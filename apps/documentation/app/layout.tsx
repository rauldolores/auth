import "./globals.css";

export const metadata = {
  title: "KontrolIA Auth — Documentación",
  description: "Arquitectura, guías, ejemplos, FAQ, migración y troubleshooting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
