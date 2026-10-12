"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

// Temps réel : le serveur pousse un signal « ce sujet a changé » (jamais de données métier) ;
// on invalide alors les requêtes React Query concernées, qui se rechargent via l'API REST
// habituelle (donc avec les mêmes contrôles d'accès). Remplace le polling périodique : tant que
// la connexion est active, les intervalles de rafraîchissement ne servent plus que de filet.

type Topic = "locations" | "fleet" | "tickets" | "clients" | "users" | "agences" | "zones" | "notifications";

// Sujet -> racines des clés de requête à invalider.
const TOPIC_QUERY_ROOTS: Record<Topic, string[]> = {
  locations: [
    "locations-stats", "locations-page", "locations-map", "loc-per-day-tenant", "loc-per-day", "loc-heatmap",
    "loc-by-user", "loc-by-type", "loc-by-agence", "me-locations", "team-stats",
    "dashboard-stats", "dashboard-charts", "dashboard-logs",
    "client-coverage", "client-coverage-stats", "client-risk-analysis", "clients-global-stats",
  ],
  fleet: ["mobile-fleet", "team-stats", "sync-logs", "active-sessions"],
  tickets: [
    "tickets-tenant", "tickets-my-it", "my-tickets", "ticket-comments", "ticket-comments-ref",
    "ticket-attachments", "escalation-comments", "my-ticket-comments", "dashboard-stats", "dashboard-charts",
  ],
  clients: [
    "clients", "clients-global-stats", "clients-available-cafs", "clients-available-cafs-raw",
    "client-coverage", "client-coverage-stats", "client-risk-analysis", "dashboard-stats",
  ],
  users: ["users", "mobile-fleet", "team-stats", "agences-users-summary", "caf-contexts", "dashboard-stats"],
  agences: ["agences", "agences-stats", "agences-users-summary", "dashboard-stats", "dashboard-charts"],
  zones: ["zones", "agences"],
  notifications: ["my-notifications", "notif-kpi"],
};

const ALL_TOPICS = Object.keys(TOPIC_QUERY_ROOTS) as Topic[];

// Pages sans session : on n'ouvre pas de connexion.
const PUBLIC_PREFIXES = ["/login", "/change-password"];

interface RealtimeState {
  connected: boolean;
}
const RealtimeContext = createContext<RealtimeState>({ connected: false });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const pathname = usePathname() ?? "";
  const [connected, setConnected] = useState(false);
  const isPublicPage = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isPublicPage) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    const pending = new Set<Topic>();
    let hasConnectedOnce = false;

    const invalidate = (topics: Iterable<Topic>) => {
      const roots = new Set<string>();
      for (const t of topics) TOPIC_QUERY_ROOTS[t]?.forEach((r) => roots.add(r));
      if (roots.size === 0) return;
      // Seules les requêtes actuellement affichées se rechargent tout de suite ; les autres sont marquées périmées.
      void qc.invalidateQueries({ predicate: (q) => roots.has(String(q.queryKey[0])) });
    };

    // Cookie de session httpOnly (nom propre à cette app, choisi côté serveur via ?app=tenant).
    const socket: Socket = io(`${baseUrl}/realtime`, {
      withCredentials: true,
      query: { app: "tenant" },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      // Après une RE-connexion, des signaux ont pu être manqués : on resynchronise tout.
      if (hasConnectedOnce) invalidate(ALL_TOPICS);
      hasConnectedOnce = true;
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      setConnected(false);
      // Session invalide / origine refusée : inutile de réessayer en boucle (le 401 REST affichera la reconnexion).
      if (err.message === "unauthorized" || err.message === "forbidden") socket.disconnect();
    });

    socket.on("invalidate", (msg: { topic?: Topic }) => {
      if (!msg?.topic || !(msg.topic in TOPIC_QUERY_ROOTS)) return;
      // Onglet masqué : on ne recharge pas en arrière-plan, on rattrape au retour.
      if (document.hidden) pending.add(msg.topic);
      else invalidate([msg.topic]);
    });

    const onVisible = () => {
      if (document.hidden || pending.size === 0) return;
      invalidate(pending);
      pending.clear();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [isPublicPage, qc]);

  return <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>;
}

/** true tant que la connexion temps réel est établie. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext).connected;
}

/**
 * Intervalle de rafraîchissement adaptatif : le polling d'origine (`fallbackMs`) tant que le temps
 * réel est indisponible, puis un simple filet de sécurité (`safetyNetMs`, 5 min par défaut) une
 * fois connecté, puisque les changements arrivent par push.
 */
export function useLiveInterval(fallbackMs: number, safetyNetMs = 5 * 60_000): number {
  return useRealtimeConnected() ? safetyNetMs : fallbackMs;
}
