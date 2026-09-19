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
   * -------------------------------------------------------------
   * تعیین نقطه شروع بر اساس آخرین رزرو تایید شده واقعی
   * -------------------------------------------------------------
   */
  let startDate: string;

  if (!job.last_success_date) {
    // اگر تا به حال رزرو موفقی نبوده، از امروز شروع کن
    startDate = today;
  } else {
    const comparison = compareDateOnly(job.last_success_date, today);

    if (comparison < 0) {
      // آخرین موفقیت مال قبل از امروز است -> باید از امروز شروع شود
      startDate = today;
    } else if (comparison === 0) {
      // آخرین موفقیت امروز بوده -> از فردا شروع کن
      startDate = addDaysToDateString(today, 1);
    } else {
      // آخرین موفقیت در روزهای آینده است (مثلاً فردا از قبل تایید شده) -> از بعد از آن شروع کن
      startDate = addDaysToDateString(job.last_success_date, 1);
    }
  }

  let currentDate = startDate;
  let datesProcessed = 0;
  let newLastSuccessfulDate: string | undefined = undefined;
  let stoppedDate: string | undefined;

  /*
   * -------------------------------------------------------------
   * پردازش روزها
   * -------------------------------------------------------------
   */
  while (datesProcessed < MAX_DAYS) {
    console.log(`[execution-chain] ${job.id} → Checking target: ${currentDate}`);

    const result = await executeJob(job, type, {
      targetDate: currentDate,
    });

    datesProcessed++;

    // حالت ۱: رزرو با موفقیت قطعی انجام شد
    if (result.success) {
      console.log(`[execution-chain] ✅ CONFIRMED RESERVATION for: ${currentDate}`);
      newLastSuccessfulDate = currentDate;
      currentDate = addDaysToDateString(currentDate, 1);
      continue;
    }

    // حالت ۲: تاریخ امروز از قبل رزرو بوده (فقط اگر امروز است رد شو و برو فردا)
    if (result.isAlreadyReserved && currentDate === today) {
      console.log(`[execution-chain] Today (${currentDate}) is already booked. Moving to tomorrow.`);
      newLastSuccessfulDate = currentDate;
      currentDate = addDaysToDateString(currentDate, 1);
      continue;
    }

    // حالت ۳: خطای احراز هویت (سشن باطل شده)
    if (result.isAuthError) {
      console.error(`[execution-chain] ❌ Auth session expired. Aborting.`);
      stoppedDate = currentDate;
      break;
    }

    // حالت ۴: هر خطای دیگری (تاریخ هنوز در سیستم باز نشده، پر است و ...)
    // ⚠️ مهم: نباید جلو برود! متوقف می‌شود تا در اجرای بعدی مجدداً همین تاریخ را چک کند
    console.warn(
      `[execution-chain] ⚠️ Target date ${currentDate} not available yet or errored. Stopping chain so it can retry later.`
    );
    stoppedDate = currentDate;
    break;
  }

  /*
   * -------------------------------------------------------------
   * بروزرسانی دیتابیس
   * فقط در صورتی last_success_date تغییر می‌کند که تایید واقعی گرفته باشد
   * -------------------------------------------------------------
   */
  const finishedAt = new Date().toISOString();
  const updateData: Record<string, string> = {
    last_run: finishedAt,
    updated_at: finishedAt,
  };

  if (newLastSuccessfulDate) {
    updateData.last_success_date = newLastSuccessfulDate;
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", job.id);

  if (updateError) {
    console.error(`[execution-chain] Failed to update job:`, updateError);
  }

  return {
    success: !stoppedDate || Boolean(newLastSuccessfulDate),
    datesProcessed,
    startedDate: startDate,
    ...(stoppedDate ? { stoppedDate } : {}),
    ...(newLastSuccessfulDate
      ? { lastSuccessfulDate: newLastSuccessfulDate }
      : job.last_success_date
      ? { lastSuccessfulDate: job.last_success_date }
      : {}),
  };
}