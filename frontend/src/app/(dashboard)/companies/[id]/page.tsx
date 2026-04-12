"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  FileText,
  Loader2,
  Megaphone,
  Newspaper,
  SendHorizonal,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { BlogPost, CompanyDetail, FounderPost, JobPosting, NewsItem } from "@/types";
import { cn, formatDate, hiringScoreColor, stageBadgeColor } from "@/lib/utils";

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

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return "••••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const vis = local.slice(0, Math.min(2, local.length));
  return `${vis}***@${domain}`;
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

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
          <button
            type="button"
            disabled={creating}
            onClick={handleCreateCampaign}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[#050505] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating drafts…
              </>
            ) : (
              <>
                <SendHorizonal className="w-4 h-4" />
                Create Campaign
              </>
            )}
          </button>
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

      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[var(--text-muted)]" />
          Contacts
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Seniority</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Tenure</th>
                <th className="px-4 py-3 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No contacts yet.
                  </td>
                </tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{c.role ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{c.seniority ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">
                    {maskEmail(c.professional_email || c.personal_email)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {c.tenure_months != null ? `${c.tenure_months} mo` : "—"}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
