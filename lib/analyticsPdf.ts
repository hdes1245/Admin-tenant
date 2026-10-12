import { apiClient } from "./apiClient";
import { fetchAgences } from "./agences";
import { renderPdf } from "./pdf/pdfClient";
import type { PortfolioData, LocationsData, AgentsData } from "./pdf/analyticsBuilders";

// Rapports PDF des 3 catégories de la page « Analytics & Rapports » (Portefeuille &
// couverture / Localisations / Agents terrain) + rapport global.
//
// Architecture : les données sont récupérées ICI, sur le thread principal (cookies de
// session, intercepteurs axios, gestion du 401), puis la construction du document — la
// partie coûteuse en CPU — est déportée dans un Web Worker (lib/pdf/*). L'interface reste
// ainsi fluide pendant la génération. Les constructeurs (lib/pdf/analyticsBuilders.ts)
// reproduisent exactement les calculs dérivés de l'UI pour que le PDF corresponde à
// ce que l'admin voit à l'écran.

const arr = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);

async function api<T = any>(path: string): Promise<T> {
  const r = await apiClient.get(path);
  return r.data as T;
}

async function fetchPortfolioData(): Promise<PortfolioData> {
  const [stats, risk] = await Promise.all([
    api<any>("/clients/coverage/stats"),
    api<any>("/clients/risk-analysis"),
  ]);
  return { stats: stats ?? {}, risk: risk ?? {} };
}

async function fetchLocationsData(period: number): Promise<LocationsData> {
  const [perDay, byType, byUser, byAgence] = await Promise.all([
    api<any>(`/locations/per-day?days=${period}`),
    api<any>(`/locations/by-type?days=${period}`),
    api<any>(`/locations/by-user?days=${period}&limit=15`),
    api<any>(`/locations/by-agence?days=${period}`),
  ]);
  return { perDay: arr(perDay), byType: arr(byType), byUser: arr(byUser), byAgence: arr(byAgence) };
}

async function fetchAgentsData(period: number): Promise<AgentsData> {
  const [statsRaw, agences, fleet] = await Promise.all([
    api<any>(`/users/stats?days=${period}`),
    fetchAgences(),
    api<any>("/users/mobile-fleet"),
  ]);
  const users = arr(statsRaw?.users ?? statsRaw);
  return { users, agences, fleet: arr(fleet) };
}

export async function generatePortfolioPdf(tenantName: string) {
  const data = await fetchPortfolioData();
  await renderPdf({ kind: "portfolio", tenantName, data });
}

export async function generateLocationsPdf(tenantName: string, period = 30) {
  const data = await fetchLocationsData(period);
  await renderPdf({ kind: "locations", tenantName, period, data });
}

export async function generateAgentsPdf(tenantName: string, period = 30) {
  const data = await fetchAgentsData(period);
  await renderPdf({ kind: "agents", tenantName, period, data });
}

export async function generateGlobalAnalyticsPdf(tenantName: string, period = 30) {
  const [portfolio, locations, agents] = await Promise.all([
    fetchPortfolioData(),
    fetchLocationsData(period),
    fetchAgentsData(period),
  ]);
  await renderPdf({ kind: "global", tenantName, period, portfolio, locations, agents });
}
