---
"@kontrolia/db": minor
---

Nuevas migraciones para soportar editar/eliminar organizaciones desde auth-server y un "launcher" de aplicaciones por organización:

- `is_org_owner()` + política de DELETE en `organizations` (solo el Owner puede eliminar — a diferencia de `is_org_admin()`, que incluye Admin, para operaciones normales).
- Columna `applications.homepage_url` (dónde vive la app para un usuario final, distinto de `redirect_urls` que son URIs de OAuth) + política de UPDATE para admins de la organización dueña de la aplicación.
- Corrige los triggers de audit log (`log_membership_change`, `log_role_assignment_change`) para que no truenen con una violación de foreign key al eliminar una organización: ambos intentaban insertar un registro nuevo referenciando la organización que se está borrando en ese mismo cascade.
