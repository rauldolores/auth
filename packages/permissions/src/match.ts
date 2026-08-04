/**
 * Matches a granted permission key against a required one.
 *
 * Supports two wildcard forms in the *granted* key:
 *  - "*" matches exactly one segment: "facturacion.facturas.*" grants every
 *    action on facturas.
 *  - a trailing "**" matches the required key's remaining segments,
 *    whatever their count: "facturacion.**" grants everything under
 *    facturacion.
 *
 * The required key is always a concrete "application.resource.action" key —
 * wildcards only make sense on the granted side.
 */
export function matchesPermission(granted: string, required: string): boolean {
  if (granted === required) return true;

  const grantedSegments = granted.split(".");
  const requiredSegments = required.split(".");

  for (let i = 0; i < grantedSegments.length; i++) {
    const segment = grantedSegments[i];

    if (segment === "**") {
      return i < requiredSegments.length;
    }

    if (i >= requiredSegments.length) return false;
    if (segment !== "*" && segment !== requiredSegments[i]) return false;
  }

  return grantedSegments.length === requiredSegments.length;
}

export function matchesAnyGrantedPermission(grantedKeys: string[], required: string): boolean {
  return grantedKeys.some((granted) => matchesPermission(granted, required));
}
