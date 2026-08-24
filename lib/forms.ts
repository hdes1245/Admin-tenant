export type FieldType =
  | "text" | "textarea" | "number" | "email" | "phone"
  | "select" | "radio" | "checkbox"
  | "date" | "time"
  | "gps" | "photo" | "signature";

export type FormCategory = "enquete" | "visite" | "fiche_client" | "rapport" | "audit" | "autre";
export type FormStatus    = "draft" | "published" | "archived";

export interface FormField {
  id:          string;
  type:        FieldType;
  label:       string;
  placeholder: string;
  required:    boolean;
  options:     string[];
  helpText:    string;
  min?:        number;
  max?:        number;
}

export interface FormTemplate {
  id:          string;
  name:        string;
  description: string;
  category:    FormCategory;
  status:      FormStatus;
  fields:      FormField[];
  createdAt:   string;
  updatedAt:   string;
  submissions: number;
  offlineSync: boolean;
}

export const FIELD_TYPES: { type: FieldType; label: string; icon: string; group: string }[] = [
  { type: "text",      label: "Texte court",    icon: "ti-forms",          group: "Basique" },
  { type: "textarea",  label: "Texte long",     icon: "ti-align-left",     group: "Basique" },
  { type: "number",    label: "Nombre",         icon: "ti-123",            group: "Basique" },
  { type: "email",     label: "E-mail",         icon: "ti-mail",           group: "Basique" },
  { type: "phone",     label: "Téléphone",      icon: "ti-phone",          group: "Basique" },
  { type: "select",    label: "Liste déroulante",icon: "ti-selector",      group: "Choix" },
  { type: "radio",     label: "Boutons radio",  icon: "ti-circle-dot",     group: "Choix" },
  { type: "checkbox",  label: "Cases à cocher", icon: "ti-checkbox",       group: "Choix" },
  { type: "date",      label: "Date",           icon: "ti-calendar",       group: "Date & heure" },
  { type: "time",      label: "Heure",          icon: "ti-clock",          group: "Date & heure" },
  { type: "gps",       label: "Position GPS",   icon: "ti-map-pin",        group: "Terrain" },
  { type: "photo",     label: "Photo",          icon: "ti-camera",         group: "Terrain" },
  { type: "signature", label: "Signature",      icon: "ti-writing-sign",   group: "Terrain" },
];

export const CATEGORY_LABELS: Record<FormCategory, string> = {
  enquete:      "Enquête",
  visite:       "Rapport de visite",
  fiche_client: "Fiche client",
  rapport:      "Rapport terrain",
  audit:        "Audit",
  autre:        "Autre",
};

const LS_KEY = "geotrust_form_templates_v1";

