---
"create-kontrolia-auth": minor
---

Added `npx create-kontrolia-auth update` for anyone who already installed via a self-hosted clone and wants to pull the latest code and apply new migrations, instead of doing it by hand. Refuses to touch a working tree with uncommitted local changes, and only fast-forwards from `origin/main` — if history has diverged it stops and points at git rather than guessing. (Consuming `@kontrolia/*` as npm dependencies in your own app is a separate path — update those like any other dependency and re-run your own migration step.)
