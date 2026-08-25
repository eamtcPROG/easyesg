# ESG Platform — Functional Requirements (MVP)

| Field | Value |
|---|---|
| Document ID | functional_requirements.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | "ESG Platform Functional Requirements (MVP)" (primary); "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)" (primary); "ESG Platform Use Case Register (MVP)" (use case identifiers); "ESG Platform Actors, Use Cases, FR and NFR (MVP)" (superseded legacy FR set; its actors, external systems and legacy NFR-1 … NFR-13 are carried into actors.md and non_functional_requirements.md respectively); "ESG Platform Use Case Design Decisions and Constraints (MVP)" (referenced for `D-n` resolution) |

---

## 1. Purpose and scope

### 1.1 Purpose

This document is the canonical functional requirements specification for the ESG Platform MVP. It consolidates the dedicated Functional Requirements register and its Deferred Scope, Coverage and Traceability companion into a single baseline that a delivery team can design, estimate, build and test against, and that a reviewer can check for coverage in both directions against the use case register.

It restates existing requirements. It introduces none. Every requirement, priority, source use case and design-decision citation below is carried from the source documents; acceptance criteria, where the sources state none, are strict restatements of the requirement itself and add no behaviour.

**Companion documents.** This document is one of seven that make up the consolidated baseline. Each owns its own identifier range, and a citation should be read against the owning document rather than against any pre-consolidation source title:

| Baseline document | Owns |
|---|---|
| `problem_overview.md` | Problem framing, market and monetization models. No requirement identifiers. |
| `actors.md` | Actor definitions and the actor codes `CA`, `RC`, `OA`, `PA`, `BO`, `SYS`. |
| `use_cases.md` | `UC-01` … `UC-176` (MVP) and the design decisions `D-1` … `D-14`. |
| `functional_requirements.md` (this document) | `FR-1` … `FR-173` (MVP), plus the deferred functional scope in §8 whose verbatim IDs collide with `FR-160` … `FR-173` (see OQ-1). |
| `non_functional_requirements.md` | `NFR-1` … `NFR-93` (MVP) and `NFR-94` … `NFR-105` (deferred); the legacy `NFR-1` … `NFR-13` reading key. |
| `architecture.md` | System decomposition, component and interface definitions, and amendments proposed against the registers. |
| `design_spec.md` | Interface and interaction design, screen composition and field-level copy. |

Documents under `moldova-guide/` are project-knowledge references outside this seven-document baseline.

### 1.2 Scope

In scope: the 173 MVP functional requirements FR-1 … FR-173 covering the reporting platform (FR-1 … FR-83), the billing, payment and subscription domain (FR-84 … FR-152), the cross-cutting obligations no single use case owns (FR-153 … FR-159), and notifications (FR-160 … FR-173). The MVP packaging is Model 1 — freemium, direct-to-SME, VSME Basic Module — with three plans: Free, Standard and Enterprise (D-12).

Also in scope, as recorded rather than built scope: the 16 deferred functional requirements at P2, P3 and Roadmap (section 8), which the MVP architecture is required not to block.

Out of scope of this document:

- **Non-functional requirements.** These are held in `non_functional_requirements.md` — `NFR-1` … `NFR-93` at MVP and `NFR-94` … `NFR-105` deferred. The legacy `NFR-1` … `NFR-13` set is retained there in §8 with its reading key. NFRs are cited here wherever a functional requirement exists to satisfy one.
- **Use case narratives.** `UC-01` … `UC-176` are held in `use_cases.md`. This document cites them; it does not restate them.
- **Design decisions.** `D-1` … `D-14` are held in `use_cases.md`.
- **Interface design, screen composition and field-level copy.** Not specified by any requirement here. Screen composition and copy are held in `design_spec.md`. The VSME field definitions that will seed wizard copy sit in `moldova-guide/05_indicators.md` and `moldova-guide/04_report_structure.md` — project-knowledge documents outside this seven-document baseline — and become a design input once FR-24 moves into UI design.
- **Deliberate MVP exclusions with no requirement written against them:** Advisor, Buyer and Licensee capability beyond the generic relationship model; enterprise SSO; tenant MFA; XBRL export; the Comprehensive Module; usage-based pricing; reseller commissions; multi-currency price automation; direct debit and standing-order mandates; virtual cash register and eBon integration; double-entry accounting; and collection on behalf of customers. These are stated in section 4 of the design decisions document. Where a placeholder requirement already existed against one, it appears in section 8; the remainder carry no requirement at all.

### 1.3 Actor codes

Actor codes follow "ESG Platform System Actors (MVP)" as extended by the use case register. No `ACT-*` identifiers appear in any consolidated source; the codes below are the identifiers in use.

| Code | Actor | Scope |
|---|---|---|
| **CA** | Common Access | Any authenticated user. Account, credential and membership actions available to every actor below. |
| **RC** | Reporting Contributor | Creates and edits report content for one or more reporting entities. No access to organization settings, user list or billing screens. |
| **OA** | Organization Administrator | Manages the organization account: legal entity data, identifiers, reporting periods, users and permissions. Does not edit report field data directly. |
| **PA** | Platform Administrator | Maintains platform-wide content and infrastructure across all tenants. No standing access to any organization's report data (D-5). |
| **BO** | Billing Operator | Internal finance role: plan catalogue and pricing, invoice issuance and correction, bank reconciliation, collections, refunds, fiscal reporting. Separated from PA. Recorded in the use case register as a new actor recommended for addition to the System Actors document. |
| **SYS** | System (scheduled / event-driven) | Automated behaviour with no human initiator: recurring charge execution, dunning runs, entitlement evaluation, metering, e-Factura transmission, notification dispatch. |

---

## 2. Requirement conventions

### 2.1 What a functional requirement is here

A functional requirement states an obligation the system must satisfy, expressed as a capability the system provides rather than a goal an actor pursues. It is the complement of a use case: a use case says what someone sets out to achieve and how the interaction unfolds; a requirement says what must be true of the built system for that achievement to be possible.

The two are deliberately not in one-to-one correspondence. One requirement frequently serves several use cases — the entitlement check in FR-99/FR-100 is the same check whether the gated action is inviting a user or generating an export. One use case frequently decomposes into several requirements, because the things that can independently fail, be built or be tested inside one use case are more numerous than the use case itself. Section 9.3 states where this deviation is intentional, so a reader checking coverage by counting rows does not read the difference as a gap.

### 2.2 Identifier scheme

| Prefix | Meaning | Authority |
|---|---|---|
| `FR-n` | Functional requirement | This document, carried from the FR register |
| `UC-n` | Use case | `use_cases.md`, UC-01 … UC-176 |
| `NFR-n` | Non-functional requirement | `non_functional_requirements.md`, NFR-1 … NFR-93 (MVP) and NFR-94 … NFR-105 (deferred); legacy NFR-1 … NFR-13 retained there in §8 |
| `D-n` | Design decision | `use_cases.md`, D-1 … D-14 |

Rules governing identifiers:

1. **FR IDs are a single continuous sequence and are stable.** They are not reused and not renumbered once assigned. Requirements are grouped by domain for reading; the domain is a reading and estimating aid, not a system boundary, and carries no permission meaning.
2. **One deliberate historical breach.** The FR register renumbered from FR-1 and supersedes legacy FR-1 … FR-23 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" in their entirety. The legacy IDs carry different meanings and are still cited in two places — legacy `FR-23` inside UC-148 and legacy `FR-15` inside D-3 — which must be read through the mapping in section 9.5. No further renumbering is permitted.
3. **The ID collision between the two primary sources is resolved by renumbering (18 Aug 2026).** FR-160 … FR-173 were used twice: as MVP notification requirements in the FR register (the later document) and as deferred P2/P3 requirements in the FR Deferred Scope document (the earlier one). **FR-160 … FR-173 mean the MVP notification requirements** in sections 3.30 and 3.31, and the deferred set is renumbered **FR-176 … FR-189** in section 8, above FR-175. Section 8's `Was (source)` column is the permanent mapping, so citations using the source-numbered IDs still resolve. Closes OQ-1.
4. **Actor codes** are CA, RC, OA, PA, BO, SYS as in section 1.3.

### 2.3 Priority scheme

The sources do not use MoSCoW. Priority is expressed as the phase tag that the FR register and the deferred-scope register carry, and no intra-MVP priority ordering is stated by any source. The phase tags are used verbatim; the MoSCoW reading below is a stated mapping for readers who need one, not a per-requirement priority assigned here.

| Phase tag | Meaning | MoSCoW reading |
|---|---|---|
| **MVP** | In MVP build scope. All 173 requirements in section 3 carry this tag. | Must |
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

1. **Acceptance criteria are strict restatements.** Where a source requirement states acceptance conditions, they are carried. Where it does not, the criterion restates the requirement in verification form and introduces no behaviour, threshold, latency, message text or state not already present in the source. Where even a restatement would add nothing beyond the requirement statement, the cell reads `—`.
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

---

## 3. Functional requirements by domain

173 MVP functional requirements across 31 domains. FR-1 … FR-83 cover the reporting platform and its administration, FR-84 … FR-152 the billing, payment and subscription domain, FR-153 … FR-159 the cross-cutting obligations no single use case owns, and FR-160 … FR-173 notifications.

### 3.1 Identity and authentication (FR-1 … FR-8)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-1 | The system shall allow an account to be registered from an email address and password, creating an unverified account record and issuing a verification challenge, and shall make no application data reachable until verification completes. | MVP | Registration precedes any organization; nothing is reachable pre-verification (UC-01). **Note (20 Aug 2026, `architecture.md` OQ-51, OQ-53):** the policy the password is validated against is ≥ 8 and ≤ 128 characters requiring a lowercase letter, an uppercase letter, a digit and one further character; and a registration naming an address that already exists answers `409 Conflict` rather than a uniform response — NFR-64's uniform-response clause is scoped by its own citations to FR-4, FR-6 and FR-11 and does not reach this path. | UC-01 | Registration with email and password creates an unverified account record and issues a verification challenge; no application data is reachable while the account is unverified. |
| FR-2 | The system shall allow an account to be registered through a social identity provider — Google and Microsoft at MVP — requesting only identifier, email and display name scopes, and shall produce the same account record with the provider identity as its credential and no password set. | MVP | D-6: social sign-in is MVP scope; another password is a real barrier at first use for the target user. | UC-02 | Provider registration requests only the three named scopes; the resulting account record is identical in kind to a password registration, holds the provider identity as credential, and has no password set. |
| FR-3 | The system shall verify control of a registered email address through a time-limited link, transitioning the account to active; shall expire unverified accounts after a defined window; and shall treat verification as satisfied where a provider asserts an already-verified address. | MVP | **Note (20 Aug 2026, `architecture.md` OQ-52):** the "defined window" is **7 days**, after which the account record is deleted and the address is registrable again. It is a different object from the link's own lifetime, which is 24 h (§12.5.6). Enforced at the point of use from task 19; the sweep that reclaims the rows lands with the scheduler in Phase 6. **Note (20 Aug 2026, `architecture.md` OQ-55):** because the link's 24 h lifetime is shorter than the account's 7-day window, FR-3 is satisfiable only if a link can be reissued — `POST /api/v1/auth/verification-email` does so, answering uniformly whether or not the address is registered. | UC-03 | Following a valid, unexpired link transitions the account to active; an expired link does not; an unverified account is expired after the defined window; a provider-asserted verified address satisfies verification without a separate email. |
| FR-4 | The system shall authenticate by whichever credential the account holds and issue a session scoped to the user's organization memberships and roles, shall match a provider identity on its subject identifier rather than its email address, and shall rate-limit failed attempts and lock out after a threshold. | MVP | Credential-stuffing protection; matching on subject identifier keeps an account resolvable after the user changes their email at the provider (UC-04, UC-05). | UC-04, UC-05 | A password session and a provider session are identical in scope and lifetime; a provider identity whose email changed still resolves to the same account; failed attempts are rate-limited and the account locks out at the configured threshold. |
| FR-5 | The system shall terminate a session server-side on logout rather than only clearing it client-side, and on re-authentication after expiry shall return the user to the exact screen and record they were on, submitting any locally queued draft changes. | MVP | Reporting is intermittent work; queued changes must not be discarded by an expiry (UC-07). | UC-06, UC-07 | After logout the session token is rejected server-side; after re-authentication the user resumes on the same screen and record, and locally queued draft changes are submitted rather than discarded. |
| FR-6 | The system shall issue a single-use, time-limited password reset link, shall return an identical response whether or not the address is registered, and shall invalidate all existing sessions for the account when the link is consumed. | MVP | The endpoint must not be usable to enumerate accounts; a compromised session must not survive a reset (UC-08, UC-09). | UC-08, UC-09 | The response is byte-identical for a registered and an unregistered address; the link cannot be consumed twice or after expiry; all pre-existing sessions for the account are invalid after consumption. |
| FR-7 | The system shall allow an authenticated user to change their password by supplying the current one, with optional termination of their other active sessions. | MVP | — | UC-10 | A change without the correct current password is refused; where the user elects it, other active sessions are terminated. |
| FR-8 | The system shall allow provider identities to be linked to and unlinked from an existing account, shall require authentication by an existing credential before a link is established, and shall refuse removal of the last remaining credential. | MVP | A provider assertion alone must never be an account-takeover path (UC-11); an account with no usable credential is unrecoverable and takes its memberships down with it (UC-12). | UC-11, UC-12 | A link cannot be established on a provider assertion alone; after linking, either credential authenticates; removal of the last remaining credential is refused. |

### 3.2 Profile and membership (FR-9 … FR-12)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-9 | The system shall maintain a personal profile — display name, contact email, notification preferences — held independently of any organization the user belongs to. The per-category structure of those preferences is specified in FR-163. | MVP | One account may hold roles in several organizations, so profile data is personal to the user (UC-13). | UC-13, UC-168 | Profile values persist against the user and are unchanged by switching active organization; notification preferences conform to FR-163. |
| FR-10 | The system shall persist a per-user interface language across devices and sessions, falling back per string to the default locale where a translation is absent and recording each fallback. | MVP | Localization is not hardcoded to two languages (NFR-4); gaps become a maintained queue rather than a user complaint (UC-74). **Note (19 Aug 2026, architecture.md OQ-43):** for catalogue text the fallback path is unreachable by construction — FR-64's parity gate fails the build before a gap can ship. It remains live for FR-61 content. | UC-14 | The selected language applies on every subsequent login and device; a string with no translation renders in the default locale and the fallback is recorded per FR-64. |
| FR-11 | The system shall accept an organization invitation bound to the invited email address, single-use and expiring, granting the assigned edit or view-only role on acceptance. | MVP | Binding to the invited address is what stops a social sign-in for a different address from consuming the invitation (UC-15). | UC-15 | An invitation is accepted only for the invited address, only once, and only before expiry; on acceptance the assigned role is granted scoped to that organization. |
| FR-12 | The system shall support multiple organization memberships per account with an active-organization selection that scopes all subsequent data access, permissions and screens. | MVP | The organization-relationship model is built generically from day one (NFR-9), even though most users will hold one membership (UC-16). | UC-16 | With two memberships, switching the active organization changes the data, permissions and screens in scope to those of the selected organization only. |

