import { jsPDF } from "jspdf";
import { apiClient } from "./apiClient";
import { fetchAgences } from "./agences";
import {
  C, fmtDate, fr, txt, hline,
  drawPieDonut, drawBarChart, drawGroupedBar, drawHorizBar,
  drawProgressBars, secHdr, pageHdr, simpleTable, pageFtr, kpiBlock,
  coverPage, finalizePageNumbers,
} from "./pdfKit";

// Générateurs de rapports PDF pour les 3 catégories de la page
// "Analytics & Rapports" (Portefeuille & couverture / Localisations / Agents
// terrain), plus un rapport global qui combine les trois. Chaque générateur
// refait les mêmes appels API que l'onglet correspondant (voir les fichiers
// page.tsx respectifs) puis reproduit les mêmes calculs dérivés que l'UI,
// pour que le PDF corresponde exactement à ce que l'admin voit à l'écran.

const arr = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);
const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

async function api<T = any>(path: string): Promise<T> {
  const r = await apiClient.get(path);
  return r.data as T;
}

function riskLabelPct(label: string) {
  return label; // les libellés (Souffrant, Perte, Encours…) sont déjà en français
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PORTEFEUILLE & COUVERTURE
// ═════════════════════════════════════════════════════════════════════════════

async function fetchPortfolioData() {
  const [stats, risk] = await Promise.all([
    api<any>("/clients/coverage/stats"),
    api<any>("/clients/risk-analysis"),
  ]);
  return { stats: stats ?? {}, risk: risk ?? {} };
}

export async function generatePortfolioPdf(tenantName: string) {
  const { stats, risk } = await fetchPortfolioData();
  const summary = risk.summary ?? {};
  const total = stats.total ?? 0;
  const recent = stats.recent ?? 0;
  const stale = stats.stale ?? 0;
  const noVisit = stats.no_visit ?? 0;
  const totalRisk = summary.total_risk ?? 0;

  const cov7d = pct(recent, total);
  const cov30d = pct(recent + stale, total);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14, IW = W - 2 * M;

  coverPage(doc, W, H, "Portefeuille Clients", "Couverture visites & risque crédit", tenantName, "Portefeuille complet");

  // ── Page 2 : KPIs + couverture ──────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "PORTEFEUILLE CLIENTS", "Couverture", "Page 2", tenantName, W);
  pageFtr(doc, tenantName, "Portefeuille complet", W, H);
  let y = 22;

  y = secHdr(doc, "Indicateurs de couverture", y, W);
  const bw = (IW - 9) / 4;
  const bh = 34;
  [
    { l: "Total clients", v: String(total), s: "portefeuille", c1: C.navy, c2: C.steel },
    { l: "Couverture 7j", v: `${cov7d}%`, s: `${recent} visités`, c1: cov7d >= 70 ? [4,78,56] as [number,number,number] : cov7d >= 40 ? [120,53,15] as [number,number,number] : [127,29,29] as [number,number,number], c2: cov7d >= 70 ? C.green : cov7d >= 40 ? C.orange : C.red },
    { l: "Jamais visités", v: String(noVisit), s: `${pct(noVisit, total)}% du portefeuille`, c1: [127,29,29] as [number,number,number], c2: C.red },
    { l: "Dossiers à risque", v: String(totalRisk), s: "SO/PE/DC", c1: C.steel, c2: [22,76,115] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (bw + 3), y, bw, bh, k.l, k.v, k.s, k.c1, k.c2));
  y += bh + 8;

  [
    { l: "Souffrant / Perte", v: String((summary.souffrant ?? 0) + (summary.perte ?? 0)), s: "dossiers en difficulté", c1: [127,29,29] as [number,number,number], c2: C.red },
    { l: "Capital impayé", v: `${fmtCurrency(summary.total_capital_impaye)}`, s: "FCFA — total portefeuille", c1: C.navy, c2: C.steel },
    { l: "Risque non visité", v: String(summary.risk_never_visited ?? 0), s: `dont ${summary.risk_not_visited_30d ?? 0} non vus 30j`, c1: [127,29,29] as [number,number,number], c2: C.red },
    { l: "Couverture 30j", v: `${cov30d}%`, s: `${recent + stale} visités`, c1: cov30d >= 70 ? [4,78,56] as [number,number,number] : cov30d >= 40 ? [120,53,15] as [number,number,number] : [127,29,29] as [number,number,number], c2: cov30d >= 70 ? C.green : cov30d >= 40 ? C.orange : C.red },
  ].forEach((k, i) => kpiBlock(doc, M + i * (bw + 3), y, bw, bh, k.l, k.v, k.s, k.c1, k.c2));
  y += bh + 10;

  // Alertes
  if ((summary.risk_never_visited ?? 0) > 0) {
    fr(doc, M, y, IW, 12, [127,29,29]);
    txt(doc, `⚠ ${summary.risk_never_visited} client(s) à risque n'ont jamais été visités — capital exposé : ${fmtCurrency(summary.total_capital_impaye)} FCFA`, M + 3, y + 7.5, 7.5, C.white, "left", true);
    y += 17;
  }
  const retard90 = summary.retard_90j ?? 0;
  if (retard90 > 0) {
    fr(doc, M, y, IW, 12, [120,53,15]);
    txt(doc, `${retard90} dossier(s) en retard de plus de 90 jours — classement souffrant/perte probable`, M + 3, y + 7.5, 7.5, C.white, "left", true);
    y += 17;
  }

  // Diagramme répartition visites
  y = secHdr(doc, "Répartition des visites", y, W);
  const pieVisit = [
    { label: "Visité 7j", value: recent },
    { label: "Visité 30j", value: stale },
    { label: "Jamais visité", value: noVisit },
  ];
  drawPieDonut(doc, pieVisit, M + 40, y + 42, 36, 16, M + 90, y + 6);
  y += 92;

  // ── Page 3 : Risque crédit ──────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "PORTEFEUILLE CLIENTS", "Risque crédit", "Page 3", tenantName, W);
  pageFtr(doc, tenantName, "Portefeuille complet", W, H);
  y = 22;

  y = secHdr(doc, "Répartition du risque crédit", y, W);
  const pieRiskTotal = (summary.souffrant ?? 0) + (summary.perte ?? 0) + (summary.encours ?? 0);
  const pieRisk = [
    { label: "Souffrant", value: summary.souffrant ?? 0 },
    { label: "Perte", value: summary.perte ?? 0 },
    { label: "Encours", value: summary.encours ?? 0 },
  ];
  if (pieRiskTotal > 0) {
    drawPieDonut(doc, pieRisk, M + 40, y + 42, 36, 16, M + 90, y + 6, riskLabelPct);
  } else {
    txt(doc, "Aucun dossier à risque.", M, y + 10, 9, C.gray);
  }
  y += 92;

  y = secHdr(doc, "Retards par tranche", y, W);
  const retardBars = [
    { label: "1-30 jours", pct: pct(summary.retard_1_30j ?? 0, totalRisk), count: summary.retard_1_30j ?? 0, col: C.gold },
    { label: "31-90 jours", pct: pct(summary.retard_30_90j ?? 0, totalRisk), count: summary.retard_30_90j ?? 0, col: C.orange },
    { label: "> 90 jours", pct: pct(retard90, totalRisk), count: retard90, col: C.red },
  ];
  drawProgressBars(doc, retardBars, M, y, IW);
  y += retardBars.length * 10 + 10;

  txt(doc, `Capital impayé total : ${fmtCurrency(summary.total_capital_impaye)} FCFA · Encours total : ${fmtCurrency(summary.total_encours)} FCFA`, M, y, 8, C.navy, "left", true);
  y += 12;

  // Table risque par agence
  const byAgenceRisk = arr(risk.byAgence);
  if (byAgenceRisk.length > 0) {
    y = secHdr(doc, "Risque par agence", y, W);
    const rows = byAgenceRisk.map((a: any) => [
      a.agence ?? "—", String(a.souffrant ?? 0), String(a.perte ?? 0), String(a.never_visited ?? 0),
      `${fmtCurrency(a.capital_impaye)} FCFA`,
    ]);
    y = simpleTable(doc, ["Agence", "Souffrant", "Perte", "Jamais visités", "Capital impayé"], rows, y, [56, 26, 22, 32, 50], W, H);
  }

  // ── Page 4 : CAF & tables détaillées ────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "PORTEFEUILLE CLIENTS", "Détail par CAF", "Page 4", tenantName, W);
  pageFtr(doc, tenantName, "Portefeuille complet", W, H);
  y = 22;

  const topRisk = arr(risk.topRisk);
  const cafMap = new Map<string, { chargeAffaire: string; agences: Set<string>; capitalImpaye: number; encoursGlobal: number; clients: any[] }>();
  for (const r of topRisk) {
    const key = r.code_charge_affaire || r.charge_affaire || "INCONNU";
    const entry = cafMap.get(key) ?? { chargeAffaire: cafDisplayLabel(r), agences: new Set(), capitalImpaye: 0, encoursGlobal: 0, clients: [] };
    entry.agences.add(r.agence);
    entry.capitalImpaye += Number(r.capital_impaye ?? 0);
    entry.encoursGlobal += Number(r.encours_global ?? 0);
    entry.clients.push(r);
    cafMap.set(key, entry);
  }
  const cafGroups = [...cafMap.values()].sort((a, b) => b.capitalImpaye - a.capitalImpaye);

  y = secHdr(doc, "Dossiers à risque par CAF", y, W);
  if (cafGroups.length > 0) {
    const rows = cafGroups.map((g) => [
      g.chargeAffaire,
      g.agences.size === 0 ? "—" : g.agences.size === 1 ? [...g.agences][0] : `${g.agences.size} agences`,
      String(g.clients.length),
      `${fmtCurrency(g.capitalImpaye)} FCFA`,
      `${fmtCurrency(g.encoursGlobal)} FCFA`,
    ]);
    y = simpleTable(doc, ["CAF", "Agence(s)", "Clients à risque", "Capital impayé", "Encours global"], rows, y, [50, 40, 30, 42, 42], W, H);
  } else {
    txt(doc, "Aucun dossier à risque assigné à un CAF.", M, y + 8, 9, C.gray);
    y += 16;
  }

  // Top dossiers à risque
  y = secHdr(doc, "Top dossiers à risque (urgence)", y, W);
  const topRows = topRisk.slice(0, 30).map((r: any) => [
    r.full_name ?? "—", r.client_ref ?? "—", r.agence ?? "—", r.statut ?? "—",
    String(r.nombre_jour_retard ?? 0), `${fmtCurrency(r.capital_impaye)} FCFA`,
  ]);
  y = simpleTable(doc, ["Client", "Réf.", "Agence", "Statut", "Retard (j)", "Capital impayé"], topRows.length ? topRows : [["—","—","—","—","—","—"]], y, [46, 26, 34, 20, 22, 46], W, H);

  finalizePageNumbers(doc, W, H, M);
  save(doc, tenantName, "portefeuille");
}

function cafDisplayLabel(r: any): string {
  const bad = /^(GESTIONNAIRE_INCONNU|INCONNU)$/i;
  if (r.charge_affaire && !bad.test(r.charge_affaire)) {
    return r.code_charge_affaire ? `${r.charge_affaire} (${r.code_charge_affaire})` : r.charge_affaire;
  }
  return r.code_charge_affaire || "—";
}
function fmtCurrency(n: any) { return Math.round(Number(n ?? 0)).toLocaleString("fr-FR"); }

// ═════════════════════════════════════════════════════════════════════════════
// 2. LOCALISATIONS
// ═════════════════════════════════════════════════════════════════════════════

async function fetchLocationsData(period: number) {
  const [perDay, byType, byUser, byAgence] = await Promise.all([
    api<any>(`/locations/per-day?days=${period}`),
    api<any>(`/locations/by-type?days=${period}`),
    api<any>(`/locations/by-user?days=${period}&limit=15`),
    api<any>(`/locations/by-agence?days=${period}`),
  ]);
  return { perDay: arr(perDay), byType: arr(byType), byUser: arr(byUser), byAgence: arr(byAgence) };
}

export async function generateLocationsPdf(tenantName: string, period = 30) {
  const { perDay, byType, byUser, byAgence } = await fetchLocationsData(period);
  const periodLabel = `${period} derniers jours`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14, IW = W - 2 * M;

  coverPage(doc, W, H, "Localisations", "Analyse des captures GPS terrain", tenantName, periodLabel);

  // ── Page 2 : KPIs + tendance ─────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "LOCALISATIONS", "Vue d'ensemble", "Page 2", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  let y = 22;

  const totalPeriod = perDay.reduce((a: number, d: any) => a + (d.count ?? 0), 0);
  const avgPerDay = perDay.length ? Math.round(totalPeriod / perDay.length) : 0;
  const peakDay = [...perDay].sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))[0];

  y = secHdr(doc, "Indicateurs clés", y, W);
  const bw = (IW - 9) / 4, bh = 34;
  [
    { l: "Total captures", v: String(totalPeriod), s: periodLabel, c1: C.navy, c2: C.steel },
    { l: "Moyenne / jour", v: String(avgPerDay), s: "captures par jour", c1: C.gold, c2: C.goldDark },
    { l: "Jour pic", v: peakDay ? peakDay.day.slice(5) : "—", s: peakDay ? `${peakDay.count} captures` : "—", c1: [5,101,70] as [number,number,number], c2: C.green },
    { l: "Agents actifs", v: String(byUser.length), s: "sur la période", c1: C.violet, c2: [88,28,135] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (bw + 3), y, bw, bh, k.l, k.v, k.s, k.c1, k.c2));
  y += bh + 8;

  y = secHdr(doc, `Captures par jour — ${periodLabel}`, y, W);
  if (perDay.length > 0) {
    const barData = perDay.map((d: any) => ({ label: String(d.day).slice(5), value: d.count ?? 0 }));
    drawBarChart(doc, barData, M + 12, y + 8, IW - 14, 65, C.steel);
    y += 90;
  } else {
    txt(doc, "Aucune donnée sur la période.", M, y + 8, 9, C.gray);
    y += 16;
  }

  // ── Page 3 : Répartition par type + top agents ──────────────────────────────
  doc.addPage();
  pageHdr(doc, "LOCALISATIONS", "Types & agents", "Page 3", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  y = secHdr(doc, "Répartition par type de lieu", y, W);
  if (byType.length > 0) {
    const pieData = byType.map((t: any) => ({ label: t.type ?? "—", value: t.count ?? 0 }));
    drawPieDonut(doc, pieData, M + 40, y + 42, 36, 16, M + 90, y + 6);
    y += 92;
  } else {
    txt(doc, "Aucune donnée.", M, y + 8, 9, C.gray);
    y += 16;
  }

  y = secHdr(doc, "Top agents — nombre de captures", y, W);
  if (byUser.length > 0) {
    const horiz = byUser.slice(0, 10).map((u: any) => ({ label: u.user_name ?? "—", value: u.locations_count ?? 0 }));
    drawHorizBar(doc, horiz, M + 52, y + 4, IW - 56, C.violet);
    y += horiz.length * 7 + 12;
  } else {
    txt(doc, "Aucune donnée.", M, y + 8, 9, C.gray);
    y += 16;
  }

  // ── Page 4 : Par agence + tables ────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "LOCALISATIONS", "Par agence", "Page 4", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  y = secHdr(doc, "Captures par agence", y, W);
  if (byAgence.length > 0) {
    const horiz = byAgence.slice(0, 12).map((a: any) => ({ label: a.agence_name ?? "—", value: a.locations_count ?? 0 }));
    drawHorizBar(doc, horiz, M + 52, y + 4, IW - 56, C.steel);
    y += horiz.length * 7 + 12;
  }

  y = secHdr(doc, "Tableau — captures par utilisateur", y, W);
  const uRows = byUser.map((u: any) => [u.user_name ?? "—", String(u.locations_count ?? 0)]);
  y = simpleTable(doc, ["Agent", "Captures"], uRows.length ? uRows : [["—","—"]], y, [130, 48], W, H);

  finalizePageNumbers(doc, W, H, M);
  save(doc, tenantName, "localisations");
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. AGENTS TERRAIN
// ═════════════════════════════════════════════════════════════════════════════

function lastActivity(u: any): string | null {
  const times = [u.last_capture_at, u.last_seen_at].filter(Boolean).map((t: string) => new Date(t).getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}
function agentStatusLabel(u: any): string {
  const mins = minutesSince(lastActivity(u));
  if (mins == null) return "Inactif";
  if (mins < 60) return "En ligne";
  if (mins < 480) return "Récent";
  if ((u.locations_24h ?? 0) > 0) return "Actif auj.";
  return "Hors ligne";
}

async function fetchAgentsData(period: number) {
  const [statsRaw, agences, fleet] = await Promise.all([
    api<any>(`/users/stats?days=${period}`),
    fetchAgences(),
    api<any>("/users/mobile-fleet"),
  ]);
  const users = arr(statsRaw?.users ?? statsRaw);
  return { users, agences, fleet: arr(fleet) };
}

export async function generateAgentsPdf(tenantName: string, period = 30) {
  const { users, fleet } = await fetchAgentsData(period);
  const periodLabel = `${period} derniers jours`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14, IW = W - 2 * M;

  coverPage(doc, W, H, "Agents Terrain", "Performance & activité des agents mobiles", tenantName, periodLabel);

  // ── Page 2 : KPIs + activité ─────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "AGENTS TERRAIN", "Vue d'ensemble", "Page 2", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  let y = 22;

  const statuses = users.map(agentStatusLabel);
  const onlineCount = statuses.filter((s) => s === "En ligne").length;
  const recentCount = statuses.filter((s) => s === "Récent").length;
  const offlineCount = users.length - onlineCount - recentCount;
  const totalToday = users.reduce((a: number, u: any) => a + (u.locations_24h ?? 0), 0);
  const total30d = users.reduce((a: number, u: any) => a + (u.locations_30d ?? 0), 0);
  const topPerformer = [...users].sort((a: any, b: any) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0))[0];

  y = secHdr(doc, "Indicateurs clés", y, W);
  const bw = (IW - 9) / 4, bh = 34;
  [
    { l: "Agents actifs", v: String(users.filter((u: any) => u.is_active).length), s: `${users.length} au total`, c1: C.navy, c2: C.steel },
    { l: "En ligne (1h)", v: String(onlineCount), s: "connectés récemment", c1: [4,78,56] as [number,number,number], c2: C.green },
    { l: "Captures aujourd'hui", v: String(totalToday), s: "toutes équipes", c1: C.gold, c2: C.goldDark },
    { l: "Captures 30j", v: String(total30d), s: periodLabel, c1: C.violet, c2: [88,28,135] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (bw + 3), y, bw, bh, k.l, k.v, k.s, k.c1, k.c2));
  y += bh + 10;

  if (topPerformer) {
    fr(doc, M, y, IW, 12, [28,52,78]);
    txt(doc, `🏆 Meilleur agent : ${topPerformer.name ?? topPerformer.username} — ${topPerformer.locations_30d ?? 0} captures sur ${periodLabel}`, M + 3, y + 7.5, 7.5, C.gold, "left", true);
    y += 17;
  }

  y = secHdr(doc, "Répartition de l'activité", y, W);
  const pieActivity = [
    { label: "En ligne", value: onlineCount },
    { label: "Récent", value: recentCount },
    { label: "Hors ligne / inactif", value: Math.max(0, offlineCount) },
  ];
  drawPieDonut(doc, pieActivity, M + 40, y + 42, 36, 16, M + 90, y + 6);
  y += 92;

  // ── Page 3 : Tableau de performance ──────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "AGENTS TERRAIN", "Performance", "Page 3", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  y = secHdr(doc, "Tableau de performance agents", y, W);
  const sorted = [...users].sort((a: any, b: any) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0));
  const rows = sorted.slice(0, 40).map((u: any) => [
    u.name ?? u.username ?? "—", u.role_name ?? "—", u.agence_name ?? "—",
    String(u.locations_24h ?? 0), String(u.locations_30d ?? 0), agentStatusLabel(u),
  ]);
  y = simpleTable(doc, ["Agent", "Rôle", "Agence", "Auj.", "30j", "Statut"], rows.length ? rows : [["—","—","—","—","—","—"]], y, [46, 34, 46, 18, 18, 26], W, H);

  // ── Page 4 : Flotte mobile ───────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "AGENTS TERRAIN", "Flotte mobile", "Page 4", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  const blocked = fleet.filter((u: any) => !u.is_active).length;
  y = secHdr(doc, "État de la flotte mobile", y, W);
  const fbw = (IW - 6) / 3, fbh = 30;
  [
    { l: "Terminaux enregistrés", v: String(fleet.length), s: "agents équipés", c1: C.navy, c2: C.steel },
    { l: "Captures 7j (flotte)", v: String(fleet.reduce((a: number, u: any) => a + (u.locations_7d ?? 0), 0)), s: "toute la flotte", c1: C.gold, c2: C.goldDark },
    { l: "Comptes bloqués", v: String(blocked), s: blocked > 0 ? "à vérifier" : "aucun", c1: blocked > 0 ? [127,29,29] as [number,number,number] : [4,78,56] as [number,number,number], c2: blocked > 0 ? C.red : C.green },
  ].forEach((k, i) => kpiBlock(doc, M + i * (fbw + 3), y, fbw, fbh, k.l, k.v, k.s, k.c1, k.c2));
  y += fbh + 10;

  y = secHdr(doc, "Répartition par agence", y, W);
  const byAg = new Map<string, number>();
  for (const u of fleet) byAg.set(u.agence_name ?? "—", (byAg.get(u.agence_name ?? "—") ?? 0) + 1);
  const grouped = [...byAg.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (grouped.length > 0) {
    drawHorizBar(doc, grouped.slice(0, 12), M + 52, y + 4, IW - 56, C.steel);
    y += Math.min(grouped.length, 12) * 7 + 12;
  }

  finalizePageNumbers(doc, W, H, M);
  save(doc, tenantName, "agents-terrain");
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. RAPPORT GLOBAL — combine les 3 catégories dans un seul document
// ═════════════════════════════════════════════════════════════════════════════

export async function generateGlobalAnalyticsPdf(tenantName: string, period = 30) {
  const [portfolio, locations, agents] = await Promise.all([
    fetchPortfolioData(),
    fetchLocationsData(period),
    fetchAgentsData(period),
  ]);
  const periodLabel = `Portefeuille complet · Terrain ${period}j`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14, IW = W - 2 * M;

  coverPage(doc, W, H, "Rapport Global", "Portefeuille · Localisations · Agents terrain", tenantName, periodLabel);

  // ── Section 1 : Portefeuille ─────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "RAPPORT GLOBAL", "1. Portefeuille clients", "Page 2", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  let y = 22;

  const summary = portfolio.risk.summary ?? {};
  const total = portfolio.stats.total ?? 0;
  const recent = portfolio.stats.recent ?? 0;
  const noVisit = portfolio.stats.no_visit ?? 0;

  y = secHdr(doc, "Portefeuille clients — indicateurs clés", y, W);
  const bw = (IW - 9) / 4, bh = 32;
  [
    { l: "Total clients", v: String(total), s: "portefeuille", c1: C.navy, c2: C.steel },
    { l: "Couverture 7j", v: `${pct(recent, total)}%`, s: `${recent} visités`, c1: C.gold, c2: C.goldDark },
    { l: "Jamais visités", v: String(noVisit), s: `${pct(noVisit, total)}%`, c1: [127,29,29] as [number,number,number], c2: C.red },
    { l: "Dossiers à risque", v: String(summary.total_risk ?? 0), s: "SO/PE/DC", c1: C.steel, c2: [22,76,115] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (bw + 3), y, bw, bh, k.l, k.v, k.s, k.c1, k.c2));
  y += bh + 10;

  y = secHdr(doc, "Répartition du risque crédit", y, W);
  const pieRisk = [
    { label: "Souffrant", value: summary.souffrant ?? 0 },
    { label: "Perte", value: summary.perte ?? 0 },
    { label: "Encours", value: summary.encours ?? 0 },
  ];
  drawPieDonut(doc, pieRisk, M + 40, y + 42, 34, 15, M + 88, y + 6, riskLabelPct);
  y += 90;

  const topRisk = arr(portfolio.risk.topRisk);
  y = secHdr(doc, "Top dossiers à risque", y, W);
  const topRows = topRisk.slice(0, 15).map((r: any) => [
    r.full_name ?? "—", r.agence ?? "—", r.statut ?? "—", String(r.nombre_jour_retard ?? 0), `${fmtCurrency(r.capital_impaye)} FCFA`,
  ]);
  y = simpleTable(doc, ["Client", "Agence", "Statut", "Retard (j)", "Capital impayé"], topRows.length ? topRows : [["—","—","—","—","—"]], y, [48, 40, 26, 26, 54], W, H);

  // ── Section 2 : Localisations ────────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "RAPPORT GLOBAL", "2. Localisations", "Page 3", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  const { perDay, byType, byUser } = locations;
  const totalPeriod = perDay.reduce((a: number, d: any) => a + (d.count ?? 0), 0);
  const avgPerDay = perDay.length ? Math.round(totalPeriod / perDay.length) : 0;

  y = secHdr(doc, `Localisations — ${period} derniers jours`, y, W);
  const lbw = (IW - 6) / 3, lbh = 32;
  [
    { l: "Total captures", v: String(totalPeriod), s: `${period}j`, c1: C.navy, c2: C.steel },
    { l: "Moyenne / jour", v: String(avgPerDay), s: "captures/j", c1: C.gold, c2: C.goldDark },
    { l: "Agents actifs", v: String(byUser.length), s: "sur la période", c1: C.violet, c2: [88,28,135] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (lbw + 3), y, lbw, lbh, k.l, k.v, k.s, k.c1, k.c2));
  y += lbh + 10;

  y = secHdr(doc, "Captures par jour", y, W);
  if (perDay.length > 0) {
    const barData = perDay.map((d: any) => ({ label: String(d.day).slice(5), value: d.count ?? 0 }));
    drawBarChart(doc, barData, M + 12, y + 8, IW - 14, 60, C.steel);
    y += 85;
  }

  if (byType.length > 0) {
    y = secHdr(doc, "Répartition par type de lieu", y, W);
    const horiz = byType.map((t: any) => ({ label: t.type ?? "—", value: t.count ?? 0 }));
    drawHorizBar(doc, horiz, M + 52, y + 4, IW - 56, C.gold);
    y += Math.min(horiz.length, 12) * 7 + 10;
  }

  // ── Section 3 : Agents terrain ──────────────────────────────────────────────
  doc.addPage();
  pageHdr(doc, "RAPPORT GLOBAL", "3. Agents terrain", "Page 4", tenantName, W);
  pageFtr(doc, tenantName, periodLabel, W, H);
  y = 22;

  const { users } = agents;
  const statuses = users.map(agentStatusLabel);
  const onlineCount = statuses.filter((s) => s === "En ligne").length;

  y = secHdr(doc, "Agents terrain — indicateurs clés", y, W);
  const abw = (IW - 9) / 4, abh = 32;
  [
    { l: "Agents actifs", v: String(users.filter((u: any) => u.is_active).length), s: `${users.length} au total`, c1: C.navy, c2: C.steel },
    { l: "En ligne (1h)", v: String(onlineCount), s: "connectés récemment", c1: [4,78,56] as [number,number,number], c2: C.green },
    { l: "Captures aujourd'hui", v: String(users.reduce((a: number, u: any) => a + (u.locations_24h ?? 0), 0)), s: "toutes équipes", c1: C.gold, c2: C.goldDark },
    { l: "Captures 30j", v: String(users.reduce((a: number, u: any) => a + (u.locations_30d ?? 0), 0)), s: `${period}j`, c1: C.violet, c2: [88,28,135] as [number,number,number] },
  ].forEach((k, i) => kpiBlock(doc, M + i * (abw + 3), y, abw, abh, k.l, k.v, k.s, k.c1, k.c2));
  y += abh + 10;

  y = secHdr(doc, "Top 10 agents — captures 30j", y, W);
  const topAgents = [...users].sort((a: any, b: any) => (b.locations_30d ?? 0) - (a.locations_30d ?? 0)).slice(0, 10)
    .map((u: any) => ({ label: u.name ?? u.username ?? "—", value: u.locations_30d ?? 0 }));
  drawHorizBar(doc, topAgents, M + 52, y + 4, IW - 56, C.violet);
  y += Math.min(topAgents.length, 12) * 7 + 12;

  finalizePageNumbers(doc, W, H, M);
  save(doc, tenantName, "global");
}

function save(doc: jsPDF, tenantName: string, kind: string) {
  const slug = tenantName.toLowerCase().replace(/\s+/g, "-");
  doc.save(`rapport-${kind}-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
