"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";

export interface LoginFormProps {
  className?: string;
  onSuccess?: () => void;
  forgotPasswordHref?: string;
  registerHref?: string;
}

export function LoginForm({ className, onSuccess, forgotPasswordHref, registerHref }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("k-flex k-flex-col k-gap-4", className)}>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-email" className="k-text-sm k-font-medium">
          Correo electrónico
        </label>
        <input
          id="k-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-password" className="k-text-sm k-font-medium">
          Contraseña
        </label>
        <input
          id="k-password"
          type="password"
          required
          autoComplete="current-password"
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
        {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
      </button>
      <div className="k-flex k-justify-between k-text-sm">
        {forgotPasswordHref && (
          <a href={forgotPasswordHref} className="k-text-muted-foreground hover:k-underline">
            ¿Olvidaste tu contraseña?
          </a>
        )}
        {registerHref && (
          <a href={registerHref} className="k-text-muted-foreground hover:k-underline">
            Crear cuenta
          </a>
        )}
      </div>
    </form>
  );
}
