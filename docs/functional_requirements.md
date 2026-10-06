# ESG Platform — Functional Requirements (MVP)

| Field | Value |
|---|---|
| Document ID | functional_requirements.md |
| Version | 2.0 |
| Status | Index — the detail is in eleven parts under `functional_requirements/` (§2.7) |
| Date | 2026-10-05 (index and parts, task 182); consolidated baseline 2026-08-17 |
| Consolidates | "ESG Platform Functional Requirements (MVP)" (primary); "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)" (primary); "ESG Platform Use Case Register (MVP)" (use case identifiers); "ESG Platform Actors, Use Cases, FR and NFR (MVP)" (superseded legacy FR set; its actors, external systems and legacy NFR-1 … NFR-13 are carried into actors.md and non_functional_requirements.md respectively); "ESG Platform Use Case Design Decisions and Constraints (MVP)" (referenced for `D-n` resolution) |

---

## 1. Purpose and scope

### 1.1 Purpose

This document is the canonical functional requirements specification for the ESG Platform MVP. It consolidates the dedicated Functional Requirements register and its Deferred Scope, Coverage and Traceability companion into a single baseline that a delivery team can design, estimate, build and test against, and that a reviewer can check for coverage in both directions against the use case register.

As consolidated on 17 Aug 2026 it restated existing requirements and introduced none, its acceptance criteria strict restatements that added no behaviour. **Amended 5 Oct 2026 (project owner, task 182):** it now also holds requirements the owner added — FR-204 … FR-210 — and its criteria state behaviour, each citing where that behaviour was decided (§2.5.1); what it still never does is decide behaviour itself.

**Companion documents.** This document is one of seven that make up the consolidated baseline. Each owns its own identifier range, and a citation should be read against the owning document rather than against any pre-consolidation source title:

| Baseline document | Owns |
|---|---|
| `problem_overview.md` | Problem framing, market and monetization models. No requirement identifiers. |
| `actors.md` | Actor definitions and the actor codes `CA`, `RC`, `OA`, `PA`, `BO`, `SYS`. |
| `use_cases.md` | `UC-01` … `UC-214` (MVP) and the design decisions `D-1` … `D-16`. |
| `functional_requirements.md` (this document) and its eleven parts | `FR-1` … `FR-173`, `FR-177`, `FR-190` … `FR-207` (MVP); `FR-174` … `FR-176` and `FR-178` … `FR-189` (deferred, §8; renumbered out of their collision by OQ-1). |
| `non_functional_requirements.md` | `NFR-1` … `NFR-93` and `NFR-106` … `NFR-110` (MVP), `NFR-94` … `NFR-105` (deferred); the legacy `NFR-1` … `NFR-13` reading key. |
| `architecture.md` | System decomposition, component and interface definitions, and amendments proposed against the registers. |
| `design_spec.md` | Interface and interaction design, screen composition and field-level copy. |

Documents under `moldova-guide/` are project-knowledge references outside this seven-document baseline.

### 1.2 Scope

In scope: the 195 MVP functional requirements covering the reporting platform (FR-1 … FR-83, FR-177), the billing, payment and subscription domain (FR-84 … FR-152), the cross-cutting obligations no single use case owns (FR-153 … FR-159), notifications (FR-160 … FR-173), the advisor domain (FR-190 … FR-203, added 11 Sep 2026), and the public tier and data-subject requests (FR-204 … FR-207, added 5 Oct 2026 to close G-9 and OQ-5). The MVP packaging is Model 1 — freemium, direct-to-SME, VSME Basic Module — with three plans: Free, Standard and Enterprise (D-12).

Also in scope, as recorded rather than built scope: the 15 deferred functional requirements at P2, P3 and Roadmap (section 8; FR-177 left it for MVP on 25 Aug 2026), which the MVP architecture is required not to block.

Out of scope of this document:

- **Non-functional requirements.** These are held in `non_functional_requirements.md` — `NFR-1` … `NFR-93` at MVP and `NFR-94` … `NFR-105` deferred. The legacy `NFR-1` … `NFR-13` set is retained there in §8 with its reading key. NFRs are cited here wherever a functional requirement exists to satisfy one.
- **Use case narratives.** `UC-01` … `UC-176` are held in `use_cases.md`. This document cites them; it does not restate them.
- **Design decisions.** `D-1` … `D-14` are held in `use_cases.md`.
- **Interface design, screen composition and field-level copy.** Not specified by any requirement here. Screen composition and copy are held in `design_spec.md`. The VSME field definitions that will seed wizard copy sit in `moldova-guide/05_indicators.md` and `moldova-guide/04_report_structure.md` — project-knowledge documents outside this seven-document baseline — and become a design input once FR-24 moves into UI design.
- **Deliberate MVP exclusions with no requirement written against them:** Buyer and Licensee capability beyond the generic relationship model, and advisor entitlement sponsorship (D-16) — *advisor capability itself was promoted into MVP on 11 Sep 2026 as FR-190 … FR-203, and the Comprehensive Module on 25 Aug 2026 as FR-177*; enterprise SSO; *enforced* tenant MFA (FR-181 — opt-in TOTP became MVP on 18 Aug 2026 as NFR-95, UC-193 … UC-195); XBRL export; usage-based pricing; reseller commissions; multi-currency price automation; direct debit and standing-order mandates; virtual cash register and eBon integration; double-entry accounting; and collection on behalf of customers. These are stated in section 4 of the design decisions document. Where a placeholder requirement already existed against one, it appears in section 8; the remainder carry no requirement at all.

### 1.3 Actor codes

Actor codes follow "ESG Platform System Actors (MVP)" as extended by the use case register. No `ACT-*` identifiers appear in any consolidated source; the codes below are the identifiers in use.

| Code | Actor | Scope |
|---|---|---|
| **CA** | Common Access | Any authenticated user. Account, credential and membership actions available to every actor below. |
| **RC** | Reporting Contributor | Creates and edits report content for one or more reporting entities. No access to organization settings, user list or billing screens. |
| **OA** | Organization Administrator | Manages the organization account: legal entity data, identifiers, reporting periods, users and permissions. May also fill the report, beside the Reporting Contributor (D-2 as amended 5 Oct 2026, task 182). |
| **PA** | Platform Administrator | Maintains platform-wide content and infrastructure across all tenants. No standing access to any organization's report data (D-5). |
| **BO** | Billing Operator | Internal finance role: plan catalogue and pricing, invoice issuance and correction, bank reconciliation, collections, refunds, fiscal reporting. Separated from PA. Recorded in the use case register as a new actor recommended for addition to the System Actors document. |
| **SYS** | System (scheduled / event-driven) | Automated behaviour with no human initiator: recurring charge execution, dunning runs, entitlement evaluation, metering, e-Factura transmission, notification dispatch. |

### 1.4 The parts

*Added 5 Oct 2026 (task 182).* Every requirement's detailed block, and the business rules and entities it carries, are in one of eleven parts. §2.7 says why, and how a block is shaped.

| Part | Holds | Index § |
|---|---|---|
| [1 — Identity, membership and users](functional_requirements/01-identity-membership.md) | FR-1 … FR-12, FR-56 … FR-60, FR-208, FR-209 | 3.1, 3.2, 3.12 |
| [2 — Organization, entities and periods](functional_requirements/02-organization-periods.md) | FR-13 … FR-23 | 3.3, 3.4 |
| [3 — Report authoring, calculator and draft persistence](functional_requirements/03-authoring-calculator.md) | FR-24 … FR-39, FR-177, FR-210 | 3.5 … 3.7 |
| [4 — Validation, comparatives, export and traceability](functional_requirements/04-validation-export.md) | FR-40 … FR-55 | 3.8 … 3.11 |
| [5 — Localization, taxonomy, rules and platform administration](functional_requirements/05-platform-content.md) | FR-61 … FR-83 | 3.13 … 3.16 |
| [6 — Plans, subscriptions, entitlements and checkout](functional_requirements/06-commercial.md) | FR-84 … FR-113 | 3.17 … 3.21 |
| [7 — Payment, invoicing, reconciliation, collections and financial reporting](functional_requirements/07-payments-fiscal.md) | FR-114 … FR-152 | 3.22 … 3.28 |
| [8 — Cross-cutting, the public tier and data-subject requests](functional_requirements/08-cross-cutting.md) | FR-153 … FR-159, FR-204 … FR-207 | 3.29 |
| [9 — Notifications and their delivery](functional_requirements/09-notifications.md) | FR-160 … FR-173 | 3.30, 3.31 |
| [10 — The advisor domain](functional_requirements/10-advisor.md) | FR-190 … FR-203 | 3.32 |
| [11 — Deferred functional scope](functional_requirements/11-deferred.md) | FR-174 … FR-176, FR-178 … FR-189 | 8 |

---

## 2. Requirement conventions

### 2.1 What a functional requirement is here

A functional requirement states an obligation the system must satisfy, expressed as a capability the system provides rather than a goal an actor pursues. It is the complement of a use case: a use case says what someone sets out to achieve and how the interaction unfolds; a requirement says what must be true of the built system for that achievement to be possible.

The two are deliberately not in one-to-one correspondence. One requirement frequently serves several use cases — the entitlement check in FR-99/FR-100 is the same check whether the gated action is inviting a user or generating an export. One use case frequently decomposes into several requirements, because the things that can independently fail, be built or be tested inside one use case are more numerous than the use case itself. Section 9.3 states where this deviation is intentional, so a reader checking coverage by counting rows does not read the difference as a gap.

### 2.2 Identifier scheme

| Prefix | Meaning | Authority |
|---|---|---|
| `FR-n` | Functional requirement | This document, carried from the FR register |
| `UC-n` | Use case | `use_cases.md`, UC-01 … UC-214 |
| `NFR-n` | Non-functional requirement | `non_functional_requirements.md`, NFR-1 … NFR-93 (MVP) and NFR-94 … NFR-105 (deferred); legacy NFR-1 … NFR-13 retained there in §8 |
| `D-n` | Design decision | `use_cases.md`, D-1 … D-16 |

Rules governing identifiers:

1. **FR IDs are a single continuous sequence and are stable.** They are not reused and not renumbered once assigned. Requirements are grouped by domain for reading; the domain is a reading and estimating aid, not a system boundary, and carries no permission meaning.
2. **One deliberate historical breach.** The FR register renumbered from FR-1 and supersedes legacy FR-1 … FR-23 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" in their entirety. The legacy IDs carry different meanings and are still cited in two places — legacy `FR-23` inside UC-148 and legacy `FR-15` inside D-3 — which must be read through the mapping in section 9.5. No further renumbering is permitted.
3. **The ID collision between the two primary sources is resolved by renumbering (18 Aug 2026).** FR-160 … FR-173 were used twice: as MVP notification requirements in the FR register (the later document) and as deferred P2/P3 requirements in the FR Deferred Scope document (the earlier one). **FR-160 … FR-173 mean the MVP notification requirements** in sections 3.30 and 3.31, and the deferred set is renumbered **FR-176 … FR-189** in section 8, above FR-175. Section 8's `Was (source)` column is the permanent mapping, so citations using the source-numbered IDs still resolve. Closes OQ-1.
4. **Actor codes** are CA, RC, OA, PA, BO, SYS as in section 1.3, plus VI (Visitor, 24 Aug 2026) and AD (Advisor Administrator, 11 Sep 2026), both defined in `actors.md`.

### 2.3 Priority scheme

The sources do not use MoSCoW. Priority is expressed as the phase tag that the FR register and the deferred-scope register carry, and no intra-MVP priority ordering is stated by any source. The phase tags are used verbatim; the MoSCoW reading below is a stated mapping for readers who need one, not a per-requirement priority assigned here.

| Phase tag | Meaning | MoSCoW reading |
|---|---|---|
| **MVP** | In MVP build scope. All 195 requirements in section 3 carry this tag. | Must |
| **MVP (architectural)** | In MVP build scope, owned by no single use case; a cross-cutting obligation every use case depends on. | Must |
| **P2** | Deferred to Phase 2. Recorded so the MVP architecture does not block it. | Could (not this release) |
| **P2/P3** | Deferred, phase not yet fixed; sequencing is demand-driven on the MVP success metrics. | Could (not this release) |
| **P3** | Deferred to Phase 3. | Could (not this release) |
| **Roadmap** | Recorded, not committed. | Won't (this release) |

### 2.4 Use of "shall"

Each requirement is stated as a single obligation in the form "The system shall …". Where a source register entry bundles several obligations into one statement, the bundle is preserved as one FR rather than split, because splitting would require new IDs and breach the stability rule. In those cases the acceptance criteria enumerate the obligations separately, so each remains independently verifiable.

Auxiliary verbs carry their conventional meaning: **shall** is an obligation; **shall not** is a prohibition; **may** marks an option the system must permit but the actor need not exercise. No requirement below uses "should".

### 2.5 What counts as testable

A requirement is testable here when it can be verified independently of the other requirements, by observing system behaviour against stated inputs and states. Three conventions apply:

1. **Acceptance criteria state behaviour, and every one cites where that behaviour was decided.** *Amended 5 Oct 2026 (project owner, task 182).* This rule read *"acceptance criteria are strict restatements … and introduce no behaviour, threshold, latency, message text or state not already present in the source"*, which kept the 17 Aug 2026 consolidation honest and left every criterion unusable as a test oracle — none could name a refusal, a boundary or a configured value, because those were decided afterwards, task by task, in `architecture.md` §12.5.6. A criterion in a part (§2.7) may now state any behaviour **a source already decided**, and carries that source in a trailing `(source: …)` — the requirement text, a §12.5.6 row, an OQ closure, a `D-n`, a UC step. **Behaviour no source decides is not a criterion**: it is a question for the owner, settled and written into the document that owns it before the criterion is written. The restriction moved; it did not go away.
2. **Configuration-held values are not fixed by the requirement.** Where a source holds a threshold, factor, interval, ceiling or rate as data (FR-71 … FR-74, FR-118, FR-148, FR-173), the testable obligation is that the value is read from configuration and applied, not that it equals any particular number. The numbers cited in section 4 are the values the sources record, not requirement text.
3. **Prohibitions are testable as prohibitions.** FR-77, FR-104, FR-115 and FR-125 are verified by demonstrating the prohibited state is unreachable, not by demonstrating a happy path.

### 2.6 Register column meanings

| Column | Content |
|---|---|
| **FR ID** | Stable identifier, verbatim from the FR register. |
| **Requirement** | The obligation, stated with "shall". Content carried from the FR register. |
| **Pri** | Phase tag per section 2.3. |
| **Rationale / source** | The decision or non-functional requirement the requirement encodes (`D-n`, `NFR-n`), or the reason stated in the source use case. `—` where the source states none beyond the requirement itself. |
| **Source UC** | Use case(s) the requirement serves, verbatim. `(architectural)` marks a cross-cutting obligation with no originating use case. |
| **Acceptance criteria** | Verification statement per section 2.5. |

### 2.7 The index and its parts

*Added 5 Oct 2026 (project owner, task 182).* This document is **an index and eleven parts**, and the twelve files are one document: one authority, one `FR-n` sequence. The index — this file — keeps the conventions (§1, §2), one row per requirement (§3), and the sections cited by number across the set (§6 … §10). Each part, under `functional_requirements/`, holds the detailed block of every requirement in its area together with the business rules (§4) and entities (§5) those requirements carry.

The split exists because one table row stopped being enough. An obligation, its rationale, its acceptance criteria and the dated record of every amendment shared a single cell, so the current text of FR-29 or FR-31 had to be reconstructed from several paragraphs of history, and the inputs, refusals, states and configured values a builder needs were decided in `architecture.md` §12.5.6 with no way back to the requirement.

**The index row** is `FR ID · Obligation · Pri · Source UC · Detail`. *Obligation* is the requirement's **current** text in one sentence, every amendment folded in; *Detail* links to the block. A row carries no history and no rationale — both are the block's.

**The block** sits under its area's numbered section in the part and takes this shape. A field with nothing to say is left out, as `use_cases.md` §2 leaves out a flow its source does not state:

```markdown
### FR-n — Short title

**Status.** Built | Partial | Not started | Deferred — delivered 37.1, 38.2 · remaining 39.1

**Obligation.** The system shall … — the current text, amendments folded in.

| Actors | Who initiates; who may; who is refused |
| Traces | UC-n · D-n · NFR-n · BR-* · OQ closures · entities |
| Surfaces | S-nn / A-nn · API operations · events |

**Preconditions.** **Inputs.** **Behaviour.** **Refusals.** **Effects.**
**Configuration-held values.** **Boundaries.**

**Acceptance criteria.**
- **AC-1** Given … when … then … *(source: …)*

**History.** date · authority · what changed · where it is recorded — one line per amendment.
```

Rules for the block:

1. **Obligation is current; History is how it got there.** An amendment is made by rewriting the Obligation and adding one History line — never by appending a dated paragraph to the Obligation, which is the shape this split exists to end.
2. **Acceptance criteria are numbered `AC-n` per requirement, cited `FR-34/AC-2`, and never renumbered.** A withdrawn criterion is struck through and keeps its number, under §2.2's stability rule.
3. **Each criterion cites its source** (§2.5.1). A bundled requirement (§2.4) keeps one ID and states its obligations as separate criteria.
4. **Refusals name their wire outcome** — HTTP status and problem type — where one is built; that is a reference a tester needs, and it is never text a user reads.
5. **Configuration-held values state the value in force and where it is held**, and §2.5.2 still governs: the testable obligation is that the value is read from configuration, not that it equals the number.
6. **A deferred requirement's block** carries Status, Obligation, Traces, the constraint the MVP architecture must not block, and History only.

