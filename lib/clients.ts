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

export interface ClientDto {
  id: number;
  name: string;
  codeClient: string;
  contactInfo: string | null;
  agenceClient: string | null;
  cafName: string | null;
  cafCode: string | null;
  createdAt?: string;
}

export interface ClientsPage {
  items: ClientDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateClientInput {
  name: string;
  codeClient: string;
  contactInfo?: string | null;
  agenceClient?: string | null;
  cafCode?: string | null;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: number;
}

export interface AvailableCaf {
  name: string;
  code: string;
  agence: string;
}

export interface AvailableAgency {
  agence: string;
}

export async function fetchClients(params?: {
  search?: string;
  page?: number;
  limit?: number;
  agence?: string;
  caf?: string;
}): Promise<ClientsPage> {
  const query: any = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
  };
  if (params?.search && params.search.trim()) {
    query.search = params.search.trim();
  }
  if (params?.agence && params.agence.trim()) {
    query.agence = params.agence.trim();
  }
  if (params?.caf && params.caf.trim()) {
    query.caf = params.caf.trim();
  }

  const response = await apiClient.get<unknown>("/clients", { params: query });
  const data = response.data as any;

  const items: ClientDto[] = (data.items ?? []).map((c: any) => ({
    id: Number(c.id),
    name: String(c.name ?? ""),
    codeClient: String(c.code_client ?? ""),
    contactInfo: c.contact_info != null ? String(c.contact_info) : null,
    agenceClient: c.agence_client != null ? String(c.agence_client) : null,
    cafName:
      c.caf_name != null && String(c.caf_name).trim().length > 0
        ? String(c.caf_name)
        : null,
    cafCode: c.caf_code != null ? String(c.caf_code) : null,
    createdAt: c.created_at ? String(c.created_at) : undefined,
  }));

  return {
    items,
    total: Number(data.total ?? items.length),
    page: Number(data.page ?? query.page),
    limit: Number(data.limit ?? query.limit),
    totalPages: Number(data.totalPages ?? 1),
  };
}

export async function createClient(input: CreateClientInput): Promise<void> {
  try {
    await apiClient.post("/clients", {
      name: input.name.trim(),
      code_client: input.codeClient.trim(),
      contact_info: input.contactInfo?.trim() || null,
      agence_client: input.agenceClient?.trim() || null,
      caf_code: input.cafCode?.trim() || null,
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer le client."));
  }
}

export async function updateClient(input: UpdateClientInput): Promise<void> {
  try {
    await apiClient.put(`/clients/${input.id}`, {
      name: input.name?.trim(),
      code_client: input.codeClient?.trim(),
      contact_info: input.contactInfo?.trim(),
      agence_client: input.agenceClient?.trim(),
      caf_code: input.cafCode?.trim(),
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de modifier le client."));
  }
}

export async function deleteClient(id: number): Promise<void> {
  try {
    await apiClient.delete(`/clients/${id}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de supprimer le client."));
  }
}

export interface ClientGlobalStats {
  total: number;
  withCaf: number;
  withoutCaf: number;
  withContact: number;
}

export async function fetchClientGlobalStats(): Promise<ClientGlobalStats> {
  try {
    const resp = await apiClient.get<unknown>("/clients/stats/global");
    const d = (resp as any).data ?? {};
    return {
      total: Number(d.total ?? 0),
      withCaf: Number(d.withCaf ?? 0),
      withoutCaf: Number(d.withoutCaf ?? 0),
      withContact: Number(d.withContact ?? 0),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de charger les statistiques clients."));
  }
}

export async function fetchAvailableCafs(): Promise<AvailableCaf[]> {
  const resp = await apiClient.get<unknown>("/clients/available-cafs");
  const data = (resp as any).data ?? resp;
  const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any).data) ? (data as any).data : [];
  return list.map((c: any) => ({
    name: String(c.name ?? c.nom ?? ""),
    code: String(c.code ?? c.CAF_CODE ?? ""),
    agence: String(c.agence ?? c.agence_caf ?? ""),
  }));
}

// Une ligne par code gestionnaire (non groupé par personne) — à utiliser pour
// assigner un client à un CAF précis (contrairement au filtre de recherche,
// qui doit chercher sur tous les codes d'une même personne).
export async function fetchAvailableCafsRaw(): Promise<AvailableCaf[]> {
  const resp = await apiClient.get<unknown>("/clients/available-cafs", { params: { grouped: false } });
  const data = (resp as any).data ?? resp;
  const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any).data) ? (data as any).data : [];
  return list.map((c: any) => ({
    name: String(c.name ?? c.nom ?? ""),
    code: String(c.code ?? c.CAF_CODE ?? ""),
    agence: String(c.agence ?? c.agence_caf ?? ""),
  }));
}

export async function fetchAvailableAgencies(): Promise<AvailableAgency[]> {
  const resp = await apiClient.get<unknown>("/clients/available-agencies");
  const data = (resp as any).data ?? resp;
  const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any).data) ? (data as any).data : [];
  return list.map((a: any) => ({
    agence: String(a.agence ?? a.NOM_AGENCE ?? a.name ?? ""),
  }));
}

