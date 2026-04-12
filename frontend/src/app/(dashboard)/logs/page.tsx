"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ActivityLog } from "@/types";
import { timeAgo } from "@/lib/utils";
import { Filter, ChevronDown, ChevronRight } from "lucide-react";

const ACTORS = ["all", "adam", "theos", "mercury", "user", "system"];
const ACTOR_COLORS: Record<string, string> = {
  adam: "bg-blue-500/20 text-blue-300",
  theos: "bg-purple-500/20 text-purple-300",
  mercury: "bg-amber-500/20 text-amber-300",
  user: "bg-emerald-500/20 text-emerald-300",
  system: "bg-neutral-500/20 text-neutral-300",
};

export default function LogsPage() {
  const [actor, setActor] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (actor !== "all") params.set("actor", actor);
  params.set("limit", "50");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["logs", actor],
    queryFn: () => apiFetch<ActivityLog[]>(`/api/logs?${params}`),
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Activity Logs</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          <select
            value={actor} onChange={(e) => setActor(e.target.value)}
            className="bg-white/5 border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-neutral-300"
          >
            {ACTORS.map((a) => (
              <option key={a} value={a} className="bg-[var(--surface)]">
                {a === "all" ? "All Actors" : a.charAt(0).toUpperCase() + a.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !logs?.length ? (
        <div className="text-center py-20 text-[var(--text-muted)]">No activity logs yet.</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="card-zen rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${ACTOR_COLORS[log.actor] || ACTOR_COLORS.system}`}>
                  {log.actor}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{log.action.replace(/_/g, " ")}</span>
                  {log.entity_type && (
                    <span className="text-xs text-[var(--text-muted)] ml-2">on {log.entity_type}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)] shrink-0">{timeAgo(log.created_at)}</span>
                {log.metadata ? (
                  expanded === log.id ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                ) : null}
              </button>
              {expanded === log.id && log.metadata && (
                <div className="px-5 pb-4 border-t border-[var(--border)]">
                  <pre className="text-xs text-[var(--text-muted)] mt-3 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