### 3.3 Organization (FR-13 … FR-16)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-13 | The system shall allow an organization to be created from a verified account and shall automatically grant the creating user the Organization Administrator role over it. | MVP | D-1: the founding user is an Organization Administrator, not a Reporting Contributor; a pure Contributor arises only by invitation. | UC-49 | Creation from a verified account succeeds and the creating user holds Organization Administrator over the new organization; creation from an unverified account is not available. |
| FR-14 | The system shall model organizations with typed parent, child and peer relationships to other organizations, with only the direct SME organization type active at MVP, so that Advisor, Buyer and Licensee types can be added without a schema change. | MVP | NFR-9: the relationship model must accept the Phase 2/3 actor types without a schema migration. | UC-49 | The relationship model stores a type on each relationship; adding a further organization type requires configuration or data only, with no change to the schema. |
| FR-15 | The system shall maintain the organization's legal form, registered name, registered address and contact details, with every change attributed and timestamped. | MVP | These values propagate into every report the organization produces (UC-50). | UC-50 | Each field is editable by the Organization Administrator, and each change records the acting user and a timestamp. |
| FR-16 | The system shall maintain entity identifiers with **IDNO as primary** and **LEI as an optional additional identifier**, validating format and checksum on entry. **Amended 18 Aug 2026** — see `architecture.md` §18 OQ-18: IDNO is universal, free and already the `billing` context's identifier, so it is the only candidate populated for every organization at signup, whereas LEI carries an annual fee and is held by very few Moldovan SMEs. LEI is retained as an optional field so B1 stays VSME-conformant for banks and EU buyers who require one. DUNS, EU ID and PermID are not modelled at MVP. | MVP | An identifier that fails validation downstream in EFRAG's own tooling is expensive to discover at filing time (UC-51). | UC-51 | An LEI may be recorded as primary and a DUNS, EU ID or PermID as fallback; an identifier failing format or checksum validation is rejected at entry. |

### 3.4 Entity and period (FR-17 … FR-23)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-17 | The system shall allow reporting entities to be created and edited with legal form, NACE code(s) and site locations, permitting more than one entity per organization. | MVP | Most SMEs hold one entity; the model does not assume it (UC-52). | UC-52, UC-53 | An entity is created with legal form, NACE code(s) and site locations, and edited thereafter; a second entity can be created in the same organization. |
| FR-18 | The system shall retain entity master data point-in-time, so that a report for a closed period continues to reflect the values in force when it was prepared. | MVP | A later correction must not retroactively alter a distributed report (UC-53). | UC-53 | After master data is changed, a report for a previously closed period still renders the values in force at the time of preparation. |
| FR-19 | The system shall record an entity's consolidation basis and, where consolidated, the subsidiaries inside the reporting boundary, feeding B1 and bounding every quantitative figure in the report. | MVP | The consolidation scope determines the boundary against which every quantitative figure must be gathered (UC-54). | UC-54 | Individual or consolidated basis is recorded; where consolidated, the in-boundary subsidiaries are recorded and reflected in B1. |
| FR-20 | The system shall allow a reporting entity to be archived, removing it from active selection while retaining its historical reports and exports intact. | MVP | Prior filings must remain retrievable after an entity is sold, merged or dissolved (UC-55). | UC-55 | An archived entity does not appear in active selection; its historical reports and exports remain retrievable unchanged. |
| FR-21 | The system shall allow a reporting period to be opened for an entity with fiscal year and start and end dates, pinning the current template and taxonomy version and linking the immediately preceding period, and shall record an optional due date by which the report must be complete, distinct from the period end. | MVP | NFR-3 version pinning; the linked prior period is what makes comparatives resolve automatically; the due date is what deadline notices count down to (UC-56). | UC-56 | Opening a period records fiscal year and dates, pins the current template and taxonomy version, links the preceding period where one exists, and accepts a due date distinct from the period end. |
| FR-22 | The system shall allow a reporting period to be locked to read-only for Reporting Contributors, and reopened with acting user, timestamp and stated reason recorded. | MVP | Locking is what makes a published figure stable and gives the change history a defensible endpoint; a post-publication amendment must be visible as an amendment (UC-57, UC-58). | UC-57, UC-58 | While locked, a Reporting Contributor cannot edit the report; reopening requires a stated reason and records acting user and timestamp. |
| FR-23 | The system shall present an organization-wide overview of every entity and period with completion and validation status in a single view. | MVP | For a multi-entity organization this is the only place "is everything ready before the deadline" is answerable without opening each report (UC-67). | UC-67 | The overview lists every entity and period in the organization with its completion and validation status, without opening individual reports. |

### 3.5 Report authoring (FR-24 … FR-32, FR-177)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-24 | The system shall provide a guided stepped wizard covering all VSME Basic Module fields B1–B11, entered at the first incomplete step, capturing structured and narrative content for a module together. | MVP | Narrative and quantitative content are captured together so a figure can be explained in context (UC-25). | UC-18, UC-19 … UC-29 (**UC-20** named explicitly — B2 is the one narrative module in the range; OQ-4) | All B1–B11 fields are reachable through the wizard; opening a report enters at the first incomplete step; a module's structured and narrative content are captured in the same step. |
| FR-25 | The system shall list the reporting entities and periods accessible to the user with completion and validation summary, reflecting per-report permissions so that a view-only member sees the same entries without edit affordances. | MVP | — | UC-17 | The list shows each accessible entity and period with completion and validation summary; a view-only member sees the same entries and no edit affordances. |
| FR-26 | The system shall grant an editable session only where the reporting period is open and the user holds edit rather than view-only rights. | MVP | — | UC-18 | An editable session is refused where the period is locked, and where the user holds view-only rights. |
| FR-27 | The system shall pre-populate B1 from the entity master record while leaving the values editable in-report. | MVP | D-2: B1 is a disclosure, not master data; entity master data is Organization Administrator-owned, disclosure content is Contributor-owned. | UC-19 | B1 fields open pre-populated from the entity master record and remain editable in-report; editing them in-report does not alter the master record. |
| FR-28 | The system shall evaluate conditional applicability dynamically from B1 inputs — the ≥50-employee turnover threshold, the ≥150-employee gender pay gap threshold, site-driven biodiversity applicability and sector-driven water relevance — showing or hiding fields rather than presenting and later rejecting them. | MVP | Thresholds move with the standard and with Moldova's transposing legislation, so they are configuration (FR-72). | UC-19, UC-23, UC-24, UC-26, UC-28 | Changing the B1 employee headcount across each threshold shows or hides the dependent field without a reload; a hidden field is never presented and then rejected on submission. |
| FR-29 | The system shall capture quantitative disclosures in the units the standard requires — MWh, tCO₂e, m³, headcount and FTE, hazardous and non-hazardous split, headcount by contract type, gender and country — and shall derive the intensity figures the standard specifies. | MVP | — | UC-21, UC-22, UC-24, UC-25, UC-26, UC-28 | Each named quantity is captured in the stated unit, and the specified intensity figures are derived rather than typed. |
| FR-30 | The system shall record a nil or zero return as an affirmative disclosure, stored and rendered distinctly from an unanswered field. | MVP | Zero is an affirmative, reportable value in B9 and B11 (UC-27, UC-29). | UC-27, UC-29 | A recorded zero is distinguishable in storage and in rendering from a field never answered. |
| FR-31 | The system shall allow a section to be declared not material or not applicable with a recorded rationale, satisfying validation rather than suppressing it and carrying the declaration into both export formats. | MVP | A reader must see a reasoned exclusion instead of an unexplained gap (UC-30). | UC-30 | A declared section requires a rationale, reports as satisfied rather than suppressed in validation, and the declaration with its rationale appears in both the PDF and the Excel template export. |
| FR-32 | The system shall allow an individual field to be declared not available with a stated reason, as a first-class terminal state distinct from `MISSING VALUE`. | MVP | D-4: every reference report reviewed discloses gaps explicitly, so a declared, explained gap is a valid terminal state. | UC-31 | The declaration requires a reason and resolves the field to a terminal state that validation reports separately from `MISSING VALUE`. |
| FR-177 | The system shall support the VSME **Comprehensive Module (C1–C9)** as an additive extension of Basic — authored through the same guided wizard as FR-24, driven by D-A's report-level scope flag, and permitted to be added to a report already in progress. | MVP | **Promoted from §8 on 25 Aug 2026** (`problem_overview.md` OQ-12, project owner). Keeps its deferred-range identifier because FR numbers are cited across the doc set, so it is annotated in both places rather than renumbered. The original deferral rationale survives as the implementation argument: the schema already mirrors C1–C9 (FR-155, NFR-2), so this is additive rather than a rework. | UC-183 … UC-192 | The nine Comprehensive disclosures are authorable in all three locales; the scope flag is settable at creation **and** on a report in progress; conditional applicability, validation and both export formats treat C1–C9 by the same mechanisms as B1–B11 (FR-27 … FR-32), not by parallel ones. |

### 3.6 Carbon calculator (FR-33 … FR-36)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-33 | The system shall record energy and fuel consumption by source and by site in the units of the company's own invoices, retaining raw inputs permanently alongside every derived figure so that a calculation can be retraced. | MVP | A future assurance reviewer must be able to retrace the calculation (UC-32). | UC-32 | Consumption is entered per source and per site in invoice units; after calculation the raw inputs remain retrievable alongside each derived figure. |
| FR-34 | The system shall convert entered consumption to MWh, apply the active emission factor set, and compute Scope 1, location-based Scope 2 and GHG intensity in tCO₂e, writing the results into the B3 fields. | MVP | — | UC-33 | Given consumption inputs, the system produces Scope 1, location-based Scope 2 and GHG intensity in tCO₂e from MWh-converted values, and the results appear in the B3 fields. |
| FR-35 | The system shall store the emission factor set version against every computed result, so that a later factor update never silently restates a figure already reported. | MVP | A factor update must not restate a filed report (UC-33, UC-80). | UC-33 | Every computed result carries the factor set version used; after a new factor set is published, existing results are unchanged. |
| FR-36 | The system shall allow a computed value to be annotated or replaced by an externally calculated figure, flagging and attributing the override and retaining the superseded computed value. | MVP | The report must never present an unexplained substitution (UC-34). | UC-34 | An override is stored with a flag and the acting user, and the superseded computed value remains retrievable. |

### 3.7 Draft persistence (FR-37 … FR-39)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-37 | The system shall persist each field change automatically on blur or step change with no explicit save action. | MVP | — | UC-35 | A field change is persisted on blur and on step change without any save action by the user. |
| FR-38 | The system shall queue changes locally and retry when the network is unavailable, warning the user while anything remains unsynced. | MVP | Autosave working and offline queuing working are different guarantees with different failure modes (coverage note, section 9.3). | UC-35 | With the network unavailable, changes are queued locally, the user is warned while anything is unsynced, and the queue is submitted on reconnection. |
| FR-39 | The system shall restore a returning user to their previous state — field values, wizard position, validation flags — regardless of the device or session in which the work was left. | MVP | Reporting for an SME is intermittent work spread over weeks, so lossless resumption is a core requirement rather than a convenience (UC-36). | UC-36 | Resuming on a different device or in a new session restores field values, wizard position and validation flags as left. |

### 3.8 Validation (FR-40 … FR-44)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-40 | The system shall expose per-field validation state among `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL`, plus the declared-not-available state, inline at the point of entry rather than only in a separate report. | MVP | EFRAG's five validation states; the XBRL taxonomy does not itself enforce them (legacy FR-5). | UC-37 | Each field displays one of the five states or the declared-not-available state of FR-32, shown inline at the point of entry. |
| FR-41 | The system shall roll validation state up per module and across the whole report, discounting sections declared not material so that a legitimate exclusion does not depress completion. | MVP | A legitimately excluded module must not depress the completion figure (UC-38). | UC-38 | Module-level and report-level states are derived from field states; a section declared not material under FR-31 does not reduce the completion figure. |
| FR-42 | The system shall allow navigation from any validation finding directly to the affected field, focused, with the rule explanation shown. | MVP | Keeps a long report navigable without hunting through eleven modules (UC-39). | UC-39 | Selecting a finding moves focus to the field that produced it and displays the rule explanation. |
| FR-43 | The system shall re-run validation idempotently at any level of completeness, so that it functions as a working tool during drafting and not only as a pre-export gate. | MVP | — | UC-40 | Validation can be run on an incomplete report; repeated runs over unchanged data produce identical results. |
| FR-44 | The system shall permit export with unresolved findings after an explicit warning, marking the gaps visibly in the output rather than omitting them silently. | MVP | — | UC-42 | Export with unresolved findings proceeds only after an explicit warning, and the resulting output marks the gaps visibly. |

### 3.9 Comparatives (FR-45 … FR-47)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-45 | The system shall store multiple reporting periods per entity and resolve the prior period automatically from the period linkage. | MVP | D-3: comparatives are MVP for storage and inline display because the multi-period data model is already an MVP requirement (NFR-3) and comparatives become mandatory in the second reporting year. | UC-45, UC-56 | With two periods recorded for one entity, the prior period resolves from the linkage recorded under FR-21 without manual selection. |
| FR-46 | The system shall display the prior-period value alongside the current input at the point of entry, so that an implausible year-over-year movement is visible while it can still be checked. | MVP | D-3. | UC-45 | Where a prior period exists, each field displays the prior-period value next to the current input. |
| FR-47 | The system shall allow a prior-period value to be carried forward into the current period, marking it as carried forward so that it is reviewed rather than accumulating unnoticed. | MVP | Carried-forward values must be reviewable rather than accumulating unnoticed across years (UC-46). | UC-46 | A carried-forward value is copied into the current period and is identifiable as carried forward. |

