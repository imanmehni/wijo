import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeJob } from "@/lib/runner";
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
  // Protect cron endpoint with CRON_SECRET if it exists
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all active jobs that have a daily schedule
  // For MVP, we will execute all jobs that are active.
  const { data: jobs, error } = await supabase.from("jobs").select("*").eq("is_active", true);

  if (error || !jobs) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  // We can execute them concurrently, but map might exceed Vercel function timeout (max 10s default, or 60s for pro)
  // We'll execute them concurrently using Promise.allSettled
  const executePromises = (jobs as Job[]).map(
    async (job): Promise<CronExecutionResult> => {
      try {
        const res = await executeJob(job, "CRON");

        // Update last_run
        await supabase
          .from("jobs")
          .update({ last_run: new Date().toISOString() })
          .eq("id", job.id);

        return { jobId: job.id, success: res.success };
      } catch (e) {
        return {
          jobId: job.id,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  );

  const executionResults = await Promise.allSettled(executePromises);

  return NextResponse.json({
    success: true,
    executed: jobs.length,
    results: executionResults,
  });
}
