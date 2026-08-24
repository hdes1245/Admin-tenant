import { apiClient } from "./apiClient";

export interface TenantDashboardStats {
  agences: number;
  cafs: number;
  clients: number;
  locations: number;
}

export interface ClientsByAgencyItem {
  agence: string;
  total_clients: string;
}

export interface TicketsByStatusItem {
  status: string;
  count: number;
}

export interface ActivityLogsByDayItem {
  date: string;
  count: number;
}

export interface ActivityLogsByActionItem {
  action: string;
  count: number;
}

export interface DashboardCharts {
  clientsByAgency: ClientsByAgencyItem[];
  ticketsByStatus: TicketsByStatusItem[];
  activityByDay: ActivityLogsByDayItem[];
  activityByAction: ActivityLogsByActionItem[];
}

export interface ActivityLogItem {
  id: number;
  action: string;
  description: string | null;
  created_at: string;
  user?: { id: number; name?: string; username?: string };
}

export interface RecentActivityLogsResponse {
  logs: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchTenantDashboardStats(): Promise<TenantDashboardStats> {
  const [agencesResp, usersResp, clientsResp, locationsResp] = await Promise.all([
    apiClient.get<unknown>("/agences").catch(() => ({ data: [] })),
    apiClient.get<unknown>("/users", { params: { includeCaf: true } }).catch(() => ({ data: [] })),
    apiClient
      .get<unknown>("/clients", {
        params: { page: 1, limit: 1 },
      })
      .catch(() => ({ data: {} })),
    apiClient
      .get<unknown>("/locations", {
        params: { page: 1, limit: 1 },
      })
      .catch(() => ({ data: {} })),
  ]);

  const agencesData = (agencesResp as any).data ?? [];
  const usersData = (usersResp as any).data ?? [];
  const clientsData = (clientsResp as any).data ?? {};
  const locationsData = (locationsResp as any).data ?? {};

  const agences = Array.isArray(agencesData) ? agencesData.length : 0;
  // Agents de terrain = utilisateurs de rôle "caf" (un agent peut porter plusieurs codes gestionnaire)
  const cafs = Array.isArray(usersData)
    ? usersData.filter((u: any) => String(u.roleCode ?? "").toLowerCase() === "caf").length
    : 0;
  const clients = Number((clientsData as any).total ?? 0);
  const locations = Number((locationsData as any).total ?? 0);

  return { agences, cafs, clients, locations };
}

export async function fetchDashboardCharts(days = 30): Promise<DashboardCharts> {
  const [agencyResp, ticketsResp, logsStatsResp] = await Promise.all([
    apiClient.get<ClientsByAgencyItem[]>("/clients/stats/agency").catch(() => ({ data: [] })),
    apiClient.get<TicketsByStatusItem[]>("/support-tickets/tenant/stats").catch(() => ({ data: [] })),
    apiClient
      .get<{ byDay: ActivityLogsByDayItem[]; byAction: ActivityLogsByActionItem[] }>(
        "/activity-logs/tenant/stats",
        { params: { days } }
      )
      .catch(() => ({ data: { byDay: [], byAction: [] } })),
  ]);

  const clientsByAgency = Array.isArray((agencyResp as any).data) ? (agencyResp as any).data : [];
  const ticketsByStatus = Array.isArray((ticketsResp as any).data) ? (ticketsResp as any).data : [];
  const logsData = (logsStatsResp as any).data ?? {};
  const activityByDay = Array.isArray(logsData.byDay) ? logsData.byDay : [];
  const activityByAction = Array.isArray(logsData.byAction) ? logsData.byAction : [];

  return {
    clientsByAgency,
    ticketsByStatus,
    activityByDay,
    activityByAction,
  };
}

export async function fetchRecentActivityLogs(limit = 15): Promise<RecentActivityLogsResponse> {
  const res = await apiClient.get<RecentActivityLogsResponse>("/activity-logs/tenant", {
    params: { page: 1, limit },
  });
  const data = (res as any).data ?? { logs: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? limit),
    totalPages: Number(data.totalPages ?? 0),
  };
}



