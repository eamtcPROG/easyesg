# Functional requirements — Part 8: Cross-cutting obligations, the public tier and data-subject requests

Part 8 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.29 Cross-cutting | FR-153 … FR-159 |
| 3.33 Public tier *(new; added with FR-204 … FR-206)* | FR-204 … FR-206 |
| 3.34 Data-subject requests *(new; added with FR-207)* | FR-207 |

Business rules held here: BR-ACC-5 (§4). Entities held here: none (§5).

**The seven cross-cutting requirements have no originating use case, and that is intentional** (index §9.4 G-1). They are obligations no single use case owns and every one depends on, and each is verified as architectural conformance: by a gate in the gate set, a suite that runs in CI, or a review the sources name. Their *Actors* row therefore says who or what is checked, not who initiates. Each traces to a design decision (`DR-n`, `AD-n`, `P-n`) and to an NFR instead of to a use case. **No task row cites them**, with two exceptions (task 51.4 cites FR-157; task 78.2 cites FR-155), so the tasks named in their Status lines are the ones the sources credit with building the mechanism. **That inference is accepted as the proof** (§12.5.6 task-182 tracking row, 182/159): an architectural requirement's tasks are the ones the sources credit, and the rows 41, 44, 47, 54.1, 55.2, 59 and 61.3 name their requirement at their next edit.

**The four requirements added on 5 Oct 2026 (FR-204 … FR-207) close two gaps the index recorded.** UC-177, UC-178 and UC-179 had screens (S-29, S-30, S-31) and no requirement (index §9.4 G-9), and a data-subject request had one defined behaviour, the fiscal-retention precedence in FR-130, and none for anything else (index §10 OQ-5). They take the next free numbers after FR-203. **UC-182 (the route to support, S-34) has no requirement yet**, and none is written here: its channel is undecided and waits on task 77.1. UC-180 and UC-181 are FR-61's and FR-64's.

## 1. Cross-cutting obligations (index §3.29)

### FR-153 — Report operations are reachable through the documented API

**Status.** Partial — delivered 2, 3, 21, 31 (31.3), 89 · remaining 41, 44, 47 (the validation and export routes), 192 (report deletion, FR-210)

**Obligation.** The system shall expose report CRUD, validation and export operations through a documented, authenticated API and not only through the interface.

| | |
|---|---|
| **Actors** | Any authenticated caller, under the same authorization the interface applies. Neither front end is privileged by being first-party. |
| **Traces** | *(architectural, index §9.4 G-1)* · DR-11 · P-5 · AD-9 · NFR-16 · NFR-83 · NFR-13 · FR-158 |
| **Surfaces** | `packages/contracts/openapi/v1.json` · `pnpm openapi:emit`, `pnpm openapi:check` · `POST` and `GET /reports`, `GET` and `PATCH /reports/{id}`, `PUT /reports/{id}/values`, `/reports/{id}/modules…`, `/reports/{id}/calculator/…` |

**Behaviour.**
1. `apps/web` and `apps/admin` are ordinary clients of one public API. The tenant web app's server tier is a session-holding proxy: it holds the session cookie and forwards each request with a short-lived access token, and every route it calls exists in the public OpenAPI surface and is authorized identically (AD-9).
2. The surface is one versioned REST API under `/api/v1`, authenticated by a bearer access token. The active organization comes from the session, never from a header or a path segment (`architecture.md` §6.8).
3. The contract is **generated from the controllers** and diffed in CI together with the types generated from it. A controller change that is not committed as a contract change fails `openapi:check` (§6.8; P-5).
4. Breaking changes are introduced only in a new version and only after a stated deprecation window (NFR-83). The window's length is deferred to the day a second version is planned, on the recorded assumption that none exists before the pilot (§12.5.6 task-182 tracking row, 182/163).
5. Of the six named operations, create, read and update of a report are built (`POST /reports`, `GET /reports[/{id}]`, `PATCH /reports/{id}` for the scope) together with the value and calculator routes. Validation and export have no route yet (tasks 41, 44, 47). **Delete is an operation** on a report (182/23): `DELETE /reports/{id}`, the Organization Administrator's alone, soft, only while the period is open and only if the report has never been exported, and specified by FR-210. It is not built (192).

**Refusals.** A request with no valid credential → 401 `authentication-required`. Authorization refusals are FR-158's.

**Boundaries.** What each role may do is FR-158. Every route's declared permission is committed in `route-permissions.ts` and compared with the surface on every run (FR-158/AC-4). A route that needs a plan entitlement is FR-100's and task 54's.

**Acceptance criteria.**
- **AC-1** Given a report create, read or update (scope), a value write or a calculator operation that the interface offers, when the same request is sent to the documented API with a valid credential, then it succeeds the same way. No interface-only privileged route exists. *(source: FR text; NFR-16; P-5)*
- **AC-2** Given a request to any operation without a credential, then it is refused with 401. *(source: FR text; task 28.1 row)*
- **AC-3** Given a controller route is added, changed or removed, when `openapi:check` runs without the contract and the generated types being regenerated and committed, then the gate fails. *(source: §6.8; P-5; NFR-83)*
- **AC-4** Given the web app's server tier acts for a signed-in user, then it calls only routes that appear in the contract. *(source: AD-9)*
- **AC-5** Given a report, when validation is requested through the API, then it is performed under authentication. *(source: FR text)* Unmet until 41.
- **AC-6** Given a report, when an export is requested through the API, then it is queued under authentication. *(source: FR text; AD-10)* Unmet until 44 and 47.
- **AC-7** Given every tenant-facing capability, then 100% is reachable through the documented API under identical authorization, with zero interface-only routes. *(source: NFR-16)* The verification is `openapi:check`, the route-permission table and the two boundary rules `web-not-to-api-src` and `admin-not-to-api-src`, which together stand for the route-coverage diff NFR-16 named: a client can reach the API only through its public address and cannot import its source (§12.5.6 task-182 tracking row, 182/162).

**History.**
- 5 Oct 2026 · project owner · the route-coverage diff NFR-16 names is discharged by the contract gate, the route-permission table and the two boundary rules, and NFR-16's verification says so · §12.5.6 task-182 tracking row (182/162)
- 5 Oct 2026 · project owner · the deprecation window's length is deferred to the day a second version is planned · §12.5.6 task-182 tracking row (182/163)

- **AC-8** Given the Organization Administrator and a never-exported report in an open period, when the same request that the interface offers is sent to the documented API, then the report is deleted as FR-210 states. *(source: FR text; §12.5.6 task-182 validation row, 182/23)* Unmet until 192.

