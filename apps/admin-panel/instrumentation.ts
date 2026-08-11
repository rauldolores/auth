/**
 * Next.js App Router hook, called for any error that escapes a Server
 * Component render or layout — including ones application code never
 * explicitly caught. Stable since Next.js 15, no `experimental` config flag
 * needed. admin-panel is almost entirely client-rendered (see app/layout.tsx
 * — the only Server Component in the app), so this hook, not a route-level
 * try/catch, is effectively this app's entire server-side observability
 * surface.
 */
export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routerKind: string; routeType: string }>,
) {
  const { logError } = await import("@/lib/logger");
  logError(`${request.method} ${request.path}`, error, {
    routerKind: context.routerKind,
    routeType: context.routeType,
  });
}
