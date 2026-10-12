"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseProps<T> {
  options: T[];
  getKey: (o: T) => string | number;
  /** Texte affiché dans le champ pour l'option sélectionnée. */
  getLabel: (o: T) => string;
  /** Filtre personnalisé (par défaut : sous-chaîne du libellé). */
  filter?: (o: T, query: string) => boolean;
  renderOption?: (o: T) => React.ReactNode;
  placeholder?: string;
  className?: string;
  /** true : la liste s'insère dans le flux (à utiliser dans un dialogue, dont le débordement est masqué). */
  inline?: boolean;
  emptyText?: string;
}

/** Liste filtrable + navigation clavier, partagée par Combobox et MultiCombobox. */
function useCombo<T>(p: BaseProps<T>, onPick: (o: T) => void) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return p.options;
    return p.options.filter((o) => (p.filter ? p.filter(o, q) : p.getLabel(o).toLowerCase().includes(q)));
  }, [p, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && filtered[active]) { e.preventDefault(); onPick(filtered[active]); }
    else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
  };

  const list = open && (
    <ul
      role="listbox"
      className={cn(
        "z-50 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg",
        p.inline ? "mt-1" : "absolute left-0 right-0 top-full mt-1",
      )}
    >
      {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{p.emptyText ?? "Aucun résultat"}</li>}
      {filtered.map((o, i) => (
        <li
          key={p.getKey(o)}
          role="option"
          aria-selected={i === active}
          onPointerDown={(e) => { e.preventDefault(); onPick(o); }}
          onMouseEnter={() => setActive(i)}
          className={cn("cursor-pointer px-3 py-1.5 text-sm", i === active && "bg-muted")}
        >
          {p.renderOption ? p.renderOption(o) : p.getLabel(o)}
        </li>
      ))}
    </ul>
  );

  return { open, setOpen, query, setQuery, setActive, rootRef, onKeyDown, list };
}

const fieldCls =
  "w-full rounded-lg border border-border-strong bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary";

/** Équivalent « Autocomplete » à sélection unique. */
export function Combobox<T>(props: BaseProps<T> & { value: T | null; onChange: (v: T | null) => void }) {
  const { value, onChange, placeholder, className } = props;
  const c = useCombo(props, (o) => { onChange(o); c.setOpen(false); c.setQuery(""); });
  return (
    <div ref={c.rootRef} className={cn("relative", className)}>
      <div className={cn(fieldCls, "flex h-9 items-center gap-1")}>
        <input
          role="combobox"
          aria-expanded={c.open}
          value={c.open ? c.query : value ? props.getLabel(value) : ""}
          placeholder={placeholder}
          onFocus={() => { c.setOpen(true); c.setActive(0); }}
          onChange={(e) => { c.setQuery(e.target.value); c.setOpen(true); c.setActive(0); }}
          onKeyDown={c.onKeyDown}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <button type="button" aria-label="Effacer" onClick={() => { onChange(null); c.setQuery(""); }}
            className="cursor-pointer rounded-full border-0 bg-transparent p-0.5 text-muted-foreground hover:bg-muted">
            <X size={15} />
          </button>
        )}
      </div>
      {c.list}
    </div>
  );
}

/** Équivalent « Autocomplete multiple » : sélection sous forme de pastilles. */
export function MultiCombobox<T>(props: BaseProps<T> & { values: T[]; onChange: (v: T[]) => void }) {
  const { values, onChange, placeholder, className, getKey } = props;
  const c = useCombo(props, (o) => {
    const has = values.some((v) => getKey(v) === getKey(o));
    onChange(has ? values.filter((v) => getKey(v) !== getKey(o)) : [...values, o]);
    c.setQuery("");
  });
  return (
    <div ref={c.rootRef} className={cn("relative", className)}>
      <div className={cn(fieldCls, "flex min-h-9 flex-wrap items-center gap-1 py-1")}>
        {values.map((v) => (
          <span key={getKey(v)} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
            {props.getLabel(v)}
            <button type="button" aria-label="Retirer" onClick={() => onChange(values.filter((x) => getKey(x) !== getKey(v)))}
              className="cursor-pointer border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          role="combobox"
          aria-expanded={c.open}
          value={c.query}
          placeholder={values.length ? "" : placeholder}
          onFocus={() => { c.setOpen(true); c.setActive(0); }}
          onChange={(e) => { c.setQuery(e.target.value); c.setOpen(true); c.setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c.query && values.length) onChange(values.slice(0, -1));
            else c.onKeyDown(e);
          }}
          className="h-6 min-w-24 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {c.list}
    </div>
  );
}
