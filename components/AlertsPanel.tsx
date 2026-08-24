"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Drawer, Box, Typography, IconButton, Divider, Switch,
  Chip, Slider, Tooltip, Stack, Select, MenuItem, FormControl,
  Button, Badge,
} from "@mui/material";
import CloseIcon          from "@mui/icons-material/Close";
import NotificationsIcon  from "@mui/icons-material/Notifications";
import WarningAmberIcon   from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon   from "@mui/icons-material/ErrorOutline";
import CheckCircleIcon    from "@mui/icons-material/CheckCircle";
import RestoreIcon        from "@mui/icons-material/Restore";
import {
  AlertThreshold, AlertSeverity, TriggeredAlert,
  DEFAULT_THRESHOLDS, saveThresholds,
} from "@/lib/alertsConfig";

const NAVY  = "#0D1B2A";
const STEEL = "#1B4F72";
const GOLD  = "#C49A2E";

interface Props {
  open:             boolean;
  onClose:          () => void;
  thresholds:       AlertThreshold[];
  triggeredAlerts:  TriggeredAlert[];
  onChange:         (updated: AlertThreshold[]) => void;
}

function SeverityChip({ severity }: { severity: AlertSeverity }) {
  return severity === "critical" ? (
    <Chip label="Critique" size="small" icon={<ErrorOutlineIcon />}
      sx={{ bgcolor: "#FEF2F2", color: "#991B1B", border: "0.5px solid #FECACA", fontSize: 10, height: 20,
        "& .MuiChip-icon": { fontSize: 12, color: "#DC2626" } }} />
  ) : (
    <Chip label="Avertissement" size="small" icon={<WarningAmberIcon />}
      sx={{ bgcolor: "#FFFBEB", color: "#92400E", border: "0.5px solid #FDE68A", fontSize: 10, height: 20,
        "& .MuiChip-icon": { fontSize: 12, color: "#D97706" } }} />
  );
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

  const criticalCount  = triggeredAlerts.filter((a) => a.severity === "critical").length;
  const warningCount   = triggeredAlerts.filter((a) => a.severity === "warning").length;

  return (
    <Drawer anchor="right" open={open}
      onClose={() => { handleSave(); onClose(); }}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 420 }, display: "flex", flexDirection: "column" } }}>

      {/* Header */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${STEEL} 100%)`,
        px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Badge badgeContent={triggeredAlerts.length} color="error" max={9}>
          <NotificationsIcon sx={{ color: GOLD, fontSize: 24 }} />
        </Badge>
        <Box flex={1}>
          <Typography fontWeight={700} color="#fff" fontSize={15}>Alertes & seuils KPI</Typography>
          <Typography fontSize={11} color="rgba(255,255,255,0.55)">
            Configuration des seuils de surveillance
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { color: "#fff" } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Active alerts summary */}
      {triggeredAlerts.length > 0 ? (
        <Box sx={{ px: 2.5, py: 2, bgcolor: "#FFFBEB", borderBottom: "0.5px solid #FDE68A" }}>
          <Typography fontSize={12} fontWeight={600} color="#92400E" mb={1.2} display="flex" alignItems="center" gap={0.5}>
            <WarningAmberIcon sx={{ fontSize: 15 }} />
            {triggeredAlerts.length} alerte{triggeredAlerts.length > 1 ? "s" : ""} active{triggeredAlerts.length > 1 ? "s" : ""}
          </Typography>
          <Stack gap={0.8}>
            {triggeredAlerts.map((a) => (
              <Box key={a.id} sx={{
                display: "flex", alignItems: "flex-start", gap: 1,
                p: 1, borderRadius: 1.5,
                bgcolor: a.severity === "critical" ? "#FEF2F2" : "#FFFBEB",
                border: `0.5px solid ${a.severity === "critical" ? "#FECACA" : "#FDE68A"}`,
              }}>
                {a.severity === "critical"
                  ? <ErrorOutlineIcon sx={{ fontSize: 15, color: "#DC2626", mt: 0.1, flexShrink: 0 }} />
                  : <WarningAmberIcon sx={{ fontSize: 15, color: "#D97706", mt: 0.1, flexShrink: 0 }} />}
                <Typography fontSize={12} color={a.severity === "critical" ? "#991B1B" : "#92400E"} lineHeight={1.5}>
                  {a.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : (
        <Box sx={{ px: 2.5, py: 1.8, bgcolor: "#ECFDF5", borderBottom: "0.5px solid #A7F3D0",
          display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleIcon sx={{ fontSize: 16, color: "#059669" }} />
          <Typography fontSize={12} color="#065F46" fontWeight={500}>
            Tous les indicateurs sont dans les seuils normaux
          </Typography>
        </Box>
      )}

      {/* Thresholds list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
        <Typography fontSize={12} fontWeight={600} color="text.secondary"
          textTransform="uppercase" letterSpacing={0.5} mb={1.5}>
          Configuration des seuils
        </Typography>
        <Stack gap={0}>
          {localThresholds.map((t, idx) => (
            <Box key={t.id}>
              <Box sx={{ py: 2 }}>
                {/* Row 1: name + toggle */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                  <Box flex={1}>
                    <Typography fontSize={13} fontWeight={600} color={NAVY}>{t.label}</Typography>
                    <Typography fontSize={11} color="text.secondary" lineHeight={1.4}>{t.description}</Typography>
                  </Box>
                  <Switch
                    checked={t.enabled}
                    onChange={(e) => update(t.id, { enabled: e.target.checked })}
                    size="small"
                    sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: STEEL },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: STEEL } }}
                  />
                </Box>

                {t.enabled && (
                  <Box mt={1.2}>
                    {/* Operator + threshold value */}
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography fontSize={11} color="text.secondary" minWidth={65}>
                        {t.operator === "lt" ? "Alerte si <" : "Alerte si >"}
                      </Typography>
                      <Slider
                        value={t.value}
                        min={t.min}
                        max={t.max}
                        step={t.step}
                        onChange={(_, v) => update(t.id, { value: v as number })}
                        size="small"
                        sx={{ flex: 1, color: STEEL,
                          "& .MuiSlider-thumb": { width: 14, height: 14 } }}
                      />
                      <Box sx={{ minWidth: 46, textAlign: "right" }}>
                        <Typography fontSize={12} fontWeight={700} color={NAVY}>
                          {t.value}{t.unit}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Severity selector */}
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontSize={11} color="text.secondary" minWidth={65}>Sévérité</Typography>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          value={t.severity}
                          onChange={(e) => update(t.id, { severity: e.target.value as AlertSeverity })}
                          sx={{ fontSize: 12, "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(27,79,114,0.25)" } }}
                        >
                          <MenuItem value="warning">
                            <Box display="flex" alignItems="center" gap={0.8}>
                              <WarningAmberIcon sx={{ fontSize: 14, color: "#D97706" }} />
                              <Typography fontSize={12}>Avertissement</Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="critical">
                            <Box display="flex" alignItems="center" gap={0.8}>
                              <ErrorOutlineIcon sx={{ fontSize: 14, color: "#DC2626" }} />
                              <Typography fontSize={12}>Critique</Typography>
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                )}
              </Box>
              {idx < localThresholds.length - 1 && (
                <Divider sx={{ borderColor: "rgba(0,0,0,0.06)" }} />
              )}
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Footer buttons */}
      <Box sx={{ px: 2.5, py: 2, borderTop: "0.5px solid rgba(0,0,0,0.08)",
        display: "flex", gap: 1 }}>
        <Tooltip title="Rétablir les valeurs par défaut">
          <IconButton size="small" onClick={handleReset}
            sx={{ border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 1.5 }}>
            <RestoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button variant="outlined" onClick={onClose} sx={{ flex: 1, fontSize: 13,
          borderColor: "rgba(0,0,0,0.2)", color: "text.secondary" }}>
          Annuler
        </Button>
        <Button variant="contained" onClick={handleSave} sx={{ flex: 2, fontSize: 13,
          bgcolor: NAVY, "&:hover": { bgcolor: STEEL }, fontWeight: 600 }}>
          Enregistrer
        </Button>
      </Box>
    </Drawer>
  );
}
