"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { Wind, FileText, Mic, CheckCircle } from "lucide-react";

const STEPS = [
  { path: "/onboarding/resume", label: "Resume & LinkedIn", icon: FileText },
  { path: "/onboarding/interview", label: "Voice Interview", icon: Mic },
  { path: "/onboarding/review", label: "Review & Confirm", icon: CheckCircle },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  if (loading || !user) return null;

  const currentStepIndex = STEPS.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="min-h-screen bg-zen-gradient">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wind className="w-6 h-6 text-white" />
            <span className="text-lg font-semibold">Agnostos</span>
          </div>
          <div className="flex items-center gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === currentStepIndex;
              const isDone = i < currentStepIndex;
              return (
                <div key={step.path} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isDone ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    isActive ? "bg-[var(--primary)]/10 text-[var(--primary)]" :
                    isDone ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                  }`}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
