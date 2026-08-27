"use client";

import { useState } from "react";
import {
  Alert, Box, Button, CircularProgress, IconButton,
  InputAdornment, TextField, Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";

const NAVY = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD = "#3C8047";

// Changement de mot de passe OBLIGATOIRE à la première connexion — cette
// page n'est jamais accessible par choix : SidebarLayout y redirige dès que
// /auth/me indique mustChangePassword=true, et le backend (guard global
// MustChangePasswordGuard) bloque de toute façon tout autre endpoint tant
// que ce n'est pas fait.
export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/change-password", { newPassword, confirmPassword });
      setDone(true);
      try { await apiClient.post("/auth/logout"); } catch { /* best-effort */ }
      setTimeout(() => router.replace("/login"), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Échec du changement de mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: GOLD }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ width: 420, maxWidth: "90vw", bgcolor: "var(--bg-surface)", borderRadius: 3, border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(15,59,92,0.06)", p: 4 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={3}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DashboardIcon sx={{ color: GOLD, fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: "var(--text-primary)" }}>GeoTrust</Typography>
              <Typography sx={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>Administration Tenant</Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1.5} mb={1}>
            <LockResetIcon sx={{ color: STEEL, fontSize: 22 }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: "var(--text-primary)" }}>
              Changement de mot de passe requis
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: 1.6, mb: 3 }}>
            C&apos;est votre première connexion : vous devez définir un nouveau mot de passe avant de continuer.
          </Typography>

          {done ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Mot de passe changé avec succès. Redirection vers la page de connexion…
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}
              <Box mb={2.5}>
                <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-secondary)", mb: 0.75, fontSize: 13 }}>
                  Nouveau mot de passe
                </Typography>
                <TextField
                  fullWidth size="small" type={showPwd ? "text" : "password"}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                          {showPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box mb={3}>
                <Typography variant="body2" fontWeight={600} sx={{ color: "var(--text-secondary)", mb: 0.75, fontSize: 13 }}>
                  Confirmer le mot de passe
                </Typography>
                <TextField
                  fullWidth size="small" type={showPwd ? "text" : "password"}
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Box>
              <Button
                type="submit" fullWidth variant="contained" disabled={loading}
                sx={{ height: 46, bgcolor: NAVY, fontWeight: 700, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: STEEL } }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: "white" }} /> : "Changer le mot de passe"}
              </Button>
            </Box>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}
