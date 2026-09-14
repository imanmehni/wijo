import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ApiErrorResponse, ApiItemResponse, ApiListResponse, Project } from "@/types";

export async function GET(): Promise<
  NextResponse<ApiListResponse<Project> | ApiErrorResponse>
> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? []) as Project[] });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiItemResponse<Project> | ApiErrorResponse>> {
  const body = (await request.json()) as { name?: string };
  const { name } = body;

  const { data, error } = await supabase
    .from("projects")
    .insert([{ name }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data as Project });
}
