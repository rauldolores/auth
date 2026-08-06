# create-kontrolia-auth

## 1.1.2

### Patch Changes

- Updated dependencies [1c3cd5a]
  - @kontrolia/db@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies [9e10f4f]
  - @kontrolia/db@1.1.0

## 1.1.0

### Minor Changes

- 564595f: The installer now registers your admin panel as an OAuth 2.1 client automatically (when your Supabase project has GoTrue's OAuth server enabled), writing `NEXT_PUBLIC_OAUTH_CLIENT_ID` for you — this is what lets auth-server and admin-panel stay signed in together across genuinely different domains, not just subdomains. Falls back gracefully (with a note on the manual steps) when the target Supabase project doesn't have that feature enabled.

  Also fixes a real bug for self-hosted Docker installs: `docker/.env`'s `SITE_URL` was only ever written with a fixed `http://localhost:3000` default, before the wizard even asked where auth-server would actually live — answering that question with a different URL left GoTrue silently building redirects (and auth emails) against the wrong host. `SITE_URL` is now kept in sync with your answer.

### Patch Changes

- Updated dependencies [4f661a6]
  - @kontrolia/db@1.0.1
