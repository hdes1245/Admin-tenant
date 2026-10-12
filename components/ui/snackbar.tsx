"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";

/** Notification éphémère en bas de l'écran (ferme seule après `autoHideMs`). */
export function Snackbar({
  open,
  onClose,
  severity = "error",
  autoHideMs = 6000,
  children,
}: {
  open: boolean;
  onClose: () => void;
  severity?: "error" | "success" | "warning" | "info";
  autoHideMs?: number;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(t);
  }, [open, autoHideMs, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-[1600] flex justify-center px-4">
      <Alert severity={severity} onClose={onClose} className="min-w-72 max-w-xl shadow-lg">
        {children}
      </Alert>
    </div>
  );
}
