"use client";

import type { EvaluationMode } from "@kontrolia/permissions";
import { useKontroliaAuthContext } from "./context.js";

export interface GuardProps {
  children: React.ReactNode;
  /** Rendered while the initial session is being resolved. */
  loading?: React.ReactNode;
  /** Rendered when the guard's condition is not met. */
  fallback?: React.ReactNode;
}

/** Renders children only for an authenticated user. */
export function AuthGuard({ children, loading = null, fallback = null }: GuardProps) {
  const { isLoading, isAuthenticated } = useKontroliaAuthContext();
  if (isLoading) return <>{loading}</>;
  return <>{isAuthenticated ? children : fallback}</>;
}

/** Renders children only for a guest (unauthenticated) — typical for login/register pages. */
export function GuestGuard({ children, loading = null, fallback = null }: GuardProps) {
  const { isLoading, isAuthenticated } = useKontroliaAuthContext();
  if (isLoading) return <>{loading}</>;
  return <>{!isAuthenticated ? children : fallback}</>;
}

export interface RequireRoleProps extends GuardProps {
  role: string | string[];
  mode?: EvaluationMode;
}

export function RequireRole({ role, mode = "any", children, loading = null, fallback = null }: RequireRoleProps) {
  const { isLoading, checker } = useKontroliaAuthContext();
  if (isLoading) return <>{loading}</>;
  return <>{checker.hasRole(role, mode) ? children : fallback}</>;
}

export interface RequirePermissionProps extends GuardProps {
  permission: string | string[];
  mode?: EvaluationMode;
}

export function RequirePermission({
  permission,
  mode = "any",
  children,
  loading = null,
  fallback = null,
}: RequirePermissionProps) {
  const { isLoading, checker } = useKontroliaAuthContext();
  if (isLoading) return <>{loading}</>;
  return <>{checker.hasPermission(permission, mode) ? children : fallback}</>;
}
