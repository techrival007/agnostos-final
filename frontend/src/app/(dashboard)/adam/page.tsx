"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronRight,
  Code,
  Lightbulb,
  MapPin,
  Mic,
  Send,
  Settings2,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type {
  ConversationTurn,
  Experience,
  ProofPoint,
  Project,
  UserProfile,
} from "@/types";

type ChatResponse = { reply: string; turn_number: number };

const HISTORY_KEY = ["adam", "chat", "history"] as const;
const PROFILE_KEY = ["adam", "profile"] as const;

type TabId = "skills" | "experience" | "projects" | "proof" | "preferences";

const tabs: { id: TabId; label: string; icon: typeof Code }[] = [
  { id: "skills", label: "Skills", icon: Code },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "projects", label: "Projects", icon: Lightbulb },
  { id: "proof", label: "Proof Points", icon: Star },
  { id: "preferences", label: "Preferences", icon: Settings2 },
];

function formatDurationMonths(months: number): string {
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y}y`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || `${months}m`;
}

function ProofPointCard({ pp }: { pp: ProofPoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 overflow-hidden transition-all duration-300",
        open && "shadow-[0_0_0_1px_rgba(96,165,250,0.15)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-4 h-4 mt-0.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        {pp.highlight && (
          <Star className="w-4 h-4 mt-0.5 text-amber-400/90 shrink-0 fill-amber-400/30" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text-main)] text-sm">{pp.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{pp.project}</p>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 pl-10 space-y-2 text-sm border-t border-[var(--border)]/60">
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Problem</span>
            <p className="text-[var(--text-main)]/90 mt-0.5">{pp.problem}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Impact</span>
            <p className="text-[var(--text-main)]/90 mt-0.5">{pp.impact}</p>
          </div>
          {pp.tech?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pp.tech.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-muted)] border border-[var(--border)]"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdamPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("skills");

  const historyQuery = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => apiFetch<ConversationTurn[]>("/api/adam/chat/history"),
  });

  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => apiFetch<UserProfile>("/api/adam/profile"),
    staleTime: 10 * 60 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiFetch<ChatResponse>("/api/adam/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  const profile = profileQuery.data;
  const messages = historyQuery.data ?? [];

  function renderKnowledgeBody() {
    if (profileQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-sm">
          Loading profile…
        </div>
      );
    }
    if (profileQuery.isError) {
      return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Knowledge base will appear after your CV is uploaded and parsed.
        </div>
      );
    }

    const technicalSkills = profile?.parsed_skills?.technical ?? [];
    const softSkills = profile?.parsed_skills?.soft ?? [];
    const experiences = (profile?.parsed_experience ?? []) as Experience[];
    const projects = (profile?.parsed_projects ?? []) as Project[];
    const proofPoints = (profile?.proof_points ?? []) as ProofPoint[];

    switch (activeTab) {
      case "skills":
        return (
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Technical</p>
              <div className="flex flex-wrap gap-2">
                {technicalSkills.length ? (
                  technicalSkills.map((s) => (
                    <span
                      key={s}
                      className="bg-blue-500/10 text-blue-300 rounded-full px-2.5 py-1 text-xs"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">No technical skills yet.</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Soft skills</p>
              {softSkills.length ? (
                <ul className="space-y-1.5 text-sm text-[var(--text-main)]/90">
                  {softSkills.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="text-[var(--text-muted)]">·</span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No soft skills listed.</p>
              )}
            </div>
          </div>
        );
      case "experience":
        return (
          <div className="space-y-4">
            {experiences.length ? (
              experiences.map((ex, i) => (
                <div
                  key={`${ex.company}-${ex.role}-${i}`}
                  className="relative pl-4 border-l border-[var(--border)]"
                >
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[var(--primary)]/60" />
                  <p className="font-semibold text-[var(--text-main)]">{ex.company}</p>
                  <p className="text-sm text-[var(--text-muted)]">{ex.role}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {formatDurationMonths(ex.duration_months)}
                  </p>
                  {ex.tech_used?.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ex.tech_used.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-blue-300/90 border border-white/10"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No experience entries.</p>
            )}
          </div>
        );
      case "projects":
        return (
          <div className="space-y-3">
            {projects.length ? (
              projects.map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3 soft-shadow"
                >
                  <p className="font-medium text-[var(--text-main)]">{p.name}</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{p.description}</p>
                  {p.tech?.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.tech.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No projects yet.</p>
            )}
          </div>
        );
      case "proof":
        return (
          <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {proofPoints.length ? (
              proofPoints.map((pp, i) => <ProofPointCard key={`${pp.title}-${i}`} pp={pp} />)
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No proof points extracted.</p>
            )}
          </div>
        );
      case "preferences":
        return (
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Preferred roles</p>
              <div className="flex flex-wrap gap-2">
                {(profile?.preferred_roles ?? []).length ? (
                  profile!.preferred_roles!.map((r) => (
                    <span
                      key={r}
                      className="bg-white/5 border border-[var(--border)] rounded-full px-2.5 py-1 text-xs text-[var(--text-main)]"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">Not set</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Stages</p>
              <div className="flex flex-wrap gap-2">
                {(profile?.preferred_stages ?? []).length ? (
                  profile!.preferred_stages!.map((s) => (
                    <span
                      key={s}
                      className="bg-emerald-500/10 text-emerald-300/90 rounded-full px-2.5 py-1 text-xs"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">Not set</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-[var(--text-muted)] shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Location</p>
                <p className="text-[var(--text-main)] mt-0.5">{profile?.location || "Not set"}</p>
              </div>
            </div>
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1.5">
                  <span>Formal tone</span>
                  <span>{profile?.tone_formal ?? 5} / 10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={profile?.tone_formal ?? 5}
                  readOnly
                  disabled
                  className="w-full accent-[var(--primary)] opacity-80 cursor-not-allowed"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1.5">
                  <span>Technical tone</span>
                  <span>{profile?.tone_technical ?? 5} / 10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={profile?.tone_technical ?? 5}
                  readOnly
                  disabled
                  className="w-full accent-[var(--primary)] opacity-80 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const kbBody = renderKnowledgeBody();

  const showInterviewBanner = profile && !profile.interview_completed;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-0 lg:gap-0">
      <section className="w-full lg:w-3/5 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border)] min-h-[420px] lg:min-h-[calc(100vh-8rem)]">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <Mic className="w-4 h-4 text-[var(--primary)]" />
          <h1 className="text-lg font-medium tracking-tight">Adam</h1>
          <span className="text-xs text-[var(--text-muted)] ml-auto">Conversation</span>
        </div>

        {showInterviewBanner && (
          <Link
            href="/adam/interview"
            className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90 hover:bg-amber-500/10 transition-colors"
          >
            <span>Start Voice Interview</span>
            <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
          </Link>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {historyQuery.isLoading && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">Loading messages…</p>
          )}
          {historyQuery.isError && (
            <p className="text-sm text-red-400/80 text-center py-8">Could not load history.</p>
          )}
          {!historyQuery.isLoading &&
            messages.map((m, idx) => {
              const isAdam = m.role === "adam";
              return (
                <div
                  key={`${m.created_at}-${idx}`}
                  className={cn("flex", isAdam ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      isAdam
                        ? "bg-[var(--surface)] text-[var(--text-main)] soft-shadow border border-[var(--border)]"
                        : "bg-white/5 text-[var(--text-main)] border border-white/5",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-2 opacity-60",
                        isAdam ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]",
                      )}
                    >
                      {timeAgo(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>

        <form
          className="p-3 border-t border-[var(--border)] bg-[var(--background)]/40 backdrop-blur-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const t = input.trim();
            if (!t || sendMutation.isPending) return;
            sendMutation.mutate(t);
            setInput("");
          }}
        >
          <div className="flex gap-2 input-focus rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <input
              className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] min-w-0"
              placeholder="Message Adam…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sendMutation.isPending}
            />
            <button
              type="submit"
              disabled={sendMutation.isPending || !input.trim()}
              className="shrink-0 rounded-xl p-2 bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 disabled:opacity-40 transition-colors"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </section>

      <aside className="w-full lg:w-2/5 flex flex-col min-h-[360px] lg:min-h-[calc(100vh-8rem)]">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Knowledge base
          </h2>
        </div>
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-[var(--border)] bg-[var(--surface)]/30">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-all duration-200",
                activeTab === id
                  ? "bg-white/10 text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5",
              )}
            >
              <Icon className="w-3.5 h-3.5 opacity-80" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">{kbBody}</div>
      </aside>
    </div>
  );
}
