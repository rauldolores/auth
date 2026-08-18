# @kontrolia/next

## 1.1.3

### Patch Changes

- Updated dependencies [1aa8b7f]
  - @kontrolia/auth@2.1.0

## 1.1.2

### Patch Changes

- Updated dependencies [da0ba79]
  - @kontrolia/auth@2.0.0

## 1.1.1

### Patch Changes

- Updated dependencies [9105753]
- Updated dependencies [1c3cd5a]
- Updated dependencies [d247ebb]
  - @kontrolia/auth@1.2.0

## 1.1.0

### Minor Changes

- 564595f: Add support for keeping auth-server and any other app sharing a KontrolIA Auth session (e.g. admin-panel) signed in together, regardless of how they're deployed:

  - `cookieDomain` client config option (`@kontrolia/auth`, `@kontrolia/next`) for SSO across subdomains of one domain — set once, the session cookie is shared automatically.
  - Native OAuth 2.1 Server support (GoTrue's authorization-code + PKCE flow) for SSO across genuinely different domains, where a shared cookie is impossible by design: `buildOAuthServerAuthorizeUrl()`, `exchangeOAuthServerCode()`, `getOAuthAuthorizationDetails()`, `decideOAuthAuthorization()` in `@kontrolia/auth`, all exposed through `useAuth()` in `@kontrolia/react`.

### Patch Changes

- Updated dependencies [564595f]
  - @kontrolia/auth@1.1.0
