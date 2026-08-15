"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { useEffect } from "react";

// admin-panel owns org management, the app launcher, and every other piece
// of the actual dashboard now (organizations/applications pages) — this
// used to duplicate all of that here too. Landing on auth-server with
// nothing else to do (no /login, /mfa-challenge, /oauth/consent, etc. in
// progress) now always hands off to admin-panel instead.
const ADMIN_PANEL_URL = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;

function RedirectTo({ href }: { href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);
  return <p className="k-p-8 k-text-center k-text-sm k-text-muted-foreground">Redirigiendo...</p>;
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  // Records this browser session as a known device once per sign-in, so
  // /devices has something to list and revoke — this is the one place every
  // authenticated visit still passes through on its way to admin-panel.
  useEffect(() => {
    if (isAuthenticated) void fetch("/api/devices/touch", { method: "POST" });
  }, [isAuthenticated]);

  return (
    <AuthGuard fallback={<RedirectTo href="/login" />}>
      <RedirectTo href={ADMIN_PANEL_URL ?? "/login"} />
    </AuthGuard>
  );
}
