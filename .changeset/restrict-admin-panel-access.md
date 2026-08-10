---
"@kontrolia/admin-panel": minor
---

El admin-panel ahora restringe el acceso a usuarios con rol de sistema Owner o Admin en la organización activa (o platform admins, sin importar su rol en esa organización) — antes, cualquier usuario autenticado, incluyendo Members, podía ver el menú completo y todas las páginas. Los roles personalizados por aplicación (p. ej. "Administrador de Facturación") no cuentan para este filtro: esos otorgan permisos dentro de esa aplicación, no acceso a la consola de administración. Quien no califica ve una pantalla "Sin acceso al panel" mientras conserva el selector de organización, por si pertenece a otra donde sí tiene el rol correcto.
