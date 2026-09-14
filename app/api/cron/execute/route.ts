import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeJob } from "@/lib/runner";
import { isJobDueToday } from "@/lib/scheduler";
import type { ApiErrorResponse, Job } from "@/types";

interface CronExecutionResult {
  jobId: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

interface CronResponse {
  success: true;
  executed: number;
  skipped: number;
  results: CronExecutionResult[];
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

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[cron] Failed to fetch jobs:", error);

    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      success: true,
      executed: 0,
      skipped: 0,
      results: [],
    });
  }

  const results: CronExecutionResult[] = [];

  const dueJobs = (jobs as Job[]).filter((job) =>
    isJobDueToday(
      job.last_run,
      job.timezone,
      new Date()
    )
  );

  const skippedJobs = (jobs as Job[]).filter(
    (job) =>
      !isJobDueToday(
        job.last_run,
        job.timezone,
        new Date()
      )
  );

  for (const job of skippedJobs) {
    results.push({
      jobId: job.id,
      success: true,
      skipped: true,
    });
  }

  const executionResults = await Promise.allSettled(
    dueJobs.map(async (job): Promise<CronExecutionResult> => {
      try {
        const result = await executeJob(job, "CRON");

        if (result.success) {
          const now = new Date().toISOString();

          const { error: updateError } = await supabase
            .from("jobs")
            .update({
              last_run: now,
              updated_at: now,
            })
            .eq("id", job.id)
            .eq("is_active", true);

          if (updateError) {
            console.error(
              `[cron] Failed to update last_run for ${job.id}:`,
              updateError
            );
          }
        }

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
        console.error(
          `[cron] Job ${job.id} failed:`,
          error
        );

        return {
          jobId: job.id,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        };
      }
    })
  );

  for (const result of executionResults) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      results.push({
        jobId: "unknown",
        success: false,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  const executed = results.filter(
    (result) =>
      !result.skipped &&
      result.success
  ).length;

  const skipped = results.filter(
    (result) => result.skipped
  ).length;

  return NextResponse.json({
    success: true,
    executed,
    skipped,
    results,
  });
}