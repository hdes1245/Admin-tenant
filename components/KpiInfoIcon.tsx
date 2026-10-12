"use client";

import { Info } from "lucide-react";

/**
 * Petite icône "i" à poser en absolute dans le coin haut-droit d'une carte
 * KPI — la carte parente doit avoir `position: "relative"`. Au survol (ou au focus
 * clavier), affiche un résumé de ce que représente le KPI. Infobulle en CSS pur.
 */
export function KpiInfoIcon({ text, color = "inherit" }: { text: string; color?: string }) {
  return (
    <span
      tabIndex={0}
      aria-label={text}
      style={{ color }}
      className="group absolute right-2 top-2 inline-flex size-[18px] cursor-help items-center justify-center opacity-55 transition-opacity hover:opacity-100 focus-visible:opacity-100"
    >
      <Info size={15} />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-50 mb-1.5 hidden w-max max-w-64 rounded-md bg-slate-800 px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-hover:block group-focus-visible:block"
      >
        {text}
      </span>
    </span>
  );
}
