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

export interface ActivityLogItem {
  id: number;
  action: string;
  description: string | null;
  createdAt: string;
  userId: number | null;
  userName: string | null;
  userUsername: string | null;
}

export interface TenantActivityLogsPage {
  logs: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityStatsByDay {
  date: string;
  count: number;
}

export interface ActivityStatsByAction {
  action: string;
  count: number;
}

export async function fetchTenantActivityLogs(params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: number | "";
  startDate?: string;
  endDate?: string;
}): Promise<TenantActivityLogsPage> {
  try {
    const query: any = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    };
    if (params?.action?.trim()) query.action = params.action.trim();
    if (params?.userId !== "" && params?.userId != null) query.user_id = params.userId;
    if (params?.startDate) query.start_date = params.startDate;
    if (params?.endDate) query.end_date = params.endDate;

    const response = await apiClient.get<unknown>("/activity-logs/tenant", { params: query });
    const data = (response as any).data ?? {};
    const rawLogs = Array.isArray(data.logs) ? data.logs : [];
    return {
      logs: rawLogs.map((log: any) => ({
        id: Number(log.id),
        action: String(log.action ?? ""),
        description: log.description != null ? String(log.description) : null,
        createdAt: String(log.created_at ?? log.createdAt ?? ""),
        userId: log.user?.id != null ? Number(log.user.id) : null,
        userName: log.user?.name != null ? String(log.user.name) : null,
        userUsername: log.user?.username != null ? String(log.user.username) : null,
      })),
      total: Number(data.total ?? 0),
      page: Number(data.page ?? query.page),
      limit: Number(data.limit ?? query.limit),
      totalPages: Number(data.totalPages ?? 0),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les logs d'activité."));
  }
}

export async function fetchTenantActivityStats(days = 30): Promise<{
  byDay: ActivityStatsByDay[];
  byAction: ActivityStatsByAction[];
}> {
  try {
    const response = await apiClient.get<unknown>("/activity-logs/tenant/stats", {
      params: { days },
    });
    const data = (response as any).data ?? {};
    return {
      byDay: Array.isArray(data.byDay)
        ? data.byDay.map((x: any) => ({
            date: String(x.date ?? ""),
            count: Number(x.count ?? 0),
          }))
        : [],
      byAction: Array.isArray(data.byAction)
        ? data.byAction.map((x: any) => ({
            action: String(x.action ?? ""),
            count: Number(x.count ?? 0),
          }))
        : [],
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de charger les statistiques d'activité."),
    );
  }
}

export async function exportTenantActivityLogs(limit = 2000): Promise<ActivityLogItem[]> {
  try {
    const response = await apiClient.get<unknown>("/activity-logs/tenant/export", {
      params: { limit },
    });
    const data = (response as any).data ?? {};
    const rawLogs = Array.isArray(data.logs) ? data.logs : [];
    return rawLogs.map((log: any) => ({
      id: Number(log.id),
      action: String(log.action ?? ""),
      description: log.description != null ? String(log.description) : null,
      createdAt: String(log.created_at ?? log.createdAt ?? ""),
      userId: log.user?.id != null ? Number(log.user.id) : null,
      userName: log.user?.name != null ? String(log.user.name) : null,
      userUsername: log.user?.username != null ? String(log.user.username) : null,
    }));
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'exporter les logs d'activité."));
  }
}
