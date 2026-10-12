"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;

const sizes = { xs: "max-w-[444px]", sm: "max-w-[600px]", md: "max-w-[900px]", lg: "max-w-[1200px]" } as const;

/**
 * Contenu de dialogue (Radix). Le portail est HORS du conteneur zoomé de l'app : on applique donc
 * `zoom: var(--ui-zoom)` à la carte. Le centrage se fait par flex sur l'overlay (non zoomé) et non
 * par top/left:50% + translate, qui seraient décalés par le zoom.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: keyof typeof sizes; accent?: boolean }
>(({ className, children, size = "sm", accent = true, style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto bg-black/50 p-4 data-[state=open]:animate-[fadeIn_.15s_ease-out]">
      <DialogPrimitive.Content
        ref={ref}
        style={{ zoom: "var(--ui-zoom)", ...style }}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl outline-none",
          sizes[size],
          className,
        )}
        {...props}
      >
        {accent && <div className="h-1 bg-accent" />}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Overlay>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ icon, children, tone = "navy" }: { icon?: React.ReactNode; children: React.ReactNode; tone?: "navy" | "danger" }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 pb-3 pt-4">
      {icon && (
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone === "danger" ? "bg-red-100 text-red-500" : "bg-primary text-accent")}>
          {icon}
        </span>
      )}
      <DialogPrimitive.Title className="text-lg font-bold">{children}</DialogPrimitive.Title>
    </div>
  );
}

export const DialogBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("px-6 py-5", className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex justify-end gap-2 border-t border-border px-6 py-4", className)} {...p} />
);
export const DialogDescription = DialogPrimitive.Description;
