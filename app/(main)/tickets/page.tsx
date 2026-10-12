"use client";

import { TicketsTable } from "@/components/TicketsTable";
import { TicketConversationDialog } from "@/components/TicketConversationDialog";
import { EscalationDialog } from "@/components/EscalationDialog";
import { TicketStatsDialog } from "@/components/TicketStatsDialog";
import {
  TicketDto,
  createTicket,
  fetchTenantTickets,
  fetchMyItTickets,
} from "@/lib/tickets";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bug, CircleCheck, Circle, Download, Hourglass, Lock, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Tooltip } from "@/components/ui/tooltip";
import { TabBar } from "@/components/ui/tabs";
import { HeaderButton, KpiTile, PageContainer, PageHeader } from "@/components/ui/page-blocks";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const STANDARD_CATEGORIES = [
  { label: "Connexion & Acces",        icon: "🔐" },
  { label: "Synchronisation",          icon: "🔄" },
  { label: "Performance & Lenteur",    icon: "⚡" },
  { label: "Crash & Plantage",         icon: "💥" },
  { label: "Geolocalisation & GPS",    icon: "📍" },
  { label: "Carte & Affichage",        icon: "🗺️" },
  { label: "Clients & Donnees",        icon: "👥" },
  { label: "Photos & Medias",          icon: "📷" },
  { label: "Rapports & Exports",       icon: "📄" },
  { label: "Notifications",            icon: "🔔" },
  { label: "Securite & Compte",        icon: "🛡️" },
  { label: "Reseau & Connectivite",    icon: "📶" },
  { label: "Installation & Mise a jour", icon: "⬇️" },
  { label: "Paiement & Facturation",   icon: "🧾" },
  { label: "Autre",                    icon: "❓" },
];

const SEVERITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "#DC2626" },
  { value: "eleve",  label: "Eleve",  color: "#D97706" },
  { value: "moyen",  label: "Moyen",  color: "#EAB308" },
  { value: "faible", label: "Faible", color: "#94A3B8" },
];

