"use client";

import { ReactNode, useRef } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";

// Mesure de la zone visible en pixels de MISE EN PAGE (clientHeight) : la mesure par défaut
// (getBoundingClientRect / borderBoxSize) renvoie des pixels visuels, faussés sous le zoom CSS
// de l'interface (--ui-zoom). Même raison pour la hauteur de ligne FIXE (pas de mesure dynamique).
function observeLayoutRect(instance: Virtualizer<HTMLDivElement, Element>, cb: (r: { width: number; height: number }) => void) {
  const el = instance.scrollElement;
  if (!el) return;
  const read = () => cb({ width: el.clientWidth, height: el.clientHeight });
  read();
  const ro = new ResizeObserver(read);
  ro.observe(el);
  return () => ro.disconnect();
}

interface VirtualTableProps<T> {
  items: T[];
  /** En-tête (<thead>…</thead>), figé en haut pendant le défilement (cellules `th` à fond opaque). */
  head: ReactNode;
  /** Doit rendre un <tr> dont la hauteur vaut EXACTEMENT `rowHeight`. */
  renderRow: (item: T, index: number) => ReactNode;
  rowHeight: number;
  /** Hauteur max de la zone défilante, ex. "calc(70vh / var(--ui-zoom))". */
  maxHeight: string;
  columns: number;
}

/**
 * Tableau virtualisé (TanStack Virtual) : seules les lignes visibles sont dans le DOM,
 * quel que soit le nombre d'éléments (16 000+ clients). Deux lignes « espaceur » conservent
 * la hauteur totale, donc la barre de défilement et la sémantique <table> restent intactes.
 */
export function VirtualTable<T>({ items, head, renderRow, rowHeight, maxHeight, columns }: VirtualTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    initialRect: { width: 0, height: 600 }, // avant la 1re mesure (SSR / premier rendu)
    observeElementRect: observeLayoutRect,
  });

  const rows = virtualizer.getVirtualItems();
  const padTop = rows.length ? rows[0].start : 0;
  const padBottom = virtualizer.getTotalSize() - (rows.length ? rows[rows.length - 1].end : 0);

  return (
    <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
        {head}
        <tbody>
          {padTop > 0 && <tr aria-hidden style={{ height: padTop }}><td colSpan={columns} className="border-0 p-0" /></tr>}
          {rows.map((v) => renderRow(items[v.index], v.index))}
          {padBottom > 0 && <tr aria-hidden style={{ height: padBottom }}><td colSpan={columns} className="border-0 p-0" /></tr>}
        </tbody>
      </table>
    </div>
  );
}
