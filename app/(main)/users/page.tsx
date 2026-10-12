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
import { Code, Download, FileUp, IdCard, KeyRound, Plus, Search, ShieldAlert, Trash2, TriangleAlert, UserCheck, UserCog, UserPlus, Users, X } from "lucide-react";
import { motion } from "framer-motion";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { HeaderButton, KpiTile, PageContainer, PageHeader, Panel } from "@/components/ui/page-blocks";

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
    { label: "Total utilisateurs", value: totalUsers,   icon: <Users size={22} />,        accent: NAVY },
    { label: "Comptes actifs",      value: activeCount,  icon: <UserCog size={22} />,      accent: "#059669" },
    { label: "CAFs terrain",        value: cafCount,     icon: <IdCard size={22} />,       accent: STEEL },
    { label: "Encadrants",          value: managerCount, icon: <UserCheck size={22} />,    accent: GOLD },
  ];

  const hdrBtn = <T extends React.ReactNode>(x: T) => x;
  void hdrBtn;

  return (
    <>
      {/* Header */}
      <PageHeader icon={<Users size={30} />} title="Utilisateurs" subtitle="Comptes CAF, chefs d'agence et administrateurs du tenant">
        <div className="flex flex-wrap gap-3">
          <Tooltip title="Exporter la liste en CSV">
            <HeaderButton
              onClick={() => downloadCsv(users, [
                { key: "id", label: "Id" }, { key: "name", label: "Nom" },
                { key: "username", label: "Login" }, { key: "email", label: "Email" },
                { key: "roleName", label: "Role" }, { key: "agenceName", label: "Agence" },
                { key: "zoneName", label: "Zone" }, { key: "cafCode", label: "Code CAF" },
              ], "utilisateurs.csv")}
            >
              <Download size={16} /> Exporter
            </HeaderButton>
          </Tooltip>
          <HeaderButton onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}>
            <FileUp size={16} /> Importer CSV
          </HeaderButton>
          <Tooltip title="Reinitialiser tous les mots de passe">
            <HeaderButton onClick={() => { setResetAllPasswordValue(""); setResetAllError(null); setResetAllDialogOpen(true); }}>
              <KeyRound size={16} /> Reinit. MDP
            </HeaderButton>
          </Tooltip>
          <Button className="bg-[#3C8047] shadow-lg hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreateDialog}>
            <Plus size={16} /> Nouvel utilisateur
          </Button>
        </div>
      </PageHeader>

      <PageContainer>
        {/* KPIs */}
        {!isLoading && users.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {kpis.map((kpi, i) => <KpiTile key={i} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
            </div>
          </motion.div>
        )}

        {isError && <Alert severity="error" className="mb-6">Impossible de charger les utilisateurs. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" className="mb-6">{actionError}</Alert>}

        {selectedUserIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-5 py-3 dark:border-orange-900 dark:bg-orange-950/40">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {selectedUserIds.length} utilisateur{selectedUserIds.length > 1 ? "s" : ""} selectionne{selectedUserIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-orange-200 text-amber-800" onClick={() => setSelectedUserIds([])}>Deselectionner</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={15} /> Supprimer ({selectedUserIds.length})
              </Button>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, login, email ou agence..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
              {search && (
                <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
              )}
            </div>
            <Select aria-label="Filtrer par rôle" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-auto min-w-44">
              <option value="">Tous les rôles</option>
              {ROLE_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </Select>
            <Select aria-label="Filtrer par statut" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto min-w-36">
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Désactivé</option>
            </Select>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" className="font-medium text-muted-foreground" onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}>
                <X size={15} /> Effacer ({activeFilters})
              </Button>
            )}
          </div>
          {!isLoading && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? "s" : ""}{activeFilters > 0 ? ` · ${users.length} au total` : ""}
            </div>
          )}
        </Panel>

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
      </PageContainer>

      {/* Dialog: Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={editing ? <Users size={20} /> : <UserPlus size={20} />}>{editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogHeader>
          <DialogBody className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nom complet"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Jean Dupont" /></Field>
              <Field label="Login (identifiant)" help="Identifiant unique de connexion"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: jdupont" /></Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ex: jean.dupont@societe.fr" /></Field>
              <Field label="Role">
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLE_OPTIONS.map((r) => (<option key={r.code} value={r.code}>{r.label}</option>))}
                </Select>
              </Field>
              <Field label="Statut du compte" help={isActive ? "Utilisateur autorise a se connecter." : "Connexion bloquee."}>
                <Select value={isActive ? "active" : "inactive"} onChange={(e) => setIsActive(e.target.value === "active")}>
                  <option value="active">Actif</option>
                  <option value="inactive">Desactive</option>
                </Select>
              </Field>
              {isCafRole && (
                <Field label="Code CAF" help="Obligatoire pour les CAFs." className="sm:col-span-2">
                  <Input value={cafCode} onChange={(e) => setCafCode(e.target.value)} placeholder="ex: CAF001" />
                </Field>
              )}
              {isAgenceRequired && (
                <Field label={isCafRole ? "Agence principale *" : "Agence *"} help="Obligatoire pour ce role">
                  <Select
                    value={agenceId === "" ? "" : String(agenceId)}
                    onChange={(e) => { const v = e.target.value; setAgenceId(v === "" ? "" : Number(v)); }}
                    className={agenceId === "" ? "border-red-500" : ""}
                  >
                    <option value="">Aucune agence</option>
                    {agences.map((a) => (<option key={a.id} value={String(a.id)}>{a.name} ({a.code})</option>))}
                  </Select>
                </Field>
              )}
              {isResponsableZoneRole ? (
                <Field label="Zone *" help="Obligatoire pour ce role">
                  <Select
                    value={zoneId === "" ? "" : String(zoneId)}
                    onChange={(e) => { const v = e.target.value; setZoneId(v === "" ? "" : Number(v)); }}
                    className={zoneId === "" ? "border-red-500" : ""}
                  >
                    <option value="">Aucune zone</option>
                    {zones.map((z) => (<option key={z.id} value={String(z.id)}>{z.name} ({z.code})</option>))}
                  </Select>
                </Field>
              ) : (
                <Field label="Zone (automatique)" help={agenceId === "" ? "Selectionnez une agence." : "Calculee automatiquement."}>
                  <Input value={computedZoneName || "Aucune zone"} disabled readOnly />
                </Field>
              )}
              {isCafRole && (
                <div className="rounded-lg border border-border bg-background p-3 sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-foreground">Agences supplémentaires (CAF multi-agences)</span>
                    <Button size="sm" variant="ghost" className="text-xs font-semibold" onClick={() => setAdditionalAssignments((prev) => [...prev, { agenceId: 0, cafCode: "" }])}>
                      <Plus size={16} /> Ajouter une agence
                    </Button>
                  </div>
                  {loadingAssignments && <span className="text-xs text-muted-foreground">Chargement des agences existantes…</span>}
                  {additionalAssignments.length === 0 && !loadingAssignments && (
                    <span className="text-xs text-muted-foreground">Ce CAF n&apos;est rattaché qu&apos;à son agence principale ci-dessus.</span>
                  )}
                  <div className="flex flex-col gap-2">
                    {additionalAssignments.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          aria-label="Agence"
                          className="flex-1"
                          value={a.agenceId ? String(a.agenceId) : ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setAdditionalAssignments((prev) => prev.map((row, i) => i === idx ? { ...row, agenceId: v } : row));
                          }}
                        >
                          <option value="">—</option>
                          {agences.filter((ag) => ag.id === a.agenceId || ag.id !== agenceId).map((ag) => (
                            <option key={ag.id} value={String(ag.id)}>{ag.name} ({ag.code})</option>
                          ))}
                        </Select>
                        <Input
                          aria-label="Code CAF" className="flex-1" placeholder="ex: 001A02"
                          value={a.cafCode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAdditionalAssignments((prev) => prev.map((row, i) => i === idx ? { ...row, cafCode: v } : row));
                          }}
                        />
                        <button type="button" aria-label="Retirer cette agence" onClick={() => setAdditionalAssignments((prev) => prev.filter((_, i) => i !== idx))}
                          className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!editing && (
                <Field label="Mot de passe initial" help="Pour la premiere connexion." className="sm:col-span-2">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}
              {formError && <Alert severity="error" className="sm:col-span-2">{formError}</Alert>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !username.trim() || createMutation.isPending || updateMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
              {editing ? "Enregistrer" : "Creer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Bulk delete */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer la selection</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous allez supprimer <strong className="text-foreground">{selectedUserIds.length} utilisateur{selectedUserIds.length > 1 ? "s" : ""}</strong>. Cette action est irreversible.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
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
              }}
            >
              <Trash2 size={15} /> Supprimer la selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Single delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer l&apos;utilisateur</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous etes sur le point de supprimer le compte de <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.username}). Cette action est irreversible.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}><Trash2 size={15} /> Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset password */}
      <Dialog open={resetDialogOpen && !!resetTarget} onOpenChange={(o) => !o && setResetDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<KeyRound size={20} />}>Reinitialiser le mot de passe</DialogHeader>
          <DialogBody>
            <div className="mb-3 text-xs text-muted-foreground">{resetTarget?.name} ({resetTarget?.username})</div>
            <p className="mb-4 text-sm text-muted-foreground">Le nouveau mot de passe devra etre communique a l&apos;utilisateur.</p>
            <Field label="Nouveau mot de passe"><Input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} /></Field>
            {resetPasswordError && <Alert severity="error" className="mt-4">{resetPasswordError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={resetPasswordMutation.isPending || !resetPasswordValue.trim()}
              className="hover:bg-[#1E6091] hover:opacity-100"
              onClick={async () => {
                if (!resetTarget || !resetPasswordValue.trim()) return;
                setResetPasswordError(null);
                try {
                  await resetPasswordMutation.mutateAsync({ id: resetTarget.id, password: resetPasswordValue.trim() });
                } catch (err) {
                  setResetPasswordError(err instanceof Error ? err.message : "Reinitialisation impossible pour cet utilisateur.");
                }
              }}
            >
              <KeyRound size={15} /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Import CSV */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<FileUp size={20} />}>Importer des utilisateurs via CSV</DialogHeader>
          <DialogBody>
            <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Code size={16} /> Format attendu</div>
              <code className="mb-3 block break-all rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">name,username,password,email,role,agence_code,zone_code,caf_code</code>
              <p className="text-xs leading-8 text-muted-foreground">
                <b>name</b>, <b>username</b>, <b>password</b>, <b>role</b> — obligatoires<br />
                <b>email</b>, <b>agence_code</b>, <b>zone_code</b>, <b>caf_code</b> — optionnels<br />
                Rôles valides : admin_tenant, caf, chef_agence, responsable_zone…
              </p>
            </div>
            <label className="inline-flex">
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted"><FileUp size={15} /> Choisir un fichier CSV</span>
              <input type="file" accept=".csv,text/csv" hidden onChange={handleUsersCsvFile} />
            </label>
            {importFileName && (
              <div className="mt-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"><FileUp size={13} /> {importFileName}</span></div>
            )}
            {parsedImportRows.length > 0 && <Alert severity="success" className="mt-4"><b>{parsedImportRows.length} utilisateur{parsedImportRows.length > 1 ? "s" : ""}</b> prêts à être importés.</Alert>}
            {importError && <Alert severity="error" className="mt-4">{importError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={!parsedImportRows.length || importMutation.isPending}
              className="hover:bg-[#1E6091] hover:opacity-100"
              onClick={async () => { if (!parsedImportRows.length) return; setImportError(null); try { await importMutation.mutateAsync(parsedImportRows); } catch (err: any) { setImportError(err?.message ?? "Import impossible."); } }}
            >
              {importMutation.isPending ? <Spinner className="size-4" /> : <FileUp size={15} />} Lancer l&apos;import ({parsedImportRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset all */}
      <Dialog open={resetAllDialogOpen} onOpenChange={(o) => !o && setResetAllDialogOpen(false)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          <div className="h-1 bg-amber-500" />
          <DialogHeader icon={<ShieldAlert size={20} />}>Reinitialiser tous les mots de passe</DialogHeader>
          <DialogBody>
            <Alert severity="warning" className="mb-4">Cette action affecte <strong>tous les utilisateurs</strong> du tenant.</Alert>
            <p className="mb-4 text-sm text-muted-foreground">Un mot de passe temporaire commun sera defini. Chaque utilisateur devra le modifier lors de sa prochaine connexion.</p>
            <Field label="Mot de passe temporaire commun"><Input type="password" value={resetAllPasswordValue} onChange={(e) => setResetAllPasswordValue(e.target.value)} /></Field>
            {resetAllError && <Alert severity="error" className="mt-4">{resetAllError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetAllDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={resetAllMutation.isPending || !resetAllPasswordValue.trim()}
              className="bg-amber-500 hover:bg-amber-600 hover:opacity-100"
              onClick={async () => {
                if (!resetAllPasswordValue.trim()) return;
                setResetAllError(null);
                try {
                  await resetAllMutation.mutateAsync(resetAllPasswordValue.trim());
                } catch (err) {
                  setResetAllError(err instanceof Error ? err.message : "Reinitialisation impossible.");
                }
              }}
            >
              <KeyRound size={15} /> Reinitialiser tous les mots de passe
            </Button>
          </DialogFooter>
        </DialogContent>
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
