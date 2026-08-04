"use client";

import { AuthProvider } from "@kontrolia/react";

const kontroliaConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
};

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider config={kontroliaConfig}>{children}</AuthProvider>;
}
