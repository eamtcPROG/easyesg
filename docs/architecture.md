# ESG Platform — System Architecture (MVP)

| Field | Value |
|---|---|
| Document ID | architecture.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | `ESG Platform System Architecture (MVP)` (primary, detail), `ESG Platform Architecture Overview (MVP)` (primary, framing), `ESG Platform Private Monetization Architecture` (commercial-layer separation), `ESG Platform Research and Architecture Notes` (background, earlier, lower authority) |

---

## 1. Purpose and scope; how to read this document

### 1.1 What this document is

This is the canonical architecture baseline for the ESG Platform MVP. It defines **how the system is built**, in the same way the FR register defines what it does and the NFR register defines how well. It is written so that a delivery team can start work from it without re-deriving decisions, and so that a reviewer can check any structural claim against the requirement that forced it.

It consolidates four prior documents into one record. Where the two architecture documents overlapped, `System Architecture (MVP)` was preferred for detail and `Architecture Overview (MVP)` for framing; genuine conflicts are recorded in §17.5 rather than silently reconciled.

### 1.2 The system, in one paragraph

A multi-tenant SaaS that lets a Moldovan SME produce a **VSME Basic Module (B1–B11)** sustainability report in Romanian, English or Russian, calculate Scope 1 and location-based Scope 2 emissions feeding B3, and export the result as PDF and as the official EFRAG Excel Digital Template — with a full self-serve billing, invoicing and Moldovan fiscal-compliance stack behind it.

| Dimension | Value |
|---|---|
| Scale envelope | ≤ 2,000 organizations · ≤ 3,000 users · ≤ 2,500 reports/year · ≈ 150 peak concurrent sessions · < 100 GB |
| Peak season | April–May, peaking in the last two weeks of May (Art. 33(3), Law 287/2017 — 150 days after year end) |
| Locales | Romanian (source), English, Russian — all separately authored, none machine-translated |
| Hosting | EU/EEA, self-managed VMs, Docker Compose |
| Scope | Full register: 173 FRs (FR-1 … FR-173); 93 MVP NFRs (NFR-1 … NFR-93) plus 12 deferred (NFR-94 … NFR-105). 8–12 month build |

### 1.3 Companion documents and identifier scheme

This document is a companion to, and traceable against, the six other baseline documents:

- `problem_overview.md` — the problem, the scope and the closed scope decisions
- `actors.md` — the actors `CA`, `RC`, `OA`, `PA`, `BO`, `SYS`
- `use_cases.md` — UC-01 … UC-176, and the use case design decisions and constraints D-1 … D-14
- `functional_requirements.md` — FR-1 … FR-173
- `non_functional_requirements.md` — NFR-1 … NFR-93 (MVP) and NFR-94 … NFR-105 (deferred)
- `design_spec.md` — UX-1 … UX-134, and the screens S-01 … S-28 and A-01 … A-18

This document owns two identifier schemes of its own: the architectural decisions **AD-1 … AD-14** (§4) and the drivers **DR-1 … DR-11** (§2). The four notification qualities authored in §17.3 as NFR-106 … NFR-109 were **ratified into `non_functional_requirements.md` §4.16 on 18 August 2026**.

All identifiers are preserved verbatim from the sources. There is no `ACT-*` scheme: actors are the letter codes `CA`, `RC`, `OA`, `PA`, `BO`, `SYS` (§2.4).

### 1.4 How to read it

- §2 is the load-bearing part. It lists the eleven **drivers** (DR-1 … DR-11) that actually shape the structure. Everything from §4 onward is a consequence of those.
- A reader with thirty minutes should read §2, §3 and §5.
- A reader who needs to know *why* a specific structural choice was made should read the corresponding AD in §4.
- A reader who needs to know what is **not** decided should read §18.

### 1.5 What is out of scope for this architecture

By prior decision: XBRL export and the Comprehensive Module (Phase 2), energy-provider and accounting integrations, AI assistance, the public disclosure portal (Phase 3), the ESAP bridge and blockchain traceability (uncommitted roadmap). Extension points for each are named in §15 so that adding them is additive rather than structural.

### 1.6 Four scope facts that drive the architecture more than the feature list does

1. **Billing is not a thin Stripe wrapper.** Stripe does not serve Moldova-resident businesses. The platform owns the plan catalogue, subscription state machine, order lifecycle, invoice and credit-note documents, gapless fiscal numbering, dunning, reconciliation, and the billing ledger (D-7). Four payment rails sit behind one adapter interface (D-8). This is 69 of 173 functional requirements (FR-84 … FR-152) — about 40% of the register, and the part with statutory consequences.
2. **e-Factura is MVP, not Phase 2.** Moldova's national B2B e-invoicing mandate takes effect **1 October 2026** (D-9). The invoice is therefore modelled as a structured platform-owned record rendered into national XML by an adapter, never as "a PDF that gets emailed".
3. **The compliance core must be able to run with billing switched off.** D-11 and NFR-1 make this a testable obligation, not an aspiration: with `BILLING_ENABLED=false`, the UC-17 … UC-48 suite must pass.
4. **The standard moves.** The VSME XBRL taxonomy had a backwards-incompatible release in February 2026 and updates several times a year. NFR-12, NFR-85 and NFR-86 require content, thresholds, factor sets and validation rules to change **without a code release**, and require a compatible template/taxonomy rollout to need no deployment. This forces a configuration-as-data architecture rather than a code-first one.

---

## 2. Architectural drivers

### 2.1 The eleven structural drivers

These are the constraints that determine structure. Everything else is detail.

| # | Driver | Source | Structural consequence |
|---|---|---|---|
| DR-1 | Billing and the compliance core are separate bounded contexts sharing no transaction, foreign key or table; disabling billing leaves reporting working | D-11, NFR-1, NFR-15, FR-154 | Two PostgreSQL schemas with no cross-schema FKs; communication only by published entitlement state and domain events; a feature flag that disables the billing module wholesale |
| DR-2 | The internal schema mirrors VSME taxonomy element names and structure | NFR-2, FR-155 | A generic, taxonomy-driven disclosure store (element-keyed values), not a hand-modelled table per module |
| DR-3 | Thresholds, factor sets, validation rule definitions, effective dates, notification behaviour, plan definitions, help-centre articles and plan presentation copy change without a redeploy, published within one working day and revertible in one step | NFR-12, NFR-85, NFR-86, FR-61 … FR-74, FR-173 | A versioned, publishable **configuration store** as a first-class subsystem; the application interprets it, it does not embed it. **Narrowed 19 Aug 2026 (OQ-43):** the *wording* of labels, help text, validation messages and notification templates ships in the release as committed message catalogues. The behaviour this driver exists to protect — that a rule, threshold or factor set changes without a redeploy — is unchanged |
| DR-4 | Every report is pinned to an explicit template and taxonomy version and can be re-exported or migrated against a later one | NFR-3, FR-51, FR-65 … FR-69 | Version is a dimension of the data model, not a global; export and validation are parameterised by it; migration is a first-class operational job |
| DR-5 | Tenant isolation is structural at the data-access layer, not a filter at call sites | NFR-63 | PostgreSQL Row-Level Security with a per-request session variable; the connection, not the query, carries the tenant |
| DR-6 | Audit, ledger and metering records are append-only, enforced at database privilege level | NFR-33, FR-151, FR-159, FR-105 | Separate DB roles; no UPDATE/DELETE grant on ledger tables to the application role; corrections are new rows |
| DR-7 | Money is provider-executed; the platform never touches card data or holds funds | D-7, D-8, NFR-60, NFR-74 | Payment adapters only; PCI DSS SAQ-A scope; no custody or settlement code path exists |
| DR-8 | Fiscal documents are immutable, gaplessly numbered per series per year, and transmitted to e-Factura with acknowledgement stored | D-9, D-10, NFR-55, NFR-71, FR-123 … FR-130 | A numbering service holding a row lock inside the issuing transaction; an outbox-driven transmission pipeline; six-year independent archive |
| DR-9 | Payment callbacks, provider webhooks and e-Factura acknowledgements are idempotent under duplicate, delayed and out-of-order delivery; order → payment → invoice → entitlement is all-or-nothing | NFR-54, NFR-59 | Transactional outbox + saga coordinator; every inbound event keyed and de-duplicated at the edge |
| DR-10 | Export generation must not degrade interactive latency; 10× concurrency spike in the filing window with no maintenance window | NFR-37, NFR-42, NFR-44, NFR-46, NFR-48 | Export and all long-running work leaves the request tier by queue into a separate worker container; horizontal scale of API and worker independently |
| DR-11 | Every tenant-facing capability is reachable through one documented, versioned API under identical authorization — no interface-only privileged route | FR-153, NFR-16, NFR-83 | The Next.js app is a client of the same public API, not a privileged backend; OpenAPI generated from source and diffed in CI |

### 2.2 The commercial driver behind DR-1

`Private Monetization Architecture` supplies the reason DR-1 is worth its cost, and it is not a technical reason. EFRAG's own VSME Excel Digital Template and open-source XBRL converter are **free, official and already available to any SME in Europe**. That sets a hard ceiling: the platform cannot charge for "the ability to produce a compliant VSME report" as a standalone feature. Every viable monetization path sells convenience, automation, integration, collaboration, aggregation or distribution — not the compliance content itself.

The architectural consequence is that pricing and packaging decisions must never touch compliance logic, because the packaging is expected to change while the compliance core stays identical for a free-tier user and an enterprise contract alike. That is DR-1, and it is why §5 treats the compliance-core / commercial-layer split as the central structural fact rather than as a modularity preference.

### 2.3 Confirmed platform and operational choices

**Confirmed platform choices** (given, not derived): NestJS for backend services, Next.js for the tenant-facing application, React + Vite for the administrative console, PostgreSQL as the primary store, Docker and Docker Compose as the packaging and deployment mechanism. Versions are in §12.

**Confirmed operational choices** (decided in review): EU-region VPS with Docker Compose; a modular monolith plus a separate worker process; shared-schema multi-tenancy with PostgreSQL Row-Level Security.

### 2.4 Actors

| Code | Actor | Does |
|---|---|---|
| CA | Common Access | Register, authenticate, manage own profile |
| RC | Reporting Contributor | Fills the report, runs the calculator, exports |
| OA | Organization Administrator | Entities, periods, users, plan, billing |
| BO | Billing Operator | Reconciliation, dunning, refunds, fiscal reporting |
| PA | Platform Administrator | Content, taxonomy versions, factor sets, plans, support grants |
| SYS | System | Scheduled and event-driven work |

---

## 3. Architecture principles

These are stated as principles because each one is applied in more than one place, and each is traceable to a driver or a requirement. They are not aspirations; every one has a named enforcement mechanism.

| # | Principle | Enforced by | Traces to |
|---|---|---|---|
| P-1 | **The compliance core knows nothing about plan, price or tenant type.** It only knows how to produce a correct report, and it is identical on the free tier and on an enterprise contract | CI boundary rule; `contracts/` as the only cross-context surface; `BILLING_ENABLED=false` CI job | DR-1, D-11, NFR-1, NFR-15 |
| P-2 | **The standard is data, not code.** Taxonomy elements, labels, thresholds, factor sets and validation rules are registered configuration interpreted at runtime | Configuration store (AD-4), taxonomy-keyed disclosure store (AD-3) | DR-2, DR-3, DR-4, NFR-12, NFR-85, NFR-86 |
| P-3 | **Version is a dimension of the data, not a global setting.** Reports, calculations and exports each record the version of the artefact that produced them | Version pinning on `report`, `calc_run`; effective-dated config with temporal constraints | DR-4, NFR-3, NFR-19, NFR-87 |
| P-4 | **Guarantees belong below the application.** Tenant isolation, append-only-ness and gapless numbering are enforced by the database, not by discipline at call sites | RLS `FORCED`; privilege-level `GRANT`/`REVOKE` plus triggers; `SELECT … FOR UPDATE` on the counter row | DR-5, DR-6, DR-8, NFR-33, NFR-55, NFR-63 |
| P-5 | **One documented API, no privileged back door.** Both front ends are ordinary clients of the same versioned surface, authorized identically | OpenAPI 3.1 generated from source and diffed in CI; route-coverage diff | DR-11, FR-153, NFR-16, NFR-83 |
| P-6 | **Nothing long-running happens in the request tier.** All generation, transmission, dispatch and scheduled work leaves by queue | BullMQ consumers in a separate `worker` container; the outbox is the only producer | DR-10, NFR-42, NFR-46 |
| P-7 | **Every external system sits behind a port with exactly one adapter per provider.** No vendor type appears outside its adapter | Ports in `contracts/`; provider registry read from configuration; dependency review per release | DR-7, NFR-11, NFR-14 |
| P-8 | **Cross-boundary effects are written in the same transaction as the state change that caused them.** No dual writes | `outbox_event` written transactionally; `inbound_event` unique-keyed at the edge | DR-9, NFR-54, NFR-59 |
| P-9 | **Fail closed on tenancy, fail open on already-granted entitlements.** An absent tenant context yields zero rows; an unreachable billing context keeps granted capabilities working | RLS `missing_ok` policy form; `TenantRepository` that throws with no context; cached entitlement snapshot | NFR-49, NFR-63 |
| P-10 | **Instrument every billable-shaped action, including actions not currently billed.** Pricing units must be evaluable end to end without a code change | Append-only `metering_event` stream | FR-105, NFR-10 |
| P-11 | **What is expensive to retrofit is built on day one, regardless of which phase its feature lands in.** Version pinning, RLS, retained calculator inputs, per-field audit, append-only ledgers, multi-period model, outbox, config-as-data | Build order (§15.4); §16.3 debt register | NFR-19, NFR-33, NFR-63, FR-45, FR-54 |
| P-12 | **A requirement verified by rehearsal needs a runbook, and the runbook is a deliverable.** A rehearsal without one is not repeatable and therefore not evidence | `docs/runbooks/` in the repository layout | NFR-28, NFR-29, NFR-31, NFR-51, NFR-52, NFR-85, NFR-86, NFR-93 |

---

## 4. Architecture decision record index

Every architectural decision carries an **AD-n** identifier, cites the drivers and requirements it discharges, and records rejected alternatives where the choice was real. A decision record that only states what was chosen is a description, not a decision.

### 4.1 Index

| ID | Decision | Status | Drivers | Key requirements |
|---|---|---|---|---|
| AD-1 | Modular monolith (`api`) + worker, boundaries enforced in CI | Accepted | DR-1, DR-10 | NFR-1, NFR-15, NFR-46, D-11 |
| AD-2 | Shared schema + PostgreSQL RLS, transaction-local tenant context per request | Accepted | DR-5 | NFR-63, NFR-62, FR-158 |
| AD-3 | Taxonomy-driven element-keyed disclosure store + generated typed facade | Accepted | DR-2, DR-4 | NFR-2, NFR-3, NFR-86, FR-155 |
| AD-4 | Configuration-as-data with versioned publish/revert and effective dating | Accepted | DR-3 | NFR-12, NFR-73, NFR-85 … NFR-87 |
| AD-5 | Single key-based entitlement service, cached, degrading open for granted keys | Accepted | DR-1 | NFR-17, NFR-41, NFR-49, FR-99 … FR-104 |
| AD-6 | Transactional outbox + inbound de-duplication + order saga | Accepted | DR-9 | NFR-54, NFR-59, NFR-50 |
| AD-7 | Gapless fiscal numbering by `SELECT … FOR UPDATE` on a counter row at `READ COMMITTED`, consumed at issuance | Accepted | DR-8 | NFR-55, FR-123, D-10 |
| AD-8 | Port + adapter per third party; merchant-of-record registered but inactive | Accepted | DR-7 | NFR-11, NFR-14, NFR-60, NFR-74 |
| AD-9 | Two front ends, both clients of one public API; admin separately addressed | Accepted | DR-11 | NFR-16, NFR-65, NFR-38, NFR-56 |
| AD-10 | All long-running work leaves the request tier by queue | Accepted | DR-10 | NFR-42, NFR-46, NFR-82 |
| AD-11 | One channel-agnostic notification subsystem with per-recipient delivery evidence | Accepted | — | FR-157, FR-160 … FR-173 |
| AD-12 | Short-lived JWT + server-side revocable refresh sessions | Accepted | — | FR-5 … FR-8, FR-58, NFR-62 |
| AD-13 | TypeScript 6.0.3, single compiler; TS 7 side-by-side documented but not adopted | Accepted | — | NFR-16, NFR-26, NFR-30, NFR-58, NFR-88 |
| AD-14 | TypeORM 1.1 with `synchronize` off, SQL migrations, ALS-bound `QueryRunner`, two `DataSource`s | Accepted | DR-1, DR-5 | NFR-1, NFR-58, NFR-63, NFR-86 |

### 4.2 AD-1 — Modular monolith plus worker, not microservices

| | |
|---|---|
| **Context** | The scale envelope is ≤ 2,000 organizations, ≤ 3,000 users, ≈ 150 concurrent sessions at peak. DR-1 demands a hard separation between billing and the compliance core; DR-10 demands that export generation not touch interactive latency; NFR-59 demands all-or-nothing behaviour across order, payment, invoice and entitlement. |
| **Decision** | One NestJS deployable, `api`, containing all bounded contexts as NestJS modules with enforced boundaries; one NestJS deployable, `worker`, running the same codebase in worker mode, consuming queues. Both are built from the same image and differ only by entrypoint and configuration. DR-1's separation is a **compilation and schema** boundary, not a network boundary. |
| **Alternatives considered** | *Three separate services from day one* — rejected: distributed-system cost buys nothing at this scale and works against NFR-59, which is far easier to satisfy inside one process with a durable outbox than across a service mesh; splitting later is cheap once the boundary is already enforced, because a module lifts out with its schema. *Single process including workers* — rejected outright by NFR-46: an export burst must not touch NFR-37's p95 ≤ 300 ms. |
| **Consequences** | Boundary enforcement moves to static analysis: `dependency-cruiser` / `eslint-plugin-boundaries` rules in CI forbid any import between `modules/billing/**` and `modules/core/**` except through `contracts/`. Each context owns a PostgreSQL schema, but **runtime enforcement is not claimed** — `search_path` governs only unqualified name resolution, so a schema-qualified cross-context join would work; genuine database-level prevention would need `USAGE` revoked across the boundary, which conflicts with AD-6's outbox. The schema split therefore exists to make a violation obvious in review and to keep contexts physically separable later. Cross-context communication is one-directional: billing publishes `EntitlementChanged`; core reads entitlements through an `EntitlementService` interface whose only implementation lives in billing and whose null implementation (grant-everything) runs when billing is disabled. A second CI job runs UC-17 … UC-48 with `BILLING_ENABLED=false`; that job is what keeps the boundary honest over time. |

### 4.3 AD-2 — Shared schema with PostgreSQL Row-Level Security for tenancy

| | |
|---|---|
| **Context** | NFR-63 requires cross-tenant access to be **structurally prevented rather than filtered at call sites**. The platform is government-branded, holds fiscal and confidential sustainability data, and serves companies who are each other's competitors, while adoption is entirely voluntary. |
| **Decision** | Every tenant-owned table carries `organization_id uuid not null`. RLS is `ENABLED` and `FORCED`, with a policy of the form `organization_id = current_setting('app.current_org', true)::uuid`. **Two clarifications, 20 Aug 2026 (task 12), each forced by writing the first policy — see below the table.** The application connects as a non-superuser, non-owner role for which RLS is not bypassable. A request-scoped interceptor sets `app.current_org` and `app.current_user` on the pooled connection **inside the transaction**, and the ORM never issues a tenant query outside a transaction. |
| **Alternatives considered** | *Schema-per-tenant* — rejected: 2,000 schemas makes every migration a 2,000-step job and makes FR-83's adoption dashboard and FR-105's metering rollups awkward. *ORM global scope or base repository injecting the predicate* — roughly 90% as effective and materially cheaper to live with, but weaker than NFR-63's wording; if the team wants it, the honest route is to amend NFR-63 explicitly rather than implement RLS half-heartedly and describe it as structural. *One deployment per customer* — incompatible with NFR-47's per-free-tier-organization cost ceiling, and turns FR-83 and FR-105 into cross-instance ETL. |
| **Consequences** | Three database roles, not two: `esg_app` and `esg_worker` are both RLS-enforced; only `esg_admin_ro` (read-only, `BYPASSRLS`) bypasses it, used solely for explicit cross-tenant rollups, migration runs and the admin API, with every acquisition logged (FR-79, NFR-66). Giving the worker `BYPASSRLS` would be the obvious shortcut and is wrong: the worker is what materialises one tenant's regulatory and fiscal record into a PDF, an Excel file, an e-Factura payload and an email. Session-scoped `SET` is prohibited — it leaks to the next borrower of a pooled connection, the single most common way RLS multi-tenancy is broken in production. PgBouncer, if used, runs in **transaction** pooling mode. CI carries a cross-tenant probe suite plus a job-level probe that enqueues work for organization A while the worker's context says organization B and asserts the job fails rather than returning data. Policies are enabled in **every** environment from the first sprint: the value of RLS is that a missing tenant context breaks loudly and early. |

**Two clarifications from the first policy, 20 Aug 2026 (task 12).** Both are amendments to the
stated form above rather than exceptions taken quietly against it.

- **The tenant root is scoped by its own `id`.** `core.organization` *is* the tenant, so it carries
  no `organization_id`; its policy reads `id = current_setting('app.current_org', true)::uuid`. The
  rule is therefore two clauses — the root by `id`, every other tenant table by `organization_id` —
  and both are enforced mechanically by the schema-invariant gate rather than by review. A
  self-referencing or generated `organization_id` column was considered for uniformity and declined:
  a stored duplicate of the primary key reads as clever now and as puzzling later, and two clauses
  checked by a gate is not the kind of exception that erodes.
- **`INSERT` on the tenant root carries `WITH CHECK (true)`, and only there.** FR-13 creates an
  organization from a verified account that holds no membership yet, so `app.current_org` cannot
  already equal an id that does not exist — a `WITH CHECK` on that insert makes organization creation
  impossible rather than secure. Creating a row you then own is not a cross-tenant act; reading or
  altering another tenant's data is, and the `SELECT`, `UPDATE` and `DELETE` policies still prevent
  both. Every other tenant table keeps a real `WITH CHECK`.

**A third detail, smaller but load-bearing:** the policy wraps the setting in `NULLIF(..., '')`. The
`missing_ok` form below gives NULL for an *unset* context, which filters to zero rows as intended —
but a context set to the **empty string** casts as `invalid input syntax for type uuid` and raises,
which is the 500-on-every-endpoint this note exists to avoid, arriving by a route it did not
consider. `NULLIF` collapses both to the same fail-closed NULL.

**Implementation note that is part of the decision.** The setting is written with `SELECT set_config('app.current_org', $1, true)` — **not** `SET LOCAL`, which is utility syntax and accepts no bind parameter, so writing it that way forces string interpolation into the one value the entire tenancy model rests on. The `true` third argument makes it transaction-local. The policy reads `current_setting(..., true)` in the `missing_ok` form, so an unset context yields NULL and therefore zero rows rather than a 500 on every endpoint. The organization id comes from the **server-side membership lookup** already performed in `AuthGuard`, never from the raw JWT claim — AD-12 declines to treat the token claim as authoritative, and grounding the RLS boundary in a value the auth design does not trust would make an org-switch race or a revoked membership into a cross-tenant read.

**On the argument that public disclosure makes NFR-63 unnecessary.** It will be raised, so it is answered here. *Timing*: the public portal is Phase 3 and opt-in; at MVP nothing is public, and this product is a **drafting tool** — a report is confidential for the whole period a company is using the system. A leaked draft is not an early copy of a public document; it is a wrong number the company had not yet corrected. B9 carries recordable accidents and fatalities, B11 carries corruption convictions and fines. *Scope*: even if every finished report were public, that justifies relaxing access control on published report content only — one projection of one table. The field-level audit trail with previous values (FR-54, FR-55), calculator raw inputs retained permanently by site and source (FR-33), fields declared not material or omitted as sensitive, all billing data (IDNO, VAT code, legal address, invoices, dunning state), and all identity data are never public. *Consistency*: applying RLS to `billing` and `identity` but not to `core` is worse than applying it everywhere — uniform enforcement is verifiable in one pass; selective enforcement is a rule every future query author must remember, which is exactly what NFR-63 exists to eliminate.

### 4.4 AD-3 — A taxonomy-driven disclosure store, not a table per module

| | |
|---|---|
| **Context** | NFR-2 and FR-155 require the internal schema to mirror the VSME taxonomy. DR-4 requires reports pinned to different taxonomy versions to coexist and be migrated. The taxonomy already delivered one backwards-incompatible release (February 2026) and updates several times a year. Each Excel named range in the Digital Template corresponds exactly by local name to an XBRL taxonomy element, and dimensions are used sparingly — a flat mapping, friendly to a relational store. **Measured against the published `2026-05-01` package on 29 Aug 2026 (task 33.1): 143 reportable elements, of which 34 are dimensioned, along 8 axes.** "Sparingly" holds; "flat" does not, and the difference is the design's, not a correction of it — `report_disclosure_value` was already keyed on `(report_id, element_key, dimension_key, ordinal)`. |
| **Decision** | Disclosure data is stored as element-keyed values against a report, where the element key **is** the VSME XBRL taxonomy element local name (e.g. `EnergyConsumptionFromFuels`, `NumberOfFemaleEmployees`). The set of elements, their datatypes, units, cardinality, dimensions, validation rules and applicability conditions comes from a **registered taxonomy version** held in the configuration store, not from TypeScript types or table columns. |
| **Alternatives considered** | *Column-per-disclosure relational modelling* — rejected on DR-4 / NFR-86 grounds: a hand-modelled `b3_energy_emissions` table would need DDL migration on every taxonomy release. *Whole report as a single JSONB blob* — rejected because per-field audit attribution (FR-54, NFR-7, NFR-35), per-field validation state (FR-40) and per-field comparative display (FR-46) all need row granularity; a blob makes each of those an application-level diff. |
| **Consequences** | A taxonomy release becomes **data registration plus a mapping**, which is what NFR-86 demands. The trade accepted is loss of compile-time typing and database-level check constraints on individual disclosures. That is bought back three ways: a typed **facade** generated per taxonomy version, so application code and the API still see `report.b3.scope1Emissions` rather than string keys; validation running from registered rule definitions (FR-73) rather than column constraints; and a golden-report cross-format regression corpus (NFR-20, NFR-21, NFR-22) that catches what the type system no longer can. |

### 4.5 AD-4 — Configuration-as-data, with an explicit publish/revert step

| | |
|---|---|
| **Context** | DR-3: content, thresholds, factor sets, validation rules, notification templates and plan definitions must change without a redeploy, publish within one working day of approval, and revert in one step. NFR-19 requires a stored calculation to reproduce exactly against its stored raw inputs and factor-set version; NFR-87 forbids a rule or factor change from silently restating a previously reported figure. |
| **Decision** | A single **configuration store** subsystem holds every artefact that must change without a release, each versioned with `draft → in review → published → superseded` states, each revertible in one action, and each with an effective date where the domain needs one. Published versions are **immutable**. Publication is a single transactional action that writes a new immutable version and flips a pointer; revert flips the pointer back. |
| **Alternatives considered** | *Event-based cache invalidation via PostgreSQL `LISTEN/NOTIFY`* — rejected on two counts: `LISTEN` requires a pinned session and is unsupported through PgBouncer in transaction pooling mode, which is exactly what fronts the database; and `NOTIFY` is lossy, so a replica disconnected during the notify never learns it missed one, leaving it indefinitely stale. *Effective-dating without immutability* — rejected: an edited "published" factor set silently rewrites history. |
| **Consequences** | **Implementation note added 20 Aug 2026 (task 16): the store is two tables, and the split is what makes §7.9's stated constraint usable.** §7.9 and §12.3 both specify `PRIMARY KEY (scope, validity WITHOUT OVERLAPS)` for effective-dated configuration, but that cannot sit on a table which also keeps superseded versions — two versions of one scope necessarily cover overlapping dates, so every supersession would violate it. `config.entry_version` therefore holds every version and no validity at all; `config.entry_schedule` holds only what is in force, carries that primary key, and **is** the pointer this decision describes. Publication writes a version and updates the slot's `version_id`; revert updates it back. The store version is bumped by a trigger on the schedule rather than by the publishing code, because a publish that forgot to bump it is a change no replica ever notices — the failure mode `LISTEN/NOTIFY` was rejected for. Cache invalidation is **version-based, not event-based**: every `api` and `worker` replica holds a cached read model stamped with a `config_version`; a cheap poll of a single-row version table (≤ 5 s) is the **authority**, and a Redis pub/sub message is only a latency optimisation. A lost message costs seconds of staleness instead of an indefinitely stale replica. Effective-dated tables carry a non-overlap guarantee at database level (§12.3). |

Artefacts held, and whether they are effective-dated:

| Artefact | Requirement | Effective-dated |
|---|---|---|
| Help-centre articles and plan presentation copy, per locale | FR-61, FR-62, NFR-85 | No — published/superseded |
| Locale registration — which locales are offered; the catalogues themselves are committed (OQ-43) | FR-63, NFR-25 | No |
| Social provider behaviour — enabled state, client id, issuer, scopes, redirect-URI allowlist; the client secret stays in the environment (§12.5.6) | FR-82 | No |
| Organization legal forms, per country — the codes; their wording is committed (OQ-43) | FR-15 | No |
| Organization relationship types — `direct_sme` at MVP; Advisor, Buyer and Licensee added as data | FR-14, NFR-9 | No |
| VSME template + XBRL taxonomy versions and their artefacts | FR-65, FR-66 | Pinned per report, not dated |
| Version-to-version field mappings | FR-67 | Pinned to a version pair |
| Emission and conversion factor sets | FR-71, NFR-19 | **Yes** |
| Conditional-applicability thresholds (≥50 turnover, ≥150 pay gap) | FR-72 | **Yes** |
| Validation rule definitions, each naming a message key whose wording is committed (OQ-43) | FR-73 | **Yes** |
| Notification category behaviour — channels, classification, lead times, repeat interval; template wording is committed (OQ-43) | FR-173 | No |
| Plan versions, entitlements, quotas, prices, discounts | FR-84 … FR-89 | **Yes** |
| VAT rates and treatment rules | FR-148, NFR-73 | **Yes** |
| MIA per-transaction and cumulative ceilings | FR-118, NFR-73 | **Yes** |
| BNM rate sourcing | FR-129, NFR-73 | **Yes** |

### 4.6 AD-5 — One entitlement service, consulted by everything, depended on by nothing

| | |
|---|---|
| **Context** | FR-100 requires gating logic to live outside the gated capability. NFR-17 requires that adding a gated capability needs no entitlement-service change and that changing a plan needs no capability change. NFR-41 sets p95 ≤ 20 ms (≤ 100 ms on cache miss). NFR-49 requires the core to keep serving UC-17 … UC-48 when the billing context is unavailable. |
| **Decision** | A single `EntitlementService` answers every gated action with `allow \| deny \| allow_with_warning`, plus the reason and the current limit. It is defined by an interface in `contracts/`, implemented in the billing context, consumed by the core. The contract is a **key lookup, not a method per feature**: `check(orgId, key, requested?) → Decision`, where `EntitlementKey` is a string registered in configuration. Entitlements are computed from plan-version entitlements plus per-subscription overrides, cached per organization. |
| **Alternatives considered** | *A method per gated feature* — rejected: it makes NFR-17 false by construction, since a new capability would require an entitlement-service change. |
| **Consequences** | A new gated capability is a new key in the plan catalogue; a new plan is new data. NFR-17's verification — a synthetic entitlement key and a synthetic plan introduced in test — is a CI job. Availability behaviour is a requirement, not an accident: the cache carries a last-known-good snapshot per organization with a generous TTL, and a deny from an unreachable billing context is treated as allow for **already-granted** keys and closed for new purchases; a chaos test that disables billing mid-session is the verification. In-process cache per `api` container means no network hop on the hot path, which is what makes 20 ms trivially achievable — another point in favour of AD-1. The version poll matters more here than for content: a missed invalidation on a downgrade or cancellation would let an organization keep entitlements it no longer holds until the TTL expires. |

Registered keys named in the sources: `report.export.pdf`, `org.entities.max`, `org.seats.max`, `api.calls.monthly`, `module.comprehensive`.

### 4.7 AD-6 — Transactional outbox and a saga for the order lifecycle

| | |
|---|---|
| **Context** | DR-9. Acquirers and national platforms deliver duplicate, delayed and out-of-order events, and NFR-54 requires convergence on a single state under all three. NFR-59 requires order → payment → invoice → entitlement to be all-or-nothing. |
| **Decision** | All cross-boundary effects — e-Factura transmission, email dispatch, payment-provider calls, entitlement propagation, webhook fan-out — are written to an `outbox_event` table **in the same transaction** as the state change that caused them, and dispatched by the worker. All inbound provider events land in an `inbound_event` table keyed `(provider, provider_event_id)` with a unique constraint. The order → payment → invoice → entitlement sequence runs as an explicitly modelled **saga** with persisted state and compensations, not a chain of awaits. |
| **Alternatives considered** | *Direct provider calls inside the request* — rejected by DR-9 and NFR-50. *Claiming exactly-once delivery* — explicitly declined: delivery is at-least-once and processing is **effectively once** (the unique constraint deduplicates insertion, the effect commits with the processed marker). "Exactly once" is not available across a network boundary and is not claimed. *Treating `invoiced` as reversible* — rejected: an issued fiscal document cannot be withdrawn (D-10) and its number cannot be released (AD-7). |
| **Consequences** | **Implementation note added 20 Aug 2026 (task 15): the dispatcher enqueues *before* marking a row dispatched, both inside one transaction.** Reversing that order yields an at-most-once system that passes every test identically — a crash between the mark and the enqueue loses the row silently, because nothing errors. Enqueue-then-mark means a crash rolls the transaction back and the row returns to pending. The `idempotency_key` is passed to BullMQ as the **job id**, so the re-emitted duplicate is discarded by the queue: that pairing is what makes "delivery is at-least-once and processing is effectively once" true in code rather than in intent. Every outbox row carries an `idempotency_key` generated in the originating transaction and passed to every provider that supports one; adapters for providers that do not — e-Factura among them — declare a **recovery query** (for e-Factura, look up by invoice number before re-transmitting). Without this, a dispatcher restart produces a duplicate e-Factura submission or a duplicate refund execution. NFR-59's "all-or-nothing" is, strictly, **eventual convergence with compensation and a surfaced terminal inconsistency**, not atomicity; the saga's terminal `inconsistent` state is a monitored operational metric with a Billing Operator work queue, not a silent log line. Saga states: `draft → awaiting_payment → paid → invoiced → provisioned`, terminals `expired \| cancelled \| failed`, compensation out of `invoiced` is `credit_note_issued`. Invoice numbering is consumed only at the `invoiced` step. Entitlements change on confirmed payment or, for approved transfer terms, on invoice issuance — never on order creation (FR-92, FR-108). |

### 4.8 AD-7 — Gapless fiscal numbering by a row lock on the counter, consumed at issuance

| | |
|---|---|
| **Context** | NFR-55 requires gapless, sequential allocation **under concurrent issuance and partial failure**, verified by a concurrency test with induced mid-transaction failure plus a sequence audit for gaps and duplicates. D-10 makes issued documents immutable. |
| **Decision** | Invoice numbers are allocated inside the issuing transaction by `SELECT next_number FROM billing.number_series WHERE document_type=$1 AND series=$2 AND fiscal_year=$3 FOR UPDATE`, incrementing the counter row and writing the document in the same transaction, at `READ COMMITTED`. The table carries `UNIQUE (document_type, series, fiscal_year, number)` as the invariant of record. A number is consumed **only** at issuance, never reserved at order creation. |
| **Alternatives considered** | *PostgreSQL sequence* — rejected: sequences are explicitly non-transactional, so a rolled-back transaction burns the number and produces a gap. *Advisory lock* — rejected with the flavour distinction spelled out: `pg_advisory_lock()` is **session**-scoped and is not released by `COMMIT` or `ROLLBACK`, so under transaction-pooled PgBouncer it is returned to the pool still held and the next borrower inherits it, deadlocking issuance for that series until the backend is killed; `pg_advisory_xact_lock()` avoids that but keys on `bigint`, so `(document_type, series, fiscal_year)` would have to be hashed, accepting silent collisions between unrelated series. `FOR UPDATE` gives the identical guarantee with no flavour ambiguity, no hashing and no pooler interaction. |
| **Consequences** | The isolation level is part of the decision, not an ambient default: read-then-increment is correct at `READ COMMITTED`, where a waiter re-reads after the lock is released; at `REPEATABLE READ` or `SERIALIZABLE` the waiter resumes on its original snapshot and the `UPDATE` aborts with a serialization failure, turning every concurrent issuance into a retry. AD-6's saga is exactly the code where someone raises the isolation level for unrelated reasons, so the issuing transaction pins its own. The cost is serialised issuance per series — at ≈ 200 documents per month this is not a bottleneck by four orders of magnitude. |

### 4.9 AD-8 — Adapter-and-port for every third party, with the merchant-of-record registered but inactive

| | |
|---|---|
| **Context** | DR-7: money is provider-executed and the platform never touches card data or holds funds. NFR-11 requires no vendor type outside its adapter, verified by a dependency review per release. NFR-14 requires an adapter to be activated with a diff limited to the adapter plus configuration. |
| **Decision** | Each external dependency is reached through a port defined in `contracts/` with exactly one adapter per provider, registered in a provider registry read from configuration. |
| **Alternatives considered** | *Direct SDK use in domain code* — rejected by NFR-11. *Building the merchant-of-record path at MVP* — rejected: D-8 requires activation to be configuration, not a build, so the port is registered and the adapter inactive. |
| **Consequences** | PCI DSS scope stays SAQ-A: no PAN reaches the platform, and no custody or settlement code path exists. Phase 2 XBRL is additive because `DocumentConversionPort` exists at MVP with no adapter wired. |

| Port | MVP adapters | Notes |
|---|---|---|
| `CardAcquiringPort` | maib (primary), Victoriabank, MICB | Hosted page / SDK only. No PAN ever reaches the platform (NFR-60, SAQ-A). Tokenisation for recurring |
| `InstantPaymentPort` | MIA (via participating bank APIs) | Offered only where order total ≤ configured per-transaction ceiling (FR-118) |
| `BankTransferPort` | Proforma + reconciliation | No provider call; settlement is asynchronous and reconciled (FR-131 … FR-134) |
| `MerchantOfRecordPort` | Paddle-class — **registered, inactive** | D-8; NFR-14's verification is adapter activation in staging with the diff limited to adapter + config |
| `EInvoicingPort` | e-Factura national XML; Peppol anticipated | FR-126, FR-127, D-9 |
| `ExchangeRatePort` | BNM official rate, by invoice date | FR-129, D-14 |
| `IdentityProviderPort` | Google, Microsoft (OIDC) | FR-2, FR-82, D-6. Registration/rotation without redeploy |
| `EmailPort` | Transactional ESP, EU region | FR-169, NFR-84 (SPF/DKIM/DMARC) |
| `DocumentConversionPort` | EFRAG open-source converter (MIT), self-hosted | Phase 2 XBRL; the port exists at MVP so Phase 2 is additive |
| `ObjectStoragePort` | S3-compatible, EU region | Exports, archives (NFR-27, NFR-36) |

### 4.10 AD-9 — Two front-end applications, both clients of one public API

| | |
|---|---|
| **Context** | DR-11 and NFR-16 forbid an interface-only privileged route. NFR-65 requires the administrative surface to be separately addressed, network-restricted and MFA-mandatory, sharing no session, cookie scope or credential with the tenant surface. NFR-43 sets LCP ≤ 2.5 s on 4G mid-range. |
| **Decision** | **`web`** — Next.js 16 (App Router), tenant-facing: registration, report wizard, calculator, validation, exports, organization and user administration, billing self-service. Server components for shell, navigation, list views and export preview; client components for the wizard's field-level interaction. **`admin`** — React 19 + Vite 8 SPA, the Platform Administrator console: content and translation publication, taxonomy version registration and migration runs, factor sets and thresholds, plan catalogue, reconciliation and dunning workspaces, adoption metrics, support-access grants. Both authenticate against and call the **same** `api`. |
| **Alternatives considered** | *Admin as a route group inside the tenant app* — rejected: it shares an origin and a cookie scope by construction, which NFR-65 forbids. *Next.js for the admin console* — rejected: an internal, authenticated, behind-the-firewall console has no SEO and no cold-start latency concern, and benefits from the simpler Vite build. *A privileged Next.js server route reaching the database directly* — rejected by DR-11. |
| **Consequences** | Next.js server-side code acts as a **session-holding proxy** — it holds the httpOnly refresh cookie and forwards requests with a short-lived access token, so no token is exposed to browser JavaScript — but every route it calls exists in the public OpenAPI surface and is authorized identically. Three Next.js 16 specifics are load-bearing: `proxy.ts` replaces `middleware.ts` and runs on the Node.js runtime, which is exactly the tier this decision describes, so the project starts on `proxy.ts`; **Cache Components (`"use cache"`) stay off as a security rule, not a performance preference** — every page is tenant-scoped, and a framework-level cache whose key the compiler generated without knowing about `organization_id` would leak across tenants **above** the RLS boundary of AD-2, where none of its probes would catch it; and `next lint` is removed, so CI must invoke ESLint directly or every gate in AD-13's table silently turns off. Turbopack is the default bundler; React Compiler stays off until the wizard's render profile is measured. |

**The wizard's persistence model** is where three requirements collide: FR-37 (autosave on blur/step change, no save button), FR-38 (queue locally and retry offline), NFR-38 (p95 ≤ 250 ms, non-blocking), NFR-56 (no acknowledged change lost — acknowledge only after durable write). The design: field-level optimistic update in a client store, a debounced batched `PATCH` per field group, an IndexedDB-backed outbound queue that survives a tab close, a per-field `synced | queued | failed` indicator, and a persistent banner while anything is unsynced. The server acknowledges only post-commit. Conflict resolution is last-write-wins per field with the audit trail (FR-54) as the reconciliation record — appropriate because the realistic concurrency is one or two people in one SME, not simultaneous editing.

### 4.11 AD-10 — Exports and all long-running work leave the request tier by queue

| | |
|---|---|
| **Context** | NFR-46 requires export generation decoupled from the request tier such that an export burst affects only export latency, verified by fault injection flooding the export queue while measuring NFR-37. NFR-42 requires any generation projected beyond 30 s to run asynchronously with progress indication and completion notification. |
| **Decision** | A BullMQ queue on Redis carries PDF generation, Excel template population, e-Factura transmission, email dispatch, dunning runs, reconciliation imports, taxonomy migration runs, trial and invitation expiry, metering rollups and backup verification. The `worker` container consumes it. The queue store is used for queueing, rate limiting and short-lived caches — **never** as a system of record. **The outbox is the only producer**: `api` does not enqueue directly. |
| **Alternatives considered** | *Synchronous export in the request* — rejected by NFR-46. *A synchronous fast path plus an async slow path* — rejected: since NFR-42 forces the async path to exist anyway, making it the only path removes a branch. *`api` enqueueing to Redis directly* — rejected as a dual write: a job enqueued for a transaction that then rolls back runs against state that does not exist, and a commit whose `LPUSH` fails silently drops the work. *ExcelJS for the EFRAG template* — rejected (see below). *Ghostscript in the PDF path* — rejected (see below). |
| **Consequences** | Every queued job has a durable outbox row behind it, so a total queue-store loss costs in-flight jobs that the dispatcher re-emits, not data. Export is always `202 + job id`. Completion raises a notification through AD-11. |

**PDF, and why the obvious pipeline does not work.** PDF is produced by headless Chromium (Playwright) rendering the same React templates the preview uses, so FR-48's preview and FR-49's PDF cannot drift, with `tagged: true` set — Chromium emits an untagged PDF by default. Semantic HTML is what makes the resulting structure tree meaningful, which is why the templates are semantic rather than absolutely positioned. Two corrections to the conventional recipe:

- **PDF/A-2b is the wrong conformance level for what NFR-75 asks.** 2b is *basic* — visual reproducibility only. Logical structure, tagging and Unicode mapping are level **a**; reading order and accessibility conformance are PDF/UA-1. A veraPDF pass against 2b proves nothing about tagged reading order, so a suite built that way reports green on a requirement it never tested. This architecture targets **PDF/A-2a plus PDF/UA-1** and validates against both profiles; NFR-82 is amended accordingly (§17.1).
- **Ghostscript must not be in this path.** Its `pdfwrite` device does not post-process; it re-interprets and re-emits, and the structure tree, marked content and `/Lang` do not survive — it would strip exactly the tags NFR-75 requires, before veraPDF ever saw the file. (It is also AGPL-3.0, which the network clause makes a live licensing question for a hosted commercial service.) The OutputIntent, ICC profile and conformance XMP are instead injected **in place** with `qpdf`/`pikepdf`, which leave the rest of the file untouched.

Chromium's tagging is real but shallow — headings, paragraphs, lists and tables, but not table header scope, artifact marking for decorative content, or PDF/UA identification metadata. Those are added in the same in-place step. If accessible tagging still proves unreachable, NFR-75 is escalated as a conflict rather than left claimed and untested.

**Excel, and why ExcelJS is not the tool.** FR-50 requires writing into the **official EFRAG template's named ranges** while preserving its dropdowns and consistency formulas. ExcelJS parses an `.xlsx` into its own object model and writes a *new* workbook from it — there is no binary-base mode — so everything it does not model is lost on round trip, and data validation (the dropdowns) is its most frequently reported round-trip loss; sheet-scoped and formula-defined names generally do not survive either, and the template's named ranges are the target. The export therefore treats the `.xlsx` as what it is — a zip of XML parts — and patches it surgically: resolve the named ranges from `xl/workbook.xml`, rewrite only the target `<c>` nodes in the relevant `xl/worksheets/sheetN.xml`, delete `xl/calcChain.xml`, set `<calcPr fullCalcOnLoad="1"/>` so consumers recalculate on open, and rezip **every other part byte-for-byte unchanged**.

NFR-20's verification needs restating for the same reason: LibreOffice Calc headless is automatable in CI and is the automated gate; Microsoft 365 and desktop Excel are not server-automatable on Linux, so those become a manual item on the release checklist rather than a CI job.

### 4.12 AD-11 — One notification subsystem, channel-agnostic, with delivery evidence

| | |
|---|---|
| **Context** | FR-157 requires every producer to raise through one mechanism. FR-167 requires cancelling an outstanding notice when its condition clears and deduplicating on category and subject. FR-170 requires per-recipient channel, dispatch timestamp and outcome as **the evidence that a required update was actually requested** — a compliance artefact, not telemetry. |
| **Decision** | A notification is a first-class record (category, subject reference, recipients, state) held separately from the channels it is delivered on (FR-160). One notice to two people on two channels is one notification with four delivery records. In-app delivery writes directly to the recipient's notification centre with no external dependency (FR-168); email goes through `EmailPort`, language resolved **per recipient** (FR-169). |
| **Alternatives considered** | *Fire-and-forget send per producer* — rejected: FR-167's cancellation and deduplication are only expressible if the notification is a stateful record keyed by `(category, subject_ref, recipient_scope)` with an upsert. |
| **Consequences** | Every producer — payment failure, quota approach, trial expiry, dunning, service restriction, invitation, invoice delivery, version change, outstanding-report, deadline — raises through this one mechanism and acquires no delivery path of its own. FR-160 … FR-173 had no NFR counterpart, which left FR-170's delivery records with no acceptance threshold; NFR-106 … NFR-109 were authored to close that (§17.3). |

### 4.13 AD-12 — Auth by short-lived JWT plus server-side revocable refresh sessions

| | |
|---|---|
| **Context** | FR-6 requires a consumed password-reset link to invalidate all existing sessions; FR-7 offers termination of other sessions; FR-58 requires a role change to take effect **on the user's next request rather than at their next login**. FR-5 requires server-side session termination on logout. |
| **Decision** | The access token is a short-lived (≤ 15 min) signed JWT carrying **`session_id` and nothing else of authorization consequence** — no role, no organization, no entitlement snapshot. Refresh tokens are opaque, stored server-side, rotated on use, revocable. Role, active organization and per-report rights are read server-side on every request from the session and membership records. |
| **Alternatives considered** | *Claims in the token (role, org, entitlements)* — rejected: all three of FR-6, FR-7 and FR-58 need a per-request server-side lookup, and once that lookup exists the token is doing no authorization work. Carrying `role` anyway would be a live footgun — some guard, at some point, trusts the claim instead of the lookup, and nothing in the design would catch it. |
| **Consequences** | The 15-minute lifetime bounds replay of a stolen token; the lookup, not the lifetime, bounds staleness. This is also why AD-2 grounds `app.current_org` in the membership lookup rather than in a claim. The admin surface needs its own token handler: AD-9's httpOnly-cookie proxy pattern depends on a server-side rendering tier, which `web` has and a static Vite SPA does not — left unaddressed, the *more* privileged surface would be the one holding its access token in browser JavaScript, inverting the intended risk gradient. `admin` therefore gets its own token handler so it uses the same httpOnly-cookie pattern. **That handler is a route on `api` — `POST /auth/admin/session` — not an endpoint at `edge`.** This paragraph originally placed it at `edge`; OQ-17 closed it onto `api` because a handler at the edge would be a second auth surface outside the one public API, which no contract test and no OpenAPI diff (P-5) would ever see. Corrected 19 Aug 2026 with the `apps/admin` scaffold; OQ-17 and §12.5 govern. |

### 4.14 AD-13 — TypeScript 6.0.3, single compiler

| | |
|---|---|
| **Context** | TypeScript 7.0 shipped 3 August 2026 as the first stable release of the native Go compiler, 8–12× faster on full builds — and **without a stable programmatic API**, expected in 7.1. typescript-eslint declares support for `>=4.8.4 <6.1.0` with no tsgo support. This architecture leans on static analysis to discharge requirements that have no other verification. |
| **Decision** | Build on **TypeScript 6.0.3**, single compiler. The optional TS 7 side-by-side type-check is documented but **not adopted**. |
| **Alternatives considered** | *Adopt TS 7 on day one* — rejected: it would disable the tooling that several NFRs name *as their acceptance criterion*. The build would be faster and four requirements would become unverifiable — a bad trade at any compile speed. *Side-by-side (TS 7 advisory `typecheck`, TS 6 authoritative `build`)* — Microsoft's own recommended shape, documented, available, not taken; if adopted, TS 6 remains authoritative and a TS 7 failure is a signal to investigate, never a merge block. |
| **Consequences** | Decorators are **not** the blocker — `tsgo` emits the same `__decorate`, `__metadata` and `__param` helpers, so NestJS DI, TypeORM entity metadata and class-validator all work under TS 7. The blocker is every consumer of the compiler API: `nest build` calls `createProgram()` and `program.emit()`, as do the Swagger and GraphQL CLI plugins, ts-jest, ts-loader, ts-morph and type-aware ESLint. 7.1 will ship a *different* API, so tooling must be **ported**, not widened — the wait is likely longer than 7.1's release date. Promotion criterion: make TS 7 the compiler of record when `nest build` **and** typescript-eslint both support it. Building on 6.0.3 now is the shortest route there, since 7.0 converts 6's deprecations into hard errors and makes `strict` and `esnext` the defaults. |

Gates that depend on the TypeScript 6 compiler API, and the requirement each verifies:

| Gate | Requirement it verifies |
|---|---|
| `dependency-cruiser` / `eslint-plugin-boundaries` on `modules/core` ↔ `modules/billing` | DR-1, NFR-15 — the *only* runtime-independent enforcement of the bounded-context split |
| Rule prohibiting float in monetary types | NFR-58's stated verification, verbatim |
| Rule prohibiting hardcoded date/number/currency format patterns | NFR-26's stated verification, verbatim |
| Log-scanning rule for personal data | NFR-30 |
| Route-coverage diff (interface-only privileged routes) | NFR-16 |

### 4.15 AD-14 — TypeORM 1.1, adopted with five parts switched off

| | |
|---|---|
| **Context** | The ORM choice was previously open. TypeORM sat on `0.3.x` for years with patchy maintenance; it reached **1.0 on 19 May 2026** and **1.1 on 13 July 2026**, making it — alongside Prisma — one of only two candidates with a 1.0-and-later stability commitment, while Drizzle (0.45) and Kysely (0.29) remain pre-1.0 on a system carrying a six-year fiscal retention obligation. |
| **Decision** | **TypeORM 1.1.0** with `@nestjs/typeorm` 11.0.3 as the persistence layer, adopted with five parts deliberately switched off. |
| **Alternatives considered** | *Prisma* — the other 1.0-committed candidate; TypeORM chosen for the first-party NestJS adapter, which removes real glue (module wiring, request scoping, health checks, testing utilities). *Drizzle, Kysely* — rejected as pre-1.0 against a six-year retention obligation. *Leaving the choice open* — closed by this decision. |
| **Consequences** | The honest trade: an ORM's headline value is entity-driven schema generation and relational navigation, and this design uses **neither** — AD-3's disclosure store is a keyed upsert, not an object graph, and DR-1 forbids relations across the core/billing boundary. TypeORM is adopted for repository ergonomics, migration tooling and team familiarity, on condition that the parts which fight the design are switched off now rather than discovered in month four. |

The five constraints, each non-negotiable:

1. **`synchronize: false`, permanently, and no auto-generated migrations.** TypeORM's schema generation cannot express RLS policies or `FORCE ROW LEVEL SECURITY`, the `GRANT`/`REVOKE` model, `WITHOUT OVERLAPS` primary keys, `uuidv7()` defaults, statement-level triggers, AD-3's composite `(report_id, organization_id)` foreign key, or expression indexes. The failure mode is worse than "unsupported": a generated migration reads those objects as drift and tries to **revert** them. Migrations are hand-authored SQL inside TypeORM migration classes.
2. **Every tenant query runs on the request's `QueryRunner`.** The largest integration risk in this decision. AD-2's RLS binding is transaction-local; a bare `repository.find()` takes an arbitrary pooled connection with no tenant GUC set. Mitigation: a `TenantRepository` base that resolves the active `QueryRunner` from `AsyncLocalStorage` and **throws when there is none**. Throwing is the point — without context, RLS returns zero rows, which presents as "this customer has no data" rather than as a bug. AD-2's CI probe suite gains a case that calls a repository method outside a request context and asserts it raises.
3. **Two `DataSource`s, not one.** `coreDataSource` and `billingDataSource`, with `audit` entities registered on both so an outbox row commits in the same transaction as the billing state change (AD-6). This makes NFR-1's "disable the billing context" test a matter of not registering the second data source, and makes a cross-context entity relation impossible to declare rather than merely forbidden.
4. **`numeric` stays a string.** The `pg` driver returns `numeric` as a JavaScript string and TypeORM preserves it — exactly what NFR-58 wants. The risk is a well-meaning `transformer` calling `parseFloat`; the CI float rule covers transformers explicitly.
5. **The audit-trail write is raw SQL.** `RETURNING old.*, new.*` is not expressible in the query builder, so any application path that wants both row images uses `queryRunner.query()`. **Amended 20 Aug 2026 (task 14): per-field capture itself is a database trigger, not an application function.** This constraint and §12.3's row both argue about the *application* path — the query builder cannot express `RETURNING old.*`, and PostgreSQL 17 needed a read-then-write under a lock. Neither argues against a trigger, which was not considered and never needed a read at all. The deciding property is that a function must be *called*: a plain `UPDATE` written in a later task bypasses it silently, which is the application-discipline failure DR-6 rejects for append-only records of exactly this kind, and FR-54 exists to support a limited-assurance review (NFR-7) that a trail with unknown gaps cannot serve. P-4 already places RLS, gapless numbering and append-only below the application deliberately; this belongs with them. The capture function is `SECURITY DEFINER`, so `esg_app` holds `SELECT` on `core.field_change` and no `INSERT` — the trail can be read by the application and authored by nothing except the trigger.

Two items for the first-week spike, listed rather than assumed: `@nestjs/typeorm` 11.0.3 declares its peer range as `^0.3.0 || ^1.0.0-dev`, which resolves 1.1.0 but loosely enough to warrant a smoke test — **discharged 18 Aug 2026: it resolves 1.1.0 cleanly with no peer warning; the only peer conflict in the tree was TypeORM's own optional `ioredis` range, recorded above**; and TypeORM and NestJS both rely on `experimentalDecorators` / `emitDecoratorMetadata`, whose behaviour under the eventual TypeScript 7 move should be verified before that migration rather than during it.

---

## 5. Logical architecture

### 5.1 The three layers, and why the separation is the central structural fact

`Private Monetization Architecture` states the layering that DR-1 encodes. Keeping these three layers cleanly separated is what allows pricing and packaging decisions never to touch compliance logic.

| Layer | Name | Owns | Knows nothing about |
|---|---|---|---|
| **Layer 1** | **Compliance core — "the truth"** | The entity data model mirroring the VSME taxonomy, the validation engine, and the PDF/Excel export generators | Plan, price, or tenant type. It only knows how to produce a correct report, and it is identical on the free tier and on an enterprise contract |
| **Layer 2** | **Commerce / entitlement layer** | Plan-and-entitlement resolution ("can this org perform this action right now"), usage counters, the metering-event stream, and the payment/invoicing rails | Report content. It gates by key, not by capability |
| **Layer 3** | **Distribution / tenancy layer** | The organization model and the typed relationships between organizations | Which monetization model is active for a given tenant |

Layer 1 is the trust asset the whole product depends on. Layer 2 supports **multiple concurrent pricing units** (per-seat, per-report, per-API-call, per-managed-supplier) rather than one hardcoded unit, which is what lets several packagings run simultaneously for different customer segments without special-casing the core. Layer 3 models organization relationships as a generic typed graph from day one — retrofitting a multi-tenant hierarchy after the fact is one of the most expensive re-architectures to do later.

**Cross-cutting: API-first.** The reporting core has a complete, documented API from day one, not a UI with an API bolted on afterwards. This is what makes usage-based billing, embedded/B2B2B use, enterprise integrations and white-labelling possible later without a separate engineering effort per channel — and it is the same principle DR-11 and NFR-16 require for a different reason (no privileged interface-only route).

### 5.2 How the three layers map onto the deployed modules

The three logical layers do not map one-to-one onto the five schemas; the mapping is stated explicitly so neither model is misread.

| Logical layer | Modules | Schema |
|---|---|---|
| Layer 1 — compliance core | `modules/core/*` (organization, entity, period, disclosure, calculator, validation, comparatives, export, trace) | `core` |
| Layer 2 — commerce / entitlement | `modules/billing/*` (catalogue, subscription, entitlement, account, order, payment, invoicing, efactura, reconciliation, collections, refunds, enterprise, finreporting) | `billing` |
| Layer 3 — distribution / tenancy | `modules/identity/*` (account, session, provider, membership, invitation) plus `core.organization` and `core.org_relationship` | `identity`, `core` |
| Cross-cutting platform services | `modules/platform/*` (configuration, content, taxonomy, localization, notification, metering, audit, support-access, admin) | `config`, `audit` |
| The only cross-context surface | `contracts/` — ports and event schemas | — |

Note the deliberate asymmetry: the **organization aggregate lives in `core`**, not in a separate tenancy schema, while `billing` references it **by ID with no foreign key**. That is the physical expression of NFR-15 ("sharing no transaction, foreign key or table"). Metering — the instrumentation that makes Layer 2's pricing units evaluable — lives in `audit`, not in `billing`, so that the metering stream keeps flowing with `BILLING_ENABLED=false`.

### 5.3 System context (C4 level 1)

```mermaid
graph TB
    RC["Reporting Contributor<br/><i>SME staff, bookkeeper</i>"]
    OA["Organization Administrator<br/><i>SME owner</i>"]
    PA["Platform Administrator<br/><i>platform operator</i>"]
    BO["Billing Operator<br/><i>finance</i>"]

    SYS["<b>ESG Platform</b><br/>VSME Basic Module reporting,<br/>carbon calculator, exports,<br/>billing and fiscal compliance"]

    IDP["Google / Microsoft<br/>OIDC identity providers"]
    ACQ["maib / Victoriabank / MICB<br/>card acquiring"]
    MIA["MIA instant payments<br/>National Bank of Moldova"]
    BANK["Customer bank<br/>transfer + statements"]
    EF["e-Factura<br/>national B2B e-invoicing"]
    BNM["BNM<br/>official exchange rates"]
    ESP["Transactional email<br/>provider (EU)"]
    EFRAG["EFRAG artefacts<br/>Digital Template, XBRL taxonomy,<br/>open-source converter"]
    MOR["Merchant of record<br/><i>registered, inactive at MVP</i>"]

    RC --> SYS
    OA --> SYS
    PA --> SYS
    BO --> SYS

    SYS --> IDP
    SYS --> ACQ
    SYS --> MIA
    SYS --> BANK
    SYS --> EF
    SYS --> BNM
    SYS --> ESP
    SYS -.-> EFRAG
    SYS -.-> MOR
```

Dotted edges are offline/artefact relationships rather than runtime calls: EFRAG artefacts are registered into the configuration store by a Platform Administrator (FR-65), not fetched live — a live dependency on an external standards body inside the export path would put NFR-42 and NFR-48 at the mercy of someone else's uptime.

`CA` (Common Access) and `SYS` do not appear as boxes on this diagram: `CA` is the pre-organizational capability set every authenticated principal holds, and `SYS` is the platform's own scheduled and event-driven work, which is internal. Both remain valid actors in the register.

### 5.4 Container view (C4 level 2)

```mermaid
graph TB
    BR["User's browser<br/>tenant UI · RO / EN / RU"]
    BRA["Staff browser<br/>admin console"]

    RP["<b>edge</b><br/>Caddy 2.11<br/>TLS 1.2+, HSTS, rate limit"]
    WEB["<b>web</b><br/>Next.js 16 App Router<br/>SSR + proxy.ts session tier"]
    ADM["<b>admin</b><br/>React + Vite SPA<br/>static bundle<br/>MFA, IP-restricted"]

    API["<b>api</b><br/>NestJS 11 on Express 5<br/>modular monolith<br/>REST + OpenAPI 3.1"]
    WRK["<b>worker</b><br/>NestJS worker mode<br/>BullMQ consumers<br/>+ scheduler"]

    PG[("<b>postgres</b><br/>PostgreSQL 18<br/>schemas: core, billing,<br/>identity, config, audit<br/>RLS enforced")]
    RDS[("<b>redis</b> 8.10<br/>queues, rate limits,<br/>ephemeral cache<br/><i>never system of record</i>")]
    OBJ[("<b>object storage</b><br/>S3-compatible, EU<br/>exports, fiscal archive,<br/>object-locked")]

    CHR["<b>renderer</b><br/>headless Chromium (tagged)<br/>+ qpdf / pikepdf / veraPDF"]
    EXT["External providers<br/>acquiring · MIA · e-Factura ·<br/>BNM · email · OIDC"]

    BR --> RP
    BRA -->|"allowlisted IPs"| RP
    RP --> WEB
    RP --> ADM
    WEB -->|"same public API"| API
    ADM -->|"same public API,<br/>admin scope"| API
    RP --> API
    API -->|"outbox row<br/>(same transaction)"| PG
    WRK -->|"dispatch → enqueue"| RDS
    WRK -->|"consume"| RDS
    API --> PG
    WRK --> PG
    WRK --> CHR
    WRK --> OBJ
    API --> OBJ
    WRK --> EXT
    API -->|"OIDC token exchange,<br/>hosted-session creation,<br/>BNM rate lookup"| EXT
    RDS -.->|"pub/sub hint"| API
    PG -.->|"version poll = authority<br/>(config + entitlement)"| API
```

**Seven Compose services, plus two stores outside the Compose file** — PostgreSQL runs on its own VM from the launch stage onward and object storage is an external EU S3-compatible provider. Each container exists because a requirement forces it, not because it is conventional.

| Container | Responsibility | Replicas | Exists because |
|---|---|---|---|
| `edge` | TLS 1.2+, HSTS, rate limiting, admin IP allowlist, dynamic upstreams | 1 | NFR-61, NFR-64, and NFR-65's admin network restriction |
| `web` | Tenant UI; holds the httpOnly refresh cookie; calls the public API only | 2 | SSR of list/preview views (NFR-43) and server-side session holding (AD-9) |
| `admin` | Static SPA on `admin.<host>`; separate auth realm; MFA mandatory | 1 | NFR-65 — separate address, cookie scope and credential realm |
| `api` | All bounded contexts; HTTP only; no long-running work | 2–4 | AD-1 |
| `worker` | Outbox dispatch, queue consumers, scheduler | 1–3 | NFR-46, NFR-42, NFR-93 |
| `renderer` | Tagged PDF generation, PDF/A-2a + PDF/UA-1 conformance | 1–2 | Chromium is heavy, has a different memory profile from Node, and must be independently restartable; NFR-82 and NFR-75 both live here |
| `postgres` | Primary store | 1 (+ standby) | Primary store; NFR-51 |
| `redis` | Queues, rate limits, ephemeral cache. **Never a system of record** | 1 | AD-10 |
| `object storage` | Exports, fiscal archive (six years, object-locked) | external | NFR-36, NFR-72 |

`api` and `worker` are the **same image**, different entrypoint. That matters for NFR-89 (buildable to a deployable artefact from source with no manual step) and for the reproducibility drill — one build, one version, two roles.

---

## 6. Component model

### 6.1 Component view of the `api` container (C4 level 3)

```mermaid
graph TB
    subgraph edge_layer["Request edge"]
        AUTH["AuthGuard<br/>JWT + session lookup"]
        TEN["TenantTransactionGuard<br/>transaction-local app.current_org"]
        ENT["EntitlementGuard<br/>@RequiresEntitlement()"]
        AUD["AuditInterceptor<br/>actor + timestamp on every mutation"]
    end

    subgraph core["<b>Compliance core</b> — schema: core"]
        ORG["Organization &<br/>Entity"]
        PER["Reporting Period<br/>lifecycle + version pinning"]
        DIS["Disclosure Store<br/>taxonomy-keyed values"]
        VAL["Validation Engine<br/>rule interpreter"]
        CALC["Carbon Calculator<br/>factor-set versioned"]
        COMP["Comparatives<br/>prior-period resolution"]
        EXP["Export Orchestrator<br/>preview + enqueue"]
        TRC["Field Audit Trail"]
    end

    subgraph billing["<b>Billing</b> — schema: billing"]
        PLAN["Plan Catalogue"]
        SUB["Subscription<br/>state machine"]
        ORD["Order + Checkout<br/>saga"]
        PAY["Payment Adapters"]
        INV["Invoicing +<br/>gapless numbering"]
        EFAC["e-Factura Pipeline"]
        REC["Reconciliation"]
        DUN["Collections / Dunning"]
        LED["Billing Ledger<br/>append-only"]
    end

    subgraph ident["<b>Identity</b> — schema: identity"]
        REG["Registration +<br/>verification"]
        SESS["Session + refresh"]
        OIDC["Provider identities"]
        MEM["Membership + roles"]
    end

    subgraph shared["<b>Platform services</b> — schema: config, audit"]
        CFG["Configuration Store<br/>versioned + publishable"]
        TAX["Taxonomy Registry<br/>+ migration engine"]
        I18N["Localization<br/>+ fallback log"]
        NOTIF["Notification Service"]
        METER["Metering<br/>append-only events"]
        OUTBOX["Outbox Dispatcher"]
        ENTS["Entitlement Service"]
    end

    AUTH --> TEN --> ENT --> AUD
    AUD --> core
    AUD --> billing
    AUD --> ident

    ENT -.->|"contracts/"| ENTS
    ENTS -.->|"implemented in"| billing
    core -.->|"reads config"| CFG
    core --> TAX
    VAL --> CFG
    CALC --> CFG
    billing --> LED
    billing --> OUTBOX
    core --> METER
    billing --> METER
    billing --> NOTIF
    core --> NOTIF
```

### 6.2 The request edge — four cross-cutting obligations discharged once

This is the only way those obligations stay true across 173 requirements.

| Component | Responsibility | Requirement |
|---|---|---|
| `AuthGuard` | Server-side evaluation on every request; the interface layer is untrusted. Resolves session → user → membership → active organization, the last step by `selectActiveMembership` — a pure function whose rules task 25.3 fixed outside the guard, so a stale or revoked preference is seven lines of spec rather than an integration test nobody writes | FR-4 … FR-8, NFR-62 |
| `TenantTransactionGuard` | Opens the transaction and sets `app.current_org` / `app.current_user` transaction-locally (AD-2). A handler reaching the database outside this transaction gets no tenant context and therefore no rows — a fail-closed default | NFR-63 |
| `RequiresRoleGuard` | `@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)`, reading the role `AuthGuard` resolved onto the request context — never a token claim, which AD-12 leaves empty of authorization consequence. Added 25 Aug 2026 with task 25.2 | FR-158, NFR-62 |
| `EntitlementGuard` | `@RequiresEntitlement('report.export.pdf')` decorator, so the gated capability contains no gating logic | FR-100, NFR-17 |
| `AuditInterceptor` | Attributes every state-changing action to an actor with a timestamp, across reporting, administration and billing alike | FR-159 |

**The order above is normative; the component *kinds* are not, and one of them could not be what
this table originally called it.** Rows two and three read `TenantContextInterceptor` until
19 Aug 2026 (task 11), when building it made the contradiction concrete: **NestJS runs every guard
before any interceptor**, and `EntitlementGuard` reads per-organization subscription state, which
needs `app.current_org` already bound. An interceptor cannot open a transaction that a guard
running earlier depends on. It is therefore a **guard**, `TenantTransactionGuard`, and the naming
is corrected here rather than left to a working-notes file.

**The surface is closed by default, and `@Public()` is the whole of the exception. Task 28.1,
25 Aug 2026.** `AuthGuard` is an `APP_GUARD`, so a route added later is closed by omission rather
than open by it — the reverse of the state it replaced, in which nothing was authenticated at all.
There are exactly three kinds of exemption and each carries its reason at the route: the routes that
make a session exist (`/auth/*`, including sign-out, which AD-12 has authenticate by refresh token
so it still works in UC-07's state), liveness (`/health`, which must not depend on the database),
and **the admin realm** — `/auth/admin/*` is public to the *tenant* guard and not public at all,
carrying no bearer because NFR-65 gives it a separate credential store and a sealed cookie its own
handler verifies. Swagger needs no marker: `SwaggerModule.setup` mounts express middleware rather
than a Nest route, so no `APP_GUARD` runs for it.

**What the guard closed that was open.** §12.5.6 recorded a deferral against this task: a revoked
session's last access token was honoured for up to 15 minutes, because nothing re-read the session.
The per-request lookup is what makes AD-12's "the lookup, not the lifetime, bounds staleness" true,
and it is the same mechanism FR-58 rests on — the role is read from the membership record on every
request, so a demotion binds on the member's next request with the token they are already holding.

**Two refusals, and the distinction is for the client rather than the user.**
`authentication-required` means there is nothing to work with — no token, a token this API did not
issue, a session that does not exist. `session-expired` means the token was ours and the session
behind it is over, which is the signal to refresh or to re-authenticate in place with work preserved
(UC-07, UX-38). A resolved actor with **no** organization is a success, not a refusal: it is the
state UC-16's list exists to report and task 25.4's branch reads.

**`@RequiresRole` applies its own guard, and that is the row's point rather than an implementation
note. Decided 25 Aug 2026 (task 25.2).** The conventional shape registers the guard globally and
sets metadata per route, which leaves the guard ubiquitous and the *gate* opt-in: a route carrying
the metadata and not the guard is open, and a route carrying neither is open, and both read as gated
in review. The decorator therefore composes `SetMetadata` with `UseGuards`, so the two cannot
separate. What that does not solve — a route declaring neither — is `AuthGuard`'s, because
"authenticated by default" is a property of the chain and not of any decorator.

It refuses in three distinguishable ways, and the distinction is required rather than decorative:
no resolved actor is `401 authentication-required`, an actor with no active organization is
`403 membership-required`, and a member in the wrong role is `403 insufficient-role`. NFR-79 makes
each a different "what now" — sign in, join or create an organization, ask an administrator — and a
front end cannot branch on wording.

Two consequences follow and are worth stating, because both are easy to get wrong once:

- **Commit and rollback are not symmetric.** A `TransactionInterceptor` commits on the success
  path, but rollback cannot live there — a guard that throws never reaches an interceptor, so
  `AuthGuard` or `EntitlementGuard` failing would leave the transaction open. Rollback belongs to
  the exception filter, which is the single error exit every failure passes through (§6.8).
- **No transaction is opened when no organization is bound.** Anonymous and pre-authentication
  requests, and `/health`, take no connection at all, so liveness does not depend on the database.
  A tenant query on such a request then fails loudly at `TenantRepository` rather than quietly
  returning zero rows, which is T-11's stated mitigation.

### 6.3 Compliance-core components

| Component | Responsibility | Owned data | Depends on |
|---|---|---|---|
| Organization & Entity | Organization profile, typed organization relationships, reporting entities, sites, consolidation boundary, point-in-time entity snapshots | `core.organization`, `core.org_relationship`, `core.reporting_entity`, `core.entity_snapshot`, `core.site`, `core.consolidation_member` | Configuration (relationship types) |
| Reporting Period | Period lifecycle, prior-period linkage, due date, template and taxonomy version pinning at period open | `core.reporting_period` | Taxonomy Registry, Configuration |
| Disclosure Store | Element-keyed disclosure values, per-field state, not-material section declarations, carried-forward flags | `core.report`, `core.report_disclosure_value`, `core.section_declaration` | Taxonomy Registry, Field Audit Trail |
| Validation Engine | Interprets registered rule definitions; produces per-field findings and per-module/per-report roll-up | `core.validation_finding` | Configuration (rules, thresholds) |
| Carbon Calculator | Raw energy/fuel input capture, unit conversion, factor-set application, results written to B3 elements | `core.calc_run`, `core.calc_input`, `core.calc_result` | Configuration (factor sets) |
| Comparatives | Prior-period resolution and year-over-year movement flags at the point of entry | — (reads across periods) | Reporting Period |
| Export Orchestrator | Preview rendering, entitlement check, version resolution, enqueue, immutable export history | `core.export_artifact` | Entitlement Service, Outbox, Object Storage |
| Field Audit Trail | Per-field who/when/previous-value capture, written from the same statement as the change; survives membership revocation | `core.field_change` | — |

### 6.4 Commercial-layer (billing) components

| Component | Responsibility | Owned data | Depends on |
|---|---|---|---|
| Plan Catalogue | Plans, plan versions, declarative entitlement keys, per-currency/per-cycle prices, discount codes | `billing.plan`, `plan_version`, `plan_entitlement`, `plan_price`, `discount_code` | Configuration |
| Subscription | Subscription state machine, per-subscription overrides (Enterprise additive), change history | `billing.subscription`, `subscription_override`, `subscription_change` | Plan Catalogue |
| Entitlement (implements `contracts/entitlement.port`) | Resolves plan entitlements + overrides into decisions; quota evaluation | — (derived; cached) | Plan Catalogue, Subscription, Metering |
| Billing Account | Billing identity and fiscal attributes of the paying party | `billing` account records (FR-106, FR-107) | — |
| Order + Checkout saga | Order lifecycle as its own aggregate; rail availability; terms-version capture; saga state and compensations | `billing.order` | Payment, Invoicing, Entitlement, Outbox |
| Payment | Rail routing and provider adapters; tokenisation for recurring | `billing.payment` | `CardAcquiringPort`, `InstantPaymentPort`, `BankTransferPort` |
| Invoicing | Proforma and invoice documents, gapless numbering, credit notes, FX rate capture at issuance | `billing.invoice`, `proforma`, `credit_note`, `number_series` | `ExchangeRatePort`, Outbox |
| e-Factura Pipeline | Renders the invoice record into national XML, transmits, stores acknowledgement and identifier, tracks rejections | `billing.efactura_transmission` | `EInvoicingPort`, Outbox |
| Reconciliation | Bank statement import, settlement matching, exception queue | `billing.settlement_match` | `BankTransferPort` |
| Collections / Dunning | Dunning step sequencing, service-restriction decisions | `billing.dunning_step` | Notification, Entitlement |
| Refunds | Refund execution against the original rail, with idempotent dispatch | (FR-139 … FR-141) | Payment, Outbox |
| Enterprise | Contract path, additive subscription overrides, approved transfer terms | (FR-142 … FR-147) | Subscription |
| Financial reporting | VAT treatment, fiscal reporting outputs, ledger consistency | (FR-148 … FR-152) | Billing Ledger, Configuration |
| Billing Ledger | Append-only entries; corrections are superseding entries referencing the original | `audit.ledger_entry` | — |

### 6.5 Identity components

| Component | Responsibility | Owned data |
|---|---|---|
| Registration + verification | Account creation, email verification, password reset, uniform responses regardless of account existence | accounts, credentials, verification tokens |
| Session + refresh | Short-lived access token issuance, opaque server-side refresh sessions rotated on use, server-side termination | sessions |
| Provider identities | OIDC identities matched on **subject identifier**, not email | provider identities |
| Membership + roles | Organization membership, role in active organization, and the inputs from which **per-report rights are evaluated** (see below); revocation without cascading historical attribution | memberships |
| Invitation | Invitation issuance, expiry, acceptance | invitations |

**Per-report rights are derived, not stored. Decided 18 Aug 2026.** FR-158 requires authorization
"scoped per organization and per report", and this row previously read as though a grant existed per
report. No functional requirement creates, grants or revokes one: FR-57 assigns a single organization
role at invitation (edit or view-only), FR-22's period lock is what makes a report read-only, and
`design_spec.md` has no screen for managing per-report access — S-16 is organization-level. A product
that genuinely had per-report ACLs would have a surface for them.

So the rights on a report are **computed per request** from the acting user's organization role, the
state of the report's period (open or locked), and the entity the report belongs to. FR-158 is
satisfied as written — the *evaluation* is per report; what does not exist is a per-report grant record.

What this costs, stated so it is not rediscovered as a surprise: in a multi-entity organization
(FR-17), every member holding the edit role can edit every entity's report. Narrowing that to one
entity is not expressible and is not an MVP capability. Adding it later is additive rather than a
rewrite — an explicit grant table would further restrict, with this derivation as the default where no
grant exists — which is why the cheap option is also the reversible one. Related and still open:
OQ-26, how scoped permissions are evaluated across an organization relationship, which is what an
Advisor acting for a client organization would need.

**The role vocabulary, and what removal does to a row. Decided 25 Aug 2026 (task 25.1).** The three
roles above are §3's data-model row — *edit / view-only / Organization Administrator* — carried into
the schema as `editor`, `viewer` and `organization_administrator`, one per membership per
organization (FR-12). **CA is not among them**: actors.md is explicit that Common Access is "not a
role and not a permission level" but the capabilities every authenticated user holds regardless of
role, so admitting it would make *no role* representable as a role and force every authorization
check to special-case the one value granting nothing.

**FR-59's removal is a status change, not a delete, and no runtime role holds `DELETE` on the
table.** `core.field_change` already keeps a removed member's field-level attribution — its
`actor_id` carries no foreign key precisely so it survives (FR-55) — but a deleted membership row
still erases the *membership's own* history: when the role was granted, by whom, and when access was
withdrawn, which is what an assurance reviewer asking who could see this data in March is asking.
Withholding the privilege rather than relying on the application to remember follows P-4: the row
leaves only on the cascade from its account (NFR-28's erasure) or its organization, and
referential-integrity actions bypass row security by design, so those still work.

**The active organization is a column on the session record.** AD-12 requires role and active
organization to be "read server-side on every request from the session and membership records";
`identity.session.active_organization_id` is that record, written by the post-sign-in branch and the
global-tier switcher (`design_spec.md` OQ-6) and read by `AuthGuard`. It is deliberately *not* named
`organization_id`: the schema-invariant gate treats that name as the mark of a tenant-scoped table
and would require RLS on `identity.session`, where a policy scoped to the bound organization would
break the pre-authentication lookup for the same reason §7.6 gives for membership. A session is an
account's and merely points at a tenant.

### 6.6 Platform-service components

| Component | Responsibility | Owned data | Notes |
|---|---|---|---|
| Configuration Store | Versioned artefacts with `draft → in review → published → superseded`, one-step revert, effective dating | `config.*` | AD-4. Version-poll invalidation is the authority |
| Taxonomy Registry + migration engine | Registration of template and taxonomy versions and their artefacts, version-pair mappings, migration runs that preserve pre-migration state | `config` taxonomy tables | FR-65 … FR-70 |
| Localization | Locale registration, and per-key runtime fallback logging into a review queue for FR-61 content. Catalogue text resolves in the front ends from committed message files and never reaches this module (OQ-43) | `config` locale tables | FR-63, FR-64 |
| Notification Service | Stateful notifications with N delivery records; dedup, cancellation, per-recipient channel and language | notification + delivery records | AD-11 |
| Metering | Append-only event stream for every billable-shaped action, including actions not currently billed | `audit.metering_event` | FR-105, NFR-10 |
| Audit | System audit log, support-access log | `audit.system_audit_log`, `audit.support_access_log` | FR-79, FR-81, FR-151, FR-159 |
| Support access | Time-boxed, reasoned, ticket-referenced, auto-expiring grants to tenant content, fully logged | grant records | D-5, FR-77 … FR-79 |
| Admin | Platform-administration surface behind the separate admin realm | — | FR-75, FR-76, FR-80, FR-82, FR-83 |
| Outbox Dispatcher | Reads `audit.outbox_event`, dispatches with idempotency keys, is the **sole** queue producer | `audit.outbox_event`, `audit.inbound_event` | AD-6, AD-10 |
| Entitlement Service (interface) | The `contracts/` port every gated capability consults; null implementation grants everything | — | AD-5 |

### 6.7 Internal interfaces — the `contracts/` surface

`contracts/` is the **only** cross-context surface, and the CI rule over it is one line of configuration and one of the highest-leverage things in the build: `modules/core/**` may not import `modules/billing/**`, and vice versa; both may import `contracts/**`. Without it, DR-1 degrades within about three sprints, because the shortest path to "show the plan name on the report page" is always a direct import.

```
apps/api/src/
├─ contracts/                  # the ONLY cross-context surface
│   ├─ entitlement.port.ts     # EntitlementService interface (AD-5)
│   ├─ notification.port.ts
│   └─ events/                 # EntitlementChanged, SubscriptionLapsed,
│                              #   ConfigurationPublished, ReportCompleted
│
├─ modules/
│   ├─ core/                   # ← schema: core        (FR-13 … FR-55, FR-83)
│   │   ├─ organization/       #   FR-13 … FR-16
│   │   ├─ entity/             #   FR-17 … FR-20
│   │   ├─ period/             #   FR-21, FR-22, FR-23
│   │   ├─ disclosure/         #   FR-24 … FR-32   (AD-3)
│   │   ├─ calculator/         #   FR-33 … FR-36
│   │   ├─ validation/         #   FR-40 … FR-44
│   │   ├─ comparatives/       #   FR-45 … FR-47
│   │   ├─ export/             #   FR-48 … FR-53
│   │   └─ trace/              #   FR-54, FR-55
│   │
│   ├─ identity/               # ← schema: identity    (FR-1 … FR-12, FR-56 … FR-60)
│   │   ├─ account/  session/  provider/  membership/  invitation/
│   │
│   ├─ billing/                # ← schema: billing     (FR-84 … FR-152)
│   │   ├─ catalogue/          #   FR-84 … FR-89
│   │   ├─ subscription/       #   FR-90 … FR-98
│   │   ├─ entitlement/        #   FR-99 … FR-105  ← implements contracts/entitlement.port
│   │   ├─ account/            #   FR-106, FR-107
│   │   ├─ order/              #   FR-108 … FR-113  (saga, AD-6)
│   │   ├─ payment/            #   FR-114 … FR-120  (adapters, AD-8)
│   │   ├─ invoicing/          #   FR-121 … FR-130  (numbering, AD-7)
│   │   ├─ efactura/           #   FR-126, FR-127   (D-9)
│   │   ├─ reconciliation/     #   FR-131 … FR-134
│   │   ├─ collections/        #   FR-135 … FR-138
│   │   ├─ refunds/            #   FR-139 … FR-141
│   │   ├─ enterprise/         #   FR-142 … FR-147
│   │   └─ finreporting/       #   FR-148 … FR-152
│   │
│   └─ platform/               # ← schema: config, audit
│       ├─ configuration/      #   FR-61, FR-62, FR-71 … FR-74   (AD-4)
│       ├─ content/            #   FR-61 read side, UC-180, UC-181  (OQ-44)
│       ├─ taxonomy/           #   FR-65 … FR-70
│       ├─ localization/       #   FR-63, FR-64
│       ├─ notification/       #   FR-157, FR-160 … FR-173       (AD-11)
│       ├─ metering/           #   FR-105
│       ├─ audit/              #   FR-79, FR-81, FR-151, FR-159
│       ├─ support-access/     #   FR-77, FR-78, FR-79           (D-5)
│       └─ admin/              #   FR-75, FR-76, FR-80, FR-82, FR-83
│
└─ infrastructure/
    ├─ persistence/            # RLS session management, repositories, migrations
    ├─ outbox/                 # AD-6
    ├─ queue/                  # BullMQ producers
    └─ adapters/               # one directory per port (AD-8)
```

### 6.8 The public API surface

One versioned REST surface. OpenAPI 3.1 generated from source and diffed in CI. `web` and `admin` are ordinary clients — no privileged route exists. Base `/api/v1`; breaking changes only in a new version, after a stated deprecation window. Bearer access token; the active organization comes from the session, not from a header or a path segment. Errors are RFC 9457 problem+json, with *what failed / consequence / resolving action* in the detail.

**Success responses carry an envelope; errors do not. Decided 18 Aug 2026.** A successful
response is wrapped by a global interceptor in `ResultObjectDto<T>` (`htmlcode`, `object`,
`messages`) or `ResultListDto<T>` (`htmlcode`, `objects`, `total`, `totalpages`, `messages`),
matching the two sibling projects so one response shape spans all three codebases. Two
consequences follow and are recorded rather than left to be rediscovered. The siblings carry an
`error: boolean` and route failures through the same envelope; here they cannot, because errors
leave as problem+json — so the field is omitted rather than shipped permanently false. And
`messages` carries a `MessageType` of `SUCCESS` or `WARNING` only: `WARNING` is what conveys
AD-5's `allow_with_warning` to a caller who still got what they asked for. Each message carries a
stable `key` **and** its rendered `text`, never a literal sentence written at the call site.
**Clarified 19 Aug 2026 (OQ-46):** the earlier wording — "holds message keys resolved through
`platform/localization`" — read either as *the wire carries keys* or as *the values come from keys
rather than hardcoded sentences*. The second is what holds: the API resolves wording server-side
against the locale negotiated from `Accept-Language`, so `text` is what a caller displays and `key`
is the machine-readable discriminator it may branch on, never something it renders. Four bypasses exist: an explicit 204, `StreamableFile`/`Buffer` (FR-53
requires an export to be re-downloadable byte-for-byte, and an envelope would corrupt it), and
anything already wrapped.

**Pagination is the compact list format. Decided 18 Aug 2026** — the doc set had specified none.
`?filters=field,v1,v2|field2,v3&order=field,asc&page=1&onpage=25`, parsed by an opt-in
`ListQueryInterceptor` so routes that do not list cannot silently accept list parameters. It
carries filtering and sorting in the same parse, which is why it beats a bare `page`/`pageSize`
here. `onpage=-1` ("all rows") is honoured **only on routes explicitly marked bounded**; every
route over an append-only store — `audit.system_audit_log`, the billing ledger, metering events,
all retained for six years under §12.5.7 — clamps to `MAX_ON_PAGE` instead. Accepted cost:
OpenAPI describes a bespoke query encoding only as three strings, so the generated client types
them loosely. NFR-83's contract tests and NFR-16's route-coverage diff are unaffected — they
check routes, status codes and declared security, not query grammar.

**Time on the wire is an epoch-millisecond integer. Decided 18 Aug 2026.** Every instant — creation,
update, dispatch, transmission, token expiry, metering event — leaves the API as a UTC-based Unix
timestamp in milliseconds; no locale-formatted string reaches a DTO (NFR-26 puts formatting at
presentation). OpenAPI can only type it `integer`, so the field name must read as a time and its
`@ApiProperty` must state the unit — nothing else in the contract will.

**Corrected 19 Aug 2026 (OQ-50).** This paragraph originally read "in storage and in the DTO alike",
which reached past what this section owns: **storage is `timestamptz`** and always was, per §7.8 and
§7.9's conventions table. This section owns the wire contract; §7 owns the column. The two
representations meet in one place — the mapping between a persistence row and a DTO — which is where
clean architecture puts a representation change anyway.

This does **not** extend to a date carrying legal force, and the distinction is load-bearing rather
than stylistic. NFR-34 requires the originating timezone to be stored wherever a legal date is
determined, and an epoch instant cannot settle which fiscal year a document belongs to. Invoice and
credit-note dates, the fiscal year a number series rolls on (AD-7, DR-8), reporting period start, end
and due dates (FR-21), the BNM rate date (FR-129), and the effective dates on VAT rules, factor sets
and thresholds (AD-4) therefore stay calendar dates plus the timezone that determines them. The test:
*would a different timezone change the answer to a legal or regulatory question?* If yes, it is a date.
An invoice dated 31 December encoded as an instant lands in the wrong fiscal year, and FR-125 makes
that uncorrectable by editing — only by credit note.

| Area | Paths |
|---|---|
| Identity | `/auth/*`, `/me`, `/me/notifications`, `/me/preferences` |
| Organization | `/organizations/{id}`, `/members`, `/invitations` |
| Entities | `/entities`, `/entities/{id}/periods` |
| Reporting | `/reports/{id}`, `/reports/{id}/values`, `/validate`, `/preview` |
| Calculator | `/reports/{id}/calculations`, `/inputs` |
| Export | `POST /reports/{id}/exports` → 202 + job id; `/exports/{id}` |
| Billing | `/plans`, `/subscription`, `/orders`, `/invoices`, `/payment-methods` |
| Admin | `/admin/*` — content, taxonomy, factors, rules, plans, metrics, support-grants |

---

## 7. Domain and data model

### 7.1 Schema layout and the cross-context rule

Five schemas in one PostgreSQL 18 instance:

| Schema | Contents | Cross-schema FKs |
|---|---|---|
| `identity` | accounts, credentials, provider identities, sessions, memberships, invitations | to `core.organization` only (membership target) |
| `core` | organizations, entities, snapshots, periods, reports, disclosure values, calculator inputs/results, exports, field audit | none outward |
| `billing` | plans, subscriptions, orders, payments, invoices, credit notes, ledger, dunning, reconciliation, number series | **none** — organization is referenced by ID, unenforced, deliberately (NFR-15) |
| `config` | content, locales, taxonomy versions, mappings, factor sets, thresholds, rules, notification templates, plan data | none |
| `audit` | system audit log, support-access log, billing ledger, metering events, outbox, inbound events | none |

A sixth schema, `migration`, sits beside these and is deliberately not in the table above: it holds nothing but TypeORM's applied-migration ledger. **Added 19 Aug 2026, with task 9.** The five are domain storage and this is bookkeeping. Separating it does two things: no runtime role is granted `USAGE` on it, so the record of what has been applied is unreadable and unforgeable from the application tier by construction rather than by table grants someone has to remember not to write; and the table above stays literally true — the five schemas are the domain, and `public` still holds nothing but extensions. It is created by `infra/postgres/init/init.sh` rather than by the baseline migration, and that is forced rather than chosen: TypeORM's `MigrationExecutor` calls `createMigrationsTableIfNotExist()` before executing anything, and that path calls `createTable()` without ever calling `createSchema()` — so a ledger schema created by a migration could never be created at all. Same shape as the roles below, same resolution.

That `billing` holds **no foreign key** to `core.organization` is the physical expression of NFR-15. It costs referential integrity across the boundary, bought back by a nightly reconciliation job that reports orphaned billing records as an operational metric. This is the correct trade: an FK would make NFR-1's "disable billing entirely" test impossible to run, because the schema itself would not load.

### 7.2 The reporting core

```mermaid
erDiagram
    ORGANIZATION ||--o{ REPORTING_ENTITY : owns
    ORGANIZATION ||--o{ ORG_RELATIONSHIP : "typed: SME | Advisor | Buyer | Licensee"
    REPORTING_ENTITY ||--o{ ENTITY_SNAPSHOT : "point-in-time (FR-18)"
    REPORTING_ENTITY ||--o{ SITE : "geolocation, B1/B5"
    REPORTING_ENTITY ||--o{ CONSOLIDATION_MEMBER : "boundary (FR-19)"
    REPORTING_ENTITY ||--o{ REPORTING_PERIOD : has
    REPORTING_PERIOD ||--o| REPORTING_PERIOD : "prior period (FR-45)"
    REPORTING_PERIOD ||--o| REPORT : contains
    REPORT }o--|| TAXONOMY_VERSION : "pinned (FR-66, NFR-3)"
    REPORT ||--o{ DISCLOSURE_VALUE : "element-keyed (AD-3)"
    REPORT ||--o{ SECTION_DECLARATION : "not material + rationale (FR-31)"
    REPORT ||--o{ VALIDATION_FINDING : "per field (FR-40)"
    REPORT ||--o{ EXPORT_ARTIFACT : "immutable history (FR-53)"
    DISCLOSURE_VALUE ||--o{ FIELD_CHANGE : "who, when, prior value (FR-54)"
    REPORT ||--o{ CALC_RUN : "B3 source"
    CALC_RUN ||--o{ CALC_INPUT : "raw, retained permanently (FR-33)"
    CALC_RUN }o--|| FACTOR_SET_VERSION : "pinned (FR-35, NFR-19)"
    CALC_RUN ||--o{ CALC_RESULT : "→ B3 elements"
```

Four modelling points carry disproportionate weight.

**`ENTITY_SNAPSHOT`** exists because FR-18 requires entity master data to be retained point-in-time, so a report for a closed period keeps reflecting the values in force when it was prepared. Without a snapshot, an address correction in 2028 silently rewrites the 2026 report. The snapshot is taken at period open and referenced by **the period** — `core.reporting_period.entity_snapshot_id` — with the report reaching it through its period (§12.5.6's task-31.1 row, 29 Aug 2026). This sentence read *"referenced by the report"* until task 31.1 built the period that takes it: the determining event is period open, so the period is what the snapshot belongs to, and the literal reading left the row unreferenced across two tasks.

**`ORG_RELATIONSHIP` with a typed relationship** is present at MVP with only the direct-SME type active, because FR-14 and NFR-9 require Advisor, Buyer and Licensee types to be addable **without a schema migration** — NFR-9's verification is a fourth relationship type registered as data in staging, so the type is a `config` lookup, not a PostgreSQL enum. This is also Layer 3 of §5.1: the four relationship shapes the commercial model may need — direct SME, advisor managing N clients, buyer monitoring N suppliers, licensee white-labelling for M sub-orgs — are the same typed graph.

**Two typed axes, not one — decided 28 Aug 2026 (task 29.1, project owner).** FR-14 names two things that move at different rates, and merging them loses the property NFR-9 tests. The **kind** of edge — `parent`, `child`, `peer` — is the shape of a graph and does not move with the commercial model, so it is a `CHECK` mirrored by an `as const`, like every other closed vocabulary here. The **organization type** — `direct_sme` at MVP, Advisor, Buyer and Licensee later — is the roadmap axis NFR-9 is written about, so it is a configuration key validated against the registered vocabulary and never a constraint. As one merged column the two would share a release cadence, and registering `advisor` would either need DDL, defeating NFR-9, or leave `parent`/`child`/`peer` unconstrained, defeating the reason a fixed set is a constraint at all.

**No MVP flow writes a row into this table, and that is the state FR-14 describes rather than an omission.** Every MVP tenant is one direct SME holding no relationship to another organization; all four shapes §5.1's Layer 3 anticipates arrive with Phase 2/3 actors. The table is built now because §7.5's expand → migrate → contract would otherwise make it a migration against a live filing window, and because NFR-9's staging demonstration needs somewhere to insert the fourth type's edge. What is verifiable in CI is therefore narrower than it first appears, and the wording matters: **the vocabulary is read from the configuration store at request time, and that its answer moves when the registration moves is specified in both directions** — registered and unregistered. **No function admits a type against it, because nothing writes a relationship to admit.** The database's only guarantee on `organization_type` is a shape regex; the admission belongs with the first flow that creates an edge, and arrives with it. *(Corrected 28 Aug 2026: this paragraph previously claimed an admission function was specified, which overstated what shipped — the code has a reader of the vocabulary and no admitter.)* The demonstration stays what NFR-9 says it is: an operational rehearsal in staging.

**Legal form is a configuration vocabulary scoped by country — decided 28 Aug 2026 (task 29.1, project owner), against the recommendation on record.** FR-15 requires the organization's legal form and no document in the set enumerates the permitted values; `config/efrag/` is not started, so whether B1's taxonomy element carries an enumerated domain is not yet knowable. The declined alternative was free text with the vocabulary question deferred to task 33. Held as configuration it is kind `organization_legal_form` — seeded from `organization-legal-form.<country>.json`, since the loader turns filename dashes into underscores — with **scope = the ISO 3166-1 alpha-2 country code**, lower case, and a payload listing the codes — seeded at MVP for `md` with the forms Law 220/2007 and the Civil Code register: `srl`, `sa`, `snc`, `sc`, `ii`, `cp`, `ci`, `is`, `im`, `gt`.

The country scope is what keeps that vocabulary honest rather than clever. One global list would admit a Romanian *SRL* because Moldova happens to spell it the same way, and refuse a Romanian *PFA* with a message about Moldova — answering a question it was not asked. **Consequence, stated rather than discovered:** an organization whose country registers no vocabulary cannot be created at MVP, and the reversal is one configuration entry, with no code change and no redeploy. That is the property AD-4 exists to provide, so it is the right shape for the limit to take.

**What the consolidation boundary does to B1 and to everything downstream — stated 28 Aug 2026 (task 29.4), because the mechanism lands in three later tasks and the record has to precede all three.** FR-19 says the boundary "feeds B1 and bounds every quantitative figure in the report", which is two obligations with different owners:

- **B1 discloses it** (UC-19, task 36.2). The basis is a disclosure field, and where it is `consolidated` the subsidiaries inside the boundary are disclosed with it. Per **D-2** these values *pre-populate* from the entity record and stay editable in the report, because B1 is a disclosure rather than master data — so the entity is the default, never the authority, and a report may legitimately disclose a boundary that differs from the entity's current one.
- **Every quantitative disclosure is gathered against it** — B3's energy and emissions, B6's water, B8's headcount and FTE, and each of their siblings. `individual` means the undertaking alone; `consolidated` means the undertaking together with the listed subsidiaries. This is not a validation rule, it is what the numbers *mean*: the same figure is correct under one basis and wrong under the other, and nothing in the data distinguishes them.
- **Task 38's calculator aggregates over it.** Scope 1 and location-based Scope 2 are summed across the sites of whatever the boundary contains, so the boundary decides which `core.calc_input` rows belong to a run.

**Which basis a filed report reflects is settled by FR-18, not by the entity's current value.** The snapshot is taken at period open (§7.2 above), so a report for a closed period keeps the basis and the member list in force when it was prepared — an entity that consolidates from 2027 does not retroactively re-scope its 2026 filing. That is the whole reason the snapshot exists, and the consolidation boundary is the field where getting it wrong is most expensive: it would restate every quantitative figure at once.

**The one rule enforced at the record rather than deferred to task 40** is that `consolidated` with an empty boundary is refused. It is a structural contradiction rather than a completeness question — a consolidated basis names a boundary, an empty boundary names nothing, and every figure is gathered against it — so it is refused where the record is written. Whether a report may be *filed* with no basis at all is the ordinary completeness question, and that is FR-73's validation rule in task 40, where the IDNO's requiredness also lives.

**The activity classification is configuration, scoped by country — decided 28 Aug 2026 (task 29.3, project owner).** FR-17 requires NACE code(s) on a reporting entity, and Moldova's classifier is **CAEM Rev.2**, which the National Bureau of Statistics harmonises 1:1 with NACE Rev.2 to four characters — so a code recorded against an entity is the NACE code B1 exports. It is held as configuration under kind `nace_code`, scope = the country code, alongside legal forms and for the same reason.

**The list was sourced, not assembled**, which after task 29.2's IDNO work is the point rather than a detail. The project owner authorised downloading the Bureau's own `caem_rev2.zip`; both documents in it — Romanian and Russian, independently typeset — parse to **996 entries with identical code sets**, and the totals match NACE Rev.2 exactly at every level: 21 sections, 88 divisions, 272 groups, 615 classes. All 88 canonical divisions are present with none missing. That agreement between two documents and an external standard is what makes the seed trustworthy; a list from memory would have been the IDNO mistake with a thousand opportunities to make it.

**This seed carries names, and that is an apparent exception to OQ-43 rather than a real one.** OQ-43 keeps authored wording — labels, help, validation messages — in committed catalogues. A classifier's own published names are not authored here: they are an external authority's text, which is exactly the case NFR-24 already covers for EFRAG's taxonomy labels ("the official EFRAG translation wherever one is published"). The practical alternative confirms it — 996 codes × three locales is 2,988 catalogue entries that must never be machine-translated, for text the state already publishes in two of the three. **Romanian and Russian are seeded from the official documents; English is owed**, and arrives as a configuration revision with no redeploy, which is what AD-4 buys.

**Entity identifiers, decided 28 Aug 2026 (task 29.2, project owner).** Three answers, and the first is a limit on what could be built rather than a preference.

**The IDNO's structure is fixed by Annex 2 of Moldovan Government Decision 272/2002 — and that annex does not carry the check-digit algorithm.** The project owner supplied **two consolidated versions** of the instrument (published in *Monitorul Oficial* 40-42/2002 art. 376 — one as amended by HG 962 of 8 Aug 2016 carrying the full system Conception, one as amended by HG 955 of 28 Dec 2022), and both state the layout at point 5 in identical terms: thirteen digits, of which the first is the identification index, the second to fourth are the last three digits of the year the IDNO was assigned, the fifth to seventh the code of the registering authority, the eighth to twelfth the sequence number within that year and office, and **the thirteenth is the check digit**. What the text says about that digit is only that it exists. Neither contains a formula, weights or a modulus. The word *algoritm* does not occur in either, and every instance of *calcul* in the longer version is `reţele de calcul` — computer networks, nothing to do with the check digit.

That is worth recording rather than treating as a dead end. It **confirms the structure against a primary source** instead of the secondary summaries the shape was first taken from, so the structural validator rests on the instrument itself. And it **narrows the open question** from "where is the algorithm defined" to "which instrument defines it", since this one demonstrably does not — the widely repeated claim that HG 272/2002's Annex 2 carries the algorithm is wrong, and can now be set aside rather than re-checked. What remains to look at is a technical norm of the registering authority (ASP, formerly the Camera Înregistrării de Stat) rather than the government decision.

LEI has no such problem: ISO 17442 fixes the twenty-character shape and ISO 7064 MOD 97-10 the two check digits, both implementable from the standards, and both are implemented.

**A candidate algorithm was tested against twelve real IDNOs and refuted, along with its whole family** (28 Aug 2026). The candidate — weights `1,2,…,10,1,2` over the first twelve digits, modulo 11, with a shifted second pass on a remainder of 10 — reproduced **2 of 12** check digits, which is chance for a one-in-eleven guess. Ten of the twelve were supplied by the project owner from real registrations; two came from a public register listing and behaved identically, so the corpus is sound.

The refutation generalises past those particular weights, and that is the part worth keeping. Treating the check digit as a weighted sum modulo 11 over the first twelve digits gives twelve linear equations over GF(11); **that system is inconsistent**, with or without a constant term. No weight vector whatsoever satisfies it, so the entire family is excluded rather than one member of it. Luhn scored 2–4 of 12, Verhoeff and Damm 1, ISO 7064 MOD 11-10 zero.

**More IDNOs of the same kind will not help, and the sample says so precisely.** Across all twelve, four positions never vary — `d1` is always `1`, `d2` always `0`, `d5`/`d6` always `6`/`0` — so their weights are unidentifiable by construction, and the digit matrix has rank 9 of the 12 needed. What a further sample must supply is **variety in the year (`d2`–`d4`) and in the registering office (`d5`–`d7`)**: registrations from different years and different territorial offices, not more from Chișinău in the 2000s. Failing that, the algorithm is a technical norm of the registering authority, and reading it is cheaper than inferring it.

**So FR-16's checksum clause is satisfied for LEI and open for IDNO.** `validateIdno` reports `checkDigits: null` — *not evaluated*, which a caller must be able to tell from *failed* — and the shape is checked in full. Guessing a modulus would be worse than not checking: a wrong algorithm **rejects real IDNOs**, turning a validator meant to catch a filing-time error into one that stops correct registrations at the door. When the defining instrument is found, one function changes and every caller gains the check at once.

**No uniqueness constraint on `idno` at MVP.** A platform-wide unique index would be an **existence oracle** over the Moldovan company register crossed with our customer list: anyone could learn which companies use the platform by observing which IDNOs are refused, which is the enumeration surface NFR-64 exists to close, opened across the whole tenant population instead of one account at a time. It would also need a cross-tenant read that no RLS policy grants. And the premise is weaker than it looks — a group legitimately running two workspaces for one legal entity is indistinguishable, from here, from a double registration. Duplicates are therefore permitted and the question is operational, alongside T-2's billing reconciliation, rather than structural.

**`idno` is nullable and nothing in the profile requires it.** S-04 does not collect identifiers and S-15 does, so an organization exists before it has one. What makes it *required* is that B1 cannot be filed without it — which is a validation rule interpreted from configuration (FR-73, task 40), not a `NOT NULL` constraint here. That keeps the enforcement where every other B1 field's enforcement lives, and keeps the profile screen usable while half-complete.

**Wording follows OQ-43, not the data.** The payload carries codes; `organization.legalForm.srl` is a catalogue key resolved in the front end and shipped with the release. A form registered as data ahead of its label renders its key — the same consequence AD-3's taxonomy elements carry, accepted here for the same reason.

*(On `state` in the disclosure store being a database enum while relationship types must be config: the rule is whether the value set changes with the standard. Relationship types are a roadmap axis and must move without DDL. The disclosure states are fixed by the Digital Template's own validation vocabulary plus the two the design decisions add, and a new one would be a genuine change in the meaning of the record — worth a migration. If a future FR adds a state such as "pending third-party data", this choice should be revisited.)*

**`CALC_INPUT` retained permanently, `CALC_RUN` pinned to a factor-set version.** NFR-19 requires a stored calculation to reproduce exactly when re-run; a nightly replay of the whole report corpus is a release gate, and divergence blocks the release. This is the single strongest correctness guarantee in the system, costs almost nothing if the model is right from day one, and is nearly impossible to retrofit.

**`FIELD_CHANGE` is written from the same statement that makes the change** — `RETURNING old.*, new.*` on the upsert — so there is no window in which a value has moved and its audit row has not. It also **survives membership revocation**: FR-55 requires historical attribution to be retained after a user's access to the organization is removed, so the change row carries a denormalised actor display name alongside the user reference, and membership removal (FR-59) never cascades.

### 7.3 The disclosure store

Element keys are VSME XBRL taxonomy local names. No table per module.

**The three example keys this section used to carry were invented, and all three were wrong** — found
29 Aug 2026 by task 33.1, the first work to hold the published package rather than reason about it.
They are recorded because the two errors point in opposite directions and neither is a typo:

- `EnergyConsumptionFromRenewableSources` **does not exist**. The renewable split is a *dimension
  member* — `EnergyConsumptionFromFuels` taken along `BreakdownOfEnergyConsumptionAxis`, whose
  members are `RenewableEnergyMember` and `NonRenewableEnergyMember`. An element was assumed where
  the standard uses a dimension.
- `NumberOfEmployeesByGender` **does not exist either**. B8 states gender as *four separate
  elements* — `NumberOfFemaleEmployees`, `NumberOfMaleEmployees`, `NumberOfOtherGenderEmployees`,
  `NumberOfNonReportedGenderEmployees`. A dimension was assumed where the standard uses elements.
- `dimension_key`'s comment listed *gender* and *contract* as axes. Neither is one; permanent and
  temporary contracts are elements too. The real set is eight axes, five explicit and three typed.

The lesson is the one AD-3 rests on and is worth stating where the DDL is read: **the taxonomy's
shape is not inferable from the disclosure's prose.** Reading B3 as *"energy from renewable
sources"* and B8 as *"employees by gender"* is a correct reading of the standard's text and yields
the wrong model both times, in both directions. This is why the artefact is extracted from the
published package by a committed script and asserted, rather than transcribed.


```sql
CREATE TABLE core.report_disclosure_value (
  report_id            uuid    NOT NULL,
  element_key          text    NOT NULL,             -- e.g. EnergyConsumptionFromFuels
  dimension_key        text    NOT NULL DEFAULT '',  -- an axis member: energy, pollutant, waste,
                                                     -- country of employment, reporting scope
  ordinal              int     NOT NULL DEFAULT 0,   -- sites, subsidiaries, materials
  value_numeric        numeric,                      -- never float
  value_text           text,
  value_boolean        boolean,
  value_date           date,
  unit_code            text,                         -- MWh, tCO2e, m3, headcount, FTE
  state                core.disclosure_state NOT NULL,
  not_available_reason text,
  carried_forward      boolean NOT NULL DEFAULT false,
  organization_id      uuid    NOT NULL,
  PRIMARY KEY (report_id, element_key, dimension_key, ordinal),
  FOREIGN KEY (report_id, organization_id)
    REFERENCES core.report(id, organization_id)
);
```

`disclosure_state` = `ok | missing | inconsistency | error | invalid_url | not_available | not_material | nil_return`.

Three structural details are deliberate rather than incidental:

- `dimension_key` and `ordinal` are `NOT NULL` with `''` / `0` defaults so the key is a plain composite. PostgreSQL does not accept expressions in a `PRIMARY KEY` or `UNIQUE` *constraint*, and an expression unique index cannot be an FK target — which `FIELD_CHANGE` needs.
- The denormalised `organization_id` is **tied** to the report's, not merely copied: `report` carries `UNIQUE (id, organization_id)` and the composite FK above enforces the pair. Without this, a wrong `organization_id` hides a row from its own tenant or exposes it to another, and RLS will faithfully enforce whatever the column says. The index leads with `organization_id`, since every RLS-filtered scan predicates on it.
- `state` carries **nil return** (FR-30), **not available with reason** (FR-32, D-4) and **not material** (FR-31) as first-class values, distinct from an absent row. The reference reports reviewed in this project all disclose gaps explicitly rather than hiding them, and the data model has to be able to say "answered zero" and "deliberately unanswered, because X" in different ways.

### 7.4 The billing core

```mermaid
erDiagram
    PLAN ||--o{ PLAN_VERSION : "versioned (FR-87)"
    PLAN_VERSION ||--o{ PLAN_ENTITLEMENT : "declarative keys (FR-85)"
    PLAN_VERSION ||--o{ PLAN_PRICE : "per currency, per cycle (FR-86, D-14)"
    PLAN_VERSION ||--o{ DISCOUNT_CODE : "FR-89"
    SUBSCRIPTION }o--|| PLAN_VERSION : "exact version sold under"
    SUBSCRIPTION ||--o{ SUBSCRIPTION_OVERRIDE : "Enterprise additive (FR-145)"
    SUBSCRIPTION ||--o{ SUBSCRIPTION_CHANGE : "history (FR-98)"
    SUBSCRIPTION ||--o{ ORDER : "FR-108"
    ORDER ||--o| PAYMENT : "rail-routed (FR-114)"
    ORDER ||--o| PROFORMA : "transfer rail (FR-121)"
    ORDER ||--o| INVOICE : "on confirmed payment (FR-122)"
    INVOICE ||--o{ CREDIT_NOTE : "corrections only (D-10)"
    INVOICE ||--|| EFACTURA_TRANSMISSION : "ack stored (FR-126)"
    INVOICE }o--|| NUMBER_SERIES : "gapless (AD-7, NFR-55)"
    PAYMENT ||--o{ SETTLEMENT_MATCH : "reconciliation (FR-132)"
    INVOICE ||--o{ DUNNING_STEP : "FR-135"
    LEDGER_ENTRY }o--|| INVOICE : "append-only (FR-151, NFR-33)"
```

`ORDER` sits between subscription and invoice as its own aggregate with its own lifecycle, exactly as FR-108 requires, so an abandoned checkout leaves neither an orphaned subscription nor a consumed invoice number.

### 7.5 Versioning and effective-dating strategy

Three distinct mechanisms, applied to different things. Conflating them is the most likely modelling error in this area.

| Mechanism | Applies to | Semantics |
|---|---|---|
| **Version pinning** | `reporting_period` **and** `report` → taxonomy and template version; `calc_run` → factor-set version | The record names the exact version that produced it. Re-export and re-calculation resolve the pinned version, not the current one (NFR-3, NFR-19). **The period is where the version is *determined*** (FR-65, UC-56 step 3) and **the report is where FR-66 requires it *stored*** — so the report's pair is **copied from its period at creation, never resolved a second time**: re-asking the registry would answer differently if an adoption were registered in between, producing two disagreeing pins for one filing (§12.5.6's task-31.3 row, 31 Aug 2026). `TAXONOMY_REGISTRY.pinFor()` is the only resolver anywhere, and `esg_app` holds no `UPDATE` privilege on either report column |
| **Publish/supersede** | Help-centre articles, plan presentation copy, locale registrations, notification category behaviour | A pointer flip; the prior version becomes `superseded` and remains immutable. Revert is one action (NFR-85). Catalogue wording is not in this row — it ships with the release (OQ-43) |
| **Effective dating** | Factor sets, applicability thresholds, validation rules, plan prices, VAT rates, MIA ceilings | Validity is a `daterange`; exactly one version is in force for any given date, enforced at database level |

Published configuration versions are **immutable**. Effective-dating without immutability is not enough: an edited "published" factor set silently rewrites history, which NFR-87 forbids.

**Taxonomy version rollout is deliberately not a schema migration** — that is the whole point of AD-3. Registering a version writes configuration; authoring a version-pair mapping writes configuration; a migration run is a worker job over a selected set of reports that **preserves the pre-migration state rather than overwriting in place** (FR-69), so a bad mapping is reversible. Affected organizations are notified through AD-11 (FR-70, FR-166), not left to discover it at export time.

Schema migrations themselves follow **expand → migrate → contract**, because NFR-53 forbids any schema change that cannot be reversed while the prior version runs. Adding a column and backfilling is one release; removing the old one is a later release after the previous version is retired.

### 7.6 Multi-tenancy and the tenant isolation model

Every tenant table carries `organization_id uuid not null`. RLS `ENABLED` and `FORCED`.

```sql
CREATE POLICY tenant_isolation ON core.report
  USING (organization_id = current_setting('app.current_org', true)::uuid);
```

Per request, inside the transaction:

```sql
SELECT set_config('app.current_org',  $1, true);   -- from AuthGuard membership lookup
SELECT set_config('app.current_user', $2, true);   -- never from a JWT claim
```

| Role | RLS | Used by |
|---|---|---|
| `esg_app` | enforced | `api` request path |
| `esg_worker` | enforced — sets context from the job payload's organization | `worker` |
| `esg_admin_ro` | `BYPASSRLS`, read-only, every acquisition logged | cross-tenant rollups, **taxonomy** migration runs (§11.5), admin API |
| `esg_migrator` | n/a — see below | schema migration job only; not a superuser; credentials never available at runtime |

**The fourth role is named `esg_migrator` as of 19 Aug 2026 (task 9); the row previously read "migration owner" and named nothing, so nothing created it.** Two clarifications came with it. `esg_admin_ro`'s "migration runs" means §11.5's *taxonomy* migration runs — worker jobs over report data — and never schema migrations, which it is read-only and therefore incapable of. And its RLS column reads "n/a" for a reason that is a trap rather than an exemption: a table's **owner is exempt from its own RLS policies regardless of `rolbypassrls`**, so `esg_migrator` is created `NOBYPASSRLS` and AD-2's policies must additionally be written with `FORCE ROW LEVEL SECURITY`. Without `FORCE`, the exemption is invisible until a probe runs as the owner and passes.

TypeORM: all tenant queries run on the request's `QueryRunner`, resolved from `AsyncLocalStorage`. A `TenantRepository` base **throws** when no context is present.

**What is expensive to retrofit is the plumbing, not the policies.** The costly parts are `organization_id` on every tenant table, the `AsyncLocalStorage` wiring and the repository discipline; the `CREATE POLICY` statements are a migration. Policies are nonetheless enabled in **every** environment from the first sprint, because the entire value of RLS is that a missing tenant context breaks loudly and early rather than leaking quietly later.

**`identity.membership` needs a second SELECT policy, and the reason generalises. Decided 25 Aug 2026 (task 25.1).** The binding above is annotated *"from AuthGuard membership lookup"*, and that annotation contains a circularity this section had not stated: the lookup that produces `app.current_org` necessarily runs **before** `app.current_org` exists. A membership table scoped only to the bound organization would therefore answer that lookup with zero rows for every account, forever — and fail as *"this account belongs to no organization"* rather than as an error, which is the quiet-leak failure mode inverted. The membership table carries two permissive `SELECT` policies:

```sql
CREATE POLICY membership_tenant_select ON identity.membership   -- UC-59: this organization's members
  FOR SELECT USING (organization_id = <bound org>);
CREATE POLICY membership_self_select ON identity.membership     -- UC-16, and the bootstrap above
  FOR SELECT USING (account_id = <bound account>);
```

The second grants **read and nothing else** — `INSERT` and `UPDATE` stay scoped to `app.current_org` alone — so an account sees where it belongs from anywhere and can alter a membership only in the organization whose context it actually holds. The general rule this is the first instance of: *a table the tenant binding is derived from cannot be scoped solely by that binding*, and the escape is the second setting, which is already bound and already trusted to the same degree.

**The tenant root needs the mirror of that, and it is narrower than the obvious version. Decided 25 Aug 2026 (task 25.3).** Knowing *where* you belong is useless without knowing what those organizations are called: FR-12's switcher and S-05's membership list render names, and `core.organization` is readable only as the bound tenant — so a member of three organizations read three membership rows and zero names. The fix is a third policy, on the tenant root:

```sql
CREATE POLICY organization_directory_select ON core.organization
  FOR SELECT USING (
    <no organization bound>
    AND EXISTS (SELECT 1 FROM identity.membership m
                 WHERE m.organization_id = core.organization.id
                   AND m.account_id = <bound account> AND m.status = 'active'));
```

**The first conjunct is the decision.** Without it the tenant root would be readable beyond the active organization *on every request*, and §7.2's profile fields — IDNO, registered address, contact details — ride on that row; every later reader would then need an explicit `WHERE id = <active org>` to stay correct, which is the filtering-at-call-sites AD-2 rejects, on the one table where it matters most. Conditioned on the pre-tenant state, the policy is active exactly when `AuthGuard` and the switcher read, and inert for every request that has resolved a tenant. Measured rather than argued: without the conjunct, a request bound to Alpha by a member of Alpha and Beta sees **two** organizations.

**A `SECURITY DEFINER` function was the first answer and does not work here**, recorded so it is not retried. It runs as the function's owner; `esg_migrator` owns `core.organization`; and `FORCE ROW LEVEL SECURITY` subjects an owner to its own policies — so it returns nothing. Making it work needs a fifth cluster role holding `BYPASSRLS`, and `CREATE ROLE` is cluster-level, lives in `infra/postgres/init/init.sh` outside the migration ledger, and would amend the four-role table above.


### 7.7 Append-only enforcement at privilege level

NFR-33 requires append-only storage of audit and ledger records **enforced at database privilege level**, with the stated verification that attempted mutation fails at the store, not in application code.

```sql
-- the migration role owns these tables; the application roles get INSERT/SELECT only
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC, esg_app, esg_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON TABLES FROM esg_app, esg_worker;
GRANT INSERT, SELECT ON audit.ledger_entry, audit.system_audit_log,
                        audit.metering_event, audit.support_access_log
  TO esg_app, esg_worker;

-- defence in depth: UPDATE/DELETE is a row trigger, TRUNCATE is a separate
-- statement-level trigger — a BEFORE UPDATE OR DELETE trigger does NOT fire on TRUNCATE
CREATE TRIGGER no_mutate  BEFORE UPDATE OR DELETE ON audit.ledger_entry
  FOR EACH ROW       EXECUTE FUNCTION audit_immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON audit.ledger_entry
  FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();
```

**Two things partitioning changes, added 20 Aug 2026 (task 13) and verified against PostgreSQL 18
rather than assumed.** §15 requires "a partitioning plan gate for every append-only store", and
§12.5.7's 24-month retention on system audit and metering is only executable by `DETACH PARTITION`
+ `DROP TABLE`, since `DELETE` is denied — so these tables are partitioned, and partitioning
reopens two doors the design above closes:

- **A statement-level `TRUNCATE` trigger on a partitioned parent does not propagate to its
  partitions.** `TRUNCATE audit.system_audit_log_2026` succeeds where `TRUNCATE` on the parent is
  refused — precisely the hole the paragraph above calls the fastest way to lose a ledger, reopened
  by a storage decision. The row trigger *is* cloned onto partitions, so `UPDATE` and `DELETE` are
  covered either way.
- **RLS does not propagate either.** A partition reads `relrowsecurity = false`, and any role
  holding a direct grant on it sees every tenant's rows.

Both are closed by `audit.enforce_append_only(regclass)`, which seals each partition: its own
`TRUNCATE` trigger, and RLS `ENABLED` + `FORCED` with **no policy**, which denies direct access
outright while queries through the parent continue to use the parent's policies. The application is
granted on the parent only — a routed `INSERT` is privilege-checked against the parent — so a
partition is a storage detail the application can never name. The schema-invariant gate asserts all
of this per partition, because the next one is added by a task that will not be reading this
paragraph.

**And a fourth thing, about what is actually doing the work.** The three layers deny in order:
privilege first (`esg_app` holds `INSERT, SELECT` and nothing else), then RLS (no `UPDATE` or
`DELETE` policy exists, so even the owner matches zero rows and sees `UPDATE 0` rather than an
error), and only then the triggers. The triggers are therefore the last line rather than the first,
and become operative exactly in the case this section names — a `GRANT ALL` that should not have
happened. That is why the test suite lifts the first two layers inside a rolled-back transaction to
prove the trigger is live rather than merely present: a trigger that never fires is
indistinguishable from one that was never created.

Three things this deliberately does not leave implicit. The blanket `REVOKE ... FROM PUBLIC` and the `ALTER DEFAULT PRIVILEGES` line are the load-bearing statements, not the `GRANT`: revoking `UPDATE, DELETE` from a role that was only ever granted `INSERT, SELECT` is a no-op, and the realistic failure mode is an ORM bootstrap script having issued `GRANT ALL ON ALL TABLES IN SCHEMA audit`. `TRUNCATE` needs its own statement-level trigger — the one privilege a row trigger cannot defend, and the fastest way to lose a ledger. And NFR-33's "fails at the store" holds only under an assumption that must be written down: **the owning migration role is not a superuser, is used only by the migration job, and its credentials are never available to a runtime process or an operator's psql session** — an owner can `ALTER TABLE ... DISABLE TRIGGER` or simply drop it. `esg_admin_ro` is neither the owner nor a member of the owner role.

Corrections are superseding entries referencing the original (FR-151), which is also what D-10 requires of fiscal documents.

### 7.8 Precision, money and time

- **One representation per kind, not a choice.** Disclosure quantities are `numeric`; monetary amounts are **integer minor units** (bani). "`numeric` or minor units" would not be a rule a static-analysis gate could implement, and NFR-58's stated verification is exactly such a gate. Float is prohibited in both.
- **Rounding is applied once at presentation for disclosure quantities** (NFR-18), so screen, PDF and Excel renderings of the same figure carry the same rounded decimal value — verified by a golden-report cross-format comparison **after locale normalisation**, since RO renders `1.234,5` where EN renders `1,234.5`. The comparison is of values, not of bytes.
- **Money is the explicit exception: it is rounded at issuance and stored.** An invoice must foot — line nets plus VAT must equal the stated total to the bani, the e-Factura schema enforces line-to-total consistency, and the ledger must balance. Presentation-time rounding would let the PDF, the XML and the ledger each round independently from an unrounded value and legitimately differ by one minor unit, producing a rejected transmission of a document that, per D-10, cannot be corrected by editing. The rounding rule (half-up), the level (per line, then summed) and the VAT base are declared and stored with the document.
- Foreign-currency invoices store the BNM rate for the invoice date **on the invoice record** and compute the MDL equivalent once at issuance (D-14, FR-129, NFR-58).
- Timestamps are `timestamptz` in UTC at second precision or better, from an NTP-synchronised clock with drift alarmed above one second (NFR-34). Where a **legal date** is determined — invoice date, period end, deadline — the originating timezone is stored alongside, because "the invoice date" in a fiscal filing is a local-calendar fact, not an instant. **The wire representation differs and that is deliberate** (§6.8, OQ-50): an instant leaves the API as an epoch-millisecond integer and is converted at the persistence-to-DTO boundary. `timestamptz` is what keeps `date_trunc`, range partitioning of `metering_event` and the `audit` tables, and interval arithmetic available on the columns §12.5.7 retains for six years — and what makes those tables readable by an auditor querying them directly in 2032, when `1787097600000` would not be.

### 7.9 Data conventions

| Rule | Applies to |
|---|---|
| `uuidv7()` primary keys | all internal tables — **except** externally visible tokens (verification, password reset, invitation), which stay high-entropy random per NFR-64 |
| `numeric` | disclosure quantities; rounded once at presentation |
| Integer minor units (bani) | money; rounded at issuance, stored, half-up, per line then summed |
| `timestamptz`, UTC, ≥ second precision | every instant in storage; converted to an epoch-ms integer at the DTO boundary, never in the column (§6.8, OQ-50) |
| `date` + IANA timezone column, named `<field>` and `<field>_tz` | every legal date (NFR-34). The pairing is enforced by the schema-invariant gate, not by review |
| `daterange` + `PRIMARY KEY (..., validity WITHOUT OVERLAPS)` | the configuration **schedule** — the table holding what is in force. It cannot go on one that also keeps superseded versions, which necessarily overlap (AD-4, task 16) |
| `RETURNING old.*, new.*` | field-change capture (raw SQL, one function) |
| Append-only at privilege level | all `audit.*` tables; row trigger for UPDATE/DELETE, **statement** trigger for TRUNCATE |
| `synchronize: false`, hand-written SQL migrations | always |
| expand → migrate → contract | all schema change |

**On `uuidv7()` and tokens.** UUIDv7 encodes its creation timestamp, so it must not be used where a value is externally visible and unguessability is the point. This belongs in the code-review checklist, because `uuidv7()` becoming the house default is exactly how such a token quietly becomes predictable.

### 7.10 Key entity inventory

**`core`** — `organization`, `org_relationship` (typed, config-driven), `reporting_entity`, `entity_snapshot` (point-in-time, taken at period open), `site`, `consolidation_member`, `reporting_period` (pins template + taxonomy version, links prior period, holds due date), `report`, `report_disclosure_value`, `section_declaration`, `validation_finding`, `export_artifact`, `field_change`, `calc_run` (pins factor-set version), `calc_input` (raw, permanent), `calc_result`.

**`billing`** — `plan` → `plan_version` → `plan_entitlement` / `plan_price` / `discount_code`; `subscription` → `subscription_override` / `subscription_change`; `order`, `payment`, `proforma`, `invoice`, `credit_note`, `efactura_transmission`, `number_series`, `settlement_match`, `dunning_step`.

**`audit`** — `ledger_entry`, `system_audit_log`, `support_access_log`, `metering_event`, `outbox_event`, `inbound_event`.

---

## 8. Integration architecture

### 8.1 The anti-corruption-layer approach

All third parties sit behind a **port** declared in `contracts/`, with exactly one **adapter** per provider, registered in a provider registry read from configuration. No vendor type appears outside its adapter — NFR-11's stated verification is a dependency review per release, so this is checkable by static analysis. Activation or replacement of a provider is a configuration change plus an adapter, with the diff limited to those two (NFR-14, verified by activating an adapter in staging).

The port is where the external model is translated into the platform's own: an `invoice` is a platform-owned structured record that an adapter renders into national XML, not "a PDF that gets emailed"; an FX rate is a value captured onto the invoice at issuance, not a live lookup at read time; a taxonomy release is registered configuration, not a fetch.

### 8.2 External systems

| System | Direction | Purpose | Port |
|---|---|---|---|
| Google, Microsoft (OIDC) | out | Social sign-in, matched on subject identifier | `IdentityProviderPort` |
| maib / Victoriabank / MICB | out | Card acquiring, hosted page + tokenisation | `CardAcquiringPort` |
| MIA (National Bank) | out | Instant payment, offered only within the configured per-transaction ceiling (≈ 5,000 MDL) | `InstantPaymentPort` |
| Customer bank | in | Statement import for transfer reconciliation | `BankTransferPort` |
| e-Factura | out | National B2B e-invoicing XML, mandatory from 1 October 2026 | `EInvoicingPort` |
| BNM | out | Official FX rate by invoice date | `ExchangeRatePort` |
| Transactional email (EU) | out | Notification delivery, SPF/DKIM/DMARC aligned | `EmailPort` |
| EFRAG artefacts | offline | Digital Template + XBRL taxonomy, registered by `PA`, **never fetched at runtime** | — (configuration) |
| EFRAG open-source converter | out (Phase 2) | XBRL/iXBRL conversion, MIT-licensed, self-hosted | `DocumentConversionPort` |
| Object storage (EU, S3-compatible) | out | Exports, six-year fiscal archive | `ObjectStoragePort` |
| Merchant of record | out | Non-resident billing — **registered, inactive at MVP** | `MerchantOfRecordPort` |

### 8.3 What is stubbed, inactive or absent at MVP

| Integration | State at MVP | Why |
|---|---|---|
| `MerchantOfRecordPort` | Port registered, adapter **inactive** | D-8: activation must be configuration, not a build. Non-resident billing is Phase 2 |
| `DocumentConversionPort` | Port present, **no adapter wired** | XBRL/iXBRL export is Phase 2; the port exists so Phase 2 is additive. Self-hosting the converter would add an eighth Compose service |
| Peppol | **Anticipated, not built** | `EInvoicingPort` is shaped to accommodate it |
| Energy-provider and accounting ingestion | **Not built** | Phase 3. `CALC_INPUT` already accepts sourced values with provenance, so the seam is an ingestion adapter per provider behind a port |
| AI assistance / risk flagging | **Not built** | Phase 3. New port + adapter; the no-training-on-customer-data obligation (NFR-6) is a contractual gate on the adapter, not a code change |
| ESAP bridge, blockchain traceability | **Not built, no seam claimed** | No requirements written |
| Enterprise SSO (SAML / OIDC federation) | **Not built** | `IdentityProviderPort` is already provider-agnostic (D-6) |

### 8.4 Integration behaviour that is architectural, not per-adapter

- **Inbound events are de-duplicated at the edge**, keyed `(provider, provider_event_id)` with a unique constraint, before any handler runs (AD-6).
- **Outbound calls carry an idempotency key** generated in the originating transaction. Providers without idempotency support — e-Factura among them — require the adapter to declare a **recovery query**; for e-Factura, look up by invoice number before re-transmitting.
- **Provider unavailability is an operational exception with an owner, not a blocked user action.** An untransmitted invoice is a tracked exception (NFR-71); it never blocks checkout, and it is never marked delivered.
- **Per-adapter outage simulation** is part of the availability verification set (NFR-50).
- **e-Factura rejection is reconciled daily** (NFR-71) and cannot be repaired by editing the invoice — per D-10 the correction is a credit note. This is why XML encoding of user-entered narrative text is treated as a first-class injection concern (§9.7).

---

## 9. Cross-cutting concerns

### 9.1 Authentication and authorization

| Concern | Mechanism | Requirement |
|---|---|---|
| Email + password | Argon2id, per-user salt, pepper from secret manager | FR-1 |
| Password policy | ≥ 8 and ≤ 128 characters, requiring a lowercase letter, an uppercase letter, a digit and one further character. The ceiling is a cost bound on a deliberately expensive hash, not a rule about secrets (OQ-51, closed 20 Aug 2026) | FR-1, UX-108 |
| Social sign-in | OIDC to Google/Microsoft; matched on **subject identifier, not email** | FR-2, FR-4, D-6 |
| Provider registration | Config-driven; disabling stops new registrations, existing accounts keep other credentials | FR-82 |
| Verification, reset, invitation | Single-use, high-entropy, time-limited tokens; uniform responses regardless of account existence | FR-3, FR-6, FR-11, NFR-64 |
| Session | ≤ 15-min JWT carrying `session_id` only + server-side revocable refresh (AD-12) | FR-5 … FR-8 |
| Active organization | Session-scoped — `identity.session.active_organization_id`, resolved server-side per request, never from a claim or a path segment (§6.5, task 25.1) | FR-12 |
| Authorization | Server-side per request, role in active org + per-report rights. `RequiresRoleGuard` reads the role from the request context, which `AuthGuard`'s membership lookup wrote — so a role change binds on the member's next request rather than at their next sign-in (§6.2, task 25.2) | FR-158, NFR-62 |
| Tenant isolation | RLS (AD-2) | NFR-63 |
| Secrets at rest | AES-256-GCM under a 256-bit key HKDF-derived from `SECRET_ENCRYPTION_KEY`, ciphertext carrying the key version it was written under. Distinct from the rows above and deliberately so: a password hash is one-way and a session secret rotates at no cost to data, while a *recoverable* secret — today `identity.admin_account.totp_secret`, tomorrow the tenant's — must survive its own key's rotation. The storage TYPE refuses plaintext — `identity.encrypted_secret`, a domain over `text` — so the guarantee is the store's rather than the caller's (P-4). Task 27.1; §12.5.6's secrets-at-rest row is normative | NFR-61, NFR-69 |
| Tenant MFA | **Opt-in TOTP**, available to any user, recommended to Organization Administrators (amended — §17.1) | — |
| Admin surface | Separate host, IP allowlist, mandatory MFA, separate cookie scope and credential store | FR-75, NFR-65 |
| Support access to tenant content | Time-boxed, reasoned, ticket-referenced grant; auto-expiring; logged | D-5, FR-77 … FR-79, NFR-66 |
| Abuse | Rate limiting and lockout on all auth paths | FR-4, NFR-64 |

**Matching a provider identity on subject rather than email (FR-4)** is worth calling out because getting it wrong is a real account-takeover path: email addresses are reassignable, and a provider may assert an address the account holder no longer controls.

**WCAG 2.2's Accessible Authentication criterion constrains the login path** (§17.1), so AD-12 and D-6's social sign-in must be designed against it from the start rather than audited against it later.

### 9.2 Auditability and append-only ledgers

Four distinct audit surfaces, each with a different subject and a different retention driver:

| Surface | Records | Retention driver |
|---|---|---|
| `core.field_change` | Per-field who / when / previous value, written from the same statement as the change; survives membership revocation | FR-54, FR-55, NFR-7, NFR-35 |
| `audit.system_audit_log` | Every state-changing action attributed to an actor with a timestamp, across reporting, administration and billing | FR-159 |
| `audit.ledger_entry` | Billing ledger; corrections are superseding entries referencing the original | FR-151, NFR-33 |
| `audit.support_access_log` | Every support-access grant and every acquisition of the `BYPASSRLS` role | FR-79, NFR-66 |

All are append-only at **database privilege level** (§7.7), not by convention. Fiscal documents are additionally written to write-once object storage with a six-year retention lock, readable independently of the application and the database (NFR-36, NFR-72); the annual verification is a restore-and-read from cold storage.

### 9.3 Configurability without redeploy

AD-4 is the mechanism; this is what it buys, expressed as obligations the platform must be able to meet:

- A wording fix, a threshold change, a new factor set, a new validation rule, a new plan or a new notification template is published **within one working day of approval** and **reverted in one step** (NFR-85).
- A compatible template/taxonomy rollout needs **no deployment** (NFR-86).
- A fourth locale is content and configuration only — no code change, no schema change, no redeploy (NFR-25).
- A new gated capability is a new entitlement key; a new plan is new data. Neither touches the other's code (NFR-17).
- A fourth organization-relationship type is registered as data (NFR-9).
- An unsold pricing unit can be evaluated end to end without a code change (NFR-10), because metering already emits for actions not currently billed.

The staging environment is where each of these is rehearsed, and NFR-14, NFR-25, NFR-85 and NFR-86 all name staging rehearsal as their verification.

### 9.4 Localization

Three locales are live at MVP: **Romanian is the source**, with English and Russian each separately authored rather than machine-translated (NFR-23, as amended in §17.1).

- Where EFRAG publishes an official translation of a VSME label, that translation is used **verbatim** (NFR-24) and diffed against the official template on every version rollout — the platform must not invent its own wording for a standard's label.
- **This is unavailable for Russian.** EFRAG's Digital Template ships in EU languages only, so Russian VSME labels are platform-authored and carry no official standing. NFR-24 therefore applies to RO and EN; the Russian label set needs its own editorial sign-off, and an export intended for a bank or EU buyer should be produced in RO or EN.
- **Text divides by who is blocked waiting on a release** (OQ-43, closed 19 Aug 2026). Application chrome, VSME disclosure labels and help text, validation finding messages, units and notification template wording ship as **committed message catalogues** in the release — a developer editing a catalogue file is not waiting on anyone, and it is the faster path for them. Help-centre articles and plan presentation copy stay **versioned configuration** (FR-61, FR-62), because support and marketing cannot deploy. Every non-text configuration artefact is untouched by this line: rule definitions, thresholds, factor sets, effective dates, notification channels, lead times and repeat intervals remain data, which is what DR-3 and AD-4 are actually for.
- **Catalogue gaps are a build failure, not a runtime queue.** Every locale's catalogue is present at build time, so a key in the source catalogue and absent from another fails CI (FR-64). The runtime per-key fallback queue (FR-64, FR-10) remains for FR-61 content, where a translation genuinely is absent until authored.
- **VSME label catalogues are scoped by taxonomy version, not global.** DR-4 pins each report to a template and taxonomy version, so a report authored under one version must still render that version's labels years later. Catalogues therefore live in per-version directories and are append-only — the same shape `config/efrag/` already uses for the official template binaries. The directory is EFRAG's own release identifier, `YYYY-MM-DD` (OQ-45, closed 29 Aug 2026), which sorts chronologically as text.
- Dates, numbers, units and currency format come from the active locale, with hardcoded format patterns blocked by a CI static-analysis rule (NFR-26).
- Interface language, **export language** (FR-52) and **email language** (per recipient, FR-169) are selected independently.
- Russian's addition at MVP is itself the NFR-25 verification, replacing the planned staging rehearsal. NFR-4 imposes no architectural limit on locale count.

### 9.5 Notifications

AD-11 is the mechanism. Operationally: a notification is one stateful record with N delivery records, deduplicated on `(category, subject_ref, recipient_scope)`, cancelled when its condition clears. In-app delivery writes directly to the notification centre with no external dependency; email goes through `EmailPort` with language resolved per recipient. Delivery records — channel, dispatch timestamp, outcome, read state — are **compliance evidence**, not telemetry. Quality thresholds are NFR-106 … NFR-109 (§17.3).

### 9.6 Entitlement, metering and graceful reduction

One append-only event stream (`audit.metering_event`) carries `organization_id`, action type, quantity, timestamp and a stable event key. **Every billable-shaped action emits, including actions not currently billed** (FR-105) — which is what makes NFR-10 achievable and what makes future pricing models a pricing decision rather than an instrumentation project.

Three consumers read that one stream: organization usage counters (FR-105, surfaced per UC-66), quota evaluation in the entitlement service (FR-99), and the adoption dashboard (FR-83). Delivery is at-least-once with de-duplication on the event key, producing exact rather than approximate counters, continuously reconciled (NFR-57). It also feeds NFR-47's per-organization infrastructure cost attribution, which is how the free tier's viability gets measured rather than assumed.

**Entitlement reduction never deletes.** Per D-13, FR-103 and FR-104: content beyond a reduced entitlement goes read-only by a deterministic, published rule — most recently active retained — with the outcome shown to the customer **before** the change takes effect (NFR-80). Previously generated documents stay downloadable throughout, and full data export in an open format works irrespective of subscription state (NFR-31), rehearsed as an exit drill.

### 9.7 Output encoding and injection defence

NFR-70 has three distinct destinations and one shared source — user-entered narrative text — so all three live in **one output-encoding layer** with an injection corpus in the export regression suite:

| Destination | Threat | Neutralisation |
|---|---|---|
| Excel | A leading `=`, `+`, `-` or `@` turns the export into a formula-injection vector in the recipient's spreadsheet | Neutralise or escape the leading character |
| PDF and interface | Markup and script injection | Markup and script escaping |
| e-Factura XML | A malformed payload is rejected by the national platform and, per D-10, **cannot be corrected by editing the invoice** — only by a credit note | Proper XML encoding |

### 9.8 Validation as a cross-cutting mechanism

Validation is a **rule interpreter over registered rule definitions** (FR-73), not compiled logic, so that a rule change is a configuration publish (NFR-85). Rules are typed:

- **presence** — is a required element answered, given applicability
- **applicability** — the ≥50-employee turnover threshold, the ≥150-employee gender pay gap threshold, site-driven biodiversity relevance, sector-driven water relevance (FR-28), each evaluated **dynamically from B1 inputs** so fields are shown or hidden rather than presented and later rejected
- **consistency** — the taxonomy's calculation linkbase, reused directly: headcount by gender and contract must total headcount; waste fractions must total waste; GHG rollups must reconcile
- **range / format** — units, non-negativity, URL validity
- **cross-period** — year-over-year movement flags surfacing beside the prior-period value at the point of entry (FR-46)

Every finding carries the field, the rule, its plain-language explanation and a deep link (FR-42, NFR-78, NFR-79). Validation is idempotent at any completeness level (FR-43), which makes it a drafting tool rather than only a pre-export gate. State rolls up per module and per report, **discounting sections declared not material** so a legitimate exclusion does not depress the completion figure (FR-41). Export with unresolved findings is permitted after explicit warning, with gaps marked visibly in the output rather than silently omitted (FR-44). Target: p95 ≤ 2 s for a fully populated Basic Module report (NFR-39), benchmarked against a maximum-population fixture.

`packages/validation` is shared between `api` and `web`: the wizard shows validation inline as the user types (FR-40) and the server re-validates authoritatively. One rule interpreter, two execution sites, no drift.

**The package also holds the password policy (added 20 Aug 2026, task 20).** OQ-51 closed the policy's values in task 19 and its implementation landed in `apps/api`'s identity domain; task 20 then needed the same check client-side — S-02 requires the policy enforced at the point of entry — and `apps/web` may not import `apps/api/src` (DR-11's boundary rule). The shared home was chosen over the two alternatives on structural grounds: duplicating the check in `web` is a second source of truth of exactly the kind this section exists to prevent, and `@easyesg/contracts` cannot hold it because `apps/api` must never import the package it produces. This does not widen the package into a general utility bin: the charter is *validation logic evaluated identically in both runtimes*, the rule interpreter is its main occupant, and the password policy is the first, smaller instance of the same property. `apps/api`'s domain module re-exports from the package so the API remains authoritative and no call site moved.

### 9.9 Carbon calculation

Raw energy and fuel inputs are stored permanently by source and site in invoice units, converted to MWh, and a factor set is applied; results are written to B3 elements. Every `calc_run` pins the factor-set version. A nightly replay of the whole report corpus is a release gate, and divergence blocks the release. Computed values may be overridden with attribution, and the superseded value is retained. Target: p95 ≤ 1 s.

### 9.10 Observability and operations

- **Correlation identifier** propagated across order → payment → fiscal document → e-Factura transmission → entitlement change (NFR-90), with weekly sampled trace-completeness checks. This is what makes a customer's "I paid and nothing happened" answerable in one query.
- **Structured logs, no personal data** — pseudonymous identifiers in logs, error traces, metering events and analytics, with a log-scanning gate in CI and sampled scanning in production (NFR-30).
- **Alerts** for unreconciled settlements beyond tolerance, e-Factura rejections, dunning backlog, metering-event lag, migration-run failures and locale-fallback spikes (NFR-91) — each exercised at least annually, because an untested alert is a decoration.
- **Scheduled-job heartbeats with absence alerting** for dunning, trial and invitation expiry, reconciliation import, backup and taxonomy migration (NFR-93). Absence alerting matters more than failure alerting: a job that stops running silently is the failure mode that actually happens.
- **SLI collection** for NFR-37 … NFR-42 and NFR-48 against a monthly-reviewed error budget (NFR-92).
- Stack: OpenTelemetry SDK in `api` and `worker` → self-hosted Prometheus + Loki + Grafana on VM-3, which keeps NFR-27's EU data-residency assertion trivially true and adds no sub-processor.

---

## 10. Deployment and infrastructure architecture

### 10.1 Hosting and residency constraints

All compute and all stores are in the **same EU region**, with backups replicated to EU object storage (NFR-27). The platform is operated as a privately owned, EU/EEA-hosted service acting as controller or processor directly with each customer under standard EU data-protection rules; residency is asserted for the primary store, replicas, backups, exports and logs. NFR-5 and NFR-27 stand unamended. Self-hosted observability and self-hosted PostgreSQL are chosen partly for this reason — each avoids adding a sub-processor.

Packaging and deployment are **Docker and Docker Compose** on self-managed VMs. Named candidate regions in the sources are illustrative (e.g. Hetzner Falkenstein, OVH Gravelines) rather than a committed provider.

### 10.2 Runtime topology — end state

```mermaid
graph TB
    subgraph internet["Internet"]
        U["SME users<br/>RO / EN / RU"]
        ADMU["Platform staff"]
    end

    CDN["CDN / DNS<br/>TLS termination optional"]

    subgraph vps1["<b>VM-1 — application</b> (EU region)"]
        EDGE["edge — Caddy 2.11<br/>TLS, HSTS, rate limit,<br/>IP allowlist for admin.*"]
        WEBC["web × 2"]
        ADMC["admin (static)"]
        APIC["api × 2–4<br/><i>scaled for filing window</i>"]
        WKC["worker × 1–3"]
        RENC["renderer × 1–2"]
        REDC["redis 8.10"]
        PGB["pgbouncer<br/>transaction pooling"]
    end

    subgraph vps2["<b>VM-2 — data</b>"]
        PGP[("postgres primary<br/>PG 18.x")]
        BKP["pgBackRest<br/>WAL archiving"]
    end

    subgraph vps3["<b>VM-3 — standby + observability</b>"]
        PGS[("postgres<br/>streaming replica")]
        OBS["Prometheus · Loki ·<br/>Grafana"]
    end

    OBJS[("Object storage — EU<br/>S3-compatible,<br/>versioned + object lock")]

    U --> CDN --> EDGE
    ADMU -->|"allowlisted IPs"| EDGE
    EDGE --> WEBC
    EDGE --> ADMC
    EDGE --> APIC
    WEBC --> APIC
    APIC --> PGB --> PGP
    WKC --> PGB
    APIC --> REDC
    WKC --> REDC
    WKC --> RENC
    WKC --> OBJS
    APIC --> OBJS
    PGP -->|"streaming"| PGS
    PGP --> BKP --> OBJS
    APIC -.-> OBS
    WKC -.-> OBS
```

**Three VMs, not one.** A single-VM Compose stack cannot meet NFR-51, because the database and the application share a failure domain. Separating data onto VM-2 with a streaming replica on VM-3 makes recovery a promotion rather than a restore. Three specifics that the diagram alone would leave misleading:

- **Asynchronous streaming replication cannot deliver RPO = 0.** By default a commit is acknowledged before the WAL reaches the standby, so losing VM-2 loses the replication-lag window — and NFR-51 asks for zero on exactly the records where one lost commit is a fiscal-numbering gap. The answer is **scoped synchronous commit**: `synchronous_standby_names` names the VM-3 standby, and the invoice, payment and ledger transactions run `SET LOCAL synchronous_commit = on` while the rest of the workload stays asynchronous. The consequence must be accepted explicitly: if the sole synchronous standby is down, those transactions block — mitigated by a quorum (`ANY 1 (...)`) or a documented degradation procedure.
- **PgBouncer runs on VM-1 with the application, not on VM-2.** Co-locating the connection router with the primary means it fails with the primary, and every client must be reconfigured before promotion counts as recovery.
- **Failover is a manual runbook unless something automates it.** No Patroni, repmgr or VIP/DNS switch is specified. That is acceptable against RTO ≤ 4 h but must be stated rather than implied by the phrase "streaming replica".

### 10.3 The topology is a schedule, not a prerequisite

Nothing requires the end state on day one, and of everything in this document it is the **easiest** thing to defer, because it is the only structural decision that is fully reversible: moving PostgreSQL to its own host is a connection string and a restore, with no application code change.

Two things are worth separating before choosing a start point. **Capacity is not the driver** — the scale envelope fits comfortably on one modest machine. And **the third VM buys durability, not uptime**: `edge`, `redis` and VM-1 remain single points of failure regardless, so anyone justifying the third machine on availability grounds is justifying it wrongly.

| Stage | Trigger | Topology | What it satisfies |
|---|---|---|---|
| **Build and pilot** — free tier, invited cohort | — | **1 VM.** Everything in one Compose stack, PostgreSQL included. Nightly base backup plus WAL archiving to EU object storage | RPO in minutes, RTO "restore from backup" — adequate while no fiscal document, payment or invoice exists, which are the records NFR-51 singles out |
| **Public launch** — open registration | Public launch | **2 VMs.** PostgreSQL on its own host | The application VM can be rebuilt, redeployed or lost without touching data. The step that buys the most per unit of effort |
| **Commercial** | First paid invoice, or first filing window | **3 VMs.** Add the streaming standby, scoped `synchronous_commit` on fiscal transactions, PgBouncer on the app host | NFR-51 in full, including RPO = 0 where it now has actual subjects |

The one thing not to defer alongside the machines is the **restore rehearsal**. NFR-52 is verified by rehearsal rather than by test, and a backup nobody has restored is a hypothesis. Run it at the single-VM stage, when it is a ten-minute exercise.

### 10.4 Compose services

```yaml
# docker-compose.yml (structure; values via .env, secrets via file mounts)
services:
  edge:      # Caddy — TLS, HSTS, rate limiting, admin IP allowlist, dynamic upstreams
  web:       # Next.js, standalone output          [replicas 2, no host ports]
  admin:     # static Vite bundle served by edge
  api:       # NestJS HTTP mode                    [replicas 2–4, no host ports]
  worker:    # same image, MODE=worker             [replicas 1–3]
  renderer:  # Chromium (tagged PDF) + qpdf/pikepdf + veraPDF  [memory-limited, restart policy]
  redis:     # queues, rate limits, ephemeral cache
  # postgres — see the note below: in the base file, not in docker-compose.prod.yml
```

**Clarified 19 August 2026**, with the Compose scaffold. The comment above described the
**production** file, and read as though `postgres` were absent everywhere. It is not.
`infra/compose/docker-compose.yml` is the base file and carries `postgres`, because §10.3's
build-and-pilot stage is one VM with PostgreSQL in the stack and §12.5.10 makes that same file the
local development environment — a base file without `postgres` would mean no developer and no CI
job has a database. It is `docker-compose.prod.yml` that drops the service at the launch stage,
when the primary moves to VM-2 and the application connects to it across the private network.
`redis` stays in every file: it is on VM-1 in the end-state topology (§10.2).

The base file as scaffolded holds `postgres` and `redis` only. **Three Dockerfiles now exist
(20 Aug 2026, task 18)** — `apps/{api,web,admin}/Dockerfile`, each built with the repository root as
context because a pnpm workspace install needs the lockfile and every workspace package. `renderer`
arrives with task 44, where Chromium and veraPDF have a pipeline to serve; the Compose services
themselves still wait for the deploy work of task 72.

**`pnpm deploy` is deliberately not used, and CLAUDE.md's Docker guidance is amended with the
reason.** Both of its paths are wrong for this workspace on pnpm 11: `--legacy` (which pnpm 11
requires, otherwise refusing with `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`) ignores the shared
lockfile and re-resolves the whole graph — observed resolving 475 packages with 0 reused before
dying on `JavaScript heap out of memory` — and the non-legacy path needs
`inject-workspace-packages: true`, which copies workspace packages instead of linking them and would
make a rebuild of `packages/i18n` invisible to `apps/api` until a reinstall. What replaces it is
`pnpm install --frozen-lockfile --prod --filter <app>...`, which resolves nothing, followed by
copying the three directories pnpm's **relative** links span: the root `node_modules`, the workspace
package, and the app. The rule CLAUDE.md states still holds and is the reason this works — an app's
`node_modules` copied alone yields dangling links.

### 10.5 Environments

| Environment | Purpose | Data | Gates |
|---|---|---|---|
| `local` | Full Compose stack + seeded fixtures | Synthetic only | — |
| `ci` | Ephemeral stack per pipeline | Synthetic | Migrations, RLS cross-tenant probe, module boundaries, contract tests, coverage floors, accessibility, injection corpus, cross-browser, `BILLING_ENABLED=false` suite |
| `staging` | Production-shaped; the rehearsal environment NFR-14, NFR-25, NFR-85 and NFR-86 all name as their verification | **Anonymised** (NFR-32) | Adapter activation, locale addition, config publish/revert, taxonomy rollout |
| `production` | — | Live | — |

NFR-32 prohibits production customer data in non-production environments. The anonymisation job is part of the platform, not a manual script, because a manual script is what gets skipped.

### 10.6 Release, rollback and the filing window

- **Zero-downtime, reversible deployment** (NFR-53) needs a mechanism Compose does not have. `deploy.replicas` is honoured by Compose v2, but `deploy.update_config` — the key that defines health-gated, one-at-a-time replacement — is **Swarm-only and ignored by `docker compose up`**, whose recreate strategy is stop-then-start with no drain and no rollback primitive. The mechanism is therefore **blue/green**: two Compose project instances behind `edge`, health-check the new one, switch the Caddy upstream, retire the old. Caddy must be configured with dynamic upstreams or an explicit upstream list, or it resolves the Docker DNS name once at config load and pins a single container — making the filing-window scale-up have no effect on traffic distribution. A service fronted by `edge` must also publish no host `ports:` mapping, or replicas collide on the port. Schema changes follow expand → migrate → contract, with a rollback drill per release train.
- **Filing-window posture.** The window is **April–May, peaking in the final two weeks of May** (§17.2). Ahead of it: scale `api` and `worker` replicas, run the 10× load test and a 24-hour soak at 3× (NFR-44), and impose a change freeze. NFR-48 permits **no** announced maintenance inside the window.
- **Backup and DR.** Continuous WAL archiving to EU object storage with object lock; nightly base backup; **quarterly full restore rehearsal measured against both RPO and RTO** (NFR-52). Fiscal documents are additionally written to write-once object storage with a six-year retention lock, readable independently of the application and the database (NFR-36, NFR-72).
- **Secrets** in a managed secret manager, or SOPS-encrypted files with age keys for a Compose deployment, scoped per environment and access-logged, with CI secret scanning on source and on the image registry (NFR-69).

### 10.7 Repository layout

A single pnpm workspace monorepo. One repository, because the OpenAPI contract, the shared types and the boundary rules are only cheaply enforceable inside one.

```
easyesg/
├─ apps/
│  ├─ api/                 # NestJS — HTTP and worker modes (AD-1)
│  ├─ web/                 # Next.js tenant application
│  └─ admin/               # React + Vite platform console
├─ packages/
│  ├─ contracts/           # OpenAPI-generated client + shared DTOs + event schemas
│  ├─ vsme/                # taxonomy model, element registry, typed facade generator (AD-3)
│  ├─ validation/          # rule interpreter — shared by api and web for inline checks
│  ├─ ui/                  # design system: wizard primitives, WCAG 2.2 AA components (SCSS)
│  ├─ xlsx-patch/          # byte-preserving named-range writer for the EFRAG template
│  └─ i18n/                # locale registry, message loading, fallback reporting
├─ config/
│  ├─ seed/                # initial taxonomy version, factor sets, rules, plans, templates
│  └─ efrag/<version>/     # official Digital Template binaries, per version (OQ-45:
│                          #   the version is EFRAG's own release id, `YYYY-MM-DD`)
├─ design/                # visual identity layer, delivered 18 Aug 2026 (design_spec.md §11)
│  ├─ (tokens.css)         # MOVED to packages/ui/src/styles/tokens.css, 18 Aug 2026
│  ├─ screens/             # 14 hi-fi prototypes; reference, never copied as markup
│  ├─ HANDOFF.md           # as-delivered record, superseded by design_spec.md §11
│  └─ IMPLEMENTATION_PLAN.md  # UI phase sequencing against §15.4
├─ infra/
│  ├─ compose/             # docker-compose.{yml,staging.yml,prod.yml}
│  ├─ caddy/
│  ├─ postgres/            # roles, RLS policies, grants, pgBackRest config
│  ├─ ansible/            # host state: users, SSH, Docker, PgBouncer, pgBackRest (§12.5.5)
│  ├─ tofu/               # VMs, firewalls, DNS, buckets — added with the DR runbook (§12.5.5)
│  └─ ci/
└─ docs/
   ├─ architecture.md      # this document
   └─ runbooks/            # DR restore, taxonomy migration, e-Factura outage,
                           #   reconciliation exception, support-access grant
```

**Amended 18 Aug 2026, with the `apps/web` scaffold.** Three notes on the tree above:

- **`design/tokens.css` is gone from `design/`.** It now lives at `packages/ui/src/styles/tokens.css`,
  moved rather than copied per §15.4, and `git` records it as a rename so the provenance survives.
- **`packages/i18n` no longer owns formatting.** next-intl's global `formats`, declared once in
  `apps/web/src/i18n/formats.ts` and reached by name through `useFormatter`/`getFormatter`, owns it —
  and a second formatting layer beside it is exactly the drift the package exists to prevent. What
  remains here is the locale registry, the message-loader port, the fallback-reporting channel
  (FR-64, UX-97) and the +40 % string-expansion harness.
- **`apps/web`'s internal structure is documented in `apps/web/CLAUDE.md`**, not here — the same
  split as `apps/api`, whose module tree sits in §6.7 rather than in this section. The load-bearing
  shape is four route groups: `(public)` (the only zone where `"use cache"` is legal), `(identity)`,
  and `(app)/(workspace)` and `(app)/(wizard)` as **siblings**, because UX-5 has the wizard suppress
  the workspace tier rather than nest inside it.

**Runbooks are a deliverable, not an afterthought**, because six NFRs are verified by *rehearsal* rather than by test — NFR-28/29 (data-subject requests), NFR-31 (exit), NFR-51/52 (restore), NFR-85 (publish-and-revert), NFR-86 (version rollout), NFR-93 (job failure).

### 10.8 Public URL structure and locale prefixes

**Decided 21 Aug 2026 (product owner), on SEO grounds.** The tenant application serves the **source
locale unprefixed** and prefixes the other two: `/`, `/register`, `/reports/:id` are Romanian;
`/en/register` and `/ru/register` are the English and Russian variants. A request carrying a
superfluous `ro` prefix — `/ro/register` — is `307`-redirected onto the canonical unprefixed
address, so one page never has two live addresses. This is `localePrefix: 'as-needed'` in
`apps/web/src/i18n/routing.ts`, replacing next-intl's `'always'` default, which the scaffold had
adopted deliberately and which is now amended rather than silently flipped.

**What the change buys is the root URL, not a ranking rule.** Google supports either scheme when
`hreflang` is declared, so this is not a conformance question. It is that `/` is the most linked,
most typed and most crawled address in the product, and under `'always'` every hit on it — every
crawl, every card, every typed visit — paid a redirect hop before rendering anything. Romanian is
the source locale (NFR-23) and Moldova the only market at MVP, so the unprefixed address and the
primary audience are the same set of pages.

The alternates are emitted by next-intl's `alternateLinks` as a **`Link` response header** rather
than as `<link>` tags in the markup — a form Google reads for `hreflang`, and worth stating because
grepping the HTML for `rel="alternate"` finds nothing and proves nothing. The set includes
`x-default`, pointing at the unprefixed source locale.

**Language is in the URL; tenancy never is, and the two must not be reasoned about together.** UX-2
forbids the active organization from appearing in a path segment because a second source of tenancy
turns an org-switch race into a cross-tenant read (AD-2). Language carries no such property, and
UX-4 requires every addressable state to have a shareable address.

**One consequence is a security property and is recorded here because it cost a real defect.** Under
`'always'`, `apps/web/src/proxy.ts` could read the locale as path segment 1 and the route as
segment 2. Unprefixed, `/home` has no segment 2 — the auth boundary read that as "no route segment,
therefore the marketing home" and returned *public*. Every authenticated Romanian route would have
been reachable with no session, failing open on the one branch no test covered, because every test
URL at the time was prefixed. The boundary now resolves the first **non-locale** segment and the
allowlist stays default-closed; `e2e/web/routing.spec.ts` is the regression guard, and it asserts
the closed default for an unknown segment as well as for the known authenticated ones.

Interacts with **OQ-31** (which host serves the tenant application, and whether the public marketing
site shares it): that question is still open, and if a host split is confirmed the marketing home
moves off `/` and `/home` takes it. This section fixes the *locale* half of the address; OQ-31 owns
the *host* half.

---

## 11. Key runtime flows

Only flows evidenced in the sources are given here.

### 11.1 Report authoring — autosave under three colliding requirements

```mermaid
sequenceDiagram
    autonumber
    actor RC as Reporting Contributor
    participant W as web (Next.js)
    participant Q as IndexedDB queue
    participant A as api
    participant P as postgres

    RC->>W: enters value, blurs field
    W->>W: optimistic update, mark field "queued"
    W->>Q: enqueue change (survives tab close)
    W->>A: PATCH /reports/:id/values (batched, debounced)
    A->>P: BEGIN, set transaction-local app.current_org
    A->>P: upsert disclosure_value + insert field_change
    A->>A: re-run affected validation rules (in-request)
    A->>P: COMMIT
    A-->>W: 200 + updated per-field validation state (FR-40)
    W->>Q: dequeue
    W->>W: mark field "synced"  [p95 ≤ 250 ms — NFR-38]

    Note over W,Q: offline → banner stays,<br/>queue retries with backoff (FR-38)
```

The acknowledgement lands **after** commit, never optimistically — that is the whole content of NFR-56, verified by kill-during-write fault injection across the autosave path.

**Validation runs inside the same request and ships in the same response.** The alternative — computing validation asynchronously and pushing the result — would require an SSE or WebSocket transport, which exists nowhere in the container view, the Compose services or the `edge` configuration, and which brings replica-affinity consequences with it. Since NFR-39's budget is p95 ≤ 2 s for a *full* report and only the rules touching the changed fields re-run here, the incremental cost fits inside NFR-38's 250 ms. If profiling later shows it does not, adding a push transport is a deliberate change to §5.4 and §10.4, not an implementation detail.

### 11.2 Order → payment → invoice → e-Factura → entitlement

```mermaid
sequenceDiagram
    autonumber
    actor OA as Org Administrator
    participant W as web
    participant A as api (billing)
    participant ENT as Entitlement Service
    participant ACQ as Acquirer (hosted page)
    participant O as Outbox
    participant WK as worker
    participant EF as e-Factura

    OA->>W: choose plan
    W->>A: POST /orders  (plan version, cycle, currency)
    A->>A: price, VAT by residency + VAT status (FR-124)
    A->>A: rail availability by total (MIA ceiling — FR-118, D-8)
    A-->>W: order summary + available rails, exclusions stated (FR-110)
    OA->>W: accept terms, choose card
    W->>A: POST /orders/:id/confirm  (terms version recorded — FR-111)
    A->>ACQ: create hosted payment session
    W->>ACQ: redirect (no card data touches platform — NFR-60)
    ACQ-->>OA: 3-D Secure challenge

    par server-to-server callback (authoritative)
        ACQ-->>A: callback (de-duplicated on provider_event_id — NFR-54)
        A->>A: saga: awaiting_payment → paid
        A->>A: allocate number, FOR UPDATE on series (AD-7)
        A->>A: issue invoice (immutable — D-10)
        A->>O: outbox: e-Factura, invoice email, EntitlementChanged
        A->>ENT: entitlements updated (only now — FR-92)
        A-->>ACQ: 200
    and browser return (may arrive FIRST)
        OA->>W: return URL
        W->>A: GET /orders/:id
        A-->>W: pending → poll, show "confirming payment"
    end

    W->>A: GET /orders/:id (poll)
    A-->>W: provisioned
    WK->>O: dispatch
    WK->>EF: transmit national XML
    EF-->>WK: acknowledgement + identifier (stored — FR-126)
    Note over WK: rejection → tracked exception with owner,<br/>never marked delivered (FR-127, NFR-71)
```

**The browser return and the acquirer callback are separate events, and the return very often arrives first.** Collapsing them — drawing the user's "provisioned" screen as a synchronous consequence of the webhook — is the most common checkout bug on hosted-payment-page rails. The rule this design encodes: **order state is authoritative from the callback only**; the return URL triggers a poll and nothing else, and a return-before-callback shows "confirming payment" rather than failing the order.

### 11.3 Export generation

```mermaid
sequenceDiagram
    autonumber
    actor RC as Contributor
    participant A as api
    participant ENT as Entitlement
    participant Q as BullMQ
    participant WK as worker
    participant CH as renderer
    participant S3 as object storage
    participant N as Notification

    RC->>A: POST /reports/:id/exports  (format, language)
    A->>ENT: check('report.export.pdf')   [p95 ≤ 20 ms — NFR-41]
    ENT-->>A: allow | allow_with_warning (unresolved findings — FR-44)
    A->>A: resolve pinned template/taxonomy version (FR-51)
    A->>Q: enqueue export job (via outbox dispatch)
    A-->>RC: 202 + job id (never blocks the request tier — NFR-46)
    WK->>CH: render semantic HTML → PDF
    CH->>CH: inject OutputIntent + XMP in place (qpdf), veraPDF vs PDF/A-2a + UA-1
    WK->>S3: store artefact + metadata (NFR-22)
    WK->>A: record immutable export history entry (FR-53)
    WK->>N: raise completion notification (NFR-42)
    N-->>RC: in-app + email per preference (FR-163)
```

Excel export follows the same path, writing into the official EFRAG template's named ranges at the report's pinned version and preserving its dropdowns and consistency formulas (FR-50, NFR-20). Export history is immutable, and any prior export is re-downloadable exactly as distributed.

### 11.4 Entitlement check

1. A gated handler carries `@RequiresEntitlement('<key>')`; `EntitlementGuard` calls `check(orgId, key, requested?)` through the `contracts/` port.
2. The billing implementation resolves the decision from the in-process cache, keyed by `organization_id` and an entitlement snapshot version. No network hop on the hot path — p95 ≤ 20 ms.
3. On cache miss, entitlements are computed from plan-version entitlements plus per-subscription overrides, and quota keys are evaluated against the metering counters — ≤ 100 ms.
4. Invalidation is a version poll of a single-row table (the authority) with Redis pub/sub as the fast path. A missed message costs seconds of staleness, not an indefinitely stale replica.
5. If the billing context is unreachable, the cached last-known-good snapshot serves: **open** for already-granted keys, **closed** for new purchases (NFR-49).
6. With `BILLING_ENABLED=false`, the null implementation grants everything, and UC-17 … UC-48 pass.

### 11.5 Taxonomy migration

1. `PA` registers a new template and taxonomy version in the configuration store, uploading its artefacts (FR-65, FR-66). This is data registration — no code release, no deployment (NFR-86).
2. `PA` authors a version-to-version field mapping, pinned to the version pair (FR-67).
3. A migration run is enqueued as a worker job over a **selected set** of reports.
4. The run **preserves the pre-migration state** rather than overwriting in place (FR-69), so a bad mapping is reversible.
5. Affected organizations are notified through the notification subsystem (FR-70, FR-166), not left to discover the change at export time.
6. Reports not migrated keep their pinned version and continue to export and validate against it (NFR-3). Two taxonomy versions are registered in staging from day one, with a report pinned to each, so the version dimension is exercised continuously rather than discovered at the first rollout.

### 11.6 Configuration publish and revert

1. An edit is made in the admin console against a **draft**.
2. Review moves it to `in review`, then approval triggers publication.
3. Publication is a **single transactional action**: write a new immutable version, flip a pointer. Effective-dated artefacts carry a validity range with a database-enforced non-overlap guarantee.
4. Replicas notice within ≤ 5 s by version poll; Redis pub/sub may deliver it sooner.
5. Revert flips the pointer back — one action (NFR-85).

---

## 12. Technology stack and rationale

Versions were verified on **10 August 2026** and are part of the build contract, not a detail. This table is accurate as of that date and will not stay accurate: it rides the quarterly regulatory-watch cycle (NFR-12), because the same review that checks EFRAG taxonomy releases should check this table.

### 12.1 The stack

| Layer | Component | Pinned | Rationale as stated in the sources |
|---|---|---|---|
| Runtime | Node.js | **26.7.0** (verified 18 Aug 2026) — **adopted on the Current channel, 10 weeks ahead of its 28 Oct 2026 LTS date; see §12.6** | Deliberate, time-boxed deviation from "never Current". 26 becomes Active LTS on 2026-10-28 and is supported to April 2029; v24 drops to Maintenance on 2026-10-20 |
| Language | TypeScript | **6.0.3** | AD-13. TS 7 has no compiler API, which breaks `nest build`, ts-jest and type-aware ESLint |
| Backend framework | NestJS | **11.1.29** | Current stable (12.0 in alpha) |
| HTTP adapter | Express | **5.2.1** | NestJS's default adapter. Fastify was considered; at ≈ 150 peak concurrent sessions throughput is not the constraint, and Express has the wider middleware ecosystem and the documentation NestJS examples assume |
| ORM | TypeORM | **1.1.0** | AD-14. Left `0.3.x` on 19 May 2026; adopted with five features deliberately switched off |
| NestJS ORM adapter | `@nestjs/typeorm` | **11.0.3** | Peer range `^0.3.0 \|\| ^1.0.0-dev`; smoke-test against 1.1 |
| Auth — password hashing | `@node-rs/argon2` | **2.1.0** (verified 19 Aug 2026) | **Added 19 Aug 2026.** §9.1 closed the algorithm — Argon2id, per-user salt, pepper from the secret manager — but named no package. Chosen over `argon2` 0.45.1: it ships N-API prebuilds as platform `optionalDependencies` with **no install script**, so `strictDepBuilds` has nothing to gate, and an ABI-stable prebuild is indifferent to the §12.6 Node window, while `argon2`'s node-gyp `install` script is exactly the source-build path control 3 warns about. Its `secret` option is where the §9.1 pepper goes. bcrypt (the iftamaster reference's choice) was declined on the spec: §9.1 is closed, and bcrypt truncates input at 72 bytes with no memory hardness. The binding is canaried by `argon2-binding.spec.ts` — a missing prebuild surfaces at require-time, not install-time |
| Auth — tokens and middleware | `@nestjs/jwt` **11.0.2**, `@nestjs/passport` **11.0.5**, `passport` **0.7.0**, `passport-jwt` **4.0.1** | — (verified 19 Aug 2026) | **Added 19 Aug 2026.** AD-12 closed the design — ≤15-min JWT carrying only `session_id`, opaque server-side refresh tokens — but named no packages. `@nestjs/jwt` wraps `jsonwebtoken` 9, which is CommonJS, so no OQ-48 pressure; `jose` was declined for being ESM-only, which would have been OQ-48's stated revisit trigger, not a library choice. The passport trio is the strategy seam the NestJS guard shape documents; a bare guard would also serve AD-12, but the strategy interface is where OIDC (§9.1) later attaches without a second mechanism. Refresh tokens need no package — they are opaque DB rows by design |
| Auth — TOTP (FR-75) | `otpauth` **9.5.1** | — (verified 24 Aug 2026) | **Added 24 Aug 2026, replacing hand-rolled code from task 23.** The admin realm's second factor first shipped as ~90 lines in `platform/admin/domain/totp.ts` — a base32 codec, RFC 4226's truncation and the window loop — argued for on the grounds that RFC 6238 ships test vectors. **Review rejected that argument on evidence:** the hand-rolled version passed all six vectors while carrying a defect (at step 0 the ±1 window reached for counter −1 and `writeBigUInt64BE` threw), found by a negative-case probe rather than by the vectors. A specification's examples cover the happy path; the failures live in boundary and malformed input. Node has no base32 either way (verified on 26.7.0 — `Buffer` does `base64url` and `hex`, not `base32`), so a codec was genuinely needed, but a maintained one existed. `otpauth` covers the whole primitive — base32 `Secret`, HOTP truncation, windowed `validate`, and the Key Uri Format for enrolment — so nothing is left hand-rolled; it is MIT, depends only on `@noble/hashes` **2.2.0**, and compares with `crypto.timingSafeEqual` internally. **It ships a real Node CommonJS build** (`exports['.'].node.require`, confirmed by an actual `require()`), so OQ-48's objection to `jose` does not apply. Declined: `otplib` (needs preset assembly for the same result) and `@scure/base` (a bare codec, which would have left the truncation and window — the half the bug was in — hand-rolled). One recorded behavioural difference: `validate` returns on its first matching window rather than comparing all three, disclosing a ±30 s clock offset by timing to someone who already holds a valid code — not a weakness worth a private implementation |
| Auth — OIDC client (FR-2, FR-4, D-6) | `openid-client` **6.8.7** | — (verified 24 Aug 2026) | **Added 24 Aug 2026, task 24's open-question batch** — the OIDC client this table recorded as deliberately unpinned until the identity build reached it. The certified Relying Party implementation, current (published 20 Aug 2026): one generic OIDC client serves Google and Microsoft alike, which is what keeps D-6's "enterprise SSO is a provider registration rather than a rework" true, and it owns the security-critical plumbing — `state`, `nonce`, PKCE, ID-token validation — that the same-day `otpauth` row establishes must not be hand-rolled. It is **ESM-only**, which fired OQ-48's stated revisit trigger; the revisit concluded **no bridge and no migration**: Node 26's stable `require(esm)` loads it natively from this CommonJS app (proven by an actual `require()` on 26.7.0 — its module graph has no top-level await), and TS 6's `module: nodenext` emits exactly that `require`. The dynamic-import bridge remains `use-intl`'s alone. Declined: `passport-google-oauth20` (last published March 2019, OAuth 2.0-level — it never validates an ID-token nonce) and `passport-microsoft` (community-maintained, same level). The 19 Aug auth row expected OIDC to attach at the passport strategy seam; it does not — §12.5.6's task-24 flow row records why the redirect endpoints live on `apps/web`, leaving the api a back channel behind `IdentityProviderPort`, where passport middleware has nothing to mount on |
| Tenant UI | Next.js | **16.3.0** | App Router; `proxy.ts` session tier; SSR for list and preview views |
| UI library | React | **19.2.8** | No major after 19 exists |
| UI DOM renderer | `react-dom` | **19.2.8** | **Added 18 Aug 2026** with the `apps/web` scaffold. Must equal the `react` pin exactly — React and its renderer are released as one unit and a split pair fails at runtime, not at install |
| Tenant i18n | `next-intl` | **4.13.7** | **Added 18 Aug 2026** with the `apps/web` scaffold; §12.1 previously named no i18n package. Chosen because its `getRequestConfig` accepts messages from an arbitrary async source, which keeps the catalogue's origin a decision rather than a framework constraint. **Note (19 Aug 2026, OQ-43):** that origin is now a committed message file for catalogue text; the property still earns its place, because the loader seam is what lets FR-61 content join the catalogue at runtime without rewriting the front ends. Its global `formats` is also where NFR-26's "no hardcoded format pattern" becomes structural. Pulls two non-optional native builds — `@swc/core` and `@parcel/watcher` — both reviewed and allowed in `pnpm-workspace.yaml` |
| Admin build | Vite | **8.2.1** | Vite 8 makes Rolldown the single bundler and Oxc the React transform, replacing esbuild/Rollup/Babel — a straight build-speed win for an internal SPA. **Added to the catalog 19 Aug 2026** with the `apps/admin` scaffold: §12.1 had pinned it since the table was written, but `pnpm-workspace.yaml` carried no entry, so under `catalogMode: strict` the pin was unenforceable — `pnpm add vite` would have failed rather than resolved to 8.2.1. Registry latest on that date was also 8.2.1, so the pin needed no reconciliation |
| Admin router | `@tanstack/react-router` | **1.170.29** (verified 19 Aug 2026) | **Added 19 Aug 2026** with the `apps/admin` scaffold; no document had named a router. Chosen for typed, schema-validated **search params**: UX-4 requires every addressable state — "an admin queue filter" among the examples it names — to be bookmarkable and restore on load, and the console's whole information architecture is saved filters over exception queues. A router with untyped string params leaves UX-4 a convention nobody enforces; this makes it a compile-time property. Ships with `@tanstack/router-plugin` **1.168.32**, which generates the route tree at build time |
| Admin i18n | `use-intl` | **4.13.7** (verified 19 Aug 2026) | **Added 19 Aug 2026** with the i18n wiring; no document had named one, and the console is Romanian-only (OQ-42) but still resolves every string through a key. `use-intl` is the framework-agnostic core `next-intl` is built on and is already in the tree as its dependency, so the console shares one ICU message syntax and one `Formats` type with `apps/web`. **Pin it to the same version as `next-intl`** — a divergence surfaces as a runtime throw on a plural or a placeholder, not as a build error |
| Admin router codegen | `@tanstack/router-plugin` | **1.168.32** (verified 19 Aug 2026) | **Added 19 Aug 2026.** Moves with the router pin and only with it: the plugin declares the router as a peer at an *exact-looking* caret (`^1.170.29`) and the two are released from one monorepo on independent counters, so the plugin's lower number is normal and the pair must be bumped together. Generates `apps/admin/src/app/route-tree.gen.ts`, which is committed and gated by `pnpm routes:check` — the analogue of `openapi:check` |
| Client server state | `@tanstack/react-query` | **5.101.4** (verified 19 Aug 2026) | **Added 19 Aug 2026** with the `apps/admin` scaffold; no document had named a data-fetching library. A static SPA has no server tier, so leaving it open meant whoever wrote the first exception queue would choose it under time pressure. §11.2 settles the shape — nothing pushes, everything polls — so `refetchInterval` is the transport for every queue and counter, and the cache/stale/error states map onto §8.1's eleven required states. **Extended to `apps/web` on 19 Aug 2026**, ending the deferral this row originally recorded (OQ-41). Its three client-side needs are all server state with cache, staleness and retry semantics — order state after a payment hand-off, export job state past AD-10's 202, and the notification unread count (FR-161) — and FR-37/FR-38 autosave wants debounced batched mutations with retry and a per-field `synced \| queued \| failed` marker, which is the mutation API. One library across both front ends, one catalog entry, one idiom. **Scope boundary, and it is load-bearing: in `apps/web` this is for client islands only, never a parallel data path.** Anything reachable server-side keeps going through the session proxy, because that proxy is what holds the access token out of browser JavaScript (AD-9); a `useQuery` calling the API directly routes around it and puts the token where AD-12 says it must not be |
| Styling | Tailwind CSS | **4.3.3** | Utilities for layout and application UI |
| Styling | `@tailwindcss/postcss` | **4.3.3** | **Added 18 Aug 2026.** Tailwind 4 ships its PostCSS integration separately; it tracks the Tailwind pin |
| Styling | Dart Sass | **1.102.0** | SCSS for design-system primitives and the print/PDF export templates. Modern API only; `@use`, not `@import` |
| Icons | `lucide-react` | **1.32.0** (verified 19 Aug 2026) | **Added 19 Aug 2026**, closing design_spec.md OQ-15 (the icon set, which blocked Phase 1). ISC-licensed continuation of Feather: stroke-consistent, tree-shakeable per-icon exports, and icons inherit `currentColor`, so the tier-2 semantic tokens stay the only colour authority (UX-78). Lives in `packages/ui`, the design system's home. Registry latest on the verification date was 1.33.0, published four hours earlier; pnpm's release-age supply-chain policy held resolution to 1.32.0, and the pin records what installed rather than overriding that guard — the next quarterly pass collects the tail |
| UI primitives | `radix-ui` | **1.6.7** (verified 19 Aug 2026) | **Added 19 Aug 2026**; no document had named a component library — design_spec.md §1.2 is deliberately library-agnostic and states only the contract one must satisfy. Headless and unstyled, so §12.2's split holds: the SCSS token cascade stays the sole styling authority and UX-79's "re-skinning edits tier 1 only" survives the dependency. The unified `radix-ui` package supersedes the per-primitive `@radix-ui/react-*` scatter. Base UI was declined on the stable-means-stable rule — it has never shipped a stable release, and its `1.0.0-rc.0` had sat unchanged since 4 Dec 2025 on the verification date. React Aria Components (stable, active) was the runner-up, declined for its heavier API surface; a shadcn-style copy-in was declined because its Tailwind-styled output contradicts §12.2. The 14 domain components remain first-party per design_spec.md §11.5 — the primitives sit underneath them only |
| Form state | `react-hook-form` | **7.85.0** (verified 19 Aug 2026) | **Added 19 Aug 2026** for `apps/web` and `apps/admin`; no document had named a form library, though `design/screens/EasyESG Components.dc.html` already cited it on the text-input specimen, so the design layer had assumed one. Uncontrolled-by-default with per-field subscriptions, which is what the B1–B11 wizard needs: a controlled tree re-renders every disclosure field on each keystroke, against NFR-43's budget on the longest form in the product. **It holds form state and field-level UX only.** Business validation stays in `packages/validation`, interpreted from rule definitions and shared with `apps/api` (§9.8) — a rule re-expressed in a resolver schema is a second source of truth, and the drift it produces is precisely what §9.8 exists to prevent. No resolver package is installed, deliberately: the seam between the interpreter and the form belongs to Phase 4 and installing one now would pre-empt it (see OQ-49). `packages/ui` does **not** depend on it — form controls stay presentational and take `value`/`onChange`/`ref`, which is what `ui-is-presentational` enforces and what keeps UX-79's swappability true. **`@tanstack/react-form` 1.33.5 was the considered alternative and is declined on a project-specific ground, not on maturity** — it is genuinely stable (1.0 on 2 Mar 2025, actively released) and `apps/admin` already runs TanStack Router and Query, so ecosystem coherence argued for it. Its headline advantage is end-to-end type inference from a statically declared form shape, and **the largest form surface in this product does not have one**: the B1–B11 wizard renders fields from the taxonomy registry at runtime (AD-4, DR-3), and T-3 has already accepted losing compile-time typing over exactly that data. An advantage that cannot apply to the wizard does not justify a second idiom, and one form library across both front ends is what the catalog exists to hold. Two lesser points, recorded so a re-evaluation starts from facts: `react-hook-form` has **no runtime dependencies**, while `@tanstack/react-form` pulls `@tanstack/react-store` at a pre-1.0 caret, which §12's exact-pin rule for pre-1.0 packages would have to reason about. Revisit if the admin console's static forms outgrow the wizard in volume, or if the disclosure model ever becomes statically typed |
| Database | PostgreSQL | **18.4** | §12.3 — five features are load-bearing. Stable since 25 September 2025; EOL November 2030 |
| DB driver | `pg` | **8.23.0** | Returns `numeric` as a string, which NFR-58 wants |
| Queue store | Redis | **8.10.0** | BullMQ's officially supported and tested backend, which removes a compatibility spike rather than adding one |
| Jobs | BullMQ | **6.0.9** | Runs on its supported backend |
| Redis client | ioredis | **6.0.0** | MIT-licensed. **Note (18 Aug 2026):** TypeORM 1.1.0 declares its `ioredis` peer as `^5.0.4`, so this pin and the TypeORM pin are internally inconsistent. Inert — the peer is `optional: true` and TypeORM touches ioredis only in `cache/RedisQueryResultCache.js`, and this design never enables TypeORM's query-result cache (AD-4 invalidates by version poll; AD-5's cache is in-process; Redis is never a system of record). Recorded as a justified `peerDependencyRules.allowedVersions` entry rather than silenced globally |
| Edge | Caddy | **2.11.4** | TLS, HSTS, rate limiting, admin IP allowlist, dynamic upstreams |
| Rendering | Playwright / Chromium | **1.62.1** | Renderer and cross-browser CI; `tagged: true` for PDF structure |
| PDF post-processing | qpdf / pikepdf, veraPDF | — | In-place metadata injection; conformance validation against PDF/A-2a and PDF/UA-1 |
| Package manager | pnpm | **11.22.0** (verified 18 Aug 2026) | Workspace monorepo. **Moved from 11.21.0 on 18 Aug 2026**: 11.21.0 cannot bootstrap itself from an 11.22.0 host on `darwin-x64` — pnpm writes `@pnpm/exe@11.21.0` into the lockfile and then refuses to run because `@pnpm/exe.darwin-x64` is absent from it. 11.22.0 installs with no override. Same minor; catalog, `allowBuilds` and `catalogMode` behave identically |
| Lint | ESLint | **10.8.1** | Next 16 removed `next lint`; CI calls ESLint directly |
| Build — alias rewrite (api) | `tsc-alias` | **1.9.2** (verified 20 Aug 2026) | **Added 20 Aug 2026** with the `@api/*` import alias. tsc emits path aliases verbatim and Node cannot resolve them, so `postbuild` rewrites `dist/` to relative specifiers — the alternative, `tsconfig-paths/register` at run time, would put a resolver and a shipped tsconfig inside the production image for a problem the build can finish. Dev-only; the emitted image is unchanged. Guarded end to end: dependency-cruiser's `api-no-unresolvable` rule fails the build if the alias ever stops resolving, because a boundary rule whose imports resolve to nothing does not fail — it silently stops matching |
| Test runner (web) | Vitest | **4.1.10** | **Added 18 Aug 2026.** §12.5.6 and OQ-16 named Vitest as the runner for `apps/{web,admin}` and `packages/*` without pinning it. With `jsdom` **30.0.1**, `@vitejs/plugin-react` **6.0.5**, `@testing-library/react` **16.3.2**, `@testing-library/user-event` **14.6.4** and `@testing-library/jest-dom` **7.0.1** (added 20 Aug 2026, task 20 — the DOM matchers, registered in `apps/web/src/test/setup.ts` together with the explicit `cleanup()` that `globals: false` withholds) |
| Contract types | `openapi-typescript` | **7.13.0** (verified 20 Aug 2026) | **Added 20 Aug 2026, task 20** — the generator behind `@easyesg/contracts`' stated design ("OpenAPI-generated client"): `openapi/v1.json` → `src/generated/v1.ts`, types only, no runtime. Committed and diffed by the same `openapi:check` gate as the spec itself, so decorators → JSON → TS is one chain a route change must regenerate whole. Declares a `typescript ^5.x` peer, predating TS 6; verified generating and typechecking under 6.0.3 and recorded as a justified `peerDependencyRules.allowedVersions` entry |
| Fonts | `@fontsource/onest`, `@fontsource/ibm-plex-mono` | **5.3.0**, **5.3.0** (verified 20 Aug 2026) | **Added 20 Aug 2026, task 20** — §11.6's self-hosting obligation (Phase 0 deliverable 2), as lockfile-pinned packages rather than a build-time fetch from Google. Only the delivered weights are imported (Onest 400/500/600/700, Plex Mono 400/500). UX-84's two silent-subsetting failures checked at install: ș/ț comma-below sit in the latin-ext unicode-range (U+0218–021B ⊂ U+0100–02BA) and the Cyrillic subsets ship in full |
| Lint (web) | `eslint-plugin-react-hooks` **7.1.1**, `eslint-plugin-jsx-a11y` **6.10.2**, `@next/eslint-plugin-next` **16.3.1** | — | **Added 18 Aug 2026.** jsx-a11y still declares a peer range ending at ESLint ^9; verified working under 10.8.1 by loading the plugin and asserting a rule fires, and recorded as a justified `peerDependencyRules.allowedVersions` entry |
| Accessibility CI | `@axe-core/playwright` | **4.13.0** | **Added 18 Aug 2026.** The automated half of NFR-75's verification; the manual keyboard and screen-reader audit of the wizard is the other half |
| Lint | typescript-eslint | **8.66.0** | The constraint behind AD-13 |
| Lint (conventions) | `eslint-plugin-sonarjs` | **4.2.0** (verified 21 Aug 2026) | **Added 21 Aug 2026** for `no-duplicate-string` alone — not the `recommended` set, which is dozens of rules nobody reviewed. It puts a mechanical check under `CLAUDE.md`'s closed-vocabulary convention, which was review-only. **The pin's rationale must record what it does not cover**, because that is the reusable finding: the rule carries `MIN_LENGTH = 10` and `NO_SEPARATOR_REGEXP = /^\w*$/` internally, and `\w` includes the underscore, so a single word of word-characters is invisible at any repetition count — measured, not assumed (`'unverified'` × 3 and `'password_reset'` × 3 pass; `'a sentence with separators'` × 3 is caught). It therefore covers message keys, route paths, SQL and prose, and misses exactly the bare tokens the convention is mostly about. Kept on that basis rather than as enforcement of the convention. Peer range already includes ESLint ^10, so no `allowedVersions` entry is needed |
| Boundaries | dependency-cruiser | **18.1.1** | AD-1's boundary enforcement |
| Telemetry | OpenTelemetry JS SDK | **0.221.0** | Pre-1.0; pin exactly |
| Observability | Prometheus, Loki, Grafana | — | Self-hosted on VM-3; keeps NFR-27's EU-residency assertion trivially true and adds no sub-processor |
| Backup | pgBackRest | — | Continuous WAL archiving to EU object storage |
| Connection pooling | PgBouncer | — | Transaction pooling mode only, on the application host. Deferred until connection count bites (§16) |
| Configuration poll interval | `CONFIG_POLL_INTERVAL_MS` | **5000 ms** | AD-4's own bound, taken at its limit: the poll of the single-row version table is the authority and must be ≤ 5 s. It is a question about whether a reload is needed, not a reload — one query against a one-row table, answered "no" almost always |
| Outbox dispatch interval | `DISPATCH_INTERVAL_MS` | **1000 ms** | **Set 20 Aug 2026 (task 15).** No source stated one — OQ-36 covers order state, export jobs and the unread count, not this. One second because the user-visible flow that depends on it is verification and invitation email (FR-9, FR-11), where someone is waiting and the interval is dead time before the job is even enqueued; at this scale an empty query against a partial index costs nothing. Tunable, unlike the queue name, which is durable in Redis |
| Outbox dispatch batch | `DISPATCH_BATCH_SIZE` | **100** | Claimed per poll under `FOR UPDATE SKIP LOCKED`, so several dispatchers never contend for the same rows |
| Outbox attempt limit | `MAX_DISPATCH_ATTEMPTS` | **10** | Past this a row stops being retried and becomes a tracked exception with an owner (NFR-71). Retrying for ever turns one poisonous row into a permanent backlog hiding every healthy one behind it |
| Application pool size | `poolSize` per `DataSource` | **10** | **Set 19 Aug 2026 (task 11).** No source stated one, and it stopped being ignorable when every request began holding a `QueryRunner` for its lifetime: the pool is what bounds concurrency until PgBouncer arrives. Four pools exist at peak — `core` + `billing` on `api`, the same two on `worker` — so 40 of PostgreSQL's default `max_connections` of 100, leaving headroom for the migration job, `esg_admin_ro`, monitoring and an operator's `psql`. It is also TypeORM's inherited default, so this records existing behaviour rather than changing it, and gives §16's PgBouncer trigger a number to be measured against |

**The catalog is this table's machine-readable form.** `pnpm-workspace.yaml`'s `catalog:` block
holds one version per dependency across the workspace, and `catalogMode: strict` makes adding a
dependency outside it an install error — so the pins above stop being a table people are meant to
consult and become one the installer enforces. Packages this table does not pin are resolved to
current stable through `pnpm add --save-catalog` and recorded there with the rest; those resolved
**18 Aug 2026** at foundation stage were `@nestjs/swagger` 11.4.7, `@nestjs/config` 4.0.4,
`@nestjs/bullmq` 11.0.5, `class-validator` 0.15.1, `class-transformer` 0.5.1, `nestjs-pino` 4.6.1,
`pino` 10.3.1, `jest` 30.4.2, `ts-jest` 29.4.12 and `@types/node` 26.2.0; `@types/passport-jwt`
4.0.1 followed on **19 Aug 2026** with the auth stack.

Two identity-phase packages were **deliberately left unpinned** here on 19 Aug 2026 — the TOTP
library and the OIDC client §9.1's MFA and SSO rows imply — because neither was needed by the auth
seam installed that day, and pinning them early would have been deciding them without the work in
front of us. Both have since been pinned exactly as intended, each from its own task's
open-question batch: `otpauth` 9.5.1 (24 Aug 2026, the task 23 review) and `openid-client` 6.8.7
(24 Aug 2026, task 24). Their rows above carry the decisions.

### 12.2 The styling split, and two configuration facts

Tailwind utilities for layout and application UI; SCSS for what utilities express badly — the `packages/ui` design-system primitives, and the **export templates**, where the semantic HTML that `renderer` turns into PDF needs `@page` rules, page-break control, counters and print media queries, none of which are utility-shaped.

- Sass runs **before** Tailwind. Write `@use`, never `@import` — Sass would try to resolve `@import "tailwindcss"` itself. Tailwind's own entry stays in a plain `.css` file; `.scss` files consume tokens through `@use` and `@apply`.
- Use the **modern Sass API** (`sass-embedded` where build speed matters). The legacy JS API is deprecated and `@import` is slated for removal in Dart Sass 3.

### 12.3 PostgreSQL 18 — where the version changes a decision, not a version string

| Feature | What it changes |
|---|---|
| **Temporal constraints** (`WITHOUT OVERLAPS`, `PERIOD` foreign keys) | Turns AD-4's effective dating from an application invariant into a database one. Six configuration artefacts are effective-dated, and in every one of them two overlapping validity ranges is a correctness bug of the worst kind: silent, and visible only in a figure that was already reported. `PRIMARY KEY (scope, validity WITHOUT OVERLAPS)` is declarable. This is the single strongest argument for 18 here, because NFR-19 and NFR-87 both rest on exactly one factor set being in force for any given date |
| **`RETURNING OLD.* / NEW.*`** | Available to any caller wanting both row images in one statement. On 17 this is read-then-write with a lock; on 18 the upsert returns both in the same round trip, removing a lock, a round trip and a class of race. **It is no longer how the field audit trail is written** — that is a trigger as of 20 Aug 2026, see AD-14 constraint 5 — because a trigger cannot be bypassed and never needed the read either way. Verified on 18.4 for `INSERT`, `UPDATE` and `DELETE` alike, where the absent image reads NULL |
| **`uuidv7()`** | Time-ordered primary keys keep inserts at the right edge of the B-tree on the append-heavy tables (`report_disclosure_value`, `metering_event`, `outbox_event`, `field_change`), instead of v4's scatter, WAL inflation and page splits. **Not** for externally visible tokens, which encode their creation time |
| **B-tree skip scan** | Every tenant index leads with `organization_id` because of AD-2; pre-18 a query filtering only on a later column could not use the index and needed a duplicate. Skip scan makes the composite index usable, so there are fewer indexes to maintain on already write-heavy tables |
| **`NOT NULL ... NOT VALID`** | Fits expand-migrate-contract. Previously adding `NOT NULL` to a populated table meant a validating scan under `ACCESS EXCLUSIVE` — a de facto maintenance window, which NFR-48 forbids inside the filing window |

Two further conveniences, not decisions: the asynchronous I/O subsystem (`io_method`) gives sequential scans, bitmap heap scans and vacuum more headroom against NFR-37, and `pg_upgrade` now preserves optimizer statistics, removing the post-upgrade "everything is slow until `ANALYZE` finishes" cliff from the major-version runbook.

**Not used:** PostgreSQL 18's OAuth authentication method. It authenticates *database* connections against an identity provider; this system's application roles authenticate by password or certificate from inside the private network, and AD-12 governs *user* authentication. Conflating the two would be a security regression, not a simplification.

**Version policy.** Pin **18.x** and track minor releases on the quarterly cadence. PostgreSQL 19 is due around September 2026, i.e. mid-build; it is a post-launch runbook item, not a build-time decision (§18).

### 12.4 The Redis licence question, answered rather than avoided

Redis 8.10 is tri-licensed **RSALv2 / SSPLv1 / AGPLv3** — the licensee chooses. Valkey (the BSD-3 Linux Foundation fork) was considered and is not needed, because none of the three licences creates an obligation for this platform:

- **AGPLv3** — its network clause triggers on *modified* versions served over a network. The platform runs stock Redis, does not modify it, does not redistribute it, and reaches it over a wire protocol using an MIT-licensed client (`ioredis`), so there is no derivative-work argument either.
- **SSPLv1** — targets offering *the software itself* as a service. This platform uses Redis as an internal job queue; it does not resell Redis.
- **RSALv2** — forbids offering a competing commercial product. Not applicable.

If a procurement review ever objects on principle rather than on obligation, Valkey is a drop-in replacement on the same protocol — that is the fallback, not the default.

The same licence discipline is applied consistently elsewhere: the EFRAG converter is MIT and therefore embeddable; **Ghostscript is AGPL-3.0 and is excluded from the PDF path on technical grounds, with the licence noted as a second reason it should not return** (§16).

---

### 12.6 The Node line — Node 26 adopted early, deliberately

Verified against `nodejs/Release` on **18 August 2026**:

| Line | Status on 18 Aug 2026 | Active LTS from | Maintenance | End of life |
|---|---|---|---|---|
| v24 "Krypton" | Active LTS | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| **v26** | **Current** | **2026-10-28** | 2027-10-20 | **2029-04-30** |
| v25 | End of life | never | 2026-04-01 | 2026-06-01 |

**Decision: pin 26.7.0 now.** This is a knowing, time-boxed departure from the standing rule that production runs Active or Maintenance LTS and never Current. It was taken with the alternative — 24.19 until 28 October — put and declined.

**The reasoning for it.** v26 is the destination on any timeline: it becomes Active LTS on 28 October 2026, ten weeks from this decision and well inside a build estimated at 8–12 months, and it is supported to April 2029 against v24's April 2028. v24 enters Maintenance on 20 October, eight days before v26 becomes Active, so pinning 24 would mean starting a multi-year product on a line that is two months from maintenance. Adopting 26 now also means the runtime is never migrated mid-build: the foundation is laid once, on the version that will carry the product through its first several filing windows.

**What is being accepted, so it is not rediscovered as a surprise.** For the ten weeks to 28 October, 26.x carries no LTS stability commitment and may change in ways an LTS line may not. The ecosystem writes support matrices and ships native prebuilt binaries against LTS lines, so a missing prebuild or an untested combination is likelier here than on 24 — and it will surface during the foundation sprint. v25 in the table is the shape of the risk when it goes wrong: release to end of life in eight months, never LTS. v26 is an even-numbered line and therefore *will* reach LTS, which is what makes this a timing bet rather than a line bet, and is the whole reason it is acceptable.

**Four controls, in force until 28 October 2026:**

1. **Pin the exact patch — 26.7.0 — not a floating `26`.** On a Current line a patch can carry more change than on an LTS line, so each bump is an explicit decision with a re-verification date, never an implicit pickup.
2. **Laptops, the Docker base image and CI run the same 26.7.0.** Dev parity is doing real work here (§12.5.10); on a Current runtime a version split between host and image is the most likely source of a "works locally" failure.
3. **A native-module or prebuild failure is a Node-version hypothesis first.** On an LTS line that would be an unlikely cause; for these ten weeks it is the first thing to check, before the dependency itself.
4. **Any 26.x patch bump inside the window re-runs the full gate set** before acceptance — boundary rules, RLS probes, contract tests, coverage floors, accessibility, injection corpus, cross-browser, `BILLING_ENABLED=false`.

**Scheduled action — on or after 28 October 2026:** confirm v26 has entered Active LTS, record the confirmation date against the §12.1 pin, and **retire this exception**. No migration is involved; the deviation closes by the calendar. Controls 1 and 3 relax to normal practice at that point; controls 2 and 4 are standing policy regardless.

### 12.5 Infrastructure, tooling and operational values

Decided 18 August 2026, closing §18.2's fourteen "the sources are silent" entries. Taken as one decision rather than fourteen because the parts constrain each other: the compute provider determines what "independent of the hosting provider" can mean for the archive (NFR-72), the archive provider determines the backup plan, and NFR-69's wording already narrows the secret store. Nothing here contradicts a stated requirement; where a requirement already narrows a choice more than the open question admitted, that is called out.

| Concern | Decision |
|---|---|
| Compute (OQ-9) | **Hetzner Cloud, Falkenstein (DE)** — VM-1, VM-2, VM-3. Off-site copy to Helsinki (FI) |
| CDN, DNS, TLS (OQ-10) | **No CDN at MVP.** DNS at Hetzner. **TLS terminates at `edge` (Caddy)** |
| Object storage (OQ-11) | **Scaleway Object Storage, Paris** — versioning + Object Lock (Compliance), Glacier for the fiscal archive. **A different provider from compute, on purpose** |
| Transactional email (OQ-12) | **Mailjet (EU)** behind `EmailPort` — one of four adapters the platform can run without a code change |
| Secrets (OQ-13) | **Self-hosted OpenBao on VM-3.** SOPS + age only for the pre-OpenBao bootstrap `.env` |
| CI (OQ-14) | **GitHub Actions.** CI holds no long-lived production credentials |
| Provisioning (OQ-15) | **Ansible** from foundation stage · **OpenTofu** when the DR runbook is written · Compose for the workload |
| Test tooling (OQ-16) | **Jest + ts-jest** in `apps/api` (both modes); **Vitest** in `apps/{web,admin}` and `packages/*`; Playwright for E2E |
| Admin token handler (OQ-17) | **A route on `api`** — not a Caddy module, not a separate service |
| Rate limits and tokens (OQ-19) | Values in §12.5.6 |
| Non-fiscal retention (OQ-20) | Schedule in §12.5.7 |
| Redis durability (OQ-21) | **RDB snapshots on a volume; AOF off; `maxmemory-policy noeviction`** |
| Backups (OQ-22) | 35-day PITR · 12 monthly · 6 yearly Object-Locked · quarterly rehearsal, one per year provider-independent |
| Chromium (OQ-27) | Derived from the Playwright pin — 1.62.1 ships **Chromium 151.0.7922.34** |

#### 12.5.1 Compute, network and the storage split

**Hetzner Cloud, Falkenstein (DE)** for all three VMs. EU-owned, so no CLOUD Act argument has to be made in a compliance product's sub-processor register; lowest per-vCPU price in the EU field, which is what makes NFR-47's €0.50 per free-tier organization comfortable at 2,000 organizations rather than tight; and plain VMs suit the Compose topology, which does not want a managed control plane. No multi-AZ within a location — already priced in, since NFR-48 is scoped to application availability precisely because `edge`, `redis` and VM-1 are unreplicated (R-11, T-7).

**No CDN at MVP.** At ~150 peak concurrent sessions and under 100 GB there is no performance case, and both ways of adding one cost something real: proxying terminates TLS at a third party that then sees every request, and full-strict passthrough adds a hop for almost nothing. Static assets are served by Next.js and Caddy with long-lived immutable cache headers. Reopens only as part of NFR-48's standing second-app-VM alternative (OQ-4).

**Object storage is Scaleway (Paris), deliberately a different provider from compute.** Object Lock in **Compliance mode** is the deciding capability, not a preference: under it an object cannot be overwritten or deleted by anyone — owner and administrator included — until retention expires, which is what DR-6's append-only guarantee and NFR-72's six-year statutory archive actually require. Verified against Scaleway's documentation on 18 Aug 2026: Object Lock requires versioning, cannot be disabled once enabled, and is supported on the Glacier class. Buckets: `esg-fiscal-archive` (locked, Glacier), `esg-exports`, `esg-backups`.

The provider split is load-bearing. NFR-72 requires fiscal documents retrievable "independently of the application, the database and the hosting provider", and `non_functional_requirements.md` OQ-14 records that NFR-36 only ever tests independence from the *application* — so the strongest clause is asserted and unverified. Putting the archive on a different provider from the VMs makes provider-independence **true by construction**, and the rehearsal in §12.5.8 makes it testable.

**Providers evaluated and rejected for storage.** AWS S3 and Google Cloud Storage — excluded on ownership, not capability: both are US-controlled, which turns NFR-27's residency assertion into a transfer-mechanism argument for a product whose whole proposition is regulatory compliance. **bunny.net** — EU-owned (Slovenia) and attractive on price and residency, but Edge Storage is positioned as CDN origin storage and **no Object Lock, versioning or WORM retention capability could be confirmed from its documentation**. For a six-year statutory archive an unconfirmed WORM capability is disqualifying on its own: the requirement is that deletion be structurally impossible, and that cannot rest on an assumption. bunny.net remains the strongest candidate to revisit for OQ-10 — CDN and DNS — if the second application VM is ever added, where its ownership and price are advantages and no WORM guarantee is needed.

#### 12.5.2 Transactional email — provider-swappable by construction

**Mailjet (EU/France)** at MVP, reached only through an `EmailPort` behind a DI token, per P-7 and D-8's adapter pattern. NFR-84 and NFR-108 need SPF/DKIM/DMARC alignment, ≥ 99% accepted delivery and — the part that eliminates most candidates — per-message bounce and complaint events fed back against the notification record (FR-157, NFR-107). Mailjet is EU-resident with a mature event webhook, so NFR-27 needs no transfer-mechanism argument.

**Switching providers must be a configuration change, not a code change**, and three rules make that true rather than aspirational:

- **No vendor type crosses the adapter boundary** (P-7). `EmailPort` speaks in platform terms — recipient, template key, locale, idempotency key — and returns a platform result. No Mailjet SDK type, error class or status string appears in `modules/*`, and dependency-cruiser enforces it.
- **Retry and suppression semantics live in the worker, not in provider configuration.** NFR-107's exponential schedule bounded at 24 hours and its hard-bounce suppression are ours. A provider that offers its own retry is told not to use it. This is what makes the swap LSP-clean: a different adapter cannot change caller behaviour, because the behaviour is not in the adapter.
- **Inbound events normalise at the adapter.** Every provider spells bounces, complaints and deferrals differently; the adapter maps them onto one platform event vocabulary before anything else sees them, so FR-157's records and NFR-109's retention are provider-independent.

The adapter set is the same shape the payment rails and `EInvoicingPort` already use (D-7, D-8), so this is the established pattern rather than a new one. Second candidate on file: **Scaleway TEM**, which consolidates to two providers and is the right swap if the Mailjet relationship fails. **Postmark** has the best transactional deliverability in the field and is US-resident. **GDPR would permit it** — the EU–US Data Privacy Framework is valid, and the General Court dismissed the Latombe challenge in September 2025 — but **NFR-27 relies on no adequacy decision and no SCCs** (amended 25 Aug 2026, `non_functional_requirements.md` OQ-16), so Postmark is excluded by the platform's own rule and not by law. Stating which of the two is doing the work matters: an adequacy decision is a dependency with a judgment date — Safe Harbour fell in 2015, Privacy Shield in 2020, and C-703/25 P is pending against the third — and a rule that rests on one has to be re-argued each time, where this one does not.

**The transport is SMTP and the provider is an environment value** (`task.md` 51.1). Every candidate above exposes SMTP, so a swap — whether forced by a failed relationship or by an adequacy decision falling — is a configuration change in the sense §12.5.2 requires, not a new adapter class. What is *not* provider-neutral is the inbound leg: bounce and complaint webhooks differ per provider and normalise at the adapter, which is where a swap actually costs work (`task.md` 51.4).

#### 12.5.3 Secrets — the open question was already half-decided

**Self-hosted OpenBao on VM-3.** §18.2 framed this as "a managed secret manager **or** SOPS-encrypted files with age keys — the choice is not made". But NFR-69 already requires secrets held "in a managed secret manager, scoped per environment and **access-logged**", and SOPS-encrypted files in a repository cannot produce an access log: decryption happens on whatever host holds the age key, unobserved. Choosing SOPS would have required an NFR amendment, not a decision. Self-hosting rather than buying follows the argument already made for observability — it keeps NFR-27 trivially true and adds no sub-processor. For a platform holding payment-rail credentials and fiscal transmission keys, a real audit log of secret access is proportionate.

SOPS + age is retained for exactly one purpose: encrypting the bootstrap `.env` that Compose needs before OpenBao is reachable. Unseal keys are split and held out-of-band, and the seal/unseal procedure is a runbook deliverable.

#### 12.5.4 CI, and what it may not hold

**GitHub Actions** on hosted `ubuntu-latest` runners. The gates were already fully specified — boundary rules, RLS probes, contract tests, coverage floors, accessibility, injection corpus, cross-browser, `BILLING_ENABLED=false` — and all of them run on a stock Linux runner: PostgreSQL 18 and Redis, Chromium via Playwright, veraPDF for NFR-82, headless LibreOffice Calc for NFR-20's CI half.

**Clarified 20 Aug 2026 (task 17): the database comes from the Compose stack, not from `services:` containers.** This paragraph said "service containers", written before `infra/postgres/init/init.sh` existed. That script creates the four roles of §7.6, and a `services:` block has no clean way to run it — so CI would carry a second copy of the role split, and the copy CI ran would be the one no developer ever executes. `pnpm dev:up` gives the roles, the health checks and the init script for free, and makes CI-versus-dev drift impossible in the one place built to catch drift. `--wait` blocks until every health check passes, so no step races a half-built cluster.

**Workflow entrypoints live in `.github/workflows/`**, which is the only place GitHub reads them; §10.7's `infra/ci` holds the composite setup action every job shares (Node, pnpm, frozen install).

**CI holds no long-lived production credentials.** Deploys use short-lived OIDC-issued credentials; CI never reads from OpenBao. A CI compromise must not be a production compromise. **Forgejo Actions** self-hosted on VM-3 is the drop-in alternative — near-identical workflow syntax — if the repository ever cannot live on GitHub.

#### 12.5.5 Provisioning, staged

Two tools with different jobs, adopted at different times.

- **Ansible** — configuration management. Describes the *state of a host*: users, SSH policy, Docker Engine, PgBouncer, pgBackRest, the node exporter, kernel parameters. It connects over SSH, needs no agent, and is idempotent, so re-running it converges a drifted host rather than duplicating work. **Adopted from foundation stage**, because host configuration drifts continuously and undocumented drift is what makes a rebuild unrepeatable.
- **OpenTofu** — infrastructure provisioning. Describes the *existence of resources*: the three VMs, firewall rules, DNS records, the Scaleway buckets and their lock configuration. It keeps a state file and computes the difference between declared and actual. It is the open-source fork of Terraform, under MPL rather than Terraform's BUSL licence, with an equivalent provider ecosystem for Hetzner and Scaleway. **Adopted when the DR runbook is written**, which is where it pays for itself: recovery becomes an apply against a second region instead of a memory of what was clicked.

The staging is deliberate. Three VMs do not need declarative provisioning for scale, and adopting both at once front-loads two unfamiliar tools onto the foundation sprint. Ansible earns its place immediately; OpenTofu earns its place at the first disaster-recovery rehearsal. The workload itself stays Docker Compose, as already specified. New directories `infra/ansible` and, later, `infra/tofu`.

**Both are deploy-path tooling and neither is a developer-workstation prerequisite.** "Adopted from foundation stage" is when the tool enters the project, not when it is installed on a laptop. They run in one of two places and nowhere else:

| | Where it runs | Installed as |
|---|---|---|
| Normal operation | The CI runner (§12.5.4) | A pinned job step, not a machine-level install |
| Initial bootstrap and disaster recovery | One operator machine | A deliberate, documented install — the estate has to exist before CI can deploy to it |

The bootstrap case is a genuine chicken-and-egg and is the only reason a person installs either locally: CI deploys to infrastructure, and infrastructure is what OpenTofu creates. Recording it here so the first VM is not provisioned by hand "just this once", which is exactly the undocumented drift Ansible is being adopted to prevent. A developer building `apps/*` or `packages/*` never needs either tool.

#### 12.5.6 Test tooling, coverage floors, rate limits and token bounds

**Jest + ts-jest** in `apps/api`, which covers HTTP and worker modes alike — there is no separate `apps/worker` package, only a second entrypoint in the same image (§5.4, §10.7). **Corrected 18 Aug 2026**: this paragraph and OQ-16 previously named `apps/worker` as a workspace package, against §10.7's tree, §5.4's container table and the §10.4 Compose file, all three of which describe one image with `MODE=worker`. Jest is NestJS's default, and AD-13 already assumes ts-jest in its argument for pinning TypeScript at 6.x. **Vitest** in `apps/web`, `apps/admin` and `packages/*` — `apps/admin` is Vite, where Vitest is native and materially faster on component suites. One documented exception costs less than forcing either runner across both sides. **Playwright** for E2E and cross-browser, already pinned.

**Coverage floors** — NFR-88 names five components and requires reporting per component, never as a project average. That per-component reporting is the requirement's real content; these are its missing values, closing `non_functional_requirements.md` OQ-10.

| Component | Line | Branch | Why |
|---|---|---|---|
| Invoice numbering | 100% | **100%** | DR-8 gapless numbering per series per year. A missed branch is a fiscal compliance defect, and the unit is small and pure, so 100% is cheap |
| VAT calculation | 100% | **100%** | Same argument. Wrong VAT on an immutable, transmitted fiscal document cannot be corrected in place |
| Emissions calculator | 95% | 90% | Feeds B3 and a published report; factor-set version pinning (DR-4) multiplies the branch count |
| Validation engine | 95% | 90% | Coverage is over the config interpreter (AD-4), with the rule corpus as fixtures |
| Entitlement service | 90% | 85% | `allow / deny / allow_with_warning` across every gated action; must hold with `BILLING_ENABLED=false` |

Project-wide floor 80%, reported alongside but never in place of the five.

**Rate limits, lockout and token bounds** — closing OQ-19 and `non_functional_requirements.md` OQ-4, whose qualitative terms left NFR-64 and FR-4's "threshold" with no pass condition.

| Control | Value |
|---|---|
| Auth paths — login, reset request, invitation accept | 5 attempts / 15 min per (IP, account); uniform response either way (NFR-64) |
| Account lockout — FR-4's "threshold" | 10 consecutive failures; released by reset link or PA action |
| Unauthenticated API, per IP | 60 req / min at `edge` |
| Provider webhooks (`/api/v1/webhooks/*`), per source IP | **600 req / min at `edge`**, a bucket separate from the unauthenticated budget; 429 beyond it, recovered by provider retry (AD-6 dedup). Alert at 70% sustained. **Set 18 Aug 2026** |
| Authenticated API, per organization | 300 req / min at `edge` |
| Export generation | 10 concurrent per organization; queued beyond, never rejected |
| Token entropy | **≥ 256 bits** from a CSPRNG; stored SHA-256, compared in constant time; single-use |
| Lifetimes | Password reset 60 min · email verification 24 h · invitation 7 days · admin session 8 h idle, 12 h absolute · **tenant session 7 days idle, 30 days absolute** (OQ-35, closed 21 Aug 2026 — idle anchors on the current refresh token's issuance so AD-12's rotation rolls it; absolute anchors on sign-in) |
| Password policy — nowhere stated before OQ-51 | ≥ 8 and ≤ 128 characters, requiring a lowercase letter, an uppercase letter, a digit and one further character. **Set 20 Aug 2026** |
| Unverified account lifetime — FR-3's "defined window" | **7 days**, after which the record is deleted and the address is registrable again. Enforced at the point of use from task 19; the reclaiming sweep lands with the scheduler in Phase 6 (OQ-52). **Set 20 Aug 2026** |
| Web session cookie — OQ-33 | One httpOnly cookie (`easyesg_session`): the AD-12 token pair, expiries and session identity **sealed** with AES-256-GCM under `SESSION_SECRET`. `Secure; SameSite=Lax; Path=/`, `Max-Age` = the refresh expiry the API stated. **Set 21 Aug 2026** |
| CSRF stance — OQ-33 | `SameSite=Lax` plus a same-origin proof on every state-changing request through the web pass-through (`Sec-Fetch-Site: same-origin`, falling back to an Origin/Host comparison where the header is absent); Server Actions ride Next's built-in Origin/Host check. No CSRF-token machinery. **Set 21 Aug 2026** |
| Admin session cookie — task 23 | One httpOnly cookie (`easyesg_admin_session`), set by the **api itself** (OQ-17): the same AD-12 pair — ≤15-min HS256 JWT + rotating single-use refresh token — plus the operator identity block, sealed AES-256-GCM. Keys derived (HKDF, distinct labels) from one `AUTH_ADMIN_SECRET`, disjoint from the tenant realm's secrets (NFR-65). `Secure; SameSite=Strict; Path=/`, host-only on the api origin. **Set 21 Aug 2026, project owner** |
| Admin realm CORS and CSRF — task 23 | The api allows exactly the configured `ADMIN_ORIGIN`, with credentials; state-changing admin-realm requests must present an `Origin` equal to it (`Sec-Fetch-Site` alone cannot tell one sibling subdomain from another, and NFR-65 treats each as its own trust zone). `Strict` rather than the web tier's `Lax` because nothing legitimate ever arrives at the api origin by top-level navigation carrying an admin session. **Set 21 Aug 2026** |
| Admin MFA — task 23 | TOTP (RFC 6238, 30 s step, ±1 window), challenged on **every** sign-in (FR-75: without exception). The secret is provisioned with the account — UC-68's own precondition — by CLI until UC-87's screens exist (task 67); enrolment UX and recovery codes land with the TOTP machinery (task 27). Shipped stored unencrypted at rest with the gap **recorded as task 27's hardening debt** rather than waved through; **that debt was paid by task 27.1 on 26 Aug 2026** and the secret is now AES-256-GCM at rest — see the secrets-at-rest row below. **Set 21 Aug 2026** |
| Admin factor challenge — task 23 review | **Five minutes**, stateless: A-01's two-step handshake (chosen by the project owner, 24 Aug 2026, over presentational staging) verifies the credential first and seals `{account, issuedAt}` into its own httpOnly `SameSite=Strict` cookie — no table, TTL evaluated at the point of use. Deliberately NOT single-use: a mistyped code stays on the factor step (A-01's recoverable "failed factor"), with guessing bounded exactly as the one-shot flow bounded it — both steps spend the same 5/15-min window, and factor failures count toward the ten-failure lockout. **Set 24 Aug 2026** |
| Social sign-in flow — task 24 | The OAuth redirect endpoints live on **`apps/web`** — `/auth/social/{provider}/start` and `/auth/social/{provider}/callback`, fixed and unlocalized, because they are the URIs registered at the provider. The api is the confidential client's **back channel**: `POST /auth/social/{provider}/challenge` builds the authorization URL (`state`, `nonce`, PKCE — generated api-side, behind `IdentityProviderPort`), and `POST /auth/social/{provider}/session` performs the token exchange and ID-token validation and answers with the **same session shape as password sign-in**, which web seals into the OQ-33 cookie exactly as task 22 does. The in-flight OIDC transaction (state, nonce, verifier, intent, return path) travels as web's own short-lived sealed httpOnly cookie and never reaches the browser readable. The alternative — passport middleware owning api-side redirect routes — was declined: only web holds `SESSION_SECRET` and only its Route Handlers may write the session cookie, so an api-owned callback would have needed a one-time handoff ticket, a second credential exchange OQ-33 never reviewed. UC-05's alternate flow is carried by an **intent** on the transaction: a sign-in-intent completion that matches no linked identity and no account **offers registration rather than silently creating an account**, and a register-intent completion against an already-registered address refuses without creating a duplicate (BR-ID-3), directing the user to password sign-in — the linking route itself is FR-8, task 27. **Set 24 Aug 2026, project owner** |
| Social provider configuration — task 24 | Split by sensitivity, resolving FR-82 against NFR-69 while OpenBao does not yet exist (§12.5.3). **Behaviour is config-store data** — kind `identity-provider`, scope per provider: enabled state, client id, issuer, scopes, redirect-URI allowlist — so withdrawing a provider lands with no redeploy today (the FR-82 clause that guards against an outage) and A-18 has data to edit in task 67. **The client secret stays an environment variable** (`AUTH_SOCIAL_<PROVIDER>_CLIENT_SECRET`, HTTP tier only, beside `AUTH_JWT_SECRET` and the pepper): a live secret in `config.entry_version` would be plaintext readable by `esg_admin_ro`, replicas and backups, against NFR-69's posture. **Recorded deferral:** FR-82's rotate-without-redeploy clause is therefore rotation-by-restart until OpenBao exists; task 67 (A-18) revisits where rotation lands with the vault in hand. **Set 24 Aug 2026, project owner** |
| Invitation resend — task 26.1 | **A resend rotates the token and restarts the seven days**, on the same invitation row. FR-57's acceptance ("a resend delivers the same invitation") is satisfied by the record, not by the string: the row keeps its id, its role and its history, so S-16 shows one line per invited person and the change trail reads as one arc. The token itself is reissued, which invalidates the outstanding link immediately and leaves **exactly one live link per invitation, ever** — OQ-55's verification precedent applied to the third token kind. Declined: re-delivering the existing link unchanged, which makes "it expired before they got round to it" unfixable except by revoke-and-reinvite; and re-delivering it with the expiry extended, which lets repeated resends make a link's lifetime unbounded, the property the seven-day limit exists to hold. **Cost accepted:** an invitee who opens the first email after a resend gets a dead link and must use the newer one. **Set 25 Aug 2026, project owner** |
| Invitation email language — task 26.1 | **The invited address's account locale where one exists, the inviting administrator's negotiated locale otherwise**, resolved once at issue and stored on the invitation row (`identity.invitation.locale`), from where it travels in the outbox payload exactly as the verification and reset events already carry theirs. FR-169 resolves language per recipient and a worker has no `Accept-Language` to negotiate; for an invitee with no account there is no preference to honour, and the inviter's is the only evidence in the request. The lookup discloses nothing — it is server-side and its result never reaches the administrator. Declined: always using the inviter's locale, which sends Romanian to an existing user who chose Russian and contradicts FR-169 in terms; and resolving on the worker at send time, which is more current but carries no fallback locale to the tier that would need it and breaks the payload shape both existing email events share. **Set 25 Aug 2026, project owner** |
| Invitation collisions — task 26.1 | **Both refused, each naming its resolving action** (NFR-79). An address already held by an **active member** answers `409` with "they already have access"; an address already holding a **pending invitation** answers `409` with "an invitation is outstanding — resend it or revoke it". Enforced by a partial unique index on `(organization_id, lower(invited_email)) WHERE status = 'pending'` rather than by a prior read, so it is the database's rule rather than the application's memory: two simultaneous invitations of one address both pass a read-then-write check and one of them is wrong. **An expired-but-unrevoked invitation is included in that refusal**, and deliberately — a partial index cannot reference `now()`, and the resolution the message names is the right one anyway, since a resend rotates the token and restarts the window, which is exactly what a lapsed invitation needs. UC-61 already gives the administrator resend and revoke, so neither refusal is a dead end. Declined: treating a duplicate invite as a silent resend, which leaves the administrator unable to tell whether they invited or nudged and makes a re-invite at a different role either a silent role change or a silent no-op; and allowing several live invitations per address, which puts duplicate rows on S-16 for one person and makes FR-57's "invalidates the outstanding link" ambiguous when there are three. **Set 25 Aug 2026, project owner** |
| Invitation mail amplification — task 26.1 | **Recorded gap, not a decision that it is fine.** `POST /invitations` and `POST /invitations/{id}/email` both cause mail to be sent to a **third party** who never asked for it, and neither is covered by the auth-path row above — that row names login, reset request and invitation *accept*, and issue and resend are not among them. The only control today is the authenticated 300 req/min per organization at `edge`, which is task 71's and does not yet exist, so an Organization Administrator can currently resend one invitation as fast as the API answers. **What holds meanwhile:** the routes are authenticated, Organization-Administrator-only and tenant-scoped, so the actor is always a named member of the organization being billed for it, and every issue and resend is attributed in `core.field_change` — this is an accountable abuse path, not an anonymous one, which is what makes deferring it acceptable where OQ-55's unauthenticated resend route would not have been. **What closes it:** an application-level throttle of the shape task 21 already built (`identity.auth_attempt` plus `domain/auth-throttle.ts`), keyed per invitation rather than per (IP, account) — the natural key, since the harm is to one mailbox. Surfaced 25 Aug 2026 by task 26.1's `nestjs-best-practices` pass (`security-rate-limiting`), which names "can be abused to spam users with emails" as the case. Task 71 must not treat these two routes as generic authenticated traffic, for the reason OQ-53 records about `register` |
| Invitation bearer read — task 26.2 | **A third transaction-local binding, `app.current_invitation`** — the presented token's SHA-256 — with a permissive `SELECT` policy on `identity.invitation` reading `token_hash = ` that value, served by its own store that binds only it (25.3's `AccountMembershipStore` shape). It states in SQL exactly what is true: *the bearer of this token may read this one row*, signed in or not. UC-15's acceptor reads the invitation **before** they are a member, so `app.current_org` is unbound and 26.1's tenant policy answers zero rows; S-03 additionally has to render the inviting organization's name to a visitor who is still signed out, which no policy over `app.current_user` can serve. It widens nothing: a request that never binds the setting matches no row, so a tenant-bound request sees exactly what it saw before. Declined: a policy on the acceptor's own email address (`SELECT lower(email) FROM identity.account WHERE id = app.current_user`), which serves the authenticated accept and leaves S-03's signed-out preview unserved — asking someone to create an account before being told which organization is asking, at the moment UC-15 step 2 has them deciding; and dropping the preview entirely, which contradicts S-03's stated content in terms. `SECURITY DEFINER` was not an option and 25.3 records why: `FORCE ROW LEVEL SECURITY` subjects the owner to its own policies, so a definer function reading this table returns nothing. **Set 25 Aug 2026, project owner** |
| Invitation and account verification — task 26.2 | **Registering while holding a live invitation token for that same address creates an already-verified account**, with no verification email — one optional field on `POST /auth/register`. This is task 24's precedent rather than a new principle: `markAccountVerified` fires when a provider vouches for **the account's own address**, and an invitation link delivered to that address is the same proof of mailbox control, arriving by the same channel FR-3's own challenge uses. What forced the question: sign-in refuses an unverified account (OQ-57's `403 email-unverified`), so an unverified account can obtain no token and can never reach the accept route — leaving a password invitee two emails and six steps, the second email arriving while they look at a screen telling them to check their inbox. Declined: leaving it, which puts that friction on the platform's main collaboration path in the April–May window; and deferring it to 26.3, which would land an API decision under a web number, the shape task 25.4 was corrected for. **Cost accepted and stated:** FR-3's verification now has two entrances, so anything later reasoning about *how* an account became verified must read both — the invitation path is recorded on FR-1 and FR-3. The token is validated exactly as acceptance validates it, so a spent, revoked, expired or differently-addressed token verifies nothing and registration proceeds as an ordinary unverified one. **Set 25 Aug 2026, project owner** |
| Active organization on acceptance — task 26.2 | **Accepting writes `identity.session.active_organization_id` to the newly joined organization**, making S-03's stated exit — "S-05 in the newly joined organization" — true for everyone rather than only for the member-of-nothing, whom `selectActiveMembership` would have resolved anyway. UX-2 requires the active organization to be a deliberate choice and this is one: the user clicked a link and accepted. Without it a bookkeeper joining their second client lands back in the first client's workspace with no sign anything happened, which is the case the multi-organization model exists for. **The third writer of that column**, after 25.4's post-sign-in branch and ahead of 30.1's switcher; the guard stays the only reader. Declined: leaving it to `selectActiveMembership`, correct for one caller and wrong for the rest; and returning the id for the switcher to apply, which is task 30.1 and would need an interim of the kind 25.4 existed to delete. **Set 25 Aug 2026, project owner** |
| Acceptance by an existing member — task 26.2 | **The invitation is consumed, the member's role is left untouched, and the call succeeds.** Reachable by a race with 26.1's membership check or by an administrator granting access by hand between issue and acceptance. The invitation's purpose — this person has access to this organization — is already true, so the caller gets what they came for, the row stops holding the invited address against the partial unique index, and a link clicked twice behaves the same as a link clicked once. **The role is deliberately not applied:** changing an existing member's role here would be a privilege change through a path FR-58 and UC-62 do not own, and the audit trail would show a role change nobody performed. Declined: refusing with a `409`, which shows an error for a state that is entirely fine and leaves the row holding the address until an administrator notices; and applying the invited role, which lets an invitation issued before a promotion silently demote its holder. A **removed** member is the different case and was already decided — task 25.1's migration reactivates the existing row at the invited role, since the unique constraint over `(account, organization)` admits one row ever. **Set 25 Aug 2026, project owner** |
| Invitation throttling — task 26.2 | **The auth-path row above names invitation accept, and task 26.2 is where it was built.** `POST /invitations/acceptance` is throttled at 5 attempts / 15 min per **(IP, account)** — the specified key, buildable here because the route requires a session, unlike the social path whose account is unknowable before its exchange. **`POST /invitations/preview` carries no application-level throttle**, which task 26.3 corrected after writing one. §12.5.6's row names invitation *accept*, not the preview, and the key it specifies is unbuildable on a route whose entire purpose is serving someone with **no account** — so the first attempt keyed it per IP alone, which made every invitee behind one office NAT share a five-per-quarter-hour budget and refused the sixth colleague to open their invitation. The browser suite hit it on its second test. What bounds that route is the edge's 60 req/min per IP, exactly as it bounds `/auth/register` and `/auth/verification-email`, the two other unauthenticated token paths (OQ-53 and OQ-55 record the same reasoning); guessing is bounded by arithmetic besides, the token being 256 bits. The accept throttle reuses `identity.auth_attempt` and the one shared implementation, so the three paths §12.5.6 names cannot drift on what an attempt is. **The defect this closed, found by task 26.2's `nestjs-best-practices` pass rather than by a gate:** acceptance originally threw its refusals from inside its own transaction, which would have rolled back the very `auth_attempt` row the throttle rests on — so every refusal would have cost the caller nothing and the limit would never have bitten. It now returns an outcome and throws after the commit, which is the shape `RequestPasswordReset` already had and the trap `apps/api/CLAUDE.md` records from task 21. Asserted over real HTTP: a sixth attempt answers `429` while the person the invitation names is unaffected, because the key is per (IP, account). **This does not close 26.1's amplification row** — that one is about issue and resend, which send mail to a third party and remain bounded only by task 71's edge limit |
| Invitation round trip — task 26.3 | **The invitation rides the URL across the S-03 → S-01 → S-03 hand-off**, as `?return=` plus an invitation parameter on the registration route — not a sealed cookie. The token is already a path segment on S-03 (the route `[locale]/(identity)/invitation/[token]` has existed since task 4), so a query parameter on S-01 opens no new class of exposure: both land in the same browser history and the same server logs, and the only outbound links on either screen are the footer's same-origin legal documents, so no `Referer` leaves the origin. It is also inspectable, which keeps the flow debuggable and the browser test readable. Declined: sealing it into a short-lived httpOnly cookie, the pattern task 24 uses for the OAuth transaction — that one carries `state`, `nonce` and a PKCE verifier, values that exist **only** for the round trip and must never be readable, whereas this token is sitting in the address bar either way; a second codec and lifetime would guard a value already in plain view, and would fail invisibly when the cookie is dropped. **What holds it:** the token is single-use and time-limited (§12.5.6), the preview consumes nothing, and acceptance is an explicit POST — so a link that leaks from history is bounded exactly as the verification and reset links already are. **Set 25 Aug 2026, project owner** |
| `?return=` precedence, refined — task 26.3 | **A deep link is honoured whenever its destination can render**, which task 25.4 stated more narrowly as "only when an organization resolves". That override was written for a real reason and keeps it: returning a member-of-nothing to a route inside `(app)` lands them on a screen that cannot render without a bound organization, and a preserved intention that cannot be honoured is not preserved. What the reasoning never covered is a destination **outside** `(app)`. S-03 is the case that found it: `/invitation/{token}` renders perfectly for someone who belongs nowhere, and is the one deep link such a person must be returned to — a registration handed off from an invitation was landing on S-04 with the invitation lost, which the browser suite caught. The override is now scoped to destinations that need a session, read from **the proxy's own list** (`apps/web/src/lib/route-access.ts`, moved there from `proxy.ts` in this task) rather than from a second one: the closed-by-default session gate and this branch must not disagree about which routes those are, and a route needing no session needs no organization. The two `(app)` screens that need an organization-free session — S-04 and S-35 — are deliberately outside the set, so the rule errs toward the branch's default rather than toward honouring a link that cannot render. **Set 25 Aug 2026, project owner** |
| Secrets at rest — task 27.1 | **One mechanism, one key, and the store is what refuses plaintext.** A *recoverable* secret is sealed AES-256-GCM under a 256-bit key HKDF-derived from **`SECRET_ENCRYPTION_KEY`** (HTTP tier, undefaulted for the pepper's reason), stored as `v<n>.<base64url(iv|tag|ciphertext)>` in a column whose TYPE pins that shape — **`identity.encrypted_secret`, a domain over `text`**, not a per-column `CHECK`. A type is what makes the deliverable's own wording literally true: a base32 TOTP secret is **unrepresentable**, and the refusal binds the api, the provisioning CLI and an operator at a `psql` prompt alike (P-4). The two populations are separated by alphabet rather than by luck — base32 draws from `A-Z2-7=`, and the envelope's lowercase `v` and its `.` are outside that set. A later sealed column declares the same type and cannot drift on what "sealed" means. Its own variable rather than a third HKDF label on `AUTH_ADMIN_SECRET`, and the reason is lifetime, not tidiness: rotating a session secret costs one forced refresh and **no data**, while rotating an at-rest key requires re-encrypting every row — so sharing one would make a routine session rotation silently destroy stored secrets, and would hang task 27.2's *tenant* secrets off the admin realm's credential that NFR-65 keeps disjoint. Encryption is a **persistence** concern and lives at that boundary: the store adapter seals on write and opens on read, exactly as OQ-50 puts the epoch-ms conversion there, so no use case, domain type or DTO knows the column is encrypted. Opening failure **throws**, deliberately unlike the session cookie's `null`: a cookie that will not unseal is an ordinary visitor, whereas a secret that will not open is a wrong key or a corrupt row, and degrading that to "wrong code" would present a misconfiguration as an operator's own typing. Applies today to `identity.admin_account.totp_secret` (task 23's recorded debt, paid); task 27.2's tenant secrets inherit it. **Set 26 Aug 2026, project owner** |
| At-rest key rotation — task 27.1 | **The envelope carries the key version; exactly one key is live, and re-encryption is a recorded deferral.** NFR-61 requires rotation at least annually and on personnel change, so the *format* admits it from the first row written — the adapter refuses an envelope written under a version it does not hold, naming the mismatch, rather than failing as "corrupt". What is **not** built is a second key: no previous-key variable and no decrypt-under-either precedence, because that would ship a mechanism for a rotation nobody has scheduled and make OQ-13's OpenBao decision more expensive rather than less. **What has to change if the assumption is wrong:** a rotation before OpenBao exists is a maintenance job that reads every classified secret column under `v<n>` and rewrites it under `v<n+1>`, run once with both keys present — the same shape as task 27.1's own migration, which is the worked example. **Set 26 Aug 2026, project owner** |
| Secret-column classification — task 27.1 | **"A plaintext secret is unrepresentable" is a gate, not a review note.** `test/schema-invariants.e2e-spec.ts` classifies every column of the five domain schemas that holds a secret: an **encrypted** one must be of the `identity.encrypted_secret` domain, and anything else must be named as plaintext-by-design with its reason (a one-way hash is not a secret at rest, and encrypting it would add a key whose loss destroys every password in the system). A column named `%secret%` or `%password%` that is in neither list fails the gate. The candidate patterns stop there deliberately — `token` and `_key` would sweep in `idempotency_key`, `attempt_key` and every `token_hash`, and a rule producing more noise than signal is one that gets switched off rather than satisfied. That is what makes task 27.2 inherit this decision by construction instead of by memory — the same shape §7.10's audited/not-audited classification already uses, and for the same reason: a rule that matches nothing looks exactly like a rule that passes. **Set 26 Aug 2026, project owner** |
| Tenant second factor — task 27.2 | **Opt-in TOTP over task 23's parameters, and deliberately not task 23's tables.** NFR-95's factor uses the same RFC 6238 shape the admin realm proved (SHA-1, 6 digits, 30 s step, ±1 window, `otpauth` per §12.1) and its own storage: NFR-65 keeps the realms disjoint, so a tenant factor may not live on `identity.admin_account` and a tenant sign-in may not resolve an elevated credential. The secret is `identity.encrypted_secret` from **task 27.1**, which is why that slice ran first — the tenant table inherits encryption at rest rather than shipping plaintext and being migrated twice. **Enrolment is two steps and activation needs the second**: a secret is issued, and the factor becomes active only when a current code proves the authenticator captured it, because activating on issue alone locks out anyone whose scan silently failed. **Enrolling and disenrolling both require the current password** — FR-8's rule for linking a provider, applied for the same reason: a second factor is the control that survives a compromised session, so a compromised session must be unable to install or strip one. A **provider-only account has no password row** (FR-2), and there the session stands as the credential — a recorded assumption, not a decision that it is equivalent; what changes if it is wrong is one re-authentication step routed through task 24's provider flow. **Set 26 Aug 2026, project owner** |
| Recovery codes — task 27.2 | **Ten codes, sixteen Crockford base32 characters each (~80 bits), SHA-256, single-use, shown exactly once.** §12.5.6's token row above specifies ≥ 256 bits for emailed links, which is a different object: a recovery code is transcribed by a person, so entropy is bounded by what a human will copy. Eighty bits is the figure that keeps an **offline** attack on a stolen database dump pointless, where the fifty bits of a ten-character code would not — and online guessing is bounded by the auth-path throttle and FR-4's lockout either way. **SHA-256 rather than Argon2id**, on the same reasoning this section already applies to its tokens: the input is high-entropy, so a slow hash buys nothing against a dump, while it would cost real time on every attempt — codes are indistinguishable until matched, so verification tries each in turn and Argon2id would turn a sign-in step into a denial-of-service lever. Crockford's alphabet because the reader is retyping from paper and `0`/`O` and `1`/`I` are where that goes wrong. **Re-issuing replaces the whole set**, so a set half-spent has no residue, and exhausting the set is a designed state the user is warned about before it arrives (UC-195). **Set 26 Aug 2026, project owner** |
| Tenant factor challenge — task 27.3 | **The admin realm's stateless five-minute challenge, with the transport changed because it has to be.** OQ-17 lets the api set the *admin* session cookie, so that realm's challenge rides one; OQ-33 gives the tenant session cookie to `apps/web` and AD-9 makes the api an ordinary back channel that sets no tenant cookie at all. So step one answers a **sealed opaque challenge in the response body** — `{ accountId, issuedAt, kind }` under AES-256-GCM, keyed by HKDF from `AUTH_JWT_SECRET` under a distinct label, which is `JwtAdminTokens`' one-secret-two-keys split applied to the tenant realm and adds no environment variable. `apps/web` holds it in its own short-lived httpOnly cookie exactly as it holds task 24's OAuth transaction; the api never learns where the client kept it. Everything else is §12.5.6's admin factor row unchanged: **no table**, TTL evaluated at the point of use, and **deliberately not single-use** so a mistyped code stays on the step rather than sending the reader back to the password. A challenge is not a session and cannot become one: it carries no token, and presenting it without a valid code yields nothing. **Set 26 Aug 2026, project owner.** **Amended 27 Aug 2026 after review:** the completion **reads** FR-4's lock as well as writing to it. It incremented `failed_attempts` and never checked `locked_at`, so `AccountLockedError` was unreachable on this route — a challenge issued moments before a lock still minted a session, and S-01's lockout state was dead code on the screen. Written-and-not-read is the one shape a security control must never have. The check sits before the code is verified, which is `SignIn`'s ordering and its reason. Two facts follow and correct an earlier claim here: the counter enters this step at **zero**, because the password success that produces a challenge clears it, and the window admits five attempts against a five-minute challenge — so **ten consecutive failures is not a state this step can reach alone**, and what actually bounds guessing is the throttle rather than the lockout. |
| Sign-in's unchallenged path is unchanged — task 27.3 | **One route, one discriminated answer**, rather than the admin realm's two-call handshake. `POST /api/v1/auth/session` still answers a session for an account with no factor — the overwhelming majority, since NFR-95 is opt-in — and answers a challenge instead for an account that has one; `POST /api/v1/auth/session/factor` completes it. Splitting the tenant flow into `challenge` → `session` the way UC-68 splits the admin one would impose a second round trip on every user to serve a minority who opted in, which is what the task row means by *without changing its unchallenged path*. **The challenged answer is a 200 rather than a problem document**: nothing failed, and NFR-79's three-part refusal shape has nothing to say about a step that is proceeding normally. What it does disclose is that this account has a factor — to someone who has already presented the correct password, which is the only point at which that is knowable, and NFR-64's uniform-response clause is about the credential step that precedes it. **Set 26 Aug 2026, project owner** |
| Re-authentication throttling — task 27.5 | **Every route that asks for the current password behind an existing session is throttled at 5 attempts / 15 min per (IP, account), under its own `reauthentication:` key.** The paths are `POST /account/password` (FR-7) and task 27.2's three password-gated TOTP routes, **retro-fitted here** — they shipped 26 Aug 2026 with no application-level bound, which this row corrects rather than leaves. The reason is that such a route is a password *oracle* reachable by someone who holds only a stolen session: the edge's authenticated budget is 300 req/min per organization, so an unbounded route yields eighteen thousand guesses an hour against a value people reuse across services. Naming the path rather than letting it inherit is the precedent OQ-53 and OQ-55 set. **Its own key, not sign-in's**, for `adminSignInThrottleKey`'s reason — a user fumbling their password on a settings screen has not been probing the sign-in page, and neither budget should exhaust the other. **It is deliberately NOT wired to FR-4's lockout**, unlike sign-in and the factor step: the caller has already proved possession of a session, and a mistyped password on a settings screen must not be able to sign them out of every device. Rate without lockout is the whole of what this buys, and it is what the requirement asked for. **Set 27 Aug 2026, project owner.** **Amended 27 Aug 2026 after review, twice.** *(a)* The window is now **one function**, `admitAuthAttempt`, beside the keys it spends: the count-record-compare shape had been written four times — the factor step, both re-authentication paths and the password change — and all four **recorded the attempt before deciding**, which inverts this section's own rule that a refused attempt is not recorded. The effect is that a hammering client re-arms its own block on every request, so it never drains; the person hammering is usually the account's owner, retrying after a mistype. `SignIn` was the only correct copy, and being right in one copy of four is not a property that survives. *(b)* `TotpService` was **not forwarding the client IP**, so the three TOTP routes built `reauthentication:unknown:<accountId>` while `POST /account/password` built the specified per-(IP, account) key — two different keys, which made this row's own claim that a settings screen has one budget false in the shipped code. |
| Session revocation on a password change — task 27.5 | **A fourth `revoked_reason`, `password_changed`, added by migration rather than borrowing `password_reset`.** The column exists so that a user reporting an unexpected sign-out can be told which of the causes it was — task 21's migration says so in terms — and a change made from a settings screen is a different event from a reset link consumed by someone locked out. Reusing the reset value would make the trail state something untrue about an account the user still holds, which is the one thing an audit column must not do. FR-7's termination is **opt-in**, since the requirement says *where the user elects it*, and it spares the **current** session by construction: revoking it would sign the user out of the device they just changed their password on, which is not what "other active sessions" means. **Set 27 Aug 2026, project owner** |
| Enrolment confirmation is throttled — task 27.2, corrected 27 Aug 2026 | **`POST /account/totp/confirmation` shipped with no window at all, and it is the route that most needed one.** The row above threw a budget at the three TOTP routes that take a *password* and passed over the fourth, which takes a *code* — and answers a correct one with **ten recovery codes**. The asymmetry is backwards: a password is a secret the caller either knows or does not, while six digits is a space of 10^6 that an unbounded caller walks at the edge's 300 req/min. The reachable case is ordinary rather than contrived — `begin` stores the secret **inert**, so an abandoned enrolment is a normal state, and a caller on a stolen session who finds one can guess against it until a hit hands them a credential set that outlives the owner's password change. Bounded now at 5 / 15 min under **its own `totp-confirmation:` key**, for `adminSignInThrottleKey`'s reason: someone mistyping the code their authenticator is showing has not been probing passwords, and neither budget should exhaust the other. Like the re-authentication window and unlike sign-in's, it does **not** feed FR-4's lockout — the caller holds a session, and a fumbled enrolment must not sign them out everywhere. **Set 27 Aug 2026** |
| Provider link and unlink — task 27.6 | **The authorization half is task 24's, reused unchanged; only the completion is new and authenticated.** `POST /auth/social/{provider}/challenge` builds an authorization URL from a provider and a redirect URI and knows nothing about who is asking — no actor, no intent, no secret — so a link begins on exactly the route a sign-in does. What differs is where the code is redeemed: `POST /api/v1/account/providers/{provider}` attaches the assertion to the **caller's** account, and it must be authenticated, which `@Public()` makes impossible on the `/auth/social` controller — that decorator short-circuits `AuthGuard` before any token is read. `SOCIAL_SIGN_IN_INTENT` gains **`LINK`** so the web tier's sealed transaction knows which completion to call on the way back; the state, nonce and PKCE are the same values task 24 already carries. **Both operations require the current password** (§12.5.6's re-authentication row, one key with the second factor and the password change): a link adds a *way in*, and a stolen session that could attach the attacker's provider would survive the very remedy its owner reaches for. A provider-only account has no password and there the session stands as the credential — task 27.2's recorded assumption, unchanged and not widened. **Set 27 Aug 2026, project owner** |
| The last credential is counted, never assumed — task 27.6 | **BR-ID-4 is one predicate over both credential kinds**: the password row plus the provider identities. Unlink is refused when it would leave zero, which is *not* the same as "refuse to unlink the only provider" — an account with a password and one provider may unlink it, and a provider-only account with two may unlink one. UC-12 states the consequence the refusal exists to prevent: an account with no usable credential is unrecoverable **and takes its organization memberships down with it**. The count is taken inside the same transaction as the delete, because a read-then-write would let two concurrent unlinks each see two credentials and both proceed. **Set 27 Aug 2026, project owner** |
| The link round trip on the web tier — task 27.7 | **The password is collected after the provider returns, never carried across the redirect.** `/auth/social/{provider}/callback` already consumes the sealed transaction and completes a sign-in; for `intent=link` it instead **re-seals the transaction** — the same httpOnly `SameSite=Lax` cookie, same five-minute bound — and redirects to S-28, which asks for the current password and posts it with the transaction to `POST /account/providers/{provider}`. Sealing the password into the transaction before leaving was declined: the cookie is httpOnly and sealed, but it would still be a live password in browser storage for the duration of a provider round trip, and nothing else in this product stores one anywhere. A re-authentication token was declined as a fourth credential kind invented to save one prompt. **The start route becomes session-gated for this intent only** — a link has no meaning without an actor, and `beginSocialFlow` reads the session it already has rather than trusting the `intent` parameter. **Set 27 Aug 2026, project owner.** **Amended 27 Aug 2026 after review: the same question has to be asked at the END.** Gating the start proved a session existed a provider round trip ago; nothing checked that the session *confirming* the link is the same one. The re-sealed cookie is path-wide and lives five minutes, so a session that ends in between — expiry, sign-out, a shared machine — leaves it standing, `/account/credentials` bounces to sign-in, and whoever signs in next is offered a confirmation that would attach someone else's provider identity to their account. The cookie now carries the **account id** that began the link; the callback refuses outright when no session remains, and both the screen's pending state and the completing action require the held id to match the live session. |
| The factor step on the web tier — task 27.8 | **Its own route, `/sign-in/factor`, and the challenge never leaves the server tier.** `design_spec.md` §5.1 calls this a *staged step* of S-01 and it is one route all the same — S-02 is the standing precedent, one `S-nn` over `/verify`, `/reset` and `/set-password` — because UX-4 wants an addressable state addressable, and because a two-mode `/sign-in` would have to conditionally suppress the provider buttons, the register link and the reset link, which is the shape that ends up half-suppressed on one path. What makes it *staged* is the precondition, not the URL: the route renders only while the sealed challenge is held, and opened directly it redirects to the password step. **The challenge rides an httpOnly `SameSite=Lax` cookie sealed under `SESSION_SECRET`** — task 24's OAuth-transaction shape, and for its reason: the value proves this API verified this account's password moments ago, and a page whose DOM carried it would put that proof exactly where the sealed cookie exists to keep it from. Only `expiresAt` reaches the browser, so the step can say how long is left without knowing the policy. **The cookie is not single-use either**, matching the API's own stance: a mistyped code puts it back, so a wrong answer costs the reader a retype and not their password. `?return=` rides inside it rather than in the URL, so UX-38's deep link survives a step the reader may spend a minute on. **A lapsed challenge is its own outcome, not `unreachable`** — nothing failed to reach the API, and "try again" is the wrong sentence for a step that cannot be tried again; the screen says *sign in again* and offers S-01. **Set 27 Aug 2026, project owner** |
| Admin sign-in in the system audit log — task 28.4 | **Task 23's deferral, paid: every admin sign-in attempt is a row in `audit.system_audit_log`.** A-01's artboard carries a LOGGED disclosure and task 23 **omitted** it rather than shipping a screen that stated something untrue; this is what makes it true, and the note ships with it. Both outcomes are recorded — a completed sign-in and each way one fails (wrong credential, wrong factor, locked, throttled) — because a log that held only successes would answer *who got in* and not *who tried*, which is the question an operator opens it for. **The row gains a pseudonymous `subject`, and the shape is the decision** (project owner, 27 Aug 2026). The table carried `actor_id` and no free-text column, so an attempt against an address that matches no account was unattributable — recorded as *a failed admin sign-in happened*, with nothing to group repeated probing by. `subject` is the **SHA-256 of the normalised presented address**, never the address: it makes "all attempts against this address" one query while the table, which is append-only and retained 24 months (§12.5.7), never holds personal data it could not later remove. Normalised through `emailIdentityKey` so the grouping survives casing, and `bytea` like every other hash in this schema. It is recorded on **every** attempt including successful ones, because `subject` is what the caller presented and `actor_id` is what resolved — two different facts, and conflating them would make the grouping stop at the outcome boundary. Added by expand→migrate→contract, which task 14's own migration anticipated for this table. Considered and declined: the address in clear, which is what a security log usually carries and which an append-only 24-month table cannot take back. | NFR-30, FR-81, FR-159, §12.5.7 |
| The global tier's two halves — task 30.1 | **The switch is split from the tier and appended as task 83, and the tier ships without it** (project owner, 29 Aug 2026). §4.2's global tier carries the *organization switcher*, and switching writes `identity.session.active_organization_id` — a column with three writers (25.4's branch, 26.2's acceptance, 29.1's founding) and **no route a user can call**. The routes were `PUT /api/v1/session/organization`, chosen over `POST /memberships/{id}/activation` (which names the membership when what changes is the session) and `PATCH /session` (a body that grows where today there is one mutable property). Building it inside 30.1 was declined in favour of appending it, so the global tier is not held behind a new route, a new use case and a permission row. **What ships meanwhile is the organization as a plate, not a trigger**: it carries no caret, because a control that cannot act is worse than an absent one — the same judgement the tier's link set makes. **UX-2 is met, and that needed a second decision.** Nothing told a caller *which* organization the request resolved to: `GET /organization` is `@RequiresRole(ORGANIZATION_ADMINISTRATOR)`, so a viewer or an editor could not read it, while UX-2 binds every authenticated screen for every actor. `GET /memberships` therefore answers **`active`** on each row — `AuthGuard`'s own `selectActiveMembership` result, already on the request context, projected onto the read that carries the names. That **reverses a sentence task 25.3 wrote** on `AccountMembershipResponseDto` ("No `isActive` flag, deliberately"): its principle — only the server resolves the active organization, once, per request, from the session — is kept and is exactly how the field is computed; its premise, that a caller could learn the resolution some other way, was false. Declined: a new `GET /session` returning the resolved context, which is a route rather than a field and belongs with task 83. | FR-12, UC-16, UX-2, AD-2, AD-12 |
| What the tier carries on day one — task 30.1 | **Only the destinations that render** (project owner, 29 Aug 2026). §4.2 names four things in the global tier and two have no screen: S-26 is task 50.2, and the help centre's placement across both chromes is **task 77.5's**, which its own row claims in terms. A chrome entry leading to a page that returns `null` teaches the reader the product is broken rather than unfinished — `WorkspaceNavigation`'s stated rule, applied again — and a greyed one is worse still, since UX-1 requires a boundary to be explained by the screen enforcing it. The same decision moves **S-28 out of the workspace tier**: task 27.7 put credentials there because no account corner existed, and §4.2 puts it under the user menu, so 30.1 is where that correction was always owed. **The artboard's switcher note is deferred with autosave** — *"switching keeps this draft saved"* states a guarantee nothing implements until task 35.2, and task 23 set the precedent by omitting A-01's note rather than shipping it untrue. **The per-organization detail line is role only**: the artboard draws *"Organization admin · 1 entity"*, and a count is a cross-tenant aggregate outside the bound organization — the widening task 25.3's `app.current_org IS NULL` conjunct exists to prevent. **No initials on the avatar**, because `design_spec.md` OQ-16 is open and registration collects no display name (UC-01); initials cut from an address are an identity the product never captured, shown to the person they are wrong about. | UX-1, UX-2, UX-89, OQ-16 |
| Reporting currency, deferred — task 30.2 | **There is none, and MDL is assumed** (project owner, 29 Aug 2026, closing `design_spec.md` OQ-20's currency half). S-04's artboard draws a *Reporting currency* field with real behaviour attached — *"changeable until the first figure is entered"* — and no document in the set carries the concept: every currency in the requirements is billing's (FR-86 prices, FR-110 order totals, FR-129 the BNM rate, FR-150 MDL equivalents), and no Basic-module disclosure holds a monetary amount, UC-28's B10 being minimum-wage *compliance*, bargaining coverage and training hours with the pay gap as a percentage. **The assumption, stated so it is not silent:** the platform serves Moldova-resident SMEs, BR-INV-5 already makes MDL the ledger currency, and any monetary figure a disclosure needs is denominated MDL — so a per-organization *choice* is an abstraction with one member, which is what the open-question protocol forbids coding around. **What must change if it is wrong:** `C8 — revenues from certain sectors` (UC-190) is the first disclosure that could carry a figure in another currency, and task 79.8 is where the standard's own shape becomes knowable; a currency added then is a column on `core.organization`, a field on the create and patch DTOs, and a pin on the report beside its template and taxonomy versions (DR-4) — cheap while no report exists, which is why the deadline is task 31 rather than task 79. **Declined:** adding the column now on P-11 grounds, since P-11 orders what is expensive to retrofit and does not license a field no FR, UC or NFR asks for. | BR-INV-5, DR-4, UC-190, `design_spec.md` OQ-20 |
| Activity classification stays on the entity — task 30.2 | **FR-17 governs and S-04 collects no activity code** (project owner, 29 Aug 2026, closing `design_spec.md` OQ-20's other half). The artboard puts *Primary activity (CAEM-2)* on the organization and claims it *"determines which sector questions appear in your report"*. The claim's premise is sound — conditional applicability is sector-driven, which `problem_overview.md` states for water — but its placement is not: FR-17 puts NACE code(s) on the **reporting entity**, and §9.6's own decision of 28 Aug 2026 registered CAEM Rev.2 as configuration scoped by country **for entities**. Collecting it on the organization as well would give applicability two sources that can disagree, and for a multi-entity organization the entity's code is the correct one — the same class of defect AD-2 and UX-2 prevent for tenancy, where a second source is only ever wrong. The artboard is drawing the one-entity shortcut most SMEs will experience; S-13 (task 30.4) is where the code is actually collected. | FR-17, §9.6, `design_spec.md` OQ-20 |
| Attribution on the organization read — task 30.3 | **`GET /organization` answers `updatedBy`, read from `core.field_change` and not from a column the application maintains** (project owner, 29 Aug 2026). §5 lists change attribution among the Record archetype's fixed elements and the read answered `updatedAt` with no actor, which is `design_spec.md` OQ-19's gap on a second screen. The alternative shapes were both worse: an `updated_by` column on `core.organization` written by the use case is a **second** writer of a fact FR-15 already makes the database's — task 14's capture trigger records the acting user per field, unbypassably and as `SECURITY DEFINER` — and two writers of one fact drift with nothing to notice. So the read takes the newest row for this record from the trail that already exists, over `field_change_record_idx`, whose leading columns are `(organization_id, table_name, record_id, occurred_at DESC)` — the index this query is the reason for. **`actor_id` carries no foreign key**, deliberately (task 14: an attribution must survive the account it names), so the join to `identity.account` for a displayable address is a left join and the DTO's actor is nullable: a change made by a since-erased account still states the field and the moment. **This is not S-12.** One row for a line of text is not the trail, and the trail is task 84 — appended the same day, after this question found that the screen §4.4 names had no task at all. | FR-15, FR-54, UC-47, `design_spec.md` OQ-19 |
| The report-cover contact — task 30.3 | **A real profile field, and FR-15 is amended to say so** (project owner, 29 Aug 2026). `EasyESG Organization Admin.dc.html` draws a *Contact for reports* region on S-15 — a name and an address *printed on the report cover* — and no FR, UC or NFR mentioned one; unlike the artboard's other three extras it traced to nothing rather than to another screen. **It is a second contact, not a rename of the first**, which is what makes it a field rather than a relabelling: the platform writes to `contactEmail` *about* the organization, while this is the person a reader of the published report contacts *about its content*, and in an SME those are routinely different people. Collected on **S-15 only** — S-04 stays at UC-49's four fields, since a founding screen has no report to put a cover on. The columns join `core.organization` and are captured by the same trigger as every other field, so the attribution above covers them with no further work. **Declined:** letting task 44.3's PDF pipeline invent a cover contact from `contactEmail`, which would put a product decision inside a renderer and make the printed value unexplainable on the screen that owns the profile. | FR-15 (amended), UC-50, task 44.3 |
| The activity classifier is offered, not only validated — task 30.4.1 | **`GET /api/v1/entities/nace-codes?q=` searches server-side and answers code + label in the negotiated locale** (project owner, 29 Aug 2026). §9.6 registered CAEM Rev.2 as configuration and the write path admits a code against it, but nothing let a screen *offer* one — S-13 would have had a free-text field for a classifier no SME owner has memorised, and a raw code on screen besides, which the user-facing-text rule forbids. **Not `/organizations/legal-forms`'s shape**, and the difference is size rather than taste: that vocabulary is ten keys and ships whole, this is 996 entries and 182 KB before English existed. Shipping it to the browser to filter there is the one thing the root layout's `messages={null}` exists to prevent (NFR-43), so the search runs where the data already is and returns a bounded page. **The match is over code *and* label, diacritic-insensitive**, because the reader is looking for their trade and types `cereale` or `Chisinau`. | FR-17, AD-4, NFR-43, OQ-43 |
| CAEM's English labels were sourced, not written — task 30.4.1 | **996 English names taken from NACE Rev. 2 itself, through the EU Publications Office SPARQL endpoint, and verified against the seed before use** (29 Aug 2026). §9.6 records that CAEM Rev.2 is harmonised 1:1 with NACE Rev.2 to four characters, so the English is a *published list to match on code* rather than a translation to author — which matters because the alternative was 996 sentences composed from memory, the failure §9.6's own note calls "the IDNO mistake with a thousand opportunities to make it". **The verification is the point.** The endpoint answers 996 concepts under `http://data.europa.eu/ux2/nace2/`; the seed holds 996 codes; the two sets are **identical with nothing on either side only**, and both split 21 / 88 / 272 / 615 across section, division, group and class. That agreement between an external standard and a document independently typeset by the Moldovan Bureau is what makes the merged seed trustworthy. **Section names arrive upper-cased** because NACE typesets them so; they are kept verbatim, since editing sourced data is what the discipline exists to prevent, and the picker deals overwhelmingly in classes. | FR-17, NFR-2, §9.6 |
| `Combobox` enters the inventory — task 30.4.1 | **Built in `packages/ui` as §11.5's own Form-controls entry** (project owner, 29 Aug 2026), with every applicable §8.1 state before any instance (UX-8, UX-90). S-13 is its first consumer and not its only one: task 30.5's entity picker and the wizard's are next, which is exactly what UX-89 means by *reviewed once and reused*. **Radix publishes no combobox primitive**, so it composes `Popover` with a filtered listbox rather than adopting one — §11.5's own rule is that the reference sheet's library column binds only where Radix is named, and here it is not. Declined: offering NACE's 21 sections through the existing `Select`, which needs no new component and leaves FR-17 unsatisfied, since B1 exports a four-character code. | UX-8, UX-89, UX-90, §11.5 |
| Resolving codes a record already holds — task 30.4.2 | **`GET /entities/nace-codes` takes `codes=` beside `q=`, and the search route grows a second mode rather than the entity read growing labels** (project owner, 29 Aug 2026). S-13's Index and Record both have to render an entity's activity as words, and `GET /entities` answers bare keys — `["10.71"]` — which is an internal identifier on a screen. Task 30.4.1's `?q=` is the wrong shape for it: searching by each code in turn is one request per code and matches by *prefix*, so `10.7` would answer three rows where one was asked for. **Declined: labels on `ReportingEntityResponseDto`.** It is the `organizationName`-on-a-membership pattern and would have been one fewer request — but it puts the classifier's wording inside every entity payload including the writes that echo one back, and makes a vocabulary change rewrite the shape of a record it does not belong to. One request labels every code on a page, through the same classifier read and the same locale fallback. | FR-17, AD-4, OQ-43 |
| S-13's two sub-steps ship as one commit — tasks 30.4.2 and 30.4.3 | **Built in sequence and committed together** (project owner, 29 Aug 2026). The rows stay separate because they are the plan's record of what was done, but an Index whose primary action and every row action lead to a screen returning `null` is the shape ruled against twice in this same phase — task 30.1's tier omits notifications and help for exactly that reason. The Index's create affordance is not optional either: §4.6 requires the first-use empty state to offer the action that creates the object, so an Index without it is the archetype missing its defining element. Task 27.7 set the precedent when 27.8 turned out to be inside it, recorded on both rows rather than merged away. | §4.6, UX-1 |
| S-05 ships one empty region, not three — task 30.5 | **UX-6's three regions are all report-derived and reports are task 31's, so the home draws a single explicitly-empty report-status region** (project owner, 29 Aug 2026). *What needs my attention*, *where did I leave off* and *what is the state of everything* are three questions about the same absent object; drawing three empty boxes above the fold teaches a reader that two thirds of their home is broken, where one region named for what it will hold says the product is unfinished here — which is true, and which §4.6's empty-state rule asks a state to *teach*. Task 32.4 splits it into UX-6's order once there is data to order. **The heading names the organization rather than the reader**: *"Good afternoon, Ana"* needs a display name registration does not collect (`design_spec.md` OQ-16, open) and a time of day a Server Component cannot know for the reader, while the organization's name is what UX-2 already requires on every screen. Declined: greeting by email address, which greets somebody by an identifier; and a client-side clock, which buys a nameless greeting for a Client Component on the most-visited screen in the product. | UX-6, UX-2, FR-23, OQ-16 |
| The arrival sentence travels in the address — task 30.5 | **`POST /invitations/acceptance`'s `grant` reaches S-05 as `?joined=`**, following task 24's `?notice=` shape on S-01 and for its reason: an outcome the next screen must state, carried where it is inspectable rather than in a second sealed cookie. Without it the three grants are indistinguishable — somebody who **already had access** sees exactly the landing a new member sees, which is the defect a review recorded on 26 Aug 2026 and left to this row. The parameter is its own name rather than `notice`, because the two vocabularies are different sets on different screens and one name over both is how a value from one starts rendering on the other. | UC-15, FR-11, `MEMBERSHIP_GRANT_KIND` |
| Task 33.1 is pulled ahead of 31.3 — task 31 | **The taxonomy registry is built before the report table that pins it** (project owner, 29 Aug 2026). DR-4, FR-66 and BR-VER-1 require every report to carry an explicit template and taxonomy version, and **no version existed anywhere** — no config artefact, no table, no constant — because task 33 registers them and the build order puts it after 31. Declined: seeding a minimal version artefact in task 31 for 33.1 to extend, which would have unblocked the pin sooner and made the *identity* of a version a thing invented here rather than by the registry that owns it; and pinning a constant, which is the config flag deferring a choice the open-question protocol forbids, load-bearing on every report created meanwhile. **Corrected the same day, before any code**: the batch that took this decision was put with the claim that 31.1 and 31.2 were unaffected, and 31.1 is not. FR-66 is on **31.1's** row, UC-56 step 3 pins the version at *period open*, and §7's own component table puts "template and taxonomy version pinning at period open" on `core.reporting_period` with **Taxonomy Registry** as its dependency. So 33.1 precedes **31.1** as well, and only 31.2 — a lock over a period that already exists — is genuinely free of it. The reorder moves two sub-steps, not one. **The registry is sourceable**, which is what makes the reorder cheap rather than open-ended: EFRAG publishes the VSME XBRL Taxonomy package (`2026-05-01`, 508 KB), carrying 382 elements and labels in 24 EU languages — Romanian and English among them, and **not Russian**, which is precisely the standing T-14 already records. | DR-4, FR-66, BR-VER-1, P-11 |
| The report carries an explicit status — task 31.3 | **A stored `report_status` with the four states the prototypes draw** — `open`, `locked`, `ready_to_file`, `filed` (project owner, 29 Aug 2026). No FR or UC names them; `EasyESG Organization Admin.dc.html` and `EasyESG Workspace.dc.html` both label reports with them, and the plan's own S-06 and UC-67 rows assume a lifecycle a reader can see. Declined: deriving the state from the period's lock plus task 41.3's completion roll-up, which needs no column and leaves *filed* with no home at all. **The cost is accepted and named: `open`/`locked` are then true in two places** — the period (FR-22) and the report — so the **period lock is the only writer of that half**, moving every report inside it in the same transaction, and nothing else may set those two values. `ready_to_file` arrives with 41.3's roll-up and `filed` with task 47's export history; until then the lifecycle has two reachable states and two waiting for their owners, which is stated rather than left to be discovered. | FR-22, FR-23, UC-67 |
| There is no report snapshot table — task 31.4 | **The lock is the snapshot** (project owner, 29 Aug 2026). §7 models `core.entity_snapshot` and no report equivalent, and the row's guarantee — that a locked period and an export cannot disagree about what was filed — is already carried by three things that exist: FR-22 makes a locked period read-only, FR-18 makes entity master data point-in-time, and `core.export_artifact` retains the distributed file byte-for-byte (FR-53). A materialised copy of values that cannot move would be a fourth statement of the same fact and the first thing to drift the day a reopen is permitted (UC-58, which is explicitly *recorded* rather than forbidden). **So 31.4 proves the property rather than adding a table**: its deliverable is the test that a report read through a locked period is identical before and after, and that a reopen is visible in the record. Declined: `core.report_snapshot`, and deferring to task 47, which would leave the guarantee unproven until the consumer existed. | FR-18, FR-22, FR-53, UC-58 |
| The entity snapshot is referenced by the period — task 31.1 | **`core.reporting_period.entity_snapshot_id`, not `core.report`'s** (project owner, 29 Aug 2026). §7.2 says the snapshot is *"taken at period open and referenced by the report"*, and those two halves are owned by different tasks — 31.1 opens the period, 31.3 creates the report — so the literal reading has 31.1 writing a row nothing points at, findable for two tasks only by `(reporting_entity_id, taken_at)`. **The determining event is period open, so the period is what the snapshot belongs to**, and the report reaches it through its period; with one report per period the two readings answer the same question. §7.2's sentence is amended to say so. **Declined:** the report carrying its own copy of the id, which would write one fact in two places to survive a hypothetical second report per period that D-A's scope flag explicitly does not create. **What must change if it is wrong:** a period with two reports of different scope would need the reference moved outward, which is a column and a backfill while no report exists — cheap now, which is why it is settled here. | FR-18, §7.2 |
| The prior-period link is maintained, not merely set — task 31.1 | **Creating a period repoints the neighbour that should now follow it** (project owner, 29 Aug 2026). UC-56 step 4 links *"the immediately preceding period"* and FR-45's acceptance names *"the linkage recorded under FR-21"*, so the column is required and deriving it by query was declined. Set-once was declined too, and it is the interesting failure: open FY2026 first and backfill FY2025 afterwards, and FY2026 keeps a null prior **forever** — so comparatives stay empty with nothing failing anywhere, which is D-3's whole feature silently absent in the second reporting year. One `UPDATE` per create closes it. **Declined:** deriving from date adjacency with no column, which is always correct and leaves FR-45's stated criterion pointing at nothing. | FR-21, FR-45, UC-56, D-3 |
| Reporting periods may not overlap, and fiscal year is not unique — task 31.1 | **An `EXCLUDE USING gist` over `(reporting_entity_id, daterange(period_start, period_end, '[]'))`** (project owner, 29 Aug 2026); `btree_gist` has been installed since task 11's baseline for exactly this class of constraint. No document states the rule, and the reason to have it is the row above: overlapping periods make *"the immediately preceding period"* ambiguous, so the comparative a report shows would depend on insertion order. **Uniqueness on `(entity, fiscal_year)` is deliberately NOT added**, which is the part worth writing down — an undertaking changing its fiscal year end produces a short transition period and a new full one that can carry the same year label and do not overlap, so the tighter constraint would refuse a legitimate filing to catch a duplicate the exclusion already catches whenever it matters. **What must change if it is wrong:** a restatement needing a genuinely overlapping period would drop the constraint, which is one migration; UC-58 makes a restatement a recorded *reopen* rather than a second period, so that is not the shape the product uses. | FR-21, FR-45, UC-58 |
| A locked period refuses every write, the administrator's included — task 31.2 | **Locking is not a role gate** (project owner, 30 Aug 2026). UC-57 step 1 says the system *"makes the period read-only for Reporting Contributors"* and FR-22's criterion names only the RC, leaving what an Organization Administrator may do unstated. Read as a role gate, an OA edits a locked period directly and their correction lands in the trail as ordinary editing — which contradicts UC-58's own business rule that *"a post-publication amendment is visible as an amendment"*, and empties UC-57's rule that locking *"gives the change history a defensible endpoint"*: an endpoint one person can move is not one. So the lock refuses **every** write and reopening is the only route through it, which also makes the OA's amendment the thing UX-72 displays. **Declined:** the literal role reading, and a per-report reopen scope, which invents a granularity no document mentions while `core.report` does not yet exist. **FR-22's acceptance criterion is amended in the same change** rather than left to imply the opposite. | FR-22, UC-57, UC-58, UX-72 |
| The reopening is its own append-only table — task 31.2 | **`core.period_reopening`, one row per reopening** (project owner, 30 Aug 2026). FR-22 requires *"acting user, timestamp and stated reason recorded"* and S-14 shows *"the persistent fact that the period was reopened together with the stated reason"*. **Declined: columns on `core.reporting_period`**, which hold only the most recent reopening — a second one silently overwrites the first, and the amendment history UX-72 exists to keep is exactly what is lost. **Declined: `audit.system_audit_log`**, which is append-only already and wrong here for a reason worth stating: its rows carry a NULL organization and are invisible to `esg_app`, so S-14 could only read its own period's history through the `BYPASSRLS` role — a path the product does not use and should not learn. The table is tenant-scoped under 25.1's RLS pattern and **immutable by grant**, following `core.entity_snapshot`: no runtime role holds UPDATE or DELETE, and it carries no policy for either. | FR-22, UC-58, UX-72 |
| The lock freezes the period shell, not only the report — task 31.2 | **`PATCH /periods/{id}` is refused while locked** (project owner, 30 Aug 2026). The disclosure store does not exist until task 34, so the shell is the only writable surface a lock could govern today, and the alternative was shipping a column nothing reads for three tasks. It is also the right answer on its own terms: moving a filed period's dates changes what the report states it covers, and a due date is moot once the report is final. **Declined: exempting the due date**, which is defensible and adds a per-field exception every later writer has to remember. **Enforced in the database as well as in the use case** (P-4): a `BEFORE UPDATE OR DELETE` trigger refuses any write to a row whose `locked_at` is set unless that write is the one clearing it, raising SQLSTATE `45001` so the repository can answer the refusal rather than a 500. The application check is what produces the message; the trigger is what makes the guarantee not depend on every future writer remembering it — and it closes the read-then-lock race the application check alone cannot. | FR-22, UC-57, P-4 |
| D-A's scope flag ships with the report table — task 31.3 | **`core.report.scope` (`basic` / `basic_and_comprehensive`) is created with the table, not migrated onto it** (project owner, 29 Aug 2026), which is what `task.md`'s Phase 10 note already instructed when it said task 78 lands with task 31. P-11 orders the work so that what is expensive to retrofit ships on day one, and this is the worked example: the flag drives form UI, validation and export (FR-27 … FR-32, FR-177), so a report table without it forces a migration over live reports. One column and one `as const` mirroring its `CHECK`. **Task 78.1 is not thereby done** — its deliverable is the flag *driving* what a report contains, and this is the column it drives from. | D-A, P-11, FR-177, OQ-12 |
| A report is created explicitly, and a period may exist without one — task 31.3 | **`POST /api/v1/reports` taking `{ reportingPeriodId, scope }`** (project owner, 31 Aug 2026), rather than a `core.report` row inserted inside `POST /periods`. §7.2's diagram draws `REPORTING_PERIOD \|\|--\|\| REPORT`, which reads as auto-creation, and that reading was tested against two things that outrank a cardinality glyph: task 32.3 is *"Report creation and its visible pins — the creation flow over 31.3"*, which has nothing to build if the period already made the row; and D-A's scope is a **report-level commercial choice** sold as its own plan scope, so putting it on `POST /periods` moves a plan-tier decision onto S-14, the Organization Administrator's administrative screen, and away from the Contributor whose report it scopes. **Declined:** auto-creation with `scope` defaulting to `basic`, which keeps the glyph literally true and makes S-06 list a report for every period whether or not anyone intends to author one — an index whose rows do not mean *somebody started this*; and auto-creation with `scope` on the period request, which is the same objection plus a second field on a form UC-56 has already settled. **§7.2's diagram is amended to `REPORTING_PERIOD \|\|--o\| REPORT` in the same change**, since the optionality is now a real state rather than a transient one. The pairing stays at most one report per period, which is what keeps the entity snapshot reachable through the period (the task-31.1 row above). | FR-177, D-A, UC-18, §7.2 |
| The report's pin is copied from its period, never re-resolved — task 31.3 | **`core.report.{template_version,taxonomy_version}` are written from the period's own columns at creation** (project owner, 31 Aug 2026). Both facts are already true: FR-65 pins *"by periods opened from that point forward"* and UC-56 step 3 pins at period open, while FR-66 stores the version *"against every report"* — so the report carries the pin and the period determines it. **Declined: calling `TAXONOMY_REGISTRY.pinFor()` a second time at report creation**, which `task.md`'s row reads as literally. It answers identically in every case but one — an adoption entry registered between period open and report creation — and in that one case it produces **two disagreeing pins for one filing, with nothing failing**, which is DR-4's "never moves silently" defeated by the mechanism meant to uphold it. The row's instruction is honoured where the resolution happens: `pinFor()` remains the only source of a pin anywhere in the system, and `max(registeredVersions)` appears nowhere. **Also declined:** dropping the period's columns so FR-66's literal subject is the only holder, which contradicts FR-65 and UC-56 and costs a migration over a shipped table. **What must change if it is wrong:** a second report per period of differing scope would need its own resolution, which is the same expansion the task-31.1 snapshot row already prices. | DR-4, FR-65, FR-66, UC-56 |
| Nothing in the request tier can move a pin, enforced by column privilege — task 31.3 | **`esg_app` holds `UPDATE` on every `core.report` column except `template_version` and `taxonomy_version`** (project owner, 31 Aug 2026). The task row calls the pin *"the invariant this slice exists to prove, not a column it happens to write"*, and a pin protected only by the absence of a DTO field is a property of the code somebody remembered to write. This is DR-6's own mechanism — *append-only enforced by DB privileges*, §7.7 — narrowed from a table to two columns, and it costs nothing on the write path. **A schema invariant asserts the exception list in both directions**, so neither a pin quietly regaining `UPDATE` nor a column added by task 34 shipping silently unwritable can pass a gate. **FR-69's migration run is not thereby blocked and is not thereby built**: task 76 grants the privilege to whatever role executes the run, in its own migration — which is what *"nothing but an explicit migration moves them"* means, exactly. **Declined:** a `BEFORE UPDATE` trigger in `refuse_locked_period_write`'s shape, which buys the same guarantee, pays a per-row function call on every report write, and needs an escape hatch that invents the mechanism task 76 owns; and surface absence plus the audit trail alone, which is how the period's pin is protected today and is the weaker half of P-4. | DR-4, DR-6, FR-66, FR-69, P-4 |
| The report follows the editor, where the period follows the administrator — task 31.3 | **`POST /reports` and `PATCH /reports/{id}` admit `organization_administrator` and `editor`; every member reads** (project owner, 31 Aug 2026). It is deliberately *not* the split `PeriodsController` and `EntitiesController` carry, and the difference is the thing being written: a period and an entity are master data, which D-2 makes Organization Administrator-owned, while the report is the Contributor's own workspace — UC-18's actor is the RC and FR-26 grants the editable session on **edit rights**, not on a role. A create route the Contributor cannot reach would mean the person who authors the report cannot start it. Reads stay open to every member because FR-25 requires a view-only member to see *"the same entries without edit affordances"*, which needs the entries. **Declined:** administrator-only writes, defensible on the grounds that `scope` selects a paid tier, at the cost of that consequence; and splitting the two writes so an editor creates and only an administrator upgrades, which is the most precise reading of the commercial axis and states a two-role rule on one table **before task 54's entitlement guard exists to make it mean anything**. **Recorded deferral:** `basic_and_comprehensive` is ungated until task 54 — `apps/api/CLAUDE.md` requires the entitlement key or the reason, and this is the reason. | FR-25, FR-26, FR-177, UC-18, D-2 |
| The lock's reach is a gate, not a review property — task 31.4 | **Every tenant table with a foreign key into `core.report` or `core.reporting_period` must carry the `refuse_locked_write` trigger, or be declared exempt with its reason** (project owner, 31 Aug 2026), asserted by `schema-invariants.e2e-spec.ts`. This row declined `core.report_snapshot` on the grounds that FR-22's lock already carries the guarantee; a gate is what keeps that argument true as tables are added, and **the risk was never that a trigger gets removed — it is that a later task adds a table inside the lock and does not give it one.** Task 34's disclosure store is the concrete case: it hangs off `core.report`, and a report whose values stay editable while its period is locked is FR-22 defeated by a table that shipped afterwards, with RLS and per-field audit correctly attended to and nothing failing. **Reachability is the foreign key rather than a maintained list of names**, so a table joins the rule by being modelled rather than by being remembered. One exemption today, `core.period_reopening`: it is the record *of* the reopening, written in the transaction that clears the lock, and it is immutable by grant — a stronger guarantee than the trigger's, not a weaker one. **Declined:** proving the property once in an e2e and leaving it there, which is what the row's own deliverable literally asks for and which stops being a proof the first time the filing grows a table. | FR-22, FR-53, UC-58, P-4 |
| A legal date's timezone comes from the reporter's browser — task 32.1 | **`Intl.DateTimeFormat().resolvedOptions().timeZone`, with no control on the screen** (project owner, 31 Aug 2026). Every legal date the API takes is `{ date, timezone }` — NFR-34 requires the zone that *determined* the date and task 31.1 built `period_start`/`period_start_tz` that way — but **no artboard draws a timezone control and no screen has ever collected one**, so S-14 is where the question first had to be answered rather than inherited. **Declined:** deriving it from `core.organization.country_code`, which was the recommendation on record — NFR-34's own test is *would a different timezone change the answer to a legal question*, and a fiscal year is determined by the jurisdiction the undertaking files in rather than by where the bookkeeper sits; and a visible control, which is a fourth field beside each of three dates for a value that is identical on essentially every Moldovan filing. **The cost is accepted and named: a reporter working from another country records a period boundary in their own zone rather than the filing's**, and FR-125 makes that uncorrectable by editing — the exact failure NFR-34 exists to prevent, admitted at the one boundary NFR-34 does not reach. **What must change if it is wrong:** the zone becomes a derived value, which is one function in the web tier plus a backfill of whatever periods exist by then — cheap while the count is small, which is why the decision is affordable now and gets dearer every filing season. | NFR-34, FR-21, FR-125 |
| S-14's Date control is the platform's — task 32.1 | **A native `<input type="date">` wearing `TextField`'s clothes** (project owner, 31 Aug 2026), as §11.5's *Date* row's first implementation. The deciding property is not the picker but the value: a native date input reads back **ISO `YYYY-MM-DD` whatever the display locale**, which is exactly what `LegalDate.date` stores, so the control needs no parsing and no locale table and cannot disagree with the wire in one of three languages. Its keyboard and screen-reader behaviour is the platform's, which is the cheapest route to WCAG 2.2 AA on a control that would otherwise own the largest accessibility surface in the inventory. **Declined:** a composed calendar over Radix `Popover`, as `Combobox` was built — it matches the artboard and owns focus management, roving tabindex and locale-aware week starts in three locales, which is the easiest thing here to get subtly and invisibly wrong; and a plain text field with an ISO mask, which asks every reporter to type a format their locale may not use. **Accepted cost:** the picker's own chrome cannot be fully styled, so S-14 will not match its artboard pixel for pixel. | UX-8, UX-89, UX-90, NFR-75 |
| Task 32.1 splits, and widens past `web` — task 32.1 | **`32.1.1` the two inventory additions, `32.1.2` the Index and Record over them; scope `web+pkg:ui`** (project owner, 31 Aug 2026). S-14's own content list names the **version pin indicator (§11.5)**, and `packages/ui/src/domain/` is empty — so the screen cannot be built without adding the inventory's **first domain component** — while three of its fields are dates and §11.5's *Date* row has no implementation either. **A third addition was found by `convention-review` and missed by the audit that produced this row**: §11.5's fourth recorded addition reserves the **reporting-period picker** as its own component, *because of this screen* — *"reporting periods are the one place where a wrong date is expensive and invisible"* — and the first pass read §11.5 for the rows S-14 needed without reading the recorded additions above them. It is built in 32.1.1 with the range rule inside it, exported as a predicate so a form validates on submit with the same one it shows inline. That is task 30.4's situation exactly: S-13 could not classify an entity without a way to offer CAEM's 996 codes, and that row split into 30.4.1 for the `Combobox` and 30.4.2/30.4.3 for the screens. **Declined:** one undivided task, which would ship two inventory components and two screens under a single build-log entry; and inlining both in the screen, which is the defect UX-89 names in terms — a component living in a screen has no state set, no dark map, no expansion coverage and no accessibility review, and the next screen needing a date copies all four. | UX-89, UX-8, UX-90 |

**Why webhooks need their own bucket, and why 600.** Payment, MIA and e-Factura callbacks are
unauthenticated *by session* — they carry a provider signature, not a user token — so under the general
rule they consume the 60/min unauthenticated budget. That budget is per IP and every callback from one
acquirer shares one source range, which makes it a single allowance spanning every tenant's payments.
The consequence is specific rather than theoretical: §11.2 makes the callback the **only** authoritative
source of order state, so a throttled callback leaves a customer who has paid sitting in
`awaiting_payment`.

Steady-state volume at the stated envelope is single digits per minute and would never approach either
figure. The sizing case is not steady state — it is a backlog draining after a provider outage, which
DR-9 and NFR-54 already treat as expected behaviour rather than an anomaly. At ≤ 2,000 organizations on
monthly cycles the worst realistic backlog is roughly a day of callbacks; 600/min drains that in about
three and a half minutes, and leaves an order of magnitude over the renewal-day sustained rate. The
alert matters more than the ceiling: 70% sustained means the assumption behind the number has changed.

**An IP allowlist was considered and deliberately not adopted as the primary control.** It is the
stronger position — it would stop unknown traffic reaching a `@Public()` endpoint at all — but it
depends on the acquirers publishing stable ranges *and* announcing changes, which is not established
for maib, Victoriabank or MICB. A silently rotated range converts a delay into a hard 403 on every
callback, which is worse than the problem. It remains available as per-provider hardening wherever a
range is actually published; it is not what the correctness of the path rests on. Signature
verification in the adapter, and `(provider, provider_event_id)` de-duplication before any handler
runs, are.

Auth limits are tighter than the general API because NFR-64's uniform-response requirement means "
       "enumeration is bounded by rate, not by response difference. The export concurrency limit is a queue-depth guard, not an entitlement — entitlement quotas stay in the billing context under DR-1.

**The web session cookie and the CSRF stance — closing OQ-33 (21 Aug 2026, project owner, with
task 22).** `apps/web` holds AD-12's whole session in **one** httpOnly cookie: the access token,
the refresh token, both expiries and the session's identity block, sealed as a single AES-256-GCM
payload under `SESSION_SECRET` (node:crypto — no new dependency). Sealing is defence in depth on
top of httpOnly: the raw refresh token never leaves the Node tier in any readable form, and a
tampered cookie fails authentication of the ciphertext rather than reaching a parser. Attributes
as in the table above. `SameSite=Lax` rather than `Strict` because a top-level arrival from an
email link — a reset link, a notification deep link, UX-38's own re-entry path — must present the
cookie; under `Strict` every such arrival looks signed out and bounces to S-01. What `Lax` leaves
open (a cross-site top-level **GET** carries the cookie) is harmless by construction: GETs through
this tier are safe methods, and every state-changing request through `src/app/api/[...path]` must
additionally prove same-origin — `Sec-Fetch-Site: same-origin`, with an Origin/Host comparison as
the fallback where the header is absent, refused as a problem+json 403 otherwise. Server Actions
need no separate check: Next rejects an Origin/Host mismatch on every action POST (verified
against the pinned Next 16 docs). A per-session CSRF token (double-submit) was considered and
rejected: it adds plumbing to every client island and the autosave queue for a vector the
Lax-plus-origin-proof pair already closes, and it is revisitable without migration if a later
surface (an embedded widget, a cross-site POST target) changes the premise.

**Where the access token is rotated on a page load — task 26.4 (26 Aug 2026, project owner).**
The seal above holds a refresh token good for 7 days idle, wrapped around an access token good for
≤15 minutes. `proxy.ts` gated `(app)` on the *cookie's presence* and nothing more, and
`src/server/api-client.ts` attaches whatever access token the seal holds without rotating —
correctly, since it serves Server Components and a cookie write throws during render. Both were
right in isolation and jointly wrong the moment a Server Component read the API on page load, which
S-16 is the first screen to do: a member returning after twenty minutes would receive a 401 and an
error screen while holding a session with six days left on it.

**`proxy.ts` is therefore the page-load rotation point**, alongside `src/app/api/[...path]` which
already rotates for client-island traffic. It is one of the two places Next permits a cookie write,
it already runs on every `(app)` request, and it runs *before* render — so the token the Server
Component reads from the cookie is the rotated one. `session.ts` single-flights refreshes per
token, which is what keeps a page issuing several parallel reads from spending the single-use
refresh token more than once; spending it twice past the race grace reads as theft and revokes the
session, which is the random-sign-out failure task 22 recorded and did not want to meet again.
Rotation is attempted only when the access token is within the refresh window and the request is
one the gate already admits: an anonymous route pays nothing, and a failed refresh falls through to
the existing redirect rather than erroring, since an unrotatable session is one that has ended.

**The admin realm's session — task 23 (21 Aug 2026, project owner, from the task's open-question
batch; sign-in reshaped to A-01's two-step handshake in the 24 Aug 2026 review — the drawn flow's
"Signed in as …" is a server-established fact, per the challenge row above).** OQ-17 put the token
handler on the api; these are the decisions that make it concrete.
The realm **mirrors the tenant session mechanism** — a ≤15-min JWT plus a rotating, single-use,
reuse-detected refresh token with task 21's race grace — rather than an opaque server-side
session, chosen for uniformity: one session model across both realms, at the recorded cost that
revoking an admin session leaves its last access token honoured for up to 15 minutes (the JWT is
verified without a lookup until task 28's guard adds one). The pair never reaches the browser in
readable form: the api seals it, with the operator's identity block, into the httpOnly cookie
above and rotates it via `Set-Cookie` on its own responses. Separate tables
(`identity.admin_account`, `identity.admin_session`, `identity.admin_refresh_token`), separate
secret, separate cookie — NFR-65's "shares no session, cookie scope or credential" taken
literally. Sign-in throttles and locks exactly as §12.5.6's table says for every auth path; the
lockout's release is a PA action or the provisioning CLI, since the admin realm deliberately has
no password-reset flow. What a locked-out sole operator does before task 67 is the CLI, and that
is an operational answer, not a product one.

#### 12.5.7 Retention for non-fiscal data

Completes what §18.2 recorded as partial. Required by the DSR runbook (NFR-28) and the exit runbook (NFR-31).

| Category | Retention | Basis |
|---|---|---|
| Disclosure data and report content | Organization life + **1 year** | Matches NFR-109's delivery-record period — one number, one policy |
| Calculator inputs (`CALC_INPUT`) | **Permanent** | Already stated. Required by FR-45 … FR-47 comparatives and the audit trail |
| Generated exports (PDF, Excel) | **24 months** | Regenerable from the pinned template and taxonomy version — what DR-4 buys. Fiscal PDFs excluded; they follow the six-year rule |
| System audit, non-billing | **24 months** | |
| Metering events | **24 months** | NFR-47 cost attribution and FR-83's success metrics |
| Application logs | **90 days** | NFR-30 already forbids personal data in them |
| Error traces | **30 days** | |
| Billing audit, fiscal documents | **6 years** | Unchanged — NFR-72, DR-8 |

Erasure now has a defined behaviour for every category rather than only for fiscal documents via FR-130 — the gap `functional_requirements.md` OQ-5 and `non_functional_requirements.md` OQ-12 record. Those stay open on whether an FR should be written; this supplies the values one would cite.

#### 12.5.8 Redis durability, and backups

**Redis: RDB snapshots to a volume; AOF off; `maxmemory 2gb`; `maxmemory-policy noeviction`; alert at 70%.**

Three separate questions hide inside "does Redis need a volume", and they have different answers.

- **Is Redis a system of record? No**, and the volume does not make it one. PostgreSQL plus the transactional outbox remains the source of truth (DR-9, AD-6), and every outbox row carries an `idempotency_key`, so a replayed job is safe by construction.
- **Is a volume needed for correctness? No** — but only because of an invariant that must be stated rather than assumed: **an outbox row is not marked terminal until the work reaches a terminal state.** Without that, a job sitting in a delayed retry lives *only* in Redis, and NFR-107's exponential schedule is bounded at 24 hours, so a restart could silently drop up to a day of pending notification retries — and delivery records are compliance evidence under FR-170. The invariant is recorded here because it is load-bearing.
- **Is a volume worth having? Yes.** An RDB snapshot costs a few gigabytes and a brief fork at 2 GB `maxmemory`, and it turns a host reboot from "wait for the outbox relay to notice and re-enqueue everything" into a resume. AOF stays off: it buys per-write durability that nothing here needs, at a real write cost, and it is the option that would genuinely start making Redis look like a system of record.

**`noeviction` is the load-bearing setting, not the persistence choice.** The default `allkeys-lru` — and every other eviction policy — will, under memory pressure, silently delete a queued export or a pending e-Factura transmission with no error raised anywhere. `noeviction` makes the write fail loudly instead, so the worker retries and the alert fires. For a queue, evicting is data loss disguised as a cache miss.

**Backups** — pgBackRest to Scaleway `esg-backups`, continuous WAL archiving: weekly full (Sunday, outside the filing-window change freeze), daily differential, **35-day PITR window** (one filing-window cycle plus a month), 12 monthly fulls retained, 6 yearly fulls Object-Locked to match the fiscal archive. Restore rehearsal quarterly, satisfying NFR-36's **D** method.

**One rehearsal per year must restore to a host outside Hetzner**, from Scaleway using only the object store and pgBackRest. That is the rehearsal that actually exercises NFR-72's independence from the hosting provider, and it is what closes the substance of `non_functional_requirements.md` OQ-14 — a six-year statutory archive asserted to survive loss of the hosting provider, with, until then, no evidence that it does.

#### 12.5.10 The local development environment is the Compose stack

**Decided 18 August 2026. No service and no service client is installed on a developer machine.** PostgreSQL, Redis and the worker's document toolchain all run as Compose services locally, the same way they run in staging and production. A developer's host needs Node, pnpm, Docker and git — nothing else.

This is not only convenience. Three things follow from it that a host install would break:

- **Client and server versions cannot drift.** `docker compose exec postgres psql` is the client shipped inside the pinned PostgreSQL 18 image, talking to that same server. A Homebrew `psql` is a separate version on its own upgrade cycle, and the failure it produces is subtle rather than loud.
- **A host PostgreSQL can shadow the container.** A second server listening on 5432 means migrations apply, the application connects, and the two are different databases. This is the single most expensive local-environment failure available here, and not installing a server is the only reliable way to avoid it.
- **The document toolchain must be verified at the CI version, not the laptop version.** NFR-82's PDF/A-2a and PDF/UA-1 conformance is machine-validated by veraPDF, NFR-20's Excel check by headless LibreOffice, and both are gates. A Homebrew veraPDF on a Mac is a *different* validator from the one in the worker image; a local pass that CI rejects is worse than no local check, because it is trusted. **qpdf, veraPDF, LibreOffice and Chromium therefore live in the worker image and are exercised through it**, locally and in CI alike.

The consequence for §12.5.9's Chromium controls is that they hold everywhere by construction: there is one place the renderer is installed, so the assert-at-build check and the veraPDF re-validation on a Playwright bump cover local runs too.

#### 12.5.9 Chromium pinning and upgrade verification

Chromium is **not separately pinnable** — it is derived from the Playwright pin. Playwright **1.62.1 ships Chromium 151.0.7922.34** (verified 18 Aug 2026). Three controls, which together are the upgrade-verification procedure OQ-27 records as missing (R-9, T-13):

1. Install explicitly — `pnpm exec playwright install --with-deps chromium` in the Dockerfile and in CI, at the pinned Playwright version. Never rely on `postinstall`, which pnpm 10+ blocks by default and which fails silently into a runtime PDF-export failure.
2. **Assert the resolved browser build at container build**, failing on mismatch, so a floating resolution cannot change the renderer unnoticed.
3. **Any Playwright bump re-runs the golden-report corpus through veraPDF** for PDF/A-2a and PDF/UA-1 before the bump is accepted. Tagged-PDF output is version-sensitive and NFR-82 is now machine-validated, so a renderer change is a conformance risk, not a patch bump.


## 13. Scalability, availability and performance approach

### 13.1 Performance targets

| Area | Target | Requirement |
|---|---|---|
| Interactive read | p95 ≤ 300 ms · p99 ≤ 800 ms at peak | NFR-37 |
| Autosave acknowledgement | p95 ≤ 250 ms, non-blocking, after durable commit | NFR-38, NFR-56 |
| Full-report validation | p95 ≤ 2 s | NFR-39 |
| Carbon calculation | p95 ≤ 1 s | NFR-40 |
| Entitlement decision | p95 ≤ 20 ms · ≤ 100 ms on cache miss | NFR-41 |
| Export | p95 ≤ 10 s; async + notification beyond 30 s | NFR-42 |
| Web vitals | LCP ≤ 2.5 s · INP ≤ 200 ms at p75, 4G mid-range | NFR-43 |
| Concurrency | 10× median with no maintenance window | NFR-44, NFR-48 |
| Notification dispatch | p95 ≤ 60 s from raise | NFR-106 |
| Content publish | ≤ 1 working day from approval, revertible in one step | NFR-85 |

### 13.2 How each target is reached

- **Interactive latency** is protected by moving all long-running work out of the request tier (AD-10) and by keeping the entitlement decision in-process (AD-5). NFR-46's verification is fault injection that floods the export queue while measuring NFR-37.
- **Autosave** batches debounced field-group `PATCH`es and runs only the validation rules touching the changed fields in-request; `RETURNING OLD/NEW` removes a lock and a round trip from that path.
- **Validation and calculation** are benchmarked against **maximum-population fixtures**, not typical ones.
- **Export throughput** scales by adding `worker` and `renderer` replicas; it is the binding constraint at the stated envelope.
- **Element-keyed reads** are served by indexes leading with `organization_id`, which every RLS-filtered scan predicates on.

### 13.3 Availability

| Aspect | Position |
|---|---|
| Targets | 99.5% outside the filing window, 99.9% inside it — **scoped to application availability, excluding single-host infrastructure loss** (§17.1) |
| Why the scoping is honest | `edge`, `redis` and VM-1 are each unreplicated. The three-VM topology buys durability, not uptime. Either the target excludes VM-1 infrastructure failure, or a second application VM is added behind the CDN |
| Maintenance windows | None announced inside the filing window (NFR-48) |
| RPO / RTO | ≤ 15 min / ≤ 4 h; **RPO = 0** for issued fiscal documents, payments and audit entries, delivered by scoped `synchronous_commit` (§10.2) |
| Degradation | Billing unavailable → the core keeps serving UC-17 … UC-48 on cached entitlements, open for granted keys, closed for new purchases (NFR-49) |
| Provider outages | Per-adapter outage simulation (NFR-50); an untransmitted invoice is a tracked exception, never a blocked checkout |
| Restore | Quarterly full restore rehearsal measured against both RPO and RTO (NFR-52) |
| Schema change | Expand → migrate → contract; nothing ships that cannot be reversed while the prior version runs (NFR-53) |
| Failover | A **manual runbook**. No automated promotion is specified — acceptable against RTO ≤ 4 h, but stated rather than implied |

### 13.4 Capacity and scaling headroom

At the stated envelope (≤ 2,000 organizations, ≈ 150 peak concurrent sessions, ≈ 200 export generations/hour, < 100 GB) this topology is comfortable, and the binding constraint is export throughput, which scales horizontally.

**NFR-45 requires accommodating 100× the envelope without redesign.** The migration path at that point is: managed PostgreSQL with read replicas, `worker` onto its own VM, and object storage already external. No part of this design has to be rebuilt to get there, which is the actual requirement.

Additional capacity mechanisms named in the sources: independent horizontal scaling of `api`, `worker` and `renderer`; a pre-window 10× load test and a 24-hour soak at 3×; a **partitioning plan gate for every append-only store** (NFR-8, NFR-46); and metering-derived per-organization cost attribution against the €0.50/free-tier-organization/month ceiling (NFR-47).

---

## 14. Security architecture

### 14.1 Layered position

| Layer | Controls | Requirement |
|---|---|---|
| Transport and edge | TLS 1.2 minimum with HSTS; rate limiting on all auth paths; IP allowlist for the admin host | NFR-61, NFR-64, NFR-65 |
| Session and identity | Argon2id password hashing with per-user salt and a pepper from the secret manager; ≤ 15-min JWT carrying only `session_id`; opaque server-side refresh tokens rotated on use and revocable; OIDC matched on subject identifier | FR-1 … FR-8, AD-12 |
| Authorization | Evaluated server-side on **every** request from session and membership records; the interface layer is untrusted; role changes take effect on the next request, not the next login | FR-58, FR-158, NFR-62 |
| Multi-factor | Opt-in TOTP for tenant users; **mandatory** MFA on the isolated admin surface | FR-75, NFR-65, §17.1 |
| Tenancy | RLS `ENABLED` and `FORCED`, transaction-local context, three DB roles, CI cross-tenant probe suite including a job-level probe | NFR-63, AD-2 |
| Data at rest | AES-256 with annual key rotation | NFR-61 |
| Payment | PCI DSS **SAQ-A** scope: hosted pages and SDKs only; no PAN received, stored or transmitted; no custody or settlement code path exists | NFR-60, NFR-74, DR-7 |
| Integrity of records | Append-only at database privilege level with a separate TRUNCATE trigger; gapless numbering with a row lock; immutable issued documents corrected only by credit note | NFR-33, NFR-55, D-10 |
| Privileged access | `esg_admin_ro` (`BYPASSRLS`, read-only) acquisition logged; support access to tenant content is time-boxed, reasoned, ticket-referenced, auto-expiring and logged | FR-77 … FR-79, NFR-66 |
| Secrets | Managed secret manager or SOPS/age-encrypted files, scoped per environment, access-logged; CI secret scanning on source and on the image registry | NFR-69 |
| Supply chain | SCA gate; critical CVE remediation ≤ 7 days, high ≤ 30 | NFR-13, NFR-67, NFR-68 |
| Output | Destination-specific neutralisation for Excel, PDF/interface and e-Factura XML in one encoding layer, with an injection corpus in the export regression suite | NFR-70 |
| Logging | Pseudonymous identifiers only; no personal data in logs, error traces, metering events or analytics; CI log-scanning gate plus sampled production scanning | NFR-30 |

### 14.2 Two structural security properties worth naming

**The risk gradient runs the right way round.** The more privileged surface (`admin`) is the more constrained one: separate host, IP allowlist, mandatory MFA, separate cookie scope and credential store, and — because a static SPA has no server-rendering tier — a dedicated token handler so it uses the same httpOnly-cookie pattern as `web` rather than holding a token in browser JavaScript. That handler is **a route on `api`** (`POST /auth/admin/session`), not an endpoint at `edge`: OQ-17 closed it there so the admin session is established through the same documented, contract-tested surface as everything else, rather than through a second one that P-5's OpenAPI diff cannot see. (This sentence said `edge` until 19 Aug 2026.)

**Framework-level caching is a tenancy risk, not a performance question.** Next.js Cache Components stay disabled and `"use cache"` is prohibited in any component that reads tenant data, enforced by a lint rule. A cache key generated by the compiler without knowledge of `organization_id` would leak a rendered page across tenants **above** the RLS boundary, where none of AD-2's probes would catch it. The only legitimate use is fully static, tenant-independent content: the marketing shell, the legal pages, the locale bundles.

### 14.3 Data protection

EU/EEA residency for customer data at rest wherever it rests — the primary store, replicas, backups, exports and logs, **and every sub-processor holding customer data**, relying on no adequacy decision and no SCCs (NFR-5, NFR-27 as amended 25 Aug 2026 per `non_functional_requirements.md` OQ-16; the five named artefacts enumerate where data rests, not whose systems are in scope). Production customer data is prohibited in non-production environments, with anonymisation implemented as a platform job rather than a manual script (NFR-32). Data-subject request handling and full data export in an open format irrespective of subscription state are verified by **rehearsal** with runbooks as the evidence (NFR-28, NFR-29, NFR-31). For any future AI assistance, the no-training-on-customer-data obligation with stated retention (NFR-6) is a contractual gate on the adapter, not a code change.

---

## 15. Evolution and extensibility

### 15.1 Named seams for deferred capability

Each deferred capability has a named seam so that adding it is additive rather than structural. This is the practical test of whether the MVP architecture was right.

| Deferred capability | Phase | Seam already present |
|---|---|---|
| XBRL / iXBRL export | 2 | `DocumentConversionPort` (AD-8); the EFRAG MIT-licensed converter self-hosted as an eighth Compose service; the export pipeline is already format-parameterised |
| Comprehensive Module C1–C9 | 2 | AD-3 — a taxonomy registration plus rules; the module flag already drives form UI and export logic |
| Completion dashboards, deadline reminders | 2 | FR-165 lead-time notices exist at MVP; the dashboard is a read model over existing data |
| Year-over-year analytics view | 2 | Multi-period data and prior-period resolution are MVP (D-3, FR-45) |
| Energy-provider / accounting ingestion | 3 | `CALC_INPUT` already accepts sourced values with provenance; add an ingestion adapter per provider behind a port |
| AI narrative drafting, risk flagging | 3 | New port + adapter; NFR-6 (no training on customer data, stated retention) is a contractual gate on the adapter, not a code change |
| Public disclosure portal | 3 | A **separate `public_disclosure` schema**, written by an explicit publish action and readable anonymously — **not** a relaxation of AD-2. Carries disclosed fields only: no audit trail, no calculator inputs, no omitted values. Field structure already ESAP-shaped |
| Advisor / Buyer / Licensee organizations | 2–3 | `ORG_RELATIONSHIP` typed and config-driven (FR-14, NFR-9); the Enterprise contract path exists at MVP (D-12) |
| Non-resident billing | 2 | `MerchantOfRecordPort` registered but inactive (D-8, NFR-14) |
| Enterprise SSO (SAML / OIDC federation) | 2–3 | `IdentityProviderPort` is provider-agnostic (D-6) |
| Usage-based pricing | later | Metering already emits for actions not currently billed (FR-105, NFR-10) |
| ESAP bridge, blockchain traceability | uncommitted | **No requirements written; no seam claimed** |

### 15.2 The public portal seam deserves its own note

When the public portal arrives, the right shape is **not** a relaxation of tenancy. It is a separate read model: an explicit publish action projects the finished report into a `public_disclosure` schema readable anonymously, carrying only the disclosed fields and none of the audit trail, raw inputs or omitted values. That is faster (cacheable, CDN-able, no per-request tenant context), it makes the publication boundary an auditable event rather than a permission, and it means the public portal is structurally incapable of being a path into tenant data.

### 15.3 Cheap to defer versus expensive to retrofit

The register is large against the schedule, so the lever that works is scope and sequence, not structure. These two lists say where cuts can land.

**Cheap to defer** — each can be added later without touching the data model or the module boundaries:

| Deferrable | Why it is safe to defer | When to add it |
|---|---|---|
| Three VMs → one | NFR-51's RPO = 0 clause applies to **issued fiscal documents, payments and audit entries**; before the first paid invoice, none exist | Staged, §10.3 |
| Blue/green deployment | NFR-48's 99.9% is an in-filing-window obligation | Before the first filing window |
| PgBouncer | ≈ 150 peak concurrent sessions does not need a pooler | When connection count actually bites |
| Separate `renderer` container | The isolation argument is about burst load a pilot does not have | Before public launch |
| Admin console | Seed configuration from version-controlled files; the console matters when someone who cannot open a pull request needs to edit content | When a non-engineer owns the content |
| Notification channels | In-app plus transactional email for verification and invitation covers the MVP; the category catalogue, preferences and dunning notices follow billing | With billing |
| Comprehensive Module, XBRL, dashboards, integrations, AI, public portal | Already Phase 2/3 by prior decision | Per §15.1 |

**Expensive to retrofit** — each is close to free at the start and close to impossible later, because each changes the meaning of data already written. All are built in the first phase regardless of which phase their *feature* lands in:

- **The taxonomy-keyed store and version pinning** (AD-3, DR-4). Retrofitting version pinning onto reports written without it means guessing which taxonomy each existing report was prepared under. There is no correct answer, only a plausible one.
- **Row-Level Security** (AD-2). Adding RLS to a schema whose queries already assume they see everything means auditing every query path at once, under time pressure, after the incident that prompted it.
- **Retained calculator inputs and factor-set versioning** (NFR-19). A figure computed without its inputs and factor version stored cannot be reconstructed. Ever. This is the guarantee an assurance provider will ask about first.
- **Per-field audit attribution** (FR-54). History not captured is history that does not exist.
- **Append-only audit and ledger tables** (NFR-33). Converting a mutable table to append-only does not make its past trustworthy.
- **The multi-period data model** (FR-45, D-3). Comparatives become mandatory in a company's second reporting year — which arrives on a fixed calendar, not on a roadmap.
- **The transactional outbox** (AD-6). Cheap as a pattern from the first write; a rewrite of every side-effecting path once they exist.
- **Content and rules as data** (AD-4). The alternative is a code release for every wording fix, which the quarterly regulatory-watch cadence turns into a permanent tax.

### 15.4 Build order

Sequence, not phases of scope:

1. **Foundation** — monorepo, CI gates, migrations, RLS roles and policies, tenant context, audit, outbox, configuration store.
2. **Identity** — registration, verification, social sign-in, sessions, memberships, invitations, opt-in TOTP.
3. **Reporting core** — organizations, entities, snapshots, periods, taxonomy registry, disclosure store, wizard, autosave, and **D-A's report-level Basic/Comprehensive scope flag**. The flag lands here rather than with the Comprehensive content because it drives form UI, validation and export, and P-11 puts what is expensive to retrofit on day one; the nine C1–C9 disclosures are authored on top of it (FR-177, promoted into MVP scope 25 Aug 2026 per `problem_overview.md` OQ-12) and NFR-2 already mirrors their element names, so the module is additive rather than a rework.
4. **Calculator and validation** — factor sets, calc runs, rule interpreter, inline state, roll-up.
5. **Export** — preview, PDF pipeline, EFRAG Excel patching, export history. → *free-tier pilot milestone*
6. **Notifications** — categories, in-app centre, email delivery, preferences. Earlier than their register position, because verification and invitation depend on the delivery mechanism.
7. **Billing** — catalogue, entitlement service, order saga, card and transfer rails, invoicing, numbering, **e-Factura in the first billing sprint** because of the 1 October 2026 deadline.
8. **Operations** — reconciliation, collections, refunds, Enterprise contract path, admin console, adoption metrics.
9. **Public tier** — marketing home, the three legal documents and the cookie choice, the published-content read path (FR-61), help centre. **Added 24 Aug 2026.** The list ran to eight and none of them was the unauthenticated surface, while the paragraph below claims to sequence "the interface half of each step" and `design/IMPLEMENTATION_PLAN.md` carries the tier as its Phase 10 — so a plan sliced from this list could not contain it, and `task.md` did not, from its first slice until tasks 74–77 were appended on the same date. Numbered last because nothing above it depends on it; **the legal slice does not wait for step 9** — see the third scheduling fact below.

**The interface half of each step is sequenced separately in `design/IMPLEMENTATION_PLAN.md`**, against this same order — thirteen UI phases, Phase 0 through Phase 12, each with deliverables, an exit check and the prototype in `design/screens/` that governs it. It is a schedule, not a specification: `design_spec.md` §11 owns the values, this section owns the order. Three of its Phase 0 obligations bind earlier than a reader of this list would guess, so they are named here:

- **The token cascade is installed before any screen exists.** `design/tokens.css` becomes `packages/ui/src/styles/tokens.css` in Phase 0 — moved, not copied — so no later phase invents a value.
- **Self-hosted font subsets are verified for comma-below `ș`/`ț` and full Cyrillic at Phase 0**, not at the end. Subsetting that silently drops Cyrillic passes English review unnoticed, and the three-locale ratification (NFR-23) makes that a launch blocker rather than a cosmetic defect.
- **The +40% string-expansion harness is wired in Phase 0** and run at the end of every phase. Retrofitting it after twenty screens finds the same class of bug twenty times.

Three scheduling facts shape the backend order rather than being discovered inside it. **e-Factura is a hard external deadline** and binds from the *first paid invoice*, not from launch — so the sequence must reach billing before the first paying customer, with `EInvoicingPort` and the invoice document model in the first billing sprint, integrated against the national test environment early. **The filing window is April–May**, and a launch landing after May misses a full year of the natural adoption moment, since an SME's motivation to produce a sustainability report peaks when it is already assembling its annual accounts — the strongest argument for getting the reporting core usable early even though the full register ships later, and for treating a free-tier pilot as a milestone inside the plan rather than as a reduced scope. **A privacy notice binds from the first real user, not from step 9.** GDPR Article 13 and Law No. 195/2024 — applicable 23 August 2026, NFR-5 — require the information to be given where personal data is collected, and registration collects an email address at step 2. So step 9's legal slice, the terms of service, the privacy notice, the cookie policy and the cookie choice, binds at **step 5's free-tier pilot**, where the first real SMEs arrive; the rest of the tier does not. A step's position here is a dependency statement, not a date — "sequence, not phases of scope" cuts both ways, and this is the one place in the list where the two visibly differ.

---

## 16. Risks, trade-offs and technical debt accepted

### 16.1 Trade-offs accepted deliberately

Each of these is a known weakness of the design, accepted with a stated reason. None is an oversight.

| # | Trade-off accepted | Why | Residual exposure |
|---|---|---|---|
| T-1 | **The core/billing boundary is enforced at build time, not at runtime.** The schema split makes a violation obvious in review and keeps the contexts physically separable; it does not prevent a schema-qualified cross-context join | Genuine database-level prevention needs `USAGE` revoked across the boundary, which conflicts with AD-6's requirement that a billing state change and its outbox row commit together. Claiming runtime enforcement would be false | A CI rule that is disabled or mis-scoped silently removes the only enforcement. The `BILLING_ENABLED=false` job is the backstop |
| T-2 | **No foreign key from `billing` to `core.organization`** | The physical expression of NFR-15; an FK would make NFR-1's "disable billing entirely" test impossible, because the schema would not load | Orphaned billing records are possible; mitigated by a nightly reconciliation job reporting them as an operational metric |
| T-3 | **The generic disclosure store gives up compile-time typing and per-disclosure check constraints** | DR-4 and NFR-86: DDL per taxonomy release is not viable when the standard already shipped one breaking change | Bought back by the generated typed facade, rule-driven validation and the golden-report cross-format corpus |
| T-4 | **NFR-59's "all-or-nothing" is eventual convergence with compensation, not atomicity** | Atomicity is not available across a network boundary. The requirement's own closing clause about residual inconsistency reaching the Billing Operator concedes as much | The saga's terminal `inconsistent` state must be a monitored metric with a real work queue, or the concession becomes a silent failure |
| T-5 | **"Exactly once" delivery is not claimed.** Delivery is at-least-once; processing is effectively once | Not available across a network boundary | Any adapter without provider-side idempotency must declare a recovery query, or a dispatcher restart duplicates an e-Factura submission or a refund |
| T-6 | **Serialised invoice issuance per series** | The row lock is what makes gaplessness survive rollback | At ≈ 200 documents/month this is four orders of magnitude from being a bottleneck |
| T-7 | **99.9% availability is not achievable in this topology and the target has been re-scoped rather than met** | `edge`, `redis` and VM-1 are unreplicated; the three-VM split buys durability, not uptime | Either the scoping stands, or a second application VM behind the CDN is added |
| T-8 | **Failover is a manual runbook** | Acceptable against RTO ≤ 4 h; no Patroni, repmgr or VIP/DNS switch is specified | RTO depends on a human being available and the runbook being current |
| T-9 | **Scoped `synchronous_commit` blocks fiscal transactions if the sole synchronous standby is down** | The only way to get RPO = 0 where NFR-51 asks for it without paying commit latency everywhere | Needs a quorum (`ANY 1 (...)`) or a documented degradation procedure |
| T-10 | **TypeScript 7's 8–12× build speedup is declined** | Adopting it would disable tooling that four NFRs name as their acceptance criterion | Slower builds until `nest build` and typescript-eslint both support TS 7 |
| T-11 | **TypeORM is adopted for ergonomics while its two headline features go unused** | Entity-driven schema generation cannot express RLS, grants, temporal constraints or the composite FK, and would try to revert them; relational navigation is forbidden across DR-1 | The `QueryRunner` discipline is the largest integration risk; mitigated by a `TenantRepository` that throws without context |
| T-12 | **Microsoft 365 and desktop Excel verification is a manual release-checklist item, not a CI gate** | Server-side Office automation is unsupported on Linux; LibreOffice Calc headless is the automated gate | A round-trip regression specific to Microsoft Excel could reach a release |
| T-13 | **Chromium in the export path** is the most operationally awkward component: memory-hungry, occasionally hangs, version-sensitive for tagged-PDF output | It is the only way FR-48's preview and FR-49's PDF cannot drift | Mitigated by container isolation with hard memory limits and a restart policy, a per-job timeout, and a queue that retries on a fresh instance |
| T-14 | **Russian VSME labels are platform-authored with no official standing** | EFRAG publishes no Russian Digital Template | Needs separate editorial sign-off, and RO or EN is the authoritative rendering for a bank or EU buyer |

### 16.2 Residual delivery risks

Execution risks with mitigations, carried forward with their original identifiers.

| ID | Risk | Mitigation |
|---|---|---|
| R-6 | **e-Factura is a hard external deadline on an integration whose specification this project does not control** | Build the port and the invoice document model in the first billing sprint; integrate against the national test environment early; treat the transmission outbox as the buffer — an untransmitted invoice is a tracked exception with an owner (NFR-71), never a blocked checkout |
| R-7 | **Taxonomy churn during build.** The February 2026 release was backwards-incompatible and further releases are expected | AD-3 and AD-4 are the structural mitigation; the residual risk is that the first implementation hardcodes something. Register two taxonomy versions in staging from day one and keep a report pinned to each, so the version dimension is exercised continuously rather than discovered at the first rollout |
| R-8 | **Scope, now expressed as schedule** | Held at the full register with the timeline re-scoped. AD-1's boundary and AD-5's null entitlement implementation keep the internal build order meaningful (§15.4) |
| R-9 | **Chromium in the export path** — see T-13; more acute since NFR-82's amendment depends on the structure tree surviving intact | Container isolation, memory limits, per-job timeout, retry on a fresh instance |
| R-10 | **NFR-82's original PDF/A-2b target would have reported green on a requirement it never tested** | Amended to PDF/A-2a + PDF/UA-1, validated against both profiles (§17.1) |
| R-11 | **NFR-48's 99.9% asserted against unreplicated single points of failure** | Closed by re-scoping the target to application availability, excluding single-host infrastructure loss (§17.1). Adding a second application VM remains the alternative |
| R-12 | **Ghostscript's licence, if it re-enters the PDF path** | Excluded on technical grounds; note that it is AGPL-3.0 and the network clause applies to a hosted commercial service |
| R-14 | **One first-week spike:** `@nestjs/typeorm` 11.0.3's peer range resolves TypeORM 1.1.0 but loosely enough to warrant a smoke test | Run the spike in week one rather than assuming it |

### 16.3 The largest scope lever, considered and declined

**Decision: full register, all 173 FRs.** The alternative is recorded because it remains the fastest route to a usable product if the schedule comes under pressure later, and because knowing what was declined is worth as much as knowing what was chosen.

The free tier needs no billing. Deferring the billing context would remove **FR-84 … FR-152** (69 requirements, ~40% of the register), the e-Factura integration and its October 2026 deadline, the order saga, gapless numbering, reconciliation, dunning, refunds, chargebacks, the Enterprise contract path, and every PCI-scope question — while still delivering a complete, exportable VSME Basic Module report an SME can hand to a bank. D-12 already defines Free as "deliberately enough to complete a real VSME report".

Scope was held and the **timeline** was re-scoped instead: **173 functional and 93 non-functional requirements, including a complete billing, invoicing and Moldovan fiscal-compliance stack, is an 8–12 month build for a competent team**, not the 4–6 months a much smaller MVP was estimated at. That estimate was made against a reporting core alone; the register has grown roughly fourfold since. This is a defensible trade — it avoids shipping a product whose commercial model is untested — but it makes two things load-bearing: the build order in §15.4, and treating a free-tier pilot as a milestone inside the plan rather than as reduced scope, so real SME feedback arrives before the billing stack is finished rather than after.

### 16.4 Technical debt accepted at MVP

| Item | Nature | Repayment trigger |
|---|---|---|
| Manual database failover | No automated promotion | If RTO tightens below 4 h |
| Unreplicated `edge`, `redis` and VM-1 | Single points of failure | If the availability target is un-scoped, or a second app VM is added |
| PostgreSQL 18 baseline through launch with 19 arriving mid-build | Deliberate deferral | Revisited after the first filing window, against a named benefit rather than on principle |
| TypeScript 6 with the TS 7 side-by-side option documented but unused | Deliberate deferral | When `nest build` **and** typescript-eslint both support TS 7 |
| Nightly orphan-reconciliation job standing in for a foreign key | Compensating control for T-2 | Never — this is the intended end state |
| Requirement amendments in §17.1 not yet reflected back into the FR/NFR registers | Documentation debt | **The only outstanding action against this document** |

---

## 17. Traceability: architectural decisions and components ↔ requirements

This section maps this document against the requirement registers in both directions, and records where the two diverge. §17.1 … §17.3 are divergences that need reflecting back into the registers; §17.4 … §17.7 are the forward matrices; §17.8 records conflicts between the source documents.

### 17.1 Requirement amendments agreed — **ratified 18 August 2026**

These are changes to the FR/NFR registers, not to the architecture. **All eight are now applied to `non_functional_requirements.md` §4 (and FR-63 in `functional_requirements.md`); its C-3 records the ratification.** That register is the record; this table is retained as the rationale and the history of the change, not as the live statement. Closes OQ-3.

| Was | Now | Consequence |
|---|---|---|
| **NFR-82** — PDF/A-2b | **PDF/A-2a + PDF/UA-1** | Archival conformance *and* accessible structure, both machine-validated by veraPDF in CI. Makes NFR-75's tagged reading order actually testable rather than asserted. Costs the harder renderer pipeline in AD-10: Chromium `tagged: true`, in-place metadata injection, table header scope, artifact marking |
| **NFR-75** — WCAG 2.1 AA | **WCAG 2.2 AA** | Superset. The four additions that bite are Target Size (Minimum), Focus Appearance, Dragging Movements and **Accessible Authentication** — the last constrains the login path, so AD-12 and D-6's social sign-in must be designed against it from the start rather than audited against it later. Aligns with EN 301 549 v4.x |
| **NFR-48** — 99.5% / 99.9% availability | **Same targets, scoped to application availability, excluding single-host infrastructure loss**, backed by a stated recovery time | Closes R-11 honestly. `edge`, `redis` and VM-1 remain unreplicated; the three-VM topology buys durability, not uptime, and this document no longer implies otherwise |
| **NFR-47** — cost ceiling unnamed | **€0.50 per active free-tier organization per month** | At 2,000 organizations that is €1,000/month, comfortably above a three-VM EU footprint plus object storage and mail — so it functions as an alarm threshold rather than a constraint on normal operation. Measured from the FR-105 metering stream |
| **Tenant MFA** — deferred entirely | **Opt-in TOTP at MVP** | Not enforced, but available to any user and recommended to Organization Administrators, who can authorise payments and export the company's full regulatory record. The identity model already supports it; the cost is a fraction of retrofitting after a first incident |
| **FR-63 / NFR-23** — Romanian and English live at MVP | **Romanian, English and Russian live at MVP** | Russian is separately authored, not machine-translated. Architecturally free (NFR-4, NFR-25) and it replaces the staging locale rehearsal. Real costs: a third translation set to review on every content publish, and no official EFRAG source for Russian VSME labels (NFR-24 applies to RO/EN only) |
| **Filing window** — assumed March–April, to be confirmed | **April–May, peaking in the final two weeks of May** | See §17.2. Changes when the load test, the soak and the change freeze happen |
| *(absent)* | **NFR-106 … NFR-109**, notification qualities | See §17.3 |

### 17.2 The filing window, resolved factually

The scale envelope previously assumed a March–April peak and flagged it for confirmation. The assumption was wrong.

Under **Article 33(3) of Law 287/2017 on Accounting and Financial Reporting**, Moldovan entities submit annual financial statements within **150 days of the financial year end — 30 May** for a calendar year — with the shorter 120-day deadline (30 April) applying only to **public-interest entities**, which are not this platform's population. Submission is through the *Ghișeul unic de raportare electronică* or to the territorial statistics office.

Two consequences:

- **The load envelope moves by two months.** NFR-44's 10× load test and 24-hour soak, and NFR-48's change freeze and no-maintenance window, are planned for **April through May**, with the peak assumed in the last two weeks of May.
- **This is a proxy, and is labelled as one.** VSME reporting is voluntary and has no statutory deadline of its own; Moldova's draft sustainability-reporting chapter was still in consultation to 19 August 2026. The financial-statement deadline is used because a company preparing a sustainability report will almost certainly prepare it alongside its annual accounts, with the same staff. Revisit once the draft law is published — if it sets its own date, that date governs.

### 17.3 New non-functional requirements: notifications (NFR-106 … NFR-109)

FR-160 … FR-173 had no quality counterpart, which left FR-170's delivery records — explicitly *the evidence that a required update was actually requested* — with no acceptance threshold. Proposed for ratification into the NFR register:

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-106 | Notifications | The system shall dispatch a raised notification to its first channel within p95 ≤ 60 s | **A** — production SLI on raise-to-dispatch latency |
| NFR-107 | Notifications | The system shall retry a transient delivery failure on an exponential schedule bounded at 24 hours, and shall suppress a recipient address on its first hard bounce (FR-171) | **T** — bounce and transient-failure simulation per channel |
| NFR-108 | Notifications | The system shall achieve ≥ 99% accepted delivery for transactional mail, SPF-, DKIM- and DMARC-aligned (extends NFR-84) | **A** — deliverability monitoring, monthly review |
| NFR-109 | Notifications | The system shall retain per-recipient delivery records — channel, dispatch timestamp, outcome, read state — for the life of the organization plus one year | **I** — retention policy review; records readable independently of the notification centre |

These four qualities were originally drafted as NFR-94 … NFR-97. Those identifiers are already occupied by the deferred register (NFR-94 … NFR-105) in `non_functional_requirements.md`, so the proposals were renumbered to NFR-106 … NFR-109. **Ratified into `non_functional_requirements.md` §4.16 on 18 August 2026**; that register is now the record. Closes OQ-2.

### 17.4 Decision ↔ driver ↔ requirement matrix

| AD | Drivers discharged | FRs discharged | NFRs discharged | Design decisions |
|---|---|---|---|---|
| AD-1 | DR-1, DR-10 | FR-154 | NFR-1, NFR-15, NFR-46 | D-11 |
| AD-2 | DR-5 | FR-158, FR-79 | NFR-62, NFR-63, NFR-66 | — |
| AD-3 | DR-2, DR-4 | FR-24 … FR-32, FR-155 | NFR-2, NFR-3, NFR-18, NFR-58, NFR-86 | D-4 |
| AD-4 | DR-3 | FR-61 … FR-74, FR-148, FR-173 | NFR-12, NFR-73, NFR-85, NFR-86, NFR-87 | — |
| AD-5 | DR-1 | FR-99 … FR-104 | NFR-10, NFR-17, NFR-41, NFR-49 | D-13 |
| AD-6 | DR-9 | FR-108, FR-114, FR-120, FR-126, FR-157 | NFR-50, NFR-54, NFR-59 | D-10 |
| AD-7 | DR-8 | FR-123, FR-125 | NFR-55 | D-10 |
| AD-8 | DR-7 | FR-114, FR-156 | NFR-11, NFR-14, NFR-50, NFR-60, NFR-74 | D-7, D-8, D-6, D-14 |
| AD-9 | DR-11 | FR-153, FR-158 | NFR-16, NFR-38, NFR-43, NFR-56, NFR-65, NFR-77 | — |
| AD-10 | DR-10 | FR-48 … FR-53 | NFR-20, NFR-42, NFR-46, NFR-75, NFR-82 | — |
| AD-11 | — | FR-157, FR-160 … FR-173 | NFR-84, NFR-106 … NFR-109 | — |
| AD-12 | — | FR-4 … FR-8, FR-12, FR-58 | NFR-62, NFR-64 | D-6 |
| AD-13 | — | — | NFR-16, NFR-26, NFR-30, NFR-58, NFR-88 | — |
| AD-14 | DR-1, DR-5 | — | NFR-1, NFR-58, NFR-63, NFR-86 | — |

### 17.5 Component ↔ requirement coverage

| Module | FR range | Principal decisions |
|---|---|---|
| `identity/*` | FR-1 … FR-12, FR-56 … FR-60 | AD-12 |
| `core/organization`, `core/entity` | FR-13 … FR-20 | AD-2 |
| `core/period` | FR-21 … FR-23 | AD-3, AD-4 |
| `core/disclosure` | FR-24 … FR-32 | AD-3 |
| `core/calculator` | FR-33 … FR-36 | AD-4 |
| `core/*` wizard and autosave | FR-37 … FR-39 | AD-9 |
| `core/validation` | FR-40 … FR-44 | AD-4 |
| `core/comparatives` | FR-45 … FR-47 | AD-3 |
| `core/export` | FR-48 … FR-53 | AD-10 |
| `core/trace` | FR-54, FR-55 | AD-2 |
| `platform/configuration` | FR-61, FR-62, FR-71 … FR-74 | AD-4 |
| `platform/localization` | FR-63, FR-64 | AD-4 |
| `platform/taxonomy` | FR-65 … FR-70 | AD-3, AD-4 |
| `platform/admin` | FR-75, FR-76, FR-80, FR-82, FR-83 | AD-9 |
| `platform/support-access` | FR-77 … FR-79 | AD-2 |
| `platform/audit` | FR-79, FR-81, FR-151, FR-159 | AD-6 |
| `platform/metering` | FR-105 | AD-5 |
| `platform/notification` | FR-157, FR-160 … FR-173 | AD-11 |
| `billing/catalogue` | FR-84 … FR-89 | AD-4, AD-5 |
| `billing/subscription` | FR-90 … FR-98 | AD-6 |
| `billing/entitlement` | FR-99 … FR-105 | AD-5 |
| `billing/account` | FR-106, FR-107 | — |
| `billing/order` | FR-108 … FR-113 | AD-6 |
| `billing/payment` | FR-114 … FR-120 | AD-8 |
| `billing/invoicing` | FR-121 … FR-130 | AD-7 |
| `billing/efactura` | FR-126, FR-127 | AD-6, AD-8 |
| `billing/reconciliation` | FR-131 … FR-134 | AD-8 |
| `billing/collections` | FR-135 … FR-138 | AD-11 |
| `billing/refunds` | FR-139 … FR-141 | AD-6 |
| `billing/enterprise` | FR-142 … FR-147 | AD-5 |
| `billing/finreporting` | FR-148 … FR-152 | AD-4 |
| Platform-wide surface | FR-153 … FR-159 | AD-1, AD-9 |

### 17.6 NFR category realization

| Category | Principal mechanisms | Decisions |
|---|---|---|
| Architecture & modularity (NFR-1, 9, 10, 11, 14 … 17) | Schema-separated bounded contexts, CI boundary rules, `contracts/`, ports + adapters, key-based entitlements, OpenAPI-only surface | AD-1, AD-5, AD-8, AD-9 |
| Standards conformance & data fidelity (NFR-2, 3, 18 … 22) | Taxonomy-keyed store, version pinning, `numeric` for quantities with presentation-time rounding and integer minor units rounded at issuance for money, golden-report cross-format corpus, byte-preserving EFRAG template patching | AD-3, AD-4, AD-10 |
| Localization (NFR-4, 23 … 26) | Content in the configuration store, RO source with EN and RU authored, official EFRAG labels used verbatim where they exist, per-key fallback logging, CI rule against hardcoded formats | AD-4 |
| Data protection & privacy (NFR-5, 6, 27 … 32) | EU-region hosting for all stores, replicas, backups and exports; pseudonymous logs with a CI scan gate; rehearsed DSR and exit runbooks; anonymised downward data flow | §10, §9.10 |
| Auditability & assurance (NFR-7, 33 … 36) | DB-privilege append-only with a separate TRUNCATE trigger, UTC with stored originating timezone, per-field change history captured by `RETURNING OLD/NEW` in one statement, six-year independently-readable archive | AD-6, §7.7, §7.8, §12.3 |
| Performance (NFR-37 … 43) | In-process entitlement cache, queue-decoupled exports, indexed element-keyed reads, SSR shell + client wizard, benchmarks against maximum-population fixtures | AD-1, AD-5, AD-9, AD-10 |
| Capacity & scalability (NFR-8, 44 … 47) | Independent horizontal scaling of `api`/`worker`/`renderer`, pre-window load test and soak, partitioning plan gate for every append-only store, metering-derived cost attribution against the €0.50/org/month ceiling | AD-10, §10, §13 |
| Availability & continuity (NFR-48 … 53) | Separate data VM + streaming replica with scoped synchronous commit, WAL archiving with quarterly restore rehearsal, cached-entitlement degradation, per-adapter outage simulation, expand-migrate-contract | AD-5, AD-8, §10 |
| Integrity & reliability (NFR-54 … 59) | Inbound de-duplication and outbound idempotency keys, transactional outbox as sole queue producer, saga with credit-note compensation, row-locked numbering, commit-then-acknowledge, integer minor units | AD-6, AD-7, AD-9 |
| Security (NFR-13, 60 … 70) | SAQ-A scope, TLS/HSTS/AES-256 with annual key rotation, server-side authorization, RLS, token hygiene, opt-in TOTP for tenant users and mandatory MFA on the isolated admin surface, time-boxed support grants, SCA gate, secret manager, destination-specific output neutralisation | AD-2, AD-8, AD-12, §9.1, §14 |
| Fiscal & regulatory (NFR-71 … 74) | Outbox-driven e-Factura with daily transmission reconciliation, six-year archive, effective-dated fiscal configuration, no custody code path | AD-4, AD-6, AD-7, AD-8 |
| Usability & accessibility (NFR-75 … 80) | WCAG 2.2 AA component library, tagged semantic-HTML PDFs validated against PDF/UA-1, moderated usability testing with ≥ 8 SME participants, three-part error messages, pre-change disclosure of read-only impact | AD-9, AD-10 |
| Compatibility & interoperability (NFR-81 … 84) | Declared browser matrix in CI, PDF/A-2a **and** PDF/UA-1 conformance validation, versioned OpenAPI with contract tests, SPF/DKIM/DMARC-aligned mail | AD-9, AD-10, AD-11 |
| Maintainability & changeability (NFR-12, 85 … 89) | Configuration-as-data with one-step publish/revert, non-overlapping effective dating enforced by temporal constraints, taxonomy rollout without code release, version-pinned regression suite, per-component coverage floors, clean-room rebuild | AD-3, AD-4, AD-13 |
| Observability & operability (NFR-90 … 93) | End-to-end correlation identifier, operational alert inventory exercised annually, SLI dashboards against an error budget, scheduled-job heartbeats with absence alerting | §9.10 |
| Notifications (NFR-106 … 109) | Stateful notification records with per-recipient delivery evidence, bounded retry, hard-bounce suppression, retention beyond organization life | AD-11 |

### 17.7 Requirements verified by rehearsal rather than by test

These have no automated gate, so the runbook is the evidence (P-12):

| Requirement | Rehearsal |
|---|---|
| NFR-28, NFR-29 | Data-subject request handling |
| NFR-31 | Exit — full data export in an open format irrespective of subscription state |
| NFR-51, NFR-52 | Restore, measured against both RPO and RTO, quarterly |
| NFR-85 | Configuration publish and revert |
| NFR-86 | Template / taxonomy version rollout |
| NFR-93 | Scheduled-job failure and absence |
| NFR-14 | Adapter activation in staging with the diff limited to adapter + config |
| NFR-25 | Locale addition — satisfied at MVP by Russian rather than by a staging rehearsal |

### 17.8 Conflicts between source documents, and how they were resolved

| # | Conflict | Resolution |
|---|---|---|
| C-1 | **NFR count.** `System Architecture` opens citing NFR-1 … NFR-93 and §16 says "93 non-functional requirements"; its own §15.3 then adds NFR-94 … NFR-97 and its footer cites NFR-1 … NFR-97. `Architecture Overview` says 97 | Resolved against the register in `non_functional_requirements.md`: the register is **NFR-1 … NFR-93 (MVP)** plus **NFR-94 … NFR-105 (deferred)**. The identifiers NFR-94 … NFR-97 are therefore already occupied, so the four notification qualities added in review are **renumbered NFR-106 … NFR-109** (§17.3) and were **ratified into that register on 18 August 2026** as its §4.16. The register is now **NFR-1 … NFR-93 + NFR-95 promoted (MVP)**, **NFR-94 … NFR-105 (deferred)**, **NFR-106 … NFR-109 (MVP, notifications)** |
| C-2 | **Filing window.** Earlier text assumes March–April; later text corrects to April–May | Resolved in favour of **April–May**, on the authority of Article 33(3) of Law 287/2017 (§17.2) |
| C-3 | **Timeline.** `System Architecture` §16 opens against a 4–6 month MVP target; §15.5 re-scopes to 8–12 months | Resolved: **8–12 months**, full register retained (§16.3) |
| C-4 | **Billing provider.** `Private Monetization Architecture` describes "integration with a billing provider (Stripe/Paddle/Chargebee-style) via webhooks". `System Architecture` states that **Stripe does not serve Moldova-resident businesses** and that the platform owns the plan catalogue, subscription state machine, order lifecycle, invoicing, numbering, dunning, reconciliation and ledger, with a Paddle-class merchant of record registered but inactive | Resolved in favour of `System Architecture`. This is a genuine evolution, not an error: the monetization document predates the Moldova-resident constraint and D-7/D-8. The **layer separation it argues for survives intact** — only the assumption that Layer 2 could be outsourced to a provider does not |
| C-5 | **Target market.** `Private Monetization Architecture` reframes the target as European SMEs generally, with the Moldova/government scenario as one possible future channel (its Model 6). `System Architecture` scopes the MVP to a Moldovan SME with Moldovan fiscal compliance, and its context diagram names MDED as the Platform Administrator | Resolved: **the MVP is Moldova-specific** — e-Factura, IDNO, BNM, MDL, MIA and Law 287/2017 are all in MVP scope. The monetization document's contribution is retained as the *reason* for the layer separation (§2.2, §5.1) and as the Phase 2–3 seam for advisor, buyer and licensee organizations (§15.1), not as a change of MVP scope |
| C-6 | **XBRL export.** `Research and Architecture Notes` recommends an Excel-first path piped through EFRAG's converter, treating XBRL export as an early module | Resolved in favour of `System Architecture`: **XBRL is Phase 2**, with `DocumentConversionPort` present at MVP so it is additive. The research document's Excel-first reasoning is preserved as the rationale for patching the official template rather than generating XBRL directly |
| C-7 | **Phase numbering.** `Research and Architecture Notes` uses a four-phase map including a Phase 4 for the public portal and ESAP bridge | Resolved in favour of the later documents: **Phase 2 and Phase 3**, with ESAP and blockchain explicitly *uncommitted* and no seam claimed |
| C-8 | **PostgreSQL host.** `Architecture Overview`'s container table says `postgres` is on its "own host from launch", while the staged topology puts everything on one VM during build and pilot | Not a real conflict: "from launch" means **from the public-launch stage**, which is exactly stage 2 of §10.3 |
| C-9 | **Redis naming.** `Architecture Overview`'s container diagram labels the queue-store node `VK` while every statement in both documents names Redis 8.10 | Resolved: **Redis**. `VK` is a residual artefact of the Valkey comparison recorded in §12.4 |
| C-10 | **Deployment topology.** `System Architecture` §11.1 presents three VMs as *the* topology; §16.4 and `Architecture Overview` present it as staged | Resolved: **three VMs is the end state, reached in stages**, and the staging is explicitly reversible (§10.3) |
| C-11 | **Named external tools.** `Research and Architecture Notes` assesses Greenstone/Cority, Workiva and IFC MALENA as tools named in the ToR | Resolved: **none is an MVP integration**. Neither architecture document includes them, and no seam is claimed. MALENA-class document analysis would land behind the Phase 3 AI port |
| C-12 | **NFR-51's RPO = 0 versus asynchronous replication** — an internal tension rather than a cross-document conflict | Resolved by **scoped `synchronous_commit`** on invoice, payment and ledger transactions only, with the blocking consequence accepted explicitly (T-9) |
| C-13 | **Actor set.** `Architecture Overview` lists six actors including `CA`; `System Architecture`'s context diagram shows four boxes (RC, OA, PA, BO) | Resolved: **six actors — CA, RC, OA, PA, BO, SYS.** `CA` and `SYS` are omitted from the context diagram because `CA` is a pre-organizational capability set and `SYS` is internal (§5.3), not because they are not actors |

---

## 18. Open questions

Items genuinely undecided, plus layers on which the sources are **silent**. Silence is recorded as silence; no plausible default has been supplied.

### 18.1 Explicitly open decisions

**Two identifiers collide in this register, recorded 20 Aug 2026 rather than renumbered.** `OQ-43`
and `OQ-44` were each assigned twice on 19 Aug 2026, and neither pair is renumbered because both
of the widely-cited members are cited *by number* from outside this file. Read them by subject:

| ID | Cited elsewhere as | The other row |
|---|---|---|
| `OQ-43` | **Which user-facing text is configuration, and which ships in the release** — cited by `CLAUDE.md`, DR-3, AD-4, FR-61 … FR-64, NFR-25, NFR-85 | *How a static admin bundle gets its per-environment API base URL* |
| `OQ-44` | **The `compact` density steps do not exist** — cited by `CLAUDE.md`, `task.md` task 67, UX-127 | *Which module owns help-centre articles* |

A citation to a bare `OQ-43` or `OQ-44` means the left-hand row. New identifiers continue from
`OQ-51`; nothing is reused.

| # | Question | Status in sources |
|---|---|---|
| OQ-1 | **PostgreSQL 19 arrives around September 2026, mid-build.** Adopt, or stay on 18.x? | Deliberately open. The baseline stays **18.x through launch** and is revisited after the first filing window, against a named benefit rather than on principle |
| OQ-2 | **Closed 18 Aug 2026 — ratified into `non_functional_requirements.md` §4.16** at NFR-106 … NFR-109, above the deferred register so the original NFR-94 … NFR-97 collision stays closed | Resolved. Also closed in `use_cases.md` OQ-5, `functional_requirements.md` OQ-3, `non_functional_requirements.md` OQ-13 and `design_spec.md` OQ-11 |
| OQ-3 | **Closed 18 Aug 2026 — all eight §17.1 amendments are ratified into the registers.** NFR-82, NFR-75, NFR-48, NFR-47, NFR-23, NFR-20 and NFR-95 amended in `non_functional_requirements.md` §4; FR-63 amended in `functional_requirements.md`; the filing window was ratified earlier | Resolved — this was named as the only outstanding action against the architecture baseline. `non_functional_requirements.md` §4 is now the record and §17.1 above is history. Cascaded into `design_spec.md` OQ-1 and OQ-11, `actors.md` OQ-8 and OQ-9, `use_cases.md` OQ-5, `functional_requirements.md` OQ-3 |
| OQ-4 | **NFR-48: accept the re-scoped target, or add a second application VM behind the CDN?** | Closed by re-scoping, with the alternative left standing (R-11, T-7) |
| OQ-5 | **Whether to adopt the TS 7 side-by-side advisory typecheck** now, ahead of full promotion | Documented, available, **not adopted** (AD-13) |
| OQ-6 | **Whether NFR-63 should instead be amended to permit ORM-level scoping** rather than RLS | The honest route is named — amend the NFR explicitly — but the recommendation is to keep RLS. Not reopened |
| OQ-7 | **Whether accessible tagging is reachable at all** through Chromium plus in-place injection | If it proves unreachable, NFR-75 is to be **escalated as a conflict** rather than left claimed and untested |
| OQ-8 | **Narrowed 18 Aug 2026 — the filing-window proxy stands.** Verified: consultation is open to 19 August 2026; the draft mandates disclosure only above >1,000 employees and ~€450M revenue, reports it as a section of the management report, and **takes effect on EU accession** | The draft **sets no submission date of its own**, so the Law 287/2017 April–May proxy in §17.2 is not replaced and NFR-44, NFR-48 and NFR-92 stay planned against April–May. What remains is the final adopted text, now a quarterly regulatory-watch item (NFR-12) rather than a build dependency. Also narrowed in `problem_overview.md` OQ-1 |

### 18.2 Layers on which the sources are silent — **closed 18 Aug 2026, see §12.5**

All fourteen are decided in **§12.5**, taken as one decision because the choices constrain each other. §12.5 is the record for each.

| # | Silent area | What is and is not stated |
|---|---|---|
| OQ-9 | **Closed — Hetzner Cloud, Falkenstein (DE)**; Helsinki (FI) for the off-site copy | EU-owned, so no CLOUD Act argument in the sub-processor register; lowest EU per-vCPU price, which is what makes NFR-47's €0.50 ceiling comfortable at 2,000 organizations; plain VMs suit the Compose topology. No multi-AZ — already priced in by NFR-48's scoping. See §12.5 |
| OQ-10 | **Closed — no CDN at MVP; DNS at Hetzner; TLS terminates at `edge` (Caddy)** | No performance case at ~150 peak concurrent. Proxying would terminate TLS at a third party — a sub-processor entry and a harder NFR-27 story. Reopens only as part of NFR-48's second-app-VM alternative (OQ-4, R-11, T-7). See §12.5 |
| OQ-11 | **Closed — Scaleway Object Storage, Paris**; versioning + Object Lock (Compliance), Glacier for the fiscal archive. AWS and Google excluded on ownership; **bunny.net excluded — no confirmable Object Lock** | Object Lock in Compliance mode is the deciding capability, verified 18 Aug 2026 — no one, owner included, can delete before expiry, which is what DR-6 and NFR-72 require. **Deliberately a different provider from compute**, which makes NFR-72's provider-independence true by construction and testable, addressing OQ-14 in `non_functional_requirements.md`. See §12.5 |
| OQ-12 | **Closed — Mailjet (EU)** behind an `EmailPort` adapter, provider-swappable by configuration | EU-resident with per-message bounce and complaint webhooks, which NFR-107's hard-bounce suppression and FR-157 need. Swappable under P-7; retry semantics stay in the worker, not in provider config, so the swap is LSP-clean. See §12.5 |
| OQ-13 | **Closed — self-hosted OpenBao on VM-3**; SOPS + age only for the pre-OpenBao bootstrap `.env` | **The either/or was already half-decided by NFR-69**, which requires secrets access-logged — SOPS-encrypted files cannot produce an access log. Self-hosting keeps NFR-27 trivially true and adds no sub-processor, the same argument the architecture already makes for observability. See §12.5 |
| OQ-14 | **Closed — GitHub Actions**; Forgejo Actions self-hosted as the drop-in alternative | Every specified gate runs on a stock Linux runner. Part of the decision: **CI holds no long-lived production credentials** — deploys use short-lived OIDC, and CI never reads from OpenBao. See §12.5 |
| OQ-15 | **Closed — Ansible** from foundation stage · **OpenTofu** (VMs, DNS, buckets) when the DR runbook is written · Compose (workload) | Adopted in stages: Ansible immediately, because host configuration drifts continuously; OpenTofu at the first DR rehearsal, where reproducible provisioning is what it buys. Not adopted for scale — the estate stays three VMs. Adds `infra/ansible` and later `infra/tofu` to the §12 layout. See §12.5 |
| OQ-16 | **Closed — Jest + ts-jest** in `apps/api` (HTTP and worker modes), **Vitest** in `apps/{web,admin}` and `packages/*`, Playwright for E2E. **Coverage floors set** | AD-13 already assumes ts-jest; `apps/admin` is Vite, where Vitest is native. Floors: invoice numbering and VAT calculation **100% branch** (a missed branch is a fiscal defect, and both are small pure units), calculator and validation 95/90, entitlement 90/85, project 80 — reported per component, never as an average. Closes `non_functional_requirements.md` OQ-10. See §12.5 |
| OQ-17 | **Closed — a route on `api`** (`/auth/admin/session`), not a Caddy module and not a separate service | DR-11 is one public API with no privileged back door. A token handler at `edge` would be a second auth surface outside the API — one no contract test or OpenAPI diff (P-5) would ever see. See §12.5 |
| OQ-18 | **Closed 18 Aug 2026 — IDNO is the primary entity identifier; LEI is an optional B1 field.** VAT code is retained alongside IDNO in `billing` as it already is. DUNS, EU ID and PermID are not modelled at MVP | **Decided against the research document's LEI-primary recommendation, on population grounds.** IDNO is the Moldovan state registry number: universal across the tenant population, free, already named in the `billing` context, and therefore the only candidate that is actually populated for every organization at signup. LEI carries an annual fee and is held by very few Moldovan SMEs — as the primary key it would be empty for the large majority. Modelling it as an optional B1 field keeps the report VSME-conformant for the cross-border readers who need an LEI (banks, EU buyers) without making the identifier block unsatisfiable for everyone else. **Correction to this question's own premise:** it stated that neither architecture document carries the scheme forward and that `core` names none. In fact **FR-16 already specified "LEI as primary and DUNS, EU ID or PermID as fallback"** — so the register was not silent, it disagreed. FR-16 is amended accordingly (18 Aug 2026), and `functional_requirements.md` §9.5's legacy FR-10 row records that the legacy intent survives while its choice of primary does not. **B1 can be modelled.** Deliberately *not* generalised into a typed multi-identifier list — that would ship an abstraction ahead of a second identifier that anyone has asked for |
| OQ-19 | **Closed — values set.** 5 attempts/15 min per (IP, account) on auth paths; lockout at 10 consecutive failures; 60 req/min per IP and 300 req/min per organization at `edge`; tokens ≥ 256 bits, SHA-256 at rest, single-use; reset 60 min, verification 24 h, invitation 7 days | Also closes `non_functional_requirements.md` OQ-4, which left NFR-64 and FR-4's "threshold" with no pass condition. Auth limits are tighter than the general API because NFR-64's uniform response means enumeration is bounded by rate, not by response difference. See §12.5 |
| OQ-20 | **Closed — schedule set.** Disclosure data and report content: organization life + 1 year. `CALC_INPUT` permanent. Generated exports 24 months. System audit 24 months. Metering 24 months. Application logs 90 days, error traces 30 days. Fiscal and billing audit 6 years, unchanged | Completes the DSR (NFR-28) and exit (NFR-31) runbooks. Erasure now has a defined behaviour for every category rather than only for fiscal documents via FR-130 — this supplies the values that `functional_requirements.md` OQ-5 / `non_functional_requirements.md` OQ-12 would need if an FR is written. See §12.5 |
| OQ-21 | **Closed — RDB snapshots on a volume; AOF off**; `maxmemory 2gb`; **`maxmemory-policy noeviction`**; alert at 70% | RDB does not make Redis a system of record — PostgreSQL plus the outbox remains that, and idempotency keys make replay safe — it shortens recovery. AOF stays off: per-write durability buys nothing here at a real write cost. Correctness rests on a stated invariant: **an outbox row is not marked terminal until the work is terminal**, without which a restart could drop up to 24 hours of pending NFR-107 retries. **`noeviction` is the load-bearing setting**: any eviction policy silently deletes a queued export or a pending e-Factura transmission with no error; `noeviction` fails loudly and the worker retries. See §12.5 |
| OQ-22 | **Closed — 35-day PITR**, weekly full, daily differential, continuous WAL; 12 monthly fulls; 6 yearly Object-Locked fulls; quarterly restore rehearsal | **One rehearsal per year restores to a non-Hetzner host** from Scaleway using only the object store and pgBackRest. That is the rehearsal that actually exercises NFR-72's independence from the hosting provider and closes the substance of `non_functional_requirements.md` OQ-14. See §12.5 |
| OQ-23 | **A public API product.** `api.calls.monthly` exists as an entitlement key and NFR-83 requires a versioned OpenAPI surface, but no MVP requirement defines a customer-facing API offering, its authentication model for machine clients, or its quota enforcement point | Key registered; product undefined |
| OQ-24 | **White-label theming and per-tenant data residency**, which the monetization document identifies as the genuine engineering cost of the institutional-licensee model | No MVP requirement, no seam claimed. Would need a decision before any licensee engagement. Related to, but narrower than, the question of which post-MVP monetization model activates first — that one is logged in `use_cases.md` OQ-2, `functional_requirements.md` OQ-6, `actors.md` OQ-5 and `problem_overview.md` OQ-11; this document logs no equivalent |
| OQ-25 | **Marketplace / referral attribution and consent gating**, and the **aggregate anonymized benchmarking layer**. The monetization document explicitly warns that the anonymization and consent rules are much harder to retrofit than to design in from the start | **No FR, NFR or seam exists for either.** This is the one place where an earlier document's "expensive to retrofit" warning has no counterpart in the architecture baseline, and it should be an explicit accept-or-address decision rather than an omission |
| OQ-26 | **Permission scoping for "one organization manages many client organizations".** `ORG_RELATIONSHIP` is typed and config-driven so a new relationship type needs no migration, but how scoped permissions across a relationship are evaluated — and how `app.current_org` behaves for a user acting on a client organization's behalf — is not specified | Data shape stated; authorization semantics not. Needed before the Advisor or Buyer type is activated |
| OQ-27 | **Closed — Chromium is derived from the Playwright pin**, not separately pinnable. Playwright 1.62.1 ships **Chromium 151.0.7922.34** (verified 18 Aug 2026) | Three controls: explicit `playwright install --with-deps chromium` at the pinned version in Dockerfile and CI, never `postinstall`; the resolved build asserted at container build, failing on mismatch; and **any Playwright bump re-runs the golden-report corpus through veraPDF** for PDF/A-2a + PDF/UA-1 before acceptance. That is the upgrade-verification procedure OQ-27 records as missing (R-9, T-13). See §12.5 |
| OQ-28 | **Team shape and cost.** The 8–12 month estimate is stated for "a competent team"; no team size, composition or budget appears in any source | Silent |
| OQ-29 | **Closed 18 Aug 2026 — provider webhooks get their own 600 req/min per-source-IP bucket at `edge`**, separate from the 60/min unauthenticated budget. Raised at foundation stage: callbacks are unauthenticated by session and all arrive from one acquirer range, so under the general rule a single allowance spans every tenant's payments — and §11.2 makes the callback the only authoritative source of order state. See §12.5.6 | Resolved. An IP allowlist is the stronger control and was **not** adopted as primary: it depends on maib, Victoriabank and MICB publishing stable ranges and announcing changes, which is not established, and a silently rotated range turns a delay into a hard 403 on every callback. Available as per-provider hardening; correctness rests on signature verification and `(provider, provider_event_id)` de-duplication |
| OQ-30 | **Closed 18 Aug 2026 — per-report rights are derived, not stored.** §6.5 previously read as though a per-report grant existed. No FR creates, grants or revokes one; FR-57 assigns an organization role, FR-22's period lock makes a report read-only, and `design_spec.md` has no screen for per-report access. Rights are computed per request from organization role × period state × entity. See §6.5 | Resolved, and FR-158 is satisfied as written — the *evaluation* is per report. Accepted cost: in a multi-entity organization every edit-role member can edit every entity's report, and narrowing that is not an MVP capability. Additive to reverse: an explicit grant table would further restrict, with this derivation as the default. Adjacent and still open: **OQ-26**, permission scoping across an organization relationship |
| OQ-31 | **Which host serves the tenant application, and does the public marketing site share it?** §3.2's surface table lists five surfaces and no public marketing surface at all, yet `design/HANDOFF.md` assigns "public site, identity, workspace, reporting wizard, commerce, help centre" to `apps/web`. The prototypes show `app.easyesg.md` exactly once. This surfaced as a hard build failure, not a preference: the marketing home and S-05 both wanted `/{locale}`, and Next rejects two route groups resolving to one path | **Open — proceeding under a stated, reversible assumption.** `apps/web` scaffolded 18 Aug 2026 with the marketing home at `/{locale}` and S-05 at `/{locale}/home`. The marketing home holds the locale root because it is the SEO landing page and the only page §14.2 permits to be cached. If a host split is confirmed, `/home` becomes `/` on the tenant host behind a redirect. **Scheduled 24 Aug 2026:** §15.4's ninth step and `task.md` task 74 build the marketing home under this assumption rather than around it — the row's reversibility is what makes that legitimate, and the cost of reversing rises from the moment the home is real. Related: `design_spec.md` OQ-12 |
| OQ-32 | **Locale in the URL versus the profile preference — which is authoritative?** UX-2 forbids the active organization from ever appearing in a URL, but says nothing about language, and UX-4 requires every addressable state to have a shareable address | **Closed 18 Aug 2026 — the URL is authoritative for rendering; the profile preference is the default a bare path redirects to.** `/{locale}/` prefixes every route, public and authenticated (`localePrefix: 'always'`). Language is not a security boundary, so the reasoning that makes tenancy session-only does not transfer: a colleague opening a shared link to a validation finding should see the page, in their own language. The mechanism needs no special case — the session writes the `NEXT_LOCALE` cookie at sign-in from the profile preference (S-27, FR-10), and next-intl's ordinary detection then serves authenticated and anonymous alike |
| OQ-33 | **CSRF and `SameSite` policy.** The doc set never uses the words CSRF, XSRF or SameSite. AD-9's design — an httpOnly cookie held by a server tier that forwards authenticated requests — is precisely the shape that makes this live | **Closed 21 Aug 2026 — sealed `SameSite=Lax` cookie plus a same-origin proof on state-changing pass-through requests; no CSRF-token machinery.** Set by the project owner in task 22's open-question batch; §12.5.6 carries the normative text (cookie attributes, the sealing, the `Sec-Fetch-Site`/Origin check, and why `Strict` and double-submit were declined). The locale cookie stays `SameSite=Lax` as scaffolded |
| OQ-34 | **Content Security Policy and the security-header set.** No CSP, no header inventory, and no statement about where they are set — Caddy at the edge, or Next's own headers | **Open.** §14.1's transport row is the complete edge security surface in the doc set. NFR-70 requires markup and script escaping for interface rendering, which a CSP complements rather than replaces |
| OQ-35 | **Tenant session idle and absolute lifetime.** §12.5.6 states 8 h idle / 12 h absolute for the *admin* session and nothing for the tenant one | **Closed 21 Aug 2026 — 7 days idle, 30 days absolute**, set by the project owner in task 21's open-question batch and recorded in §12.5.6's lifetimes row. The idle window anchors on the refresh token's issuance, so AD-12's rotation keeps it rolling while the user keeps returning; the absolute cap anchors on sign-in and is what bounds a stolen refresh token. Decided against the admin values (built for a privileged, IP-allowlisted, MFA-mandatory surface — a different threat model), against 24 h idle (a sign-in wall for reporting that FR-39 and UC-36 describe as intermittent work spread over weeks), and against 30/90 (the weakest posture for fiscal and regulatory records, bought with stickiness the product does not need). Expiry mid-work is a designed-for path, not a failure: UC-07 and UX-38 already require inline re-authentication with drafts preserved |
| OQ-36 | **Poll intervals and backoff.** §11.2 makes polling the named mechanism for order state, and AD-10 for export jobs; FR-161 requires an unread count available from any screen. No interval is stated for any of the three | **Open.** UX-116 sets the constraint qualitatively — under filing-window load no element may poll more frequently than the state it reflects actually changes — but the numbers are unset, and 300 req/min per organization at `edge` (§12.5.6) is the budget they have to fit inside |
| OQ-37 | **The `apps/web` health-check path.** §10.6's blue/green switch health-checks the new Compose project before moving the Caddy upstream, and never names the endpoint | **Closed 18 Aug 2026 — `GET /health`**, outside the `[locale]` segment and excluded from the proxy matcher so it answers identically regardless of language and requires no session. Matches `apps/api`'s existing `/health` exclusion from the global prefix |
| OQ-38 | **Where do the React templates shared by the preview and the PDF live?** §4.11 requires that headless Chromium render "the same React templates the preview uses, so FR-48's preview and FR-49's PDF cannot drift". S-10 is in `apps/web`; the renderer is a separate container | **Open.** `packages/ui` is the natural home — it already carries the token cascade both surfaces share (UX-127) — but §12.2 puts the export templates' `@page` rules, page-break control and counters in SCSS, and the renderer must run them with no client JS and no late web fonts. Needed before Phase 7 |
| OQ-39 | **`next/root-params` migration.** next-intl 4.13 deprecates **both** `requestLocale` (in `getRequestConfig`) and `setRequestLocale` (per layout and page) in favour of `next/root-params`, which Next 16.3 enables by default | **Deferred 18 Aug 2026, with the blocker recorded. Amended 28 Aug 2026 — the blocker is wider than first written, and the revisit condition was therefore wrong.** `apps/web` stays on `requestLocale` and keeps its `setRequestLocale` calls: root params throw inside a Route Handler (Next error E1043), and the module is a compiler-replaced placeholder that throws on plain import, which breaks any unit test reaching `src/i18n/request.ts`. **next-intl's own migration note states root params are unsupported in Route Handlers *and Server Actions*** — and Server Actions are how `apps/web` reaches the API (task 20), so Route Handler support alone would not unblock this. The documented workaround — bind the locale at each call site and have `getRequestConfig` prefer that override — threads a parameter through every action to buy nothing, since next-intl keeps `setRequestLocale` supported for backwards compatibility. Adopting it today would add two failure modes to buy nothing. Revisit when **both** environments are supported, or when the deprecation becomes a removal |

| OQ-40 | **Which router does `apps/admin` use?** No document names one, yet UX-4 requires every addressable state — "a report module, a validation finding, an invoice, **an admin queue filter**" — to have a stable, shareable, bookmarkable address that restores the same state on load | **Closed 19 Aug 2026 — `@tanstack/react-router`** (§12.1), with the `apps/admin` scaffold. Decided on typed, schema-validated search params: the console's information architecture is saved filters over exception queues, so UX-4 lands almost entirely on search-param handling. A router with untyped string params leaves it a convention that review has to catch every time; this makes it a compile-time property. Route tree generated at build time and gated by `pnpm routes:check` |
| OQ-41 | **What is `apps/admin`'s data-fetching and server-state layer?** Not named in any of the seven documents | **Closed 19 Aug 2026 — `@tanstack/react-query`** (§12.1), with the `apps/admin` scaffold. `apps/web` can leave this open because server components fetch on the server; a static SPA has no such tier, so deferring it only meant whoever wrote the first exception queue would pick one under time pressure — the undocumented-decision failure mode. §11.2 already fixes the shape: nothing pushes, everything polls, so `refetchInterval` is the transport for every queue and counter, and the cache/stale/error states map onto §8.1's eleven required states. **Follow-up, 19 Aug 2026: the `apps/web` deferral this row granted is now closed the same way** — the same library, resolving to the same catalog pin, for client islands only (§12.1). The three needs `src/client/polling/` already names are server state in every respect, and the same time-pressure argument applies to whoever writes the first wizard poll. **A global client store was considered at the same time and deliberately not adopted**: after server, URL, form and session state are assigned, the residue is theme and density, a toast queue and wizard-local UI flags, which React context covers — and a store holding the active organization would be the second source of tenancy UX-2 forbids from the URL, in a different container, where AD-2's probes cannot see it |
| OQ-42 | **How many locales does the administrative console's own interface ship in?** NFR-23 and FR-63 set three live locales for "interface, export and email"; `actors.md` frames the three as PA's *content-authoring* scope; `design_spec.md` §3.2's admin row carries no locale column. The three sources are compatible with either answer | **Closed 19 Aug 2026 — Romanian only, i18n-ready**, with the `apps/admin` scaffold. Amended into `non_functional_requirements.md` at NFR-23 and cross-logged in `design_spec.md` §3.2. The console has no locale segment in its URLs. This decides how many catalogues the *chrome* ships in and nothing else: every string remains a message key rather than a literal, so adding a locale is authoring one more catalogue file rather than a rebuild of the route tree (FR-63's "no architectural limit"). **Narrowed 19 Aug 2026 by OQ-43:** those keys resolve from a committed catalogue, not the configuration store, so NFR-85 no longer binds here and a console wording change ships with a release. The Romanian-only decision is unaffected — it rests on locale count, not on where the catalogue lives. The three-locale registry from `@easyesg/i18n` is still consumed — A-03 is where an operator authors all three and registers a fourth |
| OQ-43 | **Which user-facing text is configuration, and which ships in the release?** FR-61 names "field labels, help text and validation messages" as versioned data; `design_spec.md` §13.4 goes further with "every string is a content key, none hardcoded"; the ESLint `JSXText` ban applies to all three browser workspaces. Taken together they read as *every string in the product lives in the configuration store*, which is a different and much larger claim than FR-61 makes, and no document distinguishes a Save button from a VSME disclosure label | **Closed 19 Aug 2026 — text divides by who is blocked waiting on a release**, with the i18n wiring. **Committed message catalogues:** application chrome, VSME disclosure labels and help text, units, validation finding messages, and notification template wording. **Configuration store:** help-centre articles and plan presentation copy. A developer editing a catalogue file is not waiting on anyone — it is the faster path for them — while support fixing a help-article typo and marketing renaming a plan are genuinely blocked, and that is the cost FR-61 was written to remove. Three findings settled it: (1) effective dating is not a blocker, because a validation rule row carries `effective_from` and a stable message key while the wording sits in the catalogue; (2) a notification category cannot exist unless code calls `raise()` with its key (`RaiseNotificationCommand.categoryKey`), so a genuinely new notice always arrives with a release and FR-173's "adding a notice needs no release" was only ever true of the catalogue row, not the trigger; (3) `config/efrag/` already commits the official template binaries per version, so committing the labels read from them is the consistent choice, not the exceptional one. Non-text configuration is untouched — rule definitions, thresholds, factor sets, effective dates and notification behaviour remain data, which is what DR-3 and AD-4 exist for. Amended into DR-3, AD-4's artefact table, §6.6, §7.5, §9.4, §12.1, FR-10, FR-61 … FR-64, FR-173, UC-73, NFR-12, NFR-23, NFR-25, NFR-85, NFR-91, OQ-42, and `design_spec.md` A-03 and A-17. **Costs accepted:** a wording fix for a label or finding message now needs a release; a new locale needs a build (NFR-25 as amended); A-03 loses its string editor. **Reverses cheaply in one direction only** — a catalogue key can move into the store later without touching call sites, because `MessageLoader` is the seam; moving the other way once content is authored in the store is the expensive direction |
| OQ-44 | **Closed 24 Aug 2026 — `platform/content`, a module of its own.** Decided by the project owner over `platform/configuration` holding them as one more artefact. | **Resolved.** Decided on what the two candidates each own. `platform/configuration` owns the **store mechanism** — versions, schedules, the version counter, the ≤5 s replica poll — and deliberately knows nothing about any artefact's meaning, which is the property AD-4 and task 16 protect with "no table and no code per artefact". Every artefact whose *meaning* needs code already has its own module: `platform/taxonomy` and `platform/notification` both read that same generic store. Help content is the same shape, plus one thing none of the others has — **an unauthenticated, per-locale, cacheable read surface** — and putting that inside the module that also serves privileged configuration is how an auth boundary erodes. `platform/localization` was considered and declined on lifecycle: it resolves keys shipped in committed catalogues (OQ-43), while articles are store rows published without a release. **Cost:** a 36th registered module, recorded in §6.7 and `CLAUDE.md`. **Consequence:** `task.md` task 76 is a clean slice, and this row's expiring justification — "no code depends on the answer" — never had to expire. `design_spec.md` OQ-12 closed the same day, as this row said it should | Related: `design_spec.md` OQ-12, OQ-43 |
| OQ-45 | **How is a taxonomy version written?** DR-4 makes version a dimension of the data model and §10.7 names `config/efrag/` as "official Digital Template binaries, per version", but no document gives the identifier's form — EFRAG's own release naming, a semantic version, a date, or a platform-assigned sequence. It surfaces wherever a version becomes a path or a key: `config/efrag/<version>/`, the disclosure label catalogues, the typed facade generated per version (AD-3), and the migration runs in A-04 | **Closed 29 Aug 2026 — EFRAG's own release identifier, verbatim: `YYYY-MM-DD`, so the first registered version is `2026-05-01`.** Decided in `platform/taxonomy` at its first task (33.1), which is where this row said the decision belonged and under the condition it set — the published package was in front of it. **It is a reading rather than a choice, which is why it needed no options round.** The identifier is not ours to invent: EFRAG stamps the release into the namespace URI (`https://xbrl.efrag.org/taxonomy/vsme/2026-05-01`), into the package's own directory layout (`xbrl.efrag.org/taxonomy/vsme/2026-05-01/`), and into the cross-taxonomy hrefs one linkbase uses to reach another (`../../waste/2026-05-01/waste.xsd`). A platform-assigned sequence or a semantic version would be a **second** identifier for a thing that already has one, requiring a mapping table whose only job is to translate our name for a release into EFRAG's — and that mapping is exactly what FR-67's version-pair mappings must not be confused with. **Consequences:** the config-store scope for kind `vsme_taxonomy` is the version (`2026-05-01`), so every registered version stays readable by name forever, which is what a DR-4 pin resolves through and what task 33.3's two-version staging needs; `config/efrag/<version>/` and the per-version label directories take the same string. **Ordering is lexicographic and that is a property, not a coincidence** — ISO 8601 dates sort chronologically as text, so "the later version" needs no parsing. **What is deliberately NOT derived from it:** which version a new report pins. That is a separate effective-dated artefact (`reporting_taxonomy`), because the date EFRAG publishes a release and the date this platform adopts it are different facts, and adopting the newest automatically is behaviour, not data. **Reverses cheaply only before reports exist**, since the string becomes a pinned column value on every one of them — which is why it was taken at 33.1 rather than at 34 | Related: DR-4, AD-3, OQ-43, FR-65, FR-66 |
| OQ-46 | **Does the HTTP API put resolved text or message keys on the wire, and how does it know the caller's language?** §6.8 reads both ways on the envelope, and problem+json is undecided — RFC 9457 wants `title` and `detail` human-readable, while CLAUDE.md names both as surfaces no internal identifier may reach. `Accept-Language` appears nowhere in the seven documents, so there is no negotiation contract either | **Closed 19 Aug 2026 — the API resolves wording server-side**, with the i18n wiring. The locale is negotiated from `Accept-Language` (`app/messages/negotiate-locale.ts`): q-ordering honoured, `q=0` treated as refusal rather than lowest preference, region subtags folded to their language (`ro-MD` → `ro`), source locale when nothing matches; the response states what it served in `Content-Language`. **The clients must send it.** OQ-32 makes the URL authoritative for rendering, so `apps/web`'s server tier forwards its active locale — a page at `/ru` whose errors arrive in Romanian is the failure this exists to prevent — and the console sends `ro` (OQ-42). **The worker never uses a header**: email language resolves per recipient from their profile (FR-169) and export language from the export request (FR-52), both data. Envelope messages carry `key` plus rendered `text`; problem documents carry `type` (a URI, machine-readable) plus a resolved `title`/`detail`, **omitted rather than filled with the slug** when the catalogue has no entry — RFC 9457 makes every member optional, and the previous implementation put the slug in `title` on every response, which was a violation on a surface CLAUDE.md names explicitly. Amended into §6.8, `problem-types.ts`, `MessageDto`, FR-64. **Cost accepted:** every wire consumer depends on the API for wording, so a client cannot re-render a message in another language without asking again | Related: OQ-32, OQ-42, OQ-43 |
| OQ-47 | **How does a workspace package become consumable by `apps/api` and the worker?** All six packages point `main` at raw TypeScript, which only bundlers can load. It went unnoticed because `apps/api` had no workspace dependency until now — but `packages/validation` is shared by `api` and `web` by design (§9.8), and `packages/vsme` and `packages/xlsx-patch` are consumed by the worker, so every one of them meets this | **Closed 19 Aug 2026 — conditional exports over a dual build**, with the i18n wiring, and `packages/i18n` is the template. `exports` resolves `types` to `src` so `pnpm typecheck` needs no prior build, `require` to a CommonJS emit and `import` to an ESM emit; `pnpm -r build` orders packages before apps on its own. Relative specifiers in source carry explicit `.js` extensions, without which the ESM emit is unresolvable by Node — tsc does not rewrite specifiers. The CJS build uses `moduleResolution: bundler` because TS 6 deprecates `node10` (TS5107) and `node16`/`nodenext` refuse to pair with `module: commonjs` (TS5110). Vitest configs alias the package to source so `pnpm test` works on a fresh clone; the `source` condition expresses the same intent but Vite 6+ replaces the default conditions rather than extending them. **This also fixes the production image**, where `pnpm deploy --prod` would otherwise copy a `.ts` entry point Node cannot run | Related: OQ-43, OQ-48 |
| OQ-48 | **Should `apps/api` be an ESM package?** It is CommonJS today. The current ICU engine (`use-intl`, and every FormatJS release it builds on) ships **ESM only** — its `exports` map has no `require` condition — so a static import is impossible and the catalogue is loaded through a dynamic `import()` awaited in both entrypoints. Jest additionally needs `NODE_OPTIONS=--experimental-vm-modules` to execute that import | **Open — proceeding under a stated, reversible assumption.** `apps/api` stays CommonJS and bridges to ESM by dynamic import; `initialiseCatalogue()` is awaited in `main.http.ts` and `main.worker.ts`, and calling `translate` before it is a logged error rather than a throw, because the caller is usually already on an error path. **The assumption is that ESM-only dependencies stay rare enough for one bridge to be cheaper than a module-system migration.** **What changes if it is wrong:** `module`/`moduleResolution`, `nest build`, ts-jest's ESM mode, `emitDecoratorMetadata` behaviour and every relative import in `apps/api/src` — a §12 stack change, not a refactor, which is why it was not taken while wiring i18n. **The stated revisit trigger fired on 24 Aug 2026** — `openid-client` (task 24, §12.1) is the second ESM-only dependency — **and the revisit found the "each new dependency needs its own bridge" premise obsolete**: this app already sits on `module: nodenext` (TS 6) and Node 26, where `require(esm)` is stable, so a plain `import` of an ESM-only package compiles to a `require` Node resolves natively — proven by an actual `require('openid-client')` on 26.7.0. No second bridge exists; the dynamic-import bridge remains `use-intl`'s alone (Jest is the reason it stays: the vm-modules flag executes that import, and the catalogue loads before Jest's runtime is involved). The question stays open only in the narrow sense that the ESM migration was not taken; the new revisit trigger is a dependency whose module graph `require(esm)` cannot load (top-level await), or NestJS documenting ESM as its default | Related: OQ-47, §12.1 |
| OQ-43 | **How does a static admin bundle get its per-environment API base URL?** Vite inlines every `VITE_*` variable at build time, so the API origin is baked into the artefact. §10.4 serves `admin` as a static bundle from `edge` and never says whether one artefact is built per environment or one artefact is configured at serve time | **Deferred 19 Aug 2026, with the assumption recorded.** `apps/admin` is scaffolded assuming **one build per environment** — the reading §10.4 implies — so a staging bundle cannot be promoted to production. If that is wrong, the fix is a small runtime-config fetch before router mount, and it changes `src/lib/env.ts` and the Compose/Caddy configuration but no screen. Needed before the first deployment of `admin`, not before its screens. Interacts with OQ-34: a runtime-config fetch is another origin a CSP would have to allow |
| OQ-49 | **How does a `packages/validation` verdict reach a `react-hook-form` field?** §9.8 makes the rule interpreter the single source of business validation, shared by `apps/api` and `apps/web` so a server verdict and an inline verdict cannot disagree. `react-hook-form` (§12.1, added 19 Aug 2026) expects errors either from its own field rules or from a resolver, and neither shape is the interpreter's. Nothing states which side adapts | **Deferred 19 Aug 2026, with the assumption recorded.** Assumed meanwhile: **the interpreter is authoritative and the form adapts to it** — findings are pushed into the form with `setError` rather than the interpreter being re-expressed as a resolver schema, and **no resolver package is installed**, so the choice stays open rather than being pre-empted by an installed dependency. Field-level UX that carries no business meaning (required, input mask, "this must be a number before it can be evaluated") may stay in the form, because it is not a rule the server also holds. **What changes if it is wrong:** an adapter in `packages/validation` exposing a resolver-shaped entry point, which is additive — no call site moves. **What must not happen either way:** a rule re-expressed as a client-side schema. That is a second source of truth, and §9.8 exists to prevent exactly it. Belongs to Phase 4 (tasks 40–42), where the interpreter is built; naming it now keeps whoever writes the first wizard form from settling it under time pressure |
| OQ-44 | **The `compact` density steps do not exist.** `design_spec.md` §11.4 specifies two density modes over one token set and §12 makes `compact` the administrative default, but `packages/ui/src/styles/tokens.css` defines a single scale and carries no density selector | **Open, and blocking Phase 11.** `apps/admin` declares the hook — `[data-density="compact"]` on `<html>`, so every screen is already inside it — and deliberately authors no values: a second token file in an app is what UX-127 calls a defect, and §15.4 moved the cascade into `packages/ui` precisely to prevent one. Until the steps land there the console renders at the tenant scale, which is a stated divergence from §12 rather than an oversight. Entangled with `design_spec.md` OQ-13: `wide` and `extra` have no pixel values either, and UX-77 makes the console target those two viewports only |
| OQ-50 | **Are instants stored as `timestamptz` or as epoch-millisecond integers?** §6.8 said "in storage and in the DTO alike"; §7.8 and §7.9's conventions table said `timestamptz` for everything. Both are normative sections of this document, and commit `0371292` — which introduced the epoch-ms convention — amended §6.8 only, describing it in its own message as "the section which owns the wire contract". Surfaced 19 Aug 2026 by task 10, whose deliverable is the column convention | **Closed 19 Aug 2026 — `timestamptz` in storage, epoch-ms on the wire, converted at the persistence-to-DTO boundary.** §7 owns the column and §6.8 owns the contract, so §6.8's clause was the overreach and is corrected rather than ratified. Decided on what the columns have to support: `date_trunc`, range partitioning and interval arithmetic over the `audit`, ledger and metering tables §12.5.7 retains for **six years**, and direct readability by an auditor or operator years after the fact — an epoch bigint forfeits the first and is hostile to the second, for no gain, at the same 8 bytes. **Cost accepted:** one conversion at the adapter boundary, and a standing rule that it never leaks inward. `CLAUDE.md` and `apps/api/src/contracts/types/time.ts` both stated the superseded reading and were amended in the same change | Related: §6.8, §7.8, §7.9, NFR-34, AD-14 |
| OQ-51 | **What is the password policy?** No document states one. §9.1 closes the *hashing* — Argon2id, per-user salt, pepper from the secret manager — and says nothing about the input; §12.5.6's bounds (OQ-4, closed) cover rate limit, lockout and token entropy, which are different objects; and `design_spec.md` S-02 requires "password policy enforced on entry with the three-part message formula" against a policy nobody wrote. Surfaced 20 Aug 2026 by task 19 | **Closed 20 Aug 2026 — minimum 8 characters, maximum 128, and at least one lowercase letter, one uppercase letter, one digit and one character that is none of those.** Taken by the platform owner over a NIST SP 800-63B-shaped alternative (≥ 12, no composition rules). Two things it does **not** cost, stated so a re-evaluation starts from facts: it does not breach **UX-108**, because WCAG 2.2's 3.3.8 prohibits a cognitive-function *test* and explicitly permits password entry wherever paste and password-manager autofill work — which is an `apps/web` property task 20 owns, not a policy property; and the 128-character ceiling is a denial-of-service bound rather than a rule about secrets, since Argon2id is deliberately expensive and an unbounded input is an unbounded cost. What it does cost is SP 800-63B §3.1.1.2's recommendation against composition rules, on the evidence that they push users toward predictable substitutions — a strength argument, not a conformance one. **No breached-password corpus check at MVP:** it needs an external service, a port and an NFR-27 transfer argument, none of which a registration endpoint should settle. Recorded in §9.1 and §12.5.6 | Related: FR-1, NFR-64, UX-108, §9.1, §12.5.6 |
| OQ-52 | **How long does an unverified account live, and what does expiry do to the record?** FR-3 requires unverified accounts to expire "after a defined window" and defines none; no other source supplies one, and none says whether the record is deleted or parked. §12.5.6 gives the verification *token* 24 h, which is a different object with a different job. Surfaced 20 Aug 2026 by task 19 | **Closed 20 Aug 2026 — 7 days, and the account record is deleted.** Seven days is 7× the token lifetime, so someone who lets the challenge lapse can register the address again rather than finding it held by their own dead attempt. Deletion rather than a tombstone, on two grounds: an unverified account holds an email address and a password hash whose only purpose has expired, which Law 195/2024 and §12.5.7's posture both point at; and a tombstoned address is unregistrable with nothing to show the user or support why. **Enforced at the point of use from task 19** — an account past the window can neither be verified nor block a re-registration — with the sweep that reclaims the rows landing with the scheduler in Phase 6. The split is deliberate: the predicate is what the requirement is about, and reclaiming rows is data hygiene | Related: FR-3, UC-03, §12.5.6, §12.5.7 |
| OQ-53 | **Does `POST /auth/register` reveal that an address is already registered?** NFR-64 requires uniform responses "irrespective of whether an account exists" and cites FR-4, FR-6 and FR-11 — login, reset request, invitation accept. FR-1 is not among them and is silent, so registration is either an unstated fourth case or deliberately outside the clause. Surfaced 20 Aug 2026 by task 19 | **Closed 20 Aug 2026 — `409 Conflict`, which is NFR-64 as written rather than an exception to it.** The uniform-response clause is scoped by its own citations to the three paths where the response is the only channel available to the caller; registration is not one of them and the FR set never extended it. **Cost accepted and stated:** the endpoint is an account-enumeration oracle bounded only by the edge's 60 req/min unauthenticated budget (§12.5.6), so that limit is load-bearing here in a way it is not on the paths that answer uniformly — task 71 must not treat this route as generic unauthenticated traffic. **What changes if it is revisited:** the response becomes a `202` identical to the success case and the truth moves into the email, which is additive at the controller plus one notification category — no schema change, no change to the account model | Related: FR-1, NFR-64, §12.5.6 |
| OQ-54 | **May the raw verification token travel in `audit.outbox_event.payload`?** AD-6 and P-8 put the verification email on the outbox — sending inside the request transaction is the dual write P-8 exists to remove — so the raw token has to reach the worker somehow, while NFR-64 requires tokens "stored SHA-256". The payload is a durable `jsonb` column that `esg_worker` and `esg_admin_ro` can read. No source addresses a secret travelling in it. Surfaced 20 Aug 2026 by task 19 | **Closed 20 Aug 2026 — the raw token travels in the payload, bounded by grant rather than by encryption.** Decided on the fact that all three token kinds have to share one shape: an invitation (FR-11) is a revocable record that must exist when the request commits, so it cannot be minted by a consumer, and a second pattern for verification alone is the more expensive answer. What holds the exposure is already in place: `esg_app` has `INSERT` and no `SELECT` on the table, so the tier that mints a token cannot read one back; `esg_worker` and `esg_admin_ro` can, and every `esg_admin_ro` acquisition is logged (§7.6, NFR-66). **Two follow-ups this creates, recorded rather than assumed away.** `audit.outbox_event` has no retention rule — §12.5.7 gives it none on the grounds that it is a work list, not a record of what happened — and a dispatched row now holds a secret past its usefulness, so a prune belongs with the first operational sweep in Phase 8. And the same value necessarily reaches Redis as a job payload, which §12.5.8 already treats as ephemeral and never a system of record. **What changes if it is revisited:** the consumer mints the token instead, which moves issuance out of the originating transaction and splits the pattern across token kinds | Related: AD-6, P-8, NFR-64, §7.6, §12.5.7 |
| OQ-55 | **How does a user get a second verification link?** FR-3 requires a time-limited link and nothing anywhere provides for reissuing one. The gap only becomes visible once §12.5.6's 24 h token lifetime is set beside OQ-52's 7-day account window: between the two, the link is dead, the account is alive, registering again answers `409` (OQ-53), and the `409` advises signing in — which an unverified account cannot do. Surfaced 20 Aug 2026 by task 19, while authoring the failure message NFR-79 requires to carry a resolving action | **Closed 20 Aug 2026 — `POST /api/v1/auth/verification-email`, answering `202` uniformly.** The response is identical whether the address is unknown, already verified, or unverified and reissued, which is NFR-64's shape for FR-6's reset request and is available here because — unlike registration — nothing about this request needs to tell the caller anything. Recorded against **FR-3 rather than as a new FR**: a time-limited link that cannot be reissued is not a satisfiable requirement, so this is what FR-3 already asks for rather than a capability beyond it. Issuing a new link invalidates any outstanding one for that account, so a resend leaves exactly one live challenge. **Cost accepted:** an unauthenticated endpoint that causes mail to be sent to a third party, bounded by the edge's 60 req/min per IP (§12.5.6) and by nothing else — task 71 should treat it as an auth path rather than as generic unauthenticated traffic, alongside `register` for the reason OQ-53 gives. Cross-logged in `functional_requirements.md` FR-3 and `design_spec.md` S-02 | Related: FR-3, NFR-64, OQ-52, OQ-53, §12.5.6 |
| OQ-56 | **Which task owns FR-6 (password reset) and FR-7 (change own password)?** `task.md` names neither anywhere — a plan gap, not a spec gap, but it bites concretely at task 21: §12.5.6 makes the reset link one of only two lockout releases, and the other (PA action, FR-77…79) is task 67 in Phase 8, so shipping FR-4's lockout without FR-6 strands a locked-out user for months. FR-6's consume-invalidates-all-sessions is session behaviour, and `design_spec.md` S-02's reset screens are task 22's scope, whose API must exist first. Surfaced 21 Aug 2026 by task 21's open-question batch | **Closed 21 Aug 2026 — FR-6 lands in task 21; FR-7 is assigned to task 27**, decided by the project owner. Task 21 is where the reset flow's three obligations already live: it is the lockout release the same task introduces, it consumes sessions the same task creates, and it is the API S-02's reset screens (task 22) call. FR-7 needs an authenticated caller and a settings surface, neither of which exists before the guard chain (task 28) — it goes to task 27, the security-settings slice TOTP already occupies, **as an assignment rather than a deferral-in-passing**: the row is amended so the requirement has an owner. `task.md` rows 21 and 27 amended accordingly | Related: FR-4, FR-6, FR-7, NFR-64, §12.5.6, `task.md` |
| OQ-57 | **What does sign-in answer for an account that exists, is unverified, and presents the correct password?** NFR-64 requires auth paths to answer uniformly "irrespective of whether an account exists", FR-3 forbids use before verification, and NFR-79 requires every failure to carry a resolving action. The three collide exactly here: a uniform `401` tells a user their correct password is wrong — a false statement with no "what now" — while a distinct answer reveals the account exists. `design_spec.md` S-01's error states list only failed credential, rate-limited and locked out. Surfaced 21 Aug 2026 by task 21's open-question batch | **Closed 21 Aug 2026 — a distinct verification-pending answer (`403`, problem type `email-unverified`), issued only when the presented password is correct**, decided by the project owner. The reading of NFR-64: its uniform-response clause defends against *enumeration*, and a caller who already holds the account's password is not enumerating — the answer discloses nothing they lack, while the resend route (OQ-55) gives NFR-79 its "what now". A wrong password on an unverified account stays inside the uniform `401`, and failed attempts on unverified accounts still count toward FR-4's lockout, so the unverified window is not a free guessing lane. Cross-logged in `design_spec.md` S-01's states | Related: FR-3, FR-4, NFR-64, NFR-79, OQ-55, S-01 |

---

*Consolidated architecture baseline for the ESG Platform (MVP). Traceable to FR-1 … FR-173, NFR-1 … NFR-105, D-1 … D-14, UC-01 … UC-176, DR-1 … DR-11 and AD-1 … AD-14. Actors are `CA`, `RC`, `OA`, `PA`, `BO`, `SYS`. The compliance core must run with `BILLING_ENABLED=false`, and that is a CI job, not an aspiration.*