### 3.10 Export (FR-48 … FR-53)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-48 | The system shall render a preview of the fully assembled report — narrative, indicator tables, comparatives — as it will appear when exported, without generating a file. | MVP | Catches presentation problems before anything leaves the platform (UC-41). | UC-41 | The preview shows narrative, indicator tables and comparatives as they will appear on export, and produces no file. |
| FR-49 | The system shall generate a formatted, publication-ready PDF from stored data in the selected export language. | MVP | — | UC-42 | A PDF is generated from stored report data in the language selected under FR-52. |
| FR-50 | The system shall write stored values into the named ranges of the official EFRAG Excel Digital Template at the version pinned to the report, preserving the template's own dropdowns and consistency-check formulas. | MVP | The EFRAG template is the canonical export target (external systems, MVP). | UC-43 | Values land in the correct named ranges of the pinned template version, and the template's dropdowns and consistency-check formulas remain functional in the output file. |
| FR-51 | Where a report is pinned to a superseded version, the system shall prompt migration or export against the original version with an explicit notice, and shall never silently export against a version the report was not prepared under. | MVP | NFR-3; the February 2026 taxonomy release contained a backwards-incompatible change (UC-76). | UC-43, UC-78 | Exporting a report pinned to a superseded version offers migration or export against the original version with an explicit notice; no path exports against a different version without notice. |
| FR-52 | The system shall allow the export language to be selected independently of the user's interface language. | MVP | A Moldovan SME frequently works in Romanian but must deliver an English report to a foreign buyer or bank (UC-48). | UC-48 | The export language can be set to a value different from the interface language, and the export honours it. |
| FR-53 | The system shall maintain an immutable export history recording format, language, taxonomy version, timestamp and generating user, and shall allow any prior export to be re-downloaded in exactly the form it was distributed. | MVP | A filed or circulated document must remain retrievable unchanged even after the underlying data has moved on (UC-44). | UC-44 | Each export is recorded with the five attributes and cannot be altered; re-downloading a prior export returns the original file byte-for-byte after the underlying data has changed. |

### 3.11 Traceability (FR-54 … FR-55)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-54 | The system shall record, per field, who changed a value, when, and what the previous value was. | MVP | NFR-7: attribution supports a future limited-assurance review, and retrofitting it later is not possible (UC-47). | UC-47 | For any disclosure field, the history shows acting user, timestamp and previous value for each change. |
| FR-55 | The system shall retain historical attribution after a user's access to the organization is removed, so that revoking access never erases the audit trail. | MVP | Removing access must not erase the audit trail (UC-63). | UC-47, UC-63 | After a member is removed under FR-59, their historical changes remain attributed in the change history. |

### 3.12 Users and access (FR-56 … FR-60)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-56 | The system shall list every user with access to the organization, their role, status — active or pending invitation — and last activity. | MVP | This is the single place "who can see our ESG data" is answerable (UC-59). | UC-59 | The list shows each member and each pending invitation with role, status and last activity. |
| FR-57 | The system shall allow a user to be invited by email with an edit or view-only role, an unacted invitation to be resent, and an invitation to be revoked, with revocation invalidating the outstanding link immediately. | MVP | Inviting beyond the plan's seat entitlement triggers the quota path (UC-150); a capped number of users is included on Free because gating collaboration entirely would block the primary workflow (UC-60). **Note (25 Aug 2026, `architecture.md` §12.5.6, task 26.1):** "a resend delivers the same invitation" is satisfied by the invitation *record* — a resend rotates the token and restarts the seven-day window, leaving exactly one live link per invitation; and an address already held by an active member or by a live pending invitation is refused rather than invited twice. | UC-60, UC-61 | An invitation is issued with the assigned role; a resend delivers the same invitation; after revocation the outstanding link is refused immediately. |
| FR-58 | The system shall allow an existing member's role to be changed, taking effect on that user's next request rather than at their next login. | MVP | A downgrade must be immediate (UC-62). | UC-62 | After a role change, the member's next request is evaluated under the new role without re-authentication. |
| FR-59 | The system shall allow a member's access to the organization to be removed without deleting their account or their historical contributions. | MVP | The account continues to exist and contributions remain attributed (UC-63); see FR-55. | UC-63 | After removal the user cannot access the organization; their account and their attributed history persist. |
| FR-60 | The system shall allow another member to be promoted to Organization Administrator, so that the departure of a sole administrator cannot lock an organization out of its own settings. | MVP | Exists at MVP specifically to avoid the single-admin lockout scenario (UC-64). | UC-64 | An Organization Administrator can promote another member, after which that member holds administrator rights over the organization. |

### 3.13 Localization and content (FR-61 … FR-64)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-61 | The system shall hold help-centre articles and plan presentation copy as versioned data editable through an administrative console, so that a wording correction by support or marketing reaches users without a release. | MVP | NFR-12: a content change by someone who cannot deploy must not wait on a release. **Amended 19 Aug 2026** (architecture.md OQ-43), with the i18n wiring: the wording of field labels, help text, validation messages and notification templates ships as committed message catalogues in the release, not as configuration. What remains versioned configuration is the text edited by people who cannot deploy — help-centre articles and plan presentation copy — together with every non-text configuration artefact (rule definitions, thresholds, factor sets, effective dates, notification channels, lead times and repeat intervals), which is untouched. The line is who is blocked waiting on a release: a developer editing a catalogue file is not blocked, support fixing a help article is. | UC-71 | A help-centre article or plan description is edited in the console and, once published, reaches users with no deployment. |
| FR-62 | The system shall publish a reviewed set of the content held under FR-61 as an explicit, versioned and reversible step taking effect across all tenants at once, so that a half-finished translation is never live. | MVP | Publishing is an explicit step rather than a side effect of editing (UC-72). **Amended 19 Aug 2026 (architecture.md OQ-43):** scope follows FR-61 as narrowed. Catalogue wording is published by deploying the release that contains it; a half-finished catalogue is prevented at build time by the key-parity gate rather than by a publication step. | UC-72 | Edits are not live until published; publication applies across all tenants at once and can be reverted to the prior version. |
| FR-63 | The system shall allow an additional interface and export locale to be registered and populated without redesigning any screen, route or schema, with **Romanian (source), English and Russian live at MVP** — each separately authored, never machine-translated — and no architectural limit. | MVP | NFR-4: EFRAG's own template ships in eleven languages. **Amended 19 Aug 2026 (architecture.md OQ-43):** a new locale is a catalogue file plus a build, not a pure configuration task. What NFR-4 protects is preserved and is the property that mattered — no architectural limit, no per-locale code path, no schema change, no route change; `apps/web`'s `[locale]` segment and `packages/i18n`'s registry are locale-count agnostic. | UC-73 | A locale is added by authoring its catalogue and rebuilding, with no schema change, no route change and no per-locale branch in application code, and becomes selectable for interface and export. |
| FR-64 | The system shall prevent an untranslated key from reaching a user, by a build-time parity gate for catalogue text and a reviewable runtime fallback queue for the content held under FR-61. | MVP | Turns localization gaps from user-reported complaints into a maintained work queue (UC-74). **Amended 19 Aug 2026 (architecture.md OQ-43):** for catalogue text the gap is now detectable before release — every locale's catalogue is present at build time, so a key absent from one fails CI. That is strictly stronger than a runtime queue, because the gap never ships. The runtime queue remains for FR-61 content, where a translation genuinely is absent until someone authors it. | UC-14, UC-74 | A key present in the source-locale catalogue and absent from another fails the build; a runtime fallback in FR-61 content adds its key to the reviewable queue. |

### 3.14 Taxonomy and versioning (FR-65 … FR-70)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-65 | The system shall allow a new VSME Digital Template or XBRL taxonomy version to be registered with its artefact and an explicit backwards-compatibility determination, pinned by periods opened from that point forward. | MVP | NFR-3; the taxonomy carried a backwards-incompatible change in February 2026. | UC-75 | Registration accepts the artefact and a compatibility determination; periods opened afterwards pin to the new version and periods already open do not. |
| FR-66 | The system shall store an explicit template and taxonomy version against every report. | MVP | NFR-3: historic reports can be re-exported or migrated against newer releases. | UC-56, UC-75 | Every report exposes the template and taxonomy version it is pinned to. |
| FR-67 | The system shall allow the field mapping between an outgoing and an incoming version to be authored deliberately, covering added, removed and semantically altered fields. | MVP | No automatic mapping would have resolved the February 2026 breaking change correctly (UC-76). | UC-76 | A mapping is authored per field pair and distinguishes added, removed and semantically altered fields; it is the input consumed by FR-69. |
| FR-68 | The system shall list every report still pinned to a superseded version, grouped by organization and by version, as the exposure view preceding any migration. | MVP | Answers how many customers would be affected before any migration is attempted (UC-77). | UC-77 | The list shows all reports on superseded versions grouped by organization and by version. |
| FR-69 | The system shall execute a migration run against a selected set of reports, in bulk for a compatible change or report-by-report with manual review for a breaking one, preserving the pre-migration state rather than overwriting in place. | MVP | Migration is a versioned transformation, never an in-place overwrite (UC-78). | UC-78 | A run over a selected set applies the FR-67 mapping; a breaking change requires per-report review; the pre-migration state remains retrievable after the run. |
| FR-70 | The system shall notify organizations whose reports were migrated or now require re-export, rather than leaving them to discover it at export time, dispatched per FR-166 rather than shown as an in-product banner alone. | MVP | Users must be told in the product rather than discovering it when an export behaves unexpectedly (UC-79). | UC-79, UC-171 | Following a migration run, affected organizations receive a notice through the FR-160 … FR-171 mechanism naming the change. |

### 3.15 Rules and factors (FR-71 … FR-74)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-71 | The system shall maintain versioned, effective-dated emission and conversion factor sets as data. | MVP | Existing results retain the factor version they were computed under (FR-35, UC-80). | UC-80 | A new factor set is added with a version and effective date without a deployment; the calculator uses the active set and FR-35 records which was used. |
| FR-72 | The system shall maintain conditional-applicability thresholds as configuration rather than code. | MVP | NFR-12: thresholds move with the standard and with Moldova's transposing legislation (UC-81). | UC-81 | A threshold value is changed in configuration and FR-28 evaluates against the new value without a deployment. |
| FR-73 | The system shall maintain validation rule definitions and the message each fires as configuration, separately from applicability thresholds. | MVP | One decides whether a field applies, the other whether a supplied value is coherent (UC-82). | UC-82 | A validation rule and its message are edited in configuration and take effect without a deployment, independently of the FR-72 thresholds. |
| FR-74 | The system shall apply content-only and rule-only changes without a redeploy, supporting a quarterly regulatory-watch cadence. | MVP | NFR-12. | UC-71, UC-81, UC-82 | A content change, a threshold change and a validation rule change each reach users with no deployment. |

### 3.16 Platform administration (FR-75 … FR-83)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-75 | The system shall authenticate Platform Administrators through a separate administrative surface with multi-factor authentication mandatory, holding elevated credentials apart from ordinary tenant accounts. | MVP | The role has cross-organization visibility that a compromised password must not expose (UC-68). | UC-68 | Administrative authentication occurs on a separate surface, requires a second factor without exception, and does not accept ordinary tenant credentials. |
| FR-76 | The system shall provide a searchable register of all organizations exposing account-level metadata — registration date, entity count, plan, activity — and shall never expose report content. | MVP | D-5: supports support triage and operational oversight while holding the access boundary. | UC-69 | The register is searchable and shows the named metadata; no report content is reachable from it. |
| FR-77 | The system shall grant no standing Platform Administrator access to any organization's report data at any point. | MVP | D-5. | UC-69, UC-85 | No Platform Administrator role or path reaches tenant report data other than through a live grant issued under FR-78. |
| FR-78 | The system shall issue scoped, time-limited support-access grants requiring a stated reason and ticket reference, expiring automatically without administrator action. | MVP | D-5. | UC-85 | A grant requires reason and ticket reference, is limited to the named organization, and ceases to permit access at expiry with no action taken. |
| FR-79 | The system shall maintain a support-access audit log recording requester, organization, reason and what was accessed, reviewable but not editable from within the administrative console. | MVP | It is exactly this role's privilege that most needs restraining (UC-86). | UC-86 | Every grant and access is logged with the four attributes; the console offers no means to edit or delete an entry. |
| FR-80 | The system shall allow platform administrator accounts to be created, modified and deactivated with separable privilege levels, so that content, operations and support functions do not require one another's rights. | MVP | A translator does not require the privileges of a taxonomy migration operator (UC-87). | UC-87 | An administrator can be granted content rights without operations or support rights, and each account can be deactivated. |
| FR-81 | The system shall maintain a platform-wide system audit log of version rollouts, content publications, migration runs, factor-set updates and administrator account changes. | MVP | The operational counterpart to the per-report change history; makes a platform-side change explicable after the fact (UC-88). | UC-88 | Each of the five event classes appears in the log, attributed and timestamped. |
| FR-82 | The system shall allow social identity providers to be registered, enabled, disabled and have their credentials rotated without a redeploy, with disabling stopping new registrations while leaving existing accounts able to authenticate by another credential. | MVP | Keeps an expiring or leaked client secret from becoming a platform-wide outage; a provider can be withdrawn without stranding users (UC-70). | UC-70 | Credentials are rotated with no deployment; after disabling a provider, new registrations and links through it are refused while existing accounts still authenticate by another credential. |
| FR-83 | The system shall provide an adoption and usage dashboard covering the defined MVP success metrics — SMEs completing a full report, exports by format, average completion time, export-usage rate — filterable by period and segment, marking low-volume figures as low-confidence, and exportable for stakeholder reporting. | MVP | The Phase 2 monetization decision is demand-driven and this export is the evidence it rests on (UC-84). | UC-83, UC-84 | The four metrics are shown, filterable by period and segment; figures below the volume threshold are marked low-confidence; the set is exportable. |

### 3.17 Plan catalogue (FR-84 … FR-89)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-84 | The system shall model a subscription plan as a first-class versioned record rather than a constant in code. | MVP | Pricing and packaging will change more often than the compliance core (UC-89). | UC-89 | A plan is created, described and versioned as data, with no code change required. |
| FR-85 | The system shall hold plan entitlements and quotas as declarative data — entities, seats, reports per period, exports by format, API allowance, module access, support tier — consumed by the entitlement service, so that a new gated capability means a new entitlement key rather than new plan logic. | MVP | D-12 plan structure; NFR-10 multi-unit entitlement. | UC-90 | Each named entitlement is set per plan version as data; adding a further entitlement key requires no change to plan logic and is honoured by the FR-99 service. |
| FR-86 | The system shall allow prices to be authored per plan version, per currency and per billing cycle rather than converted at display time. | MVP | D-14: an annual MDL price is a deliberate commercial decision, not an artefact of an exchange rate on the day. | UC-91 | A price exists per plan version, currency and cycle combination; no price is derived by conversion at display time. |
| FR-87 | The system shall version a plan on any price or entitlement change with an explicit grandfathering choice, every subscription referencing the exact plan version it was sold under. | MVP | A price rise must never silently restate an in-force agreement (UC-92). | UC-92 | A price or entitlement change produces a new plan version and requires a grandfathering choice; existing subscriptions continue to reference their original version. |
| FR-88 | The system shall allow a plan to be published for new purchase and retired, with retirement closing the plan to new subscriptions while leaving existing subscribers on it until they change or renew. | MVP | A withdrawn plan must not terminate anyone's service (UC-93). | UC-93 | An unpublished plan is not purchasable; after retirement no new subscription can be created on it and existing subscribers remain on it. |
| FR-89 | The system shall allow discount codes and trial terms to be defined per plan version — percentage or fixed, first-period or recurring, validity dates, redemption limits, plan eligibility, trial length, payment-instrument requirement and expiry behaviour. | MVP | Early adoption of voluntary sustainability reporting will need commercial incentives, and issuing one should not require a release (UC-94); trial terms are per plan version so an offer can be withdrawn without affecting existing customers (UC-95). | UC-94, UC-95 | Each named attribute is settable per plan version without a release; trial terms attach to the plan version rather than to the plan. |

