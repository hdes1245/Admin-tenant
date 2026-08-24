"use client";

import { Agence, AgenceStats } from "@/lib/agences";
import {
  Avatar, Box, Checkbox, Chip, CircularProgress, IconButton,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BusinessIcon from "@mui/icons-material/Business";
import MapIcon from "@mui/icons-material/Map";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { PaginationBar } from "./PaginationBar";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

interface AgencesTableProps {
  agences: Agence[];
  loading?: boolean;
  onEdit?: (agence: Agence) => void;
  onDelete?: (agence: Agence) => void;
  selectedIds?: number[];
  onToggleSelect?: (agenceId: number) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: number[]) => void;
  stats?: Map<number, AgenceStats>;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export function AgencesTable({
  agences,
  loading,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  stats,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: AgencesTableProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const totalPages = Math.max(1, Math.ceil(agences.length / pageSize));
  const paginated = agences.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = useMemo(() => paginated.map((a) => a.id), [paginated]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  const COLS = ["Code agence", "Nom de l'agence", "Zone", "Clients", "CAFs", "Utilisateurs", ""];

  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ bgcolor: NAVY, pl: 2, borderBottom: "none", width: 48 }}>
                  <Checkbox
                    size="small"
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked, visibleIds)}
                    sx={{ color: "rgba(255,255,255,0.35)", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: GOLD }, padding: "4px" }}
                  />
                </TableCell>
                <TableCell sx={{ bgcolor: NAVY, borderBottom: "none", width: 52, pl: 2 }} />
                {COLS.map((label, i) => (
                  <TableCell key={i} align={i === COLS.length - 1 ? "right" : i >= 3 && i <= 5 ? "center" : "left"}
                    sx={{ bgcolor: NAVY, color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, borderBottom: "none", py: 1.75, pr: i === COLS.length - 1 ? 2.5 : undefined }}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={COLS.length + 2} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
                      <CircularProgress size={18} sx={{ color: STEEL }} />
                      <Typography variant="body2" color="text.secondary">Chargement des agences...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS.length + 2} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                      <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BusinessIcon sx={{ fontSize: 24, color: "#CBD5E1" }} />
                      </Box>
                      <Typography variant="body2" color="text.disabled">Aucune agence trouvee.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((agence, idx) => {
                  const isSelected = selectedSet.has(agence.id);
                  const s = stats?.get(agence.id);
                  const bg = isSelected ? "#F0F6FF" : "white";
                  const cellSx = { bgcolor: bg, borderBottom: "1px solid #F1F5F9" };
                  return (
                    <motion.tr key={agence.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: idx * 0.015 }} style={{ display: "table-row" }}>
                      <TableCell padding="checkbox" sx={{ pl: 2, ...cellSx, borderLeft: isSelected ? `3px solid ${STEEL}` : "3px solid transparent", transition: "all 0.12s" }}>
                        <Checkbox size="small" checked={isSelected} onChange={() => onToggleSelect?.(agence.id)} sx={{ "&.Mui-checked": { color: STEEL }, padding: "4px" }} />
                      </TableCell>

                      <TableCell sx={{ ...cellSx, pl: 2 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: NAVY, fontSize: 13, fontWeight: 700 }}>
                          {agence.name?.charAt(0).toUpperCase() ?? "?"}
                        </Avatar>
                      </TableCell>

                      <TableCell sx={cellSx}>
                        <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: STEEL, letterSpacing: 0.3 }}>{agence.code}</Typography>
                        </Box>
                      </TableCell>

                      <TableCell sx={cellSx}>
                        <Typography variant="body2" fontWeight={600} sx={{ color: NAVY }}>{agence.name}</Typography>
                      </TableCell>

                      <TableCell sx={cellSx}>
                        {agence.zoneName ? (
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <MapIcon sx={{ fontSize: 14, color: "#94A3B8" }} />
                            <Typography variant="body2" sx={{ color: "#334155", fontSize: 13 }}>{agence.zoneName}</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: "#CBD5E1" }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Stats columns */}
                      {[
                        { icon: <PeopleOutlineIcon sx={{ fontSize: 13 }} />, val: s?.nbClients, color: STEEL },
                        { icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 13 }} />, val: s?.nbCafs, color: "#7c3aed" },
                        { icon: <PersonOutlineIcon sx={{ fontSize: 13 }} />, val: s?.nbUsers, color: "#059669" },
                      ].map((stat, si) => (
                        <TableCell key={si} align="center" sx={cellSx}>
                          {stats === undefined ? (
                            <Box sx={{ width: 28, height: 16, borderRadius: 1, bgcolor: "#F1F5F9", display: "inline-block" }} />
                          ) : (stat.val ?? 0) > 0 ? (
                            <Chip icon={stat.icon} label={stat.val} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${stat.color}15`, color: stat.color, "& .MuiChip-icon": { color: stat.color } }} />
                          ) : (
                            <Typography variant="caption" sx={{ color: "#CBD5E1" }}>—</Typography>
                          )}
                        </TableCell>
                      ))}

                      <TableCell align="right" sx={{ ...cellSx, pr: 2 }}>
                        <Box display="flex" justifyContent="flex-end" gap={0.5} sx={{ opacity: 0.4, transition: "opacity 0.15s", "tr:hover &": { opacity: 1 } }}>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={() => onEdit?.(agence)} sx={{ color: "#94A3B8", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}>
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={() => onDelete?.(agence)} sx={{ color: "#94A3B8", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: "#dc2626", bgcolor: "#FEF2F2" } }}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </motion.tr>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && agences.length > 0 && (
          <PaginationBar page={page} totalPages={totalPages} total={agences.length} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        )}
      </motion.div>
    </Box>
  );
}
