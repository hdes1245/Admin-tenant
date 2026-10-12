"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronUp, Eye, GripVertical, Plus, Save, Settings, Trash2, Upload, WifiOff, X,
} from "lucide-react";
import {
  FormTemplate, FormField, FieldType, FormStatus, FormCategory,
  loadForms, saveForm, defaultField,
  FIELD_TYPES, CATEGORY_LABELS,
} from "@/lib/forms";
import { saveCaptureConfig, fetchCaptureConfig, CaptureFormConfig, CaptureFieldType } from "@/lib/captureConfig";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLocationTypes, createLocationType, updateLocationType, deleteLocationType,
  LocationTypeItem,
} from "@/lib/locationTypes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Snackbar } from "@/components/ui/snackbar";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const SYSTEM_ID = "system_localiser_client";

async function syncCaptureConfigFromForm(form: FormTemplate): Promise<void> {
  if (form.id !== SYSTEM_ID) return;
  const typeF  = form.fields.find((f) => f.id === "sys_f2" || (f.type === "select" && f.label.toLowerCase().includes("type")));
  const labelF = form.fields.find((f) => f.id === "sys_f3" || (f.type === "text"   && f.label.toLowerCase().includes("lieu")));
  const photoF = form.fields.find((f) => f.id === "sys_f4" || f.type === "photo");
  const reservedIds = new Set([typeF?.id, labelF?.id, photoF?.id, "sys_f1"].filter(Boolean));
  const extraFields = form.fields
    .filter((f) => !reservedIds.has(f.id) && f.type !== "gps")
    .map((f, idx) => ({
      id:          f.id,
      // Le constructeur de formulaire (FieldType) autorise des types
      // (email, phone, date, time, signature) que la config de capture
      // mobile (CaptureFieldType) ne modélise pas encore — non bloquant à
      // l'exécution (le rendu applique déjà un fallback texte par défaut
      // pour un type non reconnu), juste un cast pour satisfaire le typage.
      type:        f.type as CaptureFieldType,
      label:       f.label,
      placeholder: f.placeholder,
      required:    f.required,
      options:     f.options,
      helpText:    f.helpText,
      enabled:     true,
      sortOrder:   idx,
    }));
  let existing: CaptureFormConfig | null = null;
  try { existing = await fetchCaptureConfig(); } catch { /* noop */ }
  const config: CaptureFormConfig = {
    typeField:  { enabled: !!typeF,  required: typeF?.required  ?? false, label: typeF?.label  ?? "Type de lieu" },
    labelField: { enabled: !!labelF, required: labelF?.required ?? false, label: labelF?.label ?? "Nom du lieu", placeholder: labelF?.placeholder ?? "" },
    photoField: { enabled: !!photoF, required: photoF?.required ?? false, maxCount: existing?.photoField?.maxCount ?? 5 },
    extraFields,
    updatedAt:  new Date().toISOString(),
  };
  await saveCaptureConfig(config);
}

const STEEL = "#1E6091";

const GROUPS = ["Basique", "Choix", "Date & heure", "Terrain"];

function fieldTypeColor(type: FieldType): string {
  if (["gps","photo","signature"].includes(type)) return "#7c3aed";
  if (["select","radio","checkbox"].includes(type)) return "#0891B2";
  if (["date","time"].includes(type)) return "#059669";
  return STEEL;
}

const sectionTitle = "text-xs font-bold uppercase tracking-[0.5px] text-muted-foreground";
const arrowBtn = "cursor-pointer rounded border-0 bg-transparent p-0.5 text-muted-foreground hover:bg-muted disabled:cursor-default disabled:opacity-30";

