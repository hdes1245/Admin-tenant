"use client";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon from "@mui/icons-material/Download";
import BugReportIcon from "@mui/icons-material/BugReport";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import NorthIcon from "@mui/icons-material/North";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import {
  TicketDto,
  TicketStatus,
  TicketCommentDto,
  TicketAttachmentDto,
  fetchTicketComments,
  addTicketComment,
  fetchTicketAttachments,
  uploadTicketAttachment,
  updateTicketStatus,
  attachmentDownloadUrl,
} from "@/lib/tickets";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const STATUS_OPTIONS: { value: TicketStatus; label: string; color: string; bg: string }[] = [
  { value: "open",         label: "Ouvert",                            color: "#d97706", bg: "#FFFBEB" },
  { value: "in_progress",  label: "En cours",                          color: STEEL,     bg: "#EFF6FF" },
  { value: "waiting_user", label: "En attente utilisateur",            color: "#7c3aed", bg: "#FAF5FF" },
  { value: "resolved",     label: "Résolu",                            color: "#15803d", bg: "#F0FDF4" },
  { value: "closed",       label: "Fermé",                             color: "#64748B", bg: "#F1F5F9" },
];

const SEVERITY_CFG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#dc2626" },
  eleve:  { label: "Élevé",  color: "#d97706" },
  moyen:  { label: "Moyen",  color: STEEL     },
  faible: { label: "Faible", color: "#64748B" },
};

const STATUS_MESSAGES: Partial<Record<TicketStatus, string>> = {
  resolved:     "Ce ticket a été marqué comme résolu. Merci pour votre patience.",
  closed:       "Ce ticket a été fermé.",
  in_progress:  "Votre ticket est en cours de traitement par notre équipe.",
  waiting_user: "Nous attendons votre retour pour continuer le traitement.",
};

