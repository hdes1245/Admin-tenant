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

export interface LocationTypeItem {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  color: string;
}

function mapLocationType(x: any): LocationTypeItem {
  return {
    id: Number(x.id),
    code: String(x.code ?? ""),
    name: String(x.name ?? ""),
    sort_order: Number(x.sort_order ?? 0),
    color: String(x.color ?? "#6B7280"),
  };
}

export async function fetchLocationTypes(): Promise<LocationTypeItem[]> {
  try {
    const resp = await apiClient.get<unknown>("/location-types");
    const data = (resp as any).data ?? resp;
    const list = Array.isArray(data) ? data : [];
    return list.map(mapLocationType).sort((a: LocationTypeItem, b: LocationTypeItem) => a.sort_order - b.sort_order);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les types de lieux."));
  }
}

export async function createLocationType(dto: { code: string; name: string; sort_order?: number; color?: string }): Promise<LocationTypeItem> {
  try {
    const resp = await apiClient.post<unknown>("/location-types", dto);
    return mapLocationType((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de creer le type de lieu."));
  }
}

export async function updateLocationType(
  id: number,
  dto: { code?: string; name?: string; sort_order?: number; color?: string },
): Promise<LocationTypeItem> {
  try {
    const resp = await apiClient.put<unknown>(`/location-types/${id}`, dto);
    return mapLocationType((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier le type de lieu."));
  }
}

export async function deleteLocationType(id: number): Promise<void> {
  try {
    await apiClient.delete(`/location-types/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer le type de lieu."));
  }
}
