"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";

export interface ForgotPasswordFormProps {
  className?: string;
  redirectTo?: string;
}

export function ForgotPasswordForm({ className, redirectTo }: ForgotPasswordFormProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email, redirectTo);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return <p className={cn("k-text-sm", className)}>Si el correo existe, enviamos un enlace para restablecer tu contraseña.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={cn("k-flex k-flex-col k-gap-4", className)}>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-forgot-email" className="k-text-sm k-font-medium">
          Correo electrónico
        </label>
        <input
          id="k-forgot-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      {error && <p className="k-text-sm k-text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