function statusCfg(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isItRole(role: string | null | undefined) {
  return role === "admin_tenant" || role === "admin";
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// ── Escalation event card ──────────────────────────────────────────────────────
function EscalationEvent({ ticket }: { ticket: TicketDto }) {
  if (!ticket.escalated || !ticket.escalatedAt) return null;
  return (
    <Box
      sx={{
        mx: "auto", my: 2, maxWidth: 480,
        border: "1.5px solid #FDE68A",
        borderRadius: 2.5, bgcolor: "#FFFBEB",
        px: 2, py: 1.5,
        display: "flex", gap: 1.5, alignItems: "flex-start",
      }}
    >
      <Box sx={{ mt: 0.25, flexShrink: 0 }}>
        <NorthIcon sx={{ fontSize: 18, color: "#d97706" }} />
      </Box>
      <Box flex={1}>
        <Typography variant="caption" fontWeight={700} sx={{ color: "#92400E", textTransform: "uppercase", letterSpacing: 0.7 }}>
          Ticket escaladé vers GeoTrust
        </Typography>
        <Typography variant="caption" sx={{ color: "#78350F", display: "block", mt: 0.25 }}>
          Par {ticket.escalatedByName ?? "Admin"} · {formatDate(ticket.escalatedAt)}
        </Typography>
        {ticket.escalationNote && (
          <Typography variant="body2" sx={{ mt: 0.75, color: "#92400E", fontStyle: "italic", lineHeight: 1.5 }}>
            « {ticket.escalationNote} »
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── Status change event card ───────────────────────────────────────────────────
function StatusEvent({ status }: { status: TicketStatus }) {
  const msg = STATUS_MESSAGES[status];
  if (!msg) return null;
  const isGood = status === "resolved" || status === "closed";
  return (
    <Box
      sx={{
        mx: "auto", my: 1.5, maxWidth: 440,
        border: `1.5px solid ${isGood ? "#BBF7D0" : "var(--border)"}`,
        borderRadius: 2.5, bgcolor: isGood ? "#F0FDF4" : "var(--bg-page)",
        px: 2, py: 1.25,
        display: "flex", gap: 1.25, alignItems: "center",
      }}
    >
      {isGood
        ? <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a", flexShrink: 0 }} />
        : <WarningAmberIcon sx={{ fontSize: 16, color: "var(--text-secondary)", flexShrink: 0 }} />}
      <Typography variant="caption" sx={{ color: isGood ? "#15803d" : "var(--text-secondary)", fontWeight: 500 }}>
        {msg}
      </Typography>
    </Box>
  );
}

// ── Comment bubble ─────────────────────────────────────────────────────────────
function CommentBubble({ comment }: { comment: TicketCommentDto }) {
  const isIt = isItRole(comment.authorRole);
  return (
    <Box
      display="flex"
      flexDirection={isIt ? "row-reverse" : "row"}
      alignItems="flex-end"
      gap={1}
      mb={2}
    >
      <Avatar
        sx={{
          width: 32, height: 32, fontSize: 12, fontWeight: 700, flexShrink: 0,
          bgcolor: isIt ? NAVY : "#E2E8F0",
          color: isIt ? GOLD : "var(--text-secondary)",
        }}
      >
        {isIt ? <AdminPanelSettingsIcon sx={{ fontSize: 16 }} /> : initials(comment.authorName)}
      </Avatar>

      <Box maxWidth="72%">
        <Box
          display="flex" alignItems="center" gap={1} mb={0.5}
          justifyContent={isIt ? "flex-end" : "flex-start"}
        >
          <Typography variant="caption" fontWeight={600} sx={{ color: isIt ? "var(--text-primary)" : "#334155" }}>
            {comment.authorName ?? (isIt ? "Admin IT" : "Utilisateur")}
          </Typography>
          {isIt && (
            <Chip label="IT" size="small" sx={{ height: 16, fontSize: 10, bgcolor: NAVY + "18", color: "var(--text-primary)", fontWeight: 700, px: 0.25 }} />
          )}
          <Typography variant="caption" sx={{ color: "var(--text-muted)", fontSize: 11 }}>
            {formatDate(comment.createdAt)}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 2, py: 1.25,
            borderRadius: isIt ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            bgcolor: isIt ? NAVY : "#F1F5F9",
            color: isIt ? "rgba(255,255,255,0.92)" : "#1E293B",
            boxShadow: isIt ? "0 2px 8px rgba(15,59,92,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {comment.content}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Attachment row ─────────────────────────────────────────────────────────────
function AttachmentRow({ att, ticketId }: { att: TicketAttachmentDto; ticketId: number }) {
  const isImage = att.mimeType.startsWith("image/");
  const downloadUrl = attachmentDownloadUrl(ticketId, att.id);

  return (
    <Box
      display="flex" alignItems="center" gap={1.5}
      sx={{
        px: 1.5, py: 1, borderRadius: 2, border: "1px solid var(--border)",
        bgcolor: "var(--bg-surface)", mb: 1,
        "&:hover": { bgcolor: "var(--bg-hover)" },
      }}
    >
      <Box
        sx={{
          width: 34, height: 34, borderRadius: 1.5,
          bgcolor: isImage ? "#EFF6FF" : "#F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <InsertDriveFileIcon sx={{ fontSize: 18, color: isImage ? STEEL : "var(--text-secondary)" }} />
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-primary)" }} noWrap>
          {att.originalName}
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
          {formatBytes(att.size)} · {att.uploaderName ?? "inconnu"} · {formatDate(att.createdAt)}
        </Typography>
      </Box>
      <Tooltip title="Télécharger">
        <IconButton
          size="small"
          component="a"
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "var(--text-muted)", "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}
        >
          <DownloadIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────
interface Props {
  ticket: TicketDto | null;
  open: boolean;
  onClose: () => void;
}

export function TicketConversationDialog({ ticket, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [replyText, setReplyText]       = useState("");
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [replyError, setReplyError]     = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [newStatus, setNewStatus]       = useState<TicketStatus>(ticket?.status ?? "open");
  const [statusSaving, setStatusSaving] = useState(false);
  const [lastStatusEvent, setLastStatusEvent] = useState<TicketStatus | null>(null);

  const [escalateDone, setEscalateDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticket) {
      setNewStatus(ticket.status);
      setEscalateDone(false);
      setLastStatusEvent(null);
    }
  }, [ticket]);

  const commentsQuery = useQuery({
    queryKey: ["ticket-comments", ticket?.id],
    queryFn: () => fetchTicketComments(ticket!.id),
    enabled: open && !!ticket,
    refetchInterval: open ? 15000 : false,
  });

  const attachmentsQuery = useQuery({
    queryKey: ["ticket-attachments", ticket?.id],
    queryFn: () => fetchTicketAttachments(ticket!.id),
    enabled: open && !!ticket,
  });

  const commentMutation = useMutation({
    mutationFn: ({ ticketId, content }: { ticketId: number; content: string }) =>
      addTicketComment(ticketId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket?.id] });
      setReplyText("");
      setReplyError(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err) => setReplyError(err instanceof Error ? err.message : "Envoi impossible."),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ ticketId, file }: { ticketId: number; file: File }) =>
      uploadTicketAttachment(ticketId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticket?.id] });
      setPendingFile(null);
      setUploadError(null);
    },
    onError: (err) => setUploadError(err instanceof Error ? err.message : "Upload impossible."),
  });

  const handleSend = async () => {
    if (!ticket) return;
    setReplyError(null);
    setUploadError(null);
    if (replyText.trim()) {
      await commentMutation.mutateAsync({ ticketId: ticket.id, content: replyText });
    }
    if (pendingFile) {
      await uploadMutation.mutateAsync({ ticketId: ticket.id, file: pendingFile });
    }
  };

  const handleStatusChange = async (newVal: TicketStatus) => {
    if (!ticket) return;
    setNewStatus(newVal);
    setStatusSaving(true);
    try {
      await updateTicketStatus({ id: ticket.id, status: newVal });
      queryClient.invalidateQueries({ queryKey: ["tickets-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-my-it"] });
      // Post automated comment for key status changes
      const msg = STATUS_MESSAGES[newVal];
      if (msg) {
        await addTicketComment(ticket.id, msg).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
        setLastStatusEvent(newVal);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      }
    } finally {
      setStatusSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = "";
  };

  const canSend = (replyText.trim().length > 0 || !!pendingFile) && !commentMutation.isPending && !uploadMutation.isPending;
  const sev = SEVERITY_CFG[ticket?.severity ?? "moyen"] ?? SEVERITY_CFG["moyen"];
  const st  = statusCfg(newStatus);
  const isEscalated = ticket?.escalated || escalateDone;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          height: { xs: "100dvh", sm: "90vh" },
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Gold top bar */}
      <Box sx={{ height: 4, bgcolor: GOLD, flexShrink: 0 }} />

      {/* Header */}
      <Box
        sx={{
          px: 3, py: 2, flexShrink: 0,
          background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`,
          color: "white",
        }}
      >
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box display="flex" alignItems="center" gap={2} flex={1} minWidth={0}>
            <Avatar sx={{ bgcolor: GOLD, width: 42, height: 42, flexShrink: 0 }}>
              <BugReportIcon sx={{ color: NAVY, fontSize: 22 }} />
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography fontWeight={700} fontSize={16} noWrap sx={{ color: "white" }}>
                {ticket?.title ?? "Ticket"}
              </Typography>
              <Box display="flex" gap={1} mt={0.5} flexWrap="wrap" alignItems="center">
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)" }}>
                  #{ticket?.id} · {ticket?.requesterName ?? "Utilisateur inconnu"}
                </Typography>
                <Chip
                  label={sev.label}
                  size="small"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: sev.color + "30", color: sev.color, border: `1px solid ${sev.color}50` }}
                />
                {ticket?.category && (
                  <Chip
                    label={ticket.category}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" justifyContent="flex-end">
            {/* Status selector */}
            <Box sx={{ position: "relative" }}>
              <Select
                value={newStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                size="small"
                disabled={statusSaving}
                sx={{
                  fontSize: 12, fontWeight: 700, height: 32,
                  bgcolor: st.bg, color: st.color,
                  borderRadius: 5,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: st.color + "60" },
                  "& .MuiSelect-icon": { color: st.color },
                  "& .MuiSelect-select": { px: 1.5, py: 0.5 },
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: opt.color, flexShrink: 0 }} />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {statusSaving && (
                <CircularProgress size={14} sx={{ position: "absolute", top: "50%", right: -20, mt: "-7px", color: GOLD }} />
              )}
            </Box>

            {isEscalated && (
              <Chip
                label="Escaladé GeoTrust"
                size="small"
                icon={<NorthIcon sx={{ fontSize: 13, color: GOLD + " !important" }} />}
                sx={{ bgcolor: "rgba(60,128,71,0.2)", color: GOLD, fontWeight: 700, fontSize: 11, border: `1px solid ${GOLD}50` }}
              />
            )}

            <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Description */}
      {ticket?.description && (
        <Box sx={{ px: 3, py: 1.5, bgcolor: "var(--bg-page)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Description initiale
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "#334155", lineHeight: 1.6 }}>
            {ticket.description}
          </Typography>
        </Box>
      )}

      {/* Conversation thread */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2, bgcolor: "#FAFBFC" }}>
        {commentsQuery.isLoading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Box key={i} display="flex" gap={1} mb={2} flexDirection={i % 2 === 0 ? "row-reverse" : "row"}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton width={220} height={60} sx={{ borderRadius: 2 }} />
              </Box>
            ))}
          </Box>
        ) : commentsQuery.data?.length === 0 ? (
          <Box textAlign="center" py={6}>
            <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 1.5 }}>
              <BugReportIcon sx={{ fontSize: 24, color: "var(--border-strong)" }} />
            </Box>
            <Typography variant="body2" color="text.disabled">
              Aucun message pour ce ticket. Répondez ci-dessous.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Escalation event — shown at top of thread if escalated */}
            {isEscalated && ticket && <EscalationEvent ticket={ticket} />}
            {commentsQuery.data?.map((c) => <CommentBubble key={c.id} comment={c} />)}
            {/* Status event shown after latest comment */}
            {lastStatusEvent && <StatusEvent status={lastStatusEvent} />}
          </>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Attachments */}
      {(attachmentsQuery.data?.length ?? 0) > 0 && (
        <Box sx={{ px: 3, py: 1.5, borderTop: "1px solid var(--border)", bgcolor: "var(--bg-page)", flexShrink: 0, maxHeight: 160, overflowY: "auto" }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1 }}>
            Pièces jointes ({attachmentsQuery.data!.length})
          </Typography>
          {attachmentsQuery.data!.map((att) => (
            <AttachmentRow key={att.id} att={att} ticketId={ticket!.id} />
          ))}
        </Box>
      )}

      {/* Reply area */}
      <Box sx={{ px: 3, pt: 1.5, pb: 2, borderTop: "1px solid var(--border)", bgcolor: "var(--bg-surface)", flexShrink: 0 }}>
        {(replyError || uploadError) && (
          <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>
            {replyError ?? uploadError}
          </Alert>
        )}

        {pendingFile && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Chip
              icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
              label={`${pendingFile.name} (${formatBytes(pendingFile.size)})`}
              size="small"
              onDelete={() => setPendingFile(null)}
              sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 600, fontSize: 11 }}
            />
          </Box>
        )}

        <Box
          sx={{
            border: "1px solid var(--border)",
            borderRadius: 2.5,
            bgcolor: "#FAFBFC",
            "&:focus-within": { borderColor: STEEL, bgcolor: "var(--bg-surface)" },
            transition: "all 0.15s",
          }}
        >
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Répondre au ticket…"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
            }}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              resize: "none",
              padding: "12px 14px 6px",
              fontFamily: "inherit",
              fontSize: 14,
              color: "#1E293B",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />
          <Box display="flex" alignItems="center" justifyContent="space-between" px={1.5} pb={1}>
            <Box display="flex" gap={0.5}>
              <Tooltip title="Joindre un fichier (max 10 Mo)">
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ color: "var(--text-muted)", "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}
                >
                  <AttachFileIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: "none" }}
                accept="image/*,application/pdf,.doc,.docx,.txt"
              />
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>Ctrl+Entrée pour envoyer</Typography>
              <Button
                variant="contained"
                size="small"
                endIcon={
                  (commentMutation.isPending || uploadMutation.isPending)
                    ? <CircularProgress size={14} sx={{ color: "rgba(255,255,255,0.8)" }} />
                    : <SendIcon sx={{ fontSize: 15 }} />
                }
                disabled={!canSend}
                onClick={handleSend}
                sx={{
                  bgcolor: NAVY, color: "white",
                  fontWeight: 700, fontSize: 12,
                  px: 2, borderRadius: 2,
                  "&:hover": { bgcolor: STEEL },
                  "&.Mui-disabled": { bgcolor: "var(--border)", color: "var(--text-muted)" },
                }}
              >
                Envoyer
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
