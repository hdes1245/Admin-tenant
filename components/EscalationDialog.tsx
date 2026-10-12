"use client";
import { useLiveInterval } from "@/lib/realtime/RealtimeProvider";

import {
  Bug, ChevronDown, ChevronUp, CircleCheck, Download, File as FileIcon, MoveUp, Paperclip, Send, ShieldCheck, X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import {
  TicketDto,
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
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const STEEL = "#1E6091";
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
    <div className={`mb-3 flex items-end gap-2 ${isIt ? "flex-row-reverse" : "flex-row"}`}>
      <span className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isIt ? "bg-[#0F3B5C] text-[#3C8047]" : "bg-slate-200 text-slate-600"}`}>
        {isIt ? <ShieldCheck size={14} /> : initials(comment.authorName)}
      </span>
      <div className="max-w-[75%]">
        <div className={`mb-0.5 flex items-center gap-2 ${isIt ? "justify-end" : "justify-start"}`}>
          <span className="text-[11px] font-semibold text-muted-foreground">{comment.authorName ?? (isIt ? "Admin IT" : "Utilisateur")}</span>
          <span className="text-[10px] text-border-strong">{formatDate(comment.createdAt)}</span>
        </div>
        <div className={`px-3 py-2 text-slate-700 ${isIt ? "rounded-[10px_10px_3px_10px] bg-[#E8EEF4]" : "rounded-[10px_10px_10px_3px] bg-slate-100"}`}>
          <span className="whitespace-pre-wrap break-words text-xs leading-normal">{comment.content}</span>
        </div>
      </div>
    </div>
  );
}

// ── Comment bubble (escalation thread) ────────────────────────────────────────
function EscCommentBubble({ comment }: { comment: TicketCommentDto }) {
  const isIt = isItRole(comment.authorRole);
  return (
    <div className={`mb-4 flex items-end gap-2 ${isIt ? "flex-row-reverse" : "flex-row"}`}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isIt ? "bg-[#92400E] text-white" : "bg-slate-200 text-slate-600"}`}>
        {isIt ? <ShieldCheck size={16} /> : initials(comment.authorName)}
      </span>
      <div className="max-w-[72%]">
        <div className={`mb-1 flex items-center gap-2 ${isIt ? "justify-end" : "justify-start"}`}>
          <span className={`text-xs font-semibold ${isIt ? "text-[#92400E]" : "text-foreground"}`}>
            {comment.authorName ?? (isIt ? "Admin GeoTrust" : "Admin tenant")}
          </span>
          {isIt && <span className="rounded-full bg-[#92400E]/10 px-1.5 text-[10px] font-bold leading-[15px] text-[#92400E]">GeoTrust</span>}
          <span className="text-[11px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
        </div>
        <div className={`px-4 py-2.5 text-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${isIt ? "rounded-[12px_12px_4px_12px] bg-[#92400E]" : "rounded-[12px_12px_12px_4px] bg-[#0F3B5C]"}`}>
          <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</span>
        </div>
      </div>
    </div>
  );
}