function newId(): string {
  return `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function newFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultField(type: FieldType): FormField {
  return {
    id:          newFieldId(),
    type,
    label:       FIELD_TYPES.find((f) => f.type === type)?.label ?? type,
    placeholder: "",
    required:    false,
    options:     ["select", "radio", "checkbox"].includes(type) ? ["Option 1", "Option 2"] : [],
    helpText:    "",
  };
}

export function loadForms(): FormTemplate[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const base: FormTemplate[] = raw ? (JSON.parse(raw) as FormTemplate[]) : DEMO_FORMS;
    // Le formulaire système est toujours présent en tête, avec ses champs à jour
    const withoutSystem = base.filter((f) => f.id !== SYSTEM_LOCALISER_CLIENT.id);
    const saved = base.find((f) => f.id === SYSTEM_LOCALISER_CLIENT.id);
    const system = saved ? { ...SYSTEM_LOCALISER_CLIENT, ...saved, id: SYSTEM_LOCALISER_CLIENT.id } : SYSTEM_LOCALISER_CLIENT;
    return [system, ...withoutSystem];
  } catch {
    return [SYSTEM_LOCALISER_CLIENT, ...DEMO_FORMS];
  }
}

export function saveForms(forms: FormTemplate[]): void {
  try {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(forms));
  } catch { /* noop */ }
}

export function createForm(partial: Partial<FormTemplate>): FormTemplate {
  const now = new Date().toISOString();
  return {
    id:          newId(),
    name:        "Nouveau formulaire",
    description: "",
    category:    "autre",
    status:      "draft",
    fields:      [],
    createdAt:   now,
    updatedAt:   now,
    submissions: 0,
    offlineSync: true,
    ...partial,
  };
}

export function saveForm(form: FormTemplate): void {
  const forms = loadForms();
  const idx   = forms.findIndex((f) => f.id === form.id);
  const updated = { ...form, updatedAt: new Date().toISOString() };
  if (idx >= 0) forms[idx] = updated;
  else forms.unshift(updated);
  saveForms(forms);
}

export function deleteForm(id: string): void {
  if (id === SYSTEM_LOCALISER_CLIENT.id) return;
  saveForms(loadForms().filter((f) => f.id !== id));
}

export function duplicateForm(form: FormTemplate): FormTemplate {
  const now = new Date().toISOString();
  return {
    ...form,
    id:          newId(),
    name:        `${form.name} (copie)`,
    status:      "draft",
    submissions: 0,
    createdAt:   now,
    updatedAt:   now,
  };
}

const SYSTEM_LOCALISER_CLIENT: FormTemplate = {
  id: "system_localiser_client",
  name: "Localiser client",
  description: "Formulaire de capture de position GPS et de qualification des lieux clients",
  category: "fiche_client",
  status: "published",
  submissions: 0,
  offlineSync: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  fields: [
    { id: "sys_f1", type: "gps",    label: "Position GPS",   placeholder: "",                          required: true,  options: [], helpText: "Capturé automatiquement" },
    { id: "sys_f2", type: "select", label: "Type de lieu",   placeholder: "",                          required: false, options: ["Domicile", "Lieu de travail", "Commerce / Boutique", "Exploitation agricole", "Autre"], helpText: "" },
    { id: "sys_f3", type: "text",   label: "Nom du lieu",    placeholder: "Ex. : Bureau principal, Chez Maman", required: false, options: [], helpText: "" },
    { id: "sys_f4", type: "photo",  label: "Photos",         placeholder: "",                          required: false, options: [], helpText: "" },
  ],
};

const DEMO_FORMS: FormTemplate[] = [
  {
    id: "demo_1",
    name: "Rapport de visite client",
    description: "Formulaire standard de visite terrain pour les CAFs",
    category: "visite",
    status: "published",
    submissions: 47,
    offlineSync: true,
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-15T10:30:00Z",
    fields: [
      { id: "f1", type: "text",     label: "Nom du client",         placeholder: "Ex: Jean Dupont", required: true,  options: [], helpText: "" },
      { id: "f2", type: "gps",      label: "Position GPS",          placeholder: "",                required: true,  options: [], helpText: "Capturé automatiquement" },
      { id: "f3", type: "select",   label: "Motif de la visite",    placeholder: "",                required: true,  options: ["Prospection", "Suivi", "Réclamation", "Livraison"], helpText: "" },
      { id: "f4", type: "radio",    label: "Satisfaction client",   placeholder: "",                required: false, options: ["Très satisfait", "Satisfait", "Neutre", "Insatisfait"], helpText: "" },
      { id: "f5", type: "textarea", label: "Observations",          placeholder: "Détaillez...",    required: false, options: [], helpText: "" },
      { id: "f6", type: "photo",    label: "Photo justificative",   placeholder: "",                required: false, options: [], helpText: "Optionnel" },
      { id: "f7", type: "signature",label: "Signature client",      placeholder: "",                required: false, options: [], helpText: "" },
    ],
  },
  {
    id: "demo_2",
    name: "Enquête satisfaction",
    description: "Évaluation de la qualité de service perçue par les clients",
    category: "enquete",
    status: "published",
    submissions: 23,
    offlineSync: true,
    createdAt: "2026-06-10T09:00:00Z",
    updatedAt: "2026-06-20T14:00:00Z",
    fields: [
      { id: "f1", type: "radio",   label: "Note globale",           placeholder: "", required: true,  options: ["1 - Très mauvais", "2 - Mauvais", "3 - Moyen", "4 - Bon", "5 - Excellent"], helpText: "" },
      { id: "f2", type: "checkbox",label: "Points à améliorer",     placeholder: "", required: false, options: ["Délai d'attente", "Accueil", "Compétences", "Propreté", "Communication"], helpText: "" },
      { id: "f3", type: "textarea",label: "Commentaire libre",      placeholder: "Votre avis...", required: false, options: [], helpText: "" },
    ],
  },
  {
    id: "demo_3",
    name: "Audit de point de vente",
    description: "Vérification de conformité des agences et points de vente",
    category: "audit",
    status: "draft",
    submissions: 0,
    offlineSync: true,
    createdAt: "2026-06-25T11:00:00Z",
    updatedAt: "2026-06-25T11:00:00Z",
    fields: [
      { id: "f1", type: "text",    label: "Nom de l'agence",        placeholder: "",   required: true,  options: [], helpText: "" },
      { id: "f2", type: "date",    label: "Date de l'audit",        placeholder: "",   required: true,  options: [], helpText: "" },
      { id: "f3", type: "radio",   label: "Signalétique conforme",  placeholder: "",   required: true,  options: ["Oui", "Non", "Partiel"], helpText: "" },
      { id: "f4", type: "radio",   label: "Stocks suffisants",      placeholder: "",   required: true,  options: ["Oui", "Non", "Partiel"], helpText: "" },
      { id: "f5", type: "photo",   label: "Photo façade",           placeholder: "",   required: true,  options: [], helpText: "" },
      { id: "f6", type: "number",  label: "Score global (/100)",    placeholder: "0",  required: true,  options: [], min: 0, max: 100, helpText: "" },
    ],
  },
];
