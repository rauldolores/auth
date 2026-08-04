"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";

export interface ResetPasswordFormProps {
  className?: string;
  onSuccess?: () => void;
}

export function ResetPasswordForm({ className, onSuccess }: ResetPasswordFormProps) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("k-flex k-flex-col k-gap-4", className)}>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-new-password" className="k-text-sm k-font-medium">
          Nueva contraseña
        </label>
        <input
          id="k-new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      <div className="k-flex k-flex-col k-gap-1.5">
        <label htmlFor="k-confirm-password" className="k-text-sm k-font-medium">
          Confirmar contraseña
        </label>
        <input
          id="k-confirm-password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-sm"
        />
      </div>
      {error && <p className="k-text-sm k-text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
      >
        {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
      </button>
    </form>
  );
}
