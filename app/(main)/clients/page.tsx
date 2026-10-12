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
import { Code, Download, FileUp, IdCard, ListFilter, MapPinned, PhoneCall, Plus, Search, Trash2, TriangleAlert, UserPlus, Users, UserX, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState, ChangeEvent, useMemo, useEffect } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { fetchAgences, Agence } from "@/lib/agences";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { HeaderButton, KpiTile, PageContainer, PageHeader, Panel } from "@/components/ui/page-blocks";

function useDebounce<T>(value: T, delay = 350): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

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

  const kpis = [
    { label: "Total clients", value: globalStats?.total ?? 0, accent: "#0F3B5C", icon: <Users size={22} /> },
    { label: "Avec CAF attribue", value: globalStats?.withCaf ?? 0, accent: "#1E6091", icon: <IdCard size={22} /> },
    { label: "Sans CAF", value: globalStats?.withoutCaf ?? 0, accent: "var(--text-muted)", icon: <UserX size={22} /> },
    { label: "Avec contact", value: globalStats?.withContact ?? 0, accent: "#3C8047", icon: <PhoneCall size={22} /> },
  ];

  return (
    <>
      <PageHeader icon={<MapPinned size={30} />} title="Clients" subtitle="Portefeuille clients du tenant — gestion, attribution CAF et import CSV">
        <div className="flex flex-wrap gap-3">
          <Tooltip title="Exporter les clients filtrés en CSV (jusqu'à 1000 lignes)">
            <HeaderButton onClick={handleExportCsv} disabled={exporting}><Download size={16} /> {exporting ? "Export…" : "Exporter CSV"}</HeaderButton>
          </Tooltip>
          {canManageClients && (
            <HeaderButton onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedRows([]); setSelectedFileName(null); }}>
              <FileUp size={16} /> Importer CSV
            </HeaderButton>
          )}
          {canManageClients && (
            <Button className="bg-[#3C8047] shadow-lg hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreateDialog}><Plus size={16} /> Ajouter un client</Button>
          )}
        </div>
      </PageHeader>

      <PageContainer>
        {(globalStats || !globalStatsQuery.isLoading) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {kpis.map((kpi, i) => <KpiTile key={i} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
            </div>
          </motion.div>
        )}

        <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou code client..." value={filterName} onChange={(e) => setFilterName(e.target.value)} className="pl-10 pr-9" />
              {filterName && (
                <button type="button" aria-label="Effacer la recherche" onClick={() => setFilterName("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
              )}
            </div>
            <Button size="sm" variant={filtersOpen ? "default" : "outline"} className={filtersOpen ? "hover:bg-[#1E6091] hover:opacity-100" : "text-muted-foreground"} onClick={() => setFiltersOpen((v) => !v)}>
              <ListFilter size={15} /> Filtres avancés
              {activeFilters > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{activeFilters}</span>}
            </Button>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" className="font-medium text-muted-foreground" onClick={clearFilters}><X size={15} /> Effacer ({activeFilters})</Button>
            )}
          </div>
          {filtersOpen && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Code client"><Input value={filterCode} onChange={(e) => setFilterCode(e.target.value)} /></Field>
                <Field label="Agence">
                  <Combobox
                    options={agenceFilterOptions}
                    value={selectedAgenceFilterOption}
                    onChange={(v) => setFilterAgence(v?.value ?? "")}
                    getKey={(o) => o.value}
                    getLabel={(o) => o.label}
                    placeholder="Toutes les agences"
                  />
                </Field>
                <Field label="CAF">
                  <Combobox
                    options={cafFilterOptions}
                    value={selectedCafFilterOption}
                    onChange={(v) => setFilterCaf(v?.value ?? "")}
                    getKey={(o) => o.value}
                    getLabel={(o) => o.label}
                    placeholder="Tous les CAFs"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Du"><Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} /></Field>
                  <Field label="Au"><Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} /></Field>
                </div>
              </div>
            </div>
          )}
          {!isLoading && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
              {serverTotal.toLocaleString("fr-FR")} client{serverTotal !== 1 ? "s" : ""} au total
              {hasClientSideOnlyFilters ? ` · ${filteredClients.length} affiché(s) sur cette page` : ""}
              {isFetching ? " · actualisation…" : ""}
            </div>
          )}
        </Panel>

        {duplicateCount > 0 && (
          <Alert severity="warning" className="mb-4 flex items-center justify-between gap-3">
            <span><b>{duplicateCount} client{duplicateCount > 1 ? "s" : ""}</b> avec un code duplique detecte{duplicateCount > 1 ? "s" : ""} — verifiez et fusionnez les doublons.</span>
            <Button size="sm" variant="ghost" className="h-7 shrink-0 text-[11px] font-bold" onClick={() => setFilterDuplicatesOnly((v) => !v)}>
              {filterDuplicatesOnly ? "Tout afficher" : "Voir les doublons"}
            </Button>
          </Alert>
        )}

        {isError && <Alert severity="error" className="mb-6">Impossible de charger les clients. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" className="mb-6">{actionError}</Alert>}

        {canManageClients && selectedCount > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-5 py-3 dark:border-orange-900 dark:bg-orange-950/40">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{selectedCount} client{selectedCount > 1 ? "s" : ""} selectionne{selectedCount > 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={clearSelection}>Deselectionner</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}><Trash2 size={15} /> Supprimer ({selectedCount})</Button>
            </div>
          </div>
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
      </PageContainer>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={editing ? <MapPinned size={20} /> : <UserPlus size={20} />}>{editing ? "Modifier le client" : "Nouveau client"}</DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Code client *" help={editing ? "Non modifiable après création" : "Identifiant unique du client"} className="sm:col-span-5">
                <Input value={codeClient} onChange={(e) => setCodeClient(e.target.value)} disabled={!!editing} placeholder="ex: APL-CLT-0100" />
              </Field>
              <Field label="Nom du client *" className="sm:col-span-7">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Jean Dupont" />
              </Field>
              <Field label="CAF attribué" help="Sélectionnez le CAF responsable de ce client." className="sm:col-span-12">
                <Select
                  value={cafCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCafCode(val);
                    const selected = availableCafsRaw.find((c) => c.code === val);
                    if (selected?.agence) setAgenceClient(selected.agence);
                    else setAgenceClient("");
                  }}
                >
                  <option value="">Aucun CAF</option>
                  {availableCafsRaw.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </Select>
              </Field>
              <Field label="Agence" help="Déduite automatiquement à partir du CAF sélectionné." className="sm:col-span-12">
                <Input value={agenceClient} disabled readOnly />
              </Field>
              <Field label="Contact (téléphone / email)" className="sm:col-span-12">
                <Textarea rows={2} value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="ex: +237 6 00 00 00 00 ou client@example.com" />
              </Field>
              {formError && <Alert severity="error" className="sm:col-span-12">{formError}</Alert>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!codeClient.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
              {editing ? "Enregistrer les modifications" : "Créer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<FileUp size={20} />}>Importer des clients via CSV</DialogHeader>
          <DialogBody>
            <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Code size={16} /> Format attendu (ligne d&apos;en-têtes)</div>
              <code className="mb-3 block rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">code_client,name,agence_client,caf_code,contact_info</code>
              <p className="text-xs leading-8 text-muted-foreground">
                ... <strong>code_client</strong> — obligatoire (ex&nbsp;: <code>APL-CLT-0100</code>)<br />
                ... <strong>name</strong> — obligatoire (ex&nbsp;: <code>Jean Dupont</code>)<br />
                ... <strong>agence_client</strong> — optionnel<br />
                ... <strong>caf_code</strong> — optionnel (ex&nbsp;: <code>001-CAF-TEST</code>)<br />
                ... <strong>contact_info</strong> — optionnel (téléphone ou email)
              </p>
            </div>
            <label className="inline-flex">
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted"><FileUp size={15} /> Choisir un fichier CSV</span>
              <input type="file" accept=".csv,text/csv" hidden onChange={handleCsvFileChange} />
            </label>
            {selectedFileName && (
              <div className="mt-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"><FileUp size={13} /> {selectedFileName}</span></div>
            )}
            {parsedRows.length > 0 && (
              <Alert severity="success" className="mt-4"><strong>{parsedRows.length} client{parsedRows.length > 1 ? "s" : ""}</strong> prêt{parsedRows.length > 1 ? "s" : ""} à être importé{parsedRows.length > 1 ? "s" : ""}.</Alert>
            )}
            {importError && <Alert severity="error" className="mt-4">{importError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={!parsedRows.length || importMutation.isPending}
              className="hover:bg-[#1E6091] hover:opacity-100"
              onClick={async () => {
                if (!parsedRows.length) return;
                setImportError(null);
                setActionError(null);
                try {
                  await importMutation.mutateAsync(parsedRows);
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : "Import impossible. Vérifiez les lignes du fichier CSV.");
                }
              }}
            >
              <FileUp size={15} /> Lancer l&apos;import ({parsedRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer le client</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous êtes sur le point de supprimer le client <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.codeClient}).
            Cette action est irréversible. Toutes les localisations de ce client seront également supprimées.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                if (deleteTarget?.id != null) {
                  setActionError(null);
                  try {
                    await deleteMutation.mutateAsync(deleteTarget.id);
                    setDeleteTarget(null);
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Suppression impossible pour ce client.");
                  }
                }
              }}
            >
              <Trash2 size={15} /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer la sélection</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous allez supprimer <strong className="text-foreground">{selectedCount} client{selectedCount > 1 ? "s" : ""}</strong>. Cette action est irréversible.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || selectedCount === 0}
              onClick={async () => {
                setActionError(null);
                try {
                  const ids = [...selectedClientIds];
                  const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
                  const failed = results.filter((r) => r.status === "rejected").length;
                  if (failed > 0) setActionError(`${failed} suppression(s) ont échoué. Vérifiez les dépendances côté backend.`);
                  setBulkDeleteOpen(false);
                  setSelectedClientIds([]);
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : "Suppression multiple impossible.");
                }
              }}
            >
              <Trash2 size={15} /> Supprimer la sélection
            </Button>
          </DialogFooter>
        </DialogContent>
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

