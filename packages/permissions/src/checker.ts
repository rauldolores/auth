import { matchesAnyGrantedPermission } from "./match.js";

export interface PermissionSource {
  roles: string[];
  permissions: string[];
}

export type EvaluationMode = "any" | "all";

export interface PermissionChecker {
  hasPermission(required: string | string[], mode?: EvaluationMode): boolean;
  hasRole(required: string | string[], mode?: EvaluationMode): boolean;
}

function evaluate(required: string | string[], mode: EvaluationMode, test: (key: string) => boolean): boolean {
  const keys = Array.isArray(required) ? required : [required];
  if (keys.length === 0) return true;
  return mode === "all" ? keys.every(test) : keys.some(test);
}

/**
 * Builds a checker bound to a decoded token's roles/permissions claims.
 * Used identically by @kontrolia/react (client-side, against the decoded
 * JWT) and by server-side code (auth-server, admin-panel) evaluating
 * against roles/permissions freshly loaded from the database.
 */
export function createPermissionChecker(source: PermissionSource): PermissionChecker {
  return {
    hasPermission(required, mode = "any") {
      return evaluate(required, mode, (key) => matchesAnyGrantedPermission(source.permissions, key));
    },
    hasRole(required, mode = "any") {
      return evaluate(required, mode, (key) => source.roles.includes(key));
    },
  };
}
