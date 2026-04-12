export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function formatMoney(amount: number | null): string {
  if (!amount) return "";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export function stageBadgeColor(stage: string | null): string {
  switch (stage) {
    case "pre-seed": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    case "seed": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "series-a": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "series-b": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    default: return "bg-white/5 text-neutral-400 border-white/10";
  }
}

export function hiringScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-neutral-400";
}

export function statusColor(status: string): string {
  switch (status) {
    case "draft": return "bg-neutral-500/20 text-neutral-300";
    case "approved": return "bg-blue-500/20 text-blue-300";
    case "sent": return "bg-sky-500/20 text-sky-300";
    case "opened": return "bg-amber-500/20 text-amber-300";
    case "replied": return "bg-emerald-500/20 text-emerald-300";
    case "bounced": return "bg-red-500/20 text-red-300";
    case "skipped": return "bg-neutral-500/20 text-neutral-500";
    case "queued": return "bg-purple-500/20 text-purple-300";
    case "active": return "bg-emerald-500/20 text-emerald-300";
    case "paused": return "bg-amber-500/20 text-amber-300";
    case "completed": return "bg-blue-500/20 text-blue-300";
    case "dormant": return "bg-neutral-500/20 text-neutral-500";
    default: return "bg-white/5 text-neutral-400";
  }
}
