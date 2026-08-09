---
"create-kontrolia-auth": minor
---

`npx create-kontrolia-auth mi-app` is now a genuinely turnkey installer instead of assuming you're already inside a clone of the repo: it checks requirements (Node, pnpm, git/Docker) with plain-language install hints for anything missing, clones the repo into the target folder and runs `pnpm install` for you, and — for the self-hosted database path — brings up `docker compose` and retries the migration until Postgres finishes booting instead of asking you to confirm it's ready by hand. Also adds `migrate` and `doctor` subcommands, and Render as a deployment target alongside the existing Vercel/Railway/Coolify/Docker/manual instructions.