### 3.18 Subscription (FR-90 … FR-98)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-90 | The system shall expose the subscription state machine — trialling, active, past due, suspended, cancelled, lapsed — to the Organization Administrator together with the plan version in force, entitlements granted, billing cycle, renewal or expiry date and next amount due. | MVP | "Past due" and "suspended" have different consequences and a customer must be able to tell which they are in (UC-106). | UC-65, UC-106 | The current state is one of the six named values and is displayed together with each named attribute. |
| FR-91 | The system shall present published plans side by side with entitlements, quotas and price per cycle, and shall show which limits the organization's actual consumption would exceed on each. | MVP | Comparing against actual consumption turns a pricing page into a decision the Administrator can make without contacting sales (UC-96). | UC-96 | The comparison lists each published plan with entitlements, quotas and price per cycle, and flags the limits current consumption would exceed. |
| FR-92 | The system shall start a paid subscription through an order, changing entitlements only on confirmed payment or, for approved bank transfer terms, on invoice issuance, and never on order creation. | MVP | An unpaid attempt must leave no orphaned subscription (UC-110, UC-97). | UC-97 | Creating an order grants no entitlement; entitlements change on confirmed payment, or on invoice issuance where bank transfer terms are approved. |
| FR-93 | The system shall activate a trial where the plan version offers one, granting full paid entitlements with a known expiry and notifying the Administrator before it ends. | MVP | The Administrator must not discover the change when a feature stops working (UC-98). | UC-98 | A trial grants the paid entitlements of the plan version, records an expiry, and raises a notice before expiry through the FR-160 mechanism. |
| FR-94 | The system shall apply an upgrade immediately with the unused remainder of the current period credited on a prorated basis, and a downgrade at the end of the paid period with advance disclosure of exactly which entities, seats and features will become read-only. | MVP | Upgrades are immediate because the Administrator is usually upgrading precisely because they are blocked (UC-100); D-13 governs the downgrade treatment. | UC-100, UC-101 | An upgrade takes effect at once with a prorated credit for the unused remainder; a downgrade takes effect at period end and the affected entities, seats and features are shown before confirmation. |
| FR-95 | The system shall allow the billing cycle to be changed effective at the next renewal, re-evaluating payment rail availability against the new total. | MVP | An annual total commonly exceeds the MIA per-transaction ceiling (D-8). | UC-99 | A cycle change takes effect at the next renewal with that cycle's price, and rail availability is re-evaluated against the new total per FR-110. |
| FR-96 | The system shall allow billable units to be added or removed mid-cycle, prorating additions to the period end and applying removals to the following period rather than as a mid-cycle refund. | MVP | — | UC-102 | An addition is prorated to the period end and charged on the next invoice; a removal reduces the following period and generates no mid-cycle refund. |
| FR-97 | The system shall allow auto-renewal to be controlled, cancellation to take effect at the close of the paid period rather than immediately, and a cancelled, lapsed or suspended subscription to be reactivated, with read-only entities and reports returning to editable on restoration of entitlement. | MVP | The customer has already paid for the period and their report deadline may fall inside it (UC-104); auto-renewal, cancellation and reactivation are three transitions of one state machine (section 9.3). | UC-103, UC-104, UC-105 | Disabling auto-renewal schedules a lapse rather than a cut-off; cancellation leaves service unchanged until period close; reactivation restores entitlements and returns read-only entities and reports to editable. |
| FR-98 | The system shall maintain a subscription change history covering every upgrade, downgrade, cycle change, plan version migration, cancellation and reactivation with date, acting user and resulting entitlements. | MVP | This is the record that settles a billing dispute without recourse to support (UC-107). | UC-107 | Each of the six change classes appears in the history with date, acting user and resulting entitlements. |

### 3.19 Entitlement and metering (FR-99 … FR-105)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-99 | The system shall answer every gated action through a central entitlement service returning allow, deny or allow-with-warning. | MVP | Legacy FR-23, cited in UC-148; split per section 9.5. | UC-148 | Every gated action resolves through the one service, and the service returns exactly one of the three outcomes. |
| FR-100 | The system shall hold gating logic outside the gated capability, so that a new plan or a changed quota never requires a change to the feature being gated. | MVP | Legacy FR-23; D-11 bounded-context separation. | UC-148 | Adding a plan or changing a quota alters no code in any gated feature. |
| FR-101 | The system shall notify the Organization Administrator as consumption approaches an entitlement ceiling, before the limit is reached. | MVP | Warning ahead of the wall makes an upgrade a considered decision rather than a hostage situation at a reporting deadline (UC-149). | UC-149 | As consumption of a metered entitlement nears its ceiling, a notice is raised through the FR-160 mechanism before the limit is reached. |
| FR-102 | On a quota-exceeded action the system shall block it, state which limit was reached and what the current plan allows, offer the upgrade path, and shall never discard reporting work in progress or prevent a started report from being finished and exported. | MVP | Reporting work already in progress is never lost to a quota block (UC-150). | UC-150 | The blocked action reports the limit reached, the current plan allowance and the upgrade path; work in progress is retained; a started report can still be completed and exported. |
| FR-103 | The system shall select which entities and reports fall outside a reduced entitlement by a deterministic, published rule — most recently active retained — and shall show the outcome to the customer before the change takes effect. | MVP | The rule must be deterministic and published rather than arbitrary (UC-151); disclosure before the change per UC-101. | UC-151 | Given the same data the selection is reproducible and retains the most recently active; the outcome is displayed before the change takes effect. |
| FR-104 | The system shall delete no disclosure content on lapse, downgrade, suspension or entitlement reversal, moving out-of-entitlement content to read-only and leaving previously generated documents downloadable throughout. | MVP | D-13: sustainability records are the customer's own regulatory records; holding them hostage is commercially self-defeating and legally exposed. | UC-142, UC-151 | After each of the four events, disclosure content still exists, out-of-entitlement content is read-only, and previously generated documents remain downloadable. |
| FR-105 | The system shall emit an append-only metering event carrying organization, action type, quantity and timestamp for every billable-shaped action, including actions not currently billed, and shall serve organization usage counters, quota evaluation and adoption metrics from that single stream, presenting consumption against the entitlement limit rather than as a bare number. | MVP | Legacy FR-23; the stream is the single source for usage counters, quota evaluation, adoption metrics and any future usage-based pricing (FR-169 deferred, NFR-10). | UC-66, UC-152 | Every billable-shaped action emits one event with the four attributes; events cannot be amended or deleted; usage counters, quota evaluation and adoption metrics derive from that stream; consumption is displayed against the limit. |

### 3.20 Billing account (FR-106 … FR-107)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-106 | The system shall maintain billing account data distinct from the organization profile: registered legal name, IDNO, VAT registration code where registered, legal address and billing contact. | MVP | The invoiced legal person is not always the reporting entity, particularly in a group structure (UC-108). | UC-108 | Each named field is held on the billing account and is editable independently of the FR-15 organization profile. |
| FR-107 | The system shall validate the format of supplied fiscal identifiers and, where a lookup is available, verify existence and VAT status. | MVP | D-10: an invoice carrying an invalid fiscal code is rejected by e-Factura and cannot be corrected by editing. | UC-109 | A malformed IDNO or VAT code is rejected at entry; where a lookup is available, existence and VAT status are verified and the result recorded. |

### 3.21 Order and checkout (FR-108 … FR-113)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-108 | The system shall model the order as an entity with its own lifecycle — draft, awaiting payment, paid, provisioned, expired, cancelled, failed — separate from both the subscription and the invoice, so that an unpaid attempt leaves no orphaned subscription and no issued fiscal document. | MVP | The order is the unit of commercial intent (UC-110). | UC-110 | An order exists in exactly one of the seven states; an abandoned order leaves no subscription and no issued fiscal document. |
| FR-109 | The system shall validate a discount code at entry against plan eligibility, validity window and remaining redemptions, recalculating the order total or rejecting the code with its reason stated. | MVP | An invalid or exhausted code is rejected at entry with the reason, not silently ignored (UC-111). | UC-111 | A valid code recalculates the total; an ineligible, expired or exhausted code is rejected at entry with the reason shown. |
| FR-110 | The system shall present an order summary showing net amount, VAT rate and basis, gross total in the order currency, and the payment rails available for that total, stating the reason where a rail is excluded rather than omitting the option. | MVP | D-8: rail availability is a function of order total, notably the MIA per-transaction ceiling. | UC-112 | The summary shows net, VAT rate and basis, and gross in the order currency; an excluded rail is shown with its exclusion reason rather than hidden. |
| FR-111 | The system shall record the accepted terms version, timestamp and acting user against the order on confirmation. | MVP | A subscription agreement is a contract and the platform must be able to evidence what was agreed; this is also the input to the FR-140 evidence pack (UC-113). | UC-113 | Confirmation records terms version, timestamp and acting user against the order. |
| FR-112 | The system shall track order status through its lifecycle, showing what is outstanding, the reference the payer must quote, and the consequence if payment does not arrive. | MVP | Matters most on the bank transfer rail where settlement is asynchronous and can take days (UC-114). | UC-114 | The order displays its current state, the outstanding amount, the payment reference to quote and the consequence of non-payment. |
| FR-113 | The system shall allow an unpaid order to be cancelled and shall void any associated proforma invoice. | MVP | A proforma is not a fiscal document, which is what allows clean voiding; a fiscal invoice can only be reversed by credit note (D-10, UC-115). | UC-115 | Cancelling an unpaid order voids its proforma; an order with an issued fiscal invoice is not cancellable by this path. |

### 3.22 Payment (FR-114 … FR-120)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-114 | The system shall perform all money movement through licensed third parties reached behind a single provider adapter interface, with rail-agnostic order routing and the customer choosing at checkout, and shall register the merchant-of-record adapter inactive at MVP so that activation is configuration. | MVP | D-7, D-8, NFR-11: executing payments without a licence is not open to a software vendor; no single Moldovan rail covers every case; the merchant-of-record rail serves the non-resident customers arriving with Phase 2. | UC-116, UC-120, UC-121, UC-122 | No money movement occurs outside a provider adapter; the order flow routes to any registered rail without rail-specific order logic; the merchant-of-record adapter is registered, inactive, and activated by configuration alone. |
| FR-115 | The system shall receive, store and transmit no card data at any point, retaining only the acquirer's transaction reference and a masked descriptor. | MVP | D-7: accepting raw card data would place the platform in PCI DSS SAQ-D scope, which is disproportionate and avoidable. | UC-116 | No system component receives, stores or transmits card data; the payment record holds only the acquirer transaction reference and a masked descriptor. |
| FR-116 | The system shall accept domestic card payment through the acquirer's hosted page or SDK including the 3-D Secure challenge, with the order surviving the round trip and possible mid-challenge abandonment without duplicating the charge or the order. | MVP | D-8: domestic acquiring through maib, Victoriabank or MICB is the only MVP rail supporting genuinely unattended recurring billing. | UC-116, UC-117 | Payment completes through the acquirer's hosted page or SDK; abandonment mid-challenge leaves exactly one order and no duplicate charge; the authentication result is carried on the transaction. |
| FR-117 | The system shall store a card token for recurring billing under a consent recorded separately from the payment itself, and shall allow stored instruments to be viewed, replaced, removed and defaulted, warning that renewal will fail when the last instrument on an auto-renewing subscription is removed. | MVP | An authorisation to charge once and an authorisation to charge every month are different permissions (UC-118); the organization must not discover the failure at suspension (UC-119). | UC-118, UC-119 | Recurring consent is recorded as a separate record from the payment; instruments can be listed, replaced, removed and set as default; removing the last instrument on an auto-renewing subscription warns that renewal will fail. |
| FR-118 | The system shall offer MIA instant payment by QR, payment link or request-to-pay only where the order total is within the per-transaction ceiling, reading the applicable limit from configuration rather than code. | MVP | D-8: the National Bank adjusts the ceiling, and an annual Standard or Enterprise price sits above it. | UC-120 | MIA is offered where the total is within the configured ceiling and withheld with a reason where it is not; changing the ceiling in configuration changes availability with no deployment. |
| FR-119 | The system shall offer bank transfer against a proforma invoice carrying a unique payment reference, deferring provisioning until the payment is reconciled. | MVP | D-8: the dominant B2B settlement method in Moldova and the only rail with no amount ceiling, therefore the default for annual and Enterprise billing. | UC-121 | Electing transfer issues a proforma with a unique payment reference; no entitlement is granted until reconciliation under FR-132 or FR-134. |
| FR-120 | The system shall execute scheduled recurring charges idempotently against the renewal period, retrying soft declines on a defined schedule, never retrying hard declines, and notifying the Administrator of a failure with what failed, the consequence, the deadline and the action that fixes it. | MVP | A retried or duplicated job must never bill a customer twice for one period (UC-123); repeating a hard decline achieves nothing and can trigger acquirer penalties (UC-124); almost all involuntary churn is an expired card nobody was told about (UC-125). | UC-123, UC-124, UC-125 | A repeated run for one renewal period charges once; a soft decline retries on the defined schedule; a hard decline is not retried; the failure notice states cause, consequence, deadline and remedy and is non-suppressible per FR-163. |

