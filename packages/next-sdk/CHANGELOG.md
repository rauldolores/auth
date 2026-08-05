# @kontrolia/next

## 1.1.0

### Minor Changes

- 564595f: Add support for keeping auth-server and any other app sharing a KontrolIA Auth session (e.g. admin-panel) signed in together, regardless of how they're deployed:

  - `cookieDomain` client config option (`@kontrolia/auth`, `@kontrolia/next`) for SSO across subdomains of one domain — set once, the session cookie is shared automatically.
  - Native OAuth 2.1 Server support (GoTrue's authorization-code + PKCE flow) for SSO across genuinely different domains, where a shared cookie is impossible by design: `buildOAuthServerAuthorizeUrl()`, `exchangeOAuthServerCode()`, `getOAuthAuthorizationDetails()`, `decideOAuthAuthorization()` in `@kontrolia/auth`, all exposed through `useAuth()` in `@kontrolia/react`.

### Patch Changes

- Updated dependencies [564595f]
  - @kontrolia/auth@1.1.0
