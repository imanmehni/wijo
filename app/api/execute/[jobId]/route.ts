import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabase } from "@/lib/supabase";

import {
  executeJobChain,
} from "@/lib/execution-chain";

import type {
  ApiErrorResponse,
  Job,
} from "@/types";

interface RouteContext {
  params: Promise<{
    jobId: string;
  }>;
}

export async function POST(
  _request: NextRequest,
  {
    params,
  }: RouteContext
) {
  const { jobId } =
    await params;

  const {
    data: job,
    error,
  } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (
    error ||
    !job
  ) {
    return NextResponse.json(
      {
        error:
          "Job not found",
      },
      {
        status: 404,
      }
    );
  }

  try {
    /*
     * IMPORTANT:
     *
     * SEND NOW now uses the exact
     * same chain engine as CRON.
     */

    const result =
      await executeJobChain(
        job as Job,
        "MANUAL"
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Execution failed";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}