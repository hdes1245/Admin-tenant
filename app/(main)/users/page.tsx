"use client";

import { UsersTable } from "@/components/UsersTable";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  UserDto,
  resetUserPassword,
  resetAllUsersPasswords,
  fetchExtraCafAssignments,
  CafAssignmentInput,
} from "@/lib/users";
import { fetchAgences, Agence } from "@/lib/agences";
import { fetchZones, Zone } from "@/lib/zones";
import { fetchMe } from "@/lib/auth";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
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
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CodeIcon from "@mui/icons-material/Code";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LockResetIcon from "@mui/icons-material/LockReset";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShieldIcon from "@mui/icons-material/Shield";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import BadgeIcon from "@mui/icons-material/Badge";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import { motion } from "framer-motion";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const ROLE_OPTIONS = [
  { code: "admin_tenant",            label: "Admin tenant" },
  { code: "caf",                     label: "CAF" },
  { code: "chef_agence",             label: "Chef d'agence" },
  { code: "responsable_zone",        label: "Responsable de zone" },
  { code: "directrice_exploitation", label: "Directrice exploitation" },
  { code: "responsable_credit",      label: "Responsable credit" },
  { code: "analyste_credit",         label: "Analyste credit" },
  { code: "recouvrement",            label: "Recouvrement" },
  { code: "controleur",              label: "Controleur" },
  { code: "audit",                   label: "Audit" },
];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("caf");
  const [agenceId, setAgenceId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [cafCode, setCafCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  // CAF multi-agences : agences supplémentaires en plus de agenceId/cafCode
  // (qui restent l'agence "principale"). Un CAF peut être rattaché à
  // plusieurs agences, chacune avec son propre code CAF (cod_gest).
  const [additionalAssignments, setAdditionalAssignments] = useState<CafAssignmentInput[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetAllError, setResetAllError] = useState<string | null>(null);
  const [resetAllDialogOpen, setResetAllDialogOpen] = useState(false);
  const [resetAllPasswordValue, setResetAllPasswordValue] = useState("");

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ── Import CSV state ──
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedImportRows, setParsedImportRows] = useState<{ name: string; username: string; password: string; email?: string; role: string; agenceCode?: string; zoneCode?: string; cafCode?: string }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ includeCaf: true }),
  });
  const { data: agences = [] } = useQuery<Agence[]>({
    queryKey: ["agences"],
    queryFn: fetchAgences,
  });
  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });

  const selectedAgence = useMemo(
    () => agences.find((a) => a.id === agenceId) ?? null,
    [agences, agenceId]
  );
  const computedZoneId   = selectedAgence?.zoneId   ?? null;
  const computedZoneName = selectedAgence?.zoneName ?? "";

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q) && !(u.email ?? "").toLowerCase().includes(q) && !(u.agenceName ?? "").toLowerCase().includes(q)) return false;
      if (filterRole && u.roleCode.toLowerCase() !== filterRole.toLowerCase()) return false;
      if (filterStatus === "active" && !u.isActive) return false;
      if (filterStatus === "inactive" && u.isActive) return false;
      return true;
    });
  }, [users, search, filterRole, filterStatus]);

  const activeFilters = [search, filterRole, filterStatus].filter(Boolean).length;

  const totalUsers   = useMemo(() => users.length, [users]);
  const activeCount  = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  // Actifs uniquement : les comptes CAF désactivés (doublons historiques
  // remplacés lors du dédoublonnage des personnes) ne doivent pas gonfler
  // le nombre d'agents terrain réellement en activité.
  const cafCount     = useMemo(() => users.filter((u) => u.roleCode.toLowerCase() === "caf" && u.isActive).length, [users]);
  const managerCount = useMemo(
    () => users.filter((u) => ["chef_agence", "responsable_zone"].includes(u.roleCode.toLowerCase()) && u.isActive).length,
    [users]
  );

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: (params: { id: number; password: string }) =>
      resetUserPassword(params.id, params.password),
    onSuccess: () => {
      setResetDialogOpen(false);
      setResetTarget(null);
      setResetPasswordValue("");
    },
  });
  const resetAllMutation = useMutation({
    mutationFn: (pwd: string) => resetAllUsersPasswords(pwd),
    onSuccess: () => {
      setResetAllDialogOpen(false);
      setResetAllPasswordValue("");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: typeof parsedImportRows) => {
      for (const row of rows) {
        const agence = agences.find((a) => a.code.toLowerCase() === (row.agenceCode ?? "").toLowerCase());
        const zone = zones.find((z) => z.code.toLowerCase() === (row.zoneCode ?? "").toLowerCase());
        await createUser({
          name: row.name, username: row.username, password: row.password,
          email: row.email || null, role: row.role,
          agenceId: agence?.id ?? null,
          zoneId: zone?.id ?? null,
          cafCode: row.cafCode || null,
          isActive: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setImportDialogOpen(false); setParsedImportRows([]); setImportFileName(null);
    },
  });

  const handleUsersCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseUsersCsv(String(reader.result ?? ""));
        if (!rows.length) { setImportError("Aucune ligne valide."); setParsedImportRows([]); }
        else { setImportError(null); setParsedImportRows(rows); }
      } catch (err: any) { setImportError(err?.message ?? "Impossible de lire le fichier."); setParsedImportRows([]); }
    };
    reader.readAsText(file, "utf-8");
  };

  const isCafRole = useMemo(() => role.toLowerCase() === "caf", [role]);
  const isResponsableZoneRole = useMemo(() => role.toLowerCase() === "responsable_zone", [role]);
  const isAgenceOptionalRole = useMemo(() => {
    const r = role.toLowerCase();
    return [
      "admin_tenant","responsable_zone","directrice_exploitation",
      "responsable_credit","analyste_credit","recouvrement","controleur","audit",
    ].includes(r);
  }, [role]);
  const isAgenceRequired = !isAgenceOptionalRole;

  useEffect(() => { if (!isAgenceRequired && agenceId !== "") setAgenceId(""); }, [isAgenceRequired, agenceId]);
  useEffect(() => { if (!isResponsableZoneRole && zoneId !== "") setZoneId(""); }, [isResponsableZoneRole, zoneId]);

  const openCreateDialog = () => {
    setEditing(null);
    setName(""); setUsername(""); setEmail(""); setRole("caf");
    setAgenceId(""); setZoneId(""); setPassword(""); setCafCode(""); setIsActive(true);
    setAdditionalAssignments([]);
    setFormError(null); setDialogOpen(true);
  };
  const openEditDialog = async (user: UserDto) => {
    const targetRole = (user.roleCode || user.roleName || "").toLowerCase();
    if (targetRole === "admin_tenant") return; // géré par GeoTrust uniquement
    setEditing(user);
    setName(user.name); setUsername(user.username);
    setEmail(user.email ?? ""); setRole(user.roleCode || user.roleName);
    setAgenceId(user.agenceId ?? ""); setZoneId(user.zoneId ?? "");
    setPassword(""); setCafCode(user.cafCode ?? ""); setIsActive(user.isActive);
    setAdditionalAssignments([]);
    setFormError(null); setDialogOpen(true);
    // Précharger les agences supplémentaires existantes (créées via sync ou
    // via ce même formulaire) pour ne pas les écraser si l'admin touche à
    // la section multi-agences.
    if (targetRole === "caf") {
      setLoadingAssignments(true);
      try {
        const extra = await fetchExtraCafAssignments(user.id);
        setAdditionalAssignments(extra);
      } catch {
        // best-effort — si ça échoue, la section démarre vide plutôt que de bloquer l'édition
      } finally {
        setLoadingAssignments(false);
      }
    }
  };
  const handleSave = async () => {
    if (!name.trim() || !username.trim() || !role.trim()) return;
    const emailValue = email.trim();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFormError("Veuillez saisir une adresse email valide."); return;
    }
    if (isAgenceRequired && agenceId === "") { setFormError("L'agence est obligatoire pour ce role."); return; }
    if (isResponsableZoneRole && zoneId === "") { setFormError("La zone est obligatoire pour le role Responsable de zone."); return; }
    if (isCafRole) {
      for (const a of additionalAssignments) {
        if (!a.agenceId || !a.cafCode.trim()) {
          setFormError("Chaque agence supplémentaire doit avoir une agence et un code CAF renseignés.");
          return;
        }
      }
      const allAgenceIds = [agenceId, ...additionalAssignments.map((a) => a.agenceId)];
      if (new Set(allAgenceIds).size !== allAgenceIds.length) {
        setFormError("Une même agence ne peut pas être sélectionnée plusieurs fois.");
        return;
      }
    }
    setFormError(null);
    const payloadAgenceId = agenceId === "" ? null : agenceId;
    const payloadZoneId = isResponsableZoneRole
      ? (zoneId === "" ? null : zoneId)
      : (payloadAgenceId != null ? computedZoneId : null);
    const payloadCafCode = cafCode.trim() || null;
    const payloadAdditionalAssignments = isCafRole
      ? additionalAssignments.map((a) => ({ agenceId: a.agenceId, cafCode: a.cafCode.trim() }))
      : undefined;
    try {
      if (!editing) {
        if (!password.trim()) return;
        await createMutation.mutateAsync({
          name, username, password,
          email: emailValue || null,
          role, agenceId: payloadAgenceId as any,
          zoneId: payloadZoneId as any,
          cafCode: isCafRole ? payloadCafCode : null, isActive,
          additionalAssignments: payloadAdditionalAssignments,
        });
      } else {
        await updateMutation.mutateAsync({
          id: editing.id, name, username,
          email: emailValue || null,
          role, agenceId: payloadAgenceId as any,
          zoneId: payloadZoneId as any,
          cafCode: isCafRole ? payloadCafCode : null, isActive,
          additionalAssignments: payloadAdditionalAssignments,
        });
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Action impossible. Verifiez les donnees saisies.");
    }
  };
  const confirmDelete = async () => {
    if (deleteTarget?.id != null) {
      setActionError(null);
      try {
        await deleteMutation.mutateAsync(deleteTarget.id);
        setDeleteTarget(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Suppression impossible pour cet utilisateur.");
      }
    }
  };
  const toggleUserSelection = (userId: number) =>
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  const toggleSelectAllVisible = (checked: boolean, visibleIds: number[]) => {
    if (!checked) { setSelectedUserIds([]); return; }
    setSelectedUserIds(visibleIds);
  };
  const openResetDialog = (user: UserDto) => {
    setResetTarget(user); setResetPasswordValue(""); setResetPasswordError(null); setResetDialogOpen(true);
  };
  const toggleUserActive = async (user: UserDto) => {
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ id: user.id, isActive: !user.isActive });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Impossible de modifier le statut de cet utilisateur.");
    }
  };

  const kpis = [
    { label: "Total utilisateurs", value: totalUsers,   icon: <GroupsIcon sx={{ fontSize: 22 }} />,            accent: NAVY,      iconBg: NAVY },
    { label: "Comptes actifs",      value: activeCount,  icon: <ManageAccountsIcon sx={{ fontSize: 22 }} />,    accent: "#059669", iconBg: "#059669" },
    { label: "CAFs terrain",        value: cafCount,     icon: <BadgeIcon sx={{ fontSize: 22 }} />,             accent: STEEL,     iconBg: STEEL },
    { label: "Encadrants",          value: managerCount, icon: <SupervisorAccountIcon sx={{ fontSize: 22 }} />, accent: GOLD,      iconBg: GOLD },
  ];

  return (
    <>
      {/* Header */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <PeopleAltIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Utilisateurs</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>Comptes CAF, chefs d&apos;agence et administrateurs du tenant</Typography>
        </Box>
        <Box display="flex" gap={1.5} flexWrap="wrap">
                <Tooltip title="Exporter la liste en CSV">
                  <Button variant="outlined" startIcon={<DownloadIcon />}
                    onClick={() => downloadCsv(users, [
                      { key: "id", label: "Id" }, { key: "name", label: "Nom" },
                      { key: "username", label: "Login" }, { key: "email", label: "Email" },
                      { key: "roleName", label: "Role" }, { key: "agenceName", label: "Agence" },
                      { key: "zoneName", label: "Zone" }, { key: "cafCode", label: "Code CAF" },
                    ], "utilisateurs.csv")}
                    sx={{ borderColor: "rgba(255,255,255,0.5)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
                    Exporter
                  </Button>
                </Tooltip>
                <Button variant="outlined" startIcon={<UploadFileIcon />}
                  onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}
                  sx={{ borderColor: "rgba(255,255,255,0.5)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
                  Importer CSV
                </Button>
                <Tooltip title="Reinitialiser tous les mots de passe">
                  <Button variant="outlined" startIcon={<LockResetIcon />}
                    onClick={() => { setResetAllPasswordValue(""); setResetAllError(null); setResetAllDialogOpen(true); }}
                    sx={{ borderColor: "rgba(255,255,255,0.5)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
                    Reinit. MDP
                  </Button>
                </Tooltip>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}
                  sx={{ bgcolor: GOLD, color: "var(--text-primary)", fontWeight: 700, boxShadow: "0 4px 14px rgba(60,128,71,0.4)", "&:hover": { bgcolor: "#B8891F" } }}>
                  Nouvel utilisateur
                </Button>
              </Box>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* KPIs */}
        {!isLoading && users.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Grid container spacing={2} mb={3}>
              {kpis.map((kpi, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{
                    borderRadius: 3, bgcolor: "var(--bg-surface)", border: "1px solid var(--border)",
                    px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2,
                    position: "relative", overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(15,59,92,0.05)",
                    "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.accent, borderRadius: "3px 0 0 3px" },
                    transition: "box-shadow 0.2s",
                    "&:hover": { boxShadow: "0 4px 16px rgba(15,59,92,0.1)" },
                  }}>
                    <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.iconBg, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.iconBg}44`, flexShrink: 0 }}>
                      {kpi.icon}
                    </Avatar>
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

        {isError && <Alert severity="error" sx={{ mb: 3 }}>Impossible de charger les utilisateurs. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}

        {selectedUserIds.length > 0 && (
          <Box sx={{ mb: 2, px: 2.5, py: 1.5, borderRadius: 2, bgcolor: "#FFF7ED", border: "1px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#92400E" }}>
              {selectedUserIds.length} utilisateur{selectedUserIds.length > 1 ? "s" : ""} selectionne{selectedUserIds.length > 1 ? "s" : ""}
            </Typography>
            <Box display="flex" gap={1}>
              <Button size="small" variant="outlined" onClick={() => setSelectedUserIds([])} sx={{ borderColor: "#FED7AA", color: "#92400E", fontWeight: 600 }}>Deselectionner</Button>
              <Button size="small" color="error" variant="contained" startIcon={<DeleteOutlineIcon />} onClick={() => setBulkDeleteOpen(true)}>
                Supprimer ({selectedUserIds.length})
              </Button>
            </Box>
          </Box>
        )}

        {/* Filter bar */}
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 4px rgba(15,59,92,0.04)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Rechercher par nom, login, email ou agence..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)", transition: "background .15s", "&:hover": { bgcolor: "var(--bg-surface)" }, "&.Mui-focused": { bgcolor: "var(--bg-surface)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 } } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            <Select size="small" displayEmpty value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              sx={{ minWidth: 180, borderRadius: 2, bgcolor: "var(--bg-page)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL } }}>
              <MenuItem value="">Tous les rôles</MenuItem>
              {ROLE_OPTIONS.map((r) => <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>)}
            </Select>
            <Select size="small" displayEmpty value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              sx={{ minWidth: 140, borderRadius: 2, bgcolor: "var(--bg-page)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL } }}>
              <MenuItem value="">Tous les statuts</MenuItem>
              <MenuItem value="active">Actif</MenuItem>
              <MenuItem value="inactive">Désactivé</MenuItem>
            </Select>
            {activeFilters > 0 && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
                sx={{ fontWeight: 500, borderRadius: 2, color: "var(--text-secondary)", fontSize: 13, "&:hover": { bgcolor: "#F1F5F9" } }}>
                Effacer ({activeFilters})
              </Button>
            )}
          </Box>
          {!isLoading && (
            <Box display="flex" gap={1} mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? "s" : ""}{activeFilters > 0 ? ` · ${users.length} au total` : ""}
              </Typography>
            </Box>
          )}
        </Paper>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <UsersTable
            users={filteredUsers} loading={isLoading}
            currentUserId={me?.id}
            onEdit={openEditDialog}
            onDelete={(u) => setDeleteTarget(u)}
            onResetPassword={openResetDialog}
            onToggleActive={toggleUserActive}
            selectedIds={selectedUserIds}
            onToggleSelect={toggleUserSelection}
            onToggleSelectAll={toggleSelectAllVisible}
          />
        </motion.div>
      </Container>

      {/* Dialog: Create / Edit */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}>
              {editing ? <PeopleAltIcon sx={{ color: GOLD, fontSize: 20 }} /> : <PersonAddIcon sx={{ color: GOLD, fontSize: 20 }} />}
            </Avatar>
            <Typography variant="h6" fontWeight={700} sx={{ color: "var(--text-primary)" }}>
              {editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nom complet" fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Jean Dupont" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Login (identifiant)" fullWidth size="small" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: jdupont" helperText="Identifiant unique de connexion" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email" type="email" fullWidth size="small" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ex: jean.dupont@societe.fr" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Role" fullWidth size="small" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (<MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Statut du compte" fullWidth size="small"
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                helperText={isActive ? "Utilisateur autorise a se connecter." : "Connexion bloquee."}
              >
                <MenuItem value="active"><Box display="flex" alignItems="center" gap={1}><ToggleOnIcon sx={{ color: "#16a34a", fontSize: 18 }} />Actif</Box></MenuItem>
                <MenuItem value="inactive"><Box display="flex" alignItems="center" gap={1}><ToggleOffIcon sx={{ color: "#ef4444", fontSize: 18 }} />Desactive</Box></MenuItem>
              </TextField>
            </Grid>
            {isCafRole && (
              <Grid item xs={12}>
                <TextField label="Code CAF" fullWidth size="small" value={cafCode} onChange={(e) => setCafCode(e.target.value)} placeholder="ex: CAF001" helperText="Obligatoire pour les CAFs." />
              </Grid>
            )}
            {isAgenceRequired && (
              <Grid item xs={12} sm={6}>
                <TextField select label={isCafRole ? "Agence principale *" : "Agence *"} fullWidth size="small"
                  value={agenceId === "" ? "" : String(agenceId)}
                  onChange={(e) => { const v = e.target.value; setAgenceId(v === "" ? "" : Number(v)); }}
                  error={agenceId === ""} helperText="Obligatoire pour ce role"
                >
                  <MenuItem value="">Aucune agence</MenuItem>
                  {agences.map((a) => (<MenuItem key={a.id} value={String(a.id)}>{a.name} ({a.code})</MenuItem>))}
                </TextField>
              </Grid>
            )}
            {isResponsableZoneRole ? (
              <Grid item xs={12} sm={6}>
                <TextField select label="Zone *" fullWidth size="small"
                  value={zoneId === "" ? "" : String(zoneId)}
                  onChange={(e) => { const v = e.target.value; setZoneId(v === "" ? "" : Number(v)); }}
                  error={zoneId === ""} helperText="Obligatoire pour ce role"
                >
                  <MenuItem value="">Aucune zone</MenuItem>
                  {zones.map((z) => (<MenuItem key={z.id} value={String(z.id)}>{z.name} ({z.code})</MenuItem>))}
                </TextField>
              </Grid>
            ) : (
              <Grid item xs={12} sm={6}>
                <TextField label="Zone (automatique)" fullWidth size="small"
                  value={computedZoneName || "Aucune zone"}
                  helperText={agenceId === "" ? "Selectionnez une agence." : "Calculee automatiquement."}
                  disabled
                />
              </Grid>
            )}
            {isCafRole && (
              <Grid item xs={12}>
                <Box sx={{ border: "1px solid var(--border)", borderRadius: 2, p: 1.5, bgcolor: "var(--bg-page)" }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography fontSize={12.5} fontWeight={700} color="var(--text-primary)">
                      Agences supplémentaires (CAF multi-agences)
                    </Typography>
                    <Button
                      size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                      onClick={() => setAdditionalAssignments((prev) => [...prev, { agenceId: 0, cafCode: "" }])}
                      sx={{ fontSize: 12, fontWeight: 600 }}
                    >
                      Ajouter une agence
                    </Button>
                  </Box>
                  {loadingAssignments && (
                    <Typography fontSize={12} color="text.secondary">Chargement des agences existantes…</Typography>
                  )}
                  {additionalAssignments.length === 0 && !loadingAssignments && (
                    <Typography fontSize={12} color="text.secondary">
                      Ce CAF n&apos;est rattaché qu&apos;à son agence principale ci-dessus.
                    </Typography>
                  )}
                  <Box display="flex" flexDirection="column" gap={1}>
                    {additionalAssignments.map((a, idx) => (
                      <Box key={idx} display="flex" gap={1} alignItems="center">
                        <TextField
                          select size="small" label="Agence" sx={{ flex: 1 }}
                          value={a.agenceId ? String(a.agenceId) : ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setAdditionalAssignments((prev) => prev.map((row, i) => i === idx ? { ...row, agenceId: v } : row));
                          }}
                        >
                          <MenuItem value="">—</MenuItem>
                          {agences.filter((ag) => ag.id === a.agenceId || ag.id !== agenceId).map((ag) => (
                            <MenuItem key={ag.id} value={String(ag.id)}>{ag.name} ({ag.code})</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small" label="Code CAF" sx={{ flex: 1 }} placeholder="ex: 001A02"
                          value={a.cafCode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAdditionalAssignments((prev) => prev.map((row, i) => i === idx ? { ...row, cafCode: v } : row));
                          }}
                        />
                        <IconButton size="small" onClick={() => setAdditionalAssignments((prev) => prev.filter((_, i) => i !== idx))} sx={{ color: "#dc2626" }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
            {!editing && (
              <Grid item xs={12}>
                <TextField label="Mot de passe initial" type="password" fullWidth size="small" value={password} onChange={(e) => setPassword(e.target.value)} helperText="Pour la premiere connexion." />
              </Grid>
            )}
            {formError && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ mt: 0.5 }}>{formError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={handleSave} variant="contained"
            disabled={!name.trim() || !username.trim() || createMutation.isPending || updateMutation.isPending}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            {editing ? "Enregistrer" : "Creer l'utilisateur"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bulk delete */}
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar>
            <Typography variant="h6" fontWeight={700}>Supprimer la selection</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Vous allez supprimer{" "}
            <Typography component="span" fontWeight={700} color="text.primary">{selectedUserIds.length} utilisateur{selectedUserIds.length > 1 ? "s" : ""}</Typography>.
            Cette action est irreversible.
          </Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />}
            disabled={deleteMutation.isPending || selectedUserIds.length === 0}
            onClick={async () => {
              setActionError(null);
              try {
                const ids = [...selectedUserIds];
                const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
                const failed = results.filter((r) => r.status === "rejected").length;
                if (failed > 0) setActionError(`${failed} suppression(s) ont echoue.`);
                setBulkDeleteOpen(false); setSelectedUserIds([]);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Suppression multiple impossible.");
              }
            }}>
            Supprimer la selection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Single delete */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#fee2e2" }}><WarningAmberIcon sx={{ color: "#ef4444", fontSize: 20 }} /></Avatar>
            <Typography variant="h6" fontWeight={700}>Supprimer l&apos;utilisateur</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Vous etes sur le point de supprimer le compte de{" "}
            <Typography component="span" fontWeight={700} color="text.primary">{deleteTarget?.name}</Typography>{" "}
            <Typography component="span" color="text.secondary">({deleteTarget?.username})</Typography>.
            Cette action est irreversible.
          </Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" color="inherit">Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleteMutation.isPending} startIcon={<DeleteOutlineIcon />}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Reset password */}
      <Dialog open={resetDialogOpen && !!resetTarget} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><LockResetIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: "var(--text-primary)" }}>Reinitialiser le mot de passe</Typography>
              <Typography variant="caption" color="text.secondary">{resetTarget?.name} ({resetTarget?.username})</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>Le nouveau mot de passe devra etre communique a l&apos;utilisateur.</Typography>
          <TextField label="Nouveau mot de passe" type="password" fullWidth size="small" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
          {resetPasswordError && <Alert severity="error" sx={{ mt: 2 }}>{resetPasswordError}</Alert>}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setResetDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button
            onClick={async () => {
              if (!resetTarget || !resetPasswordValue.trim()) return;
              setResetPasswordError(null);
              try {
                await resetPasswordMutation.mutateAsync({ id: resetTarget.id, password: resetPasswordValue.trim() });
              } catch (err) {
                setResetPasswordError(err instanceof Error ? err.message : "Reinitialisation impossible pour cet utilisateur.");
              }
            }}
            variant="contained" disabled={resetPasswordMutation.isPending || !resetPasswordValue.trim()} startIcon={<LockResetIcon />}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL } }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Import CSV */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: GOLD }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: NAVY }}><UploadFileIcon sx={{ color: GOLD, fontSize: 20 }} /></Avatar>
            <Typography variant="h6" fontWeight={700}>Importer des utilisateurs via CSV</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "divider", p: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}><CodeIcon sx={{ fontSize: 16, color: "text.secondary" }} /><Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Format attendu</Typography></Box>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12, bgcolor: "var(--bg-surface)", borderRadius: 1, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", mb: 1.5 }}>name,username,password,email,role,agence_code,zone_code,caf_code</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 2 }}>
              <b>name</b>, <b>username</b>, <b>password</b>, <b>role</b> — obligatoires<br />
              <b>email</b>, <b>agence_code</b>, <b>zone_code</b>, <b>caf_code</b> — optionnels<br />
              Rôles valides : admin_tenant, caf, chef_agence, responsable_zone…
            </Typography>
          </Box>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2 }}>
            Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={handleUsersCsvFile} />
          </Button>
          {importFileName && <Box mt={2}><Chip label={importFileName} size="small" icon={<UploadFileIcon />} color="warning" variant="outlined" /></Box>}
          {parsedImportRows.length > 0 && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}><b>{parsedImportRows.length} utilisateur{parsedImportRows.length > 1 ? "s" : ""}</b> prêts à être importés.</Alert>}
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

      {/* Dialog: Reset all */}
      <Dialog open={resetAllDialogOpen} onClose={() => setResetAllDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
        <Box sx={{ height: 4, bgcolor: "#f59e0b" }} />
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#fff7ed" }}><ShieldIcon sx={{ color: "#f59e0b", fontSize: 20 }} /></Avatar>
            <Typography variant="h6" fontWeight={700}>Reinitialiser tous les mots de passe</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>Cette action affecte <strong>tous les utilisateurs</strong> du tenant.</Alert>
          <Typography variant="body2" color="text.secondary" mb={2}>Un mot de passe temporaire commun sera defini. Chaque utilisateur devra le modifier lors de sa prochaine connexion.</Typography>
          <TextField label="Mot de passe temporaire commun" type="password" fullWidth size="small" value={resetAllPasswordValue} onChange={(e) => setResetAllPasswordValue(e.target.value)} />
          {resetAllError && <Alert severity="error" sx={{ mt: 2 }}>{resetAllError}</Alert>}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setResetAllDialogOpen(false)} variant="outlined" color="inherit">Annuler</Button>
          <Button
            onClick={async () => {
              if (!resetAllPasswordValue.trim()) return;
              setResetAllError(null);
              try {
                await resetAllMutation.mutateAsync(resetAllPasswordValue.trim());
              } catch (err) {
                setResetAllError(err instanceof Error ? err.message : "Reinitialisation impossible.");
              }
            }}
            variant="contained" color="warning"
            disabled={resetAllMutation.isPending || !resetAllPasswordValue.trim()}
            startIcon={<LockResetIcon />}>
            Reinitialiser tous les mots de passe
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function parseUsersCsv(text: string): { name: string; username: string; password: string; email?: string; role: string; agenceCode?: string; zoneCode?: string; cafCode?: string }[] {
  const cleaned = text.replace(/^﻿/, "");
  const lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());
  const idx = (k: string) => header.indexOf(k);
  if (idx("name") === -1 || idx("username") === -1 || idx("password") === -1 || idx("role") === -1)
    throw new Error("Colonnes obligatoires manquantes : name, username, password, role.");
  const rows: ReturnType<typeof parseUsersCsv> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const get = (k: string) => idx(k) >= 0 ? cells[idx(k)] || undefined : undefined;
    const name = get("name"), username = get("username"), password = get("password"), role = get("role");
    if (!name || !username || !password || !role) continue;
    rows.push({ name, username, password, role, email: get("email"), agenceCode: get("agence_code"), zoneCode: get("zone_code"), cafCode: get("caf_code") });
  }
  return rows;
}
