import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeJob } from "@/lib/runner";
import { isJobDueToday, addCalendarDays } from "@/lib/scheduler";
import type { ApiErrorResponse, Job } from "@/types";

const MAX_DAYS = 30;

interface CronExecutionResult {
  jobId: string;
  success: boolean;
  skipped?: boolean;
  datesProcessed?: number;
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
}

interface CronResponse {
  success: true;
  executed: number;
  skipped: number;
  results: CronExecutionResult[];
}

function parseDateOnly(
  value: string,
  timezone: string
): Date {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );
}

function getToday(
  timezone: string
): Date {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

  const parts = formatter.formatToParts(now);

  const values: Record<string, number> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  return new Date(
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      12,
      0,
      0
    )
  );
}

export async function GET(
  request: NextRequest
): Promise<
  NextResponse<
    CronResponse | ApiErrorResponse
  >
> {
  /*
   * --------------------------------------------------
   * CRON AUTH
   * --------------------------------------------------
   */

  const authHeader =
    request.headers.get("authorization");

  const cronSecret =
    process.env.CRON_SECRET;

  if (
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * --------------------------------------------------
   * LOAD ACTIVE JOBS
   * --------------------------------------------------
   */

  const {
    data: jobs,
    error,
  } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", {
      ascending: true,
    });

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

  const results: CronExecutionResult[] =
    [];

  const now = new Date();

  /*
   * --------------------------------------------------
   * CHECK DAILY SCHEDULE
   * --------------------------------------------------
   */

  const dueJobs = (jobs as Job[]).filter(
    (job) =>
      isJobDueToday(
        job.last_run,
        job.timezone,
        now
      )
  );

  const skippedJobs = (jobs as Job[]).filter(
    (job) =>
      !isJobDueToday(
        job.last_run,
        job.timezone,
        now
      )
  );

  for (const job of skippedJobs) {
    results.push({
      jobId: job.id,
      success: true,
      skipped: true,
    });
  }

  /*
   * --------------------------------------------------
   * EXECUTE DUE JOBS
   * --------------------------------------------------
   */

  for (const job of dueJobs) {
    const timezone =
      job.timezone || "Asia/Tehran";

    try {
      /*
       * ----------------------------------------------
       * DETERMINE START DATE
       * ----------------------------------------------
       *
       * First ever execution:
       *     today
       *
       * After successful dates:
       *     last_success_date + 1
       *
       * Example:
       *
       * 15 ✅
       * 16 ✅
       * 17 ❌
       *
       * next Cron:
       * 17
       */

      let currentDate: Date;

      if (job.last_success_date) {
        const lastSuccessDate =
          parseDateOnly(
            job.last_success_date,
            timezone
          );

        currentDate =
          addCalendarDays(
            lastSuccessDate,
            1,
            timezone
          );
      } else {
        currentDate =
          getToday(timezone);
      }

      /*
       * ----------------------------------------------
       * PROCESS DATE CHAIN
       * ----------------------------------------------
       */

      let datesProcessed = 0;
      let jobSuccess = true;
      let stoppedAt:
        | string
        | undefined;

      let lastSuccessfulDate:
        | Date
        | null = null;

      const startedAt =
        currentDate
          .toISOString()
          .slice(0, 10);

      while (
        datesProcessed < MAX_DAYS
      ) {
        const currentDateString =
          currentDate
            .toISOString()
            .slice(0, 10);

        console.log(
          `[cron] Job ${job.id} → ${currentDateString}`
        );

        /*
         * Execute exactly ONE date.
         *
         * resolveVariables() receives currentDate,
         * therefore:
         *
         * (date)
         * (date+1)
         * (date-1)
         *
         * are all based on this date.
         */

        const result =
          await executeJob(
            job,
            "CRON",
            currentDate
          );

        datesProcessed++;

        /*
         * --------------------------------------------
         * SUCCESS
         * --------------------------------------------
         */

        if (result.success) {
          lastSuccessfulDate =
            currentDate;

          currentDate =
            addCalendarDays(
              currentDate,
              1,
              timezone
            );

          continue;
        }

        /*
         * --------------------------------------------
         * FAILURE → STOP
         * --------------------------------------------
         */

        jobSuccess = false;
        stoppedAt =
          currentDateString;

        console.log(
          `[cron] Job ${job.id} stopped at ${currentDateString}`
        );

        break;
      }

      /*
       * ------------------------------------------------
       * UPDATE JOB STATE
       * ------------------------------------------------
       */

      const finishedAt =
        new Date().toISOString();

      const updateData: Record<
        string,
        string | null
      > = {
        last_run: finishedAt,
        updated_at: finishedAt,
      };

      /*
       * Only update last_success_date when
       * at least one date succeeded.
       *
       * If the first date fails, the previous
       * last_success_date remains untouched.
       */

      if (lastSuccessfulDate) {
        updateData.last_success_date =
          lastSuccessfulDate
            .toISOString()
            .slice(0, 10);
      }

      const {
        error: updateError,
      } = await supabase
        .from("jobs")
        .update(updateData)
        .eq("id", job.id)
        .eq("is_active", true);

      if (updateError) {
        console.error(
          `[cron] Failed to update job ${job.id}:`,
          updateError
        );
      }

      /*
       * ------------------------------------------------
       * RESULT
       * ------------------------------------------------
       */

      results.push({
        jobId: job.id,
        success: jobSuccess,
        datesProcessed,
        startedAt,
        ...(stoppedAt
          ? {
              stoppedAt,
            }
          : {}),
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

  /*
   * --------------------------------------------------
   * SUMMARY
   * --------------------------------------------------
   */

  const executed =
    results.filter(
      (result) =>
        !result.skipped &&
        result.success
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