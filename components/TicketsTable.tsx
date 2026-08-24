"use client";

import { TicketDto, TicketStatus } from "@/lib/tickets";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import BugReportIcon from "@mui/icons-material/BugReport";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockIcon from "@mui/icons-material/Lock";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import NorthIcon from "@mui/icons-material/North";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "./PaginationBar";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";

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
  open:          { label: "Ouvert",           dot: "#f59e0b", icon: <RadioButtonUncheckedIcon sx={{ fontSize: 13 }} /> },
  in_progress:   { label: "En cours",         dot: STEEL,     icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} /> },
  waiting_user:  { label: "Att. utilisateur", dot: "#7c3aed", icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} /> },
  resolved:      { label: "Resolu",           dot: "#22c55e", icon: <CheckCircleOutlineIcon sx={{ fontSize: 13 }} /> },
  closed:        { label: "Ferme",            dot: "#94A3B8", icon: <LockIcon sx={{ fontSize: 13 }} /> },
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
  if (!active) return <UnfoldMoreIcon sx={{ fontSize: 13, opacity: 0.4, ml: 0.5 }} />;
  return dir === "asc"
    ? <ArrowUpwardIcon sx={{ fontSize: 13, ml: 0.5, color: "#C49A2E" }} />
    : <ArrowDownwardIcon sx={{ fontSize: 13, ml: 0.5, color: "#C49A2E" }} />;
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

  const selectSx = {
    height: 36,
    fontSize: 13,
    borderRadius: 2,
    bgcolor: "#F8FAFC",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 },
  };

  const colHeader = (label: string, key?: SortKey, pl?: number) => (
    <TableCell
      onClick={key ? () => handleSort(key) : undefined}
      sx={{
        bgcolor: NAVY,
        color: sortKey === key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
        fontWeight: 600,
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: 1,
        borderBottom: "none",
        py: 1.75,
        pl: pl ?? undefined,
        cursor: key ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        "&:hover": key ? { color: "rgba(255,255,255,0.9)" } : {},
      }}
    >
      <Box display="flex" alignItems="center">
        {label}
        {key && <SortIcon active={sortKey === key} dir={sortDir} />}
      </Box>
    </TableCell>
  );

  return (
    <Box>
      {/* Barre de recherche + filtres */}
      <Paper elevation={0} sx={{ border: "1px solid #E2E8F0", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "white", boxShadow: "0 1px 4px rgba(13,27,42,0.04)" }}>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Rechercher par titre, demandeur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              flex: 1, minWidth: 240,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2, bgcolor: "#F8FAFC", transition: "background .15s",
                "&:hover": { bgcolor: "white" },
                "&.Mui-focused": { bgcolor: "white" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 },
              },
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#94A3B8", fontSize: 18 }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
            }}
          />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} size="small" displayEmpty sx={selectSx}>
            <MenuItem value="all">Tous les statuts</MenuItem>
            {(Object.entries(STATUS_CFG) as [TicketStatus, StatusCfg][]).map(([val, cfg]) => (
              <MenuItem key={val} value={val}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
          <Select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} size="small" displayEmpty sx={selectSx}>
            <MenuItem value="all">Toutes les sévérités</MenuItem>
            {[
              { value: "urgent", label: "Urgent", color: "#b91c1c" },
              { value: "eleve",  label: "Elevé",  color: "#c2410c" },
              { value: "moyen",  label: "Moyen",  color: "#b45309" },
              { value: "faible", label: "Faible", color: "#64748b" },
            ].map((s) => (
              <MenuItem key={s.value} value={s.value}>
                <Typography sx={{ fontWeight: 600, color: s.color, fontSize: 13 }}>{s.label}</Typography>
              </MenuItem>
            ))}
          </Select>
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} size="small" displayEmpty sx={{ ...selectSx, minWidth: 180 }}>
            <MenuItem value="all">Toutes les catégories</MenuItem>
            {categories.map((cat) => (<MenuItem key={cat} value={cat}>{cat}</MenuItem>))}
          </Select>
          {activeFilterCount > 0 && (
            <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={clearFilters}
              sx={{ fontWeight: 500, borderRadius: 2, color: "#64748B", fontSize: 13, "&:hover": { bgcolor: "#F1F5F9" } }}>
              Effacer ({activeFilterCount})
            </Button>
          )}
        </Box>
        <Box display="flex" alignItems="center" mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }}>
          <Typography variant="caption" color="text.secondary">
            {sorted.length} ticket{sorted.length !== 1 ? "s" : ""}{sorted.length !== tickets.length ? ` sur ${tickets.length} au total` : ""}
          </Typography>
        </Box>
      </Paper>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ borderRadius: 2.5, border: "1px solid #E2E8F0", overflow: "hidden" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {colHeader("Ticket",     "title",     3)}
                {colHeader("Demandeur")}
                {colHeader("Sévérité",  "severity")}
                {colHeader("Statut",    "status")}
                {colHeader("Réponse IT")}
                {colHeader("Date",      "createdAt")}
                <TableCell sx={{ bgcolor: NAVY, borderBottom: "none", pr: 2.5, width: 80 }} />
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
                      <CircularProgress size={18} sx={{ color: STEEL }} />
                      <Typography variant="body2" color="text.secondary">Chargement des tickets...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                      <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BugReportIcon sx={{ fontSize: 24, color: "#CBD5E1" }} />
                      </Box>
                      <Typography variant="body2" color="text.disabled">
                        Aucun ticket ne correspond aux filtres.
                      </Typography>
                      {activeFilterCount > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: STEEL, cursor: "pointer", textDecoration: "underline" }}
                          onClick={clearFilters}
                        >
                          Réinitialiser les filtres
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((ticket, idx) => {
                  const sc = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;
                  const sv = severityLabel(ticket.severity);
                  return (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      style={{ display: "table-row", cursor: onChangeStatus ? "pointer" : "default" }}
                      onClick={() => onChangeStatus?.(ticket)}
                    >
                      <TableCell sx={{ pl: 3, maxWidth: 260, borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3, color: NAVY }} noWrap>
                          #{ticket.id} — {ticket.title}
                        </Typography>
                        {ticket.category && (
                          <Typography variant="caption" color="text.secondary">{ticket.category}</Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        {ticket.requesterName ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: NAVY }}>
                              {userInitials(ticket.requesterName)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2, color: NAVY }}>{ticket.requesterName}</Typography>
                              {ticket.requesterEmail && (
                                <Typography variant="caption" color="text.secondary">{ticket.requesterEmail}</Typography>
                              )}
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: "#CBD5E1" }}>—</Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: sv.color }}>
                          {sv.label}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: sc.dot, flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11.5, color: "#334155" }}>
                            {sc.label}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ maxWidth: 240, borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        {ticket.itResponse ? (
                          <Tooltip title={ticket.itResponse} arrow placement="top">
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200, fontSize: 12 }}>
                              {ticket.itResponse}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" sx={{ color: "#CBD5E1" }}>—</Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ borderBottom: "1px solid #F1F5F9", bgcolor: "white" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                          {formatDate(ticket.createdAt)}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ pr: 2, borderBottom: "1px solid #F1F5F9", bgcolor: "white" }} onClick={(e) => e.stopPropagation()}>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {onChangeStatus && (
                            <Tooltip title="Ouvrir la conversation">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onChangeStatus(ticket); }} sx={{ color: "#CBD5E1", "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}>
                                <OpenInFullIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onEscalate && (
                            <Tooltip title={ticket.escalated ? "Déjà escaladé — voir la discussion GeoTrust" : "Escalader vers GeoTrust"}>
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); onEscalate(ticket); }}
                                sx={ticket.escalated
                                  ? { color: "#92400E", bgcolor: "#FEF3C7", "&:hover": { bgcolor: "#FDE68A" } }
                                  : { color: "#CBD5E1", "&:hover": { color: "#92400E", bgcolor: "#FEF3C7" } }
                                }
                              >
                                <NorthIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </motion.tr>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

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
    </Box>
  );
}
