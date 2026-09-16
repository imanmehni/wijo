import { supabase } from "@/lib/supabase";

import {
  addDaysToDateString,
  compareDateOnly,
  getTodayDate,
} from "@/lib/scheduler";

import {
  executeJob,
} from "@/lib/runner";

import type {
  ExecutionType,
  Job,
} from "@/types";

const MAX_DAYS = 3;

export interface ExecutionChainResult {
  success: boolean;

  datesProcessed: number;

  startedDate: string;

  stoppedDate?: string;

  lastSuccessfulDate?: string;

  error?: string;
}

export async function executeJobChain(
  job: Job,
  type: ExecutionType
): Promise<ExecutionChainResult> {
  const timezone =
    job.timezone ||
    "Asia/Tehran";

  const today =
    getTodayDate(
      timezone
    );

  /*
   * --------------------------------------------
   * Determine starting date
   * --------------------------------------------
   *
   * IMPORTANT:
   *
   * If last success is in the past:
   *     start TODAY
   *
   * If last success is today:
   *     start TOMORROW
   *
   * If last success is future:
   *     continue AFTER it
   */

  let startDate: string;

  if (
    !job.last_success_date
  ) {
    startDate = today;
  } else {
    const comparison =
      compareDateOnly(
        job.last_success_date,
        today
      );

    if (comparison < 0) {
      startDate = today;
    } else if (
      comparison === 0
    ) {
      startDate =
        addDaysToDateString(
          today,
          1
        );
    } else {
      startDate =
        addDaysToDateString(
          job.last_success_date,
          1
        );
    }
  }

  let currentDate =
    startDate;

  let datesProcessed = 0;

  let lastSuccessfulDate:
    | string
    | undefined;

  let stoppedDate:
    | string
    | undefined;

  /*
   * --------------------------------------------
   * Chain
   * --------------------------------------------
   */

  while (
    datesProcessed <
    MAX_DAYS
  ) {
    console.log(
      `[execution-chain] ${job.id} → ${currentDate}`
    );

    const result =
      await executeJob(
        job,
        type,
        {
          targetDate:
            currentDate,
        }
      );

    datesProcessed++;

    /*
     * SUCCESS
     */

    if (
      result.success
    ) {
      lastSuccessfulDate =
        currentDate;

      currentDate =
        addDaysToDateString(
          currentDate,
          1
        );

      continue;
    }

    /*
     * FAILURE
     */

    stoppedDate =
      currentDate;

    break;
  }

  /*
   * --------------------------------------------
   * Update job
   * --------------------------------------------
   */

  const finishedAt =
    new Date().toISOString();

  const updateData: Record<
    string,
    string
  > = {
    last_run:
      finishedAt,

    updated_at:
      finishedAt,
  };

  if (
    lastSuccessfulDate
  ) {
    updateData.last_success_date =
      lastSuccessfulDate;
  }

  const {
    error: updateError,
  } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", job.id);

  if (updateError) {
    console.error(
      `[execution-chain] Failed to update job ${job.id}:`,
      updateError
    );
  }

  return {
    success:
      !stoppedDate,

    datesProcessed,

    startedDate:
      startDate,

    ...(stoppedDate
      ? {
          stoppedDate,
        }
      : {}),

    ...(lastSuccessfulDate
      ? {
          lastSuccessfulDate,
        }
      : {}),
  };
}