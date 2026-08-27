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
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon          from "@mui/icons-material/Close";
import SendIcon           from "@mui/icons-material/Send";
import AttachFileIcon     from "@mui/icons-material/AttachFile";
import NorthIcon          from "@mui/icons-material/North";
import ExpandMoreIcon     from "@mui/icons-material/ExpandMore";
import ExpandLessIcon     from "@mui/icons-material/ExpandLess";
import BugReportIcon      from "@mui/icons-material/BugReport";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CheckCircleIcon    from "@mui/icons-material/CheckCircle";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon       from "@mui/icons-material/Download";
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
  attachmentDownloadUrl,
  escalateTicket,
  updateTicketStatus,
} from "@/lib/tickets";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";
const AMBER = "#92400E";

const SEVERITY_CFG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#dc2626" },
  eleve:  { label: "Élevé",  color: "#d97706" },
  moyen:  { label: "Moyen",  color: STEEL     },
  faible: { label: "Faible", color: "#64748B" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function isItRole(role: string | null | undefined) {
  return role === "admin_tenant" || role === "admin";
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// ── Comment bubble (read-only reference) ──────────────────────────────────────
function RefCommentBubble({ comment }: { comment: TicketCommentDto }) {
  const isIt = isItRole(comment.authorRole);
  return (
    <Box display="flex" flexDirection={isIt ? "row-reverse" : "row"} alignItems="flex-end" gap={1} mb={1.5}>
      <Avatar sx={{ width: 26, height: 26, fontSize: 10, fontWeight: 700, flexShrink: 0, bgcolor: isIt ? NAVY : "#E2E8F0", color: isIt ? GOLD : "var(--text-secondary)" }}>
        {isIt ? <AdminPanelSettingsIcon sx={{ fontSize: 14 }} /> : initials(comment.authorName)}
      </Avatar>
      <Box maxWidth="75%">
        <Box display="flex" alignItems="center" gap={1} mb={0.3} justifyContent={isIt ? "flex-end" : "flex-start"}>
          <Typography variant="caption" fontWeight={600} sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {comment.authorName ?? (isIt ? "Admin IT" : "Utilisateur")}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--border-strong)", fontSize: 10 }}>
            {formatDate(comment.createdAt)}
          </Typography>
        </Box>
        <Box sx={{
          px: 1.5, py: 1,
          borderRadius: isIt ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
          bgcolor: isIt ? "#E8EEF4" : "#F1F5F9",
          color: "#334155",
        }}>
          <Typography variant="caption" sx={{ lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
            {comment.content}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Comment bubble (escalation thread) ────────────────────────────────────────
function EscCommentBubble({ comment }: { comment: TicketCommentDto }) {
  const isIt = isItRole(comment.authorRole);
  return (
    <Box display="flex" flexDirection={isIt ? "row-reverse" : "row"} alignItems="flex-end" gap={1} mb={2}>
      <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, flexShrink: 0, bgcolor: isIt ? AMBER : "#E2E8F0", color: isIt ? "white" : "var(--text-secondary)" }}>
        {isIt ? <AdminPanelSettingsIcon sx={{ fontSize: 16 }} /> : initials(comment.authorName)}
      </Avatar>
      <Box maxWidth="72%">
        <Box display="flex" alignItems="center" gap={1} mb={0.5} justifyContent={isIt ? "flex-end" : "flex-start"}>
          <Typography variant="caption" fontWeight={600} sx={{ color: isIt ? AMBER : "#334155" }}>
            {comment.authorName ?? (isIt ? "Admin GeoTrust" : "Admin tenant")}
          </Typography>
          {isIt && <Chip label="GeoTrust" size="small" sx={{ height: 15, fontSize: 10, bgcolor: AMBER + "18", color: AMBER, fontWeight: 700, px: 0.25 }} />}
          <Typography variant="caption" sx={{ color: "var(--text-muted)", fontSize: 11 }}>{formatDate(comment.createdAt)}</Typography>
        </Box>
        <Box sx={{
          px: 2, py: 1.25,
          borderRadius: isIt ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          bgcolor: isIt ? AMBER : NAVY,
          color: "rgba(255,255,255,0.92)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
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
  // Navigation same-origin via /proxy → le cookie httpOnly access_token part
  // automatiquement avec la requête, plus besoin de token en query string
  // (qui n'était de toute façon jamais lu côté backend).
  const downloadUrl = attachmentDownloadUrl(ticketId, att.id);
  return (
    <Box display="flex" alignItems="center" gap={1.5} sx={{ px: 1.5, py: 1, borderRadius: 2, border: "1px solid var(--border)", bgcolor: "var(--bg-surface)", mb: 1, "&:hover": { bgcolor: "var(--bg-hover)" } }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <InsertDriveFileIcon sx={{ fontSize: 16, color: "var(--text-secondary)" }} />
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-primary)", fontSize: 12 }} noWrap>{att.originalName}</Typography>
        <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>{formatBytes(att.size)} · {att.uploaderName ?? "inconnu"}</Typography>
      </Box>
      <Tooltip title="Télécharger">
        <IconButton size="small" component="a" href={downloadUrl} target="_blank" rel="noopener noreferrer" sx={{ color: "var(--text-muted)", "&:hover": { color: STEEL } }}>
          <DownloadIcon sx={{ fontSize: 16 }} />
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

export function EscalationDialog({ ticket, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase state
  const [phase, setPhase] = useState<"form" | "thread">(ticket?.escalated ? "thread" : "form");

  // Form phase state
  const [escalateNote, setEscalateNote]   = useState("");
  const [escalating, setEscalating]       = useState(false);
  const [escalateError, setEscalateError] = useState<string | null>(null);

  // Original ticket reference — collapsed by default
  const [showRef, setShowRef] = useState(false);

  // Thread phase state
  const [replyText, setReplyText]     = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replyError, setReplyError]   = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setPhase(ticket.escalated ? "thread" : "form");
      setEscalateNote("");
      setEscalateError(null);
      setShowRef(false);
      setReplyText("");
      setReplyError(null);
    }
  }, [ticket?.id, ticket?.escalated]);

  // Original ticket comments (reference panel)
  const refCommentsQuery = useQuery({
    queryKey: ["ticket-comments-ref", ticket?.id],
    queryFn: () => fetchTicketComments(ticket!.id),
    enabled: open && !!ticket && showRef,
  });

  // Escalation thread comments
  const threadCommentsQuery = useQuery({
    queryKey: ["escalation-comments", ticket?.id],
    queryFn: () => fetchTicketComments(ticket!.id),
    enabled: open && !!ticket && phase === "thread",
    refetchInterval: open && phase === "thread" ? 15000 : false,
  });

  // Attachments
  const attachmentsQuery = useQuery({
    queryKey: ["ticket-attachments", ticket?.id],
    queryFn: () => fetchTicketAttachments(ticket!.id),
    enabled: open && !!ticket && phase === "thread",
  });

  const commentMutation = useMutation({
    mutationFn: ({ ticketId, content }: { ticketId: number; content: string }) =>
      addTicketComment(ticketId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-comments", ticket?.id] });
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
    },
    onError: (err) => setReplyError(err instanceof Error ? err.message : "Upload impossible."),
  });

  const handleEscalate = async () => {
    if (!ticket) return;
    setEscalating(true);
    setEscalateError(null);
    try {
      await escalateTicket(ticket.id, escalateNote.trim() || undefined);

      // Post admin message to GeoTrust (visible in thread)
      if (escalateNote.trim()) {
        await addTicketComment(ticket.id, escalateNote.trim());
      }

      // Post user-facing notification as a comment
      await addTicketComment(
        ticket.id,
        `Votre ticket a été escaladé vers le support GeoTrust. Notre équipe technique le traitera en priorité. Vous serez notifié dès qu'une réponse sera disponible.`
      ).catch(() => {});

      // Update ticket status
      await updateTicketStatus({ id: ticket.id, status: "in_progress" }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["tickets-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-my-it"] });
      queryClient.invalidateQueries({ queryKey: ["escalation-comments", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });

      setPhase("thread");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (err) {
      setEscalateError(err instanceof Error ? err.message : "Escalade impossible.");
    } finally {
      setEscalating(false);
    }
  };

  const handleSend = async () => {
    if (!ticket) return;
    setReplyError(null);
    if (replyText.trim()) {
      await commentMutation.mutateAsync({ ticketId: ticket.id, content: replyText });
    }
    if (pendingFile) {
      await uploadMutation.mutateAsync({ ticketId: ticket.id, file: pendingFile });
    }
  };

  const canSend = (replyText.trim().length > 0 || !!pendingFile) && !commentMutation.isPending && !uploadMutation.isPending;
  const sev = SEVERITY_CFG[ticket?.severity ?? "moyen"] ?? SEVERITY_CFG["moyen"];

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
          height: { xs: "100dvh", sm: "92vh" },
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Gold accent */}
      <Box sx={{ height: 4, bgcolor: GOLD, flexShrink: 0 }} />

      {/* Header */}
      <Box sx={{ px: 3, py: 2, flexShrink: 0, background: `linear-gradient(135deg, ${AMBER} 0%, #b45309 100%)`, color: "white" }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box display="flex" alignItems="center" gap={2} flex={1} minWidth={0}>
            <Avatar sx={{ bgcolor: GOLD, width: 42, height: 42, flexShrink: 0 }}>
              <NorthIcon sx={{ color: NAVY, fontSize: 22 }} />
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography fontWeight={700} fontSize={15} sx={{ color: "white" }}>
                {phase === "form" ? "Escalader vers GeoTrust" : "Ticket GeoTrust — Discussion en cours"}
              </Typography>
              <Box display="flex" gap={1} mt={0.5} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                  Réf. ticket #{ticket?.id} — {ticket?.title}
                </Typography>
                <Chip label={sev.label} size="small" sx={{ height: 17, fontSize: 10, fontWeight: 700, bgcolor: "rgba(255,255,255,0.15)", color: "white" }} />
                {ticket?.escalated && (
                  <Chip icon={<CheckCircleIcon sx={{ fontSize: 12, color: "white !important" }} />} label="Escaladé" size="small"
                    sx={{ height: 17, fontSize: 10, fontWeight: 700, bgcolor: "rgba(255,255,255,0.2)", color: "white" }} />
                )}
              </Box>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── Original ticket reference card ── */}
      <Box sx={{ borderBottom: "1px solid var(--border)", flexShrink: 0, bgcolor: "#FFF9EC" }}>
        <Box
          display="flex" alignItems="center" gap={1.5} px={3} py={1.25}
          sx={{ cursor: "pointer", "&:hover": { bgcolor: "#FFF3D0" }, transition: "background .15s" }}
          onClick={() => setShowRef((v) => !v)}
        >
          <BugReportIcon sx={{ fontSize: 16, color: "#b45309", flexShrink: 0 }} />
          <Box flex={1} minWidth={0}>
            <Typography variant="caption" fontWeight={700} sx={{ color: "#92400E", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Ticket original joint en référence
            </Typography>
            <Typography variant="caption" sx={{ color: "#78350F", display: "block" }} noWrap>
              #{ticket?.id} — {ticket?.title} · {ticket?.requesterName ?? "Utilisateur inconnu"} · {ticket?.category ?? "Sans catégorie"}
            </Typography>
          </Box>
          <Box sx={{ color: "#b45309", flexShrink: 0 }}>
            {showRef ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </Box>
        </Box>

        <Collapse in={showRef}>
          <Box sx={{ px: 3, pb: 2, maxHeight: 320, overflowY: "auto" }}>
            {/* Description */}
            {ticket?.description && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: "#92400E", textTransform: "uppercase", letterSpacing: 0.7, display: "block", mb: 0.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" sx={{ color: "#78350F", lineHeight: 1.6, fontSize: 13 }}>
                  {ticket.description}
                </Typography>
              </Box>
            )}

            {/* Original thread */}
            <Typography variant="caption" fontWeight={700} sx={{ color: "#92400E", textTransform: "uppercase", letterSpacing: 0.7, display: "block", mb: 1 }}>
              Fil de discussion original
            </Typography>
            {refCommentsQuery.isLoading ? (
              <Box>{[1,2].map(i => <Skeleton key={i} height={48} sx={{ mb: 1, borderRadius: 2 }} />)}</Box>
            ) : (refCommentsQuery.data?.length ?? 0) === 0 ? (
              <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>Aucun message dans la discussion originale.</Typography>
            ) : (
              refCommentsQuery.data?.map((c) => <RefCommentBubble key={c.id} comment={c} />)
            )}
          </Box>
        </Collapse>
      </Box>

      {/* ── Phase 1 : Formulaire d'escalade ── */}
      {phase === "form" && (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", px: 3, py: 3, bgcolor: "#FAFBFC", overflowY: "auto" }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "var(--text-primary)", mb: 0.5 }}>
              Message d'escalade vers GeoTrust
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Décrivez le contexte, l'urgence et les éléments importants que l'équipe GeoTrust doit connaître. Le ticket original et sa discussion seront joints automatiquement en référence.
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1, border: "1.5px solid var(--border)", borderRadius: 2.5,
              bgcolor: "var(--bg-surface)", "&:focus-within": { borderColor: AMBER, bgcolor: "var(--bg-surface)" }, transition: "all .15s",
            }}
          >
            <textarea
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="Ex : Ce problème bloque 12 agents terrain depuis 2 jours. Malgré nos tentatives de résolution côté tenant, le bug semble lié à une synchronisation backend. Priorité haute..."
              rows={8}
              style={{
                width: "100%", border: "none", outline: "none",
                background: "transparent", resize: "none",
                padding: "16px", fontFamily: "inherit",
                fontSize: 14, color: "#1E293B", lineHeight: 1.7,
                boxSizing: "border-box",
              }}
            />
          </Box>

          {escalateError && <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>{escalateError}</Alert>}

          <Box display="flex" alignItems="center" justifyContent="space-between" mt={2}>
            <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
              Le demandeur sera notifié et le ticket passera en statut "En cours"
            </Typography>
            <Box display="flex" gap={1}>
              <Button variant="outlined" color="inherit" onClick={onClose} disabled={escalating}>
                Annuler
              </Button>
              <Button
                variant="contained"
                disabled={escalating || !escalateNote.trim()}
                onClick={handleEscalate}
                startIcon={escalating ? <CircularProgress size={14} sx={{ color: "rgba(255,255,255,0.8)" }} /> : <NorthIcon sx={{ fontSize: 16 }} />}
                sx={{ bgcolor: AMBER, "&:hover": { bgcolor: "#78350F" }, fontWeight: 700, px: 3 }}
              >
                {escalating ? "Envoi en cours…" : "Envoyer l'escalade vers GeoTrust"}
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Phase 2 : Thread de discussion ── */}
      {phase === "thread" && (
        <>
          {/* Thread header */}
          <Box sx={{ px: 3, py: 1.25, bgcolor: "#FFF9EC", borderBottom: "1px solid #FDE68A", flexShrink: 0 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <CheckCircleIcon sx={{ fontSize: 15, color: "#16a34a" }} />
              <Typography variant="caption" fontWeight={700} sx={{ color: "#15803d" }}>
                Ticket escaladé{ticket?.escalatedAt ? ` le ${formatDate(ticket.escalatedAt)}` : ""}
                {ticket?.escalatedByName ? ` par ${ticket.escalatedByName}` : ""}
              </Typography>
            </Box>
          </Box>

          {/* Thread body */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2, bgcolor: "#FAFBFC" }}>
            {threadCommentsQuery.isLoading ? (
              <Box>{[1,2,3].map(i => (
                <Box key={i} display="flex" gap={1} mb={2} flexDirection={i % 2 === 0 ? "row-reverse" : "row"}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton width={200} height={56} sx={{ borderRadius: 2 }} />
                </Box>
              ))}</Box>
            ) : (threadCommentsQuery.data?.length ?? 0) === 0 ? (
              <Box textAlign="center" py={6}>
                <NorthIcon sx={{ fontSize: 36, color: "var(--border-strong)", mb: 1 }} />
                <Typography variant="body2" color="text.disabled">
                  La discussion GeoTrust démarrera ici. Répondez ci-dessous.
                </Typography>
              </Box>
            ) : (
              threadCommentsQuery.data?.map((c) => <EscCommentBubble key={c.id} comment={c} />)
            )}
            <div ref={bottomRef} />
          </Box>

          {/* Attachments */}
          {(attachmentsQuery.data?.length ?? 0) > 0 && (
            <Box sx={{ px: 3, py: 1.5, borderTop: "1px solid var(--border)", bgcolor: "var(--bg-page)", flexShrink: 0, maxHeight: 140, overflowY: "auto" }}>
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
            {replyError && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{replyError}</Alert>}

            {pendingFile && (
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                  label={`${pendingFile.name} (${formatBytes(pendingFile.size)})`}
                  size="small"
                  onDelete={() => setPendingFile(null)}
                  sx={{ bgcolor: "#FFF9EC", color: AMBER, fontWeight: 600, fontSize: 11 }}
                />
              </Box>
            )}

            <Box sx={{ border: "1px solid var(--border)", borderRadius: 2.5, bgcolor: "#FAFBFC", "&:focus-within": { borderColor: AMBER, bgcolor: "var(--bg-surface)" }, transition: "all .15s" }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Répondre dans la discussion GeoTrust…"
                rows={3}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
                style={{
                  width: "100%", border: "none", outline: "none",
                  background: "transparent", resize: "none",
                  padding: "12px 14px 6px", fontFamily: "inherit",
                  fontSize: 14, color: "#1E293B", lineHeight: 1.6, boxSizing: "border-box",
                }}
              />
              <Box display="flex" alignItems="center" justifyContent="space-between" px={1.5} pb={1}>
                <Box display="flex" gap={0.5}>
                  <Tooltip title="Joindre un fichier (max 10 Mo)">
                    <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ color: "var(--text-muted)", "&:hover": { color: AMBER, bgcolor: "#FFF9EC" } }}>
                      <AttachFileIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ""; }} style={{ display: "none" }} accept="image/*,application/pdf,.doc,.docx,.txt" />
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>Ctrl+Entrée</Typography>
                  <Button
                    variant="contained" size="small"
                    endIcon={(commentMutation.isPending || uploadMutation.isPending) ? <CircularProgress size={13} sx={{ color: "rgba(255,255,255,0.8)" }} /> : <SendIcon sx={{ fontSize: 15 }} />}
                    disabled={!canSend}
                    onClick={handleSend}
                    sx={{ bgcolor: AMBER, fontWeight: 700, fontSize: 12, px: 2, borderRadius: 2, "&:hover": { bgcolor: "#78350F" }, "&.Mui-disabled": { bgcolor: "var(--border)", color: "var(--text-muted)" } }}
                  >
                    Envoyer
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Dialog>
  );
}
