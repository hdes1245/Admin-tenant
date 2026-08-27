"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box, Typography, Button, IconButton, Tooltip, Chip, Divider,
  TextField, Switch, FormControlLabel, Select, MenuItem, FormControl,
  InputLabel, Stack, Paper, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, InputAdornment,
} from "@mui/material";
import ArrowBackIcon       from "@mui/icons-material/ArrowBack";
import SaveIcon            from "@mui/icons-material/Save";
import PublishIcon         from "@mui/icons-material/Publish";
import DeleteOutlineIcon   from "@mui/icons-material/DeleteOutline";
import AddIcon             from "@mui/icons-material/Add";
import DragIndicatorIcon   from "@mui/icons-material/DragIndicator";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SettingsIcon        from "@mui/icons-material/Settings";
import WifiOffIcon         from "@mui/icons-material/WifiOff";
import PreviewIcon         from "@mui/icons-material/Preview";
import CloseIcon           from "@mui/icons-material/Close";
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
import { Alert, CircularProgress } from "@mui/material";

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

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const GROUPS = ["Basique", "Choix", "Date & heure", "Terrain"];

function fieldTypeColor(type: FieldType): string {
  if (["gps","photo","signature"].includes(type)) return "#7c3aed";
  if (["select","radio","checkbox"].includes(type)) return "#0891B2";
  if (["date","time"].includes(type)) return "#059669";
  return STEEL;
}

