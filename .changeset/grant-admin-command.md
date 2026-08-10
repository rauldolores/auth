---
"create-kontrolia-auth": minor
"@kontrolia/db": minor
---

Nuevo comando `npx create-kontrolia-auth grant-admin <email>` — otorga platform admin directo contra la base de datos (misma connection string que `migrate`), sin pasar por login. Es la única vía de recuperación cuando una instalación se queda sin ningún platform admin: por ejemplo, al instalar sobre un proyecto Supabase que ya tenía usuarios de otra aplicación, el trigger que asciende automáticamente "al primer usuario" nunca dispara (cuenta filas de `auth.users`, que es compartida por todo el proyecto Supabase, no solo por KontrolIA Auth) — y la página "Platform admins" del admin-panel no se puede usar para arreglarlo porque requiere ya ser platform admin.
