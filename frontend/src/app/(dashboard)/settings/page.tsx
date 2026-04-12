"use client";
import { useEffect, useMemo, useState } from "react";
import { Mail, Key, Bell, UserRound, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/lib/api";
import type { ProviderSettingsResponse } from "@/types";

export default function SettingsPage() {
  const { user, loadUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [geminiKey, setGeminiKey] = useState("");
  const [apolloKey, setApolloKey] = useState("");
  const [showGeminiEditor, setShowGeminiEditor] = useState(false);
  const [showApolloEditor, setShowApolloEditor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [savingApollo, setSavingApollo] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [providers, setProviders] = useState<ProviderSettingsResponse["providers"]>([]);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user?.name, user?.email]);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await apiFetch<ProviderSettingsResponse>("/api/settings/providers");
        setProviders(data.providers);
      } catch {
        setProviders([
          { id: "gemini", label: "Gemini", configured: false, editable: true },
          { id: "anthropic", label: "Anthropic", configured: false },
          { id: "grok", label: "Grok", configured: false },
          { id: "openai", label: "OpenAI", configured: false },
        ]);
      }
    };
    loadProviders();
  }, []);

  const geminiProvider = useMemo(
    () => providers.find((provider) => provider.id === "gemini"),
    [providers],
  );

  const apolloProvider = useMemo(
    () => providers.find((provider) => provider.id === "apollo"),
    [providers],
  );

  const otherProviders = useMemo(
    () => providers.filter((provider) => provider.id !== "gemini" && provider.id !== "apollo"),
    [providers],
  );

  const saveProfile = async () => {
    setSavingProfile(true);
    setStatus(null);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email,
        }),
      });
      await loadUser();
      setStatus({ kind: "success", message: "Profile updated." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveGemini = async () => {
    setSavingGemini(true);
    setStatus(null);
    try {
      const data = await apiFetch<ProviderSettingsResponse>("/api/settings/providers/gemini", {
        method: "PUT",
        body: JSON.stringify({ gemini_api_key: geminiKey }),
      });
      setProviders(data.providers);
      setGeminiKey("");
      setShowGeminiEditor(false);
      setStatus({ kind: "success", message: "Gemini API key saved and will be used for future requests." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not save Gemini API key.",
      });
    } finally {
      setSavingGemini(false);
    }
  };

  const saveApollo = async () => {
    setSavingApollo(true);
    setStatus(null);
    try {
      const data = await apiFetch<ProviderSettingsResponse>("/api/settings/providers/apollo", {
        method: "PUT",
        body: JSON.stringify({ apollo_api_key: apolloKey }),
      });
      setProviders(data.providers);
      setApolloKey("");
      setShowApolloEditor(false);
      setStatus({ kind: "success", message: "Apollo API key saved. Contact enrichment is now active." });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not save Apollo API key.",
      });
    } finally {
      setSavingApollo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">
        Manage your profile and provider keys.
      </p>

      {status && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
            status.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {status.kind === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.message}
        </div>
      )}

      <div className="space-y-4">
        <div className="card-zen rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserRound className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">Profile</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Full name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 text-sm outline-none focus:border-white/20"
                placeholder="Your name"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 text-sm outline-none focus:border-white/20"
                placeholder="you@company.com"
              />
            </label>
          </div>
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>

        <div className="card-zen rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">Provider Keys</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Gemini is editable now. Other providers are listed as attachable options for upcoming support.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowGeminiEditor((open) => !open)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-[var(--border)] hover:bg-white/[0.04] transition-all text-left"
            >
              <span className="text-sm text-neutral-300">Gemini API Key</span>
              <span className="text-xs text-neutral-500">
                {geminiProvider?.configured ? "Configured" : "Not configured"}
              </span>
            </button>
            {showGeminiEditor && (
              <div className="px-4 py-4 bg-white/[0.02] rounded-xl border border-[var(--border)]">
                <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Gemini key</label>
                <input
                  value={geminiKey}
                  onChange={(event) => setGeminiKey(event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3 text-sm outline-none focus:border-white/20"
                  type="password"
                  placeholder="AIza..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  This updates the root-level `GEMINI_API_KEY` and that key is used in future Gemini requests.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={saveGemini}
                    disabled={savingGemini}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-60"
                  >
                    {savingGemini ? "Saving..." : "Save key"}
                  </button>
                  <button
                    onClick={() => setShowGeminiEditor(false)}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowApolloEditor((open) => !open)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-[var(--border)] hover:bg-white/[0.04] transition-all text-left"
            >
              <span className="text-sm text-neutral-300">Apollo.io API Key</span>
              <span className="text-xs text-neutral-500">
                {apolloProvider?.configured ? "Configured" : "Not configured"}
              </span>
            </button>
            {showApolloEditor && (
              <div className="px-4 py-4 bg-white/[0.02] rounded-xl border border-[var(--border)]">
                <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Apollo key</label>
                <input
                  value={apolloKey}
                  onChange={(event) => setApolloKey(event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3 text-sm outline-none focus:border-white/20"
                  type="password"
                  placeholder="apollo_..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Used for contact email enrichment. Get your key from Apollo.io dashboard.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={saveApollo}
                    disabled={savingApollo}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-60"
                  >
                    {savingApollo ? "Saving..." : "Save key"}
                  </button>
                  <button
                    onClick={() => setShowApolloEditor(false)}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {otherProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-[var(--border)]"
              >
                <span className="text-sm text-neutral-400">{provider.label}</span>
                <button type="button" className="text-xs text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Attach soon
                </button>
              </div>
            ))}
          </div>
        </div>

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
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-base font-medium">Notifications</h2>
          </div>
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <label className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3">
              Product updates
              <input type="checkbox" defaultChecked className="accent-[#60a5fa]" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3">
              Campaign alerts
              <input type="checkbox" defaultChecked className="accent-[#60a5fa]" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3">
              Weekly summaries
              <input type="checkbox" className="accent-[#60a5fa]" />
            </label>
            </div>
        </div>
      </div>
    </div>
  );
}
