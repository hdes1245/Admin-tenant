"use client";

import { UserDto } from "@/lib/users";
import {
  Avatar,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockResetIcon from "@mui/icons-material/LockReset";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "./PaginationBar";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

interface UsersTableProps {
  users: UserDto[];
  loading?: boolean;
  onEdit?: (user: UserDto) => void;
  onDelete?: (user: UserDto) => void;
  onResetPassword?: (user: UserDto) => void;
  onToggleActive?: (user: UserDto) => void;
  selectedIds?: number[];
  onToggleSelect?: (userId: number) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: number[]) => void;
  currentUserId?: number;
}

function roleLabel(user: UserDto): string {
  const raw = user.roleName || user.roleCode;
  return raw && raw.trim().length > 0 ? raw : user.roleCode || "Inconnu";
}

function userInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function UsersTable({
  users,
  loading,
  onEdit,
  onDelete,
  onResetPassword,
  onToggleActive,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  currentUserId,
}: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.roleName || u.roleCode).toLowerCase().includes(q) ||
      (u.agenceName ?? "").toLowerCase().includes(q) ||
      (u.zoneName ?? "").toLowerCase().includes(q) ||
      (u.cafCode ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  useEffect(() => { setPage(1); }, [search, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = useMemo(() => paginated.map((u) => u.id), [paginated]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  return (
    <Box>
      <Box mb={2.5} display="flex" alignItems="center" gap={2}>
        <TextField
          size="small"
          placeholder="Rechercher par nom, login, role, agence, code CAF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            maxWidth: 460,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: "var(--bg-surface)",
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border-strong)" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
        {search && (
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            {filtered.length} resultat{filtered.length !== 1 ? "s" : ""}
          </Typography>
        )}
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 2.5,
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  padding="checkbox"
                  sx={{ bgcolor: NAVY, pl: 2, borderBottom: "none", width: 48 }}
                >
                  <Checkbox
                    size="small"
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked, visibleIds)}
                    sx={{
                      color: "rgba(255,255,255,0.35)",
                      "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: GOLD },
                      padding: "4px",
                    }}
                  />
                </TableCell>
                {[
                  { label: "Utilisateur" },
                  { label: "Login" },
                  { label: "Role" },
                  { label: "Agence" },
                  { label: "Zone" },
                  { label: "Code CAF" },
                  { label: "Statut" },
                  { label: "", align: "right" as const },
                ].map((col, i) => (
                  <TableCell
                    key={i}
                    align={col.align}
                    sx={{
                      bgcolor: NAVY,
                      color: "rgba(255,255,255,0.55)",
                      fontWeight: 600,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      borderBottom: "none",
                      py: 1.75,
                      pr: i === 7 ? 2.5 : undefined,
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
                      <CircularProgress size={18} sx={{ color: STEEL }} />
                      <Typography variant="body2" color="text.secondary">Chargement...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8, border: "none" }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                      <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <PeopleAltIcon sx={{ fontSize: 24, color: "var(--border-strong)" }} />
                      </Box>
                      <Typography variant="body2" color="text.disabled">
                        {search ? "Aucun utilisateur ne correspond." : "Aucun utilisateur enregistre."}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((user, idx) => {
                  const isSelected = selectedSet.has(user.id);
                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: idx * 0.015 }}
                      style={{ display: "table-row" }}
                    >
                      {/* Checkbox */}
                      <TableCell
                        padding="checkbox"
                        sx={{
                          pl: 2,
                          bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)",
                          borderLeft: isSelected ? `3px solid ${STEEL}` : "3px solid transparent",
                          borderBottom: "1px solid var(--border)",
                          transition: "all 0.12s",
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(user.id)}
                          sx={{ "&.Mui-checked": { color: STEEL }, padding: "4px" }}
                        />
                      </TableCell>

                      {/* Utilisateur */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", py: 1.5 }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar
                            sx={{
                              width: 34, height: 34,
                              bgcolor: NAVY,
                              fontSize: 12, fontWeight: 700,
                              letterSpacing: 0.3,
                              flexShrink: 0,
                            }}
                          >
                            {userInitials(user.name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ color: "var(--text-primary)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                            >
                              {user.name}
                            </Typography>
                            {user.email && (
                              <Typography variant="caption" sx={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {user.email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Login */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}
                        >
                          {user.username}
                        </Typography>
                      </TableCell>

                      {/* Role */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Box
                          sx={{
                            display: "inline-flex",
                            px: 1.25, py: 0.4,
                            borderRadius: 1.25,
                            bgcolor: "#F1F5F9",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, fontSize: 11, color: "var(--text-primary)", letterSpacing: 0.2, whiteSpace: "nowrap" }}
                          >
                            {roleLabel(user)}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Agence */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Typography variant="body2" sx={{ color: user.agenceName ? "var(--text-primary)" : "var(--border-strong)", fontSize: 13 }}>
                          {user.agenceName ?? "—"}
                        </Typography>
                      </TableCell>

                      {/* Zone */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Typography variant="body2" sx={{ color: user.zoneName ? "var(--text-primary)" : "var(--border-strong)", fontSize: 13 }}>
                          {user.zoneName ?? "—"}
                        </Typography>
                      </TableCell>

                      {/* Code CAF */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        {user.cafCode ? (
                          <Box
                            sx={{
                              display: "inline-flex",
                              px: 1.25, py: 0.4,
                              borderRadius: 1.25,
                              bgcolor: "#EFF6FF",
                              border: "1px solid #DBEAFE",
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: STEEL, letterSpacing: 0.3 }}>
                              {user.cafCode}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: "var(--border-strong)" }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Statut */}
                      <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <Box sx={{
                            width: 6, height: 6, borderRadius: "50%",
                            bgcolor: user.isActive ? "#22c55e" : "var(--border)",
                          }} />
                          <Typography variant="caption" fontWeight={600} sx={{ color: user.isActive ? "#15803d" : "var(--text-muted)", fontSize: 11.5 }}>
                            {user.isActive ? "Actif" : "Inactif"}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        align="right"
                        sx={{
                          bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)",
                          borderBottom: "1px solid var(--border)",
                          pr: 2,
                        }}
                      >
                        <Box
                          display="flex"
                          justifyContent="flex-end"
                          gap={0.5}
                          sx={{
                            opacity: 0.4,
                            transition: "opacity 0.15s",
                            "tr:hover &": { opacity: 1 },
                          }}
                        >
                          <Tooltip title={user.isActive ? "Desactiver" : "Activer"}>
                            <IconButton
                              size="small"
                              onClick={() => onToggleActive?.(user)}
                              sx={{
                                color: user.isActive ? "#EF4444" : "#22c55e",
                                width: 28, height: 28, borderRadius: 1.25,
                                "&:hover": { bgcolor: user.isActive ? "#FEF2F2" : "#F0FDF4" },
                              }}
                            >
                              {user.isActive ? <ToggleOffIcon sx={{ fontSize: 16 }} /> : <ToggleOnIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reinitialiser le mot de passe">
                            <IconButton
                              size="small"
                              onClick={() => onResetPassword?.(user)}
                              sx={{
                                color: "var(--text-muted)",
                                width: 28, height: 28, borderRadius: 1.25,
                                "&:hover": { color: "#b45309", bgcolor: "#FFFBEB" },
                              }}
                            >
                              <LockResetIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          {(() => {
                            const isAdminTenant = (user.roleCode || user.roleName || "").toLowerCase() === "admin_tenant";
                            return isAdminTenant ? (
                              <Tooltip title="Modification reservee aux admins GeoTrust">
                                <span>
                                  <IconButton size="small" disabled sx={{ width: 28, height: 28, borderRadius: 1.25 }}>
                                    <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Modifier">
                                <IconButton
                                  size="small"
                                  onClick={() => onEdit?.(user)}
                                  sx={{
                                    color: "var(--text-muted)",
                                    width: 28, height: 28, borderRadius: 1.25,
                                    "&:hover": { color: STEEL, bgcolor: "#EFF6FF" },
                                  }}
                                >
                                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            );
                          })()}
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              onClick={() => onDelete?.(user)}
                              sx={{
                                color: "var(--text-muted)",
                                width: 28, height: 28, borderRadius: 1.25,
                                "&:hover": { color: "#dc2626", bgcolor: "#FEF2F2" },
                              }}
                            >
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

        {!loading && filtered.length > 0 && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </motion.div>
    </Box>
  );
}
