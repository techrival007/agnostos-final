"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  MapPin,
  Users,
  Radar,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Trash2,
  Square,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Company, SearchJob, DeepSearchParams } from "@/types";
import {
  cn,
  formatDate,
  formatMoney,
  hiringScoreColor,
  stageBadgeColor,
} from "@/lib/utils";
import { DeepSearchProgress } from "@/components/theos/DeepSearchProgress";

const STAGES: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pre-seed", value: "pre-seed" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series-a" },
  { label: "Series B", value: "series-b" },
];

const SORTS: { label: string; value: string }[] = [
  { label: "Hiring Score", value: "hiring_score" },
  { label: "Funding Date", value: "funding_date" },
  { label: "Recent", value: "created_at" },
];

const SOURCES: { label: string; value: string }[] = [
  { label: "All sources", value: "" },
  { label: "Y Combinator", value: "yc" },
  { label: "Crunchbase", value: "crunchbase" },
  { label: "Inc42", value: "inc42" },
  { label: "Entrepreneur First", value: "ef" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Deep Search", value: "deepsearch" },
];

const COMPANY_COUNTS = [5, 10, 25, 50] as const;
const LOCATIONS = ["Any", "US", "Europe", "India", "Southeast Asia", "Middle East"] as const;

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: Square,
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  running: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  failed: "text-red-400 bg-red-500/10 border-red-500/20",
  cancelled: "text-[#94a3b8] bg-white/5 border-white/10",
};

function stageLabel(stage: string | null): string {
  if (!stage) return "Unknown";
  const m: Record<string, string> = {
    "pre-seed": "Pre-seed",
    seed: "Seed",
    "series-a": "Series A",
    "series-b": "Series B",
  };
  return m[stage] ?? stage;
}

function buildCompaniesQuery(stage: string, source: string, sort: string): string {
  const p = new URLSearchParams();
  p.set("sort", sort);
  p.set("limit", "60");
  if (stage) p.set("stage", stage);
  if (source) p.set("source", source);
  return `/api/theos/companies?${p.toString()}`;
}