### 3.23 Invoicing (FR-121 … FR-130)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-121 | The system shall issue a proforma invoice on election of bank transfer, carrying payment reference, bank details, amount and validity date, creating no VAT liability and consuming no invoice number. | MVP | A proforma is a payment request, not a fiscal document, which is what allows FR-113 to void it cleanly (UC-126). | UC-126 | The proforma carries the four attributes, consumes no number from the FR-123 series, and creates no VAT liability. |
| FR-122 | The system shall generate the fiscal invoice from the order on confirmed payment rather than by manual entry, recording supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, and total. | MVP | The invoice is generated from the order, not typed, so the document and the ledger cannot diverge (UC-127). | UC-127 | On confirmed payment an invoice is generated from the order carrying each named field; no manual-entry path exists. |
| FR-123 | The system shall allocate invoice numbers from a gapless, monotonic series per document type per fiscal year, under a lock at issuance and never reserved optimistically at order creation. | MVP | D-10: statutory constraint; an abandoned order must not leave a hole in the series (UC-134). | UC-134 | Numbers are allocated only at issuance, are monotonic and gapless within document type and fiscal year, and concurrent issuance produces no duplicate or gap; the series rolls at the fiscal year boundary. |
| FR-124 | The system shall derive VAT treatment from the customer's residency and VAT status — standard-rate domestic supply, or the applicable export or reverse-charge treatment — stating the basis on the document and drawing rates and rules from maintained data. | MVP | Rates and digital-services rules move independently of the platform's release cycle (UC-128, FR-148). | UC-128 | A domestic customer receives standard-rate treatment and a non-resident the applicable export or reverse-charge treatment; the basis is stated on the document; rates and rules come from FR-148 data. |
| FR-125 | The system shall treat an issued invoice as immutable, changing its effect only through a credit note or corrective invoice referencing the original, itself transmitted to e-Factura. | MVP | D-10: statutory constraint, and what makes the billing ledger auditable. | UC-133 | No path edits an issued invoice; a correction is a separate document referencing the original and is transmitted per FR-126. |
| FR-126 | The system shall render the invoice into the required national e-Factura XML format and transmit it, storing the platform's acknowledgement and identifier against the invoice record. | MVP | D-9: mandatory for B2B from 1 October 2026, and every paying customer is a Moldovan business, so this applies from the first paid invoice. | UC-129 | Each issued invoice is rendered into the national XML format, transmitted, and the acknowledgement and platform identifier stored against the invoice record. |
| FR-127 | The system shall surface a transmission rejection with its reason and support reissue after the underlying data is corrected, and shall never mark an untransmitted invoice as delivered. | MVP | An untransmitted B2B invoice is a compliance exposure, not a delivery inconvenience (UC-130). | UC-130 | A rejection is shown with its reason; reissue is possible after correction; no untransmitted invoice carries a delivered state. |
| FR-128 | The system shall deliver the invoice to the billing contact and make it available in the billing area, recording delivery timestamp and channel, and shall keep invoice history and document download available after downgrade, cancellation and lapse. | MVP | Answers the recurring dispute over whether an invoice was ever received (UC-131); the customer's retention obligation outlives their subscription (UC-132). | UC-131, UC-132 | Delivery is recorded with timestamp and channel; the invoice is downloadable from the billing area; after downgrade, cancellation and lapse the history and downloads remain available. |
| FR-129 | The system shall store the National Bank of Moldova official rate for the invoice date on any foreign-currency invoice and reproduce it on the document. | MVP | D-14: the MDL equivalent is what the fiscal return and the accounting ledger are built from. | UC-136 | A EUR- or USD-denominated invoice stores the BNM rate for its invoice date and shows it on the document. |
| FR-130 | The system shall archive issued fiscal documents and their transmission receipts in immutable storage for the statutory retention period, taking precedence over a customer erasure request. | MVP | Retention is a system guarantee rather than a backup policy, and is the point at which the erasure workflow defers to fiscal law (UC-135). | UC-135 | Issued documents and transmission receipts are stored immutably for the statutory period, and an erasure request does not remove them. |

### 3.24 Reconciliation (FR-131 … FR-134)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-131 | The system shall import bank account statements by file or bank API into a reconciliation workspace. | MVP | The transfer rail settles asynchronously with no callback; without an inbound statement the platform cannot know a customer has paid (UC-137). | UC-137 | A statement is imported by file and by bank API, and its lines appear in the reconciliation workspace. |
| FR-132 | The system shall match statement lines to open orders and invoices automatically on payment reference, amount and payer fiscal code, marking the invoice paid and provisioning the subscription on a confident match. | MVP | Automatic matching is what keeps the bank transfer rail from becoming a manual back office (UC-138). | UC-138 | A line matching on reference, amount and payer fiscal code marks the invoice paid and provisions the subscription without operator action. |
| FR-133 | The system shall provide an exception workspace for missing or mistyped references, partial payments, overpayments, third-party payments and duplicates, recording every resolution with its rationale. | MVP | A manual match is a financial assertion (UC-139). | UC-139 | Each of the five exception classes is presentable in the workspace, and every resolution records a rationale. |
| FR-134 | The system shall permit manual settlement of an invoice only with a stated reason, written to the immutable billing audit ledger. | MVP | The single most abusable capability in the billing domain (UC-140). | UC-140 | Manual settlement without a reason is refused; each settlement writes an entry to the FR-151 ledger. |

### 3.25 Collections (FR-135 … FR-138)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-135 | The system shall escalate an unpaid invoice through a configurable dunning sequence at defined intervals, each notice stating the amount, the due date passed and the date service will be restricted, stopping immediately on payment. | MVP | The schedule is configuration rather than code (UC-141). | UC-141 | Notices are raised at the configured intervals, each carrying the three named facts; payment stops the sequence immediately; changing the schedule requires no deployment. |
| FR-136 | The system shall move the subscription to suspended when dunning is exhausted, making out-of-entitlement reports and entities read-only and blocking new exports, and shall tell the Administrator exactly what changed and how to restore it. | MVP | D-13: nothing is deleted, and previously generated documents remain downloadable (FR-104). | UC-142 | On exhaustion the state becomes suspended, out-of-entitlement reports and entities are read-only, new exports are blocked, and the Administrator is told what changed and how to restore it. |
| FR-137 | The system shall restore full entitlements automatically on settlement of the overdue amount, without requiring the customer to contact support. | MVP | The failure that caused suspension is usually an expired card, not a decision (UC-143). | UC-143 | Settlement restores full entitlements and returns read-only entities and reports to editable with no support intervention. |
| FR-138 | The system shall record a write-off against the invoice with reason and accounting treatment, leaving the fiscal document in the ledger rather than deleting it. | MVP | The fiscal document exists whether or not it was ever paid (UC-144). | UC-144 | A write-off records reason and accounting treatment and leaves the invoice in the ledger with the write-off entry against it. |

### 3.26 Refunds and disputes (FR-139 … FR-141)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-139 | The system shall issue full or partial refunds through the original rail where possible and by transfer where not, generating the corresponding credit note, with refund authority separated from invoice issuance authority. | MVP | No single account may both raise a charge and reverse it (UC-145). | UC-145 | A refund routes to the original rail where available and to transfer otherwise, generates a credit note under FR-125, and cannot be performed by an account holding only invoice issuance authority. |
| FR-140 | The system shall handle a card chargeback by recording the case, assembling an evidence pack from the order, the recorded terms acceptance and usage records, and recording the outcome. | MVP | The evidence pack is assembled from data the platform already holds, which is why FR-111 records the terms version and timestamp (UC-146). | UC-146 | A case is recorded; the evidence pack draws on order, FR-111 terms acceptance and FR-105 usage records; the outcome is recorded against the case. |
| FR-141 | The system shall reverse entitlements following a refund or chargeback as a step distinct from the financial reversal, applying read-only treatment rather than deletion and accommodating partial, goodwill and already-consumed cases. | MVP | D-13; a refund may be partial, goodwill, or for a period already consumed (UC-147). | UC-147 | Entitlement reversal is invocable independently of the financial reversal, applies read-only treatment per FR-104, and handles a partial, a goodwill and an already-consumed case without deleting content. |

### 3.27 Enterprise (FR-142 … FR-147)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-142 | The system shall exclude Enterprise from self-serve checkout, with a quote request creating a tracked opportunity as the entry point to the contract path. | MVP | D-12: Enterprise is contract-based and never passes through self-serve checkout; the Phase 2/3 Advisor, Buyer and Licensee models are all Enterprise-shaped. | UC-153 | No self-serve checkout path exists for Enterprise; a quote request creates a tracked opportunity rather than an email. |
| FR-143 | The system shall hold a quote as structured data — negotiated entitlement set, price, currency, billing schedule, validity date — provisioning directly on acceptance so that sold terms and configured terms cannot drift apart. | MVP | The quote is structured data rather than a document (UC-154). | UC-154 | A quote stores each named attribute as data; acceptance provisions the subscription from the quote without re-entry. |
| FR-144 | The system shall record the executed contract: term length, notice period, negotiated entitlements, SLA, price protection and any non-standard clause with billing consequences. | MVP | This is the authoritative record the Enterprise subscription is provisioned from (UC-155). | UC-155 | Each named term is recorded against the contract, and the subscription's entitlements are traceable to it. |
| FR-145 | The system shall provision an Enterprise subscription by additive per-subscription entitlement overrides rather than a bespoke plan per customer. | MVP | Stops the plan catalogue from degenerating into one plan per client (UC-156). | UC-156 | Negotiated entitlements are stored as overrides on the subscription; no new plan record is created per customer. |
| FR-146 | The system shall record the customer's own purchase-order or contract reference against the subscription and reproduce it on every invoice issued under it. | MVP | Institutional and public-sector buyers will not process an invoice that omits it (UC-157). | UC-157 | The reference is recorded on the subscription and appears on every invoice issued under that subscription. |
| FR-147 | The system shall drive custom billing schedules from data — annual in advance, semi-annual, milestone-based, multi-year instalment — and shall track approaching expiry, renewal and renegotiation, with an unrenewed contract following the standard lapse path rather than abrupt termination. | MVP | The alternative is a manual diary entry that will eventually be missed (UC-158); D-13 lapse treatment (UC-159). | UC-158, UC-159 | Each named schedule shape is configurable as data; approaching expiry is tracked and surfaced; an unrenewed contract lapses per FR-104 rather than terminating abruptly. |

### 3.28 Financial reporting (FR-148 … FR-152)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-148 | The system shall maintain VAT rates and the rules selecting treatment by customer residency and VAT status, each with an effective date, requiring no deployment for a rate change. | MVP | Rates and digital-services rules change by legislation on their own timetable (UC-160). | UC-160 | A rate or rule is added with an effective date and applied by FR-124 with no deployment; a document dated before the effective date retains the prior rate. |
| FR-149 | The system shall provide a billing revenue dashboard covering recognised and deferred revenue, active subscriptions by plan, monthly recurring revenue, churn, collection rate and days sales outstanding. | MVP | Read alongside the adoption metrics, this is what makes the Phase 2 monetization decision evidence-based (UC-161). | UC-161 | Each of the six measures is presented on the dashboard. |
| FR-150 | The system shall export the period's invoices, credit notes, payments and VAT summary in the form the fiscal return and the company's accountant require, including MDL equivalents of foreign-currency documents. | MVP | D-14; the handover point between the platform and the company's own accounting obligations (UC-162). | UC-162 | The export contains the period's invoices, credit notes, payments and VAT summary, with MDL equivalents for foreign-currency documents per FR-129. |
| FR-151 | The system shall maintain an append-only billing audit ledger of every financial event — order, invoice, payment, credit note, refund, manual match, write-off, entitlement override, price change — attributed and timestamped, with entries superseded rather than edited or deleted. | MVP | Entries are never edited or deleted, only superseded, which is what makes the ledger evidence (UC-163). | UC-163 | Each of the nine event classes is recorded with actor and timestamp; no path edits or deletes an entry; a correction appears as a superseding entry. |
| FR-152 | The system shall reconcile acquirer and instant-rail settlement reports against payments recorded in the platform, identifying missing settlements, fee discrepancies and timing differences. | MVP | Without this the platform knows what it charged but not what it actually received, and the two differ routinely (UC-164). | UC-164 | Importing a settlement report produces the three named discrepancy classes against recorded payments. |

### 3.29 Cross-cutting (FR-153 … FR-159)

These seven requirements have no originating use case. They are obligations no single use case owns but every one depends on, and they are verified as architectural conformance rather than through a single actor flow. This is intentional and is recorded as such in section 9.4.

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-153 | The system shall expose report CRUD, validation and export operations through a documented, authenticated API and not only through the interface. | MVP (architectural) | Legacy FR-21, API-first; NFR-13 requires a real authentication and authorization surface behind it. | *(architectural)* | Report create, read, update, delete, validation and export are each invocable through the documented API under authentication, without use of the interface. |
| FR-154 | The system shall keep the compliance core free of any dependency on plan, price or tenant type, such that disabling billing entirely leaves every reporting use case UC-17 … UC-48 functioning. | MVP (architectural) | D-11, NFR-1: billing is a separate bounded context publishing only entitlement changes into the core. | *(architectural)* | With billing disabled, every use case in UC-17 … UC-48 completes; no compliance-core component references plan, price or tenant type. |
| FR-155 | The system shall mirror VSME taxonomy element names and structure in the internal schema rather than adopting a custom schema. | MVP (architectural) | NFR-2. | *(architectural)* | Internal field names and structure correspond to VSME taxonomy elements for B1–B11. |
| FR-156 | The system shall place third-party components — EFRAG converter, payment providers, e-Factura, identity providers — behind internal interfaces, with no hard dependency on a single vendor. | MVP (architectural) | NFR-11: vendor-continuity risk. | *(architectural)* | Each named third party is reached only through an internal interface, and a substitute implementation can be registered without changing calling code. |
| FR-157 | The system shall deliver every system-initiated notification — payment failure, quota approach, trial expiry, dunning, taxonomy version change, invitation, outstanding-report notice — through one channel-agnostic mechanism recording delivery timestamp and channel. FR-160 … FR-173 specify that mechanism rather than adding a second one. | MVP (architectural) | One mechanism, every producer (register note on FR-160 … FR-173). | *(architectural)* | Every named producer dispatches through the single mechanism, and no producer holds its own delivery path; each dispatch records timestamp and channel. |
| FR-158 | The system shall enforce role-based access control server-side on every request, scoped per organization and per report, rather than in the interface layer. | MVP (architectural) | NFR-13. | *(architectural)* | A request that the interface would not offer is refused server-side; scoping is evaluated per organization and per report on every request. |
| FR-159 | The system shall attribute every state-changing action to an acting actor with a timestamp, across reporting, administration and billing alike. | MVP (architectural) | NFR-7 extended platform-wide; underpins FR-54, FR-81, FR-98, FR-151. | *(architectural)* | Every state-changing action in each of the three domains records an acting actor and a timestamp. |

### 3.30 Notifications (FR-160 … FR-167, FR-173)

**These requirements specify FR-157 rather than compete with it.** FR-157 requires that every system-initiated notification runs through one channel-agnostic mechanism; it does not say what that mechanism does. FR-160 … FR-172 are that specification, and every existing producer — payment failure (FR-120), quota approach (FR-101), trial expiry (FR-93), dunning (FR-135), service restriction (FR-136), invitation (FR-57), invoice delivery (FR-128), version change (FR-70) — is bound by them rather than acquiring its own delivery path.

