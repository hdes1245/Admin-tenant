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

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export async function fetchMyNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  try {
    const response = await apiClient.get<unknown>("/notifications/my", {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        unreadOnly: params?.unreadOnly ?? false,
      },
    });
    const data = (response as any).data ?? {};
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      items: items.map((n: any) => ({
        id: Number(n.id),
        type: String(n.type ?? ""),
        title: String(n.title ?? ""),
        body: n.body != null ? String(n.body) : null,
        isRead: !!n.is_read,
        readAt: n.read_at != null ? String(n.read_at) : null,
        createdAt: String(n.created_at ?? ""),
      })),
      total: Number(data.total ?? 0),
      page: Number(data.page ?? 1),
      limit: Number(data.limit ?? 20),
      totalPages: Number(data.totalPages ?? 1),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les notifications."));
  }
}

export async function fetchUnreadNotificationsCount(): Promise<number> {
  try {
    const response = await apiClient.get<unknown>("/notifications/my/unread-count");
    const data = (response as any).data ?? {};
    return Number(data.count ?? 0);
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de charger le nombre de notifications non lues."),
    );
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  try {
    await apiClient.post(`/notifications/${id}/mark-read`);
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de marquer cette notification comme lue."),
    );
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await apiClient.post("/notifications/my/mark-all-read");
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de marquer toutes les notifications comme lues."),
    );
  }
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

export interface BroadcastDto {
  id: number;
  title: string;
  body: string | null;
  targetRoles: string[];
  scheduledAt: string | null;
  sentAt: string | null;
  isSent: boolean;
  recipientCount: number;
  readCount: number;
  createdAt: string | null;
}

function mapBroadcast(b: any): BroadcastDto {
  return {
    id: Number(b.id),
    title: String(b.title ?? ""),
    body: b.body != null ? String(b.body) : null,
    targetRoles: Array.isArray(b.targetRoles) ? b.targetRoles : [],
    scheduledAt: b.scheduledAt ?? null,
    sentAt: b.sentAt ?? null,
    isSent: !!b.isSent,
    recipientCount: Number(b.recipientCount ?? 0),
    readCount: Number(b.readCount ?? 0),
    createdAt: b.createdAt ?? null,
  };
}

export async function createBroadcast(dto: {
  title: string;
  body?: string;
  targetRoles: string[];
  scheduledAt?: string | null;
}): Promise<BroadcastDto> {
  try {
    const resp = await apiClient.post<unknown>("/notifications/broadcasts", dto);
    return mapBroadcast((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer la diffusion."));
  }
}

export async function fetchBroadcasts(): Promise<BroadcastDto[]> {
  try {
    const resp = await apiClient.get<unknown>("/notifications/broadcasts");
    const data = (resp as any).data ?? resp;
    const list = Array.isArray(data) ? data : [];
    return list.map(mapBroadcast);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les diffusions."));
  }
}

export async function cancelBroadcast(id: number): Promise<void> {
  try {
    await apiClient.delete(`/notifications/broadcasts/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'annuler la diffusion."));
  }
}

// ── Règles d'alertes clients à risque ──────────────────────────────────────────

export type AlertCriterion =
  | "RISK_TRANCHE"
  | "DAYS_LATE"
  | "UNPAID_CAPITAL"
  | "RISK_STATUS_ENTRY"
  | "UPCOMING_DUE";

export interface AlertRuleDto {
  id: number;
  tenantId: number | null;
  name: string;
  criterion: AlertCriterion;
  threshold: number | null;
  tranches: string[];
  targetRoles: string[];
  digest: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  totalFired: number;
  createdAt: string | null;
}

export interface AlertRuleInput {
  name: string;
  criterion: AlertCriterion;
  threshold?: number | null;
  tranches?: string[];
  targetRoles: string[];
  digest?: boolean;
  isActive?: boolean;
  tenantId?: number | null;
}

function mapAlertRule(r: any): AlertRuleDto {
  return {
    id: Number(r.id),
    tenantId: r.tenantId != null ? Number(r.tenantId) : null,
    name: String(r.name ?? ""),
    criterion: String(r.criterion ?? "RISK_TRANCHE") as AlertCriterion,
    threshold: r.threshold != null ? Number(r.threshold) : null,
    tranches: Array.isArray(r.tranches) ? r.tranches : [],
    targetRoles: Array.isArray(r.targetRoles) ? r.targetRoles : [],
    digest: r.digest !== false,
    isActive: !!r.isActive,
    lastRunAt: r.lastRunAt ?? null,
    totalFired: Number(r.totalFired ?? 0),
    createdAt: r.createdAt ?? null,
  };
}

export async function fetchAlertRules(): Promise<AlertRuleDto[]> {
  try {
    const resp = await apiClient.get<unknown>("/alert-rules");
    const data = (resp as any).data ?? resp;
    return (Array.isArray(data) ? data : []).map(mapAlertRule);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les règles d'alertes."));
  }
}

export async function createAlertRule(dto: AlertRuleInput): Promise<AlertRuleDto> {
  try {
    const resp = await apiClient.post<unknown>("/alert-rules", dto);
    return mapAlertRule((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer la règle d'alerte."));
  }
}

export async function updateAlertRule(id: number, dto: Partial<AlertRuleInput>): Promise<AlertRuleDto> {
  try {
    const resp = await apiClient.put<unknown>(`/alert-rules/${id}`, dto);
    return mapAlertRule((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier la règle d'alerte."));
  }
}

export async function setAlertRuleActive(id: number, isActive: boolean): Promise<AlertRuleDto> {
  try {
    const resp = await apiClient.post<unknown>(`/alert-rules/${id}/active`, { isActive });
    return mapAlertRule((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier l'état de la règle."));
  }
}

export async function runAlertRuleNow(id: number): Promise<{ alerts: number }> {
  try {
    const resp = await apiClient.post<unknown>(`/alert-rules/${id}/run`);
    const data = (resp as any).data ?? {};
    return { alerts: Number(data.alerts ?? 0) };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'exécuter la règle."));
  }
}

export async function deleteAlertRule(id: number): Promise<void> {
  try {
    await apiClient.delete(`/alert-rules/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer la règle d'alerte."));
  }
}
