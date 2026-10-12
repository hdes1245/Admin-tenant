"use client";

import { UserDto } from "@/lib/users";
import { KeyRound, Pencil, Search, ToggleLeft, ToggleRight, Trash2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "./PaginationBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { IconAction, Panel, Th } from "@/components/ui/page-blocks";

interface UsersTableProps {
  users: UserDto[];
  loading?: boolean;
  onEdit?: (user: UserDto) => void;
  onDelete?: (user: UserDto) => void;
  onResetPassword?: (user: UserDto) => void;
  onToggleActive?: (user: UserDto) => void;
  selectedIds?: number[];
  onToggleSelect?: (userId: number) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: number[]) => void;
  currentUserId?: number;
}

function roleLabel(user: UserDto): string {
  const raw = user.roleName || user.roleCode;
  return raw && raw.trim().length > 0 ? raw : user.roleCode || "Inconnu";
}

function userInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function UsersTable({
  users,
  loading,
  onEdit,
  onDelete,
  onResetPassword,
  onToggleActive,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}: UsersTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.roleName || u.roleCode).toLowerCase().includes(q) ||
      (u.agenceName ?? "").toLowerCase().includes(q) ||
      (u.zoneName ?? "").toLowerCase().includes(q) ||
      (u.cafCode ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  useEffect(() => { setPage(1); }, [search, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = useMemo(() => paginated.map((u) => u.id), [paginated]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <div className="relative w-full max-w-[460px]">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, login, role, agence, code CAF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface pl-10"
          />
        </div>
        {search && (
          <span className="text-xs font-medium text-muted-foreground">
            {filtered.length} resultat{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        <Panel className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0F3B5C]">
                <Th className="w-12">
                  <Checkbox
                    aria-label="Tout sélectionner"
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked, visibleIds)}
                  />
                </Th>
                {["Utilisateur", "Login", "Role", "Agence", "Zone", "Code CAF", "Statut", ""].map((label, i) => (
                  <Th key={i} className={i === 7 ? "pr-5 text-right" : ""}>{label}</Th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                      <Spinner className="text-[#1E6091]" /> Chargement...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong"><Users size={24} /></span>
                      <span className="text-sm text-muted-foreground">{search ? "Aucun utilisateur ne correspond." : "Aucun utilisateur enregistre."}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((user, idx) => {
                  const isSelected = selectedSet.has(user.id);
                  const cell = `border-b border-border pl-4 ${isSelected ? "bg-[rgba(30,96,145,0.10)]" : "bg-surface"}`;
                  const isAdminTenant = (user.roleCode || user.roleName || "").toLowerCase() === "admin_tenant";
                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: idx * 0.015 }}
                      style={{ display: "table-row" }}
                      className="group"
                    >
                      <td className={`py-2 transition-colors ${cell} border-l-[3px] ${isSelected ? "border-l-[#1E6091]" : "border-l-transparent"}`}>
                        <Checkbox aria-label={`Sélectionner ${user.name}`} checked={isSelected} onChange={() => onToggleSelect?.(user.id)} />
                      </td>

                      {/* Utilisateur */}
                      <td className={`py-3 ${cell}`}>
                        <div className="flex items-center gap-3">
                          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#0F3B5C] text-xs font-bold tracking-wide text-white">
                            {userInitials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-tight text-foreground">{user.name}</div>
                            {user.email && <div className="text-[11px] text-muted-foreground">{user.email}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Login */}
                      <td className={`py-2 font-mono text-[12.5px] font-medium text-muted-foreground ${cell}`}>{user.username}</td>

                      {/* Role */}
                      <td className={`py-2 ${cell}`}>
                        <span className="inline-flex whitespace-nowrap rounded-[5px] border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-foreground">
                          {roleLabel(user)}
                        </span>
                      </td>

                      {/* Agence */}
                      <td className={`py-2 text-[13px] ${cell} ${user.agenceName ? "text-foreground" : "text-border-strong"}`}>{user.agenceName ?? "—"}</td>

                      {/* Zone */}
                      <td className={`py-2 text-[13px] ${cell} ${user.zoneName ? "text-foreground" : "text-border-strong"}`}>{user.zoneName ?? "—"}</td>

                      {/* Code CAF */}
                      <td className={`py-2 ${cell}`}>
                        {user.cafCode ? (
                          <span className="inline-flex rounded-[5px] border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#1E6091]">{user.cafCode}</span>
                        ) : (
                          <span className="text-sm text-border-strong">—</span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className={`py-2 ${cell}`}>
                        <span className="flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-border"}`} />
                          <span className={`text-[11.5px] font-semibold ${user.isActive ? "text-green-700" : "text-muted-foreground"}`}>{user.isActive ? "Actif" : "Inactif"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className={`py-2 pr-4 ${cell}`}>
                        <div className="flex justify-end gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                          <IconAction label={user.isActive ? "Desactiver" : "Activer"} tone={user.isActive ? "dangerStrong" : "success"} onClick={() => onToggleActive?.(user)}>
                            {user.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                          </IconAction>
                          <IconAction label="Reinitialiser le mot de passe" tone="warn" onClick={() => onResetPassword?.(user)}>
                            <KeyRound size={16} />
                          </IconAction>
                          {isAdminTenant ? (
                            <IconAction label="Modification reservee aux admins GeoTrust" disabled>
                              <Pencil size={16} />
                            </IconAction>
                          ) : (
                            <IconAction label="Modifier" onClick={() => onEdit?.(user)}>
                              <Pencil size={16} />
                            </IconAction>
                          )}
                          <IconAction label="Supprimer" tone="danger" onClick={() => onDelete?.(user)}>
                            <Trash2 size={16} />
                          </IconAction>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {!loading && filtered.length > 0 && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </motion.div>
    </div>
  );
}
