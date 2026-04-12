"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Edit3, Save, ArrowRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import type { InterviewTranscript, InterviewQA } from "@/types";

export default function ReviewPage() {
  const [transcript, setTranscript] = useState<InterviewTranscript | null>(null);
  const [qaList, setQaList] = useState<InterviewQA[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<InterviewTranscript | null>("/api/adam/interview/transcript");
        if (data) {
          setTranscript(data);
          setQaList(data.analyzed_qa || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/adam/interview/answers", {
        method: "PATCH",
        body: JSON.stringify({ analyzed_qa: qaList }),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setEditingIdx(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      if (editingIdx !== null) await handleSave();
      await apiFetch("/api/adam/onboarding/step", { method: "PATCH" });
      await loadUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Review Your Answers</h1>
        <p className="text-[var(--text-muted)]">
          Here's what Adam gathered from your interview. Edit anything you'd like to clarify or expand.
        </p>
      </div>

      {qaList.length === 0 ? (
        <div className="card-zen rounded-2xl p-8 text-center">
          <p className="text-[var(--text-muted)]">No interview data found. You can continue to the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {qaList.map((qa, idx) => (
            <div key={idx} className="card-zen rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--primary)]">{qa.question}</h3>
                <button
                  onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {editingIdx === idx ? (
                <div className="space-y-3">
                  <textarea
                    value={qa.answer}
                    onChange={(e) => {
                      const updated = [...qaList];
                      updated[idx] = { ...qa, answer: e.target.value };
                      setQaList(updated);
                    }}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-white placeholder:text-neutral-600 focus:border-[var(--primary)]/30 transition-all resize-none"
                  />
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-sm hover:bg-[var(--primary)]/30 disabled:opacity-50">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{qa.answer}</p>
              )}

              {qa.key_insights?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {qa.key_insights.map((insight, j) => (
                    <span key={j} className="px-2 py-1 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-xs">
                      {insight}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleComplete} disabled={completing}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {completing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Completing...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Complete Onboarding</>
          )}
        </button>
      </div>
    </div>
  );
}