**History.**
- 5 Oct 2026 · project owner · *delete* stays in the obligation and is FR-210's · §12.5.6 task-182 validation row (182/23)

### FR-154 — The compliance core does not depend on plan, price or tenant type

**Status.** Partial — delivered 2, 10, 17, 18 · remaining 54.1, 54.3 (the null entitlement implementation; the billing-off job green across the whole core suite)

**Obligation.** The system shall keep the compliance core free of any dependency on plan, price or tenant type, such that disabling billing entirely leaves every reporting use case UC-17 … UC-48 functioning.

| | |
|---|---|
| **Actors** | No actor. CI evaluates it: the boundary gate and the `BILLING_ENABLED=false` job. |
| **Traces** | *(architectural, index §9.4 G-1)* · D-11 · DR-1 · AD-1 · AD-5 · NFR-1 · NFR-15 · UC-17 … UC-48 |
| **Surfaces** | `BILLING_ENABLED` · the CI job of that name and `billing-disabled.e2e-spec.ts` · boundary rules `core-not-to-billing` and `billing-not-to-core` · `EntitlementPort` |

**Behaviour.**
1. `core` and `billing` are two PostgreSQL schemas with no cross-schema foreign key and no shared transaction or table (DR-1; NFR-15; task 10).
2. Static analysis forbids any import between `modules/billing/**` and `modules/core/**` except through `contracts/`. Each rule has a fixture proving it rejects a real violation (AD-1; `boundaries:prove`).
3. Traffic between the contexts is one-directional. Billing publishes `EntitlementChanged`. Core reads entitlements through an interface whose only real implementation lives in billing and whose **null implementation grants everything** and runs when billing is disabled (AD-1; AD-5).
4. With `BILLING_ENABLED=false` the process holds no billing connection, and with it enabled the process does. The flag is read at module-definition time, so one process cannot exercise both branches. CI therefore runs the suite in both modes, and the pair, not either run, is the proof (task 18 row; `billing-disabled.e2e-spec.ts`).
5. Comprehensive reporting stays authorable with billing disabled (FR-177; task 81.1).

**Boundaries.** The entitlement service and its seams are FR-99 … FR-105's. This requirement is only that the core does not need them.

**Acceptance criteria.**
- **AC-1** Given billing is disabled, when the suite for UC-17 … UC-48 runs, then every use case completes. *(source: FR text; NFR-1)* The job exists and the suite grows as the use cases land. Unmet in full until 54.3.
- **AC-2** Given a file under `modules/core/**` that imports from `modules/billing/**`, or the converse, other than through `contracts/`, then the boundary gate fails. *(source: AD-1; task 2 row)*
- **AC-3** Given `BILLING_ENABLED=false`, then no billing connection exists in the process. Given `true`, one does. *(source: task 18 row)*
- **AC-4** Given a foreign key from `billing` to `core` or the converse, then the migration check fails. *(source: DR-1; NFR-15; task 10 row)*
- **AC-5** Given billing is disabled, when the core asks whether a capability is granted, then the answer is yes. *(source: AD-1; AD-5)* Unmet until 54.1.

### FR-155 — Internal names and structure mirror the VSME taxonomy

**Status.** Built — delivered 33.1, 33.3, 34.1, 34.2, 78.2

**Obligation.** The system shall mirror VSME taxonomy element names and structure in the internal schema rather than adopting a custom schema.

| | |
|---|---|
| **Actors** | No actor. Reviewed at each taxonomy version registration (NFR-2), by a Platform Administrator who registers it (FR-65). |
| **Traces** | *(architectural, index §9.4 G-1)* · NFR-2 · DR-2 · AD-3 · AD-4 · FR-177 |
| **Surfaces** | The registered taxonomy artefacts in `config/seed` · the disclosure store · `packages/vsme`'s generated facade · `pnpm facade:check` |

