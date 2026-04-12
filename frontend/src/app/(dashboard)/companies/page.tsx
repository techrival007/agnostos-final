"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, MapPin, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Company } from "@/types";
import {
  cn,
  formatDate,
  formatMoney,
  hiringScoreColor,
  stageBadgeColor,
} from "@/lib/utils";

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
];

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
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("hiring_score");

  const queryUrl = useMemo(() => buildCompaniesQuery(stage, source, sort), [stage, source, sort]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["theos-companies", stage, source, sort],
    queryFn: () => apiFetch<Company[]>(queryUrl),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Active Hiring Feed</h1>
        <div className="relative inline-flex items-center">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-white focus:border-white/20 min-w-[180px]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </header>

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
              <option key={s.value || "all-src"} value={s.value}>
                {s.label}
              </option>
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
            No companies match these filters. Try widening the stage or source.
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
    </div>
  );
}
