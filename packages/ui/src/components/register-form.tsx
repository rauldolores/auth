"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";
import { GoogleLoginButton, MicrosoftLoginButton } from "./oauth-buttons.js";

export interface RegisterFormProps {
  className?: string;
  onSuccess?: () => void;
  loginHref?: string;
  /** Only opt into this once the installation's Supabase project has Google enabled. */
  showGoogle?: boolean;
  /** Only opt into this once the installation's Supabase project has Azure enabled. */
  showMicrosoft?: boolean;
  /** Where GoTrue sends the browser back to once Google/Microsoft sign-up completes — threaded straight through to loginWithOAuth(). */
  redirectTo?: string;
}

export function RegisterForm({ className, onSuccess, loginHref, showGoogle, showMicrosoft, redirectTo }: RegisterFormProps) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ email, password, fullName });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("k-flex k-flex-col k-gap-4", className)}>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-full-name" className="k-text-sm k-font-medium">
          Nombre completo
        </label>
        <input
          id="k-full-name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-register-email" className="k-text-sm k-font-medium">
          Correo electrónico
        </label>
        <input
          id="k-register-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-register-password" className="k-text-sm k-font-medium">
          Contraseña
        </label>
        <input
          id="k-register-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      {error && <p className="k-text-sm k-text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
      >
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      {loginHref && (
        <a href={loginHref} className="k-text-center k-text-sm k-text-muted-foreground hover:k-underline">
          ¿Ya tienes cuenta? Inicia sesión
        </a>
      )}
      {(showGoogle || showMicrosoft) && (
        <>
          <div className="k-flex k-items-center k-gap-3 k-text-xs k-text-muted-foreground">
            <span className="k-h-px k-flex-1 k-bg-border" />o<span className="k-h-px k-flex-1 k-bg-border" />
          </div>
          {showGoogle && <GoogleLoginButton label="Registrarme con Google" redirectTo={redirectTo} />}
          {showMicrosoft && <MicrosoftLoginButton label="Registrarme con Microsoft" redirectTo={redirectTo} />}
        </>
      )}
    </form>
  );
}
