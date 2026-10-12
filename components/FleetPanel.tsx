"use client";
import { useLiveInterval } from "@/lib/realtime/RealtimeProvider";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, BellRing, History, ListFilter, MapPin, RefreshCw, Smartphone, Wifi, WifiOff } from "lucide-react";

import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Panel, Th } from "@/components/ui/page-blocks";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

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

/**
 * Tableau de bord de la flotte mobile (appareils SiteCheck). Partagé entre la page « Flotte Mobile »
 * (avec son titre) et l'onglet « Flotte mobile » des Agents terrain (sans titre).
 */
export function FleetPanel({ withHeader = false }: { withHeader?: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [agenceFilter, setAgenceFilter] = useState("");
  const [notifDialog, setNotifDialog] = useState<any>(null);
  const [notifMsg, setNotifMsg] = useState("");

  // Temps réel : le polling ne sert plus que de filet de sécurité tant que le WebSocket est connecté.
  const fleetPollMs = useLiveInterval(30_000);
  const { data: fleet = [], isLoading, refetch } = useQuery({
    queryKey: ["mobile-fleet"],
    queryFn: () => apiFetch("/users/mobile-fleet"),
    refetchInterval: fleetPollMs,
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
    <div className="p-6">
      <div className={`mb-6 flex items-center ${withHeader ? "justify-between" : "justify-start"}`}>
        {withHeader && (
          <div className="flex items-center gap-3">
            <Smartphone size={32} className="text-[#3C8047]" />
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Flotte Mobile</h1>
              <p className="text-[13px] text-muted-foreground">Gestion et supervision des appareils SiteCheck terrain</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center gap-2 rounded-full bg-green-100 px-3 text-[13px] font-bold text-green-700">
            <span className="size-2 rounded-full bg-green-400" /> {online} en ligne
          </span>
          <Tooltip title="Actualiser (auto 30s)">
            <button type="button" aria-label="Actualiser" onClick={() => refetch()} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-muted">
              <RefreshCw size={20} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Agents actifs", value: users.filter((u) => u.is_active).length, color: "#16a34a", icon: <Wifi size={22} /> },
          { label: "En ligne (1h)", value: online, color: GOLD, icon: <Smartphone size={22} /> },
          { label: "Captures aujourd'hui", value: totalCapturesToday, color: STEEL, icon: <MapPin size={22} /> },
          { label: "Bloqués", value: users.filter((u) => !u.is_active).length, color: "#dc2626", icon: <Ban size={22} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm" style={{ border: `1px solid ${color}30` }}>
            <div>
              <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
              <div className="text-[28px] font-extrabold" style={{ color }}>{value}</div>
            </div>
            <span className="flex size-11 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}>{icon}</span>
          </div>
        ))}
      </div>

      {/* Sync logs summary */}
      {syncLogs.length > 0 && (
        <Panel className="mb-6 rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <History size={20} className="text-[#1E6091]" />
            <h2 className="font-bold text-foreground">Historique synchronisations récentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  {["Date", "Réussies", "Échouées", "Action", "Ignorées"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLogs.slice(0, 5).map((log: any) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-2 text-xs">{new Date(log.logged_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-2 font-bold text-green-600">{log.succeeded}</td>
                    <td className={`px-4 py-2 font-bold ${log.failed > 0 ? "text-red-600" : "text-muted-foreground/60"}`}>{log.failed}</td>
                    <td className="px-4 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{log.action ?? "sync"}</span></td>
                    <td className="px-4 py-2 text-xs">{log.dropped ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Filters */}
      <Panel className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <ListFilter size={20} className="text-muted-foreground" />
          <Select aria-label="Agence" value={agenceFilter} onChange={(e) => setAgenceFilter(e.target.value)} className="w-44">
            <option value="">Toutes les agences</option>
            {agences.map((a: any) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </Select>
          <Input placeholder="Recherche agent" aria-label="Recherche agent" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          {isLoading && <Spinner />}
          <span className="text-[13px] text-muted-foreground">{filtered.length} agents</span>
        </div>
      </Panel>

      {/* Fleet table */}
      <Panel className="overflow-hidden rounded-2xl">
        <div className="bg-[#0F3B5C] p-4">
          <h2 className="font-bold text-white">Tableau de bord flotte mobile</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-alt">
                {["Agent", "Rôle", "Agence", "Statut app", "Auj.", "7j", "Dernière activité", "Actif", "Actions"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-[11px] font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{isLoading ? "Chargement…" : "Aucun agent"}</td></tr>
              )}
              {filtered.map((u: any) => {
                // Statut/activité basés sur la plus récente activité authentifiée
                // (requête app OU capture GPS) — un agent connecté sans capture
                // récente reste "en ligne".
                const activity = lastActivity(u);
                const mins = activity ? (Date.now() - new Date(activity).getTime()) / 60000 : Infinity;
                const appStatus = mins < 60
                  ? { label: "En ligne", color: "#16a34a", Icon: Wifi }
                  : mins < 480
                  ? { label: "Récent", color: "#d97706", Icon: Wifi }
                  : { label: "Hors ligne", color: "#94a3b8", Icon: WifiOff };
                const Icon = appStatus.Icon;
                return (
                  <tr key={u.id} className={`border-b border-border hover:bg-muted ${u.is_active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="relative">
                          <span className="flex size-[30px] items-center justify-center rounded-full bg-[#1E6091] text-xs text-white">{u.name?.[0]}</span>
                          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white" style={{ background: appStatus.color }} />
                        </span>
                        <div>
                          <div className="text-[13px] font-semibold">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2"><span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px]">{u.role_name ?? "?"}</span></td>
                    <td className="px-4 py-2 text-xs">{displayAgence(u)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${appStatus.color}20`, color: appStatus.color }}>
                        <Icon size={14} /> {appStatus.label}
                      </span>
                    </td>
                    <td className={`px-4 py-2 font-bold ${u.locations_24h > 0 ? "text-[#3C8047]" : "text-muted-foreground/60"}`}>{u.locations_24h ?? 0}</td>
                    <td className="px-4 py-2 font-semibold">{u.locations_7d ?? 0}</td>
                    {/* Colonne "Dernière activité" : la plus récente entre capture GPS et requête app */}
                    <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">{minutesAgo(activity)}</td>
                    <td className="px-4 py-2">
                      <Tooltip title={u.is_active ? "Bloquer cet agent" : "Réactiver"}>
                        <Switch
                          aria-label={`Activer ${u.name}`}
                          checked={!!u.is_active}
                          onCheckedChange={(v) => toggleUser({ userId: u.id, active: v })}
                          className={u.is_active ? "bg-[#3C8047]" : ""}
                        />
                      </Tooltip>
                    </td>
                    <td className="px-4 py-2">
                      <Tooltip title="Envoyer une notification">
                        <button type="button" aria-label="Envoyer une notification" onClick={() => setNotifDialog(u)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-muted">
                          <BellRing size={18} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Send notification dialog */}
      <Dialog open={!!notifDialog} onOpenChange={(o) => !o && setNotifDialog(null)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          <DialogHeader icon={<BellRing size={18} />}>Envoyer une notification à {notifDialog?.name}</DialogHeader>
          <DialogBody>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Message</span>
              <Textarea rows={3} autoFocus value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} />
            </label>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setNotifDialog(null)}>Annuler</Button>
            <Button disabled={!notifMsg.trim() || sending} onClick={() => sendNotif({ userId: notifDialog.id, message: notifMsg })}>
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
