"use client";

import { fetchLocations, fetchLocationHistory, fetchDeletionLogs, fetchLocationPhotos, deleteLocationPhoto } from "@/lib/locations";
import { downloadCsv } from "@/lib/csvExport";
import type { LocationItem, LocationHistoryItem, DeletionLogItem, LocationPhotoItem } from "@/lib/locations";
import { fetchMe } from "@/lib/auth";
import { useThemeMode } from "@/components/ThemeModeContext";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown, Compass, Download, ExternalLink, Filter, History, House, ImageOff, Images, Info, LocateFixed,
  MapPin, Search, ShieldCheck, Trash, Trash2, TriangleAlert, User, Activity, X,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { buildTenantMapHtml } from "@/lib/buildTenantMapHtml";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { HeaderButton, PageHeader } from "@/components/ui/page-blocks";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";

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

const sectionLabel = "mb-3 text-[13px] font-bold uppercase tracking-[0.8px] text-muted-foreground";

function SheetHeader({ icon, title, subtitle, onClose, bg }: { icon: React.ReactNode; title: string; subtitle?: string; onClose: () => void; bg: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-5 text-white" style={{ background: bg }}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <SheetTitle className="text-[15px] font-bold">{title}</SheetTitle>
          {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
        </div>
      </div>
      <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-white/70 hover:text-white"><X size={18} /></button>
    </div>
  );
}

const chip = (bg: string, color: string) => ({ background: bg, color });

export default function LocationsPage() {
  const [page, setPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  // DELETE /location-photos/:id est restreint côté backend à
  // chef_agence/responsable_zone/admin/admin_tenant — les autres rôles
  // superviseurs (directrice_exploitation, responsable_credit, analyste_credit,
  // controleur, audit) qui accèdent aussi à /locations reçoivent un 403 s'ils
  // cliquent ; le bouton est donc masqué pour eux plutôt que de l'exposer.
  const { data: me } = useQuery({ queryKey: ["me-locations"], queryFn: fetchMe });
  const canDeletePhoto = ["chef_agence", "responsable_zone", "admin", "admin_tenant"].includes(
    String(me?.role ?? "").toLowerCase(),
  );

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

  const statsQuery = useQuery({
    queryKey: ["locations-stats"],
    queryFn: () => fetchLocations({ page: 1, limit: 1000 }),
    staleTime: 60_000,
  });
  void statsQuery;

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

  const { mode } = useThemeMode();
  const mapHtml = useMemo(() => buildTenantMapHtml(mapItems, mode === "dark"), [mapItems, mode]);

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
  void openDetail;

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
  void openHistory;

  const kpis = [
    { label: "Total points GPS", value: mapItems.length,   accent: NAVY,      icon: <LocateFixed size={20} /> },
    { label: "Domicile",         value: countDomicileMap,  accent: "#7c3aed", icon: <House size={20} /> },
    { label: "Activité",         value: countActiviteMap,  accent: STEEL,     icon: <Activity size={20} /> },
    { label: "Garantie",         value: countGarantieMap,  accent: "#059669", icon: <ShieldCheck size={20} /> },
  ];

  const legend = [
    { label: "Domicile", color: "#7c3aed" },
    { label: "Activité", color: "#1E6091" },
    { label: "Garantie", color: "#15803d" },
    { label: "Caution",  color: "#b45309" },
    { label: "Autre",    color: "var(--text-secondary)" },
  ];

  return (
    <>
      <PageHeader icon={<LocateFixed size={30} />} title="Localisations" subtitle="Historique des captures GPS des clients">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip title="Exporter les localisations en CSV">
            <HeaderButton onClick={handleExportCsv} disabled={mapItems.length === 0}><Download size={16} /> CSV</HeaderButton>
          </Tooltip>
          <Tooltip title="Journal des suppressions de localisations">
            <button
              type="button"
              onClick={openDeletionAudit}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-red-500/55 bg-transparent px-4 text-sm font-semibold text-red-300 transition-colors hover:border-red-300 hover:bg-red-500/10"
            >
              <Trash size={16} /> Suppressions
            </button>
          </Tooltip>
        </div>
      </PageHeader>

      <div className="flex flex-col bg-background" style={{ height: "calc(100vh / var(--ui-zoom) - 140px)" }}>
        {/* KPIs */}
        <div className="px-6 pb-3 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(15,59,92,0.05)]">
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: kpi.accent }} />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: kpi.accent }}>{kpi.icon}</span>
                <div>
                  <div className="text-xl font-extrabold leading-none" style={{ color: kpi.accent }}>{kpi.value}</div>
                  <div className="text-xs font-medium text-muted-foreground">{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map area */}
        <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
          {/* Left panel — filters */}
          <div className="flex w-[270px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Filter size={16} className="text-[#3C8047]" />
              <span className="text-[13px] font-bold text-foreground">Filtres</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {/* Search with suggestions */}
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Client, opérateur, adresse…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Effacer la recherche"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearch(""); setShowSuggestions(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X size={14} />
                  </button>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-[0_8px_24px_rgba(15,59,92,0.12)]">
                    {suggestions.map((s, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSearch(s.label); setShowSuggestions(false); }}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-background ${idx < suggestions.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <span
                          className="flex size-[26px] shrink-0 items-center justify-center rounded-md"
                          style={chip(s.type === "client" ? "#EFF6FF" : s.type === "operator" ? "#F0FDF4" : "#FAF5FF", s.type === "client" ? STEEL : s.type === "operator" ? "#15803d" : "#7c3aed")}
                        >
                          {s.type === "address" ? <MapPin size={14} /> : <User size={14} />}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">{s.label}</div>
                          {s.sub && <div className="truncate text-[10px] text-muted-foreground">{s.sub}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Select aria-label="Type de localisation" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {LOCATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <Field label="Du"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
              <Field label="Au"><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
              {hasFilters && (
                <Button size="sm" variant="ghost" className="justify-start font-semibold text-muted-foreground" onClick={resetFilters}>
                  <X size={14} /> Effacer les filtres
                </Button>
              )}

              <div className="mt-2 border-t border-border pt-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.8px] text-muted-foreground">Points affichés</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  {mapQuery.isFetching
                    ? <Spinner className="size-3.5 text-[#1E6091]" />
                    : <span className="rounded-full bg-muted px-2 text-[11px] font-bold leading-5 text-foreground">{mapItems.length.toLocaleString("fr-FR")}</span>}
                </div>
              </div>

              {/* Légende types */}
              <div className="border-t border-border pt-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.8px] text-muted-foreground">Légende</div>
                {legend.map((t) => (
                  <div key={t.label} className="mb-1.5 flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,.3)]" style={{ background: t.color }} />
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leaflet map */}
          <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-[#E8ECF0]">
            {mapQuery.isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60"><Spinner className="size-8 text-[#1E6091]" /></div>
            )}
            {mapItems.length === 0 && !mapQuery.isFetching && (
              <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3">
                <LocateFixed size={48} className="text-border-strong" />
                <span className="text-sm text-muted-foreground">Aucune localisation GPS à afficher</span>
              </div>
            )}
            <iframe
              key={`map-${typeFilter}-${search}-${dateFrom}-${dateTo}-${mapItems.length}`}
              srcDoc={mapHtml}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              title="Carte GPS localisations"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>

      {/* Drawer — historique des modifications */}
      <Sheet open={!!historyLocation} onOpenChange={(o) => !o && setHistoryLocation(null)}>
        <SheetContent width={480} className="bg-background">
          <SheetHeader
            bg={NAVY}
            icon={<History size={22} className="text-[#3C8047]" />}
            title="Historique des modifications"
            subtitle={historyLocation?.clientName ?? historyLocation?.clientCode ?? `#${historyLocation?.id}`}
            onClose={() => setHistoryLocation(null)}
          />
          <div className="flex-1 overflow-y-auto p-5">
            {historyLoading && <div className="flex justify-center py-12"><Spinner className="size-7 text-[#1E6091]" /></div>}
            {historyError && <Alert severity="error" className="mb-4">{historyError}</Alert>}
            {!historyLoading && !historyError && historyItems.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
                <History size={48} className="opacity-20" />
                <span className="text-sm font-medium">Aucune modification enregistree pour cette localisation.</span>
              </div>
            )}
            {!historyLoading && historyItems.map((h, idx) => (
              <div key={h.id} className="mb-4 flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1E6091] text-white"><ArrowUpDown size={15} /></span>
                  {idx < historyItems.length - 1 && <span className="my-1 min-h-5 w-0.5 flex-1 bg-border" />}
                </div>
                <div className="mb-1 flex-1 rounded-lg border border-border bg-surface p-4">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-1">
                    <span className="rounded-full bg-blue-50 px-2 text-[10px] font-bold leading-5 text-[#1E6091]">{h.action ?? "Modification"}</span>
                    <span className="text-xs text-muted-foreground">{fmt(h.modifiedAt)}</span>
                  </div>
                  {h.modifiedByName && <div className="mb-2 text-xs text-muted-foreground">par <strong>{h.modifiedByName}</strong></div>}
                  {(h.oldLatitude != null || h.newLatitude != null) && (
                    <div className="mt-1 rounded-md bg-background p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.8px] text-muted-foreground">Coordonnees</div>
                      {h.oldLatitude != null && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="min-w-[50px] text-xs text-muted-foreground">Avant</span>
                          <span className="font-mono text-xs text-muted-foreground">{h.oldLatitude?.toFixed(5)}, {h.oldLongitude?.toFixed(5)}</span>
                        </div>
                      )}
                      {h.newLatitude != null && (
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-[50px] text-xs font-bold text-green-600">Apres</span>
                          <span className="font-mono text-xs font-semibold text-green-600">{h.newLatitude?.toFixed(5)}, {h.newLongitude?.toFixed(5)}</span>
                          <Tooltip title="Voir sur Google Maps">
                            <a href={`https://www.google.com/maps?q=${h.newLatitude},${h.newLongitude}`} target="_blank" rel="noopener noreferrer" aria-label="Voir sur Google Maps" className="p-0.5 text-muted-foreground hover:text-[#1A73E8]">
                              <ExternalLink size={13} />
                            </a>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Drawer — détail localisation (metadata + photos) */}
      <Sheet open={!!detailLocation} onOpenChange={(o) => !o && setDetailLocation(null)}>
        <SheetContent width={540} className="bg-background">
          <SheetHeader
            bg={NAVY}
            icon={<Info size={22} className="text-[#3C8047]" />}
            title="Détail de la localisation"
            subtitle={detailLocation?.clientName ?? detailLocation?.clientCode ?? `#${detailLocation?.id}`}
            onClose={() => setDetailLocation(null)}
          />
          <div className="flex-1 overflow-y-auto p-5">
            {/* ── Metadata formulaire terrain ── */}
            <div className={sectionLabel}>Données terrain</div>
            {(!detailLocation?.metadata || Object.keys(detailLocation.metadata).length === 0) ? (
              <div className="mb-6 rounded-lg border border-border bg-surface p-5 text-center text-sm italic text-muted-foreground">
                Aucune donnée terrain enregistrée pour cette localisation.
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-border bg-surface p-4">
                {Object.entries(detailLocation.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-3 border-b border-border py-1.5 last:border-b-0">
                    <span className="min-w-[140px] shrink-0 break-words text-xs font-bold text-muted-foreground">{key}</span>
                    <span className="flex-1 break-words text-sm text-foreground">
                      {value === null || value === undefined ? <span className="text-border-strong">—</span>
                        : typeof value === "object" ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Photos de capture ── */}
            <div className="mb-3 flex items-center gap-2">
              <Images size={16} className="text-muted-foreground" />
              <span className="text-[13px] font-bold uppercase tracking-[0.8px] text-muted-foreground">Photos de capture</span>
              {!detailPhotosLoading && <span className="rounded-full bg-muted px-2 text-[11px] leading-[18px] text-foreground">{detailPhotos.length}</span>}
            </div>

            {detailPhotosLoading && <div className="flex justify-center py-8"><Spinner className="size-6 text-[#1E6091]" /></div>}
            {detailPhotosError && <Alert severity="error" className="mb-4">{detailPhotosError}</Alert>}

            {!detailPhotosLoading && !detailPhotosError && detailPhotos.length === 0 && (
              <div className="rounded-lg border border-border bg-surface p-5 text-center">
                <ImageOff size={36} className="mx-auto mb-1 text-border" />
                <span className="text-sm italic text-muted-foreground">Aucune photo associée à cette localisation.</span>
              </div>
            )}

            {!detailPhotosLoading && detailPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {detailPhotos.map((photo) => {
                  // Nouveau format : file_name = chemin relatif à /uploads
                  // (cloisonné par tenant) ; ancien format : nom nu à plat.
                  const photoUrl = photo.file_name.includes("/")
                    ? `/proxy/uploads/${photo.file_name}`
                    : `/proxy/uploads/location-photos/${photo.file_name}`;
                  const sizekb = (photo.size / 1024).toFixed(1);
                  const isDeleting = deletingPhotoId === photo.id;
                  return (
                    <div key={photo.id} className="relative overflow-hidden rounded-lg border border-border bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt={photo.original_name}
                        style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="px-3 py-2">
                        <div className="truncate text-xs font-medium text-muted-foreground" title={photo.original_name}>{photo.original_name}</div>
                        <span className="text-xs text-muted-foreground">{sizekb} Ko · {fmt(photo.uploaded_at)}</span>
                      </div>
                      {canDeletePhoto && (
                        <Tooltip title="Supprimer cette photo">
                          <button
                            type="button"
                            aria-label="Supprimer cette photo"
                            disabled={isDeleting}
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute right-1.5 top-1.5 flex size-[26px] cursor-pointer items-center justify-center rounded-full border-0 bg-black/50 text-white hover:bg-red-600 disabled:bg-black/30"
                          >
                            {isDeleting ? <Spinner className="size-3" /> : <Trash2 size={14} />}
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Drawer — journal des suppressions */}
      <Sheet open={deletionDrawerOpen} onOpenChange={setDeletionDrawerOpen}>
        <SheetContent width={520}>
          <SheetHeader
            bg="linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"
            icon={<Trash size={24} />}
            title="Journal des suppressions"
            subtitle="Localisations supprimées avec justification"
            onClose={() => setDeletionDrawerOpen(false)}
          />
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {deletionLoading && <div className="flex justify-center pt-12"><Spinner className="size-9 text-red-800" /></div>}
            {deletionError && <Alert severity="error" className="mt-4">{deletionError}</Alert>}
            {!deletionLoading && !deletionError && deletionLogs.length === 0 && (
              <div className="pt-12 text-center">
                <Trash size={48} className="mx-auto text-border" />
                <p className="mt-2 text-muted-foreground">Aucune suppression enregistrée.</p>
              </div>
            )}
            {!deletionLoading && deletionLogs.map((log, idx) => (
              <div key={log.id} className="relative pb-6 pl-6">
                {idx < deletionLogs.length - 1 && <span className="absolute bottom-0 left-[9px] top-6 w-0.5 bg-red-100" />}
                {/* Pastille timeline */}
                <span className="absolute left-0 top-1 flex size-[18px] items-center justify-center rounded-full bg-red-800 text-white"><Trash size={10} /></span>

                <div className="rounded-lg border border-red-100 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                  <span className="text-xs font-semibold text-muted-foreground">{fmt(log.createdAt)}</span>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {log.agentName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 text-[11px] font-semibold leading-5 text-[#1E6091]"><User size={12} /> {log.agentName}</span>
                    )}
                    {log.deletedByRole && <span className="rounded-full bg-muted px-2 text-[11px] font-semibold leading-5 text-muted-foreground">{log.deletedByRole}</span>}
                    {log.clientCode && <span className="rounded-full bg-emerald-50 px-2 text-[11px] font-semibold leading-5 text-green-700">Client : {log.clientCode}</span>}
                    {log.locationId && <span className="rounded-full bg-violet-50 px-2 text-[11px] font-semibold leading-5 text-violet-600">#{log.locationId}</span>}
                  </div>

                  {log.justification ? (
                    <div className="mt-3 rounded-md bg-red-100 px-3 py-2 dark:bg-red-950/40">
                      <div className="text-xs font-bold text-red-800 dark:text-red-300">Justification</div>
                      <div className="mt-0.5 text-sm text-red-900 dark:text-red-200">{log.justification}</div>
                    </div>
                  ) : (
                    <span className="mt-2 block text-xs italic text-muted-foreground">Aucune justification fournie</span>
                  )}

                  {log.description && <span className="mt-2 block text-xs text-muted-foreground">{log.description}</span>}
                </div>
              </div>
            ))}
          </div>

          {!deletionLoading && deletionLogs.length > 0 && (
            <div className="border-t border-red-100 px-6 py-3">
              <span className="text-xs text-muted-foreground">
                {deletionLogs.length} suppression{deletionLogs.length > 1 ? "s" : ""} enregistrée{deletionLogs.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
