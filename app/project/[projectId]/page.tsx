"use client";

import { useState, useEffect, useCallback, use, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Plus,
  Terminal as TerminalIcon,
  Zap,
  Sparkles,
  Key,
  Info,
} from "lucide-react";
import { parseCurl, parseFetch } from "@/lib/parsers";
import type { ApiItemResponse, ApiListResponse, Job, Project, SourceType } from "@/types";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

const WIJO_TEMPLATE = (token: string) => `curl 'https://wijo.ir/api/reservations' \\
  -H 'Accept: */*' \\
  -H 'Accept-Language: en-US,en;q=0.9' \\
  -H 'Connection: keep-alive' \\
  -H 'Content-Type: application/json' \\
  -b 'authjs.session-token=${token || "YOUR_SESSION_TOKEN_HERE"}' \\
  -H 'Origin: https://wijo.ir' \\
  -H 'Referer: https://wijo.ir/reserve' \\
  -H 'Sec-Fetch-Dest: empty' \\
  -H 'Sec-Fetch-Mode: cors' \\
  -H 'Sec-Fetch-Site: same-origin' \\
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' \\
  -H 'sec-ch-ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"' \\
  -H 'sec-ch-ua-mobile: ?0' \\
  -H 'sec-ch-ua-platform: "Linux"' \\
  --data-raw '{"spaceId":"innovation-hall","date":"(date)"}'`;

