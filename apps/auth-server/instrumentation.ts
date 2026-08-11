/**
 * Next.js App Router hook, called for any error that escapes a Server
 * Component render, Route Handler, Server Action, or Middleware — including
 * ones application code never explicitly caught (e.g. a JSON body that
 * fails to parse). Stable since Next.js 15, no `experimental` config flag
 * needed. This is the safety net behind the explicit `logError(...)` calls
 * already sprinkled through app/api/**: those cover error paths the code
 * knows about, this one covers the ones it doesn't.
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
