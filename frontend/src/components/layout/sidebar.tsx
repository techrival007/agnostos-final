"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wind, Home, User, Building2, Radio, Search, BarChart3, ScrollText, Settings, Zap, Eye, ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

type NavItem = { href: string; icon: typeof Home; label: string };
type NavGroup = { icon: typeof Home; label: string; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

const NAV: NavEntry[] = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/adam", icon: User, label: "Adam" },
  {
    icon: Eye, label: "Theos",
    children: [
      { href: "/companies", icon: Building2, label: "Companies" },
      { href: "/signals", icon: Radio, label: "Signals" },
      { href: "/browse", icon: Search, label: "Browse" },
    ],
  },
  { href: "/mercury", icon: Zap, label: "Mercury" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/logs", icon: ScrollText, label: "Logs" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) =>
    group.children.some((c) => isActive(c.href));

  const handleLogout = () => {
    const shouldLogout = window.confirm("Are you sure you want to log out?");
    if (shouldLogout) logout();
  };

  return (
    <aside className="w-20 lg:w-64 border-r border-[var(--border)] h-screen sticky top-0 flex flex-col items-center lg:items-start py-8 px-3 lg:px-5 z-50 bg-[var(--background)] shrink-0">
      <Link href="/" className="flex items-center gap-3 mb-12 px-2">
        <div className="w-8 h-8 flex items-center justify-center">
          <Wind className="w-6 h-6 text-white" />
        </div>
        <span className="hidden lg:block font-semibold text-lg tracking-tight">Agnostos</span>
      </Link>

      <nav className="flex flex-col gap-1 w-full flex-1">
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <div key={entry.label} className="flex flex-col">
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all",
                  isGroupActive(entry)
                    ? "text-white"
                    : "text-[var(--text-muted)]"
                )}
              >
                <entry.icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:flex items-center gap-1.5 flex-1">
                  {entry.label}
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </span>
              </div>
              <div className="flex flex-col gap-0.5 lg:pl-5">
                {entry.children.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-[13px] font-medium",
                      isActive(href)
                        ? "bg-white/5 text-white"
                        : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:block">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Link
              key={entry.href}
              href={entry.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-medium",
                isActive(entry.href)
                  ? "bg-white/5 text-white"
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
              )}
            >
              <entry.icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{entry.label}</span>
            </Link>
          )
        )}
      </nav>

      <div className="w-full space-y-1">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--text-muted)] border border-white/5 bg-white/[0.02]">
          <Zap className="w-5 h-5 shrink-0 text-amber-400" />
          <span className="hidden lg:block text-sm font-medium">100 tokens</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--text-muted)] hover:text-red-300 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Log out</span>
        </button>
        <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--text-muted)] hover:text-white transition-all">
          <Settings className="w-5 h-5 shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
