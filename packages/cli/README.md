# create-kontrolia-auth

Wizard de instalación. Dos preguntas independientes (ver la sección "Desacoplamiento clave" del plan de arquitectura):

1. **¿De dónde sale tu Supabase?** Proyecto existente (pegas URL/keys, sin Docker) o uno nuevo self-hosted (genera `docker/.env` con secretos reales).
2. **¿Dónde despliegas `auth-server`/`admin-panel`?** Docker, Vercel, Coolify, Railway u otro — genera los `.env.local` correspondientes.

## Uso

```bash
git clone <tu-fork-de-kontrolia-auth>
cd kontrolia-auth
pnpm install
pnpm --filter create-kontrolia-auth dev
```
