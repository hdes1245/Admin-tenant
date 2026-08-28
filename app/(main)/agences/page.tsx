"use client";

import { AgencesTable } from "@/components/AgencesTable";
import { Agence, AgenceStats, createAgence, deleteAgence, fetchAgences, fetchAgencesStats, updateAgence } from "@/lib/agences";
import { fetchUsers } from "@/lib/users";
import { fetchZones, Zone } from "@/lib/zones";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Collapse,
  Container, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Grid, IconButton, InputAdornment, MenuItem, Paper, Select,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import CodeIcon from "@mui/icons-material/Code";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { motion } from "framer-motion";
import { useMemo, useState, ChangeEvent, useEffect } from "react";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

export default function AgencesPage() {
  const queryClient = useQueryClient();

  // ── Form state ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agence | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [formError, setFormError] = useState<string | null>(null);

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<Agence | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedAgenceIds, setSelectedAgenceIds] = useState<number[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [filterZone, setFilterZone] = useState<number | "">("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ── Import state ──
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<{ code: string; name: string; zoneCode?: string }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  // ── Queries ──
  const { data: agences = [], isLoading, isError, error } = useQuery({ queryKey: ["agences"], queryFn: fetchAgences });
  const { data: zones = [] } = useQuery<Zone[]>({ queryKey: ["zones"], queryFn: fetchZones });
  const { data: rawStats = [] } = useQuery<AgenceStats[]>({ queryKey: ["agences-stats"], queryFn: fetchAgencesStats });
  const { data: allUsers = [] } = useQuery({ queryKey: ["users", "includeCaf"], queryFn: () => fetchUsers({ includeCaf: true }) });

  const statsMap = useMemo(() => new Map(rawStats.map((s) => [s.agenceId, s])), [rawStats]);

  // ── Filtered list ──
  const filteredAgences = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agences.filter((a) => {
      if (q && !a.code.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q) && !(a.zoneName ?? "").toLowerCase().includes(q)) return false;
      if (filterZone !== "" && a.zoneId !== filterZone) return false;
      return true;
    });
  }, [agences, search, filterZone]);

  useEffect(() => { setPage(1); }, [search, filterZone]);

  // ── KPIs ──
  const agencesWithZone = useMemo(() => agences.filter((a) => a.zoneId != null).length, [agences]);
  const zonesLinked = useMemo(() => new Set(agences.map((a) => a.zoneId).filter(Boolean)).size, [agences]);
  const totalClients = useMemo(() => rawStats.reduce((acc, s) => acc + s.nbClients, 0), [rawStats]);
  // Comptage distinct (un agent CAF peut être rattaché à plusieurs agences)
  const totalCafs    = useMemo(() => allUsers.filter((u) => u.roleCode.toLowerCase() === "caf").length, [allUsers]);

  const activeFilters = [search, filterZone !== "" ? "zone" : ""].filter(Boolean).length;

  // ── Mutations ──
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["agences"] });
    queryClient.invalidateQueries({ queryKey: ["agences-stats"] });
  };

  const createMutation  = useMutation({ mutationFn: createAgence,  onSuccess: invalidate });
  const updateMutation  = useMutation({ mutationFn: updateAgence,  onSuccess: invalidate });
  const deleteMutation  = useMutation({ mutationFn: (id: number) => deleteAgence(id), onSuccess: invalidate });
  const importMutation  = useMutation({
    mutationFn: async (rows: { code: string; name: string; zoneCode?: string }[]) => {
      for (const row of rows) {
        const zone = zones.find((z) => z.code.toLowerCase() === (row.zoneCode ?? "").toLowerCase());
        await createAgence({ code: row.code, name: row.name, zoneId: zone?.id ?? null });
      }
    },
    onSuccess: () => { invalidate(); setImportDialogOpen(false); setParsedImportRows([]); setImportFileName(null); },
  });

  // ── Dialog helpers ──
  const openCreate = () => { setEditing(null); setCode(""); setName(""); setZoneId(""); setFormError(null); setDialogOpen(true); };
  const openEdit   = (a: Agence) => { setEditing(a); setCode(a.code); setName(a.name); setZoneId((a as any).zoneId ?? ""); setFormError(null); setDialogOpen(true); };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) return;
    setFormError(null); setActionError(null);
    try {
      if (editing?.id != null) await updateMutation.mutateAsync({ id: editing.id, code, name, zoneId: zoneId === "" ? null : zoneId });
      else await createMutation.mutateAsync({ code, name, zoneId: zoneId === "" ? null : zoneId });
      setDialogOpen(false);
    } catch (err) { setFormError(err instanceof Error ? err.message : "Action impossible."); }
  };

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try { const rows = parseAgencesCsv(String(reader.result ?? "")); if (!rows.length) { setImportError("Aucune ligne valide."); setParsedImportRows([]); } else { setImportError(null); setParsedImportRows(rows); } }
      catch (err: any) { setImportError(err?.message ?? "Impossible de lire le fichier."); setParsedImportRows([]); }
    };
    reader.readAsText(file, "utf-8");
  };

  const toggleSelect    = (id: number) => setSelectedAgenceIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSelectAll = (checked: boolean, ids: number[]) => setSelectedAgenceIds(checked ? ids : []);

  const KPI_DATA = [
    { label: "Total agences", value: agences.length, accent: NAVY, icon: <BusinessIcon sx={{ fontSize: 20 }} /> },
    { label: "Zones distinctes", value: zonesLinked, accent: STEEL, icon: <AccountTreeIcon sx={{ fontSize: 20 }} /> },
    { label: "Sans zone", value: agences.length - agencesWithZone, accent: "var(--text-muted)", icon: <LinkOffIcon sx={{ fontSize: 20 }} /> },
    { label: "Total clients", value: totalClients, accent: STEEL, icon: <PeopleOutlineIcon sx={{ fontSize: 20 }} /> },
    { label: "Total CAFs", value: totalCafs, accent: "#7c3aed", icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 20 }} /> },
  ];

  return (
    <>
      {/* ── Header ── */}
      <Box sx={{ background: `linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <BusinessIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Agences</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>Gestion des agences, rattachement aux zones et statistiques de portefeuille</Typography>
        </Box>
        <Box display="flex" gap={1.5} flexWrap="wrap">
                <Tooltip title="Exporter les agences visibles en CSV">
                  <Button variant="outlined" startIcon={<DownloadIcon />}
                    onClick={() => downloadCsv(filteredAgences as unknown as Record<string, unknown>[], [{ key: "code", label: "code" }, { key: "name", label: "nom" }, { key: "zoneName", label: "zone" }], "agences.csv")}
                    sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
                    Exporter CSV
                  </Button>
                </Tooltip>
                <Button variant="outlined" startIcon={<UploadFileIcon />}
                  onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}
                  sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
                  Importer CSV
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
                  sx={{ bgcolor: GOLD, color: "var(--text-primary)", fontWeight: 700, "&:hover": { bgcolor: "#2A5C34" }, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                  Ajouter une agence
                </Button>
              </Box>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* ── KPI tiles ── */}
        {!isLoading && agences.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Grid container spacing={2} mb={3}>
              {KPI_DATA.map((kpi, i) => (
                <Grid item xs={6} sm={4} key={i}>
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

        {/* ── Filter bar ── */}
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 4px rgba(15,59,92,0.04)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Rechercher par code, nom ou zone..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)", transition: "background .15s", "&:hover": { bgcolor: "var(--bg-surface)" }, "&.Mui-focused": { bgcolor: "var(--bg-surface)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 } } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            <Select
              size="small" displayEmpty value={filterZone === "" ? "" : String(filterZone)}
              onChange={(e) => { const v = e.target.value; setFilterZone(v === "" ? "" : Number(v)); }}
              sx={{ minWidth: 180, borderRadius: 2, bgcolor: "var(--bg-page)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL } }}
            >
              <MenuItem value="">Toutes les zones</MenuItem>
              <MenuItem value="none">Sans zone</MenuItem>
              {zones.map((z) => <MenuItem key={z.id} value={String(z.id)}>{z.name}</MenuItem>)}
            </Select>
            {activeFilters > 0 && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={() => { setSearch(""); setFilterZone(""); }}
                sx={{ fontWeight: 500, borderRadius: 2, color: "var(--text-secondary)", fontSize: 13, "&:hover": { bgcolor: "#F1F5F9" } }}>
                Effacer ({activeFilters})
              </Button>
            )}
          </Box>
        </Paper>

        {isError && <Alert severity="error" sx={{ mb: 3 }}>Impossible de charger les agences. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}

        {/* ── Bulk selection bar ── */}
        {selectedAgenceIds.length > 0 && (
          <Box sx={{ mb: 2, px: 2.5, py: 1.5, borderRadius: 2, bgcolor: "#FFF7ED", border: "1px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#92400E" }}>
              {selectedAgenceIds.length} agence{selectedAgenceIds.length > 1 ? "s" : ""} selectionnee{selectedAgenceIds.length > 1 ? "s" : ""}
            </Typography>
            <Box display="flex" gap={1}>
              <Button size="small" color="inherit" onClick={() => setSelectedAgenceIds([])} sx={{ fontSize: 12 }}>Deselectionner</Button>
              <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setBulkDeleteOpen(true)}>
                Supprimer ({selectedAgenceIds.length})
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Table ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <AgencesTable
            agences={filteredAgences}
            loading={isLoading}
            onEdit={openEdit}
            onDelete={(a) => setDeleteTarget(a)}
            selectedIds={selectedAgenceIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            stats={statsMap.size > 0 ? statsMap : undefined}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </motion.div>
      </Container>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><BusinessIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>{editing ? "Modifier l'agence" : "Nouvelle agence"}</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <TextField label="Code agence *" fullWidth margin="normal" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: AG001" size="small" />
          <TextField label="Nom de l'agence *" fullWidth margin="normal" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Agence Centre-Ville" size="small" />
          <TextField label="Zone (optionnel)" select fullWidth margin="normal" value={zoneId === "" ? "" : String(zoneId)} onChange={(e) => { const v = e.target.value; setZoneId(v === "" ? "" : Number(v)); }} helperText="Rattacher cette agence a une zone geographique." size="small">
            <MenuItem value="">Aucune zone</MenuItem>
            {zones.map((z) => <MenuItem key={z.id} value={String(z.id)}>{z.name} ({z.code})</MenuItem>)}
          </TextField>
          {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={handleSave} variant="contained" disabled={!code.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending} sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            {editing ? "Enregistrer les modifications" : "Creer l'agence"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Import CSV dialog ── */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><UploadFileIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Importer des agences via CSV</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "divider", p: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}><CodeIcon sx={{ fontSize: 16, color: "text.secondary" }} /><Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Format attendu</Typography></Box>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "var(--bg-surface)", borderRadius: 1, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", mb: 1.5 }}>code,name,zone_code</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 2 }}>
              <b>code</b> — obligatoire (ex: AG001)<br /><b>name</b> — obligatoire (ex: Agence Centre)<br /><b>zone_code</b> — optionnel, rattache automatiquement a la zone correspondante
            </Typography>
          </Box>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2 }}>
            Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={handleCsvFile} />
          </Button>
          {importFileName && <Box mt={2}><Chip label={importFileName} size="small" icon={<UploadFileIcon />} color="warning" variant="outlined" /></Box>}
          {parsedImportRows.length > 0 && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}><b>{parsedImportRows.length} agence{parsedImportRows.length > 1 ? "s" : ""}</b> pretes a etre importees.</Alert>}
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

      {/* ── Bulk delete dialog ── */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Supprimer la selection</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">Vous allez supprimer <Typography component="span" fontWeight={700} color="text.primary">{selectedAgenceIds.length} agence{selectedAgenceIds.length > 1 ? "s" : ""}</Typography>. La suppression sera refusee pour les agences encore liees a des clients, CAFs ou utilisateurs.</Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={deleteMutation.isPending || selectedAgenceIds.length === 0}
            onClick={async () => { setActionError(null); const ids = [...selectedAgenceIds]; const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id))); const failed = results.filter((r) => r.status === "rejected").length; if (failed > 0) setActionError(`${failed} suppression(s) ont echoue (agences encore liees).`); setBulkDeleteOpen(false); setSelectedAgenceIds([]); }}>
            Supprimer la selection
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Single delete dialog ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}><Box display="flex" alignItems="center" gap={1.5}><Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar><Typography variant="h6" fontWeight={700}>Supprimer l&apos;agence</Typography></Box></DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {deleteTarget && statsMap.get(deleteTarget.id) && (statsMap.get(deleteTarget.id)!.nbClients > 0 || statsMap.get(deleteTarget.id)!.nbCafs > 0 || statsMap.get(deleteTarget.id)!.nbUsers > 0) && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>
              Cette agence possede encore {[
                statsMap.get(deleteTarget.id)!.nbClients > 0 ? `${statsMap.get(deleteTarget.id)!.nbClients} client(s)` : "",
                statsMap.get(deleteTarget.id)!.nbCafs > 0 ? `${statsMap.get(deleteTarget.id)!.nbCafs} CAF(s)` : "",
                statsMap.get(deleteTarget.id)!.nbUsers > 0 ? `${statsMap.get(deleteTarget.id)!.nbUsers} utilisateur(s)` : "",
              ].filter(Boolean).join(", ")}. La suppression sera refusee.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">Vous etes sur le point de supprimer l&apos;agence <Typography component="span" fontWeight={700} color="text.primary">{deleteTarget?.name}</Typography> ({deleteTarget?.code}). Cette action est irreversible.</Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={async () => { if (deleteTarget?.id != null) { setActionError(null); try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } catch (err) { setActionError(err instanceof Error ? err.message : "Suppression impossible."); setDeleteTarget(null); } } }} color="error" variant="contained" disabled={deleteMutation.isPending} startIcon={<DeleteOutlineIcon />}>Supprimer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function parseAgencesCsv(text: string): { code: string; name: string; zoneCode?: string }[] {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());
  const idxCode = header.indexOf("code"), idxName = header.indexOf("name"), idxZone = header.indexOf("zone_code");
  if (idxCode === -1 || idxName === -1) throw new Error("Les colonnes 'code' et 'name' sont obligatoires dans l'en-tete.");
  const rows: { code: string; name: string; zoneCode?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const c = cells[idxCode], n = cells[idxName];
    if (!c || !n) continue;
    rows.push({ code: c, name: n, zoneCode: idxZone >= 0 ? cells[idxZone] || undefined : undefined });
  }
  return rows;
}
