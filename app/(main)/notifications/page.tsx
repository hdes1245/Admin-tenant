"use client";

import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  createBroadcast,
  fetchBroadcasts,
  cancelBroadcast,
  BroadcastDto,
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  setAlertRuleActive,
  runAlertRuleNow,
  deleteAlertRule,
  AlertRuleDto,
  AlertCriterion,
} from "@/lib/notifications";
import { PaginationBar } from "@/components/PaginationBar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CampaignIcon from "@mui/icons-material/Campaign";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import AddIcon from "@mui/icons-material/Add";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";
const PAGE_SIZE = 15;

const TENANT_ROLES = [
  { code: "caf",                     label: "CAF terrain" },
  { code: "chef_agence",             label: "Chef d'agence" },
  { code: "responsable_zone",        label: "Responsable de zone" },
  { code: "directrice_exploitation", label: "Directrice exploitation" },
  { code: "responsable_credit",      label: "Responsable crédit" },
  { code: "analyste_credit",         label: "Analyste crédit" },
  { code: "recouvrement",            label: "Recouvrement" },
  { code: "controleur",              label: "Contrôleur" },
  { code: "audit",                   label: "Audit" },
  { code: "admin_tenant",            label: "Admin tenant" },
];

const CRITERIA: {
  code: AlertCriterion; label: string; help: string;
  needsThreshold: boolean; needsTranches?: boolean; unit?: string; defaultThreshold?: number;
}[] = [
  { code: "RISK_TRANCHE",      label: "Tranches de retard (PAR)",       help: "Alerte sur une ou plusieurs tranches d'ancienneté de retard.", needsThreshold: false, needsTranches: true },
  { code: "DAYS_LATE",         label: "Jours de retard ≥ seuil",        help: "Alerte quand un dossier dépasse le nombre de jours de retard.", needsThreshold: true, unit: "jours", defaultThreshold: 30 },
  { code: "UNPAID_CAPITAL",    label: "Capital impayé ≥ seuil",         help: "Alerte quand le capital impayé d'un client dépasse le montant.", needsThreshold: true, unit: "FCFA", defaultThreshold: 500000 },
  { code: "RISK_STATUS_ENTRY", label: "Entrée en statut à risque",      help: "Alerte dès qu'un dossier passe en statut SO / PE / DC.", needsThreshold: false },
  { code: "UPCOMING_DUE",      label: "Échéance proche (≤ N jours)",    help: "Alerte X jours avant une échéance pour anticiper le recouvrement.", needsThreshold: true, unit: "jours", defaultThreshold: 7 },
];

// Tranches de retard (buckets PAR) — codes alignés avec le backend.
const TRANCHES = [
  { code: "1_30",     label: "1–30 j" },
  { code: "31_90",    label: "31–90 j" },
  { code: "91_180",   label: "91–180 j" },
  { code: "181_360",  label: "181–360 j" },
  { code: "361_plus", label: "+360 j" },
];
const trancheLabel = (code: string) => TRANCHES.find((t) => t.code === code)?.label ?? code;

function criterionMeta(code: AlertCriterion) {
  return CRITERIA.find((c) => c.code === code) ?? CRITERIA[0];
}

function alertSummary(r: AlertRuleDto): string {
  const m = criterionMeta(r.criterion);
  if (m.needsTranches) {
    const labels = (r.tranches ?? []).map(trancheLabel);
    return labels.length ? `Retard : ${labels.join(", ")}` : "Tranches de retard";
  }
  if (!m.needsThreshold) return m.label;
  const val = m.unit === "FCFA"
    ? `${Math.round(Number(r.threshold ?? 0)).toLocaleString("fr-FR")} FCFA`
    : `${r.threshold} ${m.unit}`;
  return `${m.label.replace(/seuil.*/, "").trim()} ${val}`;
}

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return value; }
}

function fmtDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Onglet Mes notifications ──────────────────────────────────────────────────
function MyNotificationsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ["my-notifications", page],
    queryFn: () => fetchMyNotifications({ page, limit: PAGE_SIZE }),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const items = notificationsQuery.data?.items ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const totalPages = notificationsQuery.data?.totalPages ?? 1;
  const unread = items.filter((n) => !n.isRead).length;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <Box>
      <Paper elevation={0} sx={{ border: "1px solid #E2E8F0", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "white", boxShadow: "0 1px 4px rgba(13,27,42,0.04)" }}>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <TextField
            size="small" placeholder="Rechercher dans les notifications..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#F8FAFC", transition: "background .15s", "&:hover": { bgcolor: "white" }, "&.Mui-focused": { bgcolor: "white" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 } } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "#94A3B8" }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
            }}
          />
          <Button
            variant="outlined" size="small" startIcon={<DoneAllIcon />}
            onClick={async () => { setActionError(null); try { await markAllMutation.mutateAsync(); } catch (e) { setActionError(e instanceof Error ? e.message : "Erreur"); } }}
            disabled={markAllMutation.isPending || unread === 0}
            sx={{ borderColor: NAVY, color: NAVY, fontWeight: 600, borderRadius: 2, flexShrink: 0 }}
          >
            Tout marquer lu
          </Button>
        </Box>
        <Box display="flex" gap={1} alignItems="center" mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }}>
          <Typography variant="caption" color="text.secondary">{filteredItems.length} notification{filteredItems.length !== 1 ? "s" : ""}{search ? ` sur ${total}` : ` au total`}</Typography>
          {unread > 0 && <><Typography variant="caption" sx={{ color: "#CBD5E1" }}>·</Typography><Typography variant="caption" sx={{ color: STEEL, fontWeight: 600 }}>{unread} non lue{unread > 1 ? "s" : ""}</Typography></>}
        </Box>
      </Paper>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {notificationsQuery.isLoading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}

      {!notificationsQuery.isLoading && filteredItems.length === 0 && (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={8} color="text.secondary">
          <NotificationsNoneIcon sx={{ fontSize: 52, opacity: 0.3 }} />
          <Typography fontWeight={500}>{search ? "Aucune notification ne correspond à la recherche." : "Aucune notification pour l’instant."}</Typography>
        </Box>
      )}

      <Box display="flex" flexDirection="column" gap={1.5}>
        {filteredItems.map((n, idx) => (
          <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.25 }}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: n.isRead ? "#E2E8F0" : STEEL + "60", borderRadius: 3, bgcolor: n.isRead ? "white" : "#F0F6FF" }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box display="flex" gap={1.5} flex={1}>
                    <Box sx={{ width: 4, minHeight: 40, borderRadius: 4, bgcolor: n.isRead ? "#E2E8F0" : STEEL, flexShrink: 0 }} />
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.3} flexWrap="wrap">
                        <Typography variant="subtitle2" fontWeight={700}>{n.title}</Typography>
                        {!n.isRead && <Chip label="Nouveau" size="small" sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 700, fontSize: 10, height: 18 }} />}
                        {n.type && <Chip label={n.type} size="small" sx={{ bgcolor: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: 10, height: 18 }} />}
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={0.5}>{n.body || "—"}</Typography>
                      <Typography variant="caption" color="text.disabled">{fmt(n.createdAt)}</Typography>
                    </Box>
                  </Box>
                  {!n.isRead && (
                    <Button size="small" variant="outlined" disabled={markReadMutation.isPending}
                      sx={{ flexShrink: 0, fontSize: 11, borderRadius: 2, height: 28, borderColor: STEEL, color: STEEL }}
                      onClick={async () => { setActionError(null); try { await markReadMutation.mutateAsync(n.id); } catch (e) { setActionError(e instanceof Error ? e.message : "Erreur"); } }}>
                      Marquer lu
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>

      {total > PAGE_SIZE && <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />}
    </Box>
  );
}

// ── Onglet fusionné : Diffusions & alertes ────────────────────────────────────
// Un seul point d'entrée « Nouveau » ouvre un formulaire à deux modes :
//   • Diffusion ponctuelle : message rédigé, envoyé maintenant ou planifié.
//   • Alerte automatique   : règle déclenchée par un critère de risque (cron).
// Les deux produisent des notifications in-app ciblées par rôle.
type Mode = "broadcast" | "alert";

function MessagingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // Dialog partagé
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("broadcast");
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Champs communs
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  // Champs diffusion
  const [body, setBody] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  // Champs alerte
  const [criterion, setCriterion] = useState<AlertCriterion>("RISK_TRANCHE");
  const [threshold, setThreshold] = useState("30");
  const [tranches, setTranches] = useState<string[]>(["31_90", "91_180", "181_360", "361_plus"]);
  const [digest, setDigest] = useState(true);

  // Bandeaux d'action (liste)
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const { data: broadcasts = [], isLoading: bLoading } = useQuery({ queryKey: ["broadcasts"], queryFn: fetchBroadcasts });
  const { data: rules = [], isLoading: rLoading } = useQuery({ queryKey: ["alert-rules"], queryFn: fetchAlertRules });

  const cancelMutation = useMutation({
    mutationFn: cancelBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const meta = criterionMeta(criterion);

  const q = search.trim().toLowerCase();
  const filteredBroadcasts = useMemo(
    () => !q ? broadcasts : broadcasts.filter((b) => b.title?.toLowerCase().includes(q) || b.body?.toLowerCase().includes(q)),
    [broadcasts, q],
  );
  const filteredRules = useMemo(
    () => !q ? rules : rules.filter((r) => r.name?.toLowerCase().includes(q) || alertSummary(r).toLowerCase().includes(q)),
    [rules, q],
  );

  const pending = filteredBroadcasts.filter((b) => !b.isSent);
  const sent = filteredBroadcasts.filter((b) => b.isSent);

  // ── Ouverture du formulaire ──
  const resetFields = () => {
    setName(""); setRoles([]); setBody(""); setScheduleMode(false); setScheduledAt("");
    setCriterion("RISK_TRANCHE"); setThreshold("30"); setTranches(["31_90", "91_180", "181_360", "361_plus"]);
    setDigest(true); setEditRuleId(null); setFormError(null);
  };
  const openNew = (m: Mode) => { resetFields(); setMode(m); setOpen(true); };
  const openEditRule = (r: AlertRuleDto) => {
    resetFields();
    setMode("alert"); setEditRuleId(r.id); setName(r.name);
    setCriterion(r.criterion);
    setThreshold(r.threshold != null ? String(r.threshold) : "");
    setTranches(r.tranches ?? []);
    setDigest(r.digest);
    setRoles(r.targetRoles);
    setOpen(true);
  };
  const switchMode = (m: Mode) => {
    if (editRuleId) return; // on ne convertit pas une règle existante
    setMode(m); setFormError(null);
  };
  const onCriterionChange = (c: AlertCriterion) => {
    setCriterion(c);
    const m = criterionMeta(c);
    if (m.needsThreshold && (!threshold || Number(threshold) <= 0)) setThreshold(String(m.defaultThreshold ?? 1));
    if (m.needsTranches && tranches.length === 0) setTranches(["31_90", "91_180", "181_360", "361_plus"]);
  };
  const toggleTranche = (code: string) =>
    setTranches((prev) => prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]);
  const toggleRole = (code: string) =>
    setRoles((prev) => prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]);

  // ── Enregistrement ──
  const handleSave = async () => {
    if (!name.trim()) { setFormError(mode === "alert" ? "Donnez un nom à la règle." : "Le titre est obligatoire."); return; }
    if (roles.length === 0) { setFormError("Choisissez au moins un rôle destinataire."); return; }

    if (mode === "broadcast") {
      if (scheduleMode && !scheduledAt) { setFormError("Choisissez une date de planification."); return; }
      if (scheduleMode && new Date(scheduledAt) <= new Date()) { setFormError("La date doit être dans le futur."); return; }
    } else {
      if (meta.needsThreshold && (!threshold || Number(threshold) <= 0)) { setFormError("Renseignez un seuil strictement positif."); return; }
      if (meta.needsTranches && tranches.length === 0) { setFormError("Sélectionnez au moins une tranche de retard."); return; }
    }

    setSaving(true); setFormError(null);
    try {
      if (mode === "broadcast") {
        await createBroadcast({
          title: name.trim(),
          body: body.trim() || undefined,
          targetRoles: roles,
          scheduledAt: scheduleMode ? new Date(scheduledAt).toISOString() : null,
        });
        qc.invalidateQueries({ queryKey: ["broadcasts"] });
      } else {
        const payload = {
          name: name.trim(),
          criterion,
          threshold: meta.needsThreshold ? Number(threshold) : null,
          tranches: meta.needsTranches ? tranches : [],
          targetRoles: roles,
          digest,
        };
        if (editRuleId) await updateAlertRule(editRuleId, payload);
        else await createAlertRule(payload);
        qc.invalidateQueries({ queryKey: ["alert-rules"] });
      }
      setOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ── Actions règles ──
  const invalidateRules = () => qc.invalidateQueries({ queryKey: ["alert-rules"] });
  const toggleRule = async (r: AlertRuleDto) => {
    try { await setAlertRuleActive(r.id, !r.isActive); invalidateRules(); }
    catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };
  const runRule = async (r: AlertRuleDto) => {
    setBanner(null);
    try {
      const { alerts } = await runAlertRuleNow(r.id);
      invalidateRules();
      setBanner({ kind: "success", msg: alerts > 0
        ? `${alerts} alerte(s) envoyée(s) pour « ${r.name} ».`
        : `Aucun nouveau client à risque ne correspond à « ${r.name} » pour l'instant.` });
    } catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };
  const deleteRule = async (r: AlertRuleDto) => {
    try { await deleteAlertRule(r.id); invalidateRules(); }
    catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };

  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <Box>
      {/* En-tête + entrée unique */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={700} color={NAVY}>Diffusions &amp; alertes</Typography>
          <Typography variant="body2" color="text.secondary">
            Envoyez un message ponctuel aux équipes, ou créez une alerte automatique déclenchée par les clients à risque.
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => openNew("broadcast")}
            sx={{ borderColor: NAVY, color: NAVY, fontWeight: 700 }}>
            Diffusion
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openNew("alert")}
            sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, "&:hover": { bgcolor: "#b8891f" } }}>
            Nouvelle alerte
          </Button>
        </Box>
      </Box>

      {/* Recherche */}
      <Paper elevation={0} sx={{ border: "1px solid #E2E8F0", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "white", boxShadow: "0 1px 4px rgba(13,27,42,0.04)" }}>
        <TextField
          fullWidth size="small" placeholder="Rechercher une diffusion ou une alerte..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#F8FAFC", transition: "background .15s", "&:hover": { bgcolor: "white" }, "&.Mui-focused": { bgcolor: "white" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 } } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "#94A3B8" }} /></InputAdornment>,
            endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
          }}
        />
        <Box mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }}>
          <Typography variant="caption" color="text.secondary">
            {activeRules} alerte{activeRules !== 1 ? "s" : ""} active{activeRules !== 1 ? "s" : ""} · {sent.length} diffusion{sent.length !== 1 ? "s" : ""} envoyée{sent.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
      </Paper>

      {banner && <Alert severity={banner.kind} sx={{ mb: 2 }} onClose={() => setBanner(null)}>{banner.msg}</Alert>}

      {/* ── Section Alertes automatiques ── */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <WarningAmberIcon sx={{ fontSize: 16, color: "#b45309" }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#b45309" }}>
            Alertes automatiques ({filteredRules.length})
          </Typography>
        </Box>
        {rLoading && <Box display="flex" justifyContent="center" py={3}><CircularProgress size={26} /></Box>}
        {!rLoading && filteredRules.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" gap={1} py={4} color="text.secondary">
            <WarningAmberIcon sx={{ fontSize: 42, opacity: 0.28 }} />
            <Typography fontSize={13.5} fontWeight={500}>Aucune alerte automatique configurée.</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openNew("alert")}
              sx={{ borderColor: NAVY, color: NAVY, fontWeight: 600 }}>Créer une alerte</Button>
          </Box>
        )}
        <Box display="flex" flexDirection="column" gap={1.25}>
          {filteredRules.map((r) => {
            const m = criterionMeta(r.criterion);
            return (
              <Card key={r.id} elevation={0} sx={{ border: "1px solid", borderColor: r.isActive ? STEEL + "50" : "#E2E8F0", borderRadius: 3, bgcolor: r.isActive ? "#FBFDFF" : "#F8FAFC", opacity: r.isActive ? 1 : 0.75 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
                    <Box display="flex" gap={1.5} flex={1} minWidth={240}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: r.isActive ? NAVY : "#94A3B8", flexShrink: 0 }}>
                        <WarningAmberIcon sx={{ color: GOLD, fontSize: 20 }} />
                      </Avatar>
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={0.3}>
                          <Typography variant="subtitle2" fontWeight={700}>{r.name}</Typography>
                          <Chip label={alertSummary(r)} size="small" sx={{ bgcolor: "#FFF7ED", color: "#b45309", fontWeight: 700, fontSize: 10, height: 18 }} />
                          <Chip label={r.digest ? "Récap" : "Par dossier"} size="small" sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 700, fontSize: 10, height: 18 }} />
                          {!r.isActive && <Chip label="Inactive" size="small" sx={{ bgcolor: "#F1F5F9", color: "#64748B", fontWeight: 600, fontSize: 10, height: 18 }} />}
                        </Box>
                        <Typography variant="caption" color="text.secondary">{m.help}</Typography>
                        <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.6}>
                          {r.targetRoles.map((role) => (
                            <Chip key={role} label={TENANT_ROLES.find((t) => t.code === role)?.label ?? role} size="small"
                              sx={{ bgcolor: "#F1F5F9", color: "#475569", fontSize: 10, height: 16 }} />
                          ))}
                        </Box>
                        <Typography variant="caption" color="text.disabled" display="block" mt={0.6}>
                          {r.totalFired} alerte{r.totalFired !== 1 ? "s" : ""} émise{r.totalFired !== 1 ? "s" : ""}
                          {r.lastRunAt ? ` · dernière éval. ${fmt(r.lastRunAt)}` : " · jamais évaluée"}
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                      <Tooltip title={r.isActive ? "Désactiver" : "Activer"}>
                        <Switch size="small" checked={r.isActive} onChange={() => toggleRule(r)}
                          sx={{ "& .Mui-checked": { color: STEEL }, "& .Mui-checked + .MuiSwitch-track": { bgcolor: STEEL } }} />
                      </Tooltip>
                      <Tooltip title="Tester maintenant">
                        <IconButton size="small" onClick={() => runRule(r)} sx={{ color: "#16a34a" }}><PlayArrowIcon sx={{ fontSize: 19 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => openEditRule(r)} sx={{ color: STEEL }}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => deleteRule(r)} sx={{ color: "#dc2626" }}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* ── Section Diffusions ── */}
      {pending.length > 0 && (
        <Box mb={3}>
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <ScheduleIcon sx={{ fontSize: 16, color: "#d97706" }} />
            <Typography variant="subtitle2" fontWeight={700} color="#d97706">
              Diffusions planifiées ({pending.length})
            </Typography>
          </Box>
          <Box display="flex" flexDirection="column" gap={1.5}>
            {pending.map((b) => (
              <BroadcastCard key={b.id} broadcast={b}
                onCancel={async () => { setBanner(null); try { await cancelMutation.mutateAsync(b.id); } catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); } }}
                cancelling={cancelMutation.isPending}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box>
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <CheckCircleIcon sx={{ fontSize: 16, color: "#16a34a" }} />
          <Typography variant="subtitle2" fontWeight={700} color="#16a34a">
            Diffusions envoyées ({sent.length})
          </Typography>
        </Box>
        {bLoading && <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>}
        {!bLoading && sent.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" gap={1} py={4} color="text.secondary">
            <CampaignIcon sx={{ fontSize: 42, opacity: 0.25 }} />
            <Typography fontSize={13.5} fontWeight={500}>Aucune diffusion envoyée pour l&apos;instant.</Typography>
            <Button size="small" variant="outlined" startIcon={<CampaignIcon />} onClick={() => openNew("broadcast")}
              sx={{ borderColor: NAVY, color: NAVY, fontWeight: 600 }}>Nouvelle diffusion</Button>
          </Box>
        )}
        <Box display="flex" flexDirection="column" gap={1.5}>
          {sent.map((b) => <BroadcastCard key={b.id} broadcast={b} />)}
        </Box>
      </Box>

      {/* ── Dialog unifié (diffusion / alerte) ── */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}>
              {mode === "alert"
                ? <WarningAmberIcon sx={{ color: GOLD, fontSize: 20 }} />
                : <CampaignIcon sx={{ color: GOLD, fontSize: 20 }} />}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              {editRuleId ? "Modifier l'alerte" : mode === "alert" ? "Nouvelle alerte automatique" : "Nouvelle diffusion"}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Box display="flex" flexDirection="column" gap={2.5}>

            {/* Sélecteur de mode (masqué en édition de règle) */}
            {!editRuleId && (
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
                {([
                  { m: "broadcast" as Mode, label: "Diffusion ponctuelle", icon: <CampaignIcon sx={{ fontSize: 16 }} />, desc: "Un message, une fois" },
                  { m: "alert" as Mode, label: "Alerte automatique", icon: <WarningAmberIcon sx={{ fontSize: 16 }} />, desc: "Déclenchée par les risques" },
                ]).map((opt) => {
                  const selected = mode === opt.m;
                  return (
                    <Box key={opt.m} onClick={() => switchMode(opt.m)}
                      sx={{
                        cursor: "pointer", borderRadius: 2, p: 1.25,
                        border: "1.5px solid", borderColor: selected ? NAVY : "#E2E8F0",
                        bgcolor: selected ? "#F0F6FF" : "white", transition: "all .15s",
                      }}>
                      <Box display="flex" alignItems="center" gap={0.75} sx={{ color: selected ? NAVY : "#64748B" }}>
                        {opt.icon}
                        <Typography variant="body2" fontWeight={700} fontSize={13}>{opt.label}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Titre / nom */}
            <TextField
              label={mode === "alert" ? "Nom de la règle *" : "Titre *"} fullWidth size="small"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder={mode === "alert" ? "ex: Retards critiques recouvrement" : "ex: Maintenance prévue ce vendredi"} />

            {/* Champs propres à la DIFFUSION */}
            {mode === "broadcast" && (
              <TextField label="Message (optionnel)" fullWidth size="small" multiline minRows={3}
                value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Détaillez votre message ici..." />
            )}

            {/* Champs propres à l'ALERTE */}
            {mode === "alert" && (
              <>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, mb: 0.75, display: "block" }}>
                    Critère déclencheur *
                  </Typography>
                  <Select fullWidth size="small" value={criterion} onChange={(e) => onCriterionChange(e.target.value as AlertCriterion)}>
                    {CRITERIA.map((c) => <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>)}
                  </Select>
                  <Typography variant="caption" color="text.secondary" mt={0.5} display="block">{meta.help}</Typography>
                </Box>
                {meta.needsThreshold && (
                  <TextField label={`Seuil (${meta.unit})`} type="number" fullWidth size="small"
                    value={threshold} onChange={(e) => setThreshold(e.target.value)} inputProps={{ min: 1 }}
                    helperText={meta.unit === "FCFA" ? "Montant en francs CFA." : "Nombre de jours."} />
                )}
                {meta.needsTranches && (
                  <Box>
                    <Typography variant="caption" fontWeight={700} sx={{ color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, mb: 0.75, display: "block" }}>
                      Tranches de retard surveillées *
                    </Typography>
                    <Box display="flex" gap={0.75} flexWrap="wrap">
                      {TRANCHES.map((t) => {
                        const on = tranches.includes(t.code);
                        return (
                          <Chip key={t.code} label={t.label} onClick={() => toggleTranche(t.code)}
                            variant={on ? "filled" : "outlined"} size="small"
                            sx={{ fontWeight: 700, cursor: "pointer",
                              bgcolor: on ? "#FFF7ED" : "transparent",
                              color: on ? "#b45309" : "#64748B",
                              borderColor: on ? "#FED7AA" : "#CBD5E1" }} />
                        );
                      })}
                    </Box>
                  </Box>
                )}

                <Alert severity="info" icon={<GroupsIcon fontSize="inherit" />} sx={{ py: 0.5, borderRadius: 2, "& .MuiAlert-message": { fontSize: 12.5 } }}>
                  Chaque destinataire ne reçoit que les clients de son périmètre : un CAF ses propres clients, un chef d&apos;agence son agence, un responsable de zone sa zone, les autres rôles l&apos;ensemble du portefeuille.
                </Alert>

                <Box sx={{ border: "1px solid #E2E8F0", borderRadius: 2, p: 1.25 }}>
                  <FormControlLabel
                    control={<Switch checked={digest} onChange={(e) => setDigest(e.target.checked)} size="small" sx={{ "& .Mui-checked": { color: STEEL }, "& .Mui-checked + .MuiSwitch-track": { bgcolor: STEEL } }} />}
                    label={<Typography variant="body2" fontWeight={600}>Notification récapitulative</Typography>}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 0.5 }}>
                    {digest
                      ? "Un seul message par destinataire (ex : « 5 clients en 91–180 j dans votre portefeuille »)."
                      : "Une notification par dossier concerné (plus détaillé, mais volumineux)."}
                  </Typography>
                </Box>
              </>
            )}

            {/* Rôles destinataires (commun) */}
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupsIcon sx={{ fontSize: 16, color: "#64748B" }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Rôles destinataires *
                </Typography>
              </Box>
              <Box sx={{ border: "1px solid #E2E8F0", borderRadius: 2, p: 1.5 }}>
                <FormGroup>
                  <Box display="grid" gridTemplateColumns="1fr 1fr" gap={0.5}>
                    {TENANT_ROLES.map((r) => (
                      <FormControlLabel key={r.code} control={
                        <Checkbox size="small" checked={roles.includes(r.code)} onChange={() => toggleRole(r.code)}
                          sx={{ color: "#CBD5E1", "&.Mui-checked": { color: NAVY } }} />
                      } label={<Typography variant="body2" fontSize={13}>{r.label}</Typography>} />
                    ))}
                  </Box>
                </FormGroup>
                <Divider sx={{ my: 1 }} />
                <Button size="small" onClick={() => setRoles(roles.length === TENANT_ROLES.length ? [] : TENANT_ROLES.map(r => r.code))}
                  sx={{ fontSize: 12, color: STEEL }}>
                  {roles.length === TENANT_ROLES.length ? "Tout déselectionner" : "Tout sélectionner"}
                </Button>
              </Box>
            </Box>

            {/* Planification (diffusion uniquement) */}
            {mode === "broadcast" && (
              <Box>
                <FormControlLabel control={
                  <Checkbox checked={scheduleMode} onChange={(e) => setScheduleMode(e.target.checked)}
                    sx={{ color: "#CBD5E1", "&.Mui-checked": { color: NAVY } }} />
                } label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ScheduleIcon sx={{ fontSize: 16, color: "#64748B" }} />
                    <Typography variant="body2" fontWeight={600}>Planifier pour plus tard</Typography>
                  </Box>
                } />
                {scheduleMode && (
                  <TextField
                    type="datetime-local" fullWidth size="small" sx={{ mt: 1 }}
                    value={scheduledAt}
                    inputProps={{ min: fmtDatetimeLocal(new Date(Date.now() + 60_000).toISOString()) }}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    label="Date et heure d'envoi"
                  />
                )}
              </Box>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} variant="outlined" color="inherit" disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}
            startIcon={mode === "alert" ? <BoltIcon /> : scheduleMode ? <ScheduleIcon /> : <SendIcon />}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            {saving
              ? "Enregistrement..."
              : mode === "alert"
                ? (editRuleId ? "Enregistrer" : "Créer l'alerte")
                : scheduleMode ? "Planifier" : "Envoyer maintenant"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BroadcastCard({ broadcast: b, onCancel, cancelling }: { broadcast: BroadcastDto; onCancel?: () => void; cancelling?: boolean }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: b.isSent ? "#E2E8F0" : "#FEF3C7", borderRadius: 3, bgcolor: b.isSent ? "white" : "#FFFBEB" }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={700}>{b.title}</Typography>
              {b.isSent ? (
                <>
                  <Chip label={`${b.recipientCount} destinataire${b.recipientCount !== 1 ? "s" : ""}`} size="small" sx={{ bgcolor: "#F0FDF4", color: "#16a34a", fontWeight: 700, fontSize: 10, height: 18 }} />
                  <Tooltip title={`${b.readCount} agent${b.readCount !== 1 ? "s ont" : " a"} lu ce message`} arrow>
                    <Chip
                      icon={<VisibilityIcon sx={{ fontSize: 11, color: b.readCount > 0 ? "#1B4F72 !important" : "#94A3B8 !important" }} />}
                      label={`${b.readCount} / ${b.recipientCount} lu${b.readCount !== 1 ? "s" : ""}`}
                      size="small"
                      sx={{
                        bgcolor: b.readCount > 0 ? "#EFF6FF" : "#F1F5F9",
                        color: b.readCount > 0 ? "#1B4F72" : "#94A3B8",
                        fontWeight: 700,
                        fontSize: 10,
                        height: 18,
                        cursor: "default",
                      }}
                    />
                  </Tooltip>
                </>
              ) : (
                <Chip icon={<ScheduleIcon sx={{ fontSize: 12, color: "#d97706 !important" }} />} label="Planifiée" size="small" sx={{ bgcolor: "#FEF3C7", color: "#d97706", fontWeight: 700, fontSize: 10, height: 18 }} />
              )}
            </Box>
            {b.body && <Typography variant="body2" color="text.secondary" mb={0.5}>{b.body}</Typography>}
            <Box display="flex" gap={0.5} flexWrap="wrap" mb={0.5}>
              {b.targetRoles.map((r) => (
                <Chip key={r} label={r} size="small" sx={{ bgcolor: "#F1F5F9", color: "#475569", fontSize: 10, height: 16 }} />
              ))}
            </Box>
            <Typography variant="caption" color="text.disabled">
              {b.isSent ? `Envoyée le ${fmt(b.sentAt)}` : `Planifiée pour le ${fmt(b.scheduledAt)}`}
              {" · "}Créée le {fmt(b.createdAt)}
            </Typography>
          </Box>
          {!b.isSent && onCancel && (
            <Tooltip title="Annuler cette diffusion planifiée">
              <span>
                <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}
                  disabled={cancelling} onClick={onCancel}
                  sx={{ fontSize: 11, height: 28, flexShrink: 0 }}>
                  Annuler
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [tab, setTab] = useState<"mine" | "messaging">("mine");

  const notifKpiQuery = useQuery({
    queryKey: ["notif-kpi"],
    queryFn: () => fetchMyNotifications({ page: 1, limit: 50 }),
  });
  const broadcastKpiQuery = useQuery({
    queryKey: ["broadcast-kpi"],
    queryFn: fetchBroadcasts,
  });
  const alertRulesKpiQuery = useQuery({
    queryKey: ["alert-rules-kpi"],
    queryFn: fetchAlertRules,
  });
  const kpiNotifItems  = notifKpiQuery.data?.items ?? [];
  const kpiBroadcasts  = broadcastKpiQuery.data ?? [];
  const kpiRules       = alertRulesKpiQuery.data ?? [];
  const kpiUnread      = kpiNotifItems.filter((n) => !n.isRead).length;
  const kpiSent        = kpiBroadcasts.filter((b) => b.isSent).length;
  const kpiActiveRules = kpiRules.filter((r) => r.isActive).length;

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <CampaignIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Notifications</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Recevez les alertes système, diffusez des messages et automatisez les alertes clients à risque
          </Typography>
        </Box>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* KPIs */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Mes notifications",   value: notifKpiQuery.data?.total ?? 0, accent: NAVY,      icon: <NotificationsNoneIcon sx={{ fontSize: 22 }} /> },
            { label: "Non lues",            value: kpiUnread,                      accent: "#d97706", icon: <NotificationsActiveIcon sx={{ fontSize: 22 }} /> },
            { label: "Diffusions envoyées", value: kpiSent,                        accent: "#059669", icon: <CampaignIcon sx={{ fontSize: 22 }} /> },
            { label: "Alertes actives",     value: kpiActiveRules,                 accent: "#b45309", icon: <WarningAmberIcon sx={{ fontSize: 22 }} /> },
          ].map((kpi, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Box sx={{
                borderRadius: 3, border: "1px solid #E2E8F0", bgcolor: "white",
                px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2,
                position: "relative", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(13,27,42,0.05)",
                "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.accent, borderRadius: "3px 0 0 3px" },
                transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(13,27,42,0.1)" },
              }}>
                <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.accent, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.accent}44`, flexShrink: 0 }}>{kpi.icon}</Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: kpi.accent, lineHeight: 1, letterSpacing: -0.5 }}>{kpi.value}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ lineHeight: 1.3 }}>{kpi.label}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Onglets */}
        <Box sx={{ borderBottom: "1px solid #E2E8F0", mb: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
            "& .MuiTab-root": { fontWeight: 600, fontSize: 14, textTransform: "none", minHeight: 44, color: "#64748B" },
            "& .Mui-selected": { color: NAVY },
            "& .MuiTabs-indicator": { bgcolor: GOLD, height: 3, borderRadius: "3px 3px 0 0" },
          }}>
            <Tab value="mine" label={
              <Box display="flex" alignItems="center" gap={1}>
                <NotificationsNoneIcon sx={{ fontSize: 18 }} />
                Mes notifications
              </Box>
            } />
            <Tab value="messaging" label={
              <Box display="flex" alignItems="center" gap={1}>
                <CampaignIcon sx={{ fontSize: 18 }} />
                Diffusions &amp; alertes
              </Box>
            } />
          </Tabs>
        </Box>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === "mine" ? <MyNotificationsTab /> : <MessagingTab />}
        </motion.div>

      </Container>
    </>
  );
}