### 2.8 Status

*Added 5 Oct 2026 (project owner, task 182).* Each block opens with one of four words, so a reader learns from the requirement itself what is built and what is not. **The word is a summary; the task numbers beside it are its proof**, and where the two disagree the tasks win.

| Word | Meaning |
|---|---|
| **Built** | Every task realising the requirement is `DONE` — in `archived_tasks.md`, or still in `task.md` under a parent with open siblings. |
| **Partial** | Some are `DONE` and some are not. |
| **Not started** | None is `DONE`. |
| **Deferred** | The requirement is outside MVP (§8). |

This is a recorded exception to the repository's rule that a status word belongs only in `task.md`'s Status column: that rule exists so a plan's state has one home, and here the home is still `task.md` — the word restates it at the requirement, and closing a task is what moves it.

---

## 3. Functional requirements by domain

**195 MVP functional requirements across 34 domains**, one row each; the detail of every row is its block in a part (§1.4, §2.7). FR-1 … FR-83 and FR-177 cover the reporting platform and its administration, FR-84 … FR-152 the billing, payment and subscription domain, FR-153 … FR-159 the cross-cutting obligations no single use case owns, FR-160 … FR-173 notifications, FR-190 … FR-203 the advisor domain, FR-204 … FR-207 the public tier and data-subject requests, and FR-208 … FR-210 the three added on 5 Oct 2026 (task 182): the second factor, a lockout released by a Platform Administrator, and report deletion. **The Obligation column is each requirement's current text** — every dated amendment folded in, its history in the block.

