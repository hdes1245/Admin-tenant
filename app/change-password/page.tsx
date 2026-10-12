"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

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

  const label = "mb-1.5 block text-[13px] font-semibold text-muted-foreground";

  return (
    <div className="relative flex items-center justify-center bg-background p-6" style={{ minHeight: "calc(100vh / var(--ui-zoom))" }}>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[#3C8047]" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="w-[420px] max-w-[90vw] rounded-2xl border border-border bg-surface p-8 shadow-[0_4px_24px_rgba(15,59,92,0.06)]">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-[42px] items-center justify-center rounded-[10px] bg-[#0F3B5C] text-[#3C8047]">
              <LayoutDashboard size={22} />
            </span>
            <div>
              <div className="text-[17px] font-extrabold text-foreground">GeoTrust</div>
              <div className="text-[11px] font-semibold text-[#3C8047]">Administration Tenant</div>
            </div>
          </div>

          <div className="mb-2 flex items-center gap-3">
            <KeyRound size={22} className="text-[#1E6091]" />
            <h1 className="text-xl font-extrabold text-foreground">Changement de mot de passe requis</h1>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            C&apos;est votre première connexion : vous devez définir un nouveau mot de passe avant de continuer.
          </p>

          {done ? (
            <Alert severity="success">Mot de passe changé avec succès. Redirection vers la page de connexion…</Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <Alert severity="error" className="mb-5">{error}</Alert>}
              <div className="mb-5">
                <label className={label} htmlFor="new-password">Nouveau mot de passe</label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <label className={label} htmlFor="confirm-password">Confirmer le mot de passe</label>
                <Input
                  id="confirm-password"
                  type={showPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="h-11 w-full font-bold hover:bg-[#1E6091] hover:opacity-100">
                {loading ? <Spinner className="size-5" /> : "Changer le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
