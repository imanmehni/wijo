export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type SourceType = "fetch" | "curl";

export type ExecutionType = "MANUAL" | "CRON";

/** Shape produced by lib/parsers.ts (parseFetch / parseCurl). */
export interface ParsedRequest {
  method: HttpMethod | string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  bodyRaw: string | null;
  url: string;
}

/** A resolved (variables substituted) request, ready to be sent. */
export interface ResolvedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export interface Job {
  id: string;
  project_id: string;
  name: string;
  source_type: SourceType;
  raw_request: string;
  parsed_request: ParsedRequest;
  timezone: string;
  schedule: string | null;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
  last_success_date: string | null;
}

export interface ExecutionAttempt {
  attempt: number;
  duration: number;
  statusCode: number;
  success: boolean;
  response: string | null;
  error: string | null;
}

export interface Execution {
  id: string;
  job_id: string;
  type: ExecutionType;
  resolved_request: ResolvedRequest;
  attempts: ExecutionAttempt[];
  success: boolean;
  final_status_code: number | null;
  total_duration: number;
  created_at: string;
}

/** Result returned by lib/runner.ts executeJob(). */
export interface ExecutionResult {
  success: boolean;
  attempts: ExecutionAttempt[];
  finalStatusCode: number;
  totalDuration: number;
  resolvedRequest: ResolvedRequest;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta?: PaginationMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
}
