"use client";
import { useLiveInterval } from "@/lib/realtime/RealtimeProvider";

import {
  Bug, CircleCheck, Download, File as FileIcon, MoveUp, Paperclip, Send, ShieldCheck, TriangleAlert, X,
} from "lucide-react";
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
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
    <div className="mx-auto my-4 flex max-w-[480px] items-start gap-3 rounded-xl border-[1.5px] border-amber-200 bg-amber-50 px-4 py-3">
      <MoveUp size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1">
        <div className="text-xs font-bold uppercase tracking-[0.7px] text-amber-800">Ticket escaladé vers GeoTrust</div>
        <div className="mt-0.5 text-xs text-amber-900">Par {ticket.escalatedByName ?? "Admin"} · {formatDate(ticket.escalatedAt)}</div>
        {ticket.escalationNote && <div className="mt-1.5 text-sm italic leading-normal text-amber-800">« {ticket.escalationNote} »</div>}
      </div>
    </div>
  );
}

// ── Status change event card ───────────────────────────────────────────────────
function StatusEvent({ status }: { status: TicketStatus }) {
  const msg = STATUS_MESSAGES[status];
  if (!msg) return null;
  const isGood = status === "resolved" || status === "closed";
  return (
    <div className={`mx-auto my-3 flex max-w-[440px] items-center gap-2.5 rounded-xl border-[1.5px] px-4 py-2.5 ${isGood ? "border-green-200 bg-green-50" : "border-border bg-background"}`}>
      {isGood ? <CircleCheck size={16} className="shrink-0 text-green-600" /> : <TriangleAlert size={16} className="shrink-0 text-muted-foreground" />}
      <span className={`text-xs font-medium ${isGood ? "text-green-700" : "text-muted-foreground"}`}>{msg}</span>
    </div>
  );
}

// ── Comment bubble ─────────────────────────────────────────────────────────────
function CommentBubble({ comment }: { comment: TicketCommentDto }) {
  const isIt = isItRole(comment.authorRole);
  return (
    <div className={`mb-4 flex items-end gap-2 ${isIt ? "flex-row-reverse" : "flex-row"}`}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isIt ? "bg-[#0F3B5C] text-[#3C8047]" : "bg-slate-200 text-slate-600"}`}>
        {isIt ? <ShieldCheck size={16} /> : initials(comment.authorName)}
      </span>

      <div className="max-w-[72%]">
        <div className={`mb-1 flex items-center gap-2 ${isIt ? "justify-end" : "justify-start"}`}>
          <span className="text-xs font-semibold text-foreground">{comment.authorName ?? (isIt ? "Admin IT" : "Utilisateur")}</span>
          {isIt && <span className="rounded-full bg-[#0F3B5C]/10 px-1.5 text-[10px] font-bold leading-4 text-foreground">IT</span>}
          <span className="text-[11px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
        </div>

        <div
          className={`px-4 py-2.5 ${
            isIt
              ? "rounded-[12px_12px_4px_12px] bg-[#0F3B5C] text-white/90 shadow-[0_2px_8px_rgba(15,59,92,0.18)]"
              : "rounded-[12px_12px_12px_4px] bg-slate-100 text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          }`}
        >
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</div>
        </div>
      </div>
    </div>
  );
}

