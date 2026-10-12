import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "GeoTrust – Admin Tenant",
  description: "Interface d'administration du tenant GeoTrust",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers><div className="app-zoom-root">{children}</div></Providers>
      </body>
    </html>
  );
}

