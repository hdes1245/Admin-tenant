"use client";

import {
  fetchLocationTypes,
  createLocationType,
  updateLocationType,
  deleteLocationType,
} from "@/lib/locationTypes";
import type { LocationTypeItem } from "@/lib/locationTypes";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  Grid,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CodeIcon from "@mui/icons-material/Code";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CategoryIcon from "@mui/icons-material/Category";
import { ChangeEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

type FormState = { code: string; name: string; sort_order: string };
const emptyForm = (): FormState => ({ code: "", name: "", sort_order: "" });

export default function LocationTypesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<LocationTypeItem | null>(null);
  const [form, setForm]                 = useState<FormState>(emptyForm());
  const [formError, setFormError]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationTypeItem | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Import CSV state ──
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<{ code: string; name: string; sort_order?: number }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  const { data: types = [], isLoading, isError } = useQuery({
    queryKey: ["location-types"],
    queryFn: fetchLocationTypes,
  });

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [types, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dto = {
        code: form.code.trim().toLowerCase().replace(/\s+/g, "_"),
        name: form.name.trim(),
        sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      };
      if (editTarget) return updateLocationType(editTarget.id, dto);
      return createLocationType(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-types"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLocationType(deleteTarget!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-types"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: typeof parsedImportRows) => {
      for (const row of rows) await createLocationType(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-types"] });
      setImportDialogOpen(false); setParsedImportRows([]); setImportFileName(null);
    },
  });

  const handleTypesCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseLocationTypesCsv(String(reader.result ?? ""));
        if (!rows.length) { setImportError("Aucune ligne valide."); setParsedImportRows([]); }
        else { setImportError(null); setParsedImportRows(rows); }
      } catch (err: any) { setImportError(err?.message ?? "Impossible de lire le fichier."); setParsedImportRows([]); }
    };
    reader.readAsText(file, "utf-8");
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (t: LocationTypeItem) => {
    setEditTarget(t);
    setForm({ code: t.code, name: t.name, sort_order: String(t.sort_order) });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setFormError("Le nom est obligatoire."); return; }
    if (!form.code.trim()) { setFormError("Le code est obligatoire."); return; }
    setFormError(null);
    saveMutation.mutate();
  };

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <CategoryIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Types de lieux</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Gérez les catégories de localisation disponibles dans l&apos;application mobile
          </Typography>
        </Box>
        <Tooltip title="Exporter les types de lieux en CSV">
          <Button variant="outlined" startIcon={<DownloadIcon />}
            onClick={() => downloadCsv(types, [{ key: "code", label: "code" }, { key: "name", label: "name" }, { key: "sort_order", label: "sort_order" }], "types-de-lieux.csv")}
            sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
            Exporter CSV
          </Button>
        </Tooltip>
        <Button variant="outlined" startIcon={<UploadFileIcon />}
          onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}
          sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
          Importer CSV
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ bgcolor: GOLD, color: "var(--text-primary)", fontWeight: 700, "&:hover": { bgcolor: "#2A5C34" } }}
        >
          Nouveau type
        </Button>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
        )}

        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>Impossible de charger les types de lieux.</Alert>
        )}

        {/* KPIs */}
        {!isLoading && (
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <Box sx={{
                borderRadius: 3, border: "1px solid var(--border)", bgcolor: "var(--bg-surface)",
                px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2,
                position: "relative", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(15,59,92,0.05)",
                "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: NAVY, borderRadius: "3px 0 0 3px" },
                transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(15,59,92,0.1)" },
              }}>
                <Avatar sx={{ width: 44, height: 44, bgcolor: NAVY, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${NAVY}44`, flexShrink: 0 }}>
                  <CategoryIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: "var(--text-primary)", lineHeight: 1, letterSpacing: -0.5 }}>{types.length}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ lineHeight: 1.3 }}>Total types</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Filter bar */}
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 4px rgba(15,59,92,0.04)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Rechercher par nom ou code..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)", transition: "background .15s", "&:hover": { bgcolor: "var(--bg-surface)" }, "&.Mui-focused": { bgcolor: "var(--bg-surface)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: NAVY }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: NAVY, borderWidth: 1.5 } } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            {!isLoading && (
              <Typography variant="caption" color="text.secondary">
                {filteredTypes.length} type{filteredTypes.length !== 1 ? "s" : ""}{search ? ` · ${types.length} au total` : ""}
              </Typography>
            )}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    { label: "#", width: 56 },
                    { label: "Code" },
                    { label: "Nom affiché" },
                    { label: "Ordre", width: 100 },
                    { label: "", width: 88 },
                  ].map((col, i) => (
                    <TableCell
                      key={i}
                      sx={{
                        bgcolor: NAVY, color: "rgba(255,255,255,0.55)", fontWeight: 600,
                        fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1,
                        borderBottom: "none", py: 1.75, width: col.width,
                      }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 8, border: "none" }}>
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
                        <CircularProgress size={18} sx={{ color: STEEL }} />
                        <Typography variant="body2" color="text.secondary">Chargement...</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 8, border: "none" }}>
                      <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                        <CategoryIcon sx={{ fontSize: 40, color: "var(--border-strong)" }} />
                        <Typography variant="body2" color="text.disabled">
                          Aucun type de lieu configuré. Créez-en un pour commencer.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {filteredTypes.map((t, idx) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.025 }}
                    style={{ display: "table-row" }}
                  >
                    <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "var(--bg-surface)", pl: 2.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        #{t.id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "var(--bg-surface)" }}>
                      <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: "#F1F5F9", border: "1px solid var(--border)" }}>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: STEEL }}>
                          {t.code}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "var(--bg-surface)" }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PlaceIcon sx={{ fontSize: 15, color: GOLD }} />
                        <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-primary)" }}>{t.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "var(--bg-surface)" }}>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{t.sort_order}</Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "var(--bg-surface)", pr: 1.5 }}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Tooltip title="Modifier" arrow>
                          <IconButton size="small" onClick={() => openEdit(t)}
                            sx={{ width: 30, height: 30, borderRadius: 1.5, color: "var(--text-muted)", "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer" arrow>
                          <IconButton size="small" onClick={() => { setActionError(null); setDeleteTarget(t); }}
                            sx={{ width: 30, height: 30, borderRadius: 1.5, color: "var(--text-muted)", "&:hover": { color: "#EF4444", bgcolor: "#FFF1F2" } }}>
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Dialog création / édition */}
        <Dialog open={dialogOpen} onClose={() => !saveMutation.isPending && setDialogOpen(false)} fullWidth maxWidth="xs"
          PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
          <Box sx={{ height: 4, bgcolor: GOLD }} />
          <DialogTitle sx={{ pb: 1 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: NAVY }}>
                <CategoryIcon sx={{ color: GOLD, fontSize: 18 }} />
              </Avatar>
              <Typography fontWeight={700}>{editTarget ? "Modifier le type" : "Nouveau type de lieu"}</Typography>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 2.5 }}>
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                label="Nom affiché *"
                fullWidth size="small"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex: Domicile, Commerce, Bureau..."
              />
              <TextField
                label="Code technique *"
                fullWidth size="small"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="ex: domicile, commerce, bureau"
                helperText="Identifiant unique, minuscules, sans espaces (utilisé par l'API)"
                inputProps={{ style: { fontFamily: "monospace" } }}
              />
              <TextField
                label="Ordre d'affichage"
                fullWidth size="small" type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                placeholder="0"
                inputProps={{ min: 0 }}
                helperText="Les types sont triés par ordre croissant"
              />
              {formError && <Alert severity="error">{formError}</Alert>}
            </Box>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit" disabled={saveMutation.isPending}>
              Annuler
            </Button>
            <Button onClick={handleSave} variant="contained" disabled={saveMutation.isPending}
              sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
              {saveMutation.isPending ? "Enregistrement..." : editTarget ? "Modifier" : "Créer"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog: Import CSV */}
        <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
          <Box sx={{ height: 4, bgcolor: GOLD }} />
          <DialogTitle sx={{ pb: 1 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><UploadFileIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar>
              <Typography variant="h6" fontWeight={700}>Importer des types de lieux via CSV</Typography>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "divider", p: 2, mb: 2.5 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}><CodeIcon sx={{ fontSize: 16, color: "text.secondary" }} /><Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Format attendu</Typography></Box>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "var(--bg-surface)", borderRadius: 1, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", mb: 1.5 }}>code,name,sort_order</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 2 }}>
                <b>code</b> — obligatoire (ex: domicile)<br /><b>name</b> — obligatoire (ex: Domicile)<br /><b>sort_order</b> — optionnel, entier (ex: 1)
              </Typography>
            </Box>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2 }}>
              Choisir un fichier CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={handleTypesCsvFile} />
            </Button>
            {importFileName && <Box mt={2}><Chip label={importFileName} size="small" icon={<UploadFileIcon />} color="warning" variant="outlined" /></Box>}
            {parsedImportRows.length > 0 && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}><b>{parsedImportRows.length} type{parsedImportRows.length > 1 ? "s" : ""}</b> prêts à être importés.</Alert>}
            {importError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{importError}</Alert>}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setImportDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
            <Button
              onClick={async () => { if (!parsedImportRows.length) return; setImportError(null); try { await importMutation.mutateAsync(parsedImportRows); } catch (err: any) { setImportError(err?.message ?? "Import impossible."); } }}
              variant="contained" disabled={!parsedImportRows.length || importMutation.isPending}
              startIcon={importMutation.isPending ? <CircularProgress size={16} sx={{ color: "white" }} /> : <UploadFileIcon />}
              sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
              Lancer l&apos;import ({parsedImportRows.length})
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog confirmation suppression */}
        <Dialog open={!!deleteTarget} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
          <Box sx={{ height: 4, bgcolor: "#EF4444" }} />
          <DialogTitle fontWeight={700}>Supprimer ce type de lieu ?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Le type <strong>{deleteTarget?.name}</strong> (code : <code>{deleteTarget?.code}</code>) sera supprimé définitivement.
              Les localisations existantes utilisant ce type ne seront pas affectées.
            </Typography>
            {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setDeleteTarget(null)} variant="outlined" color="inherit" disabled={deleteMutation.isPending}>
              Annuler
            </Button>
            <Button onClick={() => deleteMutation.mutate()} variant="contained" color="error" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </>
  );
}

function parseLocationTypesCsv(text: string): { code: string; name: string; sort_order?: number }[] {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());
  const idxCode = header.indexOf("code"), idxName = header.indexOf("name"), idxOrder = header.indexOf("sort_order");
  if (idxCode === -1 || idxName === -1) throw new Error("Colonnes 'code' et 'name' obligatoires dans l'en-tête.");
  const rows: { code: string; name: string; sort_order?: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const c = cells[idxCode], n = cells[idxName];
    if (!c || !n) continue;
    const sort_order = idxOrder >= 0 && cells[idxOrder] ? Number(cells[idxOrder]) : undefined;
    rows.push({ code: c.toLowerCase().replace(/\s+/g, "_"), name: n, sort_order });
  }
  return rows;
}
