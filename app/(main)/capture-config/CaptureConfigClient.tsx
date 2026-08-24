"use client";

import React, { useState, useEffect } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import {
  Box, Tabs, Tab, Typography, Button, IconButton, Chip,
  Switch, TextField, Slider, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Select, FormControl,
  InputLabel, Tooltip,
} from "@mui/material";
import AddIcon              from "@mui/icons-material/Add";
import DeleteIcon           from "@mui/icons-material/Delete";
import EditIcon             from "@mui/icons-material/Edit";
import PhoneAndroidIcon     from "@mui/icons-material/PhoneAndroid";
import SaveIcon             from "@mui/icons-material/Save";
import LockIcon             from "@mui/icons-material/Lock";
import GpsFixedIcon         from "@mui/icons-material/GpsFixed";
import PhotoCameraIcon      from "@mui/icons-material/PhotoCamera";
import ListIcon             from "@mui/icons-material/List";
import TextFieldsIcon       from "@mui/icons-material/TextFields";
import { SidebarLayout }    from "@/components/layout/SidebarLayout";
import {
  fetchLocationTypes, createLocationType, updateLocationType, deleteLocationType, reorderLocationTypes,
  fetchCaptureConfig, saveCaptureConfig, saveCaptureConfigLocal, createExtraField,
  CaptureFormConfig, LocationType, CaptureExtraField, EXTRA_FIELD_TYPES, DEFAULT_CONFIG,
} from "@/lib/captureConfig";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

export default function CaptureConfigClient() {
  return (
    <SidebarLayout>
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <CaptureConfigPanel />
      </Box>
    </SidebarLayout>
  );
}

