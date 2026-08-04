# @kontrolia/permissions

Motor de evaluación de RBAC framework-agnóstico para [KontrolIA Auth](https://github.com/rauldolores/auth): `hasPermission()`/`hasRole()` con soporte de wildcards jerárquicos (`facturacion.facturas.*`, `facturacion.**`). Sin dependencias de React ni de ningún framework — lo usan tanto los SDKs cliente como el servidor.

## Instalación

```bash
npm install @kontrolia/permissions
```

## Uso

```ts
import { createPermissionChecker } from "@kontrolia/permissions";

const checker = createPermissionChecker({
  roles: ["owner"],
  permissions: ["facturacion.facturas.crear", "facturacion.facturas.*"],
});

checker.hasPermission("facturacion.facturas.crear"); // true
checker.hasPermission(["facturacion.facturas.crear", "crm.clientes.ver"], "all"); // false — falta el segundo
checker.hasRole("owner"); // true
```

Un `*` matchea exactamente un segmento; un `**` al final de un permiso concedido matchea cualquier resto de segmentos.

## Documentación

Ver la [guía completa](https://github.com/rauldolores/auth) del monorepo.
