"use client";

import { ClientDto } from "@/lib/clients";
import {
  Avatar,
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonPinCircleIcon from "@mui/icons-material/PersonPinCircle";
import PhoneIcon from "@mui/icons-material/Phone";
import { motion } from "framer-motion";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

interface ClientsTableProps {
  clients: ClientDto[];
  loading?: boolean;
  onEdit?: (client: ClientDto) => void;
  onDelete?: (client: ClientDto) => void;
  selectedIds?: number[];
  onToggleSelect?: (clientId: number) => void;
  onToggleSelectAll?: (checked: boolean) => void;
  /** Affiche les colonnes de gestion (sélection, éditer, supprimer). Faux = lecture seule. */
  canManage?: boolean;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function ClientsTable({
  clients,
  loading,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  canManage = true,
}: ClientsTableProps) {
  const selectedSet = new Set(selectedIds);
  const allSelected = clients.length > 0 && clients.every((c) => selectedSet.has(c.id));
  const someSelected = clients.some((c) => selectedSet.has(c.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: 2.5, border: "1px solid var(--border)", overflow: "hidden" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {canManage && (
                <TableCell padding="checkbox" sx={{ bgcolor: NAVY, pl: 2, borderBottom: "none", width: 48 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                    sx={{
                      color: "rgba(255,255,255,0.35)",
                      "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: GOLD },
                      padding: "4px",
                    }}
                  />
                </TableCell>
              )}
              <TableCell sx={{ bgcolor: NAVY, borderBottom: "none", width: 52, pl: 2 }} />
              {["Client", "Code client", "Agence", "CAF attribue", "Contact", ...(canManage ? [""] : [])].map((label, i) => (
                <TableCell
                  key={i}
                  align={i === 5 ? "right" : "left"}
                  sx={{
                    bgcolor: NAVY,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    borderBottom: "none",
                    py: 1.75,
                    pr: i === 5 ? 2.5 : undefined,
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8, border: "none" }}>
                  <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
                    <CircularProgress size={18} sx={{ color: STEEL }} />
                    <Typography variant="body2" color="text.secondary">Chargement des clients...</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8, border: "none" }}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                    <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <PersonPinCircleIcon sx={{ fontSize: 24, color: "var(--border-strong)" }} />
                    </Box>
                    <Typography variant="body2" color="text.disabled">Aucun client trouve.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client, idx) => {
                const isSelected = selectedSet.has(client.id);
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    style={{ display: "table-row" }}
                  >
                    {canManage && (
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
                          onChange={() => onToggleSelect?.(client.id)}
                          sx={{ "&.Mui-checked": { color: STEEL }, padding: "4px" }}
                        />
                      </TableCell>
                    )}

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", pl: 2 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: NAVY, fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
                        {initials(client.name)}
                      </Avatar>
                    </TableCell>

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", py: 1.5 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-primary)" }}>
                        {client.name}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                      <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: STEEL, letterSpacing: 0.3, fontFamily: "monospace" }}>
                          {client.codeClient}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                      <Typography variant="body2" sx={{ color: client.agenceClient ? "var(--text-primary)" : "var(--border-strong)", fontSize: 13 }}>
                        {client.agenceClient ?? "—"}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                      {client.cafName || client.cafCode ? (
                        <Box>
                          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2, color: "var(--text-primary)" }}>
                            {client.cafName ?? client.cafCode}
                          </Typography>
                          {client.cafName && client.cafCode && (
                            <Typography variant="caption" color="text.secondary">{client.cafCode}</Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: "var(--border-strong)" }}>—</Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
                      {client.contactInfo ? (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PhoneIcon sx={{ fontSize: 14, color: "var(--text-muted)" }} />
                          <Typography variant="body2" sx={{ fontSize: 12, color: "var(--text-secondary)" }}>{client.contactInfo}</Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: "var(--border-strong)" }}>—</Typography>
                      )}
                    </TableCell>

                    {canManage && (
                      <TableCell align="right" sx={{ bgcolor: isSelected ? "rgba(30,96,145,0.10)" : "var(--bg-surface)", borderBottom: "1px solid var(--border)", pr: 2 }}>
                        <Box
                          display="flex"
                          justifyContent="flex-end"
                          gap={0.5}
                          sx={{ opacity: 0.4, transition: "opacity 0.15s", "tr:hover &": { opacity: 1 } }}
                        >
                          <Tooltip title="Modifier">
                            <IconButton
                              size="small"
                              onClick={() => onEdit?.(client)}
                              sx={{ color: "var(--text-muted)", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: STEEL, bgcolor: "#EFF6FF" } }}
                            >
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              onClick={() => onDelete?.(client)}
                              sx={{ color: "var(--text-muted)", width: 28, height: 28, borderRadius: 1.25, "&:hover": { color: "#dc2626", bgcolor: "#FEF2F2" } }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && clients.length > 0 && (
        <Box mt={1.5} display="flex" justifyContent="flex-end">
          <Typography variant="caption" color="text.secondary">
            {clients.length} client{clients.length > 1 ? "s" : ""}
          </Typography>
        </Box>
      )}
    </motion.div>
  );
}