**Scope held down deliberately.** There is no ownership or assignment model on a notice and no escalation chain: an outstanding-report notice addresses everyone with edit access, repeats at a configured interval, and stops when the condition clears. The Organization Administrator's view of what is outstanding remains the report status overview of FR-23. Both refinements can be added later if usage warrants; neither earns its complexity for an SME with two people on the report.

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-160 | The system shall model a notification as a first-class record carrying category, subject reference, recipients and state — raised, delivered, read, cancelled — held separately from the channel or channels it is delivered on, so that one notice to two people on two channels remains one notification. | MVP | Specifies FR-157. | UC-165, UC-172, UC-174 | One notice addressed to two recipients over two channels is one notification record with per-recipient delivery records; the record's state is one of the four named values. |
| FR-161 | The system shall provide an in-app notification centre listing the user's notifications for the active organization with an unread count available from any screen, persisting each item until read or dismissed rather than only while the user is present, and holding read state per user. | MVP | The centre is storage, not a transient toast — a notice raised while the user was logged out is waiting when they return (UC-165); one recipient reading an organization-wide notice must not clear it for colleagues (UC-167). | UC-165, UC-167 | A notice raised while the user was logged out is present on return; the unread count is reachable from any screen; marking read affects only the acting user. |
| FR-162 | The system shall carry on every notification a deep link to the object that raised it — module, field, reporting period, invoice — so that acting on it requires no navigation. | MVP | A notice saying something is missing but not where converts far worse than one that lands the user on the screen that fixes it (UC-166). | UC-166 | Selecting a notification opens the object that raised it directly. |
| FR-163 | The system shall maintain per-user notification preferences by category and channel, stored on the user profile so that they follow the user across organizations, permitting suppression only for categories classified optional; security, account, invoice-delivery, payment-failure and service-restriction notices are non-suppressible and presented as such. Extends FR-9. | MVP | A user should not be able to opt out of being told their card was declined (UC-168). | UC-168 | Preferences are settable per category and channel, persist across organizations, and the five named categories cannot be switched off and are shown as mandatory. |
| FR-164 | The system shall raise a notice, at a configured repeat interval while a reporting period is open, where mandatory disclosures remain unanswered or validation findings unresolved, naming the specific modules and fields outstanding rather than reporting only that the report is incomplete. | MVP | The named list comes from the validation rollup of FR-41, which already computes it (UC-169). | UC-169 | While the period is open with outstanding items, a notice naming the specific modules and fields is raised at the configured interval to the users with edit access. |
| FR-165 | The system shall raise a deadline notice at each configured lead time before a period's due date stating the date, days remaining and current completion state, and shall raise none where the report is already complete and validated. | MVP | A reminder that fires regardless of state trains users to ignore the channel (UC-170). | UC-170 | At each configured lead time before the FR-21 due date a notice carrying the three named facts is raised; where the report is complete and validated no notice is raised. |
| FR-166 | The system shall raise a report-update notice to affected organizations wherever a taxonomy or template version change, an applicability threshold change or an emission factor update means an existing report must be reviewed or re-exported, naming the change and what it obliges. | MVP | The mechanised form of FR-70 / UC-79. | UC-171 | Each of the three change classes raises a notice to the affected organizations naming the change and the obligation it creates. |
| FR-167 | The system shall cancel an outstanding notice and stop its repetition as soon as its condition clears — the disclosure supplied, the section declared not material, the period locked — and shall deduplicate on category and subject so that a repeatedly evaluated condition produces one notice rather than one per evaluation. | MVP | — | UC-169, UC-170 | Supplying the disclosure, declaring the section not material, or locking the period cancels the notice and stops repetition; repeated evaluation of one unchanged condition yields one notification, not one per run. |
| FR-173 | The system shall hold the notification category catalogue's behaviour as publishable configuration — default channels, transactional-or-optional classification, deadline lead times, repeat interval — so that tuning a notice needs no release, with its per-locale subject and body wording shipped in the release that raises it. | MVP | Tuning a notice is configuration, not a release (UC-176). **Amended 19 Aug 2026 (architecture.md OQ-43):** template wording moved into the message catalogues. A category cannot exist unless code calls `raise()` with its key — `RaiseNotificationCommand.categoryKey`, `apps/api/src/contracts/notification.port.ts` — so a genuinely new notice always arrives with a release regardless of where its words live, and "adding a notice needs no release" was only ever true of the catalogue row, not the trigger. What an operator actually tunes without a release is the behaviour, and that is unchanged. | UC-175, UC-176 | Default channels, classification, lead times and repeat interval are configuration values edited and published with no deployment; subject and body wording resolves from the message catalogue by category key. |

### 3.31 Notification delivery (FR-168 … FR-172)

| FR ID | Requirement | Pri | Rationale / source | Source UC | Acceptance criteria |
|---|---|---|---|---|---|
| FR-168 | The system shall deliver in-app by writing to each recipient's notification centre, with no dependency on any external provider, so that the channel continues to function during an email provider outage. | MVP | In-app delivery depends on no external provider (UC-172). | UC-172 | With the email provider unavailable, in-app delivery still writes to each recipient's centre and updates the unread count. |
| FR-169 | The system shall deliver by email through a provider reached behind the standard provider adapter, resolving language per recipient rather than per notification, and including a working one-click unsubscribe in every optional-category message. | MVP | NFR-11, FR-156: the provider sits behind the standard adapter; the target user is an SME owner who does not log in between reporting sessions (UC-173). | UC-173 | Two recipients with different interface languages receive the same notification each in their own language; every optional-category email carries a working one-click unsubscribe; the provider is reached only through the adapter. |
| FR-170 | The system shall record per notification and recipient the channel used, dispatch timestamp and outcome, and read state for in-app, as the evidence that a required update was actually requested. | MVP | — | UC-174 | Each notification and recipient pair carries channel, dispatch timestamp and outcome, with read state additionally recorded for in-app. |
| FR-171 | The system shall retry a transient send failure on a bounded schedule, suppress an address that hard-bounces, and surface a suppressed recipient to the Organization Administrator. | MVP | A silently undeliverable address is otherwise indistinguishable from a person ignoring their notices (UC-174). | UC-174 | A transient failure retries within the bounded schedule and then stops; a hard bounce suppresses the address; the suppressed recipient is visible to the Organization Administrator. |
| FR-172 | The system shall dispatch notifications asynchronously, so that no user-facing action blocks on delivery and a provider outage degrades delivery without degrading the application. | MVP (architectural) | Specifies FR-157; no originating use case. | *(architectural)* | A user-facing action that raises a notification completes without waiting for delivery; with the provider unavailable the action still completes. |

---

## 4. Business rules and validation rules

These rules are not additional requirements. Each is a rule already carried inside one or more requirements in section 3, extracted here so that a reader can find the decision logic in one place. The requirement, not this section, is the authority. Numeric values shown are those the sources record; per section 2.5 the testable obligation is that the value is read from configuration and applied, not that it equals a particular number.

### 4.1 Reporting and disclosure rules

| Rule | Statement | Held in |
|---|---|---|
| BR-VAL-1 | Field validation resolves to exactly one of `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR`, `INVALID URL`, or the declared-not-available state. | FR-40, FR-32 |
| BR-VAL-2 | Rollup discounts sections declared not material, so a legitimate exclusion does not depress completion. | FR-41, FR-31 |
| BR-VAL-3 | Validation is idempotent and runnable at any completeness level; it is a drafting tool, not only a pre-export gate. | FR-43 |
| BR-VAL-4 | Export is permitted with unresolved findings after an explicit warning; gaps are marked visibly in the output, never omitted silently. | FR-44 |
| BR-APP-1 | Employee turnover disclosure applies at a B1 headcount of ≥50. | FR-28, FR-72 |
| BR-APP-2 | The unadjusted gender pay gap applies at a B1 headcount of ≥150. | FR-28, FR-72 |
| BR-APP-3 | Biodiversity applicability is site-driven, evaluated from the B1 site geolocations; a company with no qualifying site records a negative determination rather than an empty section. | FR-28, FR-19 |
| BR-APP-4 | Water relevance is sector-driven and supports a documented immateriality determination. | FR-28, FR-31 |
| BR-APP-5 | A field that does not apply is hidden rather than presented and later rejected. | FR-28 |
| BR-DIS-1 | A nil or zero return is an affirmative disclosure, stored and rendered distinctly from an unanswered field. | FR-30 |
| BR-DIS-2 | A section declared not material or not applicable requires a rationale, satisfies validation, and carries the declaration into both export formats. | FR-31 |
| BR-DIS-3 | A field declared not available requires a stated reason and is a terminal state distinct from `MISSING VALUE`. | FR-32, D-4 |
| BR-DIS-4 | B1 pre-populates from the entity master record and remains editable in-report; editing it does not alter master data. | FR-27, D-2 |
| BR-CALC-1 | Consumption is entered in invoice units, converted to MWh, and results are expressed in tCO₂e; raw inputs are retained permanently. | FR-33, FR-34 |
| BR-CALC-2 | Every computed emission result stores the factor set version used; a later factor update never restates an existing result. | FR-35, FR-71 |
| BR-CALC-3 | An override of a computed value is flagged, attributed, and retains the superseded computed value. | FR-36 |
| BR-PER-1 | A locked period is read-only for Reporting Contributors; reopening requires a stated reason and records actor and timestamp. | FR-22 |
| BR-PER-2 | Entity master data is point-in-time: a closed period keeps the values in force when its report was prepared. | FR-18 |
| BR-PER-3 | A period's due date is distinct from its period end and is what deadline notices count down to. | FR-21, FR-165 |
| BR-VER-1 | Every report carries an explicit template and taxonomy version; periods pin the version current when they are opened. | FR-66, FR-65 |
| BR-VER-2 | A report is never exported against a version it was not prepared under; the choice is migrate or export against the original with an explicit notice. | FR-51 |
| BR-VER-3 | Migration preserves the pre-migration state; a breaking change is migrated report-by-report with manual review. | FR-69, FR-67 |

### 4.2 Access, identity and membership rules

| Rule | Statement | Held in |
|---|---|---|
| BR-ID-1 | No application data is reachable until email verification completes; a provider-asserted verified address satisfies verification. | FR-1, FR-3 |
| BR-ID-2 | A provider identity is matched on its subject identifier, never on its email address. | FR-4 |
| BR-ID-3 | A provider assertion alone never attaches to an existing account; the user must first authenticate with an existing credential. | FR-8 |
| BR-ID-4 | The last remaining credential on an account cannot be removed. | FR-8 |
| BR-ID-5 | A password reset endpoint returns an identical response for registered and unregistered addresses; consuming a reset link invalidates all sessions. | FR-6 |
| BR-ID-6 | Disabling a social provider stops new registrations and links while leaving existing accounts able to authenticate by another credential. | FR-82 |
| BR-ACC-1 | The founding user of an organization is an Organization Administrator; a pure Reporting Contributor arises only by invitation. | FR-13, D-1 |
| BR-ACC-2 | An invitation is bound to the invited email address, is single-use, and expires; revocation invalidates the outstanding link immediately. | FR-11, FR-57 |
| BR-ACC-3 | A role change takes effect on the user's next request, not at their next login. | FR-58 |
| BR-ACC-4 | Removing a member's access deletes neither their account nor their attributed history. | FR-59, FR-55 |
| BR-ACC-5 | Access control is enforced server-side on every request, scoped per organization and per report. | FR-158 |
| BR-ACC-6 | The Platform Administrator holds no standing access to tenant report data; access exists only under a scoped, time-limited, logged grant that expires without action. | FR-77, FR-78, FR-79, D-5 |

### 4.3 Commercial, entitlement and fiscal rules

| Rule | Statement | Held in |
|---|---|---|
| BR-ENT-1 | An entitlement check returns exactly one of allow, deny, allow-with-warning, and is answered by the central service. | FR-99, FR-100 |
| BR-ENT-2 | A quota block never discards work in progress, and a started report can always be finished and exported. | FR-102 |
| BR-ENT-3 | On reduced entitlement, the entities and reports retained are selected deterministically — most recently active retained — and the outcome is shown before the change takes effect. | FR-103 |
| BR-ENT-4 | No disclosure content is deleted on lapse, downgrade, suspension or entitlement reversal; out-of-entitlement content becomes read-only and previously generated documents stay downloadable. | FR-104, FR-136, FR-141, D-13 |
| BR-ENT-5 | A metering event is emitted for every billable-shaped action, including actions not currently billed. | FR-105 |
| BR-SUB-1 | Entitlements change on confirmed payment, or on invoice issuance under approved bank transfer terms — never on order creation. | FR-92, FR-108 |
| BR-SUB-2 | An upgrade is immediate with a prorated credit; a downgrade takes effect at the end of the paid period with advance disclosure of what becomes read-only. | FR-94 |
| BR-SUB-3 | Mid-cycle additions are prorated to the period end; removals apply to the following period and generate no mid-cycle refund. | FR-96 |
| BR-SUB-4 | Cancellation takes effect at the close of the paid period, not immediately. | FR-97 |
| BR-SUB-5 | A plan version change requires an explicit grandfathering choice; each subscription references the plan version it was sold under. | FR-87 |
| BR-SUB-6 | Retiring a plan closes it to new subscriptions and terminates no existing service. | FR-88 |
| BR-SUB-7 | Enterprise never passes through self-serve checkout; it is provisioned from a quote or contract by additive entitlement overrides. | FR-142, FR-143, FR-145, D-12 |
| BR-PAY-1 | All money movement is performed by licensed third parties behind a provider adapter; order routing is rail-agnostic and the customer chooses at checkout. | FR-114, D-7, D-8 |
| BR-PAY-2 | The platform receives, stores and transmits no card data; only the acquirer transaction reference and a masked descriptor are retained. | FR-115, D-7 |
| BR-PAY-3 | MIA is offered only where the order total is within the per-transaction ceiling, which is read from configuration. The source records the ceiling at approximately 5,000 MDL per transaction, commission-free below 10,000 MDL per month. | FR-118, FR-110, D-8 |
| BR-PAY-4 | Bank transfer carries no amount ceiling and defers provisioning until reconciliation. | FR-119, FR-132 |
| BR-PAY-5 | Recurring consent is recorded separately from the payment; removing the last instrument on an auto-renewing subscription warns that renewal will fail. | FR-117 |
| BR-PAY-6 | A recurring charge is idempotent per renewal period. Soft declines retry on a defined schedule; hard declines are never retried. | FR-120 |
| BR-PAY-7 | An excluded payment rail is shown with its exclusion reason rather than hidden. | FR-110 |
| BR-INV-1 | Invoice numbers are gapless and monotonic per document type per fiscal year, allocated under a lock at issuance and never reserved at order creation. | FR-123, D-10 |
| BR-INV-2 | An issued invoice is immutable; its effect changes only through a credit note or corrective invoice referencing it, itself transmitted to e-Factura. | FR-125, D-10 |
| BR-INV-3 | A proforma is not a fiscal document: it creates no VAT liability, consumes no invoice number, and is voidable with its order. | FR-121, FR-113 |
| BR-INV-4 | VAT treatment derives from customer residency and VAT status, with the basis stated on the document and rates drawn from effective-dated data. The source records the standard Moldovan rate at 20% with no reduced rate for digital services. | FR-124, FR-148 |
| BR-INV-5 | A foreign-currency invoice stores and reproduces the BNM official rate for the invoice date; MDL is the ledger currency. | FR-129, FR-150, D-14 |
| BR-INV-6 | Every invoice is rendered into the national e-Factura XML format and transmitted; an untransmitted invoice is never marked delivered. | FR-126, FR-127, D-9 |
| BR-INV-7 | Issued fiscal documents and their transmission receipts are retained in immutable storage for the statutory period, which takes precedence over a customer erasure request. The source records Moldovan VAT record retention at not less than six years. | FR-130 |
| BR-INV-8 | Invoice history and document download remain available after downgrade, cancellation and lapse. | FR-128, FR-104 |
| BR-COL-1 | Dunning escalates at configured intervals, each notice stating amount, due date passed and restriction date, and stops immediately on payment. | FR-135 |
| BR-COL-2 | Settlement of the overdue amount restores full entitlements automatically, without contacting support. | FR-137 |
| BR-COL-3 | A write-off leaves the fiscal document in the ledger with the write-off recorded against it. | FR-138 |
| BR-COL-4 | Manual settlement of an invoice requires a stated reason and writes to the immutable billing audit ledger. | FR-134, FR-151 |
| BR-COL-5 | Refund authority is separated from invoice issuance authority. | FR-139 |
| BR-COL-6 | Entitlement reversal is a step distinct from financial reversal and applies read-only treatment, never deletion. | FR-141 |
| BR-LED-1 | Billing audit ledger entries are superseded, never edited or deleted. | FR-151 |
| BR-FIS-1 | A fiscal identifier failing format validation is rejected at entry, because an invalid code cannot be corrected after issuance. | FR-107, D-10 |

