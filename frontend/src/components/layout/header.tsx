"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Home, Folder, BookOpen, Zap, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { cn } from "@/lib/utils";

const CENTER_NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/mercury", icon: Folder, label: "Mercury" },
  { href: "/browse", icon: BookOpen, label: "Browse Jobs" },
];

const POLL_INTERVAL = 5000;

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { unreadCount, togglePanel, fetchUnreadCount } = useNotificationStore();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 bg-[var(--background)]/70 backdrop-blur-xl z-40 border-b border-[var(--border)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-[var(--border)] cursor-pointer hover:bg-white/10 transition-all">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px] text-emerald-400 font-bold border border-emerald-500/30">P</div>
          <span className="text-xs font-medium text-neutral-300 hidden sm:block">Personal</span>
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center bg-black/40 border border-[var(--border)] rounded-full p-1">
        {CENTER_NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href} href={href}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all",
              isActive(href) ? "nav-pill-active" : "text-[var(--text-muted)] hover:text-white"
            )}
          >
            <Icon className="w-3 h-3" /> {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={togglePanel}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#60a5fa] flex items-center justify-center text-[10px] font-bold text-white px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel />
        </div>
        <div className="w-8 h-8 rounded-full bg-[#1a1a1b] flex items-center justify-center font-medium text-[10px] border border-white/5 text-[var(--text-muted)] cursor-pointer hover:text-white transition-all">
          {initials}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-semibold text-neutral-400">100</span>
        </div>
        <button onClick={logout} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
