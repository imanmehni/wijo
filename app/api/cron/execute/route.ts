import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeJob } from "@/lib/runner";
import { getNextRunAt } from "@/lib/scheduler";
import type { ApiErrorResponse, Job } from "@/types";

interface CronExecutionResult {
  jobId: string;
  success: boolean;
  error?: string;
}

interface CronResponse {
  success: true;
  executed: number;
  results: PromiseSettledResult<CronExecutionResult>[];
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<CronResponse | ApiErrorResponse>> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      success: true,
      executed: 0,
      results: [],
    });
  }

  const executePromises = (jobs as Job[]).map(
    async (job): Promise<CronExecutionResult> => {
      try {
        /*
         * Move next_run_at BEFORE execution.
         *
         * This prevents the same job from being selected
         * again by another cron invocation.
         */
        const nextRunAt = getNextRunAt(
          job.schedule,
          job.timezone,
          new Date()
        );

        await supabase
          .from("jobs")
          .update({
            last_run: new Date().toISOString(),
            next_run_at: nextRunAt?.toISOString() ?? null,
          })
          .eq("id", job.id);

        const result = await executeJob(job, "CRON");

        return {
          jobId: job.id,
          success: result.success,
          ...(result.success
            ? {}
            : {
                error: `HTTP ${result.finalStatusCode}`,
              }),
        };
      } catch (error) {
        return {
          jobId: job.id,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        };
      }
    }
  );

  const executionResults =
    await Promise.allSettled(executePromises);

  return NextResponse.json({
    success: true,
    executed: jobs.length,
    results: executionResults,
  });
}