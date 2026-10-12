"use client";

import { Agence, AgenceStats } from "@/lib/agences";
import { Building2, Map as MapIcon, Pencil, Trash2, Users, Wallet, User } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { PaginationBar } from "./PaginationBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { CodeChip, Panel, Th } from "@/components/ui/page-blocks";

interface AgencesTableProps {
  agences: Agence[];
  loading?: boolean;
  onEdit?: (agence: Agence) => void;
  onDelete?: (agence: Agence) => void;
  selectedIds?: number[];
  onToggleSelect?: (agenceId: number) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: number[]) => void;
  stats?: Map<number, AgenceStats>;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export function AgencesTable({
  agences,
  loading,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  stats,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: AgencesTableProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const totalPages = Math.max(1, Math.ceil(agences.length / pageSize));
  const paginated = agences.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = useMemo(() => paginated.map((a) => a.id), [paginated]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  const COLS = ["Code agence", "Nom de l'agence", "Zone", "Clients", "CAFs", "Utilisateurs", ""];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
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
                <Th className="w-[52px]" />
                {COLS.map((label, i) => (
                  <Th
                    key={i}
                    className={i === COLS.length - 1 ? "pr-5 text-right" : i >= 3 && i <= 5 ? "text-center" : ""}
                  >
                    {label}
                  </Th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLS.length + 2} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                      <Spinner className="text-[#1E6091]" /> Chargement des agences...
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong">
                        <Building2 size={24} />
                      </span>
                      <span className="text-sm text-muted-foreground">Aucune agence trouvee.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((agence, idx) => {
                  const isSelected = selectedSet.has(agence.id);
                  const s = stats?.get(agence.id);
                  const cell = `border-b border-border py-2 ${isSelected ? "bg-[rgba(30,96,145,0.10)]" : "bg-surface"}`;
                  return (
                    <motion.tr
                      key={agence.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: idx * 0.015 }}
                      style={{ display: "table-row" }}
                      className="group"
                    >
                      <td className={`pl-4 transition-colors ${cell} border-l-[3px] ${isSelected ? "border-l-[#1E6091]" : "border-l-transparent"}`}>
                        <Checkbox aria-label={`Sélectionner ${agence.name}`} checked={isSelected} onChange={() => onToggleSelect?.(agence.id)} />
                      </td>

                      <td className={`pl-4 ${cell}`}>
                        <span className="flex size-[34px] items-center justify-center rounded-full bg-[#0F3B5C] text-[13px] font-bold text-white">
                          {agence.name?.charAt(0).toUpperCase() ?? "?"}
                        </span>
                      </td>

                      <td className={`pl-4 ${cell}`}><CodeChip>{agence.code}</CodeChip></td>

                      <td className={`pl-4 ${cell}`}>
                        <span className="text-sm font-semibold text-foreground">{agence.name}</span>
                      </td>

                      <td className={`pl-4 ${cell}`}>
                        {agence.zoneName ? (
                          <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                            <MapIcon size={14} className="text-muted-foreground" /> {agence.zoneName}
                          </span>
                        ) : (
                          <span className="text-sm text-border-strong">—</span>
                        )}
                      </td>

                      {/* Stats columns */}
                      {[
                        { icon: <Users size={13} />, val: s?.nbClients, color: "#1E6091" },
                        { icon: <Wallet size={13} />, val: s?.nbCafs, color: "#7c3aed" },
                        { icon: <User size={13} />, val: s?.nbUsers, color: "#059669" },
                      ].map((stat, si) => (
                        <td key={si} className={`pl-4 text-center ${cell}`}>
                          {stats === undefined ? (
                            <span className="inline-block h-4 w-7 rounded bg-muted" />
                          ) : (stat.val ?? 0) > 0 ? (
                            <span
                              className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-bold"
                              style={{ background: `color-mix(in srgb, ${stat.color} 10%, transparent)`, color: stat.color }}
                            >
                              {stat.icon} {stat.val}
                            </span>
                          ) : (
                            <span className="text-xs text-border-strong">—</span>
                          )}
                        </td>
                      ))}

                      <td className={`pl-4 pr-4 ${cell}`}>
                        <div className="flex justify-end gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                          <Tooltip title="Modifier">
                            <button
                              type="button"
                              aria-label="Modifier"
                              onClick={() => onEdit?.(agence)}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]"
                            >
                              <Pencil size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <button
                              type="button"
                              aria-label="Supprimer"
                              onClick={() => onDelete?.(agence)}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {!loading && agences.length > 0 && (
          <PaginationBar page={page} totalPages={totalPages} total={agences.length} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        )}
      </motion.div>
    </div>
  );
}
