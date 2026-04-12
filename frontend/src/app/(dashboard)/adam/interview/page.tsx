"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Square, Loader2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

type Status = "ready" | "connecting" | "listening" | "processing" | "speaking" | "active" | "complete";
type Message = { role: "adam" | "user"; text: string };

export default function AdamInterviewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("ready");
  const [isRecording, setIsRecording] = useState(false);
  const [questionNum, setQuestionNum] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const levelFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const interviewDoneRef = useRef(false);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(levelFrameRef.current);
      releaseMic();
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start mic after Adam finishes speaking
  useEffect(() => {
    if (
      status === "active" &&
      !isRecording &&
      conversation.length > 0 &&
      !interviewDoneRef.current &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      const t = setTimeout(() => startMic(), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isRecording, conversation.length]);

  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setStatus("speaking");

    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift()!;
      try {
        const blob = new Blob([buffer], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = 1.5;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); reject(); };
          audio.play().catch(reject);
        });
      } catch (e) {
        console.error("[TTS] playback error:", e);
      }
    }
    isPlayingRef.current = false;
    if (interviewDoneRef.current) {
      setStatus("complete");
    } else {
      setStatus("active");
    }
  }, []);

  const startInterview = async () => {
    setStatus("connecting");
    setError("");
    const token = localStorage.getItem("agnostos_token");
    if (!token) { setError("Not authenticated"); setStatus("ready"); return; }

    const wsUrl = API_BASE.replace(/^http/, "ws") + `/api/adam/interview/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        audioQueueRef.current.push(event.data);
        playAudioQueue();
        return;
      }
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "adam_response") {
          setQuestionNum(msg.question_number);
          setTotalQuestions(msg.total_questions);
          setConversation((prev) => [...prev, { role: "adam", text: msg.text }]);
          if (!msg.has_audio) setStatus("active");
        } else if (msg.type === "transcript") {
          setConversation((prev) => [...prev, { role: "user", text: msg.text }]);
        } else if (msg.type === "no_speech") {
          setStatus("active");
        } else if (msg.type === "interview_complete") {
          interviewDoneRef.current = true;
          setConversation((prev) => [...prev, { role: "adam", text: msg.text }]);
          if (timerRef.current) clearInterval(timerRef.current);
          if (!msg.has_audio) setStatus("complete");
        } else if (msg.type === "error") {
          setError(msg.message);
          setStatus("active");
        }
      } catch {}
    };
    ws.onerror = () => setError("Connection error");
    ws.onclose = () => { if (timerRef.current) clearInterval(timerRef.current); };
  };

  const releaseMic = () => {
    cancelAnimationFrame(levelFrameRef.current);
    setAudioLevel(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
  };

  const startMic = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (interviewDoneRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(250);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 255);
        levelFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setIsRecording(true);
      setStatus("listening");
    } catch {
      setError("Microphone access denied");
    }
  };

  const finishRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      await new Promise((r) => setTimeout(r, 300));
    }
    releaseMic();

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && audioChunksRef.current.length > 0) {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const buffer = await blob.arrayBuffer();
      ws.send(buffer);
    }
    setStatus("processing");
  };

  const endEarly = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_interview" }));
    }
    releaseMic();
    wsRef.current?.close();
    router.push("/adam");
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const progress = totalQuestions > 0 ? Math.min(questionNum / totalQuestions, 1) : 0;

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-lg flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Voice Interview</p>
          {status !== "ready" && status !== "connecting" && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{formatTime(elapsed)}</span>
              <span className="text-[var(--border)]">|</span>
              <span>{questionNum}/{totalQuestions}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {status !== "ready" && status !== "connecting" && (
          <div className="mb-6">
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)]/60 to-[var(--primary)] transition-all duration-500 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Start */}
        {status === "ready" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative mb-8">
              <button
                onClick={startInterview}
                className="relative z-10 w-32 h-32 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--primary)]/30 hover:text-[var(--primary)] soft-shadow transition-all duration-300 active:scale-95"
              >
                <Mic className="w-12 h-12" strokeWidth={1.25} />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Tap to begin</p>
            <p className="text-xs text-[var(--text-muted)]/50">~10 questions, voice only</p>
            <button
              onClick={() => router.push("/adam")}
              className="mt-4 text-xs text-[var(--text-muted)] hover:text-white transition-colors underline underline-offset-2"
            >
              Skip (dev)
            </button>
          </div>
        )}

        {status === "connecting" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
            </div>
          </div>
        )}

        {/* Conversation + controls */}
        {["active", "listening", "processing", "speaking", "complete"].includes(status) && (
          <>
            {/* Transcript area */}
            <div className="flex-1 min-h-[300px] flex flex-col border border-[var(--border)] rounded-2xl bg-[var(--surface)]/40 overflow-hidden soft-shadow mb-4">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                {conversation.map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wide font-medium",
                      m.role === "adam" ? "text-[var(--primary)]" : "text-emerald-400/90",
                    )}>
                      {m.role === "adam" ? "Adam" : "You"}
                    </span>
                    <p className="text-[var(--text-main)]/90 mt-1 whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] mb-3 min-h-[20px]">
              {status === "listening" && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span>Listening... tap mic when done</span>
                </>
              )}
              {status === "processing" && <><Loader2 className="w-3 h-3 animate-spin" /><span>Processing...</span></>}
              {status === "speaking" && (
                <>
                  <div className="flex items-end gap-0.5 h-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-0.5 bg-[var(--primary)] rounded-full animate-pulse"
                        style={{ height: `${40 + Math.random() * 60}%`, animationDelay: `${i * 120}ms`, animationDuration: "600ms" }} />
                    ))}
                  </div>
                  <span>Adam is speaking...</span>
                </>
              )}
              {status === "active" && <span className="text-[var(--text-muted)]/60">Starting mic...</span>}
              {status === "complete" && <span className="text-emerald-400/80">Interview complete</span>}
            </div>

            {/* Centered mic button */}
            {status !== "complete" && (
              <div className="flex justify-center mb-4">
                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-400/50 transition-transform duration-75"
                      style={{ transform: `scale(${1 + audioLevel * 0.5})`, opacity: 0.3 + audioLevel * 0.7 }} />
                  )}
                  <button
                    onClick={isRecording ? finishRecording : startMic}
                    disabled={status === "processing" || status === "speaking"}
                    className={cn(
                      "relative z-10 p-5 rounded-full transition-all duration-200",
                      isRecording
                        ? "bg-red-500/90 text-white shadow-lg shadow-red-500/25"
                        : "bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 border border-[var(--primary)]/20",
                      "disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                  >
                    {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            )}

            {/* End / complete buttons */}
            {status === "complete" ? (
              <button onClick={() => router.push("/adam")}
                className="w-full mt-2 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:brightness-110 transition-all">
                Back to Adam
              </button>
            ) : (
              <button onClick={endEarly}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 rounded-full text-xs text-[var(--text-muted)] border border-[var(--border)] hover:bg-white/5 transition-colors">
                <Square className="w-3 h-3" /> End Interview
              </button>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400/60 hover:text-red-400">dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
