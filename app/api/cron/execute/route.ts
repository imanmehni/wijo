import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabase } from "@/lib/supabase";

import {
  executeJobChain,
} from "@/lib/execution-chain";

import {
  isJobDueToday,
} from "@/lib/scheduler";

import type {
  ApiErrorResponse,
  Job,
} from "@/types";

interface CronExecutionResult {
  jobId: string;
  success: boolean;
  skipped?: boolean;

  datesProcessed?: number;

  startedDate?: string;
  stoppedDate?: string;

  lastSuccessfulDate?: string;

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
): Promise<
  NextResponse<
    CronResponse |
      ApiErrorResponse
  >
> {
  /*
   * AUTH
   */

  const authHeader =
    request.headers.get(
      "authorization"
    );

  const cronSecret =
    process.env.CRON_SECRET;

  if (
    cronSecret &&
    authHeader !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * LOAD ACTIVE JOBS
   */

  const {
    data: jobs,
    error,
  } = await supabase
    .from("jobs")
    .select("*")
    .eq(
      "is_active",
      true
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "[cron] Failed to fetch jobs:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch jobs",
      },
      {
        status: 500,
      }
    );
  }

  if (
    !jobs ||
    jobs.length === 0
  ) {
    return NextResponse.json({
      success: true,
      executed: 0,
      skipped: 0,
      results: [],
    });
  }

  const results:
    CronExecutionResult[] =
    [];

  const now =
    new Date();

  /*
   * Only run once per calendar day.
   */

  const dueJobs =
    (jobs as Job[]).filter(
      (job) =>
        isJobDueToday(
          job.last_run,
          job.timezone,
          now
        )
    );

  const skippedJobs =
    (jobs as Job[]).filter(
      (job) =>
        !isJobDueToday(
          job.last_run,
          job.timezone,
          now
        )
    );

  for (
    const job of skippedJobs
  ) {
    results.push({
      jobId: job.id,
      success: true,
      skipped: true,
    });
  }

  /*
   * Execute chains
   */

  for (
    const job of dueJobs
  ) {
    try {
      const result =
        await executeJobChain(
          job,
          "CRON"
        );

      results.push({
        jobId: job.id,

        success:
          result.success,

        datesProcessed:
          result.datesProcessed,

        startedDate:
          result.startedDate,

        stoppedDate:
          result.stoppedDate,

        lastSuccessfulDate:
          result.lastSuccessfulDate,
      });
    } catch (error) {
      console.error(
        `[cron] Job ${job.id} failed:`,
        error
      );

      results.push({
        jobId: job.id,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const executed =
    results.filter(
      (result) =>
        !result.skipped
    ).length;

  const skipped =
    results.filter(
      (result) =>
        result.skipped
    ).length;

  return NextResponse.json({
    success: true,
    executed,
    skipped,
    results,
  });
}