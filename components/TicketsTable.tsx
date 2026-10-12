"use client";

import { TicketDto, TicketStatus } from "@/lib/tickets";
import {
  ArrowDown, ArrowUp, Bug, CircleCheck, Circle, Hourglass, Lock, MoveUp, Maximize2, Search, ChevronsUpDown, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "./PaginationBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Panel } from "@/components/ui/page-blocks";

const STEEL = "#1E6091";

const STANDARD_CATEGORIES = [
  "Connexion & Accès",
  "Synchronisation",
  "Performance & Lenteur",
  "Crash & Plantage",
  "Géolocalisation & GPS",
  "Carte & Affichage",
  "Clients & Données",
  "Photos & Médias",
  "Rapports & Exports",
  "Notifications",
  "Sécurité & Compte",
  "Réseau & Connectivité",
  "Installation & Mise à jour",
  "Paiement & Facturation",
  "Autre",
];

interface TicketsTableProps {
  tickets: TicketDto[];
  loading?: boolean;
  onChangeStatus?: (ticket: TicketDto) => void;
  onEscalate?: (ticket: TicketDto) => void;
}

type StatusCfg = {
  label: string;
  dot: string;
  icon: React.ReactNode;
};

const STATUS_CFG: Record<TicketStatus, StatusCfg> = {
  open:          { label: "Ouvert",           dot: "#f59e0b", icon: <Circle size={13} /> },
  in_progress:   { label: "En cours",         dot: STEEL,     icon: <Hourglass size={13} /> },
  waiting_user:  { label: "Att. utilisateur", dot: "#7c3aed", icon: <Hourglass size={13} /> },
  resolved:      { label: "Resolu",           dot: "#22c55e", icon: <CircleCheck size={13} /> },
  closed:        { label: "Ferme",            dot: "#94A3B8", icon: <Lock size={13} /> },
};

const SEVERITY_ORDER: Record<string, number> = { urgent: 0, eleve: 1, moyen: 2, faible: 3 };

function severityLabel(s: string): { label: string; color: string } {
  switch (s.toLowerCase()) {
    case "urgent": return { label: "Urgent", color: "#b91c1c" };
    case "eleve":  return { label: "Eleve",  color: "#c2410c" };
    case "moyen":  return { label: "Moyen",  color: "#b45309" };
    case "faible": return { label: "Faible", color: "#64748b" };
    default:       return { label: s,        color: "#64748b" };
  }
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function userInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

type SortKey = "id" | "title" | "severity" | "status" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={13} className="ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp size={13} className="ml-1 text-[#3C8047]" />
    : <ArrowDown size={13} className="ml-1 text-[#3C8047]" />;
}

export function TicketsTable({ tickets, loading, onChangeStatus, onEscalate }: TicketsTableProps) {
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus]     = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortKey, setSortKey]         = useState<SortKey>("createdAt");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(20);

  const categories = STANDARD_CATEGORIES;

  const activeFilterCount = [filterStatus, filterSeverity, filterCategory].filter((v) => v !== "all").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterSeverity !== "all" && t.severity !== filterSeverity) return false;
      if (filterCategory !== "all" && (t.category ?? "") !== filterCategory) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.requesterName ?? "").toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        t.severity.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, search, filterStatus, filterSeverity, filterCategory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id":        cmp = a.id - b.id; break;
        case "title":     cmp = a.title.localeCompare(b.title); break;
        case "severity":  cmp = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9); break;
        case "status":    cmp = a.status.localeCompare(b.status); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterSeverity, filterCategory, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setSearch("");
    setFilterStatus("all");
    setFilterSeverity("all");
    setFilterCategory("all");
  }

  const selectCls = "h-9 w-auto text-[13px]";

  const colHeader = (label: string, key?: SortKey, first?: boolean) => (
    <th
      onClick={key ? () => handleSort(key) : undefined}
      className={`select-none whitespace-nowrap py-3.5 text-left text-[10.5px] font-semibold uppercase tracking-[1px] ${first ? "pl-6" : "pl-4"} ${
        sortKey === key ? "text-white/95" : "text-white/55"
      } ${key ? "cursor-pointer hover:text-white/90" : ""}`}
    >
      <span className="flex items-center">
        {label}
        {key && <SortIcon active={sortKey === key} dir={sortDir} />}
      </span>
    </th>
  );

  return (
    <div>
      {/* Barre de recherche + filtres */}
      <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par titre, demandeur..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-9" />
            {search && (
              <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted">
                <X size={16} />
              </button>
            )}
          </div>
          <Select aria-label="Statut" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="all">Tous les statuts</option>
            {(Object.entries(STATUS_CFG) as [TicketStatus, StatusCfg][]).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </Select>
          <Select aria-label="Sévérité" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className={selectCls}>
            <option value="all">Toutes les sévérités</option>
            <option value="urgent">Urgent</option>
            <option value="eleve">Elevé</option>
            <option value="moyen">Moyen</option>
            <option value="faible">Faible</option>
          </Select>
          <Select aria-label="Catégorie" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${selectCls} min-w-44`}>
            <option value="all">Toutes les catégories</option>
            {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </Select>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" className="font-medium text-muted-foreground" onClick={clearFilters}>
              <X size={15} /> Effacer ({activeFilterCount})
            </Button>
          )}
        </div>
        <div className="mt-3 flex items-center border-t border-border pt-2 text-xs text-muted-foreground">
          {sorted.length} ticket{sorted.length !== 1 ? "s" : ""}{sorted.length !== tickets.length ? ` sur ${tickets.length} au total` : ""}
        </div>
      </Panel>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        <Panel className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0F3B5C]">
                {colHeader("Ticket", "title", true)}
                {colHeader("Demandeur")}
                {colHeader("Sévérité", "severity")}
                {colHeader("Statut", "status")}
                {colHeader("Réponse IT")}
                {colHeader("Date", "createdAt")}
                <th className="w-20 pr-5" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                      <Spinner className="text-[#1E6091]" /> Chargement des tickets...
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong"><Bug size={24} /></span>
                      <span className="text-sm text-muted-foreground">Aucun ticket ne correspond aux filtres.</span>
                      {activeFilterCount > 0 && (
                        <button type="button" onClick={clearFilters} className="cursor-pointer border-0 bg-transparent text-xs text-[#1E6091] underline">
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((ticket, idx) => {
                  const sc = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;
                  const sv = severityLabel(ticket.severity);
                  const cell = "border-b border-border bg-surface pl-4 py-2.5";
                  return (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      style={{ display: "table-row", cursor: onChangeStatus ? "pointer" : "default" }}
                      onClick={() => onChangeStatus?.(ticket)}
                    >
                      <td className="max-w-[260px] border-b border-border bg-surface py-2.5 pl-6">
                        <div className="truncate text-sm font-semibold leading-tight text-foreground">#{ticket.id} — {ticket.title}</div>
                        {ticket.category && <div className="text-xs text-muted-foreground">{ticket.category}</div>}
                      </td>

                      <td className={cell}>
                        {ticket.requesterName ? (
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0F3B5C] text-[11px] font-bold text-white">
                              {userInitials(ticket.requesterName)}
                            </span>
                            <div>
                              <div className="text-sm font-semibold leading-tight text-foreground">{ticket.requesterName}</div>
                              {ticket.requesterEmail && <div className="text-xs text-muted-foreground">{ticket.requesterEmail}</div>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-border-strong">—</span>
                        )}
                      </td>

                      <td className={cell}><span className="text-[11px] font-bold" style={{ color: sv.color }}>{sv.label}</span></td>

                      <td className={cell}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: sc.dot }} />
                          <span className="text-[11.5px] font-semibold text-foreground">{sc.label}</span>
                        </span>
                      </td>

                      <td className={`${cell} max-w-[240px]`}>
                        {ticket.itResponse ? (
                          <Tooltip title={ticket.itResponse}>
                            <span className="block max-w-[200px] truncate text-xs text-muted-foreground">{ticket.itResponse}</span>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-border-strong">—</span>
                        )}
                      </td>

                      <td className={cell}><span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span></td>

                      <td className="border-b border-border bg-surface py-2.5 pl-4 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {onChangeStatus && (
                            <Tooltip title="Ouvrir la conversation">
                              <button
                                type="button"
                                aria-label="Ouvrir la conversation"
                                onClick={(e) => { e.stopPropagation(); onChangeStatus(ticket); }}
                                className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-border-strong hover:bg-blue-50 hover:text-[#1E6091]"
                              >
                                <Maximize2 size={16} />
                              </button>
                            </Tooltip>
                          )}
                          {onEscalate && (
                            <Tooltip title={ticket.escalated ? "Déjà escaladé — voir la discussion GeoTrust" : "Escalader vers GeoTrust"}>
                              <button
                                type="button"
                                aria-label="Escalader vers GeoTrust"
                                onClick={(e) => { e.stopPropagation(); onEscalate(ticket); }}
                                className={`cursor-pointer rounded-full border-0 p-1.5 ${
                                  ticket.escalated
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                    : "bg-transparent text-border-strong hover:bg-amber-100 hover:text-amber-800"
                                }`}
                              >
                                <MoveUp size={16} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {!loading && sorted.length > 0 && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={sorted.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </motion.div>
    </div>
  );
}