function CompanyCardSkeleton() {
  return (
    <div className="card-zen rounded-2xl p-5 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-2/3 mb-3" />
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-white/10 rounded-full w-16" />
        <div className="h-6 bg-white/10 rounded-full w-14" />
      </div>
      <div className="h-8 bg-white/10 rounded w-20 mb-4" />
      <div className="h-4 bg-white/10 rounded w-full mb-2" />
      <div className="h-4 bg-white/10 rounded w-4/5 mb-4" />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-white/10 rounded-full w-14" />
        ))}
      </div>
      <div className="h-4 bg-white/10 rounded w-1/2" />
    </div>
  );
}

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("hiring_score");
  const [modalOpen, setModalOpen] = useState(false);

  const [activeSearchJobId, setActiveSearchJobId] = useState<string | null>(null);
  const [activeSearchParams, setActiveSearchParams] = useState<DeepSearchParams | null>(null);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

  const [dsParams, setDsParams] = useState<DeepSearchParams>({
    company_count: 10,
    location: "Any",
    sector: "",
  });
  const [customLocation, setCustomLocation] = useState("");

  const queryUrl = useMemo(() => buildCompaniesQuery(stage, source, sort), [stage, source, sort]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["theos-companies", stage, source, sort],
    queryFn: () => apiFetch<Company[]>(queryUrl),
  });

  const historyQuery = useQuery({
    queryKey: ["theos", "deepsearch", "history"],
    queryFn: () =>
      apiFetch<SearchJob[]>("/api/theos/deepsearch/history?limit=10"),
    refetchInterval: activeSearchJobId ? 5000 : false,
  });

  const startSearch = useMutation({
    mutationFn: (params: DeepSearchParams) =>
      apiFetch<SearchJob>("/api/theos/deepsearch/start", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: (job) => {
      setModalOpen(false);
      setActiveSearchJobId(job.id);
      setActiveSearchParams(dsParams);
      queryClient.invalidateQueries({ queryKey: ["theos", "deepsearch", "history"] });
    },
  });

  const handleStartSearch = useCallback(() => {
    const params = {
      ...dsParams,
      location: dsParams.location === "Custom" ? customLocation || "Any" : dsParams.location,
      sector: dsParams.sector || "Any",
    };
    startSearch.mutate(params);
  }, [dsParams, customLocation, startSearch]);

  const handleDefaults = () => {
    setDsParams({ company_count: 10, location: "Any", sector: "" });
    setCustomLocation("");
  };

  const handleSearchComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["theos-companies"] });
    queryClient.invalidateQueries({ queryKey: ["theos", "deepsearch", "history"] });
  }, [queryClient]);

  const handleCloseProgress = useCallback(() => {
    setActiveSearchJobId(null);
    setActiveSearchParams(null);
    setViewingJobId(null);
  }, []);

  const handleViewRunningJob = useCallback((jobId: string) => {
    setViewingJobId(jobId);
  }, []);

  const displayJobId = activeSearchJobId || viewingJobId;
  const displayParams = activeSearchParams || (viewingJobId ? historyQuery.data?.find(j => j.id === viewingJobId)?.parameters : null);

  const deleteJob = useMutation({
    mutationFn: (jobId: string) =>
      apiFetch(`/api/theos/deepsearch/${jobId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["theos", "deepsearch", "history"] });
    },
  });

  const handleDeleteJob = useCallback((jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayJobId === jobId) {
      handleCloseProgress();
    }
    deleteJob.mutate(jobId);
  }, [deleteJob, displayJobId, handleCloseProgress]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white tracking-tight">Active Hiring Feed</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#60a5fa]/10 border border-[#60a5fa]/20 px-5 py-2.5 text-sm font-medium text-[#93c5fd] hover:bg-[#60a5fa]/20 transition-all"
          >
            <Radar className="w-4 h-4" />
            Deep Search
          </button>
          <div className="relative inline-flex items-center">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-white focus:border-white/20 min-w-[180px]"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>
      </header>

      {/* Active Deep Search Progress */}
      {displayJobId && displayParams && (
        <div className="mb-6">
          <DeepSearchProgress
            jobId={displayJobId}
            params={displayParams}
            onClose={handleCloseProgress}
            onComplete={handleSearchComplete}
          />
        </div>
      )}

      {/* Search History */}
      {(historyQuery.data?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-medium text-[var(--text-muted)] mb-2">Recent deep searches</h2>
          <div className="flex flex-wrap gap-2">
            {historyQuery.data!.map((job) => {
              const Icon = STATUS_ICON[job.status] || Clock;
              const isViewable = job.status === "running" && job.id !== displayJobId;
              const isDeletable = job.status !== "running" || job.id !== displayJobId;
              return (
                <div
                  key={job.id}
                  className={cn(
                    "group/pill inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                    STATUS_STYLE[job.status] || STATUS_STYLE.pending,
                    isViewable && "hover:brightness-125 cursor-pointer",
                  )}
                  role={isViewable ? "button" : undefined}
                  onClick={() => {
                    if (isViewable) handleViewRunningJob(job.id);
                  }}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", job.status === "running" && "animate-spin")} />
                  <span>
                    {job.parameters?.company_count ?? "?"} companies
                    {job.parameters?.location && job.parameters.location !== "Any"
                      ? ` · ${job.parameters.location}`
                      : ""}
                  </span>
                  {job.status === "completed" && (
                    <span className="text-[10px] opacity-70">
                      ({job.companies_found} found)
                    </span>
                  )}
                  {job.status === "cancelled" && (
                    <span className="text-[10px] opacity-70">cancelled</span>
                  )}
                  {isViewable && (
                    <Eye className="w-3 h-3 opacity-60 shrink-0" />
                  )}
                  {isDeletable && (
                    <button
                      onClick={(e) => handleDeleteJob(job.id, e)}
                      className="opacity-0 group-hover/pill:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all shrink-0"
                      title="Delete search"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s.value || "all"}
              type="button"
              onClick={() => setStage(s.value)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                stage === s.value
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-white/15 hover:text-white"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative inline-flex items-center lg:ml-auto">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-white focus:border-white/20 min-w-[200px]"
          >
            {SOURCES.map((s) => (
              <option key={s.value || "all-src"} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(error as Error).message || "Failed to load companies"}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CompanyCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="card-zen rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <Building2 className="w-12 h-12 text-[var(--text-muted)] mb-4 opacity-50" />
          <p className="text-[var(--text-muted)] text-sm max-w-sm">
            No companies match these filters. Try a Deep Search to discover new ones.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.map((c) => {
            const stack = c.tech_stack ?? [];
            const shown = stack.slice(0, 5);
            const rest = stack.length - shown.length;
            return (
              <article key={c.id} className="card-zen rounded-2xl p-5 flex flex-col">
                <h2 className="font-medium text-base text-white mb-3">{c.name}</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className={cn(
                      "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                      stageBadgeColor(c.stage)
                    )}
                  >
                    {stageLabel(c.stage)}
                  </span>
                  {c.source && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-white/5 text-[var(--text-muted)] border-white/10">
                      {c.source}
                    </span>
                  )}
                </div>
                <div className={cn("text-2xl font-semibold tabular-nums mb-1", hiringScoreColor(c.hiring_score))}>
                  {c.hiring_score}
                  <span className="text-xs font-normal text-[var(--text-muted)] ml-1">hiring</span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {c.funding_amount_usd ? (
                    <>
                      <span className="text-white/90">{formatMoney(c.funding_amount_usd)}</span>
                      {c.funding_date && (
                        <span> · {formatDate(String(c.funding_date))}</span>
                      )}
                    </>
                  ) : (
                    "Funding undisclosed"
                  )}
                </p>
                {shown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {shown.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-muted)] border border-white/5 max-w-[120px] truncate"
                        title={t}
                      >
                        {t}
                      </span>
                    ))}
                    {rest > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-muted)] border border-white/5">
                        +{rest}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] mt-auto pt-2 border-t border-[var(--border)]">
                  {c.hq_location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {c.hq_location}
                    </span>
                  )}
                  {c.headcount != null && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      {c.headcount} people
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-[var(--text-muted)]">
                    {c.contact_count} contact{c.contact_count === 1 ? "" : "s"}
                  </span>
                  <Link
                    href={`/companies/${c.id}`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    View Details
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Deep Search Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-3xl border border-[var(--border)] bg-[#0e0e0f] p-8 shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#64748b] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[#60a5fa]/10 flex items-center justify-center">
                <Radar className="w-5 h-5 text-[#60a5fa]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Deep Search</h2>
                <p className="text-xs text-[#64748b]">Find recently funded companies with AI</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Companies to find</label>
              <div className="flex gap-2">
                {COMPANY_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setDsParams((p) => ({ ...p, company_count: n }))}
                    className={cn(
                      "flex-1 py-2 rounded-xl border text-sm font-medium transition-all",
                      dsParams.company_count === n
                        ? "border-[#60a5fa]/40 bg-[#60a5fa]/10 text-[#93c5fd]"
                        : "border-[var(--border)] bg-white/[0.02] text-[#94a3b8] hover:bg-white/5"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Location</label>
              <div className="flex flex-wrap gap-2">
                {[...LOCATIONS, "Custom" as const].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setDsParams((p) => ({ ...p, location: loc }))}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                      dsParams.location === loc
                        ? "border-[#60a5fa]/40 bg-[#60a5fa]/10 text-[#93c5fd]"
                        : "border-[var(--border)] bg-white/[0.02] text-[#94a3b8] hover:bg-white/5"
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              {dsParams.location === "Custom" && (
                <input
                  type="text"
                  placeholder="e.g. Berlin, Tokyo, Lagos..."
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#4b5563] focus:border-[#60a5fa]/40 focus:outline-none"
                />
              )}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Sector (optional)</label>
              <input
                type="text"
                placeholder="e.g. AI/ML, FinTech, HealthTech, Climate..."
                value={dsParams.sector}
                onChange={(e) => setDsParams((p) => ({ ...p, sector: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#4b5563] focus:border-[#60a5fa]/40 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleDefaults}
                className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
              >
                Reset to defaults
              </button>
              <button
                onClick={handleStartSearch}
                disabled={startSearch.isPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-medium transition-all",
                  startSearch.isPending
                    ? "bg-[#60a5fa]/5 text-[#64748b] cursor-not-allowed"
                    : "bg-[#60a5fa]/15 text-[#93c5fd] hover:bg-[#60a5fa]/25"
                )}
              >
                {startSearch.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Radar className="w-4 h-4" />
                    Start Search
                  </>
                )}
              </button>
            </div>

            {startSearch.isError && (
              <p className="mt-3 text-xs text-red-400">
                {(startSearch.error as Error)?.message || "Failed to start search"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
