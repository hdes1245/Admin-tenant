"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Box, Typography, Paper, Chip, Stack, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, TextField, Select, MenuItem, FormControl,
  InputLabel, IconButton, Tooltip, Tab, Tabs, Alert,
  TablePagination, Skeleton, Divider, Badge,
} from "@mui/material";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, LabelList,
  RadialBarChart, RadialBar,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import StoreIcon from "@mui/icons-material/Store";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import RefreshIcon from "@mui/icons-material/Refresh";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import GppMaybeIcon from "@mui/icons-material/GppMaybe";
import PhoneIcon from "@mui/icons-material/Phone";
import ApartmentIcon from "@mui/icons-material/Apartment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { apiClient } from "@/lib/apiClient";
import { KpiInfoIcon } from "@/components/KpiInfoIcon";

const NAVY   = "#0D1B2A";
const STEEL  = "#1B4F72";
const GOLD   = "#C49A2E";
const RED    = "#dc2626";
const ORANGE = "#d97706";
const GREEN  = "#16a34a";

function apiFetch(path: string) {
  return apiClient.get(path).then((r) => r.data);
}

function fmt(n: number) { return n.toLocaleString("fr-FR"); }
function fmtM(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}

const VISIT_CFG = {
  recent:   { label: "Visité 7j",     color: GREEN,  bg: "#dcfce7", Icon: CheckCircleIcon },
  stale:    { label: "Visité 30j",    color: ORANGE, bg: "#fef3c7", Icon: WarningAmberIcon },
  no_visit: { label: "Jamais visité", color: RED,    bg: "#fee2e2", Icon: ErrorIcon },
} as const;

const RISK_CFG: Record<number, { label: string; color: string; bg: string }> = {
  4: { label: "Perte",       color: "#7f1d1d", bg: "#fef2f2" },
  3: { label: "Critique",    color: RED,       bg: "#fee2e2" },
  2: { label: "Élevé",       color: ORANGE,    bg: "#fef3c7" },
  1: { label: "Modéré",      color: "#ca8a04", bg: "#fefce8" },
  0: { label: "Encours",     color: STEEL,     bg: "#eff6ff" },
};

const ROWS_OPTIONS = [25, 50, 100, 200];

function useDebounce<T>(value: T, delay = 350): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

function KpiCard({ label, value, sub, color = NAVY, icon: Icon, urgent = false, info }: any) {
  return (
    <Card sx={{ border: `1px solid ${color}25`, position: "relative", overflow: "visible" }}>
      {urgent && <Box sx={{ position: "absolute", top: -6, right: -6, width: 14, height: 14, borderRadius: "50%", bgcolor: RED, boxShadow: `0 0 0 3px #fee2e2` }} />}
      {info && <KpiInfoIcon text={info} color={color} />}
      <CardContent sx={{ pb: "16px !important" }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          {Icon && <Icon sx={{ fontSize: 16, color }} />}
          <Typography fontSize={10} fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>{label}</Typography>
        </Stack>
        <Typography fontSize={28} fontWeight={800} color={color} lineHeight={1}>{value}</Typography>
        {sub && <Typography fontSize={11} color="text.secondary" mt={0.5}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ score }: { score: number }) {
  const cfg = RISK_CFG[score] ?? RISK_CFG[0];
  return <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 10 }} />;
}

function isGenericCafName(name: string) { return /^(GESTIONNAIRE_INCONNU|INCONNU)$/i.test(name.trim()); }

function cafDisplayLabel(r: any): string {
  const code = r.code_charge_affaire ? String(r.code_charge_affaire).trim() : "";
  const name = r.charge_affaire ? String(r.charge_affaire).trim() : "";
  if (name && !isGenericCafName(name)) return name;
  if (name && code) return `${name} (${code})`;
  return code || "—";
}

