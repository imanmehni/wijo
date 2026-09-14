import { supabase } from "@/lib/supabase";
import { resolveVariables } from "@/lib/variables";
import type {
  Job,
  ExecutionAttempt,
  ExecutionResult,
  ExecutionType,
  ResolvedRequest,
} from "@/types";

/**
 * Basic SSRF prevention
 */
function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0")
      return false;
    // Simple regex for private IPv4
    if (
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    // Note: A full SSRF prevention on a serverless environment like Vercel usually requires more strict networking checks,
    // but this prevents the most obvious local routing issues.
    return true;
  } catch {
    return false;
  }
}

/**
 * Executes a job, resolving variables, handling retries, and returning the result.
 */
export async function executeJob(
  job: Job,
  type: ExecutionType = "MANUAL"
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 1. Resolve variables
  const resolvedUrl = resolveVariables(job.parsed_request.url, job.timezone);

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

  const resolvedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(job.parsed_request.headers || {})) {
    resolvedHeaders[resolveVariables(k, job.timezone)] = resolveVariables(
      v,
      job.timezone
    );
  }

  const resolvedBody = job.parsed_request.bodyRaw
    ? resolveVariables(job.parsed_request.bodyRaw, job.timezone)
    : undefined;
  const method = job.parsed_request.method || "GET";

  const resolvedRequest: ResolvedRequest = {
    url: resolvedUrl,
    method,
    headers: resolvedHeaders,
    body: resolvedBody,
  };

  // 2. Retry Logic
  const maxRetries = 3;
  const retryCodes = [408, 429, 500, 502, 503, 504];
  const attempts: ExecutionAttempt[] = [];
  let success = false;
  let finalStatusCode = 0;

  for (let i = 1; i <= maxRetries; i++) {
    const attemptStart = Date.now();
    let attemptSuccess = false;
    let attemptStatus = 0;
    let attemptResponse: string | null = null;
    let attemptError: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(resolvedUrl, {
        method,
        headers: resolvedHeaders,
        body: method !== "GET" && method !== "HEAD" ? resolvedBody : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      attemptStatus = res.status;
      // Read response as text (don't force JSON in case it's HTML/XML)
      attemptResponse = await res.text();

      if (res.ok) {
        attemptSuccess = true;
      } else {
        attemptError = `HTTP ${res.status}`;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      attemptError = error instanceof Error ? error.message : String(error);
    }

    const attemptDuration = Date.now() - attemptStart;
    attempts.push({
      attempt: i,
      duration: attemptDuration,
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

    if (!retryCodes.includes(attemptStatus) && attemptStatus !== 0) {
      // It's a 4xx error (not 408/429), or a successful non-200, do not retry
      finalStatusCode = attemptStatus;
      break;
    }

    if (i < maxRetries) {
      // Wait 2 seconds before retry
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const totalDuration = Date.now() - startTime;

  const result: ExecutionResult = {
    success,
    attempts,
    finalStatusCode,
    totalDuration,
    resolvedRequest,
  };

  // 3. Save Execution Log to Supabase
  if (supabase) {
    try {
      await supabase.from("executions").insert({
        job_id: job.id,
        type,
        resolved_request: resolvedRequest,
        attempts,
        success,
        final_status_code: finalStatusCode,
        total_duration: totalDuration,
      });
    } catch (err) {
      console.error("Failed to log execution to Supabase:", err);
    }
  }

  return result;
}
