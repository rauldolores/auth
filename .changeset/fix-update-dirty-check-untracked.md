---
"create-kontrolia-auth": patch
---

Fixed `npx create-kontrolia-auth update` refusing to run when the working tree had untracked files it had never seen edited — a stray `.vercel/` folder left behind by a manual `vercel` deploy attempt was enough to trip it, even with zero actual local edits. The dirty-tree guard now only blocks on modifications to files git already tracks (untracked files can't be silently discarded by `git pull` anyway — it refuses on its own if one would collide with an incoming file). Also added `.vercel` to `.gitignore`, since it's a normal by-product of deploying from this monorepo and was never meant to be tracked.
