"use client";

import {
  X, Download, BarChart3, CalendarDays, FilterX, Clock, AlertTriangle, CheckCircle2, Hourglass, PauseCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { TicketDto } from "@/lib/tickets";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Tooltip } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";

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

// ── Petits blocs UI ────────────────────────────────────────────────────────────
function Chip({ label, bg, color }: { label: React.ReactNode; bg: string; color: string }) {
  return (
    <span className="inline-flex h-5 w-fit items-center rounded-full px-2.5 text-[11px] font-bold" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

const sevStyle = (sev: string) => ({
  bg: sev === "urgent" ? "#FEF2F2" : sev === "eleve" ? "#FFFBEB" : "#F1F5F9",
  color: sev === "urgent" ? "#dc2626" : sev === "eleve" ? "#d97706" : "#64748B",
});

function Card({ title, icon, border, children, className }: { title?: React.ReactNode; icon?: React.ReactNode; border?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-[10px] bg-surface p-5 " + (className ?? "")} style={{ border: `1px solid ${border ?? "var(--border)"}` }}>
      {title && (
        <div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-foreground">
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function TableHead({ cols, labels, bg, color }: { cols: string; labels: string[]; bg: string; color: string }) {
  return (
    <div className="mb-1 grid gap-2 rounded-md px-4 py-2" style={{ gridTemplateColumns: cols, background: bg }}>
      {labels.map((h) => (
        <span key={h} className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color }}>{h}</span>
      ))}
    </div>
  );
}

function Row({ cols, bg, hover, children }: { cols: string; bg: string; hover?: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-2 rounded px-4 py-[10px] transition-colors hover:[background:var(--row-hover)]"
      style={{ gridTemplateColumns: cols, background: bg, ["--row-hover" as string]: hover ?? bg }}
    >
      {children}
    </div>
  );
}

const Cell = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => (
  <span className={"truncate text-sm " + (muted ? "text-secondary-foreground" : "font-semibold text-foreground")} style={muted ? { color: "var(--text-secondary)" } : undefined}>
    {children}
  </span>
);

// ── Stat KPI card ──────────────────────────────────────────────────────────────
function StatKpi({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-[10px] border border-border bg-surface px-5 py-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: color + "18", color }}>{icon}</span>
      <div>
        <div className="text-[22px] font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</div>
        {sub && <div className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function HBar({ label, value, max, color, total }: { label: string; value: number; max: number; color: string; total: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="min-w-[110px] text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#F1F5F9" }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="min-w-7 text-right text-xs font-bold" style={{ color }}>{value}</span>
      {total > 0 && <span className="min-w-9 text-[11px]" style={{ color: "var(--text-muted)" }}>{Math.round((value / total) * 100)}%</span>}
    </div>
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

  const plural = filteredTickets.length !== 1 ? "s" : "";
  const kpis = [
    { label: "Total tickets",            value: s.total,                    sub: `${s.resolved} résolus`,      icon: <BarChart3 size={20} />,    color: "#64748B" },
    { label: "Taux de résolution",       value: `${s.resolutionRate}%`,     sub: `${s.resolved}/${s.total}`,   icon: <CheckCircle2 size={20} />, color: "#16a34a" },
    { label: "Délai moy. résolution",    value: `${s.avgResolutionDays}j`,  sub: "tickets résolus/fermés",     icon: <Clock size={20} />,        color: STEEL },
    { label: "Att. réponse utilisateur", value: s.byStatus.waiting_user,    sub: "tickets bloqués",            icon: <PauseCircle size={20} />,  color: "#7c3aed" },
    { label: "Jamais traités",           value: s.untouchedTickets.length,  sub: "aucune action IT",           icon: <AlertTriangle size={20} />, color: "#dc2626" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg" accent={false} aria-describedby={undefined} className="flex flex-col" style={{ height: "calc(92vh / var(--ui-zoom))" }}>
        <div className="h-1 shrink-0" style={{ background: GOLD }} />

        {/* Header */}
        <div className="shrink-0 px-6 py-4" style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="flex size-[42px] items-center justify-center rounded-full" style={{ background: GOLD }}>
                <BarChart3 size={22} color={NAVY} />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-white">Statistiques & Rapport tickets IT</DialogTitle>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {filteredTickets.length} ticket{plural} analysés
                  {hasFilter ? ` · filtrés sur ${tickets.length} au total` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExport}
                disabled={generating || filteredTickets.length === 0}
                className="text-[13px] font-bold text-white hover:opacity-90"
                style={{ background: GOLD }}
              >
                {generating ? <Spinner /> : <Download size={16} />}
                {generating ? "Génération…" : "Exporter PDF"}
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Period filter bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-border bg-surface px-6 py-3">
          <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <CalendarDays size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Période</span>
          </div>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Du
            <Input type="date" className="w-40" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <span style={{ color: "var(--text-muted)" }}>→</span>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Au
            <Input type="date" className="w-40" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          {hasFilter ? (
            <>
              <Chip
                bg="#EFF6FF"
                color={STEEL}
                label={
                  dateFrom && dateTo
                    ? `${fmtDisplayDate(dateFrom)} → ${fmtDisplayDate(dateTo)}`
                    : dateFrom
                    ? `Depuis le ${fmtDisplayDate(dateFrom)}`
                    : `Jusqu'au ${fmtDisplayDate(dateTo)}`
                }
              />
              <Chip bg="#F0FDF4" color="#15803d" label={`${filteredTickets.length} ticket${plural}`} />
              <Tooltip title="Effacer le filtre">
                <button
                  type="button"
                  aria-label="Effacer le filtre"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:bg-red-50 hover:text-red-600"
                  style={{ color: "var(--text-muted)" }}
                >
                  <FilterX size={17} />
                </button>
              </Tooltip>
            </>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tous les tickets · {tickets.length} au total</span>
          )}
        </div>

        {exportError && (
          <Alert severity="error" onClose={() => setExportError(null)} className="mx-6 mt-3 shrink-0">
            {exportError}
          </Alert>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6" style={{ background: "var(--bg-page)" }}>
          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {kpis.map((k, i) => <StatKpi key={i} {...k} />)}
          </div>

          {/* Charts row 1 */}
          <div className="mb-5 grid gap-5 md:grid-cols-2">
            <Card title="Répartition par statut">
              {statusChartData.length > 0 ? (
                statusChartData.map((d) => (
                  <HBar key={d.name} label={d.name} value={d.value} max={Math.max(...statusChartData.map((x) => x.value))} color={d.fill} total={s.total} />
                ))
              ) : (
                <div className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucune donnée</div>
              )}
            </Card>
            <Card title="Répartition par sévérité">
              {sevChartData.length > 0 ? (
                sevChartData.map((d) => (
                  <HBar key={d.name} label={d.name} value={d.value} max={Math.max(...sevChartData.map((x) => x.value))} color={d.fill} total={s.total} />
                ))
              ) : (
                <div className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucune donnée</div>
              )}
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="mb-5 grid gap-5 md:grid-cols-12">
            <Card title="Volume de tickets — 6 derniers mois" className="md:col-span-7">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]} fill={NAVY} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Ancienneté des tickets actifs" className="md:col-span-5">
              <div className="-mt-2 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                Tickets ouverts + en cours ({s.byStatus.open + s.byStatus.in_progress} au total)
              </div>
              {ageChartData.map((d) => (
                <HBar key={d.name} label={d.name} value={d.value} max={Math.max(...ageChartData.map((x) => x.value), 1)} color={d.fill} total={s.byStatus.open + s.byStatus.in_progress} />
              ))}
            </Card>
          </div>

          {/* Waiting tickets */}
          {s.waitingTickets.length > 0 && (
            <Card className="mb-5" icon={<PauseCircle size={20} color="#7c3aed" />} title={`Tickets en attente de réponse utilisateur (${s.waitingTickets.length})`}>
              <TableHead cols="1fr 140px 100px 80px" labels={["Titre", "Demandeur", "En attente", "Sévérité"]} bg={NAVY} color="rgba(255,255,255,0.65)" />
              {s.waitingTickets.slice(0, 8).map((t, i) => (
                <Row key={t.id} cols="1fr 140px 100px 80px" bg={i % 2 === 0 ? "var(--bg-page)" : "var(--bg-surface)"} hover="#EFF6FF">
                  <Cell>{t.title}</Cell>
                  <Cell muted>{t.requesterName ?? "—"}</Cell>
                  <Chip label={`${Math.ceil(t.waitingDays)}j`} bg="#FAF5FF" color="#7c3aed" />
                  <Chip label={t.severity} {...sevStyle(t.severity)} />
                </Row>
              ))}
            </Card>
          )}

          {/* Untouched */}
          {s.untouchedTickets.length > 0 && (
            <Card border="#FEE2E2" icon={<AlertTriangle size={20} color="#dc2626" />} title={`Tickets jamais traités — aucune action IT (${s.untouchedTickets.length})`}>
              <TableHead cols="1fr 140px 80px 80px" labels={["Titre", "Demandeur", "Âge", "Sévérité"]} bg="#FEF2F2" color="#991b1b" />
              {s.untouchedTickets.map((t, i) => (
                <Row key={t.id} cols="1fr 140px 80px 80px" bg={i % 2 === 0 ? "#FFF7F7" : "var(--bg-surface)"}>
                  <Cell>{t.title}</Cell>
                  <Cell muted>{t.requesterName ?? "—"}</Cell>
                  <Chip label={`${Math.ceil(t.ageDays)}j`} bg="#FEF2F2" color="#dc2626" />
                  <Chip label={t.severity} {...sevStyle(t.severity)} />
                </Row>
              ))}
            </Card>
          )}

          {/* In progress */}
          {s.inProgressList.length > 0 && (
            <Card className="mt-5" border="#DBEAFE" icon={<Hourglass size={20} color={STEEL} />} title={`Tickets en cours de traitement (${s.inProgressList.length})`}>
              <TableHead cols="1fr 130px 80px 90px 80px" labels={["Titre", "Demandeur", "Sévérité", "Catégorie", "Âge"]} bg={NAVY} color="rgba(255,255,255,0.65)" />
              {s.inProgressList.map((t, i) => (
                <Row key={t.id} cols="1fr 130px 80px 90px 80px" bg={i % 2 === 0 ? "#EFF6FF" : "var(--bg-surface)"} hover="#DBEAFE">
                  <Cell>{t.title}</Cell>
                  <Cell muted>{t.requesterName ?? "—"}</Cell>
                  <Chip label={t.severity} bg={t.severity === "urgent" ? "#FEF2F2" : t.severity === "eleve" ? "#FFFBEB" : "#EFF6FF"} color={t.severity === "urgent" ? "#dc2626" : t.severity === "eleve" ? "#d97706" : STEEL} />
                  <Cell muted>{t.category ?? "—"}</Cell>
                  <Chip
                    label={t.ageDays < 1 ? `${Math.round(t.ageDays * 24)}h` : `${Math.ceil(t.ageDays)}j`}
                    bg={t.ageDays > 30 ? "#FEF2F2" : t.ageDays > 7 ? "#FFFBEB" : "#F0FDF4"}
                    color={t.ageDays > 30 ? "#dc2626" : t.ageDays > 7 ? "#d97706" : "#15803d"}
                  />
                </Row>
              ))}
            </Card>
          )}

          {/* Resolved */}
          {s.resolvedList.length > 0 && (
            <Card className="mt-5" border="#BBF7D0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <CheckCircle2 size={20} color="#16a34a" />
                  Tickets traités — Résolus & Fermés ({s.resolvedList.length})
                </div>
                <div className="flex gap-2">
                  {s.fastestResolution && <Chip bg="#F0FDF4" color="#15803d" label={`⚡ Plus rapide : ${s.fastestResolution.resolutionDays.toFixed(1)}j`} />}
                  {s.slowestResolution && s.resolvedList.length > 1 && <Chip bg="#FFFBEB" color="#b45309" label={`⏱ Plus long : ${s.slowestResolution.resolutionDays.toFixed(1)}j`} />}
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-border p-3" style={{ background: "var(--bg-page)" }}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Délai de résolution</div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "< 1j",  value: s.resTimeBuckets["<1j"],   color: "#16a34a", bg: "#F0FDF4" },
                    { label: "1–7j",  value: s.resTimeBuckets["1-7j"],  color: "#b45309", bg: "#FFFBEB" },
                    { label: "8–30j", value: s.resTimeBuckets["8-30j"], color: "#d97706", bg: "#FFF7ED" },
                    { label: "> 30j", value: s.resTimeBuckets[">30j"],  color: "#dc2626", bg: "#FEF2F2" },
                  ].map((b) => (
                    <div key={b.label} className="rounded-lg px-4 py-1.5" style={{ background: b.bg, border: `1px solid ${b.color}30` }}>
                      <div className="text-lg font-extrabold leading-none" style={{ color: b.color }}>{b.value}</div>
                      <div className="text-xs font-semibold" style={{ color: b.color }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <TableHead cols="1fr 130px 80px 80px 80px 90px" labels={["Titre", "Demandeur", "Statut", "Sévérité", "Délai", "Résolu le"]} bg="#15803d" color="rgba(255,255,255,0.85)" />
              {s.resolvedList.map((t, i) => {
                const delay = t.resolutionDays < 1 ? `${Math.round(t.resolutionDays * 24)}h` : `${t.resolutionDays.toFixed(1)}j`;
                const delayColor = t.resolutionDays < 1 ? "#16a34a" : t.resolutionDays < 7 ? "#b45309" : t.resolutionDays < 30 ? "#d97706" : "#dc2626";
                const delayBg    = t.resolutionDays < 1 ? "#F0FDF4" : t.resolutionDays < 7 ? "#FFFBEB" : t.resolutionDays < 30 ? "#FFF7ED" : "#FEF2F2";
                return (
                  <Row key={t.id} cols="1fr 130px 80px 80px 80px 90px" bg={i % 2 === 0 ? "#F0FDF4" : "var(--bg-surface)"} hover="#DCFCE7">
                    <Cell>{t.title}</Cell>
                    <Cell muted>{t.requesterName ?? "—"}</Cell>
                    <Chip label={t.status === "resolved" ? "Résolu" : "Fermé"} bg={t.status === "resolved" ? "#F0FDF4" : "#F1F5F9"} color={t.status === "resolved" ? "#16a34a" : "#64748B"} />
                    <Chip label={t.severity} {...sevStyle(t.severity)} />
                    <Chip label={delay} bg={delayBg} color={delayColor} />
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {new Date(t.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </Row>
                );
              })}
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
