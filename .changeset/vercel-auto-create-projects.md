---
"create-kontrolia-auth": minor
---

The installer can now create both Vercel projects for you via the Vercel REST API instead of walking you through the dashboard or CLI by hand — the exact fields that were easy to get wrong doing this manually (`rootDirectory`, the connected GitHub repo, environment variables) are just set correctly in one request. Offered automatically when you pick Vercel as the deploy target and the repo has a GitHub remote; only needs a Vercel API token (from vercel.com/account/tokens, never persisted). Falls back to the existing manual instructions if declined, if there's no GitHub remote yet, or if project creation fails for either app.
