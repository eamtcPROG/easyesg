# apps/api — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below. Cite it; do not re-derive it.

## Current state

Identity, organization and the reporting core are live (tasks 19 … 36, 89, 91, 130, 131), and so is the
notification core (49) — categories, one mail path, `raise()` and delivery by category — with its store since
50.1.1, each notice recorded once and each delivery a row per recipient and channel; the calculator, validation,
export, the in-app centre's reads and preferences, billing, the console's screens, edge and deploy, the
public tier and the Comprehensive Module are not (37 onward). `docs/archived_tasks.md` says what each closed task
shipped and `docs/task.md` what each remaining one must, `docs/build-log.md` what it cost, and `architecture.md` §12.5.6 holds the decisions. What
follows is what a reader needs in hand: the foundation's guarantees, the live slices' shape, and the
traps each one left — grouped by area rather than by the task that built it.

### The foundation, and what each piece guarantees

- **The request pipeline**: the response envelope, the problem+json filter, `TenantTransactionGuard`
  binding `app.current_org` / `app.current_user` transaction-locally, commit in
  `TransactionInterceptor` and rollback in `ProblemDetailsFilter`, both `DataSource`s registered —
  "The request pipeline" below.
- **The port surface** in `contracts/`, OpenAPI emission diffed by `pnpm openapi:check`, and message
  resolution (`app/messages/`) — locale negotiation plus catalogue lookup over `packages/i18n`'s
  committed catalogues (OQ-43); the api resolves wording because the worker has no client.
- **The migration runner**: §7.1's schemas — five from the baseline, `notification` since task
  50.1.1 — plus `btree_gist`, `core.organization` as the tenant root, applying and reverting
  cleanly from an empty database, with §7's schema invariants asserted by `migrations:check` —
  each proving its own rule bites.
- **RLS `ENABLED` and `FORCED`** from `core.organization` down, proven isolated as both `esg_app`
  and the owning role, with a test that drops `FORCE` in a rolled-back transaction and watches
  isolation collapse.
- **The append-only substrate**: `audit.enforce_append_only(regclass)`; `audit.system_audit_log`
  partitioned, privilege-denied to the application and trigger-guarded against the owner;
  `core.field_change` per-field audit written only by a `SECURITY DEFINER` trigger — the application
  can read its trail and holds no privilege to author, alter or erase one.
- **The outbox**: `audit.outbox_event` and its worker dispatcher onto BullMQ; `MODE=worker` boots,
  polls and dispatches; `OutboxConsumer` is the queue's single `@Processor`, routing by job name to
  whatever claimed it with `@HandlesJob`.
- **The configuration store**: one generic versioned store with a `WITHOUT OVERLAPS` schedule and a
  ≤5 s replica poll, seeded from `config/seed`; it publishes, reverts and propagates by version poll.
- **Secrets at rest**: `SecretCipher` — AES-256-GCM under HKDF from its own `SECRET_ENCRYPTION_KEY`,
  sealed as `v<n>.<base64url>` — applied at the persistence boundary, with the
  `identity.encrypted_secret` domain making plaintext unrepresentable ("Adding a column that holds
  a secret" below).

### Live, by area

- **Identity** (`modules/identity/*` and `platform/admin`; tasks 19 … 28, 130, 131): accounts and
  verification (`POST /auth/{register,verify-email,verification-email}`, Argon2id behind a port,
  `EmailPort` with a logging adapter); sessions and sign-in (`POST/DELETE /auth/session`,
  `POST /auth/session/refresh` — AD-12 as shipped: an HS256 JWT carrying `sub` = session id and
  nothing else, opaque refresh rows rotated by conditional consume with a 30 s race grace and
  reuse-revocation, 7 d idle / 30 d absolute computed at the point of use, OQ-35), password reset,
  §12.5.6's throttle and lockout; the admin realm (`POST /auth/admin/session/challenge` →
  `POST/GET/DELETE /auth/admin/session`, mandatory TOTP over `otpauth`, the `admin:provision` CLI) and A-02's organization register (`GET /admin/organizations`, 67.3); A-08's accounts, invitations and system audit log (`/admin/accounts`, `/admin/invitations`, `GET /admin/audit-log`) and A-20's acceptance (`POST /auth/admin/invitation/{preview,enrolment,acceptance}`), with `AuditInterceptor` (67.4); A-19's own credentials (`GET /admin/credentials`, `POST /admin/credentials/{password,totp/enrolment,totp/confirmation,recovery-codes}`) and the recovery sign-in (`POST /auth/admin/session/recovery`) (144); support access (`GET/POST /admin/support-access`, `POST /admin/organizations/{id}/support-access/{requestId}/end` with its three report reads, `GET /support-access`, `POST /support-access/{requestId}/{grant,decline,end}`) and one register row by id (`GET /admin/organizations/{id}`) (67.9); A-18's identity providers (`GET /admin/identity-providers`, `POST /admin/identity-providers/{provider}/{configuration,enablement,disablement}`) (67.11);
  social sign-in (`POST /auth/social/{provider}/{challenge,session}`, `GET /auth/social/providers`), and the
  setup a provider registration completes (`GET /account/setup`, `POST /account/setup/{password,profile}`,
  `POST /auth/account-setup/password`) (155);
  opt-in TOTP and password change (27); memberships and roles (`GET/PATCH/DELETE /members`,
  `GET /memberships`), and choosing among them (`PUT /session/organization`, 83.1); invitations and acceptance (`GET/POST /invitations`,
  `POST /invitations/{id}/email`, `DELETE /invitations/{id}`,
  `POST /invitations/{preview,acceptance}`); and S-16's union read model (`GET /access`, 131).
- **Organization** (`core/organization`, `core/entity`; task 29): organizations and reporting
  entities, with the country's legal forms and NACE classifier as configuration artefacts.
- **Reporting core** (`platform/taxonomy`, `core/period`, `core/disclosure`, `core/comparatives`;
  tasks 31, 33, 34, 89, 91): the taxonomy registry (`TAXONOMY_REGISTRY` over three `config/seed`
  artefacts per registered version) and its typed facade in `packages/vsme`; reporting periods
  (`GET/POST /periods`, `GET/PATCH /periods/{id}`) with the lock
  (`POST /periods/{id}/{lock,reopening}`, `GET /periods/{id}/reopenings`); the report
  (`GET/POST /reports`, `GET/PATCH /reports/{id}`) carrying its pinned taxonomy; the disclosure
  store and the wizard's step read with applicability, derivations, template defaults and omissions;
  and `GET /reports/{id}/prior-period` (34.3).
- **Not live**: the calculator and validation (37 … 42), preview and export (43 … 47),
  the in-app centre's API and screen, cancellation, the email channel's bounces and suppression, and preferences
  (50 … 52), billing (53 … 66), the console's screens beyond A-02, A-07, A-08, A-18 and A-19 (67 … 70), edge and deploy
  (71 … 73), the public tier (74 … 77), the Comprehensive Module (78 … 81), the advisor domain
  (116 … 121).

### Traps and load-bearing facts, by area

**Identity**

- **Sign-in's use case runs several short transactions and throws only after commit** (task 21) —
  folding it into one `run` rolls back the very counters FR-4 requires; the port header explains.
  The throttle's per-(IP, account) key reads `req.ip`, which is the proxy's address until task 71
  sets `trust proxy` — degraded to per-account, not broken. `AUTH_JWT_SECRET` is the HTTP tier's;
  the worker holds neither it nor the pepper.
- **The admin realm's session is a cookie the api itself sets and rotates** (task 23): the pair
  sealed AES-256-GCM into an httpOnly `SameSite=Strict` cookie, keys HKDF-derived from
  `AUTH_ADMIN_SECRET` under distinct labels; a stateless sealed five-minute challenge cookie whose
  `kind` discriminator keeps it unconfusable with the session under the shared key; CORS pinned to
  `ADMIN_ORIGIN` with credentials and an Origin proof on the realm's writes. TOTP is a thin wrapper
  over `otpauth` — it was hand-rolled until 24 Aug 2026 and `domain/totp.ts`'s header records why
  that was wrong. `admin:provision` runs from `dist/` so `tsc-alias` has resolved `@api/*`. **The
  session is read on every request since task 145** (13 Sep 2026): a signed-out, reuse-revoked or
  deactivated session is refused on its next request, and the identity answered is the account as
  it stands. Until then a revoked session's last access token was honoured ≤15 min — deferred to
  task 28's guard, which closed without it. The read is `findSessionForRequest`, one joined
  statement answering an identity rather than `AdminAccount`, so it opens no TOTP secret; rotation
  and sign-in are the paths that still do. `totp_secret` is **encrypted at rest** (27.1): its type is `identity.encrypted_secret`,
  a domain whose constraint refuses anything but `v<n>.<base64url>`, so plaintext is unrepresentable
  rather than discouraged; the store adapter opens it on the way out and `admin:provision` seals it
  on the way in.
- **The admin realm's own routes go through `AdminRealmGuard`** (task 67.3; §12.5.6's task-67.3 row).
  `@RequiresAdminRole(...)` marks a route `IS_ADMIN_REALM` — which the tenant `AuthGuard` stands aside
  for — and applies the guard, which resolves the sealed cookie through task 145's per-request read,
  re-sets it when it rotates, and answers `insufficient-role` for a role the route does not name. The
  operator is `adminAccountId` in the request context, **never `actorId`**, which is the tenant actor
  field-change capture attributes to. **Reads across organizations go through
  `infrastructure/persistence/admin-readonly.ts`**: `esg_admin_ro` in `READ ONLY` transactions, each
  acquisition written to `audit.support_access_log` first and the read refused if it cannot be — so
  the HTTP tier does not start without `DB_ADMIN_RO_USER` / `DB_ADMIN_RO_PASSWORD`, and CI's image
  job and the browser suite pass them. `test/admin-route-matrix.e2e-spec.ts` is the realm's half of
  the route matrix, derived from `admin:` rows in `src/testing/route-permissions.ts`;
  `test/support/signed-in-operator.ts` signs an operator in through the real handshake.
- **Accounts come from invitations, and their lifecycle is a status** (task 67.4; §12.5.6's task-67.4
  row). `identity.admin_invitation` holds the address, the realm, the token's hash, a 24-hour expiry
  and a staged `totp_secret` (`identity.encrypted_secret`); an account row is written only by the
  acceptance that sets the password and confirms the factor, in one transaction with the claim.
  `admin_account.active` became `status` (`active`, `suspended`, `removed`), the address unique only
  among accounts that are not removed; suspension and removal revoke the account's sessions in the
  same transaction, so a reactivation revives none. **`@RequiresAdminRole` composes `AdminOriginGuard`**
  since this task, so every admin-realm write carries the Origin proof. The log is read through
  `esg_admin_ro` (a platform row is invisible to `esg_app`), logged as an acquisition under
  `system_audit_log`, with column grants on the two realm tables' `(id, email)`.
- **An operator's own credentials, and a way back in without an authenticator** (task 144; §12.5.6's
  task-144 row). **`POST /auth/admin/session/recovery` judges the recovery code before the password** and
  admits a locked account, releasing the lock — swap those two and the lock stops ending password guessing
  while every spec asserting a success stays green; `recover-admin-sign-in.use-case.spec.ts` records the
  hashes the hasher was asked about to hold the order. A-19's four writes re-authenticate, **the
  confirmation of a re-enrolment included**, under one `admin-reauthentication:<ip>:<account>` window that
  feeds no lockout — keyed on the account id, so a test drain by address misses it. A re-enrolment stages
  `admin_account.staged_totp_secret` (sealed) beside the factor in force and promotes it under the row's
  lock. `identity.admin_recovery_code` is the one realm table `esg_app` may `DELETE` from, and codes exist
  only once A-19 issues them. `AdminRealmGuard` writes `adminSessionId` beside `adminAccountId`, for the
  password change that spares the session asking, and `@AuditAction` gains a third target, `operator`.
- **Support access is folded from log rows, and consent is the database's** (task 67.9; §12.5.6's task-67.9 row).
  A request, its grant or decline, an end from either realm and every read under a grant are each one row in
  `audit.support_access_log`, and a request's state — awaiting, active, declined, lapsed, ended, expired — is computed
  from those rows against the clock, so nothing expires by a job. **The platform insert policy never admits a grant or
  a decline**, and the organization insert policy admits one only for the bound organization with the bound member as
  actor, so no defect above the database can grant on an organization's behalf. **A read under a grant runs the
  organization's own `ReportService` and `WizardService`** inside a READ ONLY transaction bound to that organization,
  which `SupportAccessGrantedReads` lends to the request context — an admin-realm request has none — after writing the
  access row on its own connection; a failed access write refuses the read. **A guard named in `@UseGuards` is built in
  the controller's own module**, so `SupportAccessModule`'s `@RequiresAdminRole` needs `AdminSessionService` exported
  from `AdminModule`, not the guard — the preview boot `openapi:emit` runs refused it, and said nothing until booted
  with `abortOnError: false`. **The migration's `down` is lossy and lifts `FORCE ROW LEVEL SECURITY` for its one
  DELETE**: without it the owner deletes nothing and says so quietly, which `migrations:check` found.
