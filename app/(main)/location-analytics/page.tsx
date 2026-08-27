"use client";

import { Fragment, useState } from "react";
import {
  Box, Typography, Paper, Stack, Card, CardContent,
  Select, MenuItem, FormControl, InputLabel, ToggleButton,
  ToggleButtonGroup, Tab, Tabs,
} from "@mui/material";
import {
  Area, Bar, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, BarChart,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

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
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocationOnIcon sx={{ color: GOLD, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={800} color="var(--text-primary)">Analytics Localisations</Typography>
            <Typography fontSize={13} color="text.secondary">Analyse approfondie des captures GPS terrain</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
            {[7, 15, 30, 90].map((d) => <ToggleButton key={d} value={d} sx={{ px: 2, fontSize: 12 }}>{d}j</ToggleButton>)}
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* KPI Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 3 }}>
        {[
          { label: `Total ${period}j`, value: totalPeriod.toLocaleString("fr-FR"), color: GOLD, icon: <LocationOnIcon /> },
          { label: "Moy. / jour", value: avgPerDay.toLocaleString("fr-FR"), color: STEEL, icon: <TrendingUpIcon /> },
          { label: "Jour pic", value: peakDay?.day?.slice(5) ?? "—", color: NAVY, icon: <AccessTimeIcon /> },
          { label: "Max / jour", value: peakDay?.count?.toLocaleString("fr-FR") ?? 0, color: "#d97706", icon: <TrendingUpIcon /> },
        ].map(({ label, value, color, icon }) => (
          <Card key={label} sx={{ border: `1px solid ${color}30` }}>
            <CardContent sx={{ pb: "16px !important" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontSize={11} fontWeight={700} color="text.secondary" textTransform="uppercase">{label}</Typography>
                  <Typography fontSize={26} fontWeight={800} color={color}>{value}</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ borderBottom: "1px solid #e2e8f0" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="Tendance temporelle" />
            <Tab label="Heatmap horaire" />
            <Tab label="Par type de lieu" />
            <Tab label="Par agent / agence" />
          </Tabs>
        </Box>

        {/* Tab 0: Trend */}
        {tab === 0 && (
          <Box sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Agence</InputLabel>
                <Select value={agenceFilter} label="Agence" onChange={(e) => setAgenceFilter(e.target.value)}>
                  <MenuItem value="">Toutes</MenuItem>
                  {agences.map((a: any) => <MenuItem key={a.id} value={String(a.id)}>{a.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={locPerDay}>
                <defs>
                  <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice?.(5) ?? v} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                <Legend />
                <Area type="monotone" dataKey="count" name="Captures" fill="url(#locGrad)" stroke={GOLD} strokeWidth={2} />
                <Line type="monotone" dataKey="count" name="Tendance" stroke={STEEL} strokeWidth={1} strokeDasharray="4 2" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tab 1: Heatmap */}
        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography fontSize={13} color="text.secondary" mb={2}>
              Intensité des captures par jour de la semaine et heure — {period} derniers jours
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "60px repeat(24,1fr)", gap: 0.5, minWidth: 800 }}>
                {/* Header hours */}
                <Box />
                {Array.from({ length: 24 }, (_, h) => (
                  <Typography key={h} fontSize={9} textAlign="center" color="text.secondary">{h}h</Typography>
                ))}
                {/* Rows per day */}
                {DOW_LABELS.map((dow, d) => (
                  // Fragment nommé (pas le raccourci <>) : un raccourci ne peut pas
                  // recevoir de `key`, ce qui cassait la réconciliation React sur
                  // cette liste et générait un avertissement "missing key" en console.
                  <Fragment key={d}>
                    <Typography fontSize={11} display="flex" alignItems="center" color="text.secondary">{dow}</Typography>
                    {Array.from({ length: 24 }, (_, h) => {
                      const count = heatMatrix.get(`${d}-${h}`) ?? 0;
                      const intensity = count / maxHeat;
                      const bg = intensity === 0 ? "#f1f5f9" : `rgba(60,128,71,${0.1 + intensity * 0.9})`;
                      return (
                        <Box
                          key={`${d}-${h}`}
                          title={`${dow} ${h}h: ${count} captures`}
                          sx={{ height: 28, borderRadius: 1, background: bg, cursor: "default", "&:hover": { outline: "2px solid #3C8047" } }}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </Box>
              <Stack direction="row" alignItems="center" spacing={1} mt={2} justifyContent="center">
                <Typography fontSize={11} color="text.secondary">Faible</Typography>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                  <Box key={v} sx={{ width: 24, height: 16, borderRadius: 1, background: `rgba(60,128,71,${v})` }} />
                ))}
                <Typography fontSize={11} color="text.secondary">Élevé</Typography>
              </Stack>
            </Box>
          </Box>
        )}

        {/* Tab 2: By type */}
        {tab === 2 && (
          <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={100} />
                <RTooltip />
                <Bar dataKey="count" name="Captures" fill={GOLD} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tab 3: By agent/agence */}
        {tab === 3 && (
          <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <Box>
              <Typography fontWeight={700} mb={2} color="var(--text-primary)">Top agents ({period}j)</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byUser.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="user_name" type="category" tick={{ fontSize: 10 }} width={110} />
                  <RTooltip />
                  <Bar dataKey="locations_count" name="Captures" fill={STEEL} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Typography fontWeight={700} mb={2} color="var(--text-primary)">Par agence ({period}j)</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byAgence}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="agence_name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Bar dataKey="locations_count" name="Captures" fill={GOLD} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
