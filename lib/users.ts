import { apiClient } from "./apiClient";

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err: any = error as any;
  const data = err?.response?.data;
  const msg = data?.message;

  if (Array.isArray(msg)) {
    const joined = msg.map((m) => String(m)).join(" | ").trim();
    if (joined) return joined;
  }
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }
  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return fallback;
}

export interface UserDto {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  isActive: boolean;
  roleCode: string;
  roleName: string;
  agenceId: number | null;
  agenceName: string | null;
  zoneId: number | null;
  zoneName: string | null;
  cafCode: string | null;
}

/** Une agence supplémentaire pour un CAF multi-agences (en plus de agenceId/cafCode = agence principale). */
export interface CafAssignmentInput {
  agenceId: number;
  cafCode: string;
}

export interface CreateUserInput {
  name: string;
  username: string;
  password: string;
  email?: string | null;
  role: string;
  agenceId: number | null;
  zoneId: number | null;
  cafCode?: string | null;
  isActive?: boolean;
  additionalAssignments?: CafAssignmentInput[];
}

export interface UpdateUserInput {
  id: number;
  name?: string;
  username?: string;
  email?: string | null;
  role?: string;
  agenceId?: number | null;
  zoneId?: number | null;
  cafCode?: string | null;
  isActive?: boolean;
  additionalAssignments?: CafAssignmentInput[];
}

export async function fetchUsers(options?: { includeCaf?: boolean }): Promise<UserDto[]> {
  const params: any = {};
  if (options?.includeCaf) {
    params.includeCaf = true;
  }
  const response = await apiClient.get<unknown>("/users", { params });
  const data = response.data as any;
  if (!Array.isArray(data)) {
    throw new Error("Réponse inattendue du serveur pour /users (attendu: tableau).");
  }
  return (data as any[]).map((u) => ({
    id: Number(u.id),
    name: String(u.name ?? ""),
    username: String(u.username ?? ""),
    email: u.email != null ? String(u.email) : null,
    isActive: Boolean(u.isActive ?? true),
    roleCode: String(u.roleCode ?? ""),
    roleName: String(u.roleName ?? ""),
    agenceId: u.agenceId != null ? Number(u.agenceId) : null,
    agenceName: u.agenceName != null ? String(u.agenceName) : null,
    zoneId: u.zoneId != null ? Number(u.zoneId) : null,
    zoneName: u.zoneName != null ? String(u.zoneName) : null,
    cafCode: u.cafCode != null ? String(u.cafCode) : null,
  }));
}

export async function createUser(input: CreateUserInput): Promise<void> {
  try {
    await apiClient.post("/users", {
      name: input.name.trim(),
      username: input.username.trim(),
      password: input.password,
      email: input.email?.trim(),
      role: input.role.trim(),
      agenceId: input.agenceId,
      zoneId: input.zoneId,
      cafCode: input.cafCode ?? null,
      isActive: input.isActive ?? true,
      ...(input.additionalAssignments ? { additionalAssignments: input.additionalAssignments } : {}),
    });
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Impossible de créer l'utilisateur."),
    );
  }
}

export async function updateUser(input: UpdateUserInput): Promise<void> {
  try {
    await apiClient.put(`/users/${input.id}`, {
      name: input.name?.trim(),
      username: input.username?.trim(),
      email: input.email?.trim(),
      role: input.role?.trim(),
      agenceId: input.agenceId,
      zoneId: input.zoneId,
      cafCode: input.cafCode ?? null,
      isActive: input.isActive,
      ...(input.additionalAssignments ? { additionalAssignments: input.additionalAssignments } : {}),
    });
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Impossible de modifier l'utilisateur.",
      ),
    );
  }
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

/** Agences supplémentaires d'un CAF multi-agences (hors agence principale) — pour pré-remplir l'édition. */
export async function fetchExtraCafAssignments(userId: number): Promise<CafAssignmentInput[]> {
  const res = await apiClient.get<Array<{ agenceId: number | null; agenceName: string | null; cafCode: string }>>(
    `/users/${userId}/caf-assignments`,
  );
  return (res.data ?? [])
    .filter((r) => r.agenceId != null)
    .map((r) => ({ agenceId: r.agenceId as number, cafCode: r.cafCode }));
}

export async function resetUserPassword(id: number, password: string): Promise<void> {
  await apiClient.post(`/users/${id}/reset-password`, { password });
}

export async function resetAllUsersPasswords(password: string): Promise<void> {
  await apiClient.post(`/users/reset-all-passwords`, { password });
}

