"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/** Infobulle Radix. `title` = texte ; l'enfant doit pouvoir recevoir une ref (button, span…). */
export function Tooltip({
  title,
  children,
  side = "top",
}: {
  title: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  if (!title) return children;
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            style={{ zoom: "var(--ui-zoom)" }}
            className="z-[1500] max-w-64 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            {title}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
