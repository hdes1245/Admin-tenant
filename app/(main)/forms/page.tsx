"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Container, Typography, Grid, Card, CardContent, CardActions,
  Button, Chip, IconButton, Menu, MenuItem, Divider,
  TextField, InputAdornment, ToggleButtonGroup, ToggleButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack,
  Select, FormControl, InputLabel,
} from "@mui/material";
import AddIcon           from "@mui/icons-material/Add";
import SearchIcon        from "@mui/icons-material/Search";
import MoreVertIcon      from "@mui/icons-material/MoreVert";
import EditIcon          from "@mui/icons-material/Edit";
import ContentCopyIcon   from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArchiveIcon       from "@mui/icons-material/Archive";
import PublishIcon       from "@mui/icons-material/Publish";
import WifiOffIcon       from "@mui/icons-material/WifiOff";
import AssignmentIcon    from "@mui/icons-material/Assignment";
import FilterListIcon    from "@mui/icons-material/FilterList";
import { motion }        from "framer-motion";
import {
  FormTemplate, FormCategory, FormStatus,
  loadForms, saveForm, createForm, duplicateForm, deleteForm,
  CATEGORY_LABELS,
} from "@/lib/forms";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const SYSTEM_ID = "system_localiser_client";

const STATUS_CONFIG: Record<FormStatus, { label: string; color: "success" | "default" | "error" | "warning" }> = {
  published: { label: "Publié",    color: "success" },
  draft:     { label: "Brouillon", color: "warning" },
  archived:  { label: "Archivé",  color: "default" },
};

