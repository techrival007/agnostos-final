"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Link2, ArrowRight, FileText, X, Loader2,
  CheckCircle, AlertCircle, SkipForward, ChevronDown, ChevronUp,
  Brain, Database, Search, Sparkles, FolderOpen,
} from "lucide-react";
import { apiStreamUpload, apiFetch } from "@/lib/api";
import type { ProcessingEvent } from "@/types";

const STEPS = [
  { id: "pdf_extract", label: "PDF Extraction", icon: FileText },
  { id: "linkedin_scrape", label: "LinkedIn Scrape", icon: Search },
  { id: "cv_analysis", label: "CV Analysis", icon: Brain },
  { id: "proof_points", label: "Proof Points", icon: Sparkles },
  { id: "knowledge_base", label: "Knowledge Base", icon: Database },
  { id: "local_save", label: "Save Analysis", icon: FolderOpen },
];

type StepStatus = "pending" | "in_progress" | "done" | "error" | "skipped";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "skip";
}

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<"upload" | "processing" | "complete">("upload");
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const now = Date.now();
    const diff = now - (startTime || now);
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const time = `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".pdf")) setFile(dropped);
    else setError("Only PDF files are accepted");
  };

  const handleSubmit = async () => {
    if (!file) { setError("Please upload your resume"); return; }
    setError("");
    setPhase("processing");
    const now = Date.now();
    setStartTime(now);
    timerRef.current = setInterval(() => setElapsed(Date.now() - now), 500);

    const initStatuses: Record<string, StepStatus> = {};
    STEPS.forEach((s) => { initStatuses[s.id] = "pending"; });
    setStepStatuses(initStatuses);
    setLogs([{ time: "00:00", message: "Starting resume processing...", type: "info" }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (linkedinUrl.trim()) formData.append("linkedin_url", linkedinUrl.trim());

      await apiStreamUpload("/api/adam/upload-resume", formData, (event: ProcessingEvent) => {
        const { step, status, message } = event;

        if (step === "complete") {
          setPhase("complete");
          if (timerRef.current) clearInterval(timerRef.current);
          addLog(message, "success");
          return;
        }

        if (step === "error") {
          addLog(message, "error");
          return;
        }

        setStepStatuses((prev) => ({ ...prev, [step]: status as StepStatus }));

        const logType: LogEntry["type"] =
          status === "done" ? "success" :
          status === "error" ? "error" :
          status === "skipped" ? "skip" : "info";
        addLog(message, logType);
      });

      await apiFetch("/api/adam/onboarding/step", { method: "PATCH" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      setPhase("upload");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleContinue = () => {
    router.push("/onboarding/interview");
  };

  if (phase === "upload") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Let&apos;s get to know you</h1>
          <p className="text-[var(--text-muted)]">
            Upload your resume and share your LinkedIn so Adam can understand your background.
          </p>
        </div>

        <div className="card-zen rounded-2xl p-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Resume (PDF)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? "border-[var(--primary)] bg-[var(--primary)]/5" :
                file ? "border-green-500/30 bg-green-500/5" : "border-[var(--border)] hover:border-[var(--primary)]/30"
              }`}
            >
              <input
                ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-6 h-6 text-green-400" />
                  <span className="text-green-400">{file.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="p-1 rounded-full hover:bg-white/10">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-[var(--text-muted)] text-sm">
                    Drag and drop your PDF here, or click to browse
                  </p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">LinkedIn Profile URL (optional)</label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] focus-within:border-[var(--primary)]/30 focus-within:shadow-[0_0_20px_var(--accent-glow)] transition-all">
              <Link2 className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder:text-neutral-600 outline-none"
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={async () => {
              await apiFetch("/api/adam/onboarding/step", { method: "PATCH" });
              router.push("/onboarding/interview");
            }}
            className="text-xs text-[var(--text-muted)] hover:text-white transition-colors underline underline-offset-2"
          >
            Skip (dev)
          </button>
          <button
            onClick={handleSubmit} disabled={!file}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- Processing / Complete phase ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            {phase === "complete" ? "Analysis Complete" : "Adam is analyzing your profile"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            {phase === "complete"
              ? "Your resume and LinkedIn have been processed and stored."
              : "Processing your resume and LinkedIn data through multiple analysis stages."}
          </p>
        </div>
        <div className="text-sm text-[var(--text-muted)] font-mono tabular-nums">
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Step progress */}
      <div className="card-zen rounded-2xl p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {STEPS.map((step) => {
            const status = stepStatuses[step.id] || "pending";
            const Icon = step.icon;
            return (
              <div key={step.id} className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                status === "in_progress" ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30" :
                status === "done" ? "bg-green-500/5" :
                status === "error" ? "bg-red-500/5" :
                status === "skipped" ? "bg-white/[0.02]" : "bg-white/[0.02]"
              }`}>
                <div className="relative">
                  {status === "in_progress" ? (
                    <div className="relative">
                      <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                      <div className="absolute inset-0 w-5 h-5 rounded-full bg-[var(--primary)]/20 animate-ping" />
                    </div>
                  ) : status === "done" ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : status === "error" ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : status === "skipped" ? (
                    <SkipForward className="w-5 h-5 text-neutral-500" />
                  ) : (
                    <Icon className="w-5 h-5 text-neutral-600" />
                  )}
                </div>
                <span className={`text-xs text-center leading-tight ${
                  status === "in_progress" ? "text-[var(--primary)] font-medium" :
                  status === "done" ? "text-green-400" :
                  status === "error" ? "text-red-400" :
                  "text-neutral-500"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live log panel */}
      <div className="card-zen rounded-2xl overflow-hidden">
        <button
          onClick={() => setLogsExpanded(!logsExpanded)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-sm font-medium text-[var(--text-muted)]">
            Processing Log ({logs.length} {logs.length === 1 ? "entry" : "entries"})
          </span>
          {logsExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
        </button>

        {logsExpanded && (
          <div className="border-t border-[var(--border)] bg-[#0a0a0f] max-h-[300px] overflow-y-auto">
            <div className="p-4 font-mono text-xs space-y-1">
              {logs.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-neutral-600 shrink-0 select-none">[{entry.time}]</span>
                  <span className={
                    entry.type === "success" ? "text-green-400" :
                    entry.type === "error" ? "text-red-400" :
                    entry.type === "skip" ? "text-neutral-500 italic" :
                    "text-neutral-300"
                  }>
                    {entry.type === "success" && "-> "}
                    {entry.type === "error" && "!! "}
                    {entry.type === "skip" && "-- "}
                    {entry.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
              {phase === "processing" && (
                <div className="flex gap-3 animate-pulse">
                  <span className="text-neutral-600 select-none">[{formatElapsed(elapsed).padStart(5, "0")}]</span>
                  <span className="text-neutral-500">...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {phase === "complete" && (
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Continue to Interview <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
