/**
 * Minimal, dependency-free structured error logging for server-side code.
 *
 * Writes a single JSON line to stderr via `console.error` so that whatever
 * the deployment platform already captures (Vercel's log drains, a
 * Docker/Railway container's stdout/stderr, etc.) has a searchable record of
 * the failure. This is deliberately NOT a Sentry/Datadog/equivalent
 * integration — wiring one of those up is a vendor/account decision for a
 * human to make, not something to bolt on silently. Treat this as the cheap
 * first step before that decision gets made.
 */
export function logError(context: string, error: unknown, meta?: Record<string, unknown>): void {
  const normalized =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: typeof error === "string" ? error : JSON.stringify(error) };

  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      context,
      ...normalized,
      ...(meta ? { meta } : {}),
    }),
  );
}
