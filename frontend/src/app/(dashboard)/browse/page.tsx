"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Briefcase,
  GraduationCap,
  Globe,
  DollarSign,
  Clock,
  Building2,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { GithubJob, GithubJobsRefreshResult, GithubJobsCount } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const JOB_TYPE_OPTIONS = [
  { value: "", label: "All types", icon: Briefcase },
  { value: "internship", label: "Internship", icon: Briefcase },
  { value: "new_grad", label: "New Grad", icon: GraduationCap },
] as const;

const REGION_OPTIONS = [
  { value: "", label: "All regions" },
  { value: "usa", label: "USA" },
  { value: "international", label: "International" },
] as const;

const SOURCE_OPTIONS = [
  { value: "", label: "All fields" },
  { value: "ai", label: "AI / ML" },
  { value: "swe", label: "SWE" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "FAANG+", label: "FAANG+" },
  { value: "Quant", label: "Quant" },
  { value: "Other", label: "Other" },
] as const;

const SORT_OPTIONS = [
  { value: "posted_at", label: "Most Recent" },
  { value: "age", label: "Newest First" },
  { value: "company", label: "Company A-Z" },
] as const;

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "";
  const posted = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function categoryBadgeStyle(cat: string | null): string {
  switch (cat) {
    case "FAANG+":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";
    case "Quant":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "Other":
      return "border-[var(--border)] bg-white/5 text-[var(--text-muted)]";
    default:
      return "border-[var(--border)] bg-white/5 text-[var(--text-muted)]";
  }
}

