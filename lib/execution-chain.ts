import { supabase } from "@/lib/supabase";
import {
  addDaysToDateString,
  compareDateOnly,
  getTodayDate,
} from "@/lib/scheduler";
import { executeJob } from "@/lib/runner";
import type { ExecutionType, Job } from "@/types";

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
  const timezone = job.timezone || "Asia/Tehran";
  const today = getTodayDate(timezone);

  /*
   * محاسبه تاریخ شروع
   */
  let startDate: string;

  if (!job.last_success_date) {
    startDate = today;
  } else {
    const comparison = compareDateOnly(job.last_success_date, today);
    if (comparison < 0) {
      startDate = today;
    } else if (comparison === 0) {
      startDate = addDaysToDateString(today, 1);
    } else {
      startDate = addDaysToDateString(job.last_success_date, 1);
    }
  }

  let currentDate = startDate;
  let datesProcessed = 0;
  let lastSuccessfulDate: string | undefined = job.last_success_date || undefined;
  let stoppedDate: string | undefined;

  /*
   * اجرای زنجیره روزها
   */
  while (datesProcessed < MAX_DAYS) {
    console.log(`[execution-chain] ${job.id} → Checking target: ${currentDate}`);

    const result = await executeJob(job, type, {
      targetDate: currentDate,
    });

    datesProcessed++;

    // حالت اول: رزرو با موفقیت انجام شد
    if (result.success) {
      console.log(`[execution-chain] Successfully reserved: ${currentDate}`);
      lastSuccessfulDate = currentDate;
      currentDate = addDaysToDateString(currentDate, 1);
      continue;
    }

    // حالت دوم: این تاریخ از قبل رزرو شده بود (نباید حلقه قطع شود!)
    if (result.isAlreadyReserved) {
      console.log(
        `[execution-chain] ${currentDate} is ALREADY RESERVED. Skipping to next day.`
      );
      lastSuccessfulDate = currentDate;
      currentDate = addDaysToDateString(currentDate, 1);
      continue;
    }

    // حالت سوم: خطای بحرانی احراز هویت (سشن منقضی شده)
    if (result.isAuthError) {
      console.error(
        `[execution-chain] Critical Auth/Session error on ${currentDate}. Aborting chain.`
      );
      stoppedDate = currentDate;
      break;
    }

    // حالت چهارم: ظرفیت تکمیل است
    if (result.isCapacityFull) {
      console.warn(
        `[execution-chain] Capacity full on ${currentDate}. Checking tomorrow...`
      );
      currentDate = addDaysToDateString(currentDate, 1);
      continue;
    }

    // سایر خطاها (مثلاً خارج از بازه مجاز سیستم رزرواسیون)
    console.warn(`[execution-chain] Unhandled failure on ${currentDate}. Halting.`);
    stoppedDate = currentDate;
    break;
  }

  /*
   * ذخیره آخرین وضعیت جاب در دیتابیس
   */
  const finishedAt = new Date().toISOString();
  const updateData: Record<string, string> = {
    last_run: finishedAt,
    updated_at: finishedAt,
  };

  if (lastSuccessfulDate) {
    updateData.last_success_date = lastSuccessfulDate;
  }

  const { error: updateError } = await supabase
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
    success: !stoppedDate || Boolean(lastSuccessfulDate),
    datesProcessed,
    startedDate: startDate,
    ...(stoppedDate ? { stoppedDate } : {}),
    ...(lastSuccessfulDate ? { lastSuccessfulDate } : {}),
  };
}