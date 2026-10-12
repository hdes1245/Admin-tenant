"use client";

import { Fragment, useState } from "react";
import {
  Area, Bar, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, BarChart,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import { Select } from "@/components/ui/select";
import { Panel } from "@/components/ui/page-blocks";
import { Segmented, TabBar } from "@/components/ui/tabs";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD = "#3C8047";

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.data)) return v.data;
  return [];
}

const PIE_COLORS = [NAVY, STEEL, GOLD, "#059669", "#DC2626", "#D97706", "#7c3aed", "#0ea5e9"];
const DOW_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function apiFetch(path: string) {
  return apiClient.get(path).then((r) => r.data);
}

export default function LocationAnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const [tab, setTab] = useState(0);
  const [agenceFilter, setAgenceFilter] = useState("");

  const { data: locPerDayRaw } = useQuery({
    queryKey: ["loc-per-day", period, agenceFilter],
    queryFn: () => apiFetch(`/locations/per-day?days=${period}${agenceFilter ? `&agenceId=${agenceFilter}` : ""}`),
  });

  const { data: heatmapRaw } = useQuery({
    queryKey: ["loc-heatmap", period],
    queryFn: () => apiFetch(`/locations/heatmap?days=${period}`),
  });

  const { data: byTypeRaw } = useQuery({
    queryKey: ["loc-by-type", period],
    queryFn: () => apiFetch(`/locations/by-type?days=${period}`),
  });

  const { data: byUserRaw } = useQuery({
    queryKey: ["loc-by-user", period],
    queryFn: () => apiFetch(`/locations/by-user?days=${period}&limit=15`),
  });

  const { data: byAgenceRaw } = useQuery({
    queryKey: ["loc-by-agence", period],
    queryFn: () => apiFetch(`/locations/by-agence?days=${period}`),
  });

  // queryKey partagé ["agences"] avec les autres pages ⇒ fetcher mappé
  // obligatoire (fetchAgences), sinon empoisonnement du cache React Query
  // avec la forme brute {COD_AGENCE, NOM_AGENCE}.
  const { data: agencesRaw } = useQuery({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });

  // Normalisation défensive — Recharts exige impérativement des tableaux
  const locPerDay = arr(locPerDayRaw);
  const heatmapData = arr(heatmapRaw);
  const byType = arr(byTypeRaw);
  const byUser = arr(byUserRaw);
  const byAgence = arr(byAgenceRaw);
  const agences = arr(agencesRaw);

  const totalPeriod = locPerDay.reduce((s: number, d: any) => s + (d.count ?? 0), 0);
  const avgPerDay = locPerDay.length ? Math.round(totalPeriod / locPerDay.length) : 0;
  const peakDay = [...locPerDay].sort((a: any, b: any) => b.count - a.count)[0];

  // Build heatmap matrix
  const heatMatrix = new Map<string, number>();
  for (const h of heatmapData) heatMatrix.set(`${h.dow}-${h.hour}`, h.count);
  const maxHeat = Math.max(1, ...heatmapData.map((h: any) => h.count));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin size={32} className="text-[#3C8047]" />
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Analytics Localisations</h1>
            <p className="text-[13px] text-muted-foreground">Analyse approfondie des captures GPS terrain</p>
          </div>
        </div>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[7, 15, 30, 90].map((d) => ({ value: d, label: `${d}j` }))}
        />
      </div>

      {/* KPI Row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: `Total ${period}j`, value: totalPeriod.toLocaleString("fr-FR"), color: GOLD, icon: <MapPin size={22} /> },
          { label: "Moy. / jour", value: avgPerDay.toLocaleString("fr-FR"), color: STEEL, icon: <TrendingUp size={22} /> },
          { label: "Jour pic", value: peakDay?.day?.slice(5) ?? "—", color: NAVY, icon: <Clock size={22} /> },
          { label: "Max / jour", value: peakDay?.count?.toLocaleString("fr-FR") ?? 0, color: "#d97706", icon: <TrendingUp size={22} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm" style={{ border: `1px solid ${color}30` }}>
            <div>
              <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
              <div className="text-[26px] font-extrabold" style={{ color }}>{value}</div>
            </div>
            <span className="flex size-11 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}>{icon}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Panel className="overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4">
          <TabBar tabs={["Tendance temporelle", "Heatmap horaire", "Par type de lieu", "Par agent / agence"]} value={tab} onChange={setTab} />
        </div>

        {/* Tab 0: Trend */}
        {tab === 0 && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-4">
              <Select aria-label="Agence" value={agenceFilter} onChange={(e) => setAgenceFilter(e.target.value)} className="w-44">
                <option value="">Toutes les agences</option>
                {agences.map((a: any) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={locPerDay}>
                <defs>
                  <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickFormatter={(v) => v?.slice?.(5) ?? v} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <RTooltip />
                <Legend wrapperStyle={{ color: "var(--text-secondary)" }} />
                <Area type="monotone" dataKey="count" name="Captures" fill="url(#locGrad)" stroke={GOLD} strokeWidth={2} />
                <Line type="monotone" dataKey="count" name="Tendance" stroke={STEEL} strokeWidth={1} strokeDasharray="4 2" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 1: Heatmap */}
        {tab === 1 && (
          <div className="p-6">
            <p className="mb-4 text-[13px] text-muted-foreground">
              Intensité des captures par jour de la semaine et heure — {period} derniers jours
            </p>
            <div className="overflow-x-auto">
              <div className="grid min-w-[800px] gap-1" style={{ gridTemplateColumns: "60px repeat(24,1fr)" }}>
                {/* Header hours */}
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-[9px] text-muted-foreground">{h}h</div>
                ))}
                {/* Rows per day */}
                {DOW_LABELS.map((dow, d) => (
                  // Fragment nommé (pas le raccourci <>) : un raccourci ne peut pas
                  // recevoir de `key`, ce qui cassait la réconciliation React sur
                  // cette liste et générait un avertissement "missing key" en console.
                  <Fragment key={d}>
                    <div className="flex items-center text-[11px] text-muted-foreground">{dow}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const count = heatMatrix.get(`${d}-${h}`) ?? 0;
                      const intensity = count / maxHeat;
                      const bg = intensity === 0 ? "var(--bg-hover)" : `rgba(60,128,71,${0.1 + intensity * 0.9})`;
                      return (
                        <div
                          key={`${d}-${h}`}
                          title={`${dow} ${h}h: ${count} captures`}
                          className="h-7 cursor-default rounded hover:outline-2 hover:outline-[#3C8047]"
                          style={{ background: bg }}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-[11px] text-muted-foreground">Faible</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                  <span key={v} className="block h-4 w-6 rounded" style={{ background: `rgba(60,128,71,${v})` }} />
                ))}
                <span className="text-[11px] text-muted-foreground">Élevé</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: By type */}
        {tab === 2 && (
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={110}
                  label={(p: any) => `${p?.type ?? "?"}: ${Math.round((p?.percent ?? 0) * 100)}%`} labelLine>
                  {byType.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} width={100} />
                <RTooltip />
                <Bar dataKey="count" name="Captures" fill={GOLD} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 3: By agent/agence */}
        {tab === 3 && (
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <div>
              <h3 className="mb-4 font-bold text-foreground">Top agents ({period}j)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byUser.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                  <YAxis dataKey="user_name" type="category" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} width={110} />
                  <RTooltip />
                  <Bar dataKey="locations_count" name="Captures" fill={STEEL} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="mb-4 font-bold text-foreground">Par agence ({period}j)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byAgence}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="agence_name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                  <RTooltip />
                  <Bar dataKey="locations_count" name="Captures" fill={GOLD} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
