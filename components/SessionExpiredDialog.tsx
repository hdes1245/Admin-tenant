"use client";

// ⚠️ DUPLIQUÉ INTENTIONNELLEMENT dans AdminGeoTrust/components/SessionExpiredDialog.tsx.
// Les deux apps sont indépendantes (pas de workspace partagé) — toute
// modification ici doit être répliquée dans l'autre fichier.
//
// Modale globale affichée quand une requête authentifiée reçoit un 401
// (cookie de session httpOnly expiré/invalide). L'événement est émis par
// l'intercepteur axios (lib/apiClient.ts) et par le layout. Elle remplace
// l'ancien comportement (redirection brutale, ou pire : affichage silencieux
// de "0" partout, qui faisait croire à une perte de données).

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, Box, Typography, Button,
} from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import LogoutIcon from "@mui/icons-material/Logout";
import { apiClient } from "@/lib/apiClient";

const NAVY = "#0D1B2A";
const GOLD = "#C49A2E";

export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const onExpired = () => setOpen(true);
    window.addEventListener("app:session-expired", onExpired);
    return () => window.removeEventListener("app:session-expired", onExpired);
  }, []);

  const handleReconnect = async () => {
    setLoggingOut(true);
    try {
      // Blackliste le token côté serveur + efface le cookie (best-effort :
      // il est probablement déjà invalide, on ignore l'échec).
      await apiClient.post("/auth/logout");
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("admin_role");
      window.localStorage.removeItem("tenantSlug");
      window.location.replace("/login");
    }
  };

  return (
    <Dialog
      open={open}
      // Non-dismissable : l'utilisateur DOIT se reconnecter, pas de fermeture
      // au clic extérieur ni à Échap.
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      <Box sx={{ height: 4, bgcolor: GOLD }} />
      <DialogContent sx={{ px: 4, py: 4, textAlign: "center" }}>
        <Box
          sx={{
            width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: `${GOLD}1A`,
          }}
        >
          <LockClockIcon sx={{ fontSize: 34, color: GOLD }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 19, color: NAVY, mb: 1 }}>
          Session expirée
        </Typography>
        <Typography sx={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, mb: 3.5 }}>
          Votre session a expiré pour des raisons de sécurité. Reconnectez-vous
          pour continuer à accéder à votre espace.
        </Typography>
        <Button
          fullWidth
          variant="contained"
          startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
          disabled={loggingOut}
          onClick={handleReconnect}
          sx={{
            height: 46, bgcolor: NAVY, fontWeight: 700, fontSize: 15,
            textTransform: "none", borderRadius: 2,
            "&:hover": { bgcolor: "#1B4F72" },
          }}
        >
          {loggingOut ? "Déconnexion…" : "Se reconnecter"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
