export type AlertOperator = "lt" | "gt";
export type AlertSeverity = "warning" | "critical";

export interface AlertThreshold {
  id:          string;
  label:       string;
  description: string;
  key:         string;
  operator:    AlertOperator;
  value:       number;
  enabled:     boolean;
  severity:    AlertSeverity;
  unit:        string;
  min:         number;
  max:         number;
  step:        number;
}

export interface TriggeredAlert {
  id:           string;
  label:        string;
  message:      string;
  severity:     AlertSeverity;
  currentValue: number;
  threshold:    number;
  operator:     AlertOperator;
  unit:         string;
}

export const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    id: "taux_resolution_min",
    label: "Taux de résolution tickets",
    description: "Alerte si le taux de résolution descend sous le seuil",
    key: "tauxResolution", operator: "lt", value: 60, enabled: true,
    severity: "warning", unit: "%", min: 0, max: 100, step: 5,
  },
  {
    id: "agences_sans_caf",
    label: "Agences sans CAF",
    description: "Alerte si des agences n'ont aucun agent terrain affecté",
    key: "agencesSansCaf", operator: "gt", value: 0, enabled: true,
    severity: "warning", unit: "", min: 0, max: 20, step: 1,
  },
  {
    id: "tendance_negative",
    label: "Tendance activité (chute)",
    description: "Alerte si l'activité chute de plus de X% sur la période",
    key: "tendance", operator: "lt", value: -20, enabled: true,
    severity: "critical", unit: "%", min: -80, max: -1, step: 5,
  },
  {
    id: "clients_min",
    label: "Nombre de clients",
    description: "Alerte si le portefeuille clients total est trop faible",
    key: "clients", operator: "lt", value: 10, enabled: false,
    severity: "warning", unit: "", min: 0, max: 10000, step: 10,
  },
  {
    id: "cafs_min",
    label: "Nombre de CAFs",
    description: "Alerte si le nombre d'agents terrain est insuffisant",
    key: "cafs", operator: "lt", value: 5, enabled: false,
    severity: "warning", unit: "", min: 0, max: 500, step: 1,
  },
  {
    id: "locations_min",
    label: "Localisations GPS",
    description: "Alerte si les captures GPS sont trop basses sur la période",
    key: "locations", operator: "lt", value: 100, enabled: false,
    severity: "warning", unit: "", min: 0, max: 10000, step: 50,
  },
  {
    id: "total_tickets_max",
    label: "Tickets ouverts (volume)",
    description: "Alerte si le volume de tickets total dépasse un seuil critique",
    key: "totalTickets", operator: "gt", value: 50, enabled: false,
    severity: "critical", unit: "", min: 0, max: 500, step: 5,
  },
];

const LS_KEY = "geotrust_alert_thresholds_v1";

export function loadThresholds(): AlertThreshold[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (!raw) return DEFAULT_THRESHOLDS;
    const saved = JSON.parse(raw) as Array<{ id: string; value: number; enabled: boolean; severity: AlertSeverity }>;
    return DEFAULT_THRESHOLDS.map((def) => {
      const match = saved.find((s) => s.id === def.id);
      if (!match) return def;
      return { ...def, value: match.value ?? def.value, enabled: match.enabled ?? def.enabled, severity: match.severity ?? def.severity };
    });
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveThresholds(thresholds: AlertThreshold[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      LS_KEY,
      JSON.stringify(thresholds.map(({ id, value, enabled, severity }) => ({ id, value, enabled, severity })))
    );
  } catch { /* noop */ }
}

export function computeTriggeredAlerts(
  thresholds: AlertThreshold[],
  values: Record<string, number>
): TriggeredAlert[] {
  const alerts: TriggeredAlert[] = [];
  for (const t of thresholds) {
    if (!t.enabled) continue;
    const current = values[t.key];
    if (current === undefined || current === null || isNaN(current)) continue;
    const triggered =
      (t.operator === "lt" && current < t.value) ||
      (t.operator === "gt" && current > t.value);
    if (!triggered) continue;
    const opLabel = t.operator === "lt" ? "inférieur à" : "supérieur à";
    alerts.push({
      id:           t.id,
      label:        t.label,
      message:      `${t.label} est ${opLabel} ${t.value}${t.unit} (valeur actuelle : ${current}${t.unit})`,
      severity:     t.severity,
      currentValue: current,
      threshold:    t.value,
      operator:     t.operator,
      unit:         t.unit,
    });
  }
  return alerts.sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));
}
