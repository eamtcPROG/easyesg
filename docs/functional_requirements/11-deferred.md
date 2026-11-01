# Functional requirements — Part 11: Deferred functional scope

Part 11 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 8 Deferred functional scope (post-MVP) | FR-174 … FR-176, FR-178 … FR-189 (15 requirements). FR-177 left §8 for MVP on 25 Aug 2026 and is held in [part 3](03-authoring-calculator.md#fr-177--the-comprehensive-module). |

Business rules held here: none. Entities held here: none. A deferred requirement is built by nothing in the MVP, so it carries no rule and no entity of its own; the rules and entities of the MVP provisions that keep it open are held in the parts that own those provisions.

**What a deferred block is.** Under §2.7 rule 6 it carries Status, Obligation, Traces, the constraint the MVP architecture must not block, and History, and nothing else. It has no acceptance criteria, no refusals and no surfaces, because nothing is built to test. What a tester can verify at MVP is the **not-blocking constraint**: that the provision it names exists and does what the source says. Each constraint quotes the source that states it and names the MVP requirement, non-functional requirement or architecture decision that keeps the door open. Where no source names a seam, the block says so rather than supplying one.

**Phase tags** are §2.3's. P2 is Phase 2, P2/P3 is Phase 2 or 3 with the phase not yet fixed, P3 is Phase 3, and Roadmap is recorded but not committed.

**Deferred non-functional requirements.** Nine of NFR-94 … NFR-105 are cited in the blocks below, each in the block it constrains: NFR-94, NFR-95 (promoted into MVP), NFR-96, NFR-98, NFR-99, NFR-101, NFR-102, NFR-103 and NFR-105 (`non_functional_requirements.md` §6.2). Their `FR-n` citations carry a `†` there and resolve through the table below. NFR-97 constrains FR-144, an MVP requirement. NFR-100 (certified control framework) and NFR-104 (multi-region recovery) accompany no deferred capability and are in no block. NFR-94, NFR-101 and NFR-105 are unquantified in their source, and `non_functional_requirements.md` OQ-15 requires each to be quantified at promotion into build scope.

## The permanent mapping from source-numbered identifiers

*Moved from the index's §8 on 5 Oct 2026 (task 182).* The deferred set was reproduced from "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)", where fourteen of its identifiers collided with the MVP notification requirements. It was renumbered on 18 Aug 2026 (closes OQ-1; index §2.2 rule 3). A backlog item, test case or external document that cites a source-numbered identifier resolves through this table, and no citation is lost. The superseded legacy FR-12 … FR-20 resolve through index §9.5.

| FR ID | Was (source) | Domain | Phase | Block |
|---|---|---|---|---|
| FR-174 | unchanged | Public disclosure | P3 | [FR-174](#fr-174--the-public-disclosure-portal) |
| FR-175 | unchanged | Submission | Roadmap | [FR-175](#fr-175--the-esap-submission-bridge) |
| FR-176 | FR-160 | Export | P2 | [FR-176](#fr-176--xbrl-export) |
| FR-177 | FR-161 | Report authoring | **MVP** (promoted 25 Aug 2026) | [part 3](03-authoring-calculator.md#fr-177--the-comprehensive-module) |
| FR-178 | FR-162 | Reporting oversight | P2 | [FR-178](#fr-178--completion-dashboards-and-deadline-reminders) |
| FR-179 | FR-163 | Comparatives | P2 | [FR-179](#fr-179--the-standalone-year-over-year-view) |
| FR-180 | FR-164 | Identity | P2 | [FR-180](#fr-180--enterprise-single-sign-on) |
| FR-181 | FR-165 | Identity | P2 | [FR-181](#fr-181--enforced-multi-factor-authentication-for-tenant-users) |
| FR-182 | FR-166 | Advisor | P2/P3 | [FR-182](#fr-182--advisor-entitlement-sponsorship) |
| FR-183 | FR-167 | Corporate buyer | P2/P3 | [FR-183](#fr-183--corporate-buyer-supplier-monitoring) |
| FR-184 | FR-168 | Licensee | P2/P3 | [FR-184](#fr-184--licensee-white-label-administration) |
| FR-185 | FR-169 | Billing | P2 | [FR-185](#fr-185--usage-based-and-metered-pricing) |
| FR-186 | FR-170 | Billing | P2/P3 | [FR-186](#fr-186--reseller-and-partner-commission) |
| FR-187 | FR-171 | Data ingestion | P3 | [FR-187](#fr-187--energy-and-accounting-connectors) |
| FR-188 | FR-172 | Report authoring | P3 | [FR-188](#fr-188--ai-assisted-narrative-drafting) |
| FR-189 | FR-173 | Report authoring | P3 | [FR-189](#fr-189--external-document-risk-flagging) |

## 1. Deferred functional scope (index §8)

### FR-174 — The public disclosure portal

**Status.** Deferred — P3

**Obligation.** The system shall provide an opt-in, searchable public disclosure portal, field-structured to align with anticipated ESAP requirements.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (public opt-in disclosure portal) · `problem_overview.md` §6.2 item 6 · `actors.md` §6.2 · `architecture.md` §15.1, §15.2, AD-2's argument on public disclosure (§4.3) · NFR-105, NFR-63 · legacy FR-19 (old), index §9.5 · FR-175 |

**Not-blocking constraint.** The portal must arrive as a separate read model and never as a relaxation of tenancy. `architecture.md` §15.1 states the seam: *"A **separate `public_disclosure` schema**, written by an explicit publish action and readable anonymously — **not** a relaxation of AD-2. Carries disclosed fields only: no audit trail, no calculator inputs, no omitted values. Field structure already ESAP-shaped."* The MVP keeps this open by:
- AD-2 and NFR-63, which apply row-level security uniformly to every tenant table. AD-2's own text answers the argument that public disclosure makes the rule unnecessary: relaxing access control could reach *"published report content only — one projection of one table"*.
- AD-3, FR-155 and NFR-2, which key the disclosure store by the VSME taxonomy's element names. That is what makes the field structure ESAP-shaped.
- FR-54, FR-55 and FR-33, whose audit trail with previous values and permanently retained calculator inputs are never public (AD-2's text); and BR-DIS-2, whose omitted sections must not appear in a public projection (§15.1: *"no omitted values"*).

At MVP nothing is public: *"a report is confidential for the whole period a company is using the system"* (AD-2's text). The portal is opt-in by design. The Visitor of `actors.md` §6.2 reads only what the platform publishes for unidentified readers, and no tenant's content. NFR-105 (read scale, caching and anti-scraping) states no metric, and is to be quantified at promotion (NFR OQ-15).

**History.**
- 18 Aug 2026 · OQ-1 closed · identifier unchanged while the colliding set was renumbered around it · index §8; `non_functional_requirements.md` §9 C-1

### FR-175 — The ESAP submission bridge

**Status.** Deferred — Roadmap, not committed

**Obligation.** The system shall provide an ESAP-compatible submission bridge. This is a roadmap placeholder, recorded so that it is not forgotten. It needs a concrete problem statement before it is scoped.

| | |
|---|---|
| **Traces** | `problem_overview.md` §6.2 item 7 and its glossary entry for ESAP · `use_cases.md` §7.1 (ESAP submission bridge), OQ-4 · `architecture.md` §8.3, §15.1, §17.8 C-7 (ESAP and blockchain explicitly uncommitted, no seam claimed) · index OQ-7 · legacy FR-20 (old), index §9.5 · FR-176, FR-174 |

**Not-blocking constraint.** None is claimed. `architecture.md` §8.3 and §15.1 both state it in the same words: *"Not built, no seam claimed"* and *"No requirements written"*. The source's own reason is that the bridge is *"blocked on Moldova's accession/connection status; ESAP itself only reaches full public launch July 2027"* (`problem_overview.md` §6.2 item 7). The glossary describes ESAP as built on XBRL and VSME's taxonomy as designed to be ESAP-ready, so the nearest provision is the one FR-176 names (the converter behind `DocumentConversionPort`, AD-8). No source claims that provision for FR-175. Nothing at MVP depends on the bridge (index OQ-7).

**History.**
- 18 Aug 2026 · OQ-1 closed · identifier unchanged · index §8; `non_functional_requirements.md` §9 C-1

### FR-176 — XBRL export

**Status.** Deferred — P2

**Obligation.** The system shall convert stored data to Inline XBRL, XBRL-JSON and XBRL-CSV through EFRAG's self-hosted open-source converter.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (XBRL export) · `problem_overview.md` §6.2 item 2, D-C · `architecture.md` AD-8, §8.3, §15.1, §17.8 C-6 (XBRL is Phase 2, with the port present at MVP) · NFR-98, NFR-18, NFR-11 · legacy FR-12 (old), index §9.5 · source ID FR-160 |

**Not-blocking constraint.** The converter must be reachable as an additive adapter. `architecture.md` §8.3 states the seam: *"Port present, no adapter wired … the port exists so Phase 2 is additive. Self-hosting the converter would add an eighth Compose service."* §15.1 adds that *"the export pipeline is already format-parameterised"*. The MVP keeps this open by:
- FR-156, NFR-11 and AD-8, which place the EFRAG converter behind an internal interface (`DocumentConversionPort`), with no vendor type outside its adapter.
- FR-50, whose export writes the official EFRAG Excel Digital Template at the version pinned to the report. D-C makes this the first step: *"populate the official Digital Template, then pipe through EFRAG's converter when XBRL lands in Phase 2"*.
- FR-155, NFR-2 and AD-3, which keep the schema's element names equal to the taxonomy's local names. The template's named ranges map to taxonomy elements exactly by local name (`problem_overview.md` §3.4).
- NFR-18, which already requires identical values across screen, PDF, Excel and XBRL renderings; and FR-66 and NFR-3, which pin the template and taxonomy version on every report.

When built, the testable obligation is NFR-98: the three instance formats validate against the EFRAG taxonomy under the official validator with zero errors.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-160 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-98's citation repointed)

**FR-177 — The Comprehensive Module.** Promoted into MVP on 25 Aug 2026 (`problem_overview.md` OQ-12, project owner) and no longer deferred. Its block is in part 3: [FR-177](03-authoring-calculator.md#fr-177--the-comprehensive-module).

### FR-178 — Completion dashboards and deadline reminders

**Status.** Deferred — P2

**Obligation.** The system shall provide completion-status dashboards with deadline reminders, as a standalone surface beyond the MVP's overview and notices.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (completion dashboards with deadline reminders as a standalone surface), UC-67, UC-170 · `problem_overview.md` §6.2 item 3 · `architecture.md` §15.1 · legacy FR-14 (old), index §9.5 · source ID FR-162 |

**Not-blocking constraint.** The dashboard must be buildable as a read over data that already exists. `architecture.md` §15.1: *"FR-165 lead-time notices exist at MVP; the dashboard is a read model over existing data."* The MVP substitutes are named in the index's own rationale and in `use_cases.md` §7.1:
- FR-23, the organization-wide overview of every entity and period with completion and validation status (UC-67).
- FR-165, the deadline notice at each configured lead time (UC-170).

FR-165 reads the period's due date (FR-21). `problem_overview.md` §6.2 item 3 draws the line: dashboards and reminders *"beyond MVP notification categories"* are Phase 2.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-162 · index §8; `non_functional_requirements.md` §9 C-1

### FR-179 — The standalone year-over-year view

**Status.** Deferred — P2

**Obligation.** The system shall provide a standalone year-over-year analytics view across periods and entities.

| | |
|---|---|
| **Traces** | D-3 · `use_cases.md` §7.1 (standalone year-over-year analytics view), UC-45, UC-46 · `architecture.md` §15.1 · FR-45, FR-46, FR-47 · legacy FR-15 (old), index §9.5 · source ID FR-163 |

**Not-blocking constraint.** The view must be buildable over the comparative data the MVP already stores. D-3 splits the legacy requirement: *"Comparatives are MVP for storage and inline display; the standalone year-over-year dashboard is P2."* `architecture.md` §15.1 names the seam: *"Multi-period data and prior-period resolution are MVP (D-3, FR-45)."* The MVP keeps this open by:
- FR-45, which stores several reporting periods per entity and resolves the prior period from the period linkage (FR-21).
- FR-46 and FR-47, which show and carry forward prior-period values inline.
- The multi-period data model, which D-3 cites as the reason the MVP half ships (D-3 gives it as NFR-3; see the questions file, Propagation fixes).

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-163 · index §8; `non_functional_requirements.md` §9 C-1
- Undated (baseline) · D-3 · the legacy comparatives requirement is split, with storage and inline display carried into FR-45 … FR-47 and only this view left deferred · `use_cases.md` D-3; index §9.5

### FR-180 — Enterprise single sign-on

**Status.** Deferred — P2

**Obligation.** The system shall support enterprise SSO: federated SAML or OIDC against a customer's own directory, with domain claiming, just-in-time provisioning and directory-driven deprovisioning. This is distinct from the social sign-in in MVP scope (FR-2).

| | |
|---|---|
| **Traces** | D-6 · `use_cases.md` §7.1 (enterprise SSO) · `architecture.md` §8.3, §15.1 · `actors.md` §6.1 · NFR-94 · FR-2, FR-156 · NFR-11, AD-8 · source ID FR-164 |

**Not-blocking constraint.** Federation must be a provider registration and not a rework. D-6: *"the identity model is provider-agnostic so adding it is a provider registration rather than a rework."* `architecture.md` §8.3 and §15.1 name the seam: *"`IdentityProviderPort` is already provider-agnostic (D-6)."* The MVP keeps this open by:
- FR-2 and D-6, under which the authentication paths meet in a single account record, with social sign-in (Google, Microsoft) the only provider kind registered at MVP.
- FR-156, NFR-11 and AD-8, which place identity providers behind an internal interface.

When built, NFR-94 states the obligation: signature, audience and replay are validated on every assertion, and domain claiming and directory-driven deprovisioning are supported *"within a stated latency"*. That latency is unquantified in its source and is to be fixed at promotion (NFR OQ-15). The sources say it *"becomes relevant when Advisor and Corporate Buyer organizations arrive"*.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-164 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-94's citation repointed)

### FR-181 — Enforced multi-factor authentication for tenant users

**Status.** Deferred — P2

**Obligation.** The system shall support enforced multi-factor authentication for tenant users: an organization-level policy, mandatory enrolment, and recovery administration. Platform Administrator MFA remains mandatory and is FR-75's.

| | |
|---|---|
| **Traces** | NFR-95 (promoted), NFR-65 · FR-75 · `use_cases.md` §7.1, UC-193, UC-194, UC-195 · `actors.md` OQ-8, §6.1 · `architecture.md` §12.5.6's task-27.2 row · source ID FR-165 |

**Not-blocking constraint.** The opt-in factor that shipped must be extendable to an enforced one. **The opt-in half is MVP, not this requirement.** NFR-95 (*"opt-in TOTP multi-factor authentication to ordinary tenant users, not enforced"*, recommended to Organization Administrators) was promoted into the MVP register on 18 Aug 2026 and is decomposed as UC-193 (enrol), UC-194 (answer the challenge at sign-in) and UC-195 (recover access without the authenticator). Its row states the boundary: *"no enforcement at MVP"*. What stays deferred is the enforcement layer: a policy an organization sets, enrolment that cannot be skipped, and recovery administration. The MVP keeps this open by:
- NFR-95 and UC-193 … UC-195, which already give every tenant user an enrolment path, a sign-in challenge and a recovery path.
- NFR-65, under which the tenant factor has its own storage and never shares the administrative realm's. §12.5.6's task-27.2 row records that a tenant factor *"may not live on `identity.admin_account`"*.
- FR-75, which keeps administrative MFA mandatory without exception.

**History.**
- 18 Aug 2026 · architecture §17.1 ratified (`non_functional_requirements.md` §9 C-3) · opt-in TOTP for tenant users promoted into MVP scope as NFR-95, and the deferred requirement narrowed to enforcement · index §8 (*"Partly superseded 18 Aug 2026"*); `non_functional_requirements.md` §4.5; `actors.md` OQ-8
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-165 · index §8; `non_functional_requirements.md` §9 C-1
- 26 Aug 2026 · project owner (task 27.2's open-question batch) · UC-193 … UC-195 written to say what NFR-95 does · `use_cases.md` UC-193

### FR-182 — Advisor entitlement sponsorship

**Status.** Deferred — P2/P3. Narrowed on 5 Oct 2026 (§12.5.6 task-182 advisor row, 182/155): the rest of advisor portfolio management was promoted into MVP on 11 Sep 2026 and is FR-190 … FR-203.

**Obligation.** The system shall let an Advisor plan raise the entitlements of the client organizations on its roster, by accepting a relationship as a further override source in the entitlement resolver, without making any compliance-core use case depend on it.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (Advisor entitlement sponsorship), D-16, UC-148 (the resolver) · FR-202 (the MVP boundary: no key of the Advisor plan raises a client's entitlements) · FR-99, FR-154 · FR-14 · FR-190 … FR-203, UC-196 … UC-211 ([part 10](10-advisor.md)) · `actors.md` §6.1 · `problem_overview.md` §4.3, Model 3 (§8.2) · source ID FR-166 |

**Not-blocking constraint.** Sponsorship must arrive as one more override source, never as a rewrite of how entitlements are resolved. The resolver (UC-148) today reads a plan version and a per-subscription override; `use_cases.md` D-16 records that taking sponsorship needs it to accept a relationship as a third source, and that this is why the model is deferred, gated on roster data showing that firms accumulate clients (§7.1). The MVP keeps this open by:
- FR-202, which evaluates every key of the Advisor plan on the advisor organization only, so that nothing yet depends on a relationship raising anything.
- FR-99 and FR-100, which keep gating logic outside the gated capability, so a further override source changes the resolver and no call site.
- FR-14 and FR-193, which already hold the relationship the resolver would read: the roster a firm carries, with its state.
- FR-154, under which no compliance-core use case depends on plan, price or tenant type, so sponsorship can never become a precondition of reporting.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-166 · index §8; `non_functional_requirements.md` §9 C-1
- 11 Sep 2026 · recorded in `use_cases.md` §4.6 · Advisor portfolio management promoted into MVP as UC-196 … UC-211 and FR-190 … FR-203. Entitlement sponsorship alone stays deferred (D-16) · `use_cases.md` §4.6, §6.1, §7.1; `actors.md` §6.1; index §1.2. The index §8 row was not amended
- 5 Oct 2026 · project owner · the requirement is narrowed to entitlement sponsorship, the one part still deferred; its title changes, its identifier and its phase tag do not · §12.5.6 task-182 advisor row (182/155)

### FR-183 — Corporate buyer supplier monitoring

**Status.** Deferred — P2/P3

**Obligation.** The system shall let a corporate buyer invite and monitor supplier organizations, view aggregated and benchmarked dashboards, and request a supplier's VSME data with consent.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (corporate buyer supplier monitoring) · `actors.md` §6.1 · `problem_overview.md` §4.3, Model 4 (§8.2) · `architecture.md` §7.2 (`ORG_RELATIONSHIP`), §15.1 · FR-14, NFR-9, NFR-10 · NFR-101 · source ID FR-167 |

**Not-blocking constraint.** The buyer must arrive as a relationship type added as data. `architecture.md` §15.1: *"`ORG_RELATIONSHIP` typed and config-driven (FR-14, NFR-9)."* The relationship table is described as covering *"buyer monitoring N suppliers"* in the same typed graph as the advisor and licensee shapes. The MVP keeps this open by:
- FR-14 and NFR-9, which add a relationship type without a schema migration, demonstrated by registering a fourth type as data in staging.
- NFR-10, whose pricing units include *per-managed-supplier*.

`actors.md` §6.1 states what the MVP does not have: *"consented cross-organization data sharing and aggregation, neither of which is an MVP concern for a single-tenant SME report."* When built, NFR-101 applies: no benchmarking figure is published from a cohort below a minimum size. That size is unquantified in its source and is to be fixed at promotion (NFR OQ-15).

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-167 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-101's citation repointed)

### FR-184 — Licensee white-label administration

**Status.** Deferred — P2/P3

**Obligation.** The system shall let a licensee administer a white-labelled instance, with its branding, domain and language pack, and the sub-organizations under it.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (Licensee white-label administration) · `actors.md` §6.1 · `problem_overview.md` §4.3, Model 6 (§8.2) · `architecture.md` §7.2 (`ORG_RELATIONSHIP`), §15.1 · FR-14, NFR-9 · FR-63, NFR-4 · NFR-96 · source ID FR-168 |

**Not-blocking constraint.** A licensee must arrive as a relationship type and a locale, with no schema or route change. `architecture.md` §15.1 uses the same seam as FR-183: *"typed and config-driven (FR-14, NFR-9)"*. The MVP keeps this open by:
- FR-14 and NFR-9, as for FR-183, with *"licensee white-labelling for M sub-orgs"* named in the typed graph (`architecture.md` §7.2).
- FR-63 and NFR-4, which let a locale be registered and populated with *"no architectural limit"*. The index §8 rationale cites them for the language pack.

`problem_overview.md` §8.2 states what Model 6 will need beyond that: *"real white-label theming, per-tenant residency and per-licensee legal terms."* NFR-96 turns the first two into the obligation: per-tenant data residency and branding isolation. This is where the Moldova/MDED licensing scenario now sits. `actors.md` §6.1 calls white-labelling *"a distinct product surface, re-scoped out of the direct-to-SME MVP."*

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-168 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-96's citation repointed)

### FR-185 — Usage-based and metered pricing

**Status.** Deferred — P2

**Obligation.** The system shall support usage-based and metered pricing units, for which FR-105 already emits the events and NFR-10 already requires multi-unit entitlement.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.2, UC-152 · `problem_overview.md` Model 2 (§8.2) · `architecture.md` §15.1 · FR-105, FR-85, FR-99 · NFR-10, NFR-57, NFR-99 · source ID FR-169 |

**Not-blocking constraint.** Activating a pricing unit must be additive. `architecture.md` §15.1: *"Metering already emits for actions not currently billed (FR-105, NFR-10)."* The MVP keeps this open by:
- FR-105, which emits an append-only metering event *"for every billable-shaped action, including actions not currently billed"*, and serves counters and quota evaluation from that one stream.
- NFR-10, which requires concurrent pricing units (per-seat, per-report, per-API-call, per-managed-supplier) and verifies it by evaluating *"an unsold pricing unit … end to end without code change"*.
- FR-85, which holds plan entitlements as declarative data, so a new gated capability *"means a new entitlement key rather than new plan logic"*.
- NFR-57, whose at-least-once delivery with de-duplication makes counters exact. This is a precondition for billing from them.

When built, NFR-99 applies: 100% of usage-priced invoice lines are re-derivable from individual metered events. `use_cases.md` §7.2 records usage-based pricing as *"Not offered at MVP"*.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-169 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-99's citation repointed)

### FR-186 — Reseller and partner commission

**Status.** Deferred — P2/P3

**Obligation.** The system shall support reseller and partner commission handling for the Model 3 and Model 5 monetization scenarios.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.2 (reseller and partner commission handling) · `problem_overview.md` Models 3 and 5 (§8.2) · `actors.md` §6.1 (Assurance / Referral Partner) · source ID FR-170 |

**Not-blocking constraint.** None is named. No source states a seam for commission handling: §15.1 of `architecture.md` has no row for it, and the index §8 rationale and `use_cases.md` §7.2 give only the reason, *"Belongs with the Model 3 and Model 5 monetization scenarios, which are not activated at MVP."* The sources do record what those models need. Model 5 *"must be a decoupled module with explicit consent gating"* (`problem_overview.md` §8.2), and the Assurance / Referral Partner actor is *"named but not use-cased"* (`actors.md` §6.1).

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-170 · index §8; `non_functional_requirements.md` §9 C-1
- 11 Sep 2026 · recorded in `use_cases.md` §4.6 · Model 3's Advisor plan (seats, roster size, board) entered MVP with the advisor domain (FR-202). No requirement of FR-190 … FR-203 concerns commission · `use_cases.md` §4.6; index §3.32

### FR-187 — Energy and accounting connectors

**Status.** Deferred — P3

**Obligation.** The system shall support pluggable connectors for energy-provider and accounting-software data ingestion.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (automated data ingestion), UC-32 · `problem_overview.md` §6.2 item 4 · `architecture.md` §8.3, §15.1 · FR-33, FR-156 · NFR-11, NFR-19, NFR-103 · legacy FR-16 (old), index §9.5 · source ID FR-171 |

**Not-blocking constraint.** Ingestion must arrive as an adapter per provider. `architecture.md` §8.3: *"`CALC_INPUT` already accepts sourced values with provenance, so the seam is an ingestion adapter per provider behind a port."* The MVP keeps this open by:
- FR-33, which records consumption by source and by site and retains raw inputs permanently, so an ingested value is one more sourced input.
- FR-156, NFR-11 and AD-8, which put third-party components behind internal interfaces.
- NFR-19, which requires a stored calculation to reproduce exactly from its stored inputs and factor-set version. NFR-103 then asks that connector rate limits, backfill and source restatement never corrupt a reported figure.

The MVP path is manual entry in invoice units (UC-32). `problem_overview.md` §6.2 item 4 records that the item *"needs provider-by-provider scoping and a feasibility study"*.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-171 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-103's citation repointed)

### FR-188 — AI-assisted narrative drafting

**Status.** Deferred — P3

**Obligation.** The system shall provide AI-assisted narrative drafting for qualitative fields (B2 and C2), with mandatory human review before save and authorship remaining with the company.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (AI-assisted narrative drafting), UC-20 · `problem_overview.md` §6.2 item 5 · `architecture.md` §8.3, §15.1 · FR-24, FR-156 · NFR-6, NFR-102, NFR-11 · legacy FR-17 (old), index §9.5 · source ID FR-172 |

**Not-blocking constraint.** An AI feature must arrive as a new port and adapter, gated by a contractual obligation and not by a code change. `architecture.md` §15.1: *"New port + adapter; NFR-6 (no training on customer data, stated retention) is a contractual gate on the adapter, not a code change."* The MVP keeps this open by:
- NFR-6, which stays in force at MVP as a stated obligation (`non_functional_requirements.md` §6.4): no customer data is submitted to model training, and a retention and deletion policy applies to every AI-assisted feature. Its MVP verification is documentary, and the deferred NFR-102 quantifies it.
- FR-156, NFR-11 and AD-8, which put third-party components behind internal interfaces.
- FR-24, whose wizard already carries B2 as the principal narrative module (UC-20).

When built, NFR-102 applies: human review before save on 100% of generated narrative content, with model and prompt provenance recorded. `problem_overview.md` §6.2 item 5 holds that *"legal authorship of report text stays with the company."*

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-172 · index §8; `non_functional_requirements.md` §9 C-1 (NFR-6 and NFR-102's citations repointed)

### FR-189 — External document-risk flagging

**Status.** Deferred — P3

**Obligation.** The system shall optionally call an external document-risk-flagging service (for example IFC MALENA) to surface advisory-only consistency warnings on narrative disclosures.

| | |
|---|---|
| **Traces** | `use_cases.md` §7.1 (external document-risk flagging) · `problem_overview.md` §6.2 item 5, glossary entry for MALENA, OQ-4, OQ-9, R7 · `actors.md` §7 (external systems) · `architecture.md` §8.3, §15.1, §17.8 C-11 · FR-156, NFR-11, AD-8 · legacy FR-18 (old), index §9.5 · source ID FR-173 |

**Not-blocking constraint.** The service must arrive behind a port and never as an MVP integration. `architecture.md` §17.8 C-11 resolves that *"none is an MVP integration"* and that *"MALENA-class document analysis would land behind the Phase 3 AI port"*; §15.1 and §8.3 state the same seam as FR-188 (*"New port + adapter"*). The MVP keeps this open by FR-156, NFR-11 and AD-8, which put third-party components behind internal interfaces with no vendor type outside the adapter. The warnings are advisory-only by design. `problem_overview.md` R7 records that no public source confirms any contractual relationship with the vendor, so the vendor is not to be referenced as a committed partner.

**History.**
- 18 Aug 2026 · OQ-1 closed · renumbered from FR-173 · index §8; `non_functional_requirements.md` §9 C-1
