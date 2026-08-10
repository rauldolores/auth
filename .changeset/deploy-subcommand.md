---
"create-kontrolia-auth": minor
---

Added `npx create-kontrolia-auth deploy` — jumps straight to the deployment step (URLs, OAuth client registration, `.env.local` generation, and the Vercel auto-create offer) without repeating the database or application questions. For anyone who already has everything running and just wants to (re)connect a deploy target — e.g. adding admin-panel to Vercel after auth-server was already deployed, without re-entering Supabase credentials through the full install flow.
