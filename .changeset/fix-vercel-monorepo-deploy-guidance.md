---
"create-kontrolia-auth": patch
---

Fixed the installer's Vercel/Railway deployment instructions — they previously told you to `cd apps/auth-server` (or `apps/admin-panel`) before running `vercel`/`railway init`, which uploads only that subfolder in isolation. Without the repo root's `pnpm-lock.yaml` and sibling `@kontrolia/*` packages, the cloud build falls back to `npm install` and fails with `Unsupported URL Type "workspace:"`. The instructions now lead with connecting the repo via each platform's dashboard (Root Directory set to the app folder, always builds from the full repo), with the CLI path as a documented alternative that explicitly warns against running it from inside the app subfolder.
