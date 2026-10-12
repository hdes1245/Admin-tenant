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
import { Code, Download, FileUp, MapPin, Pencil, Plus, Search, Shapes, Trash2, X } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { HeaderButton, KpiTile, PageContainer, PageHeader, Panel, Th } from "@/components/ui/page-blocks";

const NAVY  = "#0F3B5C";

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
      <PageHeader icon={<Shapes size={30} />} title="Types de lieux" subtitle="Gérez les catégories de localisation disponibles dans l'application mobile">
        <Tooltip title="Exporter les types de lieux en CSV">
          <HeaderButton onClick={() => downloadCsv(types, [{ key: "code", label: "code" }, { key: "name", label: "name" }, { key: "sort_order", label: "sort_order" }], "types-de-lieux.csv")}>
            <Download size={16} /> Exporter CSV
          </HeaderButton>
        </Tooltip>
        <HeaderButton onClick={() => { setImportDialogOpen(true); setImportError(null); setParsedImportRows([]); setImportFileName(null); }}>
          <FileUp size={16} /> Importer CSV
        </HeaderButton>
        <Button className="bg-[#3C8047] hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreate}>
          <Plus size={16} /> Nouveau type
        </Button>
      </PageHeader>

      <PageContainer>
        {actionError && !deleteTarget && <Alert severity="error" className="mb-4" onClose={() => setActionError(null)}>{actionError}</Alert>}
        {isError && <Alert severity="error" className="mb-4">Impossible de charger les types de lieux.</Alert>}

        {/* KPIs */}
        {!isLoading && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTile label="Total types" value={types.length} accent={NAVY} icon={<Shapes size={22} />} />
          </div>
        )}

        {/* Filter bar */}
        <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
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
            {!isLoading && (
              <span className="text-xs text-muted-foreground">
                {filteredTypes.length} type{filteredTypes.length !== 1 ? "s" : ""}{search ? ` · ${types.length} au total` : ""}
              </span>
            )}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0F3B5C]">
                <Th className="w-14 pl-5">#</Th>
                <Th>Code</Th>
                <Th>Nom affiché</Th>
                <Th className="w-[100px]">Ordre</Th>
                <Th className="w-[88px]" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                      <Spinner className="text-[#1E6091]" /> Chargement...
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && types.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                      <Shapes size={40} className="text-border-strong" />
                      Aucun type de lieu configuré. Créez-en un pour commencer.
                    </div>
                  </td>
                </tr>
              )}
              {filteredTypes.map((t, idx) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: idx * 0.025 }}
                  style={{ display: "table-row" }}
                  className="border-b border-border bg-surface"
                >
                  <td className="py-2.5 pl-5 pr-2 font-mono text-[11px] font-medium text-muted-foreground">#{t.id}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-[5px] border border-border bg-muted px-2.5 py-0.5 font-mono text-xs font-bold text-[#1E6091]">{t.code}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin size={15} className="text-[#3C8047]" /> {t.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.sort_order}</td>
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-1">
                      <Tooltip title="Modifier">
                        <button type="button" aria-label="Modifier" onClick={() => openEdit(t)}
                          className="flex size-[30px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]">
                          <Pencil size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <button type="button" aria-label="Supprimer" onClick={() => { setActionError(null); setDeleteTarget(t); }}
                          className="flex size-[30px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Dialog création / édition */}
        <Dialog open={dialogOpen} onOpenChange={(o) => !o && !saveMutation.isPending && setDialogOpen(false)}>
          <DialogContent size="xs" aria-describedby={undefined}>
            <DialogHeader icon={<Shapes size={18} />}>{editTarget ? "Modifier le type" : "Nouveau type de lieu"}</DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <Field label="Nom affiché *">
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex: Domicile, Commerce, Bureau..." />
              </Field>
              <Field label="Code technique *" help="Identifiant unique, minuscules, sans espaces (utilisé par l'API)">
                <Input className="font-mono" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ex: domicile, commerce, bureau" />
              </Field>
              <Field label="Ordre d'affichage" help="Les types sont triés par ordre croissant">
                <Input type="number" min={0} value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} placeholder="0" />
              </Field>
              {formError && <Alert severity="error">{formError}</Alert>}
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>Annuler</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
                {saveMutation.isPending ? "Enregistrement..." : editTarget ? "Modifier" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Import CSV */}
        <Dialog open={importDialogOpen} onOpenChange={(o) => !o && setImportDialogOpen(false)}>
          <DialogContent size="sm" aria-describedby={undefined}>
            <DialogHeader icon={<FileUp size={20} />}>Importer des types de lieux via CSV</DialogHeader>
            <DialogBody>
              <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Code size={16} /> Format attendu
                </div>
                <code className="mb-3 block rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">code,name,sort_order</code>
                <p className="text-xs leading-8 text-muted-foreground">
                  <b>code</b> — obligatoire (ex: domicile)<br /><b>name</b> — obligatoire (ex: Domicile)<br /><b>sort_order</b> — optionnel, entier (ex: 1)
                </p>
              </div>
              <label className="inline-flex">
                <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted">
                  <FileUp size={15} /> Choisir un fichier CSV
                </span>
                <input type="file" accept=".csv,text/csv" hidden onChange={handleTypesCsvFile} />
              </label>
              {importFileName && (
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                    <FileUp size={13} /> {importFileName}
                  </span>
                </div>
              )}
              {parsedImportRows.length > 0 && (
                <Alert severity="success" className="mt-4"><b>{parsedImportRows.length} type{parsedImportRows.length > 1 ? "s" : ""}</b> prêts à être importés.</Alert>
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

        {/* Dialog confirmation suppression */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleteMutation.isPending && setDeleteTarget(null)}>
          <DialogContent size="xs" accent={false} aria-describedby={undefined}>
            <div className="h-1 bg-red-500" />
            <DialogHeader>Supprimer ce type de lieu ?</DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                Le type <strong className="text-foreground">{deleteTarget?.name}</strong> (code : <code>{deleteTarget?.code}</code>) sera supprimé définitivement.
                Les localisations existantes utilisant ce type ne seront pas affectées.
              </p>
              {actionError && <Alert severity="error" className="mt-4">{actionError}</Alert>}
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Annuler</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
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