export function CaptureConfigPanel() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography fontWeight={800} fontSize={22} color={NAVY}>Configuration du formulaire de capture</Typography>
          <Typography fontSize={13} color="text.secondary" mt={0.4}>
            Personnalisez le formulaire utilisé par les agents sur l&apos;application mobile pour enregistrer les localisations clients.
          </Typography>
        </Box>
        <Chip icon={<PhoneAndroidIcon sx={{ fontSize: 15 }} />} label="Formulaire mobile · Localiser client"
          size="small" sx={{ bgcolor: "#EFF6FF", color: STEEL, border: `1px solid ${STEEL}30`, fontWeight: 600 }} />
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        mb: 3, borderBottom: "1px solid rgba(0,0,0,0.08)",
        "& .MuiTab-root": { fontSize: 13, fontWeight: 600, textTransform: "none" },
        "& .Mui-selected": { color: NAVY },
        "& .MuiTabs-indicator": { bgcolor: GOLD, height: 3 },
      }}>
        <Tab label="Types de lieux"        icon={<ListIcon        sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Champs du formulaire"  icon={<TextFieldsIcon  sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Aperçu mobile"         icon={<PhoneAndroidIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>
      {tab === 0 && <LocationTypesTab />}
      {tab === 1 && <FormFieldsTab />}
      {tab === 2 && <MobilePreviewTab />}
    </Box>
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
  const [newColor, setNewColor] = useState("#1B4F72");
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    fetchLocationTypes().then((t) => { setTypes(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const EMOJIS = ["🏠","💼","🏪","🌾","🏭","🏫","🏥","🏦","🍽️","🏗️","📍","⭐"];

  const addType = async () => {
    if (!newName.trim()) return;
    const code = newCode.trim() || newName.trim().toLowerCase().replace(/\s+/g, "_");
    const t = await createLocationType({ name: newName.trim(), code, sort_order: types.length + 1 });
    setTypes((p) => [...p, t]);
    setAddOpen(false); setNewName(""); setNewCode(""); setNewIcon("📍"); setNewColor("#1B4F72");
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

  if (loading) return <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress size={28} sx={{ color: STEEL }} /></Box>;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography fontSize={13} color="text.secondary">
          Ces types apparaissent dans la liste déroulante du formulaire mobile. L&apos;ordre ici est l&apos;ordre d&apos;affichage.
          <strong style={{ color: STEEL }}> Les modifications sont enregistrées immédiatement et visibles sur l&apos;app mobile.</strong>
        </Typography>
        <Button startIcon={<AddIcon />} variant="outlined" size="small"
          sx={{ borderColor: STEEL, color: STEEL, fontSize: 13, flexShrink: 0 }} onClick={() => setAddOpen(true)}>
          Ajouter
        </Button>
      </Box>

      <Box sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 90px", bgcolor: NAVY, px: 2, py: 1.5 }}>
          {["Ordre", "Nom", "Code", "Actions"].map((h) => (
            <Typography key={h} fontSize={11} fontWeight={700} color="rgba(255,255,255,0.6)" textTransform="uppercase" letterSpacing={0.5}>{h}</Typography>
          ))}
        </Box>
        {types.map((t, idx) => (
          <Box key={t.id} sx={{ display: "grid", gridTemplateColumns: "48px 1fr 160px 90px", alignItems: "center", px: 2, py: 1.5, bgcolor: idx % 2 === 0 ? "#fff" : "#F8FAFC", borderBottom: "1px solid rgba(0,0,0,0.05)", "&:hover": { bgcolor: "#F0F7FF" } }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <IconButton size="small" onClick={() => move(idx, -1)} disabled={idx === 0} sx={{ p: 0.2 }}>
                <Typography fontSize={9} color={idx === 0 ? "text.disabled" : STEEL}>▲</Typography>
              </IconButton>
              <Typography fontSize={11} fontWeight={700} color={NAVY}>{t.sort_order}</Typography>
              <IconButton size="small" onClick={() => move(idx, 1)} disabled={idx === types.length - 1} sx={{ p: 0.2 }}>
                <Typography fontSize={9} color={idx === types.length - 1 ? "text.disabled" : STEEL}>▼</Typography>
              </IconButton>
            </Box>
            {editId === t.id ? (
              <TextField size="small" value={editName} autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveRename(t.id, editName)}
                onKeyDown={(e) => { if (e.key === "Enter") saveRename(t.id, editName); }}
                sx={{ "& .MuiInputBase-input": { fontSize: 13, py: 0.5 } }} />
            ) : (
              <Typography fontSize={13} fontWeight={600} color={NAVY}>{t.name}</Typography>
            )}
            <Typography fontSize={12} color="text.secondary" fontFamily="monospace">{t.code}</Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Renommer">
                <IconButton size="small" onClick={() => { setEditId(t.id); setEditName(t.name); }} sx={{ color: STEEL }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Supprimer">
                <IconButton size="small" onClick={() => del(t.id)} sx={{ color: "#DC2626" }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ))}
        {types.length === 0 && (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography fontSize={13} color="text.secondary">Aucun type. Cliquez sur &quot;Ajouter&quot;.</Typography>
          </Box>
        )}
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: NAVY }}>Nouveau type de lieu</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack gap={2.5} sx={{ pt: 1 }}>
            <TextField label="Nom affiché *" value={newName} onChange={(e) => setNewName(e.target.value)} size="small" fullWidth autoFocus />
            <TextField label="Code interne" value={newCode} onChange={(e) => setNewCode(e.target.value)} size="small" fullWidth helperText="Laissez vide pour générer automatiquement" />
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Icône</InputLabel>
                <Select value={newIcon} onChange={(e) => setNewIcon(e.target.value)} label="Icône" sx={{ fontSize: 18 }}>
                  {EMOJIS.map((em) => <MenuItem key={em} value={em} sx={{ fontSize: 18 }}>{em}</MenuItem>)}
                </Select>
              </FormControl>
              <Box>
                <Typography fontSize={12} color="text.secondary" mb={0.5}>Couleur</Typography>
                <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: newColor, border: "2px solid #E2E8F0", overflow: "hidden", position: "relative" }}>
                  <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                </Box>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: "text.secondary" }}>Annuler</Button>
          <Button variant="contained" onClick={addType} disabled={!newName.trim()} sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>Ajouter</Button>
        </DialogActions>
      </Dialog>
    </Box>
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

  if (loading) return <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress size={28} sx={{ color: STEEL }} /></Box>;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 3, alignItems: "start" }}>
      {/* Left — champs */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography fontWeight={700} fontSize={15} color={NAVY}>Champs du formulaire</Typography>
          <Button startIcon={<SaveIcon />} variant="contained" size="small"
            sx={{ bgcolor: saved ? "#059669" : NAVY, "&:hover": { bgcolor: STEEL }, fontSize: 13 }} onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </Box>

        {/* Fixed — GPS */}
        <FixedFieldCard icon={<GpsFixedIcon sx={{ fontSize: 16 }} />} label="Coordonnées GPS" description="Latitude / Longitude — automatique, toujours présent" />

        {/* Fixed — Adresse */}
        <FixedFieldCard icon={<LockIcon sx={{ fontSize: 16 }} />} label="Adresse (géocodage inverse)" description="Déduite des coordonnées GPS — toujours présente" />

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
            <TextField size="small" label="Placeholder" value={cfg.labelField.placeholder}
              onChange={(e) => updLabel({ placeholder: e.target.value })}
              sx={{ mt: 1, "& .MuiInputBase-input": { fontSize: 12 } }} fullWidth />
          }
        />

        {/* Configurable — Photos */}
        <Box sx={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 2, p: 2, mb: 2, bgcolor: cfg.photoField.enabled ? "#fff" : "#F8FAFC" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <PhotoCameraIcon sx={{ fontSize: 20, color: cfg.photoField.enabled ? STEEL : "text.disabled" }} />
            <Typography fontSize={13} fontWeight={700} color={cfg.photoField.enabled ? NAVY : "text.disabled"} flex={1}>Photos</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography fontSize={11} color="text.secondary">Requis</Typography>
                <Switch size="small" checked={cfg.photoField.required} disabled={!cfg.photoField.enabled}
                  onChange={(e) => updPhoto({ required: e.target.checked })} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography fontSize={11} color="text.secondary">Actif</Typography>
                <Switch size="small" checked={cfg.photoField.enabled}
                  onChange={(e) => updPhoto({ enabled: e.target.checked })} />
              </Box>
            </Box>
          </Box>
          {cfg.photoField.enabled && (
            <Box sx={{ px: 1 }}>
              <Typography fontSize={12} color="text.secondary" mb={0.5}>Nombre max de photos : <strong>{cfg.photoField.maxCount}</strong></Typography>
              <Slider min={1} max={10} step={1} value={cfg.photoField.maxCount}
                onChange={(_, v) => updPhoto({ maxCount: v as number })}
                sx={{ color: STEEL, "& .MuiSlider-thumb": { width: 16, height: 16 } }} />
            </Box>
          )}
        </Box>

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
      </Box>

      {/* Right — palette */}
      <Box sx={{ position: "sticky", top: 80 }}>
        <Typography fontWeight={700} fontSize={13} color={NAVY} mb={1.5}>Ajouter un champ</Typography>
        <Box sx={{ borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {EXTRA_FIELD_TYPES.map((ft, idx) => (
            <Box key={ft.type} onClick={() => addExtra(ft.type)} sx={{
              display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5,
              borderBottom: idx < EXTRA_FIELD_TYPES.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              cursor: "pointer", bgcolor: "#fff",
              "&:hover": { bgcolor: "#EFF6FF" },
              transition: "background 0.15s",
            }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${STEEL}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AddIcon sx={{ fontSize: 16, color: STEEL }} />
              </Box>
              <Box>
                <Typography fontSize={13} fontWeight={600} color={NAVY}>{ft.label}</Typography>
                <Typography fontSize={11} color="text.secondary">{ft.type}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Typography fontSize={11} color="text.secondary" mt={1.5} lineHeight={1.5}>
          Cliquez sur un type pour l&apos;ajouter au bas du formulaire. Vous pourrez ensuite le configurer en cliquant sur ✏️.
        </Typography>
      </Box>

      {/* Edit extra field dialog */}
      {editField && (
        <ExtraFieldEditDialog field={editField} onSave={saveExtra} onClose={() => setEditField(null)} />
      )}
    </Box>
  );
}

// ── FixedFieldCard ────────────────────────────────────────────────────────────
function FixedFieldCard({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <Box sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 2, p: 2, mb: 2, bgcolor: "#F8FAFC", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ color: "text.disabled" }}>{icon}</Box>
      <Box flex={1}>
        <Typography fontSize={13} fontWeight={600} color="text.disabled">{label}</Typography>
        <Typography fontSize={11} color="text.disabled">{description}</Typography>
      </Box>
      <Chip label="Fixe" size="small" sx={{ fontSize: 10, height: 20, bgcolor: "#E2E8F0", color: "#64748B" }} />
    </Box>
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
    <Box sx={{ border: `1px solid ${enabled ? STEEL + "30" : "rgba(0,0,0,0.08)"}`, borderRadius: 2, p: 2, mb: 2, bgcolor: enabled ? "#fff" : "#F8FAFC" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 18, opacity: enabled ? 1 : 0.4 }}>{icon}</span>
        {editingLabel ? (
          <TextField size="small" value={draftLabel} autoFocus
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => { onLabelChange(draftLabel); setEditingLabel(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onLabelChange(draftLabel); setEditingLabel(false); } }}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 13, fontWeight: 700, py: 0.5 } }} />
        ) : (
          <Typography fontSize={13} fontWeight={700} color={enabled ? NAVY : "text.disabled"} flex={1}
            onClick={() => { setDraftLabel(label); setEditingLabel(true); }}
            sx={{ cursor: "text", "&:hover": { color: STEEL }, transition: "color 0.15s" }}>
            {label} <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 400 }}>(cliquer pour renommer)</span>
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography fontSize={11} color="text.secondary">Requis</Typography>
            <Switch size="small" checked={required} disabled={!enabled} onChange={(e) => onToggleRequired(e.target.checked)} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography fontSize={11} color="text.secondary">Actif</Typography>
            <Switch size="small" checked={enabled} onChange={(e) => onToggleEnabled(e.target.checked)} />
          </Box>
        </Box>
      </Box>
      {detail && <Typography fontSize={11} color="text.secondary" mt={0.5} ml={3.5}>{detail}</Typography>}
      {enabled && extraContent && <Box ml={3.5}>{extraContent}</Box>}
    </Box>
  );
}

