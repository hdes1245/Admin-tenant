import { apiClient } from "./apiClient";

export interface AuthUserProfile {
  id: number;
  name: string;
  username: string;
  role: string;
  tenantName?: string | null;
  tenantLogoUrl?: string | null;
  mustChangePassword: boolean;
}

export async function fetchMe(): Promise<AuthUserProfile | null> {
  try {
    const response = await apiClient.get<unknown>("/auth/me");
    const data = response.data as any;
    if (!data) return null;
    return {
      id: Number(data.id ?? 0),
      name: String(data.name ?? data.fullName ?? ""),
      username: String(data.username ?? data.email ?? ""),
      role: String(data.role ?? data.roleCode ?? ""),
      // Le backend (AuthService.toProfilePayload) renvoie ces champs à plat
      // (tenantName / tenantLogoUrl), pas sous un objet imbriqué `tenant`.
      tenantName:
        data.tenantName != null ? String(data.tenantName) : null,
      tenantLogoUrl:
        data.tenantLogoUrl != null ? String(data.tenantLogoUrl) : null,
      mustChangePassword: !!data.must_change_password,
    };
  } catch {
    return null;
  }
}

