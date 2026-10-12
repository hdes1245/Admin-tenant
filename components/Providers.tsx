"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeModeProvider } from "@/components/ThemeModeContext";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:        60_000,
          gcTime:           5 * 60_000,
          retry:            1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <ThemeModeProvider>
          {children}
        </ThemeModeProvider>
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
