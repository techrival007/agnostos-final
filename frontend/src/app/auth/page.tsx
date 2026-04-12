"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { Wind } from "lucide-react";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push(user.onboarding_completed ? "/" : "/onboarding/resume");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "register") {
        const user = await register(email, password, name);
        router.push("/onboarding/resume");
      } else {
        const user = await login(email, password);
        if (user && !user.onboarding_completed) {
          router.push("/onboarding/resume");
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err.message || (tab === "login" ? "Login failed" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zen-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="stagger-reveal flex items-center justify-center gap-3 mb-12" style={{ animationDelay: "0.1s" }}>
          <Wind className="w-8 h-8 text-white" />
          <span className="text-2xl font-semibold tracking-tight">Agnostos</span>
        </div>

        <div className="stagger-reveal card-zen rounded-3xl p-8" style={{ animationDelay: "0.2s" }}>
          <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/5">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === "login" ? "bg-white/10 text-white" : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab("register"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === "register" ? "bg-white/10 text-white" : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <h1 className="text-xl font-semibold mb-2">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">
            {tab === "login"
              ? "Sign in to your account"
              : "Start discovering the hidden job market"}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === "register" && (
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Name</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-white placeholder:text-neutral-600 focus:border-[var(--primary)]/30 focus:shadow-[0_0_20px_var(--accent-glow)] transition-all"
                  placeholder="Your full name" required
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-white placeholder:text-neutral-600 focus:border-[var(--primary)]/30 focus:shadow-[0_0_20px_var(--accent-glow)] transition-all"
                placeholder="you@example.com" required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-white placeholder:text-neutral-600 focus:border-[var(--primary)]/30 focus:shadow-[0_0_20px_var(--accent-glow)] transition-all"
                placeholder={tab === "login" ? "Enter your password" : "Create a password"}
                required minLength={tab === "register" ? 6 : undefined}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? (tab === "login" ? "Signing in..." : "Creating account...")
                : (tab === "login" ? "Sign in" : "Create account")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
