import * as React from "react";
import { cn } from "@/lib/utils";

/** Bloc de chargement (shadcn/ui) : animation CSS pure, aucun JS à l'exécution. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-black/10 dark:bg-white/10", className)} {...props} />;
}
