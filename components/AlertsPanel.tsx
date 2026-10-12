"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertOctagon, Bell, CircleCheck, RotateCcw, TriangleAlert, X } from "lucide-react";
import {
  AlertThreshold, AlertSeverity, TriggeredAlert,
  DEFAULT_THRESHOLDS, saveThresholds,
} from "@/lib/alertsConfig";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface Props {
  open:             boolean;
  onClose:          () => void;
  thresholds:       AlertThreshold[];
  triggeredAlerts:  TriggeredAlert[];
  onChange:         (updated: AlertThreshold[]) => void;
}

export default function AlertsPanel({ open, onClose, thresholds, triggeredAlerts, onChange }: Props) {
  const [localThresholds, setLocalThresholds] = useState<AlertThreshold[]>(thresholds);

  useEffect(() => {
    if (open) setLocalThresholds(thresholds);
  }, [open]);

  const update = useCallback((id: string, patch: Partial<AlertThreshold>) => {
    setLocalThresholds((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const handleSave = useCallback(() => {
    saveThresholds(localThresholds);
    onChange(localThresholds);
    onClose();
  }, [localThresholds, onChange, onClose]);

  const handleReset = () => {
    setLocalThresholds(DEFAULT_THRESHOLDS);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={420}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}
        >
          <span className="relative text-[#3C8047]">
            <Bell size={24} />
            {triggeredAlerts.length > 0 && (
              <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {triggeredAlerts.length > 9 ? "9+" : triggeredAlerts.length}
              </span>
            )}
          </span>
          <div className="flex-1">
            <SheetTitle className="text-[15px] font-bold text-white">Alertes & seuils KPI</SheetTitle>
            <div className="text-[11px] text-white/55">Configuration des seuils de surveillance</div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer rounded-full border-0 bg-transparent p-1 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Active alerts summary */}
        {triggeredAlerts.length > 0 ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
            <div className="mb-3 flex items-center gap-1 text-xs font-semibold text-amber-800">
              <TriangleAlert size={15} />
              {triggeredAlerts.length} alerte{triggeredAlerts.length > 1 ? "s" : ""} active{triggeredAlerts.length > 1 ? "s" : ""}
            </div>
            <div className="flex flex-col gap-2">
              {triggeredAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-2 rounded-lg border p-2 ${a.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
                >
                  {a.severity === "critical"
                    ? <AlertOctagon size={15} className="mt-0.5 shrink-0 text-red-600" />
                    : <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />}
                  <span className={`text-xs leading-normal ${a.severity === "critical" ? "text-red-800" : "text-amber-800"}`}>{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-5 py-3.5">
            <CircleCheck size={16} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-800">Tous les indicateurs sont dans les seuils normaux</span>
          </div>
        )}

        {/* Thresholds list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuration des seuils</div>
          {localThresholds.map((t, idx) => (
            <div key={t.id} className={`py-4 ${idx < localThresholds.length - 1 ? "border-b border-border" : ""}`}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-foreground">{t.label}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{t.description}</div>
                </div>
                <Switch aria-label={`Activer ${t.label}`} checked={t.enabled} onCheckedChange={(v) => update(t.id, { enabled: v })} />
              </div>

              {t.enabled && (
                <div className="mt-3">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="min-w-[65px] text-[11px] text-muted-foreground">{t.operator === "lt" ? "Alerte si <" : "Alerte si >"}</span>
                    <input
                      type="range"
                      aria-label={`Seuil ${t.label}`}
                      value={t.value}
                      min={t.min}
                      max={t.max}
                      step={t.step}
                      onChange={(e) => update(t.id, { value: Number(e.target.value) })}
                      className="h-1 flex-1 cursor-pointer accent-[#1E6091]"
                    />
                    <span className="min-w-[46px] text-right text-xs font-bold text-foreground">{t.value}{t.unit}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="min-w-[65px] text-[11px] text-muted-foreground">Sévérité</span>
                    <Select
                      aria-label="Sévérité"
                      value={t.severity}
                      onChange={(e) => update(t.id, { severity: e.target.value as AlertSeverity })}
                      className="h-8 w-40 text-xs"
                    >
                      <option value="warning">Avertissement</option>
                      <option value="critical">Critique</option>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Tooltip title="Rétablir les valeurs par défaut">
            <Button variant="outline" size="icon" aria-label="Rétablir les valeurs par défaut" onClick={handleReset}>
              <RotateCcw size={16} />
            </Button>
          </Tooltip>
          <Button variant="outline" className="flex-1 text-[13px] text-muted-foreground" onClick={onClose}>Annuler</Button>
          <Button className="flex-[2] text-[13px] hover:bg-[#1E6091] hover:opacity-100" onClick={handleSave}>Enregistrer</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
