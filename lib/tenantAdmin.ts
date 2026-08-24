import { apiClient } from "./apiClient";

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err: any = error as any;
  const data = err?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) {
    const joined = msg.map((m) => String(m)).join(" | ").trim();
    if (joined) return joined;
  }
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

export interface TenantPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  maxAgeDays: number | null;
  sessionTimeoutMinutes: number | null;
}

export interface IpWhitelistSettings {
  enabled: boolean;
  ips: string[];
}

export interface ActiveSession {
  userId: number;
  userName: string;
  userRole: string | null;
  lastActivity: string;
  ip: string | null;
  device: string | null;
}

export interface TenantSecurityResponse {
  passwordPolicy: TenantPasswordPolicy | null;
}

export interface TenantHealthResponse {
  ok: boolean;
  tenant?: {
    id: number;
    name: string;
    slug: string;
    status: string;
  };
  synchronization?: {
    lastStatus: string | null;
    lastAt: string | null;
    recentEvents: Array<{
      id: number;
      status: string;
      message?: string;
      created_at: string;
    }>;
  };
  activity?: {
    errorCountLast24h: number;
    recentErrors: Array<{
      id: number;
      action: string;
      description?: string;
      created_at: string;
    }>;
  };
  support?: {
    criticalOpenTickets: number;
    openTickets: number;
  };
  computedAt?: string;
  reason?: string;
}

export interface TenantBrandingResponse {
  tenantId: number | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantLogoUrl: string | null;
}

export async function fetchTenantSecurity(): Promise<TenantSecurityResponse> {
  try {
    const response = await apiClient.get<unknown>("/tenants/me/security");
    const data = (response as any).data ?? {};
    const policy = data.passwordPolicy ?? null;
    return {
      passwordPolicy: policy
        ? {
            minLength: Number(policy.minLength ?? 8),
            requireUppercase: !!policy.requireUppercase,
            requireLowercase: !!policy.requireLowercase,
            requireDigit: !!policy.requireDigit,
            requireSpecialChar: !!policy.requireSpecialChar,
            maxAgeDays: policy.maxAgeDays != null ? Number(policy.maxAgeDays) : null,
            sessionTimeoutMinutes: policy.sessionTimeoutMinutes != null ? Number(policy.sessionTimeoutMinutes) : null,
          }
        : null,
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de charger les paramètres de sécurité."),
    );
  }
}

export async function updateTenantPasswordPolicy(
  policy: Partial<TenantPasswordPolicy>,
): Promise<{ success: boolean; passwordPolicy: TenantPasswordPolicy | null }> {
  try {
    const response = await apiClient.put<unknown>(
      "/tenants/me/security/password-policy",
      policy,
    );
    const data = (response as any).data ?? {};
    const p = data.passwordPolicy ?? null;
    return {
      success: !!data.success,
      passwordPolicy: p
        ? {
            minLength: Number(p.minLength ?? 8),
            requireUppercase: !!p.requireUppercase,
            requireLowercase: !!p.requireLowercase,
            requireDigit: !!p.requireDigit,
            requireSpecialChar: !!p.requireSpecialChar,
            maxAgeDays: p.maxAgeDays != null ? Number(p.maxAgeDays) : null,
            sessionTimeoutMinutes: p.sessionTimeoutMinutes != null ? Number(p.sessionTimeoutMinutes) : null,
          }
        : null,
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Impossible de mettre à jour la politique de mot de passe.",
      ),
    );
  }
}

export async function fetchTenantHealth(): Promise<TenantHealthResponse> {
  try {
    const response = await apiClient.get<unknown>("/tenants/me/health");
    const data = (response as any).data ?? {};
    return data as TenantHealthResponse;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger la santé du tenant."));
  }
}

export async function fetchTenantBranding(): Promise<TenantBrandingResponse> {
  try {
    const response = await apiClient.get<unknown>("/tenants/me/branding");
    const data = (response as any).data ?? {};
    return {
      tenantId: data.tenantId != null ? Number(data.tenantId) : null,
      tenantSlug: data.tenantSlug != null ? String(data.tenantSlug) : null,
      tenantName: data.tenantName != null ? String(data.tenantName) : null,
      tenantLogoUrl: data.tenantLogoUrl != null ? String(data.tenantLogoUrl) : null,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger le branding du tenant."));
  }
}

export async function fetchIpWhitelist(): Promise<IpWhitelistSettings> {
  try {
    const response = await apiClient.get<unknown>("/tenants/me/security/ip-whitelist");
    const data = (response as any).data ?? {};
    return { enabled: !!data.enabled, ips: Array.isArray(data.ips) ? data.ips.map(String) : [] };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger la liste blanche IP."));
  }
}

export async function updateIpWhitelist(settings: IpWhitelistSettings): Promise<IpWhitelistSettings> {
  try {
    const response = await apiClient.put<unknown>("/tenants/me/security/ip-whitelist", settings);
    const data = (response as any).data ?? {};
    return { enabled: !!data.enabled, ips: Array.isArray(data.ips) ? data.ips.map(String) : [] };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de mettre a jour la liste blanche IP."));
  }
}

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  try {
    const response = await apiClient.get<unknown>("/tenants/me/sessions");
    const data = (response as any).data ?? {};
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return sessions.map((s: any) => ({
      userId: Number(s.userId),
      userName: String(s.userName ?? "Inconnu"),
      userRole: s.userRole != null ? String(s.userRole) : null,
      lastActivity: String(s.lastActivity ?? ""),
      ip: s.ip != null ? String(s.ip) : null,
      device: s.device != null ? String(s.device) : null,
    }));
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les sessions actives."));
  }
}

export async function revokeSession(userId: number): Promise<void> {
  try {
    await apiClient.delete<unknown>(`/tenants/me/sessions/${userId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de revoquer la session."));
  }
}

export async function uploadTenantLogo(file: File): Promise<TenantBrandingResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.put<unknown>("/tenants/me/branding/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const data = (response as any).data ?? {};
    return {
      tenantId: data.tenantId != null ? Number(data.tenantId) : null,
      tenantSlug: data.tenantSlug != null ? String(data.tenantSlug) : null,
      tenantName: data.tenantName != null ? String(data.tenantName) : null,
      tenantLogoUrl: data.tenantLogoUrl != null ? String(data.tenantLogoUrl) : null,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'uploader le logo du tenant."));
  }
}
