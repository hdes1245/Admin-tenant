"use client";

import React, { useState, useEffect } from "react";
import { Camera, ListOrdered, LocateFixed, Lock, Pencil, Plus, Save, Smartphone, Trash2, Type } from "lucide-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import {
  fetchLocationTypes, createLocationType, updateLocationType, deleteLocationType, reorderLocationTypes,
  fetchCaptureConfig, saveCaptureConfig, saveCaptureConfigLocal, createExtraField,
  CaptureFormConfig, LocationType, CaptureExtraField, EXTRA_FIELD_TYPES, DEFAULT_CONFIG,
} from "@/lib/captureConfig";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { TabBar } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

export default function CaptureConfigClient() {
  return (
    <SidebarLayout>
      <div className="mx-auto max-w-[1100px]">
        <CaptureConfigPanel />
      </div>
    </SidebarLayout>
  );
}

export function CaptureConfigPanel() {
  const [tab, setTab] = useState(0);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground">Configuration du formulaire de capture</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Personnalisez le formulaire utilisé par les agents sur l&apos;application mobile pour enregistrer les localisations clients.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E6091]/20 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1E6091]">
          <Smartphone size={15} /> Formulaire mobile · Localiser client
        </span>
      </div>
      <TabBar
        className="mb-6 border-b border-border"
        value={tab}
        onChange={setTab}
        tabs={[
          <span key="0" className="flex items-center gap-2"><ListOrdered size={18} /> Types de lieux</span>,
          <span key="1" className="flex items-center gap-2"><Type size={18} /> Champs du formulaire</span>,
          <span key="2" className="flex items-center gap-2"><Smartphone size={18} /> Aperçu mobile</span>,
        ]}
      />
      {tab === 0 && <LocationTypesTab />}
      {tab === 1 && <FormFieldsTab />}
      {tab === 2 && <MobilePreviewTab />}
    </div>
  );
}

