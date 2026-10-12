import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn("inline-block size-[18px] animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}
