"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  AppBar, Avatar, Badge, Box, Collapse, CssBaseline, Divider,
  Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Tooltip, Typography,
} from "@mui/material";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { fetchMe, AuthUserProfile } from "@/lib/auth";
import { apiClient } from "@/lib/apiClient";
import { SessionExpiredDialog } from "@/components/SessionExpiredDialog";
import { isSupervisorRole, isPathAllowedForSupervisor, landingPathForRole, normalizeRole } from "@/lib/roles";
import { useThemeMode } from "@/components/ThemeModeContext";

// Icons — nav items
import MenuIcon              from "@mui/icons-material/Menu";
import DashboardIcon         from "@mui/icons-material/Dashboard";
import BusinessIcon          from "@mui/icons-material/Business";
import PeopleAltIcon         from "@mui/icons-material/PeopleAlt";
import PersonPinCircleIcon   from "@mui/icons-material/PersonPinCircle";
import MapIcon               from "@mui/icons-material/Map";
import PlaceIcon             from "@mui/icons-material/Place";
import AssignmentIcon        from "@mui/icons-material/Assignment";
import GroupsIcon            from "@mui/icons-material/Groups";
import BugReportIcon         from "@mui/icons-material/BugReport";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import FactCheckIcon         from "@mui/icons-material/FactCheck";
import InsightsIcon          from "@mui/icons-material/Insights";
import SecurityIcon          from "@mui/icons-material/Security";
import LogoutIcon            from "@mui/icons-material/Logout";
import ExpandMoreIcon        from "@mui/icons-material/ExpandMore";
import ExpandLessIcon        from "@mui/icons-material/ExpandLess";
import DarkModeIcon          from "@mui/icons-material/DarkMode";
import LightModeIcon         from "@mui/icons-material/LightMode";

// Icons — group headers
import LayersIcon            from "@mui/icons-material/Layers";
import TerrainIcon           from "@mui/icons-material/Terrain";
import SupportAgentIcon      from "@mui/icons-material/SupportAgent";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PublicIcon            from "@mui/icons-material/Public";

// ── Design tokens (identiques GeoTrust) ───────────────────────────────────
const DRAWER_WIDTH          = 264;
const NAVY                  = "#0F3B5C";
const STEEL                 = "#1E6091";
const GOLD                  = "#3C8047";
const SIDEBAR_TEXT          = "#7A8FA6";
const SIDEBAR_TEXT_ACTIVE   = "#FFFFFF";
const SIDEBAR_ACTIVE_BG     = "rgba(74,222,128,0.14)";
const SIDEBAR_ACTIVE_BORDER = "#4ADE80";
const SIDEBAR_HOVER_BG      = "rgba(255,255,255,0.04)";
// GOLD (#3C8047) est un vert foncé lisible sur fond clair (boutons, badges
// blancs) mais illisible en texte/icône directement sur le fond sidebar
// navy — SIDEBAR_ACCENT est la variante claire réservée à cet usage.
const SIDEBAR_ACCENT        = "#4ADE80";
const SIDEBAR_ACCENT_SOFT   = "#86EFAC";

// ── Types ──────────────────────────────────────────────────────────────────
type NavItem  = { label: string; icon: React.ReactNode; href: string; badge?: number };
type NavGroup = { id: string; label: string; icon: React.ReactNode; items: NavItem[] };

