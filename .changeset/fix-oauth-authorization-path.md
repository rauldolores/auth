---
"create-kontrolia-auth": patch
---

Corrige el valor de `oauth_server_authorization_path` que la automatización de Supabase Cloud enviaba al activar el servidor OAuth 2.1: era `/oauth/authorize` (la propia API interna de GoTrue, fija y no configurable) cuando debía ser `/oauth/consent` — la ruta en auth-server donde GoTrue redirige al usuario para mostrar la pantalla de consentimiento. `docker/docker-compose.yml` (self-hosted) siempre tuvo el valor correcto; el error estaba solo en la llamada a la Management API. Con el valor incorrecto, activar el servidor OAuth no daba ningún error, pero cada intento de autorización real fallaba silenciosamente al redirigir a una ruta que nada atiende.
