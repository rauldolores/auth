import { SignJWT } from "jose";

/**
 * Mints local anon/service_role keys for the self-hosted docker-compose
 * path — these are just HS256 JWTs signed with the project's JWT_SECRET,
 * the same scheme Supabase's own key generator uses.
 */
export async function generateSupabaseKeys(jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret);
  const issuedAt = Math.floor(Date.now() / 1000);
  const tenYears = 10 * 365 * 24 * 60 * 60;

  const sign = (role: "anon" | "service_role") =>
    new SignJWT({ role, iss: "kontrolia-auth" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + tenYears)
      .sign(secret);

  return {
    anonKey: await sign("anon"),
    serviceRoleKey: await sign("service_role"),
  };
}
