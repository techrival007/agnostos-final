"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Send, MailOpen, MessageCircleReply, Zap, ArrowUpRight, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Analytics } from "@/types";
import { cn } from "@/lib/utils";

const zenPage =
  "min-h-full px-6 py-10 md:px-10 max-w-6xl mx-auto text-[#fcfcfc]";

export default function AnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<Analytics>("/api/analytics"),
  });

  const a = analyticsQuery.data;

  const sent = a?.total_sent ?? 0;
  const opened = a?.total_opened ?? 0;
  const replied = a?.total_replied ?? 0;
  const openRate = a?.open_rate ?? 0;
  const replyRate = a?.reply_rate ?? 0;
  const active = a?.active_campaigns ?? 0;
  const completeness = a?.profile_completeness ?? 0;

  const funnelMax = Math.max(sent, 1);
  const openedW = `${Math.min(100, (opened / funnelMax) * 100)}%`;
  const repliedW = `${Math.min(100, (replied / funnelMax) * 100)}%`;
  const sentW = "100%";
  const daily = a?.daily_sends ?? [];
  const dailyPeak = Math.max(...daily.map((point) => point.count), 1);
  const recentDaily = daily.slice(-10);

  return (
    <div
      className={zenPage}
      style={{
        backgroundColor: "#050505",
        ["--border" as string]: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-10 flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-[#94a3b8]">
          Outreach performance, campaign health, and response momentum.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-[#93c5fd] w-fit">
          <Activity className="w-3.5 h-3.5" />
          Live overview of sends, opens, and replies
        </div>
      </div>

      {analyticsQuery.isLoading && (
        <p className="text-sm text-[#94a3b8]">Loading analytics…</p>
      )}
      {analyticsQuery.isError && (
        <p className="text-sm text-red-400">Could not load analytics.</p>
      )}

      {a && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
            <StatCard
              icon={Send}
              label="Total sent"
              value={sent}
              sub={null}
            />
            <StatCard
              icon={MailOpen}
              label="Opened"
              value={opened}
              sub={`${openRate.toFixed(1)}% open rate`}
            />
            <StatCard
              icon={MessageCircleReply}
              label="Replied"
              value={replied}
              sub={`${replyRate.toFixed(1)}% reply rate`}
            />
            <StatCard
              icon={Zap}
              label="Active campaigns"
              value={active}
              sub={null}
            />
          </div>

          <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="card-zen rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#e2e8f0]">Send trend (recent)</h2>
                <span className="text-xs text-[#64748b]">Last {recentDaily.length} points</span>
              </div>
              {recentDaily.length > 0 ? (
                <div className="grid grid-cols-10 gap-2 items-end h-36">
                  {recentDaily.map((point) => (
                    <div key={point.date} className="flex flex-col items-center gap-2">
                      <div className="h-28 flex items-end w-full">
                        <div
                          className="w-full rounded-md bg-gradient-to-t from-[#60a5fa]/70 to-[#34d399]/60"
                          style={{ height: `${Math.max(12, (point.count / dailyPeak) * 100)}%` }}
                          title={`${point.date}: ${point.count}`}
                        />
                      </div>
                      <span className="text-[10px] text-[#64748b] tabular-nums">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#64748b]">No daily send trend available yet.</p>
              )}
            </div>
            <div className="card-zen rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-[#e2e8f0] mb-4">Quick insights</h2>
              <div className="space-y-3 text-sm">
                <InsightRow label="Open rate" value={`${openRate.toFixed(1)}%`} />
                <InsightRow label="Reply rate" value={`${replyRate.toFixed(1)}%`} />
                <InsightRow label="Active campaigns" value={String(active)} />
                <InsightRow label="Profile completeness" value={`${completeness.toFixed(0)}%`} />
              </div>
              <Link
                href="/mercury"
                className="mt-5 inline-flex items-center gap-1.5 text-xs text-[#93c5fd] hover:text-[#bfdbfe]"
              >
                Open Mercury
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-4">
              Engagement funnel
            </h2>
            <div className="card-zen rounded-2xl p-6 space-y-4">
              <FunnelRow label="Sent" count={sent} width={sentW} tone="sky" />
              <FunnelRow
                label="Opened"
                count={opened}
                width={openedW}
                tone="amber"
              />
              <FunnelRow
                label="Replied"
                count={replied}
                width={repliedW}
                tone="emerald"
              />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-4">
              Top campaigns
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[0.03] text-[#94a3b8] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium text-right">Sent</th>
                    <th className="px-4 py-3 font-medium text-right">Opened</th>
                    <th className="px-4 py-3 font-medium text-right">Replied</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Reply rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {(a.top_campaigns ?? []).map((row) => (
                    <tr key={row.campaign_id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[#e2e8f0]">
                        <Link
                          href="/mercury"
                          className="hover:text-[#93c5fd] hover:underline"
                        >
                          {row.company_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#cbd5e1]">
                        {row.sent}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#cbd5e1]">
                        {row.opened}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#cbd5e1]">
                        {row.replied}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400/90">
                        {row.reply_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(a.top_campaigns ?? []).length === 0 && (
                <p className="px-4 py-6 text-sm text-[#64748b] text-center">
                  No campaign data yet.
                </p>
              )}
            </div>
          </section>

          <section className="mb-2">
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-3">
              Profile completeness
            </h2>
            <div className="card-zen rounded-2xl p-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-[#94a3b8]">Adam profile</span>
                <span className="tabular-nums text-[#e2e8f0] font-medium">
                  {completeness.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#60a5fa]/60 to-[#34d399]/70"
                  style={{ width: `${Math.min(100, completeness)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#64748b]">
                Complete your interview and CV upload in{" "}
                <Link href="/adam" className="text-[#93c5fd] hover:underline">
                  Adam
                </Link>{" "}
                to improve match quality.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <span className="text-[#94a3b8]">{label}</span>
      <span className="tabular-nums text-[#e2e8f0] font-medium">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  sub: string | null;
}) {
  return (
    <div className="card-zen rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[#94a3b8] text-xs font-medium uppercase tracking-wide">
        <Icon className="w-4 h-4 text-[#60a5fa]" />
        {label}
      </div>
      <p className="text-3xl font-semibold tabular-nums text-[#f8fafc]">
        {value}
      </p>
      {sub && <p className="text-sm text-[#64748b]">{sub}</p>}
    </div>
  );
}

function FunnelRow({
  label,
  count,
  width,
  tone,
}: {
  label: string;
  count: number;
  width: string;
  tone: "sky" | "amber" | "emerald";
}) {
  const bar = {
    sky: "from-sky-500/80 to-sky-400/40",
    amber: "from-amber-500/80 to-amber-400/40",
    emerald: "from-emerald-500/80 to-emerald-400/40",
  }[tone];

  return (
    <div>
      <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-[#e2e8f0]">{count}</span>
      </div>
      <div className="h-9 rounded-lg bg-white/[0.04] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-lg bg-gradient-to-r transition-all min-w-[2rem]",
            bar,
          )}
          style={{ width }}
        />
      </div>
    </div>
  );
}
