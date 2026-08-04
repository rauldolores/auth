import type { Metadata } from "next";
import { DashboardShell } from "./dashboard-shell";
import { Providers } from "./providers";
import "./globals.css";

// Every page here depends on client-side auth state resolved against a live
// Supabase project — there is nothing meaningful to statically prerender,
// and doing so would require Supabase env vars at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KontrolIA Admin",
  description: "Panel de administración de KontrolIA Auth",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