// ── Nav groups ─────────────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    id: "plateforme",
    label: "Plateforme",
    icon: <LayersIcon sx={{ fontSize: 16 }} />,
    items: [
      { label: "Tableau de bord", icon: <DashboardIcon sx={{ fontSize: 19 }} />,       href: "/" },
      { label: "Agences",         icon: <BusinessIcon sx={{ fontSize: 19 }} />,        href: "/agences" },
      { label: "Utilisateurs",    icon: <PeopleAltIcon sx={{ fontSize: 19 }} />,       href: "/users" },
      { label: "Clients",         icon: <PersonPinCircleIcon sx={{ fontSize: 19 }} />, href: "/clients" },
    ],
  },
  {
    id: "terrain",
    label: "Terrain & Données",
    icon: <TerrainIcon sx={{ fontSize: 16 }} />,
    items: [
      { label: "Référentiels",    icon: <MapIcon sx={{ fontSize: 19 }} />,        href: "/zones" },
      { label: "Localisations",       icon: <PlaceIcon sx={{ fontSize: 19 }} />,      href: "/locations" },
      { label: "Analytics & Rapports", icon: <InsightsIcon sx={{ fontSize: 19 }} />,  href: "/analytics" },
      { label: "Formulaires",         icon: <AssignmentIcon sx={{ fontSize: 19 }} />, href: "/forms" },
      { label: "Fixation d'Objectifs", icon: <FactCheckIcon sx={{ fontSize: 19 }} />,  href: "/objectifs" },
    ],
  },
  {
    id: "support",
    label: "Support & Incidents",
    icon: <SupportAgentIcon sx={{ fontSize: 16 }} />,
    items: [
      { label: "Tickets IT",       icon: <BugReportIcon sx={{ fontSize: 19 }} />,         href: "/tickets" },
      // Réservé aux superviseurs (filtré côté admin_tenant dans
      // navGroupsForRole, qui a déjà /tickets pour gérer tous les tickets du
      // tenant — pas besoin d'un doublon "mes tickets" pour ce rôle-là).
      { label: "Mes signalements", icon: <BugReportIcon sx={{ fontSize: 19 }} />,         href: "/my-tickets" },
      { label: "Notifications",    icon: <NotificationsNoneIcon sx={{ fontSize: 19 }} />, href: "/notifications" },
    ],
  },
  {
    id: "securite",
    label: "Sécurité & Audit",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 16 }} />,
    items: [
      { label: "Logs & Audit", icon: <FactCheckIcon sx={{ fontSize: 19 }} />, href: "/logs" },
      { label: "Sécurité",     icon: <SecurityIcon sx={{ fontSize: 19 }} />,  href: "/security" },
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

// ── NavGroupSection — copie exacte du composant GeoTrust ──────────────────
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
  const hasActive = group.items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href),
  );

  return (
    <Box sx={{ mb: 0.5 }}>
      {/* Group header */}
      <ListItemButton
        onClick={onToggle}
        sx={{
          borderRadius: 2,
          px: 1.5,
          py: 0.75,
          color: hasActive ? SIDEBAR_ACCENT : SIDEBAR_TEXT,
          "&:hover": { bgcolor: SIDEBAR_HOVER_BG, color: hasActive ? SIDEBAR_ACCENT : "#94a3b8" },
          transition: "all .15s ease",
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>
          {group.icon}
        </ListItemIcon>
        <ListItemText
          primary={group.label}
          primaryTypographyProps={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        />
        <Box sx={{ color: "inherit", display: "flex", alignItems: "center", opacity: 0.6 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </Box>
      </ListItemButton>

      {/* Items */}
      <Collapse in={expanded} timeout={180} unmountOnExit>
        <List disablePadding sx={{ pl: 1 }}>
          {group.items.map((item) => {
            const selected = item.href === "/" ? pathname === "/" : !!pathname?.startsWith(item.href);
            return (
              <ListItemButton
                key={item.href}
                selected={selected}
                onMouseEnter={() => onPrefetch(item.href)}
                onClick={() => onNavigate(item.href)}
                sx={{
                  borderRadius: 2,
                  mb: 0.25,
                  px: 1.5,
                  py: 0.85,
                  color: selected ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
                  bgcolor: selected ? SIDEBAR_ACTIVE_BG : "transparent",
                  borderLeft: selected ? `3px solid ${SIDEBAR_ACTIVE_BORDER}` : "3px solid transparent",
                  "&:hover": {
                    bgcolor: selected ? SIDEBAR_ACTIVE_BG : SIDEBAR_HOVER_BG,
                    color: selected ? SIDEBAR_TEXT_ACTIVE : "#CBD5E1",
                  },
                  transition: "all .15s ease",
                  "& .MuiListItemIcon-root": { color: selected ? SIDEBAR_ACCENT : SIDEBAR_TEXT },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  {item.badge && item.badge > 0
                    ? <Badge badgeContent={item.badge} color="error" max={99}>{item.icon}</Badge>
                    : item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, lineHeight: 1.3 }}
                />
                {selected && (
                  <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: SIDEBAR_ACCENT, flexShrink: 0 }} />
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </Box>
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
      state[g.id] = g.items.some((item) =>
        item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href),
      );
    }
    if (!Object.values(state).some(Boolean)) state[groups[0]?.id ?? "plateforme"] = true;
    return state;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [expanded, setExpanded] = useState<Record<string, boolean>>(getDefaultExpanded);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((item) =>
          item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href),
        )) {
          next[g.id] = true;
        }
      }
      return next;
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: NAVY, overflow: "hidden" }}>

      {/* Accent top bar */}
      <Box sx={{ height: 3, background: `linear-gradient(90deg, ${GOLD}, ${SIDEBAR_ACCENT_SOFT})`, flexShrink: 0 }} />

      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          background: `linear-gradient(135deg, ${GOLD}, ${SIDEBAR_ACCENT_SOFT})`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: `0 4px 12px rgba(60,128,71,0.35)`,
        }}>
          <PublicIcon sx={{ color: NAVY, fontSize: 22 }} />
        </Box>
        <Box>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 17, letterSpacing: -0.5, lineHeight: 1 }}>
            GeoTrust
          </Typography>
          <Typography sx={{ color: SIDEBAR_ACCENT, fontSize: 11, mt: 0.3, fontWeight: 600, letterSpacing: 0.5 }}>
            {user?.tenantName ?? "Administration"}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", mx: 2, mb: 1 }} />

      {/* Nav groups */}
      <List disablePadding sx={{
        px: 1, flex: 1, overflowY: "auto", pb: 1,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.08)", borderRadius: 2 },
      }}>
        {groups.map((group, i) => (
          <Box key={group.id}>
            {i > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.04)", my: 0.5, mx: 1 }} />}
            <NavGroupSection
              group={group}
              pathname={pathname}
              expanded={!!expanded[group.id]}
              onToggle={() => toggle(group.id)}
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
            />
          </Box>
        ))}
      </List>

      {/* System status badge */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Box sx={{
          borderRadius: 2,
          background: "rgba(60,128,71,0.06)",
          border: "1px solid rgba(60,128,71,0.15)",
          px: 2, py: 1.2,
          display: "flex", alignItems: "center", gap: 1,
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#22c55e", flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: SIDEBAR_TEXT, textTransform: "uppercase" }}>
              Système
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: SIDEBAR_ACCENT, lineHeight: 1 }}>
              Opérationnel
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", mx: 2 }} />

      {/* User profile footer */}
      <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 700, bgcolor: STEEL, flexShrink: 0 }}>
          {user ? userInitials(user.name) : "?"}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Typography sx={{ color: "#E2E8F0", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }} noWrap>
            {user?.name ?? "Chargement…"}
          </Typography>
          <Typography sx={{ color: SIDEBAR_TEXT, fontSize: 11, mt: 0.25 }} noWrap>
            {user ? roleLabel(user.role) : ""}
          </Typography>
        </Box>
        <Tooltip title={mode === "dark" ? "Mode clair" : "Mode nuit"}>
          <IconButton
            size="small"
            onClick={(e) => toggleMode({ x: e.clientX, y: e.clientY })}
            sx={{
              color: SIDEBAR_TEXT,
              "&:hover": { color: SIDEBAR_ACCENT, bgcolor: SIDEBAR_HOVER_BG },
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            {mode === "dark" ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Déconnexion">
          <IconButton
            size="small"
            onClick={onLogout}
            sx={{
              color: SIDEBAR_TEXT,
              "&:hover": { color: "#EF4444", bgcolor: "rgba(239,68,68,0.08)" },
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            <LogoutIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      {/* Modale globale de reconnexion en cas de session expirée (401). */}
      <SessionExpiredDialog />

      {/* Mobile TopBar */}
      <AppBar position="fixed" elevation={0} sx={{
        display: { sm: "none" },
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ color: "var(--text-primary)" }}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PublicIcon sx={{ color: NAVY, fontSize: 16 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>GeoTrust</Typography>
          </Box>
          {user && (
            <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: STEEL }}>
              {userInitials(user.name)}
            </Avatar>
          )}
        </Toolbar>
      </AppBar>

      {/* Desktop TopBar */}
      <AppBar position="fixed" elevation={0} sx={{
        display: { xs: "none", sm: "flex" },
        zIndex: (t) => t.zIndex.drawer + 1,
        left: DRAWER_WIDTH,
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        bgcolor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}>
        <Toolbar>
          <Typography fontWeight={700} fontSize={16} color="var(--text-primary)">{pageTitle}</Typography>
          <Box flex={1} />
          <Box sx={{
            display: "flex", alignItems: "center", gap: 0.75,
            px: 1.5, py: 0.6, borderRadius: 2,
            bgcolor: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
            <Typography sx={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Système opérationnel</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, bgcolor: NAVY, border: "none" } }}
        >
          <SidebarContent {...sidebarProps} />
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, bgcolor: NAVY, border: "none", boxShadow: "4px 0 24px rgba(0,0,0,0.2)" } }}
          open
        >
          <SidebarContent {...sidebarProps} />
        </Drawer>
      </Box>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` }, minHeight: "100vh", bgcolor: "var(--bg-page)" }}>
        <Toolbar />
        {supervisorBlocked ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <Typography color="text.secondary" fontSize={14}>Redirection…</Typography>
          </Box>
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
      </Box>
    </Box>
  );
}
