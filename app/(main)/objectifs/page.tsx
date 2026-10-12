"use client";

import { useMemo, useState } from "react";
import { Ban, Flag, Plus, Save, Trash2, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import { fetchMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Combobox, MultiCombobox } from "@/components/ui/combobox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { HeaderButton, PageContainer, PageHeader, Panel, Th } from "@/components/ui/page-blocks";


type ObjectiveType = {
  id: number; code: string; label: string; description: string | null;
  unit: "count" | "fcfa"; sortOrder: number; active: boolean;
};
type CafObjectiveRow = {
  id: number; cafCode: string; period: string; objectiveTypeId: number;
  targetValue: number; achievedValue: number;
  setByName?: string | null; updatedAt?: string | null;
};
type CafContext = { userId: number; name: string; username: string; cafCode: string; agenceName: string | null; isActive: boolean };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ObjectifsCafPage() {
  const qc = useQueryClient();

  // Fixer un objectif est une décision métier (management terrain), pas une
  // tâche IT : admin_tenant garde l'accès à ce module en LECTURE (consulter
  // les cibles/réalisations), mais seule la directrice d'exploitation peut
  // les fixer. Le backend applique la même restriction (voir
  // caf-objectives.controller.ts, @Roles('directrice_exploitation') sur
  // tous les endpoints d'écriture) — ceci n'est qu'un reflet côté UI.
  const { data: me } = useQuery({ queryKey: ["me-objectifs"], queryFn: fetchMe });
  const canEdit = String(me?.role ?? "").toLowerCase() === "directrice_exploitation";

  const [cafCode, setCafCode] = useState("");
  const [period, setPeriod]   = useState(currentPeriod());
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [error, setError]     = useState<string | null>(null);
  const [saved, setSaved]     = useState<number | null>(null);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeUnit, setNewTypeUnit]   = useState<"count" | "fcfa">("count");

  // ── Fixation en masse ──
  const [bulkOpen, setBulkOpen]           = useState(false);
  const [bulkScope, setBulkScope]         = useState<"all_caf" | "all_recouvrement" | "custom">("all_caf");
  const [bulkCafCodes, setBulkCafCodes]   = useState<string[]>([]);
  const [bulkTypeId, setBulkTypeId]       = useState<number | "">("");
  const [bulkTarget, setBulkTarget]       = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkResult, setBulkResult]       = useState<string | null>(null);

  const { data: types = [] } = useQuery<ObjectiveType[]>({
    queryKey: ["objective-types"],
    queryFn: () => apiClient.get("/caf-objectives/types").then((r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? [])),
  });

  // Un contexte par (CAF, agence) — un CAF multi-agences a un cod_gest distinct
  // par agence, donc apparait plusieurs fois ici (contrairement à /users/stats
  // qui ne renvoie que son caf_code principal).
  const { data: agents = [] } = useQuery<CafContext[]>({
    queryKey: ["caf-contexts"],
    queryFn: () => apiClient.get("/users/caf-contexts").then((r) => {
      const rows = (r.data ?? []) as CafContext[];
      return rows.filter((u) => u.isActive && u.cafCode);
    }),
  });

  // Mapping agence → zone (pour permettre la recherche d'un CAF par zone).
  const { data: agences = [] } = useQuery({ queryKey: ["agences"], queryFn: fetchAgences });
  const zoneByAgenceName = useMemo(
    () => new Map(agences.map((a: any) => [String(a.name ?? "").toLowerCase().trim(), a.zoneName ?? ""])),
    [agences],
  );

  // Options CAF enrichies (nom, code, agence, zone) pour l'autocomplétion.
  const cafOptions = useMemo(
    () => agents.map((a) => ({
      caf_code: a.cafCode,
      name: a.name,
      agence: a.agenceName ?? "",
      zone: zoneByAgenceName.get(String(a.agenceName ?? "").toLowerCase().trim()) ?? "",
    })),
    [agents, zoneByAgenceName],
  );
  const selectedCaf = useMemo(() => cafOptions.find((o) => o.caf_code === cafCode) ?? null, [cafOptions, cafCode]);

  const { data: objectives = [], isFetching: objsLoading } = useQuery<CafObjectiveRow[]>({
    queryKey: ["caf-objectives", cafCode, period],
    queryFn: () => apiClient.get(`/caf-objectives?cafCode=${encodeURIComponent(cafCode)}&period=${period}`)
      .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? [])),
    enabled: !!cafCode,
  });

  // Attribution personnelle des types (indépendante de la période) : un CAF
  // peut être évalué sur le recouvrement, un autre non — absence de ligne =
  // activé par défaut (cf. caf-objectives.controller.ts / setAssignment).
  const { data: assignments = [] } = useQuery<Array<{ objectiveTypeId: number; enabled: boolean }>>({
    queryKey: ["caf-objective-assignments", cafCode],
    queryFn: () => apiClient.get(`/caf-objectives/assignments?cafCode=${encodeURIComponent(cafCode)}`)
      .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? [])),
    enabled: !!cafCode,
  });
  const isTypeEnabled = (typeId: number) => assignments.find((a) => a.objectiveTypeId === typeId)?.enabled ?? true;

  const assignMut = useMutation({
    mutationFn: ({ objectiveTypeId, enabled }: { objectiveTypeId: number; enabled: boolean }) =>
      apiClient.put("/caf-objectives/assignments", { cafCode, objectiveTypeId, enabled }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caf-objective-assignments", cafCode] }),
    onError: (e: any) => setError(e?.response?.data?.message ?? "Modification de l'attribution impossible."),
  });

  const objectiveByTypeId = useMemo(() => new Map(objectives.map((o) => [o.objectiveTypeId, o])), [objectives]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["caf-objectives", cafCode, period] });

  const bulkMut = useMutation({
    mutationFn: () =>
      apiClient.put("/caf-objectives/bulk-set", {
        scope: bulkScope,
        cafCodes: bulkScope === "custom" ? bulkCafCodes : undefined,
        period,
        objectiveTypeId: bulkTypeId,
        targetValue: Number(bulkTarget),
      }).then((r) => r.data as { count: number }),
    onSuccess: (r) => {
      setBulkResult(`Cible appliquée à ${r.count} destinataire${r.count > 1 ? "s" : ""}.`);
      setBulkConfirmOpen(false);
      setBulkOpen(false);
      invalidate();
      qc.invalidateQueries({ queryKey: ["caf-objective-assignments"] });
    },
    onError: (e: any) => {
      setBulkConfirmOpen(false);
      setError(e?.response?.data?.message ?? "Fixation en masse impossible.");
    },
  });

  const bulkScopeLabel = bulkScope === "all_caf" ? "tous les CAF du tenant"
    : bulkScope === "all_recouvrement" ? "tous les agents recouvrement"
    : `la sélection (${bulkCafCodes.length} personne${bulkCafCodes.length > 1 ? "s" : ""})`;
  const bulkTypeLabel = types.find((t) => t.id === bulkTypeId)?.label ?? "";
  const bulkCanSubmit = !!bulkTypeId && bulkTarget !== "" && Number(bulkTarget) >= 0 &&
    (bulkScope !== "custom" || bulkCafCodes.length > 0);

  const saveMut = useMutation({
    mutationFn: ({ objectiveTypeId, targetValue }: { objectiveTypeId: number; targetValue: number }) =>
      apiClient.put("/caf-objectives", { cafCode, period, objectiveTypeId, targetValue }).then((r) => r.data),
    onSuccess: (_r, vars) => { invalidate(); setSaved(vars.objectiveTypeId); setTimeout(() => setSaved(null), 2000); },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Enregistrement impossible."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/caf-objectives/${id}`),
    onSuccess: invalidate,
    onError: (e: any) => setError(e?.response?.data?.message ?? "Suppression impossible."),
  });

  const createTypeMut = useMutation({
    mutationFn: () => apiClient.post("/caf-objectives/types", {
      code: newTypeLabel.trim().toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[̀-ͯ]/g, ""),
      label: newTypeLabel.trim(),
      unit: newTypeUnit,
    }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objective-types"] }); setNewTypeLabel(""); },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Création du type impossible."),
  });

  const deactivateTypeMut = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/caf-objectives/types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["objective-types"] }),
    onError: (e: any) => setError(e?.response?.data?.message ?? "Désactivation impossible."),
  });

  const fmt = (v: number, unit: string) =>
    unit === "fcfa" ? `${Math.round(v).toLocaleString("fr-FR")} FCFA` : Math.round(v).toLocaleString("fr-FR");

  return (
    <>
      <PageHeader icon={<Flag size={30} />} title="Fixation d'Objectifs" subtitle="Attribution et suivi des objectifs mensuels des agents terrain">
        {canEdit && (
          <HeaderButton onClick={() => { setBulkResult(null); setBulkOpen(true); }}>
            <Users size={18} /> Fixation en masse
          </HeaderButton>
        )}
      </PageHeader>

      <PageContainer>
        {error && <Alert severity="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
        {bulkResult && <Alert severity="success" className="mb-4" onClose={() => setBulkResult(null)}>{bulkResult}</Alert>}
        {me && !canEdit && (
          <Alert severity="info" className="mb-4">
            Vous consultez ce module en lecture seule. La fixation des objectifs est une décision métier réservée à la direction d&apos;exploitation.
          </Alert>
        )}

        {/* ── Sélection CAF + période ── */}
        <Panel className="mb-5 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Combobox
              className="min-w-80 flex-1"
              options={cafOptions}
              value={selectedCaf}
              onChange={(v) => { setCafCode(v?.caf_code ?? ""); setTargets({}); }}
              getKey={(o) => o.caf_code}
              getLabel={(o) => `${o.name} — ${o.caf_code}`}
              // Recherche sur nom, code CAF, agence ET zone.
              filter={(o, q) =>
                o.name.toLowerCase().includes(q) ||
                o.caf_code.toLowerCase().includes(q) ||
                o.agence.toLowerCase().includes(q) ||
                o.zone.toLowerCase().includes(q)
              }
              renderOption={(o) => (
                <div>
                  <div className="text-[13px] font-semibold">
                    {o.name} <span className="text-xs font-normal text-muted-foreground">— {o.caf_code}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.agence || "Sans agence"}{o.zone ? ` · ${o.zone}` : ""}
                  </div>
                </div>
              )}
              placeholder="Rechercher par nom, code CAF, agence ou zone…"
            />
            <Input
              type="month"
              value={period}
              onChange={(e) => { setPeriod(e.target.value); setTargets({}); }}
              className="w-44"
            />
            {objsLoading && <Spinner className="text-[#1E6091]" />}
          </div>
        </Panel>

        {/* ── Attribution des objectifs ── */}
        {cafCode ? (
          <Panel className="mb-6 overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0F3B5C]">
                  {["Assigné", "Objectif", "Unité", "Cible", "Réalisé", "Progression", ""].map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const existing = objectiveByTypeId.get(t.id);
                  const target = targets[t.id] ?? (existing ? String(existing.targetValue) : "");
                  const achieved = existing?.achievedValue ?? 0;
                  const pct = existing && existing.targetValue > 0
                    ? Math.min(100, Math.round((achieved / existing.targetValue) * 100)) : null;
                  const enabled = isTypeEnabled(t.id);
                  return (
                    <tr key={t.id} className={`border-b border-border hover:bg-muted ${enabled ? "" : "opacity-50"}`}>
                      <td className="w-[70px] px-4 py-2.5">
                        <Tooltip title={enabled ? "Ce type s'applique à cette personne — désactiver pour le retirer de son application" : "Non applicable à cette personne — activer pour qu'il apparaisse dans son application"}>
                          <Switch
                            aria-label={`Assigner ${t.label}`}
                            checked={enabled}
                            disabled={!canEdit || assignMut.isPending}
                            onCheckedChange={(v) => assignMut.mutate({ objectiveTypeId: t.id, enabled: v })}
                          />
                        </Tooltip>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-[13px] font-semibold">{t.label}</div>
                        {t.description && <div className="text-[11px] text-muted-foreground">{t.description}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{t.unit === "fcfa" ? "FCFA" : "Nombre"}</span>
                      </td>
                      <td className="w-[170px] px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          value={target}
                          placeholder="Non fixé"
                          disabled={!canEdit || !enabled}
                          onChange={(e) => setTargets((p) => ({ ...p, [t.id]: e.target.value }))}
                          className="h-8 text-[13px]"
                        />
                        {existing?.setByName && (
                          <div className="mt-1 truncate text-[10px] text-muted-foreground/70">
                            Fixé par {existing.setByName}
                            {existing.updatedAt && ` · ${new Date(existing.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-semibold">{existing ? fmt(achieved, t.unit) : "—"}</td>
                      <td className="px-4 py-2.5">
                        {pct != null ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              background: pct >= 100 ? "#dcfce7" : pct >= 50 ? "#FEF3C7" : "#fee2e2",
                              color: pct >= 100 ? "#16a34a" : pct >= 50 ? "#92400E" : "#dc2626",
                            }}
                          >
                            {pct} %
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="w-[110px] px-4 py-2.5">
                        {canEdit && (
                          <div className="flex gap-1">
                            <Tooltip title={saved === t.id ? "Enregistré !" : "Enregistrer la cible"}>
                              <button
                                type="button"
                                aria-label="Enregistrer la cible"
                                disabled={!enabled || target === "" || saveMut.isPending}
                                onClick={() => saveMut.mutate({ objectiveTypeId: t.id, targetValue: Number(target) })}
                                className={`flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:bg-muted disabled:cursor-default disabled:opacity-40 ${saved === t.id ? "text-green-600" : "text-[#1E6091]"}`}
                              >
                                <Save size={17} />
                              </button>
                            </Tooltip>
                            {existing && (
                              <Tooltip title="Retirer cet objectif">
                                <button
                                  type="button"
                                  aria-label="Retirer cet objectif"
                                  onClick={() => deleteMut.mutate(existing.id)}
                                  className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        ) : (
          <div className="mb-6 rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <Flag size={40} className="mx-auto mb-2 text-border-strong" />
            <p className="text-[13px] text-muted-foreground">Sélectionnez un CAF pour attribuer ou modifier ses objectifs.</p>
          </div>
        )}

        {/* ── Gestion des types d'objectifs ── */}
        <Panel className="p-5">
          <h2 className="mb-1 font-bold text-foreground">Types d&apos;objectifs</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            La liste des types est partagée avec l&apos;application mobile — désactiver un type le retire des
            écrans sans effacer l&apos;historique déjà attribué.
          </p>
          <div className="flex flex-col gap-2">
            {types.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-1.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#0F3B5C] text-[#3C8047]"><Flag size={14} /></span>
                <span className="flex-1 text-[13px] font-semibold">{t.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{t.unit === "fcfa" ? "FCFA" : "Nombre"}</span>
                {canEdit && (
                  <Tooltip title="Désactiver ce type (historique conservé)">
                    <button
                      type="button"
                      aria-label="Désactiver ce type"
                      onClick={() => deactivateTypeMut.mutate(t.id)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-red-600 hover:bg-red-50"
                    >
                      <Ban size={16} />
                    </button>
                  </Tooltip>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
                <Input
                  placeholder="Nouveau type d'objectif…"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  className="h-8 max-w-80 flex-1"
                />
                <Select value={newTypeUnit} onChange={(e) => setNewTypeUnit(e.target.value as any)} className="h-8 w-32">
                  <option value="count">Nombre</option>
                  <option value="fcfa">FCFA</option>
                </Select>
                <Button
                  size="sm"
                  disabled={!newTypeLabel.trim() || createTypeMut.isPending}
                  onClick={() => createTypeMut.mutate()}
                  className="hover:bg-[#1E6091] hover:opacity-100"
                >
                  {createTypeMut.isPending ? <Spinner className="size-3.5" /> : <Plus size={15} />} Ajouter
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </PageContainer>

      {/* ── Fixation en masse ── */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          <DialogHeader>Fixation en masse</DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <p className="text-[13px] text-muted-foreground">
              Applique la même cible à un groupe entier en une seule fois, pour la période sélectionnée ({period}).
            </p>
            <Select value={bulkScope} onChange={(e) => { setBulkScope(e.target.value as any); setBulkCafCodes([]); }}>
              <option value="all_caf">Tous les CAF du tenant</option>
              <option value="all_recouvrement">Tous les agents recouvrement</option>
              <option value="custom">Sélection personnalisée</option>
            </Select>
            {bulkScope === "custom" && (
              <MultiCombobox
                inline
                options={cafOptions}
                values={cafOptions.filter((o) => bulkCafCodes.includes(o.caf_code))}
                onChange={(v) => setBulkCafCodes(v.map((o) => o.caf_code))}
                getKey={(o) => o.caf_code}
                getLabel={(o) => `${o.name} — ${o.caf_code}`}
                placeholder="Rechercher une ou plusieurs personnes…"
              />
            )}
            <Select value={bulkTypeId} onChange={(e) => setBulkTypeId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="" disabled>Type d&apos;objectif…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.unit === "fcfa" ? "FCFA" : "Nombre"})</option>)}
            </Select>
            <Field label="Cible">
              <Input type="number" min={0} value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Annuler</Button>
            <Button disabled={!bulkCanSubmit} onClick={() => setBulkConfirmOpen(true)} className="hover:bg-[#1E6091] hover:opacity-100">
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkConfirmOpen} onOpenChange={(o) => !o && setBulkConfirmOpen(false)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader>Confirmer la fixation en masse</DialogHeader>
          <DialogBody>
            <p className="text-sm">
              Fixer <strong>{bulkTypeLabel}</strong> à <strong>{bulkTarget}</strong> pour <strong>{bulkScopeLabel}</strong> sur la période <strong>{period}</strong> ?
            </p>
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Écrase la cible existante pour tous les destinataires concernés — le réalisé n&apos;est pas affecté.
            </p>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setBulkConfirmOpen(false)} disabled={bulkMut.isPending}>Annuler</Button>
            <Button variant="destructive" disabled={bulkMut.isPending} onClick={() => bulkMut.mutate()}>
              {bulkMut.isPending && <Spinner className="size-3.5" />} Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
