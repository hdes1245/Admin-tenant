import axios from 'axios';

// ⚠️ DUPLIQUÉ INTENTIONNELLEMENT dans AdminGeoTrust/lib/apiClient.ts.
// Les deux apps Next.js sont des projets indépendants (pas de monorepo/
// workspace partagé) — toute modification de la logique d'auth/token ici
// (gestion du 401, header Authorization, etc.) doit être répliquée
// manuellement dans l'autre fichier pour éviter une dérive de comportement
// entre Admin_tenant et AdminGeoTrust. Seules différences volontaires entre
// les deux : le nom de la clé localStorage du token, et la présence du flux
// de branding par tenantSlug (propre à Admin_tenant, absent d'AdminGeoTrust
// qui n'a qu'un seul "tenant" : GeoTrust lui-même).

// Côté navigateur : on passe par le proxy Next.js /proxy/* → aucun problème CORS.
// Côté serveur Next.js (SSR) : on appelle directement le backend.
const GEO_BACKEND_URL =
  typeof window !== 'undefined'
    ? '/proxy'
    : (process.env.NEXT_PUBLIC_GEO_BACKEND_URL ?? 'http://localhost:3000');

export const apiClient = axios.create({
  baseURL: GEO_BACKEND_URL,
  withCredentials: true,
  // Permet au backend de poser/lire un cookie de session distinct de celui
  // d'AdminGeoTrust : les deux apps tournent sur le même host "localhost" en
  // dev (ports différents seulement), et un cookie httpOnly sans attribut
  // Domain est partagé entre TOUS les ports d'un même host — sans cet
  // en-tête, se connecter sur l'une écrasait silencieusement la session de
  // l'autre (voir geo-backend/src/auth/app-cookie.util.ts).
  headers: { "X-Client-App": "tenant" },
});

// Le JWT vit désormais uniquement dans un cookie httpOnly "access_token" posé
// par le backend (voir auth.controller.ts) — plus de header Authorization
// géré ici, `withCredentials: true` suffit à faire suivre le cookie sur
// chaque requête via le proxy same-origin. Ça élimine le vol de token par
// XSS (le JS, y compris un script injecté, ne peut plus lire ce cookie).

// Passe à true dès qu'une requête authentifiée réussit. Sert à ne montrer la
// modale "session expirée" QUE pour une expiration en cours de session : sur
// un chargement à froid avec cookie déjà expiré, on laisse le layout rediriger
// vers /login sans faire clignoter la modale.
let sessionEstablished = false;

apiClient.interceptors.response.use(
  (response) => {
    sessionEstablished = true;
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? "");
    // Un 401 sur /auth/login = mauvais identifiants (géré en ligne par la page
    // de connexion), pas une session expirée : on ne déclenche pas la modale.
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/logout");
    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !isAuthEndpoint &&
      sessionEstablished
    ) {
      // Signale à l'UI d'afficher la modale de reconnexion (SessionExpiredDialog),
      // au lieu de rediriger brutalement ou d'afficher silencieusement des "0".
      window.dispatchEvent(new Event("app:session-expired"));
    }
    return Promise.reject(error);
  },
);

