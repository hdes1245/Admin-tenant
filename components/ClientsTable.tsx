"use client";

import { ClientDto } from "@/lib/clients";
import { MapPinned, Pencil, Phone, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Panel, Th } from "@/components/ui/page-blocks";

interface ClientsTableProps {
  clients: ClientDto[];
  loading?: boolean;
  onEdit?: (client: ClientDto) => void;
  onDelete?: (client: ClientDto) => void;
  selectedIds?: number[];
  onToggleSelect?: (clientId: number) => void;
  onToggleSelectAll?: (checked: boolean) => void;
  /** Affiche les colonnes de gestion (sélection, éditer, supprimer). Faux = lecture seule. */
  canManage?: boolean;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function ClientsTable({
  clients,
  loading,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  canManage = true,
}: ClientsTableProps) {
  const selectedSet = new Set(selectedIds);
  const allSelected = clients.length > 0 && clients.every((c) => selectedSet.has(c.id));
  const someSelected = clients.some((c) => selectedSet.has(c.id));
  const columns = ["Client", "Code client", "Agence", "CAF attribue", "Contact", ...(canManage ? [""] : [])];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      <Panel className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#0F3B5C]">
              {canManage && (
                <Th className="w-12">
                  <Checkbox
                    aria-label="Tout sélectionner"
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  />
                </Th>
              )}
              <Th className="w-[52px]" />
              {columns.map((label, i) => (
                <Th key={i} className={i === 5 ? "pr-5 text-right" : ""}>{label}</Th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <Spinner className="text-[#1E6091]" /> Chargement des clients...
                  </div>
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="flex size-[52px] items-center justify-center rounded-full bg-muted text-border-strong">
                      <MapPinned size={24} />
                    </span>
                    <span className="text-sm text-muted-foreground">Aucun client trouve.</span>
                  </div>
                </td>
              </tr>
            ) : (
              clients.map((client, idx) => {
                const isSelected = selectedSet.has(client.id);
                const cell = `border-b border-border pl-4 ${isSelected ? "bg-[rgba(30,96,145,0.10)]" : "bg-surface"}`;
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    style={{ display: "table-row" }}
                    className="group"
                  >
                    {canManage && (
                      <td className={`py-2 transition-colors ${cell} border-l-[3px] ${isSelected ? "border-l-[#1E6091]" : "border-l-transparent"}`}>
                        <Checkbox aria-label={`Sélectionner ${client.name}`} checked={isSelected} onChange={() => onToggleSelect?.(client.id)} />
                      </td>
                    )}

                    <td className={`py-2 ${cell}`}>
                      <span className="flex size-[34px] items-center justify-center rounded-full bg-[#0F3B5C] text-[13px] font-bold tracking-wide text-white">
                        {initials(client.name)}
                      </span>
                    </td>

                    <td className={`py-3 ${cell}`}>
                      <span className="text-sm font-semibold text-foreground">{client.name}</span>
                    </td>

                    <td className={`py-2 ${cell}`}>
                      <span className="inline-flex rounded-[5px] border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-[#1E6091]">
                        {client.codeClient}
                      </span>
                    </td>

                    <td className={`py-2 text-[13px] ${cell} ${client.agenceClient ? "text-foreground" : "text-border-strong"}`}>
                      {client.agenceClient ?? "—"}
                    </td>

                    <td className={`py-2 ${cell}`}>
                      {client.cafName || client.cafCode ? (
                        <div>
                          <div className="text-sm font-semibold leading-tight text-foreground">{client.cafName ?? client.cafCode}</div>
                          {client.cafName && client.cafCode && <div className="text-xs text-muted-foreground">{client.cafCode}</div>}
                        </div>
                      ) : (
                        <span className="text-sm text-border-strong">—</span>
                      )}
                    </td>

                    <td className={`py-2 ${cell}`}>
                      {client.contactInfo ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone size={14} /> {client.contactInfo}
                        </span>
                      ) : (
                        <span className="text-sm text-border-strong">—</span>
                      )}
                    </td>

                    {canManage && (
                      <td className={`py-2 pr-4 ${cell}`}>
                        <div className="flex justify-end gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                          <Tooltip title="Modifier">
                            <button
                              type="button"
                              aria-label="Modifier"
                              onClick={() => onEdit?.(client)}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]"
                            >
                              <Pencil size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <button
                              type="button"
                              aria-label="Supprimer"
                              onClick={() => onDelete?.(client)}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </Panel>

      {!loading && clients.length > 0 && (
        <div className="mt-3 flex justify-end text-xs text-muted-foreground">
          {clients.length} client{clients.length > 1 ? "s" : ""}
        </div>
      )}
    </motion.div>
  );
}
