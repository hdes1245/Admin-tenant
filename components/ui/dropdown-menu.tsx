"use client";

import * as React from "react";
import * as Primitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

/** Contenu du menu (portail hors zoom → `zoom: var(--ui-zoom)` appliqué ici). */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 6, style, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{ zoom: "var(--ui-zoom)", ...style }}
      className={cn("z-[1400] min-w-56 rounded-lg border border-border bg-surface p-1 text-foreground shadow-lg outline-none", className)}
      {...props}
    />
  </Primitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

/** Entrée de menu : icône optionnelle + libellé + sous-texte optionnel. */
export function DropdownMenuItem({
  icon,
  title,
  secondary,
  className,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof Primitive.Item>, "title"> & { icon?: React.ReactNode; title: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <Primitive.Item
      className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted", className)}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm">{title}</span>
        {secondary && <span className="block text-xs text-muted-foreground">{secondary}</span>}
      </span>
    </Primitive.Item>
  );
}

export const DropdownMenuSeparator = () => <Primitive.Separator className="my-1 h-px bg-border" />;
