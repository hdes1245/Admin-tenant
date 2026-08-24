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

export interface Zone {
  id: number;
  code: string;
  name: string;
  createdAt?: string;
}

export async function fetchZones(): Promise<Zone[]> {
  const response = await apiClient.get<unknown>("/zones");
  const data = response.data as any;
  if (!Array.isArray(data)) {
    throw new Error("Réponse inattendue du serveur pour /zones (attendu: tableau).");
  }
  return (data as any[]).map((z) => ({
    id: Number(z.id),
    code: String(z.code ?? ""),
    name: String(z.name ?? ""),
    createdAt: z.created_at ? String(z.created_at) : undefined,
  }));
}

export async function createZone(input: { code: string; name: string }): Promise<void> {
  try {
    await apiClient.post("/zones", {
      code: input.code.trim(),
      name: input.name.trim(),
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer la zone."));
  }
}

export async function updateZone(input: { id: number; code: string; name: string }): Promise<void> {
  try {
    await apiClient.put(`/zones/${input.id}`, {
      code: input.code.trim(),
      name: input.name.trim(),
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier la zone."));
  }
}

export async function deleteZone(id: number): Promise<void> {
  try {
    await apiClient.delete(`/zones/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer la zone."));
  }
}

