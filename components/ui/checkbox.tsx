"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Case à cocher native stylée ; `indeterminate` passe par la propriété DOM (pas d'attribut HTML). */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { indeterminate?: boolean }
>(({ className, indeterminate, ...props }, forwardedRef) => {
  const inner = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwardedRef, () => inner.current as HTMLInputElement);
  React.useEffect(() => {
    if (inner.current) inner.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return <input ref={inner} type="checkbox" className={cn("size-4 cursor-pointer accent-[#1E6091]", className)} {...props} />;
});
Checkbox.displayName = "Checkbox";
