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

export interface RemoteAgence {
  id: number;
  COD_AGENCE: string;
  NOM_AGENCE: string;
  ZONE_ID?: number | null;
  ZONE_NAME?: string | null;
}

export interface Agence {
  id: number;
  code: string;
  name: string;
  zoneId: number | null;
  zoneName: string | null;
}

export async function fetchAgences(): Promise<Agence[]> {
  const response = await apiClient.get<unknown>("/agences");
  const data = response.data as any;

  if (!Array.isArray(data)) {
    // Par exemple en cas de 401/403 ou d'erreur serveur on peut recevoir un objet.
    // On remonte une erreur claire à la couche UI.
    throw new Error(
      "Réponse inattendue du serveur pour /agences (attendu: tableau)."
    );
  }

  return (data as RemoteAgence[]).map((a) => ({
    id: Number(a.id),
    code: a.COD_AGENCE,
    name: a.NOM_AGENCE,
    zoneId: a.ZONE_ID != null ? Number(a.ZONE_ID) : null,
    zoneName: a.ZONE_NAME != null ? String(a.ZONE_NAME) : null,
  }));
}

export async function createAgence(input: {
  code: string;
  name: string;
  zoneId?: number | null;
}): Promise<void> {
  try {
    await apiClient.post("/agences", {
      code: input.code.trim(),
      name: input.name.trim(),
      zoneId: input.zoneId ?? null,
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer l'agence."));
  }
}

export async function updateAgence(input: {
  id: number;
  code: string;
  name: string;
  zoneId?: number | null;
}): Promise<void> {
  try {
    await apiClient.put(`/agences/${input.id}`, {
      code: input.code.trim(),
      name: input.name.trim(),
      zoneId: input.zoneId ?? null,
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier l'agence."));
  }
}

export interface AgenceStats {
  agenceId: number;
  nbClients: number;
  nbCafs: number;
  nbUsers: number;
}

export async function fetchAgencesStats(): Promise<AgenceStats[]> {
  try {
    const response = await apiClient.get<unknown>("/agences/stats");
    const data = (response as any).data ?? [];
    return Array.isArray(data)
      ? data.map((s: any) => ({
          agenceId: Number(s.agenceId),
          nbClients: Number(s.nbClients ?? 0),
          nbCafs: Number(s.nbCafs ?? 0),
          nbUsers: Number(s.nbUsers ?? 0),
        }))
      : [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les statistiques des agences."));
  }
}

export async function fetchAgencesUsersSummary(): Promise<{ totalDistinctUsers: number }> {
  try {
    const response = await apiClient.get<unknown>("/agences/stats/users-summary");
    const data = (response as any).data ?? {};
    return { totalDistinctUsers: Number(data.totalDistinctUsers ?? 0) };
  } catch {
    return { totalDistinctUsers: 0 };
  }
}

export async function deleteAgence(id: number): Promise<void> {
  try {
    await apiClient.delete(`/agences/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer l'agence."));
  }
}

