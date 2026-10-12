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
import { LogOut, LockKeyhole } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
    // Non-dismissable : l'utilisateur DOIT se reconnecter, pas de fermeture au clic extérieur ni à Échap.
    <Dialog open={open}>
      <DialogContent
        size="xs"
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="px-8 py-8 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-[#3C8047]/10 text-[#3C8047]">
            <LockKeyhole size={34} />
          </div>
          <DialogTitle className="mb-2 text-[19px] font-extrabold text-foreground">Session expirée</DialogTitle>
          <p className="mb-7 text-sm leading-relaxed text-muted-foreground">
            Votre session a expiré pour des raisons de sécurité. Reconnectez-vous
            pour continuer à accéder à votre espace.
          </p>
          <Button className="h-11 w-full text-[15px] font-bold hover:bg-[#1E6091] hover:opacity-100" disabled={loggingOut} onClick={handleReconnect}>
            <LogOut size={18} /> {loggingOut ? "Déconnexion…" : "Se reconnecter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
