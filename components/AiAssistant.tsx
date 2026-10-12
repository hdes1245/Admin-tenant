"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, CircleAlert, Copy, Send, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";

interface AiContext {
  kpis:       Record<string, number>;
  derived:    Record<string, unknown>;
  tickets:    Array<{ status: string; count: number }>;
  activity:   Array<{ action: string; count: number }>;
  topAgences: Array<{ agence: string; Clients: number }>;
  days:       number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

const QUICK_QUESTIONS = [
  "Quelle agence a le plus de clients ?",
  "Quel est le taux de résolution des tickets ?",
  "Y a-t-il des agences sans CAF affecté ?",
  "Analyse la tendance d'activité récente",
  "Donne-moi un résumé exécutif",
  "Quelles actions correctives recommandes-tu ?",
];

const EMPTY_CONTEXT: AiContext = {
  kpis: {}, derived: {}, tickets: [], activity: [], topAgences: [], days: 30,
};

interface Props {
  context?: AiContext;
}

export default function AiAssistant({ context = EMPTY_CONTEXT }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState<number | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          role: "assistant",
          content:
            "Bonjour ! Je suis votre assistant IA GeoTrust. Je peux analyser vos données en temps réel, identifier des tendances et vous recommander des actions. Comment puis-je vous aider ?",
        }]);
      }
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg: Message = { role: "user", content: q };
    const newMessages      = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error, isError: true }]);
        setLoading(false);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion au service IA.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: msg, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, context]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const copyMessage = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Conversation réinitialisée. Comment puis-je vous aider ?",
    }]);
  };

  return (
    <>
      {/* Floating toggle button */}
      <Tooltip title={open ? "Fermer l'assistant IA" : "Assistant IA GeoTrust"} side="left">
        <button
          type="button"
          aria-label={open ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
          onClick={() => setOpen((v) => !v)}
          className="fixed bottom-6 right-6 z-[1400] flex size-14 cursor-pointer items-center justify-center rounded-full border-0 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-[250ms] hover:scale-[1.08] hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)]"
          style={{
            background: open
              ? "linear-gradient(135deg, var(--banner-to) 0%, var(--banner-from) 100%)"
              : "linear-gradient(135deg, #3C8047 0%, #1F5C30 100%)",
          }}
        >
          {open ? <X size={22} className="text-white" /> : <Bot size={24} className="text-white" />}
        </button>
      </Tooltip>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[92px] right-6 z-[1399] flex h-[540px] w-[calc(100vw-32px)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-[#1E6091]/15 bg-surface shadow-2xl sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}>
            <span className="flex size-8 items-center justify-center rounded-full bg-[#3C8047] text-[#0F3B5C]"><Bot size={18} /></span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-white">Assistant IA GeoTrust</div>
              <div className="text-[11px] text-white/60">Analyse vos données en temps réel</div>
            </div>
            <Tooltip title="Réinitialiser la conversation">
              <button type="button" aria-label="Réinitialiser la conversation" onClick={clearChat} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-white/50 hover:text-white">
                <Sparkles size={18} />
              </button>
            </Tooltip>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-background px-4 py-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.isError ? (
                  <div className="flex max-w-[90%] items-start gap-2 rounded-[12px_12px_12px_2px] border border-red-200 bg-red-50 px-3 py-2">
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <span className="text-[13px] leading-relaxed text-red-800">{msg.content}</span>
                  </div>
                ) : (
                  <div
                    className={`group relative max-w-[85%] px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${
                      msg.role === "user"
                        ? "rounded-[12px_12px_2px_12px] bg-[#1E6091]"
                        : "rounded-[12px_12px_12px_2px] border border-[#1E6091]/15 bg-surface"
                    }`}
                  >
                    <div className={`whitespace-pre-wrap text-[13px] leading-relaxed ${msg.role === "user" ? "text-white" : "text-foreground"}`}>{msg.content}</div>
                    {msg.role === "assistant" && (
                      <button
                        type="button"
                        aria-label="Copier le message"
                        onClick={() => copyMessage(idx, msg.content)}
                        className={`absolute right-0.5 top-0.5 cursor-pointer rounded-full border-0 bg-transparent p-1 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 ${copied === idx ? "text-emerald-600" : "text-[#1E6091]"}`}
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-[12px_12px_12px_2px] border border-[#1E6091]/15 bg-surface px-3 py-2">
                  <Spinner className="size-3 text-[#1E6091]" />
                  <span className="text-xs text-muted-foreground">Analyse en cours…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="bg-background px-3 pb-2">
              <div className="mb-2 px-1 text-[11px] text-muted-foreground">Questions rapides :</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="h-6 cursor-pointer rounded-full border border-[#1E6091]/25 bg-transparent px-2.5 text-[10px] text-[#1E6091] transition-colors hover:border-[#1E6091] hover:bg-[#1E6091]/5"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-[#1E6091]/10 bg-surface px-3 py-2.5">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Posez votre question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              className="max-h-20 min-h-9 w-full resize-none rounded-lg border border-[#1E6091]/20 bg-transparent px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground hover:border-[#1E6091] focus:border-[#1E6091] disabled:opacity-60"
            />
            <Tooltip title="Envoyer (Entrée)">
              <button
                type="button"
                aria-label="Envoyer"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-[#0F3B5C] text-white transition-colors hover:bg-[#1E6091] disabled:cursor-default disabled:bg-black/10 disabled:text-black/25"
              >
                <Send size={17} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </>
  );
}