// ─── Field preview chip in palette ──────────────────────────────────────────
function PaletteItem({ ft, onAdd }: { ft: typeof FIELD_TYPES[0]; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface p-2 text-left transition-all hover:border-[#1E6091] hover:bg-[#1E6091]/5"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded" style={{ background: `${fieldTypeColor(ft.type)}15` }}>
        <i className={`ti ${ft.icon}`} style={{ fontSize: 14, color: fieldTypeColor(ft.type) }} aria-hidden />
      </span>
      <span className="truncate text-xs font-medium text-foreground">{ft.label}</span>
      <Plus size={14} className="ml-auto text-[#1E6091] opacity-50" />
    </button>
  );
}

// ─── Field card in canvas ────────────────────────────────────────────────────
function FieldCard({ field, selected, onSelect, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  field: FormField; selected: boolean;
  onSelect: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const ftInfo = FIELD_TYPES.find((f) => f.type === field.type);
  return (
    <div
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all ${
        selected
          ? "border-[1.5px] border-[#1E6091] bg-[#1E6091]/[0.03] shadow-[0_0_0_3px_rgba(30,96,145,0.12)]"
          : "border border-border bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
      }`}
    >
      <GripVertical size={18} className="shrink-0 text-border-strong" />
      <span className="flex size-8 shrink-0 items-center justify-center rounded" style={{ background: `${fieldTypeColor(field.type)}15` }}>
        <i className={`ti ${ftInfo?.icon ?? "ti-forms"}`} style={{ fontSize: 15, color: fieldTypeColor(field.type) }} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-foreground">{field.label}</div>
        <div className="text-[11px] text-muted-foreground">{ftInfo?.label}</div>
      </div>
      {field.required && <span className="rounded-full bg-red-50 px-2 text-[10px] leading-[18px] text-red-800">Requis</span>}
      <div className="flex flex-col">
        <button type="button" aria-label="Monter" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} className={arrowBtn}><ChevronUp size={14} /></button>
        <button type="button" aria-label="Descendre" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} className={arrowBtn}><ChevronDown size={14} /></button>
      </div>
      <button
        type="button"
        aria-label="Supprimer le champ"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ─── Éditeur des types de lieux (champ "Type de lieu" du formulaire système) ──
// Les options de ce champ ne sont PAS de simples chaînes : ce sont les types
// de lieux du référentiel (table location_types), utilisés partout (mobile,
// carte, filtres, couleurs des marqueurs). On les gère donc directement ici,
// en CRUD sur l'API — plus besoin de l'onglet dédié dans Référentiels.
function LocationTypeOptionsEditor({ onNamesChanged }: { onNamesChanged: (names: string[]) => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["location-types"],
    queryFn: fetchLocationTypes,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["location-types"] });

  const propagateNames = (updated: LocationTypeItem[]) =>
    onNamesChanged([...updated].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.name));

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: { name?: string; sort_order?: number; color?: string } }) =>
      updateLocationType(id, dto),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const createMut = useMutation({
    mutationFn: (name: string) => createLocationType({
      code: name.trim().toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[̀-ͯ]/g, ""),
      name: name.trim(),
      sort_order: (types[types.length - 1]?.sort_order ?? 0) + 1,
    }),
    onSuccess: (created) => {
      invalidate(); setNewName("");
      propagateNames([...types, created]);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteLocationType(id),
    onSuccess: (_res, id) => {
      invalidate();
      propagateNames(types.filter((t) => t.id !== id));
    },
    onError: (e: Error) => setError(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= types.length) return;
    const a = types[idx], b = types[j];
    // Échange des sort_order des deux voisins
    updateMut.mutate({ id: a.id, dto: { sort_order: b.sort_order } });
    updateMut.mutate({ id: b.id, dto: { sort_order: a.sort_order } });
    const reordered = [...types];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    propagateNames(reordered.map((t, i) => ({ ...t, sort_order: i + 1 })));
  };

  if (isLoading) {
    return <div className="flex justify-center py-4"><Spinner className="size-[18px] text-[#1E6091]" /></div>;
  }

  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted-foreground">Types de lieux (référentiel)</div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Ces options sont partagées avec la carte, les filtres et l&apos;app mobile —
        toute modification s&apos;applique immédiatement partout.
      </p>
      <div className="flex flex-col gap-2">
        {types.map((t, idx) => (
          <div key={t.id} className="flex items-center gap-1.5">
            {/* Couleur du marqueur */}
            <Tooltip title="Couleur du marqueur">
              <label className="relative size-[22px] shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-border" style={{ background: t.color }}>
                <input
                  type="color"
                  aria-label={`Couleur de ${t.name}`}
                  defaultValue={t.color}
                  onBlur={(e) => { if (e.target.value !== t.color) updateMut.mutate({ id: t.id, dto: { color: e.target.value } }); }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </label>
            </Tooltip>
            <Input
              defaultValue={t.name}
              aria-label={`Nom du type ${t.name}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== t.name) {
                  updateMut.mutate({ id: t.id, dto: { name: v } });
                  propagateNames(types.map((x) => x.id === t.id ? { ...x, name: v } : x));
                }
              }}
              className="h-8 text-xs"
            />
            <div className="flex flex-col">
              <button type="button" aria-label="Monter" disabled={idx === 0} onClick={() => move(idx, -1)} className={arrowBtn}><ChevronUp size={13} /></button>
              <button type="button" aria-label="Descendre" disabled={idx === types.length - 1} onClick={() => move(idx, 1)} className={arrowBtn}><ChevronDown size={13} /></button>
            </div>
            <button
              type="button"
              aria-label={`Supprimer ${t.name}`}
              onClick={() => deleteMut.mutate(t.id)}
              disabled={types.length <= 1 || deleteMut.isPending}
              className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:text-red-600 disabled:cursor-default disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <Input
            placeholder="Nouveau type de lieu…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMut.mutate(newName); }}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="ghost" className="shrink-0 text-xs text-[#1E6091]" disabled={!newName.trim() || createMut.isPending} onClick={() => createMut.mutate(newName)}>
            {createMut.isPending ? <Spinner className="size-3" /> : <Plus size={14} />} Ajouter
          </Button>
        </div>
        {error && <Alert severity="error" className="text-xs" onClose={() => setError(null)}>{error}</Alert>}
      </div>
    </div>
  );
}