- **A-18 publishes a provider's behaviour and never touches its secret** (task 67.11; §12.5.6's task-67.11 row). Its
  three writes are each a `ConfigurationPublisher.publish` **carrying the revision the operator read**:
  `expectedRevision` refuses any other in force, under a transaction-scoped advisory lock on the slot, because a slot's
  first publication has no row `FOR UPDATE` could lock. `publish` answers `{ id, revision }` since, and the version's id
  is each write's audit target, which A-08's log names by provider. The reading comes from `config.entry_*` directly
  rather than the cache, and the store adapter calls `ConfigurationStore.poll()` after a publication, so this replica's
  S-01 changes at once. **The secret's standing comes from `PROVIDER_ENVIRONMENT`** — held, and the setting — which task
  154 re-points at OpenBao; the e2e suites get Google's secret from `apps/api/.env`, which `ConfigModule` loads, so the
  secret-missing refusal is a unit spec's. **`setCredentialPassword` is an upsert** (UC-09's alternate flow): a
  social-only account holds no `identity.credential` row, and a reset used to refuse it as a dead link.
- **An account in setup reaches only what `@AdmitsAccountInSetup` marks** (task 155; §12.5.6's task-155 row).
  `AuthGuard` reads the account's status and setup deadline in the same identity join as the session, and refuses
  every other route with `account-setup-required` — so **a route added later is closed to a setup account by
  default**, which is the direction the rule wants, and the route-matrix e2e's in-setup actor proves it per row. A
  lapsed deadline answers `authentication-required`, as an expired session does; a *null* deadline is a moved
  legacy account and never lapses. **The first password's proof is the session's own `created_at`** within 15
  minutes: an account holding no password can only have signed in through a provider, so that timestamp is the
  provider sign-in. **The confirmation link's grant is a password-reset token** with a 15-minute life, spent by
  the public `POST /auth/account-setup/password`, which then issues the session. The account row's shape is
  `infrastructure/persistence/identity/account-row.ts`, shared by the four identity adapters that map the whole
  row — a column those adapters read goes there once, not into four copies. The guard's identity join is the
  exception by design: it reads the two columns it judges, beside the session, and never maps an account.
- **Social sign-in matches on `(provider, subject)`, never email** (task 24; §9.1 calls the
  email-match variant an account-takeover path). `openid-client` 6.8.7 is a plain static import —
  ESM-only, and on `module: nodenext`/Node 26 `require(esm)` loads it, the OQ-48 revisit, proven for
  Node and Jest alike. No passport middleware (§12.5.6's task-24 rows, the recorded deviation from
  the task row). Provider behaviour is config-store data (kind `identity_provider`, scope per
  provider — enable/disable with no redeploy); client secrets are env
  (`AUTH_SOCIAL_*_CLIENT_SECRET`, missing ⇒ that ONE provider unavailable, logged, never
  boot-fatal). The completion use case returns outcomes and throws AFTER commit — the
  unverified-registration path must commit account + challenge while answering 403. The social
  throttle key is per (IP, provider), the account being unknowable before the exchange, so suites
  sharing a stack share ONE §12.5.6 window; every e2e suite that completes a provider flow drains
  `attempt_key LIKE 'social-sign-in:%'` for that reason. `test/support/oidc-provider-stub.ts` is a
  minimal Authorization Server those suites (and the browser suite, by relative import) drive a
  real code flow against; `AUTH_SOCIAL_ALLOW_INSECURE=true` is what lets discovery hit its http
  issuer, and is never set in production.
- **`identity.membership` is `identity`, not `core`** (25.1 — §7.1's one permitted cross-schema
  FK, correcting the task row). `MEMBERSHIP_ROLE` is `editor` / `viewer` /
  `organization_administrator` (CA is not a role — actors.md); FR-59's removal is a `status` change
  and **no runtime role holds `DELETE`**, so the row leaves only on the cascade from its account or
  its organization. Two `SELECT` policies, because AD-2's binding is *derived from* this table and a
  single policy would answer the pre-tenant lookup with zero rows forever (architecture.md §7.6) —
  and the self-select one is narrowed to *no organization bound* since task 130 found the
  unconditional form was a live FR-60 bypass. `core.capture_field_change` is attached with
  `last_active_at` ignored; `identity.session.active_organization_id` is task 21's expand half.
- **`@RequiresRole` composes `SetMetadata` with `UseGuards`** (25.2), so a route cannot carry the
  metadata and miss the gate; `@RequiresAccount` is for the member-of-nothing, whom `@RequiresRole`
  refuses by definition. `MembershipStoreRepository` is the first repository that actually extends
  `TenantRepository` — every statement runs on the request's `QueryRunner` and none names an
  organization. `wouldLeaveNoAdministrator` is one domain predicate shared by the role change and
  the removal, because FR-60's lockout arrives by both; since task 130 it counts the bound
  organization's administrators only. Three refusals with three resolutions: 401
  `authentication-required`, 403 `membership-required`, 403 `insufficient-role`.
- **`AccountMembershipStore` opens its own transaction and binds only `app.current_user`** (25.3);
  `selectActiveMembership` is the pure function `AuthGuard` resolves an active organization with,
  so a stale or revoked preference is a unit spec rather than an integration test, and
  `GET /memberships` projects its answer as `active` per row (30.1). `organization_directory_select`
  makes the tenant root readable across memberships **only while no organization is bound** — see
  the tenancy note below before touching it.
- **`AuthGuard` closes the surface by default** (28.1, done ahead of 25.4 because that task could
  not branch on memberships while nothing resolved a bearer token): an `APP_GUARD` registered before
  `TenantTransactionGuard`, resolving token → session → memberships → `selectActiveMembership` into
  the request context, with `@Public()` the only exception and each use carrying its reason.
  `AccessTokenVerifier` is a sibling port on the same adapter. The e2e identity fixture is deleted —
  `test/support/signed-in-account.ts` signs actors in for real.
- **An invitation has one live link, ever** (26.1): a resend rotates the token and restarts the
  seven days on the same row (OQ-55's precedent for the third token kind, which is why the endpoint
  is `POST …/email` rather than `…/resend`); the email language is the invitee's account locale
  where one exists and the inviter's negotiated locale otherwise, resolved at issue and stored; and
  both collisions are refused — an active member, or a pending invitation, the latter by the partial
  unique index `invitation_pending_address_key` over `(organization_id, lower(invited_email)) WHERE
  status = 'pending'`. Two things follow from that index and are stated at three call sites each
  because they read as tidyable: **`GET /invitations` lists lapsed invitations too**, since the
  collection must publish exactly what the index constrains or an administrator gets a 409 on a row
  they cannot see; and **nothing in 26.1 consults the clock** — expiry is derived at the point of
  use. `TenantRepository` gained a `protected get runner()`, because `writeOutboxEvent` needs the
  request's `QueryRunner` and an `EntityManager` cannot express P-8. **The seat precondition is task
  142's interim ceiling** (below), not an entitlement gate — that is task 54.2's, and it swaps the
  source rather than adding a guard. The two write routes were an authenticated mail amplifier bounded only by task 71's
  edge limit **until task 141** (13 Sep 2026), which gives them **one window over both**, keyed
  `invitation-mail:<organization>:<address>` at 5 per 15 min. The address is the key because the
  mailbox is what is rationed — keyed per invitation id, a revoke-and-reinvite cycle bought a fresh
  budget every time. A **success** spends it, like sign-in; a collision-refused issue rolls its own
  row back with the request and costs nothing, because no mail left (§12.5.6's task-26.1 row).

**A cleanup that deletes from a table with no `DELETE` policy removes nothing and says so quietly**
(task 26.1, and the stronger form of the memberships note above). `DELETE FROM identity.invitation`
as **`esg_migrator`** reports `DELETE 0`: `FORCE ROW LEVEL SECURITY` subjects the owner to its own
policies and there is no `DELETE` policy at all, so binding a tenant does not help — a bound
organization is not the missing part. It cost twelve e2e failures, all presenting as unexplained
`409`s two tests later. Clean up the way the product does (revoke), or drop the parent row and let
the cascade do it — referential actions bypass row security by design.

- **Acceptance is a second controller at the same path prefix** (26.2), because
  `InvitationsController` is `@RequiresRole(OA)` at the class and the invitee is by definition not a
  member — `preview` is `@Public()`, `acceptance` is `@RequiresAccount()`. Two policies, both keyed
  on a **third transaction-local binding, `app.current_invitation`** (the presented token's
  SHA-256, hex): `invitation_bearer_select` on `identity.invitation` and
  `organization_invitation_select` on `core.organization`, the latter because S-03 names the
  inviting organization to a signed-out visitor. `InvitationBearerStoreRepository` is the only
  binder; it hashes the raw token, and no route accepts a hash. Acceptance is **one transaction** —
  consume, grant, point the session — and it returns an outcome, throwing after the commit.
  **Registering with a live invitation for the same address creates a verified account and sends
  no challenge** (FR-3's third route, §12.5.6): one optional field on `POST /auth/register`,
  validated with `invitationIsAcceptable` and `emailIdentityKey`, the same two functions acceptance
  uses. `RequestContext` gains `sessionId`, for one reader. Both bearer routes are throttled
  (§12.5.6): accept per (IP, account), preview per IP.

**A store may need its own transaction because the request's is bound to the WRONG tenant**
(task 26.2 — the third and sharpest reason an identity store opens its own). The acceptor is signed
in and may already hold an active organization, so `TenantTransactionGuard` has bound the one they
are *currently* in, not the one inviting them. On the request's transaction the invitation read
returns zero rows and the membership insert is refused — both presenting as "the link is invalid".

**`app.current_org IS NULL` is NOT the right conjunct when the binding IS the capability**
(task 26.2). `organization_directory_select` needs it because its qualifying condition — being a
member — is true on every ordinary request. `invitation_bearer_select`'s is *knowing the token*,
which no ordinary request does; adding the conjunct buys nothing and breaks the bookkeeper accepting
their second client's invitation with a tenant already bound.

- **S-16's list is a union read model** (131): `identity/access` computes members and pending
  invitations as one CTE and applies the filter, the order and the window to the merged set, with
  the standing derived from `now()` in the same statement. It is the first route to opt into §6.8's
  compact list format — `@UseInterceptors(new ListQueryInterceptor())`, and **the `new` is
  required**: passing the class makes Nest inject its `(bounded, maxOnPage)` primitives and the
  application does not boot, which the interceptor's own docblock prescribed for three weeks
  because nothing had ever opted in.
- **The interim seat ceiling** (task 142; §12.5.6's task-142 row): `config/seed/seat-allowance.global.json`
  read through `SEAT_ALLOWANCE` in `contracts/`, provided by `identity/access` and imported by
  `identity/invitation`, whose two writes are the gates. Three things to know before touching it.
  **A seat is an active member or a pending invitation, lapsed ones included**, counted by one
  statement (`persistence/identity/seat.queries.ts`) that the issue gate, the acceptance gate and
  `GET /access/seats` all call — `test/seats.e2e-spec.ts` holds it equal to `GET /access`'s
  unfiltered total. **Both gates check after their write with one predicate**
  (`withinSeatAllowance`): the issue counts its own insert under a transaction-scoped advisory lock,
  so two invitations at the last seat cannot both commit; the acceptance moves no count, so it
  refuses only an organization already over its ceiling, and it **throws inside the bearer
  transaction on purpose** — the consume and the grant must roll back, and a seat refusal is not a
  guess, so it must spend no throttle budget. **It fails closed**: an absent or malformed artefact
  answers both writes `503 seat-allowance-unavailable`, while the read answers `allowance: null`.
  The refusal is `entitlement-quota-exceeded`, the type task 54.2 will raise — which, with the
  port, is what makes that task a change of source that deletes the artefact rather than extends it.

**Reporting core**

**The taxonomy registry** (task 33.1 — FR-65, FR-66; AD-3, AD-4): three `config/seed` artefacts
and `TAXONOMY_REGISTRY` in the port surface — no table, no migration, no code per artefact, which is
what task 16's store being generic is for. `vsme-taxonomy.2026-05-01.json` carries 143 reportable
elements over B1–B11 and C1–C9 with their kinds, period types, presentation order and dimensions;
`vsme-waste-classification.2026-05-01.json` is the EU List of Waste (973 members) that B7's axis
draws its domain from; `reporting-taxonomy.vsme.json` says which version a new report pins.
**OQ-45 closed here** — a version is EFRAG's own `YYYY-MM-DD`, and the config scope for
`vsme_taxonomy` *is* that version, so registered versions coexist forever as DR-4 requires.

Five things about it that are load-bearing:

- **The artefacts are extracted, never authored.** `tools/extract-vsme-taxonomy.mjs` regenerates
  them from EFRAG's published package; a hand edit is discarded by the next release. A correction
  belongs in the extractor. It **asserts rather than defaults** — an unmapped XBRL item type, a
  concrete element reaching no presentation role, an explicit axis resolving no members, a
  reportable element resolving no module, or measurement guidance that stops partitioning into unit
  lists and the four intensities' prose (task 91.4) each fail the run — and four of the five exist
  because each caught a real defect on first use.
- **`pinFor()`, never `max(registeredVersions())`.** The date EFRAG publishes a release and the date
  this platform adopts it are different facts, so adoption is a separate effective-dated entry. It
  answers `null` rather than guessing, because a report pinned to a version invented at a call site
  is what DR-4 exists to prevent.
- **Every method takes the version it is asking about.** Two registered versions coexist by design
  (task 33.3) and a report pinned to the older one must resolve *its* elements years later; a
  convenience overload answering "the current elements" is the shape that silently re-reads an
  archived report against a taxonomy it was never authored under.
- **An element belongs to `modules`, not to a module** (task 36.4). Eight disclosures are presented
  in **B3 and C3** — one shared hypercube, `EstimatedGreenhouseGasEmissions` over
  `ReportingScopesAxis` — so `TaxonomyElement.modules` is a list and a reader asks
  `modules.includes(…)`, never `[0]`. The extractor used to keep the first presentation role it met,
  which filed all eight under Comprehensive alone and left B3 serving 9 elements of 17 with **every
  assertion green**: each element reached *a* role and resolved *a* module, and 143 is a count of
  elements, so nothing could see a relation recorded as a scalar. `section`, `order` and `parent`
  stay singular and the extractor fails the run if a shared element's placements disagree about
  them. The facade emits such an element under **every** group, because a short `cThree` is the same
  defect one layer up.
- **`unitCodes` is what the standard ADMITS; `unit_code` on a row is what it holds** (task 91.4).
  UX-14's two branches are the list's `length` — 25 elements admit one unit and 13 admit several —
  and **empty means EFRAG states none**, which is not the same as the element taking no unit: the
  role reaches 42 elements of which 38 state a *unit list*, out of 78 quantitative ones — the other
  four are the intensities, whose guidance is a ratio in prose. `EnergyConsumptionFromFuels` carries
  none
  while its own `TotalEnergyConsumption` carries `[utr:MWh]`. It is on `DisclosureFieldDto` and
  deliberately **not** on `DisclosureValueResponseDto`, for `origin`'s reason one direction over: a
  stored value has no business restating the taxonomy's answer.

- **A malformed element is dropped; a malformed version fails whole**, which is the opposite split
  from the NACE classifier's and deliberately so. There, one bad row must not remove 995 good ones
  from a picker. Here, a partial taxonomy would let a report be authored against one shape and
  re-read against another. Both paths log at `error`, and
  `modules/platform/taxonomy/taxonomy-artefact.spec.ts` asserts the shipped artefacts produce no such
  line — a fail-soft design is only safe when a gate reads the log.

**The typed facade over that registry** (task 34.2 — AD-3, T-3), in `packages/vsme` — the
disclosure store is element-keyed, so `DISCLOSURES.bThree.grossScopeOneGreenhouseGasEmissions` is
what buys back the compile-time typing a generic store never had. Two rules about it, and both are
DR-4's:

- **`packages/vsme/src/generated/<version>.ts` is written once and never edited.** A report pinned
  to `2026-05-01` must still read against *that* version's elements after a newer one registers, so
  a taxonomy change is a **new file**, never an edit to the old one — the same append-only shape the
  label catalogues use. The vocabulary those files are written against lives beside them in
  `packages/vsme/src/shape.ts`, hand-written, so changing what a descriptor *means* stays one edit
  rather than one per registered version.
- **Regenerate, never hand-edit.** `pnpm facade:generate` writes it from
  `config/seed/vsme-taxonomy.<version>.json`, and `pnpm facade:check` regenerates and then
  `git diff --exit-code`s the result — so a hand edit fails the gate exactly as a stale file does.
  The generator asserts rather than defaults, like the extractor above it: an unmapped disclosure
  kind, an axis the version does not declare, an element carrying more than one axis, or an
  identifier that would carry a digit each fail the run with a message.

**The reporting period** (task 31.1 — UC-56; FR-21, FR-45, FR-66): `core.reporting_period` with
`GET/POST /api/v1/periods` and `GET/PATCH /periods/{id}`, reads open to every member and writes
`@RequiresRole(OA)`. Four things about it are load-bearing:

- **It is the first table carrying a legal date**, so §7.9's `<field>`/`<field>_tz` pairing is real
  and the invariant gate's rule finally fires. **`::text` on every date column in the repository**:
  the driver maps `date` to a JavaScript `Date`, so `2026-12-31` read in a zone behind UTC comes back
  as the 30th — NFR-34's exact failure, reintroduced at the boundary meant to uphold it.
- **The pin is `TAXONOMY_REGISTRY.pinFor({ on: periodStart.date })`** — never `max(registeredVersions)`,
  and never *today*. A backfilled 2025 period must pin what was in force then, and every assertion
  about the pin passes either way, which is why the fake registry records what it was asked.
- **Two periods for one entity may not overlap** (`EXCLUDE USING gist`, `'[]'` bounds because
  `period_end` is a day *inside* the period), and the **prior-period link is maintained**: creating a
  period repoints the neighbour that should now follow it, or a backfilled year leaves its successor
  with a null prior forever and FR-45's comparatives are silently absent.
- **The entity snapshot is taken here and referenced by the period**, not by the report (§7.2 as
  amended, §12.5.6). Its payload is assembled in SQL with `to_jsonb`, so it is a consistent read of
  the same transaction.

**Never `{ ...stored, ...patch }` with a DTO** (task 31.1). A class field declared `foo?: T` is an own
property set to `undefined` under `useDefineForClassFields`, so the spread *erases* fields the patch
never named rather than leaving them. Merge field by field, and compare an optional-nullable to
`undefined` rather than coalescing — `null` usually means *clear this*, which `??` would silently
undo. The repositories' `if (value === undefined) continue` loops were always right; the fakes
modelling them were not, until this task.

**`returnedRows` is one module now, in `persistence/`.** `UPDATE`/`DELETE ... RETURNING` answer
`[rows, count]` where `SELECT`/`INSERT` answer rows. It had been written four times — twice as a
declaration, twice hand-rolled inline — before task 31.1 needed a fifth.

**The lock** (task 31.2 — UC-57, UC-58; FR-22): `locked_at`/`locked_by` on the period,
`core.period_reopening`, and `POST /periods/{id}/{lock,reopening}` plus `GET /periods/{id}/reopenings`.
Four things to know before touching it:

- **The lock is not a role gate.** UC-57 names the Reporting Contributor and FR-22's criterion
  followed it; read that way, an administrator's correction is ordinary editing in the trail, against
  UC-58's rule that an amendment must look like one. It refuses **every** write and reopening is the
  only route through it (§12.5.6's task-31.2 row; FR-22 amended). `LockReportingPeriod` never sees a
  role, which is what makes that structural rather than remembered.
- **A `BEFORE UPDATE` trigger enforces it too** (P-4), raising SQLSTATE `45001` — class 45 is left to
  applications, so the repository can answer it as a domain conflict rather than a 500. It compares
  **row images** (`to_jsonb(NEW) - 'locked_at' - 'locked_by' - 'updated_at'`), not a column list, so
  a statement that cleared the lock *and* moved the dates is refused and a column added later is
  covered the day it is added.
- **`DELETE` is deliberately not covered.** Covering it made one locked period render its whole
  **organization** undeletable through the cascade, and a row that ceases to exist has not been
  amended — the history lives in `core.field_change`, which a deletion cannot reach.
- **The reopening is a row, never columns**, so a second amendment cannot overwrite the first
  (UX-72), and it is immutable by grant like `core.entity_snapshot`. The record is written **before**
  the unlock: there is no ordering in which the lock is gone and the reason was never captured.

**The report** (task 31.3 — UC-17, UC-18; FR-24 … FR-32, FR-66, FR-177) — in
**`core/disclosure`**, which §17.5 gives FR-24 … FR-32 and §7's component table already listed
`core.report` under. `GET/POST /api/v1/reports` and `GET/PATCH /reports/{id}`. Five things to know:

- **The pin is copied from the period, never resolved a second time.** `pinFor()` is asked once, at
  period open (task 31.1); the report's `INSERT ... SELECT` takes the two strings from the period's
  own row, so they never pass through the application. Re-asking the registry agrees in every case
  but one — an adoption registered in between — and in that one it gives a filing **two disagreeing
  pins with nothing failing**, which is DR-4 defeated by its own mechanism (§12.5.6's task-31.3 row).
- **`esg_app` cannot write either pin, and that is a privilege rather than a convention.** `GRANT
  UPDATE (scope, status, updated_at)` and nothing else — see "Withholding a column" below.
- **The period lock is the only writer of `open` and `locked`.** Storing the lifecycle on the report
  makes those two true in two places, and the cost is paid in `ReportingPeriodStoreRepository`'s own
  transaction: `lock`/`reopen` move every report inside the period. `ready_to_file` (task 41.3) and
  `filed` (task 47) are declared and unreachable; each owes an answer about what a lock does to it.
- **A `BEFORE UPDATE` trigger refuses a locked report's every write but `status`**, so a scope change
  inside a locked period is refused below the application as well as above it (P-4). Row comparison,
  not a column list, exactly as task 31.2's.
- **The writes admit the editor**, which is the opposite of the split `EntitiesController` and
  `PeriodsController` carry — master data is OA-owned (D-2), a report is the Contributor's workspace
  (UC-18, FR-26). A create route the RC could not reach means the author cannot start their report.


**Notification**

**The store is the worker's, and nothing else writes it** (task 50.1.1; §12.5.6's task-50.1 row). The
`notification` schema — `notification.notification`, one row per notice, and `notification.delivery`, one per
recipient and channel — is written by `NotificationStoreRepository` on the worker, as `esg_worker`, each statement
in a short transaction of its own bound to the job's organization (`app.current_org` only; nobody is acting).
`esg_app` holds no privilege on either table until 50.1.2's centre brings its read. Four things to know:

- **FR-167's deduplication is `notification_open_key`**, a partial unique index over
  `(organization, category, subject, recipient_scope) WHERE state <> 'cancelled'`, and `open` inserts against it
  with `ON CONFLICT … DO NOTHING`. **The conflict target restates that predicate as a literal**: PostgreSQL infers a
  partial index from a predicate it can prove when planning, so a bind parameter there works under the driver's
  custom plans and fails the statement under a generic one (*"no unique or exclusion constraint matching the ON
  CONFLICT specification"*, measured with `plan_cache_mode = force_generic_plan`). The ordinary reads bind the state
  as a parameter and use the index either way — measured with `enable_seqscan = off`.
- **What is owed is derived from what is recorded, every run.** `DeliverNotification` writes in-app, then sends
  each email and records it once the provider accepts, then marks the notice delivered — so a job run again after
  any failure completes the work rather than repeating it, and the email's idempotency key is the notice and the
  recipient. A raise folded into an open notice delivers **the notice as recorded**, to the recipients it adds.
- **A redelivered job finds its notice by its own id first**, which is what keeps a job for a *cancelled* notice
  from joining the open one a later raise created. Nothing cancels until 50.1.3, so only the e2e's hand-written
  cancellation exercises it.
- **Cleaning up needs `deleteNotificationsOf`** (`test/support/notification-store.ts`). Neither table has a
  `DELETE` policy or a parent to cascade from, so a plain `DELETE` as the owner removes nothing under `FORCE`; the
  helper lifts `FORCE` inside the transaction that deletes and restores it before committing.

### Withholding a column from the application

PostgreSQL grants `UPDATE` **per column**, and task 31.3 is the first place that matters: `GRANT
SELECT, INSERT, DELETE ON core.report TO esg_app` plus `GRANT UPDATE (scope, status, updated_at)`.
`INSERT` stays table-wide, because the withheld columns are *set* at creation and only then.

- **It composes with RLS rather than competing with it.** The policy decides which rows, the grant
  decides which columns. Both still apply.
- **Declare what is WITHHELD in `test/schema-invariants.e2e-spec.ts`** (`APP_IMMUTABLE_COLUMNS`),
  never what is granted. The first draft of that gate listed the granted columns and was **inert in
  one direction**: a column added by a later task with no grant appears in neither the actual set nor
  the declaration, so `toEqual` passes while the application cannot write it — and the failure
  arrives in production as `42501` rather than at a gate. Inverted, every column of the table is
  accounted for by one list or the other.
- **Adding a column to such a table means adding its grant in the same migration.** The gate is what
  tells you; without it the symptom is a write that worked in every test written before the column.

**An actor column into `identity` is a bare `uuid`, never a foreign key** — §7.1 permits one
cross-schema foreign key and it is not this one, and `ON DELETE SET NULL` would erase the attribution
FR-55 requires be retained. `core.field_change.actor_id` set the precedent at task 14;
`schema-invariants.e2e-spec.ts` is what catches a new one.

**A schema gate over a migration that did not apply is a false green.** After removing those foreign
keys the migration failed to compile — a backtick inside a SQL comment — and `db:invariants` then
reported 36 passed, because the table was not there to fail on. Check the table exists before
believing the invariants.

**Not built yet, and do not assume otherwise** (rewritten 31 Aug 2026 — the previous version was
taken 25 Aug and had been overtaken by tasks 29, 30, 31 and 33, which is the failure mode a
current-state list has): **one of the four edge guards** — `EntitlementGuard` (task 54; `AdminRealmGuard` shipped with
task 67.3 and `AuditInterceptor` with task 67.4, both under Identity above). No **disclosure
value** store (task 34), no calculator, validation, comparatives, export or trace body, and no
`billing` or `platform` body beyond `admin`, `configuration`, `localization`, `notification` (task 49) and `taxonomy`.

**Read the module tree and `src/testing/route-permissions.ts` rather than a list here.** That table
is the surface, it is a gate, and it cannot go stale — which is exactly why enumerating controllers
in prose stopped being worth doing.

**Both entrypoints must boot, and only a gate that boots them can say so** (26 Aug 2026, after
CI). Task 28.1 registered `AuthGuard` as an `APP_GUARD` in `AppModule` while `SessionModule`
provides it on the HTTP side only — so `MODE=worker` failed dependency resolution and **the worker
container refused to start for four tasks**. Every local gate was green: `openapi:check` boots in
preview mode and instantiates no provider, and every e2e boots HTTP. CI's Images job found it,
because it is the only thing that starts the container a deploy would use.

Two things came out of that and both are load-bearing:

- **The request pipeline is registered in HTTP mode only** — one conditional over the list rather
  than four guarded providers, because the next guard added is one somebody has to remember to
  guard. `main.worker.ts` builds an application context: no HTTP server, no controllers, no
  requests, so a guard there governs nothing.
- **`pnpm e2e:worker` is the tenth gate**, and it runs the same `entrypoint-boot.e2e-spec.ts` the
  HTTP suite runs — the mode is read at module-definition time, so one process cannot exercise both
  branches and neither run alone proves the split. That is `billing-disabled.e2e-spec.ts`'s
  arrangement, for the same reason. Verified the way the boundary rules are: reintroduce the
  unconditional registration and the gate fails.

**`emit-openapi.ts` uses `preview: true`, and that is load-bearing.** `PersistenceModule` opens
connections at boot, so a full boot would make `openapi:check` require Docker. Preview mode builds
the module graph without instantiating providers and emits a byte-identical document, because
Swagger reads decorator metadata. Twelve of the sixteen gates run with no database and it is worth
keeping that true. The accepted cost: emission no longer proves the DI graph resolves, so a missing
provider surfaces at startup instead of at the gate.

## Commands

**Running the worker in development: `pnpm --filter @easyesg/api start:worker:dev`.** It is
`start:worker` plus the two things a laptop needs and a container does not — a `prestart` build,
because the worker runs from `dist` and only `postbuild`'s `tsc-alias` rewrites `@api/*` there, and
`--env-file-if-exists=.env`.

**It is also the only way to see a verification link.** `EmailPort`'s development adapter writes the
message to the log rather than sending it, so nothing reaches an inbox — but the message is written
by the *worker*, since registration only enqueues an outbox row (P-8). With no worker running, the
row sits with `dispatched_at` null and nothing anywhere displays the token. Two further things about
that log, both deliberate:

- **The `log` line carries a pseudonym, not the address**, and the link is at **`debug`** (NFR-30 —
  the adapter's own header explains why `EMAIL_PROVIDER` has no default). Nest 11 enables `debug` by
  default, so the link prints with no extra flag; **nothing in this app reads `LOG_LEVEL`**, and
  setting it does nothing.
- **The raw token exists in exactly one durable place** — `audit.outbox_event`'s payload.
  `identity.verification_token` holds only its SHA-256 (OQ-54), which is why `verificationTokenFor`
  in the e2e helpers reads the outbox and why a token cannot be recovered from the token table:

  ```sql
  SELECT payload->>'email', payload->>'token' FROM audit.outbox_event
   WHERE event_type = 'identity.email_verification.requested' ORDER BY occurred_at DESC LIMIT 1;
  ```

  The event type is dotted — `identity.email_verification.requested`. Guessing underscores returns
  zero rows, which reads exactly like "nothing was registered".

Run boundary and lint checks from the **repo root**; they are workspace-wide.

| From | Command | Notes |
| --- | --- | --- |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script of its own |
| root | `pnpm boundaries` | dependency-cruiser over `apps/api/src` |
| root | `pnpm boundaries:prove` | Asserts each rule still **rejects** a real violation. Run after touching `.dependency-cruiser.cjs` |
| root | `pnpm openapi:check` | Regenerates the spec and fails if it differs from the committed one |
| here | `pnpm typecheck` | `tsc --noEmit`. **Not the same as `build`** — see below |
| here | `pnpm build` / `test` / `test:e2e` | |
| here | `pnpm start:dev` | HTTP mode. `pnpm start:worker` for `MODE=worker` |
| here | `pnpm db:migrate` / `db:revert` / `db:show` | Needs the Compose stack (`pnpm dev:up`) and `apps/api/.env`. Connects as `esg_migrator`, never as `esg_app` |
| here | `pnpm db:invariants` | §7's structural rules against the migrated database. Each proves its own rule bites |
| here | `pnpm test:e2e` | Needs the Compose stack. Runs the tenant-context probe and the schema invariants |
| here | `pnpm test:worker` | The same `AppModule` booted as `MODE=worker`. Needs the stack. The tenth gate, added 26 Aug 2026 — see below |
| root | `pnpm migrations:check` | The ninth gate: apply → revert → apply → invariants. Needs Docker, unlike the other eight |

**`build` does not type-check tests.** `tsconfig.build.json` excludes `*.spec.ts`, and ts-jest
compiles per-file without whole-program checking. `pnpm typecheck` is what covers them. A spec can
be broken while `build` is green.

## Where things live

```
src/
├─ main.ts · main.http.ts · main.worker.ts   one image, MODE picks the entrypoint (AD-1, §5.4)
├─ app.module.ts                             composition root — NOT in app/, see below
├─ app/          cross-cutting only: dto/ filters/ interceptors/ guards/ decorators/ constants/ interfaces/ messages/
├─ config/       ConfigService schema. Never process.env in business logic
├─ contracts/    the ONLY cross-context surface: ports, events/, types/
├─ modules/      core/(9) identity/(6) billing/(13) platform/(8) — 36, plus the four context modules: 40 `*.module.ts`
└─ infrastructure/  persistence/ outbox/ queue/ adapters/ openapi/ observability/ configuration/ provisioning/
```

`app.module.ts` sits at `src/`, not in `app/`, because `app/` carries a rule that it may not import
`modules/**` — and a composition root imports every namespace module by definition. It is wiring,
not cross-cutting code.

Which module owns which FR: `architecture.md` §17.5 and §6.7. Each `*.module.ts` repeats its own
range in a header comment.

## Module anatomy

Required: `<name>.module.ts`, `controllers/`, `services/`, `use-cases/`, `models/`, `dto/`,
`types/`. Optional, only when the domain needs them: `providers/ interfaces/ guards/ decorators/
errors/ validators/ constants/ consumers/ sagas/ domain/`. Tests colocated as `*.spec.ts`.

`use-cases/` is not optional where `use_cases.md` names a flow. Those classes stay **framework-free**
— no `@Injectable`, no TypeORM, no Express — and the check is that their tests run with no database,
no broker and no HTTP. `domain-free-of-frameworks` enforces it.

**Controllers call services; services call use cases** (added 20 Aug 2026, task 19 review). Each
layer holds one kind of knowledge: `controllers/` maps transport — routes, status codes, DTOs,
OpenAPI — to the module's service and nothing else; `services/` is the Nest-aware application seam
that orchestrates use cases and resolves ambient request context (the registration locale is the
worked example); `use-cases/` stays framework-free. A controller importing from `use-cases/` is the
violation. A service wrapping a single use case is the honest minimum, not the pass-through
CLAUDE.md warns against — the seam is the rule, and it is where a later task composes two flows
without the controller growing a second caller. `identity/account` is the template.

**No `@Injectable` means no `useClass`.** A framework-free use case has no constructor metadata for
Nest to read, so it is registered with `useFactory` + `inject` naming its port tokens. That is the
price of the constraint and it is the shape to copy — `identity/account/account.module.ts` is the
worked example. Inject the clock the same way (`() => new Date()`): OQ-52's seven-day window is
otherwise only testable by waiting a week.

**`testing/` holds test doubles shared by more than one spec** — `tsconfig.build.json` excludes it
so it never reaches `dist`, while `tsconfig.json` keeps it in the program so `pnpm typecheck` holds
a fake to the interface it claims to implement. A fake worth writing models **rollback**, not just
return values: `FakeAccountStore.run` restores its snapshot when the callback throws, which is what
lets a spec assert P-8's "all of it or none of it" instead of only that an error was raised.

**One behaviour per file; a vocabulary stays whole** (11 Sep 2026, task 132 —
`file-one-behaviour-api` in the `one-idea-per-file` skill; the companion `one-kind-per-folder` does
not reach this app: *"the api's structure is good"*, so the anatomy above is unchanged). A use
case, a service, a controller, a repository or a consumer is one file each. `<module>.errors.ts` —
the module's closed set of refusals — and a `dto/` file — one wire object with its parts — are
vocabularies and stay whole; a repository's private transaction adapter (`AccountTransactionAdapter`
beside `AccountStoreRepository`, five such) is the same behaviour's second face and stays beside
it. One file does not meet it, task 133.2's: `core/disclosure/use-cases/read-wizard-step.use-case.ts`
— 1,222 lines, one use case beside two private resolver classes and nine helpers. The second,
`identity/account/use-cases/manage-totp.use-case.ts`, held `ManageTotp` and `ConsumeRecoveryCode`
until task 133.1 gave the latter `consume-recovery-code.use-case.ts`.

A module is a unit of ownership, not a URL prefix. Several own no routes at all
(`platform/configuration`, `billing/entitlement`); that is correct. **`core/comparatives` left
that list at task 34.3** — it still owns no table, which is the claim architecture.md's component
table actually makes ("— (reads across periods)"), and it now serves
`GET /reports/:id/prior-period` because comparability is computed from two pinned taxonomy
versions through `TAXONOMY_REGISTRY`, which no browser can ask.

## The request pipeline

Order is fixed by §6.2: **auth → tenant context → entitlement → audit**.

That order is normative; the *component kinds* in §6.2 are not, and cannot be. NestJS runs every
guard before any interceptor, and `EntitlementGuard` reads per-organization state, so the binding
must exist before it runs — §6.2's "TenantContextInterceptor" is therefore a **guard**,
`TenantTransactionGuard`. §6.2 and the §5 diagram were amended to say so on 19 Aug 2026 (task 11);
before that this file claimed the amendment existed when it did not.

**`AuthGuard` must be registered BEFORE `TenantTransactionGuard`.** `APP_GUARD` order follows
registration order, and `AuthGuard` is what puts the organization in the context the transaction
guard reads. Registered after, it would bind nothing and every tenant read would throw.

**It is registered with `useExisting`, and `IdentityModule` re-exports `SessionModule` so it
resolves** (task 28.1). `SessionModule` is what can construct the guard — it needs the JWT secret
and the request-identity store — and `useExisting` resolves in the *registering* module's scope, so
without the re-export the application does not boot at all. That is the right failure: a guard the
composition root cannot resolve must not silently become no guard. `useClass` would ask Nest to
build a second one from `AppModule`'s empty provider scope.

**A route with no `@Public()` needs a session.** The three kinds of exemption are enumerated on the
decorator, and the one to know about is the admin realm: `/auth/admin/*` is public to the *tenant*
guard and not public at all. Swagger's `/docs` needs no marker — `SwaggerModule.setup` mounts
express middleware, not a Nest route, so no `APP_GUARD` runs for it.

**The guard opens its own transaction, and leaves `app.current_org` unset.** It runs before the
request transaction exists, and task 25.3's `organization_directory_select` is conditioned on no
organization being bound — so binding a tenant there would look like diligence and silently drop the
organization names it needs.

Traps, each of which has cost someone a day:

- **The catch-all filter registers first.** Nest scans filters backwards from the last registered
  for the first matching `@Catch`, so a catch-all added last swallows every specific one.
- **`AuditInterceptor` registers last**, and since task 67.4 it exists (§12.5.6's task-67.4 row).
  Every successful admin-realm write that declares `@AuditAction({ action, target })` becomes **one**
  row in `audit.system_audit_log` — the operator, the action, the target, the time — written once the
  handler returns; a refusal writes nothing. `route-permissions.spec.ts` fails an admin-realm write
  that declares no action, and an action declared on anything else. Tenant mutations are not its
  business (`core.field_change` attributes them) and a use case writes explicitly only where no
  session-bearing request carries the event — sign-in (28.4), an invitation's acceptance, the
  provisioning CLI. Last-registered is *innermost*, and only the innermost interceptor sees the
  handler's raw return value — which is how it records a created row's id.
- **A guard that throws never reaches an interceptor.** `TenantTransactionGuard` opens a
  transaction, so the rollback cannot live only in a transaction interceptor —
  `ProblemDetailsFilter` rolls back, `TransactionInterceptor` only commits. The asymmetry is the
  design, not an oversight.
- **A named `DataSource` must carry `name` in its options** (`NamedDataSourceOptions`), even though
  TypeORM 1.1 removed it from `DataSourceOptions`. `@nestjs/typeorm` 11.0.3 resolves the shutdown
  token from the factory *result*, so without it `onApplicationShutdown` looks up the default token,
  fails to find it and throws before destroying anything — a failed SIGTERM, since `main.http.ts`
  enables shutdown hooks.
- **`rawBody: true`** on `NestFactory.create`. Webhook HMAC breaks if the body is re-serialised.
- **`app.use(...)`, not `MiddlewareConsumer.forRoutes('*')`** — the middleware must wrap the guards,
  and Express 5 changed wildcard path matching.

## Tenancy

Every repository over a tenant-owned table extends `TenantRepository`. It resolves the request's
`QueryRunner` from `AsyncLocalStorage` and **throws when there is none**.

The throw is the whole point. RLS returns **zero rows** when `app.current_org` is unset — it does
not error. So a bare `repository.find()` on a pooled connection succeeds and returns nothing, which
reads downstream as "this customer has no data" and survives review, staging and a demo.

Deliberate exceptions, each with a stated reason: `modules/identity/*` (runs before a tenant
exists), `platform/audit` and `platform/metering` (append-only, cross-tenant by design), and
`infrastructure/persistence/admin-readonly.ts` (`esg_admin_ro`, `BYPASSRLS`, read-only, every
acquisition logged).

Tenant binding is `SELECT set_config('app.current_org', $1, true)` — a bind parameter, and
transaction-local. Never `SET LOCAL` (utility syntax, no bind parameter, forces interpolation into
the one value tenancy rests on) and never session-scoped (PgBouncer runs transaction pooling; it
would leak to the next borrower).

### A user-visible text ordering states its own collation

`architecture.md` **OQ-61**, closed 13 Sep 2026. `ORDER BY name` takes whatever collation the
cluster was initialised with, and nothing here pins one — `infra/postgres/init/init.sh` sets no
locale and the compose file passes no `POSTGRES_INITDB_ARGS`, so it is the image default. Wrap the
expression in `collated()` from `infrastructure/persistence/collation.ts`:

```ts
ORDER BY ${collated('name')}, id
```

- **It applies wherever a person reads the order** — names, addresses, titles. Five orderings across
  three adapters carried this when the row closed: S-16's person column and its tie-break, entity
  names (×3) and organization names.
- **Not to a `uuid`, a `timestamptz` or an integer rank.** Those are not collatable and `COLLATE` on
  them is a type error, so a tie-break on `id` stays bare beside a collated text key. The asymmetry
  is correct.
- **Measured, and the obvious fix does not work.** Under `C`, *Ștefan Țurcanu* sorts after
  `zoe@example.md` — a Romanian name below every ASCII value, which for this product is the failure
  that matters rather than the capitalisation. `lower()` corrects the case and leaves `ș` past `z`.
  `test/collation.e2e-spec.ts` pins all of it.
- **Nothing mechanical catches an omission on this machine.** The dev cluster is `en_US.utf8`, which
  agrees with ICU on every value the suite tests, so a missing `collated()` breaks only on a `C`
  cluster. What stands in is that the helper is the one spelling — imported, not remembered.

### Adding a tenant table

Four things in the **same** migration, or `pnpm migrations:check` fails the build:

1. `organization_id uuid NOT NULL` — except the tenant root, which is scoped by its own `id`.
2. `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`. `ENABLE` alone is the shape that
   looks protected and is not: `esg_migrator` owns every table, an owner is exempt from its own
   policies regardless of `rolbypassrls`, and no probe run as `esg_app` can see the difference.
3. Policies reading `NULLIF(current_setting('app.current_org', true), '')::uuid`. The `NULLIF`
   matters — an empty context raises `invalid input syntax for type uuid` where an unset one
   correctly yields zero rows.
4. `WITH CHECK` on writes. `core.organization`'s permissive `INSERT` is a named exception for FR-13
   and the only one; copying it elsewhere lets a tenant write another tenant's rows.

**A table the binding is derived from cannot be scoped solely by that binding** (task 25.1, §7.6).
`identity.membership` is the case: `AuthGuard` reads it to *produce* `app.current_org`, so a policy
scoped to `app.current_org` answers that read with zero rows for every account, forever — and
presents as "this account belongs to no organization" rather than as an error. It carries a second
permissive `SELECT` policy on `app.current_user`, which `setTenantContext` already binds. Read only:
`INSERT` and `UPDATE` stay on the organization alone, so an account sees where it belongs from
anywhere and can change a membership only where it holds the context.

**A backfill run by `esg_migrator` sees zero rows** unless it sets `app.current_org` per
organization — `FORCE` applies to the owner too. A data migration that appears to update nothing is
this, not an empty table.

**`SECURITY DEFINER` does NOT escape RLS here, and it looks like it should** (task 25.3). The
function runs as its owner, `esg_migrator` owns every table, and `FORCE` subjects an owner to its
own policies — so a definer function reading a tenant table returns **nothing**. `SET row_security =
off` does not help either: for a forced-RLS owner it raises rather than bypassing. Escaping needs a
role holding `BYPASSRLS`, and `CREATE ROLE` is cluster-level — it lives in `infra/postgres/init/
init.sh`, outside the migration ledger. `core.capture_field_change` is definer for a different
reason entirely: it *writes* as the owner so the application needs no INSERT grant, and its target
carries a permissive `WITH CHECK (true)`.

**`core.organization` carries a third policy, active only before a tenant is bound** (task 25.3).
It is what lets the switcher read the names of every organization an account belongs to. The
`app.current_org IS NULL` conjunct is load-bearing and measured: without it, a request bound to one
organization sees every organization its actor belongs to, which would put task 29's IDNO and
registered address outside the active tenant on every request. `tenant-isolation.e2e-spec.ts` has
the only test that would catch its removal.

Task 28.4 pays task 23's audit deferral: **every admin sign-in attempt is a row in
`audit.system_audit_log`** — the completed pair, and each way it fails (credential, factor, locked,
throttled). `SYSTEM_AUDIT_LOG` is the port (`contracts/`, because FR-159's writers are everywhere
and the log's owner is one module), `SystemAuditLogRepository` the adapter, and `AUDIT_ACTION` the
closed vocabulary written into `action` — which carries no `CHECK`, so that object is the only place
the spelling is true.

**The write takes its own connection, and that is the port's contract rather than the adapter's
preference.** Every interesting event is a *failure*, and a failure throws — so a write enlisted in
the caller's transaction would be rolled back by the very refusal it records, while every test
asserting a *successful* sign-in stayed green. It is `SignIn`'s throttle-counter shape, stated on the
port so a later "tidy" onto the request runner has to argue with it.

**A failed audit write is logged, never rethrown.** The caller is usually already throwing, and
turning a 401 into a 500 would tell the caller something false and hand a prober a way to
distinguish states by breaking the log. The opposite belongs to a *ledger* (DR-6), and conflating
the two is how a sign-in page starts 500-ing because a partition is missing.

**`subject` is a SHA-256 of the normalised address, never the address** (§12.5.6, project owner).
`actor_id` cannot answer for an attempt against an address matching no account, so without it the
row said only *a failed admin sign-in happened*. Build it with `auditSubject` — a second hashing
would be locally correct and globally useless, since the grouping is the whole point.

**A platform audit row is invisible to `esg_app` AND to the owner**, which cost an hour to
rediscover. The SELECT policy compares `organization_id` for equality and a platform row's is NULL,
so nothing matches — and `FORCE ROW LEVEL SECURITY` subjects `esg_migrator` to its own policies, so
being the owner does not help. **`esg_admin_ro`'s BYPASSRLS is the documented route**, which is why
`DB_ADMIN_RO_USER`/`DB_ADMIN_RO_PASSWORD` now exist in `.env.example`: the e2e reads these rows the
way the console will, rather than through a path the product does not use. An insert that reports
`INSERT 0 1` followed by a `SELECT` returning nothing is this, not a failed write.

### Adding an append-only table

`CALL audit.enforce_append_only('audit.<table>')` **after** creating the table and all its
partitions. It does four things, and omitting any one is silent: revokes UPDATE/DELETE/TRUNCATE,
creates the row trigger, creates the statement TRUNCATE trigger, and seals every partition.

**Partitions do not inherit what you think they inherit.** Verified against PostgreSQL 18:

| | Propagates to partitions? |
| --- | --- |
| `BEFORE UPDATE OR DELETE ... FOR EACH ROW` trigger | **Yes** — PostgreSQL clones it |
| `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger | **No** — `TRUNCATE <partition>` succeeds |
| Row-level security | **No** — the partition reads `relrowsecurity = false` |

So each partition gets its own TRUNCATE trigger, and RLS `ENABLED` + `FORCED` with **no policy** —
deny-all on direct access, while parent queries keep using the parent's policies. Grant on the
parent only; a routed `INSERT` is privilege-checked there, so the application never needs to name a
partition. Add a partition in a later task and you must re-run the procedure — the invariant gate
fails the build otherwise.

### The outbox — the only way work leaves the request tier

`api` **never enqueues** (AD-10 rejects it as a dual write). It calls `writeOutboxEvent(queryRunner,
…)` on the request's own runner, so the effect commits with the state change or not at all. The
dispatcher on the worker is the sole queue producer (§6.7).

Three things about it that are load-bearing:

- **Enqueue, then mark dispatched — never the reverse.** Both inside one transaction. A crash
  between marking and enqueueing loses the row silently; a crash between enqueueing and committing
  re-emits it, which is at-least-once. The idempotency key is BullMQ's `jobId`, so the duplicate is
  discarded — that is where "effectively once" comes from.
- **`RETURNING` requires `SELECT` privilege.** `esg_app` holds `INSERT` on the outbox and nothing
  else, which is why the table needs no RLS policy — so a `RETURNING` clause in the writer would
  force a SELECT grant and dismantle the guarantee. It has already been written once and removed.
- **The worker runs as `esg_worker`, not `esg_app`.** Set `DB_WORKER_USER`/`DB_WORKER_PASSWORD`
  locally; production containers just supply their own `DB_USER`. Running the worker as `esg_app`
  fails on the first poll, because `esg_app` may only INSERT into the outbox.

**A suite that signs an actor in leaks an outbox row, and one unscoped DELETE was hiding all of
them** (27 Aug 2026, review). `signInFreshAccount` registers an account, which emits an
`identity.email_verification.requested` row — and deleting the account does **not** take it, because
`audit.outbox_event` carries no FK to `identity.account` on purpose: an effect must outlive the state
change that caused it (AD-6). Seven suites never cleaned those rows, and nobody noticed because
`outbox.e2e-spec.ts` ran `DELETE FROM audit.outbox_event` unscoped, silently tidying up after every
suite that had run before it under `--runInBand`. Scoping that DELETE is what surfaced it: four of
the seven run alphabetically ahead of it, and their twenty stray rows made `dispatchBatch()` answer
21 where the test expects 1.

**`cleanupSignedInAccounts({ owner })` in an `afterAll` is the fix, and it takes no email list** —
the helper records what it registered in a module-level set, which is per-file because jest gives
each test file its own module registry. A suite therefore cannot pass the wrong addresses or forget
an actor added later. Call it from any suite using `signInFreshAccount`.

**An e2e response with no `x-correlation-id` did not come from this api** (14 Sep 2026; §12.5.6's
loopback row). supertest binds a server per request with a host-less `listen(0)` and then requests
`127.0.0.1`, so a local tool that bound the same port on `127.0.0.1` used to receive the request — in one
run VS Code's helper answered a sign-in route with `400 WebSockets request was expected` and a session probe
with an empty `404`. `test/support/supertest-loopback.ts` makes that server listen on `127.0.0.1`, where
nothing else can take the port. It patches supertest's private `serverAddress` and `end`, because a `listen`
naming a host binds asynchronously and supertest reads the port synchronously — so defaulting the host in
`http.Server#listen` is the fix that looks right and crashes every request. If a status that fits no path
its request could take comes back anyway, read the response's correlation header before reading the code:
its absence means the answer was not ours.

**Re-running `pnpm e2e` exhausts the sign-in window, and it does not look like a throttle
problem.** These suites use fixed addresses, so three runs inside fifteen minutes spend §12.5.6's
five-attempt budget for each of them and the fourth reports `expected 201 "Created", got 429` from
inside `signInFreshAccount` — 66 failures across four suites that read like a regression in whatever
you just changed. `DELETE FROM identity.auth_attempt` as `esg_migrator` between runs is the fix. CI
never sees it, because its database is fresh.

**`pnpm e2e` seeds the configuration store itself, and that is `pretest:e2e`'s job rather than
CI's** (30 Aug 2026, found by CI). `POST /entities` admits a legal form and an activity code against
the configuration vocabularies, and `POST /periods` resolves its version pin from one — so both
suites fail with a flat `400`/`409` against an empty store. They passed anyway, because
`configuration-store.e2e-spec.ts` calls `seedConfiguration` as part of testing it, and **whichever
suite jest happens to run first was silently providing the vocabulary for the rest**.

Two things made that invisible. A developer's store is always already seeded from some earlier
command, so no local run could fail. And jest's default sequencer orders by file size, not
alphabetically — so "the seeding suite runs first" was never even reliably true; it just happened to
be, until the `BILLING_ENABLED=false` job, which is the one job that migrates without seeding, drew
the other order. 44 failures across two suites, none of them about the code they were testing.

The fix is the root `CLAUDE.md`'s own rule applied literally — *a script must be runnable on its own,
and if `pnpm x` needs what `pnpm y` produces that belongs in a `prex` hook, not in a CI step* — so
`pretest:e2e` now runs `config:seed`. **Do not add a seed step to a workflow instead**: the next job
that forgets it is the same bug again.

**A `new Date()` bound against a database-written column is a cross-clock comparison, and it fails
intermittently in the direction that looks like a broken feature** (9 Sep 2026, diagnosed from
`members.e2e-spec.ts`). Every audit and outbox column here defaults to `now()` — PostgreSQL's
*transaction start time*, on the **container's** clock. A test bounding one with `Date.now()` reads
the **host's**. Measured on this stack: the container runs **7–8 ms behind**, which is ordinary for
a Docker VM and not a misconfiguration.

So `WHERE occurred_at >= $since` with a host `since` can exclude the very row the next request
writes. `members.e2e-spec.ts`'s FR-55 case asserted one audit row and saw **none**, reading as
*attribution is broken* rather than as a bound that had excluded it.

**The intermittency pointed the wrong way, which is why it survived.** It failed inside the full
`pnpm e2e` and passed when the suite ran alone — so it read as cross-suite interference, the class
this section is otherwise about. It is the opposite: a *warm* process answers the `DELETE` in a
millisecond or two, well inside the 8 ms window, while a cold one takes longer than the skew and
passes. Running the suite alone is the slow case.

**`databaseNow(connection)` in `support/database.ts` is the fix**, and the rule is one line: *a bound
on a column the database wrote comes from the database's clock*. Proven by mutation — a `databaseNow`
returning a host clock 50 ms ahead reproduces the failure exactly, and the real implementation is
immune.

The same shape is elsewhere and does not bite: three suites assert `expiresAt > Date.now()` against
challenge and invitation windows measured in minutes and days, where 8 ms is nothing. They are named
here so the next reader does not have to re-derive that margin — the hazard is the comparison, and
what makes those safe is only the size of the window.

**`outbox.e2e-spec.ts` still needs the table globally quiet for two of its tests**, and that is not
something scoping can fix: `dispatchBatch` polls every pending row regardless of tenant, because the
dispatcher is global by design (§6.7's single producer). Those tests assert the precondition rather
than manufacture it — a stray row fails them loudly and names the count, instead of being swept.

### Consuming from the queue

**There is exactly one `@Processor(OUTBOX_QUEUE)` in this application and there must stay one.** A
BullMQ worker consumes every job on its queue and cannot subscribe to a name, so a second
`@Processor` on AD-10's single queue does not divide the work — the two compete, each receiving
jobs meant for the other and failing on them. `OutboxConsumer` is that one processor; a module
claims a job name by marking a provider `@HandlesJob('<event_type>')`, and it is found by
`DiscoveryService` so the module that owns the work owns its registration.

- The string must equal the `eventType` written to `audit.outbox_event` — both sides read one
  exported constant.
- A handler takes `(payload, context)`, never a `Job`, so it is testable without a queue.
  `context.jobId` **is** the outbox row's idempotency key, which is what §8.4's outbound calls need.
- An unclaimed job name **throws**. An outbox row exists because a transaction committed a decision;
  dropping it silently is the loss the outbox exists to prevent. A failed job is visible and
  re-runnable.
- Consumers run on the worker entrypoint only, like the dispatcher.

### Adding a configuration artefact

No table and no code. Add a `config/seed/<kind>.<scope>.json` file and read it with
`ConfigurationStore.get({ kind, scope, on? })` — that is what DR-3 and Open/Closed mean here.
(One named input since 28 Aug 2026 — `kind` and `scope` are both free-form strings, and the
positional form let a swap compile and answer "nothing registered".)

- **Two tables, and the split matters.** `config.entry_version` keeps every version, immutable once
  published; `config.entry_schedule` keeps only what is in force and carries
  `PRIMARY KEY (kind, scope, validity WITHOUT OVERLAPS)`. §7.9 states that key for "every
  effective-dated config table", but it cannot sit on a table holding superseded versions — they
  necessarily overlap.
- **Publish flips `version_id` on the slot; revert flips it back.** Neither deletes anything, which
  is why revert is safe under pressure and why the schedule needs no DELETE grant.
- **The store version is bumped by a trigger on the schedule**, not by the publishing code. A
  publish that forgot to bump it is a change no replica ever notices.
- **A statement-level trigger fires even for a zero-row statement.** An UPDATE that matches nothing
  still bumps the version, so check the slot exists before flipping it. This has already cost one
  spurious cache invalidation per first publish.
- Dates are **calendar dates** (NFR-34). Which factor set applies on 1 January must not change with
  the reader's timezone.

Task 27.2 adds the tenant second factor (NFR-95, UC-193 … UC-195): `identity.totp_credential` —
`account_id` as the primary key, the secret typed `identity.encrypted_secret`, and `confirmed_at`
which is what makes enrolment two steps — plus `identity.recovery_code`, ten single-use SHA-256
hashes per account. `GET /api/v1/account/totp` and `POST /api/v1/account/totp/{enrolment,
confirmation,removal,recovery-codes}` behind `@RequiresAccount()`, in `identity/account` because it
owns credentials. **"Enrolled" is `confirmed_at IS NOT NULL`, never "a row exists"** — a secret an
authenticator failed to capture must leave the account unchallenged. Enrol and disenrol require the
current password (§12.5.6); a provider-only account has no credential row and its session stands as
one. The **challenge** is not here: answering a factor happens during sign-in and is task 27.3's,
in `identity/session`. Action-noun routes rather than `DELETE` with a body, following
`POST /invitations/{preview,acceptance}` — `DELETE` with a body is unevenly supported through
proxies, which is not a thing to find out on the route that turns a security control off.

Task 27.3 folds the challenge into sign-in (UC-194, UC-195). `POST /api/v1/auth/session` now
answers **one of two shapes**, discriminated by `kind`: a session for an account with no factor —
unchanged, and most of them — or a sealed challenge for one that has it, completed at
`POST /auth/session/factor`. **The challenge is returned in the BODY, not a cookie**, because
OQ-33 gives the tenant session cookie to `apps/web` and AD-9 makes this api a back channel; the
admin realm's cookie-borne challenge is not copyable here. It carries `{accountId, issuedAt, kind}`
sealed under an HKDF key from `AUTH_JWT_SECRET`, lives five minutes, and is deliberately **not**
single-use so a mistype keeps the caller on the step. Factor failures count toward the **same**
`failed_attempts` as the password step (a separate budget would give 10^6 free guesses), and the
throttle key is `factor-challenge:<ip>:<accountId>` — keyed on the **account**, unlike sign-in's,
which carries the email. A test draining `auth_attempt` by address alone will miss it.

**The lock is read here as well as written** (27 Aug 2026, review). It shipped incrementing
`failed_attempts` and never checking `locked_at`, so `AccountLockedError` was unreachable on this
route and S-01's lockout state was dead code on the screen. Two things a reader should know before
editing it: the counter enters this step at **zero**, because the password success that produced the
challenge cleared it, and the window admits five attempts against a five-minute challenge — so **ten
failures is not a state this step can reach on its own**, and the throttle, not the lockout, is what
makes 10^6 unwalkable. The use case's original header claimed the opposite of both, and also claimed
the factor step spends sign-in's key; it spends its own.

Task 27.5 adds FR-7 (UC-10): `POST /api/v1/account/password` behind `@RequiresAccount()`, with
`terminateOtherSessions` **opt-in** because the requirement says *where the user elects it*. Two
things it does not share with FR-6's reset. It spares the **current** session — "other" is the
word, and the session id comes from the request context, never the body, or a caller could
nominate which session to keep. And it revokes with a fourth `revoked_reason`, `password_changed`,
added by migration rather than borrowing `password_reset`: the column exists so support can tell
the causes apart.

**Every route that asks for the current password behind a session shares one throttle key**
(`reauthentication:<ip>:<accountId>`, §12.5.6) — this route and task 27.2's three password-gated
TOTP routes, which shipped without one. A settings screen has one budget, not one per control. It
is **not** wired to FR-4's lockout: the caller already holds a session, and a mistype must not sign
them out of every device. Two consequences for tests: the key carries the **account id**, so a
drain matching an email address misses it; and a suite touching these routes more than four times
must drain between tests, which is how the retro-fit announced itself.

**`admitAuthAttempt` is the window, and there is one of it** (27 Aug 2026, review). Spend a window
with `admitAuthAttempt(tx, { key, now })` — never by hand. The count-record-compare shape had been
written out four times and **all four recorded the attempt before deciding**, which inverts
§12.5.6's rule that a refused attempt is not recorded: recording it re-arms the window on every
request, so a hammering client's block never drains — and the client hammering an auth route is
usually its owner, retrying after a mistype. `SignIn` was the one correct copy. `auth-throttle.spec.ts`
pins the property, and it is the only test in the file that can tell the two versions apart: a
refused attempt still throttles, so "the sixth is refused" passes either way.

**A fourth TOTP route needed its own key.** `POST /account/totp/confirmation` takes a *code*, not a
password, and was read as needing no window — leaving the one route that mints ten recovery codes
unbounded. It is now `totp-confirmation:<ip>:<accountId>`, its own segment so a fumbled enrolment
does not spend what the password change needs.

**A service that resolves ambient context must forward ALL of it.** `TotpService` resolved
`accountId` and dropped `clientIp`, so its routes threw away the per-IP half of the key while
`PasswordService` on the same screen kept it — two different keys, and the paragraph above claiming
they share one was false in the shipped code. Nothing failed: a coarser key still throttles.

Task 27.6 adds FR-8 (UC-11, UC-12): `GET /api/v1/account/providers`,
`POST /api/v1/account/providers/{provider}` and `.../removal`, behind `@RequiresAccount()`.
**A link BEGINS on task 24's public challenge route, unchanged** — that route builds an
authorization URL and needs no actor — and only the redemption is new and authenticated.
`SOCIAL_SIGN_IN_INTENT.LINK` tells the web tier which completion to return to. Both operations take
the current password on 27.5's key. **BR-ID-4 is `isLastCredential`**, one predicate over the
password row *and* the provider identities, counted inside the same transaction as the delete.

**Task 28.3 makes the user-facing-text rule a gate too, and the split between the two halves is
the point.** `message-content.spec.ts` checks the **corpus** — every string in
`packages/i18n/catalogues` that can become a `title` or a `detail`, in all three locales,
hermetically. That is what establishes *every error body passes the rule*, because every body the
filter can emit is one of those strings on one of its three paths. `test/problem-documents.e2e-spec.ts`
checks the **envelope on the wire**, which no static check sees: the content type, the `type` URI,
NFR-90's correlation id in the body agreeing with the `x-correlation-id` header, its derivation from
an inbound W3C `traceparent`, and the negotiated `content-language`. Verified by planting
`(FR-12; see identity.membership)` in a real message — the corpus gate failed and the e2e stayed
green, because that string is a 403 and the e2e raises 401, 400 and 404. Neither is the other's
substitute.

**The detector is `findInternalIdentifiers` in `@easyesg/i18n`, and its shape is a lesson.** The
first draft matched kebab-case as a proxy for a problem-type slug and flagged `sign-in`, `e-mail` and
the Romanian clitics `s-a`, `v-o`, `acceptat-o` — nineteen hits in `ro.json`, none a defect. **Match
the actual vocabulary where one exists and a shape only where none does**: slugs are handed in from
`Object.values(ProblemType)`, and the surviving shapes (spec identifier, `SCREAMING_SNAKE`,
`schema.table`, `snake_case`, stack frame) each scored zero false positives against all three
catalogues. A term that is a single lowercase word is skipped — `ProblemType` contains `conflict` and
`internal`, and matching those flagged the English `problem.conflict.title`, which reads "Conflict".

**A message key without a catalogue entry is invisible, and `message-keys.spec.ts` is why that is
now a gate.** `ProblemDetailsFilter` reads `detail` from `exception.messageKey` for a `DomainError`
and from `problem.<slug>.detail` for a framework exception — so text authored under the slug is
**dead** for a domain error, which is how four properly-translated social messages looked like
coverage while contributing nothing. A missing key makes `translate` answer `undefined` and the
filter omit `detail`: right failure, silent failure, and NFR-79's second and third parts gone. The
i18n parity harness cannot see it, because it compares the three catalogues to each other. **Adding
a `DomainError` means adding its key to all three catalogues in the same change.**

Task 28.2 makes the permission model **checkable rather than conventional**, in two halves that
prove different things and are worth keeping apart:

- **`src/testing/route-permissions.ts`** holds one table: every route on the surface and the
  permission it declares. `route-permissions.spec.ts` walks `@Module`/`@Controller` metadata from
  `AppModule` — no container, no provider, no database — and compares the whole computed surface
  with `toEqual`. That shape catches three mistakes with one assertion: a **new** route with no
  declaration, a route whose permission **changed** (`GET /members` moving from OA to any
  authenticated account is a privilege escalation that compiles and passes every other test), and a
  route **deleted** while its row stayed, which is how such a table normally rots into fiction.
- **`test/route-matrix.e2e-spec.ts`** drives every tenant route × six actors over real HTTP and
  **derives** the expected outcome from that same table. One table, two claims: a declaration
  nothing enforces is a comment, and enforcement nobody wrote down is the surface someone
  remembered. Both were verified to bite — the hermetic one on a changed and on a missing
  declaration, the matrix on a simulated `RequiresRoleGuard` regression that the hermetic gate
  cannot see (declarations unchanged, 4/4 green, matrix 21 red).

**Adding a route means adding a line to that table**, and there is no default: `@Public()`,
`@RequiresAccount()` or `@RequiresRole(...)`, at class or method level. The entitlement axis is
deliberately not checked here — `@RequiresEntitlement` has no guard until task 54, and annotations
nothing can verify decay before their reader arrives.

**The matrix asserts authorization and nothing else**, which is what makes it affordable: a refused
caller is refused before the body is read, so every request goes out with `{}`. It distinguishes on
the **problem type**, never the status — `401` means both "no session" and "wrong password", and the
first version of that reader sliced the base URI without its separator, read every refusal as
`admitted`, and briefly looked like the guards had stopped refusing.

### Adding a column that holds a secret

Since task 27.1 there is one mechanism and the database enforces it (§12.5.6's secrets-at-rest row).

- **Is it recoverable?** If the application only ever *compares* the value, it is a hash and none of
  this applies — `password_hash` and every `token_hash` are deliberately plaintext-by-design, and
  encrypting a one-way digest protects nothing while adding a key whose loss is catastrophic. If the
  application must *read it back* — a TOTP secret, a provider credential — it is a secret at rest.
- **Declare the column as `identity.encrypted_secret`**, never `text`. The domain's constraint is
  what makes plaintext unrepresentable for every writer, `psql` included; a `CHECK` you write
  yourself is a fourth copy of a pattern that must not drift.
- **Seal and open at the persistence boundary**, through `SECRET_CIPHER` — never in a use case. The
  domain type is the secret; that it is stored encrypted is the store's business, exactly as OQ-50's
  epoch-ms conversion is.
- **Classify it** in `test/schema-invariants.e2e-spec.ts` (`ENCRYPTED_SECRET_COLUMNS`, or
  `PLAINTEXT_BY_DESIGN_SECRET_COLUMNS` with the reason). A column named `%secret%` or `%password%`
  that is in neither fails the gate — which is the point, and the reason the gate exists rather than
  a review note.
- **`open` throws.** Do not catch it into a falsy value: a secret that will not open is a wrong
  `SECRET_ENCRYPTION_KEY` or a corrupt row, and answering "no secret" turns an operator
  misconfiguration into what looks like a mistyped code.

### Adding a table inside a filing

A tenant table with a foreign key into `core.report` or `core.reporting_period` is **inside a
reporting period's lock**, and FR-22 makes a locked period read-only. Attach the guard in the same
migration:

```sql
CREATE TRIGGER refuse_locked_write BEFORE UPDATE ON core.<table>
  FOR EACH ROW WHEN (OLD.<status or lock column> = ...) EXECUTE FUNCTION core.refuse_...();
```

— or add the table to `LOCK_GUARD_EXEMPT_TABLES` in `test/schema-invariants.e2e-spec.ts` with its
reason. The gate fails a table that is in neither (task 31.4).

**The risk it guards is not a trigger being removed; it is a table being added without one.** Task
31.4 declined a `core.report_snapshot` because FR-22's lock already carries the guarantee that a
locked period and an export cannot disagree — so the lock reaching every table inside a filing is
the argument that decision stands on, and it had to become a gate rather than a review property.
**Task 34's disclosure store is the case it was written for**: it hangs off `core.report`, and a
report whose values stay editable while its period is locked is FR-22 defeated by a table that
shipped afterwards, with RLS and per-field audit correctly attended to and nothing failing.

Reachability is the **foreign key**, not a list of names, so a table joins the rule by being
modelled rather than by being remembered.

### Adding an audited table

Attach the capture trigger in the same migration and add the table to
`FIELD_AUDITED_TABLES` in `test/schema-invariants.e2e-spec.ts` — or to `UNAUDITED_TABLES` with a
reason. The gate fails a table that is in neither, because an unaudited table produces no error,
just a gap nobody can see later.

**"A table" means a tenant table anywhere, not a `core` table** (corrected 25 Aug 2026, task 25.1).
The rule read `nspname = 'core'` until `identity.membership` became the first tenant-scoped table
outside that schema and would have shipped unaudited in silence. It now uses the same two clauses
the RLS rule does: in `core`, **or** carrying `organization_id`.

```sql
CREATE TRIGGER capture_field_change AFTER INSERT OR UPDATE OR DELETE ON core.<table>
  FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at');
```

**The table needs an `id uuid` column, and nothing tells you so.** The function resolves the record
it is describing with `coalesce(after ->> 'id', before ->> 'id')::uuid`, so a composite primary key
with no `id` attaches cleanly, migrates cleanly and fails on the first write — a plpgsql body is not
validated at creation. §7.9's `uuidv7()` convention is load-bearing here, not merely conventional.

**Ignore a column the request path touches on every request.** `identity.membership.last_active_at`
is in the ignore list because task 28's guard writes it per request, and capturing that would make
the system's highest-volume writer a writer of its highest-volume audit table — to record that
somebody was present. FR-54 is about who changed a *value*.

`TG_ARGV[0]` names the tenant column — `id` for the tenant root, `organization_id` everywhere else.
`TG_ARGV[1..]` are columns to ignore. The comparison is over `jsonb` row images, so no table needs
its own plpgsql.

**Two traps this function has already sprung.** A plpgsql body is **not validated at creation**, so
a missing function inside it applies cleanly and fails on the first write — `akeys(hstore(...))` did
exactly that. And backticks inside a SQL comment close the TypeScript template literal the migration
is written in.

**Three layers deny, in this order**, and only the first two are visible in a normal test: privilege
(`esg_app` holds `INSERT, SELECT`), then RLS (no UPDATE/DELETE policy, so even the owner matches
zero rows and gets `UPDATE 0` rather than an error), then the triggers. To see a trigger fire you
must lift the first two — which `append-only.e2e-spec.ts` does inside a rolled-back transaction,
because a trigger that never fires looks exactly like one that was never created.

## Persistence — AD-14's five constraints

1. `synchronize: false` permanently. Migrations are **hand-authored SQL** in TypeORM migration
   classes; generated ones read RLS policies, grants and `uuidv7()` defaults as drift and revert them.
2. Every tenant query on the request's `QueryRunner` (above).
3. **Two `DataSource`s** — `coreDataSource`, `billingDataSource`, with `audit` entities on both so
   an outbox row commits in the same transaction as the billing state change. A **third**,
   `migration.data-source.ts`, runs the migrations and is not one of them: it connects as
   `esg_migrator`, a role the runtime never holds (§7.6, §7.7).
4. `numeric` stays a **string** (NFR-58). A `transformer` calling `parseFloat` is the failure mode.
5. `RETURNING old.*, new.*` is raw `queryRunner.query()` — not expressible in the query builder.
   **Per-field capture itself is a trigger, not an application function** (AD-14 amended 20 Aug
   2026): a function must be called, and a plain `UPDATE` would bypass it silently.

### Migrations — five things that cost time to rediscover

- **`migrations` is an explicit array, not a glob** (`persistence/migrations/index.ts`). A
  `*{.ts,.js}` glob also matches the emitted `.d.ts` files, and a history assembled by filesystem
  order is not reviewable. Adding a migration is two edits — the file and one line — and
  `index.spec.ts` fails if the second is forgotten.
- **Schema-qualify every object.** TypeORM's postgres driver does not set `search_path`, so an
  unqualified `CREATE` lands wherever the migration role's default points — `public`, here. That
  is a silent wrong answer, not an error.
- **The datasource module may export exactly one `DataSource`.** `CommandUtils.loadDataSource()`
  walks every export and refuses when more than one matches, so adding `export default` beside the
  named export fails with "must contain only one export of DataSource instance" — naming the same
  object twice.
- **`name` is gone from `DataSourceOptions` in TypeORM 1.1.** It was a 0.3-era `ConnectionManager`
  leftover; naming a connection is now `@nestjs/typeorm`'s `TypeOrmModuleOptions.name`. Every
  pre-1.0 example still puts it in the options object.
- **The ledger schema is bootstrapped by `init.sh`, not by a migration.** `MigrationExecutor`
  creates its table before executing anything and never calls `createSchema`, so a ledger schema
  created by a migration could never be created at all.
- **Storage is `timestamptz`; the wire is epoch-ms** (OQ-50, closed 19 Aug 2026). The conversion
  happens where a row becomes a DTO and must not leak inward — a use-case signature taking a number
  of milliseconds has admitted the wire format into the core. `test/schema-invariants.e2e-spec.ts`
  fails on a naive `timestamp` column, and on a `date` with no `_tz` sibling (NFR-34).
- **`test/` is inside `tsconfig.json`'s program, and `rootDir` lives in `tsconfig.build.json`.**
  Three constraints meet here: `rootDir: ./src` in the base puts test/ outside the program
  (TS6059), omitting rootDir breaks ts-jest which demands one whenever outDir is set (TS5011), and
  a separate test tsconfig hides test/ from ESLint's project service, which discovers
  `tsconfig.json` only. Do not "tidy" this back.
- **`queryRunner.query()` returns a different SHAPE per SQL command, and nothing warns you.**
  `SELECT` and `INSERT ... RETURNING` give you the rows; `UPDATE ... RETURNING` and
  `DELETE ... RETURNING` give you `[rows, rowCount]` — TypeORM builds `raw` with a switch on the
  driver's `command`. So the identical `RETURNING` clause reads as `rows[0].id` after an INSERT and
  as `undefined` after an UPDATE, with no error where you wrote it: it surfaces later as a
  `TypeError` on a property of what should have been a row. Normalise at the call site — see
  `returnedRows` in `persistence/identity/account-store.repository.ts` — rather than remembering
  which command you are in. Found on task 19, on the first `UPDATE ... RETURNING` in the codebase.
- **`EntityManager.query` and `QueryRunner.query` take their row type differently, and neither
  spelling works for the other.** `EntityManager.query<Row[]>(sql, params)` is generic and
  unoverloaded, so a trailing `as Row[]` is flagged by `no-unnecessary-type-assertion`.
  `QueryRunner.query` carries a `useStructuredResult` overload, so a type argument selects the wrong
  signature (TS2558) and the assertion is the only form. Same call, two spellings, each forced —
  `membership-store.repository.ts` and `account-store.repository.ts` are the two worked examples.
- **jest hands a test a *copy* of `process`**, so `process.loadEnvFile()` in a spec mutates a
  sandbox and real credentials never arrive — the symptom is a SASL error naming the password,
  which reads as a database fault. Load env before jest starts, as `db:invariants` does.

## Secrets are split per entrypoint

`AUTH_PASSWORD_PEPPER` (§9.1) is read by the **HTTP** tier and `EMAIL_PROVIDER` by the **worker**,
and each throws at boot when its own is missing. That is least privilege rather than tidiness: the
api hashes passwords and never sends mail, the worker sends mail and never hashes, and neither
should hold a secret it has no caller for. `AccountModule` splits its providers on `MODE` to make
it so, the way `OutboxModule` already splits the dispatcher.

`SECRET_ENCRYPTION_KEY` (task 27.1) joins the HTTP tier's list, and it is the one secret that is
**also** read outside the tier: `admin:provision` seals with it, and `db:migrate` needs it only when
rows already hold a plaintext secret to convert — a fresh database needs none, which is why CI's
migrate step passes none. It is deliberately not derived from `AUTH_ADMIN_SECRET`: rotating a session
secret costs one forced refresh and no data, while rotating this one makes every sealed column
unreadable until re-encrypted, so one variable for both would make the cheap rotation silently
perform the expensive one.

Neither has a default, and `EMAIL_PROVIDER`'s absence is deliberate: the `log` adapter writes a
recipient address and a verification link into the application log, which NFR-30 forbids of a
production pipeline — so a deployment that has not chosen a provider fails to start rather than
logging personal data for months. `emit-openapi.ts` runs in `preview` mode and instantiates no
provider, so the hermetic gates still need no secrets.

## The two things called "contracts"

| | |
| --- | --- |
| `src/contracts/` | In-process **port** surface — ports, events, shared types. Imported by `modules/**`. This is what enforces DR-1 |
| `@easyesg/contracts` | The **wire** contract — generated OpenAPI client, for `apps/web` and `apps/admin`. `apps/api` *produces* it and must never import it |

Say "the port surface" or "the contracts package"; never the bare word. `contracts-is-a-leaf`
forbids `src/contracts/` importing `app/`, `modules/` or `infrastructure/` — it is the shared kernel
every context depends on, so anything it reaches for becomes a transitive dependency of `core`.

## Wire conventions

- **Success is enveloped, errors are not.** `GlobalResponseInterceptor` wraps in
  `ResultObjectDto`/`ResultListDto`; failures leave `ProblemDetailsFilter` as RFC 9457
  `application/problem+json`. Controllers return plain data and never build either.
- **Bypasses exist and are load-bearing**: explicit 204, `StreamableFile`/`Buffer` (FR-53 needs a
  byte-identical re-download), and anything already wrapped.
- **Never throw `HttpException` from domain or use-case code.** Throw a `DomainError` subclass with
  a registered problem type; mapping a domain failure to a status is an adapter concern.
- **Pagination** is the compact format, opt-in per handler via `ListQueryInterceptor`:
  `?filters=f,v1,v2|f2,v3&order=f,asc&page=1&onpage=25`. `onpage=-1` only on routes marked bounded.
- **Time**: instants are `EpochMillis`; anything whose answer changes with timezone is a
  `LegalDate` (see `contracts/types/time.ts`).
- **No user-facing text in code, and this tier is where it gets resolved.** DTOs and errors carry
  message *keys*; wording lives in the committed catalogues under `packages/i18n/catalogues`
  (OQ-43 — the configuration store now holds only help-centre articles and plan copy). The API
  resolves them server-side against the locale negotiated from `Accept-Language` (OQ-46), so an
  envelope message carries `key` **and** rendered `text`, and a problem document carries a
  resolved `title`/`detail`. **A missing key omits the member rather than falling back to the
  slug** — `title: 'validation-failed'` is an internal identifier on a surface CLAUDE.md names
  explicitly, and RFC 9457 makes every member optional. No `FR-`/`UC-` identifier, enum name or
  element key ever reaches a screen, an export or a problem+json `detail`.

- **`DomainError` takes a message key and params, never a sentence.** The key is passed to
  `Error` so logs and traces still identify the failure — that surface is developer-facing and
  stays untranslated on purpose.

- **Cross-tree imports use `@api/*`, never a `../../` climb** (added 20 Aug 2026, task 19
  review). `@api/*` maps to `src/*`; one level up (`../dto/x`) stays relative, because that is a
  within-module neighbourhood reference. Enforced by ESLint (`no-restricted-imports`, gitignore
  patterns) — and NOT `@/*`, because `tsconfig.boundaries.json` is one resolver shared by every
  workspace and `@/*` is apps/web's there (`~/*` is admin's). It also keeps `@api/contracts/…`
  (the port surface) visually apart from `@easyesg/contracts` (the wire package).

  **tsc does not rewrite aliases in emitted JS**, so the alias is carried by five surfaces, and
  each has a guard: `postbuild` runs `tsc-alias` so `dist/` holds plain relative requires (the
  image runs `node dist/main.js` with no runtime dependency — verified by grepping dist for
  `@api/` after build); both jest configs restate it as `moduleNameMapper`;
  `tsconfig.boundaries.json` carries it for dependency-cruiser, guarded by `api-no-unresolvable`
  — without that rule a dropped mapping would not fail the boundary rules, it would make them
  **silently stop matching** — and by the `controllers-not-to-use-cases` fixture, which violates
  through the alias on purpose; `nest start --watch` works because @nestjs/cli registers
  tsconfig-paths for the process it spawns (verified 20 Aug 2026, not assumed). The **TypeORM
  CLI and seed runner have no registration at all**, which is why the files they load — the
  migration datasource, every migration, `seed-configuration*` — are lint-banned from the alias:
  an `@api/` import there fails at run time in whichever environment migrates first.
- **A closed vocabulary is declared once, as an `as const` object with a derived union — never
  scattered string literals.** The rule and its two exceptions moved to the root `CLAUDE.md`
  ("Conventions") on 21 Aug 2026: it was written here on 20 Aug and is not package-scoped —
  `apps/web`'s `API_OUTCOME` was already following it unwritten. Read it there; what is specific
  to this package is that a **contract surface is derived from the object** — `@ApiProperty({ enum:
  Object.values(ACCOUNT_STATUS) })`, where declaration order becomes contract order, so a
  reordering is a diff `openapi:check` fails on rather than a silent change to the published
  enum. `ACCOUNT_STATUS`, `APP_MODE`, `ProblemType`, `LOG_EMAIL_PROVIDER` and
  `SESSION_REVOKED_REASON` are this package's instances; `MessageType` predates the rule. Of the
  root file's two exceptions, the **migration-SQL** one lands only here, since migrations exist in
  no other workspace — and it pairs with a `CHECK` constraint holding the same vocabulary, so the
  object and the constraint are two copies that must be changed together by hand.
- **The catalogue must be initialised before anything serves.** `use-intl` and every current
  FormatJS release ship ESM only, and this app is CommonJS (OQ-48), so `initialiseCatalogue()`
  bridges with a dynamic `import()` and is awaited in both entrypoints. Forgetting it does not
  crash — every message silently vanishes — so it logs once at error level. Jest needs
  `NODE_OPTIONS=--experimental-vm-modules` to execute that import, which is why the `test` script
  sets it.
- OpenAPI is **3.1** only because `document.factory.ts` calls `setOpenAPIVersion('3.1.0')` —
  `DocumentBuilder` defaults to 3.0 and nothing fails loudly if the call is removed.
- **Swagger UI is served at `/docs`** (raw document at `/docs-json`), mounted in
  `configureHttpApp` over the same `buildOpenApiDocument` output the CI gate diffs — one
  generator, two consumers, and `docs.e2e-spec.ts` asserts the served document deep-equals the
  committed contract so the two cannot drift. Outside `/api/v1` like `health`, so it is an NFR-16
  allowlist entry; whether the production edge exposes it is task 71's routing decision, taken
  there rather than behind a config flag here.

## Before you call it done

The root `CLAUDE.md` says each app's file carries this checklist. This one did not until task 26.1,
which is the kind of omission the rule exists to catch: `apps/web` and `apps/admin` have had a React
pass baked into finishing a task since 24 Aug 2026, and `apps/api` — the workspace
`nestjs-best-practices` is named for — had nothing.

- **Load `nestjs-best-practices` and read it against the diff.** Not recalled — opened. The gates
  prove code runs; they say nothing about whether it belongs, and every finding a review has raised
  here was invisible to all sixteen of them.
- **Load `one-idea-per-file` too** (task 132) whenever a use case, service, controller, repository
  or consumer is added or grows — one behaviour per file, a vocabulary whole. The folder skill does
  not reach this app.
- **A rule considered and declined with a reason is a decision. A rule never opened is an omission
  wearing the same clothes.** Record both in the build-log entry, with the rule's own id, so the next
  reader can tell which happened.
- **Where the skill and this project's architecture disagree, the architecture wins** — the skill is
  a general-purpose guide, not written against `architecture.md`. `error-throw-http-exceptions` is
  the standing example: it asks for `HttpException`, and this codebase forbids one from domain or
  use-case code in terms. Decline it by name rather than silently.
- **Measure the database claims, do not reason about them.** `EXPLAIN` the queries a task adds; at
  these table sizes the planner prefers a sequential scan, so confirm an index is *usable* with
  `SET enable_seqscan = off` rather than concluding it is missing.
- **Then the run the root file's "Closing a task" calls for** — a sub-step gets only the gates its
  change reaches; the parent gets `pnpm gates:clean` and the three review agents. Then the build-log
  entry, which is half of what "finished" means. Never `pnpm gates` followed by `pnpm gates:clean`:
  the second wraps the first, so that is the same set paid for twice.

## Boundary rules

Ten, in `.dependency-cruiser.cjs`: `core-not-to-billing`, `billing-not-to-core`,
`api-no-unresolvable`, `controllers-not-to-use-cases`, `cross-cutting-not-to-modules`,
`api-not-to-contracts-package`, `contracts-is-a-leaf`, `domain-free-of-frameworks`,
`email-port-behind-notification`, `no-circular`.

**`email-port-behind-notification` is AD-11's one mail path** (task 49.2): nothing under `modules/` but
`platform/notification` may import `EmailPort` or the email adapters. A module that has mail to send
sends a notification category's email through `NOTIFICATION_EMAIL_PORT`, which the notification module
exports in worker mode — so FR-170's delivery evidence and FR-171's suppression, when they land, have one
place to live and reach every notice at once.

All ten have a fixture in `tools/prove-boundaries.sh` proving they reject a real violation. Keep
that true: if you add or edit a rule, add its fixture in the same change. A rule that matches nothing
looks exactly like a rule that passes — `domain-free-of-frameworks` shipped inert on its first run
because dependency-cruiser matches npm dependencies by *resolved* path, so `^@nestjs` never matched
`node_modules/@nestjs/...`.

## Before you add a route

- It belongs to a module that already owns its FR range (§17.5). If it seems not to, that is a
  question, not a judgement call.
- The active organization comes from the **session** — never a path segment, header or token claim.
  An `{id}` in a tenant path is a second, contradictory source of tenancy.
- Nothing long-running in the request tier (AD-10). Long work is `202` + job id, enqueued **through
  the outbox** — `api` never enqueues directly.
- Gate it with `@RequiresRole(...)`, `@RequiresAccount()` or `@Public()` — one of the three, at
  class or method level, and **add its line to `src/testing/route-permissions.ts`**. The decorator
  applies its own guard, so there is no second thing to remember; the table is what makes the
  *choice* reviewable in one place instead of inferred from a decorator three directories away.
  Since task 28.2 a route declaring none fails `route-permissions.spec.ts`, so "closed by default"
  is a gate rather than a review property.
- Gate it with `@RequiresEntitlement(key)` or record why it needs no key.
- **No `default:` on a request DTO's `@ApiProperty`/`@ApiPropertyOptional`.** openapi-typescript
  treats a property carrying a default as always present and emits it **required**, so the generated
  client obliges every caller to send a field the schema's own `required` list omits. State the
  default in the `description`, where a reader needs it, and apply it in the use case, where it can
  actually be applied. Gated hermetically by `src/infrastructure/openapi/contract-shape.spec.ts`,
  which walks every schema a `requestBody` points at — added at task 32.3 after the same defect
  arrived three times (`SignInRequestDto.remember`, `CreateReportRequestDto.scope`, and
  `ChangePasswordRequestDto.terminateOtherSessions`, which nobody had noticed at all). A default on
  a **response** property is a different claim and is untouched by the rule.
- A list handler returns a bare array and is annotated `@ApiListResponse(Dto, …)`. Annotating it
  `@ApiOkResponse({ type: [Dto] })` publishes a contract saying the body IS an array, while
  `ResultListDto` arrives — the generated client then reads `response[0]` where `response.objects[0]`
  is.
- Regenerate and commit the spec: `pnpm openapi:check` fails otherwise. It compares the working tree
  to the index, so **staging the regenerated files is what makes it pass** — the gate is "the spec
  in the commit matches the source in the commit", not "the spec is unchanged".
