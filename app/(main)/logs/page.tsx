"use client";

import {
  exportTenantActivityLogs,
  fetchTenantActivityLogs,
  fetchTenantActivityStats,
} from "@/lib/activityLogs";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import DownloadIcon from "@mui/icons-material/Download";
import TodayIcon from "@mui/icons-material/Today";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

function formatDate(value: string): string {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("fr-FR"); }
  catch { return value; }
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["tenant-logs", page, action, startDate, endDate],
    queryFn: () => fetchTenantActivityLogs({ page, limit: 25, action, startDate, endDate }),
  });
  const statsQuery = useQuery({
    queryKey: ["tenant-logs-stats"],
    queryFn: () => fetchTenantActivityStats(30),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportTenantActivityLogs(5000),
  });

  const topActions = useMemo(() => {
    const data = statsQuery.data?.byAction ?? [];
    return [...data].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [statsQuery.data]);

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <FactCheckIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Logs & Audit</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Historique d&apos;activite du tenant avec filtres et export.
          </Typography>
        </Box>
        <Button
                variant="outlined" startIcon={<DownloadIcon />}
                onClick={async () => {
                  setExportError(null);
                  try {
                    const rows = await exportMutation.mutateAsync();
                    downloadCsv(rows as unknown as Record<string, unknown>[], [
                      { key: "id", label: "ID" }, { key: "action", label: "Action" }, { key: "description", label: "Description" },
                      { key: "userName", label: "Utilisateur" }, { key: "userUsername", label: "Login" }, { key: "createdAt", label: "Date" },
                    ], "activity-logs-tenant.csv");
                  } catch (err) {
                    setExportError(err instanceof Error ? err.message : "Export des logs impossible.");
                  }
                }}
                sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
              >
                Exporter CSV
              </Button>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>

        {exportError && <Alert severity="error" sx={{ mb: 2 }}>{exportError}</Alert>}
        {logsQuery.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Impossible de charger les logs. {logsQuery.error instanceof Error ? logsQuery.error.message : null}
          </Alert>
        )}

        {/* KPIs */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Total logs", value: logsQuery.data?.total ?? 0, accent: NAVY, icon: <FactCheckIcon sx={{ fontSize: 22 }} /> },
            { label: "Jours actifs (30j)", value: statsQuery.data?.byDay?.length ?? 0, accent: STEEL, icon: <TodayIcon sx={{ fontSize: 22 }} /> },
            { label: "Actions distinctes", value: statsQuery.data?.byAction?.length ?? 0, accent: "#7c3aed", icon: <ListAltIcon sx={{ fontSize: 22 }} /> },
          ].map((kpi, i) => (
            <Grid item xs={12} sm={4} key={i}>
              <Box sx={{
                borderRadius: 3, border: "1px solid var(--border)", bgcolor: "var(--bg-surface)",
                px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2,
                position: "relative", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(15,59,92,0.05)",
                "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.accent, borderRadius: "3px 0 0 3px" },
                transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(15,59,92,0.1)" },
              }}>
                <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.accent, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.accent}44`, flexShrink: 0 }}>{kpi.icon}</Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: kpi.accent, lineHeight: 1, letterSpacing: -0.5 }}>{kpi.value}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ lineHeight: 1.3 }}>{kpi.label}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "var(--bg-surface)", boxShadow: "0 1px 4px rgba(15,59,92,0.04)" }}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <TextField
              size="small" placeholder="Filtrer par action (ex: CREATE_USER)..."
              value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
              sx={{ flex: 1, minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)", transition: "background .15s", "&:hover": { bgcolor: "var(--bg-surface)" }, "&.Mui-focused": { bgcolor: "var(--bg-surface)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STEEL }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STEEL, borderWidth: 1.5 } } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} /></InputAdornment>,
                endAdornment: action ? <InputAdornment position="end"><IconButton size="small" onClick={() => { setAction(""); setPage(1); }}><ClearIcon sx={{ fontSize: 16 }} /></IconButton></InputAdornment> : undefined,
              }}
            />
            {topActions.length > 0 && (
              // displayEmpty : sans lui, la valeur "" ne rend rien et le
              // sélecteur apparaît comme une boîte vide sans libellé.
              <TextField select size="small" value="" onChange={(e) => { setAction(e.target.value); setPage(1); }}
                SelectProps={{ displayEmpty: true }}
                sx={{ minWidth: 180, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "var(--bg-page)" } }}>
                <MenuItem value="">Raccourcis actions</MenuItem>
                {topActions.map((x) => (<MenuItem key={x.action} value={x.action}>{x.action}</MenuItem>))}
              </TextField>
            )}
            <Button size="small" startIcon={<FilterListIcon />}
              onClick={() => setShowDateFilters((v) => !v)}
              variant={showDateFilters ? "contained" : "outlined"}
              sx={showDateFilters
                ? { bgcolor: NAVY, color: "white", fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: STEEL } }
                : { fontWeight: 600, borderRadius: 2, borderColor: "var(--border)", color: "var(--text-secondary)", "&:hover": { borderColor: STEEL, bgcolor: "#F1F5F9" } }}>
              Dates{(startDate || endDate) && <Chip label={(startDate ? 1 : 0) + (endDate ? 1 : 0)} size="small" sx={{ ml: 1, height: 18, fontSize: 11, fontWeight: 700, bgcolor: "rgba(255,255,255,0.25)", color: "inherit" }} />}
            </Button>
            {(action || startDate || endDate) && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 15 }} />} onClick={() => { setAction(""); setStartDate(""); setEndDate(""); setPage(1); }}
                sx={{ fontWeight: 500, borderRadius: 2, color: "var(--text-secondary)", fontSize: 13, "&:hover": { bgcolor: "#F1F5F9" } }}>
                Effacer
              </Button>
            )}
          </Box>
          <Collapse in={showDateFilters}>
            <Box display="flex" gap={1.5} mt={1.5} pt={1.5} sx={{ borderTop: "1px solid #F1F5F9" }} flexWrap="wrap">
              <TextField size="small" label="Du" type="date" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} sx={{ minWidth: 160 }} />
              <TextField size="small" label="Au" type="date" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} sx={{ minWidth: 160 }} />
            </Box>
          </Collapse>
          <Box display="flex" gap={1} mt={1.5} pt={1} sx={{ borderTop: "1px solid #F1F5F9" }} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">{logsQuery.data?.total ?? 0} log{(logsQuery.data?.total ?? 0) !== 1 ? "s" : ""}</Typography>
            <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>·</Typography>
            <Typography variant="caption" color="text.secondary">Page {logsQuery.data?.page ?? 1}/{logsQuery.data?.totalPages ?? 1}</Typography>
            <Typography variant="caption" sx={{ color: "var(--border-strong)" }}>·</Typography>
            <Typography variant="caption" color="text.secondary">{statsQuery.data?.byDay?.length ?? 0} jours actifs (30j)</Typography>
          </Box>
        </Paper>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid var(--border)", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["ID", "Action", "Description", "Utilisateur", "Date"].map((label, i) => (
                  <TableCell
                    key={i}
                    sx={{
                      bgcolor: NAVY,
                      color: "rgba(255,255,255,0.55)",
                      fontWeight: 600,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      borderBottom: "none",
                      py: 1.75,
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(logsQuery.data?.logs ?? []).map((log) => (
                <TableRow key={log.id} sx={{ "& td": { borderBottom: "1px solid #F1F5F9" }, "&:hover": { bgcolor: "var(--bg-hover)" } }}>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{log.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: STEEL, letterSpacing: 0.2 }}>
                        {log.action || "—"}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontSize: 12 }}>{log.description || "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500} sx={{ color: "var(--text-primary)" }}>{log.userName || log.userUsername || "Systeme"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{formatDate(log.createdAt)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!logsQuery.isLoading && (logsQuery.data?.logs?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, border: "none" }}>
                    <Typography variant="body2" color="text.secondary">Aucun log trouve.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <PaginationBar
          page={logsQuery.data?.page ?? 1}
          totalPages={logsQuery.data?.totalPages ?? 1}
          total={logsQuery.data?.total ?? 0}
          pageSize={25}
          onPageChange={setPage}
        />
      </Container>
    </>
  );
}