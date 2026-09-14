import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ApiErrorResponse, ApiItemResponse, ApiListResponse, Job } from "@/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiListResponse<Job> | ApiErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  let query = supabase.from("jobs").select("*").order("created_at", { ascending: false });
  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? []) as Job[] });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiItemResponse<Job> | ApiErrorResponse>> {
  const body = (await request.json()) as Partial<Job>;
  const {
    project_id,
    name,
    source_type,
    raw_request,
    parsed_request,
    timezone,
    schedule,
  } = body;

  const { data, error } = await supabase
    .from("jobs")
    .insert([{ project_id, name, source_type, raw_request, parsed_request, timezone, schedule }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data as Job });
}
