"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Users,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Campaign, Company } from "@/types";
import {
  cn,
  formatMoney,
  stageBadgeColor,
  hiringScoreColor,
  statusColor,
} from "@/lib/utils";

function formatStage(stage: string | null): string {
  if (!stage) return "Unknown";
  return stage
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function DashboardHomePage() {
  const companiesQuery = useQuery({
    queryKey: ["theos", "companies", "dashboard", 5],
    queryFn: () =>
      apiFetch<Company[]>(
        "/api/theos/companies?limit=5&sort=hiring_score",
      ),
  });

  const campaignsQuery = useQuery({
    queryKey: ["mercury", "campaigns", "dashboard", 3],
    queryFn: () =>
      apiFetch<Campaign[]>("/api/mercury/campaigns?limit=3"),
  });

  const companies = companiesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  return (
    <div className="min-h-full px-6 py-10 md:px-10 max-w-6xl mx-auto bg-[#050505] text-[#fcfcfc]">
      <section className="mb-12 text-center">
        <h1
          className="stagger-reveal text-5xl lg:text-6xl font-semibold tracking-tight text-[#fcfcfc]"
          style={{ animationDelay: "0.05s" }}
        >
          Think it. Explore it.
        </h1>
        <p
          className="stagger-reveal mt-4 text-base md:text-lg text-[#94a3b8] max-w-2xl mx-auto"
          style={{ animationDelay: "0.14s" }}
        >
          Outbound-first. AI-powered. Your hidden job market, automated.
        </p>
      </section>


      <section className="mb-16">
        <div
          className="stagger-reveal flex items-center justify-between gap-4 mb-6"
          style={{ animationDelay: "0.28s" }}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#60a5fa]" />
            <h2 className="text-lg font-semibold text-[#fcfcfc]">
              Active Hiring Feed
            </h2>
          </div>
          <Link
            href="/companies"
            className="inline-flex items-center gap-1 text-sm text-[#60a5fa] hover:underline"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {companiesQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0e0e0f] p-5 animate-pulse h-40"
              />
            ))}
          </div>
        ) : companiesQuery.isError ? (
          <p className="text-sm text-[#94a3b8]">
            Could not load companies. Try again later.
          </p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-[#94a3b8] rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0e0e0f] px-5 py-8 text-center">
            No companies in the feed yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c, i) => (
              <div
                key={c.id}
                className="stagger-reveal card-zen rounded-2xl p-5 flex flex-col gap-3"
                style={{ animationDelay: `${0.32 + i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#fcfcfc] leading-tight">
                    {c.name}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border",
                      stageBadgeColor(c.stage),
                    )}
                  >
                    {formatStage(c.stage)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[#94a3b8]">Hiring score</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      hiringScoreColor(c.hiring_score),
                    )}
                  >
                    {c.hiring_score}
                  </span>
                  {c.funding_amount_usd != null && c.funding_amount_usd > 0 && (
                    <span className="text-xs text-[#94a3b8] ml-auto">
                      {formatMoney(c.funding_amount_usd)} raised
                    </span>
                  )}
                </div>
                {c.tech_stack && c.tech_stack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.tech_stack.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-[rgba(255,255,255,0.06)] text-[#94a3b8]"
                      >
                        {t}
                      </span>
                    ))}
                    {c.tech_stack.length > 6 && (
                      <span className="text-[10px] text-[#94a3b8]">
                        +{c.tech_stack.length - 6}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94a3b8] mt-auto pt-1">
                  {c.hq_location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {c.hq_location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {c.contact_count} contacts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div
          className="stagger-reveal flex items-center justify-between gap-4 mb-6"
          style={{ animationDelay: "0.42s" }}
        >
          <h2 className="text-lg font-semibold text-[#fcfcfc]">
            Recent Campaigns
          </h2>
          <Link
            href="/mercury"
            className="inline-flex items-center gap-1 text-sm text-[#60a5fa] hover:underline"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {campaignsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0e0e0f] p-5 animate-pulse h-36"
              />
            ))}
          </div>
        ) : campaignsQuery.isError ? (
          <p className="text-sm text-[#94a3b8]">
            Could not load campaigns. Try again later.
          </p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-[#94a3b8] rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0e0e0f] px-5 py-8 text-center">
            No campaigns yet. Start from the pipeline or company queue.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaigns.map((camp, i) => (
              <div
                key={camp.id}
                className="stagger-reveal card-zen rounded-2xl p-5 flex flex-col gap-3"
                style={{ animationDelay: `${0.46 + i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-[#fcfcfc] leading-tight">
                    {camp.company_name ?? "Unknown company"}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                      statusColor(camp.status),
                    )}
                  >
                    {camp.status}
                  </span>
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  <span className="text-[#fcfcfc]">{camp.draft_count}</span>{" "}
                  drafts,{" "}
                  <span className="text-[#fcfcfc]">{camp.sent_count}</span>{" "}
                  sent,{" "}
                  <span className="text-[#fcfcfc]">{camp.opened_count}</span>{" "}
                  opened,{" "}
                  <span className="text-[#fcfcfc]">{camp.replied_count}</span>{" "}
                  replied
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
