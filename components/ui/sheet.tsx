"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTitle = DialogPrimitive.Title;

/**
 * Panneau latéral droit (équivalent Drawer). Hors du conteneur zoomé → `zoom: var(--ui-zoom)` ici ;
 * la hauteur est divisée par le zoom pour occuper exactement la fenêtre.
 */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { width?: number; side?: "left" | "right" }
>(({ className, children, width = 420, side = "right", style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[1200] bg-black/50 data-[state=open]:animate-[fadeIn_.15s_ease-out]" />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      style={{ zoom: "var(--ui-zoom)", height: "calc(100vh / var(--ui-zoom))", width: `min(${width}px, calc(100vw / var(--ui-zoom)))`, ...style }}
      className={cn(
        "fixed top-0 z-[1201] flex flex-col bg-surface text-foreground shadow-2xl outline-none",
        side === "right" ? "right-0 data-[state=open]:animate-[slideIn_.2s_ease-out]" : "left-0 data-[state=open]:animate-[slideInLeft_.2s_ease-out]",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";
