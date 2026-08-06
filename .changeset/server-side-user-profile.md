---
"@kontrolia/auth": minor
"@kontrolia/shared": minor
---

`verifyRequest()`/`requirePermission()` (`@kontrolia/auth/server`) now return a `user` field alongside `claims`/`checker` — the same `KontroliaUser` shape `useAuth().user` gives client-side (`email`, `fullName`, `avatarUrl`, `locale`, `timezone`), read straight out of the already-verified token with no extra query. Useful for a server-side `/api/auth/me`-style endpoint that needs to hydrate a user profile without a round trip to the database. `lastSeenAt` is always `null` here — it's the one field GoTrue doesn't put in the access token.

`KontroliaTokenClaims` (`@kontrolia/shared`) is now properly typed with the `email`/`user_metadata` claims every Supabase-issued token already carries — previously only accessible via the type's index signature.

Also exports `getUserFromClaims()` for mapping claims to a `KontroliaUser` outside of `verifyRequest()`.
