"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Container, Grid, Typography, Card, CardContent, Chip,
  Avatar, Divider, IconButton, Tooltip, Stack, Paper, ToggleButton,
  ToggleButtonGroup, Badge, LinearProgress, Snackbar, Collapse, Alert,
} from "@mui/material";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart,
} from "recharts";
import BusinessIcon           from "@mui/icons-material/Business";
import PeopleAltIcon          from "@mui/icons-material/PeopleAlt";
import PersonPinCircleIcon    from "@mui/icons-material/PersonPinCircle";
import LocationOnIcon         from "@mui/icons-material/LocationOn";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import TrendingDownIcon       from "@mui/icons-material/TrendingDown";
import AccessTimeIcon         from "@mui/icons-material/AccessTime";
import RefreshIcon            from "@mui/icons-material/Refresh";
import PictureAsPdfIcon       from "@mui/icons-material/PictureAsPdf";
import FilterAltIcon          from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon       from "@mui/icons-material/FilterAltOff";
import AutorenewIcon          from "@mui/icons-material/Autorenew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import GroupsIcon             from "@mui/icons-material/Groups";
import WarningAmberIcon       from "@mui/icons-material/WarningAmber";
import ManageAccountsIcon     from "@mui/icons-material/ManageAccounts";
import MapIcon                from "@mui/icons-material/Map";
import NotificationsIcon      from "@mui/icons-material/Notifications";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { motion }          from "framer-motion";
import {
  fetchTenantDashboardStats, fetchDashboardCharts, fetchRecentActivityLogs,
  TenantDashboardStats, DashboardCharts, ActivityLogItem,
} from "@/lib/dashboard";
import { fetchAgences }      from "@/lib/agences";
import { fetchAgencesStats } from "@/lib/agences";
import { fetchAgencesUsersSummary } from "@/lib/agences";
import type { PdfReportData } from "@/lib/dashboardPdf";
import AlertsPanel           from "@/components/AlertsPanel";
import { KpiInfoIcon }       from "@/components/KpiInfoIcon";
import {
  loadThresholds, computeTriggeredAlerts,
  AlertThreshold,
} from "@/lib/alertsConfig";

// ─── Palette ────────────────────────────────────────────────────────────────
const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";
const PIE_COLORS = [NAVY, STEEL, GOLD, "#059669", "#DC2626", "#D97706", "#7c3aed"];

// ─── Countdown isolé — ne re-render que lui-même, pas le dashboard ──────────
const RefreshCountdown = memo(function RefreshCountdown({
  interval, onTick,
}: { interval: number; onTick: () => void }) {
  const [count, setCount] = useState(interval);
  useEffect(() => {
    if (interval <= 0) return;
    setCount(interval);
    const autoId  = setInterval(() => { onTick(); setCount(interval); }, interval * 1000);
    const tickId  = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(autoId); clearInterval(tickId); };
  }, [interval, onTick]);
  if (interval <= 0 || count <= 0) return null;
  return <> — prochain dans {count}s</>;
});

// ─── Period options ─────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { label: "7j",  value: 7  },
  { label: "15j", value: 15 },
  { label: "30j", value: 30 },
  { label: "90j", value: 90 },
];

// ─── Auto-refresh options ───────────────────────────────────────────────────
const REFRESH_OPTIONS = [
  { label: "Off",   value: 0     },
  { label: "30 s",  value: 30    },
  { label: "1 min", value: 60    },
  { label: "5 min", value: 300   },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function actionColor(action: string): string {
  const m: Record<string, string> = {
    LOGIN: "#059669", LOGOUT: "#6B7280", CREATE: "#1B4F72",
    UPDATE: "#D97706", DELETE: "#DC2626", VIEW: "#7c3aed",
  };
  return m[action?.toUpperCase()] ?? "#0D1B2A";
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé",
  };
  return m[s] ?? s;
}

// ─── KPI card config ─────────────────────────────────────────────────────────
const KPI_CARDS = [
  { key: "agences",   label: "Agences",   subtitle: "Agences actives",
    info: "Nombre total d'agences actives dans ce tenant.",
    icon: <BusinessIcon sx={{ fontSize: 26 }} />,
    gradient: `linear-gradient(135deg,${NAVY} 0%,${STEEL} 100%)`, light: "#EFF6FF" },
  { key: "cafs",      label: "CAFs",      subtitle: "Agents de terrain",
    info: "Nombre total de chargés d'affaires (agents de terrain) rattachés à ce tenant.",
    icon: <PeopleAltIcon sx={{ fontSize: 26 }} />,
    gradient: `linear-gradient(135deg,${STEEL} 0%,#164C73 100%)`, light: "#EFF6FF" },
  { key: "clients",   label: "Clients",   subtitle: "Portefeuille clients",
    info: "Nombre total de clients dans le portefeuille de ce tenant.",
    icon: <PersonPinCircleIcon sx={{ fontSize: 26 }} />,
    gradient: `linear-gradient(135deg,${GOLD} 0%,#A07820 100%)`, light: "#FFFBEB" },
  { key: "locations", label: "Localisations", subtitle: "GPS capturées",
    info: "Nombre total de positions GPS capturées lors des visites terrain.",
    icon: <LocationOnIcon sx={{ fontSize: 26 }} />,
    gradient: `linear-gradient(135deg,#059669 0%,#047857 100%)`, light: "#ECFDF5" },
];

