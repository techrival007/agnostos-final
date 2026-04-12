"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronRight,
  Code,
  Edit3,
  Lightbulb,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type {
  ChatMessage,
  ChatSession,
  Experience,
  ProofPoint,
  Project,
  UserProfile,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants & types                                                 */
/* ------------------------------------------------------------------ */

const PROFILE_KEY = ["adam", "profile"] as const;
const SESSIONS_KEY = ["chat", "sessions"] as const;

type TabId = "skills" | "experience" | "projects" | "proof" | "preferences";

const tabs: { id: TabId; label: string; icon: typeof Code }[] = [
  { id: "skills", label: "Skills", icon: Code },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "projects", label: "Projects", icon: Lightbulb },
  { id: "proof", label: "Proof Points", icon: Star },
  { id: "preferences", label: "Preferences", icon: Settings2 },
];

type PreferenceSuggestions = {
  roles: string[];
  stages: string[];
  sectors: string[];
};

/* ------------------------------------------------------------------ */
/*  Small sub-components                                              */
/* ------------------------------------------------------------------ */

function TagEditor({
  tags,
  onUpdate,
  color = "blue",
}: {
  tags: string[];
  onUpdate: (tags: string[]) => void;
  color?: "blue" | "emerald" | "amber";
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const colorMap = {
    blue: "bg-blue-500/10 text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-300/90",
    amber: "bg-amber-500/10 text-amber-300/90",
  };

  const add = () => {
    const t = value.trim();
    if (t && !tags.includes(t)) {
      onUpdate([...tags, t]);
    }
    setValue("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5 group",
            colorMap[color],
          )}
        >
          {tag}
          <button
            type="button"
            onClick={() => onUpdate(tags.filter((t) => t !== tag))}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={add}
            className="bg-white/5 border border-[var(--border)] rounded-full px-2.5 py-1 text-xs text-[var(--text-main)] w-28 focus:border-[var(--primary)]/40 transition-colors"
            placeholder="Add…"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full px-2 py-1 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
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

function formatDurationMonths(months: number): string {
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y}y`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || `${months}m`;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function AdamPage() {
  const queryClient = useQueryClient();

  // --- Chat state ---
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- KB state ---
  const [activeTab, setActiveTab] = useState<TabId>("skills");
  const [editingExp, setEditingExp] = useState<number | null>(null);
  const [editingProj, setEditingProj] = useState<number | null>(null);

  // --- Upload state ---
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Preferences state ---
  const [prefEditing, setPrefEditing] = useState(false);
  const [prefRoles, setPrefRoles] = useState<string[]>([]);
  const [prefStages, setPrefStages] = useState<string[]>([]);
  const [prefSectors, setPrefSectors] = useState<string[]>([]);

  /* ---- queries ---- */

  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => apiFetch<UserProfile>("/api/adam/profile"),
    staleTime: 5 * 60 * 1000,
  });

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => apiFetch<ChatSession[]>("/api/chat/sessions"),
  });

  const suggestMutation = useMutation({
    mutationFn: () => apiFetch<PreferenceSuggestions>("/api/adam/suggest-preferences", { method: "POST" }),
  });

  const profileMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      apiFetch<UserProfile>("/api/adam/profile", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });

  const profile = profileQuery.data;
  const sessions = sessionsQuery.data ?? [];

  // scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // auto-select first session
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      const first = sessions[0];
      setActiveSessionId(first.id);
      loadMessages(first.id);
    }
  }, [sessions, activeSessionId]);

  // init pref state from profile
  useEffect(() => {
    if (profile) {
      setPrefRoles(profile.preferred_roles ?? []);
      setPrefStages(profile.preferred_stages ?? []);
      setPrefSectors(profile.preferred_sectors ?? []);
    }
  }, [profile]);

  /* ---- chat helpers ---- */

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await apiFetch<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`);
      setChatMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  const createSession = async () => {
    try {
      const session = await apiFetch<ChatSession>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      setActiveSessionId(session.id);
      setChatMessages([]);
      setShowSessions(false);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await apiFetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setChatMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const switchSession = (id: string) => {
    setActiveSessionId(id);
    loadMessages(id);
    setShowSessions(false);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeSessionId || sending) return;
    const text = chatInput.trim();
    setChatInput("");
    setSending(true);

    setChatMessages((prev) => [
      ...prev,
      { id: "temp-user", role: "user", content: text, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await apiFetch<{ user_message: ChatMessage; adam_reply: ChatMessage }>(
        `/api/chat/sessions/${activeSessionId}/messages`,
        { method: "POST", body: JSON.stringify({ message: text }) },
      );
      setChatMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== "temp-user");
        return [...filtered, res.user_message, res.adam_reply];
      });
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    } catch (err) {
      console.error("Failed to send message:", err);
      setChatMessages((prev) => prev.filter((m) => m.id !== "temp-user"));
    } finally {
      setSending(false);
    }
  };

  /* ---- CV upload ---- */

  const handleCVUpload = async (file: File) => {
    if (!file.name.endsWith(".pdf")) return;
    setUploading(true);
    setUploadProgress("Uploading and processing CV…");

    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload("/api/adam/upload", formData);
      setUploadProgress("CV updated successfully!");
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      setTimeout(() => {
        setUploading(false);
        setUploadProgress("");
      }, 2000);
    } catch (err) {
      console.error("CV upload failed:", err);
      setUploadProgress("Upload failed. Please try again.");
      setTimeout(() => {
        setUploading(false);
        setUploadProgress("");
      }, 3000);
    }
  };

  /* ---- preference helpers ---- */

  const savePrefChanges = () => {
    profileMutation.mutate({
      preferred_roles: prefRoles,
      preferred_stages: prefStages,
      preferred_sectors: prefSectors,
    });
    setPrefEditing(false);
  };

  const applySuggestions = (suggestions: PreferenceSuggestions) => {
    const mergeUnique = (existing: string[], suggested: string[]) => [
      ...new Set([...existing, ...suggested]),
    ];
    setPrefRoles(mergeUnique(prefRoles, suggestions.roles));
    setPrefStages(mergeUnique(prefStages, suggestions.stages));
    setPrefSectors(mergeUnique(prefSectors, suggestions.sectors));
    setPrefEditing(true);
  };

  /* ---- KB save helpers ---- */

  const saveSkills = (technical: string[], soft: string[]) => {
    profileMutation.mutate({ parsed_skills: { technical, soft } });
  };

  const saveExperience = (exps: Experience[]) => {
    profileMutation.mutate({ parsed_experience: exps });
    setEditingExp(null);
  };

  const saveProjects = (projs: Project[]) => {
    profileMutation.mutate({ parsed_projects: projs });
    setEditingProj(null);
  };

  /* ---- render KB body ---- */

  function renderKnowledgeBody() {
    if (profileQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Technical
              </p>
              <TagEditor
                tags={technicalSkills}
                onUpdate={(t) => saveSkills(t, softSkills)}
                color="blue"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Soft skills
              </p>
              <TagEditor
                tags={softSkills}
                onUpdate={(s) => saveSkills(technicalSkills, s)}
                color="emerald"
              />
            </div>
          </div>
        );

      case "experience":
        return (
          <div className="space-y-4">
            {experiences.length ? (
              experiences.map((ex, i) => {
                const isEditing = editingExp === i;
                return (
                  <ExperienceCard
                    key={`${ex.company}-${ex.role}-${i}`}
                    exp={ex}
                    editing={isEditing}
                    onEdit={() => setEditingExp(i)}
                    onSave={(updated) => {
                      const newExps = [...experiences];
                      newExps[i] = updated;
                      saveExperience(newExps);
                    }}
                    onDelete={() => {
                      saveExperience(experiences.filter((_, idx) => idx !== i));
                    }}
                    onCancel={() => setEditingExp(null)}
                  />
                );
              })
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No experience entries.</p>
            )}
          </div>
        );

      case "projects":
        return (
          <div className="space-y-3">
            {projects.length ? (
              projects.map((p, i) => {
                const isEditing = editingProj === i;
                return (
                  <ProjectCard
                    key={`${p.name}-${i}`}
                    project={p}
                    editing={isEditing}
                    onEdit={() => setEditingProj(i)}
                    onSave={(updated) => {
                      const newProjs = [...projects];
                      newProjs[i] = updated;
                      saveProjects(newProjs);
                    }}
                    onDelete={() => {
                      saveProjects(projects.filter((_, idx) => idx !== i));
                    }}
                    onCancel={() => setEditingProj(null)}
                  />
                );
              })
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No projects yet.</p>
            )}
          </div>
        );

      case "proof":
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 pb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-[var(--text-muted)]">
                AI-analyzed from your CV and interview — read only
              </span>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {proofPoints.length ? (
                proofPoints.map((pp, i) => <ProofPointCard key={`${pp.title}-${i}`} pp={pp} />)
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No proof points extracted.</p>
              )}
            </div>
          </div>
        );

      case "preferences":
        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">
                {prefEditing ? "Editing preferences" : "Your job preferences"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    suggestMutation.mutate(undefined, { onSuccess: applySuggestions });
                  }}
                  disabled={suggestMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                >
                  {suggestMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  AI Suggest
                </button>
                {prefEditing && (
                  <button
                    type="button"
                    onClick={savePrefChanges}
                    disabled={profileMutation.isPending}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 transition-colors"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Preferred roles
              </p>
              <TagEditor
                tags={prefRoles}
                onUpdate={(r) => {
                  setPrefRoles(r);
                  setPrefEditing(true);
                }}
                color="blue"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Company stages
              </p>
              <StageSelector
                selected={prefStages}
                onChange={(s) => {
                  setPrefStages(s);
                  setPrefEditing(true);
                }}
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Sectors
              </p>
              <TagEditor
                tags={prefSectors}
                onUpdate={(s) => {
                  setPrefSectors(s);
                  setPrefEditing(true);
                }}
                color="amber"
              />
            </div>

            <div className="flex items-start gap-2 text-sm pt-2">
              <MapPin className="w-4 h-4 mt-0.5 text-[var(--text-muted)] shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Location</p>
                <p className="text-[var(--text-main)] mt-0.5">{profile?.location || "Not set"}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  /* ---- main render ---- */

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col lg:flex-row">
      {/* ===== LEFT: Chat ===== */}
      <section className="w-full lg:w-3/5 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border)] min-h-[420px] lg:min-h-[calc(100vh-8rem)]">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <Mic className="w-4 h-4 text-[var(--primary)]" />
          <h1 className="text-lg font-medium tracking-tight">Adam</h1>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSessions(!showSessions)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] transition-colors"
              title="Chat sessions"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={createSession}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Session sidebar */}
        {showSessions && (
          <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 max-h-52 overflow-y-auto">
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-4 text-[var(--text-muted)] text-sm">
                <p className="mb-2">No conversations yet</p>
                <button
                  type="button"
                  onClick={createSession}
                  className="px-3 py-1.5 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] text-xs"
                >
                  Start a Chat
                </button>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                      activeSessionId === s.id
                        ? "bg-[var(--primary)]/10 text-white"
                        : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]",
                    )}
                  >
                    <div className="flex-1 min-w-0" onClick={() => switchSession(s.id)}>
                      <p className="font-medium truncate">{s.title}</p>
                      {s.last_message && (
                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          {s.last_message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] ml-2 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {!activeSessionId ? (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div>
              <MessageCircle className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]/50" />
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Start a conversation with Adam
              </p>
              <button
                type="button"
                onClick={createSession}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm hover:opacity-90 transition-opacity"
              >
                New Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
              {chatMessages.length === 0 && !sending && (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">
                  Send a message to start chatting with Adam
                </p>
              )}
              {chatMessages.map((m, idx) => {
                const isAdam = m.role !== "user";
                return (
                  <div
                    key={`${m.id}-${idx}`}
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
                      <p className="text-[10px] mt-2 opacity-60 text-[var(--text-muted)]">
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="p-3 border-t border-[var(--border)] bg-[var(--background)]/40 backdrop-blur-sm"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <div className="flex gap-2 input-focus rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <input
                  className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] min-w-0"
                  placeholder="Message Adam…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !chatInput.trim()}
                  className="shrink-0 rounded-xl p-2 bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 disabled:opacity-40 transition-colors"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* ===== RIGHT: Knowledge Base ===== */}
      <aside className="w-full lg:w-2/5 flex flex-col min-h-[360px] lg:min-h-[calc(100vh-8rem)]">
        {/* Action buttons */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCVUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? "Processing…" : "Upload Updated CV"}
          </button>
          <Link
            href="/adam/interview"
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
            Take Re-interview
          </Link>
        </div>

        {/* Upload progress */}
        {uploadProgress && (
          <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]/50">
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
              {uploadProgress}
            </p>
          </div>
        )}

        {/* KB header + tabs */}
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

        {/* KB content */}
        <div className="flex-1 overflow-y-auto p-4">{renderKnowledgeBody()}</div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Experience card                                                   */
/* ------------------------------------------------------------------ */

function ExperienceCard({
  exp,
  editing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: {
  exp: Experience;
  editing: boolean;
  onEdit: () => void;
  onSave: (updated: Experience) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState(exp.company);
  const [role, setRole] = useState(exp.role);
  const [duration, setDuration] = useState(exp.duration_months);
  const [desc, setDesc] = useState(exp.description);
  const [tech, setTech] = useState(exp.tech_used?.join(", ") ?? "");

  if (!editing) {
    return (
      <div className="relative pl-4 border-l border-[var(--border)] group">
        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[var(--primary)]/60" />
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-[var(--text-main)]">{exp.company}</p>
            <p className="text-sm text-[var(--text-muted)]">{exp.role}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatDurationMonths(exp.duration_months)}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)]"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded hover:bg-white/10 text-red-400/70"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {exp.tech_used?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {exp.tech_used.map((t) => (
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
    );
  }

  return (
    <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface-elevated)]/40 p-3 space-y-2">
      <input
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company"
      />
      <input
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role"
      />
      <div className="flex gap-2">
        <input
          type="number"
          className="w-24 bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
          placeholder="Months"
        />
        <span className="text-xs text-[var(--text-muted)] self-center">months</span>
      </div>
      <textarea
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)] resize-none"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description"
        rows={2}
      />
      <input
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
        value={tech}
        onChange={(e) => setTech(e.target.value)}
        placeholder="Tech (comma separated)"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...exp,
              company,
              role,
              duration_months: duration,
              description: desc,
              tech_used: tech
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project card                                                      */
/* ------------------------------------------------------------------ */

function ProjectCard({
  project,
  editing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: {
  project: Project;
  editing: boolean;
  onEdit: () => void;
  onSave: (updated: Project) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [tech, setTech] = useState(project.tech?.join(", ") ?? "");

  if (!editing) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/40 p-3 soft-shadow group">
        <div className="flex items-start justify-between">
          <p className="font-medium text-[var(--text-main)]">{project.name}</p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)]"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded hover:bg-white/10 text-red-400/70"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
          {project.description}
        </p>
        {project.tech?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {project.tech.map((t) => (
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
    );
  }

  return (
    <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface-elevated)]/40 p-3 space-y-2">
      <input
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
      />
      <textarea
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)] resize-none"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description"
        rows={3}
      />
      <input
        className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)]"
        value={tech}
        onChange={(e) => setTech(e.target.value)}
        placeholder="Tech (comma separated)"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...project,
              name,
              description: desc,
              tech: tech
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage multi-select                                                */
/* ------------------------------------------------------------------ */

const ALL_STAGES = [
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
  "Growth / Public",
  "Bootstrapped",
];

function StageSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const toggle = (stage: string) => {
    if (selected.includes(stage)) {
      onChange(selected.filter((s) => s !== stage));
    } else {
      onChange([...selected, stage]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_STAGES.map((stage) => {
        const active = selected.includes(stage);
        return (
          <button
            key={stage}
            type="button"
            onClick={() => toggle(stage)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-all duration-200 border",
              active
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-white/5 text-[var(--text-muted)] border-[var(--border)] hover:border-emerald-500/20 hover:text-emerald-300/70",
            )}
          >
            {stage}
          </button>
        );
      })}
    </div>
  );
}