export default function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceType, setSourceType] = useState<SourceType>("curl");
  const [jobName, setJobName] = useState("");
  const [rawRequest, setRawRequest] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [timezone, setTimezone] = useState("Asia/Tehran");
  const [schedule, setSchedule] = useState("00:01 DAILY");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [projectsRes, jobsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/jobs?projectId=${projectId}`),
      ]);
      const projectsJson = (await projectsRes.json()) as ApiListResponse<Project>;
      const jobsJson = (await jobsRes.json()) as ApiListResponse<Job>;

      const found = projectsJson.data?.find((p) => p.id === projectId) ?? null;
      setProject(found);
      setJobs(jobsJson.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // اکشن بارگذاری قالب آماده Wijo
  const handleApplyWijoPreset = () => {
    setSourceType("curl");
    if (!jobName) setJobName("رزرو سالن نوآوری Wijo");
    setRawRequest(WIJO_TEMPLATE(sessionToken));
  };

  // هر زمان توکن تایپ شد، اگر قالب Wijo بود خودکار در textarea آپدیت شود
  const handleTokenChange = (token: string) => {
    setSessionToken(token);
    if (rawRequest.includes("authjs.session-token=") || rawRequest.includes("wijo.ir")) {
      const updated = rawRequest.replace(
        /authjs\.session-token=[^' ;"]*/,
        `authjs.session-token=${token.trim() || "YOUR_SESSION_TOKEN_HERE"}`
      );
      setRawRequest(updated);
    } else {
      setRawRequest(WIJO_TEMPLATE(token.trim()));
    }
  };

  const handleCreateJob = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jobName.trim() || !rawRequest.trim()) return;

    if (rawRequest.includes("YOUR_SESSION_TOKEN_HERE")) {
      setCreateError("لطفاً ابتدا مقدار Session Token معتبر را وارد کنید.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const parsed =
        sourceType === "fetch" ? parseFetch(rawRequest) : parseCurl(rawRequest);

      if (!parsed.url) {
        setCreateError("آدرس URL در درخواست وارد شده یافت نشد.");
        setIsCreating(false);
        return;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: jobName,
          source_type: sourceType,
          raw_request: rawRequest,
          parsed_request: parsed,
          timezone,
          schedule: schedule || null,
        }),
      });
      const json = (await res.json()) as ApiItemResponse<Job>;
      if (json.data) {
        setJobs([json.data, ...jobs]);
        setJobName("");
        setRawRequest("");
        setSessionToken("");
        setSchedule("00:01 DAILY");
      }
    } catch (err) {
      console.error(err);
      setCreateError("خطا در ایجاد جاب.");
    } finally {
      setIsCreating(false);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full mt-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-cyan-500 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          BACK TO PROJECTS
        </Link>
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-100 uppercase tracking-widest">
              {project?.name ?? "Unknown Project"}
            </h1>
            <p className="text-neutral-500 text-xs mt-1">ID: {projectId}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreateJob}
        className="space-y-4 bg-neutral-900 p-5 border border-neutral-800 rounded-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Automation Job
          </h2>

          {/* دکمه بارگذاری سریع قالب */}
          <button
            type="button"
            onClick={handleApplyWijoPreset}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/50 px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            بارگذاری قالب رزرو Wijo
          </button>
        </div>

        {/* فیلد اختصاصی سشن توکن برای راحتی کاربر */}
        <div className="bg-neutral-950/60 border border-neutral-800 p-3 rounded space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="text-neutral-300 flex items-center gap-1.5 font-medium">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              authjs.session-token :
            </label>
            <span className="text-[11px] text-neutral-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              از کوکی‌های سایت wijo کپی کنید
            </span>
          </div>
          <input
            type="text"
            value={sessionToken}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="مقدار سشن توکن خود را اینجا پیست کنید (خودکار در cURL جایگذاری می‌شود)"
            className="w-full bg-neutral-900 border border-neutral-800 p-2 text-xs text-amber-200 outline-none focus:border-amber-500/60 font-mono transition-colors placeholder:text-neutral-600 rounded-sm"
          />
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="JOB NAME..."
            className="flex-1 bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 transition-colors placeholder:text-neutral-700"
            disabled={isCreating}
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 transition-colors"
            disabled={isCreating}
          >
            <option value="curl">Copy as cURL</option>
            <option value="fetch">Copy as fetch</option>
          </select>
        </div>

        <textarea
          value={rawRequest}
          onChange={(e) => setRawRequest(e.target.value)}
          placeholder={
            sourceType === "fetch"
              ? 'Paste Chrome "Copy as fetch" output here...'
              : 'Paste Chrome "Copy as cURL" output here...'
          }
          rows={6}
          className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-neutral-200 font-mono outline-none focus:border-cyan-500 transition-colors placeholder:text-neutral-700 resize-y"
          disabled={isCreating}
        />

        <div className="flex gap-3">
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Timezone (e.g. Asia/Tehran)"
            className="flex-1 bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 transition-colors placeholder:text-neutral-700"
            disabled={isCreating}
          />
          <input
            type="text"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Schedule (e.g. 00:01 DAILY)"
            className="flex-1 bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 transition-colors placeholder:text-neutral-700"
            disabled={isCreating}
          />
        </div>

        {createError && (
          <p className="text-xs text-red-400 bg-red-950/30 p-2 border border-red-900/50 rounded">
            {createError}
          </p>
        )}

        <button
          type="submit"
          disabled={isCreating || !jobName.trim() || !rawRequest.trim()}
          className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 px-4 py-2 text-sm font-semibold tracking-wider flex items-center gap-2 border border-neutral-700 transition-colors"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          CREATE JOB
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
          Jobs
        </h2>

        {jobs.length === 0 ? (
          <div className="text-center py-12 border border-neutral-800 border-dashed text-neutral-600 bg-neutral-900/50">
            <TerminalIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="tracking-widest">NO JOBS FOUND</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/job/${job.id}`}
                className="group flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Zap
                    className={`w-5 h-5 ${
                      job.is_active ? "text-green-500" : "text-neutral-600"
                    }`}
                  />
                  <div>
                    <h3 className="font-semibold text-neutral-200">{job.name}</h3>
                    <p className="text-xs text-neutral-600 mt-1 font-mono">
                      {job.parsed_request?.method} {job.parsed_request?.url}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-700 group-hover:text-cyan-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}