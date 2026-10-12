import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border px-4 py-2.5 text-sm", {
  variants: {
    severity: {
      error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
      success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200",
      warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    },
  },
  defaultVariants: { severity: "info" },
});

export function Alert({
  className,
  severity,
  onClose,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { onClose?: () => void }) {
  return (
    <div role="alert" className={cn(alertVariants({ severity }), onClose && "flex items-start justify-between gap-3", className)} {...props}>
      <div>{children}</div>
      {onClose && (
        <button type="button" aria-label="Fermer" onClick={onClose} className="cursor-pointer border-0 bg-transparent p-0.5 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
