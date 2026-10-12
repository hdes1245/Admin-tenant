"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, Building2, Bug, ChevronDown, ChevronUp, ClipboardList, Globe, Headset, LayoutDashboard, Layers,
  LineChart, ListChecks, LogOut, Map as MapIcon, MapPin, MapPinned, Menu, Moon, Mountain, ShieldCheck, Sun, Users,
} from "lucide-react";
import { fetchMe, AuthUserProfile } from "@/lib/auth";
import { apiClient } from "@/lib/apiClient";
import { SessionExpiredDialog } from "@/components/SessionExpiredDialog";
import { isSupervisorRole, isPathAllowedForSupervisor, landingPathForRole, normalizeRole } from "@/lib/roles";
import { useThemeMode } from "@/components/ThemeModeContext";
import { Tooltip } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// ── Design tokens (identiques GeoTrust) ───────────────────────────────────
const DRAWER_WIDTH = 264;
// GOLD (#3C8047) est un vert foncé lisible sur fond clair (boutons, badges
// blancs) mais illisible en texte/icône directement sur le fond sidebar
// navy — #4ADE80 est la variante claire réservée à cet usage.
const SIDEBAR_ACCENT_SOFT = "#86EFAC";

// ── Types ──────────────────────────────────────────────────────────────────
type NavItem  = { label: string; icon: React.ReactNode; href: string; badge?: number };
type NavGroup = { id: string; label: string; icon: React.ReactNode; items: NavItem[] };

// ── Nav groups ─────────────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    id: "plateforme",
    label: "Plateforme",
    icon: <Layers size={16} />,
    items: [
      { label: "Tableau de bord", icon: <LayoutDashboard size={19} />, href: "/" },
      { label: "Agences",         icon: <Building2 size={19} />,       href: "/agences" },
      { label: "Utilisateurs",    icon: <Users size={19} />,           href: "/users" },
      { label: "Clients",         icon: <MapPinned size={19} />,       href: "/clients" },
    ],
  },
  {
    id: "terrain",
    label: "Terrain & Données",
    icon: <Mountain size={16} />,
    items: [
      { label: "Référentiels",         icon: <MapIcon size={19} />,       href: "/zones" },
      { label: "Localisations",        icon: <MapPin size={19} />,        href: "/locations" },
      { label: "Analytics & Rapports", icon: <LineChart size={19} />,     href: "/analytics" },
      { label: "Formulaires",          icon: <ClipboardList size={19} />, href: "/forms" },
      { label: "Fixation d'Objectifs", icon: <ListChecks size={19} />,    href: "/objectifs" },
    ],
  },
  {
    id: "support",
    label: "Support & Incidents",
    icon: <Headset size={16} />,
    items: [
      { label: "Tickets IT",       icon: <Bug size={19} />,  href: "/tickets" },
      // Réservé aux superviseurs (filtré côté admin_tenant dans
      // navGroupsForRole, qui a déjà /tickets pour gérer tous les tickets du
      // tenant — pas besoin d'un doublon "mes tickets" pour ce rôle-là).
      { label: "Mes signalements", icon: <Bug size={19} />,  href: "/my-tickets" },
      { label: "Notifications",    icon: <Bell size={19} />, href: "/notifications" },
    ],
  },
  {
    id: "securite",
    label: "Sécurité & Audit",
    icon: <ShieldCheck size={16} />,
    items: [
      { label: "Logs & Audit", icon: <ListChecks size={19} />, href: "/logs" },
      { label: "Sécurité",     icon: <ShieldCheck size={19} />, href: "/security" },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/":                   "Tableau de bord",
  "/agences":            "Agences",
  "/users":              "Utilisateurs",
  "/clients":            "Clients",
  "/zones":              "Référentiels",
  "/locations":          "Localisations",
  "/location-types":     "Référentiels",
  "/location-analytics": "Analytics & Rapports",
  "/client-portfolio":   "Analytics & Rapports",
  "/analytics":          "Analytics & Rapports",
  "/mobile-fleet":       "Agents terrain",
  "/tickets":            "Tickets IT",
  "/my-tickets":         "Mes signalements",
  "/forms":              "Formulaires terrain",
  "/forms/builder":      "Éditeur de formulaire",
  "/team-performance":   "Analytics & Rapports",
  "/objectifs":          "Fixation d'Objectifs",
  "/notifications":      "Notifications",
  "/logs":               "Logs & Audit",
  "/security":           "Sécurité",
};

function userInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    admin_tenant:            "Admin Tenant",
    admin:                   "Administrateur",
    caf:                     "CAF",
    chef_agence:             "Chef d'agence",
    responsable_zone:        "Resp. de zone",
    directrice_exploitation: "Directrice exploitation",
    responsable_credit:      "Resp. crédit",
    analyste_credit:         "Analyste crédit",
    recouvrement:            "Recouvrement",
    controleur:              "Contrôleur",
    audit:                   "Audit",
    manager:                 "Manager",
    analyste:                "Analyste",
  };
  return map[role.toLowerCase()] ?? role;
}