// ── Attachment row ─────────────────────────────────────────────────────────────
function AttachmentRow({ att, ticketId }: { att: TicketAttachmentDto; ticketId: number }) {
  // Navigation same-origin via /proxy → le cookie httpOnly access_token part
  // automatiquement avec la requête, plus besoin de token en query string
  // (qui n'était de toute façon jamais lu côté backend).
  const downloadUrl = attachmentDownloadUrl(ticketId, att.id);
  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-muted">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileIcon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{att.originalName}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(att.size)} · {att.uploaderName ?? "inconnu"}</div>
      </div>
      <Tooltip title="Télécharger">
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" aria-label="Télécharger" className="rounded-full p-1.5 text-muted-foreground hover:text-[#1E6091]">
          <Download size={16} />
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
  const commentsPollMs = useLiveInterval(15_000, 60_000);
  const threadCommentsQuery = useQuery({
    queryKey: ["escalation-comments", ticket?.id],
    queryFn: () => fetchTicketComments(ticket!.id),
    enabled: open && !!ticket && phase === "thread",
    refetchInterval: open && phase === "thread" ? commentsPollMs : false,
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
  const sending = commentMutation.isPending || uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" aria-describedby={undefined} className="flex flex-col" style={{ height: "calc(92vh / var(--ui-zoom))" }}>
        {/* Header */}
        <div className="shrink-0 px-6 py-4 text-white" style={{ background: `linear-gradient(135deg, ${AMBER} 0%, #b45309 100%)` }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#3C8047] text-[#0F3B5C]"><MoveUp size={22} /></span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[15px] font-bold text-white">
                  {phase === "form" ? "Escalader vers GeoTrust" : "Ticket GeoTrust — Discussion en cours"}
                </DialogTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/70">Réf. ticket #{ticket?.id} — {ticket?.title}</span>
                  <span className="rounded-full bg-white/15 px-2 text-[10px] font-bold leading-[17px] text-white">{sev.label}</span>
                  {ticket?.escalated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 text-[10px] font-bold leading-[17px] text-white">
                      <CircleCheck size={12} /> Escaladé
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-white/70 hover:bg-white/10 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Original ticket reference card ── */}
        <div className="shrink-0 border-b border-border bg-[#FFF9EC]">
          <div
            onClick={() => setShowRef((v) => !v)}
            className="flex cursor-pointer items-center gap-3 px-6 py-2.5 transition-colors hover:bg-[#FFF3D0]"
          >
            <Bug size={16} className="shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.7px] text-amber-800">Ticket original joint en référence</div>
              <div className="truncate text-xs text-amber-900">
                #{ticket?.id} — {ticket?.title} · {ticket?.requesterName ?? "Utilisateur inconnu"} · {ticket?.category ?? "Sans catégorie"}
              </div>
            </div>
            <span className="shrink-0 text-amber-700">{showRef ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
          </div>

          {showRef && (
            <div className="max-h-80 overflow-y-auto px-6 pb-4">
              {/* Description */}
              {ticket?.description && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-1 text-xs font-bold uppercase tracking-[0.7px] text-amber-800">Description</div>
                  <div className="text-[13px] leading-relaxed text-amber-900">{ticket.description}</div>
                </div>
              )}

              {/* Original thread */}
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.7px] text-amber-800">Fil de discussion original</div>
              {refCommentsQuery.isLoading ? (
                <div>{[1, 2].map((i) => <Skeleton key={i} className="mb-2 h-12 rounded-lg" />)}</div>
              ) : (refCommentsQuery.data?.length ?? 0) === 0 ? (
                <span className="text-xs text-border-strong">Aucun message dans la discussion originale.</span>
              ) : (
                refCommentsQuery.data?.map((c) => <RefCommentBubble key={c.id} comment={c} />)
              )}
            </div>
          )}
        </div>

        {/* ── Phase 1 : Formulaire d'escalade ── */}
        {phase === "form" && (
          <div className="flex flex-1 flex-col overflow-y-auto bg-background px-6 py-6">
            <div className="mb-4">
              <h3 className="mb-1 text-base font-bold text-foreground">Message d&apos;escalade vers GeoTrust</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Décrivez le contexte, l&apos;urgence et les éléments importants que l&apos;équipe GeoTrust doit connaître. Le ticket original et sa discussion seront joints automatiquement en référence.
              </p>
            </div>

            <div className="flex-1 rounded-xl border-[1.5px] border-border bg-surface transition-all focus-within:border-[#92400E]">
              <textarea
                value={escalateNote}
                onChange={(e) => setEscalateNote(e.target.value)}
                placeholder="Ex : Ce problème bloque 12 agents terrain depuis 2 jours. Malgré nos tentatives de résolution côté tenant, le bug semble lié à une synchronisation backend. Priorité haute..."
                rows={8}
                className="box-border w-full resize-none border-0 bg-transparent p-4 text-sm leading-[1.7] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {escalateError && <Alert severity="error" className="mt-3 py-1">{escalateError}</Alert>}

            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">Le demandeur sera notifié et le ticket passera en statut &quot;En cours&quot;</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={escalating}>Annuler</Button>
                <Button
                  disabled={escalating || !escalateNote.trim()}
                  onClick={handleEscalate}
                  className="bg-[#92400E] px-6 font-bold hover:bg-[#78350F] hover:opacity-100"
                >
                  {escalating ? <Spinner className="size-3.5" /> : <MoveUp size={16} />}
                  {escalating ? "Envoi en cours…" : "Envoyer l'escalade vers GeoTrust"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase 2 : Thread de discussion ── */}
        {phase === "thread" && (
          <>
            {/* Thread header */}
            <div className="shrink-0 border-b border-amber-200 bg-[#FFF9EC] px-6 py-2.5">
              <div className="flex items-center gap-2">
                <CircleCheck size={15} className="text-green-600" />
                <span className="text-xs font-bold text-green-700">
                  Ticket escaladé{ticket?.escalatedAt ? ` le ${formatDate(ticket.escalatedAt)}` : ""}
                  {ticket?.escalatedByName ? ` par ${ticket.escalatedByName}` : ""}
                </span>
              </div>
            </div>

            {/* Thread body */}
            <div className="flex-1 overflow-y-auto bg-background px-6 py-4">
              {threadCommentsQuery.isLoading ? (
                <div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`mb-4 flex gap-2 ${i % 2 === 0 ? "flex-row-reverse" : "flex-row"}`}>
                      <Skeleton className="size-8 rounded-full" />
                      <Skeleton className="h-14 w-[200px] rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (threadCommentsQuery.data?.length ?? 0) === 0 ? (
                <div className="py-12 text-center">
                  <MoveUp size={36} className="mx-auto mb-2 text-border-strong" />
                  <p className="text-sm text-muted-foreground">La discussion GeoTrust démarrera ici. Répondez ci-dessous.</p>
                </div>
              ) : (
                threadCommentsQuery.data?.map((c) => <EscCommentBubble key={c.id} comment={c} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Attachments */}
            {(attachmentsQuery.data?.length ?? 0) > 0 && (
              <div className="max-h-36 shrink-0 overflow-y-auto border-t border-border bg-background px-6 py-3">
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
              {replyError && <Alert severity="error" className="mb-3 py-1">{replyError}</Alert>}

              {pendingFile && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF9EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]">
                    <Paperclip size={14} /> {pendingFile.name} ({formatBytes(pendingFile.size)})
                    <button type="button" aria-label="Retirer le fichier" onClick={() => setPendingFile(null)} className="cursor-pointer border-0 bg-transparent p-0 text-[#92400E]/70 hover:text-[#92400E]">
                      <X size={13} />
                    </button>
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-border bg-background transition-all focus-within:border-[#92400E] focus-within:bg-surface">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Répondre dans la discussion GeoTrust…"
                  rows={3}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
                  className="box-border w-full resize-none border-0 bg-transparent px-3.5 pb-1.5 pt-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <div className="flex gap-1">
                    <Tooltip title="Joindre un fichier (max 10 Mo)">
                      <button type="button" aria-label="Joindre un fichier" onClick={() => fileInputRef.current?.click()} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-[#FFF9EC] hover:text-[#92400E]">
                        <Paperclip size={18} />
                      </button>
                    </Tooltip>
                    <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ""; }} className="hidden" accept="image/*,application/pdf,.doc,.docx,.txt" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-border-strong">Ctrl+Entrée</span>
                    <button
                      type="button"
                      disabled={!canSend}
                      onClick={handleSend}
                      className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#92400E] px-4 text-xs font-bold text-white transition-colors hover:bg-[#78350F] disabled:cursor-default disabled:bg-border disabled:text-muted-foreground"
                    >
                      Envoyer {sending ? <Spinner className="size-3.5" /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
