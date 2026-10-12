"use client";

import { memo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

/** Pages affichées : 1 … p-1 p p+1 … N (les « … » sont des null). */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}

const cell =
  "inline-flex border-0 bg-transparent h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default disabled:opacity-40";

// Migré de MUI vers Tailwind (premier composant du chantier) : mêmes props, même rendu général,
// couleurs via les variables CSS existantes (le mode nuit suit sans code supplémentaire).
export const PaginationBar = memo(function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationBarProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {total === 0 ? "Aucun résultat" : `${from}–${to} sur ${total}`}
        </span>
        {onPageSizeChange && (
          <select
            aria-label="Lignes par page"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-7 cursor-pointer rounded-md border border-border-strong bg-surface px-2 text-xs text-foreground outline-none focus-visible:border-primary"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        )}
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" aria-label="Première page" className={cn(cell, "text-foreground hover:bg-muted")} disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft size={14} />
        </button>
        <button type="button" aria-label="Page précédente" className={cn(cell, "text-foreground hover:bg-muted")} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={14} />
        </button>
        {pageWindow(page, totalPages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={n}
              type="button"
              aria-current={n === page ? "page" : undefined}
              onClick={() => onPageChange(n)}
              className={cn(cell, n === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" aria-label="Page suivante" className={cn(cell, "text-foreground hover:bg-muted")} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={14} />
        </button>
        <button type="button" aria-label="Dernière page" className={cn(cell, "text-foreground hover:bg-muted")} disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight size={14} />
        </button>
      </nav>
    </div>
  );
});
