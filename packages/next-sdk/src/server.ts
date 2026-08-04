// Re-exported for backward compatibility and Next.js-flavored discoverability
// — the actual implementation is framework-agnostic (plain Fetch API
// Request + jose) and lives in @kontrolia/auth/server so Express/NestJS
// examples don't need to depend on Next.js at all.
export {
  verifyRequest,
  requirePermission,
  type VerifyRequestConfig,
  type VerifiedRequest,
} from "@kontrolia/auth/server";
