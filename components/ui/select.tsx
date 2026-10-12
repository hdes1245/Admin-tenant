import * as React from "react";
import { cn } from "@/lib/utils";

/** Liste déroulante native stylée (accessible, mobile-friendly, aucun JS). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-background px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";
