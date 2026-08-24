"use client";

import {
  fetchTenantBranding, fetchTenantHealth, fetchTenantSecurity,
  fetchIpWhitelist, fetchActiveSessions, updateIpWhitelist, revokeSession,
  TenantPasswordPolicy, uploadTenantLogo, updateTenantPasswordPolicy,
} from "@/lib/tenantAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import UploadIcon from "@mui/icons-material/Upload";
import RefreshIcon from "@mui/icons-material/Refresh";
import WifiLockIcon from "@mui/icons-material/WifiLock";
import DevicesIcon from "@mui/icons-material/Devices";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TimerOffIcon from "@mui/icons-material/TimerOff";
import { useEffect, useState } from "react";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

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
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0", height: "100%" }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: accent ? `${accent}14` : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: accent ?? NAVY }}>{icon}</Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, fontSize: 15 }}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function PolicyRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between"
      sx={{ px: 2, py: 1.25, borderRadius: 2, border: "1px solid", borderColor: checked ? `${STEEL}30` : "#E2E8F0", bgcolor: checked ? `${STEEL}08` : "#FAFAFA", transition: "all .15s", cursor: "pointer", "&:hover": { borderColor: STEEL } }}
      onClick={() => onChange(!checked)}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: checked ? "#059669" : "#CBD5E1", transition: "background .15s" }} />
        <Typography variant="body2" fontWeight={500} sx={{ color: NAVY }}>{label}</Typography>
      </Box>
      <Checkbox checked={checked} onChange={(e) => { e.stopPropagation(); onChange(e.target.checked); }} size="small" sx={{ p: 0, color: "#CBD5E1", "&.Mui-checked": { color: NAVY } }} />
    </Box>
  );
}

function HealthRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" py={1} sx={{ borderBottom: "1px solid #F1F5F9" }}>
      <Typography variant="body2" sx={{ color: "#64748B", fontSize: 13 }}>{label}</Typography>
      <Box component="span" sx={{ fontWeight: 600, color: highlight ? "#DC2626" : NAVY, fontSize: 13 }}>{value}</Box>
    </Box>
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

  return (
    <>
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${GOLD}`, px: 4, py: 2.5, color: "white", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <SecurityIcon sx={{ color: GOLD, fontSize: 30, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={700} color="white">Securite et Sante</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>Politique MDP, expiration, sessions, whitelist IP et monitoring.</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
                <Chip label={tenantStatus === "active" ? "Tenant actif" : tenantStatus ?? "..."} size="small" icon={tenantStatus === "active" ? <CheckCircleOutlineIcon style={{ fontSize: 14 }} /> : <ErrorOutlineIcon style={{ fontSize: 14 }} />} sx={{ bgcolor: tenantStatus === "active" ? "rgba(5,150,105,0.2)" : "rgba(220,38,38,0.2)", color: "white", fontWeight: 600, fontSize: 12, border: "1px solid rgba(255,255,255,0.2)", "& .MuiChip-icon": { color: tenantStatus === "active" ? "#6EE7B7" : "#FCA5A5" } }} />
                <Tooltip title="Actualiser"><Box component="button" onClick={() => { queryClient.invalidateQueries({ queryKey: ["tenant-health"] }); queryClient.invalidateQueries({ queryKey: ["active-sessions"] }); }} sx={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 2, p: 0.75, cursor: "pointer", display: "flex", color: "white", "&:hover": { background: "rgba(255,255,255,0.2)" } }}><RefreshIcon sx={{ fontSize: 18 }} /></Box></Tooltip>
              </Box>
      </Box>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <Stack spacing={3}>
              {/* ── Password Policy Card ── */}
              <SectionCard title="Politique de mot de passe" icon={<LockOutlinedIcon sx={{ fontSize: 18 }} />} accent={STEEL}>
                <Stack spacing={1}>
                  {([["requireUppercase","Majuscule obligatoire"],["requireLowercase","Minuscule obligatoire"],["requireDigit","Chiffre obligatoire"],["requireSpecialChar","Caractere special"]] as [keyof TenantPasswordPolicy, string][]).map(([k, lbl]) => (
                    <PolicyRow key={k} label={lbl} checked={!!policy[k]} onChange={(v) => setPolicy((p) => ({ ...p, [k]: v }))} />
                  ))}
                  <Box sx={{ px: 2, py: 1.5, borderRadius: 2, border: "1px solid #E2E8F0", bgcolor: "#FAFAFA" }}>
                    <Typography variant="body2" fontWeight={500} sx={{ color: NAVY, mb: 1 }}>Longueur minimale: <b>{policy.minLength}</b></Typography>
                    <Box component="input" type="range" min={6} max={32} value={policy.minLength} onChange={(e: any) => setPolicy((p) => ({ ...p, minLength: Number(e.target.value) }))} style={{ width: "100%", accentColor: STEEL }} />
                  </Box>
                </Stack>
                <Box mt={2} pt={2} sx={{ borderTop: "1px solid #F1F5F9" }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: NAVY, mb: 1.5 }}>Expiration et timeout</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: policy.maxAgeDays != null ? `${STEEL}30` : "#E2E8F0", bgcolor: policy.maxAgeDays != null ? `${STEEL}08` : "#FAFAFA" }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}><ScheduleIcon sx={{ fontSize: 16, color: STEEL }} /><Typography variant="body2" fontWeight={500} sx={{ color: NAVY }}>Expiration MDP</Typography></Box>
                          <Switch size="small" checked={policy.maxAgeDays != null} onChange={(e) => setPolicy((p) => ({ ...p, maxAgeDays: e.target.checked ? 90 : null }))} sx={{ "& .MuiSwitch-thumb": { bgcolor: NAVY }, "& .Mui-checked+.MuiSwitch-track": { bgcolor: STEEL } }} />
                        </Box>
                        {policy.maxAgeDays != null && <TextField size="small" type="number" fullWidth value={policy.maxAgeDays} onChange={(e) => setPolicy((p) => ({ ...p, maxAgeDays: Number(e.target.value) }))} InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption">jours</Typography></InputAdornment> }} inputProps={{ min: 1, max: 365 }} sx={{ mt: 0.5 }} />}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: policy.sessionTimeoutMinutes != null ? `${STEEL}30` : "#E2E8F0", bgcolor: policy.sessionTimeoutMinutes != null ? `${STEEL}08` : "#FAFAFA" }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}><TimerOffIcon sx={{ fontSize: 16, color: STEEL }} /><Typography variant="body2" fontWeight={500} sx={{ color: NAVY }}>Timeout session</Typography></Box>
                          <Switch size="small" checked={policy.sessionTimeoutMinutes != null} onChange={(e) => setPolicy((p) => ({ ...p, sessionTimeoutMinutes: e.target.checked ? 30 : null }))} sx={{ "& .MuiSwitch-thumb": { bgcolor: NAVY }, "& .Mui-checked+.MuiSwitch-track": { bgcolor: STEEL } }} />
                        </Box>
                        {policy.sessionTimeoutMinutes != null && <TextField size="small" type="number" fullWidth value={policy.sessionTimeoutMinutes} onChange={(e) => setPolicy((p) => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))} InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption">min</Typography></InputAdornment> }} inputProps={{ min: 1, max: 1440 }} sx={{ mt: 0.5 }} />}
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
                {policyMsg && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setPolicyMsg(null)}>{policyMsg}</Alert>}
                {policyErr && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setPolicyErr(null)}>{policyErr}</Alert>}
                <Button variant="contained" fullWidth sx={{ mt: 2, bgcolor: NAVY, "&:hover": { bgcolor: STEEL }, borderRadius: 2, fontWeight: 600 }} disabled={updatePolicyMutation.isPending} onClick={async () => { setPolicyMsg(null); setPolicyErr(null); try { await updatePolicyMutation.mutateAsync(policy); setPolicyMsg("Politique sauvegardee."); } catch (e: any) { setPolicyErr(e.message); } }}>
                  {updatePolicyMutation.isPending ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Sauvegarder la politique"}
                </Button>
              </SectionCard>
              {/* ── IP Whitelist Card ── */}
              <SectionCard title="Liste blanche IP" icon={<WifiLockIcon sx={{ fontSize: 18 }} />} accent="#7c3aed">
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="body2" fontWeight={500} sx={{ color: NAVY }}>Activer la restriction par IP</Typography>
                  <Switch checked={ipEnabled} onChange={(e) => setIpEnabled(e.target.checked)} sx={{ "& .MuiSwitch-thumb": { bgcolor: NAVY }, "& .Mui-checked+.MuiSwitch-track": { bgcolor: "#7c3aed" } }} />
                </Box>
                {ipEnabled && (
                  <>
                    <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>Seules les IP listees ci-dessous pourront acceder au panneau admin.</Alert>
                    <Box display="flex" gap={1} mb={1.5}>
                      <TextField size="small" fullWidth placeholder="Ex: 192.168.1.1" value={newIp} onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newIp.trim()) { setIpList((l) => [...l.filter((x) => x !== newIp.trim()), newIp.trim()]); setNewIp(""); } }} />
                      <IconButton size="small" onClick={() => { if (newIp.trim()) { setIpList((l) => [...l.filter((x) => x !== newIp.trim()), newIp.trim()]); setNewIp(""); } }} sx={{ bgcolor: NAVY, color: "white", borderRadius: 2, "&:hover": { bgcolor: STEEL }, flexShrink: 0 }}><AddIcon sx={{ fontSize: 18 }} /></IconButton>
                    </Box>
                    <Stack spacing={0.75} mb={2}>
                      {ipList.length === 0 && <Typography variant="caption" sx={{ color: "#94A3B8", textAlign: "center", display: "block", py: 1 }}>Aucune IP ajoutee</Typography>}
                      {ipList.map((ip) => (
                        <Box key={ip} display="flex" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", color: NAVY }}>{ip}</Typography>
                          <IconButton size="small" onClick={() => setIpList((l) => l.filter((x) => x !== ip))} sx={{ p: 0.25, color: "#DC2626" }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
                {ipMsg && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setIpMsg(null)}>{ipMsg}</Alert>}
                {ipErr && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setIpErr(null)}>{ipErr}</Alert>}
                <Button variant="contained" fullWidth sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" }, borderRadius: 2, fontWeight: 600 }} disabled={updateIpMutation.isPending} onClick={async () => { setIpMsg(null); setIpErr(null); try { await updateIpMutation.mutateAsync({ enabled: ipEnabled, ips: ipList }); setIpMsg("Whitelist IP sauvegardee."); } catch (e: any) { setIpErr(e.message); } }}>
                  {updateIpMutation.isPending ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Sauvegarder la whitelist"}
                </Button>
              </SectionCard>
              {/* ── Logo Upload Card ── */}
              <SectionCard title="Logo de la plateforme" icon={<ImageOutlinedIcon sx={{ fontSize: 18 }} />} accent={GOLD}>
                {tenantLogoUrl && <Box component="img" src={tenantLogoUrl} alt="Logo tenant" sx={{ display: "block", maxHeight: 80, maxWidth: 220, mb: 2, borderRadius: 2, objectFit: "contain", border: "1px solid #E2E8F0" }} onError={(e: any) => { e.target.style.display = "none"; }} />}
                <Box component="label" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, p: 3, borderRadius: 2, border: "2px dashed", borderColor: "#CBD5E1", bgcolor: "#F8FAFC", cursor: "pointer", transition: "all .15s", "&:hover": { borderColor: GOLD, bgcolor: `${GOLD}08` } }}>
                  <UploadIcon sx={{ fontSize: 32, color: "#94A3B8" }} />
                  <Typography variant="body2" sx={{ color: "#64748B", textAlign: "center" }}>Cliquez pour selectionner un logo<br /><Typography component="span" variant="caption" sx={{ color: "#94A3B8" }}>PNG, JPG, WEBP — max 5 Mo</Typography></Typography>
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setLogoMsg(null); setLogoErr(null); try { await uploadLogoMutation.mutateAsync(file); setLogoMsg("Logo mis a jour."); } catch (ex: any) { setLogoErr(ex.message); } }} />
                </Box>
                {logoMsg && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setLogoMsg(null)}>{logoMsg}</Alert>}
                {logoErr && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setLogoErr(null)}>{logoErr}</Alert>}
              </SectionCard>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Stack spacing={3}>
              {/* ── KPI tiles ── */}
              <Grid container spacing={2}>
                {[{ icon: <ErrorOutlineIcon sx={{ fontSize: 20 }} />, label: "Erreurs 24h", value: errorCount, color: errorCount > 0 ? "#DC2626" : "#059669", bg: errorCount > 0 ? "#FEF2F2" : "#F0FDF4" }, { icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: 20 }} />, label: "Tickets ouverts", value: openTickets, color: openTickets > 5 ? "#D97706" : NAVY, bg: openTickets > 5 ? "#FFFBEB" : "#F8FAFC" }, { icon: <ReportProblemOutlinedIcon sx={{ fontSize: 20 }} />, label: "Critiques", value: critTickets, color: critTickets > 0 ? "#DC2626" : "#059669", bg: critTickets > 0 ? "#FEF2F2" : "#F0FDF4" }].map((kpi) => (
                  <Grid item xs={4} key={kpi.label}>
                    <Box sx={{ borderRadius: 3, border: "1px solid #E2E8F0", bgcolor: "white", px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 2, position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(13,27,42,0.05)", "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: kpi.color, borderRadius: "3px 0 0 3px" }, transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 16px rgba(13,27,42,0.1)" } }}>
                      <Avatar sx={{ width: 44, height: 44, bgcolor: kpi.color, color: "white", borderRadius: 2.5, boxShadow: `0 4px 12px ${kpi.color}44`, flexShrink: 0 }}>{kpi.icon}</Avatar>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: kpi.color, lineHeight: 1, letterSpacing: -0.5 }}>{healthQuery.isLoading ? "..." : kpi.value}</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ lineHeight: 1.3 }}>{kpi.label}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              {/* ── Sessions actives ── */}
              <SectionCard title="Sessions actives" icon={<DevicesIcon sx={{ fontSize: 18 }} />} accent={STEEL}>
                {sessionsQuery.isLoading && <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>}
                {!sessionsQuery.isLoading && (sessionsQuery.data ?? []).length === 0 && <Typography variant="body2" sx={{ color: "#94A3B8", textAlign: "center", py: 2 }}>Aucune session detectee.</Typography>}
                <Stack spacing={1}>
                  {(sessionsQuery.data ?? []).map((s) => (
                    <Box key={s.userId} display="flex" alignItems="center" gap={1.5} sx={{ px: 2, py: 1.25, borderRadius: 2, border: "1px solid #E2E8F0", bgcolor: "#FAFAFA" }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: STEEL, fontSize: 13 }}>{s.userName.charAt(0).toUpperCase()}</Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600} sx={{ color: NAVY }} noWrap>{s.userName}</Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={0.25}>
                          {s.userRole && <Chip label={s.userRole} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 600, bgcolor: `${STEEL}15`, color: STEEL }} />}
                          {s.ip && <Typography variant="caption" sx={{ color: "#94A3B8" }}>{s.ip}</Typography>}
                        </Box>
                        <Box display="flex" alignItems="center" gap={0.5} mt={0.25}><AccessTimeIcon sx={{ fontSize: 11, color: "#94A3B8" }} /><Typography variant="caption" sx={{ color: "#94A3B8" }}>{fmt(s.lastActivity)}</Typography></Box>
                      </Box>
                      <Tooltip title="Revoquer la session">
                        <IconButton size="small" onClick={() => setRevokeTarget({ userId: s.userId, userName: s.userName })} sx={{ color: "#DC2626", "&:hover": { bgcolor: "#FEF2F2" } }}><PersonOffIcon sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Stack>
                {revokeMsg && <Alert severity="success" sx={{ mt: 1.5, borderRadius: 2 }} onClose={() => setRevokeMsg(null)}>{revokeMsg}</Alert>}
              </SectionCard>
              {/* ── Sante du tenant ── */}
              <SectionCard title="Sante du tenant" icon={<MonitorHeartIcon sx={{ fontSize: 18 }} />} accent="#059669">
                {healthQuery.isLoading ? <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box> : (
                  <Stack>
                    <HealthRow label="Statut" value={<Chip label={health?.tenant?.status ?? "--"} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: health?.tenant?.status === "active" ? "#D1FAE5" : "#FEE2E2", color: health?.tenant?.status === "active" ? "#065F46" : "#991B1B" }} />} />
                    <HealthRow label="Derniere synchro" value={fmt(health?.synchronization?.lastAt)} />
                    <HealthRow label="Statut synchro" value={health?.synchronization?.lastStatus ?? "--"} />
                    <HealthRow label="Calcule le" value={fmt(health?.computedAt)} />
                  </Stack>
                )}
              </SectionCard>
              {/* ── Dernieres erreurs ── */}
              {(health?.activity?.recentErrors ?? []).length > 0 && (
                <SectionCard title="Dernieres erreurs (24h)" icon={<ErrorOutlineIcon sx={{ fontSize: 18 }} />} accent="#DC2626">
                  <Stack spacing={0.75}>
                    {(health?.activity?.recentErrors ?? []).slice(0, 5).map((err) => (
                      <Box key={err.id} sx={{ px: 2, py: 1.25, borderRadius: 2, border: "1px solid #FEE2E2", bgcolor: "#FEF2F2" }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={600} sx={{ color: "#DC2626", fontSize: 12 }}>{err.action}</Typography>
                          <Typography variant="caption" sx={{ color: "#94A3B8" }}>{fmt(err.created_at)}</Typography>
                        </Box>
                        {err.description && <Typography variant="caption" sx={{ color: "#64748B", display: "block" }}>{err.description}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                </SectionCard>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
      {/* ── Revoke dialog ── */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>Revoquer la session</DialogTitle>
        <DialogContent><Typography>Confirmer la revocation de la session de <b>{revokeTarget?.userName}</b> ? L utilisateur sera deconnecte lors de son prochain appel API.</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevokeTarget(null)} sx={{ color: "#64748B" }}>Annuler</Button>
          <Button variant="contained" sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" }, borderRadius: 2 }} disabled={revokeMutation.isPending} onClick={() => { if (revokeTarget) revokeMutation.mutate(revokeTarget.userId); }}>
            {revokeMutation.isPending ? <CircularProgress size={16} sx={{ color: "white" }} /> : "Revoquer"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
