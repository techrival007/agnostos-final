"use client";

import { useEffect, useRef } from "react";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Rocket,
  Bell,
  CheckCheck,
} from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { cn } from "@/lib/utils";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ICON_MAP: Record<string, typeof Bell> = {
  search_started: Rocket,
  search_progress: Loader2,
  search_completed: CheckCircle2,
  search_failed: AlertCircle,
  companies_added: Search,
};

export function NotificationPanel() {
  const {
    notifications,
    isOpen,
    loading,
    closePanel,
    markAsRead,
    markAllRead,
  } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] rounded-2xl border border-[var(--border)] bg-[#0e0e0f] shadow-2xl overflow-hidden z-[100] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <button
          onClick={markAllRead}
          className="flex items-center gap-1 text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark all read
        </button>
      </div>

      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[#94a3b8] animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell className="w-6 h-6 text-[#334155]" />
            <p className="text-sm text-[#64748b]">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = ICON_MAP[n.type] || Bell;
            const isFailed = n.type === "search_failed";
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                  !n.is_read && "bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    isFailed
                      ? "bg-red-500/10 text-red-400"
                      : "bg-[#60a5fa]/10 text-[#60a5fa]"
                  )}
                >
                  <Icon className={cn("w-4 h-4", n.type === "search_progress" && "animate-spin")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13px] font-medium truncate", n.is_read ? "text-[#94a3b8]" : "text-white")}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] shrink-0" />
                    )}
                  </div>
                  {n.message && (
                    <p className="text-[12px] text-[#64748b] mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <span className="text-[11px] text-[#475569] mt-1 block">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
