"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  SkipForward,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Pencil,
  X,
  Check,
  Send,
  Mail,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import type {
  Campaign,
  CampaignDetail,
  OutreachEmail,
  PipelineColumn,
  User,
} from "@/types";
import { cn, statusColor, timeAgo } from "@/lib/utils";

function timeUntil(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "due";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

const zenPage =
  "min-h-full px-6 py-10 md:px-10 max-w-[1600px] mx-auto text-[#fcfcfc]";

// ---------------------------------------------------------------------------
// Nylas connect banner
// ---------------------------------------------------------------------------
function NylasConnectBanner({ user }: { user: User | null }) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isConnected = !!user?.nylas_grant_id;

  useEffect(() => {
    if (isConnected || dismissed) return;
    setLoading(true);
    apiFetch<{ auth_url: string | null; connected: boolean }>(
      "/api/mercury/nylas/auth-url"
    )
      .then((d) => setAuthUrl(d.auth_url))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isConnected, dismissed]);

  if (isConnected) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
        <Mail className="w-4 h-4 shrink-0" />
        Gmail / Outlook connected — Mercury can send from your inbox.
      </div>
    );
  }

  if (dismissed || loading || !authUrl) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-amber-300">
        <Mail className="w-4 h-4 shrink-0" />
        <span>
          Connect your Gmail or Outlook so Mercury can send emails from your
          inbox.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={authUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30 transition-colors"
        >
          Connect email
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[#64748b] hover:text-[#94a3b8]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function MercuryPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // If redirected from "Create Campaign", honour the URL params
  const urlView = searchParams.get("view") as "kanban" | "campaigns" | null;
  const urlCampaignId = searchParams.get("campaign");

  const [view, setView] = useState<"kanban" | "campaigns">(urlView === "campaigns" ? "campaigns" : "kanban");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(urlCampaignId ?? null);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);

  const pipelineQuery = useQuery({
    queryKey: ["mercury", "pipeline"],
    queryFn: () => apiFetch<PipelineColumn[]>("/api/mercury/pipeline"),
    enabled: view === "kanban",
  });

  const campaignsQuery = useQuery({
    queryKey: ["mercury", "campaigns", "full"],
    queryFn: () => apiFetch<Campaign[]>("/api/mercury/campaigns?limit=100"),
    enabled: view === "campaigns" || !!urlCampaignId,
  });

  const detailQuery = useQuery({
    queryKey: ["mercury", "campaign", expandedCampaignId],
    queryFn: () =>
      apiFetch<CampaignDetail>(
        `/api/mercury/campaigns/${expandedCampaignId}`
      ),
    enabled: !!expandedCampaignId,
  });

  const invalidateMercury = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mercury"] });
  }, [queryClient]);

  const skipMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiFetch<{ status: string }>(`/api/mercury/emails/${emailId}/skip`, {
        method: "POST",
      }),
    onSuccess: invalidateMercury,
  });

  const approveMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiFetch<{ status: string }>(`/api/mercury/emails/${emailId}/approve`, {
        method: "POST",
      }),
    onSuccess: invalidateMercury,
  });

  const sendMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiFetch<{ status: string; note?: string }>(
        `/api/mercury/emails/${emailId}/send`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    onSuccess: invalidateMercury,
  });

  const patchEmailMutation = useMutation({
    mutationFn: ({
      id,
      subject,
      body,
    }: {
      id: string;
      subject?: string;
      body?: string;
    }) =>
      apiFetch<OutreachEmail>(`/api/mercury/emails/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ subject, body }),
      }),
    onSuccess: () => {
      invalidateMercury();
      queryClient.invalidateQueries({
        queryKey: ["mercury", "campaign", expandedCampaignId],
      });
    },
  });

  const handleApproveAndSend = useCallback(
    async (emailId: string) => {
      await approveMutation.mutateAsync(emailId);
      await sendMutation.mutateAsync(emailId);
    },
    [approveMutation, sendMutation]
  );

  const openCampaignFromCard = useCallback((campaignId: string) => {
    setView("campaigns");
    setExpandedCampaignId(campaignId);
    setPreviewEmailId(null);
  }, []);

  const columns = pipelineQuery.data ?? [];
  const actionPending =
    approveMutation.isPending ||
    skipMutation.isPending ||
    sendMutation.isPending ||
    patchEmailMutation.isPending;

  const tabBtn = (
    mode: "kanban" | "campaigns",
    label: string,
    Icon: typeof LayoutGrid
  ) => (
    <button
      type="button"
      onClick={() => {
        setView(mode);
        if (mode === "kanban") setExpandedCampaignId(null);
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        view === mode
          ? "border-[#60a5fa]/40 bg-[#60a5fa]/10 text-[#93c5fd]"
          : "border-[var(--border)] bg-white/[0.02] text-[#94a3b8] hover:bg-white/5 hover:text-[#e2e8f0]"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div
      className={zenPage}
      style={{
        backgroundColor: "#050505",
        ["--border" as string]: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Mercury</h1>
        <p className="text-sm text-[#94a3b8]">
          Mercury outreach: drafts through replies, and campaign-level email
          review.
        </p>
      </div>

      <NylasConnectBanner user={user} />

      <div className="flex flex-wrap gap-3 mb-8">
        {tabBtn("kanban", "Kanban", LayoutGrid)}
        {tabBtn("campaigns", "Campaigns", List)}
      </div>

      {view === "kanban" && (
        <div>
          {pipelineQuery.isLoading ? (
            <p className="text-sm text-[#94a3b8]">Loading pipeline…</p>
          ) : pipelineQuery.isError ? (
            <p className="text-sm text-red-400">Could not load pipeline.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
              {columns.map((col) => (
                <div
                  key={col.status}
                  className="min-w-[280px] shrink-0 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#e2e8f0]">
                      {col.label}
                    </h2>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[#94a3b8]">
                      {col.cards?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
                    {(col.cards ?? []).map((card) => (
                      <div
                        key={card.email_id}
                        className="card-zen rounded-xl p-4 flex flex-col gap-2"
                      >
                        <p className="font-medium text-[#f1f5f9] leading-snug">
                          {card.company_name || "Company"}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          {card.contact_name}
                          {card.contact_role ? ` · ${card.contact_role}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              statusColor(card.status)
                            )}
                          >
                            {card.status}
                          </span>
                          {card.last_activity && (
                            <span className="text-[11px] text-[#64748b]">
                              {timeAgo(
                                typeof card.last_activity === "string"
                                  ? card.last_activity
                                  : (card.last_activity as unknown as string)
                              )}
                            </span>
                          )}
                        </div>
                        {card.next_followup && (
                          <p className="text-[11px] text-amber-400/90">
                            Next follow-up{" "}
                            {timeUntil(
                              typeof card.next_followup === "string"
                                ? card.next_followup
                                : (card.next_followup as unknown as string)
                            )}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            title="View in campaigns"
                            onClick={() =>
                              openCampaignFromCard(card.campaign_id)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white/[0.03] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-white/5"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Skip email"
                            disabled={skipMutation.isPending}
                            onClick={() => skipMutation.mutate(card.email_id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white/[0.03] text-[#94a3b8] hover:text-amber-300 hover:bg-white/5"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "campaigns" && (
        <div className="flex flex-col gap-4">
          {campaignsQuery.isLoading ? (
            <p className="text-sm text-[#94a3b8]">Loading campaigns…</p>
          ) : campaignsQuery.isError ? (
            <p className="text-sm text-red-400">Could not load campaigns.</p>
          ) : (
            (campaignsQuery.data ?? []).map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                expanded={expandedCampaignId === c.id}
                onToggle={() =>
                  setExpandedCampaignId((id) => (id === c.id ? null : c.id))
                }
                detail={
                  expandedCampaignId === c.id ? detailQuery.data : undefined
                }
                detailLoading={
                  expandedCampaignId === c.id && detailQuery.isLoading
                }
                previewEmailId={previewEmailId}
                setPreviewEmailId={setPreviewEmailId}
                onApproveAndSend={handleApproveAndSend}
                onSkip={(id) => skipMutation.mutate(id)}
                onPatch={(id, fields) => patchEmailMutation.mutate({ id, ...fields })}
                actionPending={actionPending}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignCard
// ---------------------------------------------------------------------------
function CampaignCard({
  campaign,
  expanded,
  onToggle,
  detail,
  detailLoading,
  previewEmailId,
  setPreviewEmailId,
  onApproveAndSend,
  onSkip,
  onPatch,
  actionPending,
}: {
  campaign: Campaign;
  expanded: boolean;
  onToggle: () => void;
  detail: CampaignDetail | undefined;
  detailLoading: boolean;
  previewEmailId: string | null;
  setPreviewEmailId: (id: string | null) => void;
  onApproveAndSend: (id: string) => Promise<void>;
  onSkip: (id: string) => void;
  onPatch: (id: string, fields: { subject?: string; body?: string }) => void;
  actionPending: boolean;
}) {
  const stats = useMemo(
    () => ({
      draft: campaign.draft_count,
      sent: campaign.sent_count,
      opened: campaign.opened_count,
      replied: campaign.replied_count,
    }),
    [campaign]
  );

  return (
    <div className="card-zen rounded-2xl p-5 flex flex-col gap-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 shrink-0 text-[#64748b] mt-0.5" />
          ) : (
            <ChevronRight className="w-5 h-5 shrink-0 text-[#64748b] mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-[#f1f5f9] truncate">
              {campaign.company_name ?? "Campaign"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#94a3b8]">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium uppercase tracking-wide",
                  statusColor(campaign.status)
                )}
              >
                {campaign.status}
              </span>
              <span>
                draft {stats.draft} · sent {stats.sent} · opened{" "}
                {stats.opened} · replied {stats.replied}
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] pt-4 pl-8">
          {detailLoading && (
            <p className="text-sm text-[#94a3b8]">Loading emails…</p>
          )}
          {!detailLoading && detail && (
            <ul className="flex flex-col gap-2">
              {detail.emails.map((email) => (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewEmailId(
                        previewEmailId === email.id ? null : email.id
                      )
                    }
                    className="w-full rounded-xl border border-transparent bg-white/[0.02] px-3 py-2 text-left hover:border-[var(--border)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#e2e8f0]">
                        {email.contact_name ?? "Contact"}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-medium uppercase",
                          statusColor(email.status)
                        )}
                      >
                        {email.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#94a3b8] line-clamp-1">
                      {email.subject ?? "(no subject)"}
                    </p>
                    {email.relevance_score != null && (
                      <p className="mt-1 text-[11px] text-[#64748b]">
                        Relevance{" "}
                        {(email.relevance_score <= 1
                          ? email.relevance_score * 100
                          : email.relevance_score
                        ).toFixed(0)}
                        %
                      </p>
                    )}
                  </button>

                  {previewEmailId === email.id && (
                    <EmailPreview
                      email={email}
                      onApproveAndSend={onApproveAndSend}
                      onSkip={onSkip}
                      onPatch={onPatch}
                      actionPending={actionPending}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailPreview — with Edit, Approve & Send, Skip
// ---------------------------------------------------------------------------
function EmailPreview({
  email,
  onApproveAndSend,
  onSkip,
  onPatch,
  actionPending,
}: {
  email: OutreachEmail;
  onApproveAndSend: (id: string) => Promise<void>;
  onSkip: (id: string) => void;
  onPatch: (id: string, fields: { subject?: string; body?: string }) => void;
  actionPending: boolean;
}) {
  const hasSubjectOptions =
    !!email.subject_options && email.subject_options.length > 0;
  const options = hasSubjectOptions
    ? email.subject_options!
    : email.subject
      ? [email.subject]
      : [];

  const [subject, setSubject] = useState(email.subject ?? "");
  const [editingBody, setEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(email.body ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSubject(email.subject ?? "");
    setBodyDraft(email.body ?? "");
    setEditingBody(false);
  }, [email.id, email.subject, email.body]);

  const canSend = email.status === "draft" || email.status === "approved";
  const alreadySent = ["sent", "opened", "replied"].includes(email.status);

  const handleSaveBody = () => {
    onPatch(email.id, { body: bodyDraft });
    setEditingBody(false);
  };

  const handleApproveAndSend = async () => {
    setSending(true);
    try {
      await onApproveAndSend(email.id);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 ml-0 rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-4">
      {/* Subject */}
      {hasSubjectOptions ? (
        <label className="block text-xs text-[#94a3b8]">
          Subject
          <select
            value={subject || options[0] || ""}
            onChange={(e) => {
              const v = e.target.value;
              setSubject(v);
              onPatch(email.id, { subject: v });
            }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e2e8f0]"
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm font-medium text-[#f1f5f9]">
          {email.subject ?? "(no subject)"}
        </p>
      )}

      {/* Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">Body</span>
          {!alreadySent && (
            <button
              type="button"
              onClick={() => {
                if (editingBody) {
                  setBodyDraft(email.body ?? "");
                  setEditingBody(false);
                } else {
                  setEditingBody(true);
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
            >
              {editingBody ? (
                <>
                  <X className="w-3 h-3" /> Cancel edit
                </>
              ) : (
                <>
                  <Pencil className="w-3 h-3" /> Edit
                </>
              )}
            </button>
          )}
        </div>

        {editingBody ? (
          <div className="space-y-2">
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e2e8f0] leading-relaxed resize-y focus:outline-none focus:border-[#60a5fa]/40"
            />
            <button
              type="button"
              onClick={handleSaveBody}
              disabled={actionPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#60a5fa]/20 px-3 py-1.5 text-xs font-medium text-[#93c5fd] hover:bg-[#60a5fa]/30 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Save changes
            </button>
          </div>
        ) : (
          <p className="text-xs text-[#94a3b8] whitespace-pre-wrap leading-relaxed">
            {email.body
              ? email.body.length > 500
                ? `${email.body.slice(0, 500)}…`
                : email.body
              : "(no body)"}
          </p>
        )}
      </div>

      {/* Recipient info */}
      {email.contact_email && (
        <p className="text-[11px] text-[#64748b]">
          To:{" "}
          <span className="text-[#94a3b8]">
            {email.contact_name} &lt;{email.contact_email}&gt;
          </span>
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {canSend && (
          <button
            type="button"
            disabled={actionPending || sending}
            onClick={handleApproveAndSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Approve & Send"}
          </button>
        )}

        {alreadySent && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-[#64748b]">
            <Check className="w-3.5 h-3.5" />
            {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
          </span>
        )}

        {!alreadySent && (
          <button
            type="button"
            disabled={actionPending || sending}
            onClick={() => onSkip(email.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#e2e8f0] hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
