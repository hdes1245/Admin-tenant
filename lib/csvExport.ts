/**
 * Génère une ligne CSV en échappant les guillemets et les retours à la ligne.
 */
function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  /** Optionnel : formater la valeur pour l'export */
  format?: (value: unknown, row: T) => string;
}

/**
 * Construit le contenu CSV (UTF-8 avec BOM pour Excel) et déclenche le téléchargement.
 */
export function downloadCsv<T extends object>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((col) => {
        const key = col.key as string;
        const raw = key.includes(".") ? key.split(".").reduce((o: any, k) => o?.[k], row) : (row as any)[key];
        const value = col.format ? col.format(raw, row) : raw;
        return escapeCsvCell(value);
      })
      .join(",")
  );
  const csv = [header, ...body].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
