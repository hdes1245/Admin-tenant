"use client";

import {
  exportTenantActivityLogs,
  fetchTenantActivityLogs,
  fetchTenantActivityStats,
} from "@/lib/activityLogs";
import { downloadCsv } from "@/lib/csvExport";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, ListChecks, ListFilter, ListOrdered, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CodeChip, HeaderButton, KpiTile, PageContainer, PageHeader, Panel, Th } from "@/components/ui/page-blocks";

const NAVY  = "#0F3B5C";
const STEEL = "#1E6091";

function formatDate(value: string): string {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("fr-FR"); }
  catch { return value; }
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["tenant-logs", page, action, startDate, endDate],
    queryFn: () => fetchTenantActivityLogs({ page, limit: 25, action, startDate, endDate }),
  });
  const statsQuery = useQuery({
    queryKey: ["tenant-logs-stats"],
    queryFn: () => fetchTenantActivityStats(30),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportTenantActivityLogs(5000),
  });

  const topActions = useMemo(() => {
    const data = statsQuery.data?.byAction ?? [];
    return [...data].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [statsQuery.data]);

  const total = logsQuery.data?.total ?? 0;
  const dateFilterCount = (startDate ? 1 : 0) + (endDate ? 1 : 0);
  const logs = logsQuery.data?.logs ?? [];

  return (
    <>
      <PageHeader icon={<ListChecks size={30} />} title="Logs & Audit" subtitle="Historique d'activite du tenant avec filtres et export.">
        <HeaderButton
          onClick={async () => {
            setExportError(null);
            try {
              const rows = await exportMutation.mutateAsync();
              downloadCsv(rows as unknown as Record<string, unknown>[], [
                { key: "id", label: "ID" }, { key: "action", label: "Action" }, { key: "description", label: "Description" },
                { key: "userName", label: "Utilisateur" }, { key: "userUsername", label: "Login" }, { key: "createdAt", label: "Date" },
              ], "activity-logs-tenant.csv");
            } catch (err) {
              setExportError(err instanceof Error ? err.message : "Export des logs impossible.");
            }
          }}
        >
          <Download size={16} /> Exporter CSV
        </HeaderButton>
      </PageHeader>

      <PageContainer>
        {exportError && <Alert severity="error" className="mb-4">{exportError}</Alert>}
        {logsQuery.isError && (
          <Alert severity="error" className="mb-4">
            Impossible de charger les logs. {logsQuery.error instanceof Error ? logsQuery.error.message : null}
          </Alert>
        )}

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile label="Total logs" value={total} accent={NAVY} icon={<ListChecks size={22} />} />
          <KpiTile label="Jours actifs (30j)" value={statsQuery.data?.byDay?.length ?? 0} accent={STEEL} icon={<CalendarDays size={22} />} />
          <KpiTile label="Actions distinctes" value={statsQuery.data?.byAction?.length ?? 0} accent="#7c3aed" icon={<ListOrdered size={22} />} />
        </div>

        <Panel className="mb-5 p-4 shadow-[0_1px_4px_rgba(15,59,92,0.04)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrer par action (ex: CREATE_USER)..."
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="pl-10 pr-9"
              />
              {action && (
                <button
                  type="button"
                  aria-label="Effacer le filtre"
                  onClick={() => { setAction(""); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-1 text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {topActions.length > 0 && (
              <Select
                aria-label="Raccourcis actions"
                value=""
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="w-auto min-w-44"
              >
                <option value="">Raccourcis actions</option>
                {topActions.map((x) => (<option key={x.action} value={x.action}>{x.action}</option>))}
              </Select>
            )}
            <Button
              size="sm"
              variant={showDateFilters ? "default" : "outline"}
              className={showDateFilters ? "hover:bg-[#1E6091] hover:opacity-100" : "text-muted-foreground"}
              onClick={() => setShowDateFilters((v) => !v)}
            >
              <ListFilter size={15} /> Dates
              {dateFilterCount > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{dateFilterCount}</span>}
            </Button>
            {(action || startDate || endDate) && (
              <Button
                size="sm"
                variant="ghost"
                className="font-medium text-muted-foreground"
                onClick={() => { setAction(""); setStartDate(""); setEndDate(""); setPage(1); }}
              >
                <X size={15} /> Effacer
              </Button>
            )}
          </div>
          {showDateFilters && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
              <Field label="Du" className="min-w-40">
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
              </Field>
              <Field label="Au" className="min-w-40">
                <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
              </Field>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <span>{total} log{total !== 1 ? "s" : ""}</span>
            <span className="text-border-strong">·</span>
            <span>Page {logsQuery.data?.page ?? 1}/{logsQuery.data?.totalPages ?? 1}</span>
            <span className="text-border-strong">·</span>
            <span>{statsQuery.data?.byDay?.length ?? 0} jours actifs (30j)</span>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0F3B5C]">
                {["ID", "Action", "Description", "Utilisateur", "Date"].map((label) => (
                  <Th key={label}>{label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-muted">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{log.id}</span>
                  </td>
                  <td className="px-4 py-2.5"><CodeChip>{log.action || "—"}</CodeChip></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.description || "—"}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">{log.userName || log.userUsername || "Systeme"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
              {!logsQuery.isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Aucun log trouve.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <PaginationBar
          page={logsQuery.data?.page ?? 1}
          totalPages={logsQuery.data?.totalPages ?? 1}
          total={total}
          pageSize={25}
          onPageChange={setPage}
        />
      </PageContainer>
    </>
  );
}
