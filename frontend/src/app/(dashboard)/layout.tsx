"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FloatingChat } from "@/components/chat/FloatingChat";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
    if (!loading && user && !user.onboarding_completed) router.push("/onboarding/resume");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zen-gradient flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !user.onboarding_completed) return null;

  return (
    <div className="min-h-screen bg-zen-gradient flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <Footer />
      </div>
      <FloatingChat />
    </div>
  );
}
