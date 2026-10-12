"use client";

import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  createBroadcast,
  fetchBroadcasts,
  cancelBroadcast,
  BroadcastDto,
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  setAlertRuleActive,
  runAlertRuleNow,
  deleteAlertRule,
  AlertRuleDto,
  AlertCriterion,
} from "@/lib/notifications";
import { PaginationBar } from "@/components/PaginationBar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellRing, Check, CheckCheck, CircleCheck, Clock, Eye, Megaphone, Pencil, Play, Plus, Search, Send,
  Trash2, TriangleAlert, Users, X, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { TabBar } from "@/components/ui/tabs";
import { KpiTile, PageContainer, PageHeader, Panel } from "@/components/ui/page-blocks";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const PAGE_SIZE = 15;

const TENANT_ROLES = [
  { code: "caf",                     label: "CAF terrain" },
  { code: "chef_agence",             label: "Chef d'agence" },
  { code: "responsable_zone",        label: "Responsable de zone" },
  { code: "directrice_exploitation", label: "Directrice exploitation" },
  { code: "responsable_credit",      label: "Responsable crédit" },
  { code: "analyste_credit",         label: "Analyste crédit" },
  { code: "recouvrement",            label: "Recouvrement" },
  { code: "controleur",              label: "Contrôleur" },
  { code: "audit",                   label: "Audit" },
  { code: "admin_tenant",            label: "Admin tenant" },
];

const CRITERIA: {
  code: AlertCriterion; label: string; help: string;
  needsThreshold: boolean; needsTranches?: boolean; unit?: string; defaultThreshold?: number;
}[] = [
  { code: "RISK_TRANCHE",      label: "Tranches de retard (PAR)",       help: "Alerte sur une ou plusieurs tranches d'ancienneté de retard.", needsThreshold: false, needsTranches: true },
  { code: "DAYS_LATE",         label: "Jours de retard ≥ seuil",        help: "Alerte quand un dossier dépasse le nombre de jours de retard.", needsThreshold: true, unit: "jours", defaultThreshold: 30 },
  { code: "UNPAID_CAPITAL",    label: "Capital impayé ≥ seuil",         help: "Alerte quand le capital impayé d'un client dépasse le montant.", needsThreshold: true, unit: "FCFA", defaultThreshold: 500000 },
  { code: "RISK_STATUS_ENTRY", label: "Entrée en statut à risque",      help: "Alerte dès qu'un dossier passe en statut SO / PE / DC.", needsThreshold: false },
  { code: "UPCOMING_DUE",      label: "Échéance proche (≤ N jours)",    help: "Alerte X jours avant une échéance pour anticiper le recouvrement.", needsThreshold: true, unit: "jours", defaultThreshold: 7 },
];

// Tranches de retard (buckets PAR) — codes alignés avec le backend.
const TRANCHES = [
  { code: "1_30",     label: "1–30 j" },
  { code: "31_90",    label: "31–90 j" },
  { code: "91_180",   label: "91–180 j" },
  { code: "181_360",  label: "181–360 j" },
  { code: "361_plus", label: "+360 j" },
];
const trancheLabel = (code: string) => TRANCHES.find((t) => t.code === code)?.label ?? code;

function criterionMeta(code: AlertCriterion) {
  return CRITERIA.find((c) => c.code === code) ?? CRITERIA[0];
}

function alertSummary(r: AlertRuleDto): string {
  const m = criterionMeta(r.criterion);
  if (m.needsTranches) {
    const labels = (r.tranches ?? []).map(trancheLabel);
    return labels.length ? `Retard : ${labels.join(", ")}` : "Tranches de retard";
  }
  if (!m.needsThreshold) return m.label;
  const val = m.unit === "FCFA"
    ? `${Math.round(Number(r.threshold ?? 0)).toLocaleString("fr-FR")} FCFA`
    : `${r.threshold} ${m.unit}`;
  return `${m.label.replace(/seuil.*/, "").trim()} ${val}`;
}

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return value; }
}

function fmtDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Petite pastille colorée. */
function Tag({ bg, color, children, className = "" }: { bg: string; color: string; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-[18px] ${className}`} style={{ background: bg, color }}>{children}</span>;
}

const subLabel = "mb-1.5 block text-xs font-bold uppercase tracking-[0.8px] text-muted-foreground";

// ── Onglet Mes notifications ──────────────────────────────────────────────────
function MyNotificationsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ["my-notifications", page],
    queryFn: () => fetchMyNotifications({ page, limit: PAGE_SIZE }),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const items = notificationsQuery.data?.items ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const totalPages = notificationsQuery.data?.totalPages ?? 1;
  const unread = items.filter((n) => !n.isRead).length;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div>
      <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher dans les notifications..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
            {search && (
              <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
            )}
          </div>
          <Button
            variant="outline" size="sm" className="shrink-0 border-[#0F3B5C] font-semibold"
            onClick={async () => { setActionError(null); try { await markAllMutation.mutateAsync(); } catch (e) { setActionError(e instanceof Error ? e.message : "Erreur"); } }}
            disabled={markAllMutation.isPending || unread === 0}
          >
            <CheckCheck size={16} /> Tout marquer lu
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <span>{filteredItems.length} notification{filteredItems.length !== 1 ? "s" : ""}{search ? ` sur ${total}` : ` au total`}</span>
          {unread > 0 && <><span className="text-border-strong">·</span><span className="font-semibold text-[#1E6091]">{unread} non lue{unread > 1 ? "s" : ""}</span></>}
        </div>
      </Panel>

      {actionError && <Alert severity="error" className="mb-4">{actionError}</Alert>}
      {notificationsQuery.isLoading && <div className="flex justify-center py-12"><Spinner className="size-8" /></div>}

      {!notificationsQuery.isLoading && filteredItems.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
          <Bell size={52} className="opacity-30" />
          <span className="font-medium">{search ? "Aucune notification ne correspond à la recherche." : "Aucune notification pour l’instant."}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filteredItems.map((n, idx) => (
          <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.25 }}>
            <div className={`rounded-xl border px-4 py-3 ${n.isRead ? "border-border bg-surface" : "border-[#1E6091]/40 bg-[#1E6091]/10"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 gap-3">
                  <span className={`min-h-10 w-1 shrink-0 rounded ${n.isRead ? "bg-border" : "bg-[#1E6091]"}`} />
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{n.title}</span>
                      {!n.isRead && <Tag bg="#EFF6FF" color={STEEL}>Nouveau</Tag>}
                      {n.type && <Tag bg="#F1F5F9" color="#334155" className="font-semibold">{n.type}</Tag>}
                    </div>
                    <p className="mb-1 text-sm text-muted-foreground">{n.body || "—"}</p>
                    <span className="text-xs text-muted-foreground/70">{fmt(n.createdAt)}</span>
                  </div>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="outline" className="h-7 shrink-0 border-[#1E6091] text-[11px] text-[#1E6091]" disabled={markReadMutation.isPending}
                    onClick={async () => { setActionError(null); try { await markReadMutation.mutateAsync(n.id); } catch (e) { setActionError(e instanceof Error ? e.message : "Erreur"); } }}>
                    Marquer lu
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {total > PAGE_SIZE && <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />}
    </div>
  );
}

// ── Onglet fusionné : Diffusions & alertes ────────────────────────────────────
// Un seul point d'entrée « Nouveau » ouvre un formulaire à deux modes :
//   • Diffusion ponctuelle : message rédigé, envoyé maintenant ou planifié.
//   • Alerte automatique   : règle déclenchée par un critère de risque (cron).
// Les deux produisent des notifications in-app ciblées par rôle.
type Mode = "broadcast" | "alert";

function MessagingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // Dialog partagé
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("broadcast");
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Champs communs
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  // Champs diffusion
  const [body, setBody] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  // Champs alerte
  const [criterion, setCriterion] = useState<AlertCriterion>("RISK_TRANCHE");
  const [threshold, setThreshold] = useState("30");
  const [tranches, setTranches] = useState<string[]>(["31_90", "91_180", "181_360", "361_plus"]);
  const [digest, setDigest] = useState(true);

  // Bandeaux d'action (liste)
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const { data: broadcasts = [], isLoading: bLoading } = useQuery({ queryKey: ["broadcasts"], queryFn: fetchBroadcasts });
  const { data: rules = [], isLoading: rLoading } = useQuery({ queryKey: ["alert-rules"], queryFn: fetchAlertRules });

  const cancelMutation = useMutation({
    mutationFn: cancelBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const meta = criterionMeta(criterion);

  const q = search.trim().toLowerCase();
  const filteredBroadcasts = useMemo(
    () => !q ? broadcasts : broadcasts.filter((b) => b.title?.toLowerCase().includes(q) || b.body?.toLowerCase().includes(q)),
    [broadcasts, q],
  );
  const filteredRules = useMemo(
    () => !q ? rules : rules.filter((r) => r.name?.toLowerCase().includes(q) || alertSummary(r).toLowerCase().includes(q)),
    [rules, q],
  );

  const pending = filteredBroadcasts.filter((b) => !b.isSent);
  const sent = filteredBroadcasts.filter((b) => b.isSent);

  // ── Ouverture du formulaire ──
  const resetFields = () => {
    setName(""); setRoles([]); setBody(""); setScheduleMode(false); setScheduledAt("");
    setCriterion("RISK_TRANCHE"); setThreshold("30"); setTranches(["31_90", "91_180", "181_360", "361_plus"]);
    setDigest(true); setEditRuleId(null); setFormError(null);
  };
  const openNew = (m: Mode) => { resetFields(); setMode(m); setOpen(true); };
  const openEditRule = (r: AlertRuleDto) => {
    resetFields();
    setMode("alert"); setEditRuleId(r.id); setName(r.name);
    setCriterion(r.criterion);
    setThreshold(r.threshold != null ? String(r.threshold) : "");
    setTranches(r.tranches ?? []);
    setDigest(r.digest);
    setRoles(r.targetRoles);
    setOpen(true);
  };
  const switchMode = (m: Mode) => {
    if (editRuleId) return; // on ne convertit pas une règle existante
    setMode(m); setFormError(null);
  };
  const onCriterionChange = (c: AlertCriterion) => {
    setCriterion(c);
    const m = criterionMeta(c);
    if (m.needsThreshold && (!threshold || Number(threshold) <= 0)) setThreshold(String(m.defaultThreshold ?? 1));
    if (m.needsTranches && tranches.length === 0) setTranches(["31_90", "91_180", "181_360", "361_plus"]);
  };
  const toggleTranche = (code: string) =>
    setTranches((prev) => prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]);
  const toggleRole = (code: string) =>
    setRoles((prev) => prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]);

  // ── Enregistrement ──
  const handleSave = async () => {
    if (!name.trim()) { setFormError(mode === "alert" ? "Donnez un nom à la règle." : "Le titre est obligatoire."); return; }
    if (roles.length === 0) { setFormError("Choisissez au moins un rôle destinataire."); return; }

    if (mode === "broadcast") {
      if (scheduleMode && !scheduledAt) { setFormError("Choisissez une date de planification."); return; }
      if (scheduleMode && new Date(scheduledAt) <= new Date()) { setFormError("La date doit être dans le futur."); return; }
    } else {
      if (meta.needsThreshold && (!threshold || Number(threshold) <= 0)) { setFormError("Renseignez un seuil strictement positif."); return; }
      if (meta.needsTranches && tranches.length === 0) { setFormError("Sélectionnez au moins une tranche de retard."); return; }
    }

    setSaving(true); setFormError(null);
    try {
      if (mode === "broadcast") {
        await createBroadcast({
          title: name.trim(),
          body: body.trim() || undefined,
          targetRoles: roles,
          scheduledAt: scheduleMode ? new Date(scheduledAt).toISOString() : null,
        });
        qc.invalidateQueries({ queryKey: ["broadcasts"] });
      } else {
        const payload = {
          name: name.trim(),
          criterion,
          threshold: meta.needsThreshold ? Number(threshold) : null,
          tranches: meta.needsTranches ? tranches : [],
          targetRoles: roles,
          digest,
        };
        if (editRuleId) await updateAlertRule(editRuleId, payload);
        else await createAlertRule(payload);
        qc.invalidateQueries({ queryKey: ["alert-rules"] });
      }
      setOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ── Actions règles ──
  const invalidateRules = () => qc.invalidateQueries({ queryKey: ["alert-rules"] });
  const toggleRule = async (r: AlertRuleDto) => {
    try { await setAlertRuleActive(r.id, !r.isActive); invalidateRules(); }
    catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };
  const runRule = async (r: AlertRuleDto) => {
    setBanner(null);
    try {
      const { alerts } = await runAlertRuleNow(r.id);
      invalidateRules();
      setBanner({ kind: "success", msg: alerts > 0
        ? `${alerts} alerte(s) envoyée(s) pour « ${r.name} ».`
        : `Aucun nouveau client à risque ne correspond à « ${r.name} » pour l'instant.` });
    } catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };
  const deleteRule = async (r: AlertRuleDto) => {
    try { await deleteAlertRule(r.id); invalidateRules(); }
    catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); }
  };

  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <div>
      {/* En-tête + entrée unique */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Diffusions &amp; alertes</h2>
          <p className="text-sm text-muted-foreground">
            Envoyez un message ponctuel aux équipes, ou créez une alerte automatique déclenchée par les clients à risque.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-[#0F3B5C] font-bold" onClick={() => openNew("broadcast")}><Megaphone size={16} /> Diffusion</Button>
          <Button className="bg-[#3C8047] font-bold hover:bg-[#2A5C34] hover:opacity-100" onClick={() => openNew("alert")}><Plus size={16} /> Nouvelle alerte</Button>
        </div>
      </div>

      {/* Recherche */}
      <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une diffusion ou une alerte..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
          {search && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
          )}
        </div>
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          {activeRules} alerte{activeRules !== 1 ? "s" : ""} active{activeRules !== 1 ? "s" : ""} · {sent.length} diffusion{sent.length !== 1 ? "s" : ""} envoyée{sent.length !== 1 ? "s" : ""}
        </div>
      </Panel>

      {banner && <Alert severity={banner.kind} className="mb-4" onClose={() => setBanner(null)}>{banner.msg}</Alert>}

      {/* ── Section Alertes automatiques ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <TriangleAlert size={16} className="text-amber-700" />
          <span className="text-sm font-bold text-amber-700">Alertes automatiques ({filteredRules.length})</span>
        </div>
        {rLoading && <div className="flex justify-center py-6"><Spinner className="size-6" /></div>}
        {!rLoading && filteredRules.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <TriangleAlert size={42} className="opacity-30" />
            <span className="text-[13.5px] font-medium">Aucune alerte automatique configurée.</span>
            <Button size="sm" variant="outline" className="border-[#0F3B5C] font-semibold" onClick={() => openNew("alert")}><Plus size={15} /> Créer une alerte</Button>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {filteredRules.map((r) => {
            const m = criterionMeta(r.criterion);
            return (
              <div key={r.id} className={`rounded-xl border px-4 py-3 ${r.isActive ? "border-[#1E6091]/30 bg-[#FBFDFF] dark:bg-surface" : "border-border bg-background opacity-75"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-60 flex-1 gap-3">
                    <span className={`flex size-[38px] shrink-0 items-center justify-center rounded-full text-[#3C8047] ${r.isActive ? "bg-[#0F3B5C]" : "bg-slate-400"}`}><TriangleAlert size={20} /></span>
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{r.name}</span>
                        <Tag bg="#FFF7ED" color="#b45309">{alertSummary(r)}</Tag>
                        <Tag bg="#EFF6FF" color={STEEL}>{r.digest ? "Récap" : "Par dossier"}</Tag>
                        {!r.isActive && <Tag bg="#F1F5F9" color="var(--text-secondary)" className="font-semibold">Inactive</Tag>}
                      </div>
                      <span className="text-xs text-muted-foreground">{m.help}</span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.targetRoles.map((role) => (
                          <span key={role} className="rounded-full bg-slate-100 px-2 text-[10px] leading-4 text-slate-600">{TENANT_ROLES.find((t) => t.code === role)?.label ?? role}</span>
                        ))}
                      </div>
                      <span className="mt-1.5 block text-xs text-muted-foreground/70">
                        {r.totalFired} alerte{r.totalFired !== 1 ? "s" : ""} émise{r.totalFired !== 1 ? "s" : ""}
                        {r.lastRunAt ? ` · dernière éval. ${fmt(r.lastRunAt)}` : " · jamais évaluée"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip title={r.isActive ? "Désactiver" : "Activer"}>
                      <Switch aria-label={`${r.isActive ? "Désactiver" : "Activer"} ${r.name}`} checked={r.isActive} onCheckedChange={() => toggleRule(r)} />
                    </Tooltip>
                    <Tooltip title="Tester maintenant">
                      <button type="button" aria-label="Tester maintenant" onClick={() => runRule(r)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-green-600 hover:bg-green-50"><Play size={19} /></button>
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <button type="button" aria-label="Modifier" onClick={() => openEditRule(r)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-[#1E6091] hover:bg-blue-50"><Pencil size={17} /></button>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <button type="button" aria-label="Supprimer" onClick={() => deleteRule(r)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={17} /></button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="my-4 border-border" />

      {/* ── Section Diffusions ── */}
      {pending.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-600">Diffusions planifiées ({pending.length})</span>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((b) => (
              <BroadcastCard key={b.id} broadcast={b}
                onCancel={async () => { setBanner(null); try { await cancelMutation.mutateAsync(b.id); } catch (e) { setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Erreur" }); } }}
                cancelling={cancelMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <CircleCheck size={16} className="text-green-600" />
          <span className="text-sm font-bold text-green-600">Diffusions envoyées ({sent.length})</span>
        </div>
        {bLoading && <div className="flex justify-center py-8"><Spinner className="size-7" /></div>}
        {!bLoading && sent.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Megaphone size={42} className="opacity-25" />
            <span className="text-[13.5px] font-medium">Aucune diffusion envoyée pour l&apos;instant.</span>
            <Button size="sm" variant="outline" className="border-[#0F3B5C] font-semibold" onClick={() => openNew("broadcast")}><Megaphone size={15} /> Nouvelle diffusion</Button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {sent.map((b) => <BroadcastCard key={b.id} broadcast={b} />)}
        </div>
      </div>

      {/* ── Dialog unifié (diffusion / alerte) ── */}
      <Dialog open={open} onOpenChange={(o) => !o && !saving && setOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={mode === "alert" ? <TriangleAlert size={20} /> : <Megaphone size={20} />}>
            {editRuleId ? "Modifier l'alerte" : mode === "alert" ? "Nouvelle alerte automatique" : "Nouvelle diffusion"}
          </DialogHeader>
          <DialogBody className="max-h-[72vh] overflow-y-auto">
            <div className="flex flex-col gap-5">
              {/* Sélecteur de mode (masqué en édition de règle) */}
              {!editRuleId && (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { m: "broadcast" as Mode, label: "Diffusion ponctuelle", icon: <Megaphone size={16} />, desc: "Un message, une fois" },
                    { m: "alert" as Mode, label: "Alerte automatique", icon: <TriangleAlert size={16} />, desc: "Déclenchée par les risques" },
                  ]).map((opt) => {
                    const selected = mode === opt.m;
                    return (
                      <button key={opt.m} type="button" onClick={() => switchMode(opt.m)}
                        className={`cursor-pointer rounded-lg border-[1.5px] p-2.5 text-left transition-all ${selected ? "border-[#0F3B5C] bg-[#1E6091]/10" : "border-border bg-surface"}`}>
                        <span className={`flex items-center gap-1.5 text-[13px] font-bold ${selected ? "text-foreground" : "text-muted-foreground"}`}>{opt.icon} {opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Titre / nom */}
              <Field label={mode === "alert" ? "Nom de la règle *" : "Titre *"}>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={mode === "alert" ? "ex: Retards critiques recouvrement" : "ex: Maintenance prévue ce vendredi"} />
              </Field>

              {/* Champs propres à la DIFFUSION */}
              {mode === "broadcast" && (
                <Field label="Message (optionnel)"><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Détaillez votre message ici..." /></Field>
              )}

              {/* Champs propres à l'ALERTE */}
              {mode === "alert" && (
                <>
                  <div>
                    <span className={subLabel}>Critère déclencheur *</span>
                    <Select value={criterion} onChange={(e) => onCriterionChange(e.target.value as AlertCriterion)}>
                      {CRITERIA.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </Select>
                    <span className="mt-1 block text-xs text-muted-foreground">{meta.help}</span>
                  </div>
                  {meta.needsThreshold && (
                    <Field label={`Seuil (${meta.unit})`} help={meta.unit === "FCFA" ? "Montant en francs CFA." : "Nombre de jours."}>
                      <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                    </Field>
                  )}
                  {meta.needsTranches && (
                    <div>
                      <span className={subLabel}>Tranches de retard surveillées *</span>
                      <div className="flex flex-wrap gap-1.5">
                        {TRANCHES.map((t) => {
                          const on = tranches.includes(t.code);
                          return (
                            <button key={t.code} type="button" onClick={() => toggleTranche(t.code)}
                              className={`h-6 cursor-pointer rounded-full border px-3 text-xs font-bold ${on ? "border-orange-200 bg-orange-50 text-amber-700" : "border-border-strong bg-transparent text-muted-foreground"}`}>
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Alert severity="info" className="flex items-start gap-2 py-1.5 text-[12.5px]">
                    <Users size={16} className="mt-0.5 shrink-0" />
                    <span>Chaque destinataire ne reçoit que les clients de son périmètre : un CAF ses propres clients, un chef d&apos;agence son agence, un responsable de zone sa zone, les autres rôles l&apos;ensemble du portefeuille.</span>
                  </Alert>

                  <div className="rounded-lg border border-border p-3">
                    <label className="flex items-center gap-2">
                      <Switch aria-label="Notification récapitulative" checked={digest} onCheckedChange={setDigest} />
                      <span className="text-sm font-semibold">Notification récapitulative</span>
                    </label>
                    <span className="ml-1 mt-1 block text-xs text-muted-foreground">
                      {digest
                        ? "Un seul message par destinataire (ex : « 5 clients en 91–180 j dans votre portefeuille »)."
                        : "Une notification par dossier concerné (plus détaillé, mais volumineux)."}
                    </span>
                  </div>
                </>
              )}

              {/* Rôles destinataires (commun) */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Users size={16} className="text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-[0.8px] text-muted-foreground">Rôles destinataires *</span>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="grid grid-cols-2 gap-1">
                    {TENANT_ROLES.map((r) => (
                      <label key={r.code} className="flex cursor-pointer items-center gap-2 py-1">
                        <Checkbox checked={roles.includes(r.code)} onChange={() => toggleRole(r.code)} />
                        <span className="text-[13px]">{r.label}</span>
                      </label>
                    ))}
                  </div>
                  <hr className="my-2 border-border" />
                  <Button size="sm" variant="ghost" className="text-xs text-[#1E6091]" onClick={() => setRoles(roles.length === TENANT_ROLES.length ? [] : TENANT_ROLES.map((r) => r.code))}>
                    {roles.length === TENANT_ROLES.length ? "Tout déselectionner" : "Tout sélectionner"}
                  </Button>
                </div>
              </div>

              {/* Planification (diffusion uniquement) */}
              {mode === "broadcast" && (
                <div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={scheduleMode} onChange={(e) => setScheduleMode(e.target.checked)} />
                    <span className="flex items-center gap-1 text-sm font-semibold"><Clock size={16} className="text-muted-foreground" /> Planifier pour plus tard</span>
                  </label>
                  {scheduleMode && (
                    <Field label="Date et heure d'envoi" className="mt-2">
                      <Input type="datetime-local" value={scheduledAt} min={fmtDatetimeLocal(new Date(Date.now() + 60_000).toISOString())} onChange={(e) => setScheduledAt(e.target.value)} />
                    </Field>
                  )}
                </div>
              )}

              {formError && <Alert severity="error">{formError}</Alert>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="hover:bg-[#1E6091] hover:opacity-100">
              {mode === "alert" ? <Zap size={16} /> : scheduleMode ? <Clock size={16} /> : <Send size={16} />}
              {saving
                ? "Enregistrement..."
                : mode === "alert"
                  ? (editRuleId ? "Enregistrer" : "Créer l'alerte")
                  : scheduleMode ? "Planifier" : "Envoyer maintenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BroadcastCard({ broadcast: b, onCancel, cancelling }: { broadcast: BroadcastDto; onCancel?: () => void; cancelling?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${b.isSent ? "border-border bg-surface" : "border-amber-100 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{b.title}</span>
            {b.isSent ? (
              <>
                <Tag bg="#F0FDF4" color="#16a34a">{`${b.recipientCount} destinataire${b.recipientCount !== 1 ? "s" : ""}`}</Tag>
                <Tooltip title={`${b.readCount} agent${b.readCount !== 1 ? "s ont" : " a"} lu ce message`}>
                  <span
                    className="inline-flex cursor-default items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-[18px]"
                    style={{ background: b.readCount > 0 ? "#EFF6FF" : "#F1F5F9", color: b.readCount > 0 ? "#1E6091" : "var(--text-muted)" }}
                  >
                    <Eye size={11} /> {`${b.readCount} / ${b.recipientCount} lu${b.readCount !== 1 ? "s" : ""}`}
                  </span>
                </Tooltip>
              </>
            ) : (
              <Tag bg="#FEF3C7" color="#d97706"><Clock size={12} /> Planifiée</Tag>
            )}
          </div>
          {b.body && <p className="mb-1 text-sm text-muted-foreground">{b.body}</p>}
          <div className="mb-1 flex flex-wrap gap-1">
            {b.targetRoles.map((r) => <span key={r} className="rounded-full bg-slate-100 px-2 text-[10px] leading-4 text-slate-600">{r}</span>)}
          </div>
          <span className="text-xs text-muted-foreground/70">
            {b.isSent ? `Envoyée le ${fmt(b.sentAt)}` : `Planifiée pour le ${fmt(b.scheduledAt)}`}
            {" · "}Créée le {fmt(b.createdAt)}
          </span>
        </div>
        {!b.isSent && onCancel && (
          <Tooltip title="Annuler cette diffusion planifiée">
            <Button size="sm" variant="outline" className="h-7 shrink-0 border-red-300 text-[11px] text-red-600" disabled={cancelling} onClick={onCancel}>
              <Trash2 size={15} /> Annuler
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [tab, setTab] = useState<"mine" | "messaging">("mine");

  const notifKpiQuery = useQuery({
    queryKey: ["notif-kpi"],
    queryFn: () => fetchMyNotifications({ page: 1, limit: 50 }),
  });
  const broadcastKpiQuery = useQuery({
    queryKey: ["broadcast-kpi"],
    queryFn: fetchBroadcasts,
  });
  const alertRulesKpiQuery = useQuery({
    queryKey: ["alert-rules-kpi"],
    queryFn: fetchAlertRules,
  });
  const kpiNotifItems  = notifKpiQuery.data?.items ?? [];
  const kpiBroadcasts  = broadcastKpiQuery.data ?? [];
  const kpiRules       = alertRulesKpiQuery.data ?? [];
  const kpiUnread      = kpiNotifItems.filter((n) => !n.isRead).length;
  const kpiSent        = kpiBroadcasts.filter((b) => b.isSent).length;
  const kpiActiveRules = kpiRules.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader icon={<Megaphone size={30} />} title="Notifications" subtitle="Recevez les alertes système, diffusez des messages et automatisez les alertes clients à risque" />
      <PageContainer>
        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile label="Mes notifications"   value={notifKpiQuery.data?.total ?? 0} accent={NAVY}      icon={<Bell size={22} />} />
          <KpiTile label="Non lues"            value={kpiUnread}                      accent="#d97706" icon={<BellRing size={22} />} />
          <KpiTile label="Diffusions envoyées" value={kpiSent}                        accent="#059669" icon={<Megaphone size={22} />} />
          <KpiTile label="Alertes actives"     value={kpiActiveRules}                 accent="#b45309" icon={<TriangleAlert size={22} />} />
        </div>

        {/* Onglets */}
        <div className="mb-6 border-b border-border">
          <TabBar
            value={tab === "mine" ? 0 : 1}
            onChange={(i) => setTab(i === 0 ? "mine" : "messaging")}
            tabs={[
              <span key="m" className="flex items-center gap-2"><Bell size={18} /> Mes notifications</span>,
              <span key="s" className="flex items-center gap-2"><Megaphone size={18} /> Diffusions &amp; alertes</span>,
            ]}
          />
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === "mine" ? <MyNotificationsTab /> : <MessagingTab />}
        </motion.div>
      </PageContainer>
    </>
  );
}
