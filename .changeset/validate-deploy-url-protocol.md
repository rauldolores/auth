---
"create-kontrolia-auth": patch
---

El instalador ahora valida que las URLs de auth-server y admin-panel usen `https://` para un dominio real (`http://` solo se acepta para `localhost`/`127.0.0.1`). Sin esto, un `http://` accidental en un dominio real se colaba silenciosamente en `NEXT_PUBLIC_ADMIN_PANEL_URL`, y como esa variable arma el header CORS `Access-Control-Allow-Origin` de auth-server, el navegador bloqueaba toda llamada de admin-panel hacia auth-server con un "Failed to fetch" genérico — sin ninguna pista de que el problema era un solo carácter (http vs https).
