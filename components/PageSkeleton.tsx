"use client";

import { Skeleton } from "@/components/ui/skeleton";

const onBanner = "bg-white/10";

export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 sm:p-6">
      {/* Bandeau */}
      <div
        className="relative mb-6 overflow-hidden rounded-xl p-6"
        style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[#3C8047]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className={`size-12 rounded-full ${onBanner}`} />
            <div className="space-y-1.5">
              <Skeleton className="h-[22px] w-40 bg-white/15" />
              <Skeleton className="h-3.5 w-56 bg-white/10" />
            </div>
          </div>
          <Skeleton className={`h-[38px] w-[130px] rounded-lg ${onBanner}`} />
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[60px] w-[120px] shrink-0 rounded-lg bg-white/10" />
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-6 bg-[#0F3B5C] px-4 py-3.5">
          <Skeleton className="size-5 shrink-0 rounded-sm bg-white/10" />
          {[80, 100, 70, 90, 80, 60, 50].map((w, i) => (
            <Skeleton key={i} className="h-3 bg-white/10" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`flex items-center gap-6 px-4 py-3 ${i < rows - 1 ? "border-b border-border" : ""}`}>
            <Skeleton className="size-5 shrink-0 rounded-sm" />
            <div className="flex w-[140px] shrink-0 items-center gap-3">
              <Skeleton className="size-[34px] rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-[13px] w-4/5" />
                <Skeleton className="h-[11px] w-3/5" />
              </div>
            </div>
            {[100, 70, 90, 80, 60, 50].map((w, j) => (
              <Skeleton key={j} className="h-[13px]" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