// ── Attachment row ─────────────────────────────────────────────────────────────
function AttachmentRow({ att, ticketId }: { att: TicketAttachmentDto; ticketId: number }) {
  const isImage = att.mimeType.startsWith("image/");
  const downloadUrl = attachmentDownloadUrl(ticketId, att.id);

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-muted">
      <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-lg ${isImage ? "bg-blue-50 text-[#1E6091]" : "bg-slate-100 text-slate-600"}`}>
        <FileIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{att.originalName}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(att.size)} · {att.uploaderName ?? "inconnu"} · {formatDate(att.createdAt)}</div>
      </div>
      <Tooltip title="Télécharger">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Télécharger"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]"
        >
          <Download size={18} />
        </a>
      </Tooltip>
    </div>
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

  const commentsPollMs = useLiveInterval(15_000, 60_000);
  const commentsQuery = useQuery({
    queryKey: ["ticket-comments", ticket?.id],
    queryFn: () => fetchTicketComments(ticket!.id),
    enabled: open && !!ticket,
    refetchInterval: open ? commentsPollMs : false,
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
  const sending = commentMutation.isPending || uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="md"
        aria-describedby={undefined}
        className="flex flex-col"
        style={{ height: "calc(90vh / var(--ui-zoom))" }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 text-white" style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#3C8047] text-[#0F3B5C]"><Bug size={22} /></span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base font-bold text-white">{ticket?.title ?? "Ticket"}</DialogTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/65">#{ticket?.id} · {ticket?.requesterName ?? "Utilisateur inconnu"}</span>
                  <span className="rounded-full px-2 text-[10px] font-bold leading-[18px]" style={{ background: sev.color + "30", color: sev.color, border: `1px solid ${sev.color}50` }}>{sev.label}</span>
                  {ticket?.category && <span className="rounded-full bg-white/10 px-2 text-[10px] leading-[18px] text-white/75">{ticket.category}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* Status selector */}
              <div className="relative">
                <Select
                  aria-label="Statut du ticket"
                  value={newStatus}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  disabled={statusSaving}
                  className="h-8 w-auto rounded-full px-3 text-xs font-bold"
                  style={{ background: st.bg, color: st.color, borderColor: st.color + "60" }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ color: "#0F172A", background: "#fff" }}>{opt.label}</option>
                  ))}
                </Select>
                {statusSaving && <Spinner className="absolute -right-6 top-1/2 size-3.5 -translate-y-1/2 text-[#3C8047]" />}
              </div>

              {isEscalated && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#3C8047]/50 bg-[#3C8047]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#3C8047]">
                  <MoveUp size={13} /> Escaladé GeoTrust
                </span>
              )}

              <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-white/70 hover:bg-white/10 hover:text-white">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        {ticket?.description && (
          <div className="shrink-0 border-b border-border bg-background px-6 py-3">
            <div className="text-xs font-bold uppercase tracking-[0.8px] text-muted-foreground">Description initiale</div>
            <div className="mt-1 text-sm leading-relaxed text-foreground">{ticket.description}</div>
          </div>
        )}

        {/* Conversation thread */}
        <div className="flex-1 overflow-y-auto bg-background px-6 py-4">
          {commentsQuery.isLoading ? (
            <div>
              {[1, 2, 3].map((i) => (
                <div key={i} className={`mb-4 flex gap-2 ${i % 2 === 0 ? "flex-row-reverse" : "flex-row"}`}>
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-[60px] w-[220px] rounded-lg" />
                </div>
              ))}
            </div>
          ) : commentsQuery.data?.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto mb-3 flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong"><Bug size={24} /></span>
              <p className="text-sm text-muted-foreground">Aucun message pour ce ticket. Répondez ci-dessous.</p>
            </div>
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
        </div>

        {/* Attachments */}
        {(attachmentsQuery.data?.length ?? 0) > 0 && (
          <div className="max-h-40 shrink-0 overflow-y-auto border-t border-border bg-background px-6 py-3">
            <div className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-muted-foreground">
              Pièces jointes ({attachmentsQuery.data!.length})
            </div>
            {attachmentsQuery.data!.map((att) => (
              <AttachmentRow key={att.id} att={att} ticketId={ticket!.id} />
            ))}
          </div>
        )}

        {/* Reply area */}
        <div className="shrink-0 border-t border-border bg-surface px-6 pb-4 pt-3">
          {(replyError || uploadError) && <Alert severity="error" className="mb-3 py-1">{replyError ?? uploadError}</Alert>}

          {pendingFile && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E6091]">
                <Paperclip size={14} /> {pendingFile.name} ({formatBytes(pendingFile.size)})
                <button type="button" aria-label="Retirer le fichier" onClick={() => setPendingFile(null)} className="cursor-pointer border-0 bg-transparent p-0 text-[#1E6091]/70 hover:text-[#1E6091]">
                  <X size={13} />
                </button>
              </span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-background transition-all focus-within:border-[#1E6091] focus-within:bg-surface">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Répondre au ticket…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
              }}
              className="box-border w-full resize-none border-0 bg-transparent px-3.5 pb-1.5 pt-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <div className="flex gap-1">
                <Tooltip title="Joindre un fichier (max 10 Mo)">
                  <button type="button" aria-label="Joindre un fichier" onClick={() => fileInputRef.current?.click()} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]">
                    <Paperclip size={18} />
                  </button>
                </Tooltip>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.doc,.docx,.txt" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-border-strong">Ctrl+Entrée pour envoyer</span>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={handleSend}
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#0F3B5C] px-4 text-xs font-bold text-white transition-colors hover:bg-[#1E6091] disabled:cursor-default disabled:bg-border disabled:text-muted-foreground"
                >
                  Envoyer {sending ? <Spinner className="size-3.5" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
