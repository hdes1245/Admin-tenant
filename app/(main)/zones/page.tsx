"use client";

import { fetchZones, Zone, createZone, updateZone, deleteZone } from "@/lib/zones";
import { fetchAgences } from "@/lib/agences";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Code, Download, FileUp, Layers, ListFilter, Map as MapIcon, MapPinPlus, Pencil, Plus, Search, Trash2, TriangleAlert, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";


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
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-alt px-6 py-3">
        <Tooltip title="Exporter les zones en CSV">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(filteredZones, [{ key: "code", label: "Code" }, { key: "name", label: "Nom" }], "zones.csv")}
          >
            <Download size={15} /> Exporter CSV
          </Button>
        </Tooltip>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}
        >
          <FileUp size={15} /> Importer CSV
        </Button>
        <div className="flex-1" />
        <Button size="sm" className="bg-[#3C8047] hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreate}>
          <Plus size={15} /> Ajouter une zone
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[1536px] px-6 py-6">
        {!isLoading && zones.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total zones", value: zones.length, accent: NAVY, icon: <Layers size={20} /> },
                { label: "Affichées", value: filteredZones.length, accent: STEEL, icon: <MapIcon size={20} /> },
                { label: "Zones avec agences", value: zones.filter((z) => (agencesPerZone.get(z.id) ?? 0) > 0).length, accent: "#059669", icon: <Layers size={20} /> },
                { label: "Zones sans agence", value: zones.filter((z) => (agencesPerZone.get(z.id) ?? 0) === 0).length, accent: "var(--text-muted)", icon: <MapIcon size={20} /> },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-surface px-5 py-5 shadow-[0_1px_3px_rgba(15,59,92,0.05)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,59,92,0.1)]"
                >
                  <span className="absolute inset-y-0 left-0 w-1 rounded-l-sm" style={{ background: kpi.accent }} />
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-white"
                    style={{ background: kpi.accent, boxShadow: `0 4px 12px color-mix(in srgb, ${kpi.accent} 27%, transparent)` }}
                  >
                    {kpi.icon}
                  </span>
                  <div>
                    <div className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: kpi.accent }}>{kpi.value}</div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground">{kpi.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mb-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou nom de zone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-9"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button
              size="sm"
              variant={filtersOpen ? "default" : "outline"}
              className={filtersOpen ? "hover:bg-[#1E6091] hover:opacity-100" : "text-muted-foreground"}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <ListFilter size={15} /> Dates
              {activeDateFilters > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{activeDateFilters}</span>}
            </Button>
            {(search || activeDateFilters > 0) && (
              <Button
                size="sm"
                variant="ghost"
                className="font-medium text-muted-foreground"
                onClick={() => { setSearch(""); setFilterStartDate(""); setFilterEndDate(""); }}
              >
                <X size={15} /> Effacer
              </Button>
            )}
          </div>
          {filtersOpen && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
              <Field label="Du" className="min-w-40">
                <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
              </Field>
              <Field label="Au" className="min-w-40">
                <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {isError && <Alert severity="error" className="mb-6">Impossible de charger les zones. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" className="mb-6">{actionError}</Alert>}

        {selectedZoneIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-5 py-3 dark:border-orange-900 dark:bg-orange-950/40">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {selectedZoneIds.length} zone{selectedZoneIds.length > 1 ? "s" : ""} sélectionnée{selectedZoneIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedZoneIds([])}>Désélectionner</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={15} /> Supprimer ({selectedZoneIds.length})
              </Button>
            </div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0F3B5C]">
                  <th className="w-12 py-3.5 pl-4 text-left">
                    <Checkbox
                      aria-label="Tout sélectionner"
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={(e) => setSelectedZoneIds(e.target.checked ? paginatedZones.map((z) => z.id) : [])}
                    />
                  </th>
                  <th className="w-[52px]" />
                  {["Code zone", "Nom de la zone", "Agences", ""].map((label, i) => (
                    <th
                      key={i}
                      className={`py-3.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-white/55 ${i === 3 ? "pr-5 text-right" : i === 2 ? "text-center" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                        <Spinner className="text-[#1E6091]" /> Chargement des zones...
                      </div>
                    </td>
                  </tr>
                ) : filteredZones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong">
                          <MapIcon size={24} />
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {search || activeDateFilters > 0 ? "Aucune zone ne correspond." : "Aucune zone enregistrée."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedZones.map((z, idx) => {
                    const isSelected = selectedZoneSet.has(z.id);
                    const cnt = agencesPerZone.get(z.id) ?? 0;
                    const cell = `border-b border-border ${isSelected ? "bg-[rgba(30,96,145,0.10)]" : "bg-surface"}`;
                    return (
                      <motion.tr
                        key={z.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        style={{ display: "table-row" }}
                        className="group"
                      >
                        <td className={`py-2 pl-4 transition-colors ${cell} border-l-[3px] ${isSelected ? "border-l-[#1E6091]" : "border-l-transparent"}`}>
                          <Checkbox aria-label={`Sélectionner ${z.name}`} checked={isSelected} onChange={() => toggleZoneSelection(z.id)} />
                        </td>
                        <td className={`py-2 pl-4 ${cell}`}>
                          <span className="flex size-[34px] items-center justify-center rounded-full bg-[#0F3B5C] text-white/70">
                            <MapIcon size={17} />
                          </span>
                        </td>
                        <td className={`py-2 ${cell}`}>
                          <span className="inline-flex rounded-[5px] border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#1E6091]">
                            {z.code}
                          </span>
                        </td>
                        <td className={`py-2 ${cell}`}>
                          <span className="text-sm font-semibold text-foreground">{z.name}</span>
                        </td>
                        <td className={`py-2 text-center ${cell}`}>
                          {cnt > 0 ? (
                            <span className="inline-flex h-5 items-center rounded-full bg-[#1E6091]/10 px-2 text-[11px] font-bold text-[#1E6091]">{cnt}</span>
                          ) : (
                            <span className="text-xs text-border-strong">—</span>
                          )}
                        </td>
                        <td className={`py-2 pr-4 ${cell}`}>
                          <div className="flex justify-end gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                            <Tooltip title="Modifier">
                              <button
                                type="button"
                                aria-label="Modifier"
                                onClick={() => openEdit(z)}
                                className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]"
                              >
                                <Pencil size={16} />
                              </button>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <button
                                type="button"
                                aria-label="Supprimer"
                                onClick={() => setDeleteTarget(z)}
                                className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredZones.length > 0 && (
            <PaginationBar page={zonePage} totalPages={zoneTotalPages} total={filteredZones.length} pageSize={zonePageSize} onPageChange={setZonePage} onPageSizeChange={(s) => { setZonePageSize(s); setZonePage(1); }} />
          )}
        </motion.div>
      </div>

      {/* Zone dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={editing ? <MapIcon size={20} /> : <MapPinPlus size={20} />}>{editing ? "Modifier la zone" : "Nouvelle zone"}</DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Code zone *" help="Identifiant unique de la zone" className="sm:col-span-5">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: ZN-CENTRE" />
              </Field>
              <Field label="Nom de la zone *" className="sm:col-span-7">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Zone Centre-Ville" />
              </Field>
              {formError && <Alert severity="error" className="sm:col-span-12">{formError}</Alert>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!code.trim() || !name.trim() || createMutation.isPending || updateMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
              {editing ? "Enregistrer" : "Créer la zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent size="xs" aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer la sélection</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous allez supprimer <strong className="text-foreground">{selectedZoneIds.length} zone{selectedZoneIds.length > 1 ? "s" : ""}</strong>. La suppression sera refusée pour les zones encore liées.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || selectedZoneIds.length === 0}
              onClick={async () => {
                setActionError(null);
                const ids = [...selectedZoneIds];
                const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
                const failed = results.filter((r) => r.status === "rejected").length;
                if (failed > 0) setActionError(`${failed} suppression(s) ont échoué.`);
                setBulkDeleteOpen(false);
                setSelectedZoneIds([]);
              }}
            >
              <Trash2 size={15} /> Supprimer la sélection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="xs" aria-describedby={undefined}>
          <DialogHeader tone="danger" icon={<TriangleAlert size={20} />}>Supprimer la zone</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Vous êtes sur le point de supprimer la zone <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.code}). La suppression sera refusée si des agences sont encore rattachées.
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              <Trash2 size={15} /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<FileUp size={20} />}>Importer des zones via CSV</DialogHeader>
          <DialogBody>
            <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Code size={16} /> Format attendu
              </div>
              <code className="block rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">code,name</code>
            </div>
            <label className="inline-flex">
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted">
                <FileUp size={15} /> Choisir un fichier CSV
              </span>
              <input type="file" accept=".csv,text/csv" hidden onChange={handleZonesCsvFile} />
            </label>
            {importFileName && (
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                  <FileUp size={13} /> {importFileName}
                </span>
              </div>
            )}
            {parsedImportRows.length > 0 && (
              <Alert severity="success" className="mt-4">
                <b>{parsedImportRows.length} zone{parsedImportRows.length > 1 ? "s" : ""}</b> prêtes à être importées.
              </Alert>
            )}
            {importError && <Alert severity="error" className="mt-4">{importError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={!parsedImportRows.length || importMutation.isPending}
              className="hover:bg-[#1E6091] hover:opacity-100"
              onClick={async () => {
                if (!parsedImportRows.length) return;
                setImportError(null);
                try { await importMutation.mutateAsync(parsedImportRows); }
                catch (err: any) { setImportError(err?.message ?? "Import impossible."); }
              }}
            >
              {importMutation.isPending ? <Spinner className="size-4" /> : <FileUp size={15} />}
              Lancer l&apos;import ({parsedImportRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
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
    <div>
      {/* Header */}
      <div className="border-b-[3px] border-[#3C8047] px-8 py-5 text-white" style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}>
        <div className="flex items-center gap-3">
          <MapIcon size={30} className="text-[#3C8047]" />
          <div>
            <h1 className="text-2xl font-bold leading-tight text-white">Référentiels</h1>
            <span className="text-xs text-white/55">Zones géographiques</span>
          </div>
        </div>
      </div>

      <ZonesTab />
    </div>
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

