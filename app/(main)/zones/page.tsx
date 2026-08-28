"use client";

import {
  Alert, Avatar, Box, Button, Chip, Checkbox, CircularProgress,
  Collapse, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, InputAdornment, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import { fetchZones, Zone, createZone, updateZone, deleteZone } from "@/lib/zones";
import { fetchAgences } from "@/lib/agences";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CodeIcon from "@mui/icons-material/Code";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import LayersIcon from "@mui/icons-material/Layers";
import { motion } from "framer-motion";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

// ── Onglet Zones ─────────────────────────────────────────────────────────────
function ZonesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<{ code: string; name: string }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  const { data: zones = [], isLoading, isError, error } = useQuery<Zone[]>({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });

  const { data: agences = [] } = useQuery({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });

  const agencesPerZone = useMemo(() => {
    const map = new Map<number, number>();
    agences.forEach((a) => { if (a.zoneId != null) map.set(a.zoneId, (map.get(a.zoneId) ?? 0) + 1); });
    return map;
  }, [agences]);

  const createMutation = useMutation({
    mutationFn: createZone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zones"] }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: { code: string; name: string }[]) => {
      for (const row of rows) await createZone(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      setImportDialogOpen(false); setParsedImportRows([]); setImportFileName(null);
    },
  });

  const handleZonesCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseZonesCsv(String(reader.result ?? ""));
        if (!rows.length) { setImportError("Aucune ligne valide."); setParsedImportRows([]); }
        else { setImportError(null); setParsedImportRows(rows); }
      } catch (err: any) { setImportError(err?.message ?? "Impossible de lire le fichier."); setParsedImportRows([]); }
    };
    reader.readAsText(file, "utf-8");
  };

  const updateMutation = useMutation({
    mutationFn: updateZone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zones"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteZone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zones"] }),
  });

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zones.filter((z) => {
      if (q && !z.code.toLowerCase().includes(q) && !z.name.toLowerCase().includes(q)) return false;
      if (filterStartDate || filterEndDate) {
        if (!z.createdAt) return false;
        const created = new Date(z.createdAt);
        if (filterStartDate && created < new Date(filterStartDate)) return false;
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      }
      return true;
    });
  }, [zones, search, filterStartDate, filterEndDate]);

  const activeDateFilters = [filterStartDate, filterEndDate].filter(Boolean).length;
  const selectedZoneSet = useMemo(() => new Set(selectedZoneIds), [selectedZoneIds]);

  const [zonePage, setZonePage] = useState(1);
  const [zonePageSize, setZonePageSize] = useState(20);
  useEffect(() => { setZonePage(1); }, [search, filterStartDate, filterEndDate, zones]);

  const zoneTotalPages = Math.max(1, Math.ceil(filteredZones.length / zonePageSize));
  const paginatedZones = filteredZones.slice((zonePage - 1) * zonePageSize, zonePage * zonePageSize);

  const allVisibleSelected = paginatedZones.length > 0 && paginatedZones.every((z) => selectedZoneSet.has(z.id));
  const someVisibleSelected = paginatedZones.some((z) => selectedZoneSet.has(z.id));

  const openCreate = () => { setEditing(null); setCode(""); setName(""); setFormError(null); setDialogOpen(true); };
  const openEdit = (zone: Zone) => { setEditing(zone); setCode(zone.code); setName(zone.name); setFormError(null); setDialogOpen(true); };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) return;
    setFormError(null); setActionError(null);
    try {
      if (editing) { await updateMutation.mutateAsync({ id: editing.id, code, name }); }
      else { await createMutation.mutateAsync({ code, name }); }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Action impossible. Verifiez les donnees saisies.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Suppression impossible pour cette zone.");
    }
  };

  const toggleZoneSelection = (zoneId: number) => {
    setSelectedZoneIds((prev) => prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]);
  };

  return (
    <>
      {/* Action bar */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Tooltip title="Exporter les zones en CSV">
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => downloadCsv(filteredZones, [{ key: "code", label: "Code" }, { key: "name", label: "Nom" }], "zones.csv")}
            sx={{ fontWeight: 600 }}>
            Exporter CSV
          </Button>
        </Tooltip>
        <Button variant="outlined" size="small" startIcon={<UploadFileIcon />}
          onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}
          sx={{ fontWeight: 600 }}>
          Importer CSV
        </Button>
        <Box flex={1} />
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}
          sx={{ bgcolor: GOLD, color: "#fff", fontWeight: 700, "&:hover": { bgcolor: "#2A5C34" } }}>
          Ajouter une zone
        </Button>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {!isLoading && zones.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Grid container spacing={2} mb={3}>
              {[
                { label: "Total zones", value: zones.length, accent: NAVY, icon: <LayersIcon sx={{ fontSize: 20 }} /> },
                { label: "Affichées", value: filteredZones.length, accent: STEEL, icon: <MapIcon sx={{ fontSize: 20 }} /> },
                { label: "Zones avec agences", value: zones.filter((z) => (agencesPerZone.get(z.id) ?? 0) > 0).length, accent: "#059669", icon: <LayersIcon sx={{ fontSize: 20 }} /> },
                { label: "Zones sans agence", value: zones.filter((z) => (agencesPerZone.get(z.id) ?? 0) === 0).length, accent: "var(--text-muted)", icon: <MapIcon sx={{ fontSize: 20 }} /> },
              ].map((kpi, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{ borderRadius: 3, border: "1px solid var(--border)", bgcolor: "var(--bg-surface)", px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2, position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(15,59,92,0.05)", "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.accent, borderRadius: "3px 0 0 3px" }, transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(15,59,92,0.1)" } }}>
                    <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.accent, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.accent}44`, flexShrink: 0 }}>{kpi.icon}</Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: kpi.accent, lineHeight: 1, letterSpacing: -0.5 }}>{kpi.value}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>{kpi.label}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        )}

        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Rechercher par code ou nom de zone..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            <Button size="small" startIcon={<FilterListIcon />} onClick={() => setFiltersOpen((v) => !v)}
              variant={filtersOpen ? "contained" : "outlined"}
              sx={filtersOpen ? { bgcolor: NAVY, color: "white", fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: STEEL } } : { fontWeight: 600, borderRadius: 2, borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              Dates{activeDateFilters > 0 && <Chip label={activeDateFilters} size="small" sx={{ ml: 1, height: 18, fontSize: 11, fontWeight: 700, bgcolor: "rgba(255,255,255,0.25)", color: "inherit" }} />}
            </Button>
            {(search || activeDateFilters > 0) && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={() => { setSearch(""); setFilterStartDate(""); setFilterEndDate(""); }}
                sx={{ fontWeight: 500, borderRadius: 2, color: "var(--text-secondary)", fontSize: 13 }}>
                Effacer
              </Button>
            )}
          </Box>
          <Collapse in={filtersOpen}>
            <Box display="flex" gap={1.5} mt={1.5} pt={1.5} sx={{ borderTop: "1px solid var(--border)" }} flexWrap="wrap">
              <TextField label="Du" type="date" size="small" InputLabelProps={{ shrink: true }} value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} sx={{ minWidth: 160 }} />
              <TextField label="Au" type="date" size="small" InputLabelProps={{ shrink: true }} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} sx={{ minWidth: 160 }} />
            </Box>
          </Collapse>
        </Paper>

        {isError && <Alert severity="error" sx={{ mb: 3 }}>Impossible de charger les zones. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}

        {selectedZoneIds.length > 0 && (
          <Box sx={{ mb: 2, px: 2.5, py: 1.5, borderRadius: 2, bgcolor: "#FFF7ED", border: "1px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#92400E" }}>{selectedZoneIds.length} zone{selectedZoneIds.length > 1 ? "s" : ""} sélectionnée{selectedZoneIds.length > 1 ? "s" : ""}</Typography>
            <Box display="flex" gap={1}>
              <Button size="small" color="inherit" onClick={() => setSelectedZoneIds([])} sx={{ fontSize: 12 }}>Désélectionner</Button>
              <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setBulkDeleteOpen(true)}>Supprimer ({selectedZoneIds.length})</Button>
            </Box>
          </Box>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid var(--border)", overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ bgcolor: NAVY, pl: 2, borderBottom: "none", width: 48 }}>
                    <Checkbox size="small" checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={(e) => setSelectedZoneIds(e.target.checked ? paginatedZones.map((z) => z.id) : [])}
                      sx={{ color: "rgba(255,255,255,0.35)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: GOLD }, padding: "4px" }} />
                  </TableCell>
                  <TableCell sx={{ bgcolor: NAVY, borderBottom: "none", width: 52, pl: 2 }} />
                  {["Code zone", "Nom de la zone", "Agences", ""].map((label, i) => (
                    <TableCell key={i} align={i === 3 ? "right" : i === 2 ? "center" : "left"}
                      sx={{ bgcolor: NAVY, color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, borderBottom: "none", py: 1.75, pr: i === 3 ? 2.5 : undefined }}>
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, border: "none" }}><Box display="flex" alignItems="center" justifyContent="center" gap={1.5}><CircularProgress size={18} sx={{ color: STEEL }} /><Typography variant="body2" color="text.secondary">Chargement des zones...</Typography></Box></TableCell></TableRow>
                ) : filteredZones.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, border: "none" }}><Box display="flex" flexDirection="column" alignItems="center" gap={1.5}><Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}><MapIcon sx={{ fontSize: 24, color: "var(--border-strong)" }} /></Box><Typography variant="body2" color="text.disabled">{search || activeDateFilters > 0 ? "Aucune zone ne correspond." : "Aucune zone enregistrée."}</Typography></Box></TableCell></TableRow>
                ) : (
                  paginatedZones.map((z, idx) => {
                    const isSelected = selectedZoneSet.has(z.id);
                    return (
                      <motion.tr key={z.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: idx * 0.02 }} style={{ display: "table-row" }}>
                        <TableCell padding="checkbox" sx={{ pl: 2, bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderLeft: isSelected ? `3px solid ${STEEL}` : "3px solid transparent", borderBottom: "1px solid var(--border)", transition: "all 0.12s" }}>
                          <Checkbox size="small" checked={isSelected} onChange={() => toggleZoneSelection(z.id)} sx={{ "&.Mui-checked": { color: STEEL }, padding: "4px" }} />
                        </TableCell>
                        <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", pl: 2 }}>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: NAVY }}><MapIcon sx={{ fontSize: 17, color: "rgba(255,255,255,0.7)" }} /></Avatar>
                        </TableCell>
                        <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                          <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: STEEL, letterSpacing: 0.3 }}>{z.code}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-primary)" }}>{z.name}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                          {(() => { const cnt = agencesPerZone.get(z.id) ?? 0; return cnt > 0 ? <Chip label={cnt} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${STEEL}15`, color: STEEL }} /> : <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>—</Typography>; })()}
                        </TableCell>
                        <TableCell align="right" sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", pr: 2 }}>
                          <Box display="flex" justifyContent="flex-end" gap={0.5} sx={{ opacity: 0.4, transition: "opacity 0.15s", "tr:hover &": { opacity: 1 } }}>
                            <Tooltip title="Modifier">
                              <IconButton size="small" onClick={() => openEdit(z)} sx={{ color: "var(--text-muted)", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}>
                                <EditOutlinedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton size="small" onClick={() => setDeleteTarget(z)} sx={{ color: "var(--text-muted)", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: "#dc2626", bgcolor: "#FEF2F2" } }}>
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!isLoading && filteredZones.length > 0 && (
            <PaginationBar page={zonePage} totalPages={zoneTotalPages} total={filteredZones.length} pageSize={zonePageSize} onPageChange={setZonePage} onPageSizeChange={(s) => { setZonePageSize(s); setZonePage(1); }} />
          )}
        </motion.div>
      </Container>

      {/* Zone dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}>{editing ? <MapIcon sx={{ color: GOLD, fontSize: 20 }} /> : <AddLocationAltIcon sx={{ color: GOLD, fontSize: 20 }} />}</Avatar>
            <Typography variant="h6" fontWeight={700}>{editing ? "Modifier la zone" : "Nouvelle zone"}</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={5}><TextField label="Code zone *" fullWidth size="small" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: ZN-CENTRE" helperText="Identifiant unique de la zone" /></Grid>
            <Grid item xs={12} sm={7}><TextField label="Nom de la zone *" fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Zone Centre-Ville" /></Grid>
            {formError && <Grid item xs={12}><Alert severity="error">{formError}</Alert></Grid>}
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={handleSave} variant="contained" disabled={!code.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending} sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            {editing ? "Enregistrer" : "Créer la zone"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk delete */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Supprimer la sélection</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">Vous allez supprimer <Typography component="span" fontWeight={700} color="text.primary">{selectedZoneIds.length} zone{selectedZoneIds.length > 1 ? "s" : ""}</Typography>. La suppression sera refusée pour les zones encore liées.</Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={async () => { setActionError(null); const ids = [...selectedZoneIds]; const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id))); const failed = results.filter((r) => r.status === "rejected").length; if (failed > 0) setActionError(`${failed} suppression(s) ont échoué.`); setBulkDeleteOpen(false); setSelectedZoneIds([]); }} color="error" variant="contained" disabled={deleteMutation.isPending || selectedZoneIds.length === 0} startIcon={<DeleteOutlineIcon />}>
            Supprimer la sélection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete single */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Supprimer la zone</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">Vous êtes sur le point de supprimer la zone <Typography component="span" fontWeight={700} color="text.primary">{deleteTarget?.name}</Typography> ({deleteTarget?.code}). La suppression sera refusée si des agences sont encore rattachées.</Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleteMutation.isPending} startIcon={<DeleteOutlineIcon />}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Import CSV */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><UploadFileIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Importer des zones via CSV</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "divider", p: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}><CodeIcon sx={{ fontSize: 16, color: "text.secondary" }} /><Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Format attendu</Typography></Box>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "var(--bg-surface)", borderRadius: 1, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", mb: 1.5 }}>code,name</Typography>
          </Box>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2 }}>Choisir un fichier CSV<input type="file" accept=".csv,text/csv" hidden onChange={handleZonesCsvFile} /></Button>
          {importFileName && <Box mt={2}><Chip label={importFileName} size="small" icon={<UploadFileIcon />} color="warning" variant="outlined" /></Box>}
          {parsedImportRows.length > 0 && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}><b>{parsedImportRows.length} zone{parsedImportRows.length > 1 ? "s" : ""}</b> prêtes à être importées.</Alert>}
          {importError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{importError}</Alert>}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setImportDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={async () => { if (!parsedImportRows.length) return; setImportError(null); try { await importMutation.mutateAsync(parsedImportRows); } catch (err: any) { setImportError(err?.message ?? "Import impossible."); } }}
            variant="contained" disabled={!parsedImportRows.length || importMutation.isPending}
            startIcon={importMutation.isPending ? <CircularProgress size={16} sx={{ color: "white" }} /> : <UploadFileIcon />}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            Lancer l&apos;import ({parsedImportRows.length})
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
// NB : les types de lieux ne se gèrent plus ici — ils s'éditent directement
// dans GeoStudio > Formulaires terrain > "Localiser client" > champ "Type de
// lieu" (panneau Propriétés), qui pilote le même référentiel /location-types.
export default function ReferentielsPage() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ background: `linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white" }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <MapIcon sx={{ color: GOLD, fontSize: 30 }} />
          <Box>
            <Typography variant="h5" fontWeight={700} color="white">Référentiels</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>Zones géographiques</Typography>
          </Box>
        </Box>
      </Box>

      <ZonesTab />
    </Box>
  );
}

function parseZonesCsv(text: string): { code: string; name: string }[] {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());
  const idxCode = header.indexOf("code"), idxName = header.indexOf("name");
  if (idxCode === -1 || idxName === -1) throw new Error("Colonnes 'code' et 'name' obligatoires dans l'en-tête.");
  const rows: { code: string; name: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const c = cells[idxCode], n = cells[idxName];
    if (!c || !n) continue;
    rows.push({ code: c, name: n });
  }
  return rows;
}

