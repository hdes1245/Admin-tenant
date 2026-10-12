"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Plus, RefreshCw, Send } from "lucide-react";
import {
  TicketDto, TicketCommentDto, createTicket, fetchMyTickets,
  fetchTicketComments, addTicketComment, reopenTicket,
} from "@/lib/tickets";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/ui/page-blocks";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const CATEGORIES = [
  "Connexion & Accès", "Synchronisation", "Performance & Lenteur", "Géolocalisation & GPS",
  "Clients & Données", "Photos & Médias", "Notifications", "Autre",
];

const SEVERITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "#DC2626" },
  { value: "eleve",  label: "Élevé",  color: "#D97706" },
  { value: "moyen",  label: "Moyen",  color: "#EAB308" },
  { value: "faible", label: "Faible", color: "#94A3B8" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open:          { bg: "#DBEAFE", color: "#2563EB", label: "Ouvert" },
  in_progress:   { bg: "#FEF3C7", color: "#D97706", label: "En cours" },
  waiting_user:  { bg: "#EDE9FE", color: "#7C3AED", label: "En attente de vous" },
  resolved:      { bg: "#DCFCE7", color: "#16A34A", label: "Résolu" },
  closed:        { bg: "#F1F5F9", color: "#64748B", label: "Fermé" },
};

// Page volontairement allégée par rapport à /tickets (réservée à admin_tenant) :
// pas de vue "tous les tickets du tenant", pas d'escalade, pas de changement de
// statut — un superviseur ne gère que SES propres signalements. Le backend
// (support-tickets.controller.ts, ALL_ROLES sur create/my/comments/reopen)
// autorisait déjà ça ; il manquait seulement cet écran.
export default function MyTicketsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TicketDto | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("moyen");
  const [category, setCategory] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: tickets = [], isLoading, isError } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: fetchMyTickets,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["my-ticket-comments", selected?.id],
    queryFn: () => fetchTicketComments(selected!.id),
    enabled: !!selected,
  });

  const createMut = useMutation({
    mutationFn: () => createTicket({ title, description, severity, category: category || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      setCreateOpen(false);
      setTitle(""); setDescription(""); setSeverity("moyen"); setCategory(""); setCreateErr(null);
    },
    onError: (e: any) => setCreateErr(e?.message ?? "Erreur lors de la création"),
  });

  const commentMut = useMutation({
    mutationFn: () => addTicketComment(selected!.id, commentText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ticket-comments", selected?.id] });
      setCommentText("");
    },
  });

  const reopenMut = useMutation({
    mutationFn: () => reopenTicket(selected!.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      setSelected(updated);
    },
  });

  const selStyle = selected ? STATUS_STYLE[selected.status] : undefined;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Mes signalements</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Signalez un problème rencontré sur l&apos;application — suivez vos échanges avec le support.
          </p>
        </div>
        <Button className="hover:bg-[#1E6091] hover:opacity-100" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Nouveau signalement
        </Button>
      </div>

      <Panel className="overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : isError ? (
          <div className="p-8"><Alert severity="error">Erreur de chargement.</Alert></div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <Bug size={48} className="mx-auto mb-4 text-border-strong" />
            <p className="text-sm text-muted-foreground">Aucun signalement pour l&apos;instant</p>
          </div>
        ) : (
          <div>
            {tickets.map((t, idx) => {
              const style = STATUS_STYLE[t.status] ?? STATUS_STYLE.open;
              const sev = SEVERITY_OPTIONS.find((s) => s.value === t.severity);
              return (
                <div key={t.id} className={`mx-6 ${idx > 0 ? "border-t border-border" : ""}`}>
                  <div
                    onClick={() => setSelected(t)}
                    className="-mx-6 flex cursor-pointer items-start gap-4 px-6 py-4 hover:bg-muted"
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground">{t.title}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</div>
                      <div className="mt-1.5 flex flex-wrap gap-3">
                        {t.category && <span className="text-[11px] text-muted-foreground">{t.category}</span>}
                        {sev && <span className="text-[11px] font-semibold" style={{ color: sev.color }}>{sev.label}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-border-strong">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Création */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          <DialogHeader>Nouveau signalement</DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            {createErr && <Alert severity="error">{createErr}</Alert>}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Titre *</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Description *</span>
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="flex gap-4">
              <Select aria-label="Sévérité" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Select aria-label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Catégorie (optionnel)</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              disabled={!title.trim() || !description.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
              className="hover:bg-[#1E6091] hover:opacity-100"
            >
              {createMut.isPending ? <Spinner className="size-4" /> : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail / conversation */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          {selected && (
            <>
              <DialogHeader>{selected.title}</DialogHeader>
              <DialogBody className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: selStyle?.bg, color: selStyle?.color }}
                  >
                    {selStyle?.label ?? selected.status}
                  </span>
                  {(selected.status === "resolved" || selected.status === "closed") && (
                    <Button size="sm" variant="ghost" className="text-[#1E6091]" disabled={reopenMut.isPending} onClick={() => reopenMut.mutate()}>
                      <RefreshCw size={14} /> Rouvrir
                    </Button>
                  )}
                </div>
                <p className="text-[13px] text-foreground">{selected.description}</p>
                {selected.itResponse && <Alert severity="info" className="text-[12.5px]">{selected.itResponse}</Alert>}
                <hr className="border-border" />
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Échanges</div>
                {commentsLoading ? (
                  <Spinner className="size-5" />
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun échange pour l&apos;instant.</p>
                ) : (
                  <div className="flex max-h-[220px] flex-col gap-3 overflow-y-auto">
                    {comments.map((c: TicketCommentDto) => (
                      <div key={c.id} className="flex gap-2.5">
                        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#1E6091]/10 text-[11px] font-semibold text-[#1E6091]">
                          {(c.authorName ?? "?")[0]?.toUpperCase()}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{c.authorName ?? "—"}</div>
                          <div className="text-[12.5px] text-foreground">{c.content}</div>
                          <div className="text-[10px] text-border-strong">
                            {new Date(c.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input placeholder="Répondre…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <Button size="icon" aria-label="Envoyer" disabled={!commentText.trim() || commentMut.isPending} onClick={() => commentMut.mutate()} className="hover:bg-[#1E6091] hover:opacity-100">
                    <Send size={16} />
                  </Button>
                </div>
              </DialogBody>
              <DialogFooter className="border-t-0">
                <Button variant="ghost" onClick={() => setSelected(null)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
