import { requirePermission } from "@kontrolia/auth/server";
import express, { type NextFunction, type Request, type Response } from "express";
import { toFetchRequest } from "./to-fetch-request.js";

const app = express();
const port = Number(process.env.PORT ?? 5001);
const kontroliaConfig = { supabaseUrl: process.env.SUPABASE_URL! };

/**
 * No supabase-js, no JWT parsing, no JWKS handling in this file — that's
 * the whole point of the SDK. requirePermission() throws a standard
 * Response on 401/403, translated to Express's res below.
 */
async function handleAuthError(error: unknown, res: Response): Promise<boolean> {
  if (error instanceof Response) {
    res.status(error.status).json({ error: await error.text() });
    return true;
  }
  return false;
}

app.get("/api/facturas", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { claims } = await requirePermission(toFetchRequest(req), kontroliaConfig, "facturacion.facturas.crear");
    res.json({ ok: true, message: `Autorizado — usuario ${claims.sub} tiene facturacion.facturas.crear` });
  } catch (error) {
    if (!(await handleAuthError(error, res))) next(error);
  }
});

app.listen(port, () => {
  console.log(`[example-express] listening on http://localhost:${port}`);
});