### 4.4 Notification rules

| Rule | Statement | Held in |
|---|---|---|
| BR-NOT-1 | One notice to several recipients over several channels remains one notification record with per-recipient delivery records. | FR-160 |
| BR-NOT-2 | Security, account, invoice-delivery, payment-failure and service-restriction categories are non-suppressible and presented as such; only optional categories can be switched off. | FR-163 |
| BR-NOT-3 | A notice is cancelled and its repetition stops as soon as its condition clears; notices deduplicate on category and subject. | FR-167 |
| BR-NOT-4 | No deadline notice is raised where the report is already complete and validated. | FR-165 |
| BR-NOT-5 | Read state is per user; one recipient reading an organization-wide notice does not clear it for others. | FR-161 |
| BR-NOT-6 | Email language resolves per recipient, not per notification; every optional-category email carries a working one-click unsubscribe. | FR-169 |
| BR-NOT-7 | A transient send failure retries on a bounded schedule; a hard-bouncing address is suppressed and surfaced to the Organization Administrator. | FR-171 |
| BR-NOT-8 | Dispatch is asynchronous: no user-facing action blocks on delivery. | FR-172 |

---

## 5. Data requirements and key entities

The sources specify data obligations only where a functional requirement carries one. This section lists the entities the requirements touch and the attributes the requirements name. It is not a data model: no cardinality, key, type or relationship is stated here that a requirement does not state, and no entity is introduced that no requirement touches.

Two schema-level obligations bound everything below: FR-155 requires that internal field names and structure mirror VSME taxonomy elements rather than a custom schema (NFR-2), and FR-154 requires that no compliance-core entity depend on plan, price or tenant type (D-11, NFR-1).

### 5.1 Identity, profile and organization

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Account | Credential(s) held, verified/unverified state, expiry of unverified accounts | FR-1, FR-2, FR-3 |
| Provider identity | Provider, subject identifier, asserted email, asserted-verified flag | FR-2, FR-4, FR-8 |
| Session | Scope over organization memberships and roles, server-side termination | FR-4, FR-5 |
| Password reset token | Single-use, time-limited | FR-6 |
| User profile | Display name, contact email, notification preferences, interface language | FR-9, FR-10, FR-163 |
| Membership | User, organization, role (edit / view-only / Organization Administrator), status, last activity | FR-11, FR-12, FR-56, FR-58, FR-60 |
| Invitation | Invited email, assigned role, single-use, expiry, revocation state | FR-11, FR-57 |
| Organization | Legal form, registered name, registered address, contact details | FR-15 |
| Organization relationship | Type (parent / child / peer), organization type (direct SME active at MVP) | FR-14 |
| Entity identifier | LEI (primary), DUNS / EU ID / PermID (fallback), format and checksum validity | FR-16 |

### 5.2 Reporting

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Reporting entity | Legal form, NACE code(s), site locations, archived state | FR-17, FR-20 |
| Consolidation scope | Basis (individual / consolidated), in-boundary subsidiaries | FR-19 |
| Entity master data version | Point-in-time values in force per period | FR-18 |
| Reporting period | Fiscal year, start and end dates, optional due date, pinned template and taxonomy version, link to preceding period, locked/reopened state with reason | FR-21, FR-22, FR-66 |
| Report / disclosure field value | Value, unit, applicability state, validation state, carried-forward marker, nil-return marker | FR-24, FR-29, FR-30, FR-40, FR-47 |
| Not-material / not-applicable declaration | Section, rationale | FR-31 |
| Not-available declaration | Field, stated reason | FR-32 |
| Field change record | Acting user, timestamp, previous value | FR-54, FR-55, FR-159 |
| Validation finding | Rule, state, affected field, message | FR-40, FR-42, FR-73 |
| Energy / fuel consumption input | Source, site, quantity, invoice unit | FR-33 |
| Emission factor set | Version, effective date, factors | FR-71, FR-35 |
| Computed emission result | Scope 1, location-based Scope 2, GHG intensity, factor set version | FR-34, FR-35 |
| Override record | Overriding value, flag, acting user, superseded computed value | FR-36 |
| Export record | Format, language, taxonomy version, timestamp, generating user, immutable artefact | FR-53, FR-49, FR-50 |

### 5.3 Platform content and versioning

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Content string | Key, locale, value, version — help-centre articles and plan presentation copy only; catalogue text is a committed message file, not a row (19 Aug 2026, architecture.md OQ-43) | FR-61, FR-62 |
| Translation set publication | Version, published state, reversibility | FR-62 |
| Locale registration | Interface and export availability. The registry itself is `packages/i18n`; a registration records which locales are offered | FR-63 |
| Fallback log entry | Content key, locale — FR-61 content only; catalogue gaps fail the build instead (FR-64 as amended) | FR-64, FR-10 |
| Template / taxonomy version | Artefact, backwards-compatibility determination | FR-65 |
| Field mapping | Outgoing version, incoming version, added / removed / semantically altered fields | FR-67 |
| Migration run | Selected reports, mode (bulk / per-report review), pre-migration state | FR-69, FR-68 |
| Applicability threshold | Threshold values as configuration | FR-72 |
| Validation rule definition | Rule, message | FR-73 |
| Support-access grant | Requester, organization, reason, ticket reference, expiry | FR-78, FR-79 |
| Platform administrator account | Privilege level, active state | FR-80, FR-75 |
| System audit log entry | Event class, actor, timestamp | FR-81, FR-159 |

### 5.4 Commercial and fiscal

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Plan / plan version | Code, description, positioning, version, published / retired state, grandfathering choice | FR-84, FR-87, FR-88 |
| Entitlement / quota | Entities, seats, reports per period, exports by format, API allowance, module access, support tier | FR-85 |
| Price | Plan version, currency, billing cycle, amount | FR-86 |
| Discount code | Percentage or fixed, first-period or recurring, validity dates, redemption limits, plan eligibility | FR-89, FR-109 |
| Trial terms | Length, payment-instrument requirement, expiry behaviour, per plan version | FR-89, FR-93 |
| Subscription | State (trialling / active / past due / suspended / cancelled / lapsed), plan version, entitlements, billing cycle, renewal or expiry date, next amount due, auto-renewal flag | FR-90, FR-97 |
| Entitlement override | Additive per-subscription overrides from contract | FR-145, FR-144 |
| Subscription change record | Change class, date, acting user, resulting entitlements | FR-98 |
| Metering event | Organization, action type, quantity, timestamp; append-only | FR-105 |
| Billing account | Registered legal name, IDNO, VAT registration code, legal address, billing contact | FR-106, FR-107 |
| Order | State (draft / awaiting payment / paid / provisioned / expired / cancelled / failed), plan version, cycle, quantity, currency, net, VAT, gross, payment reference | FR-108, FR-110, FR-112 |
| Terms acceptance | Terms version, timestamp, acting user | FR-111 |
| Payment | Rail, acquirer transaction reference, masked descriptor, outcome | FR-114, FR-115, FR-116 |
| Stored payment instrument | Card token held by acquirer, recurring consent record, default flag | FR-117 |
| Proforma invoice | Payment reference, bank details, amount, validity date, void state | FR-121, FR-113 |
| Fiscal invoice | Number from series, supplier and buyer fiscal identifiers, service description, net, VAT rate and amount, total, immutable | FR-122, FR-123, FR-125 |
| Credit note / corrective invoice | Reference to original invoice | FR-125, FR-139 |
| Numbering series | Document type, fiscal year, gapless monotonic sequence | FR-123 |
| e-Factura transmission record | XML artefact, acknowledgement, platform identifier, rejection reason | FR-126, FR-127 |
| Exchange rate record | BNM official rate for the invoice date | FR-129 |
| Fiscal document archive | Documents and transmission receipts, immutable, statutory retention period | FR-130 |
| Bank statement import | Source (file / bank API), statement lines | FR-131 |
| Reconciliation match / exception | Matched invoice and order, exception class, resolution rationale | FR-132, FR-133 |
| Dunning state | Sequence position, intervals, stop-on-payment | FR-135 |
| Write-off | Reason, accounting treatment | FR-138 |
| Refund | Full or partial, rail, associated credit note | FR-139 |
| Chargeback case | Case record, evidence pack, outcome | FR-140 |
| Quote | Negotiated entitlement set, price, currency, billing schedule, validity date | FR-143 |
| Contract | Term length, notice period, negotiated entitlements, SLA, price protection, non-standard clauses | FR-144, FR-147 |
| Purchase-order reference | Customer PO or contract reference on subscription and invoices | FR-146 |
| Billing schedule | Annual in advance / semi-annual / milestone-based / multi-year instalment | FR-147 |
| VAT rate and rule | Rate, selection rule by residency and VAT status, effective date | FR-148 |
| Billing audit ledger entry | Event class, actor, timestamp, superseding entry | FR-151 |
| Settlement report reconciliation | Acquirer and instant-rail settlements, missing settlements, fee discrepancies, timing differences | FR-152 |

### 5.5 Notifications

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Notification | Category, subject reference, recipients, state (raised / delivered / read / cancelled), deep link | FR-160, FR-162, FR-167 |
| Delivery record | Notification, recipient, channel, dispatch timestamp, outcome, read state (in-app) | FR-170, FR-171 |
| Notification preference | User, category, channel, suppressible or mandatory | FR-163 |
| Notification category catalogue | Default channels, transactional-or-optional classification, deadline lead times, repeat interval. Template wording resolves from the message catalogue by category key (FR-173 as amended) | FR-173 |
| Suppression record | Hard-bounced address, visibility to Organization Administrator | FR-171 |

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
| Declared exclusions in output | FR-31 | Not-material and not-applicable declarations with rationale appear in both formats. |
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

| FR ID | Was (source) | Domain | Requirement | Phase | Deferral rationale |
|---|---|---|---|---|---|
| FR-176 | FR-160 | Export | Convert stored data to Inline XBRL, XBRL-JSON and XBRL-CSV through EFRAG's self-hosted open-source converter | P2 | XBRL export is a Phase 2 exclusion by prior decision; the MVP export target is the Excel Digital Template (FR-50), and the converter is placed behind an internal interface so the addition is additive (FR-156, NFR-11). |
| FR-177 | FR-161 | Report authoring | Support the VSME Comprehensive Module [C1–C9] as an additive extension of Basic | **MVP** | **Promoted 25 Aug 2026 — no longer deferred** (`problem_overview.md` OQ-12, project owner). The requirement text is unchanged and now also carries a row in §3.5, where MVP report-authoring requirements live; this row is retained so the FR-176 … FR-189 range stays contiguous and OQ-1's `Was (source)` mapping survives. The original deferral rationale still holds and is now the *implementation* argument rather than a scheduling one: the internal schema already mirrors VSME element names including C1–C9 (FR-155, NFR-2), so the module is additive rather than a rework. |
| FR-178 | FR-162 | Reporting oversight | Provide completion-status dashboards with deadline reminders | P2 | Deferred by prior decision. The MVP substitutes are the organization-wide status overview (FR-23) and the deadline notice (FR-165). |
| FR-179 | FR-163 | Comparatives | Provide a standalone year-over-year analytics view across periods and entities | P2 | D-3: comparative storage and inline display are MVP (FR-45, FR-46, FR-47); only the standalone analytics view is deferred. |
| FR-180 | FR-164 | Identity | Support enterprise SSO — federated SAML/OIDC against a customer's own directory, with domain claiming, just-in-time provisioning and directory-driven deprovisioning — distinct from the social sign-in in MVP scope | P2 | D-6: social sign-in is MVP, enterprise SSO is not. It becomes relevant when Advisor and Corporate Buyer organizations arrive; the provider-agnostic identity model keeps it a provider registration rather than a rework. |
| FR-181 | FR-165 | Identity | **Partly superseded 18 Aug 2026.** *Opt-in* TOTP for tenant users is now MVP scope — NFR-95, promoted into `non_functional_requirements.md` §4.5. What remains deferred is **enforced** MFA: organization-level policy, mandatory enrolment and recovery administration. PA MFA remains mandatory (FR-75) | P2 | Deferred for tenant users by prior decision; mandatory now only for the role with cross-organization visibility (FR-75). |
| FR-182 | FR-166 | Advisor | Manage a portfolio of client organizations from one login, completing or reviewing a report on a client's behalf | P2/P3 | Phase 2/3 actor capability. The typed organization relationship model is built at MVP so the actor type is added without a schema change (FR-14, NFR-9). Sequencing is demand-driven on the MVP success metrics (FR-83). |
| FR-183 | FR-167 | Corporate buyer | Invite and monitor supplier organizations, view aggregated and benchmarked dashboards, and request a supplier's VSME data with consent | P2/P3 | As FR-166: Phase 2/3 actor capability anticipated by FR-14 / NFR-9, sequencing demand-driven. |
| FR-184 | FR-168 | Licensee | Administer a white-labelled instance — branding, domain, language pack — and the sub-organizations under it | P2/P3 | Phase 2/3 actor capability; this is where the re-scoped Moldova/MDED licensing scenario sits. Anticipated by FR-14 / NFR-9 and by locale registration (FR-63, NFR-4). |
| FR-185 | FR-169 | Billing | Support usage-based and metered pricing units, for which FR-105 already emits the events and NFR-10 already requires multi-unit entitlement | P2 | Usage-based pricing is not offered at MVP by prior decision, but the event stream (FR-105) and multi-unit entitlement (NFR-10) exist so activation is additive. |
| FR-186 | FR-170 | Billing | Support reseller and partner commission handling for the Model 3 and Model 5 monetization scenarios | P2/P3 | Belongs with the Model 3 and Model 5 monetization scenarios, which are not activated at MVP. |
| FR-187 | FR-171 | Data ingestion | Support pluggable connectors for energy-provider and accounting-software data ingestion | P3 | Phase 3 exclusion. MVP captures consumption by manual entry in invoice units (FR-33); connectors sit behind the internal-interface rule (FR-156). |
| FR-188 | FR-172 | Report authoring | Provide AI-assisted narrative drafting for qualitative fields [B2/C2] with mandatory human review before save, authorship remaining with the company | P3 | Phase 3 exclusion. NFR-6 constrains any AI feature: no training on submitted customer data and a stated deletion/retention policy. |
| FR-189 | FR-173 | Report authoring | Optionally call an external document-risk-flagging service (e.g. IFC MALENA) to surface advisory-only consistency warnings on narrative disclosures | P3 | Phase 3 exclusion; advisory-only by design. Vendor sits behind the internal-interface rule (FR-156, NFR-11). |
| FR-174 | unchanged | Public disclosure | Provide an opt-in, searchable public disclosure portal, field-structured to align with anticipated ESAP requirements | P3 | Phase 3 exclusion; opt-in by design and structured now only in anticipation of ESAP. |
| FR-175 | unchanged | Submission | Provide an ESAP-compatible submission bridge | Roadmap | Not committed. Recorded as a roadmap placeholder; needs a concrete problem statement before being scoped. |

