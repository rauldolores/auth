---
"create-kontrolia-auth": patch
---

Cuando conectas un proyecto Supabase existente, el instalador ahora también avisa que hay que agregar `kontrolia_auth` a "Exposed schemas" en Dashboard → Project Settings → Data API (además del Custom Access Token Hook que ya avisaba). Sin ese paso, cualquier operación contra el schema (crear una organización, etc.) falla con `Invalid schema: kontrolia_auth` — un error de PostgREST poco descriptivo que antes no quedaba explicado en ningún lado del flujo.
