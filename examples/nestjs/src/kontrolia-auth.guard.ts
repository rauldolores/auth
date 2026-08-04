import { verifyRequest, requirePermission } from "@kontrolia/auth/server";
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { PERMISSION_KEY } from "./require-permission.decorator.js";

const kontroliaConfig = { supabaseUrl: process.env.SUPABASE_URL! };

function toFetchRequest(req: ExpressRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(`http://localhost${req.originalUrl}`, { headers });
}

/**
 * Wraps @kontrolia/auth/server's verifyRequest()/requirePermission() as a
 * standard Nest guard. Reads the required permission (if any) from
 * @RequirePermission() route metadata via the global Reflect polyfill
 * directly (SetMetadata just calls Reflect.defineMetadata under the hood) —
 * deliberately not Nest's own injectable Reflector service, whose
 * constructor-parameter DI depends on emitDecoratorMetadata output that
 * esbuild-based runners (tsx, and this example uses tsx) don't always
 * produce correctly, silently leaving the injected value undefined.
 */
@Injectable()
export class KontroliaAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExpressRequest & { kontrolia?: unknown }>();
    const permission = Reflect.getMetadata(PERMISSION_KEY, context.getHandler()) as string | undefined;

    try {
      const verified = permission
        ? await requirePermission(toFetchRequest(request), kontroliaConfig, permission)
        : await verifyRequest(toFetchRequest(request), kontroliaConfig);
      request.kontrolia = verified;
      return true;
    } catch (error) {
      if (error instanceof Response) {
        if (error.status === 403) throw new ForbiddenException(await error.text());
        throw new UnauthorizedException(await error.text());
      }
      throw error;
    }
  }
}