**Count:** 16 deferred requirements — 11 at P2 or P2/P3, 4 at P3, 1 Roadmap (not committed). Of these, 14 carry IDs that collide with MVP requirements.

**Excluded outright, with no requirement written against them** (design decisions document, section 4): multi-currency price-list automation (prices are authored per currency by hand, D-14); direct debit and standing-order mandates (the transfer-plus-reconciliation path covers the same need); virtual cash register and eBon digital receipt integration (the platform sells B2B to registered companies); full double-entry accounting (the platform maintains a billing ledger and exports to the customer's accounting system, FR-150); in-product payment collection on behalf of customers (raises payment-institution licensing questions beyond this scope); blockchain traceability (uncommitted, no problem statement).

---

## 9. Coverage and traceability

### 9.1 UC → FR matrix

Every use case UC-01 … UC-176 in "ESG Platform Use Case Register (MVP)" maps to at least one MVP functional requirement. The matrix below is derived from the `Source UC` column of section 3 and is the forward check.

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
| UC-20 | RC | FR-24 (via the `UC-19 … UC-29` range only — see 9.4) |
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

### 9.2 FR → UC reverse check

The reverse index below restates the `Source UC` column of section 3 in one place. 165 of the 173 MVP requirements trace to at least one use case; the 8 that do not are listed in section 9.4.

FR-1→UC-01 · FR-2→UC-02 · FR-3→UC-03 · FR-4→UC-04, UC-05 · FR-5→UC-06, UC-07 · FR-6→UC-08, UC-09 · FR-7→UC-10 · FR-8→UC-11, UC-12 · FR-9→UC-13, UC-168 · FR-10→UC-14 · FR-11→UC-15 · FR-12→UC-16 · FR-13→UC-49 · FR-14→UC-49 · FR-15→UC-50 · FR-16→UC-51 · FR-17→UC-52, UC-53 · FR-18→UC-53 · FR-19→UC-54 · FR-20→UC-55 · FR-21→UC-56 · FR-22→UC-57, UC-58 · FR-23→UC-67 · FR-24→UC-18, UC-19 … UC-29 · FR-25→UC-17 · FR-26→UC-18 · FR-27→UC-19 · FR-28→UC-19, UC-23, UC-24, UC-26, UC-28 · FR-29→UC-21, UC-22, UC-24, UC-25, UC-26, UC-28 · FR-30→UC-27, UC-29 · FR-31→UC-30 · FR-32→UC-31 · FR-33→UC-32 · FR-34→UC-33 · FR-35→UC-33 · FR-36→UC-34 · FR-37→UC-35 · FR-38→UC-35 · FR-39→UC-36 · FR-40→UC-37 · FR-41→UC-38 · FR-42→UC-39 · FR-43→UC-40 · FR-44→UC-42 · FR-45→UC-45, UC-56 · FR-46→UC-45 · FR-47→UC-46 · FR-48→UC-41 · FR-49→UC-42 · FR-50→UC-43 · FR-51→UC-43, UC-78 · FR-52→UC-48 · FR-53→UC-44 · FR-54→UC-47 · FR-55→UC-47, UC-63 · FR-56→UC-59 · FR-57→UC-60, UC-61 · FR-58→UC-62 · FR-59→UC-63 · FR-60→UC-64 · FR-61→UC-71 · FR-62→UC-72 · FR-63→UC-73 · FR-64→UC-14, UC-74 · FR-65→UC-75 · FR-66→UC-56, UC-75 · FR-67→UC-76 · FR-68→UC-77 · FR-69→UC-78 · FR-70→UC-79, UC-171 · FR-71→UC-80 · FR-72→UC-81 · FR-73→UC-82 · FR-74→UC-71, UC-81, UC-82 · FR-75→UC-68 · FR-76→UC-69 · FR-77→UC-69, UC-85 · FR-78→UC-85 · FR-79→UC-86 · FR-80→UC-87 · FR-81→UC-88 · FR-82→UC-70 · FR-83→UC-83, UC-84 · FR-84→UC-89 · FR-85→UC-90 · FR-86→UC-91 · FR-87→UC-92 · FR-88→UC-93 · FR-89→UC-94, UC-95 · FR-90→UC-65, UC-106 · FR-91→UC-96 · FR-92→UC-97 · FR-93→UC-98 · FR-94→UC-100, UC-101 · FR-95→UC-99 · FR-96→UC-102 · FR-97→UC-103, UC-104, UC-105 · FR-98→UC-107 · FR-99→UC-148 · FR-100→UC-148 · FR-101→UC-149 · FR-102→UC-150 · FR-103→UC-151 · FR-104→UC-142, UC-151 · FR-105→UC-66, UC-152 · FR-106→UC-108 · FR-107→UC-109 · FR-108→UC-110 · FR-109→UC-111 · FR-110→UC-112 · FR-111→UC-113 · FR-112→UC-114 · FR-113→UC-115 · FR-114→UC-116, UC-120, UC-121, UC-122 · FR-115→UC-116 · FR-116→UC-116, UC-117 · FR-117→UC-118, UC-119 · FR-118→UC-120 · FR-119→UC-121 · FR-120→UC-123, UC-124, UC-125 · FR-121→UC-126 · FR-122→UC-127 · FR-123→UC-134 · FR-124→UC-128 · FR-125→UC-133 · FR-126→UC-129 · FR-127→UC-130 · FR-128→UC-131, UC-132 · FR-129→UC-136 · FR-130→UC-135 · FR-131→UC-137 · FR-132→UC-138 · FR-133→UC-139 · FR-134→UC-140 · FR-135→UC-141 · FR-136→UC-142 · FR-137→UC-143 · FR-138→UC-144 · FR-139→UC-145 · FR-140→UC-146 · FR-141→UC-147 · FR-142→UC-153 · FR-143→UC-154 · FR-144→UC-155 · FR-145→UC-156 · FR-146→UC-157 · FR-147→UC-158, UC-159 · FR-148→UC-160 · FR-149→UC-161 · FR-150→UC-162 · FR-151→UC-163 · FR-152→UC-164 · **FR-153→none** · **FR-154→none** · **FR-155→none** · **FR-156→none** · **FR-157→none** · **FR-158→none** · **FR-159→none** · FR-160→UC-165, UC-172, UC-174 · FR-161→UC-165, UC-167 · FR-162→UC-166 · FR-163→UC-168 · FR-164→UC-169 · FR-165→UC-170 · FR-166→UC-171 · FR-167→UC-169, UC-170 · FR-168→UC-172 · FR-169→UC-173 · FR-170→UC-174 · FR-171→UC-174 · **FR-172→none** · FR-173→UC-175, UC-176

### 9.3 Where the two documents deliberately do not align one-to-one

Counting rows in the two registers gives **182** use cases against 173 requirements. The difference is not a gap; it is the sum of two intentional deviations — and, since 24 Aug 2026, one recorded one.

**Four of the six public-tier use cases originate no requirement** (UC-177, UC-178, UC-179, UC-182), which is G-9 in §9.4 rather than a third deviation: it is a gap the register acknowledges owing, not a place the two documents were designed to differ. The count ran to 176 against 173 before that date.

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
| G-2 | **FR-172 has no originating use case** and is marked `(architectural)`, but sits in the Notification delivery domain. The FR Deferred Scope document states that every MVP requirement "except the seven cross-cutting entries (FR-153 … FR-159)" traces to a use case — a statement written before FR-160 … FR-173 were added. | **Stale statement in the source, not a defect in the requirement.** The correct count is eight requirements without an originating use case. FR-172 traces to FR-157 as its parent obligation. Corrected in this baseline. |
| G-3 | **UC-20 (Complete B2 — Practices, policies and future initiatives) has no explicitly enumerated FR.** It is covered only by the `UC-19 … UC-29` range on FR-24. Every other Basic Module use case is additionally named explicitly on FR-28, FR-29, FR-30, FR-31 or FR-32. | **Weak but not absent.** B2 is the report's principal narrative module, and FR-24 requires structured and narrative content for a module to be captured together, so coverage exists. Recorded as OQ-4: consider naming UC-20 explicitly against FR-24 so the trace does not depend on reading a range. |
| G-4 | **No use case originates a requirement for NFR-5 (GDPR / Moldovan data protection, EU/EEA hosting) or NFR-8 (responsive across devices, scaling for fiscal year-end spikes).** | **Expected.** Both are non-functional by nature and neither source writes a functional requirement against them. FR-130 records the one place where fiscal retention overrides an erasure request, which is the only functional interaction with NFR-5 that any source states. Recorded as OQ-5. |
| G-5 | **NFR coverage for FR-160 … FR-173 does not exist.** The source register's closing note states that delivery latency, retry bounds, email deliverability and retention of delivery records are unspecified. | **Open item against the NFR document**, not against this baseline. Recorded as OQ-3. |
| G-6 | **UC-148 cites legacy `FR-23`** ("central entitlement/plan-check service plus metering events"), which in the current sequence is "Present an organization-wide overview of every entity and period". | **Reading key required**, section 9.5. The current requirements are FR-99, FR-100 and FR-105. |
| G-7 | **Design decision D-3 cites legacy `FR-15`** ("multi-period comparative records in a year-over-year view") and calls for its split; current FR-15 is the organization profile requirement. | **Reading key required**, section 9.5. The split is realised as FR-45, FR-46, FR-47 at MVP with the standalone analytics view deferred. |
| G-8 | **The FR Deferred Scope document states the register holds 159 MVP requirements and that "every use case UC-01 … UC-164" is covered.** | **Stale counts.** The register holds 173 and the use case register holds 176. Resolved in favour of the register (section 9.6, C-2 and C-3). |
| G-9 | **UC-177, UC-178, UC-179 and UC-182 originate no functional requirement.** Added 24 Aug 2026 with the Visitor actor (`design_spec.md` OQ-12): the marketing home, the legal documents, the cookie choice and the route to support have screens (S-29, S-30, S-31, S-34) and use cases, and no FR anywhere in this register describes them. UC-180 and UC-181 are covered — FR-61 already holds help-centre articles as versioned data. | **A real gap, recorded rather than closed by inventing numbers.** Three reasons it is not closed here. The MVP block is FR-1 … FR-173 and FR-174 … FR-189 are the deferred register, so a new MVP requirement would have to be numbered outside its own block — a scheme change, not a requirement. The legal-document obligation is discharged **non-functionally** and there is precedent for exactly that: G-4 records NFR-5 as having no FR at all, and §7.3 states the same disposition. And UC-182's delivery channel is undecided (`task.md` task 77), so an FR written now would specify a mechanism nobody has chosen. **What this costs:** four use cases whose acceptance criteria live in `design_spec.md` §5 rather than here, which is the weaker place for them. Owned by the requirements owner alongside `design_spec.md` OQ-12's cascade. |

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
| NFR-5 GDPR / Moldovan data protection, EU/EEA hosting | No functional requirement stated; FR-130 records the fiscal-retention precedence. See OQ-5. |
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
| OQ-5 | **Do NFR-5 and NFR-8 need functional requirements?** Neither GDPR / EU-EEA hosting nor responsiveness and year-end scaling has a functional requirement written against it, and the erasure-versus-retention interaction is stated only inside FR-130. Also logged in `non_functional_requirements.md` OQ-12. | G-4 | A data subject erasure request has one defined behaviour (fiscal documents are retained) and no defined behaviour for anything else. |
| OQ-6 | **Which monetization model is activated after MVP — Model 3 (Advisor), Model 4 (Corporate Buyer) or Model 6 (Licensee)?** The decision is explicitly demand-driven and gated on the MVP success metrics that FR-83 produces. Also logged in `use_cases.md` OQ-2, `actors.md` OQ-5, `problem_overview.md` OQ-11 and `architecture.md` OQ-24. | Combined document section 5; deferred FR-166, FR-167, FR-168 | The P2/P3 sequencing of three deferred capability clusters is undetermined. The architecture is required only not to block any of them (FR-14, NFR-9). |
| OQ-7 | **Blockchain traceability and the ESAP bridge remain uncommitted.** No requirement is written for blockchain traceability at all; FR-175 is a roadmap placeholder for ESAP. Both need a concrete problem statement before being scoped. Also logged in `use_cases.md` OQ-4. | Combined document section 5; design decisions section 4 | Nothing at MVP depends on either; the risk is only that a stakeholder expects them to be in scope. |
| OQ-8 | **The Assurance / Referral Partner actor (Model 5) is named but not use-cased.** It needs its own pass once a referral-partner list exists. Deferred FR-170 (reseller and partner commission handling) is the only requirement written against that direction. Also logged in `use_cases.md` OQ-3 and `actors.md` OQ-4. | Combined document sections 1.2 and 5 | A Phase 2/3 actor has requirements written for its commercial handling but no use cases describing what it does. |
| OQ-9 | **Which UI and copy source seeds FR-24?** No requirement specifies interface design, screen composition or field-level copy. The VSME field definitions in `moldova-guide/05_indicators.md` and `moldova-guide/04_report_structure.md` — project-knowledge documents outside this seven-document baseline — are named as the design input, but the handover is not a requirement. | Deferred Scope document section 4 | FR-24 is buildable as a mechanism but not as a screen until the field list and copy are drawn from the guide and published as content under FR-61. |

---

*Canonical functional requirements baseline. Consolidates "ESG Platform Functional Requirements (MVP)" and "ESG Platform Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)"; use case identifiers `UC-01` … `UC-176` and design decisions `D-1` … `D-14` follow `use_cases.md`; actor definitions follow `actors.md`. Supersedes section 3 (Functional Requirements) of "ESG Platform Actors, Use Cases, FR and NFR (MVP)"; that document's forward-looking actors and external systems are carried into `actors.md`, and its legacy NFR-1 … NFR-13 into `non_functional_requirements.md` §8. Non-functional requirements are not restated here; they are held in `non_functional_requirements.md`.*

