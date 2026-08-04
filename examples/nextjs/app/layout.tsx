import { Providers } from "./providers";

// Auth state is resolved client-side against a live Supabase project —
// nothing here is meaningful to statically prerender at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Facturación — ejemplo KontrolIA" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
