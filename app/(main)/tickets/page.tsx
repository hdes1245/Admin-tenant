"use client";

import { TicketsTable } from "@/components/TicketsTable";
import { TicketConversationDialog } from "@/components/TicketConversationDialog";
import { EscalationDialog } from "@/components/EscalationDialog";
import { TicketStatsDialog } from "@/components/TicketStatsDialog";
import {
  TicketDto,
  createTicket,
  fetchTenantTickets,
  fetchMyItTickets,
} from "@/lib/tickets";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import LockIcon from "@mui/icons-material/Lock";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

const STANDARD_CATEGORIES = [
  { label: "Connexion & Acces",        icon: "🔐" },
  { label: "Synchronisation",          icon: "🔄" },
  { label: "Performance & Lenteur",    icon: "⚡" },
  { label: "Crash & Plantage",         icon: "💥" },
  { label: "Geolocalisation & GPS",    icon: "📍" },
  { label: "Carte & Affichage",        icon: "🗺️" },
  { label: "Clients & Donnees",        icon: "👥" },
  { label: "Photos & Medias",          icon: "📷" },
  { label: "Rapports & Exports",       icon: "📄" },
  { label: "Notifications",            icon: "🔔" },
  { label: "Securite & Compte",        icon: "🛡️" },
  { label: "Reseau & Connectivite",    icon: "📶" },
  { label: "Installation & Mise a jour", icon: "⬇️" },
  { label: "Paiement & Facturation",   icon: "🧾" },
  { label: "Autre",                    icon: "❓" },
];

const SEVERITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "#DC2626" },
  { value: "eleve",  label: "Eleve",  color: "#D97706" },
  { value: "moyen",  label: "Moyen",  color: "#EAB308" },
  { value: "faible", label: "Faible", color: "#94A3B8" },
];

