"use client";

import { useState, useEffect, useCallback, use } from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  FileJson,
  Globe2,
  History,
  Loader2,
  Pause,
  Play,
  Power,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatBody(body: string | null): string {
  if (!body) return "—";

  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fa-IR");
}

function formatTargetDate(value: string | null | undefined): string {
  if (!value) return "—";

  try {
    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function lastAttemptOf(
  attempts: ExecutionAttempt[],
): ExecutionAttempt | undefined {
  return attempts[attempts.length - 1];
}

function getStatusLabel(status: number | null): string {
  if (!status) return "NO RESPONSE";

  if (status >= 200 && status < 300) {
    return "SUCCESS";
  }

  if (status >= 300 && status < 400) {
    return "REDIRECT";
  }

  if (status >= 400 && status < 500) {
    return "CLIENT ERROR";
  }

  if (status >= 500) {
    return "SERVER ERROR";
  }

  return "UNKNOWN";
}

function getStatusClass(status: number | null): string {
  if (!status) {
    return "text-neutral-500";
  }

  if (status >= 200 && status < 300) {
    return "text-green-400";
  }

  if (status >= 300 && status < 400) {
    return "text-yellow-400";
  }

  if (status >= 400) {
    return "text-red-400";
  }

  return "text-neutral-400";
}

function truncate(value: string, length = 80): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}…`;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface JobPageProps {
  params: Promise<{
    jobId: string;
  }>;
}

interface ExecutionChainResult {
  success: boolean;
  datesProcessed: number;
  startedDate: string;
  stoppedDate?: string;
  lastSuccessfulDate?: string;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function JobPage({ params }: JobPageProps) {
  const { jobId } = use(params);

  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);

  const [executions, setExecutions] = useState<Execution[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [isRunning, setIsRunning] = useState(false);

  const [isToggling, setIsToggling] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const [lastResult, setLastResult] = useState<ExecutionChainResult | null>(
    null,
  );

  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(
    null,
  );

  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      }

      try {
        const [jobRes, execRes] = await Promise.all([
          fetch(`/api/jobs/${jobId}`),
          fetch(`/api/executions?jobId=${jobId}&limit=10`),
        ]);

        if (!jobRes.ok) {
          throw new Error("Failed to load job");
        }

        if (!execRes.ok) {
          throw new Error("Failed to load executions");
        }

        const jobJson = (await jobRes.json()) as ApiItemResponse<Job>;

        const execJson = (await execRes.json()) as ApiListResponse<Execution>;

        setJob(jobJson.data ?? null);

        setExecutions(execJson.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [jobId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ------------------------------------------------------------------------ */
  /* Run                                                                       */
  /* ------------------------------------------------------------------------ */

  const handleRunNow = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setLastResult(null);

    try {
      const res = await fetch(`/api/execute/${jobId}`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Execution failed");
      }

      setLastResult(json as ExecutionChainResult);

      await loadData();
    } catch (err) {
      console.error(err);

      setLastResult({
        success: false,
        datesProcessed: 0,
        startedDate: "",
        error: err instanceof Error ? err.message : "Execution failed",
      });
    } finally {
      setIsRunning(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Toggle                                                                    */
  /* ------------------------------------------------------------------------ */

  const handleToggleActive = async () => {
    if (!job || isToggling) return;

    setIsToggling(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !job.is_active,
        }),
      });

      const json = (await res.json()) as ApiItemResponse<Job>;

      if (json.data) {
        setJob(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsToggling(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Delete                                                                    */
  /* ------------------------------------------------------------------------ */

  const handleDelete = async () => {
    if (!job || isDeleting) {
      return;
    }

    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      router.push(`/project/${job.project_id}`);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Copy                                                                      */
  /* ------------------------------------------------------------------------ */

  const handleCopyUrl = async () => {
    if (!job?.parsed_request?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(job.parsed_request.url);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                   */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />

          <span className="text-xs tracking-[0.25em]">
            LOADING JOB CONSOLE...
          </span>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Not found                                                                 */
  /* ------------------------------------------------------------------------ */

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto w-full mt-10">
        <div className="border border-neutral-800 border-dashed bg-neutral-900/50 py-16 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />

          <p className="text-xs tracking-[0.25em] text-neutral-500">
            JOB NOT FOUND
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 text-xs text-cyan-500 hover:text-cyan-400"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Derived                                                                   */
  /* ------------------------------------------------------------------------ */

  const maskedHeaders = maskSecrets(job.parsed_request?.headers);

  const totalExecutions = executions.length;

  const successfulExecutions = executions.filter((item) => item.success).length;

  const failedExecutions = executions.filter((item) => !item.success).length;

  const latestExecution = executions[0];

  const latestAttempt = latestExecution
    ? lastAttemptOf(latestExecution.attempts ?? [])
    : undefined;

  const successRate =
    totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 100)
      : 0;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}

      <div>
        <Link
          href={`/project/${job.project_id}`}
          className="inline-flex items-center gap-2 text-[11px] tracking-widest text-neutral-600 hover:text-cyan-400 transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO PROJECT
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  job.is_active
                    ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,.6)]"
                    : "bg-neutral-600"
                }`}
              />

              <span className="text-[10px] tracking-[0.3em] text-neutral-600 uppercase">
                {job.is_active ? "MONITORING ACTIVE" : "MONITORING PAUSED"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
              {job.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="px-2 py-1 border border-neutral-800 bg-neutral-900 text-cyan-400 font-mono text-[10px]">
                {job.parsed_request?.method}
              </span>

              <span className="text-neutral-600 text-xs">/</span>

              <span className="font-mono text-xs text-neutral-500 truncate max-w-[650px]">
                {job.parsed_request?.url}
              </span>
            </div>
          </div>

          {/* Actions */}

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh"
              className="h-9 w-9 border border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-200 hover:border-neutral-700 flex items-center justify-center transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>

            <button
              onClick={handleRunNow}
              disabled={isRunning}
              className="h-9 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[11px] font-bold tracking-widest flex items-center gap-2 transition-colors"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}

              {isRunning ? "RUNNING..." : "RUN NOW"}
            </button>

            <button
              onClick={handleToggleActive}
              disabled={isToggling}
              className={`h-9 px-3 text-[10px] font-bold tracking-widest flex items-center gap-2 border transition-colors ${
                job.is_active
                  ? "border-green-800/70 text-green-500 hover:bg-green-950/30"
                  : "border-neutral-700 text-neutral-500 hover:bg-neutral-800"
              }`}
            >
              {isToggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : job.is_active ? (
                <Power className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}

              {job.is_active ? "ACTIVE" : "PAUSED"}
            </button>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete job"
              className="h-9 w-9 border border-neutral-800 text-neutral-600 hover:border-red-800 hover:text-red-500 flex items-center justify-center transition-colors"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Live Run Result                                                    */}
      {/* ================================================================== */}

      {lastResult && (
        <section
          className={`border ${
            lastResult.success
              ? "border-green-900/80 bg-green-950/10"
              : "border-red-900/80 bg-red-950/10"
          }`}
        >
          <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {lastResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}

              <div>
                <div
                  className={`text-xs font-bold tracking-widest ${
                    lastResult.success ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {lastResult.success ? "CHAIN COMPLETED" : "CHAIN STOPPED"}
                </div>

                <div className="text-[10px] text-neutral-600 mt-1">
                  {lastResult.datesProcessed} date
                  {lastResult.datesProcessed === 1 ? "" : "s"} processed
                </div>
              </div>
            </div>

            {lastResult.lastSuccessfulDate && (
              <div className="text-right">
                <div className="text-[9px] tracking-widest text-neutral-600 uppercase">
                  Last successful target
                </div>

                <div className="text-xs font-mono text-green-400 mt-1">
                  {lastResult.lastSuccessfulDate}
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {lastResult.startedDate && (
                <span className="px-2 py-1 bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-400">
                  START: {lastResult.startedDate}
                </span>
              )}

              {lastResult.stoppedDate && (
                <span className="px-2 py-1 bg-red-950/30 border border-red-900/50 text-[10px] font-mono text-red-400">
                  STOPPED: {lastResult.stoppedDate}
                </span>
              )}
            </div>

            {lastResult.error && (
              <div className="mt-3 text-xs text-red-400 font-mono bg-red-950/20 border border-red-900/40 p-3">
                {lastResult.error}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* Overview Stats                                                     */}
      {/* ================================================================== */}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em] text-neutral-600 uppercase">
              Executions
            </span>

            <History className="w-4 h-4 text-neutral-700" />
          </div>

          <div className="text-2xl font-semibold text-neutral-200 mt-3">
            {totalExecutions}
          </div>

          <div className="text-[10px] text-neutral-600 mt-1">latest loaded</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em] text-neutral-600 uppercase">
              Success Rate
            </span>

            <CheckCircle2 className="w-4 h-4 text-green-700" />
          </div>

          <div className="text-2xl font-semibold text-green-400 mt-3">
            {successRate}%
          </div>

          <div className="text-[10px] text-neutral-600 mt-1">
            {successfulExecutions} successful
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em] text-neutral-600 uppercase">
              Failures
            </span>

            <XCircle className="w-4 h-4 text-red-700" />
          </div>

          <div className="text-2xl font-semibold text-red-400 mt-3">
            {failedExecutions}
          </div>

          <div className="text-[10px] text-neutral-600 mt-1">
            failed executions
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em] text-neutral-600 uppercase">
              Last Status
            </span>

            <Server className="w-4 h-4 text-neutral-700" />
          </div>

          <div
            className={`text-2xl font-semibold mt-3 ${getStatusClass(
              latestExecution?.final_status_code ?? null,
            )}`}
          >
            {latestExecution?.final_status_code ?? "—"}
          </div>

          <div className="text-[10px] text-neutral-600 mt-1">
            {getStatusLabel(latestExecution?.final_status_code ?? null)}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Main Grid                                                           */}
      {/* ================================================================== */}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ================================================================ */}
        {/* LEFT                                                              */}
        {/* ================================================================ */}

        <div className="space-y-6">
          {/* -------------------------------------------------------------- */}
          {/* Execution Timeline / Chain                                     */}
          {/* -------------------------------------------------------------- */}

          <section className="bg-neutral-900 border border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-neutral-300">
                  EXECUTION PIPELINE
                </h2>

                <p className="text-[10px] text-neutral-600 mt-1">
                  Target-date processing chain
                </p>
              </div>

              <Zap className="w-4 h-4 text-cyan-700" />
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  {
                    label: "TODAY",
                    value: job.last_success_date || "CURRENT",
                  },
                  {
                    label: "+1 DAY",
                    value: "NEXT TARGET",
                  },
                  {
                    label: "+2 DAYS",
                    value: "NEXT TARGET",
                  },
                ].map((item, index) => (
                  <div key={item.label} className="flex items-center shrink-0">
                    <div
                      className={`min-w-[150px] border p-3 ${
                        index === 0
                          ? "border-cyan-900/70 bg-cyan-950/10"
                          : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] tracking-widest text-neutral-600">
                          {item.label}
                        </span>

                        {index === 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        )}
                      </div>

                      <div className="text-xs font-mono text-neutral-300 mt-3">
                        {item.value}
                      </div>
                    </div>

                    {index < 2 && <div className="w-8 h-px bg-neutral-800" />}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-600">
                <ShieldCheck className="w-3.5 h-3.5 text-green-700" />

                <span>
                  Stops automatically on the first final failure. Retries are
                  handled per target date.
                </span>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Request                                                          */}
          {/* -------------------------------------------------------------- */}

          <section className="bg-neutral-900 border border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-neutral-300">
                  REQUEST CONFIGURATION
                </h2>

                <p className="text-[10px] text-neutral-600 mt-1">
                  Parsed request used by the runner
                </p>
              </div>

              <FileJson className="w-4 h-4 text-neutral-700" />
            </div>

            <div className="p-4 space-y-4">
              {/* URL */}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] tracking-widest text-neutral-600">
                    ENDPOINT
                  </span>

                  <button
                    onClick={handleCopyUrl}
                    className="text-[9px] text-neutral-600 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        COPIED
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        COPY
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 p-3 flex items-start gap-3">
                  <Globe2 className="w-4 h-4 text-cyan-800 mt-0.5 shrink-0" />

                  <code className="text-[11px] font-mono text-neutral-400 break-all">
                    {job.parsed_request?.url}
                  </code>
                </div>
              </div>

              {/* Method / Source / Timezone */}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoBox
                  label="METHOD"
                  value={job.parsed_request?.method || "—"}
                />

                <InfoBox label="SOURCE" value={job.source_type} />

                <InfoBox label="TIMEZONE" value={job.timezone} />

                <InfoBox label="SCHEDULE" value={job.schedule || "CRON"} />
              </div>

              {/* Headers */}

              {maskedHeaders && Object.keys(maskedHeaders).length > 0 && (
                <div>
                  <div className="text-[9px] tracking-widest text-neutral-600 mb-2">
                    HEADERS
                  </div>

                  <pre className="text-[10px] leading-5 text-neutral-400 font-mono bg-neutral-950 border border-neutral-800 p-3 overflow-x-auto max-h-[260px]">
                    {JSON.stringify(maskedHeaders, null, 2)}
                  </pre>
                </div>
              )}

              {/* Body */}

              {job.parsed_request?.bodyRaw && (
                <div>
                  <div className="text-[9px] tracking-widest text-neutral-600 mb-2">
                    REQUEST BODY
                  </div>

                  <pre className="text-[10px] leading-5 text-neutral-400 font-mono bg-neutral-950 border border-neutral-800 p-3 overflow-x-auto max-h-[260px] whitespace-pre-wrap">
                    {formatBody(job.parsed_request.bodyRaw)}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Execution History                                               */}
          {/* -------------------------------------------------------------- */}

          <section>
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-neutral-300">
                  EXECUTION HISTORY
                </h2>

                <p className="text-[10px] text-neutral-600 mt-1">
                  Latest 10 executions
                </p>
              </div>

              <span className="text-[9px] font-mono text-neutral-700">
                {executions.length} RECORDS
              </span>
            </div>

            {executions.length === 0 ? (
              <div className="border border-neutral-800 border-dashed bg-neutral-900/50 py-16 text-center">
                <History className="w-7 h-7 text-neutral-800 mx-auto mb-3" />

                <p className="text-[10px] tracking-[0.2em] text-neutral-600">
                  NO EXECUTIONS YET
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {executions.map((exec) => {
                  const isExpanded = expandedExecutionId === exec.id;

                  const attempts = exec.attempts ?? [];

                  const lastAttempt = lastAttemptOf(attempts);

                  return (
                    <div
                      key={exec.id}
                      className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                    >
                      {/* Execution Header */}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedExecutionId(isExpanded ? null : exec.id)
                        }
                        className="w-full text-left p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5">
                              {exec.success ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold tracking-widest text-neutral-400">
                                  {exec.type}
                                </span>

                                <span className="text-neutral-800">•</span>

                                <span className="text-[10px] font-mono text-cyan-700">
                                  TARGET
                                </span>

                                <span className="text-[10px] font-mono text-neutral-300">
                                  {exec.target_date || "—"}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                <span className="text-[10px] text-neutral-600 flex items-center gap-1.5">
                                  <Clock3 className="w-3 h-3" />
                                  SENT {formatDate(exec.created_at)}
                                </span>

                                <span className="text-[10px] text-neutral-700 font-mono">
                                  ID {truncate(exec.id, 18)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="hidden sm:block text-right">
                              <div
                                className={`text-sm font-mono font-bold ${getStatusClass(
                                  exec.final_status_code,
                                )}`}
                              >
                                {exec.final_status_code ?? "—"}
                              </div>

                              <div className="text-[8px] tracking-widest text-neutral-700 mt-0.5">
                                {getStatusLabel(exec.final_status_code)}
                              </div>
                            </div>

                            <div className="hidden sm:block text-right">
                              <div className="text-xs font-mono text-neutral-400">
                                {exec.total_duration}ms
                              </div>

                              <div className="text-[8px] tracking-widest text-neutral-700 mt-0.5">
                                DURATION
                              </div>
                            </div>

                            <div className="text-neutral-700">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mobile metrics */}

                        <div className="sm:hidden flex items-center gap-4 mt-4 pt-3 border-t border-neutral-800">
                          <span
                            className={`font-mono font-bold ${getStatusClass(
                              exec.final_status_code,
                            )}`}
                          >
                            {exec.final_status_code ?? "—"}
                          </span>

                          <span className="text-neutral-700">•</span>

                          <span className="text-neutral-500 font-mono">
                            {exec.total_duration}
                            ms
                          </span>

                          <span className="text-neutral-700">•</span>

                          <span className="text-neutral-600">
                            {attempts.length} attempts
                          </span>
                        </div>
                      </button>

                      {/* Expanded */}

                      {isExpanded && (
                        <div className="border-t border-neutral-800 p-4 space-y-4">
                          {/* Target / Send Time */}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <DetailBox
                              label="TARGET DATE"
                              value={
                                exec.target_date
                                  ? formatTargetDate(exec.target_date)
                                  : "—"
                              }
                              mono
                            />

                            <DetailBox
                              label="ACTUAL SEND TIME"
                              value={formatDate(exec.created_at)}
                            />

                            <DetailBox
                              label="TOTAL DURATION"
                              value={`${exec.total_duration} ms`}
                              mono
                            />
                          </div>

                          {/* Attempts */}

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] tracking-widest text-neutral-600">
                                ATTEMPT TRACE
                              </span>

                              <span className="text-[9px] font-mono text-neutral-700">
                                {attempts.length} ATTEMPT
                                {attempts.length === 1 ? "" : "S"}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {attempts.map((attempt) => {
                                const attemptKey = `${exec.id}-${attempt.attempt}`;

                                const open = expandedAttempt === attemptKey;

                                return (
                                  <div
                                    key={attemptKey}
                                    className="border border-neutral-800 bg-neutral-950"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedAttempt(
                                          open ? null : attemptKey,
                                        )
                                      }
                                      className="w-full flex items-center justify-between p-3 text-left"
                                    >
                                      <div className="flex items-center gap-3">
                                        {attempt.success ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                        ) : (
                                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                                        )}

                                        <span className="text-[10px] font-mono text-neutral-500">
                                          ATTEMPT {attempt.attempt}
                                        </span>

                                        <span
                                          className={`text-[10px] font-mono font-bold ${getStatusClass(
                                            attempt.statusCode,
                                          )}`}
                                        >
                                          {attempt.statusCode || "NETWORK"}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-mono text-neutral-600">
                                          {attempt.duration}ms
                                        </span>

                                        {open ? (
                                          <ChevronUp className="w-3.5 h-3.5 text-neutral-700" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 text-neutral-700" />
                                        )}
                                      </div>
                                    </button>

                                    {open && (
                                      <div className="border-t border-neutral-800 p-3 space-y-3">
                                        {attempt.error && (
                                          <div className="border border-red-900/50 bg-red-950/20 p-3">
                                            <div className="text-[9px] tracking-widest text-red-700 mb-2">
                                              ERROR
                                            </div>

                                            <pre className="text-[10px] text-red-400 font-mono whitespace-pre-wrap">
                                              {attempt.error}
                                            </pre>
                                          </div>
                                        )}

                                        {attempt.response && (
                                          <div>
                                            <div className="text-[9px] tracking-widest text-neutral-700 mb-2">
                                              RESPONSE
                                            </div>

                                            <pre className="text-[10px] leading-5 font-mono bg-black border border-neutral-800 p-3 text-neutral-400 overflow-x-auto max-h-[400px] whitespace-pre-wrap">
                                              {formatBody(attempt.response)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Resolved Request */}

                          {exec.resolved_request && (
                            <div>
                              <div className="text-[9px] tracking-widest text-neutral-600 mb-2">
                                RESOLVED REQUEST
                              </div>

                              <div className="bg-neutral-950 border border-neutral-800 p-3">
                                <pre className="text-[10px] leading-5 font-mono text-neutral-500 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(
                                    {
                                      method: exec.resolved_request.method,
                                      url: exec.resolved_request.url,
                                      headers: maskSecrets(
                                        exec.resolved_request.headers,
                                      ),
                                      body:
                                        exec.resolved_request.body ?? undefined,
                                    },
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ================================================================ */}
        {/* RIGHT SIDEBAR                                                     */}
        {/* ================================================================ */}

        <aside className="space-y-4">
          {/* Job Status */}

          <section className="bg-neutral-900 border border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] tracking-[0.2em] text-neutral-600">
                JOB STATUS
              </span>

              {job.is_active ? (
                <span className="flex items-center gap-1.5 text-[9px] text-green-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  ONLINE
                </span>
              ) : (
                <span className="text-[9px] text-neutral-600">OFFLINE</span>
              )}
            </div>

            <div className="space-y-3">
              <StatusRow
                label="Current state"
                value={job.is_active ? "ACTIVE" : "PAUSED"}
                positive={job.is_active}
              />

              <StatusRow label="Source" value={job.source_type} />

              <StatusRow label="Timezone" value={job.timezone} />

              <StatusRow label="Schedule" value={job.schedule || "CRON"} />
            </div>
          </section>

          {/* Dates */}

          <section className="bg-neutral-900 border border-neutral-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-neutral-700" />

              <span className="text-[9px] tracking-[0.2em] text-neutral-600">
                EXECUTION DATES
              </span>
            </div>

            <div className="space-y-4">
              <DateItem label="LAST RUN" value={formatDate(job.last_run)} />

              <DateItem
                label="LAST SUCCESSFUL TARGET"
                value={
                  job.last_success_date
                    ? formatTargetDate(job.last_success_date)
                    : "Never"
                }
                accent={!!job.last_success_date}
              />

              <DateItem label="CREATED" value={formatDate(job.created_at)} />

              <DateItem label="UPDATED" value={formatDate(job.updated_at)} />
            </div>
          </section>

          {/* Latest Execution */}

          <section className="bg-neutral-900 border border-neutral-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-neutral-700" />

              <span className="text-[9px] tracking-[0.2em] text-neutral-600">
                LATEST EXECUTION
              </span>
            </div>

            {latestExecution ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">Status</span>

                  <span
                    className={`text-xs font-mono font-bold ${getStatusClass(
                      latestExecution.final_status_code,
                    )}`}
                  >
                    {latestExecution.final_status_code ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">Target</span>

                  <span className="text-[10px] font-mono text-neutral-400">
                    {latestExecution.target_date || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">Duration</span>

                  <span className="text-[10px] font-mono text-neutral-400">
                    {latestExecution.total_duration}
                    ms
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">Attempts</span>

                  <span className="text-[10px] font-mono text-neutral-400">
                    {latestExecution.attempts?.length}
                  </span>
                </div>

                <div className="pt-3 border-t border-neutral-800">
                  <span className="text-[9px] tracking-widest text-neutral-700">
                    RESPONSE
                  </span>

                  <div className="text-[10px] font-mono text-neutral-500 mt-2">
                    {latestAttempt?.response
                      ? truncate(latestAttempt.response, 120)
                      : latestAttempt?.error || "No response"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-neutral-700">
                No execution data.
              </div>
            )}
          </section>

          {/* Security */}

          <section className="border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-800" />

              <span className="text-[9px] tracking-[0.2em] text-neutral-600">
                SECURITY
              </span>
            </div>

            <div className="mt-3 space-y-2 text-[9px] text-neutral-700">
              <div className="flex justify-between">
                <span>Credentials</span>
                <span className="text-green-800">MASKED</span>
              </div>

              <div className="flex justify-between">
                <span>Request logging</span>
                <span className="text-green-800">SAFE</span>
              </div>

              <div className="flex justify-between">
                <span>SSRF protection</span>
                <span className="text-green-800">ENABLED</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI Components                                                        */
/* -------------------------------------------------------------------------- */

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 p-3">
      <div className="text-[8px] tracking-widest text-neutral-700">{label}</div>

      <div className="text-[10px] font-mono text-neutral-400 mt-2 truncate">
        {value}
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 p-3">
      <div className="text-[8px] tracking-widest text-neutral-700">{label}</div>

      <div
        className={`text-[10px] text-neutral-400 mt-2 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] text-neutral-600">{label}</span>

      <span
        className={`text-[10px] font-mono ${
          positive ? "text-green-500" : "text-neutral-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DateItem({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[8px] tracking-widest text-neutral-700">{label}</div>

      <div
        className={`text-[10px] font-mono mt-1 ${
          accent ? "text-green-500" : "text-neutral-400"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
