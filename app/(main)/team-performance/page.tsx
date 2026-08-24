"use client";

import { AgentsTerrainView } from "@/components/AgentsTerrainView";

// Route « Agents terrain » (accès direct / atterrissage superviseur) : rend la
// vue complète avec son en-tête. La même vue est réutilisée, sans en-tête, dans
// la page « Analytics & Rapports ».
export default function AgentsTerrainPage() {
  return <AgentsTerrainView />;
}