function statusKpi(tickets: TicketDto[]) {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };
}

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"users" | "mine">("users");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [conversationTicket, setConversationTicket] = useState<TicketDto | null>(null);
  const [escalationTicket, setEscalationTicket]     = useState<TicketDto | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  // Champs du formulaire de création
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ title: false, description: false, severity: false, category: false });

  const [actionError, setActionError] = useState<string | null>(null);

  const { data: tickets = [], isLoading, isError, error } = useQuery({
    queryKey: ["tickets-tenant"],
    queryFn: fetchTenantTickets,
  });

  const { data: myItTickets = [], isLoading: myItLoading } = useQuery({
    queryKey: ["tickets-my-it"],
    queryFn: fetchMyItTickets,
  });

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-my-it"] });
    },
  });

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tickets]
  );

  const kpi = useMemo(() => statusKpi(tickets), [tickets]);

  const openCreate = () => {
    setTitle(""); setDescription(""); setSeverity(null); setCategory(null);
    setCreateError(null); setFieldErrors({ title: false, description: false, severity: false, category: false });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    const tErr = !title.trim();
    const dErr = !description.trim();
    const sErr = !severity;
    const cErr = !category;
    if (tErr || dErr || sErr || cErr) {
      setFieldErrors({ title: tErr, description: dErr, severity: sErr, category: cErr });
      setCreateError("Veuillez renseigner tous les champs obligatoires.");
      return;
    }
    setCreateError(null); setActionError(null);
    try {
      await createMutation.mutateAsync({ title, description, severity: severity!, category });
      setCreateDialogOpen(false);
      setTab("mine");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Creation impossible.");
    }
  };

  const KPI_DATA = [
    { label: "Total", value: kpi.total, accent: "#64748b", icon: <BugReportIcon sx={{ fontSize: 18 }} /> },
    { label: "Ouverts", value: kpi.open, accent: "#d97706", icon: <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} /> },
    { label: "En cours", value: kpi.in_progress, accent: STEEL, icon: <HourglassEmptyIcon sx={{ fontSize: 18 }} /> },
    { label: "Resolus", value: kpi.resolved, accent: "#16a34a", icon: <CheckCircleOutlineIcon sx={{ fontSize: 18 }} /> },
    { label: "Fermes", value: kpi.closed, accent: "#94A3B8", icon: <LockIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <BugReportIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Tickets IT</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Suivi des incidents, demandes et resolutions pour votre tenant
          </Typography>
        </Box>
        <Box display="flex" gap={1.5} flexWrap="wrap">
                <Button
                  variant="outlined" startIcon={<BarChartIcon />}
                  onClick={() => setStatsOpen(true)}
                  sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
                >
                  Statistiques
                </Button>
                <Tooltip title="Exporter les tickets en CSV">
                  <Button
                    variant="outlined" startIcon={<DownloadIcon />}
                    onClick={() => downloadCsv(
                      sortedTickets,
                      [{ key: "id", label: "Id" }, { key: "title", label: "Titre" }, { key: "description", label: "Description" }, { key: "severity", label: "Severite" }, { key: "status", label: "Statut" }, { key: "category", label: "Categorie" }, { key: "createdAt", label: "Date creation" }, { key: "requesterName", label: "Demandeur" }, { key: "requesterEmail", label: "Email demandeur" }, { key: "itResponse", label: "Reponse IT" }],
                      "tickets-it.csv"
                    )}
                    sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    Exporter CSV
                  </Button>
                </Tooltip>
                <Button
                  variant="contained" startIcon={<AddIcon />} onClick={openCreate}
                  sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, "&:hover": { bgcolor: "#b8891f" }, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}
                >
                  Creer un ticket
                </Button>
              </Box>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {!isLoading && tickets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Grid container spacing={2} mb={3}>
              {KPI_DATA.map((kpiItem, i) => (
                <Grid item xs={6} sm={4} md={12 / 5} key={i}>
                  <Box sx={{
                    borderRadius: 3, border: "1px solid #E2E8F0",
                    bgcolor: "white", px: 2.5, py: 2.5,
                    display: "flex", alignItems: "center", gap: 2,
                    position: "relative", overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(13,27,42,0.05)",
                    "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpiItem.accent, borderRadius: "3px 0 0 3px" },
                    transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(13,27,42,0.1)" },
                  }}>
                    <Avatar sx={{ width: 44, height: 44, bgcolor: kpiItem.accent, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpiItem.accent}44`, flexShrink: 0 }}>
                      {kpiItem.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: kpiItem.accent, lineHeight: 1, letterSpacing: -0.5 }}>{kpiItem.value}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>{kpiItem.label}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        )}

        {isError && <Alert severity="error" sx={{ mb: 3 }}>Impossible de charger les tickets. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}

        {/* Onglets */}
        <Box sx={{ borderBottom: "1px solid #E2E8F0", mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { fontWeight: 600, fontSize: 14, textTransform: "none", minHeight: 44, color: "#64748B" },
              "& .Mui-selected": { color: NAVY },
              "& .MuiTabs-indicator": { bgcolor: GOLD, height: 3, borderRadius: "3px 3px 0 0" },
            }}
          >
            <Tab
              value="users"
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  Tickets utilisateurs
                  <Chip label={sortedTickets.length} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: tab === "users" ? NAVY : "#E2E8F0", color: tab === "users" ? "white" : "#64748B" }} />
                </Box>
              }
            />
            <Tab
              value="mine"
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  Mes tickets & escaladés
                  {myItTickets.length > 0 && (
                    <Chip label={myItTickets.length} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: tab === "mine" ? GOLD : "#FEF3C7", color: tab === "mine" ? NAVY : "#92400E" }} />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          {tab === "users" ? (
            <TicketsTable
              tickets={sortedTickets}
              loading={isLoading}
              onChangeStatus={(ticket) => setConversationTicket(ticket)}
              onEscalate={(ticket) => setEscalationTicket(ticket)}
            />
          ) : (
            <>
              {myItTickets.length === 0 && !myItLoading ? (
                <Box sx={{ textAlign: "center", py: 8, color: "#94A3B8" }}>
                  <BugReportIcon sx={{ fontSize: 48, mb: 2, opacity: 0.4 }} />
                  <Typography fontWeight={600}>Aucun ticket personnel ni escaladé</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Creez un ticket IT ou escaladez un ticket utilisateur pour le voir ici.
                  </Typography>
                </Box>
              ) : (
                <TicketsTable
                  tickets={[...myItTickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                  loading={myItLoading}
                  onChangeStatus={(ticket) => setConversationTicket(ticket)}
                  onEscalate={(ticket) => setEscalationTicket(ticket)}
                />
              )}
            </>
          )}
        </motion.div>
      </Container>

      {/* Stats dialog */}
      <TicketStatsDialog
        tickets={sortedTickets}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />

      {/* Conversation dialog */}
      <TicketConversationDialog
        ticket={conversationTicket}
        open={!!conversationTicket}
        onClose={() => setConversationTicket(null)}
      />

      {/* Escalation dialog */}
      <EscalationDialog
        ticket={escalationTicket}
        open={!!escalationTicket}
        onClose={() => setEscalationTicket(null)}
      />

      {/* Create ticket dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}>
              <BugReportIcon sx={{ color: GOLD, fontSize: 20 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>Creer un ticket IT</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

            {/* Catégorie */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: fieldErrors.category ? "#DC2626" : "#64748B", textTransform: "uppercase", letterSpacing: 0.8, mb: 1, display: "block" }}>
                Categorie *
              </Typography>
              <Grid container spacing={1}>
                {STANDARD_CATEGORIES.map((cat) => {
                  const selected = category === cat.label;
                  return (
                    <Grid item xs={4} key={cat.label}>
                      <Box
                        onClick={() => { setCategory(cat.label); setFieldErrors((e) => ({ ...e, category: false })); }}
                        sx={{
                          border: `1.5px solid ${selected ? NAVY : fieldErrors.category ? "#DC2626" : "#E2E8F0"}`,
                          borderRadius: 2, p: 1, cursor: "pointer", textAlign: "center",
                          bgcolor: selected ? NAVY : "white",
                          transition: "all 0.15s",
                          "&:hover": { borderColor: NAVY, bgcolor: selected ? NAVY : "#F8FAFC" },
                        }}
                      >
                        <Typography sx={{ fontSize: 18, lineHeight: 1, mb: 0.25 }}>{cat.icon}</Typography>
                        <Typography sx={{ fontSize: 10, fontWeight: selected ? 700 : 500, color: selected ? "white" : "#334155", lineHeight: 1.2 }}>
                          {cat.label}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
              {fieldErrors.category && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>Veuillez choisir une categorie</Typography>}
            </Box>

            {/* Titre */}
            <TextField
              label="Titre *" fullWidth size="small" value={title}
              error={fieldErrors.title}
              helperText={fieldErrors.title ? "Le titre est obligatoire" : undefined}
              onChange={(e) => { setTitle(e.target.value); setFieldErrors((er) => ({ ...er, title: false })); }}
              placeholder="ex: Probleme de connexion a l'application"
            />

            {/* Description */}
            <TextField
              label="Description *" fullWidth size="small" value={description}
              error={fieldErrors.description}
              helperText={fieldErrors.description ? "La description est obligatoire" : undefined}
              onChange={(e) => { setDescription(e.target.value); setFieldErrors((er) => ({ ...er, description: false })); }}
              placeholder="Decrivez le probleme rencontre en detail"
              multiline minRows={4}
            />

            {/* Sévérité */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: fieldErrors.severity ? "#DC2626" : "#64748B", textTransform: "uppercase", letterSpacing: 0.8, mb: 1, display: "block" }}>
                Severite *
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {SEVERITY_OPTIONS.map((opt) => {
                  const sel = severity === opt.value;
                  return (
                    <Chip
                      key={opt.value} label={opt.label} clickable
                      onClick={() => { setSeverity(opt.value); setFieldErrors((e) => ({ ...e, severity: false })); }}
                      sx={{
                        fontWeight: 700, fontSize: 13,
                        bgcolor: sel ? opt.color : "transparent",
                        color: sel ? "white" : opt.color,
                        border: `2px solid ${sel ? opt.color : fieldErrors.severity ? "#DC2626" : opt.color + "60"}`,
                        "&:hover": { bgcolor: opt.color + "22" },
                      }}
                    />
                  );
                })}
              </Box>
              {fieldErrors.severity && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>Veuillez choisir un niveau de severite</Typography>}
            </Box>

            {createError && <Alert severity="error">{createError}</Alert>}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setCreateDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createMutation.isPending} sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            {createMutation.isPending ? "Creation..." : "Creer le ticket"}
          </Button>
        </DialogActions>
      </Dialog>

    </>
  );
}