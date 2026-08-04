import type { PermissionKey } from "./types.js";

/**
 * Permission keys are dot-separated hierarchies:
 * "<application>.<resource>.<action>", e.g. "facturacion.facturas.crear".
 */
export interface ParsedPermissionKey {
  application: string;
  resource: string;
  action: string;
}

export function parsePermissionKey(key: PermissionKey): ParsedPermissionKey {
  const segments = key.split(".");
  if (segments.length !== 3) {
    throw new Error(
      `Invalid permission key "${key}": expected "<application>.<resource>.<action>"`,
    );
  }
  const [application, resource, action] = segments as [string, string, string];
  return { application, resource, action };
}

export function buildPermissionKey(parts: ParsedPermissionKey): PermissionKey {
  return `${parts.application}.${parts.resource}.${parts.action}`;
}