// ─── Field settings panel ────────────────────────────────────────────────────
function FieldSettings({ field, onChange, locationTypeMode = false }: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  locationTypeMode?: boolean;
}) {
  const hasOptions = ["select", "radio", "checkbox"].includes(field.type) && !locationTypeMode;

  const handleOptionChange = (idx: number, val: string) => {
    const opts = [...field.options];
    opts[idx] = val;
    onChange({ options: opts });
  };
  const addOption = () => onChange({ options: [...field.options, `Option ${field.options.length + 1}`] });
  const removeOption = (idx: number) => onChange({ options: field.options.filter((_, i) => i !== idx) });

  return (
    <div className="flex flex-col gap-4">
      <Field label="Label du champ"><Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} className="text-[13px]" /></Field>

      {["text","textarea","number","email","phone"].includes(field.type) && (
        <Field label="Placeholder"><Input value={field.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} className="text-[13px]" /></Field>
      )}

      <Field label="Texte d'aide (optionnel)"><Input value={field.helpText} onChange={(e) => onChange({ helpText: e.target.value })} className="text-[13px]" /></Field>

      {field.type === "number" && (
        <div className="flex gap-3">
          <Field label="Min" className="flex-1">
            <Input type="number" value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Max" className="flex-1">
            <Input type="number" value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
        </div>
      )}

      <label className="flex items-center gap-2">
        <Switch aria-label="Champ obligatoire" checked={field.required} onCheckedChange={(v) => onChange({ required: v })} />
        <span className="text-[13px]">Champ obligatoire</span>
      </label>

      {locationTypeMode && <LocationTypeOptionsEditor onNamesChanged={(names) => onChange({ options: names })} />}

      {hasOptions && (
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Options</div>
          <div className="flex flex-col gap-2">
            {field.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={opt} aria-label={`Option ${idx + 1}`} onChange={(e) => handleOptionChange(idx, e.target.value)} className="h-8 text-xs" />
                <button
                  type="button"
                  aria-label={`Retirer l'option ${idx + 1}`}
                  onClick={() => removeOption(idx)}
                  disabled={field.options.length <= 1}
                  className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:text-red-600 disabled:cursor-default disabled:opacity-30"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="self-start text-xs text-[#1E6091]" onClick={addOption}>
              <Plus size={14} /> Ajouter une option
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview dialog ──────────────────────────────────────────────────────────
function PreviewDialog({ open, onClose, form }: { open: boolean; onClose: () => void; form: FormTemplate }) {
  const ro = "pointer-events-none h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground flex items-center";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" accent={false} aria-describedby={undefined}>
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-bold text-foreground">{form.name}</h2>
            <div className="text-xs text-muted-foreground">{form.description}</div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={20} /></button>
        </div>
        <DialogBody className="max-h-[60vh] overflow-y-auto">
          {form.fields.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun champ ajouté</p>
          ) : (
            <div className="flex flex-col gap-5">
              {form.fields.map((f) => {
                const ftLabel = FIELD_TYPES.find((t) => t.type === f.type)?.label ?? f.type;
                const showInput = ["text","email","phone","number"].includes(f.type);
                const showTextarea = f.type === "textarea";
                const showSelect = f.type === "select";
                const showRadio = f.type === "radio";
                const showCheck = f.type === "checkbox";
                const showDate = f.type === "date" || f.type === "time";
                const isSpecial = ["gps","photo","signature"].includes(f.type);
                return (
                  <div key={f.id}>
                    <div className="mb-1 text-[13px] font-semibold text-foreground">{f.label}{f.required && <span className="text-red-600"> *</span>}</div>
                    {f.helpText && <div className="mb-1.5 text-[11px] text-muted-foreground">{f.helpText}</div>}
                    {showInput && <div className={ro}>{f.placeholder || `Saisir ${f.label.toLowerCase()}...`}</div>}
                    {showTextarea && <div className={`${ro} h-[76px] items-start py-2`}>{f.placeholder || "Saisir..."}</div>}
                    {showSelect && (
                      <div className={`${ro} justify-between`}>
                        <em>Sélectionner…</em><span className="text-[10px]">▼</span>
                      </div>
                    )}
                    {showRadio && (
                      <div className="mt-1 flex flex-col gap-1">
                        {f.options.map((o) => (
                          <div key={o} className="flex items-center gap-2">
                            <span className="size-3.5 rounded-full border-[1.5px] border-border-strong" />
                            <span className="text-[13px] text-muted-foreground">{o}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showCheck && (
                      <div className="mt-1 flex flex-col gap-1">
                        {f.options.map((o) => (
                          <div key={o} className="flex items-center gap-2">
                            <span className="size-3.5 rounded-sm border-[1.5px] border-border-strong" />
                            <span className="text-[13px] text-muted-foreground">{o}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showDate && <div className={ro}>{f.type === "date" ? "jj/mm/aaaa" : "--:--"}</div>}
                    {isSpecial && (
                      <div className="flex items-center gap-2 rounded-md border border-dashed border-border-strong bg-background p-3">
                        <i className={`ti ${FIELD_TYPES.find((t) => t.type === f.type)?.icon}`} style={{ fontSize: 18, color: "var(--text-muted)" }} aria-hidden />
                        <span className="text-xs text-muted-foreground">{ftLabel} — disponible sur mobile</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main builder page ────────────────────────────────────────────────────────
export default function FormBuilderPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const formId       = searchParams.get("id");

  const [form, setForm]         = useState<FormTemplate | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [snack, setSnack]       = useState("");
  const [preview, setPreview]   = useState(false);
  const [dirty, setDirty]       = useState(false);

  useEffect(() => {
    if (!formId) return;
    const all = loadForms();
    const found = all.find((f) => f.id === formId);
    if (found) setForm(found);
  }, [formId]);

  const updateForm = useCallback((patch: Partial<FormTemplate>) => {
    setForm((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
  }, []);

  const handleAddField = (type: FieldType) => {
    const field = defaultField(type);
    updateForm({ fields: [...(form?.fields ?? []), field] });
    setSelectedFieldId(field.id);
  };

  const handleUpdateField = (id: string, patch: Partial<FormField>) => {
    updateForm({ fields: (form?.fields ?? []).map((f) => f.id === id ? { ...f, ...patch } : f) });
  };

  const handleDeleteField = (id: string) => {
    updateForm({ fields: (form?.fields ?? []).filter((f) => f.id !== id) });
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleMoveField = (id: string, dir: "up" | "down") => {
    const fields = [...(form?.fields ?? [])];
    const idx = fields.findIndex((f) => f.id === id);
    if (dir === "up" && idx > 0) [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
    if (dir === "down" && idx < fields.length - 1) [fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]];
    updateForm({ fields });
  };

  const handleSave = async (publishAfter = false) => {
    if (!form) return;
    const toSave = publishAfter ? { ...form, status: "published" as FormStatus } : form;
    saveForm(toSave);
    if (toSave.id === SYSTEM_ID) {
      try { await syncCaptureConfigFromForm(toSave); } catch { /* noop — ne pas bloquer le save local */ }
    }
    setForm(toSave);
    setDirty(false);
    setSnack(publishAfter ? "Formulaire publié !" : "Enregistré !");
  };

  const selectedField = form?.fields.find((f) => f.id === selectedFieldId) ?? null;

  if (!form) return (
    <div className="flex items-center justify-center" style={{ minHeight: "calc(60vh / var(--ui-zoom))" }}>
      <span className="text-muted-foreground">Chargement…</span>
    </div>
  );

  const statusCls = form.status === "published" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white";

  return (
    <>
      {/* Top bar */}
      <div className="sticky top-16 z-[100] flex items-center gap-4 border-b border-border bg-surface px-6 py-3">
        <button
          type="button"
          aria-label="Retour aux formulaires"
          onClick={() => router.push("/forms")}
          className="cursor-pointer rounded-md border border-border bg-transparent p-1.5 text-foreground hover:bg-muted"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <input
            aria-label="Nom du formulaire"
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            className="w-full max-w-md border-0 border-b border-transparent bg-transparent text-base font-bold text-foreground outline-none hover:border-border focus:border-[#1E6091]"
          />
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 text-[10px] leading-[18px] ${statusCls}`}>
              {form.status === "published" ? "Publié" : form.status === "draft" ? "Brouillon" : "Archivé"}
            </span>
            <span className="rounded-full bg-[#1E6091]/10 px-2 text-[10px] leading-[18px] text-[#1E6091]">{CATEGORY_LABELS[form.category]}</span>
            {form.offlineSync && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2 text-[10px] leading-[18px] text-violet-800 dark:text-violet-300">
                <WifiOff size={11} /> Sync hors-ligne
              </span>
            )}
            {dirty && <span className="rounded-full bg-amber-500 px-2 text-[10px] leading-[18px] text-white">Non enregistré</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs text-muted-foreground" onClick={() => setPreview(true)}>
            <Eye size={15} /> Aperçu
          </Button>
          <Button size="sm" variant="outline" className="border-[#1E6091] text-xs text-[#1E6091]" onClick={() => handleSave()}>
            <Save size={15} /> Enregistrer
          </Button>
          {form.status !== "published" && (
            <Button size="sm" className="bg-emerald-600 text-xs hover:bg-emerald-700 hover:opacity-100" onClick={() => handleSave(true)}>
              <Upload size={15} /> Publier
            </Button>
          )}
        </div>
      </div>

      {/* Builder body */}
      <div className="flex bg-background" style={{ height: "calc(100vh / var(--ui-zoom) - 128px)" }}>

        {/* LEFT: Field palette */}
        <div className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-surface">
          <div className="border-b border-border px-4 py-3"><span className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">Ajouter un champ</span></div>
          <div className="p-3">
            {GROUPS.map((group) => (
              <div key={group} className="mb-3">
                <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">{group}</div>
                <div className="flex flex-col gap-1.5">
                  {FIELD_TYPES.filter((ft) => ft.group === group).map((ft) => (
                    <PaletteItem key={ft.type} ft={ft} onAdd={() => handleAddField(ft.type)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Form metadata */}
          <div className="mb-5 rounded-lg bg-surface p-5 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
            <div className={`${sectionTitle} mb-3`}>Informations du formulaire</div>
            <div className="flex flex-col gap-4">
              <Field label="Description">
                <Textarea rows={2} value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="Décrivez l'objectif de ce formulaire…" className="text-[13px]" />
              </Field>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Catégorie" className="min-w-44">
                  <Select value={form.category} onChange={(e) => updateForm({ category: e.target.value as FormCategory })} className="text-[13px]">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Field>
                <label className="flex h-9 items-center gap-2">
                  <Switch aria-label="Synchronisation hors-ligne" checked={form.offlineSync} onCheckedChange={(v) => updateForm({ offlineSync: v })} className={form.offlineSync ? "bg-[#7c3aed]" : ""} />
                  <span className="text-[13px]">Synchronisation hors-ligne</span>
                </label>
              </div>
            </div>
          </div>

          {/* Fields canvas */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className={sectionTitle}>Champs ({form.fields.length})</span>
              {selectedFieldId && (
                <span className="rounded-full bg-[#1E6091]/[0.06] px-2 text-[10px] leading-5 text-[#1E6091]">Cliquer sur un champ pour le sélectionner</span>
              )}
            </div>
            {form.fields.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
                <p className="mb-2 text-sm text-muted-foreground">Aucun champ ajouté</p>
                <p className="text-xs text-muted-foreground">Cliquez sur un type de champ dans le panneau de gauche pour commencer</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {form.fields.map((field, idx) => (
                  <FieldCard
                    key={field.id} field={field}
                    selected={selectedFieldId === field.id}
                    onSelect={() => setSelectedFieldId(field.id === selectedFieldId ? null : field.id)}
                    onDelete={() => handleDeleteField(field.id)}
                    onMoveUp={() => handleMoveField(field.id, "up")}
                    onMoveDown={() => handleMoveField(field.id, "down")}
                    isFirst={idx === 0} isLast={idx === form.fields.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Field settings */}
        <div className={`shrink-0 overflow-hidden border-l border-border bg-surface transition-[width] duration-200 ${selectedField ? "w-[280px]" : "w-0 border-l-0"}`}>
          {selectedField && (
            <div className="h-full w-[280px] overflow-y-auto">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Settings size={16} className="text-[#1E6091]" />
                <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">Propriétés</span>
                <button type="button" aria-label="Fermer les propriétés" onClick={() => setSelectedFieldId(null)} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>
              </div>
              <div className="px-4 py-4">
                <FieldSettings
                  field={selectedField}
                  // Champ "Type de lieu" du formulaire système : ses options
                  // sont le référentiel des types de lieux (même détection que
                  // syncCaptureConfigFromForm) — gérées en base, pas en statique.
                  locationTypeMode={form.id === SYSTEM_ID &&
                    (selectedField.id === "sys_f2" ||
                      (selectedField.type === "select" && selectedField.label.toLowerCase().includes("type")))}
                  onChange={(patch) => handleUpdateField(selectedField.id, patch)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <PreviewDialog open={preview} onClose={() => setPreview(false)} form={form} />

      <Snackbar open={!!snack} severity="success" autoHideMs={3000} onClose={() => setSnack("")}>{snack}</Snackbar>
    </>
  );
}
