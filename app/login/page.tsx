"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import BusinessIcon from "@mui/icons-material/Business";
import PlaceIcon from "@mui/icons-material/Place";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { isMobileOnlyRole, isSupervisorRole, landingPathForRole } from "@/lib/roles";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

function StatCard({ icon, title, desc, delay, top, left }: { icon: React.ReactNode; title: string; desc: string; delay: number; top?: number | string; left?: number | string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: "easeOut" }} style={{ position: "absolute", top, left }}>
      <Box sx={{ bgcolor: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 2.5, px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5, minWidth: 210 }}>
        <Box sx={{ color: GOLD, display: "flex" }}>{icon}</Box>
        <Box>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{title}</Typography>
          <Typography sx={{ color: "#7A8FA6", fontSize: 11, mt: 0.25 }}>{desc}</Typography>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function LoginPage() {
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPwd]    = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [tenantLogoUrl, setLogoUrl]   = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const slug = typeof window !== "undefined" ? localStorage.getItem("tenantSlug") || "" : "";
        if (!slug) return;
        const resp = await apiClient.get("/auth/tenant-brand", { params: { tenantSlug: slug } });
        const raw = String((resp.data as any)?.tenantLogoUrl ?? "").trim();
        if (!raw) return;
        setLogoUrl(raw.startsWith("http") ? raw : `/proxy${raw.startsWith("/") ? raw : `/${raw}`}`);
      } catch { setLogoUrl(null); }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError("Veuillez renseigner votre identifiant et votre mot de passe."); return; }
    setLoading(true); setError(null);
    try {
      const tenantSlug = typeof window !== "undefined" ? localStorage.getItem("tenantSlug") || undefined : undefined;
      const body: Record<string, any> = { username: username.trim(), password };
      if (tenantSlug) body.tenantSlug = tenantSlug;

      const resp = await apiClient.post("/auth/login", body);
      const raw = resp.data as any;
      // Le backend peut envelopper dans { data: ... } ou retourner directement
      const data = raw?.data ?? raw;
      const token = (data?.access_token ?? data?.token ?? data?.accessToken ?? "").toString();
      const user  = (data?.user ?? data?.profile ?? {}) as any;

      if (!token) throw new Error("Réponse de login invalide (token manquant).");
      const role = ((user?.roleCode ?? user?.role ?? "") as string).toLowerCase();
      // Routage par rôle :
      //  - admin_tenant → interface d'administration (existante)
      //  - superviseurs → interface superviseur (pages opérationnelles scopées)
      //  - caf / recouvrement → application mobile uniquement
      if (isMobileOnlyRole(role)) {
        throw new Error("Les agents terrain (CAF, recouvrement) utilisent l'application mobile — cet espace est réservé aux superviseurs et administrateurs.");
      }
      if (role !== "admin_tenant" && !isSupervisorRole(role)) {
        throw new Error("Votre compte ne dispose pas d'un rôle autorisé sur cet espace.");
      }

      if (typeof window !== "undefined") {
        // Le JWT lui-même n'est plus stocké ici : le backend l'a posé dans un
        // cookie httpOnly "access_token" (voir Set-Cookie de /auth/login),
        // inaccessible au JS — c'est aussi ce cookie que le middleware Edge
        // vérifie pour protéger les routes (il n'est pas httpOnly *pour lui*,
        // seulement pour le navigateur/JS côté client).
        localStorage.setItem("admin_role", role);
        if (user?.tenantSlug) localStorage.setItem("tenantSlug", user.tenantSlug.toString());
      }
      router.push(user?.must_change_password ? "/change-password" : landingPathForRole(role));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Échec de la connexion.";
      setError(Array.isArray(msg) ? msg.join(" ") : msg.toString());
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "var(--bg-page)" }}>

      {/* Left panel — branding */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: "0 0 460px",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          bgcolor: NAVY,
          p: 6,
        }}
      >
        {/* Subtle decorative element */}
        <Box sx={{ position: "absolute", top: -100, right: -100, width: 350, height: 350, borderRadius: "50%", background: `radial-gradient(circle, rgba(60,128,71,0.08) 0%, transparent 65%)`, pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", bottom: -80, left: -80, width: 280, height: 280, borderRadius: "50%", background: `radial-gradient(circle, rgba(30,96,145,0.25) 0%, transparent 65%)`, pointerEvents: "none" }} />

        {/* Gold top bar */}
        <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: GOLD }} />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={6}>
            {tenantLogoUrl ? (
              <Box sx={{ width: 64, height: 44, borderRadius: 1.5, bgcolor: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", p: 0.5 }}>
                <img src={tenantLogoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
              </Box>
            ) : (
              <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ color: NAVY, fontWeight: 900, fontSize: 22, letterSpacing: -1 }}>S</Typography>
              </Box>
            )}
            <Box>
              <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 22, letterSpacing: -0.5, lineHeight: 1 }}>SiteCheck</Typography>
              <Typography sx={{ color: GOLD, fontSize: 12, fontWeight: 600 }}>Administration & Supervision</Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 28, lineHeight: 1.25, mb: 2, letterSpacing: -0.5 }}>
            Pilotez votre organisation en toute clarté
          </Typography>
          <Typography sx={{ color: "#7A8FA6", fontSize: 15, lineHeight: 1.7, mb: 5 }}>
            Gérez agences, utilisateurs, clients et localisations depuis une interface centralisée et sécurisée.
          </Typography>
        </motion.div>

        {/* Feature cards */}
        <Box sx={{ position: "relative", height: 220 }}>
          <StatCard icon={<DashboardIcon sx={{ fontSize: 20 }} />} title="Tableau de bord" desc="Statistiques en temps réel" delay={0.25} top={0} left={0} />
          <StatCard icon={<PeopleAltIcon sx={{ fontSize: 20 }} />} title="Supervision terrain" desc="Agents, objectifs et couverture" delay={0.35} top={72} left={40} />
          <StatCard icon={<BusinessIcon sx={{ fontSize: 20 }} />} title="Agences & Zones" desc="Organisation géographique" delay={0.45} top={144} left={0} />
        </Box>

        {/* Footer */}
        <Box mt="auto" pt={4}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
            <Typography sx={{ color: "#475569", fontSize: 12 }}>Système opérationnel</Typography>
          </Box>
          <Typography sx={{ color: "#334155", fontSize: 12 }}>© 2025 SiteCheck · Tous droits réservés</Typography>
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, sm: 6 }, position: "relative" }}>

        {/* Gold accent top line on mobile */}
        <Box sx={{ display: { xs: "block", md: "none" }, position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: GOLD }} />

        <Box sx={{ width: "100%", maxWidth: 400 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>

            {/* Mobile logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 4, mt: 2 }}>
              {tenantLogoUrl ? (
                <Box sx={{ width: 52, height: 36, borderRadius: 1.5, bgcolor: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", p: 0.5, border: "1px solid var(--border)" }}>
                  <img src={tenantLogoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </Box>
              ) : (
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: NAVY, fontWeight: 900, fontSize: 18 }}>S</Typography>
                </Box>
              )}
              <Typography sx={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>SiteCheck</Typography>
            </Box>

            {/* Heading */}
            <Box mb={4}>
              <Typography variant="h5" fontWeight={800} sx={{ color: "var(--text-primary)", mb: 0.75, letterSpacing: -0.3 }}>
                Connexion
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Connectez-vous : vous serez dirigé vers votre espace selon votre profil (administrateur ou superviseur).
              </Typography>
            </Box>

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit}>
              <Box mb={2.5}>
                <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-secondary)", mb: 0.75, fontSize: 13 }}>
                  Identifiant
                </Typography>
                <TextField
                  fullWidth size="small"
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineIcon sx={{ fontSize: 18, color: "var(--text-muted)" }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "var(--bg-surface)",
                      "&:hover fieldset": { borderColor: "var(--border-strong)" },
                      "&.Mui-focused fieldset": { borderColor: STEEL, borderWidth: 1.5 },
                    },
                  }}
                />
              </Box>

              <Box mb={3}>
                <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-secondary)", mb: 0.75, fontSize: 13 }}>
                  Mot de passe
                </Typography>
                <TextField
                  fullWidth size="small"
                  placeholder="Votre mot de passe"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ fontSize: 18, color: "var(--text-muted)" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end" sx={{ color: "var(--text-muted)" }}>
                          {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "var(--bg-surface)",
                      "&:hover fieldset": { borderColor: "var(--border-strong)" },
                      "&.Mui-focused fieldset": { borderColor: STEEL, borderWidth: 1.5 },
                    },
                  }}
                />
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2.5, fontSize: 13 }}>{error}</Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  height: 46,
                  bgcolor: NAVY,
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 0,
                  "&:hover": { bgcolor: STEEL },
                  "&:disabled": { bgcolor: "#E2E8F0", color: "var(--text-muted)" },
                  transition: "background .2s ease",
                }}
              >
                {loading
                  ? <Box display="flex" alignItems="center" gap={1.5}><CircularProgress size={18} sx={{ color: "white" }} /> Connexion…</Box>
                  : "Se connecter"}
              </Button>
            </Box>

            {/* Info note */}
            <Box mt={4} pt={3} sx={{ borderTop: "1px solid var(--border)" }}>
              <Box sx={{ display: "flex", gap: 1.5, p: 2, bgcolor: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: 2 }}>
                <PlaceIcon sx={{ fontSize: 18, color: GOLD, flexShrink: 0, mt: 0.1 }} />
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  Espace <strong style={{ color: "var(--text-primary)" }}>administrateurs</strong> et <strong style={{ color: "var(--text-primary)" }}>superviseurs</strong> (chefs d&apos;agence, responsables de zone, direction, analystes, contrôle, audit) — chacun est dirigé vers son interface. Agents terrain (CAF, recouvrement) : utilisez l&apos;application mobile SiteCheck.
                </Typography>
              </Box>
            </Box>

          </motion.div>
        </Box>
      </Box>
    </Box>
  );
}
