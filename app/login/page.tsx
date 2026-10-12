"use client";

import { useEffect, useState } from "react";
import { Building2, Eye, EyeOff, LayoutDashboard, Lock, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";
import { isMobileOnlyRole, isSupervisorRole, landingPathForRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const GOLD = "#3C8047";

function StatCard({ icon, title, desc, delay, top, left }: { icon: React.ReactNode; title: string; desc: string; delay: number; top?: number | string; left?: number | string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: "easeOut" }} style={{ position: "absolute", top, left }}>
      <div className="flex min-w-[210px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-[10px]">
        <span className="flex text-[#3C8047]">{icon}</span>
        <div>
          <div className="text-[13px] font-semibold leading-tight text-white">{title}</div>
          <div className="mt-0.5 text-[11px] text-[#7A8FA6]">{desc}</div>
        </div>
      </div>
    </motion.div>
  );
}

function Logo({ url, size }: { url: string | null; size: "lg" | "sm" }) {
  const lg = size === "lg";
  return url ? (
    <span className={`flex items-center justify-center overflow-hidden rounded-md bg-white p-1 ${lg ? "h-11 w-16" : "h-9 w-[52px] border border-border"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
    </span>
  ) : (
    <span className={`flex items-center justify-center bg-[#3C8047] font-black text-[#0F3B5C] ${lg ? "size-11 rounded-[10px] text-[22px] tracking-tighter" : "size-9 rounded-lg text-lg"}`}>S</span>
  );
}

export default function LoginPage() {
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPwd]    = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [captcha, setCaptcha]         = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
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
    if (TURNSTILE_SITE_KEY && !captcha) { setError("Veuillez valider la vérification anti-robot."); return; }
    setLoading(true); setError(null);
    try {
      const tenantSlug = typeof window !== "undefined" ? localStorage.getItem("tenantSlug") || undefined : undefined;
      const body: Record<string, any> = { username: username.trim(), password };
      if (tenantSlug) body.tenantSlug = tenantSlug;
      if (captcha) body.turnstileToken = captcha;

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
      setCaptchaReset((n) => n + 1);
    } finally { setLoading(false); }
  };

  const label = "mb-1.5 block text-[13px] font-semibold text-muted-foreground";
  const iconCls = "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground";

  return (
    <div className="flex bg-background" style={{ minHeight: "calc(100vh / var(--ui-zoom))" }}>

      {/* Left panel — branding */}
      <div className="relative hidden flex-[0_0_460px] flex-col justify-center overflow-hidden bg-[var(--sidebar-bg)] p-12 md:flex">
        {/* Formes « lampe à lave » — dérivent lentement en boucle (voir globals.css) */}
        <div className="login-blob login-blob-a" style={{ top: -100, right: -100, width: 350, height: 350, background: "radial-gradient(circle, rgba(60,128,71,0.14) 0%, transparent 65%)" }} />
        <div className="login-blob login-blob-b" style={{ bottom: -80, left: -80, width: 280, height: 280, background: "radial-gradient(circle, rgba(30,96,145,0.30) 0%, transparent 65%)" }} />
        <div className="login-blob login-blob-c" style={{ top: "38%", left: "20%", width: 220, height: 220, background: "radial-gradient(circle, rgba(74,222,128,0.10) 0%, transparent 65%)" }} />

        {/* Gold top bar */}
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: GOLD }} />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-12 flex items-center gap-3">
            <Logo url={tenantLogoUrl} size="lg" />
            <div>
              <div className="text-[22px] font-extrabold leading-none tracking-tight text-white">GeoTrust</div>
              <div className="text-xs font-semibold text-[#3C8047]">Administration & Supervision</div>
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 className="mb-4 text-[28px] font-extrabold leading-tight tracking-tight text-white">Pilotez votre organisation en toute clarté</h2>
          <p className="mb-10 text-[15px] leading-relaxed text-[#7A8FA6]">
            Gérez agences, utilisateurs, clients et localisations depuis une interface centralisée et sécurisée.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="relative h-[220px]">
          <StatCard icon={<LayoutDashboard size={20} />} title="Tableau de bord" desc="Statistiques en temps réel" delay={0.25} top={0} left={0} />
          <StatCard icon={<Users size={20} />} title="Supervision terrain" desc="Agents, objectifs et couverture" delay={0.35} top={72} left={40} />
          <StatCard icon={<Building2 size={20} />} title="Agences & Zones" desc="Organisation géographique" delay={0.45} top={144} left={0} />
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-slate-400">Système opérationnel</span>
          </div>
          <span className="text-xs text-slate-500">© 2025 GeoTrust · Tous droits réservés</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-12">

        {/* Formes « lampe à lave » — même traitement que le panneau navy, en plus discret sur ce fond quasi-noir */}
        <div className="login-blob login-blob-b" style={{ top: -120, right: -140, width: 380, height: 380, background: "radial-gradient(circle, rgba(30,96,145,0.16) 0%, transparent 65%)" }} />
        <div className="login-blob login-blob-a" style={{ bottom: -100, right: "15%", width: 300, height: 300, background: "radial-gradient(circle, rgba(60,128,71,0.10) 0%, transparent 65%)" }} />
        <div className="login-blob login-blob-c" style={{ bottom: "10%", left: -100, width: 260, height: 260, background: "radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 65%)" }} />

        {/* Gold accent top line on mobile */}
        <div className="absolute inset-x-0 top-0 z-[1] h-[3px] md:hidden" style={{ background: GOLD }} />

        <div className="relative z-[1] w-full max-w-[400px]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>

            {/* Mobile logo */}
            <div className="mb-8 mt-4 flex items-center gap-3 md:hidden">
              <Logo url={tenantLogoUrl} size="sm" />
              <span className="text-lg font-extrabold text-foreground">GeoTrust</span>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-foreground">Connexion</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Connectez-vous : vous serez dirigé vers votre espace selon votre profil (administrateur ou superviseur).
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label htmlFor="login-username" className={label}>Identifiant</label>
                <div className="relative">
                  <User size={18} className={iconCls} />
                  <Input
                    id="login-username"
                    placeholder="Votre identifiant"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-surface pl-10"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="login-password" className={label}>Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className={iconCls} />
                  <Input
                    id="login-password"
                    placeholder="Votre mot de passe"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-surface pl-10 pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <TurnstileWidget onToken={setCaptcha} resetKey={captchaReset} />

              {error && <Alert severity="error" className="mb-5 text-[13px]">{error}</Alert>}

              <Button type="submit" disabled={loading} className="h-[46px] w-full text-[15px] font-bold hover:bg-[#1E6091] hover:opacity-100">
                {loading ? <span className="flex items-center gap-3"><Spinner className="size-[18px]" /> Connexion…</span> : "Se connecter"}
              </Button>
            </form>

          </motion.div>
        </div>
      </div>
    </div>
  );
}