function RiskClientRow({ r, showLastVisit = true }: { r: any; showLastVisit?: boolean }) {
  return (
    <TableRow hover sx={{
      bgcolor: r.risk_score === 4 ? "#fef2f2" : r.risk_score === 3 ? "#fff5f5" : "inherit",
      "&:hover": { bgcolor: "#fff1f2 !important" }
    }}>
      <TableCell>
        <Typography fontWeight={700} fontSize={13}>{r.full_name ?? "—"}</Typography>
        {r.phone && (
          <Stack direction="row" alignItems="center" spacing={0.4} mt={0.2}>
            <PhoneIcon sx={{ fontSize: 11, color: "text.secondary" }} />
            <Typography fontSize={11} color="text.secondary">{r.phone}</Typography>
          </Stack>
        )}
      </TableCell>
      <TableCell>
        <Chip label={r.client_ref} size="small" variant="outlined" sx={{ fontSize: 10 }} />
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={0.4}>
          <ApartmentIcon sx={{ fontSize: 12, color: "text.secondary" }} />
          <Typography fontSize={12}>{r.agence ?? "—"}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography fontSize={11} color="text.secondary">{cafDisplayLabel(r)}</Typography>
      </TableCell>
      <TableCell>
        {r.risk_score !== undefined
          ? <RiskBadge score={r.risk_score} />
          : <Chip label={r.risk_label ?? r.statut ?? "—"} size="small"
              sx={{ bgcolor: "#fee2e2", color: RED, fontWeight: 700, fontSize: 10 }} />}
      </TableCell>
      <TableCell>
        <Typography fontWeight={700} fontSize={12}
          color={r.nombre_jour_retard > 90 ? "#7f1d1d" : r.nombre_jour_retard > 30 ? RED : ORANGE}>
          {r.nombre_jour_retard > 0 ? `${fmt(r.nombre_jour_retard)}j` : "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography fontWeight={800} fontSize={12} color={RED}>
          {r.capital_impaye > 0 ? `${fmtM(r.capital_impaye)} FCFA` : "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography fontSize={12} color={STEEL}>
          {r.encours_global > 0 ? `${fmtM(r.encours_global)} FCFA` : "—"}
        </Typography>
      </TableCell>
      {showLastVisit && (
        <TableCell>
          {r.last_visit
            ? <Typography fontSize={11} color="text.secondary">{new Date(r.last_visit).toLocaleDateString("fr-FR")}</Typography>
            : <Chip label="Jamais" size="small" sx={{ bgcolor:"#fee2e2", color:RED, fontWeight:700, fontSize:9 }} />}
        </TableCell>
      )}
    </TableRow>
  );
}

function CafRiskGroupRow({ group, expanded, onToggle }: { group: any; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow hover sx={{ cursor: "pointer", bgcolor: expanded ? "#fff1f2" : "inherit" }} onClick={onToggle}>
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small">
            {expanded ? <ExpandMoreIcon sx={{ transform: "rotate(180deg)" }} /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight={700} fontSize={13}>{group.chargeAffaire}</Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={0.4}>
            <ApartmentIcon sx={{ fontSize: 12, color: "text.secondary" }} />
            <Typography fontSize={12}>{group.agence}</Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Chip label={`${fmt(group.clients.length)} client(s)`} size="small"
            sx={{ bgcolor: "#fee2e2", color: RED, fontWeight: 700, fontSize: 10 }} />
        </TableCell>
        <TableCell>
          <Typography fontWeight={800} fontSize={12} color={RED}>
            {fmtM(group.capitalImpaye)} FCFA
          </Typography>
        </TableCell>
        <TableCell>
          <Typography fontSize={12} color={STEEL}>
            {fmtM(group.encoursGlobal)} FCFA
          </Typography>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, borderBottom: "2px solid #e2e8f0" }}>
            <Box sx={{ p: 2, bgcolor: "#fafbfc" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: "#fff1f2" }}>
                    {["Client","Code","Agence","CAF","Statut risque","Retard","Capital impayé","Encours"].map(h =>
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 10, color: RED }}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.clients.map((r: any, i: number) => (
                    <RiskClientRow key={i} r={r} showLastVisit={false} />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function ClientPortfolioPage() {
  const [tab, setTab]             = useState(0);
  const [agenceFilter, setAgence] = useState("");
  const [statusFilter, setStatus] = useState("");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(0);
  const [rpp, setRpp]             = useState(50);
  const [riskTab, setRiskTab]     = useState(0);
  const [expandedCafs, setExpandedCafs] = useState<Set<string>>(new Set());
  const dSearch = useDebounce(search, 350);

  const toggleCaf = (key: string) => {
    setExpandedCafs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const effectiveStatus = useMemo(() => tab === 1 ? "no_visit" : tab === 2 ? "stale" : statusFilter, [tab, statusFilter]);

  const prevRef = useRef({ agenceFilter, effectiveStatus, dSearch, tab });
  useEffect(() => {
    const p = prevRef.current;
    if (p.agenceFilter !== agenceFilter || p.effectiveStatus !== effectiveStatus || p.dSearch !== dSearch || p.tab !== tab) {
      setPage(0);
      prevRef.current = { agenceFilter, effectiveStatus, dSearch, tab };
    }
  }, [agenceFilter, effectiveStatus, dSearch, tab]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["client-coverage-stats"],
    queryFn:  () => apiFetch("/clients/coverage/stats"),
    staleTime: 60_000, refetchInterval: 120_000,
  });

  const { data: riskData, isLoading: riskLoading, refetch: refetchRisk } = useQuery({
    queryKey: ["client-risk-analysis"],
    queryFn:  () => apiFetch("/clients/risk-analysis"),
    staleTime: 60_000, refetchInterval: 120_000,
  });

  const listParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page + 1), limit: String(rpp) });
    if (agenceFilter)    p.set("agence", agenceFilter);
    if (effectiveStatus) p.set("status", effectiveStatus);
    if (dSearch)         p.set("search", dSearch);
    return p.toString();
  }, [page, rpp, agenceFilter, effectiveStatus, dSearch]);

  const { data: listRaw, isLoading: listLoading, isFetching, refetch: refetchList } = useQuery({
    queryKey: ["client-coverage", listParams],
    queryFn:  () => apiFetch(`/clients/coverage?${listParams}`),
    staleTime: 30_000, placeholderData: keepPreviousData,
  });

  const clients: any[] = listRaw?.data ?? [];
  const totalCount     = listRaw?.total ?? 0;

  const kpi     = useMemo(() => ({ total: stats?.total ?? 0, recent: stats?.recent ?? 0, stale: stats?.stale ?? 0, no_visit: stats?.no_visit ?? 0 }), [stats]);
  const risk    = useMemo(() => riskData?.summary ?? {}, [riskData]);
  const agStatsVisit: any[] = stats?.byAgence ?? [];
  const agStatsRisk:  any[] = riskData?.byAgence ?? [];
  const topRisk:      any[] = riskData?.topRisk ?? [];
  const unvisited:    any[] = riskData?.unvisitedRisk ?? [];

  // Regroupement des dossiers à risque par CAF (chargé d'affaires)
  // Le nom "GESTIONNAIRE_INCONNU" est un libellé générique renvoyé par la source
  // pour plusieurs anciens agents distincts — on affiche alors le code réel entre parenthèses.
  const cafGroups = useMemo(() => {
    const map = new Map<string, { key: string; chargeAffaire: string; agences: Set<string>; capitalImpaye: number; encoursGlobal: number; clients: any[] }>();
    for (const r of topRisk) {
      const code = r.code_charge_affaire ? String(r.code_charge_affaire).trim() : "";
      const name = r.charge_affaire ? String(r.charge_affaire).trim() : "";
      const key = code || name || "INCONNU";
      if (!map.has(key)) {
        map.set(key, {
          key,
          chargeAffaire: cafDisplayLabel(r),
          agences: new Set(),
          capitalImpaye: 0,
          encoursGlobal: 0,
          clients: [],
        });
      }
      const g = map.get(key)!;
      if (r.agence) g.agences.add(r.agence);
      g.capitalImpaye  += Number(r.capital_impaye ?? 0);
      g.encoursGlobal  += Number(r.encours_global ?? 0);
      g.clients.push(r);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        agence: g.agences.size === 0 ? "—" : g.agences.size === 1 ? Array.from(g.agences)[0] : `${g.agences.size} agences`,
      }))
      .sort((a, b) => b.capitalImpaye - a.capitalImpaye);
  }, [topRisk]);

  const cov7d  = kpi.total ? Math.round((kpi.recent / kpi.total) * 100) : 0;
  const cov30d = kpi.total ? Math.round(((kpi.recent + kpi.stale) / kpi.total) * 100) : 0;

  const pieVisit = [
    { name: "Visité 7j",     value: kpi.recent,   color: GREEN },
    { name: "Visité 30j",    value: kpi.stale,     color: ORANGE },
    { name: "Jamais visité", value: kpi.no_visit,  color: RED },
  ];

  const pieRisk = [
    { name: "Souffrant",  value: risk.souffrant ?? 0, color: RED },
    { name: "Perte",      value: risk.perte     ?? 0, color: "#7f1d1d" },
    { name: "Encours",    value: risk.encours   ?? 0, color: ORANGE },
  ];

  const refetch = () => { refetchStats(); refetchRisk(); refetchList(); };

  const criticalUnvisited = risk.risk_never_visited ?? 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <StoreIcon sx={{ color: GOLD, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={800} color={NAVY}>Portefeuille Clients</Typography>
            <Typography fontSize={13} color="text.secondary">Centre d'analyse — couverture visites & risque crédit</Typography>
          </Box>
        </Stack>
        <Tooltip title="Actualiser"><IconButton onClick={refetch} size="small"><RefreshIcon /></IconButton></Tooltip>
      </Stack>

      {/* ── Alertes prioritaires ────────────────────────────────────────── */}
      {!riskLoading && criticalUnvisited > 0 && (
        <Alert severity="error" icon={<LocalFireDepartmentIcon />} sx={{ mb: 2, fontWeight: 600, borderRadius: 2 }}>
          <strong>{fmt(criticalUnvisited)} client(s) à risque n'ont jamais été visités.</strong>{" "}
          Intervention urgente recommandée — capital impayé exposé : <strong>{fmtM(risk.total_capital_impaye ?? 0)} FCFA</strong>
        </Alert>
      )}
      {!riskLoading && (risk.retard_90j ?? 0) > 0 && (
        <Alert severity="warning" icon={<GppMaybeIcon />} sx={{ mb: 3, borderRadius: 2 }}>
          <strong>{fmt(risk.retard_90j)} dossier(s)</strong> en retard de plus de 90 jours — classement souffrant/perte probable.
        </Alert>
      )}

      {/* ── KPI Visite + Risque ─────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 3 }}>
        {statsLoading || riskLoading
          ? Array.from({ length: 8 }).map((_,i) => <Card key={i}><CardContent><Skeleton /><Skeleton height={40} /></CardContent></Card>)
          : <>
              <KpiCard label="Total clients" value={fmt(kpi.total)} color={NAVY} icon={StoreIcon}
                info="Nombre total de clients enregistrés dans ce tenant." />
              <KpiCard label="Couverture 7j" value={`${cov7d}%`} color={GREEN} icon={CheckCircleIcon}
                sub={<LinearProgress variant="determinate" value={cov7d} sx={{ height:5, borderRadius:3, mt:0.5, "& .MuiLinearProgress-bar":{background:GREEN} }} />}
                info="Pourcentage de clients ayant reçu au moins une visite au cours des 7 derniers jours." />
              <KpiCard label="Jamais visités" value={fmt(kpi.no_visit)} color={RED} icon={PersonOffIcon}
                sub={`${kpi.total ? Math.round((kpi.no_visit/kpi.total)*100) : 0}% du portefeuille`} urgent
                info="Clients n'ayant jamais eu de localisation ou de visite enregistrée." />
              <KpiCard label="À relancer" value={fmt(kpi.stale)} color={ORANGE} icon={AccessTimeIcon}
                info="Clients visités il y a plus de 7 jours mais moins de 30 jours (couverture 30j hors couverture 7j)." />
              <KpiCard label="Dossiers à risque" value={fmt(risk.total_risk ?? 0)} color={STEEL} icon={GppMaybeIcon}
                info="Nombre total de dossiers classés en risque crédit (souffrance, perte ou encours en retard)." />
              <KpiCard label="Souffrant / Perte" value={fmt((risk.souffrant??0)+(risk.perte??0))} color={RED} icon={TrendingDownIcon} urgent
                info="Dossiers dont le statut de risque est Souffrance ou Perte, les niveaux de risque les plus critiques." />
              <KpiCard label="Capital impayé" value={fmtM(risk.total_capital_impaye??0)} color={"#7f1d1d"} icon={TrendingDownIcon}
                sub="FCFA — total portefeuille"
                info="Somme du capital impayé cumulé sur l'ensemble des dossiers à risque du portefeuille." />
              <KpiCard label="Risque non visité" value={fmt(risk.risk_never_visited??0)} color={RED} icon={PersonOffIcon}
                sub={`+ ${fmt(risk.risk_not_visited_30d??0)} non vus 30j`} urgent
                info="Clients à risque n'ayant jamais été visités sur le terrain (le sous-total indique ceux non visités depuis 30 jours)." />
            </>
        }
      </Box>

      {/* ── Graphiques ─────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, mb: 3 }}>

        {/* Répartition visite */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5} color={NAVY}>Répartition visites</Typography>
          {statsLoading ? <Skeleton variant="circular" width={140} height={140} sx={{ mx:"auto" }} /> : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieVisit} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38}
                  strokeWidth={2}>
                  {/* stroke="none" : un trait visible entre tranches crée une encoche
                      (façon "C") quand une seule catégorie domine à ~100% */}
                  {pieVisit.map((d,i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <RTooltip
                  formatter={(v: any, _: any, entry: any) => [`${fmt(v)} (${kpi.total ? Math.round((v/kpi.total)*100) : 0}%)`, entry.name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <Stack spacing={1} mt={1.5}>
            {pieVisit.map(d => {
              const pct = kpi.total ? Math.round((d.value / kpi.total) * 100) : 0;
              return (
                <Box key={d.name}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.3}>
                    <Stack direction="row" alignItems="center" spacing={0.7}>
                      <Box sx={{ width:10, height:10, borderRadius:"50%", bgcolor:d.color, flexShrink:0 }} />
                      <Typography fontSize={12} fontWeight={500}>{d.name}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontSize={12} fontWeight={800} color={d.color}>{fmt(d.value)}</Typography>
                      <Chip label={`${pct}%`} size="small" sx={{ height:18, fontSize:10, fontWeight:700, bgcolor:`${d.color}18`, color:d.color }} />
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{ height:5, borderRadius:3, bgcolor:`${d.color}20`, "& .MuiLinearProgress-bar":{ background:d.color } }} />
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Répartition risque */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5} color={NAVY}>Répartition risque crédit</Typography>
          {riskLoading ? <Skeleton variant="circular" width={140} height={140} sx={{ mx:"auto" }} /> : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieRisk} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38}
                  strokeWidth={2}>
                  {pieRisk.map((d,i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <RTooltip
                  formatter={(v: any, _: any, entry: any) => {
                    const total = (risk.souffrant??0)+(risk.perte??0)+(risk.encours??0);
                    return [`${fmt(v)} (${total ? Math.round((v/total)*100) : 0}%)`, entry.name];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <Stack spacing={1} mt={1.5}>
            {pieRisk.map(d => {
              const total = (risk.souffrant??0)+(risk.perte??0)+(risk.encours??0);
              const pct = total ? Math.round((d.value / total) * 100) : 0;
              return (
                <Box key={d.name}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.3}>
                    <Stack direction="row" alignItems="center" spacing={0.7}>
                      <Box sx={{ width:10, height:10, borderRadius:"50%", bgcolor:d.color, flexShrink:0 }} />
                      <Typography fontSize={12} fontWeight={500}>{d.name}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontSize={12} fontWeight={800} color={d.color}>{fmt(d.value)}</Typography>
                      <Chip label={`${pct}%`} size="small" sx={{ height:18, fontSize:10, fontWeight:700, bgcolor:`${d.color}18`, color:d.color }} />
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{ height:5, borderRadius:3, bgcolor:`${d.color}20`, "& .MuiLinearProgress-bar":{ background:d.color } }} />
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" justifyContent="space-between" mt={1.5} pt={1.5} sx={{ borderTop:"1px solid #f1f5f9" }}>
            <Typography fontSize={11} color="text.secondary">Total dossiers risque</Typography>
            <Typography fontSize={12} fontWeight={800} color={RED}>{fmt(risk.total_risk??0)}</Typography>
          </Stack>
        </Paper>

        {/* Retard par tranche */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5} color={NAVY}>Retards par tranche</Typography>
          {riskLoading ? <Skeleton height={160} /> : (
            <Box>
              {[
                { label: "> 90 jours",   value: risk.retard_90j   ?? 0, color: RED,    max: risk.total_risk },
                { label: "31 – 90 jours", value: risk.retard_30_90j ?? 0, color: ORANGE, max: risk.total_risk },
                { label: "1 – 30 jours",  value: risk.retard_1_30j  ?? 0, color: "#ca8a04", max: risk.total_risk },
              ].map(r => (
                <Box key={r.label} mb={1.5}>
                  <Stack direction="row" justifyContent="space-between" mb={0.3}>
                    <Typography fontSize={11} fontWeight={600}>{r.label}</Typography>
                    <Typography fontSize={11} fontWeight={700} color={r.color}>{fmt(r.value)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate"
                    value={r.max > 0 ? Math.round((r.value/r.max)*100) : 0}
                    sx={{ height:8, borderRadius:4, "& .MuiLinearProgress-bar":{background:r.color} }} />
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography fontSize={11} color="text.secondary">Total capital impayé</Typography>
                <Typography fontSize={12} fontWeight={800} color={RED}>{fmtM(risk.total_capital_impaye??0)} FCFA</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" mt={0.5}>
                <Typography fontSize={11} color="text.secondary">Encours total</Typography>
                <Typography fontSize={12} fontWeight={700} color={STEEL}>{fmtM(risk.total_encours??0)} FCFA</Typography>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>

      {/* ── Risque par agence ───────────────────────────────────────────── */}
      {!riskLoading && agStatsRisk.length > 0 && (
        <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5} color={NAVY}>Risque par agence — capital impayé & dossiers critiques</Typography>
          <ResponsiveContainer width="100%" height={Math.max(agStatsRisk.length * 44, 160)}>
            <BarChart data={agStatsRisk} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="agence" width={210} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <RTooltip formatter={(v: any, n: any) => [fmt(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="souffrant" name="Souffrant" fill={RED}     radius={[0,3,3,0]} stackId="a" barSize={16} />
              <Bar dataKey="perte"     name="Perte"     fill="#7f1d1d" radius={[0,3,3,0]} stackId="a" barSize={16}>
                <LabelList dataKey="capital_impaye" position="right" style={{ fontSize: 10, fill: RED }}
                  formatter={(v: any) => v > 0 ? fmtM(v) : ""} />
              </Bar>
              <Bar dataKey="never_visited" name="Jamais visités" fill={ORANGE} radius={[0,3,3,0]} stackId="b" barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── Onglets principaux ──────────────────────────────────────────── */}
      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ background: NAVY, p: 2 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setStatus(""); setPage(0); }}
            sx={{ "& .MuiTab-root": { color: "rgba(255,255,255,0.7)", minHeight: 40 }, "& .Mui-selected": { color: GOLD } }}>
            <Tab label={`Tous (${fmt(kpi.total)})`} />
            <Tab label={`Jamais visités (${fmt(kpi.no_visit)})`} />
            <Tab label={`À relancer (${fmt(kpi.stale)})`} />
            <Tab label={
              <Stack direction="row" alignItems="center" spacing={1}>
                <span>🔥 Clients à risque</span>
                {(risk.risk_never_visited ?? 0) > 0 && (
                  <Chip
                    label={fmt(risk.risk_never_visited ?? 0)}
                    size="small"
                    sx={{ height: 18, fontSize: 10, fontWeight: 800, bgcolor: RED, color: "#fff", borderRadius: "9px" }}
                  />
                )}
              </Stack>
            } />
            <Tab label="Par agence" />
          </Tabs>
        </Box>

        {/* ── Filtres tableau visite ────────────────────────────────────── */}
        {tab < 3 && (
          <Box sx={{ p: 2, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Agence</InputLabel>
                <Select value={agenceFilter} label="Agence" onChange={e => { setAgence(e.target.value); setPage(0); }}>
                  <MenuItem value="">Toutes</MenuItem>
                  {agStatsVisit.map((a: any) => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                </Select>
              </FormControl>
              {tab === 0 && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Statut</InputLabel>
                  <Select value={statusFilter} label="Statut" onChange={e => { setStatus(e.target.value); setPage(0); }}>
                    <MenuItem value="">Tous</MenuItem>
                    <MenuItem value="recent">Visité 7j</MenuItem>
                    <MenuItem value="stale">Visité 30j</MenuItem>
                    <MenuItem value="no_visit">Jamais visité</MenuItem>
                  </Select>
                </FormControl>
              )}
              <TextField size="small" label="Recherche client / code" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 220 }} />
              <Typography fontSize={13} color="text.secondary">
                {isFetching && !listLoading ? "…" : fmt(totalCount)} clients
              </Typography>
            </Stack>
          </Box>
        )}

        {/* ── Tableau visite (onglets 0-2) ─────────────────────────────── */}
        {tab < 3 && (
          <>
            {isFetching && <LinearProgress sx={{ height: 2 }} />}
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ background: "#f8fafc" }}>
                    {["Client","Code","Agence","Statut visite","Visites total","7j","30j","Dernière visite"].map(h =>
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: 11 }}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading
                    ? Array.from({ length: 8 }).map((_,i) => (
                        <TableRow key={i}>{Array.from({length:8}).map((__,j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
                      ))
                    : clients.map((c: any) => {
                        const cfg = VISIT_CFG[c.visit_status as keyof typeof VISIT_CFG] ?? VISIT_CFG.no_visit;
                        const Icon = cfg.Icon;
                        return (
                          <TableRow key={c.id} hover>
                            <TableCell><Typography fontWeight={600} fontSize={13}>{c.name}</Typography></TableCell>
                            <TableCell><Chip label={c.code_client} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                            <TableCell><Typography fontSize={12}>{c.agence_client ?? "—"}</Typography></TableCell>
                            <TableCell>
                              <Chip icon={<Icon sx={{ fontSize:"14px !important", color:`${cfg.color} !important` }} />}
                                label={cfg.label} size="small"
                                sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
                            </TableCell>
                            <TableCell><Typography fontWeight={600} color={GOLD}>{c.total_visits}</Typography></TableCell>
                            <TableCell><Typography fontWeight={600}>{c.visits_7d}</Typography></TableCell>
                            <TableCell>{c.visits_30d}</TableCell>
                            <TableCell>
                              <Typography fontSize={11} color="text.secondary">
                                {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("fr-FR") : "Jamais"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </Box>
            <TablePagination component="div" count={totalCount} page={page}
              onPageChange={(_,p) => setPage(p)} rowsPerPage={rpp}
              onRowsPerPageChange={e => { setRpp(parseInt(e.target.value,10)); setPage(0); }}
              rowsPerPageOptions={ROWS_OPTIONS} labelRowsPerPage="Lignes"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${fmt(count)}`}
              sx={{ borderTop: "1px solid #e2e8f0" }} />
          </>
        )}

        {/* ── Onglet Clients à risque ───────────────────────────────────── */}
        {tab === 3 && (
          <Box>
            <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 2, pt: 1, bgcolor: "#fff9f9" }}>
              <Tabs value={riskTab} onChange={(_,v) => setRiskTab(v)}
                sx={{ "& .MuiTab-root": { fontSize: 12, minHeight: 38 }, "& .Mui-selected": { color: RED } }}>
                <Tab label={`🔥 Urgence absolue — Jamais visités (${fmt(unvisited.length)})`} />
                <Tab label={`Par CAF (${fmt(cafGroups.length)} agent(s) — ${fmt(topRisk.length)} dossier(s))`} />
              </Tabs>
            </Box>

            {riskLoading
              ? <Box p={3}>{Array.from({length:6}).map((_,i) => <Skeleton key={i} height={48} sx={{ mb:1 }} />)}</Box>
              : riskTab === 0
                ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ background: "#fff1f2" }}>
                          {["Client","Code","Agence","CAF","Statut risque","Retard","Capital impayé","Encours","Dernière visite"].map(h =>
                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: RED }}>{h}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unvisited.map((r: any, i: number) => (
                          <RiskClientRow key={i} r={r} showLastVisit />
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )
                : (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ background: "#fff1f2" }}>
                          {["","CAF (chargé d'affaires)","Agence","Clients à risque","Capital impayé","Encours global"].map(h =>
                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: RED }}>{h}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cafGroups.map((g) => (
                          <CafRiskGroupRow key={g.key} group={g} expanded={expandedCafs.has(g.key)} onToggle={() => toggleCaf(g.key)} />
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
          </Box>
        )}

        {/* ── Onglet Par agence ─────────────────────────────────────────── */}
        {tab === 4 && (
          <Box sx={{ p: 3 }}>
            {statsLoading
              ? Array.from({length:5}).map((_,i) => <Skeleton key={i} height={50} sx={{ mb:2 }} />)
              : agStatsVisit.map((a: any) => {
                  const riskA = agStatsRisk.find((r: any) => r.agence === a.name);
                  return (
                    <Box key={a.name} mb={3}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ApartmentIcon sx={{ fontSize: 16, color: NAVY }} />
                          <Typography fontWeight={700}>{a.name}</Typography>
                          {riskA && riskA.souffrant + riskA.perte > 0 && (
                            <Chip label={`${fmt(riskA.souffrant + riskA.perte)} à risque`} size="small"
                              sx={{ bgcolor:"#fee2e2", color:RED, fontWeight:700, fontSize:10 }} />
                          )}
                        </Stack>
                        <Stack direction="row" spacing={3} alignItems="center">
                          {riskA && riskA.capital_impaye > 0 && (
                            <Typography fontSize={12} fontWeight={700} color={RED}>{fmtM(riskA.capital_impaye)} FCFA impayés</Typography>
                          )}
                          <Typography fontSize={13} color="text.secondary">{fmt(a.visited)}/{fmt(a.total)} visités</Typography>
                          <Typography fontWeight={800} fontSize={18}
                            color={a.pct >= 70 ? GREEN : a.pct >= 40 ? ORANGE : RED}>{a.pct}%</Typography>
                        </Stack>
                      </Stack>
                      <LinearProgress variant="determinate" value={a.pct} sx={{
                        height: 10, borderRadius: 5,
                        bgcolor: "#fee2e2",
                        "& .MuiLinearProgress-bar": { background: a.pct >= 70 ? GREEN : a.pct >= 40 ? ORANGE : RED },
                      }} />
                    </Box>
                  );
                })}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