function sourceRepoBadge(repo: string): string {
  return repo === "ai"
    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export default function BrowsePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [jobType, setJobType] = useState("");
  const [region, setRegion] = useState("");
  const [sourceRepo, setSourceRepo] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("posted_at");
  const [limit, setLimit] = useState(50);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("sort", sort);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (jobType) p.set("job_type", jobType);
    if (region) p.set("region", region);
    if (sourceRepo) p.set("source_repo", sourceRepo);
    if (category) p.set("category", category);
    return p.toString();
  }, [debouncedSearch, jobType, region, sourceRepo, category, sort, limit]);

  const jobsQuery = useQuery({
    queryKey: ["github-jobs", queryString],
    queryFn: () =>
      apiFetch<GithubJob[]>(`/api/theos/github-jobs?${queryString}`),
  });

  const countQuery = useQuery({
    queryKey: ["github-jobs-count"],
    queryFn: () =>
      apiFetch<GithubJobsCount>("/api/theos/github-jobs/count"),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      apiFetch<GithubJobsRefreshResult>("/api/theos/github-jobs/refresh", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["github-jobs-count"] });
    },
  });

  const handleSearch = useCallback(() => {
    setDebouncedSearch(search);
    setLimit(50);
  }, [search]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setJobType("");
    setRegion("");
    setSourceRepo("");
    setCategory("");
    setSort("posted_at");
    setLimit(50);
  }, []);

  const hasFilters = debouncedSearch || jobType || region || sourceRepo || category;

  const loadMore = useCallback(() => {
    setLimit((prev) => prev + 50);
  }, []);

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Browse Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {countQuery.data ? (
              <>
                <span className="text-white font-medium">
                  {countQuery.data.total.toLocaleString()}
                </span>{" "}
                jobs from AI & SWE repos
                {countQuery.data.last_scraped_at && (
                  <span>
                    {" "}
                    · last updated{" "}
                    {timeSince(countQuery.data.last_scraped_at)}
                  </span>
                )}
              </>
            ) : (
              "Loading job data..."
            )}
          </p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-medium transition-all shrink-0",
            refreshMutation.isPending
              ? "border-white/10 bg-white/5 text-[var(--text-muted)] cursor-not-allowed"
              : "border-[#60a5fa]/20 bg-[#60a5fa]/10 text-[#93c5fd] hover:bg-[#60a5fa]/20",
          )}
        >
          {refreshMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </>
          )}
        </button>
      </header>

      {refreshMutation.isSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {refreshMutation.data.message}
        </div>
      )}
      {refreshMutation.isError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {(refreshMutation.error as Error)?.message || "Refresh failed"}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
        <input
          type="search"
          placeholder="Search by position, company, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          className="w-full rounded-2xl border border-[var(--border)] bg-white/[0.03] py-3 pl-11 pr-24 text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#60a5fa]/40 focus:outline-none focus:ring-1 focus:ring-[#60a5fa]/30"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/5 px-4 py-1.5 text-xs font-medium text-[#94a3b8] hover:bg-white/10 hover:text-[#e2e8f0] transition-colors"
        >
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Job Type Chips */}
        <div className="flex gap-1.5">
          {JOB_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all-type"}
              onClick={() => { setJobType(opt.value); setLimit(50); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                jobType === opt.value
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-white/15 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Region */}
        <div className="relative inline-flex items-center">
          <Globe className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
          <select
            value={region}
            onChange={(e) => { setRegion(e.target.value); setLimit(50); }}
            className="appearance-none pl-8 pr-8 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-white focus:border-white/20"
          >
            {REGION_OPTIONS.map((o) => (
              <option key={o.value || "all-rgn"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
        </div>

        {/* Source Repo */}
        <div className="relative inline-flex items-center">
          <SlidersHorizontal className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
          <select
            value={sourceRepo}
            onChange={(e) => { setSourceRepo(e.target.value); setLimit(50); }}
            className="appearance-none pl-8 pr-8 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-white focus:border-white/20"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value || "all-src"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
        </div>

        {/* Category */}
        <div className="relative inline-flex items-center">
          <Building2 className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setLimit(50); }}
            className="appearance-none pl-8 pr-8 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-white focus:border-white/20"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value || "all-cat"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
        </div>

        <div className="w-px h-6 bg-[var(--border)]" />

        {/* Sort */}
        <div className="relative inline-flex items-center">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-white focus:border-white/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      {!jobsQuery.isLoading && (
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Showing {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Loading State */}
      {jobsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="card-zen rounded-2xl p-5 animate-pulse flex items-center gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/10 rounded w-1/3" />
              </div>
              <div className="h-8 bg-white/10 rounded-full w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {jobsQuery.isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {(jobsQuery.error as Error)?.message || "Failed to load jobs"}
        </div>
      )}

      {/* Empty State */}
      {!jobsQuery.isLoading &&
        !jobsQuery.isError &&
        jobs.length === 0 &&
        countQuery.data?.total === 0 && (
          <div className="card-zen rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <Briefcase className="w-12 h-12 text-[var(--text-muted)] mb-4 opacity-50" />
            <p className="text-[var(--text-muted)] text-sm max-w-sm mb-4">
              No jobs scraped yet. Click &quot;Refresh Data&quot; to fetch listings
              from GitHub.
            </p>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#60a5fa]/10 border border-[#60a5fa]/20 px-5 py-2.5 text-sm font-medium text-[#93c5fd] hover:bg-[#60a5fa]/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Fetch Jobs Now
            </button>
          </div>
        )}

      {/* No filter results */}
      {!jobsQuery.isLoading &&
        !jobsQuery.isError &&
        jobs.length === 0 &&
        (countQuery.data?.total ?? 0) > 0 && (
          <div className="card-zen rounded-2xl p-12 flex flex-col items-center justify-center text-center">
            <Search className="w-10 h-10 text-[var(--text-muted)] mb-3 opacity-50" />
            <p className="text-[var(--text-muted)] text-sm">
              No jobs match your filters. Try adjusting your search.
            </p>
          </div>
        )}

      {/* Job Listings */}
      {!jobsQuery.isLoading && jobs.length > 0 && (
        <>
          <div className="space-y-2">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="card-zen rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 group hover:border-white/10 transition-colors"
              >
                {/* Left: Job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1.5">
                    <h2 className="font-medium text-sm text-white leading-snug truncate">
                      {job.position}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {job.company_url ? (
                      <a
                        href={job.company_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#93c5fd] hover:text-[#bfdbfe] font-medium transition-colors"
                      >
                        {job.company}
                      </a>
                    ) : (
                      <span className="text-[#94a3b8] font-medium">
                        {job.company}
                      </span>
                    )}
                    {job.location && (
                      <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                    )}
                    {job.salary && (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <DollarSign className="w-3 h-3" />
                        {job.salary}
                      </span>
                    )}
                    {job.posted_at && (
                      <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                        <Clock className="w-3 h-3" />
                        {timeSince(job.posted_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Badges & Apply */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      sourceRepoBadge(job.source_repo),
                    )}
                  >
                    {job.source_repo === "ai" ? "AI/ML" : "SWE"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      job.job_type === "internship"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                        : "border-purple-500/30 bg-purple-500/10 text-purple-300",
                    )}
                  >
                    {job.job_type === "internship" ? "Intern" : "New Grad"}
                  </span>
                  {job.category && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        categoryBadgeStyle(job.category),
                      )}
                    >
                      {job.category}
                    </span>
                  )}
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#60a5fa]/15 px-4 py-1.5 text-xs font-medium text-[#93c5fd] hover:bg-[#60a5fa]/25 transition-colors"
                  >
                    Apply
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          {/* Load More */}
          {jobs.length >= limit && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-white/5 hover:text-white transition-colors"
              >
                Load more
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
