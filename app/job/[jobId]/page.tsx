"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Power,
  Trash2,
  XCircle,
} from "lucide-react";
import { maskSecrets } from "@/lib/variables";
import type {
  ApiItemResponse,
  ApiListResponse,
  Execution,
  ExecutionAttempt,
  ExecutionResult,
  Job,
} from "@/types";

/** Pretty-prints a response/error body if it's JSON, otherwise returns it as-is. */
function formatBody(body: string | null): string {
  if (!body) return "—";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** The most recent attempt is the one that actually determined the outcome. */
function lastAttemptOf(attempts: ExecutionAttempt[]): ExecutionAttempt | undefined {
  return attempts[attempts.length - 1];
}

interface JobPageProps {
  params: Promise<{ jobId: string }>;
}

export default function JobPage({ params }: JobPageProps) {
  const { jobId } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [jobRes, execRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/executions?jobId=${jobId}&limit=10`),
      ]);
      const jobJson = (await jobRes.json()) as ApiItemResponse<Job>;
      const execJson = (await execRes.json()) as ApiListResponse<Execution>;

      setJob(jobJson.data ?? null);
      setExecutions(execJson.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunNow = async () => {
    setIsRunning(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/execute/${jobId}`, { method: "POST" });
      const json = (await res.json()) as ExecutionResult;
      setLastResult(json);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleActive = async () => {
    if (!job) return;
    setIsToggling(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !job.is_active }),
      });
      const json = (await res.json()) as ApiItemResponse<Job>;
      if (json.data) setJob(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      router.push(`/project/${job.project_id}`);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-neutral-600 flex justify-center items-center gap-2 mt-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>LOADING...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12 border border-neutral-800 border-dashed text-neutral-600 bg-neutral-900/50 mt-8 max-w-4xl mx-auto w-full">
        <p className="tracking-widest">JOB NOT FOUND</p>
      </div>
    );
  }

  const maskedHeaders = maskSecrets(job.parsed_request?.headers);

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full mt-8">
      <div>
        <Link
          href={`/project/${job.project_id}`}
          className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-cyan-500 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO PROJECT
        </Link>
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-100 uppercase tracking-widest">
              {job.name}
            </h1>
            <p className="text-neutral-500 text-xs mt-1 font-mono">
              {job.parsed_request?.method} {job.parsed_request?.url}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunNow}
              disabled={isRunning}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-2 text-xs font-semibold tracking-wider flex items-center gap-2 transition-colors"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              RUN NOW
            </button>
            <button
              onClick={handleToggleActive}
              disabled={isToggling}
              className={`px-3 py-2 text-xs font-semibold tracking-wider flex items-center gap-2 border transition-colors ${
                job.is_active
                  ? "border-green-700 text-green-500 hover:bg-green-950/40"
                  : "border-neutral-700 text-neutral-500 hover:bg-neutral-800"
              }`}
            >
              <Power className="w-4 h-4" />
              {job.is_active ? "ACTIVE" : "PAUSED"}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-2 text-xs font-semibold tracking-wider flex items-center gap-2 border border-neutral-800 text-neutral-500 hover:border-red-800 hover:text-red-500 transition-colors"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {lastResult && (
        <div
          className={`p-4 border rounded-sm text-sm space-y-2 ${
            lastResult.success
              ? "border-green-800 bg-green-950/20 text-green-400"
              : "border-red-800 bg-red-950/20 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {lastResult.success ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {lastResult.success ? "Execution succeeded" : "Execution failed"} — status{" "}
            {lastResult.finalStatusCode || "—"} in {lastResult.totalDuration}ms
          </div>
          {(() => {
            const attempt = lastAttemptOf(lastResult.attempts);
            const body = attempt?.response ?? null;
            const errorText = attempt?.error ?? null;
            if (!body && !errorText) return null;
            return (
              <pre className="text-xs font-mono bg-neutral-950/60 p-2 border border-white/10 overflow-x-auto whitespace-pre-wrap text-neutral-200">
                {body ? formatBody(body) : errorText}
              </pre>
            );
          })()}
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
          Request Details
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-neutral-600 text-xs uppercase">Timezone</dt>
            <dd className="text-neutral-300">{job.timezone}</dd>
          </div>
          <div>
            <dt className="text-neutral-600 text-xs uppercase">Schedule</dt>
            <dd className="text-neutral-300">{job.schedule || "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-600 text-xs uppercase">Last run</dt>
            <dd className="text-neutral-300">
              {job.last_run ? new Date(job.last_run).toLocaleString() : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-600 text-xs uppercase">Source</dt>
            <dd className="text-neutral-300">{job.source_type}</dd>
          </div>
        </dl>
        {maskedHeaders && Object.keys(maskedHeaders).length > 0 && (
          <div>
            <dt className="text-neutral-600 text-xs uppercase mb-1">Headers</dt>
            <pre className="text-xs text-neutral-400 font-mono bg-neutral-950 p-2 border border-neutral-800 overflow-x-auto">
              {JSON.stringify(maskedHeaders, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
          Execution History
        </h2>

        {executions.length === 0 ? (
          <div className="text-center py-10 border border-neutral-800 border-dashed text-neutral-600 bg-neutral-900/50">
            <p className="tracking-widest text-xs">NO EXECUTIONS YET</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {executions.map((exec) => {
              const isExpanded = expandedExecutionId === exec.id;
              const attempt = lastAttemptOf(exec.attempts ?? []);
              return (
                <div key={exec.id} className="bg-neutral-900 border border-neutral-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedExecutionId(isExpanded ? null : exec.id)}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {exec.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-neutral-400 font-mono">{exec.type}</span>
                      <span className="text-neutral-600">
                        {new Date(exec.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-neutral-500">
                      <span>{exec.final_status_code ?? "—"}</span>
                      <span>{exec.total_duration}ms</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-neutral-800 pt-2">
                      <p className="text-neutral-600 uppercase text-[10px] tracking-widest">
                        Server response ({exec.attempts?.length ?? 0} attempt
                        {exec.attempts?.length === 1 ? "" : "s"})
                      </p>
                      <pre className="text-xs font-mono bg-neutral-950 p-2 border border-neutral-800 overflow-x-auto whitespace-pre-wrap text-neutral-300">
                        {attempt?.response
                          ? formatBody(attempt.response)
                          : attempt?.error ?? "No response body recorded."}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
