"use client";

import { AgencesTable } from "@/components/AgencesTable";
import { Agence, AgenceStats, createAgence, deleteAgence, fetchAgences, fetchAgencesStats, updateAgence } from "@/lib/agences";
import { fetchUsers } from "@/lib/users";
import { fetchZones, Zone } from "@/lib/zones";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Code, Download, FileUp, Network, Plus, Search, Trash2, TriangleAlert, Unlink, Users, Wallet, X } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, ChangeEvent, useEffect } from "react";
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
    { label: "Total agences", value: agences.length, accent: NAVY, icon: <Building2 size={20} /> },
    { label: "Zones distinctes", value: zonesLinked, accent: STEEL, icon: <Network size={20} /> },
    { label: "Sans zone", value: agences.length - agencesWithZone, accent: "var(--text-muted)", icon: <Unlink size={20} /> },
    { label: "Total clients", value: totalClients, accent: STEEL, icon: <Users size={20} /> },
    { label: "Total CAFs", value: totalCafs, accent: "#7c3aed", icon: <Wallet size={20} /> },
  ];

  const selStats = deleteTarget ? statsMap.get(deleteTarget.id) : undefined;
  const hasLinks = !!selStats && (selStats.nbClients > 0 || selStats.nbCafs > 0 || selStats.nbUsers > 0);

  return (
    <>
      {/* ── Header ── */}
      <PageHeader icon={<Building2 size={30} />} title="Agences" subtitle="Gestion des agences, rattachement aux zones et statistiques de portefeuille">
        <div className="flex flex-wrap gap-3">
          <Tooltip title="Exporter les agences visibles en CSV">
            <HeaderButton onClick={() => downloadCsv(filteredAgences as unknown as Record<string, unknown>[], [{ key: "code", label: "code" }, { key: "name", label: "nom" }, { key: "zoneName", label: "zone" }], "agences.csv")}>
              <Download size={16} /> Exporter CSV
            </HeaderButton>
          </Tooltip>
          <HeaderButton onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}>
            <FileUp size={16} /> Importer CSV
          </HeaderButton>
          <Button className="bg-[#3C8047] shadow-lg hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreate}>
            <Plus size={16} /> Ajouter une agence
          </Button>
        </div>
      </PageHeader>

      <PageContainer>
        {/* ── KPI tiles ── */}
        {!isLoading && agences.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {KPI_DATA.map((kpi, i) => (
                <KpiTile key={i} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Filter bar ── */}
        <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par code, nom ou zone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
              {search && (
                <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted">
                  <X size={16} />
                </button>
              )}
            </div>
            <Select
              aria-label="Filtrer par zone"
              value={filterZone === "" ? "" : String(filterZone)}
              onChange={(e) => { const v = e.target.value; setFilterZone(v === "" ? "" : Number(v)); }}
              className="w-auto min-w-44"
            >
              <option value="">Toutes les zones</option>
              <option value="none">Sans zone</option>
              {zones.map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
            </Select>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" className="font-medium text-muted-foreground" onClick={() => { setSearch(""); setFilterZone(""); }}>
                <X size={15} /> Effacer ({activeFilters})
              </Button>
            )}
          </div>
        </Panel>

        {isError && <Alert severity="error" className="mb-6">Impossible de charger les agences. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" className="mb-6">{actionError}</Alert>}

        {/* ── Bulk selection bar ── */}
        {selectedAgenceIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-5 py-3 dark:border-orange-900 dark:bg-orange-950/40">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {selectedAgenceIds.length} agence{selectedAgenceIds.length > 1 ? "s" : ""} selectionnee{selectedAgenceIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedAgenceIds([])}>Deselectionner</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={15} /> Supprimer ({selectedAgenceIds.length})
              </Button>
            </div>
          </div>
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
      </PageContainer>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<Building2 size={20} />}>{editing ? "Modifier l'agence" : "Nouvelle agence"}</DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Code agence *"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: AG001" /></Field>
            <Field label="Nom de l'agence *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Agence Centre-Ville" /></Field>
            <Field label="Zone (optionnel)" help="Rattacher cette agence a une zone geographique.">
              <Select value={zoneId === "" ? "" : String(zoneId)} onChange={(e) => { const v = e.target.value; setZoneId(v === "" ? "" : Number(v)); }}>
                <option value="">Aucune zone</option>
                {zones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} ({z.code})</option>)}
              </Select>
            </Field>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!code.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
              {editing ? "Enregistrer les modifications" : "Creer l'agence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import CSV dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<FileUp size={20} />}>Importer des agences via CSV</DialogHeader>
          <DialogBody>
            <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Code size={16} /> Format attendu</div>
              <code className="mb-3 block rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">code,name,zone_code</code>
              <p className="text-xs leading-8 text-muted-foreground">
                <b>code</b> — obligatoire (ex: AG001)<br /><b>name</b> — obligatoire (ex: Agence Centre)<br /><b>zone_code</b> — optionnel, rattache automatiquement a la zone correspondante
              </p>
            </div>
            <label className="inline-flex">
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted">
                <FileUp size={15} /> Choisir un fichier CSV
              </span>
              <input type="file" accept=".csv,text/csv" hidden onChange={handleCsvFile} />
            </label>
            {importFileName && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"><FileUp size={13} /> {importFileName}</span>
              </div>
            )}
            {parsedImportRows.length > 0 && <Alert severity="success" className="mt-4"><b>{parsedImportRows.length} agence{parsedImportRows.length > 1 ? "s" : ""}</b> pretes a etre importees.</Alert>}
            {importError && <Alert severity="error" className="mt-4">{importError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={!parsedImportRows.length || importMutation.isPending}
              className="hover:bg-[#1E6091] hover:opacity-100"
              onClick={async () => { if (!parsedImportRows.length) return; setImportError(null); try { await importMutation.mutateAsync(parsedImportRows); } catch (err: any) { setImportError(err?.message ?? "Import impossible."); } }}
            >
              {importMutation.isPending ? <Spinner className="size-4" /> : <FileUp size={15} />}
              Lancer l&apos;import ({parsedImportRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk delete dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent size="xs" aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer la selection</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous allez supprimer <strong className="text-foreground">{selectedAgenceIds.length} agence{selectedAgenceIds.length > 1 ? "s" : ""}</strong>. La suppression sera refusee pour les agences encore liees a des clients, CAFs ou utilisateurs.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || selectedAgenceIds.length === 0}
              onClick={async () => { setActionError(null); const ids = [...selectedAgenceIds]; const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id))); const failed = results.filter((r) => r.status === "rejected").length; if (failed > 0) setActionError(`${failed} suppression(s) ont echoue (agences encore liees).`); setBulkDeleteOpen(false); setSelectedAgenceIds([]); }}
            >
              <Trash2 size={15} /> Supprimer la selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Single delete dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="xs" aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer l&apos;agence</DialogHeader>
          <DialogBody>
            {hasLinks && selStats && (
              <Alert severity="warning" className="mb-4 text-xs">
                Cette agence possede encore {[
                  selStats.nbClients > 0 ? `${selStats.nbClients} client(s)` : "",
                  selStats.nbCafs > 0 ? `${selStats.nbCafs} CAF(s)` : "",
                  selStats.nbUsers > 0 ? `${selStats.nbUsers} utilisateur(s)` : "",
                ].filter(Boolean).join(", ")}. La suppression sera refusee.
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              Vous etes sur le point de supprimer l&apos;agence <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.code}). Cette action est irreversible.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => { if (deleteTarget?.id != null) { setActionError(null); try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } catch (err) { setActionError(err instanceof Error ? err.message : "Suppression impossible."); setDeleteTarget(null); } } }}
            >
              <Trash2 size={15} /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
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
