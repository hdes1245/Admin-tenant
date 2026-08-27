"use client";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockIcon from "@mui/icons-material/Lock";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TicketDto } from "@/lib/tickets";
import { useMemo, useRef, useState } from "react";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

// ── Computed stats ─────────────────────────────────────────────────────────────

function computeStats(tickets: TicketDto[]) {
  const now = Date.now();
  const DAY = 86400000;

  // Status counts
  const byStatus = {
    open:         tickets.filter((t) => t.status === "open").length,
    in_progress:  tickets.filter((t) => t.status === "in_progress").length,
    waiting_user: tickets.filter((t) => t.status === "waiting_user").length,
    resolved:     tickets.filter((t) => t.status === "resolved").length,
    closed:       tickets.filter((t) => t.status === "closed").length,
  };

  // Severity counts
  const bySeverity = {
    urgent: tickets.filter((t) => t.severity === "urgent").length,
    eleve:  tickets.filter((t) => t.severity === "eleve").length,
    moyen:  tickets.filter((t) => t.severity === "moyen").length,
    faible: tickets.filter((t) => t.severity === "faible").length,
  };

  // Resolution rate
  const resolved = byStatus.resolved + byStatus.closed;
  const resolutionRate = tickets.length > 0 ? Math.round((resolved / tickets.length) * 100) : 0;

  // Avg resolution time for resolved/closed tickets
  const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");
  const avgResolutionMs = resolvedTickets.length > 0
    ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()), 0) / resolvedTickets.length
    : 0;
  const avgResolutionDays = (avgResolutionMs / DAY).toFixed(1);

  // Age buckets for open + in_progress tickets
  const activeTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const ageBuckets = { "<1j": 0, "1-7j": 0, "8-30j": 0, ">30j": 0 };
  activeTickets.forEach((t) => {
    const ageDays = (now - new Date(t.createdAt).getTime()) / DAY;
    if (ageDays < 1)       ageBuckets["<1j"]++;
    else if (ageDays < 7)  ageBuckets["1-7j"]++;
    else if (ageDays < 30) ageBuckets["8-30j"]++;
    else                   ageBuckets[">30j"]++;
  });

  // Waiting user tickets — sorted by how long they've been waiting (updatedAt)
  const waitingTickets = tickets
    .filter((t) => t.status === "waiting_user")
    .map((t) => ({ ...t, waitingDays: (now - new Date(t.updatedAt).getTime()) / DAY }))
    .sort((a, b) => b.waitingDays - a.waitingDays);

  // Open tickets with no IT action (updatedAt == createdAt roughly = never touched)
  const untouchedTickets = tickets
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .map((t) => ({
      ...t,
      ageDays: (now - new Date(t.createdAt).getTime()) / DAY,
      touchedDays: Math.abs(new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / DAY,
    }))
    .filter((t) => t.touchedDays < 0.01) // never updated = never touched
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 10);

  // Tickets by month (last 6 months)
  const monthsMap: Record<string, number> = {};
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    monthsMap[key] = 0;
  }
  tickets.forEach((t) => {
    const d = new Date(t.createdAt);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    if (key in monthsMap) monthsMap[key]++;
  });

  // Category breakdown
  const catMap: Record<string, number> = {};
  tickets.forEach((t) => {
    const cat = t.category ?? "Non catégorisé";
    catMap[cat] = (catMap[cat] ?? 0) + 1;
  });

  // Resolved tickets with resolution time — sorted fastest first
  const resolvedList = tickets
    .filter((t) => t.status === "resolved" || t.status === "closed")
    .map((t) => ({
      ...t,
      resolutionDays: (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / DAY,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Resolution time buckets for resolved tickets
  const resTimeBuckets = { "<1j": 0, "1-7j": 0, "8-30j": 0, ">30j": 0 };
  resolvedList.forEach((t) => {
    if (t.resolutionDays < 1)       resTimeBuckets["<1j"]++;
    else if (t.resolutionDays < 7)  resTimeBuckets["1-7j"]++;
    else if (t.resolutionDays < 30) resTimeBuckets["8-30j"]++;
    else                             resTimeBuckets[">30j"]++;
  });

  // In-progress tickets with age
  const inProgressList = tickets
    .filter((t) => t.status === "in_progress")
    .map((t) => ({
      ...t,
      ageDays: (now - new Date(t.createdAt).getTime()) / DAY,
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  // Fastest & slowest resolutions
  const sortedByResTime = [...resolvedList].sort((a, b) => a.resolutionDays - b.resolutionDays);
  const fastestResolution = sortedByResTime[0] ?? null;
  const slowestResolution = sortedByResTime[sortedByResTime.length - 1] ?? null;

  return {
    total: tickets.length,
    byStatus,
    bySeverity,
    resolutionRate,
    avgResolutionDays,
    ageBuckets,
    waitingTickets,
    untouchedTickets,
    monthsMap,
    catMap,
    resolved,
    resolvedList,
    resTimeBuckets,
    inProgressList,
    fastestResolution,
    slowestResolution,
  };
}

// ── Stat KPI card ──────────────────────────────────────────────────────────────
function StatKpi({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Box
      sx={{
        bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)",
        px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5,
        position: "relative", overflow: "hidden",
        "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: color },
      }}
    >
      <Avatar sx={{ width: 40, height: 40, bgcolor: color + "18", color, flexShrink: 0 }}>{icon}</Avatar>
      <Box>
        <Typography fontWeight={800} fontSize={22} sx={{ color, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
        {sub && <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block", fontSize: 10.5 }}>{sub}</Typography>}
      </Box>
    </Box>
  );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function HBar({ label, value, max, color, total }: { label: string; value: number; max: number; color: string; total: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
      <Typography variant="caption" sx={{ minWidth: 110, color: "var(--text-secondary)", fontWeight: 500, fontSize: 12 }}>{label}</Typography>
      <Box flex={1} sx={{ height: 10, bgcolor: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: 5, transition: "width 0.6s ease" }} />
      </Box>
      <Typography variant="caption" sx={{ minWidth: 28, textAlign: "right", fontWeight: 700, color, fontSize: 12 }}>{value}</Typography>
      {total > 0 && (
        <Typography variant="caption" sx={{ minWidth: 36, color: "var(--text-muted)", fontSize: 11 }}>
          {Math.round((value / total) * 100)}%
        </Typography>
      )}
    </Box>
  );
}

// ── PDF generation ─────────────────────────────────────────────────────────────
function generatePdf(tickets: TicketDto[], tenantName?: string, dateRange?: { from: string; to: string }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require("jspdf");
  const s = computeStats(tickets);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const periodLabel = dateRange?.from && dateRange?.to
    ? `Période : du ${fmtDate(dateRange.from)} au ${fmtDate(dateRange.to)}`
    : dateRange?.from
    ? `À partir du ${fmtDate(dateRange.from)}`
    : dateRange?.to
    ? `Jusqu'au ${fmtDate(dateRange.to)}`
    : "Toute la période";

  // ── helpers ──────────────────────────────────────────────────────────────────
  const hex2rgb = (hex: string): [number, number, number] => {
    const clean = hex.startsWith("#") && hex.length >= 7 ? hex : "#000000";
    const r = parseInt(clean.slice(1, 3), 16) || 0;
    const g = parseInt(clean.slice(3, 5), 16) || 0;
    const b = parseInt(clean.slice(5, 7), 16) || 0;
    return [r, g, b];
  };
  const setFill = (hex: string) => { const [r, g, b] = hex2rgb(hex); doc.setFillColor(r, g, b); };
  const setDraw = (hex: string) => { const [r, g, b] = hex2rgb(hex); doc.setDrawColor(r, g, b); };
  const setTxt  = (hex: string) => { const [r, g, b] = hex2rgb(hex); doc.setTextColor(r, g, b); };

  const kpiBox = (x: number, y: number, w: number, label: string, value: string | number, sub: string, accentHex: string) => {
    setFill("#FFFFFF"); setDraw("#E2E8F0");
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 22, 2, 2, "FD");
    // accent bar
    setFill(accentHex);
    doc.roundedRect(x, y, 3, 22, 1, 1, "F");
    // value
    setTxt(accentHex);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(String(value), x + 8, y + 9);
    // label
    setTxt("#334155");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label, x + 8, y + 15);
    // sub
    if (sub) {
      setTxt("#94A3B8");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(sub, x + 8, y + 19.5);
    }
  };

  const hBarRow = (x: number, y: number, label: string, value: number, maxVal: number, total: number, colorHex: string) => {
    const BAR_W = 65;
    const pct = maxVal > 0 ? (value / maxVal) : 0;
    setTxt("#475569");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, x, y + 3.5);
    setFill("#F1F5F9");
    doc.roundedRect(x + 52, y, BAR_W, 5, 1, 1, "F");
    if (pct > 0) {
      setFill(colorHex);
      doc.roundedRect(x + 52, y, BAR_W * pct, 5, 1, 1, "F");
    }
    setTxt(colorHex);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(String(value), x + 122, y + 3.5);
    setTxt("#94A3B8");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    if (total > 0) doc.text(`${Math.round((value / total) * 100)}%`, x + 132, y + 3.5);
    return y + 8;
  };

  const sectionTitle = (x: number, y: number, title: string) => {
    setFill("#F8FAFC"); setDraw("#E2E8F0");
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, W - 2 * x, 7, 1, 1, "FD");
    setFill(GOLD);
    doc.rect(x, y, 3, 7, "F");
    setTxt(NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), x + 7, y + 4.7);
    return y + 10;
  };

  const pageHeader = (pageNum: number, subtitle: string) => {
    // Navy banner — 38mm pour loger toutes les infos
    setFill(NAVY);
    doc.rect(0, 0, W, 38, "F");
    // Gold bar top
    setFill(GOLD);
    doc.rect(0, 0, W, 2.5, "F");

    // ── Colonne gauche ────────────────────────────────────────
    // Titre
    setTxt("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RAPPORT TICKETS IT", 15, 15);
    // Sous-titre (section)
    setTxt("#94A3B8");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(subtitle, 15, 23);
    // Période (en or, en bas à gauche)
    setTxt(GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(periodLabel, 15, 32);

    // ── Colonne droite ────────────────────────────────────────
    setTxt("#94A3B8");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Généré le ${today}`, W - 15, 15, { align: "right" });
    if (tenantName) {
      doc.text(`Tenant : ${tenantName}`, W - 15, 22, { align: "right" });
    }
    // Numéro de page (en bas à droite)
    setTxt("#94A3B8");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Page ${pageNum}`, W - 15, 32, { align: "right" });

    // Footer
    setFill("#F1F5F9");
    doc.rect(0, H - 8, W, 8, "F");
    setTxt("#94A3B8");
    doc.setFontSize(7);
    doc.text("GeoTrust · Rapport confidentiel", 15, H - 3.5);
    doc.text(`${s.total} tickets analysés`, W - 15, H - 3.5, { align: "right" });
  };

  // ═══════════════════════════════════════════════════════
  // PAGE 1 — Vue d'ensemble
  // ═══════════════════════════════════════════════════════
  pageHeader(1, "Vue d'ensemble · Répartition des tickets");

  let y = 44; // start below 38mm header + 6mm margin

  // KPI row
  const kW = (W - 30 - 3 * 4) / 4;
  kpiBox(15, y,      kW, "Total tickets",     s.total,          `${s.resolved} résolus`,       "#64748B");
  kpiBox(15 + kW + 4, y, kW, "Taux de résolution", `${s.resolutionRate}%`, `${s.resolved}/${s.total}`, "#16a34a");
  kpiBox(15 + (kW + 4) * 2, y, kW, "Délai moy. résolution", `${s.avgResolutionDays}j`, "tickets résolus/fermés", STEEL);
  kpiBox(15 + (kW + 4) * 3, y, kW, "En attente util.", s.byStatus.waiting_user, "sans réponse utilisateur", "#7c3aed");
  y += 28;

  // Status distribution
  y = sectionTitle(15, y, "Répartition par statut");
  const statusRows: [string, number, string][] = [
    ["Ouvert",                           s.byStatus.open,         "#d97706"],
    ["En cours",                         s.byStatus.in_progress,  STEEL],
    ["En attente réponse utilisateur",   s.byStatus.waiting_user, "#7c3aed"],
    ["Résolu",                           s.byStatus.resolved,     "#16a34a"],
    ["Fermé",                            s.byStatus.closed,       "#64748B"],
  ];
  const maxStatus = Math.max(...statusRows.map(([, v]) => v), 1);
  statusRows.forEach(([label, val, color]) => {
    y = hBarRow(15, y, label, val, maxStatus, s.total, color);
  });
  y += 4;

  // Severity distribution
  y = sectionTitle(15, y, "Répartition par sévérité");
  const sevRows: [string, number, string][] = [
    ["Urgent", s.bySeverity.urgent, "#dc2626"],
    ["Élevé",  s.bySeverity.eleve,  "#d97706"],
    ["Moyen",  s.bySeverity.moyen,  STEEL],
    ["Faible", s.bySeverity.faible, "#64748B"],
  ];
  const maxSev = Math.max(...sevRows.map(([, v]) => v), 1);
  sevRows.forEach(([label, val, color]) => {
    y = hBarRow(15, y, label, val, maxSev, s.total, color);
  });
  y += 4;

  // Category distribution
  const catEntries = Object.entries(s.catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (catEntries.length > 0) {
    y = sectionTitle(15, y, "Répartition par catégorie");
    const maxCat = Math.max(...catEntries.map(([, v]) => v), 1);
    const CAT_COLORS = [NAVY, STEEL, "#0369a1", "#0891b2", "#0d9488", "#059669"];
    catEntries.forEach(([cat, val], i) => {
      y = hBarRow(15, y, cat, val, maxCat, s.total, CAT_COLORS[i] ?? STEEL);
    });
    y += 4;
  }

  // Monthly volume
  const monthEntries = Object.entries(s.monthsMap);
  if (monthEntries.length > 0) {
    y = sectionTitle(15, y, "Volume de tickets par mois (6 derniers mois)");
    const maxMonth = Math.max(...monthEntries.map(([, v]) => v), 1);
    monthEntries.forEach(([month, val]) => {
      y = hBarRow(15, y, month, val, maxMonth, s.total, NAVY);
    });
  }

  // ═══════════════════════════════════════════════════════
  // PAGE 2 — Délais et tickets critiques
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  pageHeader(2, "Analyse des délais · Tickets sans réponse");
  y = 44;

  // Age buckets for open tickets
  y = sectionTitle(15, y, "Ancienneté des tickets ouverts / en cours");
  const ageRows: [string, number, string][] = [
    ["Moins de 1 jour",  s.ageBuckets["<1j"],   "#16a34a"],
    ["1 à 7 jours",      s.ageBuckets["1-7j"],  GOLD],
    ["8 à 30 jours",     s.ageBuckets["8-30j"], "#d97706"],
    ["Plus de 30 jours", s.ageBuckets[">30j"],  "#dc2626"],
  ];
  const maxAge = Math.max(...ageRows.map(([, v]) => v), 1);
  const activeCount = s.byStatus.open + s.byStatus.in_progress;
  ageRows.forEach(([label, val, color]) => {
    y = hBarRow(15, y, label, val, maxAge, activeCount, color);
  });
  y += 6;

  // Waiting user tickets table
  if (s.waitingTickets.length > 0) {
    y = sectionTitle(15, y, `Tickets en attente de réponse utilisateur (${s.waitingTickets.length})`);

    // Table header
    setFill(NAVY);
    doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    setTxt("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Titre",        18, y + 4.5);
    doc.text("Demandeur",    90, y + 4.5);
    doc.text("Attente",     135, y + 4.5);
    doc.text("Sévérité",    165, y + 4.5);
    y += 7;

    const sevColors: Record<string, string> = { urgent: "#dc2626", eleve: "#d97706", moyen: STEEL, faible: "#64748B" };
    s.waitingTickets.slice(0, 10).forEach((t, i) => {
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      setFill(rowBg); setDraw("#E2E8F0");
      doc.setLineWidth(0.15);
      doc.rect(15, y, W - 30, 6.5, "FD");

      const title = t.title.length > 38 ? t.title.slice(0, 35) + "…" : t.title;
      const req   = (t.requesterName ?? "Inconnu").slice(0, 20);
      const wait  = `${Math.ceil(t.waitingDays)}j`;
      const sev   = t.severity;

      setTxt("#1E293B");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(title, 18, y + 4.2);
      doc.text(req, 90, y + 4.2);

      setTxt("#7c3aed");
      doc.setFont("helvetica", "bold");
      doc.text(wait, 135, y + 4.2);

      setTxt(sevColors[sev] ?? STEEL);
      doc.text(sev.charAt(0).toUpperCase() + sev.slice(1), 165, y + 4.2);
      y += 6.5;
    });
    y += 6;
  }

  // Untouched tickets table
  if (s.untouchedTickets.length > 0) {
    y = sectionTitle(15, y, `Tickets jamais traités (ouverts, aucune action IT) — ${s.untouchedTickets.length}`);

    setFill(NAVY); doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    setTxt("#FFFFFF");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text("Titre", 18, y + 4.5);
    doc.text("Demandeur", 90, y + 4.5);
    doc.text("Age", 135, y + 4.5);
    doc.text("Sévérité", 165, y + 4.5);
    y += 7;

    const sevColors: Record<string, string> = { urgent: "#dc2626", eleve: "#d97706", moyen: STEEL, faible: "#64748B" };
    s.untouchedTickets.forEach((t, i) => {
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      setFill(rowBg); setDraw("#E2E8F0");
      doc.setLineWidth(0.15);
      doc.rect(15, y, W - 30, 6.5, "FD");

      const title = t.title.length > 38 ? t.title.slice(0, 35) + "…" : t.title;
      const req   = (t.requesterName ?? "Inconnu").slice(0, 20);
      const age   = `${Math.ceil(t.ageDays)}j`;

      setTxt("#1E293B"); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text(title, 18, y + 4.2);
      doc.text(req, 90, y + 4.2);
      setTxt("#dc2626"); doc.setFont("helvetica", "bold");
      doc.text(age, 135, y + 4.2);
      setTxt(sevColors[t.severity] ?? STEEL);
      doc.text(t.severity.charAt(0).toUpperCase() + t.severity.slice(1), 165, y + 4.2);
      y += 6.5;
    });
    y += 6;
  }

  // ═══════════════════════════════════════════════════════
  // PAGE 3 — Liste complète tickets ouverts
  // ═══════════════════════════════════════════════════════
  const openTickets = tickets
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (openTickets.length > 0) {
    doc.addPage();
    pageHeader(3, "Liste des tickets ouverts · classés par ancienneté");
    y = 44;

    y = sectionTitle(15, y, `Tickets ouverts et en cours (${openTickets.length})`);

    // Table header
    setFill(NAVY); doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    setTxt("#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text("#",         18,  y + 4.5);
    doc.text("Titre",     26,  y + 4.5);
    doc.text("Demandeur", 90,  y + 4.5);
    doc.text("Statut",   125,  y + 4.5);
    doc.text("Sévérité", 152,  y + 4.5);
    doc.text("Age",      175,  y + 4.5);
    doc.text("Créé le",  187,  y + 4.5);
    y += 7;

    const sevColors: Record<string, string> = { urgent: "#dc2626", eleve: "#d97706", moyen: STEEL, faible: "#64748B" };
    const stColors: Record<string, string> = {
      open: "#d97706", in_progress: STEEL, waiting_user: "#7c3aed", resolved: "#16a34a", closed: "#64748B",
    };
    const stLabels: Record<string, string> = {
      open: "Ouvert", in_progress: "En cours", waiting_user: "Att. util.", resolved: "Résolu", closed: "Fermé",
    };

    const DAY = 86400000;
    const now = Date.now();

    openTickets.forEach((t, i) => {
      if (y > H - 20) {
        doc.addPage();
        pageHeader(4, "Liste des tickets ouverts (suite)");
        y = 44;
      }
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      setFill(rowBg); setDraw("#E2E8F0"); doc.setLineWidth(0.15);
      doc.rect(15, y, W - 30, 6.5, "FD");

      const title  = t.title.length > 32 ? t.title.slice(0, 29) + "…" : t.title;
      const req    = (t.requesterName ?? "—").slice(0, 18);
      const age    = `${Math.ceil((now - new Date(t.createdAt).getTime()) / DAY)}j`;
      const createdStr = new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

      setTxt("#94A3B8"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(`#${t.id}`, 18, y + 4.2);
      setTxt("#1E293B"); doc.setFontSize(7.5);
      doc.text(title, 26, y + 4.2);
      doc.text(req, 90, y + 4.2);
      setTxt(stColors[t.status] ?? STEEL); doc.setFont("helvetica", "bold");
      doc.text(stLabels[t.status] ?? t.status, 125, y + 4.2);
      setTxt(sevColors[t.severity] ?? STEEL);
      doc.text(t.severity.charAt(0).toUpperCase() + t.severity.slice(1), 152, y + 4.2);
      setTxt(age.includes("30") || parseInt(age) > 30 ? "#dc2626" : "#475569");
      doc.text(age, 175, y + 4.2);
      setTxt("#94A3B8"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(createdStr, 187, y + 4.2);
      y += 6.5;
    });
  }

  // ═══════════════════════════════════════════════════════
  // PAGE 4 — Tickets traités (résolus + fermés)
  // ═══════════════════════════════════════════════════════
  if (s.resolvedList.length > 0) {
    doc.addPage();
    pageHeader(4, "Tickets traités · Résolus & Fermés");
    y = 44;

    // Délai de résolution buckets
    y = sectionTitle(15, y, "Délai de résolution des tickets traités");
    const resRows: [string, number, string][] = [
      ["Moins de 1 jour",  s.resTimeBuckets["<1j"],   "#16a34a"],
      ["1 à 7 jours",      s.resTimeBuckets["1-7j"],  GOLD],
      ["8 à 30 jours",     s.resTimeBuckets["8-30j"], "#d97706"],
      ["Plus de 30 jours", s.resTimeBuckets[">30j"],  "#dc2626"],
    ];
    const maxRes = Math.max(...resRows.map(([, v]) => v), 1);
    resRows.forEach(([label, val, color]) => {
      y = hBarRow(15, y, label, val, maxRes, s.resolvedList.length, color);
    });

    // Records (sans emoji — non supportés par Helvetica dans jsPDF)
    if (s.fastestResolution) {
      y += 3;
      const halfW = (W - 30) / 2 - 3;

      // Carte "Plus rapide"
      setFill("#F0FDF4"); setDraw("#BBF7D0"); doc.setLineWidth(0.3);
      doc.roundedRect(15, y, halfW, 16, 2, 2, "FD");
      // badge vert
      setFill("#16a34a"); doc.roundedRect(15, y, 3, 16, 1, 1, "F");
      setTxt("#15803d"); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text("RESOLUTION LA PLUS RAPIDE", 22, y + 5.5);
      setTxt("#1E293B"); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      const ft = s.fastestResolution.title.length > 32 ? s.fastestResolution.title.slice(0, 29) + "..." : s.fastestResolution.title;
      doc.text(ft, 22, y + 11);
      setTxt("#15803d"); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(`${s.fastestResolution.resolutionDays < 1 ? Math.round(s.fastestResolution.resolutionDays * 24) + "h" : s.fastestResolution.resolutionDays.toFixed(1) + "j"}`, 15 + halfW - 4, y + 11, { align: "right" });

      // Carte "Plus longue"
      if (s.slowestResolution && s.slowestResolution.id !== s.fastestResolution.id) {
        setFill("#FFF7ED"); setDraw("#FED7AA"); doc.setLineWidth(0.3);
        doc.roundedRect(W / 2 + 3, y, halfW, 16, 2, 2, "FD");
        setFill("#d97706"); doc.roundedRect(W / 2 + 3, y, 3, 16, 1, 1, "F");
        setTxt("#b45309"); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.text("RESOLUTION LA PLUS LONGUE", W / 2 + 10, y + 5.5);
        setTxt("#1E293B"); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
        const sl = s.slowestResolution.title.length > 32 ? s.slowestResolution.title.slice(0, 29) + "..." : s.slowestResolution.title;
        doc.text(sl, W / 2 + 10, y + 11);
        setTxt("#b45309"); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(`${s.slowestResolution.resolutionDays.toFixed(1)}j`, W - 18, y + 11, { align: "right" });
      }
      y += 22;
    }

    // Table — colonnes recalculées pour tenir dans 180mm (W-30)
    // #(8) | Titre(56) | Demandeur(38) | Statut(20) | Sévérité(20) | Délai(18) | Résolu le(20)
    // x :  15  23       79              117          137            157         175
    y = sectionTitle(15, y, `Liste des tickets traités (${s.resolvedList.length})`);
    setFill(NAVY); doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    setTxt("#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text("#",          18,  y + 4.5);
    doc.text("Titre",      24,  y + 4.5);
    doc.text("Demandeur",  80,  y + 4.5);
    doc.text("Statut",    118,  y + 4.5);
    doc.text("Severite",  138,  y + 4.5);
    doc.text("Delai",     158,  y + 4.5);
    doc.text("Resolu le", 176,  y + 4.5);
    y += 7;

    const sevC: Record<string, string> = { urgent: "#dc2626", eleve: "#d97706", moyen: STEEL, faible: "#64748B" };
    let pageNum = 4;

    s.resolvedList.forEach((t, i) => {
      if (y > H - 20) {
        doc.addPage();
        pageNum++;
        pageHeader(pageNum, "Tickets traités (suite)");
        y = 44;
      }
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      setFill(rowBg); setDraw("#E2E8F0"); doc.setLineWidth(0.15);
      doc.rect(15, y, W - 30, 6.5, "FD");

      const title = t.title.length > 28 ? t.title.slice(0, 25) + "..." : t.title;
      const req   = (t.requesterName ?? "-").slice(0, 16);
      const resolvedStr = new Date(t.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
      const delay = t.resolutionDays < 1
        ? `${Math.round(t.resolutionDays * 24)}h`
        : `${t.resolutionDays.toFixed(1)}j`;
      const delayColor = t.resolutionDays < 1 ? "#16a34a" : t.resolutionDays < 7 ? GOLD : t.resolutionDays < 30 ? "#d97706" : "#dc2626";

      setTxt("#94A3B8"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(`#${t.id}`, 18, y + 4.2);
      setTxt("#1E293B"); doc.setFontSize(7.5);
      doc.text(title, 24, y + 4.2);
      doc.text(req, 80, y + 4.2);
      setTxt(t.status === "resolved" ? "#16a34a" : "#64748B"); doc.setFont("helvetica", "bold");
      doc.text(t.status === "resolved" ? "Resolu" : "Ferme", 118, y + 4.2);
      setTxt(sevC[t.severity] ?? STEEL);
      doc.text(t.severity.charAt(0).toUpperCase() + t.severity.slice(1), 138, y + 4.2);
      setTxt(delayColor);
      doc.text(delay, 158, y + 4.2);
      setTxt("#475569"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(resolvedStr, 176, y + 4.2);
      y += 6.5;
    });
  }

  // ═══════════════════════════════════════════════════════
  // PAGE 5 — Tickets en cours
  // ═══════════════════════════════════════════════════════
  if (s.inProgressList.length > 0) {
    doc.addPage();
    const ipPageNum = s.resolvedList.length > 0 ? 5 : 4;
    pageHeader(ipPageNum, "Tickets en cours · Prise en charge active");
    y = 44;

    y = sectionTitle(15, y, `Tickets en cours de traitement (${s.inProgressList.length})`);

    setFill(NAVY); doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    setTxt("#FFFFFF"); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text("#",          18,  y + 4.5);
    doc.text("Titre",      26,  y + 4.5);
    doc.text("Demandeur",  88,  y + 4.5);
    doc.text("Catégorie", 135,  y + 4.5);
    doc.text("Sévérité",  162,  y + 4.5);
    doc.text("Âge",       180,  y + 4.5);
    doc.text("Créé le",   191,  y + 4.5);
    y += 7;

    const sevCI: Record<string, string> = { urgent: "#dc2626", eleve: "#d97706", moyen: STEEL, faible: "#64748B" };
    s.inProgressList.forEach((t, i) => {
      if (y > H - 20) {
        doc.addPage();
        pageHeader(ipPageNum + 1, "Tickets en cours (suite)");
        y = 44;
      }
      const rowBg = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      setFill(rowBg); setDraw("#E2E8F0"); doc.setLineWidth(0.15);
      doc.rect(15, y, W - 30, 6.5, "FD");

      const title    = t.title.length > 30 ? t.title.slice(0, 27) + "…" : t.title;
      const req      = (t.requesterName ?? "—").slice(0, 18);
      const cat      = (t.category ?? "—").slice(0, 16);
      const age      = t.ageDays < 1 ? `${Math.round(t.ageDays * 24)}h` : `${Math.ceil(t.ageDays)}j`;
      const ageColor = t.ageDays > 30 ? "#dc2626" : t.ageDays > 7 ? "#d97706" : "#475569";
      const createdStr = new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

      setTxt("#94A3B8"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(`#${t.id}`, 18, y + 4.2);
      setTxt("#1E293B"); doc.setFontSize(7.5);
      doc.text(title, 26, y + 4.2);
      doc.text(req, 88, y + 4.2);
      setTxt("#64748B");
      doc.text(cat, 135, y + 4.2);
      setTxt(sevCI[t.severity] ?? STEEL); doc.setFont("helvetica", "bold");
      doc.text(t.severity.charAt(0).toUpperCase() + t.severity.slice(1), 162, y + 4.2);
      setTxt(ageColor);
      doc.text(age, 180, y + 4.2);
      setTxt("#94A3B8"); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(createdStr, 191, y + 4.2);
      y += 6.5;
    });
  }

  const suffix = dateRange?.from || dateRange?.to
    ? `-${(dateRange.from ?? "").slice(0, 10) || "debut"}_${(dateRange.to ?? "").slice(0, 10) || "fin"}`
    : "";
  const fileName = `rapport-tickets${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ── Dialog component ──────────────────────────────────────────────────────────
interface Props {
  tickets: TicketDto[];
  open: boolean;
  onClose: () => void;
  tenantName?: string;
}

export function TicketStatsDialog({ tickets, open, onClose, tenantName }: Props) {
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  // Filter tickets by date range (based on createdAt)
  const filteredTickets = useMemo(() => {
    if (!dateFrom && !dateTo) return tickets;
    return tickets.filter((t) => {
      const d = new Date(t.createdAt).getTime();
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to   = dateTo   ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
      return d >= from && d <= to;
    });
  }, [tickets, dateFrom, dateTo]);

  const s = useMemo(() => computeStats(filteredTickets), [filteredTickets]);

  const hasFilter = !!dateFrom || !!dateTo;
  const dateRange = hasFilter ? { from: dateFrom, to: dateTo } : undefined;

  const fmtDisplayDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

  const handleExport = () => {
    setExportError(null);
    setGenerating(true);
    try {
      generatePdf(filteredTickets, tenantName, dateRange);
    } catch (err) {
      console.error("PDF generation error:", err);
      setExportError(err instanceof Error ? err.message : "Erreur lors de la génération du PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const statusChartData = [
    { name: "Ouvert",        value: s.byStatus.open,         fill: "#d97706" },
    { name: "En cours",      value: s.byStatus.in_progress,  fill: STEEL },
    { name: "Att. util.",    value: s.byStatus.waiting_user, fill: "#7c3aed" },
    { name: "Résolu",        value: s.byStatus.resolved,     fill: "#16a34a" },
    { name: "Fermé",         value: s.byStatus.closed,       fill: "#94A3B8" },
  ].filter((d) => d.value > 0);

  const sevChartData = [
    { name: "Urgent", value: s.bySeverity.urgent, fill: "#dc2626" },
    { name: "Élevé",  value: s.bySeverity.eleve,  fill: "#d97706" },
    { name: "Moyen",  value: s.bySeverity.moyen,  fill: STEEL },
    { name: "Faible", value: s.bySeverity.faible, fill: "#94A3B8" },
  ].filter((d) => d.value > 0);

  const ageChartData = [
    { name: "< 1j",   value: s.ageBuckets["<1j"],   fill: "#16a34a" },
    { name: "1–7j",   value: s.ageBuckets["1-7j"],  fill: GOLD },
    { name: "8–30j",  value: s.ageBuckets["8-30j"], fill: "#d97706" },
    { name: "> 30j",  value: s.ageBuckets[">30j"],  fill: "#dc2626" },
  ];

  const monthChartData = Object.entries(s.monthsMap).map(([name, value]) => ({ name, value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", height: { xs: "100dvh", sm: "92vh" }, display: "flex", flexDirection: "column" } }}
    >
      <Box sx={{ height: 4, bgcolor: GOLD, flexShrink: 0 }} />

      {/* Header */}
      <Box sx={{ px: 3, py: 2, flexShrink: 0, background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)` }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: GOLD, width: 42, height: 42 }}>
              <BarChartIcon sx={{ color: NAVY, fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography fontWeight={700} fontSize={16} sx={{ color: "white" }}>
                Statistiques & Rapport tickets IT
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)" }}>
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} analysés
                {hasFilter ? ` · filtrés sur ${tickets.length} au total` : ""}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={14} sx={{ color: "white" }} /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={generating || filteredTickets.length === 0}
              sx={{ bgcolor: GOLD, color: "var(--text-primary)", fontWeight: 700, fontSize: 13, "&:hover": { bgcolor: "#b8891f" } }}
            >
              {generating ? "Génération…" : "Exporter PDF"}
            </Button>
            <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.1)" } }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Period filter bar */}
      <Box
        sx={{
          flexShrink: 0, px: 3, py: 1.5,
          bgcolor: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <CalendarMonthIcon sx={{ fontSize: 18, color: "var(--text-secondary)" }} />
          <Typography variant="caption" fontWeight={700} sx={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Période
          </Typography>
        </Box>

        <TextField
          type="date"
          size="small"
          label="Du"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: dateTo || undefined }}
          sx={{
            width: 160,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "& fieldset": { borderColor: "var(--border)" },
              "&:hover fieldset": { borderColor: "var(--border-strong)" },
              "&.Mui-focused fieldset": { borderColor: STEEL, borderWidth: 1.5 },
            },
          }}
        />

        <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>→</Typography>

        <TextField
          type="date"
          size="small"
          label="Au"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: dateFrom || undefined }}
          sx={{
            width: 160,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "& fieldset": { borderColor: "var(--border)" },
              "&:hover fieldset": { borderColor: "var(--border-strong)" },
              "&.Mui-focused fieldset": { borderColor: STEEL, borderWidth: 1.5 },
            },
          }}
        />

        {hasFilter && (
          <>
            <Chip
              label={
                dateFrom && dateTo
                  ? `${fmtDisplayDate(dateFrom)} → ${fmtDisplayDate(dateTo)}`
                  : dateFrom
                  ? `Depuis le ${fmtDisplayDate(dateFrom)}`
                  : `Jusqu'au ${fmtDisplayDate(dateTo)}`
              }
              size="small"
              sx={{ bgcolor: "#EFF6FF", color: STEEL, fontWeight: 600, fontSize: 11 }}
            />
            <Chip
              label={`${filteredTickets.length} ticket${filteredTickets.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{ bgcolor: "#F0FDF4", color: "#15803d", fontWeight: 700, fontSize: 11 }}
            />
            <Tooltip title="Effacer le filtre">
              <IconButton
                size="small"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                sx={{ color: "var(--text-muted)", "&:hover": { color: "#dc2626", bgcolor: "#FEF2F2" } }}
              >
                <FilterAltOffIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </>
        )}

        {!hasFilter && (
          <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
            Tous les tickets · {tickets.length} au total
          </Typography>
        )}
      </Box>

      {exportError && (
        <Alert severity="error" onClose={() => setExportError(null)} sx={{ mx: 3, mt: 1.5, flexShrink: 0 }}>
          {exportError}
        </Alert>
      )}

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 3, bgcolor: "var(--bg-page)" }}>

        {/* KPI row */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Total tickets",          value: s.total,             sub: `${s.resolved} résolus`,   icon: <BarChartIcon sx={{ fontSize: 20 }} />,         color: "#64748B" },
            { label: "Taux de résolution",     value: `${s.resolutionRate}%`, sub: `${s.resolved}/${s.total}`, icon: <CheckCircleIcon sx={{ fontSize: 20 }} />,     color: "#16a34a" },
            { label: "Délai moy. résolution",  value: `${s.avgResolutionDays}j`, sub: "tickets résolus/fermés", icon: <AccessTimeIcon sx={{ fontSize: 20 }} />,   color: STEEL },
            { label: "Att. réponse utilisateur", value: s.byStatus.waiting_user, sub: "tickets bloqués", icon: <PauseCircleIcon sx={{ fontSize: 20 }} />,         color: "#7c3aed" },
            { label: "Jamais traités",         value: s.untouchedTickets.length, sub: "aucune action IT", icon: <WarningAmberIcon sx={{ fontSize: 20 }} />,       color: "#dc2626" },
          ].map((k, i) => (
            <Grid item xs={6} sm={4} md={12 / 5} key={i}>
              <StatKpi {...k} />
            </Grid>
          ))}
        </Grid>

        {/* Charts row 1 */}
        <Grid container spacing={2.5} mb={2.5}>
          <Grid item xs={12} md={6}>
            <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)", p: 2.5 }}>
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)" mb={2}>
                Répartition par statut
              </Typography>
              {statusChartData.length > 0 ? (
                <>
                  {statusChartData.map((d) => (
                    <HBar
                      key={d.name}
                      label={d.name}
                      value={d.value}
                      max={Math.max(...statusChartData.map((x) => x.value))}
                      color={d.fill}
                      total={s.total}
                    />
                  ))}
                </>
              ) : (
                <Typography variant="body2" color="text.disabled" textAlign="center" py={3}>Aucune donnée</Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)", p: 2.5 }}>
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)" mb={2}>
                Répartition par sévérité
              </Typography>
              {sevChartData.length > 0 ? (
                <>
                  {sevChartData.map((d) => (
                    <HBar
                      key={d.name}
                      label={d.name}
                      value={d.value}
                      max={Math.max(...sevChartData.map((x) => x.value))}
                      color={d.fill}
                      total={s.total}
                    />
                  ))}
                </>
              ) : (
                <Typography variant="body2" color="text.disabled" textAlign="center" py={3}>Aucune donnée</Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Charts row 2 */}
        <Grid container spacing={2.5} mb={2.5}>
          <Grid item xs={12} md={7}>
            <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)", p: 2.5 }}>
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)" mb={2}>
                Volume de tickets — 6 derniers mois
              </Typography>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]} fill={NAVY} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)", p: 2.5 }}>
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)" mb={1.5}>
                Ancienneté des tickets actifs
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                Tickets ouverts + en cours ({s.byStatus.open + s.byStatus.in_progress} au total)
              </Typography>
              {ageChartData.map((d) => (
                <HBar
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  max={Math.max(...ageChartData.map((x) => x.value), 1)}
                  color={d.fill}
                  total={s.byStatus.open + s.byStatus.in_progress}
                />
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* Waiting tickets table */}
        {s.waitingTickets.length > 0 && (
          <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid var(--border)", p: 2.5, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <PauseCircleIcon sx={{ color: "#7c3aed", fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)">
                Tickets en attente de réponse utilisateur ({s.waitingTickets.length})
              </Typography>
            </Box>
            {/* Header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 80px", gap: 1, bgcolor: NAVY, borderRadius: 1.5, px: 2, py: 1, mb: 0.5 }}>
              {["Titre", "Demandeur", "En attente", "Sévérité"].map((h) => (
                <Typography key={h} variant="caption" fontWeight={700} sx={{ color: "rgba(255,255,255,0.65)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {h}
                </Typography>
              ))}
            </Box>
            {s.waitingTickets.slice(0, 8).map((t, i) => (
              <Box
                key={t.id}
                sx={{
                  display: "grid", gridTemplateColumns: "1fr 140px 100px 80px",
                  gap: 1, px: 2, py: 1.25, borderRadius: 1,
                  bgcolor: i % 2 === 0 ? "var(--bg-page)" : "var(--bg-surface)",
                  "&:hover": { bgcolor: "#EFF6FF" },
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "var(--text-primary)" }}>{t.title}</Typography>
                <Typography variant="body2" sx={{ color: "var(--text-secondary)" }} noWrap>{t.requesterName ?? "—"}</Typography>
                <Chip
                  label={`${Math.ceil(t.waitingDays)}j`}
                  size="small"
                  sx={{ bgcolor: "#FAF5FF", color: "#7c3aed", fontWeight: 700, height: 20, fontSize: 11, width: "fit-content" }}
                />
                <Chip
                  label={t.severity}
                  size="small"
                  sx={{
                    height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                    bgcolor: t.severity === "urgent" ? "#FEF2F2" : t.severity === "eleve" ? "#FFFBEB" : "#F1F5F9",
                    color: t.severity === "urgent" ? "#dc2626" : t.severity === "eleve" ? "#d97706" : "#64748B",
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* Untouched tickets */}
        {s.untouchedTickets.length > 0 && (
          <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid #FEE2E2", p: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <WarningAmberIcon sx={{ color: "#dc2626", fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)">
                Tickets jamais traités — aucune action IT ({s.untouchedTickets.length})
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 80px", gap: 1, bgcolor: "#FEF2F2", borderRadius: 1.5, px: 2, py: 1, mb: 0.5 }}>
              {["Titre", "Demandeur", "Âge", "Sévérité"].map((h) => (
                <Typography key={h} variant="caption" fontWeight={700} sx={{ color: "#991b1b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {h}
                </Typography>
              ))}
            </Box>
            {s.untouchedTickets.map((t, i) => (
              <Box
                key={t.id}
                sx={{
                  display: "grid", gridTemplateColumns: "1fr 140px 80px 80px",
                  gap: 1, px: 2, py: 1.25, borderRadius: 1,
                  bgcolor: i % 2 === 0 ? "#FFF7F7" : "var(--bg-surface)",
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "var(--text-primary)" }}>{t.title}</Typography>
                <Typography variant="body2" sx={{ color: "var(--text-secondary)" }} noWrap>{t.requesterName ?? "—"}</Typography>
                <Chip
                  label={`${Math.ceil(t.ageDays)}j`}
                  size="small"
                  sx={{ bgcolor: "#FEF2F2", color: "#dc2626", fontWeight: 700, height: 20, fontSize: 11, width: "fit-content" }}
                />
                <Chip
                  label={t.severity}
                  size="small"
                  sx={{
                    height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                    bgcolor: t.severity === "urgent" ? "#FEF2F2" : t.severity === "eleve" ? "#FFFBEB" : "#F1F5F9",
                    color: t.severity === "urgent" ? "#dc2626" : t.severity === "eleve" ? "#d97706" : "#64748B",
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* ── Tickets en cours ──────────────────────────────── */}
        {s.inProgressList.length > 0 && (
          <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid #DBEAFE", p: 2.5, mt: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <HourglassEmptyIcon sx={{ color: STEEL, fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={13} color="var(--text-primary)">
                Tickets en cours de traitement ({s.inProgressList.length})
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 130px 80px 90px 80px", gap: 1, bgcolor: NAVY, borderRadius: 1.5, px: 2, py: 1, mb: 0.5 }}>
              {["Titre", "Demandeur", "Sévérité", "Catégorie", "Âge"].map((h) => (
                <Typography key={h} variant="caption" fontWeight={700} sx={{ color: "rgba(255,255,255,0.65)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {h}
                </Typography>
              ))}
            </Box>
            {s.inProgressList.map((t, i) => (
              <Box
                key={t.id}
                sx={{
                  display: "grid", gridTemplateColumns: "1fr 130px 80px 90px 80px",
                  gap: 1, px: 2, py: 1.25, borderRadius: 1,
                  bgcolor: i % 2 === 0 ? "#EFF6FF" : "var(--bg-surface)",
                  "&:hover": { bgcolor: "#DBEAFE" },
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "var(--text-primary)" }}>{t.title}</Typography>
                <Typography variant="body2" sx={{ color: "var(--text-secondary)" }} noWrap>{t.requesterName ?? "—"}</Typography>
                <Chip
                  label={t.severity}
                  size="small"
                  sx={{
                    height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                    bgcolor: t.severity === "urgent" ? "#FEF2F2" : t.severity === "eleve" ? "#FFFBEB" : "#EFF6FF",
                    color: t.severity === "urgent" ? "#dc2626" : t.severity === "eleve" ? "#d97706" : STEEL,
                  }}
                />
                <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontSize: 12 }} noWrap>{t.category ?? "—"}</Typography>
                <Chip
                  label={t.ageDays < 1 ? `${Math.round(t.ageDays * 24)}h` : `${Math.ceil(t.ageDays)}j`}
                  size="small"
                  sx={{
                    height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                    bgcolor: t.ageDays > 30 ? "#FEF2F2" : t.ageDays > 7 ? "#FFFBEB" : "#F0FDF4",
                    color: t.ageDays > 30 ? "#dc2626" : t.ageDays > 7 ? "#d97706" : "#15803d",
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* ── Tickets traités ───────────────────────────────── */}
        {s.resolvedList.length > 0 && (
          <Box sx={{ bgcolor: "var(--bg-surface)", borderRadius: 2.5, border: "1px solid #BBF7D0", p: 2.5, mt: 2.5 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon sx={{ color: "#16a34a", fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={13} color="var(--text-primary)">
                  Tickets traités — Résolus & Fermés ({s.resolvedList.length})
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                {s.fastestResolution && (
                  <Chip
                    label={`⚡ Plus rapide : ${s.fastestResolution.resolutionDays.toFixed(1)}j`}
                    size="small"
                    sx={{ bgcolor: "#F0FDF4", color: "#15803d", fontWeight: 700, fontSize: 11 }}
                  />
                )}
                {s.slowestResolution && s.resolvedList.length > 1 && (
                  <Chip
                    label={`⏱ Plus long : ${s.slowestResolution.resolutionDays.toFixed(1)}j`}
                    size="small"
                    sx={{ bgcolor: "#FFFBEB", color: "#b45309", fontWeight: 700, fontSize: 11 }}
                  />
                )}
              </Box>
            </Box>

            {/* Resolution time mini-bars */}
            <Box sx={{ mb: 2, p: 1.5, bgcolor: "var(--bg-page)", borderRadius: 2, border: "1px solid var(--border)" }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1 }}>
                Délai de résolution
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                {[
                  { label: "< 1j",   value: s.resTimeBuckets["<1j"],   color: "#16a34a", bg: "#F0FDF4" },
                  { label: "1–7j",   value: s.resTimeBuckets["1-7j"],  color: "#b45309", bg: "#FFFBEB" },
                  { label: "8–30j",  value: s.resTimeBuckets["8-30j"], color: "#d97706", bg: "#FFF7ED" },
                  { label: "> 30j",  value: s.resTimeBuckets[">30j"],  color: "#dc2626", bg: "#FEF2F2" },
                ].map((b) => (
                  <Box key={b.label} sx={{ px: 2, py: 0.75, borderRadius: 2, bgcolor: b.bg, border: `1px solid ${b.color}30` }}>
                    <Typography fontWeight={800} fontSize={18} sx={{ color: b.color, lineHeight: 1 }}>{b.value}</Typography>
                    <Typography variant="caption" sx={{ color: b.color, fontWeight: 600 }}>{b.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Table */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 130px 80px 80px 80px 90px", gap: 1, bgcolor: "#15803d", borderRadius: 1.5, px: 2, py: 1, mb: 0.5 }}>
              {["Titre", "Demandeur", "Statut", "Sévérité", "Délai", "Résolu le"].map((h) => (
                <Typography key={h} variant="caption" fontWeight={700} sx={{ color: "rgba(255,255,255,0.85)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {h}
                </Typography>
              ))}
            </Box>
            {s.resolvedList.map((t, i) => {
              const delay = t.resolutionDays < 1
                ? `${Math.round(t.resolutionDays * 24)}h`
                : `${t.resolutionDays.toFixed(1)}j`;
              const delayColor = t.resolutionDays < 1 ? "#16a34a" : t.resolutionDays < 7 ? "#b45309" : t.resolutionDays < 30 ? "#d97706" : "#dc2626";
              const delayBg    = t.resolutionDays < 1 ? "#F0FDF4" : t.resolutionDays < 7 ? "#FFFBEB" : t.resolutionDays < 30 ? "#FFF7ED" : "#FEF2F2";
              return (
                <Box
                  key={t.id}
                  sx={{
                    display: "grid", gridTemplateColumns: "1fr 130px 80px 80px 80px 90px",
                    gap: 1, px: 2, py: 1.25, borderRadius: 1,
                    bgcolor: i % 2 === 0 ? "#F0FDF4" : "var(--bg-surface)",
                    "&:hover": { bgcolor: "#DCFCE7" },
                  }}
                >
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "var(--text-primary)" }}>{t.title}</Typography>
                  <Typography variant="body2" sx={{ color: "var(--text-secondary)" }} noWrap>{t.requesterName ?? "—"}</Typography>
                  <Chip
                    label={t.status === "resolved" ? "Résolu" : "Fermé"}
                    size="small"
                    sx={{
                      height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                      bgcolor: t.status === "resolved" ? "#F0FDF4" : "#F1F5F9",
                      color: t.status === "resolved" ? "#16a34a" : "#64748B",
                    }}
                  />
                  <Chip
                    label={t.severity}
                    size="small"
                    sx={{
                      height: 20, fontSize: 11, fontWeight: 700, width: "fit-content",
                      bgcolor: t.severity === "urgent" ? "#FEF2F2" : t.severity === "eleve" ? "#FFFBEB" : "#F1F5F9",
                      color: t.severity === "urgent" ? "#dc2626" : t.severity === "eleve" ? "#d97706" : "#64748B",
                    }}
                  />
                  <Chip
                    label={delay}
                    size="small"
                    sx={{ height: 20, fontSize: 11, fontWeight: 700, width: "fit-content", bgcolor: delayBg, color: delayColor }}
                  />
                  <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {new Date(t.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
