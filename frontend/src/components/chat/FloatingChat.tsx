"use client";
import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Plus, Send, Loader2, Trash2, ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ChatSession, ChatMessage } from "@/types";

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) loadSessions();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await apiFetch<ChatSession[]>("/api/chat/sessions");
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0].id);
        loadMessages(data[0].id);
      }
    } catch {} finally {
      setLoadingSessions(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const data = await apiFetch<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`);
      setMessages(data);
    } catch {}
  };

  const createSession = async () => {
    try {
      const session = await apiFetch<ChatSession>("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session.id);
      setMessages([]);
      setShowSessions(false);
    } catch {}
  };

  const deleteSession = async (id: string) => {
    try {
      await apiFetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession === id) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch {}
  };

  const switchSession = (id: string) => {
    setActiveSession(id);
    loadMessages(id);
    setShowSessions(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [...prev, { id: "temp", role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const res = await apiFetch<{ user_message: ChatMessage; adam_reply: ChatMessage }>(
        `/api/chat/sessions/${activeSession}/messages`,
        { method: "POST", body: JSON.stringify({ message: text }) }
      );

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== "temp");
        return [...filtered, res.user_message, res.adam_reply];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== "temp"));
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-[var(--primary)] text-white shadow-lg hover:opacity-90 transition-all z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[560px] rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex flex-col z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
        <div className="flex items-center gap-2">
          {showSessions && (
            <button onClick={() => setShowSessions(false)} className="p-1 rounded hover:bg-white/10">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-medium">
            {showSessions ? "Chat Sessions" : "Adam"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSessions(!showSessions)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button onClick={createSession} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSessions ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] text-sm">
              <p className="mb-3">No conversations yet</p>
              <button onClick={createSession}
                className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-sm">
                Start a Chat
              </button>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  activeSession === s.id ? "bg-[var(--primary)]/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex-1 min-w-0" onClick={() => switchSession(s.id)}>
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  {s.last_message && (
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{s.last_message}</p>
                  )}
                </div>
                <button onClick={() => deleteSession(s.id)}
                  className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] ml-2 shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : !activeSession ? (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)] mb-4">Start a conversation with Adam</p>
            <button onClick={createSession}
              className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:opacity-90">
              New Chat
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-[var(--primary)]/20 text-white"
                    : "bg-white/5 text-[var(--text-muted)]"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl bg-white/5 text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask Adam anything..."
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--border)] text-white text-sm placeholder:text-neutral-600 focus:border-[var(--primary)]/30 transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-2.5 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
