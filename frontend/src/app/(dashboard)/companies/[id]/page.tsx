"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Megaphone,
  Newspaper,
  Pencil,
  Search,
  Send,
  SendHorizonal,
  SkipForward,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { BlogPost, CompanyDetail, Contact, ContactEmailStatus, FounderPost, JobPosting, NewsItem } from "@/types";
import { cn, formatDate, hiringScoreColor, stageBadgeColor, statusColor } from "@/lib/utils";

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

function SignalList({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Newspaper;
  children: React.ReactNode;
}) {
  return (
    <section className="card-zen rounded-2xl p-4 flex flex-col min-h-[200px]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      <div className="flex-1 space-y-3 text-sm">{children}</div>
    </section>
  );
}

function NewsBlock({ items }: { items: NewsItem[] }) {
  if (!items?.length) return <p className="text-sm text-[var(--text-muted)]">No recent news.</p>;
  return (
    <>
      {items.map((n, i) => (
        <div key={i} className="border-b border-[var(--border)] last:border-0 pb-3 last:pb-0">
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white hover:text-[var(--primary)] line-clamp-2"
          >
            {n.headline}
          </a>
          <p className="text-xs text-[var(--text-muted)] mt-1">{formatDate(n.date)}</p>
          {n.summary && <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-3">{n.summary}</p>}
        </div>
      ))}
    </>
  );
}

function BlogBlock({ items }: { items: BlogPost[] }) {
  if (!items?.length) return <p className="text-sm text-[var(--text-muted)]">No blog posts.</p>;
  return (
    <>
      {items.map((b, i) => (
        <div key={i} className="border-b border-[var(--border)] last:border-0 pb-3 last:pb-0">
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white hover:text-[var(--primary)] line-clamp-2"
          >
            {b.title}
          </a>
          <p className="text-xs text-[var(--text-muted)] mt-1">{formatDate(b.date)}</p>
          {b.summary && <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-3">{b.summary}</p>}
        </div>
      ))}
    </>
  );
}

function FounderBlock({ items }: { items: FounderPost[] }) {
  if (!items?.length) return <p className="text-sm text-[var(--text-muted)]">No founder posts.</p>;
  return (
    <>
      {items.map((f, i) => (
        <div key={i} className="border-b border-[var(--border)] last:border-0 pb-3 last:pb-0">
          <p className="font-medium text-white">{f.author}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(f.date)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-4">{f.content}</p>
        </div>
      ))}
    </>
  );
}

function JobsBlock({ items }: { items: JobPosting[] }) {
  if (!items?.length) return <p className="text-sm text-[var(--text-muted)]">No job postings.</p>;
  return (
    <>
      {items.map((j, i) => (
        <div key={i} className="border-b border-[var(--border)] last:border-0 pb-3 last:pb-0">
          <a
            href={j.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white hover:text-[var(--primary)] line-clamp-2"
          >
            {j.title}
          </a>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {formatDate(j.date)}
            {j.department ? ` · ${j.department}` : ""}
          </p>
        </div>
      ))}
    </>
  );
}

interface EnrichedContact {
  contact_id: string;
  name: string;
  email: string;
  source: string;
  already_had: boolean;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : "";
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [enrichingResearch, setEnrichingResearch] = useState(false);
  const [researchDone, setResearchDone] = useState(false);
  const [enrichingContacts, setEnrichingContacts] = useState(false);
  const [contactsDone, setContactsDone] = useState(false);
  const [enrichedContacts, setEnrichedContacts] = useState<EnrichedContact[]>([]);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  async function handleResearchEnrich() {
    setEnrichingResearch(true);
    setEnrichError(null);
    try {
      await apiFetch(`/api/theos/companies/${id}/enrich/research`, { method: "POST" });
      setResearchDone(true);
      queryClient.invalidateQueries({ queryKey: ["theos-company", id] });
    } catch (err) {
      setEnrichError((err as Error).message || "Research failed");
    } finally {
      setEnrichingResearch(false);
    }
  }

  async function handleApolloEnrich() {
    setEnrichingContacts(true);
    setEnrichError(null);
    try {
      const result = await apiFetch<{ contacts: EnrichedContact[] }>(
        `/api/theos/companies/${id}/enrich/contacts`,
        { method: "POST" },
      );
      setEnrichedContacts(result.contacts);
      setContactsDone(true);
      queryClient.invalidateQueries({ queryKey: ["theos-company", id] });
    } catch (err) {
      setEnrichError((err as Error).message || "Contact enrichment failed");
    } finally {
      setEnrichingContacts(false);
    }
  }

  async function handleFullEnrichAndCampaign() {
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch(`/api/theos/companies/${id}/enrich`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["theos-company", id] });
      const result = await apiFetch<{ campaign: { id: string } }>("/api/mercury/campaigns", {
        method: "POST",
        body: JSON.stringify({ company_id: id }),
      });
      router.push(`/mercury?view=campaigns&campaign=${result.campaign.id}`);
    } catch (err) {
      setCreateError((err as Error).message || "Failed to create campaign");
      setCreating(false);
    }
  }

  async function handleCreateCampaign() {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await apiFetch<{ campaign: { id: string } }>("/api/mercury/campaigns", {
        method: "POST",
        body: JSON.stringify({ company_id: id }),
      });
      router.push(`/mercury?view=campaigns&campaign=${result.campaign.id}`);
    } catch (err) {
      setCreateError((err as Error).message || "Failed to create campaign");
      setCreating(false);
    }
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["theos-company", id],
    queryFn: () => apiFetch<CompanyDetail>(`/api/theos/companies/${id}`),
    enabled: Boolean(id),
  });

  const research = data?.research;

  const grids = useMemo(
    () => ({
      news: (research?.recent_news as NewsItem[] | null) ?? null,
      blogs: (research?.blog_posts as BlogPost[] | null) ?? null,
      founders: (research?.founder_posts as FounderPost[] | null) ?? null,
      jobs: (research?.job_postings as JobPosting[] | null) ?? null,
    }),
    [research]
  );

  if (!id) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-[var(--text-muted)]">Invalid company.</p>
        <Link href="/companies" className="text-[var(--primary)] text-sm mt-2 inline-block">
          Back to companies
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-8" />
        <div className="h-40 bg-white/10 rounded-2xl mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white/10 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-white/10 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <p className="text-red-300 text-sm">{(error as Error)?.message || "Company not found"}</p>
        <Link href="/companies" className="text-[var(--primary)] text-sm mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to companies
        </Link>
      </div>
    );
  }

  const { company, contacts } = data;
  const web = company.website?.startsWith("http") ? company.website : company.website ? `https://${company.website}` : null;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <Link
        href="/companies"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Companies
      </Link>

      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-3">{company.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {web && (
              <a
                href={web}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
              >
                Website
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                stageBadgeColor(company.stage)
              )}
            >
              {stageLabel(company.stage)}
            </span>
            {company.source && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-white/5 text-[var(--text-muted)] border-white/10">
                {company.source}
              </span>
            )}
            <span className={cn("text-lg font-semibold tabular-nums", hiringScoreColor(company.hiring_score))}>
              {company.hiring_score} <span className="text-xs font-normal text-[var(--text-muted)]">hiring score</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={handleFullEnrichAndCampaign}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[#050505] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enriching & generating…
                </>
              ) : (
                <>
                  <SendHorizonal className="w-4 h-4" />
                  Create Campaign
                </>
              )}
            </button>
          </div>
          {createError && (
            <p className="text-xs text-red-400">{createError}</p>
          )}
        </div>
      </header>

      <div className="card-zen rounded-2xl p-6 mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Research summary</h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
          {company.research_summary || "No summary available yet."}
        </p>
      </div>

      {/* Enrichment Panel — Theos → Mercury bridge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card-zen rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Company Research</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Use Gemini 2.5 Flash to research this company — news, job postings, founder activity, and tech stack.
          </p>
          <button
            type="button"
            disabled={enrichingResearch || researchDone}
            onClick={handleResearchEnrich}
            className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrichingResearch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Researching with Gemini…
              </>
            ) : researchDone ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Research complete
              </>
            ) : company.research_summary ? (
              <>
                <Search className="w-4 h-4" />
                Re-research company
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Research company
              </>
            )}
          </button>
        </div>

        <div className="card-zen rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Contact Enrichment</h3>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
              Apollo.io
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Find professional email addresses for all contacts using Apollo.io enrichment.
          </p>
          {contactsDone && enrichedContacts.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
              <p className="text-xs text-emerald-300 font-medium mb-1">
                {enrichedContacts.filter((c) => !c.already_had).length} emails found
              </p>
              <div className="space-y-1">
                {enrichedContacts.map((c) => (
                  <div key={c.contact_id} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{c.name}</span>
                    <span className="font-mono text-emerald-300/80">{c.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={enrichingContacts || contactsDone}
            onClick={handleApolloEnrich}
            className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-sm font-medium hover:bg-sky-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrichingContacts ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching from Apollo.io…
              </>
            ) : contactsDone ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Contacts enriched
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Enrich contacts
              </>
            )}
          </button>
        </div>
      </div>

      {enrichError && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {enrichError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <SignalList title="Recent News" icon={Newspaper}>
          <NewsBlock items={grids.news ?? []} />
        </SignalList>
        <SignalList title="Blog Posts" icon={FileText}>
          <BlogBlock items={grids.blogs ?? []} />
        </SignalList>
        <SignalList title="Founder Posts" icon={User}>
          <FounderBlock items={grids.founders ?? []} />
        </SignalList>
        <SignalList title="Job Postings" icon={Briefcase}>
          <JobsBlock items={grids.jobs ?? []} />
        </SignalList>
      </div>

      <ContactsWithMercury companyId={id} contacts={contacts} />
    </div>
  );
}


/* =========================================================================
   ContactsWithMercury — full inline Mercury outreach per contact
   ========================================================================= */

function ContactsWithMercury({ companyId, contacts }: { companyId: string; contacts: Contact[] }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["mercury-status", companyId],
    queryFn: () => apiFetch<ContactEmailStatus[]>(`/api/mercury/status/company/${companyId}`),
    enabled: contacts.length > 0,
  });

  const statusMap = useMemo(() => {
    const map: Record<string, ContactEmailStatus> = {};
    for (const s of statusQuery.data ?? []) {
      map[s.contact_id] = s;
    }
    return map;
  }, [statusQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["mercury-status", companyId] });
    queryClient.invalidateQueries({ queryKey: ["mercury"] });
  };

  async function handleGenerateDraft(contactId: string) {
    setGeneratingId(contactId);
    try {
      await apiFetch("/api/mercury/draft/contact", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, contact_id: contactId }),
      });
      invalidate();
      setExpandedId(contactId);
    } catch {
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleApproveAndSend(emailId: string) {
    setActionPending(true);
    try {
      await apiFetch(`/api/mercury/emails/${emailId}/approve`, { method: "POST" });
      await apiFetch(`/api/mercury/emails/${emailId}/send`, { method: "POST", body: JSON.stringify({}) });
      invalidate();
    } finally {
      setActionPending(false);
    }
  }

  async function handleSkip(emailId: string) {
    setActionPending(true);
    try {
      await apiFetch(`/api/mercury/emails/${emailId}/skip`, { method: "POST" });
      invalidate();
    } finally {
      setActionPending(false);
    }
  }

  async function handlePatch(emailId: string, fields: { subject?: string; body?: string }) {
    setActionPending(true);
    try {
      await apiFetch(`/api/mercury/emails/${emailId}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      invalidate();
    } finally {
      setActionPending(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-[var(--text-muted)]" />
        Contacts & Outreach
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-medium w-8" />
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Outreach</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No contacts yet.
                </td>
              </tr>
            )}
            {contacts.map((c) => {
              const ms = statusMap[c.id];
              const emailStatus = ms?.status ?? "none";
              const hasEmail = !!(c.professional_email || c.personal_email);
              const hasDraft = emailStatus !== "none" && !!ms?.email_id;
              const isExpanded = expandedId === c.id;
              const isGenerating = generatingId === c.id;

              return (
                <ContactRow
                  key={c.id}
                  contact={c}
                  mercuryStatus={ms}
                  emailStatus={emailStatus}
                  hasEmail={hasEmail}
                  hasDraft={hasDraft}
                  isExpanded={isExpanded}
                  isGenerating={isGenerating}
                  actionPending={actionPending}
                  onToggleExpand={() => setExpandedId(isExpanded ? null : c.id)}
                  onGenerateDraft={() => handleGenerateDraft(c.id)}
                  onApproveAndSend={handleApproveAndSend}
                  onSkip={handleSkip}
                  onPatch={handlePatch}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


/* =========================================================================
   ContactRow — single contact with expandable Mercury email preview
   ========================================================================= */

function ContactRow({
  contact: c,
  mercuryStatus: ms,
  emailStatus,
  hasEmail,
  hasDraft,
  isExpanded,
  isGenerating,
  actionPending,
  onToggleExpand,
  onGenerateDraft,
  onApproveAndSend,
  onSkip,
  onPatch,
}: {
  contact: Contact;
  mercuryStatus: ContactEmailStatus | undefined;
  emailStatus: string;
  hasEmail: boolean;
  hasDraft: boolean;
  isExpanded: boolean;
  isGenerating: boolean;
  actionPending: boolean;
  onToggleExpand: () => void;
  onGenerateDraft: () => void;
  onApproveAndSend: (emailId: string) => Promise<void>;
  onSkip: (emailId: string) => void;
  onPatch: (emailId: string, fields: { subject?: string; body?: string }) => void;
}) {
  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]">
        {/* Expand chevron */}
        <td className="px-4 py-3">
          {hasDraft && (
            <button type="button" onClick={onToggleExpand} className="text-[var(--text-muted)] hover:text-white">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </td>

        <td className="px-4 py-3 text-white font-medium">{c.name}</td>
        <td className="px-4 py-3 text-[var(--text-muted)]">{c.role ?? "—"}</td>

        <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">
          {hasEmail ? (c.professional_email || c.personal_email) : "—"}
        </td>

        <td className="px-4 py-3">
          {c.email_source ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
              {c.email_source}
            </span>
          ) : hasEmail ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)] border border-white/10">
              manual
            </span>
          ) : null}
        </td>

        {/* Outreach status */}
        <td className="px-4 py-3">
          {emailStatus !== "none" ? (
            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", statusColor(emailStatus))}>
              {emailStatus}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
        </td>

        {/* Tags */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {c.is_founder && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                founder
              </span>
            )}
            {c.is_new_recruit && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                new_recruit
              </span>
            )}
          </div>
        </td>

        {/* Action button */}
        <td className="px-4 py-3 text-right">
          {!hasEmail ? (
            <span className="text-xs text-[var(--text-muted)]">No email</span>
          ) : !hasDraft ? (
            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerateDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] text-xs font-medium hover:bg-[var(--primary)]/20 transition-all disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  Generate Draft
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--border)] text-[var(--text-muted)] text-xs font-medium hover:text-white hover:bg-white/10 transition-all"
            >
              <Mail className="w-3.5 h-3.5" />
              {isExpanded ? "Hide" : "View"} Draft
            </button>
          )}
        </td>
      </tr>

      {/* Expanded email preview row */}
      {isExpanded && hasDraft && ms && (
        <tr className="border-b border-[var(--border)]">
          <td colSpan={8} className="p-0">
            <InlineEmailPreview
              status={ms}
              contactEmail={c.professional_email || c.personal_email || ""}
              contactName={c.name}
              onApproveAndSend={onApproveAndSend}
              onSkip={onSkip}
              onPatch={onPatch}
              actionPending={actionPending}
            />
          </td>
        </tr>
      )}
    </>
  );
}


/* =========================================================================
   InlineEmailPreview — edit, approve & send, skip — all inline
   ========================================================================= */

function InlineEmailPreview({
  status: ms,
  contactEmail,
  contactName,
  onApproveAndSend,
  onSkip,
  onPatch,
  actionPending,
}: {
  status: ContactEmailStatus;
  contactEmail: string;
  contactName: string;
  onApproveAndSend: (emailId: string) => Promise<void>;
  onSkip: (emailId: string) => void;
  onPatch: (emailId: string, fields: { subject?: string; body?: string }) => void;
  actionPending: boolean;
}) {
  const emailId = ms.email_id!;
  const options = ms.subject_options ?? (ms.subject ? [ms.subject] : []);
  const [subject, setSubject] = useState(ms.subject ?? "");
  const [editingBody, setEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(ms.body ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSubject(ms.subject ?? "");
    setBodyDraft(ms.body ?? "");
    setEditingBody(false);
  }, [ms.email_id, ms.subject, ms.body]);

  const canSend = ms.status === "draft" || ms.status === "approved";
  const alreadySent = ["sent", "opened", "replied"].includes(ms.status);

  const handleSaveBody = () => {
    onPatch(emailId, { body: bodyDraft });
    setEditingBody(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onApproveAndSend(emailId);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-4 my-3 rounded-xl border border-[var(--border)] bg-black/30 p-5 space-y-4">
      {/* To line */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Mail className="w-3.5 h-3.5" />
        <span>To:</span>
        <span className="text-white font-medium">{contactName}</span>
        <span className="font-mono text-[var(--text-muted)]">&lt;{contactEmail}&gt;</span>
        {ms.relevance_score != null && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {(ms.relevance_score <= 1 ? ms.relevance_score * 100 : ms.relevance_score).toFixed(0)}% match
          </span>
        )}
      </div>

      {/* Subject */}
      {options.length > 1 ? (
        <label className="block text-xs text-[var(--text-muted)]">
          Subject
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              onPatch(emailId, { subject: e.target.value });
            }}
            disabled={alreadySent}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white"
          >
            {options.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      ) : (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Subject</p>
          <p className="text-sm font-medium text-white">{ms.subject ?? "(no subject)"}</p>
        </div>
      )}

      {/* Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Body</span>
          {!alreadySent && (
            <button
              type="button"
              onClick={() => {
                if (editingBody) {
                  setBodyDraft(ms.body ?? "");
                  setEditingBody(false);
                } else {
                  setEditingBody(true);
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              {editingBody ? <><X className="w-3 h-3" /> Cancel</> : <><Pencil className="w-3 h-3" /> Edit</>}
            </button>
          )}
        </div>

        {editingBody ? (
          <div className="space-y-2">
            <textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-[var(--border)] bg-[#0a0a0a] px-3 py-2 text-sm text-white leading-relaxed resize-y focus:outline-none focus:border-white/20"
            />
            <button
              type="button"
              onClick={handleSaveBody}
              disabled={actionPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Save changes
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed bg-white/[0.02] rounded-lg p-3 border border-[var(--border)]">
            {ms.body || "(no body)"}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border)]">
        {canSend && (
          <button
            type="button"
            disabled={actionPending || sending}
            onClick={handleSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Approve & Send"}
          </button>
        )}

        {alreadySent && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {ms.status.charAt(0).toUpperCase() + ms.status.slice(1)}
            {ms.sent_at && <span className="ml-1 text-[var(--text-muted)]">· sent</span>}
          </span>
        )}

        {!alreadySent && (
          <button
            type="button"
            disabled={actionPending || sending}
            onClick={() => onSkip(emailId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        )}

        {ms.hook_used && (
          <span className="ml-auto text-[11px] text-[var(--text-muted)] max-w-[300px] truncate" title={ms.hook_used}>
            Hook: {ms.hook_used}
          </span>
        )}
      </div>
    </div>
  );
}
