"use client";
import { Settings, Mail, Key, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>

      <div className="space-y-4">
        <div className="card-zen rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">Email Connection</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Connect your Gmail or Outlook account to send outreach emails through Mercury.
          </p>
          <button className="px-4 py-2 rounded-xl bg-white/5 border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all">
            Connect Email Account
          </button>
        </div>

        <div className="card-zen rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">API Keys</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Configure API keys for Gemini, Deepgram, and other services.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-[var(--border)]">
              <span className="text-sm text-neutral-400">Gemini API Key</span>
              <span className="text-xs text-neutral-600">Not configured</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-[var(--border)]">
              <span className="text-sm text-neutral-400">Deepgram API Key</span>
              <span className="text-xs text-neutral-600">Not configured</span>
            </div>
          </div>
        </div>

        <div className="card-zen rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">Notifications</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Notification preferences will be available once email is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
