"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import ClientPortfolioPage from "../client-portfolio/page";
import { AgentsTerrainView } from "@/components/AgentsTerrainView";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

// Analytics localisations : lourd (recharts) → chargé à la demande.
const LocationAnalyticsPage = dynamic(() => import("../location-analytics/page"), {
  ssr: false,
  loading: () => <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>,
});

// Point d'entrée unique regroupant toutes les vues analytiques du tenant
// (portefeuille & couverture clients, analyse des captures GPS terrain).
export default function AnalyticsPage() {
  const [tab, setTab] = useState(0);

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <InsightsIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Analytics &amp; Rapports</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Portefeuille clients, risque crédit et analyse des captures GPS terrain
          </Typography>
        </Box>
      </Box>

      <Box sx={{ borderBottom: "1px solid #e2e8f0", background: "white", px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { fontWeight: 600, fontSize: 13, textTransform: "none", minHeight: 48 }, "& .Mui-selected": { color: GOLD }, "& .MuiTabs-indicator": { background: GOLD } }}>
          <Tab label="Portefeuille & couverture" />
          <Tab label="Localisations" />
          <Tab label="Agents terrain" />
        </Tabs>
      </Box>

      {tab === 0 && <ClientPortfolioPage />}
      {tab === 1 && <LocationAnalyticsPage />}
      {tab === 2 && <AgentsTerrainView embedded />}
    </>
  );
}
