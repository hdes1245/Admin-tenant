"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, FileText, Layers, LineChart, FileDown } from "lucide-react";
import ClientPortfolioPage from "../client-portfolio/page";
import { AgentsTerrainView } from "@/components/AgentsTerrainView";
import { fetchMe } from "@/lib/auth";
import { generatePortfolioPdf, generateLocationsPdf, generateAgentsPdf, generateGlobalAnalyticsPdf } from "@/lib/analyticsPdf";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Snackbar } from "@/components/ui/snackbar";
import { TabBar } from "@/components/ui/tabs";
import { HeaderButton, PageHeader } from "@/components/ui/page-blocks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Analytics localisations : lourd (recharts) → chargé à la demande.
const LocationAnalyticsPage = dynamic(() => import("../location-analytics/page"), {
  ssr: false,
  loading: () => <div className="p-8 text-center"><Spinner className="size-7" /></div>,
});

const TAB_LABELS = ["Portefeuille & couverture", "Localisations", "Agents terrain"];

// Point d'entrée unique regroupant toutes les vues analytiques du tenant
// (portefeuille & couverture clients, analyse des captures GPS terrain).
export default function AnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantName = async () => {
    // /auth/me est accessible à tout rôle authentifié (contrairement à
    // /tenants/me/branding, réservé à admin/admin_tenant, qui renvoyait
    // "Accès refusé : rôle insuffisant" pour les autres rôles — ex. Directrice
    // Exploitation — lors de l'export d'un rapport).
    const me = await fetchMe();
    return me?.tenantName?.trim() || "Tenant";
  };

  const runExport = async (fn: () => Promise<void>) => {
    setMenuOpen(false);
    setExporting(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Échec de la génération du rapport PDF.");
    } finally {
      setExporting(false);
    }
  };

  const exportCurrentTab = () => runExport(async () => {
    const name = await tenantName();
    if (tab === 0) await generatePortfolioPdf(name);
    else if (tab === 1) await generateLocationsPdf(name, 30);
    else await generateAgentsPdf(name, 30);
  });

  const exportGlobal = () => runExport(async () => {
    const name = await tenantName();
    await generateGlobalAnalyticsPdf(name, 30);
  });

  return (
    <>
      <PageHeader icon={<LineChart size={30} />} title="Analytics & Rapports" subtitle="Portefeuille clients, risque crédit et analyse des captures GPS terrain">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <Tooltip title={exporting ? "Génération en cours…" : "Exporter un rapport PDF détaillé"}>
            <DropdownMenuTrigger asChild disabled={exporting}>
              <HeaderButton>
                {exporting ? <Spinner className="size-4" /> : <FileDown size={16} />}
                {exporting ? "Génération…" : "Exporter en PDF"}
                {!exporting && <ChevronDown size={16} />}
              </HeaderButton>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={exportCurrentTab}
              icon={<FileText size={18} className="text-[#1E6091]" />}
              title={`Rapport — ${TAB_LABELS[tab]}`}
              secondary="Uniquement la catégorie affichée"
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={exportGlobal}
              icon={<Layers size={18} className="text-[#3C8047]" />}
              title="Rapport global"
              secondary="Portefeuille + Localisations + Agents terrain"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="border-b border-border bg-surface px-6">
        <TabBar tabs={TAB_LABELS} value={tab} onChange={setTab} />
      </div>

      {tab === 0 && <ClientPortfolioPage />}
      {tab === 1 && <LocationAnalyticsPage />}
      {tab === 2 && <AgentsTerrainView embedded />}

      <Snackbar open={!!error} onClose={() => setError(null)}>{error}</Snackbar>
    </>
  );
}
