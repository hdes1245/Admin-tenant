"use client";
import { useLiveInterval } from "@/lib/realtime/RealtimeProvider";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw, Smartphone, TrendingUp, Trophy, Users, Wifi, ListFilter } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import { FleetPanel } from "@/components/FleetPanel";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { Panel } from "@/components/ui/page-blocks";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD = "#3C8047";

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.data)) return v.data;
  return [];
}

function apiFetch(path: string) {
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

function Bar({ value, color, className = "h-2" }: { value: number; color: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-muted ${className}`}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

// ── Onglet Performance ──────────────────────────────────────────────────────
function PerformanceTab() {
  const [period, setPeriod] = useState(30);
  const [agenceFilter, setAgenceFilter] = useState("");
  const [search, setSearch] = useState("");

  const teamPollMs = useLiveInterval(60_000);
  const { data: statsRaw, refetch } = useQuery({
    queryKey: ["team-stats", period],
    queryFn: () => apiFetch(`/users/stats?days=${period}`),
    refetchInterval: teamPollMs,
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

  const recentCount = users.filter((u) => agentStatus(lastActivity(u), u.locations_24h).label === "Récent").length;
  const sortedAgents = [...filtered].sort((a: any, b: any) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <Select aria-label="Période" value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="w-32">
          {[7, 15, 30, 90].map((d) => <option key={d} value={d}>{d} jours</option>)}
        </Select>
        <Tooltip title="Actualiser">
          <button type="button" aria-label="Actualiser" onClick={() => refetch()} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-muted">
            <RefreshCw size={20} />
          </button>
        </Tooltip>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Agents en ligne", value: onlineCount, color: "#16a34a", icon: <Wifi size={22} /> },
          { label: `Captures ${period}j`, value: totalCaptures30d.toLocaleString("fr-FR"), color: GOLD, icon: <MapPin size={22} /> },
          { label: "Captures aujourd'hui", value: totalCapturesToday, color: STEEL, icon: <TrendingUp size={22} /> },
          { label: "Meilleur agent", value: topPerformer?.name ?? "—", color: "#7c3aed", icon: <Trophy size={22} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm" style={{ border: `1px solid ${color}30` }}>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
              <div className={`truncate font-extrabold leading-tight ${label === "Meilleur agent" ? "text-base" : "text-[28px]"}`} style={{ color }}>{value}</div>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}>{icon}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel className="rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-foreground">Captures GPS / jour ({period}j)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={locPerDay}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickFormatter={(v) => v?.slice?.(5) ?? v} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
              <RTooltip />
              <Area type="monotone" dataKey="count" name="Captures" fill="url(#g1)" stroke={GOLD} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-foreground">Répartition activité</h3>
          <div className="grid gap-4">
            {[
              { label: "En ligne (< 1h)", count: onlineCount, color: "#16a34a" },
              { label: "Récent (< 8h)", count: recentCount, color: "#d97706" },
              { label: "Hors ligne", count: users.length - onlineCount - recentCount, color: "#94a3b8" },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-bold" style={{ color }}>{count}</span>
                </div>
                <Bar value={users.length ? Math.round((count / users.length) * 100) : 0} color={color} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Filters */}
      <Panel className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <ListFilter size={20} className="text-muted-foreground" />
          <Select aria-label="Agence" value={agenceFilter} onChange={(e) => setAgenceFilter(e.target.value)} className="w-44">
            <option value="">Toutes les agences</option>
            {agences.map((a: any) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </Select>
          <Input placeholder="Recherche agent" aria-label="Recherche agent" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <span className="text-[13px] text-muted-foreground">{filtered.length} agents</span>
        </div>
      </Panel>

      {/* Agent table */}
      <Panel className="overflow-hidden rounded-2xl">
        <div className="bg-[#0F3B5C] p-4"><h3 className="font-bold text-white">Tableau de performance agents</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                {["#", "Agent", "Rôle", "Agence", "Statut", "Auj.", `${period}j`, "Dernière capture", "Score"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Aucun agent</td></tr>
              )}
              {sortedAgents.map((u: any, i: number) => {
                const status = agentStatus(lastActivity(u), u.locations_24h ?? 0);
                const score = Math.min(100, (u.locations_30d ?? 0));
                const rankBg = i === 0 ? GOLD : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "var(--bg-hover)";
                return (
                  <tr key={u.id} className="border-b border-border hover:bg-muted" style={i < 3 ? { background: `${GOLD}06` } : undefined}>
                    <td className="px-4 py-2">
                      <span className="flex size-6 items-center justify-center rounded-full text-[11px] font-extrabold" style={{ background: rankBg, color: i < 3 ? "white" : NAVY }}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#1E6091] text-xs text-white">{u.name?.[0]}</span>
                        <div>
                          <div className="text-[13px] font-semibold">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2"><span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px]">{u.role_name ?? "?"}</span></td>
                    <td className="px-4 py-2 text-xs">{displayAgence(u)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${status.color}20`, color: status.color }}>{status.label}</span>
                    </td>
                    <td className={`px-4 py-2 font-bold ${u.locations_24h > 0 ? "text-[#3C8047]" : "text-muted-foreground/60"}`}>{u.locations_24h ?? 0}</td>
                    <td className="px-4 py-2 font-semibold">{u.locations_30d?.toLocaleString("fr-FR") ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">{minutesAgo(u.last_capture_at)}</td>
                    <td className="min-w-[110px] px-4 py-2">
                      <Bar value={score} color={score > 50 ? "#16a34a" : score > 20 ? "#d97706" : "#dc2626"} />
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{score} pts</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
// Vue réutilisable : rendue en page plein écran (défaut) ou intégrée sans son
// en-tête sombre dans la page « Analytics & Rapports » (embedded).
export function AgentsTerrainView({ embedded = false }: { embedded?: boolean }) {
  const [mainTab, setMainTab] = useState(0);

  return (
    <div>
      {/* Header (masqué lorsqu'intégré dans la page Analytics) */}
      {!embedded && (
        <div className="border-b-[3px] border-[#3C8047] px-8 py-5 text-white" style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}>
          <div className="flex items-center gap-3">
            <Users size={30} className="text-[#3C8047]" />
            <div>
              <h1 className="text-2xl font-extrabold text-white">Agents terrain</h1>
              <div className="text-[13px] text-white/60">Performance, suivi d&apos;activité et gestion de la flotte mobile</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border bg-surface px-6">
        {[
          { icon: <Users size={18} />, label: "Performance équipe" },
          { icon: <Smartphone size={18} />, label: "Flotte mobile" },
        ].map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={mainTab === i}
            onClick={() => setMainTab(i)}
            className={`flex min-h-12 cursor-pointer items-center gap-2 whitespace-nowrap border-0 bg-transparent px-4 text-[13px] font-semibold transition-colors ${
              mainTab === i ? "text-accent shadow-[inset_0_-2.5px_0_0_currentColor]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {mainTab === 0 && <PerformanceTab />}
      {mainTab === 1 && <FleetPanel />}
    </div>
  );
}
