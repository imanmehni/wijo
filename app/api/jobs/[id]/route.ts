import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

  const updates: Partial<Job> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    updates.name = name;
  }

  if (source_type !== undefined) {
    updates.source_type = source_type;
  }

  if (raw_request !== undefined) {
    updates.raw_request = raw_request;
  }

  if (parsed_request !== undefined) {
    updates.parsed_request = parsed_request;
  }

  if (timezone !== undefined) {
    updates.timezone = timezone;
  }

  if (schedule !== undefined) {
    updates.schedule = schedule;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
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
