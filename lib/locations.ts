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

export interface LocationItem {
  id: number;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  timestamp: string | null;
  clientName: string | null;
  clientCode: string | null;
  userName: string | null;
  metadata: Record<string, unknown> | null;
}

export interface LocationPhotoItem {
  id: number;
  original_name: string;
  file_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

export interface LocationsPage {
  items: LocationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LocationHistoryItem {
  id: number;
  locationId: number;
  action: string | null;
  oldLatitude: number | null;
  oldLongitude: number | null;
  newLatitude: number | null;
  newLongitude: number | null;
  modifiedAt: string | null;
  modifiedByName: string | null;
}

export interface DeletionLogItem {
  id: number;
  createdAt: string;
  /** Nom de l'agent qui a effectué la suppression (jointure user). */
  agentName: string | null;
  description: string | null;
  clientCode: string | null;
  clientId: number | null;
  locationId: number | null;
  deletedByRole: string | null;
  justification: string | null;
}

export async function fetchDeletionLogs(params?: {
  page?: number;
  limit?: number;
}): Promise<{ logs: DeletionLogItem[]; total: number }> {
  try {
    const resp = await apiClient.get<unknown>("/activity-logs/tenant", {
      params: {
        action: "LOCATION_DELETE",
        page: params?.page ?? 1,
        limit: params?.limit ?? 100,
      },
    });
    const data = (resp as any).data ?? {};
    const raw: any[] = Array.isArray(data.logs) ? data.logs : [];
    return {
      logs: raw.map((r) => {
        const meta = r.metadata ?? {};
        const user = r.user ?? {};
        return {
          id: Number(r.id),
          createdAt: r.created_at ?? r.createdAt ?? "",
          agentName: user.name ?? user.email ?? null,
          description: r.description != null ? String(r.description) : null,
          clientCode: meta.client_code ?? null,
          clientId: meta.client_id != null ? Number(meta.client_id) : null,
          locationId: meta.location_id != null ? Number(meta.location_id) : null,
          deletedByRole: meta.deleted_by_role ?? null,
          justification: meta.justification ?? null,
        };
      }),
      total: Number(data.total ?? raw.length),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger le journal des suppressions."));
  }
}

export async function fetchLocationHistory(locationId: number): Promise<LocationHistoryItem[]> {
  try {
    const response = await apiClient.get<unknown>(`/locations/${locationId}/history`);
    const data = (response as any).data ?? [];
    const list = Array.isArray(data) ? data : [];
    return list.map((h: any) => ({
      id: Number(h.id),
      locationId: Number(h.location_id ?? locationId),
      action: h.action != null ? String(h.action) : null,
      oldLatitude: h.old_latitude != null ? Number(h.old_latitude) : null,
      oldLongitude: h.old_longitude != null ? Number(h.old_longitude) : null,
      newLatitude: h.new_latitude != null ? Number(h.new_latitude) : null,
      newLongitude: h.new_longitude != null ? Number(h.new_longitude) : null,
      modifiedAt: h.modified_at != null ? String(h.modified_at) : null,
      modifiedByName: h.modified_by_name != null ? String(h.modified_by_name) : null,
    }));
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger l'historique de cette localisation."));
  }
}

export async function fetchLocations(params?: {
  page?: number;
  limit?: number;
  clientId?: number;
  userId?: number;
  type?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<LocationsPage> {
  try {
    const response = await apiClient.get<unknown>("/locations", {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        clientId: params?.clientId,
        userId: params?.userId,
        type: params?.type || undefined,
        search: params?.search || undefined,
        dateFrom: params?.dateFrom || undefined,
        dateTo: params?.dateTo || undefined,
      },
    });
    const data = (response as any).data ?? {};
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      items: items.map((x: any) => ({
        id: Number(x.id),
        type: x.type != null ? String(x.type) : null,
        latitude: x.latitude != null ? Number(x.latitude) : null,
        longitude: x.longitude != null ? Number(x.longitude) : null,
        address: x.address != null ? String(x.address) : null,
        timestamp: x.timestamp != null ? String(x.timestamp) : null,
        clientName: x.client?.name != null ? String(x.client.name) : null,
        clientCode: x.client?.code_client != null ? String(x.client.code_client) : null,
        userName: x.user?.name != null ? String(x.user.name) : null,
        metadata: x.metadata != null && typeof x.metadata === "object" ? x.metadata as Record<string, unknown> : null,
      })),
      total: Number(data.total ?? 0),
      page: Number(data.page ?? 1),
      limit: Number(data.limit ?? 20),
      totalPages: Number(data.totalPages ?? 1),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les localisations."));
  }
}

export async function fetchLocationPhotos(locationId: number): Promise<LocationPhotoItem[]> {
  try {
    const response = await apiClient.get<unknown>(`/location-photos/location/${locationId}`);
    const data = (response as any).data;
    const list = Array.isArray(data) ? data : [];
    return list.map((p: any) => ({
      id: Number(p.id),
      original_name: String(p.original_name ?? ""),
      file_name: String(p.file_name ?? ""),
      mime_type: String(p.mime_type ?? ""),
      size: Number(p.size ?? 0),
      uploaded_at: String(p.uploaded_at ?? ""),
    }));
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les photos."));
  }
}

export async function deleteLocationPhoto(photoId: number): Promise<void> {
  try {
    await apiClient.delete(`/location-photos/${photoId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer la photo."));
  }
}
