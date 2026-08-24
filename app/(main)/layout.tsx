"use client";

import { SidebarLayout } from "@/components/layout/SidebarLayout";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const AiAssistant = dynamic(() => import("@/components/AiAssistant"), {
  ssr: false,
  loading: () => null,
});

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarLayout>
      {children}
      <AiAssistant />
    </SidebarLayout>
  );
}
