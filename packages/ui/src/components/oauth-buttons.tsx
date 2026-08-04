"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";

export interface GoogleLoginButtonProps {
  className?: string;
  label?: string;
}

/**
 * Only renders meaningfully if the installation's Supabase project has the
 * Google provider enabled — otherwise loginWithOAuth() redirects to a
 * Supabase error page. The button itself has no way to know that in
 * advance; apps opt into showing it (see LoginForm/RegisterForm's
 * showGoogle prop) once they've configured the provider.
 */
export function GoogleLoginButton({ className, label = "Continuar con Google" }: GoogleLoginButtonProps) {
  const { loginWithOAuth } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsRedirecting(true);
    try {
      await loginWithOAuth("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión con Google.");
      setIsRedirecting(false);
    }
  }

  return (
    <div className={cn("k-flex k-flex-col k-gap-2", className)}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isRedirecting}
        className="k-flex k-items-center k-justify-center k-gap-2 k-rounded-md k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted disabled:k-opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C40.9 36.4 44 30.8 44 24c0-1.3-.1-2.7-.4-3.5z"
          />
        </svg>
        {isRedirecting ? "Redirigiendo..." : label}
      </button>
      {error && <p className="k-text-sm k-text-destructive">{error}</p>}
    </div>
  );
}

export interface MicrosoftLoginButtonProps {
  className?: string;
  label?: string;
}

/**
 * Only renders meaningfully if the installation's Supabase project has the
 * Azure provider enabled — otherwise loginWithOAuth() redirects to a
 * Supabase error page. Same caveat as GoogleLoginButton above.
 */
export function MicrosoftLoginButton({ className, label = "Continuar con Microsoft" }: MicrosoftLoginButtonProps) {
  const { loginWithOAuth } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsRedirecting(true);
    try {
      await loginWithOAuth("azure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión con Microsoft.");
      setIsRedirecting(false);
    }
  }

  return (
    <div className={cn("k-flex k-flex-col k-gap-2", className)}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isRedirecting}
        className="k-flex k-items-center k-justify-center k-gap-2 k-rounded-md k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted disabled:k-opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
          <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
        </svg>
        {isRedirecting ? "Redirigiendo..." : label}
      </button>
      {error && <p className="k-text-sm k-text-destructive">{error}</p>}
    </div>
  );
}