function FormCard({ form, onEdit, onDuplicate, onDelete, onToggleStatus }: {
  form: FormTemplate;
  onEdit:         () => void;
  onDuplicate:    () => void;
  onDelete:       () => void;
  onToggleStatus: (s: FormStatus) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const st       = STATUS_CONFIG[form.status];
  const isSystem = form.id === SYSTEM_ID;

  return (
    <Card sx={{
      borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", height: "100%",
      display: "flex", flexDirection: "column",
      border: form.status === "published" ? "1px solid rgba(5,150,105,0.2)" : "1px solid transparent",
      transition: "box-shadow .2s", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.12)" },
    }}>
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Chip label={CATEGORY_LABELS[form.category]} size="small"
            sx={{ fontSize: 10, bgcolor: "rgba(30,96,145,0.08)", color: STEEL, height: 20 }} />
          <Box display="flex" alignItems="center" gap={0.5}>
            {isSystem && (
              <Chip label="Système" size="small"
                sx={{ fontSize: 10, height: 20, bgcolor: "rgba(60,128,71,0.15)", color: "#92400E", fontWeight: 600 }} />
            )}
            <Chip label={st.label} size="small" color={st.color} sx={{ fontSize: 10, height: 20 }} />
            <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 0.3 }}>
              <MoreVertIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        <Typography fontWeight={700} color="var(--text-primary)" fontSize={15} mb={0.5} lineHeight={1.3}>
          {form.name}
        </Typography>
        {form.description && (
          <Typography fontSize={12} color="text.secondary" mb={1} lineHeight={1.5}>
            {form.description}
          </Typography>
        )}

        <Box display="flex" alignItems="center" gap={1.5} mt={1.5} flexWrap="wrap">
          <Typography fontSize={11} color="text.secondary">
            <strong style={{ color: "var(--text-primary)" }}>{form.fields.length}</strong> champ{form.fields.length !== 1 ? "s" : ""}
          </Typography>
          {form.submissions > 0 && (
            <Typography fontSize={11} color="text.secondary">
              <strong style={{ color: "#059669" }}>{form.submissions}</strong> soumission{form.submissions !== 1 ? "s" : ""}
            </Typography>
          )}
          {form.offlineSync && (
            <Chip icon={<WifiOffIcon />} label="Hors-ligne" size="small"
              sx={{ fontSize: 10, height: 18, "& .MuiChip-icon": { fontSize: 11 },
                bgcolor: "rgba(124,58,237,0.08)", color: "#5B21B6" }} />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1 }}>
        <Button size="small" variant="contained" startIcon={<EditIcon sx={{ fontSize: 14 }} />}
          onClick={onEdit}
          sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL }, fontSize: 12, fontWeight: 600, flex: 1 }}>
          Modifier
        </Button>
        {!isSystem && form.status === "draft" && (
          <Button size="small" variant="outlined" startIcon={<PublishIcon sx={{ fontSize: 14 }} />}
            onClick={() => onToggleStatus("published")}
            sx={{ fontSize: 12, borderColor: "#059669", color: "#059669", "&:hover": { bgcolor: "rgba(5,150,105,0.06)" } }}>
            Publier
          </Button>
        )}
        {!isSystem && form.status === "published" && (
          <Button size="small" variant="outlined" startIcon={<ArchiveIcon sx={{ fontSize: 14 }} />}
            onClick={() => onToggleStatus("archived")}
            sx={{ fontSize: 12, borderColor: "rgba(0,0,0,0.2)", color: "text.secondary", "&:hover": { bgcolor: "rgba(0,0,0,0.04)" } }}>
            Archiver
          </Button>
        )}
        {!isSystem && form.status === "archived" && (
          <Button size="small" variant="outlined" onClick={() => onToggleStatus("draft")}
            sx={{ fontSize: 12, borderColor: "rgba(0,0,0,0.2)", color: "text.secondary" }}>
            Restaurer
          </Button>
        )}
      </CardActions>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { onEdit(); setAnchor(null); }}>
          <EditIcon sx={{ fontSize: 16, mr: 1 }} /> Modifier
        </MenuItem>
        {!isSystem && (
          <MenuItem onClick={() => { onDuplicate(); setAnchor(null); }}>
            <ContentCopyIcon sx={{ fontSize: 16, mr: 1 }} /> Dupliquer
          </MenuItem>
        )}
        {!isSystem && [
          <Divider key="div" />,
          <MenuItem key="del" onClick={() => { onDelete(); setAnchor(null); }} sx={{ color: "#DC2626" }}>
            <DeleteOutlineIcon sx={{ fontSize: 16, mr: 1 }} /> Supprimer
          </MenuItem>,
        ]}
      </Menu>
    </Card>
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
      <Box sx={{ background: `linear-gradient(135deg,${NAVY} 0%,${STEEL} 100%)`,
        px: 4, py: 2.5, display: "flex", alignItems: "center", gap: 2,
        borderBottom: `3px solid ${GOLD}` }}>
        <AssignmentIcon sx={{ color: GOLD, fontSize: 28 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700} color="white">Formulaires terrain</Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.55)">
            Créez et gérez vos formulaires de collecte mobile
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}
          sx={{ bgcolor: GOLD, color: "var(--text-primary)", fontWeight: 700, "&:hover": { bgcolor: "#A07820" }, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
          Nouveau formulaire
        </Button>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Formulaires publiés", value: publishedCount, color: "#059669" },
            { label: "Brouillons",          value: draftCount,     color: GOLD      },
            { label: "Total formulaires",   value: forms.length,   color: STEEL     },
            { label: "Soumissions totales", value: totalSub,       color: "#7c3aed" },
          ].map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", borderLeft: `4px solid ${s.color}` }}>
                <Typography fontSize={24} fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography fontSize={12} color="text.secondary">{s.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <TextField size="small" placeholder="Rechercher un formulaire…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
            sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { fontSize: 13 } }} />
          <Box display="flex" alignItems="center" gap={0.8}>
            <FilterListIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <ToggleButtonGroup value={filterStatus} exclusive size="small"
              onChange={(_, v) => { if (v) setFilterStatus(v); }}
              sx={{ "& .MuiToggleButton-root": { fontSize: 12, px: 1.5, py: 0.5 } }}>
              <ToggleButton value="all">Tous</ToggleButton>
              <ToggleButton value="published">Publiés</ToggleButton>
              <ToggleButton value="draft">Brouillons</ToggleButton>
              <ToggleButton value="archived">Archivés</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {filtered.length === 0 ? (
          <Box textAlign="center" py={8}>
            <AssignmentIcon sx={{ fontSize: 56, color: "var(--border)", mb: 2 }} />
            <Typography color="text.secondary" fontWeight={500}>
              {search ? "Aucun formulaire ne correspond à votre recherche" : "Aucun formulaire créé"}
            </Typography>
            {!search && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDialog(true)} sx={{ mt: 2, bgcolor: NAVY }}>
                Créer le premier formulaire
              </Button>
            )}
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {filtered.map((form, i) => (
              <Grid item xs={12} sm={6} lg={4} key={form.id}>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} style={{ height: "100%" }}>
                  <FormCard
                    form={form}
                    onEdit={() => router.push(`/forms/builder?id=${form.id}`)}
                    onDuplicate={() => { const copy = duplicateForm(form); saveForm(copy); refresh(); }}
                    onDelete={() => setDeleteTarget(form)}
                    onToggleStatus={(s) => { saveForm({ ...form, status: s }); refresh(); }}
                  />
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: "var(--text-primary)", pb: 1 }}>Nouveau formulaire</DialogTitle>
        <DialogContent>
          <Stack gap={2.5} mt={1}>
            <TextField label="Nom du formulaire" fullWidth size="small" value={newName}
              onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Rapport de visite client"
              sx={{ "& label": { fontSize: 13 }, "& input": { fontSize: 13 } }} />
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: 13 }}>Catégorie</InputLabel>
              <Select value={newCategory} label="Catégorie" onChange={(e) => setNewCategory(e.target.value as FormCategory)} sx={{ fontSize: 13 }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k} sx={{ fontSize: 13 }}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Description (optionnel)" fullWidth size="small" multiline rows={2}
              value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="À quoi sert ce formulaire ?"
              sx={{ "& label": { fontSize: 13 }, "& textarea": { fontSize: 13 } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setNewDialog(false)} sx={{ color: "text.secondary" }}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate}
            sx={{ bgcolor: NAVY, "&:hover": { bgcolor: STEEL }, fontWeight: 600 }}>
            Créer et ouvrir l&apos;éditeur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: "#DC2626" }}>Supprimer le formulaire ?</DialogTitle>
        <DialogContent>
          <Typography fontSize={14} color="text.secondary">
            Le formulaire <strong style={{ color: "var(--text-primary)" }}>{deleteTarget?.name}</strong> sera supprimé définitivement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Annuler</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
