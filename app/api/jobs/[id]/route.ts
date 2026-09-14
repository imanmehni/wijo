import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getNextRunAt } from "@/lib/scheduler";
import type {
  ApiErrorResponse,
  ApiItemResponse,
  Job,
} from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<ApiItemResponse<Job> | ApiErrorResponse>> {
  const { id } = await params;

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: data as Job,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<ApiItemResponse<Job> | ApiErrorResponse>> {
  const { id } = await params;
  const body = (await request.json()) as Partial<Job>;

  const {
    name,
    source_type,
    raw_request,
    parsed_request,
    timezone,
    schedule,
    is_active,
  } = body;

  const { data: currentJob, error: currentJobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (currentJobError || !currentJob) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  const finalTimezone =
    timezone !== undefined
      ? timezone || "Asia/Tehran"
      : currentJob.timezone || "Asia/Tehran";

  const finalSchedule =
    schedule !== undefined
      ? schedule
      : currentJob.schedule;

  const finalIsActive =
    is_active !== undefined
      ? is_active
      : currentJob.is_active;

  const updates: Partial<Job> & {
    next_run_at?: string | null;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updates.name = name;
  if (source_type !== undefined) updates.source_type = source_type;
  if (raw_request !== undefined) updates.raw_request = raw_request;
  if (parsed_request !== undefined) {
    updates.parsed_request = parsed_request;
  }

  if (timezone !== undefined) {
    updates.timezone = finalTimezone;
  }

  if (schedule !== undefined) {
    updates.schedule = finalSchedule;
  }

  if (is_active !== undefined) {
    updates.is_active = finalIsActive;
  }

  const scheduleChanged =
    schedule !== undefined ||
    timezone !== undefined;

  if (!finalIsActive) {
    updates.next_run_at = null;
  } else if (scheduleChanged) {
    const nextRunAt = getNextRunAt(
      finalSchedule,
      finalTimezone
    );

    updates.next_run_at =
      nextRunAt?.toISOString() ?? null;
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: data as Job,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<{ success: true } | ApiErrorResponse>> {
  const { id } = await params;

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}