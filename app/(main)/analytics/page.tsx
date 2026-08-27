"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Box, Button, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText,
  Tab, Tabs, Tooltip, Typography, Snackbar, Alert, Divider,
} from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DescriptionIcon from "@mui/icons-material/Description";
import LayersIcon from "@mui/icons-material/Layers";
import ClientPortfolioPage from "../client-portfolio/page";
import { AgentsTerrainView } from "@/components/AgentsTerrainView";
import { fetchMe } from "@/lib/auth";
import { generatePortfolioPdf, generateLocationsPdf, generateAgentsPdf, generateGlobalAnalyticsPdf } from "@/lib/analyticsPdf";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

// Analytics localisations : lourd (recharts) → chargé à la demande.
const LocationAnalyticsPage = dynamic(() => import("../location-analytics/page"), {
  ssr: false,
  loading: () => <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>,
});

const TAB_LABELS = ["Portefeuille & couverture", "Localisations", "Agents terrain"];

// Point d'entrée unique regroupant toutes les vues analytiques du tenant
// (portefeuille & couverture clients, analyse des captures GPS terrain).
export default function AnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
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
    setMenuAnchor(null);
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
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <InsightsIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Analytics &amp; Rapports</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
            Portefeuille clients, risque crédit et analyse des captures GPS terrain
          </Typography>
        </Box>

        <Tooltip title={exporting ? "Génération en cours…" : "Exporter un rapport PDF détaillé"}>
          <span>
            <Button
              variant="outlined"
              disabled={exporting}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              startIcon={exporting ? <CircularProgress size={16} sx={{ color: "white" }} /> : <PictureAsPdfIcon />}
              endIcon={!exporting && <ArrowDropDownIcon />}
              sx={{
                color: "white", borderColor: "rgba(255,255,255,0.4)", textTransform: "none", fontWeight: 600,
                "&:hover": { borderColor: GOLD, background: "rgba(196,154,46,0.12)" },
              }}
            >
              {exporting ? "Génération…" : "Exporter en PDF"}
            </Button>
          </span>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}>
          <MenuItem onClick={exportCurrentTab}>
            <ListItemIcon><DescriptionIcon fontSize="small" sx={{ color: STEEL }} /></ListItemIcon>
            <ListItemText
              primary={`Rapport — ${TAB_LABELS[tab]}`}
              secondary="Uniquement la catégorie affichée"
            />
          </MenuItem>
          <Divider />
          <MenuItem onClick={exportGlobal}>
            <ListItemIcon><LayersIcon fontSize="small" sx={{ color: GOLD }} /></ListItemIcon>
            <ListItemText
              primary="Rapport global"
              secondary="Portefeuille + Localisations + Agents terrain"
            />
          </MenuItem>
        </Menu>
      </Box>

      <Box sx={{ borderBottom: "1px solid #e2e8f0", background: "white", px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { fontWeight: 600, fontSize: 13, textTransform: "none", minHeight: 48 }, "& .Mui-selected": { color: GOLD }, "& .MuiTabs-indicator": { background: GOLD } }}>
          {TAB_LABELS.map((l) => <Tab key={l} label={l} />)}
        </Tabs>
      </Box>

      {tab === 0 && <ClientPortfolioPage />}
      {tab === 1 && <LocationAnalyticsPage />}
      {tab === 2 && <AgentsTerrainView embedded />}

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>{error}</Alert>
      </Snackbar>
    </>
  );
}
