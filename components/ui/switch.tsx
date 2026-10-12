"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Interrupteur accessible (role=switch). */
export const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & { checked: boolean; onCheckedChange?: (v: boolean) => void }
>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-[#1E6091]" : "bg-border-strong",
      className,
    )}
    {...props}
  >
    <span className={cn("block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
  </button>
));
Switch.displayName = "Switch";
