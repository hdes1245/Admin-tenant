import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/** Bandeau de titre de page (dégradé de marque + filet vert). `children` = actions à droite. */
export function PageHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 border-b-[3px] border-[#3C8047] px-8 py-5 text-white"
      style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}
    >
      <span className="shrink-0 text-[#3C8047]">{icon}</span>
      <div className="min-w-[200px] flex-1">
        <h1 className="text-2xl font-bold leading-tight text-white">{title}</h1>
        {subtitle && <span className="text-xs text-white/55">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/** Bouton « contour blanc » pour les actions posées sur le bandeau (transmet sa ref : compatible Radix asChild). */
export const HeaderButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/60 bg-transparent px-4 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
HeaderButton.displayName = "HeaderButton";

/** Tuile KPI : pastille d'icône colorée + valeur + libellé, filet d'accent à gauche. */
export function KpiTile({ label, value, accent, icon }: { label: string; value: React.ReactNode; accent: string; icon: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-surface px-5 py-5 shadow-[0_1px_3px_rgba(15,59,92,0.05)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,59,92,0.1)]">
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-sm" style={{ background: accent }} />
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-white"
        style={{ background: accent, boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 27%, transparent)` }}
      >
        {icon}
      </span>
      <div>
        <div className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: accent }}>{value}</div>
        <div className="mt-1 text-xs font-medium leading-snug text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** Cellule d'en-tête de tableau (marine, majuscules). */
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("py-3.5 pl-4 text-left text-[10.5px] font-semibold uppercase tracking-[1px] text-white/55", className)} {...props} />;
}

/** Pastille de code/action (bleu acier). */
export function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-[5px] border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#1E6091]">
      {children}
    </span>
  );
}

/** Conteneur de page standard (largeur max + gouttières). */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1536px] px-6 py-6", className)} {...props} />;
}

/** Carte blanche à bordure fine (barre de filtres, panneaux). */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)} {...props} />;
}

const iconActionTones = {
  default: "text-muted-foreground hover:bg-blue-50 hover:text-[#1E6091]",
  danger: "text-muted-foreground hover:bg-red-50 hover:text-red-600",
  warn: "text-muted-foreground hover:bg-amber-50 hover:text-amber-700",
  success: "text-green-600 hover:bg-green-50",
  dangerStrong: "text-red-500 hover:bg-red-50",
} as const;

/** Bouton d'action de ligne : icône + infobulle + libellé accessible. */
export function IconAction({
  label,
  tone = "default",
  className,
  children,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> & { label: string; tone?: keyof typeof iconActionTones }) {
  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "flex size-7 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent disabled:cursor-default disabled:opacity-40",
          iconActionTones[tone],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Barre de progression fine (couleur libre). `track` = couleur du fond. */
export function ProgressBar({ value, color, track, className = "h-2" }: { value: number; color: string; track?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-full", !track && "bg-muted", className)} style={track ? { background: track } : undefined}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