/**
 * Navigation visible selon le rôle : les superviseurs (chef d'agence,
 * responsable de zone, direction, analystes, contrôle, audit) n'accèdent
 * qu'aux pages opérationnelles de leur périmètre — le backend scope déjà
 * les données par rôle sur ces endpoints.
 */
function navGroupsForRole(role: string): NavGroup[] {
  if (!isSupervisorRole(role)) {
    // "/my-tickets" est le "mes signalements" léger des superviseurs —
    // admin_tenant a déjà /tickets pour gérer tous les tickets du tenant.
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.href !== "/my-tickets"),
    }));
  }
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => isPathAllowedForSupervisor(item.href, role)),
  })).filter((g) => g.items.length > 0);
}

const isActiveHref = (href: string, pathname: string | null) =>
  href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

// ── NavGroupSection ────────────────────────────────────────────────────────
function NavGroupSection({
  group, pathname, expanded, onToggle, onNavigate, onPrefetch,
}: {
  group: NavGroup;
  pathname: string | null;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
  onPrefetch: (href: string) => void;
}) {
  const hasActive = group.items.some((item) => isActiveHref(item.href, pathname));

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full cursor-pointer items-center gap-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left transition-all duration-150 hover:bg-white/[0.04] ${
          hasActive ? "text-[#4ADE80]" : "text-[#7A8FA6] hover:text-[#94a3b8]"
        }`}
      >
        <span className="flex min-w-7 items-center">{group.icon}</span>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[1.1px]">{group.label}</span>
        <span className="flex items-center opacity-60">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {/* Items */}
      {expanded && (
        <div className="pl-2">
          {group.items.map((item) => {
            const selected = isActiveHref(item.href, pathname);
            return (
              <button
                key={item.href}
                type="button"
                onMouseEnter={() => onPrefetch(item.href)}
                onClick={() => onNavigate(item.href)}
                className={`mb-px flex w-full cursor-pointer items-center rounded-lg border-0 border-l-[3px] px-3 py-[11px] text-left transition-all duration-150 ${
                  selected
                    ? "border-l-[#4ADE80] bg-[rgba(74,222,128,0.14)] text-white"
                    : "border-l-transparent bg-transparent text-[#7A8FA6] hover:bg-white/[0.04] hover:text-[#CBD5E1]"
                }`}
              >
                <span className={`flex min-w-[34px] items-center ${selected ? "text-[#4ADE80]" : "text-[#7A8FA6]"}`}>
                  {item.badge && item.badge > 0 ? (
                    <span className="relative">
                      {item.icon}
                      <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">{item.badge > 99 ? "99+" : item.badge}</span>
                    </span>
                  ) : item.icon}
                </span>
                <span className={`flex-1 text-[13.5px] leading-snug ${selected ? "font-semibold" : "font-normal"}`}>{item.label}</span>
                {selected && <span className="size-1 shrink-0 rounded-full bg-[#4ADE80]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SidebarContent ─────────────────────────────────────────────────────────
function SidebarContent({
  pathname, user, onNavigate, onPrefetch, onLogout,
}: {
  pathname: string | null;
  user: AuthUserProfile | null;
  onNavigate: (href: string) => void;
  onPrefetch: (href: string) => void;
  onLogout: () => void;
}) {
  // Groupes de navigation filtrés selon le rôle (superviseur = pages
  // opérationnelles uniquement).
  const groups = navGroupsForRole(normalizeRole(user?.role));
  const { mode, toggleMode } = useThemeMode();

  const getDefaultExpanded = useCallback(() => {
    const state: Record<string, boolean> = {};
    for (const g of groups) {
      state[g.id] = g.items.some((item) => isActiveHref(item.href, pathname));
    }
    if (!Object.values(state).some(Boolean)) state[groups[0]?.id ?? "plateforme"] = true;
    return state;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [expanded, setExpanded] = useState<Record<string, boolean>>(getDefaultExpanded);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((item) => isActiveHref(item.href, pathname))) next[g.id] = true;
      }
      return next;
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const footerBtn = "flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-1.5 text-[#7A8FA6] transition-all duration-150";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--sidebar-bg)]">

      {/* Accent top bar */}
      <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, #3C8047, ${SIDEBAR_ACCENT_SOFT})` }} />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#0F3B5C] shadow-[0_4px_12px_rgba(60,128,71,0.35)]"
          style={{ background: `linear-gradient(135deg, #3C8047, ${SIDEBAR_ACCENT_SOFT})` }}
        >
          <Globe size={22} />
        </span>
        <div>
          <div className="text-[17px] font-extrabold leading-none tracking-tight text-white">GeoTrust</div>
          <div className="mt-[3px] text-[11px] font-semibold tracking-[0.5px] text-[#4ADE80]">{user?.tenantName ?? "Administration"}</div>
        </div>
      </div>

      <div className="mx-4 mb-2 h-px bg-white/5" />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/10">
        {groups.map((group, i) => (
          <div key={group.id}>
            {i > 0 && <div className="mx-2 my-1 h-px bg-white/[0.04]" />}
            <NavGroupSection
              group={group}
              pathname={pathname}
              expanded={!!expanded[group.id]}
              onToggle={() => toggle(group.id)}
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
            />
          </div>
        ))}
      </nav>

      {/* System status badge */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#3C8047]/15 bg-[#3C8047]/[0.06] px-4 py-2.5">
          <span className="size-[7px] shrink-0 rounded-full bg-green-500" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#7A8FA6]">Système</div>
            <div className="text-xs font-semibold leading-none text-[#4ADE80]">Opérationnel</div>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/5" />

      {/* User profile footer */}
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#1E6091] text-xs font-bold text-white">
          {user ? userInitials(user.name) : "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-slate-200">{user?.name ?? "Chargement…"}</div>
          <div className="mt-0.5 truncate text-[11px] text-[#7A8FA6]">{user ? roleLabel(user.role) : ""}</div>
        </div>
        <Tooltip title={mode === "dark" ? "Mode clair" : "Mode nuit"}>
          <button
            type="button"
            aria-label={mode === "dark" ? "Passer en mode clair" : "Passer en mode nuit"}
            onClick={(e) => toggleMode({ x: e.clientX, y: e.clientY })}
            className={`${footerBtn} hover:bg-white/[0.04] hover:text-[#4ADE80]`}
          >
            {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Tooltip>
        <Tooltip title="Déconnexion">
          <button type="button" aria-label="Déconnexion" onClick={onLogout} className={`${footerBtn} hover:bg-red-500/10 hover:text-red-500`}>
            <LogOut size={17} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Main Layout ────────────────────────────────────────────────────────────
export function SidebarLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser]             = useState<AuthUserProfile | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // NB : pas de ref-guard "déjà fetché" ici. Combiné au flag `active` et au
    // double-invoke de React StrictMode (mount → cleanup → mount), il bloquait
    // le 2ᵉ effet tout en invalidant la résolution du 1ᵉʳ fetch (active=false)
    // → setUser n'était jamais appelé, l'utilisateur restait "Chargement…"
    // et la nav retombait sur la vue admin par défaut. On refetch simplement
    // à chaque montage (bénin), le flag `active` évite le setState post-unmount.
    let active = true;
    fetchMe().then((profile) => {
      if (!active) return;
      if (!profile) { router.replace("/login"); return; }
      if (profile.mustChangePassword) { router.replace("/change-password"); return; }
      setUser(profile);
    });
    return () => { active = false; };
  }, [router]);

  // Garde de routage par rôle : un superviseur ne peut naviguer que sur les
  // pages de son périmètre — toute autre URL le renvoie sur son atterrissage.
  // (Le backend refuse de toute façon les endpoints admin ; ceci évite des
  // pages d'erreurs et des 403 dans les logs d'audit.)
  useEffect(() => {
    if (!user) return;
    const role = normalizeRole(user.role);
    if (isSupervisorRole(role) && !isPathAllowedForSupervisor(pathname, role)) {
      router.replace(landingPathForRole(role));
    }
  }, [user, pathname, router]);

  const handleLogout = async () => {
    try {
      // Même origine via /proxy → le cookie httpOnly access_token part avec
      // la requête automatiquement (withCredentials), le backend le blackliste
      // et l'efface (res.clearCookie côté auth.controller.ts).
      await apiClient.post("/auth/logout");
    } catch (_) {}
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("admin_role");
      window.localStorage.removeItem("tenantSlug");
    }
    router.push("/login");
  };

  const pageTitle = (() => {
    if (!pathname) return "GeoTrust";
    for (const [key, val] of Object.entries(PAGE_TITLES)) {
      if (key === "/" ? pathname === "/" : pathname.startsWith(key)) return val;
    }
    return "GeoTrust";
  })();

  const sidebarProps = {
    pathname,
    user,
    onNavigate: (href: string) => { router.push(href); setMobileOpen(false); },
    onPrefetch: (href: string) => router.prefetch(href),
    onLogout: handleLogout,
  };

  // Un superviseur sur une page hors périmètre : ne PAS rendre le contenu (le
  // guard ci-dessus le redirige). Rendre la page ne serait-ce qu'un instant
  // déclencherait ses requêtes vers des endpoints admin → 403 parasites.
  const supervisorBlocked =
    !!user && isSupervisorRole(normalizeRole(user.role)) &&
    !isPathAllowedForSupervisor(pathname, normalizeRole(user.role));

  return (
    <div className="flex" style={{ minHeight: "calc(100vh / var(--ui-zoom))" }}>
      {/* Modale globale de reconnexion en cas de session expirée (401). */}
      <SessionExpiredDialog />

      {/* Mobile TopBar */}
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-14 items-center justify-between border-b border-border bg-surface px-4 text-foreground sm:hidden">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-foreground">
            <Menu size={24} />
          </button>
          <span className="flex size-7 items-center justify-center rounded-md bg-[#3C8047] text-[#0F3B5C]"><Globe size={16} /></span>
          <span className="text-[15px] font-bold text-foreground">GeoTrust</span>
        </div>
        {user && (
          <span className="flex size-8 items-center justify-center rounded-full bg-[#1E6091] text-xs font-bold text-white">{userInitials(user.name)}</span>
        )}
      </header>

      {/* Desktop TopBar */}
      <header
        className="fixed top-0 z-[1100] hidden h-16 items-center border-b border-border bg-surface px-6 text-foreground sm:flex"
        style={{ left: DRAWER_WIDTH, width: `calc(100% - ${DRAWER_WIDTH}px)` }}
      >
        <span className="text-base font-bold text-foreground">{pageTitle}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-600">Système opérationnel</span>
        </div>
      </header>

      {/* Sidebar (bureau) */}
      <aside className="fixed left-0 top-0 z-[1000] hidden h-full shadow-[4px_0_24px_rgba(0,0,0,0.2)] sm:block" style={{ width: DRAWER_WIDTH }}>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Sidebar (mobile) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" width={DRAWER_WIDTH} className="bg-[var(--sidebar-bg)] sm:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent {...sidebarProps} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="min-w-0 flex-1 bg-background sm:ml-[264px]" style={{ minHeight: "calc(100vh / var(--ui-zoom))" }}>
        <div className="h-14 sm:h-16" />
        {supervisorBlocked ? (
          <div className="flex items-center justify-center" style={{ minHeight: "calc(60vh / var(--ui-zoom))" }}>
            <span className="text-sm text-muted-foreground">Redirection…</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
