"use client";

import { fetchLocations, fetchLocationHistory, fetchDeletionLogs, fetchLocationPhotos, deleteLocationPhoto } from "@/lib/locations";
import { downloadCsv } from "@/lib/csvExport";
import type { LocationItem, LocationHistoryItem, DeletionLogItem, LocationPhotoItem } from "@/lib/locations";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import DownloadIcon from "@mui/icons-material/Download";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import HomeIcon from "@mui/icons-material/Home";
import VerifiedIcon from "@mui/icons-material/Verified";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExploreIcon from "@mui/icons-material/Explore";
import PersonIcon from "@mui/icons-material/Person";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import { Drawer } from "@mui/material";
import { useState, useCallback, useMemo } from "react";
import { buildTenantMapHtml } from "@/lib/buildTenantMapHtml";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

const LOCATION_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "activite", label: "Activite" },
  { value: "garantie", label: "Garantie" },
  { value: "domicile", label: "Domicile" },
  { value: "caution", label: "Caution" },
];

function fmt(s?: string | null): string {
  if (!s) return "--";
  try {
    const d = new Date(s);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

type TypeCfg = { label: string; bg: string; color: string; border: string; icon: React.ReactNode };

function getTypeCfg(type: string | null | undefined): TypeCfg {
  switch ((type ?? "").toLowerCase()) {
    case "activite":
      return { label: type ?? "Activite", bg: "#EFF6FF", color: STEEL, border: "#BFDBFE", icon: <TimelineIcon sx={{ fontSize: 12 }} /> };
    case "garantie":
      return { label: "Garantie", bg: "#F0FDF4", color: "#15803d", border: "#BBF7D0", icon: <VerifiedIcon sx={{ fontSize: 12 }} /> };
    case "domicile":
      return { label: "Domicile", bg: "#FAF5FF", color: "#7c3aed", border: "#DDD6FE", icon: <HomeIcon sx={{ fontSize: 12 }} /> };
    case "caution":
      return { label: "Caution", bg: "#FFFBEB", color: "#b45309", border: "#FDE68A", icon: <WarningAmberIcon sx={{ fontSize: 12 }} /> };
    default:
      return { label: type ?? "Autres", bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", icon: <ExploreIcon sx={{ fontSize: 12 }} /> };
  }
}

const LOCATION_CSV_COLUMNS = [
  { key: "id" as const, label: "ID" },
  { key: "clientName" as const, label: "Client" },
  { key: "clientCode" as const, label: "Code client" },
  { key: "userName" as const, label: "Operateur" },
  { key: "type" as const, label: "Type" },
  { key: "latitude" as const, label: "Latitude", format: (v: unknown) => (v != null ? String(Number(v).toFixed(5)) : "--") },
  { key: "longitude" as const, label: "Longitude", format: (v: unknown) => (v != null ? String(Number(v).toFixed(5)) : "--") },
  { key: "address" as const, label: "Adresse" },
  { key: "timestamp" as const, label: "Date", format: (v: unknown) => (v ? fmt(String(v)) : "--") },
];

export default function LocationsPage() {
  const [page, setPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [historyLocation, setHistoryLocation] = useState<LocationItem | null>(null);
  const [historyItems, setHistoryItems] = useState<LocationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [deletionDrawerOpen, setDeletionDrawerOpen] = useState(false);
  const [deletionLogs, setDeletionLogs] = useState<DeletionLogItem[]>([]);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const [detailLocation, setDetailLocation] = useState<LocationItem | null>(null);
  const [detailPhotos, setDetailPhotos] = useState<LocationPhotoItem[]>([]);
  const [detailPhotosLoading, setDetailPhotosLoading] = useState(false);
  const [detailPhotosError, setDetailPhotosError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);

  const hasFilters = search || typeFilter || dateFrom || dateTo;

  const resetFilters = useCallback(() => {
    setSearch("");
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const query = useQuery({
    queryKey: ["locations-page", page, search, typeFilter, dateFrom, dateTo],
    queryFn: () => fetchLocations({ page, limit: 25, search: search || undefined, type: typeFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    placeholderData: (prev: any) => prev,
  });

  const mapQuery = useQuery({
    queryKey: ["locations-map", search, typeFilter, dateFrom, dateTo],
    queryFn: () => fetchLocations({ page: 1, limit: 1000, search: search || undefined, type: typeFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    enabled: true,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const currentPage = query.data?.page ?? 1;

  const statsQuery = useQuery({
    queryKey: ["locations-stats"],
    queryFn: () => fetchLocations({ page: 1, limit: 1000 }),
    staleTime: 60_000,
  });
  const statsItems = statsQuery.data?.items ?? [];
  const countDomicile  = useMemo(() => statsItems.filter((i) => i.type === "domicile").length,  [statsItems]);
  const countActivite  = useMemo(() => statsItems.filter((i) => i.type === "activite").length,  [statsItems]);
  const countGarantie  = useMemo(() => statsItems.filter((i) => i.type === "garantie").length,  [statsItems]);

  const mapItems = useMemo(() => {
    let list = (mapQuery.data?.items ?? []).filter((l) => l.latitude != null && l.longitude != null);
    if (typeFilter) {
      list = list.filter((i) => (i.type ?? "").toLowerCase() === typeFilter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        (i.clientName ?? "").toLowerCase().includes(q) ||
        (i.clientCode ?? "").toLowerCase().includes(q) ||
        (i.userName ?? "").toLowerCase().includes(q) ||
        (i.address ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [mapQuery.data, typeFilter, search]);

  const mapHtml = useMemo(() => buildTenantMapHtml(mapItems), [mapItems]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    const allItems = (mapQuery.data?.items ?? []);
    const seen = new Set<string>();
    const results: { label: string; sub: string; type: "client" | "operator" | "address" }[] = [];
    for (const i of allItems) {
      if (results.length >= 8) break;
      const name = i.clientName ?? i.clientCode ?? "";
      const key = "c:" + name;
      if (name && name.toLowerCase().includes(q) && !seen.has(key)) {
        seen.add(key);
        results.push({ label: name, sub: i.clientCode ?? "", type: "client" });
      }
    }
    for (const i of allItems) {
      if (results.length >= 8) break;
      const op = i.userName ?? "";
      const key = "o:" + op;
      if (op && op.toLowerCase().includes(q) && !seen.has(key)) {
        seen.add(key);
        results.push({ label: op, sub: "Opérateur", type: "operator" });
      }
    }
    for (const i of allItems) {
      if (results.length >= 8) break;
      const addr = i.address ?? "";
      const key = "a:" + addr;
      if (addr && addr.toLowerCase().includes(q) && !seen.has(key)) {
        seen.add(key);
        results.push({ label: addr, sub: "Adresse", type: "address" });
      }
    }
    return results;
  }, [search, mapQuery.data]);

  const countDomicileMap  = useMemo(() => mapItems.filter((i) => (i.type ?? "").toLowerCase() === "domicile").length,  [mapItems]);
  const countActiviteMap  = useMemo(() => mapItems.filter((i) => (i.type ?? "").toLowerCase() === "activite").length,  [mapItems]);
  const countGarantieMap  = useMemo(() => mapItems.filter((i) => (i.type ?? "").toLowerCase() === "garantie").length,  [mapItems]);

  const handleExportCsv = () => {
    downloadCsv(items as LocationItem[], LOCATION_CSV_COLUMNS as any, "localisations.csv");
  };

  const openDeletionAudit = async () => {
    setDeletionDrawerOpen(true);
    setDeletionLogs([]);
    setDeletionError(null);
    setDeletionLoading(true);
    try {
      const result = await fetchDeletionLogs({ limit: 200 });
      setDeletionLogs(result.logs);
    } catch (e) {
      setDeletionError(e instanceof Error ? e.message : "Erreur lors du chargement.");
    } finally {
      setDeletionLoading(false);
    }
  };

  const openDetail = async (loc: LocationItem) => {
    setDetailLocation(loc);
    setDetailPhotos([]);
    setDetailPhotosError(null);
    setDetailPhotosLoading(true);
    try {
      const photos = await fetchLocationPhotos(loc.id);
      setDetailPhotos(photos);
    } catch (e) {
      setDetailPhotosError(e instanceof Error ? e.message : "Erreur chargement photos.");
    } finally {
      setDetailPhotosLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    setDeletingPhotoId(photoId);
    try {
      await deleteLocationPhoto(photoId);
      setDetailPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (_) {}
    setDeletingPhotoId(null);
  };

  const openHistory = async (loc: LocationItem) => {
    setHistoryLocation(loc);
    setHistoryItems([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const items = await fetchLocationHistory(loc.id);
      setHistoryItems(items);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Erreur lors du chargement.");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <GpsFixedIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Localisations</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>Historique des captures GPS des clients</Typography>
        </Box>
              <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
                <Tooltip title="Exporter les localisations en CSV">
                  <Button
                    variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv} disabled={mapItems.length === 0}
                    sx={{ borderColor: "rgba(255,255,255,0.6)", color: "white", fontWeight: 600, "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
                  >
                    CSV
                  </Button>
                </Tooltip>
                <Tooltip title="Journal des suppressions de localisations">
                  <Button
                    variant="outlined" startIcon={<DeleteForeverIcon />} onClick={openDeletionAudit}
                    sx={{ borderColor: "rgba(239,68,68,0.55)", color: "#FCA5A5", fontWeight: 600, "&:hover": { borderColor: "#FCA5A5", bgcolor: "rgba(239,68,68,0.12)" } }}
                  >
                    Suppressions
                  </Button>
                </Tooltip>
              </Box>
      </Box>

      {(
        <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", bgcolor: "#F4F6F9" }}>
          {/* KPIs */}
          <Box sx={{ px: 3, pt: 2, pb: 1.5 }}>
            <Grid container spacing={2}>
              {[
                { label: "Total points GPS", value: mapItems.length, accent: NAVY,      icon: <GpsFixedIcon sx={{ fontSize: 20 }} /> },
                { label: "Domicile",         value: countDomicileMap, accent: "#7c3aed", icon: <HomeIcon sx={{ fontSize: 20 }} /> },
                { label: "Activité",         value: countActiviteMap, accent: STEEL,     icon: <TimelineIcon sx={{ fontSize: 20 }} /> },
                { label: "Garantie",         value: countGarantieMap, accent: "#059669", icon: <VerifiedIcon sx={{ fontSize: 20 }} /> },
              ].map((kpi, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{
                    borderRadius: 2.5, border: "1px solid #E2E8F0", bgcolor: "white",
                    px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5,
                    position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(13,27,42,0.05)",
                    "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 3, bgcolor: kpi.accent },
                  }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: kpi.accent, color: "white", borderRadius: 2, flexShrink: 0 }}>{kpi.icon}</Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={800} sx={{ color: kpi.accent, lineHeight: 1 }}>{kpi.value}</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>{kpi.label}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Map area */}
          <Box sx={{ display: "flex", flex: 1, minHeight: 0, px: 3, pb: 3, gap: 2 }}>
            {/* Left panel — filters */}
            <Paper elevation={0} sx={{ width: 270, flexShrink: 0, borderRadius: 2.5, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 1 }}>
                <FilterListIcon sx={{ fontSize: 16, color: GOLD }} />
                <Typography fontSize={13} fontWeight={700} color={NAVY}>Filtres</Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {/* Search with suggestions */}
                <Box sx={{ position: "relative" }}>
                  <TextField
                    size="small" fullWidth
                    placeholder="Client, opérateur, adresse…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: "#94A3B8" }} /></InputAdornment>,
                      endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearch(""); setShowSuggestions(false); }}><ClearIcon sx={{ fontSize: 14 }} /></IconButton></InputAdornment> : null,
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#F8FAFC", "&:hover fieldset": { borderColor: STEEL }, "&.Mui-focused fieldset": { borderColor: STEEL } } }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <Paper elevation={4} sx={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999,
                      borderRadius: 2, mt: 0.5, overflow: "hidden",
                      border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(13,27,42,0.12)",
                    }}>
                      {suggestions.map((s, idx) => (
                        <Box
                          key={idx}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSearch(s.label); setShowSuggestions(false); }}
                          sx={{
                            px: 1.5, py: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25,
                            borderBottom: idx < suggestions.length - 1 ? "1px solid #F1F5F9" : "none",
                            "&:hover": { bgcolor: "#F8FAFC" },
                          }}
                        >
                          <Box sx={{
                            width: 26, height: 26, borderRadius: 1.25, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            bgcolor: s.type === "client" ? "#EFF6FF" : s.type === "operator" ? "#F0FDF4" : "#FAF5FF",
                          }}>
                            {s.type === "client"   && <PersonIcon sx={{ fontSize: 14, color: STEEL }} />}
                            {s.type === "operator" && <PersonIcon sx={{ fontSize: 14, color: "#15803d" }} />}
                            {s.type === "address"  && <PlaceIcon  sx={{ fontSize: 14, color: "#7c3aed" }} />}
                          </Box>
                          <Box minWidth={0}>
                            <Typography fontSize={12} fontWeight={600} color={NAVY} noWrap>
                              {s.label}
                            </Typography>
                            {s.sub && (
                              <Typography fontSize={10} color="#94A3B8" noWrap>{s.sub}</Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>
                <Select
                  size="small" fullWidth displayEmpty value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  sx={{ bgcolor: "#F8FAFC", "& fieldset": { borderColor: "#E2E8F0" }, "&:hover fieldset": { borderColor: STEEL } }}
                >
                  {LOCATION_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
                <TextField
                  size="small" fullWidth label="Du" type="date" value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#F8FAFC" } }}
                />
                <TextField
                  size="small" fullWidth label="Au" type="date" value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#F8FAFC" } }}
                />
                {hasFilters && (
                  <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 14 }} />} onClick={resetFilters}
                    sx={{ fontWeight: 600, color: "#64748B", justifyContent: "flex-start", textTransform: "none", "&:hover": { bgcolor: "#F1F5F9" } }}>
                    Effacer les filtres
                  </Button>
                )}

                <Box sx={{ mt: 1, pt: 1.5, borderTop: "1px solid #F1F5F9" }}>
                  <Typography fontSize={10} fontWeight={700} color="#94A3B8" textTransform="uppercase" letterSpacing={0.8} mb={1}>
                    Points affichés
                  </Typography>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography fontSize={12} color="#334155">Total</Typography>
                    {mapQuery.isFetching
                      ? <CircularProgress size={14} sx={{ color: STEEL }} />
                      : <Chip label={mapItems.length.toLocaleString("fr-FR")} size="small" sx={{ fontWeight: 700, bgcolor: "#F1F5F9", fontSize: 11 }} />
                    }
                  </Box>
                </Box>

                {/* Légende types */}
                <Box sx={{ pt: 1.5, borderTop: "1px solid #F1F5F9" }}>
                  <Typography fontSize={10} fontWeight={700} color="#94A3B8" textTransform="uppercase" letterSpacing={0.8} mb={1}>
                    Légende
                  </Typography>
                  {[
                    { label: "Domicile", color: "#7c3aed" },
                    { label: "Activité", color: "#1B4F72" },
                    { label: "Garantie", color: "#15803d" },
                    { label: "Caution",  color: "#b45309" },
                    { label: "Autre",    color: "#475569" },
                  ].map((t) => (
                    <Box key={t.label} display="flex" alignItems="center" gap={1} mb={0.75}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.color, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,.3)", flexShrink: 0 }} />
                      <Typography fontSize={12} color="#334155">{t.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>

            {/* Leaflet map */}
            <Box sx={{ flex: 1, borderRadius: 2.5, overflow: "hidden", border: "1px solid #E2E8F0", position: "relative", bgcolor: "#E8ECF0" }}>
              {mapQuery.isFetching && (
                <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                  <CircularProgress sx={{ color: STEEL }} />
                </Box>
              )}
              {mapItems.length === 0 && !mapQuery.isFetching && (
                <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 5, gap: 1.5 }}>
                  <GpsFixedIcon sx={{ fontSize: 48, color: "#CBD5E1" }} />
                  <Typography fontSize={14} color="#94A3B8">Aucune localisation GPS à afficher</Typography>
                </Box>
              )}
              <iframe
                key={`map-${typeFilter}-${search}-${dateFrom}-${dateTo}-${mapItems.length}`}
                srcDoc={mapHtml}
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                title="Carte GPS localisations"
                sandbox="allow-scripts allow-same-origin"
              />
            </Box>
          </Box>
        </Box>
      )}
      {/* Drawers */}
      <Drawer
        anchor="right"
        open={!!historyLocation}
        onClose={() => setHistoryLocation(null)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, bgcolor: "#F8FAFC" } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ px: 3, py: 2.5, bgcolor: NAVY, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <HistoryIcon sx={{ fontSize: 22, color: GOLD }} />
              <Box>
                <Typography fontWeight={700} fontSize={15}>Historique des modifications</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {historyLocation?.clientName ?? historyLocation?.clientCode ?? `#${historyLocation?.id}`}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setHistoryLocation(null)} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white" } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
            {historyLoading && (
              <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} sx={{ color: STEEL }} /></Box>
            )}
            {historyError && <Alert severity="error" sx={{ mb: 2 }}>{historyError}</Alert>}

            {!historyLoading && !historyError && historyItems.length === 0 && (
              <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={8} color="text.secondary">
                <HistoryIcon sx={{ fontSize: 48, opacity: 0.2 }} />
                <Typography fontWeight={500} fontSize={14}>Aucune modification enregistree pour cette localisation.</Typography>
              </Box>
            )}

            {!historyLoading && historyItems.map((h, idx) => (
              <Box key={h.id} sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.5 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: STEEL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <SwapVertIcon sx={{ fontSize: 15, color: "white" }} />
                    </Box>
                    {idx < historyItems.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 20, bgcolor: "#E2E8F0", my: 0.5 }} />}
                  </Box>
                  <Box sx={{ flex: 1, bgcolor: "white", border: "1px solid #E2E8F0", borderRadius: 2, p: 2, mb: 0.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1} flexWrap="wrap" gap={0.5}>
                      <Chip
                        label={h.action ?? "Modification"}
                        size="small"
                        sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 700, fontSize: 10, height: 20 }}
                      />
                      <Typography variant="caption" sx={{ color: "#94A3B8" }}>{fmt(h.modifiedAt)}</Typography>
                    </Box>
                    {h.modifiedByName && (
                      <Typography variant="body2" fontSize={12} sx={{ color: "#64748B", mb: 1 }}>
                        par <strong>{h.modifiedByName}</strong>
                      </Typography>
                    )}
                    {(h.oldLatitude != null || h.newLatitude != null) && (
                      <Box sx={{ bgcolor: "#F8FAFC", borderRadius: 1.5, p: 1.5, mt: 0.5 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8 }}>
                          Coordonnees
                        </Typography>
                        {h.oldLatitude != null && (
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Typography variant="caption" sx={{ color: "#94A3B8", minWidth: 50 }}>Avant</Typography>
                            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#475569" }}>
                              {h.oldLatitude?.toFixed(5)}, {h.oldLongitude?.toFixed(5)}
                            </Typography>
                          </Box>
                        )}
                        {h.newLatitude != null && (
                          <Box display="flex" alignItems="center" gap={1} mt={0.25}>
                            <Typography variant="caption" sx={{ color: "#16a34a", minWidth: 50, fontWeight: 700 }}>Apres</Typography>
                            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#16a34a", fontWeight: 600 }}>
                              {h.newLatitude?.toFixed(5)}, {h.newLongitude?.toFixed(5)}
                            </Typography>
                            <Tooltip title="Voir sur Google Maps">
                              <IconButton size="small" component="a"
                                href={`https://www.google.com/maps?q=${h.newLatitude},${h.newLongitude}`}
                                target="_blank" rel="noopener noreferrer"
                                sx={{ p: 0.25, color: "#94A3B8", "&:hover": { color: "#1A73E8" } }}>
                                <OpenInNewIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Drawer>

      {/* Drawer — détail localisation (metadata + photos) */}
      <Drawer
        anchor="right"
        open={!!detailLocation}
        onClose={() => setDetailLocation(null)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 540 }, bgcolor: "#F8FAFC" } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ px: 3, py: 2.5, bgcolor: NAVY, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <InfoOutlinedIcon sx={{ fontSize: 22, color: GOLD }} />
              <Box>
                <Typography fontWeight={700} fontSize={15}>Détail de la localisation</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {detailLocation?.clientName ?? detailLocation?.clientCode ?? `#${detailLocation?.id}`}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setDetailLocation(null)} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white" } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
            {/* ── Metadata formulaire terrain ── */}
            <Typography fontWeight={700} fontSize={13} sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, mb: 1.5 }}>
              Données terrain
            </Typography>
            {(!detailLocation?.metadata || Object.keys(detailLocation.metadata).length === 0) ? (
              <Box sx={{ bgcolor: "white", border: "1px solid #E2E8F0", borderRadius: 2, p: 2.5, mb: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.disabled" fontStyle="italic">Aucune donnée terrain enregistrée pour cette localisation.</Typography>
              </Box>
            ) : (
              <Box sx={{ bgcolor: "white", border: "1px solid #E2E8F0", borderRadius: 2, p: 2, mb: 3 }}>
                {Object.entries(detailLocation.metadata).map(([key, value]) => (
                  <Box key={key} sx={{ display: "flex", gap: 1.5, py: 0.75, borderBottom: "1px solid #F1F5F9", "&:last-child": { borderBottom: "none" } }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748B", minWidth: 140, flexShrink: 0, wordBreak: "break-word" }}>
                      {key}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#1E293B", wordBreak: "break-word", flex: 1 }}>
                      {value === null || value === undefined ? <span style={{ color: "#CBD5E1" }}>—</span>
                        : typeof value === "object" ? JSON.stringify(value)
                        : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* ── Photos de capture ── */}
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <PhotoLibraryIcon sx={{ fontSize: 16, color: "#64748B" }} />
              <Typography fontWeight={700} fontSize={13} sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Photos de capture
              </Typography>
              {!detailPhotosLoading && (
                <Chip label={detailPhotos.length} size="small" sx={{ height: 18, fontSize: 11, bgcolor: "#F1F5F9" }} />
              )}
            </Box>

            {detailPhotosLoading && (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: STEEL }} /></Box>
            )}
            {detailPhotosError && <Alert severity="error" sx={{ mb: 2 }}>{detailPhotosError}</Alert>}

            {!detailPhotosLoading && !detailPhotosError && detailPhotos.length === 0 && (
              <Box sx={{ bgcolor: "white", border: "1px solid #E2E8F0", borderRadius: 2, p: 2.5, textAlign: "center" }}>
                <BrokenImageIcon sx={{ fontSize: 36, color: "#E2E8F0", mb: 0.5 }} />
                <Typography variant="body2" color="text.disabled" fontStyle="italic">Aucune photo associée à cette localisation.</Typography>
              </Box>
            )}

            {!detailPhotosLoading && detailPhotos.length > 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                {detailPhotos.map((photo) => {
                  // Nouveau format : file_name = chemin relatif à /uploads
                  // (cloisonné par tenant) ; ancien format : nom nu à plat.
                  const photoUrl = photo.file_name.includes("/")
                    ? `/proxy/uploads/${photo.file_name}`
                    : `/proxy/uploads/location-photos/${photo.file_name}`;
                  const sizekb = (photo.size / 1024).toFixed(1);
                  const isDeleting = deletingPhotoId === photo.id;
                  return (
                    <Box key={photo.id} sx={{ position: "relative", borderRadius: 2, overflow: "hidden", border: "1px solid #E2E8F0", bgcolor: "white" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt={photo.original_name}
                        style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <Box sx={{ px: 1.25, py: 1 }}>
                        <Typography variant="caption" sx={{ color: "#475569", display: "block", fontWeight: 500 }} noWrap title={photo.original_name}>
                          {photo.original_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94A3B8" }}>{sizekb} Ko · {fmt(photo.uploaded_at)}</Typography>
                      </Box>
                      <Tooltip title="Supprimer cette photo">
                        <IconButton
                          size="small"
                          disabled={isDeleting}
                          onClick={() => handleDeletePhoto(photo.id)}
                          sx={{ position: "absolute", top: 6, right: 6, bgcolor: "rgba(0,0,0,0.5)", color: "white", width: 26, height: 26, "&:hover": { bgcolor: "#DC2626" }, "&.Mui-disabled": { bgcolor: "rgba(0,0,0,0.3)" } }}
                        >
                          {isDeleting ? <CircularProgress size={12} sx={{ color: "white" }} /> : <DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Drawer — journal des suppressions */}
      <Drawer
        anchor="right"
        open={deletionDrawerOpen}
        onClose={() => setDeletionDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, p: 0 } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* En-tête */}
          <Box sx={{ px: 3, py: 2.5, background: `linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)`, color: "white", display: "flex", alignItems: "center", gap: 1.5 }}>
            <DeleteForeverIcon sx={{ fontSize: 24 }} />
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Journal des suppressions</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Localisations supprimées avec justification</Typography>
            </Box>
            <IconButton onClick={() => setDeletionDrawerOpen(false)} sx={{ color: "white" }} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Corps */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
            {deletionLoading && (
              <Box display="flex" justifyContent="center" pt={6}>
                <CircularProgress size={36} sx={{ color: "#991b1b" }} />
              </Box>
            )}
            {deletionError && (
              <Alert severity="error" sx={{ mt: 2 }}>{deletionError}</Alert>
            )}
            {!deletionLoading && !deletionError && deletionLogs.length === 0 && (
              <Box textAlign="center" pt={6}>
                <DeleteForeverIcon sx={{ fontSize: 48, color: "#E2E8F0" }} />
                <Typography color="text.secondary" mt={1}>Aucune suppression enregistrée.</Typography>
              </Box>
            )}
            {!deletionLoading && deletionLogs.map((log, idx) => (
              <Box key={log.id} sx={{ position: "relative", pl: 3, pb: 3, "&::before": idx < deletionLogs.length - 1 ? { content: '""', position: "absolute", left: 9, top: 24, bottom: 0, width: 2, bgcolor: "#FEE2E2" } : {} }}>
                {/* Pastille timeline */}
                <Box sx={{ position: "absolute", left: 0, top: 4, width: 18, height: 18, borderRadius: "50%", bgcolor: "#991b1b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DeleteForeverIcon sx={{ fontSize: 10, color: "white" }} />
                </Box>

                <Paper elevation={0} sx={{ border: "1px solid #FEE2E2", borderRadius: 2, p: 2, bgcolor: "#FFF5F5" }}>
                  {/* Date */}
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {fmt(log.createdAt)}
                  </Typography>

                  <Box display="flex" gap={1} mt={0.75} flexWrap="wrap">
                    {/* Agent */}
                    {log.agentName && (
                      <Chip
                        icon={<PersonIcon sx={{ fontSize: 12 }} />}
                        label={log.agentName}
                        size="small"
                        sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 600, fontSize: 11 }}
                      />
                    )}
                    {/* Rôle */}
                    {log.deletedByRole && (
                      <Chip
                        label={log.deletedByRole}
                        size="small"
                        sx={{ bgcolor: "#F1F5F9", color: "#475569", fontWeight: 600, fontSize: 11 }}
                      />
                    )}
                    {/* Code client */}
                    {log.clientCode && (
                      <Chip
                        label={`Client : ${log.clientCode}`}
                        size="small"
                        sx={{ bgcolor: "#ECFDF5", color: "#15803d", fontWeight: 600, fontSize: 11 }}
                      />
                    )}
                    {/* ID localisation */}
                    {log.locationId && (
                      <Chip
                        label={`#${log.locationId}`}
                        size="small"
                        sx={{ bgcolor: "#F5F3FF", color: "#7c3aed", fontWeight: 600, fontSize: 11 }}
                      />
                    )}
                  </Box>

                  {/* Justification */}
                  {log.justification ? (
                    <Box mt={1.25} sx={{ bgcolor: "#FEE2E2", borderRadius: 1.5, px: 1.5, py: 1 }}>
                      <Typography variant="caption" color="#991b1b" fontWeight={700} display="block">Justification</Typography>
                      <Typography variant="body2" color="#7f1d1d" sx={{ mt: 0.25 }}>{log.justification}</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1, fontStyle: "italic" }}>
                      Aucune justification fournie
                    </Typography>
                  )}

                  {/* Description système */}
                  {log.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      {log.description}
                    </Typography>
                  )}
                </Paper>
              </Box>
            ))}
          </Box>

          {/* Pied */}
          {!deletionLoading && deletionLogs.length > 0 && (
            <Box sx={{ px: 3, py: 1.5, borderTop: "1px solid #FEE2E2" }}>
              <Typography variant="caption" color="text.secondary">
                {deletionLogs.length} suppression{deletionLogs.length > 1 ? "s" : ""} enregistrée{deletionLogs.length > 1 ? "s" : ""}
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
}
