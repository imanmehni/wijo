import { supabase } from "@/lib/supabase";
import { resolveVariables } from "@/lib/variables";

import type {
  Job,
  ExecutionAttempt,
  ExecutionResult,
  ExecutionType,
  ResolvedRequest,
} from "@/types";

interface ExecuteJobOptions {
  targetDate?: string;
}

function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function createBaseDate(targetDate?: string): Date {
  if (!targetDate) return new Date();
  return new Date(`${targetDate}T12:00:00Z`);
}

// تابع کمکی برای تشخیص ماهیت خطا از روی پاسخ سرور
function detectErrorType(statusCode: number, responseBody: string | null) {
  const body = (responseBody || "").toLowerCase();

  // ۱. خطای احراز هویت و منقضی شدن توکن
  const isAuthError =
    statusCode === 401 ||
    statusCode === 403 ||
    body.includes("unauthorized") ||
    body.includes("توکن") ||
    body.includes("وارد شوید");

  // ۲. خطای رزرو تکراری (روز قبلاً رزرو شده)
  const isAlreadyReserved =
    statusCode === 409 ||
    body.includes("قبلاً رزرو") ||
    body.includes("قبلا رزرو") ||
    body.includes("رزرو دارید") ||
    body.includes("رزرو تکراری") ||
    body.includes("already reserved") ||
    body.includes("duplicate");

  // ۳. خطای پر بودن ظرفیت
  const isCapacityFull =
    body.includes("تکمیل") ||
    body.includes("ظرفیت") ||
    body.includes("sold out") ||
    body.includes("full");

  return { isAuthError, isAlreadyReserved, isCapacityFull };
}

export async function executeJob(
  job: Job,
  type: ExecutionType = "MANUAL",
  options: ExecuteJobOptions = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const targetDate = options.targetDate;
  const baseDate = createBaseDate(targetDate);

  /*
   * Resolve URL
   */
  const resolvedUrl = resolveVariables(
    job.parsed_request.url,
    job.timezone,
    baseDate
  );

  if (!isUrlSafe(resolvedUrl)) {
    return {
      success: false,
      finalStatusCode: 0,
      totalDuration: Date.now() - startTime,
      resolvedRequest: {
        url: resolvedUrl,
        method: job.parsed_request.method,
        headers: {},
        error: "Unsafe URL (SSRF Protection)",
      },
      attempts: [
        {
          attempt: 1,
          duration: 0,
          statusCode: 0,
          success: false,
          response: null,
          error: "Unsafe URL (SSRF Protection)",
        },
      ],
    };
  }

  /*
   * Resolve headers
   */
  const resolvedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(job.parsed_request.headers || {})) {
    resolvedHeaders[resolveVariables(key, job.timezone, baseDate)] =
      resolveVariables(value, job.timezone, baseDate);
  }

  /*
   * Resolve body
   */
  const resolvedBody = job.parsed_request.bodyRaw
    ? resolveVariables(job.parsed_request.bodyRaw, job.timezone, baseDate)
    : undefined;

  const method = job.parsed_request.method || "GET";
  const resolvedRequest: ResolvedRequest = {
    url: resolvedUrl,
    method,
    headers: resolvedHeaders,
    body: resolvedBody,
  };

  /*
   * Retry Loop
   */
  const maxRetries = 3;
  const retryCodes = [408, 429, 500, 502, 503, 504];
  const attempts: ExecutionAttempt[] = [];

  let success = false;
  let finalStatusCode = 0;
  let lastResponseBody: string | null = null;

  for (let i = 1; i <= maxRetries; i++) {
    const attemptStart = Date.now();
    let attemptSuccess = false;
    let attemptStatus = 0;
    let attemptResponse: string | null = null;
    let attemptError: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(resolvedUrl, {
        method,
        headers: resolvedHeaders,
        body: method !== "GET" && method !== "HEAD" ? resolvedBody : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      attemptStatus = response.status;
      attemptResponse = await response.text();
      lastResponseBody = attemptResponse;

      if (response.ok) {
        attemptSuccess = true;
      } else {
        attemptError = `HTTP ${response.status}`;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      attemptError = error instanceof Error ? error.message : String(error);
    }

    attempts.push({
      attempt: i,
      duration: Date.now() - attemptStart,
      statusCode: attemptStatus,
      success: attemptSuccess,
      response: attemptResponse,
      error: attemptError,
    });

    if (attemptSuccess) {
      success = true;
      finalStatusCode = attemptStatus;
      break;
    }

    // اگر خطا از جنس خطاهای موقتی سرور نبود، ادامه نده
    if (!retryCodes.includes(attemptStatus) && attemptStatus !== 0) {
      finalStatusCode = attemptStatus;
      break;
    }

    if (i < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = Date.now() - startTime;
  
  // استخراج وضعیت خطاها
  const { isAuthError, isAlreadyReserved, isCapacityFull } = detectErrorType(
    finalStatusCode,
    lastResponseBody
  );

  const result: ExecutionResult = {
    success,
    attempts,
    finalStatusCode,
    totalDuration,
    resolvedRequest,
    isAlreadyReserved,
    isAuthError,
    isCapacityFull,
  };

  /*
   * Save execution log to DB
   */
  try {
    await supabase.from("executions").insert({
      job_id: job.id,
      type,
      target_date: targetDate || null,
      resolved_request: resolvedRequest,
      attempts,
      success,
      final_status_code: finalStatusCode,
      total_duration: totalDuration,
    });
  } catch (error) {
    console.error("[runner] Failed to save execution:", error);
  }

  return result;
}