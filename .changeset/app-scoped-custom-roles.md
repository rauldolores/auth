---
"@kontrolia/db": minor
---

Custom roles now belong to exactly one application instead of being able to span several — each enabled application can define its own catalog of roles (e.g. "Facturación → Contador"), and a membership can hold at most one role per application (enforced by a new trigger). Enabling an application for an organization now also auto-creates an "Administrador de `<app>`" role holding every permission that application currently declares; it stays in sync automatically whenever the application registers a new permission, so nobody has to remember to re-grant it by hand. The 3 global system roles (Owner/Admin/Member) are unchanged — still organization-wide, shared, and immutable.
