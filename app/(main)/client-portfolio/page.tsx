"use client";
import { useLiveInterval } from "@/lib/realtime/RealtimeProvider";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Building, ChevronDown, CircleAlert, CircleCheck, Clock, Flame, ShieldAlert, Phone, RefreshCw, Store,
  TriangleAlert, TrendingDown, UserX,
} from "lucide-react";

import { apiClient } from "@/lib/apiClient";
import { KpiInfoIcon } from "@/components/KpiInfoIcon";
import { VirtualTable } from "@/components/VirtualTable";
import { PaginationBar } from "@/components/PaginationBar";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Panel, ProgressBar } from "@/components/ui/page-blocks";

const NAVY   = "#0F3B5C";
const STEEL  = "#1E6091";
const GOLD   = "#3C8047";
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
  recent:   { label: "Visité 7j",     color: GREEN,  bg: "#dcfce7", Icon: CircleCheck },
  stale:    { label: "Visité 30j",    color: ORANGE, bg: "#fef3c7", Icon: TriangleAlert },
  no_visit: { label: "Jamais visité", color: RED,    bg: "#fee2e2", Icon: CircleAlert },
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
    <div className="relative rounded-xl bg-surface p-4 shadow-sm" style={{ border: `1px solid ${color}25` }}>
      {urgent && <span className="absolute -right-1.5 -top-1.5 size-3.5 rounded-full bg-red-600 shadow-[0_0_0_3px_#fee2e2]" />}
      {info && <KpiInfoIcon text={info} color={color} />}
      <div className="mb-1 flex items-center gap-2">
        {Icon && <Icon size={16} style={{ color }} />}
        <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-[28px] font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Pill({ label, color, bg, className = "" }: { label: React.ReactNode; color: string; bg: string; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`} style={{ background: bg, color }}>{label}</span>;
}

function RiskBadge({ score }: { score: number }) {
  const cfg = RISK_CFG[score] ?? RISK_CFG[0];
  return <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} />;
}

function CodeOutline({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-border-strong px-2 py-0.5 text-[10px]">{children}</span>;
}

function isGenericCafName(name: string) { return /^(GESTIONNAIRE_INCONNU|INCONNU)$/i.test(name.trim()); }

function cafDisplayLabel(r: any): string {
  const code = r.code_charge_affaire ? String(r.code_charge_affaire).trim() : "";
  const name = r.charge_affaire ? String(r.charge_affaire).trim() : "";
  if (name && !isGenericCafName(name)) return name;
  if (name && code) return `${name} (${code})`;
  return code || "—";
}

// Hauteur fixe d'une ligne client à risque (nom + téléphone sur 2 lignes).
const RISK_ROW_HEIGHT = 60;

function RiskClientRow({ r, showLastVisit = true }: { r: any; showLastVisit?: boolean }) {
  const bg = r.risk_score === 4 ? "bg-red-600/[0.14]" : r.risk_score === 3 ? "bg-red-600/[0.08]" : "";
  const retardColor = r.nombre_jour_retard > 90 ? "#b91c1c" : r.nombre_jour_retard > 30 ? RED : ORANGE;
  return (
    <tr style={{ height: RISK_ROW_HEIGHT }} className={`border-b border-border hover:bg-red-600/[0.18] ${bg}`}>
      <td className="px-4 py-2">
        <div className="text-[13px] font-bold">{r.full_name ?? "—"}</div>
        {r.phone && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Phone size={11} /> {r.phone}</div>
        )}
      </td>
      <td className="px-4 py-2"><CodeOutline>{r.client_ref}</CodeOutline></td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-1 text-xs"><Building size={12} className="text-muted-foreground" /> {r.agence ?? "—"}</span>
      </td>
      <td className="px-4 py-2 text-[11px] text-muted-foreground">{cafDisplayLabel(r)}</td>
      <td className="px-4 py-2">
        {r.risk_score !== undefined ? <RiskBadge score={r.risk_score} /> : <Pill label={r.risk_label ?? r.statut ?? "—"} color={RED} bg="#fee2e2" />}
      </td>
      <td className="px-4 py-2 text-xs font-bold" style={{ color: retardColor }}>{r.nombre_jour_retard > 0 ? `${fmt(r.nombre_jour_retard)}j` : "—"}</td>
      <td className="px-4 py-2 text-xs font-extrabold text-red-600">{r.capital_impaye > 0 ? `${fmtM(r.capital_impaye)} FCFA` : "—"}</td>
      <td className="px-4 py-2 text-xs text-[#1E6091]">{r.encours_global > 0 ? `${fmtM(r.encours_global)} FCFA` : "—"}</td>
      {showLastVisit && (
        <td className="px-4 py-2">
          {r.last_visit
            ? <span className="text-[11px] text-muted-foreground">{new Date(r.last_visit).toLocaleDateString("fr-FR")}</span>
            : <Pill label="Jamais" color={RED} bg="#fee2e2" className="text-[9px]" />}
        </td>
      )}
    </tr>
  );
}

const riskHeadCell = "px-4 py-2.5 text-left font-bold text-red-600 bg-[#fdecec] dark:bg-[#3a1d22]";

function CafRiskGroupRow({ group, expanded, onToggle }: { group: any; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-b border-border hover:bg-muted ${expanded ? "bg-red-600/10" : ""}`}>
        <td className="w-10 px-4 py-2">
          <ChevronDown size={18} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </td>
        <td className="px-4 py-2 text-[13px] font-bold">{group.chargeAffaire}</td>
        <td className="px-4 py-2">
          <span className="flex items-center gap-1 text-xs"><Building size={12} className="text-muted-foreground" /> {group.agence}</span>
        </td>
        <td className="px-4 py-2"><Pill label={`${fmt(group.clients.length)} client(s)`} color={RED} bg="#fee2e2" /></td>
        <td className="px-4 py-2 text-xs font-extrabold text-red-600">{fmtM(group.capitalImpaye)} FCFA</td>
        <td className="px-4 py-2 text-xs text-[#1E6091]">{fmtM(group.encoursGlobal)} FCFA</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="border-b-2 border-border p-0">
            <div className="bg-muted/30 p-4">
              <VirtualTable
                items={group.clients}
                rowHeight={RISK_ROW_HEIGHT}
                maxHeight="calc(50vh / var(--ui-zoom))"
                columns={8}
                head={
                  <thead>
                    <tr className="text-[10px]">
                      {["Client","Code","Agence","CAF","Statut risque","Retard","Capital impayé","Encours"].map((h) => <th key={h} className={riskHeadCell}>{h}</th>)}
                    </tr>
                  </thead>
                }
                renderRow={(r: any, i: number) => <RiskClientRow key={r.client_ref ?? i} r={r} showLastVisit={false} />}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Légende d'un graphique en anneau : pastille, libellé, valeur, pourcentage, barre. */
function DonutLegend({ items, pctOf }: { items: { name: string; value: number; color: string }[]; pctOf: number }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((d) => {
        const pct = pctOf ? Math.round((d.value / pctOf) * 100) : 0;
        return (
          <div key={d.name}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="text-xs font-medium">{d.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-extrabold" style={{ color: d.color }}>{fmt(d.value)}</span>
                <span className="rounded-full px-2 text-[10px] font-bold leading-[18px]" style={{ background: `${d.color}18`, color: d.color }}>{pct}%</span>
              </span>
            </div>
            <ProgressBar value={pct} color={d.color} track={`${d.color}20`} className="h-[5px]" />
          </div>
        );
      })}
    </div>
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
  const portfolioPollMs = useLiveInterval(120_000);
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["client-coverage-stats"],
    queryFn:  () => apiFetch("/clients/coverage/stats"),
    staleTime: 60_000, refetchInterval: portfolioPollMs,
  });

  const { data: riskData, isLoading: riskLoading, refetch: refetchRisk } = useQuery({
    queryKey: ["client-risk-analysis"],
    queryFn:  () => apiFetch("/clients/risk-analysis"),
    staleTime: 60_000, refetchInterval: portfolioPollMs,
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

  const pieVisit = [
    { name: "Visité 7j",     value: kpi.recent,   color: GREEN },
    { name: "Visité 30j",    value: kpi.stale,     color: ORANGE },
    { name: "Jamais visité", value: kpi.no_visit,  color: RED },
  ];

  const pieRisk = [
    { name: "Souffrant",  value: risk.souffrant ?? 0, color: RED },
    { name: "Perte",      value: risk.perte     ?? 0, color: "#b91c1c" },
    { name: "Encours",    value: risk.encours   ?? 0, color: ORANGE },
  ];
  const riskPieTotal = (risk.souffrant ?? 0) + (risk.perte ?? 0) + (risk.encours ?? 0);

  const refetch = () => { refetchStats(); refetchRisk(); refetchList(); };

  const criticalUnvisited = risk.risk_never_visited ?? 0;

  const tabCls = (active: boolean) =>
    `min-h-10 shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 text-sm font-medium transition-colors ${
      active ? "text-[#4ADE80] shadow-[inset_0_-2.5px_0_0_#4ADE80]" : "text-white/70 hover:text-white"
    }`;

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store size={32} className="text-[#3C8047]" />
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Portefeuille Clients</h1>
            <p className="text-[13px] text-muted-foreground">Centre d&apos;analyse — couverture visites &amp; risque crédit</p>
          </div>
        </div>
        <Tooltip title="Actualiser">
          <button type="button" aria-label="Actualiser" onClick={refetch} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-muted"><RefreshCw size={20} /></button>
        </Tooltip>
      </div>

      {/* ── Alertes prioritaires ────────────────────────────────────────── */}
      {!riskLoading && criticalUnvisited > 0 && (
        <Alert severity="error" className="mb-4 flex items-start gap-2 font-semibold">
          <Flame size={20} className="mt-0.5 shrink-0" />
          <span>
            <strong>{fmt(criticalUnvisited)} client(s) à risque n&apos;ont jamais été visités.</strong>{" "}
            Intervention urgente recommandée — capital impayé exposé : <strong>{fmtM(risk.total_capital_impaye ?? 0)} FCFA</strong>
          </span>
        </Alert>
      )}
      {!riskLoading && (risk.retard_90j ?? 0) > 0 && (
        <Alert severity="warning" className="mb-6 flex items-start gap-2">
          <ShieldAlert size={20} className="mt-0.5 shrink-0" />
          <span><strong>{fmt(risk.retard_90j)} dossier(s)</strong> en retard de plus de 90 jours — classement souffrant/perte probable.</span>
        </Alert>
      )}

      {/* ── KPI Visite + Risque ─────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsLoading || riskLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4"><Skeleton className="mb-2 h-4 w-3/4" /><Skeleton className="h-10" /></div>
            ))
          : <>
              <KpiCard label="Total clients" value={fmt(kpi.total)} color={NAVY} icon={Store}
                info="Nombre total de clients enregistrés dans ce tenant." />
              <KpiCard label="Couverture 7j" value={`${cov7d}%`} color={GREEN} icon={CircleCheck}
                sub={<ProgressBar value={cov7d} color={GREEN} className="mt-1 h-[5px]" />}
                info="Pourcentage de clients ayant reçu au moins une visite au cours des 7 derniers jours." />
              <KpiCard label="Jamais visités" value={fmt(kpi.no_visit)} color={RED} icon={UserX}
                sub={`${kpi.total ? Math.round((kpi.no_visit / kpi.total) * 100) : 0}% du portefeuille`} urgent
                info="Clients n'ayant jamais eu de localisation ou de visite enregistrée." />
              <KpiCard label="À relancer" value={fmt(kpi.stale)} color={ORANGE} icon={Clock}
                info="Clients visités il y a plus de 7 jours mais moins de 30 jours (couverture 30j hors couverture 7j)." />
              <KpiCard label="Dossiers à risque" value={fmt(risk.total_risk ?? 0)} color={STEEL} icon={ShieldAlert}
                info="Nombre total de dossiers classés en risque crédit (souffrance, perte ou encours en retard)." />
              <KpiCard label="Souffrant / Perte" value={fmt((risk.souffrant ?? 0) + (risk.perte ?? 0))} color={RED} icon={TrendingDown} urgent
                info="Dossiers dont le statut de risque est Souffrance ou Perte, les niveaux de risque les plus critiques." />
              <KpiCard label="Capital impayé" value={fmtM(risk.total_capital_impaye ?? 0)} color="#b91c1c" icon={TrendingDown}
                sub="FCFA — total portefeuille"
                info="Somme du capital impayé cumulé sur l'ensemble des dossiers à risque du portefeuille." />
              <KpiCard label="Risque non visité" value={fmt(risk.risk_never_visited ?? 0)} color={RED} icon={UserX}
                sub={`+ ${fmt(risk.risk_not_visited_30d ?? 0)} non vus 30j`} urgent
                info="Clients à risque n'ayant jamais été visités sur le terrain (le sous-total indique ceux non visités depuis 30 jours)." />
            </>
        }
      </div>

      {/* ── Graphiques ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Répartition visite */}
        <Panel className="rounded-2xl p-5">
          <h3 className="mb-3 text-[13px] font-bold text-foreground">Répartition visites</h3>
          {statsLoading ? <Skeleton className="mx-auto size-[140px] rounded-full" /> : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieVisit} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38} strokeWidth={2}>
                  {/* stroke="none" : un trait visible entre tranches crée une encoche
                      (façon "C") quand une seule catégorie domine à ~100% */}
                  {pieVisit.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <RTooltip
                  formatter={(v: any, _: any, entry: any) => [`${fmt(v)} (${kpi.total ? Math.round((v / kpi.total) * 100) : 0}%)`, entry.name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <DonutLegend items={pieVisit} pctOf={kpi.total} />
        </Panel>

        {/* Répartition risque */}
        <Panel className="rounded-2xl p-5">
          <h3 className="mb-3 text-[13px] font-bold text-foreground">Répartition risque crédit</h3>
          {riskLoading ? <Skeleton className="mx-auto size-[140px] rounded-full" /> : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieRisk} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38} strokeWidth={2}>
                  {pieRisk.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <RTooltip
                  formatter={(v: any, _: any, entry: any) => [`${fmt(v)} (${riskPieTotal ? Math.round((v / riskPieTotal) * 100) : 0}%)`, entry.name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <DonutLegend items={pieRisk} pctOf={riskPieTotal} />
          <div className="mt-3 flex justify-between border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">Total dossiers risque</span>
            <span className="text-xs font-extrabold text-red-600">{fmt(risk.total_risk ?? 0)}</span>
          </div>
        </Panel>

        {/* Retard par tranche */}
        <Panel className="rounded-2xl p-5">
          <h3 className="mb-3 text-[13px] font-bold text-foreground">Retards par tranche</h3>
          {riskLoading ? <Skeleton className="h-40" /> : (
            <div>
              {[
                { label: "> 90 jours",    value: risk.retard_90j    ?? 0, color: RED,       max: risk.total_risk },
                { label: "31 – 90 jours", value: risk.retard_30_90j ?? 0, color: ORANGE,    max: risk.total_risk },
                { label: "1 – 30 jours",  value: risk.retard_1_30j  ?? 0, color: "#ca8a04", max: risk.total_risk },
              ].map((r) => (
                <div key={r.label} className="mb-3">
                  <div className="mb-0.5 flex justify-between">
                    <span className="text-[11px] font-semibold">{r.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: r.color }}>{fmt(r.value)}</span>
                  </div>
                  <ProgressBar value={r.max > 0 ? Math.round((r.value / r.max) * 100) : 0} color={r.color} />
                </div>
              ))}
              <hr className="my-3 border-border" />
              <div className="flex justify-between">
                <span className="text-[11px] text-muted-foreground">Total capital impayé</span>
                <span className="text-xs font-extrabold text-red-600">{fmtM(risk.total_capital_impaye ?? 0)} FCFA</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[11px] text-muted-foreground">Encours total</span>
                <span className="text-xs font-bold text-[#1E6091]">{fmtM(risk.total_encours ?? 0)} FCFA</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Risque par agence ───────────────────────────────────────────── */}
      {!riskLoading && agStatsRisk.length > 0 && (
        <Panel className="mb-6 rounded-2xl p-5">
          <h3 className="mb-3 text-[13px] font-bold text-foreground">Risque par agence — capital impayé &amp; dossiers critiques</h3>
          <ResponsiveContainer width="100%" height={Math.max(agStatsRisk.length * 44, 160)}>
            <BarChart data={agStatsRisk} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="agence" width={210} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
              <RTooltip formatter={(v: any, n: any) => [fmt(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: "var(--text-secondary)" }} />
              <Bar dataKey="souffrant" name="Souffrant" fill={RED}     radius={[0, 3, 3, 0]} stackId="a" barSize={16} />
              <Bar dataKey="perte"     name="Perte"     fill="#b91c1c" radius={[0, 3, 3, 0]} stackId="a" barSize={16}>
                <LabelList dataKey="capital_impaye" position="right" style={{ fontSize: 10, fill: RED }}
                  formatter={(v: any) => v > 0 ? fmtM(v) : ""} />
              </Bar>
              <Bar dataKey="never_visited" name="Jamais visités" fill={ORANGE} radius={[0, 3, 3, 0]} stackId="b" barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* ── Onglets principaux ──────────────────────────────────────────── */}
      <Panel className="overflow-hidden rounded-2xl">
        <div className="bg-[#0F3B5C] p-4">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {[
              <>Tous ({fmt(kpi.total)})</>,
              <>Jamais visités ({fmt(kpi.no_visit)})</>,
              <>À relancer ({fmt(kpi.stale)})</>,
              <span key="r" className="flex items-center gap-2">
                <span>🔥 Clients à risque</span>
                {(risk.risk_never_visited ?? 0) > 0 && (
                  <span className="rounded-[9px] bg-red-600 px-2 text-[10px] font-extrabold leading-[18px] text-white">{fmt(risk.risk_never_visited ?? 0)}</span>
                )}
              </span>,
              <>Par agence</>,
            ].map((label, i) => (
              <button key={i} type="button" role="tab" aria-selected={tab === i} className={tabCls(tab === i)}
                onClick={() => { setTab(i); setStatus(""); setPage(0); }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filtres tableau visite ────────────────────────────────────── */}
        {tab < 3 && (
          <div className="border-b border-border bg-surface-alt p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select aria-label="Agence" value={agenceFilter} onChange={(e) => { setAgence(e.target.value); setPage(0); }} className="w-44">
                <option value="">Toutes les agences</option>
                {agStatsVisit.map((a: any) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </Select>
              {tab === 0 && (
                <Select aria-label="Statut" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-40">
                  <option value="">Tous les statuts</option>
                  <option value="recent">Visité 7j</option>
                  <option value="stale">Visité 30j</option>
                  <option value="no_visit">Jamais visité</option>
                </Select>
              )}
              <Input placeholder="Recherche client / code" aria-label="Recherche client / code" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-56" />
              <span className="text-[13px] text-muted-foreground">{isFetching && !listLoading ? "…" : fmt(totalCount)} clients</span>
            </div>
          </div>
        )}

        {/* ── Tableau visite (onglets 0-2) ─────────────────────────────── */}
        {tab < 3 && (
          <>
            {isFetching && <div className="h-0.5 animate-pulse bg-[#1E6091]" />}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-alt">
                    {["Client", "Code", "Agence", "Statut visite", "Visites total", "7j", "30j", "Dernière visite"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-4 py-2"><Skeleton className="h-4" /></td>)}</tr>
                      ))
                    : clients.map((c: any) => {
                        const cfg = VISIT_CFG[c.visit_status as keyof typeof VISIT_CFG] ?? VISIT_CFG.no_visit;
                        const Icon = cfg.Icon;
                        return (
                          <tr key={c.id} className="border-b border-border hover:bg-muted">
                            <td className="px-4 py-2 text-[13px] font-semibold">{c.name}</td>
                            <td className="px-4 py-2"><CodeOutline>{c.code_client}</CodeOutline></td>
                            <td className="px-4 py-2 text-xs">{c.agence_client ?? "—"}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                <Icon size={14} /> {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-semibold text-[#3C8047]">{c.total_visits}</td>
                            <td className="px-4 py-2 font-semibold">{c.visits_7d}</td>
                            <td className="px-4 py-2">{c.visits_30d}</td>
                            <td className="px-4 py-2 text-[11px] text-muted-foreground">
                              {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("fr-FR") : "Jamais"}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 pb-4">
              <PaginationBar
                page={page + 1}
                totalPages={Math.max(1, Math.ceil(totalCount / rpp))}
                total={totalCount}
                pageSize={rpp}
                pageSizeOptions={ROWS_OPTIONS}
                onPageChange={(p) => setPage(p - 1)}
                onPageSizeChange={(s) => { setRpp(s); setPage(0); }}
              />
            </div>
          </>
        )}

        {/* ── Onglet Clients à risque ───────────────────────────────────── */}
        {tab === 3 && (
          <div>
            <div className="border-b border-border bg-red-600/5 px-4 pt-2">
              <div role="tablist" className="flex gap-1 overflow-x-auto">
                {[
                  `🔥 Urgence absolue — Jamais visités (${fmt(unvisited.length)})`,
                  `Par CAF (${fmt(cafGroups.length)} agent(s) — ${fmt(topRisk.length)} dossier(s))`,
                ].map((label, i) => (
                  <button key={i} type="button" role="tab" aria-selected={riskTab === i} onClick={() => setRiskTab(i)}
                    className={`min-h-[38px] shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 text-xs font-medium transition-colors ${
                      riskTab === i ? "text-red-600 shadow-[inset_0_-2.5px_0_0_currentColor]" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {riskLoading
              ? <div className="p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-2 h-12" />)}</div>
              : riskTab === 0
                ? (
                  <VirtualTable
                    items={unvisited}
                    rowHeight={RISK_ROW_HEIGHT}
                    maxHeight="calc(70vh / var(--ui-zoom))"
                    columns={9}
                    head={
                      <thead>
                        <tr className="text-[11px]">
                          {["Client", "Code", "Agence", "CAF", "Statut risque", "Retard", "Capital impayé", "Encours", "Dernière visite"].map((h) => <th key={h} className={riskHeadCell}>{h}</th>)}
                        </tr>
                      </thead>
                    }
                    renderRow={(r: any, i: number) => <RiskClientRow key={r.client_ref ?? i} r={r} showLastVisit />}
                  />
                )
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-red-600/[0.12] text-[11px]">
                          {["", "CAF (chargé d'affaires)", "Agence", "Clients à risque", "Capital impayé", "Encours global"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-red-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cafGroups.map((g) => (
                          <CafRiskGroupRow key={g.key} group={g} expanded={expandedCafs.has(g.key)} onToggle={() => toggleCaf(g.key)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          </div>
        )}

        {/* ── Onglet Par agence ─────────────────────────────────────────── */}
        {tab === 4 && (
          <div className="p-6">
            {statsLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-4 h-[50px]" />)
              : agStatsVisit.map((a: any) => {
                  const riskA = agStatsRisk.find((r: any) => r.agence === a.name);
                  const color = a.pct >= 70 ? GREEN : a.pct >= 40 ? ORANGE : RED;
                  return (
                    <div key={a.name} className="mb-6">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building size={16} className="text-foreground" />
                          <span className="font-bold">{a.name}</span>
                          {riskA && riskA.souffrant + riskA.perte > 0 && (
                            <Pill label={`${fmt(riskA.souffrant + riskA.perte)} à risque`} color={RED} bg="#fee2e2" />
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          {riskA && riskA.capital_impaye > 0 && (
                            <span className="text-xs font-bold text-red-600">{fmtM(riskA.capital_impaye)} FCFA impayés</span>
                          )}
                          <span className="text-[13px] text-muted-foreground">{fmt(a.visited)}/{fmt(a.total)} visités</span>
                          <span className="text-lg font-extrabold" style={{ color }}>{a.pct}%</span>
                        </div>
                      </div>
                      <ProgressBar value={a.pct} color={color} track="#fee2e2" className="h-2.5" />
                    </div>
                  );
                })}
          </div>
        )}
      </Panel>
    </div>
  );
}
