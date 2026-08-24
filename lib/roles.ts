/**
 * Répartition des interfaces par rôle :
 * - admin_tenant           → interface d'administration complète (existante)
 * - rôles superviseurs     → interface superviseur (pages opérationnelles
 *                            scopées par le backend sur leur périmètre)
 * - caf / recouvrement     → application mobile uniquement (refusés ici)
 */

export const SUPERVISOR_ROLES = [
  "chef_agence",
  "responsable_zone",
  "directrice_exploitation",
  "responsable_credit",
  "analyste_credit",
  "controleur",
  "audit",
] as const;

export const MOBILE_ONLY_ROLES = ["caf", "cafs", "recouvrement"] as const;

export function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").toLowerCase().trim();
}

export function isSupervisorRole(role: string | null | undefined): boolean {
  return (SUPERVISOR_ROLES as readonly string[]).includes(normalizeRole(role));
}

export function isMobileOnlyRole(role: string | null | undefined): boolean {
  return (MOBILE_ONLY_ROLES as readonly string[]).includes(normalizeRole(role));
}

/** Pages accessibles à tout superviseur (les autres redirigent vers la première). */
export const SUPERVISOR_ALLOWED_PATHS = [
  "/team-performance",
  "/mobile-fleet",
  "/clients",
  "/client-portfolio",
  "/locations",
  "/location-analytics",
  "/analytics",
  "/my-tickets",
] as const;

/**
 * Contrôle uniquement la visibilité de /objectifs dans la nav des
 * SUPERVISEURS (admin_tenant a de toute façon accès à toutes les pages,
 * géré séparément dans navGroupsForRole). Seule la directrice d'exploitation
 * peut réellement FIXER un objectif — admin_tenant garde un accès lecture
 * seule au module (voir objectifs/page.tsx, prop `canEdit`, et le backend
 * caf-objectives.controller.ts où les endpoints d'écriture sont réservés à
 * 'directrice_exploitation' uniquement).
 */
export function canManageObjectives(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "admin_tenant" || r === "directrice_exploitation";
}

/** Page d'atterrissage après login, selon le rôle. */
export function landingPathForRole(role: string | null | undefined): string {
  return isSupervisorRole(role) ? "/team-performance" : "/";
}

export function isPathAllowedForSupervisor(
  pathname: string | null,
  role?: string | null,
): boolean {
  if (!pathname) return false;
  const paths: string[] = [...SUPERVISOR_ALLOWED_PATHS];
  if (canManageObjectives(role)) paths.push("/objectifs");
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
