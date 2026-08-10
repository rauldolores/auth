---
"create-kontrolia-auth": minor
---

La automatización de configuración de Supabase Cloud (schema expuesto + Custom Access Token Hook) ahora también activa el servidor OAuth 2.1 de GoTrue en el mismo paso — la función que hace posible que otras aplicaciones, en dominios distintos, inicien sesión contra tu auth-server. Antes solo se podía activar a mano desde el Dashboard (si el proyecto ya tenía el toggle disponible, por ser una función en beta); ahora usa el mismo Personal Access Token y la misma llamada a la Management API que ya se pedía para el hook.