// ── LocationTypesTab ──────────────────────────────────────────────────────────
function LocationTypesTab() {
  const [types, setTypes]       = useState<LocationType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [addOpen, setAddOpen]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [newCode, setNewCode]   = useState("");
  const [newIcon, setNewIcon]   = useState("📍");
  const [newColor, setNewColor] = useState("#1E6091");
  const [, setSaved]            = useState(false);

  useEffect(() => {
    fetchLocationTypes().then((t) => { setTypes(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const EMOJIS = ["🏠","💼","🏪","🌾","🏭","🏫","🏥","🏦","🍽️","🏗️","📍","⭐"];

  const addType = async () => {
    if (!newName.trim()) return;
    const code = newCode.trim() || newName.trim().toLowerCase().replace(/\s+/g, "_");
    const t = await createLocationType({ name: newName.trim(), code, sort_order: types.length + 1 });
    setTypes((p) => [...p, t]);
    setAddOpen(false); setNewName(""); setNewCode(""); setNewIcon("📍"); setNewColor("#1E6091");
  };
  const del  = async (id: number) => {
    await deleteLocationType(id);
    const updated = types.filter((t) => t.id !== id).map((t, i) => ({ ...t, sort_order: i + 1 }));
    setTypes(updated);
    await reorderLocationTypes(updated.map((t) => t.id));
  };
  const saveRename = async (id: number, name: string) => {
    const t = await updateLocationType(id, { name });
    setTypes((p) => p.map((x) => x.id === id ? t : x));
    setEditId(null);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const arr = [...types]; const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    const reordered = arr.map((t, i) => ({ ...t, sort_order: i + 1 }));
    setTypes(reordered);
    await reorderLocationTypes(reordered.map((t) => t.id));
  };

  if (loading) return <div className="py-16 text-center"><Spinner className="size-7 text-[#1E6091]" /></div>;

  const grid = "grid grid-cols-[48px_1fr_160px_90px]";
  const arrowBtn = "cursor-pointer border-0 bg-transparent p-0.5 text-[9px] disabled:cursor-default disabled:text-muted-foreground/50";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-[13px] text-muted-foreground">
          Ces types apparaissent dans la liste déroulante du formulaire mobile. L&apos;ordre ici est l&apos;ordre d&apos;affichage.
          <strong className="text-[#1E6091]"> Les modifications sont enregistrées immédiatement et visibles sur l&apos;app mobile.</strong>
        </p>
        <Button variant="outline" size="sm" className="shrink-0 border-[#1E6091] text-[13px] text-[#1E6091]" onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Ajouter
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className={`${grid} bg-[#0F3B5C] px-4 py-3`}>
          {["Ordre", "Nom", "Code", "Actions"].map((h) => (
            <span key={h} className="text-[11px] font-bold uppercase tracking-wide text-white/60">{h}</span>
          ))}
        </div>
        {types.map((t, idx) => (
          <div key={t.id} className={`${grid} items-center border-b border-border px-4 py-3 hover:bg-blue-50/60 dark:hover:bg-white/5 ${idx % 2 === 0 ? "bg-surface" : "bg-surface-alt"}`}>
            <div className="flex flex-col items-center">
              <button type="button" aria-label="Monter" onClick={() => move(idx, -1)} disabled={idx === 0} className={`${arrowBtn} text-[#1E6091]`}>▲</button>
              <span className="text-[11px] font-bold text-foreground">{t.sort_order}</span>
              <button type="button" aria-label="Descendre" onClick={() => move(idx, 1)} disabled={idx === types.length - 1} className={`${arrowBtn} text-[#1E6091]`}>▼</button>
            </div>
            {editId === t.id ? (
              <Input
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveRename(t.id, editName)}
                onKeyDown={(e) => { if (e.key === "Enter") saveRename(t.id, editName); }}
                className="h-8 text-[13px]"
              />
            ) : (
              <span className="text-[13px] font-semibold text-foreground">{t.name}</span>
            )}
            <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
            <div className="flex gap-1">
              <Tooltip title="Renommer">
                <button type="button" aria-label="Renommer" onClick={() => { setEditId(t.id); setEditName(t.name); }} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-[#1E6091] hover:bg-blue-50">
                  <Pencil size={16} />
                </button>
              </Tooltip>
              <Tooltip title="Supprimer">
                <button type="button" aria-label="Supprimer" onClick={() => del(t.id)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Aucun type. Cliquez sur &quot;Ajouter&quot;.</div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader>Nouveau type de lieu</DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <Field label="Nom affiché *"><Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></Field>
            <Field label="Code interne" help="Laissez vide pour générer automatiquement"><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} /></Field>
            <div className="flex items-center gap-4">
              <Field label="Icône" className="min-w-28">
                <Select value={newIcon} onChange={(e) => setNewIcon(e.target.value)} className="text-lg">
                  {EMOJIS.map((em) => <option key={em} value={em}>{em}</option>)}
                </Select>
              </Field>
              <div>
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Couleur</span>
                <div className="relative size-10 overflow-hidden rounded border-2 border-border" style={{ background: newColor }}>
                  <input type="color" aria-label="Couleur" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={addType} disabled={!newName.trim()} className="hover:bg-[#1E6091] hover:opacity-100">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FormFieldsTab ─────────────────────────────────────────────────────────────
function FormFieldsTab() {
  const [cfg, setCfg]             = useState<CaptureFormConfig>(DEFAULT_CONFIG);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [editField, setEditField] = useState<CaptureExtraField | null>(null);

  useEffect(() => {
    fetchCaptureConfig().then((c) => { setCfg(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await saveCaptureConfig(cfg);
    saveCaptureConfigLocal(cfg); // cache local pour aperçu synchrone
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const updType  = (patch: Partial<CaptureFormConfig["typeField"]>)  => setCfg((c) => ({ ...c, typeField:  { ...c.typeField,  ...patch } }));
  const updLabel = (patch: Partial<CaptureFormConfig["labelField"]>) => setCfg((c) => ({ ...c, labelField: { ...c.labelField, ...patch } }));
  const updPhoto = (patch: Partial<CaptureFormConfig["photoField"]>) => setCfg((c) => ({ ...c, photoField: { ...c.photoField, ...patch } }));

  const addExtra = (type: CaptureExtraField["type"]) => {
    const f = createExtraField(type);
    f.sortOrder = cfg.extraFields.length + 1;
    setCfg((c) => ({ ...c, extraFields: [...c.extraFields, f] }));
  };
  const delExtra = (id: string) => setCfg((c) => ({ ...c, extraFields: c.extraFields.filter((f) => f.id !== id).map((f, i) => ({ ...f, sortOrder: i + 1 })) }));
  const updExtra = (id: string, patch: Partial<CaptureExtraField>) => setCfg((c) => ({ ...c, extraFields: c.extraFields.map((f) => f.id === id ? { ...f, ...patch } : f) }));
  const saveExtra = (updated: CaptureExtraField) => { updExtra(updated.id, updated); setEditField(null); };

  const FIELD_TYPE_LABELS: Record<string, string> = {
    text: "Texte court", textarea: "Texte long", number: "Nombre",
    select: "Liste déroulante", radio: "Choix unique", checkbox: "Cases à cocher", photo: "Photo",
  };

  if (loading) return <div className="py-16 text-center"><Spinner className="size-7 text-[#1E6091]" /></div>;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_280px]">
      {/* Left — champs */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-foreground">Champs du formulaire</h2>
          <Button size="sm" className={`text-[13px] ${saved ? "bg-emerald-600" : "hover:bg-[#1E6091] hover:opacity-100"}`} onClick={save} disabled={saving}>
            <Save size={15} /> {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </div>

        {/* Fixed — GPS */}
        <FixedFieldCard icon={<LocateFixed size={16} />} label="Coordonnées GPS" description="Latitude / Longitude — automatique, toujours présent" />

        {/* Fixed — Adresse */}
        <FixedFieldCard icon={<Lock size={16} />} label="Adresse (géocodage inverse)" description="Déduite des coordonnées GPS — toujours présente" />

        {/* Configurable — Type de lieu */}
        <ConfigurableFieldCard
          icon="🏷️" label={cfg.typeField.label}
          enabled={cfg.typeField.enabled} required={cfg.typeField.required}
          onToggleEnabled={(v) => updType({ enabled: v })}
          onToggleRequired={(v) => updType({ required: v })}
          onLabelChange={(v) => updType({ label: v })}
          detail="Dropdown avec les types définis dans l'onglet Types de lieux"
        />

        {/* Configurable — Nom du lieu */}
        <ConfigurableFieldCard
          icon="🏠" label={cfg.labelField.label}
          enabled={cfg.labelField.enabled} required={cfg.labelField.required}
          onToggleEnabled={(v) => updLabel({ enabled: v })}
          onToggleRequired={(v) => updLabel({ required: v })}
          onLabelChange={(v) => updLabel({ label: v })}
          detail={`Placeholder : "${cfg.labelField.placeholder}"`}
          extraContent={
            <Input aria-label="Placeholder" placeholder="Placeholder" value={cfg.labelField.placeholder}
              onChange={(e) => updLabel({ placeholder: e.target.value })} className="mt-2 text-xs" />
          }
        />

        {/* Configurable — Photos */}
        <div className={`mb-4 rounded-lg border border-border p-4 ${cfg.photoField.enabled ? "bg-surface" : "bg-background"}`}>
          <div className="mb-2 flex items-center gap-2">
            <Camera size={20} className={cfg.photoField.enabled ? "text-[#1E6091]" : "text-muted-foreground/60"} />
            <span className={`flex-1 text-[13px] font-bold ${cfg.photoField.enabled ? "text-foreground" : "text-muted-foreground/60"}`}>Photos</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Requis</span>
                <Switch aria-label="Photos requises" checked={cfg.photoField.required} disabled={!cfg.photoField.enabled} onCheckedChange={(v) => updPhoto({ required: v })} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Actif</span>
                <Switch aria-label="Photos actives" checked={cfg.photoField.enabled} onCheckedChange={(v) => updPhoto({ enabled: v })} />
              </div>
            </div>
          </div>
          {cfg.photoField.enabled && (
            <div className="px-2">
              <div className="mb-1 text-xs text-muted-foreground">Nombre max de photos : <strong>{cfg.photoField.maxCount}</strong></div>
              <input
                type="range" aria-label="Nombre max de photos" min={1} max={10} step={1} value={cfg.photoField.maxCount}
                onChange={(e) => updPhoto({ maxCount: Number(e.target.value) })}
                className="w-full cursor-pointer accent-[#1E6091]"
              />
            </div>
          )}
        </div>

        {/* Extra fields */}
        {cfg.extraFields.map((f) => (
          <ExtraFieldCard key={f.id} field={f}
            onToggleEnabled={(v) => updExtra(f.id, { enabled: v })}
            onToggleRequired={(v) => updExtra(f.id, { required: v })}
            onEdit={() => setEditField(f)}
            onDelete={() => delExtra(f.id)}
            typeLabel={FIELD_TYPE_LABELS[f.type] ?? f.type}
          />
        ))}
      </div>

      {/* Right — palette */}
      <div className="sticky top-20">
        <h3 className="mb-3 text-[13px] font-bold text-foreground">Ajouter un champ</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          {EXTRA_FIELD_TYPES.map((ft, idx) => (
            <button
              key={ft.type}
              type="button"
              onClick={() => addExtra(ft.type)}
              className={`flex w-full cursor-pointer items-center gap-3 border-0 bg-surface px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-white/5 ${idx < EXTRA_FIELD_TYPES.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#1E6091]/10 text-[#1E6091]"><Plus size={16} /></span>
              <div>
                <div className="text-[13px] font-semibold text-foreground">{ft.label}</div>
                <div className="text-[11px] text-muted-foreground">{ft.type}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-normal text-muted-foreground">
          Cliquez sur un type pour l&apos;ajouter au bas du formulaire. Vous pourrez ensuite le configurer en cliquant sur ✏️.
        </p>
      </div>

      {/* Edit extra field dialog */}
      {editField && <ExtraFieldEditDialog field={editField} onSave={saveExtra} onClose={() => setEditField(null)} />}
    </div>
  );
}

// ── FixedFieldCard ────────────────────────────────────────────────────────────
function FixedFieldCard({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-background p-4">
      <span className="text-muted-foreground/60">{icon}</span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-muted-foreground/60">{label}</div>
        <div className="text-[11px] text-muted-foreground/60">{description}</div>
      </div>
      <span className="rounded-full bg-slate-200 px-2 text-[10px] leading-5 text-slate-600">Fixe</span>
    </div>
  );
}

function RequiredActiveSwitches({ required, enabled, onRequired, onEnabled, label }: { required: boolean; enabled: boolean; onRequired: (v: boolean) => void; onEnabled: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground">Requis</span>
        <Switch aria-label={`${label} requis`} checked={required} disabled={!enabled} onCheckedChange={onRequired} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground">Actif</span>
        <Switch aria-label={`${label} actif`} checked={enabled} onCheckedChange={onEnabled} />
      </div>
    </div>
  );
}

// ── ConfigurableFieldCard ─────────────────────────────────────────────────────
function ConfigurableFieldCard({
  icon, label, enabled, required, detail, extraContent,
  onToggleEnabled, onToggleRequired, onLabelChange,
}: {
  icon: string; label: string; enabled: boolean; required: boolean; detail?: string; extraContent?: React.ReactNode;
  onToggleEnabled: (v: boolean) => void; onToggleRequired: (v: boolean) => void; onLabelChange: (v: string) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel]     = useState(label);
  return (
    <div className={`mb-4 rounded-lg border p-4 ${enabled ? "border-[#1E6091]/20 bg-surface" : "border-border bg-background"}`}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 18, opacity: enabled ? 1 : 0.4 }}>{icon}</span>
        {editingLabel ? (
          <Input
            value={draftLabel}
            autoFocus
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => { onLabelChange(draftLabel); setEditingLabel(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onLabelChange(draftLabel); setEditingLabel(false); } }}
            className="h-8 flex-1 text-[13px] font-bold"
          />
        ) : (
          <span
            onClick={() => { setDraftLabel(label); setEditingLabel(true); }}
            className={`flex-1 cursor-text text-[13px] font-bold transition-colors hover:text-[#1E6091] ${enabled ? "text-foreground" : "text-muted-foreground/60"}`}
          >
            {label} <span className="text-[10px] font-normal text-muted-foreground">(cliquer pour renommer)</span>
          </span>
        )}
        <RequiredActiveSwitches required={required} enabled={enabled} onRequired={onToggleRequired} onEnabled={onToggleEnabled} label={label} />
      </div>
      {detail && <div className="ml-7 mt-1 text-[11px] text-muted-foreground">{detail}</div>}
      {enabled && extraContent && <div className="ml-7">{extraContent}</div>}
    </div>
  );
}

// ── ExtraFieldCard ────────────────────────────────────────────────────────────
function ExtraFieldCard({ field, typeLabel, onToggleEnabled, onToggleRequired, onEdit, onDelete }: {
  field: CaptureExtraField; typeLabel: string;
  onToggleEnabled: (v: boolean) => void; onToggleRequired: (v: boolean) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`mb-4 rounded-lg border p-4 ${field.enabled ? "border-[#3C8047]/40 bg-[#FFFBF0] dark:bg-surface" : "border-border bg-background"}`}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#3C8047]/15 px-2 text-[10px] font-semibold leading-5 text-amber-800 dark:text-amber-300">{typeLabel}</span>
        <span className={`flex-1 text-[13px] font-bold ${field.enabled ? "text-foreground" : "text-muted-foreground/60"}`}>{field.label}</span>
        <div className="flex items-center gap-3">
          <RequiredActiveSwitches required={field.required} enabled={field.enabled} onRequired={onToggleRequired} onEnabled={onToggleEnabled} label={field.label} />
          <Tooltip title="Modifier">
            <button type="button" aria-label="Modifier" onClick={onEdit} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-[#1E6091] hover:bg-blue-50"><Pencil size={16} /></button>
          </Tooltip>
          <Tooltip title="Supprimer">
            <button type="button" aria-label="Supprimer" onClick={onDelete} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
          </Tooltip>
        </div>
      </div>
      {field.placeholder && <div className="mt-1 text-[11px] text-muted-foreground">Placeholder : {field.placeholder}</div>}
      {field.helpText && <div className="mt-0.5 text-[11px] text-muted-foreground">Aide : {field.helpText}</div>}
      {field.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {field.options.map((o) => <span key={o} className="rounded-full bg-muted px-2 text-[10px] leading-[18px]">{o}</span>)}
        </div>
      )}
    </div>
  );
}

// ── ExtraFieldEditDialog ──────────────────────────────────────────────────────
function ExtraFieldEditDialog({ field, onSave, onClose }: { field: CaptureExtraField; onSave: (f: CaptureExtraField) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<CaptureExtraField>({ ...field, options: [...field.options] });
  const [newOption, setNewOption] = useState("");

  const upd = (patch: Partial<CaptureExtraField>) => setDraft((d) => ({ ...d, ...patch }));
  const addOpt = () => { if (!newOption.trim()) return; upd({ options: [...draft.options, newOption.trim()] }); setNewOption(""); };
  const delOpt = (i: number) => upd({ options: draft.options.filter((_, idx) => idx !== i) });

  const hasOptions = ["select", "radio", "checkbox"].includes(draft.type);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" accent={false} aria-describedby={undefined}>
        <DialogHeader>Modifier le champ</DialogHeader>
        <DialogBody className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto">
          <Field label="Libellé *"><Input value={draft.label} onChange={(e) => upd({ label: e.target.value })} autoFocus /></Field>
          <Field label="Placeholder"><Input value={draft.placeholder} onChange={(e) => upd({ placeholder: e.target.value })} /></Field>
          <Field label="Texte d'aide"><Input value={draft.helpText} onChange={(e) => upd({ helpText: e.target.value })} /></Field>
          {hasOptions && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-foreground">Options</div>
              {draft.options.map((o, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2">
                  <span className="flex-1 rounded border border-border-strong px-3 py-1.5 text-[13px]">{o}</span>
                  <button type="button" aria-label={`Supprimer l'option ${o}`} onClick={() => delOpt(i)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addOpt(); }} placeholder="Nouvelle option..." className="flex-1" />
                <Button variant="outline" size="sm" className="border-[#1E6091] text-[#1E6091]" onClick={addOpt}>Ajouter</Button>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter className="border-t-0">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(draft)} disabled={!draft.label.trim()} className="hover:bg-[#1E6091] hover:opacity-100">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── MobilePreviewTab ──────────────────────────────────────────────────────────
function MobilePreviewTab() {
  // La config doit refléter la valeur réellement enregistrée côté serveur
  // (GET /tenants/me/capture-config), pas le cache localStorage local à ce
  // navigateur — sinon un premier accès à cet onglet, un autre appareil, ou
  // une modification faite par un autre admin_tenant affiche un aperçu
  // obsolète ou la config par défaut au lieu de la config réelle.
  const [cfg, setCfg] = useState<CaptureFormConfig>(DEFAULT_CONFIG);
  const [types, setTypes] = useState<LocationType[]>([]);
  useEffect(() => { fetchCaptureConfig().then(setCfg).catch(() => {}); }, []);
  useEffect(() => { fetchLocationTypes().then(setTypes).catch(() => {}); }, []);

  const box = "rounded-md border border-slate-300 bg-white px-3 py-2";
  const photoBox = "flex size-14 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white";

  return (
    <div className="flex justify-center pt-4">
      <div>
        <p className="mb-6 text-center text-[13px] text-muted-foreground">Aperçu du formulaire tel qu&apos;il apparaîtra sur l&apos;application mobile</p>
        {/* Phone frame */}
        <div className="relative mx-auto w-80 overflow-hidden rounded-[36px] border-[12px] border-slate-800 shadow-[0_25px_50px_rgba(0,0,0,0.3)]">
          <div className="mx-auto mt-2 h-1.5 w-20 rounded-[3px] bg-slate-800" />
          {/* Status bar */}
          <div className="flex justify-between bg-[#0F3B5C] px-4 py-2">
            <span className="text-[10px] text-white/80">9:41</span>
            <span className="text-[10px] text-white/80">●●●</span>
          </div>
          {/* App bar */}
          <div className="flex items-center gap-2 bg-[#0F3B5C] px-4 py-3">
            <span className="flex size-6 items-center justify-center rounded-full bg-white/15 text-xs text-white">←</span>
            <span className="flex-1 text-sm font-bold text-white">Capturer localisation</span>
          </div>
          {/* Form body */}
          <div className="min-h-[420px] bg-slate-50 p-4">
            {/* GPS indicator */}
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-sky-100 p-3">
              <LocateFixed size={14} className="text-sky-600" />
              <span className="text-[11px] font-semibold text-sky-600">GPS actif · 48.8566, 2.3522</span>
            </div>

            {/* Type de lieu */}
            {cfg.typeField.enabled && (
              <PreviewField label={cfg.typeField.label} required={cfg.typeField.required}>
                <div className={`${box} flex items-center justify-between`}>
                  <span className={`text-xs ${types.length > 0 ? "text-slate-800" : "text-slate-400"}`}>
                    {types.length > 0 ? `${types[0].icon} ${types[0].name}` : "Sélectionnez..."}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </div>
              </PreviewField>
            )}

            {/* Nom du lieu */}
            {cfg.labelField.enabled && (
              <PreviewField label={cfg.labelField.label} required={cfg.labelField.required}>
                <div className={box}><span className="text-xs text-slate-400">{cfg.labelField.placeholder}</span></div>
              </PreviewField>
            )}

            {/* Photos */}
            {cfg.photoField.enabled && (
              <PreviewField label="Photos" required={cfg.photoField.required}>
                <div className="flex flex-wrap gap-2">
                  <div className={photoBox}>
                    <Camera size={18} className="text-slate-400" />
                    <span className="text-[8px] text-slate-400">Ajouter</span>
                  </div>
                  <span className="self-end text-[10px] text-slate-400">Max {cfg.photoField.maxCount}</span>
                </div>
              </PreviewField>
            )}

            {/* Extra fields */}
            {cfg.extraFields.filter((f: CaptureExtraField) => f.enabled).map((f: CaptureExtraField) => (
              <PreviewField key={f.id} label={f.label} required={f.required}>
                {f.type === "textarea" ? (
                  <div className={`${box} h-[52px]`}><span className="text-xs text-slate-400">{f.placeholder || "Saisir..."}</span></div>
                ) : f.type === "select" ? (
                  <div className={`${box} flex justify-between`}>
                    <span className="text-xs text-slate-400">{f.options[0] ?? "Sélectionner..."}</span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </div>
                ) : f.type === "checkbox" ? (
                  <div className="flex flex-col gap-1">
                    {f.options.slice(0, 3).map((o: string) => (
                      <div key={o} className="flex items-center gap-2">
                        <span className="size-3.5 rounded-sm border-[1.5px] border-slate-300 bg-white" />
                        <span className="text-[11px] text-slate-700">{o}</span>
                      </div>
                    ))}
                  </div>
                ) : f.type === "photo" ? (
                  <div className={photoBox}><Camera size={18} className="text-slate-400" /></div>
                ) : (
                  <div className={box}><span className="text-xs text-slate-400">{f.placeholder || "Saisir..."}</span></div>
                )}
              </PreviewField>
            ))}

            {/* Submit button */}
            <div className="mt-4 rounded-lg bg-[#0F3B5C] py-3 text-center">
              <span className="text-[13px] font-bold text-white">Enregistrer la localisation</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Cet aperçu est indicatif — le rendu réel peut légèrement varier.</p>
      </div>
    </div>
  );
}

// ── PreviewField ──────────────────────────────────────────────────────────────
function PreviewField({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-semibold text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-600">*</span>}
      </div>
      {children}
    </div>
  );
}