**Behaviour.**
1. A disclosure value is stored against a report under a key that **is** the taxonomy element's local name (for example `EnergyConsumptionFromFuels`). The set of elements, their datatypes, units, cardinality, dimensions and applicability come from the registered taxonomy version, not from types or table columns (AD-3).
2. There is no table or column per module or per disclosure (DR-2; AD-3's rejected alternatives).
3. A typed facade is generated per registered version from the taxonomy artefact, and a stale facade fails `facade:check` (AD-3; task 34.2).
4. The `2026-05-01` package carries 143 reportable elements, 34 of them dimensioned along 8 axes (AD-3, measured 29 Aug 2026).
5. The Comprehensive elements C1 … C9 are named verbatim from the published standard, because the names are the schema's own vocabulary (task 78.2 row; FR-177).

**Configuration-held values.** Three artefacts per registered taxonomy version, the taxonomy and its two classifications, in `config/seed`. The labels' wording ships as committed catalogues (`architecture.md` OQ-43).

**Acceptance criteria.**
- **AC-1** Given any B1 … B11 disclosure, then the key under which it is stored is the taxonomy element's local name. *(source: FR text; AD-3)*
- **AC-2** Given any C1 … C9 disclosure, then the same holds. *(source: task 78.2 row; FR-177)*
- **AC-3** Given a new taxonomy version is registered, then it is data plus a mapping, with no table added and no column changed. *(source: AD-3 consequences; NFR-86)*
- **AC-4** Given the generated facade differs from what the registered taxonomy generates, then `facade:check` fails. *(source: AD-3; task 34.2 row)*

### FR-156 — Third parties sit behind internal interfaces

**Status.** Partial — delivered 19, 24, 49.2, 51.1 · remaining 55.2, 59, 60

**Obligation.** The system shall place third-party components — EFRAG converter, payment providers, e-Factura, identity providers — behind internal interfaces, with no hard dependency on a single vendor.

| | |
|---|---|
| **Actors** | No actor. Reviewed per release (NFR-11); a substitute is activated in staging (NFR-14). |
| **Traces** | *(architectural, index §9.4 G-1)* · NFR-11 · NFR-14 · P-7 · DR-7 · AD-8 · D-7, D-8 · FR-114, FR-169 |
| **Surfaces** | `contracts/` ports and `adapters/`, one directory per port · the provider registry read from configuration · boundary rule `email-port-behind-notification` |

**Behaviour.**
1. Every third party is reached through a port declared in `contracts/`, with exactly one adapter per provider, registered in a provider registry read from configuration. No vendor type appears outside its adapter (P-7; NFR-11; `architecture.md` §8.1).
2. The ports `architecture.md` §8.2 names: `IdentityProviderPort` (Google, Microsoft), `EmailPort`, `CardAcquiringPort`, `InstantPaymentPort`, `BankTransferPort`, `MerchantOfRecordPort` (registered, inactive), `EInvoicingPort`, `ExchangeRatePort`, `ObjectStoragePort` and `DocumentConversionPort`, the last being the EFRAG converter, with no adapter wired at MVP.
3. Activating or replacing a provider is a configuration change plus an adapter, with the diff limited to those two (NFR-14). The mail provider is an environment value: an EU provider is a host, a port and a credential, not a class (NFR OQ-17).
4. Built today: `IdentityProviderPort` (task 24) and `EmailPort` (task 19), the latter reached only through the notification module (task 49.2) with an SMTP adapter chosen by configuration (task 51.1).
5. The EFRAG converter is a Phase 2 integration. The EFRAG Digital Template and taxonomy are registered offline and never fetched at runtime (`architecture.md` §8.2).

**Boundaries.** The behaviour of each port belongs to the requirement that uses it (FR-2 and FR-82, FR-114 … FR-120, FR-126, FR-127, FR-169).

**Acceptance criteria.**
- **AC-1** Given each named third party, then it is reached only through its port, and a substitute implementation can be registered without changing calling code. *(source: FR text)*
- **AC-2** Given a vendor type referenced outside its adapter, then the dependency review per release records a finding. *(source: NFR-11 verification)*
- **AC-3** Given a file under `modules/` outside the notification module that imports the email port or its adapters, then the boundary gate fails. *(source: §12.5.6 task-49.2 row (4))*
- **AC-4** Given a mail provider is replaced, then the change is a host, a port and a credential. *(source: NFR OQ-17)*
- **AC-5** Given a payment, e-invoicing or document-conversion provider, then the same holds. *(source: FR text; §8.2)* Unmet until 55.2, 59 and 60. The converter's port has no task.

### FR-157 — One mechanism delivers every system notification

**Status.** Partial — delivered 37.3, 49.1, 49.2, 49.3, 50.1.1, 50.1.4, 50.3, 51.1, 51.3, 51.4, 52.2.1, 52.2.2 · remaining 51.2, 65.1 (the producers not yet raising)

**Obligation.** The system shall deliver every system-initiated notification — payment failure, quota approach, trial expiry, dunning, taxonomy version change, invitation, outstanding-report notice — through one channel-agnostic mechanism recording delivery timestamp and channel. FR-160 … FR-173 specify that mechanism rather than adding a second one.

| | |
|---|---|
| **Actors** | No actor. Every producer is checked. |
| **Traces** | *(architectural, index §9.4 G-1)* · AD-11 · P-7 · NFR-84 · NFR-106 … NFR-109 · FR-160 … FR-173 |
| **Surfaces** | The notification module's port (`raise`) · boundary rule `email-port-behind-notification` · per-recipient delivery records |

**Behaviour.**
1. A notification is a first-class record held apart from the channels it travels on. One notice to two people on two channels is one notification with four delivery records (AD-11).
2. Every producer raises through the one port and acquires no delivery path of its own. The notification module is the single caller of `EmailPort` (§12.5.6 task-49.2 row (1)).
3. A producer raises an outbox event on its own request transaction, and the worker writes the record and the deliveries (§12.5.6 task-49.3 row (3); task 50.1).
4. Each delivery records the channel, the dispatch timestamp and the outcome (AD-11; FR-170).
5. A producer registers its category with the task that first raises it (§12.5.6 task-49.1 row).

**Boundaries.** Categories, channels, preferences, retry and suppression are FR-160 … FR-173's.

**Acceptance criteria.**
- **AC-1** Given any producer raises a notice, then it does so through the notification port and holds no delivery path of its own. *(source: FR text; §12.5.6 task-49.2 row)*
- **AC-2** Given a file outside the notification module that imports the email port, then the boundary gate fails. *(source: §12.5.6 task-49.2 row (4))*
- **AC-3** Given any dispatch, then its delivery record carries the channel and the dispatch timestamp. *(source: FR text; AD-11)*
- **AC-4** Given an invitation or a manual outstanding-report reminder is raised, then it travels through this mechanism. *(source: §12.5.6 task-50.1 and task-50.3 rows)*
- **AC-5** Given payment failure, quota approach, trial expiry, dunning, a taxonomy version change or an automatic outstanding-report notice, then each travels through this mechanism. *(source: FR text)* Unmet until 37.3, 51.2, 65.1 and the billing producers' own tasks.

### FR-158 — Authorization is enforced server-side on every request

**Status.** Built — delivered 11, 12, 25.2, 25.3, 28.1, 28.2, 31.3, 67.3, 88, 145

**Obligation.** The system shall enforce role-based access control server-side on every request, scoped per organization and per report, rather than in the interface layer.

| | |
|---|---|
| **Actors** | No actor. Every route × every actor is exercised by the route matrix. |
| **Traces** | *(architectural, index §9.4 G-1)* · NFR-13 · NFR-62 · NFR-63 · AD-2 · AD-12 · DR-5 · BR-ACC-3, BR-ACC-5 · OQ-30 |
| **Surfaces** | `AuthGuard` → `TenantTransactionGuard` → `RequiresRoleGuard` · `AdminRealmGuard` · `route-permissions.ts` · `route-matrix.e2e-spec.ts` and `admin-route-matrix.e2e-spec.ts` · `tenant-isolation.e2e-spec.ts` |

**Behaviour.**
1. The guard chain resolves session → account → membership → active organization on **every** request, from the server's records. The interface is untrusted, and no token claim carries an authorization consequence (`architecture.md` §6.2; AD-12).
2. A role change takes effect on the user's next request (BR-ACC-3).
3. Per-report rights are **derived on each request** from the member's organization role, the state of the report's period and the entity it belongs to. No per-report grant exists (OQ-30; §6.5). A multi-entity organization's editors can edit every entity's report.
4. Tenant isolation is structural. Every tenant table carries `organization_id`, with row-level security enabled **and forced**, and the application connects as a role that cannot bypass it. A handler that reaches the database outside the tenant transaction gets no rows (AD-2; `TenantTransactionGuard`; task 11).
5. Every route states its permission. The statement is a committed table compared with `toEqual` against the surface derived from the source, so a new route with no declaration, a changed permission and a deleted route each show as a diff (`route-permissions.spec.ts`; task 28.2).
6. The matrix drives every gated route as every actor over real HTTP, with the expected outcome derived from the same table. A response of `internal`, `rate-limited` or `session-expired`, or a 5xx without a problem document, is inconclusive and never read as *admitted* (§12.5.6 task-88 row).
7. The administrative realm has its own guard, separately addressed (NFR-65; `AdminRealmGuard`).

**Refusals.** No session → 401 `authentication-required` · a role that does not hold the permission → 403 `insufficient-role` · signed in and a member of nothing → 403 `membership-required` · an account still in setup → 403 `account-setup-required` · a report outside the active organization → 404 `not-found`, because row-level security shows the caller no row.

**Boundaries.** Who may edit a report, and when, is FR-26. Roles are assigned by FR-57 and FR-58. Plan entitlements are FR-100's.

**Acceptance criteria.**
- **AC-1** Given a request the interface would not offer, made by a role that does not hold the permission, then it is refused with 403. *(source: FR text; NFR-62)*
- **AC-2** Given a request without a session, then it is refused with 401 before any handler runs. *(source: task 28.1 row)*
- **AC-3** Given a session in organization A, when it reads a record of organization B, then nothing is returned, whatever the query's own predicate. *(source: NFR-63; AD-2; `tenant-isolation.e2e-spec.ts`)*
- **AC-4** Given a route that declares no permission, a route whose declared permission changed, or a declaration whose route was removed, then `route-permissions.spec.ts` fails. *(source: task 28.2 row)*
- **AC-5** Given every gated route and every actor (administrator, editor, viewer, a member of nothing, an account in setup, anonymous), then the matrix finds the outcome the table derives. *(source: task 28.2 row; NFR-62's suite)*
- **AC-6** Given a member's role is changed, then the next request is evaluated under the new role. *(source: BR-ACC-3)*
- **AC-7** Given the rights on a report, then they are computed per request and no stored per-report grant exists. *(source: OQ-30)*
- **AC-8** Given a revoked administrative session, then the request is refused within that request, and not at the next sign-in. *(source: NFR-62's target; §12.5.6 task-145 row)*

### FR-159 — Every state-changing action names its actor and time

**Status.** Partial — delivered 13, 14, 28.4, 67.4, 67.9 · remaining 61.3 (the billing audit ledger), 189 (the schema invariant over the capture trigger)

**Obligation.** The system shall attribute every state-changing action to an acting actor with a timestamp, across reporting, administration and billing alike.

| | |
|---|---|
| **Actors** | No actor. The three mechanisms are checked. |
| **Traces** | *(architectural, index §9.4 G-1)* · NFR-7 · NFR-33 · NFR-30 · DR-6 · P-11 · FR-54, FR-55, FR-81, FR-98, FR-151 |
| **Surfaces** | `core.field_change` · `audit.system_audit_log` read on A-08 · `AuditInterceptor` and `@AuditAction` · the billing ledger |

**Behaviour.** FR-159 is discharged by **three mechanisms, not duplicated by one** (`architecture.md` §6.2):
1. **Reporting and other tenant mutations.** A database trigger on the changing statement writes a per-field row to `core.field_change` with the acting user, the time and the previous value. There is no window in which a value has moved and its audit row has not (task 14; FR-54).
2. **Administration.** `AuditInterceptor` records every successful state-changing admin-realm request as one row in `audit.system_audit_log`, under the action the route declares with `@AuditAction`, carrying the operator, the target and the time. A route-table gate fails an admin-realm write that declares none (task 67.4 row (5)). Every admin sign-in attempt, successful or not, is recorded too, with a pseudonymous `subject` and never the address (task 28.4 row).
3. **Billing.** The billing ledger attributes its own mutations (DR-6). Not built.
4. These records are append-only: no `UPDATE` or `DELETE` is granted to any application path, enforced at the database and not in code (NFR-33; task 13).
5. An attribution outlives its person: `core.field_change.actor_id` carries no foreign key (task 14; FR-55).
6. **"Every state-changing action" means a change to a tenant business record**, and the claim is made checkable: a schema invariant requires each such table to carry the capture trigger or be declared exempt with its reason, in the model of the lock trigger's declaration (task 31.4). Sign-ins and notification events are on the exemption list (§12.5.6 task-182 identity and organization row, 182/4).

**Boundaries.** Reading the trail is FR-54's (S-12), the platform log's is FR-81's. Data-subject erasure against these records is FR-207's.

**Acceptance criteria.**
- **AC-1** Given a mutation of a tenant row that carries the capture trigger, then a `core.field_change` row with the actor and the time exists from the same statement. *(source: task 14 row; FR-54)*
- **AC-2** Given a successful state-changing admin-realm request, then one `audit.system_audit_log` row records the operator, the declared action, the target and the time. *(source: §12.5.6 task-67.4 row (5))*
- **AC-3** Given an admin-realm write route that declares no audit action, then the route-table gate fails. *(source: §12.5.6 task-67.4 row (5))*
- **AC-4** Given an admin sign-in attempt, whether it completes or fails, then it is a row in the system audit log. *(source: §12.5.6 task-28.4 row)*
- **AC-5** Given an `UPDATE` or `DELETE` against an audit or ledger table from the application role, then it fails at the database. *(source: NFR-33; task 13 row)*
- **AC-6** Given a billing mutation, then the ledger attributes it to an acting actor with a timestamp. *(source: FR text; DR-6)* Unmet until 61.3.
- **AC-7** Given a tenant table that holds a business record and neither carries the capture trigger nor is declared exempt with a reason, then `migrations:check` fails. *(source: §12.5.6 task-182 identity and organization row, 182/4; the model of AC-10 of FR-22)* Unmet until 189.

## 2. Public tier (index §3.33, new)

**Where the public tier sits.** S-29, S-30 and S-31 are three of the six unauthenticated screens of `architecture.md` §15.4's ninth step. Three properties hold across all of them (`design_spec.md` §5.1b). They are the only screens the framework may cache, because they are the only tenant-independent ones. They carry no session, so nothing on them may read or imply an active organization. And the authentication boundary is a list whose default is closed: a public route is public only because it was added to `UNAUTHENTICATED_SEGMENTS` (task 74.1 row). What is in the repository today is the chrome (74.1, in progress) and three addresses that answer a *not yet available* state in place of a blank page (task 103).

### FR-204 — The marketing home

**Status.** Not started — delivered none · remaining 74.1 (in progress), 74.2, 74.3, 74.4, 74.5, 74.6 (the pricing section, which waits for 53.3 and 76)

**Obligation.** The system shall let a visitor with no account and no session read, in the language they choose, what the platform produces and for whom, what it costs and what is asked of them before they sign up, and then proceed to registration or sign-in, while storing nothing against the visitor.

| | |
|---|---|
| **Actors** | VI (Visitor) reads. No account or session exists. |
| **Traces** | UC-177 · UC-01, UC-02, UC-178, UC-180 · `design_spec.md` OQ-12 · NFR-30 · FR-61 · FR-64 · `architecture.md` §14.2, OQ-31 |
| **Surfaces** | S-29 (Content archetype) · routes to S-01, S-30 and S-32 · the content read path of task 76 for the pricing section |

**Preconditions.** None. A person arrives at the platform's public address.

**Behaviour.**
1. The home holds the locale root, as `architecture.md` OQ-31 records for the time being: if a host split is confirmed, `/home` becomes `/` behind a redirect.
2. It shows what the platform produces and for whom, the eleven Basic sections named, how the work is sequenced, what it costs per company per reporting year, what is asked before signing up, and where the answers sit and who can see them (`design_spec.md` S-29).
3. The pricing section presents the plan presentation copy held under FR-61. It reads them through the content read path (task 76) once that and the plan copy (task 53.3) exist. **Until both exist the home ships without the section** and writes no price into the page, because a price written here would be a second source of truth for what task 53.1 versions on purpose (task-74.6 row; §12.5.6 task-182 public tier row, 182/118).
4. Its controls are register, sign in, language choice, and routes to the help centre and the legal set.
5. If the content read path is unavailable, the page degrades to itself without its pricing section and does not become an error page (S-29, error — system).
6. Nothing is stored against the visitor, and personal data stays out of any analytics that records the visit (UC-177; NFR-30).
7. It is the one screen the framework may cache. `"use cache"` is legal in the public zone and prohibited everywhere a tenant is in scope, and a gate proves the absence (`architecture.md` §14.2; task 74.4 row).
8. It is served in Romanian, English and Russian at the three frames of UX-73, each locale separately authored. Each locale's page declares a canonical address that points at itself, and `hreflang` alternates for all three locales with Romanian as `x-default`. The alternates already ride the `Link` response header and the rule is written in `architecture.md` §10.8; it does not depend on which host serves the page (OQ-31) (§12.5.6 task-182 public tier row, 182/119).
9. It is the same page for every visitor, a signed-in member included: no redirect is applied on a session, because a page that varies by session cannot be cached (`architecture.md` §14.2), and the way into the workspace is the header's, which is chrome and not content (§12.5.6 task-182 public tier row, 182/120).

**Refusals.** None. The address is public. The one failure state is the degraded pricing section above.

**Boundaries.** Registration and sign-in are FR-1 … FR-5. The legal set is FR-205. The help centre is FR-61 and FR-64. The route to support (UC-182, S-34) is not specified (task 77.1).

**Acceptance criteria.**
- **AC-1** Given a visitor with no session, when the public address is opened, then the page shows what the platform produces, what it costs and what is asked before signing up, with no sign-in wall. *(source: UC-177 steps; `design_spec.md` S-29)* What it costs is unmet until 53.3 and 76; until then the page shows the rest and omits the pricing section.
- **AC-2** Given the home, then it offers register, sign in, a language choice, and routes to the help centre and the legal set. *(source: `design_spec.md` S-29)*
- **AC-3** Given the content read path is unavailable, when the home is opened, then it renders without its pricing section and does not show an error page. *(source: `design_spec.md` S-29)*
- **AC-4** Given a visit, then nothing is stored against the visitor and the page reads no active organization. *(source: UC-177 postconditions; `design_spec.md` §5.1b)*
- **AC-5** Given the application, then `"use cache"` appears in the public route group and provably nowhere else. *(source: `architecture.md` §14.2; task 74.4 row)*
- **AC-6** Given each of the three locales and each of the frames 1440, 834 and 390, then the home renders, the +40% expansion harness passes and the accessibility scan passes. *(source: task 74 row)*
- **AC-7** Given a route added to the public zone, then it is on the unauthenticated list, and a route not on it is refused to a visitor. *(source: task 74.1 row)*
- **AC-8** Given each of the three locales, then the home declares a canonical address pointing at itself and alternates for all three locales with Romanian as `x-default`. *(source: §12.5.6 task-182 public tier row, 182/119)* Unmet until 74.5.
- **AC-9** Given a signed-in member, when the public address is opened, then the same page is served and no redirect is applied. *(source: §12.5.6 task-182 public tier row, 182/120)* Unmet until 74.3.
- **AC-10** Given the plan copy and the content read path do not yet exist, then the home ships without its pricing section and carries no price written into the page. *(source: §12.5.6 task-182 public tier row, 182/118; task-74.6 row)*

**History.**
- 5 Oct 2026 · project owner · written to close G-9 for UC-177, from UC-177 and S-29 · index §9.4 G-9 *(the §12.5.6 row recording it is listed under Propagation fixes in the questions file)*
- 5 Oct 2026 · project owner · the pricing section waits for the plan catalogue and the content read path, and no price is hardcoded · §12.5.6 task-182 public tier row (182/118)
- 5 Oct 2026 · project owner · a canonical per locale, `hreflang` for all three with Romanian as `x-default`, written into §10.8 · §12.5.6 task-182 public tier row (182/119)
- 5 Oct 2026 · project owner · the home is the same page for a signed-in member · §12.5.6 task-182 public tier row (182/120)

### FR-205 — The legal documents

**Status.** Not started — delivered none · remaining 75.1, 75.3, 75.4, 195 (with 74.1 and 74.2, the chrome and the archetype)

**Obligation.** The system shall publish the terms of service, the privacy notice and the cookie policy as one set, readable without signing in and from the footer of every screen, each with a plain-language summary above its formal text, a version and an effective date, in each of the three locales, so that a person is told what is agreed to and how personal data is handled before any is collected.

| | |
|---|---|
| **Actors** | VI reads. Every authenticated actor reads through the footer. |
| **Traces** | UC-178 · UC-01, UC-179, UC-177 · NFR-5 · NFR-23 · `design_spec.md` OQ-17, OQ-18, OQ-24 · FR-9 |
| **Surfaces** | S-30 (Content archetype) · the footer's three legal links · a link from the registration screen (S-01) · S-31 |

**Behaviour.**
1. The three documents are one set with one navigation, so a reader at any of them can see the other two (UC-178). The set is three documents: the terms of service, the privacy notice and the cookie policy. A data processing agreement and a sub-processor list are not published, because each would commit the platform to maintaining it (§12.5.6 task-182 public tier row, 182/121).
2. Each document shows a plain-language summary above its formal text, at a reading measure and not in the workspace grid (`design_spec.md` S-30).
3. They are reachable from the footer links present on every screen that renders the footer, from S-29, and from the registration screen (S-30 entry points).
4. The information duty is discharged where personal data is collected, which is registration (UC-01). This requirement is therefore a precondition of a lawful registration path. The instruments are GDPR Article 13 and Law No. 195/2024, applicable 23 August 2026, and NFR-5 is where the platform holds the obligation (UC-178).
5. Each document shows a version and an effective date wherever its text lives (`design_spec.md` S-30; task 75.1 row). The text is committed to the release, as the wording of messages is (OQ-43), so the version and the effective date come from the release and not from a store entry (§12.5.6 task-182 public tier row, 182/116).
6. The privacy notice renders the sentence `legal.privacy.phone`: what is kept of a member's phone number, its one purpose and who reads it. It is already written in all three catalogues, and the notice may not ship without it (§12.5.6 task-167 row (2); task 75.3).
7. The documents are authored separately in Romanian, English and Russian, and never machine-translated (task 75.4 row).
8. Acceptance of the terms and the notice is **implied, not recorded**, for the pilot: the registration screen states it in its copy and nothing in the identity schema records it. Once the documents carry a version (behaviour 5), registration records the version accepted and a timestamp, and an account created before then is asked to accept again (195; `design_spec.md` OQ-24; §12.5.6 task-182 public tier row, 182/115).

**Refusals.** None. The one failure state is *error — system* (`design_spec.md` S-30).

**Boundaries.** The cookie policy is one of the three, and the disclosure of what the site sets is FR-206's. A data-subject request is FR-207's.

**Acceptance criteria.**
- **AC-1** Given the footer on any screen that renders it, when the terms, the privacy notice or the cookie policy link is followed, then the document opens and does not answer a not-yet-available state. *(source: task 75 row; `design_spec.md` S-30)*
- **AC-2** Given a visitor with no session, then each document is readable. *(source: UC-178 preconditions)*
- **AC-3** Given any of the three documents, then a reader can move to the other two from it. *(source: UC-178 rule; `design_spec.md` S-30)*
- **AC-4** Given a document, then a plain-language summary stands above the formal text, and a version and an effective date are shown. *(source: task 75 row; `design_spec.md` S-30)*
- **AC-5** Given the privacy notice, then it states what is kept of a member's phone number, its one purpose and who reads it. *(source: §12.5.6 task-167 row (2))*
- **AC-6** Given each of the three locales, then the three documents are available and none was machine-translated. *(source: task 75.4 row)*
- **AC-7** Given the registration screen, then it links to the terms and the notice. *(source: `design_spec.md` S-30 entry points)*
- **AC-8** Given the registration screen, then its copy states that continuing is acceptance of the terms and the notice, and no acceptance record is written. *(source: §12.5.6 task-182 public tier row, 182/115; `design_spec.md` OQ-24)*
- **AC-9** Given the documents carry a version, when an account registers, then the version accepted and the time are recorded against it, and an account created before then is asked to accept again. *(source: §12.5.6 task-182 public tier row, 182/115)* Unmet until 75.1 and 195.
- **AC-10** Given a document, then its version and effective date are the ones the release that carries it supplies. *(source: §12.5.6 task-182 public tier row, 182/116)* Unmet until 75.1.
- **AC-11** Given the footer, then it links to exactly three legal documents. *(source: §12.5.6 task-182 public tier row, 182/121)*

**History.**
- 5 Oct 2026 · project owner · written to close G-9 for UC-178, from UC-178 and S-30 · index §9.4 G-9
- 5 Oct 2026 · project owner · acceptance is implied for the pilot and recorded with the document version once there is one · §12.5.6 task-182 public tier row (182/115)
- 5 Oct 2026 · project owner · the legal text is committed to the release, which supplies its version and effective date · §12.5.6 task-182 public tier row (182/116)
- 5 Oct 2026 · project owner · the set is three documents · §12.5.6 task-182 public tier row (182/121)

### FR-206 — The cookie choice

**Status.** Not started — delivered none · remaining 75.1, 75.2, 75.5

**Obligation.** The system shall tell a visitor, before anything is set, every cookie the site sets by purpose, what it does not set, and any browser storage that is not a cookie, while setting no non-essential storage; it shall therefore record no consent and offer no accept or decline. Adding any non-essential storage re-opens this requirement, and the consent mechanism ships in the same change.

| | |
|---|---|
| **Actors** | VI reads. |
| **Traces** | UC-179 · UC-178 · `design_spec.md` OQ-23 (closed 10 Sep 2026) · NFR-5 · NFR-30 · FR-205 |
| **Surfaces** | The cookie policy of S-30, reached from the footer. S-31 folds into it and is not a first-arrival overlay (§12.5.6 task-182 public tier row, 182/117) |

**Behaviour.**
1. The visitor is shown what the site sets and what it does not. There are no non-essential categories to accept or decline (UC-179 steps; OQ-23).
2. No consent record is written and no client-side preference is stored, because every cookie the platform sets is strictly necessary, and strictly necessary cookies require information rather than consent (OQ-23, resting on Law No. 195/2024's alignment with the ePrivacy standard).
3. The disclosure is **a factual claim about the shipped build**, so it is verified against the code and not authored as copy (UC-179 rule; `design_spec.md` S-31). Task 75.2 produces the enumerated, verified inventory. OQ-23 recorded seven cookies on 10 Sep 2026; task 155 added an eighth, `easyesg_setup_grant`, on 14 Sep 2026; and the application also keeps two session-storage stores and the autosave queue in IndexedDB, which are not cookies. **The inventory task 75.2 enumerates is the single source**, and a test fails when a cookie is added that it does not list. There is no analytics, advertising or third-party code, and the fonts are self-hosted. Every one of the eight is treated as strictly necessary: that is the owner's assumption and not a verified fact (§12.5.6 task-182 public tier row, 182/122).
4. Because the disclosure is a section of the cookie policy and not an overlay, it obscures nothing, and the privacy notice that explains it is one move away within the set (UC-178; §12.5.6 task-182 public tier row, 182/117).
5. There is nothing to dismiss. S-31 is folded into the cookie policy of S-30, reached from the footer, with no first-arrival overlay: remembering a dismissal would mean storing something, against UC-179's postcondition, and an overlay that returns on every visit tells the reader nothing new (§12.5.6 task-182 public tier row, 182/117).
6. **This re-opens the moment any non-essential storage is added** (analytics, an advertising pixel, an embedded third-party player, a font service). It re-opens as a new question, and the consent mechanism ships in the same change, because the policy may not be false for even one release (OQ-23; UC-179 rule).

**Refusals.** None.

**Boundaries.** The cookie policy as a document is FR-205's. Personal data in analytics is excluded by NFR-30.

**Acceptance criteria.**
- **AC-1** Given a visitor, when the disclosure is shown, then it lists every cookie the site sets by purpose, what it does not set, and the browser storage that is not a cookie. *(source: `design_spec.md` S-31)*
- **AC-2** Given the disclosure, then it carries no accept or decline control. *(source: OQ-23; `design_spec.md` S-31)*
- **AC-3** Given a visit, then no consent record is written and no client-side preference is stored by the disclosure. *(source: UC-179 postconditions)*
- **AC-4** Given the build, then what the disclosure states is true of what the application sets, checked against an enumerated inventory. *(source: UC-179 rule; task 75.2 row)*
- **AC-5** Given a reader who has not read it, then the privacy notice remains reachable from the disclosure. *(source: `design_spec.md` S-31 layout)*
- **AC-6** Given a change that adds non-essential storage, then it includes the consent mechanism, and the disclosure is true of the build at that release. *(source: OQ-23; UC-179 rule)*
- **AC-7** Given each of the three locales, then the disclosure is live. *(source: task 75.5 row)*
- **AC-8** Given a first visit to any public screen, then no overlay is shown and nothing is stored to record that one was. *(source: §12.5.6 task-182 public tier row, 182/117; UC-179 postconditions)* Unmet until 75.5.
- **AC-9** Given a cookie added to the application that the enumerated inventory does not list, then a test fails. *(source: §12.5.6 task-182 public tier row, 182/122; task 75.2 row)* Unmet until 75.2.

**History.**
- 5 Oct 2026 · project owner · written to close G-9 for UC-179, from UC-179 and S-31 as OQ-23 settled them · index §9.4 G-9
- 5 Oct 2026 · project owner · S-31 folds into the cookie policy, with no first-arrival overlay · §12.5.6 task-182 public tier row (182/117)
- 5 Oct 2026 · project owner · the inventory of task 75.2 is the single source of the claim, checked by a test; eight cookies since task 155 · §12.5.6 task-182 public tier row (182/122)

## 3. Data-subject requests (index §3.34, new)

### FR-207 — Data-subject requests: access, rectification, erasure and portability

**Status.** Not started — delivered none · remaining 73.3 (the runbook), 77.1 (the support channel a request arrives by), 163 (retention of one category), 196 (the record of a request), 197 (erasure of account data), 198 (the member's data export)

**Obligation.** The system shall permit a data subject's request for access, rectification, erasure or portability of their personal data to be fulfilled within 30 calendar days, retaining a record of what was disclosed. On an erasure request it shall retain what statute requires (issued fiscal documents and their transmission receipts for six years, and the disclosure audit trail for the life of the report) and report the retained categories to the requester.

| | |
|---|---|
| **Actors** | The data subject makes the request, through support (UC-182). The platform carries it out for the data of the requester's account (a Platform Administrator, by runbook), and the organization for report content (its Organization Administrator, through the product) (§12.5.6 task-182 data-subject requests row, 182/123, 182/124). |
| **Traces** | NFR-5 · NFR-27 … NFR-32 · NFR scenario 5.3 · UC-182, FR-81 · FR-130, BR-INV-7, UC-135 · FR-54, FR-55, FR-59, BR-ACC-4 · D-13 · P-12 · `architecture.md` §12.5.7, OQ-20 · index §9.4 G-4, §10 OQ-5 |
| **Surfaces** | None built. A request arrives through the support channel (UC-182, task 77.1). The runbook (task 73.3) and the three tasks it rests on are the artefacts the plan names: the record of a request (196), the erasure of account data (197) and the member's data export (198). |

**Behaviour.**
1. The four kinds of request are access, rectification, erasure and portability (NFR-28; task 73.3 row). Export is NFR-28's portability. Rectifying a member's own account data is the profile edit (S-27, task 52.3), with no request; anything else is a request to the Organization Administrator or to support (§12.5.6 task-182 data-subject requests row, 182/129).
2. A request is fulfillable within 30 calendar days, and a record of what was disclosed is retained (NFR-28). **A request reaches the platform through support (UC-182), and the 30 days run from its ticket reference** (§12.5.6 task-182 data-subject requests row, 182/123). How the requester's identity is checked is not decided here: it is written with the support channel in task 77.1 and with the runbook in task 73.3, and until then this requirement specifies no check. **The record of what was disclosed is one new append-only row in the platform audit log per request**. It names the request by its ticket reference, its kind, the date it was fulfilled and the categories disclosed or retained, and holds no personal data itself, as the `subject` hash of task 28.4 holds none. A Platform Administrator reads it on A-08 with the rest of the log (FR-81), and it is kept for **6 years**, the fiscal floor (BR-INV-7) — longer than the 24 months of the system audit it sits in, so an erasure dispute stays answerable while the fiscal records the erasure spared exist (`architecture.md` §12.5.7; §12.5.6 task-182 starting-values row, 182/127).
3. **What fiscal retention keeps.** Issued fiscal documents and their transmission receipts are retained in immutable storage for the statutory period, at least six years for Moldovan VAT records, and this takes precedence over a customer's erasure request (FR-130; BR-INV-7; UC-135; NFR-29).
4. **What the audit trail keeps.** The disclosure audit trail is retained for the life of the report (NFR-29). It cannot be mutated to effect an erasure, because append-only is enforced at database privilege level (NFR-33; scenario 5.3). Historical attribution survives the removal of a user's access (FR-55; FR-59).
5. **How an attribution outlives a person.** `core.field_change.actor_id` carries no foreign key, by design, so an attribution outlives the account it names (task 14; NFR-28 cited). The read then shows the attribution with a nullable address (build-log, task 30.3 entry). A membership row leaves only on the cascade from its account or its organization, and no runtime role may delete it otherwise (`architecture.md` §6.5, citing NFR-28's erasure). **The trail lives and dies with its report**, and a report with its organization: it is kept for the organization's life plus one year (`architecture.md` §12.5.7, which now has a row for it). The bare actor id stays for as long as the trail does, and a person's erasure does not overwrite it, because overwriting would be an exception to append-only (NFR-33) (§12.5.6 task-182 data-subject requests row, 182/126).
6. **The retained categories are reported to the requester** (NFR-29).
7. **Every other category has a retention period** (`architecture.md` §12.5.7, which states that *erasure now has a defined behaviour for every category*): disclosure data and report content, organization life plus one year; calculator inputs, permanent; generated exports, organization life plus one year (amended, 182/126); the disclosure audit trail, organization life plus one year (new row, 182/126); non-billing system audit, 24 months; metering events, 24 months; application logs, 90 days; error traces, 30 days; billing audit and fiscal documents, 6 years; notifications and their deliveries, organization life plus one year (a platform notice, one year from sending). Only the last is enforced, and by a task not yet built (163). **An erasure request removes the requester's account data now: the profile, the memberships, the sessions, the preferences and the notification deliveries. Everything else stays until its retention period ends**, which leaves report content to the organization's own lifecycle (§12.5.6 task-182 data-subject requests row, 182/125). The requester's own delivery rows are therefore the one place where erasure shortens a retention period (FR-170; NFR-109). This is the owner's reading of NFR-29, taken as an assumption pending legal advice: if legal requires more to go, behaviour 7 and 197 widen.
8. **Erasure of an organization.** The runtime role holds `DELETE` on the tenant root for NFR-28's thirty-day erasure, and the foreign keys of organization-to-organization edges cascade on both sides, so no third organization's data can block it (task 12; build-log, task 12 entry).
9. Personal data is excluded from application logs, error traces, metering events and analytics, and those streams carry pseudonymous identifiers (NFR-30). A dataset copied downward is anonymised (NFR-32). Hosting and sub-processors are inside the EU/EEA (NFR-27).
10. Portability is "full customer data export in an open format, irrespective of subscription state" (NFR-31; D-13). A data subject's portability is **the data about that member (the profile, the memberships and the changes attributed to them) in JSON**. NFR-31's organization-wide export stays the organization's exit (§12.5.6 task-182 data-subject requests row, 182/128).
11. **Evidence.** The runbook is rehearsed annually against a seeded tenant, with NFR-29 rehearsed alongside (NFR-28 and NFR-29 verification, class D; task 73.3).

**Refusals.** A request is not refused as a whole. The data the statute requires is refused erasure and reported (behaviours 3, 4 and 6). No wire outcome exists yet.

**Effects.** A record of what was disclosed (NFR-28). The retained categories reported to the requester (NFR-29).

**Boundaries.** The organization-wide exit export is NFR-31's and task 73.4's. Fiscal archiving is FR-130's. Hosting is NFR-27's. The anonymisation job is `architecture.md` §10.5's. The route a request reaches support by is UC-182's, which has no requirement.

**Configuration-held values.** **Starting value: a data-subject request's record is kept 6 years**, matching the fiscal retention floor (BR-INV-7), so an erasure dispute can be answered while the fiscal records it spared still exist (§12.5.6 task-182 starting-values row).

**Acceptance criteria.**
- **AC-1** Given an organization that holds issued fiscal documents, when a data subject's erasure request is fulfilled, then the documents and their transmission receipts remain, and the requester is told they were retained. *(source: NFR-29; FR-130; scenario 5.3)*
- **AC-2** Given a completed report with a disclosure audit trail, when an erasure request is fulfilled, then the trail's rows are not mutated and remain attributed. *(source: NFR-29; NFR-33; FR-55)*
- **AC-3** Given a request is fulfilled, then a record of what was disclosed has been retained as a row in the audit log that holds no personal data. *(source: NFR-28; §12.5.6 task-182 data-subject requests row, 182/127)* Unmet until 196.
- **AC-4** Given a request is made, then it is fulfilled within 30 calendar days. *(source: NFR-28; §12.5.6 task-182 data-subject requests row, 182/123)* Unmet until 73.3 and 77.1.
- **AC-5** Given an erasure request, then the categories that were retained are reported to the requester. *(source: NFR-29)* Unmet until 73.3.
- **AC-6** Given the annual rehearsal against a seeded tenant, then access, rectification, erasure and portability are each carried out and NFR-29 is rehearsed with it. *(source: NFR-28 and NFR-29 verification; task 73.3 row)* Unmet until 73.3.
- **AC-7** Given a removed member or an erased account, then the account's attributed history persists as an attribution without the person. *(source: FR-55; FR-59; task 14 row)*
- **AC-8** Given an erasure request, when it is fulfilled, then the requester's profile, memberships, sessions, preferences and notification deliveries are removed and every other category is kept to the end of its retention period. *(source: §12.5.6 task-182 data-subject requests row, 182/125)* Unmet until 197.
- **AC-9** Given a request made through support, then its 30 days run from its ticket reference. *(source: §12.5.6 task-182 data-subject requests row, 182/123)* Unmet until 77.1 and 73.3.
- **AC-10** Given a portability request, then the member receives their profile, memberships and attributed changes as a JSON file. *(source: §12.5.6 task-182 data-subject requests row, 182/128)* Unmet until 198.
- **AC-11** Given a member who corrects their own name, job title or phone on the profile screen, then that is the rectification of their account data and no request is raised. *(source: §12.5.6 task-182 data-subject requests row, 182/129; task 52.3)*
- **AC-12** Given the disclosure audit trail, when its person's account is erased, then the rows are unaltered and keep their actor id for as long as the trail is kept, which is the organization's life plus one year. *(source: §12.5.6 task-182 data-subject requests row, 182/126; NFR-33)*

**History.**
- 5 Oct 2026 · project owner · written to close OQ-5 and G-4, from NFR-5, NFR-27 … NFR-32 and `architecture.md` §12.5.7 · index §10 OQ-5
- 5 Oct 2026 · project owner · a request arrives through support and its 30 days run from the ticket reference · §12.5.6 task-182 data-subject requests row (182/123)
- 5 Oct 2026 · project owner · the platform carries out account data and the organization report content, pending legal advice on the roles · §12.5.6 task-182 data-subject requests row (182/124)
- 5 Oct 2026 · project owner · erasure removes the requester's account data now and keeps the rest to its retention period · §12.5.6 task-182 data-subject requests row (182/125)
- 5 Oct 2026 · project owner · exports and the disclosure audit trail are kept for the organization's life plus one year · §12.5.6 task-182 data-subject requests row (182/126)
- 5 Oct 2026 · project owner · the record of what was disclosed is an audit-log row holding no personal data · §12.5.6 task-182 data-subject requests row (182/127)
- 5 Oct 2026 · project owner · portability is the member's own data in JSON · §12.5.6 task-182 data-subject requests row (182/128)
- 5 Oct 2026 · project owner · rectifying one's own account data is the profile edit · §12.5.6 task-182 data-subject requests row (182/129)
- 5 Oct 2026 · project owner · the request record is kept 6 years (182/127) · §12.5.6 task-182 starting-values row

## 4. Business rules held in this part

Moved from the index's §4.2 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-ACC-5 | Access control is enforced server-side on every request, scoped per organization and per report. | FR-158 |

## 5. Entities held in this part

Moved from the index's §5 on 5 Oct 2026 (task 182). None. No row of the index's §5 is assigned to this part. FR-207 touches personal data held in several entities of other parts and creates none of its own.