function statusKpi(tickets: TicketDto[]) {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };
}

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"users" | "mine">("users");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [conversationTicket, setConversationTicket] = useState<TicketDto | null>(null);
  const [escalationTicket, setEscalationTicket]     = useState<TicketDto | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  // Champs du formulaire de création
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ title: false, description: false, severity: false, category: false });

  const [actionError, setActionError] = useState<string | null>(null);

  const { data: tickets = [], isLoading, isError, error } = useQuery({
    queryKey: ["tickets-tenant"],
    queryFn: fetchTenantTickets,
  });

  const { data: myItTickets = [], isLoading: myItLoading } = useQuery({
    queryKey: ["tickets-my-it"],
    queryFn: fetchMyItTickets,
  });

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-my-it"] });
    },
  });

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tickets]
  );

  const kpi = useMemo(() => statusKpi(tickets), [tickets]);

  const openCreate = () => {
    setTitle(""); setDescription(""); setSeverity(null); setCategory(null);
    setCreateError(null); setFieldErrors({ title: false, description: false, severity: false, category: false });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    const tErr = !title.trim();
    const dErr = !description.trim();
    const sErr = !severity;
    const cErr = !category;
    if (tErr || dErr || sErr || cErr) {
      setFieldErrors({ title: tErr, description: dErr, severity: sErr, category: cErr });
      setCreateError("Veuillez renseigner tous les champs obligatoires.");
      return;
    }
    setCreateError(null); setActionError(null);
    try {
      await createMutation.mutateAsync({ title, description, severity: severity!, category });
      setCreateDialogOpen(false);
      setTab("mine");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Creation impossible.");
    }
  };

  const KPI_DATA = [
    { label: "Total", value: kpi.total, accent: "#64748b", icon: <Bug size={18} /> },
    { label: "Ouverts", value: kpi.open, accent: "#d97706", icon: <Circle size={18} /> },
    { label: "En cours", value: kpi.in_progress, accent: STEEL, icon: <Hourglass size={18} /> },
    { label: "Resolus", value: kpi.resolved, accent: "#16a34a", icon: <CircleCheck size={18} /> },
    { label: "Fermes", value: kpi.closed, accent: "#94A3B8", icon: <Lock size={18} /> },
  ];

  const errCls = "text-xs text-red-600";
  const sectionLabel = (err: boolean) => `mb-2 block text-xs font-bold uppercase tracking-[0.8px] ${err ? "text-red-600" : "text-muted-foreground"}`;

  return (
    <>
      <PageHeader icon={<Bug size={30} />} title="Tickets IT" subtitle="Suivi des incidents, demandes et resolutions pour votre tenant">
        <div className="flex flex-wrap gap-3">
          <HeaderButton onClick={() => setStatsOpen(true)}>
            <BarChart3 size={16} /> Statistiques
          </HeaderButton>
          <Tooltip title="Exporter les tickets en CSV">
            <HeaderButton
              onClick={() => downloadCsv(
                sortedTickets,
                [{ key: "id", label: "Id" }, { key: "title", label: "Titre" }, { key: "description", label: "Description" }, { key: "severity", label: "Severite" }, { key: "status", label: "Statut" }, { key: "category", label: "Categorie" }, { key: "createdAt", label: "Date creation" }, { key: "requesterName", label: "Demandeur" }, { key: "requesterEmail", label: "Email demandeur" }, { key: "itResponse", label: "Reponse IT" }],
                "tickets-it.csv"
              )}
            >
              <Download size={16} /> Exporter CSV
            </HeaderButton>
          </Tooltip>
          <Button className="bg-[#3C8047] shadow-lg hover:bg-[#2A5C34] hover:opacity-100" onClick={openCreate}>
            <Plus size={16} /> Creer un ticket
          </Button>
        </div>
      </PageHeader>

      <PageContainer>
        {!isLoading && tickets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {KPI_DATA.map((k, i) => (
                <KpiTile key={i} label={k.label} value={k.value} accent={k.accent} icon={k.icon} />
              ))}
            </div>
          </motion.div>
        )}

        {isError && <Alert severity="error" className="mb-6">Impossible de charger les tickets. {error instanceof Error ? error.message : null}</Alert>}
        {actionError && <Alert severity="error" className="mb-6">{actionError}</Alert>}

        {/* Onglets */}
        <div className="mb-6 border-b border-border">
          <TabBar
            value={tab === "users" ? 0 : 1}
            onChange={(i) => setTab(i === 0 ? "users" : "mine")}
            tabs={[
              <span key="u" className="flex items-center gap-2">
                Tickets utilisateurs
                <span className={`rounded-full px-2 text-[11px] font-bold leading-5 ${tab === "users" ? "bg-[#0F3B5C] text-white" : "bg-slate-200 text-slate-600"}`}>{sortedTickets.length}</span>
              </span>,
              <span key="m" className="flex items-center gap-2">
                Mes tickets & escaladés
                {myItTickets.length > 0 && (
                  <span className={`rounded-full px-2 text-[11px] font-bold leading-5 ${tab === "mine" ? "bg-[#3C8047] text-white" : "bg-amber-100 text-amber-800"}`}>{myItTickets.length}</span>
                )}
              </span>,
            ]}
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          {tab === "users" ? (
            <TicketsTable
              tickets={sortedTickets}
              loading={isLoading}
              onChangeStatus={(ticket) => setConversationTicket(ticket)}
              onEscalate={(ticket) => setEscalationTicket(ticket)}
            />
          ) : (
            <>
              {myItTickets.length === 0 && !myItLoading ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Bug size={48} className="mx-auto mb-4 opacity-40" />
                  <div className="font-semibold">Aucun ticket personnel ni escaladé</div>
                  <div className="mt-1 text-sm">Creez un ticket IT ou escaladez un ticket utilisateur pour le voir ici.</div>
                </div>
              ) : (
                <TicketsTable
                  tickets={[...myItTickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                  loading={myItLoading}
                  onChangeStatus={(ticket) => setConversationTicket(ticket)}
                  onEscalate={(ticket) => setEscalationTicket(ticket)}
                />
              )}
            </>
          )}
        </motion.div>
      </PageContainer>

      {/* Stats dialog */}
      <TicketStatsDialog
        tickets={sortedTickets}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />

      {/* Conversation dialog */}
      <TicketConversationDialog
        ticket={conversationTicket}
        open={!!conversationTicket}
        onClose={() => setConversationTicket(null)}
      />

      {/* Escalation dialog */}
      <EscalationDialog
        ticket={escalationTicket}
        open={!!escalationTicket}
        onClose={() => setEscalationTicket(null)}
      />

      {/* Create ticket dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(o) => !o && setCreateDialogOpen(false)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader icon={<Bug size={20} />}>Creer un ticket IT</DialogHeader>
          <DialogBody className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto">
            {/* Catégorie */}
            <div>
              <span className={sectionLabel(fieldErrors.category)}>Categorie *</span>
              <div className="grid grid-cols-3 gap-2">
                {STANDARD_CATEGORIES.map((cat) => {
                  const selected = category === cat.label;
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => { setCategory(cat.label); setFieldErrors((e) => ({ ...e, category: false })); }}
                      className={`cursor-pointer rounded-lg border-[1.5px] p-2 text-center transition-all hover:border-[#0F3B5C] ${
                        selected
                          ? "border-[#0F3B5C] bg-[#0F3B5C]"
                          : `bg-surface hover:bg-muted ${fieldErrors.category ? "border-red-600" : "border-border"}`
                      }`}
                    >
                      <div className="mb-0.5 text-lg leading-none">{cat.icon}</div>
                      <div className={`text-[10px] leading-tight ${selected ? "font-bold text-white" : "font-medium text-foreground"}`}>{cat.label}</div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.category && <span className={`${errCls} mt-1 block`}>Veuillez choisir une categorie</span>}
            </div>

            {/* Titre */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Titre *</span>
              <Input
                value={title}
                aria-invalid={fieldErrors.title}
                className={fieldErrors.title ? "border-red-600" : ""}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((er) => ({ ...er, title: false })); }}
                placeholder="ex: Probleme de connexion a l'application"
              />
              {fieldErrors.title && <span className={`${errCls} mt-1 block`}>Le titre est obligatoire</span>}
            </label>

            {/* Description */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Description *</span>
              <Textarea
                rows={4}
                value={description}
                aria-invalid={fieldErrors.description}
                className={fieldErrors.description ? "border-red-600" : ""}
                onChange={(e) => { setDescription(e.target.value); setFieldErrors((er) => ({ ...er, description: false })); }}
                placeholder="Decrivez le probleme rencontre en detail"
              />
              {fieldErrors.description && <span className={`${errCls} mt-1 block`}>La description est obligatoire</span>}
            </label>

            {/* Sévérité */}
            <div>
              <span className={sectionLabel(fieldErrors.severity)}>Severite *</span>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_OPTIONS.map((opt) => {
                  const sel = severity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSeverity(opt.value); setFieldErrors((e) => ({ ...e, severity: false })); }}
                      className="h-8 cursor-pointer rounded-full px-4 text-[13px] font-bold transition-colors"
                      style={{
                        background: sel ? opt.color : "transparent",
                        color: sel ? "white" : opt.color,
                        border: `2px solid ${sel ? opt.color : fieldErrors.severity ? "#DC2626" : opt.color + "60"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.severity && <span className={`${errCls} mt-1 block`}>Veuillez choisir un niveau de severite</span>}
            </div>

            {createError && <Alert severity="error">{createError}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="hover:bg-[#1E6091] hover:opacity-100">
              {createMutation.isPending ? "Creation..." : "Creer le ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
