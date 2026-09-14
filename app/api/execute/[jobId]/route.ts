import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeJob } from "@/lib/runner";
import type { ApiErrorResponse, ExecutionResult, Job } from "@/types";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * Manually triggers a job execution (e.g. from the job detail page's
 * "Run now" button). Mirrors what the cron endpoint does for a single job.
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<ExecutionResult | ApiErrorResponse>> {
  const { jobId } = await params;

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const result = await executeJob(job as Job, "MANUAL");

    await supabase
      .from("jobs")
      .update({ last_run: new Date().toISOString() })
      .eq("id", jobId);

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
