---
"create-kontrolia-auth": minor
---

Cuando conectas un proyecto Supabase Cloud existente, el instalador ahora ofrece configurar automáticamente los dos ajustes que antes eran 100% manuales — exponer el schema `kontrolia_auth` en la API de datos y activar el Custom Access Token Hook — vía la Management API de Supabase. Pide un Personal Access Token de tu cuenta (distinto a las keys del proyecto, no se guarda). Si lo saltas, o si el proyecto es self-hosted/dominio propio (sin Management API), sigue mostrando las instrucciones manuales exactas para lo que falte.
