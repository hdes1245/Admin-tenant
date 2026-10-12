"use client";

import {
  fetchTenantBranding, fetchTenantHealth, fetchTenantSecurity,
  fetchIpWhitelist, fetchActiveSessions, updateIpWhitelist, revokeSession,
  TenantPasswordPolicy, uploadTenantLogo, updateTenantPasswordPolicy,
} from "@/lib/tenantAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleAlert, CircleCheck, Clock, HeartPulse, ImageIcon, Lock, Monitor, Plus, RefreshCw, ShieldCheck,
  Ticket, TimerOff, Timer, Trash2, TriangleAlert, Upload, UserX, WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { KpiTile, PageContainer, PageHeader, Panel } from "@/components/ui/page-blocks";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";
const GOLD  = "#3C8047";

const DEFAULT_POLICY: TenantPasswordPolicy = {
  minLength: 8, requireUppercase: true, requireLowercase: true,
  requireDigit: true, requireSpecialChar: true, maxAgeDays: null, sessionTimeoutMinutes: null,
};

function fmt(s?: string | null): string {
  if (!s) return "--";
  try { return new Date(s).toLocaleString("fr-FR"); } catch { return s; }
}

function SectionCard({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }) {
  return (
    <Panel className="h-full rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <span
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ background: accent ? `color-mix(in srgb, ${accent} 8%, transparent)` : "var(--bg-hover)", color: accent ?? "var(--text-primary)" }}
        >
          {icon}
        </span>
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </Panel>
  );
}

function PolicyRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-2.5 transition-all hover:border-[#1E6091] ${checked ? "border-[#1E6091]/20 bg-[#1E6091]/5" : "border-border bg-background"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`size-2 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-300"}`} />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-[#0F3B5C]"
      />
    </div>
  );
}

function HealthRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-[13px] font-semibold ${highlight ? "text-red-600" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

/** Carte « option activable » (expiration MDP / timeout session). */
function ToggleCard({
  icon, label, enabled, onToggle, value, onValue, unit, min, max,
}: {
  icon: React.ReactNode; label: string; enabled: boolean; onToggle: (v: boolean) => void;
  value: number | null; onValue: (n: number) => void; unit: string; min: number; max: number;
}) {
  return (
    <div className={`rounded-lg border p-4 ${enabled ? "border-[#1E6091]/20 bg-[#1E6091]/5" : "border-border bg-background"}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="text-[#1E6091]">{icon}</span> {label}
        </span>
        <Switch aria-label={label} checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <div className="relative mt-1">
          <Input type="number" min={min} max={max} value={value ?? ""} onChange={(e) => onValue(Number(e.target.value))} className="pr-14" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState<TenantPasswordPolicy>(DEFAULT_POLICY);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [policyErr, setPolicyErr] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [ipEnabled, setIpEnabled] = useState(false);
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");
  const [ipMsg, setIpMsg] = useState<string | null>(null);
  const [ipErr, setIpErr] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ userId: number; userName: string } | null>(null);
  const [revokeMsg, setRevokeMsg] = useState<string | null>(null);
  const securityQuery = useQuery({ queryKey: ["tenant-security"], queryFn: fetchTenantSecurity });
  const healthQuery   = useQuery({ queryKey: ["tenant-health"],   queryFn: fetchTenantHealth });
  const brandingQuery = useQuery({ queryKey: ["tenant-branding"], queryFn: fetchTenantBranding });
  const ipQuery       = useQuery({ queryKey: ["ip-whitelist"],    queryFn: fetchIpWhitelist });
  const sessionsQuery = useQuery({ queryKey: ["active-sessions"], queryFn: fetchActiveSessions });
  useEffect(() => { const p = securityQuery.data?.passwordPolicy; if (p) setPolicy({ ...DEFAULT_POLICY, ...p }); }, [securityQuery.data]);
  useEffect(() => { const d = ipQuery.data; if (d) { setIpEnabled(d.enabled); setIpList(d.ips); } }, [ipQuery.data]);
  const updatePolicyMutation = useMutation({ mutationFn: updateTenantPasswordPolicy, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-security"] }) });
  const uploadLogoMutation   = useMutation({ mutationFn: uploadTenantLogo,           onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-branding"] }) });
  const updateIpMutation     = useMutation({ mutationFn: updateIpWhitelist,          onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ip-whitelist"] }) });
  const revokeMutation = useMutation({ mutationFn: (userId: number) => revokeSession(userId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["active-sessions"] }); setRevokeMsg("Session revoquee."); setRevokeTarget(null); } });
  const rawLogo = brandingQuery.data?.tenantLogoUrl ?? null;
  const tenantLogoUrl = rawLogo ? (rawLogo.startsWith("http") ? rawLogo : "/proxy" + (rawLogo.startsWith("/") ? rawLogo : "/" + rawLogo)) : null;
  const health = healthQuery.data;
  const tenantStatus = health?.tenant?.status ?? null;
  const errorCount   = health?.activity?.errorCountLast24h ?? 0;
  const openTickets  = health?.support?.openTickets ?? 0;
  const critTickets  = health?.support?.criticalOpenTickets ?? 0;

  const addIp = () => {
    const ip = newIp.trim();
    if (!ip) return;
    setIpList((l) => [...l.filter((x) => x !== ip), ip]);
    setNewIp("");
  };

  const kpis = [
    { icon: <CircleAlert size={20} />, label: "Erreurs 24h", value: errorCount, color: errorCount > 0 ? "#DC2626" : "#059669" },
    { icon: <Ticket size={20} />, label: "Tickets ouverts", value: openTickets, color: openTickets > 5 ? "#D97706" : NAVY },
    { icon: <TriangleAlert size={20} />, label: "Critiques", value: critTickets, color: critTickets > 0 ? "#DC2626" : "#059669" },
  ];

  return (
    <>
      <PageHeader icon={<ShieldCheck size={30} />} title="Securite et Sante" subtitle="Politique MDP, expiration, sessions, whitelist IP et monitoring.">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white"
            style={{ background: tenantStatus === "active" ? "rgba(5,150,105,0.2)" : "rgba(220,38,38,0.2)" }}
          >
            {tenantStatus === "active"
              ? <CircleCheck size={14} className="text-emerald-300" />
              : <CircleAlert size={14} className="text-red-300" />}
            {tenantStatus === "active" ? "Tenant actif" : tenantStatus ?? "..."}
          </span>
          <Tooltip title="Actualiser">
            <button
              type="button"
              aria-label="Actualiser"
              onClick={() => { queryClient.invalidateQueries({ queryKey: ["tenant-health"] }); queryClient.invalidateQueries({ queryKey: ["active-sessions"] }); }}
              className="flex cursor-pointer rounded-lg border border-white/20 bg-white/10 p-1.5 text-white hover:bg-white/20"
            >
              <RefreshCw size={18} />
            </button>
          </Tooltip>
        </div>
      </PageHeader>

      <PageContainer>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            {/* ── Password Policy Card ── */}
            <SectionCard title="Politique de mot de passe" icon={<Lock size={18} />} accent={STEEL}>
              <div className="flex flex-col gap-2">
                {([["requireUppercase","Majuscule obligatoire"],["requireLowercase","Minuscule obligatoire"],["requireDigit","Chiffre obligatoire"],["requireSpecialChar","Caractere special"]] as [keyof TenantPasswordPolicy, string][]).map(([k, lbl]) => (
                  <PolicyRow key={k} label={lbl} checked={!!policy[k]} onChange={(v) => setPolicy((p) => ({ ...p, [k]: v }))} />
                ))}
                <div className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="mb-2 text-sm font-medium text-foreground">Longueur minimale: <b>{policy.minLength}</b></div>
                  <input
                    type="range"
                    aria-label="Longueur minimale"
                    min={6}
                    max={32}
                    value={policy.minLength}
                    onChange={(e) => setPolicy((p) => ({ ...p, minLength: Number(e.target.value) }))}
                    className="w-full cursor-pointer accent-[#1E6091]"
                  />
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-3 text-sm font-semibold text-foreground">Expiration et timeout</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ToggleCard
                    icon={<Timer size={16} />} label="Expiration MDP" unit="jours" min={1} max={365}
                    enabled={policy.maxAgeDays != null} onToggle={(v) => setPolicy((p) => ({ ...p, maxAgeDays: v ? 90 : null }))}
                    value={policy.maxAgeDays} onValue={(n) => setPolicy((p) => ({ ...p, maxAgeDays: n }))}
                  />
                  <ToggleCard
                    icon={<TimerOff size={16} />} label="Timeout session" unit="min" min={1} max={1440}
                    enabled={policy.sessionTimeoutMinutes != null} onToggle={(v) => setPolicy((p) => ({ ...p, sessionTimeoutMinutes: v ? 30 : null }))}
                    value={policy.sessionTimeoutMinutes} onValue={(n) => setPolicy((p) => ({ ...p, sessionTimeoutMinutes: n }))}
                  />
                </div>
              </div>
              {policyMsg && <Alert severity="success" className="mt-4" onClose={() => setPolicyMsg(null)}>{policyMsg}</Alert>}
              {policyErr && <Alert severity="error" className="mt-4" onClose={() => setPolicyErr(null)}>{policyErr}</Alert>}
              <Button
                className="mt-4 w-full hover:bg-[#1E6091] hover:opacity-100"
                disabled={updatePolicyMutation.isPending}
                onClick={async () => { setPolicyMsg(null); setPolicyErr(null); try { await updatePolicyMutation.mutateAsync(policy); setPolicyMsg("Politique sauvegardee."); } catch (e: any) { setPolicyErr(e.message); } }}
              >
                {updatePolicyMutation.isPending ? <Spinner className="size-[18px]" /> : "Sauvegarder la politique"}
              </Button>
            </SectionCard>

            {/* ── IP Whitelist Card ── */}
            <SectionCard title="Liste blanche IP" icon={<WifiOff size={18} />} accent="#7c3aed">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Activer la restriction par IP</span>
                <Switch aria-label="Activer la restriction par IP" checked={ipEnabled} onCheckedChange={setIpEnabled} className={ipEnabled ? "bg-[#7c3aed]" : ""} />
              </div>
              {ipEnabled && (
                <>
                  <Alert severity="warning" className="mb-4 text-xs">Seules les IP listees ci-dessous pourront acceder au panneau admin.</Alert>
                  <div className="mb-3 flex gap-2">
                    <Input placeholder="Ex: 192.168.1.1" value={newIp} onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addIp(); }} />
                    <Button size="icon" aria-label="Ajouter l'IP" className="shrink-0 hover:bg-[#1E6091] hover:opacity-100" onClick={addIp}><Plus size={18} /></Button>
                  </div>
                  <div className="mb-4 flex flex-col gap-1.5">
                    {ipList.length === 0 && <span className="block py-2 text-center text-xs text-muted-foreground">Aucune IP ajoutee</span>}
                    {ipList.map((ip) => (
                      <div key={ip} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5">
                        <span className="font-mono text-sm text-foreground">{ip}</span>
                        <button type="button" aria-label={`Retirer ${ip}`} onClick={() => setIpList((l) => l.filter((x) => x !== ip))} className="cursor-pointer border-0 bg-transparent p-0.5 text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {ipMsg && <Alert severity="success" className="mb-3" onClose={() => setIpMsg(null)}>{ipMsg}</Alert>}
              {ipErr && <Alert severity="error" className="mb-3" onClose={() => setIpErr(null)}>{ipErr}</Alert>}
              <Button
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] hover:opacity-100"
                disabled={updateIpMutation.isPending}
                onClick={async () => { setIpMsg(null); setIpErr(null); try { await updateIpMutation.mutateAsync({ enabled: ipEnabled, ips: ipList }); setIpMsg("Whitelist IP sauvegardee."); } catch (e: any) { setIpErr(e.message); } }}
              >
                {updateIpMutation.isPending ? <Spinner className="size-[18px]" /> : "Sauvegarder la whitelist"}
              </Button>
            </SectionCard>

            {/* ── Logo Upload Card ── */}
            <SectionCard title="Logo de la plateforme" icon={<ImageIcon size={18} />} accent={GOLD}>
              {tenantLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogoUrl} alt="Logo tenant" className="mb-4 block max-h-20 max-w-[220px] rounded-lg border border-border object-contain" onError={(e: any) => { e.target.style.display = "none"; }} />
              )}
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border-strong bg-background p-6 transition-all hover:border-[#3C8047] hover:bg-[#3C8047]/5">
                <Upload size={32} className="text-muted-foreground" />
                <span className="text-center text-sm text-muted-foreground">
                  Cliquez pour selectionner un logo<br />
                  <span className="text-xs">PNG, JPG, WEBP — max 5 Mo</span>
                </span>
                <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setLogoMsg(null); setLogoErr(null); try { await uploadLogoMutation.mutateAsync(file); setLogoMsg("Logo mis a jour."); } catch (ex: any) { setLogoErr(ex.message); } }} />
              </label>
              {logoMsg && <Alert severity="success" className="mt-4" onClose={() => setLogoMsg(null)}>{logoMsg}</Alert>}
              {logoErr && <Alert severity="error" className="mt-4" onClose={() => setLogoErr(null)}>{logoErr}</Alert>}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-5">
            {/* ── KPI tiles ── */}
            <div className="grid grid-cols-3 gap-4">
              {kpis.map((kpi) => (
                <KpiTile key={kpi.label} icon={kpi.icon} label={kpi.label} accent={kpi.color} value={healthQuery.isLoading ? "..." : kpi.value} />
              ))}
            </div>

            {/* ── Sessions actives ── */}
            <SectionCard title="Sessions actives" icon={<Monitor size={18} />} accent={STEEL}>
              {sessionsQuery.isLoading && <div className="flex justify-center py-6"><Spinner className="size-6" /></div>}
              {!sessionsQuery.isLoading && (sessionsQuery.data ?? []).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune session detectee.</p>
              )}
              <div className="flex flex-col gap-2">
                {(sessionsQuery.data ?? []).map((s) => (
                  <div key={s.userId} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1E6091] text-[13px] text-white">{s.userName.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{s.userName}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2">
                        {s.userRole && <span className="rounded-full bg-[#1E6091]/10 px-2 text-[9px] font-semibold leading-4 text-[#1E6091]">{s.userRole}</span>}
                        {s.ip && <span className="text-xs text-muted-foreground">{s.ip}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} /> {fmt(s.lastActivity)}</div>
                    </div>
                    <Tooltip title="Revoquer la session">
                      <button type="button" aria-label="Revoquer la session" onClick={() => setRevokeTarget({ userId: s.userId, userName: s.userName })} className="cursor-pointer rounded-full border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50">
                        <UserX size={18} />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              {revokeMsg && <Alert severity="success" className="mt-3" onClose={() => setRevokeMsg(null)}>{revokeMsg}</Alert>}
            </SectionCard>

            {/* ── Sante du tenant ── */}
            <SectionCard title="Sante du tenant" icon={<HeartPulse size={18} />} accent="#059669">
              {healthQuery.isLoading ? (
                <div className="flex justify-center py-6"><Spinner className="size-6" /></div>
              ) : (
                <div>
                  <HealthRow
                    label="Statut"
                    value={
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: health?.tenant?.status === "active" ? "#D1FAE5" : "#FEE2E2",
                          color: health?.tenant?.status === "active" ? "#065F46" : "#991B1B",
                        }}
                      >
                        {health?.tenant?.status ?? "--"}
                      </span>
                    }
                  />
                  <HealthRow label="Derniere synchro" value={fmt(health?.synchronization?.lastAt)} />
                  <HealthRow label="Statut synchro" value={health?.synchronization?.lastStatus ?? "--"} />
                  <HealthRow label="Calcule le" value={fmt(health?.computedAt)} />
                </div>
              )}
            </SectionCard>

            {/* ── Dernieres erreurs ── */}
            {(health?.activity?.recentErrors ?? []).length > 0 && (
              <SectionCard title="Dernieres erreurs (24h)" icon={<CircleAlert size={18} />} accent="#DC2626">
                <div className="flex flex-col gap-1.5">
                  {(health?.activity?.recentErrors ?? []).slice(0, 5).map((err) => (
                    <div key={err.id} className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 dark:border-red-900 dark:bg-red-950/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-red-600">{err.action}</span>
                        <span className="text-xs text-muted-foreground">{fmt(err.created_at)}</span>
                      </div>
                      {err.description && <span className="block text-xs text-muted-foreground">{err.description}</span>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </PageContainer>

      {/* ── Revoke dialog ── */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent size="xs" accent={false} aria-describedby={undefined}>
          <DialogHeader>Revoquer la session</DialogHeader>
          <DialogBody className="text-sm">
            Confirmer la revocation de la session de <b>{revokeTarget?.userName}</b> ? L utilisateur sera deconnecte lors de son prochain appel API.
          </DialogBody>
          <DialogFooter className="border-t-0">
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>Annuler</Button>
            <Button variant="destructive" disabled={revokeMutation.isPending} onClick={() => { if (revokeTarget) revokeMutation.mutate(revokeTarget.userId); }}>
              {revokeMutation.isPending ? <Spinner className="size-4" /> : "Revoquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
