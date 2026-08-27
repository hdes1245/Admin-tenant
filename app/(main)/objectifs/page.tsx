"use client";

import { useMemo, useState } from "react";
import {
  Alert, Autocomplete, Avatar, Box, Button, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  MenuItem, Paper, Select, Stack, Switch, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import FlagIcon from "@mui/icons-material/Flag";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BlockIcon from "@mui/icons-material/Block";
import GroupsIcon from "@mui/icons-material/Groups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { fetchAgences } from "@/lib/agences";
import { fetchMe } from "@/lib/auth";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

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
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2 }}>
        <FlagIcon sx={{ color: GOLD, fontSize: 30 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700} color="white">Fixation d'Objectifs</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Attribution et suivi des objectifs mensuels des agents terrain
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="outlined"
            startIcon={<GroupsIcon sx={{ fontSize: 18 }} />}
            onClick={() => { setBulkResult(null); setBulkOpen(true); }}
            sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", textTransform: "none", fontWeight: 600, "&:hover": { borderColor: GOLD, bgcolor: "rgba(255,255,255,0.06)" } }}
          >
            Fixation en masse
          </Button>
        )}
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {bulkResult && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setBulkResult(null)}>{bulkResult}</Alert>}
        {me && !canEdit && (
          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
            Vous consultez ce module en lecture seule. La fixation des objectifs est une décision métier réservée à la direction d&apos;exploitation.
          </Alert>
        )}

        {/* ── Sélection CAF + période ── */}
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Autocomplete
              size="small"
              options={cafOptions}
              value={selectedCaf}
              onChange={(_, v) => { setCafCode(v?.caf_code ?? ""); setTargets({}); }}
              getOptionLabel={(o) => `${o.name} — ${o.caf_code}`}
              isOptionEqualToValue={(o, v) => o.caf_code === v.caf_code}
              // Recherche sur nom, code CAF, agence ET zone.
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                if (!q) return opts;
                return opts.filter((o) =>
                  o.name.toLowerCase().includes(q) ||
                  o.caf_code.toLowerCase().includes(q) ||
                  o.agence.toLowerCase().includes(q) ||
                  o.zone.toLowerCase().includes(q),
                );
              }}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.caf_code}>
                  <Box>
                    <Typography fontSize={13} fontWeight={600}>{o.name} <Typography component="span" fontSize={12} color="text.secondary">— {o.caf_code}</Typography></Typography>
                    <Typography fontSize={11} color="text.secondary">
                      {o.agence || "Sans agence"}{o.zone ? ` · ${o.zone}` : ""}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder="Rechercher par nom, code CAF, agence ou zone…" />
              )}
              sx={{ flex: 1, minWidth: 320 }}
            />
            <TextField size="small" type="month" value={period}
              onChange={(e) => { setPeriod(e.target.value); setTargets({}); }} sx={{ width: 180 }} />
            {objsLoading && <CircularProgress size={18} sx={{ color: STEEL }} />}
          </Stack>
        </Paper>

        {/* ── Attribution des objectifs ── */}
        {cafCode ? (
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, overflow: "hidden", mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Assigné", "Objectif", "Unité", "Cible", "Réalisé", "Progression", ""].map((h) => (
                    <TableCell key={h} sx={{ bgcolor: NAVY, color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", borderBottom: "none" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {types.map((t) => {
                  const existing = objectiveByTypeId.get(t.id);
                  const target = targets[t.id] ?? (existing ? String(existing.targetValue) : "");
                  const achieved = existing?.achievedValue ?? 0;
                  const pct = existing && existing.targetValue > 0
                    ? Math.min(100, Math.round((achieved / existing.targetValue) * 100)) : null;
                  const enabled = isTypeEnabled(t.id);
                  return (
                    <TableRow key={t.id} hover sx={{ opacity: enabled ? 1 : 0.5 }}>
                      <TableCell sx={{ width: 70 }}>
                        <Tooltip title={enabled ? "Ce type s'applique à cette personne — désactiver pour le retirer de son application" : "Non applicable à cette personne — activer pour qu'il apparaisse dans son application"}>
                          <Switch
                            size="small"
                            checked={enabled}
                            disabled={!canEdit || assignMut.isPending}
                            onChange={(e) => assignMut.mutate({ objectiveTypeId: t.id, enabled: e.target.checked })}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography fontSize={13} fontWeight={600}>{t.label}</Typography>
                        {t.description && <Typography fontSize={11} color="text.secondary">{t.description}</Typography>}
                      </TableCell>
                      <TableCell><Chip label={t.unit === "fcfa" ? "FCFA" : "Nombre"} size="small" sx={{ fontSize: 10, fontWeight: 700 }} /></TableCell>
                      <TableCell sx={{ width: 170 }}>
                        <TextField size="small" type="number" value={target} placeholder="Non fixé" disabled={!canEdit || !enabled}
                          onChange={(e) => setTargets((p) => ({ ...p, [t.id]: e.target.value }))}
                          inputProps={{ min: 0 }} sx={{ "& input": { fontSize: 13, py: 0.6 } }} />
                        {existing?.setByName && (
                          <Typography fontSize={10} color="text.disabled" mt={0.4} noWrap>
                            Fixé par {existing.setByName}
                            {existing.updatedAt && ` · ${new Date(existing.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Typography fontSize={13} fontWeight={600}>{existing ? fmt(achieved, t.unit) : "—"}</Typography></TableCell>
                      <TableCell>
                        {pct != null
                          ? <Chip label={`${pct} %`} size="small" sx={{ fontWeight: 700, bgcolor: pct >= 100 ? "#dcfce7" : pct >= 50 ? "#FEF3C7" : "#fee2e2", color: pct >= 100 ? "#16a34a" : pct >= 50 ? "#92400E" : "#dc2626" }} />
                          : <Typography fontSize={12} color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell sx={{ width: 110 }}>
                        {canEdit && (
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title={saved === t.id ? "Enregistré !" : "Enregistrer la cible"}>
                              <span>
                                <IconButton size="small" disabled={!enabled || target === "" || saveMut.isPending}
                                  onClick={() => saveMut.mutate({ objectiveTypeId: t.id, targetValue: Number(target) })}
                                  sx={{ color: saved === t.id ? "#16a34a" : STEEL }}>
                                  <SaveIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {existing && (
                              <Tooltip title="Retirer cet objectif">
                                <IconButton size="small" onClick={() => deleteMut.mutate(existing.id)} sx={{ color: "#dc2626" }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: "center", border: "2px dashed var(--border)", borderRadius: 3, bgcolor: "transparent", mb: 3 }}>
            <FlagIcon sx={{ fontSize: 40, color: "var(--border-strong)", mb: 1 }} />
            <Typography fontSize={13} color="text.secondary">Sélectionnez un CAF pour attribuer ou modifier ses objectifs.</Typography>
          </Paper>
        )}

        {/* ── Gestion des types d'objectifs ── */}
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2.5 }}>
          <Typography fontWeight={700} color="var(--text-primary)" mb={0.5}>Types d&apos;objectifs</Typography>
          <Typography fontSize={12} color="text.secondary" mb={2}>
            La liste des types est partagée avec l&apos;application mobile — désactiver un type le retire des
            écrans sans effacer l&apos;historique déjà attribué.
          </Typography>
          <Stack gap={1}>
            {types.map((t) => (
              <Box key={t.id} display="flex" alignItems="center" gap={1.5}
                sx={{ px: 1.5, py: 0.75, borderRadius: 2, bgcolor: "var(--bg-page)", border: "1px solid var(--border)" }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: NAVY }}><FlagIcon sx={{ fontSize: 14, color: GOLD }} /></Avatar>
                <Typography fontSize={13} fontWeight={600} flex={1}>{t.label}</Typography>
                <Chip label={t.unit === "fcfa" ? "FCFA" : "Nombre"} size="small" sx={{ fontSize: 10 }} />
                {canEdit && (
                  <Tooltip title="Désactiver ce type (historique conservé)">
                    <IconButton size="small" onClick={() => deactivateTypeMut.mutate(t.id)} sx={{ color: "#dc2626" }}>
                      <BlockIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
            {canEdit && <Divider sx={{ my: 1 }} />}
            {canEdit && (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="Nouveau type d'objectif…" value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)} sx={{ flex: 1, maxWidth: 320 }} />
              <Select size="small" value={newTypeUnit} onChange={(e) => setNewTypeUnit(e.target.value as any)} sx={{ width: 130 }}>
                <MenuItem value="count">Nombre</MenuItem>
                <MenuItem value="fcfa">FCFA</MenuItem>
              </Select>
              <Button size="small" variant="contained" startIcon={createTypeMut.isPending ? <CircularProgress size={13} sx={{ color: "white" }} /> : <AddIcon />}
                disabled={!newTypeLabel.trim() || createTypeMut.isPending}
                onClick={() => createTypeMut.mutate()}
                sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL }, fontWeight: 600 }}>
                Ajouter
              </Button>
            </Stack>
            )}
          </Stack>
        </Paper>
      </Container>

      {/* ── Fixation en masse ── */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Fixation en masse</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography fontSize={13} color="text.secondary">
              Applique la même cible à un groupe entier en une seule fois, pour la période sélectionnée ({period}).
            </Typography>
            <Select size="small" value={bulkScope} onChange={(e) => { setBulkScope(e.target.value as any); setBulkCafCodes([]); }}>
              <MenuItem value="all_caf">Tous les CAF du tenant</MenuItem>
              <MenuItem value="all_recouvrement">Tous les agents recouvrement</MenuItem>
              <MenuItem value="custom">Sélection personnalisée</MenuItem>
            </Select>
            {bulkScope === "custom" && (
              <Autocomplete
                multiple
                size="small"
                options={cafOptions}
                value={cafOptions.filter((o) => bulkCafCodes.includes(o.caf_code))}
                onChange={(_, v) => setBulkCafCodes(v.map((o) => o.caf_code))}
                getOptionLabel={(o) => `${o.name} — ${o.caf_code}`}
                isOptionEqualToValue={(o, v) => o.caf_code === v.caf_code}
                renderInput={(params) => <TextField {...params} placeholder="Rechercher une ou plusieurs personnes…" />}
              />
            )}
            <Select size="small" value={bulkTypeId} displayEmpty
              onChange={(e) => setBulkTypeId(e.target.value as number)}>
              <MenuItem value="" disabled>Type d&apos;objectif…</MenuItem>
              {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.label} ({t.unit === "fcfa" ? "FCFA" : "Nombre"})</MenuItem>)}
            </Select>
            <TextField size="small" type="number" label="Cible" value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)} inputProps={{ min: 0 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkOpen(false)}>Annuler</Button>
          <Button variant="contained" disabled={!bulkCanSubmit}
            onClick={() => setBulkConfirmOpen(true)}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            Continuer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkConfirmOpen} onClose={() => setBulkConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmer la fixation en masse</DialogTitle>
        <DialogContent>
          <Typography fontSize={14}>
            Fixer <strong>{bulkTypeLabel}</strong> à <strong>{bulkTarget}</strong> pour <strong>{bulkScopeLabel}</strong> sur la période <strong>{period}</strong> ?
          </Typography>
          <Typography fontSize={12.5} color="text.secondary" sx={{ mt: 1.5 }}>
            Écrase la cible existante pour tous les destinataires concernés — le réalisé n&apos;est pas affecté.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkConfirmOpen(false)} disabled={bulkMut.isPending}>Annuler</Button>
          <Button variant="contained" color="error" disabled={bulkMut.isPending}
            startIcon={bulkMut.isPending ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
            onClick={() => bulkMut.mutate()}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
