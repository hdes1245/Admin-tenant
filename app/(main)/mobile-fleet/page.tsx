"use client";

import { useState } from "react";
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, Avatar, Alert, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Tooltip, Badge, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SyncIcon from "@mui/icons-material/Sync";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import LockResetIcon from "@mui/icons-material/LockReset";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterListIcon from "@mui/icons-material/FilterList";
import HistoryIcon from "@mui/icons-material/History";
import BlockIcon from "@mui/icons-material/Block";
import InfoIcon from "@mui/icons-material/Info";

import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD = "#3C8047";

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

export default function MobileFleetPage() {
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

  // queryKey partagé ["agences"] avec les autres pages ⇒ fetcher mappé
  // obligatoire (fetchAgences), sinon empoisonnement du cache React Query
  // avec la forme brute {COD_AGENCE, NOM_AGENCE}.
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
    // Multi-agences : matcher l'agence principale OU une affectation caf_assignments.
    if (agenceFilter) {
      const ids = [u.agence_id, ...((u.agence_ids as any[]) ?? [])].filter((x: any) => x != null).map(String);
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

  const totalCapturesToday = users.reduce((s: number, u: any) => s + (u.locations_24h ?? 0), 0);

  // Libellé agence : quand un filtre est actif, montrer l'agence filtrée
  // (l'affectation qui justifie la présence de l'agent), pas son agence
  // principale — cohérence multi-agences avec la page Agents terrain.
  const agenceNameById = new Map((agences as any[]).map((a: any) => [String(a.id), a.name]));
  const displayAgence = (u: any): string => {
    if (agenceFilter) return agenceNameById.get(agenceFilter) ?? (u.agence_name ?? "—");
    const extra = ((u.agence_ids as any[]) ?? []).filter((id: any) => id != null && String(id) !== String(u.agence_id)).length;
    return `${u.agence_name ?? "—"}${extra > 0 ? ` (+${extra})` : ""}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PhoneAndroidIcon sx={{ color: GOLD, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={800} color="var(--text-primary)">Flotte Mobile</Typography>
            <Typography fontSize={13} color="text.secondary">Gestion et supervision des appareils SiteCheck terrain</Typography>
          </Box>
        </Stack>
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
            <Typography fontWeight={700} color="var(--text-primary)">Historique synchronisations récentes</Typography>
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
              {agences.map((a: any) => <MenuItem key={a.id} value={String(a.id)}>{a.name}</MenuItem>)}
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
                // Statut/activité basés sur la plus récente activité authentifiée
                // (requête app OU capture GPS) — un agent connecté sans capture
                // récente reste "en ligne".
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
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Envoyer une notification">
                          <IconButton size="small" onClick={() => setNotifDialog(u)}>
                            <NotificationsActiveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
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
            <span>Envoyer une notification à {notifDialog?.name}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Message"
            value={notifMsg}
            onChange={(e) => setNotifMsg(e.target.value)}
            sx={{ mt: 1 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifDialog(null)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => sendNotif({ userId: notifDialog.id, message: notifMsg })}
            disabled={!notifMsg.trim() || sending}
            sx={{ background: NAVY }}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
