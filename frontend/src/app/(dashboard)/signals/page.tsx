"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Radio } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Signal } from "@/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";

const TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Hiring Posts", value: "hiring_post" },
  { label: "New Recruits", value: "new_recruit" },
  { label: "Funding", value: "funding_announce" },
  { label: "Expansion", value: "expansion" },
];

function signalTypeBadgeClass(t: string | null): string {
  switch (t) {
    case "hiring_post":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "new_recruit":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "funding_announce":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "expansion":
      return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    default:
      return "bg-white/5 text-neutral-400 border-white/10";
  }
}

function signalTypeLabel(t: string | null): string {
  switch (t) {
    case "hiring_post":
      return "Hiring Post";
    case "new_recruit":
      return "New Recruit";
    case "funding_announce":
      return "Funding";
    case "expansion":
      return "Expansion";
    default:
      return t || "Signal";
  }
}

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  const s = text.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
}

function buildSignalsUrl(signalType: string): string {
  const p = new URLSearchParams();
  p.set("limit", "80");
  if (signalType) p.set("signal_type", signalType);
  return `/api/theos/signals?${p.toString()}`;
}

function SignalCardSkeleton() {
  return (
    <div className="card-zen rounded-2xl p-5 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-28 mb-4" />
      <div className="h-4 bg-white/10 rounded w-full mb-2" />
      <div className="h-4 bg-white/10 rounded w-5/6 mb-4" />
      <div className="h-3 bg-white/10 rounded w-40" />
    </div>
  );
}

export default function SignalsPage() {
  const [signalType, setSignalType] = useState("");

  const url = useMemo(() => buildSignalsUrl(signalType), [signalType]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["theos-signals", signalType],
    queryFn: () => apiFetch<Signal[]>(url),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[960px] mx-auto">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Radio className="w-6 h-6 text-[var(--text-muted)]" />
          LinkedIn Signals
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Live feed from monitored LinkedIn activity</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-[var(--border)] pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => setSignalType(tab.value)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
              signalType === tab.value
                ? "bg-white/10 text-white border-white/20"
                : "bg-transparent text-[var(--text-muted)] border-transparent hover:text-white hover:bg-white/5"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mb-6">
          {(error as Error).message || "Failed to load signals"}
        </div>
      )}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SignalCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="card-zen rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <Radio className="w-12 h-12 text-[var(--text-muted)] mb-4 opacity-50" />
          <p className="text-[var(--text-muted)] text-sm max-w-sm">No signals for this filter yet.</p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((s) => (
            <li key={s.id}>
              <article className="card-zen rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full border",
                      signalTypeBadgeClass(s.signal_type)
                    )}
                  >
                    {signalTypeLabel(s.signal_type)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-main)] leading-relaxed mb-4">
                  {truncate(s.post_content, 200)}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[var(--text-muted)]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-white/90 font-medium">{s.author_name || "Unknown author"}</span>
                    {s.author_linkedin && (
                      <a
                        href={s.author_linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                      >
                        LinkedIn
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span>
                      {!s.resolved ? (
                        <span className="text-amber-400/90 italic">Resolving…</span>
                      ) : s.company_id ? (
                        <Link href={`/companies/${s.company_id}`} className="text-[var(--primary)] hover:underline font-medium">
                          {s.company_name || "View company"}
                        </Link>
                      ) : s.company_name ? (
                        <span className="text-white/80">{s.company_name}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </span>
                  </div>
                  <time
                    className="tabular-nums shrink-0 text-[var(--text-muted)] text-right"
                    dateTime={s.detected_at ? String(s.detected_at) : undefined}
                    title={s.detected_at ? formatDate(String(s.detected_at)) : undefined}
                  >
                    {s.detected_at ? (
                      <>
                        {formatDate(String(s.detected_at))}
                        <span className="text-white/25 mx-1.5">·</span>
                        {timeAgo(String(s.detected_at))}
                      </>
                    ) : (
                      "—"
                    )}
                  </time>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
