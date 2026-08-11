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
- **Observability:** `logSecurityEvent()` now fires on every rejection branch (no-key-configured,
  invalid-key, rate-limited); `api_key_last_used_at` touched on every successful auth
  (`INT-KEY-002`, closed 2026-08-11, commit 585b646).

## GET /api/applications/members

- **Method:** GET
- **Path:** `/api/applications/members`
- **Purpose:** List the members of the calling application's own organization
  (`applications.owner_organization_id`), with resolved emails and role assignments.
- **Authentication:** Bearer `kapp_...` API key (same key as `/sync`) + `X-Application-Slug`
  header to identify which application (GET has no body to carry a slug in).
- **Scopes:** N/A — one key grants full member-management control of that one application's own
  organization.
- **Request:** Query param `offset` (optional, default 0, page size 100).
- **Response:** `{ members: { membershipId, userId, email, status, createdAt, roles }[], hasMore }`.
- **Errors:** 401 missing/invalid key; 400 missing `X-Application-Slug`; 404 unknown slug; 403
  application has no key issued yet; 409 application has no `owner_organization_id`; 429 rate
  limited.
- **Pagination:** Offset-based, page size 100, same convention as `/api/organization-members`.
- **Rate limiting:** 30 req/5 min per IP, independently keyed from the other 3 operations on this
  route family.
- **Idempotency:** N/A (GET).
- **Tenant isolation:** Every query explicitly filtered by `application.ownerOrganizationId` — the
  admin/service-role client bypasses RLS, so this filter is the entire boundary, not a backstop.

## POST /api/applications/members (invite)

- **Method:** POST
- **Path:** `/api/applications/members`
- **Purpose:** Create an invitation to the calling application's own organization. Same
  `kontrolia_auth.invitations` table and no-email-provider contract as `POST /api/invitations`
  (returns the token for the caller to deliver however it already sends mail), gated by
  application API key instead of a user session.
- **Authentication:** Same as GET above.
- **Scopes:** N/A.
- **Request:** `{ email: string (required), roleId?: string }`.
- **Response:** `{ invitation: { id, email, token, expires_at } }`, 201.
- **Errors:** 400 missing `email`; 403 `roleId` is the Owner system role, or a custom role
  belonging to a different organization (`loadAssignableRole()`); 404 `roleId` doesn't exist; same
  auth/rate-limit errors as GET.
- **Pagination:** N/A.
- **Rate limiting:** 30 req/5 min per IP, independently keyed.
- **Idempotency:** Not idempotent — repeated calls create distinct invitations (matches
  `POST /api/invitations`; no `(organization_id, email)` uniqueness constraint exists, tracked
  separately as `PQ-TECH-003`).
- **Security:** Granting the Owner role is rejected at the application layer — the database's own
  `prevent_admin_granting_owner_role` trigger exempts `service_role` (needed for org-bootstrap),
  so this is the actual enforcement point for this caller. Backstopped at the database layer too:
  migration 0033's `prevent_owner_role_invitation` trigger rejects an owner-role invitation
  regardless of caller, closing an incidental gap found in `POST /api/invitations/accept` while
  designing this endpoint (see the migration's own comment).

## DELETE /api/applications/members/{membershipId}

- **Method:** DELETE
- **Path:** `/api/applications/members/{membershipId}`
- **Purpose:** Remove a member from the calling application's own organization.
- **Authentication:** Same as GET above.
- **Response:** 204 on success.
- **Errors:** 404 membership doesn't exist *or* belongs to a different organization (identical
  response either way — no cross-org existence probing); 400 surfaces the database's own
  last-owner-removal trigger message verbatim when applicable; same auth/rate-limit errors as GET.
- **Rate limiting:** 30 req/5 min per IP, independently keyed.
- **Idempotency:** Deleting an already-deleted/nonexistent membership returns 404, not a
  false-positive 204.
- **Security:** No application-layer last-owner check needed —
  `prevent_last_owner_membership_removal` (migration 0026, re-anchored in 0030) has no
  `service_role` exemption, unlike the owner-*grant* trigger, so it protects this delete for every
  caller including this API. Live-verified: attempting to remove the sole active Owner is blocked
  with the same Spanish error message the admin-panel UI surfaces.

## PATCH /api/applications/members/{membershipId} (roles)

- **Method:** PATCH
- **Path:** `/api/applications/members/{membershipId}`
- **Purpose:** Grant and/or revoke role assignments for a member of the calling application's own
  organization.
- **Authentication:** Same as GET above.
- **Request:** `{ grant?: string[], revoke?: string[] }` (role ids) — at least one required.
- **Response:** `{ roles: { id, name, slug }[] }` — the member's roles after the mutation.
- **Errors:** 400 neither `grant` nor `revoke` provided, or a revoke targets a nonexistent role;
  403 a `grant` role id is the Owner system role or a custom role from a different organization;
  404 membership not found / not in this org, or a `grant` role id doesn't exist; 400 surfaces the
  database's last-owner-role-removal trigger message verbatim on a blocked revoke.
- **Rate limiting:** 30 req/5 min per IP, independently keyed.
- **Idempotency:** Grant uses `upsert` (`onConflict: "membership_id,role_id"`) — re-granting an
  already-held role is a no-op, not an error.
- **Security:** Same Owner-grant rejection as the invite endpoint, same reasoning
  (`service_role` bypasses the DB trigger, so this route is the enforcement point). Revoking Owner
  is left to the database (`prevent_last_owner_role_removal`, no `service_role` exemption) — both
  paths live-verified against the sandbox: granting Owner to a non-Owner member returns 403;
  revoking Owner from the organization's sole active Owner returns 400 with the database's own
  message.
