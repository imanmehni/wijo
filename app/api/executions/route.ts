import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ApiErrorResponse, ApiListResponse, Execution } from "@/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiListResponse<Execution> | ApiErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("executions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (jobId) {
    query = query.eq("job_id", jobId);
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = count ?? 0;

  return NextResponse.json({
    data: (data ?? []) as Execution[],
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
