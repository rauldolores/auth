---
"create-kontrolia-auth": patch
---

`npx create-kontrolia-auth deploy` ya no pide de nuevo la URL/anon key/service role key de Supabase en cada corrida — las reutiliza desde `apps/auth-server/.env.local` (escrito en una instalación o despliegue anterior) si están ahí, con opción de capturar otras. Las URLs de auth-server/admin-panel y el dominio de cookie compartido también quedan pre-llenados con lo último guardado, editable en vez de tener que reescribirlo.