### 3.1 Identity and authentication (FR-1 … FR-8, FR-208, FR-209)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-1 | The system shall allow an account to be registered from an email address and a password, creating an unverified account record and issuing a verification challenge, and shall make no application data reachable until verification completes. A registration presenting a live organization invitation for that same address creates an already-verified account and issues no challenge. | MVP | UC-01 | [Part 1](functional_requirements/01-identity-membership.md#fr-1--registration-with-email-and-password) |
| FR-2 | The system shall allow an account to be registered through a social identity provider — Google and Microsoft at MVP — requesting only identifier, email and display name scopes, and shall produce the same account record with the provider identity as its credential. It shall hold the account in a setup state, able to do nothing but complete its setup, until its owner has set a password and supplied a given name and a family name and confirmed the interface language. An account abandoned in setup is deleted seven days after registration, except one moved into setup from active, which may hold organizations and is never deleted by that rule. | MVP | UC-02 | [Part 1](functional_requirements/01-identity-membership.md#fr-2--registration-through-a-social-identity-provider) |
| FR-3 | The system shall verify control of a registered email address through a time-limited link, transitioning the account to active; shall expire unverified accounts after a defined window; and shall treat verification as satisfied where a provider asserts an already-verified address, or where the account is registered from a live organization invitation issued to that same address. For an account registered through a provider, a verified address satisfies verification but does not make the account active: it enters the setup state until its password and names are set (FR-2), and confirming by link opens its password step for 15 minutes. | MVP | UC-03 | [Part 1](functional_requirements/01-identity-membership.md#fr-3--verify-the-email-address) |
| FR-4 | The system shall authenticate by whichever credential the account holds and issue a session scoped to the user's organization memberships and roles, shall match a provider identity on its subject identifier rather than its email address, and shall rate-limit failed attempts and lock out after a threshold. | MVP | UC-04, UC-05 | [Part 1](functional_requirements/01-identity-membership.md#fr-4--authenticate-with-a-lockout) |
| FR-5 | The system shall terminate a session server-side on logout rather than only clearing it client-side, and on re-authentication after expiry shall return the user to the exact screen and record they were on, submitting any locally queued draft changes. | MVP | UC-06, UC-07 | [Part 1](functional_requirements/01-identity-membership.md#fr-5--sign-out-for-real-resume-after-expiry) |
| FR-6 | The system shall issue a single-use, time-limited password reset link, shall return an identical response whether or not the address is registered, and shall invalidate all existing sessions for the account when the link is consumed. | MVP | UC-08, UC-09 | [Part 1](functional_requirements/01-identity-membership.md#fr-6--reset-a-forgotten-password) |
| FR-7 | The system shall allow an authenticated user to change their password by supplying the current one, with optional termination of their other active sessions. | MVP | UC-10 | [Part 1](functional_requirements/01-identity-membership.md#fr-7--change-own-password) |
| FR-8 | The system shall allow provider identities to be linked to and unlinked from an existing account, shall require authentication by an existing credential before a link is established, and shall refuse removal of the last remaining credential. | MVP | UC-11, UC-12 | [Part 1](functional_requirements/01-identity-membership.md#fr-8--link-and-unlink-provider-identities) |
| FR-208 | The system shall let any signed-in user add a time-based one-time code (TOTP) as a second factor to their own account, take effect only once a current code from it has been returned, and be given ten single-use recovery codes, shown once; shall challenge an account that holds the factor for a current code, or for a recovery code, after the correct password and before any session exists, and never challenge an account that does not hold it; and shall let the user turn the factor off or replace the whole set of recovery codes. The factor is opt-in, is not enforced at MVP, and is recommended to Organization Administrators. | MVP | UC-193, UC-194, UC-195 | [Part 1](functional_requirements/01-identity-membership.md#fr-208--the-opt-in-second-factor) |
| FR-209 | The system shall let a Platform Administrator release a tenant account that FR-4's lockout has locked, stating a reason, so that the person can sign in again without waiting on the reset link, and shall record the release against the administrator in the system audit log. | MVP | UC-214 | [Part 1](functional_requirements/01-identity-membership.md#fr-209--release-a-locked-tenant-account) |

### 3.2 Profile and membership (FR-9 … FR-12)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-9 | The system shall maintain a personal profile — a given name and a family name, the contact email, an optional job title and an optional phone number, and the notification preferences — held independently of any organization the user belongs to, capturing the two name parts at registration and allowing them to be edited afterwards. The display name is derived from the two parts and is not stored. The contact email is the sign-in address, shown and not a second address. The per-category structure of the preferences is FR-163's. | MVP | UC-13, UC-168 | [Part 1](functional_requirements/01-identity-membership.md#fr-9--the-personal-profile) |
| FR-10 | The system shall persist a per-user interface language across devices and sessions, falling back per string to the default locale where a translation is absent and recording each fallback. | MVP | UC-14 | [Part 1](functional_requirements/01-identity-membership.md#fr-10--interface-language) |
| FR-11 | The system shall accept an organization invitation bound to the invited email address, single-use and expiring, granting the assigned edit or view-only role on acceptance and making the organization joined the session's active organization. | MVP | UC-15 | [Part 1](functional_requirements/01-identity-membership.md#fr-11--accept-an-invitation) |
| FR-12 | The system shall support multiple organization memberships per account with an active-organization selection that scopes all subsequent data access, permissions and screens. | MVP | UC-16 | [Part 1](functional_requirements/01-identity-membership.md#fr-12--several-memberships-one-active-organization) |

### 3.3 Organization (FR-13 … FR-16)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-13 | The system shall allow an organization to be created from a verified account and shall automatically grant the creating user the Organization Administrator role over it. | MVP | UC-49 | [Part 2](functional_requirements/02-organization-periods.md#fr-13--create-an-organization) |
| FR-14 | The system shall model organizations with typed parent, child and peer relationships to other organizations, with the direct SME organization type and, from task 116.1, the advisor type active at MVP, so that Buyer and Licensee types can be added without a schema change. | MVP | UC-49 | [Part 2](functional_requirements/02-organization-periods.md#fr-14--typed-relationships-between-organizations) |
| FR-15 | The system shall maintain the organization's registered name, its country and the contact email and phone the platform writes to, with every change attributed and timestamped. The legal form, the registered address and the contact printed on the report cover are each reporting entity's (FR-17), not the organization's. | MVP | UC-50 | [Part 2](functional_requirements/02-organization-periods.md#fr-15--the-organizations-profile) |
| FR-16 | The system shall maintain each reporting entity's identifiers, with **IDNO as primary** and **LEI as an optional additional identifier**, validating format and checksum on entry. DUNS, EU ID and PermID are not modelled at MVP. | MVP | UC-51 | [Part 2](functional_requirements/02-organization-periods.md#fr-16--entity-identifiers) |

### 3.4 Entity and period (FR-17 … FR-23)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-17 | The system shall allow reporting entities to be created and edited with legal form, NACE code(s), site locations, **registered address** and the **contact printed on the report's cover**, permitting more than one entity per organization. | MVP | UC-52, UC-53 | [Part 2](functional_requirements/02-organization-periods.md#fr-17--reporting-entities) |
| FR-18 | The system shall retain entity master data point-in-time, so that a report for a closed period continues to reflect the values in force when it was prepared. A period is closed, for this purpose, once it is locked or its report's B1 has been opened, whichever comes first. | MVP | UC-53 | [Part 2](functional_requirements/02-organization-periods.md#fr-18--entity-master-data-is-point-in-time) |
| FR-19 | The system shall record an entity's consolidation basis and, where consolidated, the subsidiaries inside the reporting boundary, feeding B1 and bounding every quantitative figure in the report. | MVP | UC-54 | [Part 2](functional_requirements/02-organization-periods.md#fr-19--consolidation-scope) |
| FR-20 | The system shall allow a reporting entity to be archived, removing it from active selection while retaining its historical reports and exports intact. | MVP | UC-55 | [Part 2](functional_requirements/02-organization-periods.md#fr-20--archive-an-entity) |
| FR-21 | The system shall allow a reporting period to be opened for an entity with fiscal year and start and end dates, pinning the current template and taxonomy version and linking the immediately preceding period, and shall record an optional due date by which the report must be complete, distinct from the period end. | MVP | UC-56 | [Part 2](functional_requirements/02-organization-periods.md#fr-21--open-a-reporting-period) |
| FR-22 | The system shall allow a reporting period to be locked, after which it refuses every write, **the Organization Administrator's included**, and to be reopened with acting user, timestamp and stated reason recorded. | MVP | UC-57, UC-58 | [Part 2](functional_requirements/02-organization-periods.md#fr-22--lock-and-reopen-a-period) |
| FR-23 | The system shall present an organization-wide overview of every period of every entity, with completion and validation status, in a single view. | MVP | UC-67 | [Part 2](functional_requirements/02-organization-periods.md#fr-23--the-organization-wide-overview) |

### 3.5 Report authoring (FR-24 … FR-32, FR-177, FR-210)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-24 | The system shall provide a guided, stepped wizard over every VSME Basic Module disclosure B1 … B11, one step per module, capturing a module's structured and narrative content together, and entering a report at the module where work last happened or, where nothing is answered, at the first incomplete step. | MVP | UC-18, UC-19 … UC-29 (**UC-20** named explicitly — B2 is the one narrative module in the range; OQ-4) | [Part 3](functional_requirements/03-authoring-calculator.md#fr-24--the-guided-wizard) |
| FR-25 | The system shall list the reports of the active organization, each with its entity, period, scope, status and last activity and its completion and validation summary, showing a view-only member the same entries without edit affordances. | MVP | UC-17 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-25--the-reports-list) |
| FR-26 | The system shall admit a write to a report only from a member holding the editor or Organization Administrator role, and only while the report's period is open, refusing it on every route and in the database rather than only in the interface. | MVP | UC-18 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-26--who-may-edit-and-when) |
| FR-27 | The system shall pre-fill B1 from the reporting entity's point-in-time snapshot (FR-18), keep every pre-filled value editable in the report without altering the entity record, and refresh the snapshot from the entity until B1 is first opened. | MVP | UC-19 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-27--b1-pre-filled-from-the-company-record) |
| FR-28 | The system shall decide from B1's stored answers, by effective-dated rules held as configuration, which disclosures apply, showing those that do and not showing those that do not rather than presenting a field and rejecting it later. | MVP | UC-19, UC-23, UC-24, UC-26, UC-28 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-28--conditional-applicability) |
| FR-29 | The system shall capture each quantitative disclosure in the unit the standard states for it, or with no unit where it states none, letting the reporter choose where several are admitted and defaulting to none; and shall derive, rather than accept typed, the figures the standard computes. Those figures are B3's total and GHG intensity, B8's turnover rate, B9's accident rate and B10's collective-agreement coverage and pay gap. | MVP | UC-21, UC-22, UC-24, UC-25, UC-26, UC-28 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-29--quantities-in-the-standards-units-intensities-derived) |
| FR-30 | The system shall store a numeric zero as an affirmative nil return, distinct from a field never answered, and shall render it as a stated answer on every surface. | MVP | UC-27, UC-29 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-30--zero-is-an-answer) |
| FR-31 | The system shall allow a disclosure section to be declared omitted as classified or sensitive information, the one ground VSME ¶19 permits, recording it in B1's list of omitted disclosures without a rationale (¶24(b)). The declaration shall satisfy validation rather than suppress it, be discounted in completion, and appear in both exports. | MVP | UC-30 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-31--a-section-omitted-as-classified-or-sensitive) |
| FR-32 | The system shall allow any field to be declared not available with a stated reason, as a terminal state distinct from `MISSING VALUE`, refusing the declaration without a reason. | MVP | UC-31 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-32--a-field-not-available-with-a-reason) |
| FR-177 | The system shall support the VSME Comprehensive Module C1 … C9 as an additive extension of Basic, selected by the report's scope flag at creation or on a report in progress, and authored, made conditional, validated and exported by the same mechanisms as B1 … B11. | MVP | UC-183 … UC-192 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-177--the-comprehensive-module) |
| FR-210 | The system shall let the Organization Administrator delete a report, only while the report's period is open and only if the report has never been exported, by removing it from every list and route while its values, calculation runs, change trail and export records stay stored until the organization's retention ends. | MVP | UC-213 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-210--delete-a-report) |

### 3.6 Carbon calculator (FR-33 … FR-36)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-33 | The system shall record energy and fuel consumption by source and by site in the units of the company's own invoices, retaining the raw inputs permanently alongside every figure derived from them so that a calculation can be retraced. | MVP | UC-32 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-33--record-consumption-in-invoice-units-retained-permanently) |
| FR-34 | The system shall convert each consumption line to MWh, apply the emission factor set in force for the reporting period, and compute Scope 1 and location-based Scope 2 in tCO₂e, writing them into B3. From those figures it derives B3's total and its GHG intensity: the total divided by B1 turnover, in the report's currency. | MVP | UC-33 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-34--compute-scope-1-and-location-based-scope-2) |
| FR-35 | The system shall store against every computed result the emission factor set version it was computed under, so that a later factor update never silently restates a figure already reported. | MVP | UC-33 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-35--pin-the-factor-set-version-to-every-result) |
| FR-36 | The system shall allow a computed figure to be annotated, or replaced by an externally calculated figure with a stated reason, flagging the replacement, naming on the figure the person who made it, and retaining the superseded computed figure. | MVP | UC-34 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-36--annotate-or-override-a-computed-figure) |

### 3.7 Draft persistence (FR-37 … FR-39)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-37 | The system shall persist each field change automatically on blur and on step change, with no explicit save action, acknowledging a change only once it is durably committed. | MVP | UC-35 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-37--autosave-with-no-save-action) |
| FR-38 | The system shall queue changes durably on the device and retry them when the network or the session is unavailable, warning the user while anything remains unsynced and before any action that would abandon the queue. | MVP | UC-35 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-38--queue-offline-and-warn-while-unsynced) |
| FR-39 | The system shall restore a returning user to the report as it was left — field values, the wizard position and validation flags — on any device and in any session, with the position derived per report from the module where work last happened. | MVP | UC-36 | [Part 3](functional_requirements/03-authoring-calculator.md#fr-39--resume-where-the-work-was-left) |

### 3.8 Validation (FR-40 … FR-44)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-40 | The system shall expose a validation state for every field, among `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL`, plus the declared-not-available state (FR-32), inline at the point of entry rather than only in a separate report. | MVP | UC-37 | [Part 4](functional_requirements/04-validation-export.md#fr-40--per-field-validation-state-inline) |
| FR-41 | The system shall roll validation state up per module and across the whole report, discounting sections declared omitted as classified or sensitive information (FR-31) so that a legitimate omission does not depress completion. | MVP | UC-38 | [Part 4](functional_requirements/04-validation-export.md#fr-41--roll-up-per-module-and-per-report) |
| FR-42 | The system shall allow navigation from any validation finding directly to the affected field, focused, with the rule explanation shown. | MVP | UC-39 | [Part 4](functional_requirements/04-validation-export.md#fr-42--from-a-finding-to-its-field) |
| FR-43 | The system shall re-run validation idempotently at any level of completeness, so that it functions as a working tool during drafting and not only as a pre-export gate. | MVP | UC-40 | [Part 4](functional_requirements/04-validation-export.md#fr-43--validation-re-run-at-any-completeness) |
| FR-44 | The system shall permit export with unresolved findings after an explicit warning, marking the gaps visibly in the output rather than omitting them silently. | MVP | UC-42 | [Part 4](functional_requirements/04-validation-export.md#fr-44--export-with-unresolved-findings-after-a-warning) |

### 3.9 Comparatives (FR-45 … FR-47)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-45 | The system shall store multiple reporting periods per entity and resolve the prior period automatically from the period linkage, with no manual selection. | MVP | UC-45, UC-56 | [Part 4](functional_requirements/04-validation-export.md#fr-45--prior-period-resolved-from-the-linkage) |
| FR-46 | The system shall display the prior-period value alongside the current input at the point of entry, so that an implausible year-over-year movement is visible while it can still be checked. | MVP | UC-45 | [Part 4](functional_requirements/04-validation-export.md#fr-46--the-prior-period-value-beside-the-input) |
| FR-47 | The system shall allow a prior-period value to be carried forward into the current period, marking it as carried forward so that it is reviewed rather than accumulating unnoticed. | MVP | UC-46 | [Part 4](functional_requirements/04-validation-export.md#fr-47--carry-a-prior-value-forward-marked) |

### 3.10 Export (FR-48 … FR-53)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-48 | The system shall render a preview of the fully assembled report — narrative, indicator tables, comparatives — as it will appear when exported, without generating a file. | MVP | UC-41 | [Part 4](functional_requirements/04-validation-export.md#fr-48--preview-of-the-assembled-report) |
| FR-49 | The system shall generate a formatted, publication-ready PDF from stored data in the selected export language. | MVP | UC-42 | [Part 4](functional_requirements/04-validation-export.md#fr-49--the-pdf) |
| FR-50 | The system shall write stored values into the named ranges of the official EFRAG Excel Digital Template at the version pinned to the report, preserving the template's own dropdowns and consistency-check formulas. | MVP | UC-43 | [Part 4](functional_requirements/04-validation-export.md#fr-50--the-efrag-excel-digital-template) |
| FR-51 | Where a report is pinned to a superseded version, the system shall prompt migration or export against the original version with an explicit notice, and shall never silently export against a version the report was not prepared under. | MVP | UC-43, UC-78 | [Part 4](functional_requirements/04-validation-export.md#fr-51--never-an-export-against-an-unplanned-version) |
| FR-52 | The system shall allow the export language to be selected independently of the user's interface language. | MVP | UC-48 | [Part 4](functional_requirements/04-validation-export.md#fr-52--export-language-independent-of-the-interface) |
| FR-53 | The system shall maintain an immutable export history recording format, language, taxonomy version, timestamp and generating user, and shall allow any prior export to be re-downloaded in exactly the form it was distributed. | MVP | UC-44 | [Part 4](functional_requirements/04-validation-export.md#fr-53--immutable-export-history) |

### 3.11 Traceability (FR-54 … FR-55)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-54 | The system shall record, per field, who changed a value, when, and what the previous value was. | MVP | UC-47 | [Part 4](functional_requirements/04-validation-export.md#fr-54--who-changed-a-field-when-and-from-what) |
| FR-55 | The system shall retain historical attribution after a user's access to the organization is removed, so that revoking access never erases the audit trail. | MVP | UC-47, UC-63 | [Part 4](functional_requirements/04-validation-export.md#fr-55--attribution-survives-removal-of-access) |

### 3.12 Users and access (FR-56 … FR-60)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-56 | The system shall list every user with access to the organization, their role, status — active or pending invitation — and last activity. | MVP | UC-59 | [Part 1](functional_requirements/01-identity-membership.md#fr-56--who-has-access) |
| FR-57 | The system shall allow a user to be invited by email with an edit or view-only role, an unacted invitation to be resent, and an invitation to be revoked, with revocation invalidating the outstanding link immediately. | MVP | UC-60, UC-61 | [Part 1](functional_requirements/01-identity-membership.md#fr-57--invite-resend-and-revoke) |
| FR-58 | The system shall allow an existing member's role to be changed, taking effect on that user's next request rather than at their next login. | MVP | UC-62 | [Part 1](functional_requirements/01-identity-membership.md#fr-58--change-a-members-role) |
| FR-59 | The system shall allow a member's access to the organization to be removed without deleting their account or their historical contributions. | MVP | UC-63 | [Part 1](functional_requirements/01-identity-membership.md#fr-59--remove-a-members-access) |
| FR-60 | The system shall allow another member to be promoted to Organization Administrator, so that the departure of a sole administrator cannot lock an organization out of its own settings. | MVP | UC-64 | [Part 1](functional_requirements/01-identity-membership.md#fr-60--promote-to-organization-administrator) |

### 3.13 Localization and content (FR-61 … FR-64)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-61 | The system shall hold help-centre articles and plan presentation copy, the text edited by people who cannot deploy, as versioned data editable through an administrative console, so that a wording correction by support or marketing reaches users without a release. | MVP | UC-71 | [Part 5](functional_requirements/05-platform-content.md#fr-61--help-centre-articles-and-plan-copy-as-versioned-data) |
| FR-62 | The system shall publish a reviewed set of the content held under FR-61 as an explicit, versioned and reversible step taking effect across all tenants at once, so that a half-finished translation is never live. Catalogue wording is not published by a step: it is published by deploying the release that contains it, and a half-finished catalogue is prevented at build time (FR-64). | MVP | UC-72 | [Part 5](functional_requirements/05-platform-content.md#fr-62--publish-a-reviewed-content-set-all-tenants-at-once) |
| FR-63 | The system shall allow an additional interface and export locale to be registered and populated without redesigning any screen, route or schema, with **Romanian (source), English and Russian live at MVP**, each separately authored and never machine-translated, and no architectural limit. A new locale is a catalogue file plus a build. | MVP | UC-73 | [Part 5](functional_requirements/05-platform-content.md#fr-63--a-locale-is-registered-by-authoring-its-catalogue) |
| FR-64 | The system shall prevent an untranslated key from reaching a user, by a build-time parity gate for catalogue text and a reviewable runtime fallback queue for the content held under FR-61. | MVP | UC-14, UC-74 | [Part 5](functional_requirements/05-platform-content.md#fr-64--no-untranslated-key-reaches-a-user) |

### 3.14 Taxonomy and versioning (FR-65 … FR-70)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-65 | The system shall allow a new VSME Digital Template or XBRL taxonomy version to be registered from its committed artefact, with an explicit backwards-compatibility determination recorded for the pair it forms with the version before it, and pinned by periods opened from that point forward. | MVP | UC-75 | [Part 5](functional_requirements/05-platform-content.md#fr-65--register-a-template-and-taxonomy-version) |
| FR-66 | The system shall store an explicit template and taxonomy version against every report. The pair is determined when the period is opened, copied to the report when it is created, and moved only by an explicit migration. | MVP | UC-56, UC-75 | [Part 5](functional_requirements/05-platform-content.md#fr-66--every-report-stores-its-template-and-taxonomy-version) |
| FR-67 | The system shall allow the field mapping between an outgoing and an incoming version to be authored deliberately, covering added, removed and semantically altered fields. | MVP | UC-76 | [Part 5](functional_requirements/05-platform-content.md#fr-67--author-the-field-mapping-between-two-versions) |
| FR-68 | The system shall list every report still pinned to a superseded version, grouped by organization and by version, as the exposure view preceding any migration. | MVP | UC-77 | [Part 5](functional_requirements/05-platform-content.md#fr-68--the-exposure-view) |
| FR-69 | The system shall execute a migration run against a selected set of reports, in bulk for a compatible change or report-by-report with manual review for a breaking one, preserving the pre-migration state rather than overwriting in place. | MVP | UC-78 | [Part 5](functional_requirements/05-platform-content.md#fr-69--execute-a-migration-run) |
| FR-70 | The system shall notify organizations whose reports were migrated or now require re-export, rather than leaving them to discover it at export time, dispatched per FR-166 and delivered through the notification mechanism (FR-160 … FR-171) rather than shown as an in-product banner alone. | MVP | UC-79, UC-171 | [Part 5](functional_requirements/05-platform-content.md#fr-70--tell-the-organizations-a-version-change-reaches) |

### 3.15 Rules and factors (FR-71 … FR-74)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-71 | The system shall maintain versioned, effective-dated emission and conversion factor sets as data, one artefact per country, so that a set serves the periods that start within its window and no two sets are in force for one period. | MVP | UC-80 | [Part 5](functional_requirements/05-platform-content.md#fr-71--emission-and-conversion-factor-sets-as-data) |
| FR-72 | The system shall maintain conditional-applicability thresholds as effective-dated configuration rather than code, read as of today so that a published change reaches reports already in progress. | MVP | UC-81 | [Part 5](functional_requirements/05-platform-content.md#fr-72--applicability-thresholds-as-configuration) |
| FR-73 | The system shall maintain validation rule definitions as configuration, each naming the message it fires by a key whose wording is committed in the catalogues, separately from applicability thresholds. | MVP | UC-82 | [Part 5](functional_requirements/05-platform-content.md#fr-73--validation-rule-definitions-as-configuration) |
| FR-74 | The system shall apply content-only and rule-only changes without a redeploy, supporting a quarterly regulatory-watch cadence. Content is FR-61's. A rule is a threshold, a factor set, a validation rule, an effective date or a notification behaviour. | MVP | UC-71, UC-81, UC-82 | [Part 5](functional_requirements/05-platform-content.md#fr-74--content-only-and-rule-only-changes-without-a-redeploy) |

### 3.16 Platform administration (FR-75 … FR-83)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-75 | The system shall authenticate Platform Administrators, and the Billing Operators who share the realm, through a separate administrative surface with multi-factor authentication mandatory on every sign-in, holding elevated credentials apart from ordinary tenant accounts. | MVP | UC-68 | [Part 5](functional_requirements/05-platform-content.md#fr-75--administrator-sign-in-on-a-separate-surface-with-a-second-factor-every-time) |
| FR-76 | The system shall provide a searchable register of all organizations exposing account-level metadata (registration date, entity count, plan, activity) and shall never expose report content. | MVP | UC-69 | [Part 5](functional_requirements/05-platform-content.md#fr-76--a-register-of-organizations-with-no-report-content) |
| FR-77 | The system shall grant no standing Platform Administrator access to any organization's report data at any point. | MVP | UC-69, UC-85 | [Part 5](functional_requirements/05-platform-content.md#fr-77--no-standing-access-to-report-data) |
| FR-78 | The system shall issue scoped, time-limited support-access grants only on a request stating a reason and a ticket reference **and granted by an Organization Administrator of the named organization**, expiring automatically without administrator action. | MVP | UC-85 | [Part 5](functional_requirements/05-platform-content.md#fr-78--support-access-that-the-organization-grants) |
| FR-79 | The system shall maintain a support-access audit log recording the requester, the organization, the reason and what was accessed, together with what the organization decided and who decided it and how the grant ended, reviewable but not editable from within the administrative console. | MVP | UC-86 | [Part 5](functional_requirements/05-platform-content.md#fr-79--the-support-access-log) |
| FR-80 | The system shall allow platform administrator accounts to be created, modified and deactivated with **roles composed of permissions**, so that content, operations and support functions do not require one another's rights, **and shall allow an administrator to manage their own credentials (password, second factor and recovery codes) without another administrator's involvement**. | MVP | UC-87, UC-212 | [Part 5](functional_requirements/05-platform-content.md#fr-80--administrator-accounts-and-their-own-credentials) |
| FR-81 | The system shall maintain a platform-wide system audit log of version rollouts, content publications, migration runs, factor-set updates and administrator account changes, each attributed and timestamped. | MVP | UC-88 | [Part 5](functional_requirements/05-platform-content.md#fr-81--the-platform-wide-system-audit-log) |
| FR-82 | The system shall allow the social identity providers FR-2 names to be registered, enabled, disabled and have their credentials rotated without a redeploy, with disabling stopping new registrations and links while leaving existing accounts able to authenticate by another credential. The client id, issuer and redirect addresses rotate without a deployment through A-18. The client secret rotates by an environment change and a restart until task 154 moves it into the secret manager. | MVP | UC-70 | [Part 5](functional_requirements/05-platform-content.md#fr-82--social-identity-providers-managed-without-a-redeploy) |
| FR-83 | The system shall provide an adoption and usage dashboard covering the defined MVP success metrics (SMEs completing a full report, exports by format, average completion time, export-usage rate), filterable by period and segment, marking low-volume figures as low-confidence, and exportable for stakeholder reporting. | MVP | UC-83, UC-84 | [Part 5](functional_requirements/05-platform-content.md#fr-83--the-adoption-and-usage-dashboard) |

### 3.17 Plan catalogue (FR-84 … FR-89)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-84 | The system shall model a subscription plan as a first-class versioned record rather than a constant in code, so that a plan is created, described and versioned as data with no code change. | MVP | UC-89 | [Part 6](functional_requirements/06-commercial.md#fr-84--a-plan-is-a-versioned-record-not-a-constant) |
| FR-85 | The system shall hold plan entitlements and quotas as declarative data — entities, seats, reports in total, exports by format, API allowance, module access, support tier — consumed by the entitlement service, so that a new gated capability means a new entitlement key rather than new plan logic. | MVP | UC-90 | [Part 6](functional_requirements/06-commercial.md#fr-85--entitlements-and-quotas-are-declarative-data) |
| FR-86 | The system shall allow prices to be authored per plan version, per currency and per billing cycle rather than converted at display time. | MVP | UC-91 | [Part 6](functional_requirements/06-commercial.md#fr-86--prices-per-plan-version-currency-and-billing-cycle) |
| FR-87 | The system shall version a plan on any price or entitlement change with an explicit grandfathering choice, every subscription referencing the exact plan version it was sold under. | MVP | UC-92 | [Part 6](functional_requirements/06-commercial.md#fr-87--versioning-with-an-explicit-grandfathering-choice) |
| FR-88 | The system shall allow a plan version to be published for new purchase and a plan to be retired, with retirement naming a successor plan and closing every version of the plan to new subscriptions, and with existing subscribers keeping their service without a gap until they change or renew, when they move to the successor. | MVP | UC-93 | [Part 6](functional_requirements/06-commercial.md#fr-88--publish-a-plan-retire-a-plan) |
| FR-89 | The system shall allow discount codes and trial terms to be defined per plan version — percentage or fixed, first-period or recurring, validity dates, redemption limits, plan eligibility, trial length, payment-instrument requirement and expiry behaviour — without a release. | MVP | UC-94, UC-95 | [Part 6](functional_requirements/06-commercial.md#fr-89--discount-codes-and-trial-terms-per-plan-version) |

### 3.18 Subscription (FR-90 … FR-98)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-90 | The system shall expose the subscription state machine — trialling, active, past due, suspended, cancelled, lapsed — to the Organization Administrator together with the plan version in force, entitlements granted, billing cycle, renewal or expiry date and next amount due. | MVP | UC-65, UC-106 | [Part 6](functional_requirements/06-commercial.md#fr-90--the-subscription-state-machine-shown-plainly) |
| FR-91 | The system shall present published plans side by side with entitlements, quotas and price per cycle, and shall show which limits the organization's actual consumption would exceed on each. | MVP | UC-96 | [Part 6](functional_requirements/06-commercial.md#fr-91--compare-plans-against-the-organizations-actual-consumption) |
| FR-92 | The system shall start a paid subscription through an order, changing entitlements only on confirmed payment or, for approved bank transfer terms, on invoice issuance, and never on order creation. | MVP | UC-97 | [Part 6](functional_requirements/06-commercial.md#fr-92--a-paid-subscription-starts-through-an-order) |
| FR-93 | The system shall activate a trial where the plan version offers one, for an organization on Free that has never started a trial, granting full paid entitlements with a known expiry and notifying the Administrator before it ends. | MVP | UC-98 | [Part 6](functional_requirements/06-commercial.md#fr-93--start-a-free-trial) |
| FR-94 | The system shall apply an upgrade immediately with the unused remainder of the current period credited on a prorated basis, and a downgrade at the end of the paid period with advance disclosure of exactly which entities, seats and features will become read-only. | MVP | UC-100, UC-101 | [Part 6](functional_requirements/06-commercial.md#fr-94--upgrade-immediately-downgrade-at-period-end) |
| FR-95 | The system shall allow the billing cycle to be changed effective at the next renewal, re-evaluating payment rail availability against the new total. | MVP | UC-99 | [Part 6](functional_requirements/06-commercial.md#fr-95--change-the-billing-cycle-at-the-next-renewal) |
| FR-96 | The system shall allow billable units to be added or removed mid-cycle, prorating additions to the period end and applying removals to the following period rather than as a mid-cycle refund. | MVP | UC-102 | [Part 6](functional_requirements/06-commercial.md#fr-96--add-or-remove-billable-units-mid-cycle) |
| FR-97 | The system shall allow auto-renewal to be controlled, cancellation to take effect at the close of the paid period rather than immediately, and a cancelled, lapsed or suspended subscription to be reactivated, with read-only entities and reports returning to editable on restoration of entitlement. | MVP | UC-103, UC-104, UC-105 | [Part 6](functional_requirements/06-commercial.md#fr-97--auto-renewal-cancellation-and-reactivation) |
| FR-98 | The system shall maintain a subscription change history covering every state-changing transition of a subscription, and at least every upgrade, downgrade, cycle change, plan version migration, cancellation and reactivation, with date, acting user and resulting entitlements. | MVP | UC-107 | [Part 6](functional_requirements/06-commercial.md#fr-98--the-subscription-change-history) |

### 3.19 Entitlement and metering (FR-99 … FR-105)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-99 | The system shall answer every gated action through a central entitlement service returning allow, deny or allow-with-warning. | MVP | UC-148 | [Part 6](functional_requirements/06-commercial.md#fr-99--one-central-entitlement-service) |
| FR-100 | The system shall hold gating logic outside the gated capability, so that a new plan or a changed quota never requires a change to the feature being gated. | MVP | UC-148 | [Part 6](functional_requirements/06-commercial.md#fr-100--gating-logic-lives-outside-the-gated-capability) |
| FR-101 | The system shall notify the Organization Administrator as consumption approaches an entitlement ceiling, before the limit is reached. | MVP | UC-149 | [Part 6](functional_requirements/06-commercial.md#fr-101--warn-before-a-limit-is-reached) |
| FR-102 | On a quota-exceeded action the system shall block it, state which limit was reached and what the current plan allows, offer the upgrade path, and shall never discard reporting work in progress or prevent a started report from being finished and exported. **For the interim seat ceiling the upgrade-path clause is deferred, not met:** no plan exists to upgrade to until tasks 53 and 63, so the block names a way out the reader can take instead (withdraw an invitation, or remove someone's access). | MVP | UC-150 | [Part 6](functional_requirements/06-commercial.md#fr-102--a-quota-block-informs-offers-a-way-out-and-never-loses-work) |
| FR-103 | The system shall select which entities and reports fall outside a reduced entitlement by a deterministic, published rule — most recently active retained — and shall show the outcome to the customer before the change takes effect. | MVP | UC-151 | [Part 6](functional_requirements/06-commercial.md#fr-103--which-content-falls-outside-a-reduced-entitlement) |
| FR-104 | The system shall delete no disclosure content on lapse, downgrade, suspension or entitlement reversal, moving out-of-entitlement content to read-only and leaving previously generated documents downloadable throughout. | MVP | UC-142, UC-151 | [Part 6](functional_requirements/06-commercial.md#fr-104--entitlement-reduction-never-deletes) |
| FR-105 | The system shall emit an append-only metering event carrying organization, action type, quantity and timestamp for every billable-shaped action, including actions not currently billed, and shall serve organization usage counters, quota evaluation and adoption metrics from that single stream, presenting consumption against the entitlement limit rather than as a bare number. | MVP | UC-66, UC-152 | [Part 6](functional_requirements/06-commercial.md#fr-105--the-metering-stream) |

### 3.20 Billing account (FR-106 … FR-107)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-106 | The system shall maintain billing account data distinct from the organization profile: registered legal name, IDNO, VAT registration code where registered, legal address and billing contact. | MVP | UC-108 | [Part 6](functional_requirements/06-commercial.md#fr-106--the-billing-account-distinct-from-the-organization-profile) |
| FR-107 | The system shall validate the format of supplied fiscal identifiers and, where a lookup is available, verify existence and VAT status. | MVP | UC-109 | [Part 6](functional_requirements/06-commercial.md#fr-107--validate-fiscal-identifiers) |

### 3.21 Order and checkout (FR-108 … FR-113)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-108 | The system shall model the order as an entity with its own lifecycle — draft, awaiting payment, paid, provisioned, expired, cancelled, failed — separate from both the subscription and the invoice, so that an unpaid attempt leaves no orphaned subscription and no issued fiscal document. | MVP | UC-110 | [Part 6](functional_requirements/06-commercial.md#fr-108--the-order-with-its-own-lifecycle) |
| FR-109 | The system shall validate a discount code at entry against plan eligibility, validity window and remaining redemptions, recalculating the order total or rejecting the code with its reason stated. | MVP | UC-111 | [Part 6](functional_requirements/06-commercial.md#fr-109--apply-a-discount-code-at-entry) |
| FR-110 | The system shall present an order summary showing net amount, VAT rate and basis, gross total in the order currency, and the payment rails available for that total, stating the reason where a rail is excluded rather than omitting the option. | MVP | UC-112 | [Part 6](functional_requirements/06-commercial.md#fr-110--the-order-summary-and-the-rails-available-for-it) |
| FR-111 | The system shall record the accepted terms version, timestamp and acting user against the order on confirmation. | MVP | UC-113 | [Part 6](functional_requirements/06-commercial.md#fr-111--evidence-of-what-was-agreed) |
| FR-112 | The system shall track order status through its lifecycle, showing what is outstanding, the reference the payer must quote, and the consequence if payment does not arrive. | MVP | UC-114 | [Part 6](functional_requirements/06-commercial.md#fr-112--track-an-order-through-settlement) |
| FR-113 | The system shall allow an unpaid order to be cancelled and shall void any associated proforma invoice. | MVP | UC-115 | [Part 6](functional_requirements/06-commercial.md#fr-113--cancel-an-unpaid-order) |

### 3.22 Payment (FR-114 … FR-120)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-114 | The system shall perform all money movement through licensed third parties reached behind a single provider adapter interface, with rail-agnostic order routing and the customer choosing at checkout, and shall register the merchant-of-record adapter inactive at MVP so that activation is configuration. | MVP | UC-116, UC-120, UC-121, UC-122 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-114--money-moves-through-licensed-third-parties-behind-one-adapter) |
| FR-115 | The system shall receive, store and transmit no card data at any point, retaining only the acquirer's transaction reference and a masked descriptor. | MVP | UC-116 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-115--no-card-data-reaches-the-platform) |
| FR-116 | The system shall accept domestic card payment through the acquirer's hosted page or SDK including the 3-D Secure challenge, with the order surviving the round trip and possible mid-challenge abandonment without duplicating the charge or the order. | MVP | UC-116, UC-117 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-116--pay-by-domestic-card-3-d-secure-included) |
| FR-117 | The system shall store a card token for recurring billing under a consent recorded separately from the payment itself, and shall allow stored instruments to be viewed, replaced, removed and defaulted, warning that renewal will fail when the last instrument on an auto-renewing subscription is removed. | MVP | UC-118, UC-119 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-117--stored-cards-for-recurring-billing-under-separate-consent) |
| FR-118 | The system shall offer MIA instant payment by QR, payment link or request-to-pay only where the order total is within the per-transaction ceiling, reading the applicable limit from configuration rather than code. | MVP | UC-120 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-118--mia-instant-payment-within-the-ceiling) |
| FR-119 | The system shall offer bank transfer against a proforma invoice carrying a unique payment reference, deferring provisioning until the payment is reconciled. | MVP | UC-121 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-119--bank-transfer-against-a-proforma) |
| FR-120 | The system shall execute scheduled recurring charges idempotently against the renewal period, retrying soft declines on a defined schedule, never retrying hard declines, and notifying the Administrator of a failure with what failed, the consequence, the deadline and the action that fixes it. | MVP | UC-123, UC-124, UC-125 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-120--recurring-charges-once-per-period-retried-by-class-failure-told) |

### 3.23 Invoicing (FR-121 … FR-130)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-121 | The system shall issue a proforma invoice on election of bank transfer, carrying payment reference, bank details, amount and validity date, creating no VAT liability and consuming no invoice number. | MVP | UC-126 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-121--the-proforma-invoice) |
| FR-122 | The system shall generate the fiscal invoice from the order on confirmed payment rather than by manual entry, recording supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, and total. | MVP | UC-127 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-122--the-fiscal-invoice-is-generated-from-the-order) |
| FR-123 | The system shall allocate invoice numbers from a gapless, monotonic series per document type per fiscal year, under a lock at issuance and never reserved optimistically at order creation. | MVP | UC-134 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-123--gapless-numbering-per-series-per-fiscal-year) |
| FR-124 | The system shall derive VAT treatment from the customer's residency and VAT status — standard-rate domestic supply, or the applicable export or reverse-charge treatment — stating the basis on the document and drawing rates and rules from maintained data. | MVP | UC-128 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-124--vat-treatment-from-residency-and-vat-status) |
| FR-125 | The system shall treat an issued invoice as immutable, changing its effect only through a credit note or corrective invoice referencing the original, itself transmitted to e-Factura. | MVP | UC-133 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-125--an-issued-invoice-is-immutable) |
| FR-126 | The system shall render the invoice into the required national e-Factura XML format and transmit it, storing the platform's acknowledgement and identifier against the invoice record. | MVP | UC-129 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-126--render-to-national-xml-and-transmit-to-e-factura) |
| FR-127 | The system shall surface a transmission rejection with its reason and support reissue after the underlying data is corrected, and shall never mark an untransmitted invoice as delivered. | MVP | UC-130 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-127--a-rejection-is-surfaced-and-reissued-never-marked-delivered) |
| FR-128 | The system shall deliver the invoice to the billing contact and make it available in the billing area, recording delivery timestamp and channel, and shall keep invoice history and document download available after downgrade, cancellation and lapse. | MVP | UC-131, UC-132 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-128--deliver-the-invoice-and-keep-it-available) |
| FR-129 | The system shall store the National Bank of Moldova official rate for the invoice date on any foreign-currency invoice and reproduce it on the document. | MVP | UC-136 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-129--the-bnm-rate-on-a-foreign-currency-invoice) |
| FR-130 | The system shall archive issued fiscal documents and their transmission receipts in immutable storage for the statutory retention period, taking precedence over a customer erasure request. | MVP | UC-135 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-130--archive-fiscal-documents-for-the-statutory-period) |

### 3.24 Reconciliation (FR-131 … FR-134)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-131 | The system shall import bank account statements by file, and by bank API once that is added (182/100), into a reconciliation workspace. | MVP | UC-137 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-131--import-a-bank-statement) |
| FR-132 | The system shall match statement lines to open orders and invoices automatically on payment reference, amount and payer fiscal code, marking the invoice paid and provisioning the subscription on a confident match. | MVP | UC-138 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-132--match-payments-automatically) |
| FR-133 | The system shall provide an exception workspace for missing or mistyped references, partial payments, overpayments, third-party payments and duplicates, recording every resolution with its rationale. | MVP | UC-139 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-133--the-exception-workspace) |
| FR-134 | The system shall permit manual settlement of an invoice only with a stated reason, written to the immutable billing audit ledger. | MVP | UC-140 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-134--manual-settlement-with-a-reason-on-the-ledger) |

### 3.25 Collections (FR-135 … FR-138)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-135 | The system shall escalate an unpaid amount (an overdue renewal order, or a fiscal invoice issued before payment) through a configurable dunning sequence at defined intervals, each notice stating the amount, the due date passed and the date service will be restricted, stopping immediately on payment. | MVP | UC-141 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-135--dunning-from-a-configured-sequence) |
| FR-136 | The system shall move the subscription to suspended when dunning is exhausted, making out-of-entitlement reports and entities read-only and blocking new exports, and shall tell the Administrator exactly what changed and how to restore it. | MVP | UC-142 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-136--restrict-service-without-deleting-anything) |
| FR-137 | The system shall restore full entitlements automatically on settlement of the overdue amount, without requiring the customer to contact support. | MVP | UC-143 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-137--restore-on-settlement-with-no-call-to-support) |
| FR-138 | The system shall record a write-off against the invoice with reason and accounting treatment, leaving the fiscal document in the ledger rather than deleting it. | MVP | UC-144 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-138--write-off-a-debt-never-the-document) |

### 3.26 Refunds and disputes (FR-139 … FR-141)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-139 | The system shall issue full or partial refunds through the original rail where possible and by transfer where not, generating the corresponding credit note, with refund authority separated from invoice issuance authority. | MVP | UC-145 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-139--refund-through-the-original-rail-with-a-credit-note) |
| FR-140 | The system shall handle a card chargeback by recording the case, assembling an evidence pack from the order, the recorded terms acceptance and usage records, and recording the outcome. | MVP | UC-146 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-140--card-chargebacks-and-the-evidence-pack) |
| FR-141 | The system shall reverse entitlements following a refund or chargeback as a step distinct from the financial reversal, applying read-only treatment rather than deletion and accommodating partial, goodwill and already-consumed cases. | MVP | UC-147 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-141--reverse-entitlements-as-a-step-of-their-own) |

### 3.27 Enterprise (FR-142 … FR-147)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-142 | The system shall exclude Enterprise from self-serve checkout, with a quote request creating a tracked opportunity as the entry point to the contract path. | MVP | UC-153 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-142--enterprise-starts-as-a-request-not-a-checkout) |
| FR-143 | The system shall hold a quote as structured data — negotiated entitlement set, price, currency, billing schedule, validity date — provisioning directly on acceptance so that sold terms and configured terms cannot drift apart. | MVP | UC-154 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-143--a-quote-is-structured-data) |
| FR-144 | The system shall record the executed contract: term length, notice period, negotiated entitlements, SLA, price protection and any non-standard clause with billing consequences. | MVP | UC-155 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-144--the-executed-contract-is-the-record) |
| FR-145 | The system shall provision an Enterprise subscription by additive per-subscription entitlement overrides rather than a bespoke plan per customer. | MVP | UC-156 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-145--overrides-on-the-subscription-never-a-plan-per-customer) |
| FR-146 | The system shall record the customer's own purchase-order or contract reference against the subscription and reproduce it on every invoice issued under it. | MVP | UC-157 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-146--the-customers-purchase-order-reference-on-every-invoice) |
| FR-147 | The system shall drive custom billing schedules from data — annual in advance, semi-annual, milestone-based, multi-year instalment — and shall track approaching expiry, renewal and renegotiation, with an unrenewed contract following the standard lapse path rather than abrupt termination. | MVP | UC-158, UC-159 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-147--custom-billing-schedules-and-the-contracts-end) |

### 3.28 Financial reporting (FR-148 … FR-152)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-148 | The system shall maintain VAT rates and the rules selecting treatment by customer residency and VAT status, each with an effective date, requiring no deployment for a rate change. | MVP | UC-160 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-148--vat-rates-and-rules-as-effective-dated-data) |
| FR-149 | The system shall provide a billing revenue dashboard covering recognised and deferred revenue, active subscriptions by plan, monthly recurring revenue, churn, collection rate and days sales outstanding. | MVP | UC-161 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-149--the-billing-revenue-dashboard) |
| FR-150 | The system shall export the period's invoices, credit notes, payments and VAT summary in the form the fiscal return and the company's accountant require, including MDL equivalents of foreign-currency documents. | MVP | UC-162 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-150--the-revenue-and-vat-export) |
| FR-151 | The system shall maintain an append-only billing audit ledger of every financial event — order, invoice, payment, credit note, refund, manual match, write-off, entitlement override, price change — attributed and timestamped, with entries superseded rather than edited or deleted. | MVP | UC-163 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-151--the-append-only-billing-audit-ledger) |
| FR-152 | The system shall reconcile acquirer and instant-rail settlement reports against payments recorded in the platform, identifying missing settlements, fee discrepancies and timing differences. | MVP | UC-164 | [Part 7](functional_requirements/07-payments-fiscal.md#fr-152--reconcile-provider-settlement-against-recorded-payments) |

### 3.29 Cross-cutting (FR-153 … FR-159)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-153 | The system shall expose report CRUD, validation and export operations through a documented, authenticated API and not only through the interface. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-153--report-operations-are-reachable-through-the-documented-api) |
| FR-154 | The system shall keep the compliance core free of any dependency on plan, price or tenant type, such that disabling billing entirely leaves every reporting use case UC-17 … UC-48 functioning. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-154--the-compliance-core-does-not-depend-on-plan-price-or-tenant-type) |
| FR-155 | The system shall mirror VSME taxonomy element names and structure in the internal schema rather than adopting a custom schema. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-155--internal-names-and-structure-mirror-the-vsme-taxonomy) |
| FR-156 | The system shall place third-party components — EFRAG converter, payment providers, e-Factura, identity providers — behind internal interfaces, with no hard dependency on a single vendor. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-156--third-parties-sit-behind-internal-interfaces) |
| FR-157 | The system shall deliver every system-initiated notification — payment failure, quota approach, trial expiry, dunning, taxonomy version change, invitation, outstanding-report notice — through one channel-agnostic mechanism recording delivery timestamp and channel. FR-160 … FR-173 specify that mechanism rather than adding a second one. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-157--one-mechanism-delivers-every-system-notification) |
| FR-158 | The system shall enforce role-based access control server-side on every request, scoped per organization and per report, rather than in the interface layer. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-158--authorization-is-enforced-server-side-on-every-request) |
| FR-159 | The system shall attribute every state-changing action to an acting actor with a timestamp, across reporting, administration and billing alike. | MVP (architectural) | *(architectural)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-159--every-state-changing-action-names-its-actor-and-time) |

### 3.30 Notifications (FR-160 … FR-167, FR-173)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-160 | The system shall model a notification as a first-class record carrying category, subject reference, recipients and state — raised, delivered or cancelled, with *read* held on each recipient's in-app delivery record and not on the notification — held separately from the channel or channels it is delivered on, so that one notice to two people on two channels remains one notification. | MVP | UC-165, UC-172, UC-174 | [Part 9](functional_requirements/09-notifications.md#fr-160--a-notification-is-one-record-held-apart-from-its-deliveries) |
| FR-161 | The system shall provide an in-app notification centre listing the user's notifications for the active organization with an unread count available from any screen, persisting each item until read or dismissed rather than only while the user is present, and holding read state per user. | MVP | UC-165, UC-167 | [Part 9](functional_requirements/09-notifications.md#fr-161--the-in-app-notification-centre) |
| FR-162 | The system shall carry on every notification a deep link to the object that raised it — module, field, reporting period, invoice — so that acting on it requires no navigation. | MVP | UC-166 | [Part 9](functional_requirements/09-notifications.md#fr-162--every-notice-carries-a-deep-link-to-its-subject) |
| FR-163 | The system shall maintain per-user notification preferences by category and channel, stored on the user profile so that they follow the user across organizations, permitting suppression only for categories classified optional; security, account, invoice-delivery, payment-failure and service-restriction notices, and the advisor access notices (FR-203), are non-suppressible and presented as such. Extends FR-9. | MVP | UC-168 | [Part 9](functional_requirements/09-notifications.md#fr-163--preferences-by-category-and-channel-with-mandatory-kinds-locked) |
| FR-164 | The system shall raise a notice, at a configured repeat interval while a reporting period is open, where mandatory disclosures remain unanswered or validation findings unresolved, naming the specific modules and fields outstanding rather than reporting only that the report is incomplete. | MVP | UC-169 | [Part 9](functional_requirements/09-notifications.md#fr-164--the-outstanding-report-notice) |
| FR-165 | The system shall raise a deadline notice at each configured lead time before a period's due date stating the date, days remaining and current completion state, and shall raise none where the report is already complete and validated. | MVP | UC-170 | [Part 9](functional_requirements/09-notifications.md#fr-165--the-deadline-notice) |
| FR-166 | The system shall raise a report-update notice to affected organizations wherever a taxonomy or template version change, an applicability threshold change or an emission factor update means an existing report must be reviewed or re-exported, naming the change and what it obliges. | MVP | UC-171 | [Part 9](functional_requirements/09-notifications.md#fr-166--the-report-update-notice) |
| FR-167 | The system shall cancel an outstanding notice and stop its repetition as soon as its condition clears — the disclosure supplied, the section declared omitted as classified or sensitive, the period locked — and shall deduplicate on category and subject so that a repeatedly evaluated condition produces one notice rather than one per evaluation. | MVP | UC-169, UC-170 | [Part 9](functional_requirements/09-notifications.md#fr-167--cancel-when-the-condition-clears-deduplicate-on-category-and-subject) |
| FR-173 | The system shall hold the notification category catalogue's behaviour — default channels, transactional-or-optional classification, deadline lead times, repeat interval — as publishable configuration, so that tuning a notice needs no release, with its per-locale subject and body wording shipped in the release that raises it. The classification of a **mandatory system category** — security, account, invoice delivery, payment failure, service restriction, the advisor access notices (FR-203), and the identity notices registered under them — is declared in code, so no artefact can make one optional and an unreadable one still sends by email. An optional category's classification stays configuration. | MVP | UC-175, UC-176 | [Part 9](functional_requirements/09-notifications.md#fr-173--category-behaviour-as-configuration-the-manual-reminder) |

### 3.31 Notification delivery (FR-168 … FR-172)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-168 | The system shall deliver in-app by writing to each recipient's notification centre, with no dependency on any external provider, so that the channel continues to function during an email provider outage. | MVP | UC-172 | [Part 9](functional_requirements/09-notifications.md#fr-168--in-app-delivery-with-no-external-dependency) |
| FR-169 | The system shall deliver by email through a provider reached behind the standard provider adapter, resolving language per recipient rather than per notification — the recipient's **email language**, a setting of its own chosen on S-27 apart from the interface language and starting as it — and including a working one-click unsubscribe in every optional-category message. | MVP | UC-173 | [Part 9](functional_requirements/09-notifications.md#fr-169--email-through-the-provider-adapter-in-the-recipients-language-with-a-one-click-unsubscribe) |
| FR-170 | The system shall record per notification and recipient the channel used, dispatch timestamp and outcome, and read state for in-app, as the evidence that a required update was actually requested. | MVP | UC-174 | [Part 9](functional_requirements/09-notifications.md#fr-170--a-delivery-record-per-notification-recipient-and-channel) |
| FR-171 | The system shall retry a transient send failure on a bounded schedule, suppress an address that hard-bounces, and surface a suppressed recipient to the Organization Administrator. | MVP | UC-174 | [Part 9](functional_requirements/09-notifications.md#fr-171--retry-transient-failures-suppress-a-hard-bounce-surface-it) |
| FR-172 | The system shall dispatch notifications asynchronously, so that no user-facing action blocks on delivery and a provider outage degrades delivery without degrading the application. | MVP (architectural) | *(architectural)* | [Part 9](functional_requirements/09-notifications.md#fr-172--dispatch-is-asynchronous) |

### 3.32 Advisor domain (FR-190 … FR-203)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-190 | The system shall allow an organization of the advisor type to be created from a verified account, shall automatically grant the creating user the Advisor Administrator role over it, and shall hold no reporting entities or reporting periods against it. | MVP | UC-196 | [Part 10](functional_requirements/10-advisor.md#fr-190--the-advisor-organization) |
| FR-191 | The system shall allow an Advisor Administrator to invite staff into the advisor organization and to set, per staff member, which clients on the roster that staff member may enter, enforcing the restriction at the point of entry rather than by omission from the interface. | MVP | UC-197 | [Part 10](functional_requirements/10-advisor.md#fr-191--advisor-staff-and-their-client-scope) |
| FR-192 | The system shall allow an advisor organization to request access to a client organization, creating a relationship in a pending state that confers no access to any of the client's data. | MVP | UC-198 | [Part 10](functional_requirements/10-advisor.md#fr-192--request-access-to-a-client-organization) |
| FR-193 | The system shall present to the Advisor Administrator a roster of every client organization the firm has requested or been granted access to, with relationship state, granted entity scope, expiry date where set, and the client's plan. | MVP | UC-199 | [Part 10](functional_requirements/10-advisor.md#fr-193--the-client-roster) |
| FR-194 | The system shall allow an Advisor Administrator to end a client relationship from the advisor side without requiring an action by the client, retaining the attribution of that firm's historical contributions in the client's change history. | MVP | UC-200 | [Part 10](functional_requirements/10-advisor.md#fr-194--end-an-engagement-from-the-advisor-side) |
| FR-195 | The system shall allow an Organization Administrator to grant a pending advisor request over a selected set of reporting entities and an optional expiry date, defaulting the entity scope to none. | MVP | UC-201 | [Part 10](functional_requirements/10-advisor.md#fr-195--grant-an-advisor-request-over-a-chosen-scope) |
| FR-196 | The system shall allow an Organization Administrator to decline a pending advisor request with an optional reason, recording the declined request rather than deleting it. | MVP | UC-202 | [Part 10](functional_requirements/10-advisor.md#fr-196--decline-an-advisor-request) |
| FR-197 | The system shall allow an Organization Administrator to revoke an active advisor relationship, withdrawing access at the advisor's next request and terminating any advisor session then inside the organization at its next action. | MVP | UC-203 | [Part 10](functional_requirements/10-advisor.md#fr-197--revoke-advisor-access) |
| FR-198 | The system shall present to the Organization Administrator, in one place, both direct members and any advisor organizations holding access, with each advisor's granted scope, expiry and the individual advisor users able to enter. | MVP | UC-204 | [Part 10](functional_requirements/10-advisor.md#fr-198--advisor-access-alongside-direct-members) |
| FR-199 | The system shall, when an advisor user enters a client organization, verify that the relationship is active, unexpired and within that staff member's scope, and shall set the tenant context to exactly one client organization for the resulting session. | MVP | UC-205 | [Part 10](functional_requirements/10-advisor.md#fr-199--entering-a-client-resolves-to-exactly-one-tenant) |
| FR-200 | The system shall present to the Advisor Administrator a consolidated board showing, for every active client, each reporting entity and open period with due date, days remaining, completion percentage and validation state, assembled by a scoped query per client rather than by a query spanning organizations. | MVP | UC-206 | [Part 10](functional_requirements/10-advisor.md#fr-200--the-consolidated-client-status-board) |
| FR-201 | The system shall restrict the export of the consolidated board to status and deadline metadata, excluding disclosure content. | MVP | UC-207 | [Part 10](functional_requirements/10-advisor.md#fr-201--export-the-board-as-status-and-deadlines-only) |
| FR-202 | The system shall support an Advisor plan whose entitlement keys — roster size, advisor staff seats, board access and board export — are evaluated against the advisor organization, and shall not permit any key of that plan to raise the entitlements of a client organization. | MVP | UC-208, UC-209 | [Part 10](functional_requirements/10-advisor.md#fr-202--the-advisor-plan-evaluated-on-the-advisor-organization) |
| FR-203 | The system shall end an advisor relationship automatically on its expiry date and shall notify the client's Organization Administrator and the advisor firm of a request and of each subsequent grant, change, decline, revocation, ending or expiry, as a transactional notification category. | MVP | UC-210, UC-211 | [Part 10](functional_requirements/10-advisor.md#fr-203--expiry-and-notice-of-every-change-of-access) |

### 3.33 Public tier (FR-204 … FR-206)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-204 | The system shall let a visitor with no account and no session read, in the language they choose, what the platform produces and for whom, what it costs and what is asked of them before they sign up, and then proceed to registration or sign-in, while storing nothing against the visitor. | MVP | UC-177 | [Part 8](functional_requirements/08-cross-cutting.md#fr-204--the-marketing-home) |
| FR-205 | The system shall publish the terms of service, the privacy notice and the cookie policy as one set, readable without signing in and from the footer of every screen, each with a plain-language summary above its formal text, a version and an effective date, in each of the three locales, so that a person is told what is agreed to and how personal data is handled before any is collected. | MVP | UC-178 | [Part 8](functional_requirements/08-cross-cutting.md#fr-205--the-legal-documents) |
| FR-206 | The system shall tell a visitor, before anything is set, every cookie the site sets by purpose, what it does not set, and any browser storage that is not a cookie, while setting no non-essential storage; it shall therefore record no consent and offer no accept or decline. Adding any non-essential storage re-opens this requirement, and the consent mechanism ships in the same change. | MVP | UC-179 | [Part 8](functional_requirements/08-cross-cutting.md#fr-206--the-cookie-choice) |

### 3.34 Data-subject requests (FR-207)

| FR ID | Obligation | Pri | Source UC | Detail |
|---|---|---|---|---|
| FR-207 | The system shall permit a data subject's request for access, rectification, erasure or portability of their personal data to be fulfilled within 30 calendar days, retaining a record of what was disclosed. On an erasure request it shall retain what statute requires (issued fiscal documents and their transmission receipts for six years, and the disclosure audit trail for the life of the report) and report the retained categories to the requester. | MVP | *(NFR-5, NFR-28, NFR-29)* | [Part 8](functional_requirements/08-cross-cutting.md#fr-207--data-subject-requests-access-rectification-erasure-and-portability) |

---

## 4. Business rules and validation rules

**Moved into the parts on 5 Oct 2026 (task 182).** Each rule now sits beside the requirements that hold it, in that part's §4, with its identifier and statement unchanged unless a later decision amended it, in which case the statement says so. This section keeps its number so that a citation of `functional_requirements.md` §4 still resolves, and maps every rule to its part. A rule is not an additional requirement: the requirement it is held in is the authority.

| Rule | Held in |
|---|---|
| BR-VAL-1 | [Part 4](functional_requirements/04-validation-export.md#5-business-rules-held-in-this-part) |
| BR-VAL-2 | [Part 4](functional_requirements/04-validation-export.md#5-business-rules-held-in-this-part) |
| BR-VAL-3 | [Part 4](functional_requirements/04-validation-export.md#5-business-rules-held-in-this-part) |
| BR-VAL-4 | [Part 4](functional_requirements/04-validation-export.md#5-business-rules-held-in-this-part) |
| BR-APP-1 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-APP-2 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-APP-3 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-APP-4 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-APP-5 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-DIS-1 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-DIS-2 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-DIS-3 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-DIS-4 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-CALC-1 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-CALC-2 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-CALC-3 | [Part 3](functional_requirements/03-authoring-calculator.md#4-business-rules-held-in-this-part) |
| BR-PER-1 | [Part 2](functional_requirements/02-organization-periods.md#3-business-rules-held-in-this-part) |
| BR-PER-2 | [Part 2](functional_requirements/02-organization-periods.md#3-business-rules-held-in-this-part) |
| BR-PER-3 | [Part 2](functional_requirements/02-organization-periods.md#3-business-rules-held-in-this-part) |
| BR-VER-1 | [Part 5](functional_requirements/05-platform-content.md#5-business-rules-held-in-this-part) |
| BR-VER-2 | [Part 4](functional_requirements/04-validation-export.md#5-business-rules-held-in-this-part) |
| BR-VER-3 | [Part 5](functional_requirements/05-platform-content.md#5-business-rules-held-in-this-part) |
| BR-ID-1 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ID-2 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ID-3 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ID-4 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ID-5 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ID-6 | [Part 5](functional_requirements/05-platform-content.md#5-business-rules-held-in-this-part) |
| BR-ACC-1 | [Part 2](functional_requirements/02-organization-periods.md#3-business-rules-held-in-this-part) |
| BR-ACC-2 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ACC-3 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ACC-4 | [Part 1](functional_requirements/01-identity-membership.md#4-business-rules-held-in-this-part) |
| BR-ACC-5 | [Part 8](functional_requirements/08-cross-cutting.md#4-business-rules-held-in-this-part) |
| BR-ACC-6 | [Part 5](functional_requirements/05-platform-content.md#5-business-rules-held-in-this-part) |
| BR-ENT-1 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-ENT-2 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-ENT-3 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-ENT-4 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-ENT-5 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-1 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-2 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-3 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-4 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-5 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-6 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-SUB-7 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-PAY-1 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-2 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-3 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-4 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-5 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-6 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-PAY-7 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-1 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-2 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-3 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-4 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-5 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-6 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-7 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-INV-8 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-1 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-2 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-3 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-4 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-5 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-COL-6 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-LED-1 | [Part 7](functional_requirements/07-payments-fiscal.md#8-business-rules-held-in-this-part) |
| BR-FIS-1 | [Part 6](functional_requirements/06-commercial.md#6-business-rules-held-in-this-part) |
| BR-NOT-1 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-2 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-3 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-4 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-5 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-6 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-7 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |
| BR-NOT-8 | [Part 9](functional_requirements/09-notifications.md#3-business-rules-held-in-this-part) |

---

## 5. Data requirements and key entities

**Moved into the parts on 5 Oct 2026 (task 182).** Each entity row now sits in the §5 of the part holding the requirements that name it. Two schema-level obligations still bound every one of them: FR-155 requires that internal field names and structure mirror VSME taxonomy elements rather than a custom schema (NFR-2), and FR-154 requires that no compliance-core entity depend on plan, price or tenant type (D-11, NFR-1). The rows list attributes the requirements name; they are not a data model.

| Entity | Held in |
|---|---|
| Account | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Provider identity | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Session | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Password reset token | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| User profile | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Membership | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Invitation | [Part 1](functional_requirements/01-identity-membership.md#5-entities-held-in-this-part) |
| Organization | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Organization relationship | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Entity identifier | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Reporting entity | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Consolidation scope | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Entity master data version | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Reporting period | [Part 2](functional_requirements/02-organization-periods.md#4-entities-held-in-this-part) |
| Report / disclosure field value | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Omitted-disclosure declaration | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Not-available declaration | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Field change record | [Part 4](functional_requirements/04-validation-export.md#6-entities-held-in-this-part) |
| Validation finding | [Part 4](functional_requirements/04-validation-export.md#6-entities-held-in-this-part) |
| Energy / fuel consumption input | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Emission factor set | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Computed emission result | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Override record | [Part 3](functional_requirements/03-authoring-calculator.md#5-entities-held-in-this-part) |
| Export record | [Part 4](functional_requirements/04-validation-export.md#6-entities-held-in-this-part) |
| Content string | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Translation set publication | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Locale registration | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Fallback log entry | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Template / taxonomy version | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Field mapping | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Migration run | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Applicability threshold | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Validation rule definition | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Support-access grant | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Platform administrator account | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| System audit log entry | [Part 5](functional_requirements/05-platform-content.md#6-entities-held-in-this-part) |
| Plan / plan version | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Entitlement / quota | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Price | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Discount code | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Trial terms | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Subscription | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Entitlement override | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Subscription change record | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Metering event | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Billing account | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Order | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Terms acceptance | [Part 6](functional_requirements/06-commercial.md#7-entities-held-in-this-part) |
| Payment | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Stored payment instrument | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Proforma invoice | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Fiscal invoice | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Credit note / corrective invoice | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Numbering series | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| e-Factura transmission record | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Exchange rate record | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Fiscal document archive | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Bank statement import | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Reconciliation match / exception | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Dunning state | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Write-off | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Refund | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Chargeback case | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Quote | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Contract | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Purchase-order reference | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Billing schedule | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| VAT rate and rule | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Billing audit ledger entry | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Settlement report reconciliation | [Part 7](functional_requirements/07-payments-fiscal.md#9-entities-held-in-this-part) |
| Notification | [Part 9](functional_requirements/09-notifications.md#4-entities-held-in-this-part) |
| Delivery record | [Part 9](functional_requirements/09-notifications.md#4-entities-held-in-this-part) |
| Notification preference | [Part 9](functional_requirements/09-notifications.md#4-entities-held-in-this-part) |
| Notification category catalogue | [Part 9](functional_requirements/09-notifications.md#4-entities-held-in-this-part) |
| Suppression record | [Part 9](functional_requirements/09-notifications.md#4-entities-held-in-this-part) |

---

## 6. Integration and interface requirements

### 6.1 Governing obligations

| FR | Obligation |
|---|---|
| FR-156 | Third-party components — EFRAG converter, payment providers, e-Factura, identity providers — sit behind internal interfaces, with no hard dependency on a single vendor (NFR-11). |
| FR-153 | Report CRUD, validation and export are exposed through a documented, authenticated API, not only through the interface. |
| FR-114 | All money movement runs through licensed third parties behind a single provider adapter interface, with rail-agnostic order routing. |
| FR-158 | Access control is enforced server-side on every request, per organization and per report, including on the API surface. |
| FR-172 | Notification dispatch is asynchronous, so a provider outage degrades delivery without degrading the application. |

### 6.2 External systems and their MVP status

| External system | Interface obligation | Requirements | Status |
|---|---|---|---|
| EFRAG VSME Excel Digital Template | Write stored values into the template's named ranges at the version pinned to the report, preserving its dropdowns and consistency-check formulas | FR-50, FR-51, FR-65 | MVP |
| National e-Factura platform | Render the invoice into the required national XML format, transmit it, store acknowledgement and identifier, surface rejections | FR-126, FR-127 | MVP (mandatory for B2B from 1 October 2026, D-9) |
| Domestic card acquirer (maib, Victoriabank, MICB) | Hosted page or SDK including 3-D Secure; tokenisation for recurring billing; no card data reaches the platform | FR-114, FR-115, FR-116, FR-117 | MVP |
| MIA instant payment rail (participating banks' APIs) | QR, payment link or request-to-pay; availability gated by a configuration-held per-transaction ceiling | FR-114, FR-118, FR-110 | MVP |
| Customer bank (transfer rail) | Proforma with unique payment reference; statement import by file or bank API; automatic matching | FR-119, FR-131, FR-132 | MVP |
| Merchant-of-record provider | Registered adapter, legal seller for non-resident customers | FR-114 | MVP as registered-but-inactive adapter; activation is configuration (D-8) |
| Acquirer and instant-rail settlement reporting | Reconcile settlement reports against recorded payments | FR-152 | MVP |
| Fiscal identifier lookup | Verify existence and VAT status where a lookup is available | FR-107 | MVP where available |
| Social identity providers (Google, Microsoft) | Minimum profile scopes; registration, enable, disable and credential rotation without redeploy | FR-2, FR-82 | MVP |
| Email provider | Reached behind the standard provider adapter; per-recipient language; one-click unsubscribe on optional categories | FR-169, FR-156 | MVP |
| Billing / metering provider | Receives the metering event stream; not billing anything through it at MVP | FR-105 | MVP event stream present; consuming provider active P2+ |
| EFRAG XBRL converter (MIT-licensed, self-hostable) | Convert stored data to Inline XBRL, XBRL-JSON, XBRL-CSV | FR-176 (deferred set; source ID FR-160) | P2 |
| Energy providers and accounting software | Pluggable ingestion connectors | FR-187 (deferred set; source ID FR-171) | P3 |
| External document-risk service (e.g. IFC MALENA) | Advisory-only consistency warnings on narrative disclosures | FR-189 (deferred set; source ID FR-173) | P3 |
| ESAP | Submission bridge | FR-175 (deferred set) | Roadmap, not committed |

### 6.3 Internal interface boundaries

| Boundary | Obligation | Requirements |
|---|---|---|
| Compliance core ↔ billing | Billing publishes only entitlement changes into the core, which reads them through the entitlement service. Disabling billing entirely leaves UC-17 … UC-48 functioning. | FR-154, FR-99, FR-100, D-11 |
| Gated capability ↔ entitlement service | Gating logic lives outside the gated capability; a new plan or changed quota changes no feature code. | FR-100, FR-85 |
| Producers ↔ notification mechanism | Every notification producer dispatches through the single channel-agnostic mechanism and holds no delivery path of its own. | FR-157, FR-160 … FR-172 |
| Content and rules ↔ runtime | Labels, help text, messages, applicability thresholds, validation rules, factor sets and notification templates are data published without redeploy. | FR-61, FR-62, FR-71, FR-72, FR-73, FR-74, FR-173, NFR-12 |

---

## 7. Reporting and output requirements

### 7.1 Report outputs to the customer

| Output | Requirement | Notes |
|---|---|---|
| On-screen assembled preview | FR-48 | Narrative, indicator tables and comparatives as they will appear on export; generates no file. |
| PDF export | FR-49 | Formatted, publication-ready, in the selected export language. |
| EFRAG Excel Digital Template export | FR-50, FR-51 | Written into named ranges at the pinned version; dropdowns and consistency-check formulas preserved; never exported silently against another version. |
| Export language selection | FR-52 | Independent of interface language. |
| Export with unresolved findings | FR-44 | Permitted after explicit warning; gaps marked visibly. |
| Declared exclusions in output | FR-31 | Sections declared omitted as classified or sensitive appear in both formats — natively in the Excel template, the element being one it already carries. |
| Export history and re-download | FR-53 | Immutable record of format, language, taxonomy version, timestamp and generating user; prior exports re-downloadable as distributed. |
| Version stamp on every report | FR-66 | Template and taxonomy version explicit per report. |

### 7.2 Status and oversight views

| Output | Requirement | Audience |
|---|---|---|
| Accessible entities and periods with completion and validation summary | FR-25 | RC |
| Field-, module- and report-level validation state | FR-40, FR-41 | RC |
| Per-field change history | FR-54, FR-55 | RC |
| Organization-wide report status overview across entities and periods | FR-23 | OA |
| Organization user and access list with role, status and last activity | FR-56 | OA |
| Plan, entitlement, cycle, renewal date and next amount due | FR-90 | OA |
| Usage counters presented against entitlement limits | FR-105 | OA |
| Plan comparison against actual consumption | FR-91 | OA |
| Subscription change history | FR-98 | OA |
| Invoice history and document download, surviving downgrade and lapse | FR-128 | OA |
| Order status with outstanding amount, reference to quote and consequence of non-payment | FR-112 | OA |

### 7.3 Platform and finance reporting

| Output | Requirement | Audience |
|---|---|---|
| Organization register with account-level metadata only, never report content | FR-76 | PA |
| Adoption and usage dashboard — SMEs completing a full report, exports by format, average completion time, export-usage rate — filterable by period and segment, low-volume figures marked low-confidence, exportable | FR-83 | PA |
| Reports still pinned to a superseded version, grouped by organization and version | FR-68 | PA |
| Untranslated content key queue | FR-64 | PA |
| Support-access audit log, reviewable and not editable in-console | FR-79 | PA |
| Platform-wide system audit log — version rollouts, content publications, migration runs, factor-set updates, administrator account changes | FR-81 | PA |
| Billing revenue dashboard — recognised and deferred revenue, active subscriptions by plan, MRR, churn, collection rate, DSO | FR-149 | BO |
| Revenue and VAT export for the fiscal return and the accountant, with MDL equivalents | FR-150 | BO |
| Append-only billing audit ledger | FR-151 | BO |
| Provider settlement reconciliation output | FR-152 | BO |
| Reconciliation exception workspace | FR-133 | BO |

### 7.4 Delivery evidence

| Output | Requirement |
|---|---|
| Per notification and recipient: channel, dispatch timestamp, outcome, and read state for in-app | FR-170 |
| Invoice delivery timestamp and channel | FR-128 |
| Suppressed recipient visibility to the Organization Administrator | FR-171 |

---

## 8. Deferred functional scope (post-MVP)

These are not MVP build items. They are recorded because the MVP architecture is required not to block them, and because several MVP requirements exist specifically to make them additive later — FR-105 emits metering events for pricing units that are not yet sold, FR-14 carries organization relationship types that are not yet used, and FR-63 registers locales beyond the two that are live.

**Identifiers reassigned 18 August 2026 (closes OQ-1).** These requirements were reproduced verbatim from "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)", where fourteen of them — FR-160 … FR-173 — collided with the MVP notification requirements that the current register assigns to the same identifiers. **The deferred set is renumbered to FR-176 … FR-189**, above FR-175, so FR-160 … FR-173 now mean the MVP notification requirements and nothing else. FR-174 and FR-175 never collided and are unchanged. The `Was (source)` column is the permanent mapping — a backlog item, test case or external document citing a source-numbered ID resolves through it, and no citation is lost. Reassignment direction: the deferred set moved because the MVP set is cited by 27 use cases and by shipping requirements, while the deferred set is cited only by nine deferred NFRs, all of which are updated in `non_functional_requirements.md` §6.2.

| FR ID | Was (source) | Domain | Requirement | Phase | Detail |
|---|---|---|---|---|---|
| FR-176 | FR-160 | Export | Convert stored data to Inline XBRL, XBRL-JSON and XBRL-CSV through EFRAG's self-hosted open-source converter | P2 | [Part 11](functional_requirements/11-deferred.md#fr-176--xbrl-export) |
| FR-177 | FR-161 | Report authoring | Support the VSME Comprehensive Module [C1–C9] as an additive extension of Basic | **MVP** | [Part 3](functional_requirements/03-authoring-calculator.md#fr-177--the-comprehensive-module) |
| FR-178 | FR-162 | Reporting oversight | Provide completion-status dashboards with deadline reminders | P2 | [Part 11](functional_requirements/11-deferred.md#fr-178--completion-dashboards-and-deadline-reminders) |
| FR-179 | FR-163 | Comparatives | Provide a standalone year-over-year analytics view across periods and entities | P2 | [Part 11](functional_requirements/11-deferred.md#fr-179--the-standalone-year-over-year-view) |
| FR-180 | FR-164 | Identity | Support enterprise SSO — federated SAML/OIDC against a customer's own directory, with domain claiming, just-in-time provisioning and directory-driven deprovisioning — distinct from the social sign-in in MVP scope | P2 | [Part 11](functional_requirements/11-deferred.md#fr-180--enterprise-single-sign-on) |
| FR-181 | FR-165 | Identity | **Partly superseded 18 Aug 2026.** *Opt-in* TOTP for tenant users is now MVP scope — NFR-95, promoted into `non_functional_requirements.md` §4.5. What remains deferred is **enforced** MFA: organization-level policy, mandatory enrolment and recovery administration. PA MFA remains mandatory (FR-75) | P2 | [Part 11](functional_requirements/11-deferred.md#fr-181--enforced-multi-factor-authentication-for-tenant-users) |
| FR-182 | FR-166 | Advisor | Manage a portfolio of client organizations from one login, completing or reviewing a report on a client's behalf | P2/P3 | [Part 11](functional_requirements/11-deferred.md#fr-182--advisor-entitlement-sponsorship) |
| FR-183 | FR-167 | Corporate buyer | Invite and monitor supplier organizations, view aggregated and benchmarked dashboards, and request a supplier's VSME data with consent | P2/P3 | [Part 11](functional_requirements/11-deferred.md#fr-183--corporate-buyer-supplier-monitoring) |
| FR-184 | FR-168 | Licensee | Administer a white-labelled instance — branding, domain, language pack — and the sub-organizations under it | P2/P3 | [Part 11](functional_requirements/11-deferred.md#fr-184--licensee-white-label-administration) |
| FR-185 | FR-169 | Billing | Support usage-based and metered pricing units, for which FR-105 already emits the events and NFR-10 already requires multi-unit entitlement | P2 | [Part 11](functional_requirements/11-deferred.md#fr-185--usage-based-and-metered-pricing) |
| FR-186 | FR-170 | Billing | Support reseller and partner commission handling for the Model 5 monetization scenario | P2/P3 | [Part 11](functional_requirements/11-deferred.md#fr-186--reseller-and-partner-commission) |
| FR-187 | FR-171 | Data ingestion | Support pluggable connectors for energy-provider and accounting-software data ingestion | P3 | [Part 11](functional_requirements/11-deferred.md#fr-187--energy-and-accounting-connectors) |
| FR-188 | FR-172 | Report authoring | Provide AI-assisted narrative drafting for qualitative fields [B2/C2] with mandatory human review before save, authorship remaining with the company | P3 | [Part 11](functional_requirements/11-deferred.md#fr-188--ai-assisted-narrative-drafting) |
| FR-189 | FR-173 | Report authoring | Optionally call an external document-risk-flagging service (e.g. IFC MALENA) to surface advisory-only consistency warnings on narrative disclosures | P3 | [Part 11](functional_requirements/11-deferred.md#fr-189--external-document-risk-flagging) |
| FR-174 | unchanged | Public disclosure | Provide an opt-in, searchable public disclosure portal, field-structured to align with anticipated ESAP requirements | P3 | [Part 11](functional_requirements/11-deferred.md#fr-174--the-public-disclosure-portal) |
| FR-175 | unchanged | Submission | Provide an ESAP-compatible submission bridge | Roadmap | [Part 11](functional_requirements/11-deferred.md#fr-175--the-esap-submission-bridge) |

**Count:** 15 deferred requirements — 10 at P2 or P2/P3 (6 at P2: FR-176, FR-178, FR-179, FR-180, FR-181, FR-185; 4 at P2/P3: FR-182, FR-183, FR-184, FR-186), 4 at P3 (FR-174, FR-187, FR-188, FR-189), 1 Roadmap (FR-175; not committed). FR-177 is promoted and no longer counted. Of these, 13 carry source IDs that collide with MVP requirements.

**Excluded outright, with no requirement written against them** (design decisions document, section 4): multi-currency price-list automation (prices are authored per currency by hand, D-14); direct debit and standing-order mandates (the transfer-plus-reconciliation path covers the same need); virtual cash register and eBon digital receipt integration (the platform sells B2B to registered companies); full double-entry accounting (the platform maintains a billing ledger and exports to the customer's accounting system, FR-150); in-product payment collection on behalf of customers (raises payment-institution licensing questions beyond this scope); blockchain traceability (uncommitted, no problem statement).

---

## 9. Coverage and traceability

### 9.1 UC → FR matrix

Every use case UC-01 … UC-214 maps to at least one MVP functional requirement, except UC-182, whose requirement waits on task 77.1 (G-9). **Regenerated 5 Oct 2026 (task 182)** from the `Source UC` column of §3 and the actor column of `use_cases.md` §3; it extended only to UC-176 before. The matrix below is derived from the `Source UC` column of section 3 and is the forward check.

| UC ID | Actor | FR(s) |
|---|---|---|
| UC-01 | CA | FR-1 |
| UC-02 | CA | FR-2 |
| UC-03 | CA | FR-3 |
| UC-04 | CA | FR-4 |
| UC-05 | CA | FR-4 |
| UC-06 | CA | FR-5 |
| UC-07 | CA | FR-5 |
| UC-08 | CA | FR-6 |
| UC-09 | CA | FR-6 |
| UC-10 | CA | FR-7 |
| UC-11 | CA | FR-8 |
| UC-12 | CA | FR-8 |
| UC-13 | CA | FR-9 |
| UC-14 | CA | FR-10, FR-64 |
| UC-15 | CA | FR-11 |
| UC-16 | CA | FR-12 |
| UC-17 | RC | FR-25 |
| UC-18 | RC | FR-24, FR-26 |
| UC-19 | RC | FR-24, FR-27, FR-28 |
| UC-20 | RC | FR-24 |
| UC-21 | RC | FR-24, FR-29 |
| UC-22 | RC | FR-24, FR-29 |
| UC-23 | RC | FR-24, FR-28 |
| UC-24 | RC | FR-24, FR-28, FR-29 |
| UC-25 | RC | FR-24, FR-29 |
| UC-26 | RC | FR-24, FR-28, FR-29 |
| UC-27 | RC | FR-24, FR-30 |
| UC-28 | RC | FR-24, FR-28, FR-29 |
| UC-29 | RC | FR-24, FR-30 |
| UC-30 | RC | FR-31 |
| UC-31 | RC | FR-32 |
| UC-32 | RC | FR-33 |
| UC-33 | RC | FR-34, FR-35 |
| UC-34 | RC | FR-36 |
| UC-35 | RC | FR-37, FR-38 |
| UC-36 | RC | FR-39 |
| UC-37 | RC | FR-40 |
| UC-38 | RC | FR-41 |
| UC-39 | RC | FR-42 |
| UC-40 | RC | FR-43 |
| UC-41 | RC | FR-48 |
| UC-42 | RC | FR-44, FR-49 |
| UC-43 | RC | FR-50, FR-51 |
| UC-44 | RC | FR-53 |
| UC-45 | RC | FR-45, FR-46 |
| UC-46 | RC | FR-47 |
| UC-47 | RC | FR-54, FR-55 |
| UC-48 | RC | FR-52 |
| UC-49 | OA | FR-13, FR-14 |
| UC-50 | OA | FR-15 |
| UC-51 | OA | FR-16 |
| UC-52 | OA | FR-17 |
| UC-53 | OA | FR-17, FR-18 |
| UC-54 | OA | FR-19 |
| UC-55 | OA | FR-20 |
| UC-56 | OA | FR-21, FR-45, FR-66 |
| UC-57 | OA | FR-22 |
| UC-58 | OA | FR-22 |
| UC-59 | OA | FR-56 |
| UC-60 | OA | FR-57 |
| UC-61 | OA | FR-57 |
| UC-62 | OA | FR-58 |
| UC-63 | OA | FR-55, FR-59 |
| UC-64 | OA | FR-60 |
| UC-65 | OA | FR-90 |
| UC-66 | OA | FR-105 |
| UC-67 | OA | FR-23 |
| UC-68 | PA | FR-75 |
| UC-69 | PA | FR-76, FR-77 |
| UC-70 | PA | FR-82 |
| UC-71 | PA | FR-61, FR-74 |
| UC-72 | PA | FR-62 |
| UC-73 | PA | FR-63 |
| UC-74 | PA | FR-64 |
| UC-75 | PA | FR-65, FR-66 |
| UC-76 | PA | FR-67 |
| UC-77 | PA | FR-68 |
| UC-78 | PA | FR-51, FR-69 |
| UC-79 | PA | FR-70 |
| UC-80 | PA | FR-71 |
| UC-81 | PA | FR-72, FR-74 |
| UC-82 | PA | FR-73, FR-74 |
| UC-83 | PA | FR-83 |
| UC-84 | PA | FR-83 |
| UC-85 | PA | FR-77, FR-78 |
| UC-86 | PA | FR-79 |
| UC-87 | PA | FR-80 |
| UC-88 | PA | FR-81 |
| UC-89 | BO | FR-84 |
| UC-90 | BO | FR-85 |
| UC-91 | BO | FR-86 |
| UC-92 | BO | FR-87 |
| UC-93 | BO | FR-88 |
| UC-94 | BO | FR-89 |
| UC-95 | BO | FR-89 |
| UC-96 | OA | FR-91 |
| UC-97 | OA | FR-92 |
| UC-98 | OA | FR-93 |
| UC-99 | OA | FR-95 |
| UC-100 | OA | FR-94 |
| UC-101 | OA | FR-94 |
| UC-102 | OA | FR-96 |
| UC-103 | OA | FR-97 |
| UC-104 | OA | FR-97 |
| UC-105 | OA | FR-97 |
| UC-106 | OA | FR-90 |
| UC-107 | OA | FR-98 |
| UC-108 | OA | FR-106 |
| UC-109 | SYS | FR-107 |
| UC-110 | OA | FR-108 |
| UC-111 | OA | FR-109 |
| UC-112 | OA | FR-110 |
| UC-113 | OA | FR-111 |
| UC-114 | OA | FR-112 |
| UC-115 | OA | FR-113 |
| UC-116 | OA | FR-114, FR-115, FR-116 |
| UC-117 | OA | FR-116 |
| UC-118 | OA | FR-117 |
| UC-119 | OA | FR-117 |
| UC-120 | OA | FR-114, FR-118 |
| UC-121 | OA | FR-114, FR-119 |
| UC-122 | OA | FR-114 |
| UC-123 | SYS | FR-120 |
| UC-124 | SYS | FR-120 |
| UC-125 | SYS | FR-120 |
| UC-126 | SYS | FR-121 |
| UC-127 | SYS | FR-122 |
| UC-128 | SYS | FR-124 |
| UC-129 | SYS | FR-126 |
| UC-130 | BO | FR-127 |
| UC-131 | SYS | FR-128 |
| UC-132 | OA | FR-128 |
| UC-133 | BO | FR-125 |
| UC-134 | BO | FR-123 |
| UC-135 | BO | FR-130 |
| UC-136 | SYS | FR-129 |
| UC-137 | BO | FR-131 |
| UC-138 | SYS | FR-132 |
| UC-139 | BO | FR-133 |
| UC-140 | BO | FR-134 |
| UC-141 | SYS | FR-135 |
| UC-142 | SYS | FR-104, FR-136 |
| UC-143 | SYS | FR-137 |
| UC-144 | BO | FR-138 |
| UC-145 | BO | FR-139 |
| UC-146 | BO | FR-140 |
| UC-147 | SYS | FR-141 |
| UC-148 | SYS | FR-99, FR-100 |
| UC-149 | SYS | FR-101 |
| UC-150 | SYS | FR-102 |
| UC-151 | SYS | FR-103, FR-104 |
| UC-152 | SYS | FR-105 |
| UC-153 | OA | FR-142 |
| UC-154 | BO | FR-143 |
| UC-155 | BO | FR-144 |
| UC-156 | BO | FR-145 |
| UC-157 | OA | FR-146 |
| UC-158 | BO | FR-147 |
| UC-159 | BO | FR-147 |
| UC-160 | BO | FR-148 |
| UC-161 | BO | FR-149 |
| UC-162 | BO | FR-150 |
| UC-163 | BO | FR-151 |
| UC-164 | BO | FR-152 |
| UC-165 | CA | FR-160, FR-161 |
| UC-166 | CA | FR-162 |
| UC-167 | CA | FR-161 |
| UC-168 | CA | FR-9, FR-163 |
| UC-169 | SYS | FR-164, FR-167 |
| UC-170 | SYS | FR-165, FR-167 |
| UC-171 | SYS | FR-70, FR-166 |
| UC-172 | SYS | FR-160, FR-168 |
| UC-173 | SYS | FR-169 |
| UC-174 | SYS | FR-160, FR-170, FR-171 |
| UC-175 | OA | FR-173 |
| UC-176 | PA | FR-173 |
| UC-177 | VI | FR-204 |
| UC-178 | VI | FR-205 |
| UC-179 | VI | FR-206 |
| UC-180 | VI | FR-61 *(G-9: help-centre articles are FR-61's versioned content)* |
| UC-181 | VI | FR-61 *(G-9)* |
| UC-182 | VI | **none** — waits on task 77.1 (G-9) |
| UC-183 | RC | FR-177 |
| UC-184 | RC | FR-177 |
| UC-185 | RC | FR-177 |
| UC-186 | RC | FR-177 |
| UC-187 | RC | FR-177 |
| UC-188 | RC | FR-177 |
| UC-189 | RC | FR-177 |
| UC-190 | RC | FR-177 |
| UC-191 | RC | FR-177 |
| UC-192 | RC | FR-177 |
| UC-193 | CA | FR-208 |
| UC-194 | CA | FR-208 |
| UC-195 | CA | FR-208 |
| UC-196 | AD | FR-190 |
| UC-197 | AD | FR-191 |
| UC-198 | AD | FR-192 |
| UC-199 | AD | FR-193 |
| UC-200 | AD | FR-194 |
| UC-201 | OA | FR-195 |
| UC-202 | OA | FR-196 |
| UC-203 | OA | FR-197 |
| UC-204 | OA | FR-198 |
| UC-205 | AD | FR-199 |
| UC-206 | AD | FR-200 |
| UC-207 | AD | FR-201 |
| UC-208 | BO | FR-202 |
| UC-209 | AD | FR-202 |
| UC-210 | SYS | FR-203 |
| UC-211 | SYS | FR-203 |
| UC-212 | PA | FR-80 |
| UC-213 | OA | FR-210 |
| UC-214 | PA | FR-209 |

### 9.2 FR → UC reverse check

The reverse index below restates the `Source UC` column of section 3 in one place. 186 of the 195 MVP requirements trace to at least one use case; the 9 that do not (FR-153 … FR-159, FR-172 and FR-207) are listed in section 9.4.

FR-1→UC-01 · FR-2→UC-02 · FR-3→UC-03 · FR-4→UC-04, UC-05 · FR-5→UC-06, UC-07 · FR-6→UC-08, UC-09 · FR-7→UC-10 · FR-8→UC-11, UC-12 · FR-9→UC-13, UC-168 · FR-10→UC-14 · FR-11→UC-15 · FR-12→UC-16 · FR-13→UC-49 · FR-14→UC-49 · FR-15→UC-50 · FR-16→UC-51 · FR-17→UC-52, UC-53 · FR-18→UC-53 · FR-19→UC-54 · FR-20→UC-55 · FR-21→UC-56 · FR-22→UC-57, UC-58 · FR-23→UC-67 · FR-24→UC-18, UC-19, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-26, UC-27, UC-28, UC-29 · FR-25→UC-17 · FR-26→UC-18 · FR-27→UC-19 · FR-28→UC-19, UC-23, UC-24, UC-26, UC-28 · FR-29→UC-21, UC-22, UC-24, UC-25, UC-26, UC-28 · FR-30→UC-27, UC-29 · FR-31→UC-30 · FR-32→UC-31 · FR-33→UC-32 · FR-34→UC-33 · FR-35→UC-33 · FR-36→UC-34 · FR-37→UC-35 · FR-38→UC-35 · FR-39→UC-36 · FR-40→UC-37 · FR-41→UC-38 · FR-42→UC-39 · FR-43→UC-40 · FR-44→UC-42 · FR-45→UC-45, UC-56 · FR-46→UC-45 · FR-47→UC-46 · FR-48→UC-41 · FR-49→UC-42 · FR-50→UC-43 · FR-51→UC-43, UC-78 · FR-52→UC-48 · FR-53→UC-44 · FR-54→UC-47 · FR-55→UC-47, UC-63 · FR-56→UC-59 · FR-57→UC-60, UC-61 · FR-58→UC-62 · FR-59→UC-63 · FR-60→UC-64 · FR-61→UC-71 · FR-62→UC-72 · FR-63→UC-73 · FR-64→UC-14, UC-74 · FR-65→UC-75 · FR-66→UC-56, UC-75 · FR-67→UC-76 · FR-68→UC-77 · FR-69→UC-78 · FR-70→UC-79, UC-171 · FR-71→UC-80 · FR-72→UC-81 · FR-73→UC-82 · FR-74→UC-71, UC-81, UC-82 · FR-75→UC-68 · FR-76→UC-69 · FR-77→UC-69, UC-85 · FR-78→UC-85 · FR-79→UC-86 · FR-80→UC-87, UC-212 · FR-81→UC-88 · FR-82→UC-70 · FR-83→UC-83, UC-84 · FR-84→UC-89 · FR-85→UC-90 · FR-86→UC-91 · FR-87→UC-92 · FR-88→UC-93 · FR-89→UC-94, UC-95 · FR-90→UC-65, UC-106 · FR-91→UC-96 · FR-92→UC-97 · FR-93→UC-98 · FR-94→UC-100, UC-101 · FR-95→UC-99 · FR-96→UC-102 · FR-97→UC-103, UC-104, UC-105 · FR-98→UC-107 · FR-99→UC-148 · FR-100→UC-148 · FR-101→UC-149 · FR-102→UC-150 · FR-103→UC-151 · FR-104→UC-142, UC-151 · FR-105→UC-66, UC-152 · FR-106→UC-108 · FR-107→UC-109 · FR-108→UC-110 · FR-109→UC-111 · FR-110→UC-112 · FR-111→UC-113 · FR-112→UC-114 · FR-113→UC-115 · FR-114→UC-116, UC-120, UC-121, UC-122 · FR-115→UC-116 · FR-116→UC-116, UC-117 · FR-117→UC-118, UC-119 · FR-118→UC-120 · FR-119→UC-121 · FR-120→UC-123, UC-124, UC-125 · FR-121→UC-126 · FR-122→UC-127 · FR-123→UC-134 · FR-124→UC-128 · FR-125→UC-133 · FR-126→UC-129 · FR-127→UC-130 · FR-128→UC-131, UC-132 · FR-129→UC-136 · FR-130→UC-135 · FR-131→UC-137 · FR-132→UC-138 · FR-133→UC-139 · FR-134→UC-140 · FR-135→UC-141 · FR-136→UC-142 · FR-137→UC-143 · FR-138→UC-144 · FR-139→UC-145 · FR-140→UC-146 · FR-141→UC-147 · FR-142→UC-153 · FR-143→UC-154 · FR-144→UC-155 · FR-145→UC-156 · FR-146→UC-157 · FR-147→UC-158, UC-159 · FR-148→UC-160 · FR-149→UC-161 · FR-150→UC-162 · FR-151→UC-163 · FR-152→UC-164 · **FR-153→none** · **FR-154→none** · **FR-155→none** · **FR-156→none** · **FR-157→none** · **FR-158→none** · **FR-159→none** · FR-160→UC-165, UC-172, UC-174 · FR-161→UC-165, UC-167 · FR-162→UC-166 · FR-163→UC-168 · FR-164→UC-169 · FR-165→UC-170 · FR-166→UC-171 · FR-167→UC-169, UC-170 · FR-168→UC-172 · FR-169→UC-173 · FR-170→UC-174 · FR-171→UC-174 · **FR-172→none** · FR-173→UC-175, UC-176 · FR-177→UC-183, UC-184, UC-185, UC-186, UC-187, UC-188, UC-189, UC-190, UC-191, UC-192 · FR-190→UC-196 · FR-191→UC-197 · FR-192→UC-198 · FR-193→UC-199 · FR-194→UC-200 · FR-195→UC-201 · FR-196→UC-202 · FR-197→UC-203 · FR-198→UC-204 · FR-199→UC-205 · FR-200→UC-206 · FR-201→UC-207 · FR-202→UC-208, UC-209 · FR-203→UC-210, UC-211 · FR-204→UC-177 · FR-205→UC-178 · FR-206→UC-179 · **FR-207→none** · FR-208→UC-193, UC-194, UC-195 · FR-209→UC-214 · FR-210→UC-213

### 9.3 Where the two documents deliberately do not align one-to-one

Counting rows in the two registers gives **214** use cases against 195 requirements. The difference is not a gap; it is the sum of two intentional deviations — and, since 24 Aug 2026, one recorded one.

**One of the six public-tier use cases originates no requirement** (UC-182), which is G-9 in §9.4 rather than a third deviation: it is a gap the register acknowledges owing, not a place the two documents were designed to differ. UC-177, UC-178 and UC-179 stood in that gap until 5 Oct 2026, when FR-204 … FR-206 were written for them.

**Several use cases share one requirement**, where the capability is genuinely identical and testing it twice would test the same code.

| Use cases | Shared requirement(s) | Why |
|---|---|---|
| UC-19 … UC-29 (the eleven Basic Module data entry use cases) | FR-24, FR-28, FR-29, FR-30 | What differs between B4 and B6 is field content held as configuration (FR-72), not system behaviour. |
| UC-103, UC-104, UC-105 | FR-97 | Auto-renewal, cancellation and reactivation are three transitions of one state machine. |
| UC-04, UC-05 | FR-4 | One authentication path per credential type over one account record. |
| UC-06, UC-07 | FR-5 | Server-side session termination and post-expiry resumption are two ends of one session obligation. |
| UC-08, UC-09 | FR-6 | Issuing and consuming the reset link is one single-use token mechanism. |
| UC-123, UC-124, UC-125 | FR-120 | Charge, retry policy and failure notice are one recurring-charge obligation. |
| UC-131, UC-132 | FR-128 | Delivery and post-lapse availability are one invoice-availability obligation. |
| UC-158, UC-159 | FR-147 | Custom schedule and renewal tracking are one data-driven contract-billing obligation. |
| UC-83, UC-84 | FR-83 | The dashboard and its export are one metrics capability. |
| UC-175, UC-176 | FR-173 | A manual reminder and the category catalogue both resolve to configuration-held categories and templates. |

**Several use cases decompose into multiple requirements**, because they contain independently failing parts.

| Use case | Requirements | Why |
|---|---|---|
| UC-35 | FR-37, FR-38 | Autosave working and offline queuing working are different guarantees with different failure modes. |
| UC-116 | FR-114, FR-115, FR-116 | "The platform never touches card data" must hold whether or not the hosted-page integration works, and is verified differently. |
| UC-33 | FR-34, FR-35 | Computing the figure and stamping the factor version onto it fail independently. |
| UC-49 | FR-13, FR-14 | Granting the founding role and modelling typed relationships are unrelated obligations. |
| UC-69 | FR-76, FR-77 | Providing the register and prohibiting standing report-data access are a capability and a prohibition. |
| UC-151 | FR-103, FR-104 | Selecting what falls out of entitlement and never deleting content are separate obligations. |
| UC-174 | FR-160, FR-170, FR-171 | Recording delivery, retrying transient failures and suppressing hard bounces fail independently. |

### 9.4 Traceability gaps and anomalies

| # | Finding | Assessment |
|---|---|---|
| G-1 | **FR-153, FR-154, FR-155, FR-156, FR-157, FR-158, FR-159 have no originating use case.** They are marked `(architectural)` in the source register. | **Intentional.** These are cross-cutting obligations no single use case owns but every one depends on. They are verified as architectural conformance (section 3.29). Each traces instead to an NFR or a design decision: FR-153→legacy FR-21/NFR-13, FR-154→D-11/NFR-1, FR-155→NFR-2, FR-156→NFR-11, FR-157→register note, FR-158→NFR-13, FR-159→NFR-7. |
| G-2 | **FR-172 has no originating use case** and is marked `(architectural)`, but sits in the Notification delivery domain. The FR Deferred Scope document states that every MVP requirement "except the seven cross-cutting entries (FR-153 … FR-159)" traces to a use case — a statement written before FR-160 … FR-173 were added. | **Stale statement in the source, not a defect in the requirement.** The correct count was eight requirements without an originating use case, and is nine since 5 Oct 2026 (FR-207, data-subject requests, joins them; the other eight are FR-153 … FR-159 and FR-172). FR-172 traces to FR-157 as its parent obligation. Corrected in this baseline. |
| G-3 | **UC-20 (Complete B2 — Practices, policies and future initiatives) has no explicitly enumerated FR.** It is covered only by the `UC-19 … UC-29` range on FR-24. Every other Basic Module use case is additionally named explicitly on FR-28, FR-29, FR-30, FR-31 or FR-32. | **Weak but not absent.** B2 is the report's principal narrative module, and FR-24 requires structured and narrative content for a module to be captured together, so coverage exists. Recorded as OQ-4: consider naming UC-20 explicitly against FR-24 so the trace does not depend on reading a range. |
| G-4 | **No use case originates a requirement for NFR-5 (GDPR / Moldovan data protection, EU/EEA hosting) or NFR-8 (responsive across devices, scaling for fiscal year-end spikes).** | **Expected.** Both are non-functional by nature and neither source writes a functional requirement against them. FR-130 records the one place where fiscal retention overrides an erasure request, which is the only functional interaction with NFR-5 that any source states. Recorded as OQ-5. **Updated 5 Oct 2026** (project owner, task 182): NFR-5 now has FR-205 (the legal documents) and FR-207 (data-subject requests); NFR-8 still has none. OQ-5 is closed. |
| G-5 | **NFR coverage for FR-160 … FR-173 does not exist.** The source register's closing note states that delivery latency, retry bounds, email deliverability and retention of delivery records are unspecified. | **Open item against the NFR document**, not against this baseline. Recorded as OQ-3. |
| G-6 | **UC-148 cites legacy `FR-23`** ("central entitlement/plan-check service plus metering events"), which in the current sequence is "Present an organization-wide overview of every entity and period". | **Reading key required**, section 9.5. The current requirements are FR-99, FR-100 and FR-105. |
| G-7 | **Design decision D-3 cites legacy `FR-15`** ("multi-period comparative records in a year-over-year view") and calls for its split; current FR-15 is the organization profile requirement. | **Reading key required**, section 9.5. The split is realised as FR-45, FR-46, FR-47 at MVP with the standalone analytics view deferred. |
| G-8 | **The FR Deferred Scope document states the register holds 159 MVP requirements and that "every use case UC-01 … UC-164" is covered.** | **Stale counts.** The register holds 195 MVP requirements and the use case register holds 212 use cases (the figures were 173 and 176 when this finding was written). Resolved in favour of the register (section 9.6, C-2 and C-3). |
| G-9 | **UC-182 originates no functional requirement.** Added 24 Aug 2026 with the Visitor actor (`design_spec.md` OQ-12): the route to support has a screen (S-34) and a use case, and no FR describes it. UC-177, UC-178 and UC-179 stood in this finding until 5 Oct 2026 (FR-204 … FR-206; the closure is recorded in the next column). UC-180 and UC-181 are covered — FR-61 already holds help-centre articles as versioned data. | **A real gap, recorded rather than closed by inventing numbers.** Three reasons it is not closed here. The MVP block is FR-1 … FR-173 and FR-174 … FR-189 are the deferred register, so a new MVP requirement would have to be numbered outside its own block — a scheme change, not a requirement. The legal-document obligation is discharged **non-functionally** and there is precedent for exactly that: G-4 records NFR-5 as having no FR at all, and §7.3 states the same disposition. And UC-182's delivery channel is undecided (`task.md` task 77), so an FR written now would specify a mechanism nobody has chosen. **What this costs:** four use cases whose acceptance criteria live in `design_spec.md` §5 rather than here, which is the weaker place for them. Owned by the requirements owner alongside `design_spec.md` OQ-12's cascade. **Closed 5 Oct 2026 (project owner, task 182)** for three of the four: UC-177, UC-178 and UC-179 now originate **FR-204, FR-205 and FR-206** (part 8), numbered after FR-203 as the advisor block already was. The block-numbering objection above stopped binding when FR-190 … FR-203 were added as MVP on 11 Sep 2026. **UC-182 still originates none**: its channel is task 77.1's to decide, and its requirement is written when that decision is. |
| G-10 | **FR-207 has no originating use case** (added 5 Oct 2026, task 182). | **Intentional.** Data-subject requests are NFR-5's obligation made functional (OQ-5, closed the same day). It traces to NFR-5, NFR-28 and NFR-29, as FR-153 … FR-159 trace to their NFRs (G-1). The count of requirements without a use case is therefore nine. |

### 9.5 Reading key for the superseded legacy FR set

Legacy FR-1 … FR-23 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" are superseded in their entirety. This is the reading key for any document, backlog item or test case that still cites a legacy ID.

| Legacy ID | Legacy requirement | Now covered by |
|---|---|---|
| FR-1 (old) | Guided form covering all VSME Basic Module fields [B1–B11] | FR-24, FR-29 |
| FR-2 (old) | Conditional-applicability rules evaluated dynamically from B1 | FR-28, FR-72 |
| FR-3 (old) | Carbon footprint calculator auto-populating B3 | FR-33, FR-34 |
| FR-4 (old) | Persist report data per entity per period with autosave | FR-21, FR-37, FR-39 |
| FR-5 (old) | Validate against EFRAG's five validation states | FR-40, FR-41, FR-73 |
| FR-6 (old) | Export a completed report as PDF | FR-49 |
| FR-7 (old) | Export via the EFRAG Excel Digital Template, version-pinned | FR-50, FR-51 |
| FR-8 (old) | Romanian and English for UI and exported labels | FR-10, FR-52, FR-63 |
| FR-9 (old) | Store template/taxonomy version against every report | FR-66 |
| FR-10 (old) | LEI primary, DUNS/EU ID/PermID fallback | FR-16 — **but the scheme is superseded**: FR-16 now reads IDNO primary with LEI optional (amended 18 Aug 2026, `architecture.md` OQ-18). The legacy requirement's intent — a validated, EFRAG-acceptable identifier — survives; its choice of primary does not |
| FR-11 (old) | More than one user per org viewing/editing a shared report | FR-25, FR-57, FR-58 |
| FR-12 (old) | XBRL conversion via the EFRAG converter (P2) | FR-176 (deferred set; source ID FR-160) |
| FR-13 (old) | Comprehensive Module [C1–C9] (P2) | FR-177 (deferred set; source ID FR-161) |
| FR-14 (old) | Completion dashboards and deadline reminders (P2) | FR-178 (deferred set; source ID FR-162) |
| FR-15 (old) | Multi-period comparative records in a year-over-year view (P2) | **Split per D-3:** storage and inline display are MVP (FR-45, FR-46, FR-47); the standalone analytics view stays P2 (FR-163, deferred set) |
| FR-16 (old) | Energy-provider and accounting connectors (P3) | FR-187 (deferred set; source ID FR-171) |
| FR-17 (old) | AI-assisted narrative drafting (P3) | FR-188 (deferred set; source ID FR-172) |
| FR-18 (old) | External document-risk flagging (P3) | FR-189 (deferred set; source ID FR-173) |
| FR-19 (old) | Opt-in public disclosure portal (P3) | FR-174 |
| FR-20 (old) | ESAP submission bridge (Roadmap) | FR-175 |
| FR-21 (old) | API-first: report CRUD, validation, export through a documented API | FR-153 |
| FR-22 (old) | Typed organization relationship model | FR-14 |
| FR-23 (old) | Central entitlement/plan-check service plus metering events | **Split:** FR-99 (central check), FR-100 (gating held outside the gated feature), FR-105 (metering event stream) — this is the reference cited in UC-148 |

Legacy use case IDs UC-1 … UC-24 in the same document are likewise superseded by UC-01 … UC-176; the mapping is section 3 of "ESG Platform Use Case Design Decisions and Constraints (MVP)" and is not reproduced here.

### 9.6 Conflicts between sources and their resolution

| # | Conflict | Resolution |
|---|---|---|
| C-1 | **FR ID collision.** FR-160 … FR-173 are MVP notification requirements in the FR register and deferred P2/P3 requirements in the FR Deferred Scope document. | The FR register is the later document and the one that governs build scope, so **FR-160 … FR-173 mean the MVP notification requirements**. The deferred entries keep their source IDs verbatim in section 8, marked `⚠ collides`, and need reassignment above FR-173 before promotion. No ID is renumbered by this document. Carried as OQ-1. |
| C-2 | **MVP requirement count.** The Deferred Scope document says 159; the register says 173 and states 31 domains. | Register wins: **173 requirements, FR-1 … FR-173, 31 domains** (verified by count in section 3). The Deferred Scope figure predates FR-160 … FR-173. |
| C-3 | **Use case range.** The Deferred Scope coverage section says UC-01 … UC-164; the use case register holds UC-01 … UC-176. | Use case register wins: **UC-01 … UC-176**, and the notification use cases UC-165 … UC-176 are covered by FR-160 … FR-173. Section 9.1 is the corrected forward check. |
| C-4 | **Requirements without a source use case.** Deferred Scope says seven (FR-153 … FR-159); the register also marks FR-172 architectural. | **Eight**: FR-153 … FR-159 plus FR-172. See G-1, G-2. |
| C-5 | **Domain count.** An earlier edition of the register stated 25 domains, the current edition states 31. | 31, verified by count. |
| C-6 | **Legacy FR set.** Legacy FR-1 … FR-23 of the combined document carry different meanings from the current FR-1 … FR-23. | The dedicated register supersedes them in their entirety; section 9.5 is the reading key. Sections 1, 2 and 4 of the combined document — forward-looking actors, external systems, and NFR-1 … NFR-13 — remain in force. |
| C-7 | **Actor vocabulary.** The combined document names SME Report Preparer, SME Org Admin and Platform Admin / Support; the use case register uses CA, RC, OA, PA, BO, SYS. | Use case register wins (section 1.3). BO and SYS have no counterpart in the combined document; BO is recorded there as a new actor recommended for addition to the System Actors document. Carried as OQ-2. |
| C-8 | **Billing provider.** The combined document lists a "Billing/metering provider (Stripe-/Paddle-/Chargebee-style)" as the MVP external system. D-7 and D-8 record that Stripe does not support Moldova-resident businesses and that money movement runs over domestic rails behind an adapter. | Design decisions win, as realised in FR-114 … FR-120. What survives from the combined document is the **metering event stream** (FR-105), which exists at MVP; a consuming billing provider is not an MVP dependency. |
| C-9 | **Actor identifier prefix.** The brief for this consolidation anticipated `ACT-*` identifiers. | No `ACT-*` identifier appears in any consolidated source. The actor identifiers in force are the codes CA, RC, OA, PA, BO, SYS. None is invented here. |

### 9.7 Design decision and NFR coverage index

| Decision | Realised by |
|---|---|
| D-1 Founding user is an Organization Administrator | FR-13 |
| D-2 Entity master data OA-owned, disclosure content RC-owned | FR-27, FR-17, FR-19 |
| D-3 Comparatives MVP for storage and inline display; standalone view P2 | FR-45, FR-46, FR-47; deferred FR-163 |
| D-4 "Not available, with reason" is a first-class field state | FR-32 |
| D-5 No standing PA access to tenant report data | FR-77, FR-78, FR-79, FR-76 |
| D-6 Social sign-in in MVP, enterprise SSO not | FR-2, FR-82; deferred FR-164 |
| D-7 Own the billing domain, not the card rails | FR-114, FR-115 |
| D-8 Four payment rails, all provider-executed, behind one adapter | FR-114, FR-116, FR-118, FR-119 |
| D-9 e-Factura integration is MVP | FR-126, FR-127 |
| D-10 Issued invoices immutable; corrections are credit notes | FR-125, FR-123, FR-107 |
| D-11 Billing is a separate bounded context | FR-154, FR-99, FR-100 |
| D-12 Three plans: Free, Standard, Enterprise | FR-85, FR-142, FR-143, FR-144, FR-145 |
| D-13 A downgrade or non-payment never destroys report data | FR-104, FR-136, FR-141, FR-147, FR-94 |
| D-14 MDL is the ledger currency; FX invoices record the BNM rate | FR-86, FR-129, FR-150 |

| NFR | Realised or constrained by |
|---|---|
| NFR-1 Compliance core independent of plan, price, tenant type | FR-154 |
| NFR-2 Internal schema mirrors VSME taxonomy elements | FR-155 |
| NFR-3 Explicit template/taxonomy version per report; re-export and migration | FR-66, FR-65, FR-51, FR-69, FR-45 |
| NFR-4 Localization not hardcoded to two languages | FR-63, FR-10, FR-52 |
| NFR-5 GDPR / Moldovan data protection, EU/EEA hosting | FR-205, FR-207; FR-130 records the fiscal-retention precedence. OQ-5 closed 5 Oct 2026. |
| NFR-6 AI features do not train on customer data; stated retention policy | Constrains deferred FR-172 only |
| NFR-7 Every disclosure field change attributable | FR-54, FR-55, FR-159 |
| NFR-8 Responsive across devices; scales for year-end spikes | No functional requirement stated. See OQ-5. |
| NFR-9 Organization/relationship model accepts new types without migration | FR-14, FR-12 |
| NFR-10 Entitlement layer supports multiple concurrent pricing units | FR-85, FR-105; enables deferred FR-169 |
| NFR-11 Third-party components behind internal interfaces | FR-156, FR-114, FR-169 |
| NFR-12 Quarterly regulatory-watch cadence without full redeploy | FR-74, FR-61, FR-62, FR-71, FR-72, FR-73, FR-173 |
| NFR-13 Security baseline: encryption, RBAC per org/role, secure auth, authenticated API | FR-158, FR-153, FR-75, FR-4 |

---

## 10. Open questions

| # | Question | Origin | Consequence if unresolved |
|---|---|---|---|
| OQ-1 | **Closed 18 Aug 2026 — the deferred set is renumbered FR-176 … FR-189**, above FR-175. FR-160 … FR-173 now mean the MVP notification requirements and nothing else. The `Was (source)` column in §8 is the permanent mapping, so citations using source-numbered IDs still resolve; §9.5's legacy FR-12 … FR-18 rows are repointed. | C-1, sections 2.2 and 8 | Resolved. The deferred set moved rather than the MVP set because the MVP set is cited by 27 use cases and by shipping requirements, while the deferred set is cited only by nine deferred NFRs — all nine updated in `non_functional_requirements.md` §6.2. A backlog item citing FR-163 is now unambiguous. Also closed in `non_functional_requirements.md` OQ-1. |
| OQ-2 | **Closed 18 Aug 2026 — yes, by supersession.** `actors.md` replaces the dedicated "System Actors (MVP)" document and carries all six codes as canonical, BO and SYS included. | Use case register actor table; C-7 | Resolved. The privilege separation between PA and BO (FR-80, FR-139) now has authority in the actors document. Also closed in `use_cases.md` OQ-1 and `actors.md` OQ-1. |
| OQ-3 | **Closed 18 Aug 2026 — ratified as NFR-106 … NFR-109** in `non_functional_requirements.md` §4.16. Dispatch latency p95 ≤ 60 s; FR-171's retry is an exponential schedule bounded at 24 h with suppression on first hard bounce; FR-169's transactional mail targets ≥ 99% accepted delivery, SPF/DKIM/DMARC-aligned (also entered against NFR-84); FR-170's delivery records are retained for organization life + 1 year, readable independently of the notification centre. | Register closing note; G-5 | Resolved. FR-169, FR-170 and FR-171 now have acceptance thresholds, and "bounded schedule" is verifiable against 24 hours. Also closed in `use_cases.md` OQ-5, `non_functional_requirements.md` OQ-13, `architecture.md` OQ-2 and `design_spec.md` OQ-11. |
| OQ-4 | **Closed 18 Aug 2026 — yes; FR-24's `Source UC` now names UC-20 explicitly** alongside the UC-19 … UC-29 range. | G-3 | Resolved. The trace to the report's principal narrative module no longer depends on a reader expanding a range. Ranges are retained elsewhere where every member is homogeneous; UC-20 is called out because B2 is the one narrative module in an otherwise quantitative range. |
| OQ-5 | **Closed 5 Oct 2026 (project owner, task 182) — NFR-5 gains one, NFR-8 needs none.** **FR-207** (part 8) states data-subject requests: access, export and erasure, what is erased, what fiscal retention keeps (FR-130), who acts and the evidence kept, traced to NFR-5 and NFR-27 … NFR-32. NFR-8 stays purely non-functional, because NFR-43 and NFR-44 already make its two qualities testable. Also closed in `non_functional_requirements.md` OQ-12. | G-4 | Resolved. A data-subject erasure request has a defined behaviour for every kind of data, not only fiscal documents. |
| OQ-6 | **Which monetization model is activated after MVP — Model 3 (Advisor), Model 4 (Corporate Buyer) or Model 6 (Licensee)?** The decision is explicitly demand-driven and gated on the MVP success metrics that FR-83 produces. Also logged in `use_cases.md` OQ-2, `actors.md` OQ-5, `problem_overview.md` OQ-11 and `architecture.md` OQ-24. | Combined document section 5; deferred FR-166, FR-167, FR-168 | The P2/P3 sequencing of three deferred capability clusters is undetermined. The architecture is required only not to block any of them (FR-14, NFR-9). |
| OQ-7 | **Blockchain traceability and the ESAP bridge remain uncommitted.** No requirement is written for blockchain traceability at all; FR-175 is a roadmap placeholder for ESAP. Both need a concrete problem statement before being scoped. Also logged in `use_cases.md` OQ-4. | Combined document section 5; design decisions section 4 | Nothing at MVP depends on either; the risk is only that a stakeholder expects them to be in scope. |
| OQ-8 | **The Assurance / Referral Partner actor (Model 5) is named but not use-cased.** It needs its own pass once a referral-partner list exists. Deferred FR-170 (reseller and partner commission handling) is the only requirement written against that direction. Also logged in `use_cases.md` OQ-3 and `actors.md` OQ-4. | Combined document sections 1.2 and 5 | A Phase 2/3 actor has requirements written for its commercial handling but no use cases describing what it does. |
| OQ-9 | **Which UI and copy source seeds FR-24?** No requirement specifies interface design, screen composition or field-level copy. The VSME field definitions in `moldova-guide/05_indicators.md` and `moldova-guide/04_report_structure.md` — project-knowledge documents outside this seven-document baseline — are named as the design input, but the handover is not a requirement. | Deferred Scope document section 4 | FR-24 is buildable as a mechanism but not as a screen until the field list and copy are drawn from the guide and published as content under FR-61. |

---

*Canonical functional requirements baseline. Consolidates "ESG Platform Functional Requirements (MVP)" and "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)"; use case identifiers `UC-01` … `UC-176` and design decisions `D-1` … `D-14` follow `use_cases.md`; actor definitions follow `actors.md`. Supersedes section 3 (Functional Requirements) of "ESG Platform Actors, Use Cases, FR and NFR (MVP)"; that document's forward-looking actors and external systems are carried into `actors.md`, and its legacy NFR-1 … NFR-13 into `non_functional_requirements.md` §8. Non-functional requirements are not restated here; they are held in `non_functional_requirements.md`.*

