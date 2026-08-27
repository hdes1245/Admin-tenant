"use client";

import { ClientsTable } from "@/components/ClientsTable";
import {
  ClientDto,
  createClient,
  deleteClient,
  fetchClients,
  updateClient,
  fetchAvailableCafs,
  fetchAvailableCafsRaw,
  fetchClientGlobalStats,
  AvailableCaf,
  CreateClientInput,
} from "@/lib/clients";
import { downloadCsv } from "@/lib/csvExport";
import { fetchMe } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import BadgeIcon from "@mui/icons-material/Badge";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PhoneEnabledIcon from "@mui/icons-material/PhoneEnabled";
import FilterListIcon from "@mui/icons-material/FilterList";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CodeIcon from "@mui/icons-material/Code";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { motion } from "framer-motion";
import { useState, ChangeEvent, useMemo, useEffect } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { fetchAgences, Agence } from "@/lib/agences";

function useDebounce<T>(value: T, delay = 350): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

const CLIENTS_NAVY = "#0F3B5C";
const CLIENTS_STEEL = "#1E6091";
const CLIENTS_GOLD = "#3C8047";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDto | null>(null);
  const [codeClient, setCodeClient] = useState("");
  const [name, setName] = useState("");
  const [agenceClient, setAgenceClient] = useState("");
  const [cafCode, setCafCode] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ClientDto | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<CreateClientInput[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterAgence, setFilterAgence] = useState("");
  const [filterCaf, setFilterCaf] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);

  // Liste groupée par personne (pour le filtre de recherche : cherche sur tous les codes d'un agent)
  const { data: availableCafs = [] } = useQuery<AvailableCaf[]>({
    queryKey: ["clients-available-cafs"],
    queryFn: fetchAvailableCafs,
  });

  // Liste brute, un code par ligne (pour l'assignation d'un client à UN CAF précis)
  const { data: availableCafsRaw = [] } = useQuery<AvailableCaf[]>({
    queryKey: ["clients-available-cafs-raw"],
    queryFn: fetchAvailableCafsRaw,
  });

  const { data: allAgences = [] } = useQuery<Agence[]>({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });

  // Création/modification/suppression des clients réservées aux admins
  // (admin tenant + admin GeoTrust). Les superviseurs sont en lecture seule.
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const canManageClients = ["admin_tenant", "admin"].includes(normalizeRole(me?.role));

  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(20);

  // Recherche combinée envoyée au serveur (nom OU code — le backend cherche dans les deux + contact + agence)
  const combinedSearch = filterCode.trim() || filterName.trim();
  const debouncedSearch = useDebounce(combinedSearch, 350);
  const debouncedAgence = useDebounce(filterAgence, 350);
  const debouncedCaf    = useDebounce(filterCaf, 350);

  // Reset à la page 1 quand un filtre serveur change
  useEffect(() => { setClientPage(1); }, [debouncedSearch, debouncedAgence, debouncedCaf]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["clients", clientPage, clientPageSize, debouncedSearch, debouncedAgence, debouncedCaf],
    queryFn: () => fetchClients({
      page: clientPage,
      limit: clientPageSize,
      search: debouncedSearch || undefined,
      agence: debouncedAgence || undefined,
      caf: debouncedCaf || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  // Clients de la page serveur courante (les filtres date/doublons ci-dessous
  // ne s'appliquent qu'à cette page, faute de support serveur pour ces critères)
  const clients = data?.items ?? [];
  const serverTotal = data?.total ?? 0;

  // clients.agence_client stocke le LIBELLÉ complet de l'agence (résolu au
  // sync), pas son code — la valeur envoyée au serveur doit donc être le nom,
  // sinon le filtre ne matche jamais rien côté backend.
  const agenceFilterOptions = useMemo(
    () =>
      allAgences
        .filter((a) => a.name?.trim())
        .map((a) => ({ value: a.name.trim(), label: `${a.name.trim()} (${a.code.trim()})` }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" })),
    [allAgences],
  );
  const selectedAgenceFilterOption = useMemo(
    () => agenceFilterOptions.find((o) => o.value === filterAgence) ?? null,
    [agenceFilterOptions, filterAgence],
  );

  // Le filtre CAF est groupé par personne : la valeur est la liste de codes
  // (ex: "007A01,007A03,007A08") que le backend éclate pour chercher sur tous.
  // Le libellé n'affiche que le nom + le nombre d'agences couvertes (lisible).
  const cafFilterOptions = useMemo(
    () =>
      availableCafs
        .filter((c) => c.code?.trim() && c.name?.trim())
        .map((c) => {
          const nbCodes = c.code.split(",").filter((v) => v.trim()).length;
          const agencesLabel = c.agence?.trim() ? c.agence.trim() : "";
          return {
            value: c.code.trim(),
            label:
              nbCodes > 1
                ? `${c.name.trim()} — ${nbCodes} agences${agencesLabel ? ` (${agencesLabel})` : ""}`
                : `${c.name.trim()}${agencesLabel ? ` (${agencesLabel})` : ""}`,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" })),
    [availableCafs],
  );
  const selectedCafFilterOption = useMemo(
    () => cafFilterOptions.find((o) => o.value === filterCaf) ?? null,
    [cafFilterOptions, filterCaf],
  );

  // Doublons de code_client : ne peuvent plus exister (contrainte unique en base),
  // ce contrôle ne porte donc que sur la page affichée, à titre de garde-fou.
  const duplicateCodeSet = useMemo(() => {
    const codeCount = new Map<string, number>();
    clients.forEach((c) => codeCount.set(c.codeClient, (codeCount.get(c.codeClient) ?? 0) + 1));
    return new Set(Array.from(codeCount.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [clients]);

  const duplicateCount = useMemo(() => clients.filter((c) => duplicateCodeSet.has(c.codeClient)).length, [clients, duplicateCodeSet]);

  // Filtres non supportés côté serveur (dates, doublons) — appliqués sur la page courante uniquement
  const hasClientSideOnlyFilters = !!(filterStartDate || filterEndDate || filterDuplicatesOnly);
  const filteredClients = useMemo(() => clients.filter((c) => {
    if (filterDuplicatesOnly && !duplicateCodeSet.has(c.codeClient)) return false;
    if (filterStartDate || filterEndDate) {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      if (filterStartDate && created < new Date(filterStartDate)) return false;
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
    }
    return true;
  }), [clients, filterDuplicatesOnly, duplicateCodeSet, filterStartDate, filterEndDate]);

  const clientTotalPages = Math.max(1, Math.ceil(serverTotal / clientPageSize));
  const paginatedClients = filteredClients;

  const selectedCount = selectedClientIds.length;

  const activeFilters = [filterName, filterCode, filterAgence, filterCaf, filterStartDate, filterEndDate, filterDuplicatesOnly ? "dup" : ""].filter(Boolean).length;

  const globalStatsQuery = useQuery({
    queryKey: ["clients-global-stats"],
    queryFn: fetchClientGlobalStats,
  });
  const globalStats = globalStatsQuery.data;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["clients-global-stats"] });
  };

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: updateClient,
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: invalidateAll,
  });

  const importMutation = useMutation({
    mutationFn: async (rows: CreateClientInput[]) => {
      for (const row of rows) await createClient(row);
    },
    onSuccess: () => {
      invalidateAll();
      setImportDialogOpen(false);
      setParsedRows([]);
      setSelectedFileName(null);
    },
  });

  const handleCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseClientsCsv(String(reader.result ?? ""));
        if (!rows.length) { setImportError("Aucune ligne valide trouvée dans le fichier."); setParsedRows([]); }
        else { setImportError(null); setParsedRows(rows); }
      } catch (err: any) {
        setImportError(err?.message ?? "Impossible de lire le fichier CSV.");
        setParsedRows([]);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const openCreateDialog = () => {
    setEditing(null); setCodeClient(""); setName(""); setAgenceClient(""); setCafCode(""); setContactInfo("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client: ClientDto) => {
    setEditing(client); setCodeClient(client.codeClient); setName(client.name);
    setAgenceClient(client.agenceClient ?? ""); setCafCode(client.cafCode ?? ""); setContactInfo(client.contactInfo ?? "");
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!codeClient.trim() || !name.trim()) return;
    setFormError(null);
    setActionError(null);
    try {
      if (editing?.id != null) {
        await updateMutation.mutateAsync({ id: editing.id, codeClient, name, agenceClient, cafCode, contactInfo });
      } else {
        await createMutation.mutateAsync({ codeClient, name, agenceClient, cafCode, contactInfo });
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Action impossible. Vérifiez les données saisies.",
      );
    }
  };

  const clearFilters = () => {
    setFilterName(""); setFilterCode(""); setFilterAgence(""); setFilterCaf(""); setFilterStartDate(""); setFilterEndDate(""); setFilterDuplicatesOnly(false);
  };

  const toggleClientSelection = (clientId: number) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedClientIds([]);
      return;
    }
    setSelectedClientIds(filteredClients.map((c) => c.id));
  };

  const clearSelection = () => setSelectedClientIds([]);

  const [exporting, setExporting] = useState(false);
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      // Récupère jusqu'à 1000 clients correspondant aux filtres serveur actuels
      // (recherche/agence/CAF) — l'export n'est pas limité à la page affichée.
      const exportData = await fetchClients({
        page: 1,
        limit: 1000,
        search: debouncedSearch || undefined,
        agence: debouncedAgence || undefined,
        caf: debouncedCaf || undefined,
      });
      let rows = exportData.items;
      if (filterStartDate || filterEndDate) {
        rows = rows.filter((c) => {
          if (!c.createdAt) return false;
          const created = new Date(c.createdAt);
          if (filterStartDate && created < new Date(filterStartDate)) return false;
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            if (created > end) return false;
          }
          return true;
        });
      }
      downloadCsv(
        rows,
        [
          { key: "codeClient", label: "code_client", format: (_v, row) => row.codeClient },
          { key: "name", label: "name", format: (_v, row) => row.name },
          { key: "agenceClient", label: "agence_client", format: (_v, row) => row.agenceClient ?? "" },
          { key: "cafCode", label: "caf_code", format: (_v, row) => row.cafCode ?? "" },
          { key: "contactInfo", label: "contact_info", format: (_v, row) => row.contactInfo ?? "" },
        ],
        "clients.csv",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Box sx={{ background: "linear-gradient(135deg, #0F3B5C 0%, #1E6091 100%)", borderBottom: "3px solid #3C8047", px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <PersonPinCircleIcon sx={{ color: "#3C8047", fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Clients</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Portefeuille clients du tenant — gestion, attribution CAF et import CSV
          </Typography>
        </Box>
        <Box display="flex" gap={1.5} flexWrap="wrap">
                <Tooltip title="Exporter les clients filtrés en CSV (jusqu'à 1000 lignes)">
                  <Button
                    variant="outlined" startIcon={<DownloadIcon />}
                    onClick={handleExportCsv}
                    disabled={exporting}
                    sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    {exporting ? "Export…" : "Exporter CSV"}
                  </Button>
                </Tooltip>
                {canManageClients && (
                  <Button
                    variant="outlined" startIcon={<UploadFileIcon />}
                    onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedRows([]); setSelectedFileName(null); }}
                    sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    Importer CSV
                  </Button>
                )}
                {canManageClients && (
                  <Button
                    variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}
                    sx={{ bgcolor: "#3C8047", color: "#0F3B5C", fontWeight: 700, "&:hover": { bgcolor: "#b8891f" }, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}
                  >
                    Ajouter un client
                  </Button>
                )}
              </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        {(globalStats || !globalStatsQuery.isLoading) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Grid container spacing={2} mb={3}>
              {[
                { label: "Total clients", value: globalStats?.total ?? 0, accent: "#0F3B5C", icon: <GroupsIcon sx={{ fontSize: 22 }} /> },
                { label: "Avec CAF attribue", value: globalStats?.withCaf ?? 0, accent: "#1E6091", icon: <BadgeIcon sx={{ fontSize: 22 }} /> },
                { label: "Sans CAF", value: globalStats?.withoutCaf ?? 0, accent: "var(--text-muted)", icon: <PersonOffIcon sx={{ fontSize: 22 }} /> },
                { label: "Avec contact", value: globalStats?.withContact ?? 0, accent: "#3C8047", icon: <PhoneEnabledIcon sx={{ fontSize: 22 }} /> },
              ].map((kpi, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{
                    borderRadius: 3, border: "1px solid var(--border)", bgcolor: "var(--bg-surface)",
                    px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2,
                    position: "relative", overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(15,59,92,0.05)",
                    "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.accent, borderRadius: "3px 0 0 3px" },
                    transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(15,59,92,0.1)" },
                  }}>
                    <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.accent, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.accent}44`, flexShrink: 0 }}>{kpi.icon}</Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: kpi.accent, lineHeight: 1, letterSpacing: -0.5 }}>{kpi.value}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ lineHeight: 1.3 }}>{kpi.label}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        )}

        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 4px rgba(15,59,92,0.04)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Rechercher par nom ou code client..."
              value={filterName} onChange={(e) => setFilterName(e.target.value)}
              sx={{ flex: 1, minWidth: 240, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)", transition: "background .15s", "&:hover": { bgcolor: "var(--bg-surface)" }, "&.Mui-focused": { bgcolor: "var(--bg-surface)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#1E6091" }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1E6091", borderWidth: 1.5 } } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: filterName ? <InputAdornment position="end"><IconButton size="small" onClick={() => setFilterName("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            <Button
              size="small" startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen((v) => !v)}
              variant={filtersOpen ? "contained" : "outlined"}
              sx={filtersOpen
                ? { bgcolor: "#0F3B5C", color: "white", fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: "#1E6091" } }
                : { fontWeight: 600, borderRadius: 2, borderColor: "var(--border)", color: "var(--text-secondary)", "&:hover": { borderColor: "#1E6091", bgcolor: "#F1F5F9" } }}
            >
              Filtres avancés{activeFilters > 0 && <Chip label={activeFilters} size="small" sx={{ ml: 1, height: 18, fontSize: 11, fontWeight: 700, bgcolor: "rgba(255,255,255,0.25)", color: "inherit" }} />}
            </Button>
            {activeFilters > 0 && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={clearFilters}
                sx={{ fontWeight: 500, borderRadius: 2, color: "var(--text-secondary)", fontSize: 13, "&:hover": { bgcolor: "#F1F5F9" } }}>
                Effacer ({activeFilters})
              </Button>
            )}
          </Box>
          <Collapse in={filtersOpen}>
            <Box sx={{ borderTop: "1px solid #F1F5F9", mt: 1.5, pt: 1.5 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label="Code client" size="small" fullWidth value={filterCode} onChange={(e) => setFilterCode(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete size="small" options={agenceFilterOptions} value={selectedAgenceFilterOption} onChange={(_, v) => setFilterAgence(v?.value ?? "")}
                    getOptionLabel={(o) => o.label} isOptionEqualToValue={(o, v) => o.value === v.value} clearOnEscape
                    renderInput={(params) => <TextField {...params} label="Agence" size="small" fullWidth placeholder="Toutes les agences" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }} />} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete size="small" options={cafFilterOptions} value={selectedCafFilterOption} onChange={(_, v) => setFilterCaf(v?.value ?? "")}
                    getOptionLabel={(o) => o.label} isOptionEqualToValue={(o, v) => o.value === v.value} clearOnEscape
                    renderInput={(params) => <TextField {...params} label="CAF" size="small" fullWidth placeholder="Tous les CAFs" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }} />} />
                </Grid>
                <Grid item xs={6} sm={3} md={1.5}>
                  <TextField label="Du" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }} />
                </Grid>
                <Grid item xs={6} sm={3} md={1.5}>
                  <TextField label="Au" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }} />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
          {!isLoading && (
            <Box display="flex" gap={1} mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {serverTotal.toLocaleString("fr-FR")} client{serverTotal !== 1 ? "s" : ""} au total
                {hasClientSideOnlyFilters ? ` · ${filteredClients.length} affiché(s) sur cette page` : ""}
                {isFetching ? " · actualisation…" : ""}
              </Typography>
            </Box>
          )}
        </Paper>

        
        {duplicateCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} action={
            <Button size="small" color="inherit" onClick={() => setFilterDuplicatesOnly((v) => !v)} sx={{ fontWeight: 700, fontSize: 11 }}>
              {filterDuplicatesOnly ? "Tout afficher" : "Voir les doublons"}
            </Button>
          }>
            <b>{duplicateCount} client{duplicateCount > 1 ? "s" : ""}</b> avec un code duplique detecte{duplicateCount > 1 ? "s" : ""} — verifiez et fusionnez les doublons.
          </Alert>
        )}

        {isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Impossible de charger les clients.{" "}
            {error instanceof Error ? error.message : null}
          </Alert>
        )}
        {actionError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {actionError}
          </Alert>
        )}

        
        {canManageClients && selectedCount > 0 && (
          <Box sx={{ mb: 2, px: 2.5, py: 1.5, borderRadius: 2, bgcolor: "#FFF7ED", border: "1px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#92400E" }}>
              {selectedCount} client{selectedCount > 1 ? "s" : ""} selectionne{selectedCount > 1 ? "s" : ""}
            </Typography>
            <Box display="flex" gap={1}>
              <Button size="small" color="inherit" onClick={clearSelection} sx={{ fontSize: 12 }}>Deselectionner</Button>
              <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setBulkDeleteOpen(true)}>
                Supprimer ({selectedCount})
              </Button>
            </Box>
          </Box>
        )}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <ClientsTable
            clients={paginatedClients}
            loading={isLoading}
            canManage={canManageClients}
            onEdit={openEditDialog}
            onDelete={(c) => setDeleteTarget(c)}
            selectedIds={selectedClientIds}
            onToggleSelect={toggleClientSelection}
            onToggleSelectAll={toggleSelectAllFiltered}
          />
          <PaginationBar
            page={clientPage}
            totalPages={clientTotalPages}
            total={serverTotal}
            pageSize={clientPageSize}
            onPageChange={setClientPage}
            onPageSizeChange={(s) => { setClientPageSize(s); setClientPage(1); }}
          />
        </motion.div>
      </Container>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: "#3C8047" }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#0F3B5C" }}>
              {editing ? <PersonPinCircleIcon sx={{ color: "#3C8047", fontSize: 20 }} /> : <PersonAddIcon sx={{ color: "#3C8047", fontSize: 20 }} />}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              {editing ? "Modifier le client" : "Nouveau client"}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={5}>
              <TextField
                label="Code client *" fullWidth size="small"
                value={codeClient} onChange={(e) => setCodeClient(e.target.value)}
                disabled={!!editing}
                placeholder="ex: APL-CLT-0100"
                helperText={editing ? "Non modifiable après création" : "Identifiant unique du client"}
              />
            </Grid>
            <Grid item xs={12} sm={7}>
              <TextField
                label="Nom du client *" fullWidth size="small"
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ex: Jean Dupont"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select label="CAF attribué" fullWidth size="small"
                value={cafCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setCafCode(val);
                  const selected = availableCafsRaw.find((c) => c.code === val);
                  if (selected?.agence) setAgenceClient(selected.agence);
                  else setAgenceClient("");
                }}
                helperText="Sélectionnez le CAF responsable de ce client."
              >
                <MenuItem value="">Aucun CAF</MenuItem>
                {availableCafsRaw.map((c) => (
                  <MenuItem key={c.code} value={c.code}>{c.name} ({c.code})</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Agence" fullWidth size="small"
                value={agenceClient} disabled
                helperText="Déduite automatiquement à partir du CAF sélectionné."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Contact (téléphone / email)" fullWidth size="small"
                value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                placeholder="ex: +237 6 00 00 00 00 ou client@example.com"
                multiline minRows={2}
              />
            </Grid>
            {formError && (
              <Grid item xs={12}>
                <Alert severity="error">{formError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button
            onClick={handleSave} variant="contained"
            disabled={!codeClient.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending}
            sx={{ bgcolor: "#0F3B5C", "&:hover": { bgcolor: "#1E6091" } }}
          >
            {editing ? "Enregistrer les modifications" : "Créer le client"}
          </Button>
        </DialogActions>
      </Dialog>

      
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: "#3C8047" }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#0F3B5C" }}>
              <UploadFileIcon sx={{ color: "#3C8047", fontSize: 20 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>Importer des clients via CSV</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "divider", p: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <CodeIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Format attendu (ligne d&apos;en-têtes)
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "var(--bg-surface)", borderRadius: 1, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", mb: 1.5 }}>
              code_client,name,agence_client,caf_code,contact_info
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 2 }}>
              ... <strong>code_client</strong> — obligatoire (ex&nbsp;: <code>APL-CLT-0100</code>)<br />
              ... <strong>name</strong> — obligatoire (ex&nbsp;: <code>Jean Dupont</code>)<br />
              ... <strong>agence_client</strong> — optionnel<br />
              ... <strong>caf_code</strong> — optionnel (ex&nbsp;: <code>001-CAF-TEST</code>)<br />
              ... <strong>contact_info</strong> — optionnel (téléphone ou email)
            </Typography>
          </Box>

          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2 }}>
            Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={handleCsvFileChange} />
          </Button>

          {selectedFileName && (
            <Box mt={2} display="flex" alignItems="center" gap={1}>
              <Chip label={selectedFileName} size="small" icon={<UploadFileIcon />} color="warning" variant="outlined" />
            </Box>
          )}
          {parsedRows.length > 0 && (
            <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
              <strong>{parsedRows.length} client{parsedRows.length > 1 ? "s" : ""}</strong> prêt{parsedRows.length > 1 ? "s" : ""} à être importé{parsedRows.length > 1 ? "s" : ""}.
            </Alert>
          )}
          {importError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{importError}</Alert>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setImportDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button
            onClick={async () => {
              if (!parsedRows.length) return;
              setImportError(null);
              setActionError(null);
              try {
                await importMutation.mutateAsync(parsedRows);
              } catch (err) {
                setImportError(
                  err instanceof Error
                    ? err.message
                    : "Import impossible. Vérifiez les lignes du fichier CSV.",
                );
              }
            }}
            variant="contained"
            disabled={!parsedRows.length || importMutation.isPending}
            startIcon={<UploadFileIcon />}
            sx={{ bgcolor: "#0F3B5C", "&:hover": { bgcolor: "#1E6091" } }}
          >
            Lancer l&apos;import ({parsedRows.length})
          </Button>
        </DialogActions>
      </Dialog>

      
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}>
              <WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>Supprimer le client</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Vous êtes sur le point de supprimer le client{" "}
            <Typography component="span" fontWeight={700} color="text.primary">{deleteTarget?.name}</Typography>{" "}
            <Typography component="span" color="text.secondary">({deleteTarget?.codeClient})</Typography>.
            Cette action est irréversible. Toutes les localisations de ce client
            seront également supprimées.
          </Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" color="inherit">Annuler</Button>
          <Button
            onClick={async () => {
              if (deleteTarget?.id != null) {
                setActionError(null);
                try {
                  await deleteMutation.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch (err) {
                  setActionError(
                    err instanceof Error
                      ? err.message
                      : "Suppression impossible pour ce client.",
                  );
                }
              }
            }}
            color="error" variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={<DeleteOutlineIcon />}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      
      <Dialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}>
              <WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              Supprimer la sélection
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Vous allez supprimer{" "}
            <Typography component="span" fontWeight={700} color="text.primary">
              {selectedCount} client{selectedCount > 1 ? "s" : ""}
            </Typography>
            . Cette action est irréversible.
          </Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} variant="outlined" color="inherit">
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleteMutation.isPending || selectedCount === 0}
            onClick={async () => {
              setActionError(null);
              try {
                const ids = [...selectedClientIds];
                const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
                const failed = results.filter((r) => r.status === "rejected").length;
                if (failed > 0) {
                  setActionError(`${failed} suppression(s) ont échoué. Vérifiez les dépendances côté backend.`);
                }
                setBulkDeleteOpen(false);
                setSelectedClientIds([]);
              } catch (err) {
                setActionError(
                  err instanceof Error
                    ? err.message
                    : "Suppression multiple impossible.",
                );
              }
            }}
          >
            Supprimer la sélection
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// "?"? CSV Parser "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

/**
 * Découpe une ligne CSV en tenant compte des champs entre guillemets.
 * Gère aussi bien la virgule que le point-virgule comme séparateur.
 */
function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        //
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseClientsCsv(text: string): CreateClientInput[] {
  // Supprime le BOM UTF-8 que Excel ajoute souvent (U+FEFF)
  const cleaned = text.replace(/^\uFEFF/, "");

  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  //
  const firstLine = lines[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const header = splitCsvLine(firstLine, sep).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());

  const idxCode = header.indexOf("code_client");
  const idxName = header.indexOf("name");
  const idxAgence = header.indexOf("agence_client");
  const idxCaf = header.indexOf("caf_code");
  const idxContact = header.indexOf("contact_info");

  if (idxCode === -1 || idxName === -1) {
    throw new Error("Les colonnes 'code_client' et 'name' sont obligatoires dans la première ligne du fichier.");
  }

  const rows: CreateClientInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], sep);
    const code = cells[idxCode]?.replace(/^["']|["']$/g, "").trim();
    const name = cells[idxName]?.replace(/^["']|["']$/g, "").trim();
    if (!code || !name) continue;
    rows.push({
      codeClient: code,
      name,
      agenceClient: idxAgence >= 0 ? cells[idxAgence]?.replace(/^["']|["']$/g, "").trim() || null : null,
      cafCode: idxCaf >= 0 ? cells[idxCaf]?.replace(/^["']|["']$/g, "").trim() || null : null,
      contactInfo: idxContact >= 0 ? cells[idxContact]?.replace(/^["']|["']$/g, "").trim() || null : null,
    });
  }
  return rows;
}

