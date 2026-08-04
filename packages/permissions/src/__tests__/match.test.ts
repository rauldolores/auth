import { describe, expect, it } from "vitest";
import { matchesPermission } from "../match.js";

describe("matchesPermission", () => {
  it("matches an exact key", () => {
    expect(matchesPermission("facturacion.facturas.crear", "facturacion.facturas.crear")).toBe(true);
  });

  it("rejects a different action", () => {
    expect(matchesPermission("facturacion.facturas.crear", "facturacion.facturas.cancelar")).toBe(false);
  });

  it("matches a single-segment wildcard", () => {
    expect(matchesPermission("facturacion.facturas.*", "facturacion.facturas.timbrar")).toBe(true);
    expect(matchesPermission("facturacion.facturas.*", "facturacion.clientes.crear")).toBe(false);
  });

  it("matches a trailing deep wildcard", () => {
    expect(matchesPermission("facturacion.**", "facturacion.facturas.crear")).toBe(true);
    expect(matchesPermission("facturacion.**", "crm.clientes.crear")).toBe(false);
  });

  it("does not match when required key is shorter", () => {
    expect(matchesPermission("facturacion.facturas.*", "facturacion.facturas")).toBe(false);
  });
});