// ─── Field preview chip in palette ──────────────────────────────────────────
function PaletteItem({ ft, onAdd }: { ft: typeof FIELD_TYPES[0]; onAdd: () => void }) {
  return (
    <Box onClick={onAdd} sx={{
      display: "flex", alignItems: "center", gap: 1,
      p: 1, borderRadius: 1.5, cursor: "pointer",
      border: "0.5px solid var(--border)",
      bgcolor: "var(--bg-card)",
      "&:hover": { bgcolor: "rgba(30,96,145,0.05)", borderColor: STEEL },
      transition: "all .15s",
    }}>
      <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: `${fieldTypeColor(ft.type)}15`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${ft.icon}`} style={{ fontSize: 14, color: fieldTypeColor(ft.type) }} aria-hidden />
      </Box>
      <Typography fontSize={12} fontWeight={500} color="var(--text-primary)" noWrap>{ft.label}</Typography>
      <AddIcon sx={{ fontSize: 14, color: STEEL, ml: "auto", opacity: 0.5 }} />
    </Box>
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
    <Box onClick={onSelect} sx={{
      p: 1.5, borderRadius: 2, cursor: "pointer",
      border: selected ? `1.5px solid ${STEEL}` : "1px solid rgba(0,0,0,0.08)",
      bgcolor: selected ? "rgba(30,96,145,0.03)" : "var(--bg-surface)",
      boxShadow: selected ? `0 0 0 3px rgba(30,96,145,0.12)` : "0 1px 4px rgba(0,0,0,0.05)",
      transition: "all .15s",
      display: "flex", alignItems: "center", gap: 1.5,
    }}>
      <DragIndicatorIcon sx={{ fontSize: 18, color: "var(--border-strong)", flexShrink: 0 }} />
      <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: `${fieldTypeColor(field.type)}15`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${ftInfo?.icon ?? "ti-forms"}`} style={{ fontSize: 15, color: fieldTypeColor(field.type) }} aria-hidden />
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography fontSize={13} fontWeight={600} color="var(--text-primary)" noWrap>{field.label}</Typography>
        <Typography fontSize={11} color="text.secondary">{ftInfo?.label}</Typography>
      </Box>
      {field.required && <Chip label="Requis" size="small" sx={{ fontSize: 10, height: 18, bgcolor: "#FEF2F2", color: "#991B1B" }} />}
      <Box display="flex" flexDirection="column" gap={0}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} sx={{ p: 0.2 }}>
          <KeyboardArrowUpIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} sx={{ p: 0.2 }}>
          <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
        sx={{ p: 0.4, color: "var(--text-muted)", "&:hover": { color: "#DC2626", bgcolor: "#FEF2F2" } }}>
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
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
    return <Box display="flex" justifyContent="center" py={2}><CircularProgress size={18} sx={{ color: STEEL }} /></Box>;
  }

  return (
    <Box>
      <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={0.5}>
        Types de lieux (référentiel)
      </Typography>
      <Typography fontSize={11} color="text.secondary" mb={1}>
        Ces options sont partagées avec la carte, les filtres et l&apos;app mobile —
        toute modification s&apos;applique immédiatement partout.
      </Typography>
      <Stack gap={0.8}>
        {types.map((t, idx) => (
          <Box key={t.id} display="flex" gap={0.6} alignItems="center">
            {/* Couleur du marqueur */}
            <Tooltip title="Couleur du marqueur">
              <Box component="label" sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: t.color,
                border: "2px solid var(--border)", cursor: "pointer", flexShrink: 0, position: "relative", overflow: "hidden" }}>
                <input type="color" defaultValue={t.color}
                  onBlur={(e) => { if (e.target.value !== t.color) updateMut.mutate({ id: t.id, dto: { color: e.target.value } }); }}
                  style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
              </Box>
            </Tooltip>
            <TextField size="small" fullWidth defaultValue={t.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== t.name) {
                  updateMut.mutate({ id: t.id, dto: { name: v } });
                  propagateNames(types.map((x) => x.id === t.id ? { ...x, name: v } : x));
                }
              }}
              sx={{ "& input": { fontSize: 12, py: 0.6 } }} />
            <Box display="flex" flexDirection="column">
              <IconButton size="small" disabled={idx === 0} onClick={() => move(idx, -1)} sx={{ p: 0.1 }}>
                <KeyboardArrowUpIcon sx={{ fontSize: 13 }} />
              </IconButton>
              <IconButton size="small" disabled={idx === types.length - 1} onClick={() => move(idx, 1)} sx={{ p: 0.1 }}>
                <KeyboardArrowDownIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
            <IconButton size="small" onClick={() => deleteMut.mutate(t.id)}
              disabled={types.length <= 1 || deleteMut.isPending}
              sx={{ p: 0.4, color: "var(--text-muted)", "&:hover": { color: "#DC2626" } }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
        <Box display="flex" gap={0.8} alignItems="center" mt={0.5}>
          <TextField size="small" fullWidth placeholder="Nouveau type de lieu…" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMut.mutate(newName); }}
            sx={{ "& input": { fontSize: 12, py: 0.6 } }} />
          <Button size="small" startIcon={createMut.isPending ? <CircularProgress size={12} /> : <AddIcon sx={{ fontSize: 14 }} />}
            disabled={!newName.trim() || createMut.isPending}
            onClick={() => createMut.mutate(newName)}
            sx={{ fontSize: 12, color: STEEL, flexShrink: 0 }}>
            Ajouter
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ fontSize: 12, borderRadius: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      </Stack>
    </Box>
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
    <Stack gap={2}>
      <TextField label="Label du champ" size="small" fullWidth value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        sx={{ "& label": { fontSize: 12 }, "& input": { fontSize: 13 } }} />

      {["text","textarea","number","email","phone"].includes(field.type) && (
        <TextField label="Placeholder" size="small" fullWidth value={field.placeholder}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          sx={{ "& label": { fontSize: 12 }, "& input": { fontSize: 13 } }} />
      )}

      <TextField label="Texte d'aide (optionnel)" size="small" fullWidth value={field.helpText}
        onChange={(e) => onChange({ helpText: e.target.value })}
        sx={{ "& label": { fontSize: 12 }, "& input": { fontSize: 13 } }} />

      {field.type === "number" && (
        <Box display="flex" gap={1.5}>
          <TextField label="Min" size="small" type="number" fullWidth
            value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
            sx={{ "& label": { fontSize: 12 } }} />
          <TextField label="Max" size="small" type="number" fullWidth
            value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
            sx={{ "& label": { fontSize: 12 } }} />
        </Box>
      )}

      <FormControlLabel control={
        <Switch checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} size="small"
          sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: STEEL },
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: STEEL } }} />
      } label={<Typography fontSize={13}>Champ obligatoire</Typography>} />

      {locationTypeMode && (
        <LocationTypeOptionsEditor onNamesChanged={(names) => onChange({ options: names })} />
      )}

      {hasOptions && (
        <Box>
          <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={1}>Options</Typography>
          <Stack gap={0.8}>
            {field.options.map((opt, idx) => (
              <Box key={idx} display="flex" gap={0.8} alignItems="center">
                <TextField size="small" fullWidth value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  sx={{ "& input": { fontSize: 12, py: 0.6 } }} />
                <IconButton size="small" onClick={() => removeOption(idx)}
                  disabled={field.options.length <= 1}
                  sx={{ p: 0.4, color: "var(--text-muted)", "&:hover": { color: "#DC2626" } }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={addOption} sx={{ fontSize: 12, color: STEEL, alignSelf: "flex-start" }}>
              Ajouter une option
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

// ─── Preview dialog ──────────────────────────────────────────────────────────
function PreviewDialog({ open, onClose, form }: { open: boolean; onClose: () => void; form: FormTemplate }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box>
          <Typography fontWeight={700} color="var(--text-primary)">{form.name}</Typography>
          <Typography fontSize={12} color="text.secondary">{form.description}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {form.fields.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4} fontSize={14}>
            Aucun champ ajouté
          </Typography>
        ) : (
          <Stack gap={2.5}>
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
                <Box key={f.id}>
                  <Typography fontSize={13} fontWeight={600} color="var(--text-primary)" mb={0.4}>
                    {f.label}{f.required && <span style={{ color: "#DC2626" }}> *</span>}
                  </Typography>
                  {f.helpText && <Typography fontSize={11} color="text.secondary" mb={0.6}>{f.helpText}</Typography>}
                  {showInput && (
                    <TextField size="small" fullWidth placeholder={f.placeholder || `Saisir ${f.label.toLowerCase()}...`}
                      type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                      disabled sx={{ "& input": { fontSize: 13 } }} />
                  )}
                  {showTextarea && (
                    <TextField size="small" fullWidth multiline rows={3} placeholder={f.placeholder || "Saisir..."}
                      disabled sx={{ "& textarea": { fontSize: 13 } }} />
                  )}
                  {showSelect && (
                    <FormControl size="small" fullWidth disabled>
                      <Select value="" displayEmpty sx={{ fontSize: 13 }}>
                        <MenuItem value="" disabled><em>Sélectionner…</em></MenuItem>
                        {f.options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                  {showRadio && (
                    <Stack gap={0.5} mt={0.5}>
                      {f.options.map((o) => (
                        <Box key={o} display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid var(--border-strong)" }} />
                          <Typography fontSize={13} color="text.secondary">{o}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  {showCheck && (
                    <Stack gap={0.5} mt={0.5}>
                      {f.options.map((o) => (
                        <Box key={o} display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: "1.5px solid var(--border-strong)" }} />
                          <Typography fontSize={13} color="text.secondary">{o}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  {showDate && (
                    <TextField size="small" type={f.type} fullWidth disabled sx={{ "& input": { fontSize: 13 } }} />
                  )}
                  {isSpecial && (
                    <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px dashed var(--border-strong)", bgcolor: "var(--bg-page)",
                      display: "flex", alignItems: "center", gap: 1 }}>
                      <i className={`ti ${FIELD_TYPES.find((t) => t.type === f.type)?.icon}`}
                        style={{ fontSize: 18, color: "var(--text-muted)" }} aria-hidden />
                      <Typography fontSize={12} color="text.secondary">{ftLabel} — disponible sur mobile</Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>Fermer</Button>
      </DialogActions>
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
    <>
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography color="text.secondary">Chargement…</Typography>
      </Box>
    </>
  );

  return (
    <>
      {/* Top bar */}
      <Box sx={{ bgcolor: "var(--bg-surface)", borderBottom: "1px solid var(--border)", px: 3, py: 1.5,
        display: "flex", alignItems: "center", gap: 2, position: "sticky", top: 64, zIndex: 100 }}>
        <IconButton size="small" onClick={() => router.push("/forms")} sx={{ border: "1px solid var(--border)", borderRadius: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Box flex={1}>
          <TextField value={form.name} onChange={(e) => updateForm({ name: e.target.value })}
            variant="standard" size="small"
            inputProps={{ style: { fontSize: 16, fontWeight: 700, color: "var(--text-primary)" } }}
            sx={{ "& .MuiInput-underline:before": { borderBottomColor: "transparent" },
              "& .MuiInput-underline:hover:before": { borderBottomColor: "var(--border)" } }} />
          <Box display="flex" alignItems="center" gap={1} mt={0.3}>
            <Chip label={form.status === "published" ? "Publié" : form.status === "draft" ? "Brouillon" : "Archivé"}
              size="small" color={form.status === "published" ? "success" : "warning"} sx={{ height: 18, fontSize: 10 }} />
            <Chip label={CATEGORY_LABELS[form.category]} size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: "rgba(30,96,145,0.08)", color: STEEL }} />
            {form.offlineSync && (
              <Chip icon={<WifiOffIcon sx={{ fontSize: 11 }} />} label="Sync hors-ligne"
                size="small" sx={{ height: 18, fontSize: 10, bgcolor: "rgba(124,58,237,0.08)", color: "#5B21B6",
                  "& .MuiChip-icon": { ml: 0.5 } }} />
            )}
            {dirty && <Chip label="Non enregistré" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Button size="small" variant="outlined" startIcon={<PreviewIcon sx={{ fontSize: 15 }} />}
            onClick={() => setPreview(true)} sx={{ fontSize: 12, borderColor: "var(--border)", color: "text.secondary" }}>
            Aperçu
          </Button>
          <Button size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
            onClick={() => handleSave()} sx={{ fontSize: 12, borderColor: STEEL, color: STEEL }}>
            Enregistrer
          </Button>
          {form.status !== "published" && (
            <Button size="small" variant="contained" startIcon={<PublishIcon sx={{ fontSize: 15 }} />}
              onClick={() => handleSave(true)}
              sx={{ fontSize: 12, bgcolor: "#059669", "&:hover": { bgcolor: "#047857" }, fontWeight: 600 }}>
              Publier
            </Button>
          )}
        </Box>
      </Box>

      {/* Builder body */}
      <Box sx={{ display: "flex", height: "calc(100vh - 128px)", bgcolor: "var(--bg-page)" }}>

        {/* LEFT: Field palette */}
        <Box sx={{ width: 220, borderRight: "1px solid var(--border)", bgcolor: "var(--bg-surface)",
          overflowY: "auto", flexShrink: 0 }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #F1F5F9" }}>
            <Typography fontSize={11} fontWeight={700} color="text.secondary"
              textTransform="uppercase" letterSpacing={0.5}>
              Ajouter un champ
            </Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 1.5 }}>
            {GROUPS.map((group) => (
              <Box key={group} mb={1.5}>
                <Typography fontSize={10} fontWeight={700} color="text.secondary"
                  textTransform="uppercase" letterSpacing={0.4} mb={0.8} px={0.5}>{group}</Typography>
                <Stack gap={0.6}>
                  {FIELD_TYPES.filter((ft) => ft.group === group).map((ft) => (
                    <PaletteItem key={ft.type} ft={ft} onAdd={() => handleAddField(ft.type)} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        {/* CENTER: Canvas */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {/* Form metadata */}
          <Paper sx={{ p: 2.5, borderRadius: 2, mb: 2.5, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5} mb={1.5}>
              Informations du formulaire
            </Typography>
            <Stack gap={2}>
              <TextField label="Description" size="small" fullWidth multiline rows={2}
                value={form.description} onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Décrivez l'objectif de ce formulaire…"
                sx={{ "& label": { fontSize: 12 }, "& textarea": { fontSize: 13 } }} />
              <Box display="flex" gap={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel sx={{ fontSize: 12 }}>Catégorie</InputLabel>
                  <Select label="Catégorie" value={form.category} onChange={(e) => updateForm({ category: e.target.value as FormCategory })} sx={{ fontSize: 13 }}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <MenuItem key={k} value={k} sx={{ fontSize: 13 }}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel control={
                  <Switch checked={form.offlineSync} onChange={(e) => updateForm({ offlineSync: e.target.checked })}
                    size="small" sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#7c3aed" },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#7c3aed" } }} />
                } label={<Typography fontSize={13}>Synchronisation hors-ligne</Typography>} />
              </Box>
            </Stack>
          </Paper>

          {/* Fields canvas */}
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                Champs ({form.fields.length})
              </Typography>
              {selectedFieldId && (
                <Chip label="Cliquer sur un champ pour le sélectionner" size="small"
                  sx={{ fontSize: 10, bgcolor: "rgba(30,96,145,0.06)", color: STEEL }} />
              )}
            </Box>
            {form.fields.length === 0 ? (
              <Box sx={{ border: "2px dashed var(--border)", borderRadius: 2, p: 6, textAlign: "center" }}>
                <Typography color="text.secondary" fontSize={14} mb={1}>
                  Aucun champ ajouté
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  Cliquez sur un type de champ dans le panneau de gauche pour commencer
                </Typography>
              </Box>
            ) : (
              <Stack gap={1}>
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
              </Stack>
            )}
          </Box>
        </Box>

        {/* RIGHT: Field settings */}
        <Box sx={{ width: selectedField ? 280 : 0, borderLeft: "1px solid var(--border)", bgcolor: "var(--bg-surface)",
          overflowY: "auto", flexShrink: 0, transition: "width .2s ease",
          overflow: "hidden" }}>
          {selectedField && (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #F1F5F9",
                display: "flex", alignItems: "center", gap: 1 }}>
                <SettingsIcon sx={{ fontSize: 16, color: STEEL }} />
                <Typography fontSize={11} fontWeight={700} color="text.secondary"
                  textTransform="uppercase" letterSpacing={0.5} flex={1}>
                  Propriétés
                </Typography>
                <IconButton size="small" onClick={() => setSelectedFieldId(null)} sx={{ p: 0.3 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              <Box px={2} py={2}>
                <FieldSettings field={selectedField}
                  // Champ "Type de lieu" du formulaire système : ses options
                  // sont le référentiel des types de lieux (même détection que
                  // syncCaptureConfigFromForm) — gérées en base, pas en statique.
                  locationTypeMode={form.id === SYSTEM_ID &&
                    (selectedField.id === "sys_f2" ||
                      (selectedField.type === "select" && selectedField.label.toLowerCase().includes("type")))}
                  onChange={(patch) => handleUpdateField(selectedField.id, patch)} />
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Preview */}
      <PreviewDialog open={preview} onClose={() => setPreview(false)} form={form} />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack("")}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </>
  );
}
