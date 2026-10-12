import type { jsPDF } from "jspdf";
import {
  buildPortfolioPdf, buildLocationsPdf, buildAgentsPdf, buildGlobalPdf, analyticsFileName,
  type PortfolioData, type LocationsData, type AgentsData,
} from "./analyticsBuilders";
import { buildDashboardPdf, dashboardFileName, type PdfReportData } from "../dashboardPdf";

// Description sérialisable (structured clone) d'un rapport à générer. Les données
// sont récupérées sur le thread principal (cookies/intercepteurs axios) ; seule la
// construction du document — la partie coûteuse en CPU — est déportée dans le worker.
export type PdfJob =
  | { kind: "portfolio"; tenantName: string; data: PortfolioData }
  | { kind: "locations"; tenantName: string; period: number; data: LocationsData }
  | { kind: "agents"; tenantName: string; period: number; data: AgentsData }
  | { kind: "global"; tenantName: string; period: number; portfolio: PortfolioData; locations: LocationsData; agents: AgentsData }
  | { kind: "dashboard"; data: PdfReportData };

/** Construit le document. Module pur : sans DOM, donc utilisable dans le worker comme sur le thread principal (repli). */
export function runPdfJob(job: PdfJob): { doc: jsPDF; filename: string } {
  switch (job.kind) {
    case "portfolio":
      return { doc: buildPortfolioPdf(job.tenantName, job.data), filename: analyticsFileName(job.tenantName, "portefeuille") };
    case "locations":
      return { doc: buildLocationsPdf(job.tenantName, job.period, job.data), filename: analyticsFileName(job.tenantName, "localisations") };
    case "agents":
      return { doc: buildAgentsPdf(job.tenantName, job.period, job.data), filename: analyticsFileName(job.tenantName, "agents-terrain") };
    case "global":
      return { doc: buildGlobalPdf(job.tenantName, job.period, job.portfolio, job.locations, job.agents), filename: analyticsFileName(job.tenantName, "global") };
    case "dashboard":
      return { doc: buildDashboardPdf(job.data), filename: dashboardFileName(job.data.tenantName) };
  }
}
