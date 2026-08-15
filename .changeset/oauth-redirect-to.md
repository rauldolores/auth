---
"@kontrolia/ui": patch
---

`GoogleLoginButton`/`MicrosoftLoginButton` (and `LoginForm`/`RegisterForm`, which render them) now accept an optional `redirectTo` prop, forwarded to `loginWithOAuth()`. Previously there was no way to preserve a `redirect_to` destination through the Google/Microsoft login path — the OAuth buttons always fell back to the SDK's bare default (`${origin}/auth/callback`, no onward target), silently dropping wherever the caller was trying to go.
