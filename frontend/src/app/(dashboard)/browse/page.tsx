"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  ExternalLink,
  Radar,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { JobListingItem, SearchJob, DeepSearchParams } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const EMPLOYMENT = [
  { value: "", label: "All" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
] as const;

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "ashby", label: "Ashby" },
  { value: "crunchbase", label: "Crunchbase" },
];

const COMPANY_COUNTS = [5, 10, 25, 50] as const;
const LOCATIONS = ["Any", "US", "Europe", "India", "Southeast Asia", "Middle East"] as const;
const RECENCY_OPTIONS = [
  { value: "1 week", label: "Last week" },
  { value: "1 month", label: "Last month" },
  { value: "3 months", label: "Last 3 months" },
  { value: "6 months", label: "Last 6 months" },
  { value: "1 year", label: "Last year" },
] as const;

function employmentLabel(v: string | null): string {
  if (!v) return "Role";
  const m: Record<string, string> = {
    "full-time": "Full-time",
    "part-time": "Part-time",
    internship: "Internship",
    contract: "Contract",
  };
  return m[v] ?? v;
}

const zenPage = "min-h-full px-6 py-10 md:px-10 max-w-5xl mx-auto text-[#fcfcfc]";

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  running: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  failed: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function BrowsePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [source, setSource] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [dsParams, setDsParams] = useState<DeepSearchParams>({
    company_count: 10,
    location: "Any",
    recency: "3 months",
    sector: "",
  });
  const [customLocation, setCustomLocation] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (employmentType) p.set("employment_type", employmentType);
    if (remoteOnly) p.set("remote_ok", "true");
    if (source) p.set("source", source);
    return p.toString();
  }, [debouncedSearch, employmentType, remoteOnly, source]);

  const listingsQuery = useQuery({
    queryKey: ["theos", "listings", queryString],
    queryFn: () =>
      apiFetch<JobListingItem[]>(`/api/theos/listings?${queryString}`),
  });

  const historyQuery = useQuery({
    queryKey: ["theos", "deepsearch", "history"],
    queryFn: () =>
      apiFetch<SearchJob[]>("/api/theos/deepsearch/history?limit=10"),
  });

  const startSearch = useMutation({
    mutationFn: (params: DeepSearchParams) =>
      apiFetch<SearchJob>("/api/theos/deepsearch/start", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      setModalOpen(false);
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
    setDsParams({ company_count: 10, location: "Any", recency: "3 months", sector: "" });
    setCustomLocation("");
  };

  return (
    <div
      className={zenPage}
      style={{
        backgroundColor: "#050505",
        ["--border" as string]: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header with Deep Search button */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">
            Job listings and company discovery powered by Theos.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#60a5fa]/10 border border-[#60a5fa]/20 px-5 py-2.5 text-sm font-medium text-[#93c5fd] hover:bg-[#60a5fa]/20 transition-all"
        >
          <Radar className="w-4 h-4" />
          Start Deep Search
        </button>
      </div>

      {/* Search History */}
      {(historyQuery.data?.length ?? 0) > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-[#94a3b8] mb-3">Recent searches</h2>
          <div className="flex flex-wrap gap-2">
            {historyQuery.data!.map((job) => {
              const Icon = STATUS_ICON[job.status] || Clock;
              return (
                <div
                  key={job.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium",
                    STATUS_STYLE[job.status] || STATUS_STYLE.pending
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", job.status === "running" && "animate-spin")} />
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Job search & filters */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
        <input
          type="search"
          placeholder="Search titles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setDebouncedSearch(search);
          }}
          className="w-full rounded-2xl border border-[var(--border)] bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#60a5fa]/40 focus:outline-none focus:ring-1 focus:ring-[#60a5fa]/30"
        />
        <button
          type="button"
          onClick={() => setDebouncedSearch(search)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-[#94a3b8] hover:bg-white/10 hover:text-[#e2e8f0]"
        >
          Search
        </button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <select
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e2e8f0]"
        >
          {EMPLOYMENT.map((o) => (
            <option key={o.value || "all"} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setRemoteOnly((v) => !v)}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
            remoteOnly
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-[var(--border)] bg-white/[0.02] text-[#94a3b8] hover:bg-white/5"
          )}
        >
          Remote only
        </button>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e2e8f0]"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value || "all-src"} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {listingsQuery.isLoading && (
        <p className="text-sm text-[#94a3b8]">Loading listings...</p>
      )}
      {listingsQuery.isError && (
        <p className="text-sm text-red-400">Could not load job listings.</p>
      )}

      <ul className="flex flex-col gap-4">
        {(listingsQuery.data ?? []).map((job) => (
          <li key={job.id}>
            <article className="card-zen rounded-2xl p-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-medium text-lg text-[#f8fafc] leading-snug">{job.title}</h2>
                  {job.company_name && (
                    <p className="mt-1 text-sm text-[#94a3b8]">{job.company_name}</p>
                  )}
                </div>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#60a5fa]/15 px-4 py-2 text-sm font-medium text-[#93c5fd] hover:bg-[#60a5fa]/25"
                >
                  Apply
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {job.location && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[#cbd5e1]">
                    <MapPin className="h-3 w-3 text-[#64748b]" />
                    {job.location}
                  </span>
                )}
                {job.remote_ok === true && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300/95">Remote</span>
                )}
                <span className="rounded-full border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[#cbd5e1]">
                  {employmentLabel(job.employment_type)}
                </span>
                {job.source && (
                  <span className="rounded-full border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[#94a3b8]">{job.source}</span>
                )}
                {job.posted_at && (
                  <span className="text-[#64748b]">Posted {formatDate(job.posted_at)}</span>
                )}
              </div>
              {job.description && (
                <p className="text-sm text-[#94a3b8] line-clamp-3 leading-relaxed">{job.description}</p>
              )}
            </article>
          </li>
        ))}
      </ul>

      {!listingsQuery.isLoading &&
        !listingsQuery.isError &&
        (listingsQuery.data?.length ?? 0) === 0 && (
          <p className="text-sm text-[#64748b]">
            No listings match your filters. Adjust search or filters.
          </p>
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

            {/* Company count */}
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

            {/* Location */}
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

            {/* Recency */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Recency</label>
              <div className="flex flex-wrap gap-2">
                {RECENCY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setDsParams((p) => ({ ...p, recency: o.value }))}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                      dsParams.recency === o.value
                        ? "border-[#60a5fa]/40 bg-[#60a5fa]/10 text-[#93c5fd]"
                        : "border-[var(--border)] bg-white/[0.02] text-[#94a3b8] hover:bg-white/5"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector */}
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

            {/* Actions */}
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
