"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Brain,
  Globe,
  Sparkles,
  Save,
  Database,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Radar,
  ArrowRight,
  X,
  Square,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, connectSSE } from "@/lib/api";
import type { DeepSearchEvent, DeepSearchParams } from "@/types";

const PHASES = [
  { key: "generate_query", label: "Query Gen", icon: Brain },
  { key: "web_research", label: "Research", icon: Globe },
  { key: "reflection", label: "Reflection", icon: Search },
  { key: "finalize_answer", label: "Synthesis", icon: Sparkles },
  { key: "saving", label: "Save", icon: Save },
  { key: "analyzing", label: "Extract", icon: Database },
] as const;

function phaseIndex(phase: string): number {
  return PHASES.findIndex((p) => p.key === phase);
}

interface Props {
  jobId: string;
  params: DeepSearchParams;
  onClose: () => void;
  onComplete: () => void;
}

export function DeepSearchProgress({ jobId, params, onClose, onComplete }: Props) {
  const [events, setEvents] = useState<DeepSearchEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("init");
  const [isDone, setIsDone] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [companiesFound, setCompaniesFound] = useState(0);

  const isTerminal = isDone || isFailed || isCancelled;

  const handleEvent = useCallback((event: DeepSearchEvent) => {
    setEvents((prev) => [...prev, event]);

    if (event.phase && event.phase !== "error") {
      setCurrentPhase(event.phase);
    }

    if (event.type === "search_completed") {
      setIsDone(true);
      setCurrentPhase("done");
      setCompaniesFound(event.companies_found ?? 0);
    } else if (event.type === "search_failed") {
      if (event.detail?.includes("cancelled")) {
        setIsCancelled(true);
      } else {
        setIsFailed(true);
      }
      setCurrentPhase("error");
    } else if (event.type === "stream_end") {
      setIsDone(true);
      setCurrentPhase("done");
    }
  }, []);

  useEffect(() => {
    const disconnect = connectSSE<DeepSearchEvent>(
      `/api/theos/deepsearch/${jobId}/stream`,
      handleEvent,
      (err) => {
        setEvents((prev) => [
          ...prev,
          { type: "search_failed", phase: "error", title: "Connection lost", detail: err.message },
        ]);
        setIsFailed(true);
      },
    );
    return () => disconnect();
  }, [jobId, handleEvent]);

  useEffect(() => {
    if (!collapsed) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, collapsed]);

  useEffect(() => {
    if (isDone) onComplete();
  }, [isDone, onComplete]);

  const toggleExpand = (idx: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiFetch(`/api/theos/deepsearch/${jobId}/cancel`, { method: "POST" });
      setIsCancelled(true);
      setCurrentPhase("error");
    } catch {
      setCancelling(false);
    }
  };

  const currentPhaseIdx = phaseIndex(currentPhase);

  const statusLabel = isDone
    ? `Deep Search Complete — ${companiesFound} companies found`
    : isCancelled
      ? "Deep Search Cancelled"
      : isFailed
        ? "Deep Search Failed"
        : "Deep Search Running";

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[#0a0a0b] overflow-hidden">
      {/* Header — always visible */}
      <div
        className={cn(
          "px-6 py-4 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-white/[0.01]",
          !collapsed && "border-b border-[var(--border)]"
        )}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            isDone ? "bg-emerald-500/10" : isCancelled ? "bg-amber-500/10" : isFailed ? "bg-red-500/10" : "bg-[#60a5fa]/10"
          )}>
            {isDone ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            ) : isCancelled ? (
              <Square className="w-4 h-4 text-amber-400" />
            ) : isFailed ? (
              <XCircle className="w-4.5 h-4.5 text-red-400" />
            ) : (
              <Radar className="w-4.5 h-4.5 text-[#60a5fa] animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{statusLabel}</h2>
            <p className="text-[11px] text-[#4b5563] mt-0.5 truncate">
              {params.company_count} companies · {params.location}
              {params.sector && params.sector !== "Any" ? ` · ${params.sector}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isTerminal && (
            <ElapsedTimer startTimestamp={events[0]?.timestamp} />
          )}

          {/* Cancel button — only while running */}
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
              title="Cancel search"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
              Cancel
            </button>
          )}

          {/* Collapse/expand toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-[#475569] hover:text-white hover:bg-white/5 transition-all"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* Close button — always visible */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#475569] hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Pipeline Steps */}
          <div className="px-6 py-3 border-b border-[var(--border)] bg-white/[0.01]">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {PHASES.map((phase, idx) => {
                const Icon = phase.icon;
                const isActive = currentPhase === phase.key;
                const isCompleted = currentPhaseIdx > idx || isDone;
                const isPending = currentPhaseIdx < idx && !isDone;

                return (
                  <div key={phase.key} className="flex items-center shrink-0">
                    {idx > 0 && (
                      <div className={cn(
                        "w-6 h-px mx-1",
                        isCompleted ? "bg-emerald-500/40" : "bg-white/[0.06]"
                      )} />
                    )}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                      isActive && !isTerminal
                        ? "border-[#60a5fa]/30 bg-[#60a5fa]/10 text-[#93c5fd]"
                        : isCompleted
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                          : isPending
                            ? "border-white/[0.04] bg-transparent text-[#334155]"
                            : "border-white/[0.06] bg-white/[0.02] text-[#64748b]"
                    )}>
                      {isActive && !isTerminal ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                      <span className="text-[11px] font-medium whitespace-nowrap">{phase.label}</span>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center shrink-0">
                <div className={cn(
                  "w-6 h-px mx-1",
                  isDone ? "bg-emerald-500/40" : "bg-white/[0.06]"
                )} />
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : isFailed || isCancelled
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-white/[0.04] bg-transparent text-[#334155]"
                )}>
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isFailed || isCancelled ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[11px] font-medium">Done</span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-[#60a5fa] animate-spin" />
                <p className="text-sm text-[#64748b]">Connecting to search agent...</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {events.map((ev, idx) => (
                  <EventRow
                    key={idx}
                    event={ev}
                    isExpanded={expandedEvents.has(idx)}
                    onToggle={() => toggleExpand(idx)}
                  />
                ))}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </>
      )}
    </div>
  );
}

function EventRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: DeepSearchEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasExpandable =
    (event.queries && event.queries.length > 0) ||
    (event.follow_up_queries && event.follow_up_queries.length > 0) ||
    event.preview ||
    (event.companies && event.companies.length > 0);

  const icon = getEventIcon(event);
  const color = getEventColor(event);

  return (
    <div className="group">
      <button
        onClick={hasExpandable ? onToggle : undefined}
        className={cn(
          "w-full flex items-start gap-3 px-6 py-3 text-left transition-colors",
          hasExpandable && "hover:bg-white/[0.02] cursor-pointer",
          !hasExpandable && "cursor-default"
        )}
      >
        <div className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color.bg)}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-[13px] font-medium", color.text)}>{event.title}</span>
            {event.total_sources != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#64748b]">
                {event.total_sources} sources
              </span>
            )}
          </div>
          {event.detail && (
            <p className="text-[12px] text-[#4b5563] mt-0.5 line-clamp-2">{event.detail}</p>
          )}
          {event.timestamp && (
            <span className="text-[10px] text-[#334155] mt-1 block font-mono">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {hasExpandable && (
          <div className="mt-1 text-[#334155]">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        )}
      </button>

      {isExpanded && hasExpandable && (
        <div className="px-6 pb-4 pl-16">
          {event.queries && event.queries.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-[#475569] uppercase tracking-wider">Search Queries</span>
              {event.queries.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-[#334155] mt-0.5 font-mono w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-[12px] text-[#94a3b8]">{q}</span>
                </div>
              ))}
            </div>
          )}

          {event.follow_up_queries && event.follow_up_queries.length > 0 && (
            <div className="space-y-1.5 mt-3">
              <span className="text-[10px] font-medium text-[#475569] uppercase tracking-wider">Follow-up Queries</span>
              {event.follow_up_queries.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-[#334155] mt-0.5 font-mono w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-[12px] text-[#94a3b8]">{q}</span>
                </div>
              ))}
            </div>
          )}

          {event.preview && (
            <div className="mt-3 space-y-1">
              <span className="text-[10px] font-medium text-[#475569] uppercase tracking-wider">Report Preview</span>
              <p className="text-[12px] text-[#64748b] leading-relaxed whitespace-pre-wrap">{event.preview}</p>
            </div>
          )}

          {event.companies && event.companies.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-medium text-[#475569] uppercase tracking-wider">
                Companies Found ({event.companies.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {event.companies.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <span className="text-[12px] text-white font-medium truncate">{c.name}</span>
                    {c.stage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#64748b] shrink-0">
                        {c.stage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getEventIcon(event: DeepSearchEvent) {
  const size = "w-3.5 h-3.5";
  switch (event.type) {
    case "search_started":
      return <Radar className={cn(size, "text-[#60a5fa]")} />;
    case "phase_start":
      return <Loader2 className={cn(size, "text-[#60a5fa] animate-spin")} />;
    case "queries_generated":
      return <Brain className={cn(size, "text-violet-400")} />;
    case "research_result":
      return <Globe className={cn(size, "text-cyan-400")} />;
    case "reflection_done":
      return <CheckCircle2 className={cn(size, "text-emerald-400")} />;
    case "reflection_gap":
      return <Search className={cn(size, "text-amber-400")} />;
    case "answer_ready":
      return <Sparkles className={cn(size, "text-yellow-400")} />;
    case "transcript_saved":
      return <Save className={cn(size, "text-[#94a3b8]")} />;
    case "companies_extracted":
      return <Database className={cn(size, "text-emerald-400")} />;
    case "companies_saved":
      return <CheckCircle2 className={cn(size, "text-emerald-400")} />;
    case "search_completed":
      return <CheckCircle2 className={cn(size, "text-emerald-400")} />;
    case "search_failed":
      return <XCircle className={cn(size, "text-red-400")} />;
    default:
      return <ArrowRight className={cn(size, "text-[#64748b]")} />;
  }
}

function getEventColor(event: DeepSearchEvent): { bg: string; text: string } {
  switch (event.type) {
    case "search_started":
    case "phase_start":
      return { bg: "bg-[#60a5fa]/10", text: "text-[#93c5fd]" };
    case "queries_generated":
      return { bg: "bg-violet-500/10", text: "text-violet-300" };
    case "research_result":
      return { bg: "bg-cyan-500/10", text: "text-cyan-300" };
    case "reflection_done":
    case "companies_extracted":
    case "companies_saved":
    case "search_completed":
      return { bg: "bg-emerald-500/10", text: "text-emerald-300" };
    case "reflection_gap":
      return { bg: "bg-amber-500/10", text: "text-amber-300" };
    case "answer_ready":
      return { bg: "bg-yellow-500/10", text: "text-yellow-300" };
    case "transcript_saved":
      return { bg: "bg-white/5", text: "text-[#94a3b8]" };
    case "search_failed":
      return { bg: "bg-red-500/10", text: "text-red-300" };
    default:
      return { bg: "bg-white/5", text: "text-[#94a3b8]" };
  }
}

function ElapsedTimer({ startTimestamp }: { startTimestamp?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTimestamp) return;
    const start = new Date(startTimestamp).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-xs font-mono text-[#475569] tabular-nums">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}