// ─── Main page ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router     = useRouter();
  const qc         = useQueryClient();

  // Period — persisté en sessionStorage pour survivre à une navigation entre
  // pages sans être conservé entre deux sessions distinctes (fermeture du
  // navigateur/onglet). Démarre toujours à la valeur par défaut côté rendu
  // initial (serveur et client) pour éviter un mismatch d'hydratation, puis
  // se réaligne sur la valeur sauvegardée juste après montage.
  const [days, setDays] = useState(30);
  useEffect(() => {
    const saved = sessionStorage.getItem('dashboard_days');
    if (saved) setDays(Number(saved));
  }, []);
  useEffect(() => { sessionStorage.setItem('dashboard_days', String(days)); }, [days]);

  // Auto-refresh — même principe de persistance par session.
  const [refreshInterval, setRefreshInterval] = useState(0);
  useEffect(() => {
    const saved = sessionStorage.getItem('dashboard_refresh_interval');
    if (saved) setRefreshInterval(Number(saved));
  }, []);
  useEffect(() => { sessionStorage.setItem('dashboard_refresh_interval', String(refreshInterval)); }, [refreshInterval]);

  // Initialisé à null pour éviter l'erreur d'hydratation (heure serveur ≠ heure client)
  const [lastRefresh, setLastRefresh]         = useState<Date | null>(null);
  useEffect(() => { setLastRefresh(new Date()); }, []);

  // Drill-down filters
  const [drillAction, setDrillAction] = useState<string | null>(null);
  const [drillStatus, setDrillStatus] = useState<string | null>(null);

  // PDF loading state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [snack, setSnack]           = useState("");

  // Alerts
  const [thresholds, setThresholds]         = useState<AlertThreshold[]>(() => loadThresholds());
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: kpis, isFetching: kpisFetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn:  fetchTenantDashboardStats,
    staleTime: 60_000,
  });
  const { data: charts, isFetching: chartsFetching } = useQuery({
    queryKey: ["dashboard-charts", days],
    queryFn:  () => fetchDashboardCharts(days),
    staleTime: 60_000,
  });
  const { data: logsData, isFetching: logsFetching } = useQuery({
    queryKey: ["dashboard-logs"],
    queryFn:  () => fetchRecentActivityLogs(50),
    staleTime: 30_000,
  });
  const { data: agencesRaw }  = useQuery({ queryKey: ["agences"],       queryFn: fetchAgences       });
  const { data: agenceStats } = useQuery({ queryKey: ["agences-stats"], queryFn: fetchAgencesStats  });
  const { data: usersSummary } = useQuery({ queryKey: ["agences-users-summary"], queryFn: fetchAgencesUsersSummary });

  const isLoading = kpisFetching || chartsFetching || logsFetching;

  // ─── Manual refresh ───────────────────────────────────────────────────────
  const doRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["dashboard-stats"]      });
    qc.invalidateQueries({ queryKey: ["dashboard-charts", days] });
    qc.invalidateQueries({ queryKey: ["dashboard-logs"]       });
    setLastRefresh(new Date());
  }, [qc, days]);

  const handleAutoRefreshTick = useCallback(() => {
    doRefresh();
    setLastRefresh(new Date());
  }, [doRefresh]);

  // TanStack Query re-fetches automatically when the queryKey [days] changes — no manual invalidation needed.

  // ─── Drill-down filtered logs ─────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const logs = logsData?.logs ?? [];
    if (!drillAction && !drillStatus) return logs;
    return logs.filter((l) => {
      if (drillAction && l.action?.toUpperCase() !== drillAction.toUpperCase()) return false;
      return true;
    });
  }, [logsData, drillAction, drillStatus]);

  const hasDrill = !!drillAction || !!drillStatus;

  // ─── PDF export ───────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      const agencesMap = new Map<number, string>();
      (agencesRaw ?? []).forEach((a) => agencesMap.set(a.id, a.name));

      const enrichedStats = (agenceStats ?? []).map((s) => ({
        agenceId: s.agenceId,
        name:     agencesMap.get(s.agenceId) ?? `Agence ${s.agenceId}`,
        code:     (agencesRaw ?? []).find((a) => a.id === s.agenceId)?.code ?? "—",
        zoneName: (agencesRaw ?? []).find((a) => a.id === s.agenceId)?.zoneName ?? null,
        nbClients: s.nbClients,
        nbCafs:    s.nbCafs,
        nbUsers:   s.nbUsers,
      }));

      const reportData: PdfReportData = {
        tenantName:      "GeoTrust Tenant",
        period:          `${days} derniers jours`,
        kpis:            kpis ?? { agences: 0, cafs: 0, clients: 0, locations: 0 },
        agenceStats:     enrichedStats,
        ticketsByStatus: charts?.ticketsByStatus ?? [],
        clientsByAgency: (charts?.clientsByAgency ?? []).map((c) => ({
          agence:        c.agence,
          total_clients: c.total_clients,
        })),
        recentLogs: (logsData?.logs ?? []).map((l) => ({
          action:      l.action,
          description: l.description,
          created_at:  l.created_at,
          userName:    l.user?.name ?? l.user?.username,
        })),
        activityByDay:   charts?.activityByDay ?? [],
        derivedKpis: {
          tauxResolution: derived.tauxResolution,
          moyenneClients: derived.moyenneClients,
          agencesSansCaf: derived.agencesSansCaf,
          totalUsers:     derived.totalUsers,
          tendance:       derived.tendance,
        },
        agencesByZone:     derived.agencesByZone,
        cafsByAgence:      derived.cafsByAgence,
        ticketBreakdown:   derived.ticketBreakdown,
        activityByAction:  charts?.activityByAction ?? [],
      };

      const { generateDashboardPdf } = await import("@/lib/dashboardPdf");
      generateDashboardPdf(reportData);
      setSnack("PDF généré avec succès !");
    } catch (err: any) {
      setSnack(`Erreur PDF : ${err?.message ?? "inconnue"}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const stats:   TenantDashboardStats = kpis   ?? { agences: 0, cafs: 0, clients: 0, locations: 0 };
  const cData:   DashboardCharts      = charts ?? { clientsByAgency: [], ticketsByStatus: [], activityByDay: [], activityByAction: [] };

  const derived = useMemo(() => {
    const allStats   = agenceStats  ?? [];
    const allAgences = agencesRaw   ?? [];
    const tickets    = cData.ticketsByStatus;

    const totalTickets    = tickets.reduce((a, t) => a + t.count, 0);
    const resolvedTickets = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).reduce((a, t) => a + t.count, 0);
    const tauxResolution  = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
    const moyenneClients  = stats.agences > 0 ? Math.round(stats.clients / stats.agences) : 0;
    const agencesSansCaf  = allStats.filter((s) => s.nbCafs === 0).length;
    // Comptage distinct (un agent peut être rattaché à plusieurs agences)
    const totalUsers      = usersSummary?.totalDistinctUsers ?? allStats.reduce((a, s) => a + s.nbUsers, 0);

    // CAFs + utilisateurs par agence (grouped bar)
    const cafsByAgence = allStats
      .map((s) => {
        const found = allAgences.find((a) => a.id === s.agenceId);
        const label =
          (found?.code ? found.code : null) ??
          found?.name?.replace(/^CREDAFRICA\s*-\s*/i, "") ??
          `Ag.${s.agenceId}`;
        return {
          agence: label,
          CAFs: s.nbCafs,
          Utilisateurs: s.nbUsers,
          Clients: s.nbClients,
        };
      })
      .sort((a, b) => b.CAFs - a.CAFs)
      .slice(0, 10);

    // Agences par zone (pie)
    const zoneMap = new Map<string, number>();
    allAgences.forEach((a) => {
      const z = a.zoneName ?? "Sans zone";
      zoneMap.set(z, (zoneMap.get(z) ?? 0) + 1);
    });
    const agencesByZone = Array.from(zoneMap.entries())
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count);

    // Ticket breakdown with %
    const ticketBreakdown = tickets.map((t) => ({
      status: statusLabel(t.status),
      raw:    t.status,
      count:  t.count,
      pct:    totalTickets > 0 ? Math.round((t.count / totalTickets) * 100) : 0,
    }));

    // Tendance: compare première moitié vs seconde moitié de la période
    const daysData  = cData.activityByDay;
    const half      = Math.floor(daysData.length / 2);
    const firstSum  = daysData.slice(0, half).reduce((a, d) => a + d.count, 0);
    const secondSum = daysData.slice(half).reduce((a, d) => a + d.count, 0);
    const tendance  = firstSum > 0 ? Math.round(((secondSum - firstSum) / firstSum) * 100) : 0;

    // Activité cumulée (pour LineChart comparaison)
    const activityComparison = daysData.map((d, i) => ({
      date:    d.date.slice(5),
      actuel:  d.count,
      moy:     Math.round(daysData.slice(0, i + 1).reduce((a, x) => a + x.count, 0) / (i + 1)),
    }));

    return { tauxResolution, moyenneClients, agencesSansCaf, totalUsers, cafsByAgence, agencesByZone, ticketBreakdown, tendance, totalTickets, activityComparison };
  }, [agenceStats, agencesRaw, cData, stats, usersSummary]);

  // ─── Triggered alerts ─────────────────────────────────────────────────────
  const triggeredAlerts = useMemo(() => computeTriggeredAlerts(thresholds, {
    tauxResolution: derived.tauxResolution,
    agencesSansCaf: derived.agencesSansCaf,
    tendance:       derived.tendance,
    totalTickets:   derived.totalTickets,
    clients:        stats.clients,
    cafs:           stats.cafs,
    locations:      stats.locations,
  }), [thresholds, derived, stats]);

  const visibleAlerts = triggeredAlerts.filter((a) => !dismissedAlerts.has(a.id));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Linear progress on fetch */}
      {isLoading && (
        <LinearProgress sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000,
          "& .MuiLinearProgress-bar": { background: GOLD } }} />
      )}

      {/* HEADER — liquid glass sur le fond navy d'origine : capsules dépolies
          claires posées sur le dégradé navy/steel, plutôt qu'un bandeau plat. */}
      <Box sx={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg,${NAVY} 0%,${STEEL} 100%)`,
        px: 4, py: 2.75, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
        borderBottom: `1px solid rgba(196,154,46,0.4)`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
      }}>
        {/* Taches de couleur douces, floutées — donnent la profondeur du verre */}
        <Box sx={{ position: "absolute", top: -60, left: "8%", width: 220, height: 220, borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}33 0%, transparent 70%)`, filter: "blur(30px)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", bottom: -80, right: "12%", width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)", filter: "blur(35px)", pointerEvents: "none" }} />

        <Box sx={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          width: 44, height: 44, borderRadius: "14px",
          background: `linear-gradient(135deg, ${GOLD} 0%, #A9832A 100%)`,
          boxShadow: "0 4px 14px rgba(196,154,46,0.35)",
        }}>
          <TrendingUpIcon sx={{ color: "white", fontSize: 24 }} />
        </Box>
        <Box sx={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={800} color="white" letterSpacing="-0.02em">Tableau de bord</Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.6)">
            Dernière actualisation : {lastRefresh ? lastRefresh.toLocaleTimeString("fr-FR") : "—"}
            <RefreshCountdown interval={refreshInterval} onTick={handleAutoRefreshTick} />
          </Typography>
        </Box>

        {/* Period selector — capsule verre clair */}
        <ToggleButtonGroup
          value={days} exclusive size="small"
          onChange={(_, v) => { if (v) setDays(v); }}
          sx={{
            position: "relative", p: 0.4, borderRadius: 999,
            background: "rgba(255,255,255,0.14)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.15)",
            "& .MuiToggleButton-root": {
              color: "rgba(255,255,255,0.75)", border: "none", borderRadius: "999px !important",
              px: 1.6, py: 0.5, fontWeight: 600, fontSize: "0.78rem",
              transition: "all .2s ease",
              "&:hover": { background: "rgba(255,255,255,0.1)" },
              "&.Mui-selected": {
                background: `linear-gradient(180deg, ${GOLD} 0%, #A9832A 100%)`,
                color: "white", fontWeight: 700,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(196,154,46,0.4)",
                "&:hover": { background: `linear-gradient(180deg, ${GOLD} 0%, #A9832A 100%)` },
              },
            },
          }}>
          {PERIOD_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Auto-refresh toggle — capsule verre sur navy */}
        <Box display="flex" alignItems="center" gap={0.5}
          sx={{
            position: "relative", borderRadius: 999, pl: 1.1, pr: 0.4, py: 0.4,
            background: "rgba(255,255,255,0.14)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.15)",
          }}>
          <AutorenewIcon sx={{ fontSize: 14, color: GOLD, mr: 0.4 }} />
          <ToggleButtonGroup
            value={refreshInterval} exclusive size="small"
            onChange={(_, v) => { if (v !== null) setRefreshInterval(v); }}
            sx={{ "& .MuiToggleButton-root": {
              color: "rgba(255,255,255,0.65)", border: "none", borderRadius: "999px !important",
              px: 1.1, py: 0.35, fontSize: "0.72rem", lineHeight: 1.4, fontWeight: 600,
              transition: "all .2s ease",
              "&:hover": { background: "rgba(255,255,255,0.1)" },
              "&.Mui-selected": {
                background: `linear-gradient(180deg, ${GOLD} 0%, #A9832A 100%)`,
                color: "white", fontWeight: 700,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(196,154,46,0.4)",
              },
            }}}>
            {REFRESH_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Alerts bell — always visible, bouton verre circulaire sur navy */}
        <Tooltip title={triggeredAlerts.length > 0 ? `${triggeredAlerts.length} alerte(s) active(s) — cliquer pour configurer` : "Alertes & seuils KPI"}>
          <IconButton onClick={() => setAlertsPanelOpen(true)}
            sx={{
              position: "relative",
              color: triggeredAlerts.length > 0 ? "#FCA5A5" : "rgba(255,255,255,0.85)",
              background: triggeredAlerts.length > 0 ? "rgba(252,165,165,0.12)" : "rgba(255,255,255,0.14)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: `1px solid ${triggeredAlerts.length > 0 ? "rgba(252,165,165,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: "999px", p: 1,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(0,0,0,0.15)",
              transition: "all .2s ease",
              "&:hover": { background: "rgba(255,255,255,0.2)", transform: "translateY(-1px)" },
              animation: triggeredAlerts.length > 0 ? "kpiBell 1.8s infinite" : "none",
              "@keyframes kpiBell": {
                "0%, 100%": { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 0 rgba(252,165,165,0)" },
                "50%":      { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 6px rgba(252,165,165,0.22)" },
              },
            }}>
            <Badge badgeContent={triggeredAlerts.length || null} color="error" max={9}>
              {triggeredAlerts.length > 0
                ? <NotificationsActiveIcon sx={{ fontSize: 20 }} />
                : <NotificationsIcon sx={{ fontSize: 20 }} />}
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Manual refresh — bouton verre circulaire sur navy, accent or */}
        <Tooltip title="Actualiser maintenant">
          <span>
            <IconButton onClick={doRefresh} disabled={isLoading}
              sx={{
                position: "relative",
                color: GOLD,
                background: "rgba(196,154,46,0.14)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid rgba(196,154,46,0.4)`,
                borderRadius: "999px", p: 1,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.18)",
                transition: "all .2s ease",
                "&:hover": { background: "rgba(196,154,46,0.24)", transform: "translateY(-1px) rotate(90deg)" },
                "&.Mui-disabled": { color: "rgba(196,154,46,0.4)", borderColor: "rgba(196,154,46,0.2)" },
              }}>
              <Badge color="warning" variant="dot" invisible={!refreshInterval}>
                <RefreshIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>

        {/* Export PDF — bouton verre circulaire sur navy, plein or au survol */}
        <Tooltip title="Exporter le rapport PDF">
          <span>
            <IconButton onClick={handleExportPdf} disabled={pdfLoading || isLoading}
              sx={{
                position: "relative",
                color: "white",
                background: "rgba(196,154,46,0.16)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid rgba(196,154,46,0.45)`,
                borderRadius: "999px", p: 1,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.18)",
                transition: "all .2s ease",
                "&:hover": {
                  background: `linear-gradient(180deg, ${GOLD} 0%, #A9832A 100%)`,
                  color: NAVY, transform: "translateY(-1px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 16px rgba(196,154,46,0.5)",
                },
                "&.Mui-disabled": { color: "rgba(255,255,255,0.35)", borderColor: "rgba(196,154,46,0.2)" },
              }}>
              <PictureAsPdfIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* ─── ALERT BANNERS ─────────────────────────────────────────── */}
        {visibleAlerts.length > 0 && (
          <Box mb={2.5}>
            <Stack gap={1}>
              {visibleAlerts.map((alert) => (
                <Collapse key={alert.id} in={!dismissedAlerts.has(alert.id)}>
                  <Alert
                    severity={alert.severity === "critical" ? "error" : "warning"}
                    onClose={() => setDismissedAlerts((prev) => new Set([...prev, alert.id]))}
                    action={
                      <Chip
                        label="Configurer"
                        size="small"
                        onClick={() => setAlertsPanelOpen(true)}
                        sx={{ fontSize: 11, cursor: "pointer", mr: 1,
                          bgcolor: alert.severity === "critical" ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.12)",
                          color: alert.severity === "critical" ? "#991B1B" : "#92400E",
                          border: `0.5px solid ${alert.severity === "critical" ? "#FECACA" : "#FDE68A"}`,
                        }}
                      />
                    }
                    sx={{ borderRadius: 2, alignItems: "center",
                      bgcolor: alert.severity === "critical" ? "#FEF2F2" : "#FFFBEB",
                      border: `1px solid ${alert.severity === "critical" ? "#FECACA" : "#FDE68A"}`,
                      "& .MuiAlert-icon": { color: alert.severity === "critical" ? "#DC2626" : "#D97706" },
                    }}
                  >
                    <Typography fontSize={13} fontWeight={500}
                      color={alert.severity === "critical" ? "#991B1B" : "#92400E"}>
                      {alert.message}
                    </Typography>
                  </Alert>
                </Collapse>
              ))}
            </Stack>
          </Box>
        )}

        {/* ─── KPI TILES ─────────────────────────────────────────────── */}
        <Grid container spacing={2.5} mb={3}>
          {KPI_CARDS.map((card, i) => (
            <Grid item xs={12} sm={6} lg={3} key={card.key}>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card sx={{ background: card.gradient, borderRadius: 2, position: "relative", overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
                  <Box sx={{ position: "absolute", right: -20, top: -20, width: 100, height: 100,
                    borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                  {card.info && <KpiInfoIcon text={card.info} color="rgba(255,255,255,0.9)" />}
                  <CardContent sx={{ p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.88)", textTransform: "uppercase",
                          letterSpacing: 1, fontSize: "0.68rem", fontWeight: 500 }}>{card.subtitle}</Typography>
                        <Typography variant="h4" fontWeight={800} color="white" lineHeight={1.1} mt={0.3}>
                          {(stats as any)[card.key]?.toLocaleString() ?? "—"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.82)", fontWeight: 400 }} mt={0.5}>{card.label}</Typography>
                      </Box>
                      <Avatar sx={{ background: "rgba(255,255,255,0.13)", width: 46, height: 46, color: "white" }}>
                        {card.icon}
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* ─── KPI ROW 2: Métriques dérivées ─────────────────────────── */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Taux de résolution",  value: `${derived.tauxResolution}%`,
              sub: "tickets résolus + fermés",
              info: "Pourcentage de tickets au statut Résolu ou Fermé sur l'ensemble des tickets de la période.",
              icon: <CheckCircleOutlineIcon sx={{ fontSize: 24 }} />,
              bg: derived.tauxResolution >= 70 ? "linear-gradient(135deg,#065F46 0%,#059669 100%)"
                : derived.tauxResolution >= 40 ? "linear-gradient(135deg,#92400E 0%,#D97706 100%)"
                : "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)" },
            { label: "Moy. clients/agence", value: derived.moyenneClients.toLocaleString(),
              sub: "clients par agence en moyenne",
              info: "Nombre moyen de clients par agence (total clients divisé par nombre d'agences).",
              icon: <PersonPinCircleIcon sx={{ fontSize: 24 }} />,
              bg: `linear-gradient(135deg,${NAVY} 0%,${STEEL} 100%)` },
            { label: "Agences sans CAF",    value: String(derived.agencesSansCaf),
              sub: "agences sans agent terrain",
              info: "Nombre d'agences ne disposant d'aucun chargé d'affaires (CAF) rattaché.",
              icon: <WarningAmberIcon sx={{ fontSize: 24 }} />,
              bg: derived.agencesSansCaf > 0
                ? "linear-gradient(135deg,#78350F 0%,#D97706 100%)"
                : "linear-gradient(135deg,#064E3B 0%,#059669 100%)" },
            { label: "Utilisateurs terrain", value: derived.totalUsers.toLocaleString(),
              sub: "rattachés à une agence",
              info: "Nombre distinct d'utilisateurs rattachés à au moins une agence (un même agent rattaché à plusieurs agences n'est compté qu'une fois).",
              icon: <ManageAccountsIcon sx={{ fontSize: 24 }} />,
              bg: "linear-gradient(135deg,#3B0764 0%,#7c3aed 100%)" },
          ].map((k, i) => (
            <Grid item xs={6} md={3} key={k.label}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
                <Card sx={{ background: k.bg, borderRadius: 2, position: "relative", overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  <Box sx={{ position: "absolute", right: -16, top: -16, width: 80, height: 80,
                    borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                  {k.info && <KpiInfoIcon text={k.info} color="rgba(255,255,255,0.9)" />}
                  <CardContent sx={{ p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography sx={{ color: "rgba(255,255,255,0.88)", textTransform: "uppercase",
                          letterSpacing: 1, fontSize: "0.67rem", fontWeight: 500 }}>{k.label}</Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ color: "#fff", lineHeight: 1.1, mt: 0.3 }}>
                          {k.value}
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: "0.78rem", mt: 0.5, display: "block" }}>
                          {k.sub}
                        </Typography>
                      </Box>
                      <Avatar sx={{ background: "rgba(255,255,255,0.15)", width: 42, height: 42, color: "white" }}>
                        {k.icon}
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* ─── TENDANCE BANNER ─────────────────────────────────────────── */}
        {derived.tendance !== 0 && (
          <Paper sx={{ p: 1.5, mb: 2.5, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.5,
            background: derived.tendance > 0 ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)",
            border: `1px solid ${derived.tendance > 0 ? "#059669" : "#DC2626"}30` }}>
            {derived.tendance > 0
              ? <TrendingUpIcon sx={{ color: "#059669" }} />
              : <TrendingDownIcon sx={{ color: "#DC2626" }} />}
            <Typography variant="body2" fontWeight={600}
              sx={{ color: derived.tendance > 0 ? "#059669" : "#DC2626" }}>
              Tendance activité {derived.tendance > 0 ? "+" : ""}{derived.tendance}% sur la 2ème moitié de la période
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (comparaison première vs seconde moitié des {days} jours)
            </Typography>
          </Paper>
        )}

        {/* ─── CHARTS ROW 1: Activity by day + Tickets by status ─── */}
        <Grid container spacing={2.5} mb={2.5}>
          {/* Area chart: activité par jour */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography fontWeight={700} color={NAVY}>Activité / jour — {days} derniers jours</Typography>
                {drillAction && (
                  <Chip size="small" icon={<FilterAltIcon />} label={`Action: ${drillAction}`}
                    onDelete={() => setDrillAction(null)} color="warning" variant="outlined" />
                )}
              </Box>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={cData.activityByDay}
                  onClick={(e) => { /* clear drill on background click */ }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={STEEL} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={STEEL} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                    formatter={(v: any) => [v, "Événements"]}
                    labelFormatter={(l) => `Date : ${l}`}
                  />
                  <Area type="monotone" dataKey="count" name="Événements"
                    stroke={STEEL} fill="url(#grad)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: GOLD }} />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Pie chart: tickets par statut */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", height: "100%" }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography fontWeight={700} color={NAVY}>Tickets par statut</Typography>
                {drillStatus && (
                  <Chip size="small" icon={<FilterAltIcon />} label={`Statut: ${statusLabel(drillStatus)}`}
                    onDelete={() => setDrillStatus(null)} color="warning" variant="outlined" />
                )}
              </Box>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={cData.ticketsByStatus} dataKey="count" nameKey="status"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    onClick={(entry: any) => setDrillStatus((s) => s === entry.status ? null : entry.status)}
                    cursor="pointer">
                    {cData.ticketsByStatus.map((_, idx) => (
                      // stroke="none" : le trait blanc par défaut entre slices crée une
                      // fine encoche visible (façon "C") quand il n'y a qu'un seul statut
                      // — un cercle à 100% se retrouve avec un unique liseré au niveau
                      // de la jointure de départ/fin au lieu d'un anneau plein.
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="none"
                        opacity={drillStatus && drillStatus !== cData.ticketsByStatus[idx]?.status ? 0.35 : 1} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => statusLabel(v)} wrapperStyle={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(v, n) => [v, statusLabel(String(n))]} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* ─── CHARTS ROW 2: Clients by agency + Logs by action ─── */}
        <Grid container spacing={2.5} mb={2.5}>
          {/* Bar chart: clients par agence */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <Typography fontWeight={700} color={NAVY} mb={2}>Clients par agence (top 8)</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cData.clientsByAgency.slice(0, 8)} layout="vertical"
                  onClick={(e) => { if (e?.activeLabel) setDrillAction(null); }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="agence" tick={{ fontSize: 9 }} width={90}
                    tickFormatter={(v) => String(v).slice(0, 14)} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                    formatter={(v) => [v, "Clients"]}
                  />
                  <Bar dataKey="total_clients" name="Clients" radius={[0, 4, 4, 0]}>
                    {cData.clientsByAgency.slice(0, 8).map((_, idx) => (
                      <Cell key={idx} fill={idx % 2 === 0 ? NAVY : STEEL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Bar chart: logs par action */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <Typography fontWeight={700} color={NAVY} mb={2}>Événements par type d'action</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cData.activityByAction}
                  onClick={(e: any) => {
                    const act = e?.activePayload?.[0]?.payload?.action;
                    if (act) setDrillAction((d) => d === act ? null : act);
                  }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="action" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                    formatter={(v) => [v, "Logs"]}
                  />
                  <Bar dataKey="count" name="Logs" radius={[4, 4, 0, 0]} cursor="pointer">
                    {cData.activityByAction.map((entry, idx) => (
                      <Cell key={idx}
                        fill={drillAction === entry.action ? GOLD : actionColor(entry.action)}
                        opacity={drillAction && drillAction !== entry.action ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {drillAction && (
                <Box mt={1} display="flex" justifyContent="flex-end">
                  <Chip size="small" icon={<FilterAltOffIcon />} label="Effacer filtre"
                    onClick={() => setDrillAction(null)} variant="outlined"
                    sx={{ borderColor: GOLD, color: GOLD, cursor: "pointer" }} />
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* ─── CHARTS ROW 3: CAFs/Utilisateurs par agence + Zones ─── */}
        <Grid container spacing={2.5} mb={2.5}>
          {/* Grouped bar: CAFs + utilisateurs par agence */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <Typography fontWeight={700} color={NAVY} mb={0.5}>CAFs & Utilisateurs par agence</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Répartition des ressources humaines par agence
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={derived.cafsByAgence} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="agence" tick={{ fontSize: 9 }} />
                  {/* Échelle unique : les barres CAFs et Utilisateurs sont
                      directement comparables entre elles. Le nombre de clients
                      (échelle très différente) a son propre graphique dédié
                      « Clients par agence » ci-dessus. */}
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} label={{ value: "CAFs / Utilisateurs", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="CAFs" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Utilisateurs" fill={GOLD} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Pie: agences par zone */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", height: "100%" }}>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <MapIcon sx={{ color: STEEL, fontSize: 18 }} />
                <Typography fontWeight={700} color={NAVY}>Agences par zone</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                {(() => {
                  const realZones = derived.agencesByZone.filter((z) => z.zone !== "Sans zone").length;
                  return realZones > 0
                    ? `${realZones} zone${realZones !== 1 ? "s" : ""} identifiée${realZones !== 1 ? "s" : ""}`
                    : "Aucune zone créée";
                })()}
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={derived.agencesByZone} dataKey="count" nameKey="zone"
                    cx="50%" cy="50%" outerRadius={78} innerRadius={35} paddingAngle={2}>
                    {derived.agencesByZone.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => String(v).slice(0, 18)} wrapperStyle={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(v, n) => [v, String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* ─── CHARTS ROW 4: Résolution tickets + Tendance activité ─── */}
        <Grid container spacing={2.5} mb={2.5}>
          {/* Ticket resolution breakdown */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", height: "100%" }}>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <CheckCircleOutlineIcon sx={{ color: "#059669", fontSize: 18 }} />
                <Typography fontWeight={700} color={NAVY}>Résolution tickets détail</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                {derived.totalTickets} tickets au total — taux {derived.tauxResolution}%
              </Typography>
              <Stack spacing={1.5}>
                {derived.ticketBreakdown.map((t) => {
                  const tColor: Record<string, string> = { open: "#DC2626", "En cours": "#D97706", "Résolu": "#059669", "Fermé": NAVY };
                  const c = tColor[t.status] ?? STEEL;
                  return (
                    <Box key={t.status}>
                      <Box display="flex" justifyContent="space-between" mb={0.4}>
                        <Typography variant="caption" fontWeight={600} color={c}>{t.status}</Typography>
                        <Typography variant="caption" color="text.secondary">{t.count} ({t.pct}%)</Typography>
                      </Box>
                      <Box sx={{ height: 8, borderRadius: 4, background: "#F0F4F8", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", borderRadius: 4, background: c, width: `${t.pct}%`,
                          transition: "width 0.8s ease" }} />
                      </Box>
                    </Box>
                  );
                })}
                {derived.ticketBreakdown.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                    Aucun ticket enregistré
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* Line chart: activité vs moyenne mobile */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <Typography fontWeight={700} color={NAVY} mb={0.5}>Activité vs moyenne mobile</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Événements journaliers et tendance cumulée sur {days} jours
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={derived.activityComparison}>
                  <defs>
                    <linearGradient id="gradActuel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NAVY} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                    formatter={(v: any, n: any) => [v, n === "actuel" ? "Événements" : "Moy. mobile"]} />
                  <Legend wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => v === "actuel" ? "Événements / jour" : "Moyenne mobile"} />
                  <Area type="monotone" dataKey="actuel" fill="url(#gradActuel)" stroke={NAVY} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="moy" stroke={GOLD} strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* ─── ACTIVITY FEED ──────────────────────────────────────── */}
        <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <AccessTimeIcon sx={{ color: STEEL }} />
              <Typography fontWeight={700} color={NAVY}>Fil d'activité récente</Typography>
              {hasDrill && (
                <Chip size="small" color="warning" variant="outlined" icon={<FilterAltIcon />}
                  label={`Filtre actif${drillAction ? ` — ${drillAction}` : ""}${drillStatus ? ` — ${statusLabel(drillStatus)}` : ""}`}
                  onDelete={() => { setDrillAction(null); setDrillStatus(null); }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {filteredLogs.length} événement{filteredLogs.length !== 1 ? "s" : ""}
              {hasDrill ? " (filtrés)" : ""}
            </Typography>
          </Box>
          <Divider sx={{ mb: 1.5 }} />
          {filteredLogs.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={3}>Aucun événement à afficher.</Typography>
          ) : (
            <Stack spacing={0.5}>
              {filteredLogs.slice(0, 30).map((log) => (
                <Box key={log.id}
                  sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, px: 1.5,
                    borderRadius: 1, cursor: "pointer",
                    "&:hover": { background: "#F8FAFC" },
                    background: drillAction === log.action ? "rgba(196,154,46,0.06)" : "transparent",
                  }}
                  onClick={() => setDrillAction((d) => d === log.action ? null : log.action)}>
                  <Chip label={log.action} size="small"
                    sx={{ fontSize: "0.65rem", fontWeight: 700, minWidth: 64, textAlign: "center",
                      background: actionColor(log.action), color: "white" }} />
                  <Typography variant="body2" color="text.primary" sx={{ flex: 1, fontSize: "0.8rem" }}
                    noWrap>
                    {log.description ?? "—"}
                  </Typography>
                  {log.user && (
                    <Typography variant="caption" color={STEEL} sx={{ whiteSpace: "nowrap" }}>
                      {log.user.name ?? log.user.username ?? ""}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {fmtDate(log.created_at)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Container>

      {/* Snackbar PDF */}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        message={snack} />

      {/* ─── Panneau alertes & seuils ───────────────────────────────── */}
      <AlertsPanel
        open={alertsPanelOpen}
        onClose={() => setAlertsPanelOpen(false)}
        thresholds={thresholds}
        triggeredAlerts={triggeredAlerts}
        onChange={(updated) => {
          setThresholds(updated);
          setDismissedAlerts(new Set());
        }}
      />

    </>
  );
}
