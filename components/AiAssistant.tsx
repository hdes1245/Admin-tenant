"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, TextField, IconButton, Chip,
  CircularProgress, Tooltip, Collapse, Avatar,
} from "@mui/material";
import SmartToyIcon    from "@mui/icons-material/SmartToy";
import CloseIcon       from "@mui/icons-material/Close";
import SendIcon        from "@mui/icons-material/Send";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

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
  const inputRef                = useRef<HTMLInputElement>(null);

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
      <Tooltip title={open ? "Fermer l'assistant IA" : "Assistant IA GeoTrust"} placement="left">
        <Box
          onClick={() => setOpen((v) => !v)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1400,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: open
              ? `linear-gradient(135deg, ${STEEL} 0%, ${NAVY} 100%)`
              : `linear-gradient(135deg, ${GOLD} 0%, #A07820 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            transition: "all 0.25s ease",
            "&:hover": { transform: "scale(1.08)", boxShadow: "0 6px 24px rgba(0,0,0,0.35)" },
          }}
        >
          {open
            ? <CloseIcon sx={{ color: "#fff", fontSize: 22 }} />
            : <SmartToyIcon sx={{ color: "#fff", fontSize: 24 }} />
          }
        </Box>
      </Tooltip>

      {/* Chat panel */}
      <Collapse in={open} timeout={280} unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 92,
            right: 24,
            zIndex: 1399,
            width: { xs: "calc(100vw - 32px)", sm: 400 },
            maxWidth: 420,
            height: 540,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            overflow: "hidden",
            border: `1px solid rgba(27,79,114,0.15)`,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`,
              px: 2, py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Avatar sx={{ bgcolor: GOLD, width: 32, height: 32 }}>
              <SmartToyIcon sx={{ fontSize: 18, color: NAVY }} />
            </Avatar>
            <Box flex={1}>
              <Typography fontSize={13} fontWeight={700} color="#fff">Assistant IA GeoTrust</Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.6)">
                Analyse vos données en temps réel
              </Typography>
            </Box>
            <Tooltip title="Réinitialiser la conversation">
              <IconButton size="small" onClick={clearChat} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}>
                <AutoFixHighIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 2,
              py: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              bgcolor: "#F8FAFC",
            }}
          >
            {messages.map((msg, idx) => (
              <Box key={idx} display="flex" flexDirection="column"
                alignItems={msg.role === "user" ? "flex-end" : "flex-start"}>
                {msg.isError ? (
                  <Box
                    sx={{
                      maxWidth: "90%",
                      px: 1.5,
                      py: 1,
                      borderRadius: "12px 12px 12px 2px",
                      bgcolor: "#FEF2F2",
                      border: "0.5px solid #FECACA",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 0.8,
                    }}
                  >
                    <ErrorOutlineIcon sx={{ fontSize: 16, color: "#DC2626", mt: 0.2, flexShrink: 0 }} />
                    <Typography fontSize={13} lineHeight={1.6} color="#991B1B">
                      {msg.content}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      maxWidth: "85%",
                      px: 1.5,
                      py: 1,
                      borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      bgcolor: msg.role === "user" ? STEEL : "#fff",
                      border: msg.role === "assistant" ? "0.5px solid rgba(27,79,114,0.15)" : "none",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      position: "relative",
                    }}
                  >
                    <Typography
                      fontSize={13}
                      lineHeight={1.6}
                      color={msg.role === "user" ? "#fff" : NAVY}
                      sx={{ whiteSpace: "pre-wrap" }}
                    >
                      {msg.content}
                    </Typography>
                    {msg.role === "assistant" && (
                      <IconButton
                        size="small"
                        onClick={() => copyMessage(idx, msg.content)}
                        sx={{
                          position: "absolute", top: 2, right: 2,
                          opacity: 0, transition: "opacity 0.2s",
                          ".MuiBox-root:hover &": { opacity: 1 },
                          "&:hover": { opacity: 1 },
                          color: copied === idx ? "#059669" : STEEL,
                          p: 0.3,
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>
            ))}

            {loading && (
              <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{
                  px: 1.5, py: 1, borderRadius: "12px 12px 12px 2px",
                  bgcolor: "#fff", border: "0.5px solid rgba(27,79,114,0.15)",
                  display: "flex", alignItems: "center", gap: 1,
                }}>
                  <CircularProgress size={12} sx={{ color: STEEL }} />
                  <Typography fontSize={12} color="text.secondary">Analyse en cours…</Typography>
                </Box>
              </Box>
            )}

            <div ref={bottomRef} />
          </Box>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <Box px={1.5} pb={1} sx={{ bgcolor: "#F8FAFC" }}>
              <Typography fontSize={11} color="text.secondary" mb={0.8} px={0.5}>
                Questions rapides :
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.6}>
                {QUICK_QUESTIONS.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    variant="outlined"
                    onClick={() => send(q)}
                    sx={{
                      fontSize: 10,
                      height: 24,
                      cursor: "pointer",
                      borderColor: `rgba(27,79,114,0.25)`,
                      color: STEEL,
                      "&:hover": { bgcolor: `rgba(27,79,114,0.06)`, borderColor: STEEL },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Input */}
          <Box
            sx={{
              px: 1.5,
              py: 1.2,
              borderTop: "0.5px solid rgba(27,79,114,0.12)",
              bgcolor: "#fff",
              display: "flex",
              gap: 1,
              alignItems: "flex-end",
            }}
          >
            <TextField
              inputRef={inputRef}
              fullWidth
              multiline
              maxRows={3}
              size="small"
              placeholder="Posez votre question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: 13,
                  borderRadius: 2,
                  "& fieldset": { borderColor: "rgba(27,79,114,0.2)" },
                  "&:hover fieldset": { borderColor: STEEL },
                  "&.Mui-focused fieldset": { borderColor: STEEL },
                },
              }}
            />
            <Tooltip title="Envoyer (Entrée)">
              <span>
                <IconButton
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  sx={{
                    bgcolor: NAVY,
                    color: "#fff",
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    flexShrink: 0,
                    "&:hover": { bgcolor: STEEL },
                    "&.Mui-disabled": { bgcolor: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.26)" },
                  }}
                >
                  <SendIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}
