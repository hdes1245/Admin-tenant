"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Line, ComposedChart,
} from "recharts";
import {
  Bell, BellRing, Building2, CircleAlert, CircleCheck, Clock, FileDown, Filter, FilterX, Map as MapIcon,
  MapPin, MapPinned, RefreshCw, TrendingDown, TrendingUp, TriangleAlert, UserCog, Users, X,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchTenantDashboardStats, fetchDashboardCharts, fetchRecentActivityLogs,
  TenantDashboardStats, DashboardCharts,
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
import { Snackbar } from "@/components/ui/snackbar";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/ui/page-blocks";

// ─── Palette ────────────────────────────────────────────────────────────────
const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";
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
    LOGIN: "#059669", LOGOUT: "#6B7280", CREATE: "#1E6091",
    UPDATE: "#D97706", DELETE: "#DC2626", VIEW: "#7c3aed",
  };
  return m[action?.toUpperCase()] ?? "#0F3B5C";
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé",
  };
  return m[s] ?? s;
}

// ─── KPI card config ─────────────────────────────────────────────────────────
// Accent solide (pas de dégradé plein) : bordure + icône colorées sur une
// carte de fond neutre — plus sobre qu'un aplat saturé, surtout en mode nuit.
const KPI_CARDS = [
  { key: "agences",   label: "Agences",   subtitle: "Agences actives",
    info: "Nombre total d'agences actives dans ce tenant.",
    icon: <Building2 size={24} />,
    accent: NAVY },
  { key: "cafs",      label: "CAFs",      subtitle: "Agents de terrain",
    info: "Nombre total de chargés d'affaires (agents de terrain) rattachés à ce tenant.",
    icon: <Users size={24} />,
    accent: STEEL },
  { key: "clients",   label: "Clients",   subtitle: "Portefeuille clients",
    info: "Nombre total de clients dans le portefeuille de ce tenant.",
    icon: <MapPinned size={24} />,
    accent: GOLD },
  { key: "locations", label: "Localisations", subtitle: "GPS capturées",
    info: "Nombre total de positions GPS capturées lors des visites terrain.",
    icon: <MapPin size={24} />,
    accent: "#2F8F52" },
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

      // Construction du PDF dans un Web Worker : le dashboard reste fluide pendant la génération.
      const { renderPdf } = await import("@/lib/pdf/pdfClient");
      await renderPdf({ kind: "dashboard", data: reportData });
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
  const glass = "bg-white/[0.14] border border-white/20 backdrop-blur-[20px] backdrop-saturate-[180%] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_14px_rgba(0,0,0,0.15)]";
  const seg = (active: boolean, small = false) =>
    `cursor-pointer rounded-full border-0 font-semibold transition-all duration-200 ${small ? "px-[11px] py-1 text-[0.72rem]" : "px-[1.6rem] py-1 text-[0.78rem]"} ${
      active
        ? "bg-gradient-to-b from-[#3C8047] to-[#1F5C30] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_rgba(60,128,71,0.4)]"
        : "bg-transparent text-white/70 hover:bg-white/10"
    }`;
  const circleBtn = "relative flex cursor-pointer items-center justify-center rounded-full p-2 transition-all duration-200 hover:-translate-y-px disabled:cursor-default";
  const card = "relative overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_4px_rgba(15,59,92,0.05)]";
  const paper = "rounded-lg bg-surface p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]";
  const labelCls = "text-[0.67rem] font-semibold uppercase tracking-[1px] text-muted-foreground";

  return (
    <>
      {/* Barre de progression pendant les requêtes */}
      {isLoading && <div className="fixed inset-x-0 top-0 z-[2000] h-[3px] animate-pulse bg-[#3C8047]" />}

      {/* HEADER — liquid glass sur le fond navy d'origine : capsules dépolies
          claires posées sur le dégradé navy/steel, plutôt qu'un bandeau plat. */}
      <div
        className="relative flex flex-wrap items-center gap-3 overflow-hidden border-b border-[#3C8047]/40 px-8 py-[22px] shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
        style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}
      >
        {/* Taches de couleur douces, floutées — donnent la profondeur du verre */}
        <div className="pointer-events-none absolute -top-[60px] left-[8%] size-[220px] rounded-full blur-[30px]" style={{ background: `radial-gradient(circle, ${GOLD}33 0%, transparent 70%)` }} />
        <div className="pointer-events-none absolute -bottom-20 right-[12%] size-[260px] rounded-full blur-[35px]" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)" }} />

        <div className="relative flex size-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#3C8047] to-[#1F5C30] shadow-[0_4px_14px_rgba(60,128,71,0.35)]">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div className="relative min-w-[200px] flex-1">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-white">Tableau de bord</h1>
          <span className="text-xs text-white/60">
            Dernière actualisation : {lastRefresh ? lastRefresh.toLocaleTimeString("fr-FR") : "—"}
            <RefreshCountdown interval={refreshInterval} onTick={handleAutoRefreshTick} />
          </span>
        </div>

        {/* Period selector — capsule verre clair */}
        <div role="group" aria-label="Période" className={`relative flex rounded-full p-[3px] ${glass}`}>
          {PERIOD_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={days === o.value} onClick={() => setDays(o.value)} className={seg(days === o.value)}>{o.label}</button>
          ))}
        </div>

        {/* Auto-refresh toggle — capsule verre sur navy */}
        <div className={`relative flex items-center gap-1 rounded-full py-[3px] pl-3 pr-[3px] ${glass}`}>
          <RefreshCw size={14} className="mr-1 text-[#3C8047]" />
          <div role="group" aria-label="Actualisation automatique" className="flex">
            {REFRESH_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={refreshInterval === o.value} onClick={() => setRefreshInterval(o.value)} className={seg(refreshInterval === o.value, true)}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* Alerts bell — always visible, bouton verre circulaire sur navy */}
        <Tooltip title={triggeredAlerts.length > 0 ? `${triggeredAlerts.length} alerte(s) active(s) — cliquer pour configurer` : "Alertes & seuils KPI"}>
          <button
            type="button"
            aria-label="Alertes & seuils KPI"
            onClick={() => setAlertsPanelOpen(true)}
            className={`${circleBtn} ${glass} ${triggeredAlerts.length > 0 ? "animate-[kpiBell_1.8s_infinite] border-[rgba(252,165,165,0.5)] bg-[rgba(252,165,165,0.12)] text-[#FCA5A5]" : "text-white/85 hover:bg-white/20"}`}
          >
            {triggeredAlerts.length > 0 ? <BellRing size={20} /> : <Bell size={20} />}
            {triggeredAlerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">{triggeredAlerts.length > 9 ? "9+" : triggeredAlerts.length}</span>
            )}
          </button>
        </Tooltip>

        {/* Manual refresh — bouton verre circulaire sur navy, accent vert */}
        <Tooltip title="Actualiser maintenant">
          <button
            type="button"
            aria-label="Actualiser maintenant"
            onClick={doRefresh}
            disabled={isLoading}
            className={`${circleBtn} border border-[#3C8047]/40 bg-[#3C8047]/[0.14] text-[#3C8047] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(0,0,0,0.18)] backdrop-blur-[20px] hover:bg-[#3C8047]/25 hover:rotate-90 disabled:text-[#3C8047]/40 disabled:border-[#3C8047]/20`}
          >
            <RefreshCw size={20} />
            {!!refreshInterval && <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" />}
          </button>
        </Tooltip>

        {/* Export PDF — bouton verre circulaire sur navy */}
        <Tooltip title="Exporter le rapport PDF">
          <button
            type="button"
            aria-label="Exporter le rapport PDF"
            onClick={handleExportPdf}
            disabled={pdfLoading || isLoading}
            className={`${circleBtn} border border-[#3C8047]/45 bg-[#3C8047]/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(0,0,0,0.18)] backdrop-blur-[20px] hover:bg-gradient-to-b hover:from-[#3C8047] hover:to-[#1F5C30] disabled:text-white/35 disabled:border-[#3C8047]/20`}
          >
            {pdfLoading ? <Spinner className="size-5" /> : <FileDown size={20} />}
          </button>
        </Tooltip>
      </div>

      <PageContainer>
        {/* ─── ALERT BANNERS ─────────────────────────────────────────── */}
        {visibleAlerts.length > 0 && (
          <div className="mb-5 flex flex-col gap-2">
            {visibleAlerts.map((alert) => {
              const critical = alert.severity === "critical";
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${critical ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
                >
                  {critical ? <CircleAlert size={20} className="shrink-0 text-red-600" /> : <TriangleAlert size={20} className="shrink-0 text-amber-600" />}
                  <span className={`flex-1 text-[13px] font-medium ${critical ? "text-red-800" : "text-amber-800"}`}>{alert.message}</span>
                  <button
                    type="button"
                    onClick={() => setAlertsPanelOpen(true)}
                    className={`mr-1 cursor-pointer rounded-full border px-2.5 text-[11px] leading-6 ${critical ? "border-red-200 bg-red-600/10 text-red-800" : "border-amber-200 bg-amber-600/10 text-amber-800"}`}
                  >
                    Configurer
                  </button>
                  <button
                    type="button"
                    aria-label="Fermer l'alerte"
                    onClick={() => setDismissedAlerts((prev) => new Set([...prev, alert.id]))}
                    className="cursor-pointer border-0 bg-transparent p-0.5 text-slate-500 hover:text-slate-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── KPI TILES ─────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_CARDS.map((c, i) => (
            <motion.div key={c.key} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <div className={card} style={{ borderLeft: `3px solid ${c.accent}` }}>
                {c.info && <KpiInfoIcon text={c.info} color="var(--text-muted)" />}
                <div className="flex items-start justify-between p-5">
                  <div>
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[1px] text-muted-foreground">{c.subtitle}</div>
                    <div className="mt-1 text-[2.125rem] font-extrabold leading-[1.1] text-foreground">{(stats as any)[c.key]?.toLocaleString() ?? "—"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{c.label}</div>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-full" style={{ background: `${c.accent}18`, color: c.accent }}>{c.icon}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── KPI ROW 2: Métriques dérivées ─────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Taux de résolution",  value: `${derived.tauxResolution}%`,
              sub: "tickets résolus + fermés",
              info: "Pourcentage de tickets au statut Résolu ou Fermé sur l'ensemble des tickets de la période.",
              icon: <CircleCheck size={24} />,
              accent: derived.tauxResolution >= 70 ? "#059669" : derived.tauxResolution >= 40 ? "#D97706" : "#DC2626" },
            { label: "Moy. clients/agence", value: derived.moyenneClients.toLocaleString(),
              sub: "clients par agence en moyenne",
              info: "Nombre moyen de clients par agence (total clients divisé par nombre d'agences).",
              icon: <MapPinned size={24} />,
              accent: STEEL },
            { label: "Agences sans CAF",    value: String(derived.agencesSansCaf),
              sub: "agences sans agent terrain",
              info: "Nombre d'agences ne disposant d'aucun chargé d'affaires (CAF) rattaché.",
              icon: <TriangleAlert size={24} />,
              accent: derived.agencesSansCaf > 0 ? "#D97706" : "#059669" },
            { label: "Utilisateurs terrain", value: derived.totalUsers.toLocaleString(),
              sub: "rattachés à une agence",
              info: "Nombre distinct d'utilisateurs rattachés à au moins une agence (un même agent rattaché à plusieurs agences n'est compté qu'une fois).",
              icon: <UserCog size={24} />,
              accent: "#2F8F52" },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
              <div className={card} style={{ borderLeft: `3px solid ${k.accent}` }}>
                {k.info && <KpiInfoIcon text={k.info} color="var(--text-muted)" />}
                <div className="flex items-start justify-between p-5">
                  <div>
                    <div className={labelCls}>{k.label}</div>
                    <div className="mt-1 text-[2.125rem] font-extrabold leading-[1.1] text-foreground">{k.value}</div>
                    <div className="mt-1 block text-[0.78rem] text-muted-foreground">{k.sub}</div>
                  </div>
                  <span className="flex size-[42px] items-center justify-center rounded-full" style={{ background: `${k.accent}18`, color: k.accent }}>{k.icon}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── TENDANCE BANNER ─────────────────────────────────────────── */}
        {derived.tendance !== 0 && (
          <div
            className="mb-5 flex items-center gap-3 rounded-lg p-3"
            style={{
              background: derived.tendance > 0 ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)",
              border: `1px solid ${derived.tendance > 0 ? "#059669" : "#DC2626"}30`,
            }}
          >
            {derived.tendance > 0 ? <TrendingUp size={20} className="text-emerald-600" /> : <TrendingDown size={20} className="text-red-600" />}
            <span className={`text-sm font-semibold ${derived.tendance > 0 ? "text-emerald-600" : "text-red-600"}`}>
              Tendance activité {derived.tendance > 0 ? "+" : ""}{derived.tendance}% sur la 2ème moitié de la période
            </span>
            <span className="text-xs text-muted-foreground">(comparaison première vs seconde moitié des {days} jours)</span>
          </div>
        )}

        {/* ─── CHARTS ROW 1: Activity by day + Tickets by status ─── */}
        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Area chart: activité par jour */}
          <div className={`${paper} md:col-span-7`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-foreground">Activité / jour — {days} derniers jours</h3>
              {drillAction && (
                <button type="button" onClick={() => setDrillAction(null)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500 bg-transparent px-2.5 text-xs leading-6 text-amber-600">
                  <Filter size={13} /> Action: {drillAction} <X size={13} />
                </button>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cData.activityByDay}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={STEEL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={STEEL} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                  formatter={(v: any) => [v, "Événements"]}
                  labelFormatter={(l) => `Date : ${l}`}
                />
                <Area type="monotone" dataKey="count" name="Événements"
                  stroke={STEEL} fill="url(#grad)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: GOLD }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart: tickets par statut */}
          <div className={`${paper} h-full md:col-span-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-foreground">Tickets par statut</h3>
              {drillStatus && (
                <button type="button" onClick={() => setDrillStatus(null)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500 bg-transparent px-2.5 text-xs leading-6 text-amber-600">
                  <Filter size={13} /> Statut: {statusLabel(drillStatus)} <X size={13} />
                </button>
              )}
            </div>
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
                <Legend formatter={(v) => statusLabel(v)} wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
                <RechartsTooltip formatter={(v, n) => [v, statusLabel(String(n))]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── CHARTS ROW 2: Clients by agency + Logs by action ─── */}
        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Bar chart: clients par agence */}
          <div className={paper}>
            <h3 className="mb-4 font-bold text-foreground">Clients par agence (top 8)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cData.clientsByAgency.slice(0, 8)} layout="vertical"
                onClick={(e) => { if (e?.activeLabel) setDrillAction(null); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                <YAxis type="category" dataKey="agence" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={90}
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
          </div>

          {/* Bar chart: logs par action */}
          <div className={paper}>
            <h3 className="mb-4 font-bold text-foreground">Événements par type d&apos;action</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cData.activityByAction}
                onClick={(e: any) => {
                  const act = e?.activePayload?.[0]?.payload?.action;
                  if (act) setDrillAction((d) => d === act ? null : act);
                }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="action" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
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
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => setDrillAction(null)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#3C8047] bg-transparent px-2.5 text-xs leading-6 text-[#3C8047]">
                  <FilterX size={13} /> Effacer filtre
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── CHARTS ROW 3: CAFs/Utilisateurs par agence + Zones ─── */}
        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Grouped bar: CAFs + utilisateurs par agence */}
          <div className={`${paper} md:col-span-7`}>
            <h3 className="mb-1 font-bold text-foreground">CAFs &amp; Utilisateurs par agence</h3>
            <span className="mb-3 block text-xs text-muted-foreground">Répartition des ressources humaines par agence</span>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={derived.cafsByAgence} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="agence" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                {/* Échelle unique : les barres CAFs et Utilisateurs sont
                    directement comparables entre elles. Le nombre de clients
                    (échelle très différente) a son propre graphique dédié
                    « Clients par agence » ci-dessus. */}
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} allowDecimals={false} label={{ value: "CAFs / Utilisateurs", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
                <Bar dataKey="CAFs" fill={STEEL} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Utilisateurs" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: agences par zone */}
          <div className={`${paper} h-full md:col-span-5`}>
            <div className="mb-1 flex items-center gap-2">
              <MapIcon size={18} className="text-[#1E6091]" />
              <h3 className="font-bold text-foreground">Agences par zone</h3>
            </div>
            <span className="mb-3 block text-xs text-muted-foreground">
              {(() => {
                const realZones = derived.agencesByZone.filter((z) => z.zone !== "Sans zone").length;
                return realZones > 0
                  ? `${realZones} zone${realZones !== 1 ? "s" : ""} identifiée${realZones !== 1 ? "s" : ""}`
                  : "Aucune zone créée";
              })()}
            </span>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={derived.agencesByZone} dataKey="count" nameKey="zone"
                  cx="50%" cy="50%" outerRadius={78} innerRadius={35} paddingAngle={2}>
                  {derived.agencesByZone.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(v) => String(v).slice(0, 18)} wrapperStyle={{ fontSize: 10, color: "var(--text-secondary)" }} />
                <RechartsTooltip formatter={(v, n) => [v, String(n)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── CHARTS ROW 4: Résolution tickets + Tendance activité ─── */}
        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Ticket resolution breakdown */}
          <div className={`${paper} h-full md:col-span-5`}>
            <div className="mb-1 flex items-center gap-2">
              <CircleCheck size={18} className="text-emerald-600" />
              <h3 className="font-bold text-foreground">Résolution tickets détail</h3>
            </div>
            <span className="mb-4 block text-xs text-muted-foreground">{derived.totalTickets} tickets au total — taux {derived.tauxResolution}%</span>
            <div className="flex flex-col gap-3">
              {derived.ticketBreakdown.map((t) => {
                const tColor: Record<string, string> = { open: "#DC2626", "En cours": "#D97706", "Résolu": "#059669", "Fermé": NAVY };
                const c = tColor[t.status] ?? STEEL;
                return (
                  <div key={t.status}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-xs font-semibold" style={{ color: c }}>{t.status}</span>
                      <span className="text-xs text-muted-foreground">{t.count} ({t.pct}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div className="h-full rounded transition-[width] duration-700" style={{ background: c, width: `${t.pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {derived.ticketBreakdown.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aucun ticket enregistré</p>}
            </div>
          </div>

          {/* Line chart: activité vs moyenne mobile */}
          <div className={`${paper} md:col-span-7`}>
            <h3 className="mb-1 font-bold text-foreground">Activité vs moyenne mobile</h3>
            <span className="mb-3 block text-xs text-muted-foreground">Événements journaliers et tendance cumulée sur {days} jours</span>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={derived.activityComparison}>
                <defs>
                  <linearGradient id="gradActuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={NAVY} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${STEEL}`, fontSize: 12 }}
                  formatter={(v: any, n: any) => [v, n === "actuel" ? "Événements" : "Moy. mobile"]} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
                  formatter={(v) => v === "actuel" ? "Événements / jour" : "Moyenne mobile"} />
                <Area type="monotone" dataKey="actuel" fill="url(#gradActuel)" stroke={NAVY} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="moy" stroke={GOLD} strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── ACTIVITY FEED ──────────────────────────────────────── */}
        <div className={paper}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-[#1E6091]" />
              <h3 className="font-bold text-foreground">Fil d&apos;activité récente</h3>
              {hasDrill && (
                <button type="button" onClick={() => { setDrillAction(null); setDrillStatus(null); }} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500 bg-transparent px-2.5 text-xs leading-6 text-amber-600">
                  <Filter size={13} /> {`Filtre actif${drillAction ? ` — ${drillAction}` : ""}${drillStatus ? ` — ${statusLabel(drillStatus)}` : ""}`} <X size={13} />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredLogs.length} événement{filteredLogs.length !== 1 ? "s" : ""}
              {hasDrill ? " (filtrés)" : ""}
            </span>
          </div>
          <hr className="mb-3 border-border" />
          {filteredLogs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Aucun événement à afficher.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredLogs.slice(0, 30).map((log) => (
                <div
                  key={log.id}
                  onClick={() => setDrillAction((d) => d === log.action ? null : log.action)}
                  className={`flex cursor-pointer items-center gap-3 rounded px-3 py-1.5 hover:bg-muted ${drillAction === log.action ? "bg-[#3C8047]/[0.06]" : ""}`}
                >
                  <span className="min-w-16 rounded-full px-2 text-center text-[0.65rem] font-bold leading-6 text-white" style={{ background: actionColor(log.action) }}>{log.action}</span>
                  <span className="flex-1 truncate text-[0.8rem] text-foreground">{log.description ?? "—"}</span>
                  {log.user && <span className="whitespace-nowrap text-xs text-[#1E6091]">{log.user.name ?? log.user.username ?? ""}</span>}
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>

      {/* Notification PDF */}
      <Snackbar open={!!snack} severity={snack.startsWith("Erreur") ? "error" : "success"} autoHideMs={4000} onClose={() => setSnack("")}>{snack}</Snackbar>

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
