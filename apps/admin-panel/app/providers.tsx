"use client";

import { AuthProvider } from "@kontrolia/react";
import { kontroliaClientConfig } from "@/lib/kontrolia-config";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider config={kontroliaClientConfig}>{children}</AuthProvider>;
}
