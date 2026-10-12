"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ClipboardList, Copy, ListFilter, MoreVertical, Pencil, Plus, Search, Trash2, Upload, WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  FormTemplate, FormCategory, FormStatus,
  loadForms, saveForm, createForm, duplicateForm, deleteForm,
  CATEGORY_LABELS,
} from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/page-blocks";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const SYSTEM_ID = "system_localiser_client";

const STATUS_CONFIG: Record<FormStatus, { label: string; cls: string }> = {
  published: { label: "Publié",    cls: "bg-emerald-600 text-white" },
  draft:     { label: "Brouillon", cls: "bg-amber-500 text-white" },
  archived:  { label: "Archivé",   cls: "bg-slate-300 text-slate-800" },
};

function FormCard({ form, onEdit, onDuplicate, onDelete, onToggleStatus }: {
  form: FormTemplate;
  onEdit:         () => void;
  onDuplicate:    () => void;
  onDelete:       () => void;
  onToggleStatus: (s: FormStatus) => void;
}) {
  const st       = STATUS_CONFIG[form.status];
  const isSystem = form.id === SYSTEM_ID;
  const outlineBtn = "h-8 flex-none text-xs";

  return (
    <div
      className={`flex h-full flex-col rounded-lg border bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] ${form.status === "published" ? "border-emerald-600/20" : "border-transparent"}`}
    >
      <div className="flex-1 p-4 pb-2">
        <div className="mb-2 flex items-start justify-between">
          <span className="rounded-full bg-[#1E6091]/10 px-2 text-[10px] font-medium leading-5 text-[#1E6091]">{CATEGORY_LABELS[form.category]}</span>
          <div className="flex items-center gap-1">
            {isSystem && <span className="rounded-full bg-[#3C8047]/15 px-2 text-[10px] font-semibold leading-5 text-amber-800">Système</span>}
            <span className={`rounded-full px-2 text-[10px] leading-5 ${st.cls}`}>{st.label}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Actions" className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted">
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onSelect={onEdit} icon={<Pencil size={16} />} title="Modifier" />
                {!isSystem && <DropdownMenuItem onSelect={onDuplicate} icon={<Copy size={16} />} title="Dupliquer" />}
                {!isSystem && <DropdownMenuSeparator />}
                {!isSystem && <DropdownMenuItem onSelect={onDelete} className="text-red-600" icon={<Trash2 size={16} />} title="Supprimer" />}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h3 className="mb-1 text-[15px] font-bold leading-snug text-foreground">{form.name}</h3>
        {form.description && <p className="mb-2 text-xs leading-normal text-muted-foreground">{form.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">{form.fields.length}</strong> champ{form.fields.length !== 1 ? "s" : ""}
          </span>
          {form.submissions > 0 && (
            <span className="text-[11px] text-muted-foreground">
              <strong className="text-emerald-600">{form.submissions}</strong> soumission{form.submissions !== 1 ? "s" : ""}
            </span>
          )}
          {form.offlineSync && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2 text-[10px] leading-[18px] text-violet-800 dark:text-violet-300">
              <WifiOff size={11} /> Hors-ligne
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-4 pt-1">
        <Button size="sm" className="h-8 flex-1 text-xs hover:bg-[#1E6091] hover:opacity-100" onClick={onEdit}>
          <Pencil size={14} /> Modifier
        </Button>
        {!isSystem && form.status === "draft" && (
          <Button size="sm" variant="outline" className={`${outlineBtn} border-emerald-600 text-emerald-600`} onClick={() => onToggleStatus("published")}>
            <Upload size={14} /> Publier
          </Button>
        )}
        {!isSystem && form.status === "published" && (
          <Button size="sm" variant="outline" className={`${outlineBtn} text-muted-foreground`} onClick={() => onToggleStatus("archived")}>
            <Archive size={14} /> Archiver
          </Button>
        )}
        {!isSystem && form.status === "archived" && (
          <Button size="sm" variant="outline" className={`${outlineBtn} text-muted-foreground`} onClick={() => onToggleStatus("draft")}>
            Restaurer
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms]               = useState<FormTemplate[]>([]);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<FormStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<FormTemplate | null>(null);
  const [newDialog, setNewDialog]       = useState(false);
  const [newName, setNewName]           = useState("");
  const [newCategory, setNewCategory]   = useState<FormCategory>("visite");
  const [newDesc, setNewDesc]           = useState("");

  useEffect(() => { setForms(loadForms()); }, []);
  const refresh = useCallback(() => setForms(loadForms()), []);

  const handleCreate = () => {
    const form = createForm({ name: newName.trim() || "Nouveau formulaire", category: newCategory, description: newDesc.trim() });
    saveForm(form);
    setNewDialog(false);
    setNewName(""); setNewDesc(""); setNewCategory("visite");
    router.push(`/forms/builder?id=${form.id}`);
  };

  const handleDelete = (form: FormTemplate) => {
    deleteForm(form.id);
    setDeleteTarget(null);
    refresh();
  };

  const filtered = forms.filter((f) => {
    const matchSearch = search === "" || f.name.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const publishedCount = forms.filter((f) => f.status === "published").length;
  const draftCount     = forms.filter((f) => f.status === "draft").length;
  const totalSub       = forms.reduce((a, f) => a + f.submissions, 0);

  return (
    <>
      <PageHeader icon={<ClipboardList size={28} />} title="Formulaires terrain" subtitle="Créez et gérez vos formulaires de collecte mobile">
        <Button className="bg-[#3C8047] shadow-md hover:bg-[#2A5C34] hover:opacity-100" onClick={() => setNewDialog(true)}>
          <Plus size={16} /> Nouveau formulaire
        </Button>
      </PageHeader>

      <PageContainer>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Formulaires publiés", value: publishedCount, color: "#059669" },
            { label: "Brouillons",          value: draftCount,     color: GOLD      },
            { label: "Total formulaires",   value: forms.length,   color: STEEL     },
            { label: "Soumissions totales", value: totalSub,       color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${s.color}` }}>
              <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative min-w-64">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher un formulaire…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 text-[13px]" />
          </div>
          <div className="flex items-center gap-2">
            <ListFilter size={18} className="text-muted-foreground" />
            <Segmented
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "all", label: "Tous" },
                { value: "published", label: "Publiés" },
                { value: "draft", label: "Brouillons" },
                { value: "archived", label: "Archivés" },
              ]}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={56} className="mx-auto mb-4 text-border" />
            <p className="font-medium text-muted-foreground">
              {search ? "Aucun formulaire ne correspond à votre recherche" : "Aucun formulaire créé"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setNewDialog(true)}>
                <Plus size={16} /> Créer le premier formulaire
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((form, i) => (
              <motion.div key={form.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} style={{ height: "100%" }}>
                <FormCard
                  form={form}
                  onEdit={() => router.push(`/forms/builder?id=${form.id}`)}
                  onDuplicate={() => { const copy = duplicateForm(form); saveForm(copy); refresh(); }}
                  onDelete={() => setDeleteTarget(form)}
                  onToggleStatus={(s) => { saveForm({ ...form, status: s }); refresh(); }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </PageContainer>

      <Dialog open={newDialog} onOpenChange={(o) => !o && setNewDialog(false)}>
        <DialogContent size="sm" accent={false} aria-describedby={undefined}>
          <DialogHeader>Nouveau formulaire</DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <Field label="Nom du formulaire">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Rapport de visite client" />
            </Field>
            <Field label="Catégorie">
              <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value as FormCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description (optionnel)">
              <Textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="À quoi sert ce formulaire ?" />
            </Field>
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setNewDialog(false)}>Annuler</Button>
            <Button className="hover:bg-[#1E6091] hover:opacity-100" onClick={handleCreate}>Créer et ouvrir l&apos;éditeur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader tone="danger">Supprimer le formulaire ?</DialogHeader>
          <DialogBody className="text-sm text-muted-foreground">
            Le formulaire <strong className="text-foreground">{deleteTarget?.name}</strong> sera supprimé définitivement.
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
