import { supabase } from "@/lib/supabase";
import {
  resolveVariables,
} from "@/lib/variables";

import type {
  Job,
  ExecutionAttempt,
  ExecutionResult,
  ExecutionType,
  ResolvedRequest,
} from "@/types";

/**
 * Basic SSRF prevention.
 */
function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return false;
    }

    const host = url.hostname.toLowerCase();

    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1"
    ) {
      return false;
    }

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

function buildCookieHeader(
  cookies: Record<string, string>,
  timezone: string,
  baseDate: Date
): string {
  return Object.entries(cookies)
    .map(([key, value]) => {
      const resolvedKey = resolveVariables(
        key,
        timezone,
        baseDate
      );

      const resolvedValue = resolveVariables(
        value,
        timezone,
        baseDate
      );

      return `${resolvedKey}=${resolvedValue}`;
    })
    .join("; ");
}

/**
 * Executes one date.
 *
 * Important:
 * This function does NOT advance dates.
 * The Cron route controls the date chain.
 */
export async function executeJob(
  job: Job,
  type: ExecutionType = "MANUAL",
  baseDate: Date = new Date()
): Promise<ExecutionResult> {
  const startTime = Date.now();

  const timezone =
    job.timezone || "Asia/Tehran";

  const resolvedUrl = resolveVariables(
    job.parsed_request.url,
    timezone,
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
          error:
            "Unsafe URL (SSRF Protection)",
        },
      ],
    };
  }

  const resolvedHeaders: Record<
    string,
    string
  > = {};

  for (const [key, value] of Object.entries(
    job.parsed_request.headers || {}
  )) {
    resolvedHeaders[
      resolveVariables(
        key,
        timezone,
        baseDate
      )
    ] = resolveVariables(
      value,
      timezone,
      baseDate
    );
  }

  /**
   * Add parsed cookies if Cookie header
   * does not already exist.
   */
  const cookieHeader = buildCookieHeader(
    job.parsed_request.cookies || {},
    timezone,
    baseDate
  );

  const existingCookieKey =
    Object.keys(resolvedHeaders).find(
      (key) =>
        key.toLowerCase() === "cookie"
    );

  if (
    cookieHeader &&
    !existingCookieKey
  ) {
    resolvedHeaders.Cookie =
      cookieHeader;
  }

  const resolvedBody =
    job.parsed_request.bodyRaw
      ? resolveVariables(
          job.parsed_request.bodyRaw,
          timezone,
          baseDate
        )
      : undefined;

  const method =
    job.parsed_request.method || "GET";

  const resolvedRequest: ResolvedRequest = {
    url: resolvedUrl,
    method,
    headers: resolvedHeaders,
    body: resolvedBody,
  };

  const maxRetries = 3;

  const retryCodes = [
    408,
    429,
    500,
    502,
    503,
    504,
  ];

  const attempts: ExecutionAttempt[] = [];

  let success = false;
  let finalStatusCode = 0;

  for (
    let i = 1;
    i <= maxRetries;
    i++
  ) {
    const attemptStart = Date.now();

    let attemptSuccess = false;
    let attemptStatus = 0;
    let attemptResponse: string | null =
      null;
    let attemptError: string | null =
      null;

    const controller =
      new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      10000
    );

    try {
      const response = await fetch(
        resolvedUrl,
        {
          method,
          headers: resolvedHeaders,
          body:
            method !== "GET" &&
            method !== "HEAD"
              ? resolvedBody
              : undefined,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      attemptStatus =
        response.status;

      attemptResponse =
        await response.text();

      if (response.ok) {
        attemptSuccess = true;
      } else {
        attemptError =
          `HTTP ${response.status}`;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      attemptError =
        error instanceof Error
          ? error.message
          : String(error);
    }

    const attemptDuration =
      Date.now() - attemptStart;

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
      finalStatusCode =
        attemptStatus;

      break;
    }

    /**
     * Non-retryable HTTP errors.
     *
     * 400, 401, 403, 404, etc.
     * immediately stop this date.
     */
    if (
      !retryCodes.includes(
        attemptStatus
      ) &&
      attemptStatus !== 0
    ) {
      finalStatusCode =
        attemptStatus;

      break;
    }

    if (i < maxRetries) {
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 2000)
      );
    }
  }

  const totalDuration =
    Date.now() - startTime;

  const result: ExecutionResult = {
    success,
    attempts,
    finalStatusCode,
    totalDuration,
    resolvedRequest,
  };

  /**
   * Save execution.
   */
  try {
    await supabase
      .from("executions")
      .insert({
        job_id: job.id,
        type,
        resolved_request:
          resolvedRequest,
        attempts,
        success,
        final_status_code:
          finalStatusCode,
        total_duration:
          totalDuration,
      });
  } catch (error) {
    console.error(
      "[runner] Failed to save execution:",
      error
    );
  }

  return result;
}