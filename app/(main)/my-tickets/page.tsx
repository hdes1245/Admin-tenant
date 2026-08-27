"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, MenuItem, Paper, Select, Skeleton,
  TextField, Typography,
} from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  TicketDto, TicketCommentDto, createTicket, fetchMyTickets,
  fetchTicketComments, addTicketComment, reopenTicket,
} from "@/lib/tickets";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

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

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box mb={3} display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: "var(--text-primary)", letterSpacing: -0.5 }}>Mes signalements</Typography>
          <Typography sx={{ color: "var(--text-secondary)", fontSize: 13, mt: 0.5 }}>
            Signalez un problème rencontré sur l&apos;application — suivez vos échanges avec le support.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: NAVY, fontWeight: 700, "&:hover": { bgcolor: STEEL }, borderRadius: 2, textTransform: "none" }}>
          Nouveau signalement
        </Button>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, overflow: "hidden" }}>
        {isLoading ? (
          <Box p={3} display="flex" flexDirection="column" gap={1.5}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={64} sx={{ borderRadius: 2 }} />)}
          </Box>
        ) : isError ? (
          <Box p={4}><Alert severity="error">Erreur de chargement.</Alert></Box>
        ) : tickets.length === 0 ? (
          <Box p={6} textAlign="center">
            <BugReportIcon sx={{ fontSize: 48, color: "var(--border-strong)", mb: 2 }} />
            <Typography color="var(--text-muted)" fontSize={14}>Aucun signalement pour l&apos;instant</Typography>
          </Box>
        ) : (
          <Box>
            {tickets.map((t, idx) => {
              const style = STATUS_STYLE[t.status] ?? STATUS_STYLE.open;
              const sev = SEVERITY_OPTIONS.find((s) => s.value === t.severity);
              return (
                <Box key={t.id}>
                  {idx > 0 && <Divider sx={{ mx: 3 }} />}
                  <Box onClick={() => setSelected(t)} sx={{ px: 3, py: 2, display: "flex", alignItems: "flex-start", gap: 2, cursor: "pointer", "&:hover": { bgcolor: "var(--bg-hover)" } }}>
                    <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700, fontSize: 10, mt: 0.25, flexShrink: 0 }} />
                    <Box flex={1}>
                      <Typography fontSize={13} fontWeight={600} color="var(--text-primary)">{t.title}</Typography>
                      <Typography fontSize={12} color="var(--text-secondary)" mt={0.25} noWrap>{t.description}</Typography>
                      <Box display="flex" gap={1.5} mt={0.75} flexWrap="wrap">
                        {t.category && <Typography fontSize={11} color="var(--text-muted)">{t.category}</Typography>}
                        {sev && <Typography fontSize={11} sx={{ color: sev.color, fontWeight: 600 }}>{sev.label}</Typography>}
                      </Box>
                    </Box>
                    <Typography fontSize={11} color="var(--border-strong)" flexShrink={0}>
                      {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Création */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: "var(--text-primary)" }}>Nouveau signalement</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          {createErr && <Alert severity="error">{createErr}</Alert>}
          <TextField label="Titre *" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Description *" size="small" fullWidth multiline rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Box display="flex" gap={2}>
            <Select size="small" fullWidth value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITY_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
            <Select size="small" fullWidth displayEmpty value={category} onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="">Catégorie (optionnel)</MenuItem>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: "var(--text-secondary)" }}>Annuler</Button>
          <Button variant="contained" disabled={!title.trim() || !description.trim() || createMut.isPending}
            onClick={() => createMut.mutate()} sx={{ bgcolor: NAVY, fontWeight: 700, "&:hover": { bgcolor: STEEL } }}>
            {createMut.isPending ? <CircularProgress size={16} sx={{ color: "white" }} /> : "Envoyer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Détail / conversation */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selected && (
          <>
            <DialogTitle sx={{ fontWeight: 700, color: "var(--text-primary)" }}>{selected.title}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box display="flex" gap={1} alignItems="center">
                <Chip label={STATUS_STYLE[selected.status]?.label ?? selected.status} size="small"
                  sx={{ bgcolor: STATUS_STYLE[selected.status]?.bg, color: STATUS_STYLE[selected.status]?.color, fontWeight: 700 }} />
                {(selected.status === "resolved" || selected.status === "closed") && (
                  <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} disabled={reopenMut.isPending}
                    onClick={() => reopenMut.mutate()} sx={{ textTransform: "none", color: STEEL }}>
                    Rouvrir
                  </Button>
                )}
              </Box>
              <Typography fontSize={13} color="var(--text-primary)">{selected.description}</Typography>
              {selected.itResponse && (
                <Alert severity="info" sx={{ fontSize: 12.5 }}>{selected.itResponse}</Alert>
              )}
              <Divider />
              <Typography fontSize={12} fontWeight={700} color="var(--text-secondary)" textTransform="uppercase" letterSpacing={0.6}>Échanges</Typography>
              {commentsLoading ? (
                <CircularProgress size={20} />
              ) : comments.length === 0 ? (
                <Typography fontSize={12} color="var(--text-muted)">Aucun échange pour l&apos;instant.</Typography>
              ) : (
                <Box display="flex" flexDirection="column" gap={1.5} maxHeight={220} sx={{ overflowY: "auto" }}>
                  {comments.map((c: TicketCommentDto) => (
                    <Box key={c.id} display="flex" gap={1.25}>
                      <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: `${STEEL}18`, color: STEEL }}>
                        {(c.authorName ?? "?")[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography fontSize={12} fontWeight={600} color="var(--text-primary)">{c.authorName ?? "—"}</Typography>
                        <Typography fontSize={12.5} color="var(--text-primary)">{c.content}</Typography>
                        <Typography fontSize={10} color="var(--border-strong)">
                          {new Date(c.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              <Box display="flex" gap={1} alignItems="center">
                <TextField size="small" fullWidth placeholder="Répondre…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <Button variant="contained" disabled={!commentText.trim() || commentMut.isPending}
                  onClick={() => commentMut.mutate()} sx={{ minWidth: 40, bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
                  <SendIcon sx={{ fontSize: 16 }} />
                </Button>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setSelected(null)} sx={{ color: "var(--text-secondary)" }}>Fermer</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