// ── ExtraFieldCard ────────────────────────────────────────────────────────────
function ExtraFieldCard({ field, typeLabel, onToggleEnabled, onToggleRequired, onEdit, onDelete }: {
  field: CaptureExtraField; typeLabel: string;
  onToggleEnabled: (v: boolean) => void; onToggleRequired: (v: boolean) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <Box sx={{ border: `1px solid ${field.enabled ? GOLD + "60" : "rgba(0,0,0,0.08)"}`, borderRadius: 2, p: 2, mb: 2, bgcolor: field.enabled ? "#FFFBF0" : "#F8FAFC" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip label={typeLabel} size="small" sx={{ fontSize: 10, height: 20, bgcolor: `${GOLD}20`, color: "#92400E", fontWeight: 600 }} />
        <Typography fontSize={13} fontWeight={700} color={field.enabled ? NAVY : "text.disabled"} flex={1}>{field.label}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography fontSize={11} color="text.secondary">Requis</Typography>
            <Switch size="small" checked={field.required} disabled={!field.enabled} onChange={(e) => onToggleRequired(e.target.checked)} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography fontSize={11} color="text.secondary">Actif</Typography>
            <Switch size="small" checked={field.enabled} onChange={(e) => onToggleEnabled(e.target.checked)} />
          </Box>
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={onEdit} sx={{ color: STEEL }}><EditIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" onClick={onDelete} sx={{ color: "#DC2626" }}><DeleteIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>
      {field.placeholder && <Typography fontSize={11} color="text.secondary" mt={0.5}>Placeholder : {field.placeholder}</Typography>}
      {field.helpText && <Typography fontSize={11} color="text.secondary" mt={0.2}>Aide : {field.helpText}</Typography>}
      {field.options.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.75 }}>
          {field.options.map((o) => <Chip key={o} label={o} size="small" sx={{ fontSize: 10, height: 18 }} />)}
        </Box>
      )}
    </Box>
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
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: NAVY }}>Modifier le champ</DialogTitle>
      <DialogContent>
        <Stack gap={2.5} sx={{ pt: 1 }}>
          <TextField label="Libellé *" value={draft.label} onChange={(e) => upd({ label: e.target.value })} size="small" fullWidth autoFocus />
          <TextField label="Placeholder" value={draft.placeholder} onChange={(e) => upd({ placeholder: e.target.value })} size="small" fullWidth />
          <TextField label="Texte d'aide" value={draft.helpText} onChange={(e) => upd({ helpText: e.target.value })} size="small" fullWidth />
          {hasOptions && (
            <Box>
              <Typography fontSize={13} fontWeight={600} color={NAVY} mb={1}>Options</Typography>
              {draft.options.map((o, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                  <Typography fontSize={13} flex={1} sx={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 1, px: 1.5, py: 0.75 }}>{o}</Typography>
                  <IconButton size="small" onClick={() => delOpt(i)} sx={{ color: "#DC2626" }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <TextField size="small" value={newOption} onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addOpt(); }} placeholder="Nouvelle option..." ee sx={{ flex: 1 }} />
                <Button variant="outlined" size="small" onClick={addOpt} sx={{ borderColor: STEEL, color: STEEL }}>Ajouter</Button>
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>Annuler</Button>
        <Button variant="contained" onClick={() => onSave(draft)} disabled={!draft.label.trim()}
          sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── MobilePreviewTab ──────────────────────────────────────────────────────────
function MobilePreviewTab() {
  const cfg   = loadCaptureConfig();
  const types = loadLocationTypes();

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
      <Box>
        <Typography fontSize={13} color="text.secondary" textAlign="center" mb={3}>
          Aperçu du formulaire tel qu&apos;il apparaîtra sur l&apos;application mobile
        </Typography>
        {/* Phone frame */}
        <Box sx={{
          width: 320, mx: "auto",
          border: "12px solid #1E293B", borderRadius: "36px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
          overflow: "hidden", position: "relative",
          "&::before": { content: '""', display: "block", width: 80, height: 6, bgcolor: "#1E293B", borderRadius: 3, mx: "auto", mt: 1, mb: 0 },
        }}>
          {/* Status bar */}
          <Box sx={{ bgcolor: NAVY, px: 2, py: 1, display: "flex", justifyContent: "space-between" }}>
            <Typography fontSize={10} color="rgba(255,255,255,0.8)">9:41</Typography>
            <Typography fontSize={10} color="rgba(255,255,255,0.8)">●●●</Typography>
          </Box>
          {/* App bar */}
          <Box sx={{ bgcolor: NAVY, px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography fontSize={12} color="white">←</Typography>
            </Box>
            <Typography fontSize={14} fontWeight={700} color="white" flex={1}>Capturer localisation</Typography>
          </Box>
          {/* Form body */}
          <Box sx={{ bgcolor: "#F8FAFC", minHeight: 420, px: 2, py: 2 }}>
            {/* GPS indicator */}
            <Box sx={{ bgcolor: "#E0F2FE", borderRadius: 2, p: 1.5, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <GpsFixedIcon sx={{ fontSize: 14, color: "#0284C7" }} />
              <Typography fontSize={11} color="#0284C7" fontWeight={600}>GPS actif · 48.8566, 2.3522</Typography>
            </Box>

            {/* Type de lieu */}
            {cfg.typeField.enabled && (
              <PreviewField label={cfg.typeField.label} required={cfg.typeField.required}>
                <Box sx={{ border: "1px solid #CBD5E1", borderRadius: 1.5, px: 1.5, py: 1, bgcolor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography fontSize={12} color={types.length > 0 ? "#1E293B" : "#94A3B8"}>
                    {types.length > 0 ? `${types[0].icon} ${types[0].name}` : "Sélectionnez..."}
                  </Typography>
                  <Typography fontSize={10} color="#94A3B8">▼</Typography>
                </Box>
              </PreviewField>
            )}

            {/* Nom du lieu */}
            {cfg.labelField.enabled && (
              <PreviewField label={cfg.labelField.label} required={cfg.labelField.required}>
                <Box sx={{ border: "1px solid #CBD5E1", borderRadius: 1.5, px: 1.5, py: 1, bgcolor: "#fff" }}>
                  <Typography fontSize={12} color="#94A3B8">{cfg.labelField.placeholder}</Typography>
                </Box>
              </PreviewField>
            )}

            {/* Photos */}
            {cfg.photoField.enabled && (
              <PreviewField label="Photos" required={cfg.photoField.required}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: "2px dashed #CBD5E1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
                    <PhotoCameraIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                    <Typography fontSize={8} color="#94A3B8">Ajouter</Typography>
                  </Box>
                  <Typography fontSize={10} color="#94A3B8" alignSelf="flex-end">Max {cfg.photoField.maxCount}</Typography>
                </Box>
              </PreviewField>
            )}

            {/* Extra fields */}
            {cfg.extraFields.filter((f) => f.enabled).map((f) => (
              <PreviewField key={f.id} label={f.label} required={f.required}>
                {f.type === "textarea" ? (
                  <Box sx={{ border: "1px solid #CBD5E1", borderRadius: 1.5, px: 1.5, py: 1, bgcolor: "#fff", height: 52 }}>
                    <Typography fontSize={12} color="#94A3B8">{f.placeholder || "Saisir..."}</Typography>
                  </Box>
                ) : f.type === "select" ? (
                  <Box sx={{ border: "1px solid #CBD5E1", borderRadius: 1.5, px: 1.5, py: 1, bgcolor: "#fff", display: "flex", justifyContent: "space-between" }}>
                    <Typography fontSize={12} color="#94A3B8">{f.options[0] ?? "Sélectionner..."}</Typography>
                    <Typography fontSize={10} color="#94A3B8">▼</Typography>
                  </Box>
                ) : f.type === "checkbox" ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {f.options.slice(0, 3).map((o) => (
                      <Box key={o} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 14, height: 14, border: "1.5px solid #CBD5E1", borderRadius: 0.5, bgcolor: "#fff" }} />
                        <Typography fontSize={11} color="#334155">{o}</Typography>
                      </Box>
                    ))}
                  </Box>
                ) : f.type === "photo" ? (
                  <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: "2px dashed #CBD5E1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
                    <PhotoCameraIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                  </Box>
                ) : (
                  <Box sx={{ border: "1px solid #CBD5E1", borderRadius: 1.5, px: 1.5, py: 1, bgcolor: "#fff" }}>
                    <Typography fontSize={12} color="#94A3B8">{f.placeholder || "Saisir..."}</Typography>
                  </Box>
                )}
              </PreviewField>
            ))}

            {/* Submit button */}
            <Box sx={{ bgcolor: NAVY, borderRadius: 2, py: 1.5, textAlign: "center", mt: 2 }}>
              <Typography fontSize={13} fontWeight={700} color="white">Enregistrer la localisation</Typography>
            </Box>
          </Box>
        </Box>
        <Typography fontSize={11} color="text.secondary" textAlign="center" mt={2}>
          Cet aperçu est indicatif — le rendu réel peut légèrement varier.
        </Typography>
      </Box>
    </Box>
  );
}

// ── PreviewField ──────────────────────────────────────────────────────────────
function PreviewField({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography fontSize={11} fontWeight={600} color="#334155" mb={0.5}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </Typography>
      {children}
    </Box>
  );
}
