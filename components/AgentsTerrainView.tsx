"use client";

import { useState } from "react";
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, Avatar, Alert, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Badge, Switch,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FilterListIcon from "@mui/icons-material/FilterList";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import SyncIcon from "@mui/icons-material/Sync";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import BlockIcon from "@mui/icons-material/Block";
import HistoryIcon from "@mui/icons-material/History";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD = "#3C8047";

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.data)) return v.data;
  return [];
}

function apiFetch(path: string, init?: RequestInit) {
  if (init?.method && init.method !== "GET") {
    return apiClient.request({ url: path, method: init.method as any, data: init.body ? JSON.parse(init.body as string) : undefined }).then((r) => r.data);
  }
  return apiClient.get(path).then((r) => r.data);
}

function minutesAgo(iso: string | null) {
  if (!iso) return "Jamais";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return "À l'instant";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} j`;
}

/** Activité la plus récente entre la dernière capture GPS et la dernière requête authentifiée (last_seen_at). */
function lastActivity(u: { last_capture_at?: string | null; last_seen_at?: string | null }): string | null {
  const capture = u.last_capture_at ? new Date(u.last_capture_at).getTime() : 0;
  const seen = u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0;
  const max = Math.max(capture, seen);
  return max > 0 ? new Date(max).toISOString() : null;
}

// Le statut "en ligne" se base sur la dernière ACTIVITÉ authentifiée (login,
// navigation dans l'app...), pas uniquement la dernière capture GPS — un
// agent connecté qui n'a pas encore capturé est bien en ligne.
function agentStatus(lastActivityIso: string | null, today: number) {
  if (!lastActivityIso) return { label: "Inactif", color: "#94a3b8" };
  const m = (Date.now() - new Date(lastActivityIso).getTime()) / 60000;
  if (m < 60) return { label: "En ligne", color: "#16a34a" };
  if (m < 480) return { label: "Récent", color: "#d97706" };
  if (today > 0) return { label: "Actif auj.", color: "#2563eb" };
  return { label: "Hors ligne", color: "#94a3b8" };
}

// ── Onglet Performance ──────────────────────────────────────────────────────
function PerformanceTab() {
  const [period, setPeriod] = useState(30);
  const [agenceFilter, setAgenceFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: statsRaw, refetch } = useQuery({
    queryKey: ["team-stats", period],
    queryFn: () => apiFetch(`/users/stats?days=${period}`),
    refetchInterval: 60_000,
  });

  // IMPORTANT : même queryKey ["agences"] que les autres pages → le fetcher
  // DOIT être fetchAgences (forme mappée {code, name}), sinon le cache React
  // Query est empoisonné avec la forme brute {COD_AGENCE, NOM_AGENCE} et les
  // listes d'agences des autres écrans affichent des libellés vides.
  const { data: agencesRaw } = useQuery({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });

  const { data: locPerDayRaw } = useQuery({
    queryKey: ["loc-per-day-tenant", period],
    queryFn: () => apiFetch(`/locations/per-day?days=${period}`),
  });

  const agences = arr(agencesRaw);
  const locPerDay = arr(locPerDayRaw);
  const users: any[] = arr(statsRaw?.users ?? statsRaw);
  const filtered = users.filter((u) => {
    // Un CAF multi-agences est affecté à plusieurs agences (agence_ids via
    // caf_assignments) en plus de son agence principale (agence_id) — le
    // filtre doit matcher n'importe laquelle, sinon certaines agences
    // paraissent vides alors qu'elles ont bien des agents.
    if (agenceFilter) {
      const ids = [u.agence_id, ...((u.agence_ids as any[]) ?? [])].filter((x) => x != null).map(String);
      if (!ids.includes(agenceFilter)) return false;
    }
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCapturesToday = users.reduce((s: number, u: any) => s + (u.locations_24h ?? 0), 0);
  const totalCaptures30d = users.reduce((s: number, u: any) => s + (u.locations_30d ?? 0), 0);
  const onlineCount = users.filter((u) => agentStatus(lastActivity(u), u.locations_24h ?? 0).label === "En ligne").length;
  const topPerformer = [...users].sort((a, b) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0))[0];

  // Libellé agence affiché : quand un filtre est actif, montrer l'agence
  // FILTRÉE (l'affectation qui justifie la présence de l'agent dans la
  // liste), pas son agence principale — sinon un CAF multi-agences filtré
  // sur Bouaké s'affiche "Prestige" et le résultat paraît incohérent.
  const agenceNameById = new Map(agences.map((a: any) => [String(a.id), a.name]));
  const displayAgence = (u: any): string => {
    if (agenceFilter) return agenceNameById.get(agenceFilter) ?? (u.agence_name ?? "—");
    const extra = ((u.agence_ids as any[]) ?? []).filter((id) => id != null && String(id) !== String(u.agence_id)).length;
    return `${u.agence_name ?? "—"}${extra > 0 ? ` (+${extra})` : ""}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
              {[7, 15, 30, 90].map((d) => <MenuItem key={d} value={d}>{d} jours</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Actualiser">
            <IconButton onClick={() => refetch()} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* KPI */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 3 }}>
        {[
          { label: "Agents en ligne", value: onlineCount, color: "#16a34a", icon: <WifiIcon /> },
          { label: `Captures ${period}j`, value: totalCaptures30d.toLocaleString("fr-FR"), color: GOLD, icon: <LocationOnIcon /> },
          { label: "Captures aujourd'hui", value: totalCapturesToday, color: STEEL, icon: <TrendingUpIcon /> },
          { label: "Meilleur agent", value: topPerformer?.name ?? "—", color: "#7c3aed", icon: <EmojiEventsIcon /> },
        ].map(({ label, value, color, icon }) => (
          <Card key={label} sx={{ border: `1px solid ${color}30` }}>
            <CardContent sx={{ pb: "16px !important" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontSize={11} fontWeight={700} color="text.secondary" textTransform="uppercase">{label}</Typography>
                  <Typography fontSize={label === "Meilleur agent" ? 16 : 28} fontWeight={800} color={color} lineHeight={1.2}>{value}</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Charts */}
      <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 3, mb: 3 }}>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography fontWeight={700} mb={2} color="var(--text-primary)">Captures GPS / jour ({period}j)</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={locPerDay}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice?.(5) ?? v} />
              <YAxis tick={{ fontSize: 11 }} />
              <RTooltip />
              <Area type="monotone" dataKey="count" name="Captures" fill="url(#g1)" stroke={GOLD} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography fontWeight={700} mb={2} color="var(--text-primary)">Répartition activité</Typography>
          <Box sx={{ display: "grid", gap: 2 }}>
            {[
              { label: "En ligne (< 1h)", count: onlineCount, color: "#16a34a" },
              { label: "Récent (< 8h)", count: users.filter((u) => agentStatus(lastActivity(u), u.locations_24h).label === "Récent").length, color: "#d97706" },
              { label: "Hors ligne", count: users.length - onlineCount - users.filter((u) => agentStatus(lastActivity(u), u.locations_24h).label === "Récent").length, color: "#94a3b8" },
            ].map(({ label, count, color }) => (
              <Box key={label}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                  <Typography fontSize={12}>{label}</Typography>
                  <Typography fontSize={12} fontWeight={700} color={color}>{count}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={users.length ? Math.round((count / users.length) * 100) : 0}
                  sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { background: color } }} />
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterListIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Agence</InputLabel>
            <Select value={agenceFilter} label="Agence" onChange={(e) => setAgenceFilter(e.target.value)}>
              <MenuItem value="">Toutes</MenuItem>
              {agences.map((a: any) => <MenuItem key={a.id} value={String(a.id)}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Recherche agent" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Typography fontSize={13} color="text.secondary">{filtered.length} agents</Typography>
        </Stack>
      </Paper>

      {/* Agent table */}
      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ background: NAVY, p: 2 }}>
          <Typography fontWeight={700} color="white">Tableau de performance agents</Typography>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: "#f8fafc" }}>
                {["#", "Agent", "Rôle", "Agence", "Statut", "Auj.", `${period}j`, "Dernière capture", "Score"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: 11 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucun agent</TableCell></TableRow>
              )}
              {filtered.sort((a: any, b: any) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0)).map((u: any, i: number) => {
                const status = agentStatus(lastActivity(u), u.locations_24h ?? 0);
                const score = Math.min(100, (u.locations_30d ?? 0));
                return (
                  <TableRow key={u.id} hover sx={{ background: i < 3 ? `${GOLD}06` : undefined }}>
                    <TableCell>
                      <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? GOLD : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "#f1f5f9", color: i < 3 ? "white" : NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</Box>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, background: STEEL }}>{u.name?.[0]}</Avatar>
                        <Box>
                          <Typography fontSize={13} fontWeight={600}>{u.name}</Typography>
                          <Typography fontSize={11} color="text.secondary">@{u.username}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Chip label={u.role_name ?? "?"} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                    <TableCell><Typography fontSize={12}>{displayAgence(u)}</Typography></TableCell>
                    <TableCell><Chip label={status.label} size="small" sx={{ background: `${status.color}20`, color: status.color, fontWeight: 700 }} /></TableCell>
                    <TableCell><Typography fontWeight={700} color={u.locations_24h > 0 ? GOLD : "text.disabled"}>{u.locations_24h ?? 0}</Typography></TableCell>
                    <TableCell><Typography fontWeight={600}>{u.locations_30d?.toLocaleString("fr-FR") ?? 0}</Typography></TableCell>
                    <TableCell><Typography fontSize={11} color="text.secondary" whiteSpace="nowrap">{minutesAgo(u.last_capture_at)}</Typography></TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <Box>
                        <LinearProgress variant="determinate" value={Math.min(100, score)} sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { background: score > 50 ? "#16a34a" : score > 20 ? "#d97706" : "#dc2626" } }} />
                        <Typography fontSize={10} color="text.secondary" mt={0.3}>{score} pts</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
}

