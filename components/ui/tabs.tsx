"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Barre d'onglets (soulignement en CSS pur, donc insensible au zoom de l'interface — l'indicateur
 * MUI, positionné en JS, se décalait). `tabs` : libellés (ReactNode accepté).
 */
export function TabBar({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: React.ReactNode[];
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto", className)}>
      {tabs.map((label, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={value === i}
          onClick={() => onChange(i)}
          className={cn(
            "min-h-12 shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent px-4 text-[13px] font-semibold transition-colors",
            value === i ? "text-accent shadow-[inset_0_-2.5px_0_0_currentColor]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Sélecteur segmenté (équivalent ToggleButtonGroup exclusif). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" className={cn("inline-flex overflow-hidden rounded-lg border border-border-strong", className)}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 cursor-pointer border-0 px-4 text-xs font-semibold transition-colors",
            i > 0 && "border-l border-border-strong",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
