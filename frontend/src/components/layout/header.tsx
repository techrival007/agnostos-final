"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Folder, BookOpen, Settings } from "lucide-react";
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
  const { user } = useAuthStore();
  const { unreadCount, togglePanel, fetchUnreadCount } = useNotificationStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!profileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 bg-[var(--background)]/70 backdrop-blur-xl z-40 border-b border-[var(--border)]">
      <div />

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
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((open) => !open)}
            className="w-8 h-8 rounded-full bg-[#1a1a1b] flex items-center justify-center font-medium text-[10px] border border-white/5 text-[var(--text-muted)] cursor-pointer hover:text-white transition-all"
            aria-label="Open profile menu"
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border)] bg-[#0c0c0e]/95 shadow-xl backdrop-blur-xl p-2">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user?.email || "No email"}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-white/5 hover:text-white transition-all"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