// ── Onglet Flotte mobile ────────────────────────────────────────────────────
function FleetTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [agenceFilter, setAgenceFilter] = useState("");
  const [notifDialog, setNotifDialog] = useState<any>(null);
  const [notifMsg, setNotifMsg] = useState("");

  const { data: fleet = [], isLoading, refetch } = useQuery({
    queryKey: ["mobile-fleet"],
    queryFn: () => apiFetch("/users/mobile-fleet"),
    refetchInterval: 30_000,
  });

  // Même contrainte que plus haut : queryKey partagé ["agences"] ⇒ fetcher mappé obligatoire.
  const { data: agences = [] } = useQuery({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: () => apiFetch("/users/sync-logs"),
  });

  const { mutate: sendNotif, isPending: sending } = useMutation({
    mutationFn: ({ userId, message }: { userId: number; message: string }) =>
      apiFetch(`/notifications/direct/${userId}`, {
        method: "POST",
        body: JSON.stringify({ title: "Message admin", body: message }),
      }),
    onSuccess: () => {
      setNotifDialog(null);
      setNotifMsg("");
      qc.invalidateQueries({ queryKey: ["mobile-fleet"] });
    },
  });

  const { mutate: toggleUser } = useMutation({
    mutationFn: ({ userId, active }: { userId: number; active: boolean }) =>
      apiFetch(`/users/${userId}`, { method: "PUT", body: JSON.stringify({ isActive: active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile-fleet"] }),
  });

  const users: any[] = fleet;
  const filtered = users.filter((u) => {
    // Un CAF multi-agences est affecté à plusieurs agences (agence_ids via
    // caf_assignments) en plus de son agence principale (agence_id) — le
    // filtre doit matcher n'importe laquelle, sinon certaines agences
    // paraissent vides alors qu'elles ont bien des agents.
    if (agenceFilter) {
      const ids = [u.agence_id, ...((u.agence_ids as any[]) ?? [])].filter((x) => x != null).map(String);
      if (!ids.includes(agenceFilter)) return false;
    }
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const online = users.filter((u) => {
    const activity = lastActivity(u);
    if (!activity) return false;
    return (Date.now() - new Date(activity).getTime()) / 60000 < 60;
  }).length;

  // Même logique d'affichage agence que l'onglet Performance (voir plus haut).
  const agenceNameById = new Map((agences as any[]).map((a: any) => [String(a.id), a.name]));
  const displayAgence = (u: any): string => {
    if (agenceFilter) return agenceNameById.get(agenceFilter) ?? (u.agence_name ?? "—");
    const extra = ((u.agence_ids as any[]) ?? []).filter((id) => id != null && String(id) !== String(u.agence_id)).length;
    return `${u.agence_name ?? "—"}${extra > 0 ? ` (+${extra})` : ""}`;
  };

  const totalCapturesToday = users.reduce((s: number, u: any) => s + (u.locations_24h ?? 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" spacing={1}>
          <Chip
            icon={<Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", ml: "8px !important" }} />}
            label={`${online} en ligne`}
            sx={{ background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}
          />
          <Tooltip title="Actualiser (auto 30s)">
            <IconButton onClick={() => refetch()} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* KPI */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 3 }}>
        {[
          { label: "Agents actifs", value: users.filter((u) => u.is_active).length, color: "#16a34a", icon: <WifiIcon /> },
          { label: "En ligne (1h)", value: online, color: GOLD, icon: <PhoneAndroidIcon /> },
          { label: "Captures aujourd'hui", value: totalCapturesToday, color: STEEL, icon: <LocationOnIcon /> },
          { label: "Bloqués", value: users.filter((u) => !u.is_active).length, color: "#dc2626", icon: <BlockIcon /> },
        ].map(({ label, value, color, icon }) => (
          <Card key={label} sx={{ border: `1px solid ${color}30` }}>
            <CardContent sx={{ pb: "16px !important" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontSize={11} fontWeight={700} color="text.secondary" textTransform="uppercase">{label}</Typography>
                  <Typography fontSize={28} fontWeight={800} color={color}>{value}</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Sync logs summary */}
      {syncLogs.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <HistoryIcon sx={{ color: STEEL }} />
            <Typography fontWeight={700} color="var(--text-primary)">Synchronisations récentes</Typography>
          </Stack>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "var(--bg-surface-alt)" }}>
                  {["Date", "Réussies", "Échouées", "Action", "Ignorées"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 11 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {syncLogs.slice(0, 5).map((log: any) => (
                  <TableRow key={log.id} hover>
                    <TableCell><Typography fontSize={12}>{new Date(log.logged_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</Typography></TableCell>
                    <TableCell><Typography fontWeight={700} color="#16a34a">{log.succeeded}</Typography></TableCell>
                    <TableCell><Typography fontWeight={700} color={log.failed > 0 ? "#dc2626" : "text.disabled"}>{log.failed}</Typography></TableCell>
                    <TableCell><Chip label={log.action ?? "sync"} size="small" /></TableCell>
                    <TableCell><Typography fontSize={12}>{log.dropped ?? 0}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterListIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Agence</InputLabel>
            <Select value={agenceFilter} label="Agence" onChange={(e) => setAgenceFilter(e.target.value)}>
              <MenuItem value="">Toutes</MenuItem>
              {(agences as any[]).map((a: any) => <MenuItem key={a.id} value={String(a.id)}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Recherche agent" value={search} onChange={(e) => setSearch(e.target.value)} />
          {isLoading && <SyncIcon sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { "100%": { transform: "rotate(360deg)" } } }} />}
          <Typography fontSize={13} color="text.secondary">{filtered.length} agents</Typography>
        </Stack>
      </Paper>

      {/* Fleet table */}
      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ background: NAVY, p: 2 }}>
          <Typography fontWeight={700} color="white">Tableau de bord flotte mobile</Typography>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: "#f8fafc" }}>
                {["Agent", "Rôle", "Agence", "Statut app", "Auj.", "7j", "Dernière activité", "Actif", "Actions"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>{isLoading ? "Chargement…" : "Aucun agent"}</TableCell></TableRow>
              )}
              {filtered.map((u: any) => {
                const activity = lastActivity(u);
                const mins = activity ? (Date.now() - new Date(activity).getTime()) / 60000 : Infinity;
                const appStatus = mins < 60
                  ? { label: "En ligne", color: "#16a34a", Icon: WifiIcon }
                  : mins < 480
                  ? { label: "Récent", color: "#d97706", Icon: WifiIcon }
                  : { label: "Hors ligne", color: "#94a3b8", Icon: WifiOffIcon };
                const Icon = appStatus.Icon;
                return (
                  <TableRow key={u.id} hover sx={{ opacity: u.is_active ? 1 : 0.5 }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                          badgeContent={<Box sx={{ width: 8, height: 8, borderRadius: "50%", background: appStatus.color, border: "2px solid white" }} />}
                        >
                          <Avatar sx={{ width: 30, height: 30, fontSize: 12, background: STEEL }}>{u.name?.[0]}</Avatar>
                        </Badge>
                        <Box>
                          <Typography fontSize={13} fontWeight={600}>{u.name}</Typography>
                          <Typography fontSize={11} color="text.secondary">@{u.username}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Chip label={u.role_name ?? "?"} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                    <TableCell><Typography fontSize={12}>{displayAgence(u)}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        icon={<Icon sx={{ fontSize: "14px !important", color: `${appStatus.color} !important` }} />}
                        label={appStatus.label}
                        size="small"
                        sx={{ background: `${appStatus.color}20`, color: appStatus.color, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell><Typography fontWeight={700} color={u.locations_24h > 0 ? GOLD : "text.disabled"}>{u.locations_24h ?? 0}</Typography></TableCell>
                    <TableCell><Typography fontWeight={600}>{u.locations_7d ?? 0}</Typography></TableCell>
                    {/* Colonne "Dernière activité" : la plus récente entre capture GPS et requête app */}
                    <TableCell><Typography fontSize={11} color="text.secondary" whiteSpace="nowrap">{minutesAgo(activity)}</Typography></TableCell>
                    <TableCell>
                      <Tooltip title={u.is_active ? "Bloquer cet agent" : "Réactiver"}>
                        <Switch
                          checked={u.is_active}
                          onChange={(e) => toggleUser({ userId: u.id, active: e.target.checked })}
                          size="small"
                          sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: GOLD }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { background: GOLD } }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Envoyer une notification">
                        <IconButton size="small" onClick={() => setNotifDialog(u)}>
                          <NotificationsActiveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Send notification dialog */}
      <Dialog open={!!notifDialog} onClose={() => setNotifDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotificationsActiveIcon />
            <span>Notification → {notifDialog?.name}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Message" value={notifMsg}
            onChange={(e) => setNotifMsg(e.target.value)} sx={{ mt: 1 }} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifDialog(null)}>Annuler</Button>
          <Button variant="contained" onClick={() => sendNotif({ userId: notifDialog.id, message: notifMsg })}
            disabled={!notifMsg.trim() || sending} sx={{ background: NAVY }}>
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
// Vue réutilisable : rendue en page plein écran (défaut) ou intégrée sans son
// en-tête sombre dans la page « Analytics & Rapports » (embedded).
export function AgentsTerrainView({ embedded = false }: { embedded?: boolean }) {
  const [mainTab, setMainTab] = useState(0);

  return (
    <Box>
      {/* Header (masqué lorsqu'intégré dans la page Analytics) */}
      {!embedded && (
        <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <GroupsIcon sx={{ color: GOLD, fontSize: 30 }} />
            <Box>
              <Typography variant="h5" fontWeight={800} color="white">Agents terrain</Typography>
              <Typography fontSize={13} sx={{ color: "rgba(255,255,255,0.6)" }}>Performance, suivi d&apos;activité et gestion de la flotte mobile</Typography>
            </Box>
          </Stack>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", px: 3 }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}
          sx={{ "& .MuiTab-root": { fontWeight: 600, fontSize: 13, textTransform: "none", minHeight: 48 }, "& .Mui-selected": { color: GOLD }, "& .MuiTabs-indicator": { background: GOLD } }}>
          <Tab icon={<GroupsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Performance équipe" />
          <Tab icon={<PhoneAndroidIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Flotte mobile" />
        </Tabs>
      </Box>

      {mainTab === 0 && <PerformanceTab />}
      {mainTab === 1 && <FleetTab />}
    </Box>
  );
}
