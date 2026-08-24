import { apiClient } from './apiClient';

export type CaptureFieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "photo";

export interface LocationType {
  id:         number;
  code:       string;
  name:       string;
  sort_order: number;
  icon?:      string;
  color?:     string;
}

export interface CaptureExtraField {
  id:          string;
  type:        CaptureFieldType;
  label:       string;
  placeholder: string;
  required:    boolean;
  options:     string[];
  helpText:    string;
  enabled:     boolean;
  sortOrder:   number;
}

export interface CaptureFormConfig {
  typeField: {
    enabled:  boolean;
    required: boolean;
    label:    string;
  };
  labelField: {
    enabled:     boolean;
    required:    boolean;
    label:       string;
    placeholder: string;
  };
  photoField: {
    enabled:  boolean;
    required: boolean;
    maxCount: number;
  };
  extraFields: CaptureExtraField[];
  updatedAt:   string;
}

export const DEFAULT_CONFIG: CaptureFormConfig = {
  typeField:   { enabled: true,  required: false, label: "Type de lieu" },
  labelField:  { enabled: true,  required: false, label: "Nom du lieu", placeholder: "Ex. : Bureau principal, Chez Maman" },
  photoField:  { enabled: true,  required: false, maxCount: 5 },
  extraFields: [],
  updatedAt:   new Date().toISOString(),
};

// ── Location Types ─ appels API ───────────────────────────────────────────────

export async function fetchLocationTypes(): Promise<LocationType[]> {
  const res = await apiClient.get<LocationType[]>('/location-types');
  return res.data;
}

export async function createLocationType(dto: { code: string; name: string; sort_order?: number }): Promise<LocationType> {
  const res = await apiClient.post<LocationType>('/location-types', dto);
  return res.data;
}

export async function updateLocationType(id: number, dto: { code?: string; name?: string; sort_order?: number }): Promise<LocationType> {
  const res = await apiClient.put<LocationType>(`/location-types/${id}`, dto);
  return res.data;
}

export async function deleteLocationType(id: number): Promise<void> {
  await apiClient.delete(`/location-types/${id}`);
}

export async function reorderLocationTypes(ids: number[]): Promise<void> {
  await apiClient.put('/location-types/reorder/bulk', { ids });
}

// ── Capture Form Config ─ appels API ─────────────────────────────────────────

export async function fetchCaptureConfig(): Promise<CaptureFormConfig> {
  const res = await apiClient.get<{ captureFormConfig: CaptureFormConfig | null }>('/tenants/me/capture-config');
  return res.data.captureFormConfig ?? DEFAULT_CONFIG;
}

export async function saveCaptureConfig(config: CaptureFormConfig): Promise<void> {
  await apiClient.put('/tenants/me/capture-config', {
    captureFormConfig: { ...config, updatedAt: new Date().toISOString() },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newFieldId(): string {
  return `ef_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createExtraField(type: CaptureFieldType): CaptureExtraField {
  const labels: Record<CaptureFieldType, string> = {
    text: "Texte court", textarea: "Texte long", select: "Liste déroulante",
    radio: "Choix unique", checkbox: "Cases à cocher", number: "Nombre", photo: "Photo supplémentaire",
  };
  return {
    id: newFieldId(), type, label: labels[type] ?? type,
    placeholder: "", required: false,
    options: ["select","radio","checkbox"].includes(type) ? ["Option 1","Option 2"] : [],
    helpText: "", enabled: true, sortOrder: 0,
  };
}

export const EXTRA_FIELD_TYPES: { type: CaptureFieldType; label: string; icon: string }[] = [
  { type: "text",     label: "Texte court",     icon: "ti-forms"      },
  { type: "textarea", label: "Texte long",       icon: "ti-align-left" },
  { type: "number",   label: "Nombre",           icon: "ti-123"        },
  { type: "select",   label: "Liste déroulante", icon: "ti-selector"   },
  { type: "radio",    label: "Choix unique",     icon: "ti-circle-dot" },
  { type: "checkbox", label: "Cases à cocher",   icon: "ti-checkbox"   },
  { type: "photo",    label: "Photo",            icon: "ti-camera"     },
];

// Compatibilité descendante — utilisé uniquement pour l'aperçu mobile synchrone
const LS_CONFIG_KEY = "geotrust_capture_config_v1";
export function loadCaptureConfig(): CaptureFormConfig {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_CONFIG_KEY) : null;
    return raw ? (JSON.parse(raw) as CaptureFormConfig) : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}
export function saveCaptureConfigLocal(config: CaptureFormConfig): void {
  try {
    if (typeof window !== "undefined")
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }));
  } catch { /* noop */ }
}
