# API Catalog

## GET /api/oauth-clients

- **Method:** GET
- **Path:** `/api/oauth-clients`
- **Purpose:** List registered OAuth clients (proxies GoTrue's admin OAuth API).
- **Authentication:** Session JWT, `is_platform_admin` claim required.
- **Scopes:** N/A (no scope system).
- **Request:** No parameters.
- **Response:** GoTrue's own client-list shape, passed through.
- **Errors:** 401 unauthenticated; 403 non-platform-admin; 502 if GoTrue unreachable.
- **Pagination:** N/A (delegates entirely to GoTrue's own list response).
- **Rate limiting:** None.
- **Idempotency:** N/A (GET).

## POST /api/oauth-clients

- **Method:** POST
- **Path:** `/api/oauth-clients`
- **Purpose:** Register a new OAuth client.
- **Authentication:** Session JWT, `is_platform_admin` claim required.
- **Scopes:** N/A.
- **Request:** `{ client_name: string (required), redirect_uris: string[] (required, non-empty) }`.
  `client_type` is hardcoded to `"public"` and `token_endpoint_auth_method` to `"none"` —
  caller cannot choose confidential-client mode. `redirect_uris` values are not format/
  scheme/host-validated (`INT-API-003`).
- **Response:** GoTrue's created-client object, passed through (includes `client_id`).
- **Errors:** 400 missing required fields; 401/403 as above; 404/other GoTrue error codes
  normalized into `.error` (see `oauth-clients.test.ts`); 502 if GoTrue unreachable.
- **Pagination:** N/A.
- **Rate limiting:** None (`INT-SEC-001`).
- **Idempotency:** Not idempotent — repeated POSTs create distinct clients (GoTrue-side).

## PUT /api/oauth-clients?clientId=

- **Method:** PUT
- **Path:** `/api/oauth-clients?clientId={id}` (query string, not a path segment — `INT-API-002`)
- **Purpose:** Edit an existing OAuth client's name/redirect URIs.
- **Authentication:** Session JWT, `is_platform_admin` claim required.
- **Scopes:** N/A.
- **Request:** `{ client_name: string, redirect_uris: string[] }`. Cannot change `client_type` or
  `token_endpoint_auth_method` post-creation.
- **Response:** GoTrue's updated-client object.
- **Errors:** 400 missing `clientId` query param or body fields; 401/403 as above.
- **Pagination:** N/A.
- **Rate limiting:** None.
- **Idempotency:** Idempotent (full replace of name/redirect_uris).

## (No DELETE) /api/oauth-clients

- **Status:** Does not exist. No way to revoke/decommission a registered OAuth client via API or
  admin-panel UI. See `INT-API-001`.

## POST /api/applications/sync

- **Method:** POST
- **Path:** `/api/applications/sync`
- **Purpose:** Machine-to-machine endpoint (deploy pipeline) to register/update an application's
  name/environment and upsert its permission catalog. Never deletes existing permissions.
- **Authentication:** Bearer `kapp_...` API key, per-application, SHA-256-hashed at rest,
  compared via `timingSafeEqual`. Not session/JWT-based.
- **Scopes:** N/A — one key grants full control of that one application's sync surface (no
  narrower scope exists or is currently warranted, see manifest).
- **Request:** `{ slug: string (required), name?: string, environment?: string, permissions:
  { resource: string, action: string }[] (required) }`.
- **Response:** `{ applicationId: string, permissionKeys: string[] }`.
- **Errors:** 401 missing/invalid Authorization header or wrong key; 400 missing `slug`/
  `permissions`; 404 unknown slug; 403 application has no key issued yet; 500 on a permission
  upsert failure (logged) — but a `name`/`environment` update failure is silently swallowed and
  still returns 200 (`PQ-TECH-008`, already tracked by Professional Review, cross-referenced here).
- **Pagination:** N/A.
- **Rate limiting:** None (`INT-SEC-001`).
- **Idempotency:** Effectively idempotent for permissions (upsert on conflict `key`); re-running
  with the same slug/permissions produces the same end state.
- **Observability:** Failed/invalid-key attempts and successful syncs are not logged at all —
  only permission-upsert errors are (`INT-KEY-002`).
