import { apiClient } from "./apiClient";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed" | "waiting_user";

export interface TicketCommentDto {
  id: number;
  content: string;
  authorName: string | null;
  authorId: number | null;
  authorRole: string | null;
  createdAt: string;
}

export interface TicketAttachmentDto {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  uploaderName: string | null;
  createdAt: string;
}

export interface TicketDto {
  id: number;
  title: string;
  description: string;
  severity: string;
  status: TicketStatus;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  requesterName: string | null;
  requesterEmail: string | null;
  itResponse: string | null;
  escalated: boolean;
  escalatedAt: string | null;
  escalationNote: string | null;
  escalatedByName: string | null;
  assignedAdminName: string | null;
}

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

function mapTicket(raw: any): TicketDto {
  const requester = raw.requester ?? {};
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    severity: String(raw.severity ?? "moyen"),
    status: (String(raw.status ?? "open").toLowerCase() as TicketStatus) ?? "open",
    category: raw.category != null ? String(raw.category) : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.created_at ?? new Date().toISOString()),
    requesterName: raw.requesterName != null ? String(raw.requesterName)
      : requester.name != null ? String(requester.name) : null,
    requesterEmail: raw.requesterEmail != null ? String(raw.requesterEmail)
      : requester.email != null ? String(requester.email) : null,
    itResponse: raw.itResponse != null ? String(raw.itResponse) : null,
    escalated: raw.escalated === true,
    escalatedAt: raw.escalatedAt != null ? String(raw.escalatedAt) : null,
    escalationNote: raw.escalationNote != null ? String(raw.escalationNote) : null,
    escalatedByName: raw.escalatedByName != null ? String(raw.escalatedByName) : null,
    assignedAdminName: raw.assignedAdminName != null ? String(raw.assignedAdminName) : null,
  };
}

export async function escalateTicket(ticketId: number, note?: string): Promise<TicketDto> {
  try {
    const resp = await apiClient.post<unknown>(`/support-tickets/${ticketId}/escalate`, { note: note?.trim() || undefined });
    return mapTicket((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'escalader le ticket."));
  }
}

export async function fetchMyItTickets(): Promise<TicketDto[]> {
  const resp = await apiClient.get<unknown>("/support-tickets/my-it");
  const data = resp.data as any;
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return list.map(mapTicket);
}

// Accessible à tous les rôles (y compris superviseurs) — contrairement à
// /support-tickets/my-it qui est réservé à admin_tenant.
export async function fetchMyTickets(): Promise<TicketDto[]> {
  const resp = await apiClient.get<unknown>("/support-tickets/my");
  const data = resp.data as any;
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return list.map(mapTicket);
}

export async function fetchTenantTickets(): Promise<TicketDto[]> {
  const resp = await apiClient.get<unknown>("/support-tickets/tenant");
  const data = resp.data as any;
  const list: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
    ? data.data
    : [];
  return list.map(mapTicket);
}

export async function createTicket(input: {
  title: string;
  description: string;
  severity: string;
  category?: string | null;
}): Promise<TicketDto> {
  try {
    const resp = await apiClient.post<unknown>("/support-tickets", {
      title: input.title.trim(),
      description: input.description.trim(),
      severity: input.severity.trim().toLowerCase(),
      category: input.category?.trim() || undefined,
    });
    return mapTicket((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de créer le ticket."));
  }
}

export async function updateTicketStatus(input: {
  id: number;
  status: TicketStatus;
  response?: string | null;
}): Promise<TicketDto> {
  try {
    const resp = await apiClient.patch<unknown>(
      `/support-tickets/${input.id}/status`,
      {
        status: input.status,
        response: input.response?.trim() || undefined,
      }
    );
    return mapTicket((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de mettre à jour le ticket."),
    );
  }
}

export async function reopenTicket(ticketId: number): Promise<TicketDto> {
  try {
    const resp = await apiClient.post<unknown>(`/support-tickets/${ticketId}/reopen`);
    return mapTicket((resp as any).data ?? resp);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de rouvrir le ticket."));
  }
}

export async function fetchTicketComments(ticketId: number): Promise<TicketCommentDto[]> {
  const resp = await apiClient.get<unknown>(`/support-tickets/${ticketId}/comments`);
  const data = resp.data as any;
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return list.map((c) => ({
    id: Number(c.id),
    content: String(c.content ?? ""),
    authorName: c.authorName != null ? String(c.authorName) : null,
    authorId: c.authorId != null ? Number(c.authorId) : null,
    authorRole: c.authorRole != null ? String(c.authorRole) : null,
    createdAt: String(c.createdAt ?? new Date().toISOString()),
  }));
}

export async function addTicketComment(ticketId: number, content: string): Promise<TicketCommentDto> {
  try {
    const resp = await apiClient.post<unknown>(`/support-tickets/${ticketId}/comments`, { content: content.trim() });
    const c = (resp as any).data ?? resp;
    return {
      id: Number(c.id),
      content: String(c.content ?? ""),
      authorName: c.authorName != null ? String(c.authorName) : null,
      authorId: c.authorId != null ? Number(c.authorId) : null,
      authorRole: c.authorRole != null ? String(c.authorRole) : null,
      createdAt: String(c.createdAt ?? new Date().toISOString()),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible d'envoyer le commentaire."));
  }
}

export async function fetchTicketAttachments(ticketId: number): Promise<TicketAttachmentDto[]> {
  const resp = await apiClient.get<unknown>(`/support-tickets/${ticketId}/attachments`);
  const data = resp.data as any;
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return list.map((a) => ({
    id: Number(a.id),
    originalName: String(a.originalName ?? "fichier"),
    mimeType: String(a.mimeType ?? "application/octet-stream"),
    size: Number(a.size ?? 0),
    uploaderName: a.uploaderName != null ? String(a.uploaderName) : null,
    createdAt: String(a.createdAt ?? new Date().toISOString()),
  }));
}

export async function uploadTicketAttachment(ticketId: number, file: File): Promise<TicketAttachmentDto> {
  try {
    const form = new FormData();
    form.append("file", file);
    const resp = await apiClient.post<unknown>(`/support-tickets/${ticketId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const a = (resp as any).data ?? resp;
    return {
      id: Number(a.id),
      originalName: String(a.originalName ?? file.name),
      mimeType: String(a.mimeType ?? file.type),
      size: Number(a.size ?? file.size),
      uploaderName: a.uploaderName != null ? String(a.uploaderName) : null,
      createdAt: String(a.createdAt ?? new Date().toISOString()),
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Impossible de téléverser la pièce jointe."));
  }
}

export function attachmentDownloadUrl(ticketId: number, attachmentId: number): string {
  const base = (apiClient.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/support-tickets/${ticketId}/attachments/${attachmentId}/download`;
}

