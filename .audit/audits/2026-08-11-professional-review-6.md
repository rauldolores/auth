# Professional Quality Review Audit

## Date
2026-08-11T21:23:00

## Skill
kontrolia-professional-review

## Scope
Scoped review, not a full-app re-walk: the application registration/ownership
lifecycle, prompted by a user question about why admin-panel's applications
page has no "create application" UI, only Rotar/Revocar for an application
that already has an owner. Specifically: (1) is there any product-driven path
that assigns `kontrolia_auth.applications.owner_organization_id`; (2) what
depends on that column being set; (3) is this a real defect and how severe.
UX/UI/Accessibility/Performance/Maintainability were not re-walked this round
— their scores below are carried forward unchanged from round 8
(2026-08-11T21:00:00). Static code inspection (source reads + exhaustive
grep across `apps/` and `packages/db/src`) plus live confirmation against the
running local Supabase sandbox — no browser session needed, this is a
data/authorization-flow question, not a UI-rendering one.

## Quality Score
UX 73/100 (uncapped, unchanged, not re-walked) /
UI 82/100 (uncapped, unchanged, not re-walked) /
Technical 70/100 (uncapped — down from 78. PQ-TECH-010, new this round: three
real, shipped, independently-tested capabilities — migration 0022's
owning-org UPDATE policy, the rotate/revoke API-key UI, and this session's
new `/api/applications/members` API — are all gated on a column
[`owner_organization_id`] that no code path in the repo ever writes, making
them practically unreachable in a genuinely fresh deployment. Not held as
low as round 7's 66 [zero test coverage on an entire layer] because this is a
single, narrowly-scoped, well-understood architectural gap with an obvious
fix shape, not a systemic absence — but it is a real, newly-open HIGH, so it
can't sit at round 8's 78 either) /
Security 84/100 (uncapped, unchanged — this finding fails closed, nothing
leaks or escalates, so it does not touch the Security dimension) /
Performance 76/100 (uncapped, unchanged, not re-walked) /
Accessibility 68/100 (uncapped, unchanged, not re-walked) /
Maintainability 70/100 (uncapped, unchanged, not re-walked — this finding is
scored under TECHNICAL per its assigned category, not MAINTAINABILITY) /
**Overall 75/100**

## Critical Issues
None open (unchanged from round 8).

## High Issues
1 open (up from 0 — round 8 was the first zero-CRITICAL/zero-HIGH round of
the entire 8-round Phase 2 sequence; this scoped round reopens exactly one,
in a different area from anything closed that day):

- **PQ-TECH-010** (new) — `applications.owner_organization_id` is never
  written by any code path anywhere in the repo. Confirmed by reading
  `packages/db/src/register-application.ts`'s INSERT statement (the column is
  simply absent from it), `packages/cli/src/steps/application.ts`
  (`askApplicationStep()` takes no organization parameter — it can't set what
  it never asks for), and every RLS policy ever defined on
  `kontrolia_auth.applications` across all 33 migrations (zero INSERT policy
  exists at all; the one UPDATE policy from migration 0022 itself requires
  `owner_organization_id is not null`, so it can never fire for a
  freshly-registered application either — a chicken-and-egg gap structurally
  identical in shape to this session's earlier PQ-SEC-006-class org-bootstrap
  bugs, except here nothing ever breaks the cycle). Practical effect,
  confirmed live against the sandbox: `INT-KEY-001`'s admin-panel rotate/
  revoke UI and this session's new `/api/applications/members` API are both
  correctly built and were both independently verified working earlier
  today — but only because their test data was set up via a direct
  `docker exec psql UPDATE` statement, not through any real product flow. No
  application registered the intended way (CLI wizard) can ever reach that
  state. Not a security hole (fails closed) and the underlying permission-
  catalog-sync flow via `/api/applications/sync` is unaffected (it never
  depended on this column) — but it is a shipped, tested feature area a real
  user can never actually reach, the specific "looks done but isn't" pattern
  this skill exists to catch.

## Medium Issues
24 open, unchanged this round (not re-walked): PQ-SEC-002, PQ-UX-008/009/
010/011, PQ-A11Y-002-006, PQ-PERF-004-007, PQ-MAINT-001-004, PQ-TECH-003-008.

## MVP Smells
One new smell this round, matching this checklist's own "looks finished but
isn't" framing precisely: a feature (application ownership/key management)
that has real UI, real API, real tests, and a real "VERIFIED" audit history
entry (`INT-KEY-001`) — but is unreachable by an actual user through any
product-intended flow. Everything else carried forward unchanged from round
6's sweep, not re-checked this round.

## Evidence
- `packages/db/src/register-application.ts:41-71` — full read; the INSERT
  into `kontrolia_auth.applications` lists `(name, slug, environment,
  api_key_hash)` only.
- `packages/cli/src/steps/application.ts:16-119` — full read; its own comment
  states "kontrolia_auth.applications/permissions have no write policy for
  regular users... and no admin API exists yet for it."
- `packages/db/migrations/0010_rls_policies.sql`, `0018_org_admins_manage_
  applications.sql`, `0022_application_homepage_url.sql`, `0032_application_
  api_key_lifecycle.sql` — every policy/grant ever written on this table,
  read in full; grepped all 33 migrations for an INSERT policy on
  `applications` and found none.
- `apps/admin-panel/app/applications/page.tsx:323,351,360` — every
  owner-gated UI control conditioned on `app.owner_organization_id ===
  organization.id`.
- Exhaustive grep, `owner_organization_id` across `apps/` and
  `packages/db/src`: only read sites found (RLS policies, admin-panel UI, the
  new members API's tenant-isolation filter) — zero write sites.
- Live query against the running local Supabase sandbox: exactly one
  application row (`facturacion`) has a non-NULL `owner_organization_id`,
  set via a direct SQL `UPDATE` while preparing test data earlier this
  session for `INT-KEY-001`/the new members API — not through any product
  flow.

## Required Actions
Not blocking a ship decision on its own (nothing broken/insecure), but
directly undermines the real-world usability of two features already marked
`VERIFIED` (`INT-KEY-001`) or just-shipped (the new members API) — recommend
prioritizing this before either is meaningfully useful to a real self-hosted
deployment. Suggested fix shape (not yet authorized/built): a platform-
admin-gated "claim ownership" action, consistent with migration 0010's own
comment that the application catalog is "platform-level, managed via
service_role" — rather than opening self-service application creation to
any organization, which would be a different, larger authorization decision.
24 unchanged MEDIUM items also remain — see `.audit/review/issues.json`.

## Final Verdict
**PROFESSIONAL BUT NEEDS POLISH** — Overall 75/100. Zero CRITICAL, 1 HIGH
(PQ-TECH-010, newly found this round, in a non-core area — application
ownership/key-management, not the primary login/signup/RLS flow round 8's
zero-HIGH state was actually measuring). This fits the verdict's own
definition ("no CRITICAL issues; at most a small number of HIGH issues in
non-core areas") rather than dropping to NOT PRODUCTION READY, which is
reserved for CRITICAL findings. Per the quality gate's own simpler pass rule
(zero open HIGH/CRITICAL), this scoped finding means Phase 2 no longer
cleanly passes that rule until PQ-TECH-010 closes — worth flagging explicitly
since round 8 had just reported the opposite.
