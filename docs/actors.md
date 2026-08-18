# ESG Platform — System Actors (MVP)

| Field | Value |
|---|---|
| Document ID | actors.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | "ESG Platform System Actors (MVP)" (primary, authoritative); "ESG Platform Actors, Use Cases, FR and NFR (MVP)" §1 (earlier combined doc); actor codes and actor-to-use-case mapping as extended by "ESG Platform Use Case Register (MVP)" |

---

## 1. Purpose and scope

System actors are the distinct roles the platform recognizes and grants permissions to. Each actor represents a boundary of access and responsibility within the system, not a job title — the same physical person can hold more than one actor role, but the platform still treats each role as a separate permission set. In a true micro-business the same human is routinely both the Organization Administrator and the Reporting Contributor; the platform does not collapse the two.

This document is the single canonical actor register for the MVP. It supersedes, in presentation, section 1 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)", retaining that document's content for the forward-looking actors (§1.2) and external systems (§1.3), which remain in force. Where the earlier combined document and the dedicated "System Actors (MVP)" document differ, the dedicated document governs; every such difference is recorded in §9.

Scope of the MVP for actor purposes is Model 1 — freemium, direct-to-SME, VSME Basic Module — with the organization/relationship model built generically from day one so that Advisor, Buyer and Licensee actor types can be introduced later without a schema migration (FR-14, NFR-9).

What this document does not contain: use case descriptions (see "ESG Platform Use Case Register (MVP)"), functional requirements (see "ESG Platform Functional Requirements (MVP)"), non-functional requirements, or interface design. Actor codes used here are normative and are cited unchanged by all of those documents.

---

## 2. Actor classification model

The sources use two orthogonal classifications. Neither is invented here.

**By nature of the actor (from "System Actors (MVP)" and the Use Case Register):**

| Type | Meaning | Actors |
|---|---|---|
| Human — tenant-side | A person acting inside a customer organization, scoped to that organization's data | RC, OA (and CA where the human is tenant-side) |
| Human — platform-side | A person on the internal team operating the platform, with cross-organization reach | PA, BO |
| Cross-role | Not a role in its own right: the account, credential and membership capabilities available to any authenticated user regardless of role | CA |
| System | Automated behaviour with no human initiator, but with a defined trigger, outcome and failure path that must be specified and tested | SYS |
| External system | A system the platform integrates with rather than a role it grants permissions to | See §7 |

**By phase and engagement (from the combined doc §1.1–§1.3):**

| Category | Meaning | Members |
|---|---|---|
| Primary — active at MVP | Drives an MVP flow; permissions are built and enforced now | RC, OA, PA (dedicated doc); CA, BO, SYS (as extended by the Use Case Register) |
| Forward-looking — Phase 2/3 | Named now so that schema and permissions anticipate them; explicitly not built at MVP | Advisor / Accountant; Corporate Buyer / Enterprise User; Institution / Licensee Admin; Assurance / Referral Partner |
| External systems | Integration counterparties, phased | EFRAG Excel Digital Template, EFRAG XBRL Converter, billing/metering provider, IFC MALENA API, energy providers / accounting software, ESAP |

**Note on identifiers.** The sources do not assign `ACT-*` numbers to actors. The canonical actor identifiers are the two-and-three-letter codes established in the Use Case Register and cited by the FR register and the interface specification: **CA, RC, OA, PA, BO, SYS**. Those codes are used as the ID column throughout this document. No `ACT-*` scheme has been introduced, because inventing one would break the citations already in force across four downstream documents.

---

## 3. Actor register

| ID | Actor | Type | Category | Description | Goals | Key use cases |
|---|---|---|---|---|---|---|
| **CA** | Common Access | Cross-role (human, any) | Primary — MVP | Any authenticated user, regardless of role. Account, credential and membership actions available to every actor below. | Get into the platform, keep the account usable and recoverable, belong to the right organization, control own notifications | UC-01 … UC-16, UC-165 … UC-168 |
| **RC** | Reporting Contributor | Human — tenant-side | Primary — MVP | Creates and edits Voluntary Sustainability Reporting Standard report content for one or more reporting entities: fills in Basic Module fields (B1–B11), runs the carbon footprint calculator, reviews field/section validation status, and generates PDF or Excel exports. Has no access to organization settings, user list, or billing/plan screens. | Produce a complete, defensible VSME report without being a sustainability specialist; not lose work between sessions; get a file out the door | UC-17 … UC-48 (report access, B1–B11 entry, carbon calculator, drafts, validation, export, comparatives, traceability) |
| **OA** | Organization Administrator | Human — tenant-side | Primary — MVP | Manages the organization account: legal entity data, identifiers (LEI/DUNS/EU ID), reporting periods, and the list of users with access to the org's reports, including their edit/view permissions. Views plan and entitlement status. Does not edit report field data directly. | Set the organization up correctly once; control who can see the organization's ESG data; know whether everything is ready before the deadline; manage plan, orders and invoices | UC-49 … UC-67, UC-96 … UC-108, UC-110 … UC-122, UC-132, UC-153, UC-157, UC-175 |
| **PA** | Platform Administrator | Human — platform-side | Primary — MVP | Maintains platform-wide content and infrastructure: translated field labels and help text, taxonomy/template version rollouts across all tenants, and usage/adoption metrics dashboards. Has cross-organization visibility but no access to any single org's report data beyond support requests. | Keep content, taxonomy versions, emission factors, thresholds and validation rules current without a release; know adoption; support customers without holding standing access to their data | UC-68 … UC-88, UC-176 |
| **BO** | Billing Operator | Human — platform-side | Primary — MVP (new actor: recommended addition to the System Actors doc) | Internal finance role: plan catalogue and pricing, invoice issuance and correction, bank reconciliation, collections, refunds, and fiscal reporting. Separated from PA because issuing a credit note and running a taxonomy migration are different privileges that should not sit in one account. | Bill correctly and fiscally compliantly under Moldovan rules; collect; keep an evidential ledger; keep the plan catalogue out of code | UC-89 … UC-95, UC-130, UC-133 … UC-135, UC-137, UC-139, UC-140, UC-144 … UC-146, UC-154 … UC-156, UC-158 … UC-164 |
| **SYS** | System (scheduled/event-driven) | System | Primary — MVP | Automated behaviour with no human initiator: recurring charge execution, dunning runs, entitlement evaluation, metering, e-Factura transmission, notification dispatch. Registered as use cases because each has a defined trigger, outcome, and failure path that must be specified and tested. | Execute on schedule and on event, idempotently, and terminate every run in something a human can see | UC-109, UC-123 … UC-129, UC-131, UC-136, UC-138, UC-141 … UC-143, UC-147 … UC-152, UC-169 … UC-174 |

Forward-looking actors are registered separately in §6; they carry no MVP permissions and no MVP use cases.

---

## 4. Detailed actor profiles

### CA — Common Access

**Description.** Not a role and not a permission level: the set of capabilities every authenticated user holds irrespective of which role they occupy in which organization. It exists as a distinct actor code because account, credential and membership behaviour is identical for a Reporting Contributor, an Organization Administrator, a Platform Administrator and a Billing Operator, and specifying it once prevents four divergent copies.

**Responsibilities.** Register (by email/password or a social identity provider), verify the email address, authenticate and re-authenticate, log out, manage own credentials including password reset/change and provider identity linking and unlinking, maintain own profile and interface language, accept an organization invitation, view memberships and switch the active organization, and operate the in-app notification centre and own notification preferences.

**Goals and motivations.** Reach the work with the least friction; never be locked out; keep one account across several organizations rather than one per engagement.

**Permissions and authority.** Own account and own credentials only. No organization data is reachable until email verification completes (UC-01, UC-03). Session scope is derived from organization memberships and roles (UC-04, UC-05); switching the active organization re-scopes all subsequent data access (UC-16). The system refuses removal of the last remaining credential (UC-12). Provider assertion alone never attaches to an existing account — the user must first authenticate with an existing credential (UC-11). Transactional notification categories — security, account, invoice delivery, payment failure — cannot be switched off (UC-168).

**Pain points.** Confusing platform logout with logout at the social provider on a shared computer (explicitly addressed in UC-06). Losing draft work to a session expiry (mitigated by UC-07, which returns the user to the exact screen and submits queued drafts). Account-collision confusion when social registration is attempted with an already-registered address (UC-02 → UC-11).

**Interaction channels.** Web interface; email (verification, reset, invitation, notifications); social identity providers (Google, Microsoft) as authentication channel; in-app notification centre.

**Volume and frequency.** Every session, for every user. Per the interface specification, most users will hold exactly one organization membership at MVP even though multi-membership is supported from day one (UC-16). 20 of the 176 registered use cases belong to this actor.

### RC — Reporting Contributor

**Description.** The person filling in the VSME report — typically an owner, office manager, bookkeeper or external accountant, not a sustainability specialist. This actor is the primary reason the platform exists, and the guided wizard is effectively the whole product from this actor's point of view.

**Responsibilities.** See the reporting entities and periods open to them with completion and validation summaries; open a report and enter the wizard at the first incomplete step; complete Basic Module disclosures B1 through B11; declare a section not material/not applicable with rationale, or an individual field not available with reason; enter energy and fuel consumption and run the Scope 1 / location-based Scope 2 calculation; review, annotate or override calculated emissions; rely on autosave and lossless resumption; read field-, section- and report-level validation state, navigate from finding to field, and re-run validation; preview the assembled report; export to PDF and to the EFRAG Excel Digital Template; re-download previous exports; view prior-period values and carry unchanged values forward; view the per-field change history; and select the export language independently of the interface language.

**Goals and motivations.** Produce a report a bank, buyer or grant programme will accept, without prior ESG knowledge and without a consultant. Answer each question once. Be able to stop and come back weeks later. Get an English report out of a Romanian-language working session.

**Permissions and authority.** Report content within the active organization, bounded by per-report edit-or-view-only permission set by the OA (UC-17, UC-18) and by whether the reporting period is open rather than locked (UC-57). Explicitly no access to organization settings, the user list, or billing/plan screens. May override a computed emissions figure, but the override is flagged, attributed, and retains the superseded computed value (UC-34). May export with unresolved validation findings, after an explicit warning, with gaps visibly marked rather than silently omitted (UC-42). Cannot edit a locked period; cannot alter the change history.

**Pain points.** No domain expertise — the wizard must be answerable without prior knowledge. Intermittent work spread over weeks, so any data loss is fatal to completion (UC-35, UC-36). A long report across eleven modules is hard to navigate, hence finding-to-field navigation (UC-39). Fields that do not apply, and data that genuinely does not exist yet, must have a legitimate terminal state rather than looking like negligence (UC-30, UC-31). Version drift: a report pinned to a superseded template must not fail silently at export (UC-43).

**Interaction channels.** Web wizard on desktop or laptop (per the interface specification, ≥ 1024 px, tablet for review; data entry is deliberately not mobile-first); generated PDF and Excel files; email and in-app notifications for outstanding-report and deadline notices (UC-169, UC-170).

**Volume and frequency.** Weeks of intermittent sessions, once a year, per the interface specification. Concentration is around fiscal year-end reporting deadlines, which is the load-spike case NFR-8 exists for. 32 of the 176 registered use cases belong to this actor.

### OA — Organization Administrator

**Description.** The owner or finance lead who sets the organization up and holds commercial and access authority over it. Frequently the same human as the RC in a micro-business, but a separate permission set and — per the interface specification — a separate administration mode rather than a permission-filtered variant of the report.

**Responsibilities.** Create the organization and be granted the OA role over it; maintain the organization profile and entity identifiers; create, edit, consolidate and archive reporting entities; open, lock and reopen reporting periods; view the organization's users and access levels; invite, resend, revoke, re-role and remove users, and promote another member to OA; view plan and entitlement status, usage counters against quota, and the organization-wide report status overview; maintain billing account and fiscal details; compare plans, start a trial or paid subscription, change cycle, upgrade, downgrade, add or remove billable units, control auto-renewal, cancel, reactivate, and review subscription status and change history; place, discount, review, confirm, track and cancel orders; pay by domestic card, MIA instant payment, or bank transfer against a proforma, including 3-D Secure and saved-instrument management; view and download invoices; request an Enterprise quote and record a purchase order reference; and send a manual reminder to a user.

**Goals and motivations.** Get the entity, identifier and period structure right once, because those values propagate into every report. Be able to answer "who can see our ESG data" from one screen. Know before the deadline whether everything is ready. Understand exactly what a charge consists of and what a downgrade will cost them in access.

**Permissions and authority.** Full authority over the organization account, its entities, its periods, its members' roles, and its commercial relationship with the platform. Does not edit report field data directly. Locking a period makes it read-only for RCs; reopening one is recorded with acting user, timestamp and stated reason (UC-57, UC-58). Removing a user ends access but does not erase their attributed contributions from the change history (UC-63). Promotion of a second OA exists specifically to prevent single-admin lockout (UC-64). Enterprise terms never pass through self-serve checkout — the OA can request a quote but not provision Enterprise (UC-153, and provisioning sits with BO under UC-156).

**Pain points.** Single-admin lockout when the only administrator leaves. Discovering a quota wall at a reporting deadline rather than in advance (mitigated by UC-66, UC-149). Discovering at suspension that a card expired (UC-125, UC-119). Asynchronous settlement on the bank transfer rail, where the OA needs to know what is outstanding and what reference to quote (UC-114, UC-121). Downgrade consequences must be visible before the downgrade, not after (UC-101, UC-151). A fiscal invoice carrying an invalid IDNO cannot be corrected by editing (UC-109, UC-133).

**Interaction channels.** Web administration mode on desktop; email (invitations, invoices, dunning, payment-failure, deadline and quota notices); external acquirer hosted payment pages and SDKs (maib, Victoriabank, MICB), the MIA instant rail, and their own bank for transfers; downloaded proforma and fiscal invoices; the national e-Factura platform as the recipient channel for issued invoices.

**Volume and frequency.** Per the interface specification: an initial setup burst, then oversight, plus billing events. 49 of the 176 registered use cases belong to this actor — the largest single share, because the entire tenant-side commercial surface sits here.

### PA — Platform Administrator

**Description.** The internal team operating the platform: content and translation, taxonomy-version rollouts, calculation rules, usage monitoring and support. Work is campaign-shaped — a publish, a migration — rather than continuous.

**Responsibilities.** Log in through a separate administrative surface with MFA; browse and search the organization register at account-metadata level; manage social identity provider configuration and credential rotation; create, edit and publish translatable content, register additional locales, and work the untranslated-key queue; register new taxonomy/template versions, define inter-version field mappings, identify reports on superseded versions, execute migration runs and notify affected organizations; maintain the versioned emission factor set, the conditional-applicability thresholds, and the validation rule definitions; view and export adoption and usage metrics; raise time-boxed support access requests and review the support-access audit log; manage platform administrator accounts and privilege levels; review the platform-wide system audit log; and maintain notification categories and templates.

**Goals and motivations.** Make wording, thresholds, factors, validation rules and locales changeable as data rather than code, which is what makes a quarterly regulatory-watch cadence sustainable (NFR-12). Know the exposure before attempting a migration. Support a customer without acquiring standing access to their data. Provide the evidence base for the Phase 2 go/no-go decision.

**Permissions and authority.** Platform-wide content, configuration and infrastructure across all tenants. Cross-organization visibility at account level — registration date, entity count, plan, activity — but not report content. No standing access to any organization's report data at any point; access for support is scoped, reasoned, ticket-referenced and automatically expiring (UC-85), and every grant is logged in a record that cannot be edited from within the console (UC-86). Migration is a versioned transformation with a preserved pre-migration state, never an in-place overwrite (UC-78). Content publication is explicit, versioned and reversible (UC-72). Privilege levels are separable, so a translator does not require the privileges of a taxonomy migration operator (UC-87). Explicitly does not hold billing authority — that is BO.

**Pain points.** Backwards-incompatible taxonomy releases that no automatic mapping resolves correctly (the February 2026 release is the reference case behind UC-76 and NFR-3). Low-volume metrics being read as reliable (UC-83 marks them low-confidence). An expiring or leaked identity-provider client secret becoming a platform-wide outage if rotation requires a redeploy (UC-70). Its own privilege being the one that most needs restraining (UC-85, UC-86).

**Interaction channels.** Separate administrative console on desktop, MFA-protected; content and translation console; migration and metrics tooling; outbound notices to affected organizations through the common notification mechanism (UC-79 → UC-171).

**Volume and frequency.** Campaign-shaped per the interface specification: bursts around a content publish, a taxonomy release, or a factor-set update, against a quarterly regulatory-watch cadence. 22 of the 176 registered use cases.

### BO — Billing Operator

**Description.** Internal finance. Registered as a distinct actor because issuing a credit note and running a taxonomy migration are different privileges that should not sit in one account. Flagged in the Use Case Register as a new actor and a recommended addition to the System Actors doc; this document adopts that recommendation (see §9).

**Responsibilities.** Define plans, their entitlements and quotas, and their prices per currency and cycle; version plans and decide grandfathering; publish or retire plans; define discounts and trial terms; resolve e-Factura transmission failures; issue credit notes and corrective invoices; maintain invoice numbering series and statutory archiving; import bank statements, resolve unmatched or partial payments, manually mark an invoice paid, and write off uncollectible debt; issue refunds and process chargebacks; prepare and issue Enterprise quotes, record signed contracts, provision Enterprise subscriptions from contract terms, bill on custom schedules and manage renewal and expiry; maintain VAT rates and tax rules; and view the revenue dashboard, export the revenue and VAT report for accounting, review the immutable billing audit ledger, and reconcile provider settlement against recorded payments.

**Goals and motivations.** Bill and collect under Moldovan fiscal law without a release for every rate or price change. Keep the ledger evidential. Know what was actually received, not only what was charged.

**Permissions and authority.** The billing and fiscal domain. Refund authority is separated from invoice issuance so that no single account can both raise a charge and reverse it (UC-145). Manually marking an invoice paid requires a reason and is written to the immutable billing audit ledger, being the single most abusable capability in the domain (UC-140, UC-163). An issued fiscal invoice can only be reversed by credit note (UC-133); a proforma can be voided because it is not a fiscal document (UC-115, UC-126). Invoice numbers are gapless and monotonic, allocated at issuance under a lock (UC-134). Statutory retention survives customer deletion requests — the point at which GDPR erasure defers to fiscal law (UC-135). Ledger entries are never edited or deleted, only superseded (UC-163). Enterprise entitlement overrides are additive data on the subscription rather than a bespoke plan per customer (UC-156). No authority over report content, taxonomy or platform content.

**Pain points.** Asynchronous settlement with no callback on the bank transfer rail, so without an imported statement the platform cannot know a customer has paid (UC-137, UC-138). e-Factura rejections that cannot be fixed by editing the invoice (UC-130). Acquirer settlement routinely differing from recorded payments (UC-164). Exchange-rate handling, where the MDL equivalent rather than the foreign amount is what the fiscal return is built from (UC-136).

**Interaction channels.** Internal billing console on desktop — per the interface specification, exception-queue design, keyboard-first, information-dense, at the opposite end of the density scale from RC; bank statement files and bank APIs; acquirer and instant-rail settlement reports; the national e-Factura platform; accounting exports.

**Volume and frequency.** Daily, in queues, per the interface specification. 27 of the 176 registered use cases.

### SYS — System (scheduled/event-driven)

**Description.** Automated behaviour with no human initiator. Registered as an actor with its own use cases because each automated behaviour has a defined trigger, outcome and failure path that must be specified and tested like any other.

**Responsibilities.** Validate fiscal identifiers; execute scheduled recurring charges and retry soft declines; notify payment failure; issue proforma and fiscal invoices, calculate VAT, transmit to e-Factura, deliver invoices, and record exchange rates; reconcile incoming payments; run dunning, restrict service after the grace period, and restore it on payment; reverse entitlements following a refund or chargeback; evaluate entitlement checks, warn on quota approach, handle quota-exceeded actions, apply the downgrade data-retention rule, and emit and store metering events; and raise outstanding-report, deadline and regulatory-change notifications, deliver them in-app and by email, and record delivery outcomes and handle failed sends.

**Goals and motivations.** None of its own; it exists to make scheduled and event-driven obligations explicit, testable and observable.

**Permissions and authority.** Acts with system authority within a defined trigger. Recurring charge attempts are idempotent against the renewal period so a retried job never double-bills (UC-123). Hard declines are not retried (UC-124). Entitlement decisions are centralised so a new plan or changed quota never requires changing the gated feature (UC-148, FR-99, FR-100). Restriction is read-only, never deletion — nothing is deleted on lapse, downgrade or suspension, and previously generated documents remain downloadable (UC-142, UC-151). Restoration on payment is automatic and does not require contacting support (UC-143). Reporting work in progress is never lost to a quota block (UC-150). Metering events are emitted for actions that are not currently billed, because the stream is the single source for usage counters, quota evaluation and adoption metrics (UC-152, FR-105).

**Pain points.** Not applicable. The relevant design constraint is that it has no interface, yet every SYS use case must terminate in something a human sees — a notification, a state change, or an exception in a queue with a named destination surface.

**Interaction channels.** Schedulers and event handlers; the metering event stream; the common notification mechanism (in-app and email); external acquirer, instant-rail and e-Factura interfaces; exception queues surfaced to BO and PA.

**Volume and frequency.** Continuous and event-driven; the highest-frequency actor by execution count. 26 of the 176 registered use cases.

---

## 5. Roles and permissions matrix

Legend: **Y** granted; **—** not granted; **R** read-only; **T** time-boxed and audited on request; **S** granted through the system rather than a human action. Every cell traces to a statement in the sources; nothing is inferred where the sources are silent, and silence is recorded in §10.

| Capability | CA | RC | OA | PA | BO | SYS |
|---|---|---|---|---|---|---|
| Own account, credentials, identity links | Y | Y (via CA) | Y (via CA) | Y (via CA) | Y (via CA) | — |
| Own profile, interface language, notification preferences | Y | Y (via CA) | Y (via CA) | Y (via CA) | Y (via CA) | — |
| Accept invitation; view memberships; switch active organization | Y | Y (via CA) | Y (via CA) | Y (via CA) | Y (via CA) | — |
| In-app notification centre (view, open, mark read) | Y | Y (via CA) | Y (via CA) | Y (via CA) | Y (via CA) | — |
| View accessible reporting entities and periods | — | Y | R (org-wide overview) | — | — | — |
| Edit report field data (B1–B11) | — | Y | — | — | — | — |
| Declare a section not material / a field not available | — | Y | — | — | — | — |
| Run the carbon calculator; override a computed figure | — | Y (override flagged and attributed) | — | — | — | S (computation) |
| View validation state and re-run validation | — | Y | R (rollup) | — | — | S (rollup input) |
| Export PDF / EFRAG Excel Digital Template; re-download exports | — | Y | — | — | — | — |
| View report change history | — | Y | — | — | — | — |
| Select export language independently of interface language | — | Y | — | — | — | — |
| Organization profile and entity identifiers | — | — | Y | R (account metadata only) | — | S (identifier validation) |
| Reporting entities: create, edit, consolidation scope, archive | — | — | Y | — | — | — |
| Reporting periods: open, lock, reopen | — | — | Y | — | — | — |
| Organization users: invite, re-role, remove, promote to OA | — | — | Y | — | — | — |
| Plan and entitlement status; usage counters | — | — | R | — | Y (catalogue side) | S (evaluation) |
| Subscription lifecycle: trial, start, upgrade, downgrade, cancel, reactivate | — | — | Y | — | Y (Enterprise provisioning only) | S (renewal, lapse) |
| Orders, checkout, discount application, terms acceptance | — | — | Y | — | — | — |
| Payment execution (card, MIA, bank transfer, saved instruments) | — | — | Y | — | — | S (recurring charge) |
| Billing account and fiscal identifiers | — | — | Y | — | — | S (validation) |
| View and download own invoices | — | — | Y | — | Y (all) | — |
| Plan catalogue, entitlements, pricing, versioning, discounts, trials | — | — | — | — | Y | — |
| Fiscal invoice issuance | — | — | — | — | — | S |
| Credit notes and corrective invoices; refunds; chargebacks | — | — | — | — | Y | S (entitlement reversal) |
| Invoice numbering series; statutory archiving | — | — | — | — | Y | — |
| Bank statement import; reconciliation exceptions; manual mark-paid; write-off | — | — | — | — | Y | S (automatic matching) |
| VAT rates and tax rules | — | — | — | — | Y | S (application) |
| Revenue dashboard, VAT/accounting export, billing audit ledger, settlement reconciliation | — | — | — | — | Y | — |
| Enterprise quote, contract record, custom billing schedule, renewal | — | — | R (request, PO reference) | — | Y | — |
| e-Factura transmission | — | — | — | — | Y (failure resolution) | S (transmission) |
| Translatable content, translation publication, locales, untranslated-key queue | — | — | — | Y | — | — |
| Taxonomy/template versions, field mapping, exposure view, migration runs | — | — | — | Y | — | — |
| Emission factor set, applicability thresholds, validation rule definitions | — | — | — | Y | — | — |
| Social identity provider configuration and credential rotation | — | — | — | Y | — | — |
| Organization register (account metadata, not report content) | — | — | — | Y | — | — |
| Access to a specific organization's report data | — | Y (own org) | — (no direct field edit) | T (UC-85, logged UC-86) | — | — |
| Adoption/usage metrics and metrics export | — | — | R (own org only) | Y | R (read alongside revenue) | S (metering) |
| Platform administrator accounts and privilege levels; platform audit log | — | — | — | Y | — | — |
| Notification categories and templates | — | — | — | Y | — | — |
| Send a manual reminder to a user | — | — | Y | — | — | S (scheduled notices) |
| Entitlement evaluation, quota handling, metering emission | — | — | — | — | — | S |

Supporting requirements: FR-25, FR-57, FR-58 (more than one user within an org may view/edit a shared report — the accessible-report list honouring per-report permissions, invitation with an edit or view-only role, and role change on an existing membership), FR-14 (typed organization relationships so Advisor/Buyer/Licensee types need no schema change), FR-99, FR-100, FR-105 (central entitlement/plan-check service and metering events), NFR-13 (RBAC per org/role, secure auth, authenticated API surface), NFR-9 (relationship model extensible to Advisor, Buyer, Licensee), NFR-7 (every disclosure field change attributable to user and timestamp).

---

## 6. Actors explicitly out of scope for the MVP

### 6.1 Forward-looking human actors (Phase 2/3)

Named so that schema and permissions anticipate them. Not built at MVP. Source: combined doc §1.2, which remains in force.

| Actor | Description | Monetization model it enables | Rationale for MVP exclusion |
|---|---|---|---|
| **Advisor / Accountant** | Manages ESG reporting on behalf of multiple client SME orgs from one login | Model 3 (B2B2B) | Which of Models 3/4/6 activates first after MVP is a demand-driven decision gated on MVP success metrics. Deliberately excluded from MVP capability; the generic org-relationship model (FR-14, NFR-9) is what keeps it addable without a schema migration. |
| **Corporate Buyer / Enterprise User** | Large, CSRD-obligated company monitoring VSME data submitted by its SME suppliers; consumes aggregated dashboards and benchmarking | Model 4 (value-chain monitoring) | As above. Requires consented cross-organization data sharing and aggregation, neither of which is an MVP concern for a single-tenant SME report. |
| **Institution / Licensee Admin** | Administers a white-labeled instance on behalf of a government, chamber of commerce or association — where the original Moldova/MDED scenario now sits | Model 6 (licensing / white-label) | As above. White-labelling (branding, domain, language pack, sub-org management) is a distinct product surface, re-scoped out of the direct-to-SME MVP. |
| **Assurance / Referral Partner** | Auditor, carbon-offset provider, or financing program receiving consented referrals from the platform | Model 5 (marketplace / referral) | Named but not use-cased. Needs its own pass once a referral-partner list exists. |

Also deliberately excluded at MVP, per the design decisions document: Advisor, Buyer and Licensee capability generally, enterprise SSO, and tenant MFA (MFA is required for PA on the administrative surface under UC-68, but is not offered to tenant actors).

### 6.2 Public / unauthenticated user

Not an MVP actor. A public disclosure portal is a Phase 3 item (FR-174), and browsing it is registered only as a forward-looking use case in the combined doc. No unauthenticated read surface exists at MVP.

### 6.3 Actors that are not actors

- **Support** as a separate role: folded into PA in the dedicated doc ("Platform Administrator"), where the combined doc named the actor "Platform Admin / Support". Support access is a time-boxed request within PA (UC-85), not a role.
- **Job titles** generally: owner, bookkeeper, office manager and external accountant are the typical humans behind RC and OA, not distinct permission sets.

---

## 7. External systems

Integration counterparties rather than roles the platform grants permissions to. Source: combined doc §1.3, which remains in force.

| System | Role | Phase |
|---|---|---|
| **EFRAG VSME Excel Digital Template** | Canonical export target; internal data is written into its named ranges | MVP |
| **EFRAG XBRL Converter** (MIT-licensed, self-hostable) | Converts filled template → Inline XBRL / XBRL-JSON / XBRL-CSV | Phase 2 |
| **Billing/metering provider** (Stripe-/Paddle-/Chargebee-style) | Receives metering events from the entitlement layer; not billing anything at MVP since the only plan is free, but the event stream should exist | MVP (stubbed), active P2+ |
| **IFC MALENA API** | Optional document-risk-flagging service for narrative disclosures | Phase 3 |
| **Energy providers / accounting software** | Data sources for auto-filled consumption/financial fields | Phase 3 |
| **ESAP** | Eventual regulatory submission target | Roadmap (not committed) |

The Use Case Register adds further MVP-active external counterparties not listed in the combined doc's §1.3 — the domestic acquiring banks (maib, Victoriabank, MICB), the MIA instant payment rail, the national e-Factura platform, the merchant-of-record adapter (registered but inactive at MVP), social identity providers (Google, Microsoft), and the email provider — each reached behind an internal provider adapter per NFR-11. These are recorded here for completeness; the authoritative treatment of each sits in the Use Case Register and design decisions documents.

---

## 8. Actor-to-use-case coverage summary

Against "ESG Platform Use Case Register (MVP)" — 176 use cases across 37 modules.

| ID | Actor | Use cases | Share | Ranges | Domain concentration |
|---|---|---|---|---|---|
| CA | Common Access | 20 | 11% | UC-01 … UC-16, UC-165 … UC-168 | Account, authentication, credentials, profile, membership, notification consumption |
| RC | Reporting Contributor | 32 | 18% | UC-17 … UC-48 | Report access, B1–B11 entry, carbon calculator, drafts, validation, export, comparatives, traceability |
| OA | Organization Administrator | 49 | 28% | UC-49 … UC-67, UC-96 … UC-108, UC-110 … UC-122, UC-132, UC-153, UC-157, UC-175 | Organization profile, entities, periods, users and access, plan oversight, subscription lifecycle, orders, payment, invoices, enterprise contracting |
| PA | Platform Administrator | 22 | 13% | UC-68 … UC-88, UC-176 | Admin access, identity providers, content and localization, taxonomy and versioning, calculation rules, metrics, support and audit, notification templates |
| BO | Billing Operator | 27 | 15% | UC-89 … UC-95, UC-130, UC-133 … UC-135, UC-137, UC-139, UC-140, UC-144 … UC-146, UC-154 … UC-156, UC-158 … UC-164 | Plan catalogue, invoicing corrections, reconciliation and collections, refunds and disputes, enterprise contracting, financial reporting and audit |
| SYS | System | 26 | 15% | UC-109, UC-123 … UC-129, UC-131, UC-136, UC-138, UC-141 … UC-143, UC-147 … UC-152, UC-169 … UC-174 | Recurring charges, invoicing automation, reconciliation matching, dunning and restriction, entitlement enforcement and metering, notification generation and delivery |

Structural split of the register: UC-01 … UC-88 cover the reporting platform, UC-89 … UC-164 the billing, payment and subscription domain, UC-165 … UC-176 notifications.

**Forward-looking actor coverage.** The combined doc §2.4 maps forward-looking actors to legacy use case identifiers: **UC-17** (Advisor — manage a portfolio of client orgs), **UC-18** (Buyer — invite/monitor supplier orgs, aggregated dashboards, consented data requests), **UC-19** (Licensee Admin — brand an instance, manage sub-orgs). These legacy identifiers collide numerically with RC use cases in the current register (see §9.3). No forward-looking actor has coverage in the current MVP register, which is correct: they are design targets, not build items.

**Coverage assertions.** Every MVP actor in §3 has at least one use case. No use case in the register lacks an actor. No MVP actor is defined without a corresponding capability row in §5. The Assurance / Referral Partner actor has no use case in any register, which the combined doc states explicitly as an open item (§10, OQ-4 below).

---

## 9. Conflicts between sources and their resolution

### 9.1 Actor names

The dedicated System Actors doc governs. Names in the earlier combined doc are superseded:

| Combined doc §1.1 (superseded) | Canonical name (dedicated doc) | Code |
|---|---|---|
| SME Report Preparer | Reporting Contributor | RC |
| SME Org Admin | Organization Administrator | OA |
| Platform Admin / Support | Platform Administrator | PA |

The combined doc's "/ Support" qualifier is dropped: support is a time-boxed access request within PA (UC-85), not part of the role name.

### 9.2 Actor set size

The dedicated doc lists three MVP actors (RC, OA, PA). The Use Case Register works with six codes, adding CA (Common Access), BO (Billing Operator) and SYS (System), and states explicitly that BO is a *new actor — recommended addition to the System Actors doc*. The FR register and the interface specification both cite all six as "System Actors (MVP) as extended by the use case register".

**Resolution.** All six are carried as canonical MVP actors here, since three downstream documents already depend on them and the dedicated doc's three-actor list predates the billing and notification domains. This is a genuine gap in the dedicated doc rather than a disagreement about substance: CA is a factoring of capabilities the dedicated doc's three actors all hold, SYS is automated behaviour the dedicated doc never addressed, and BO is a privilege separation the dedicated doc's PA definition does not contemplate. Recorded as an open question in §10.1 because the dedicated doc itself has not been amended.

### 9.3 Use case identifier collision

The combined doc §2 numbers use cases **UC-1 … UC-24**; the current register numbers them **UC-01 … UC-176**. The two schemes overlap numerically with different meanings — combined-doc UC-17/UC-18/UC-19 are the Advisor/Buyer/Licensee forward-looking cases, while register UC-17/UC-18/UC-19 are RC report-access and B1 entry. Both sets are preserved verbatim above and neither is renumbered. Any citation of a single- or double-digit UC number must state which document it refers to. Flagged in §10.

### 9.4 PA access to tenant report data

The dedicated doc: PA has "cross-organization visibility but no access to any single org's report data **beyond support requests**". The register: PA has "**no standing** access to any organization's report data", with support access being scoped, reasoned, ticket-referenced, automatically expiring and audited (UC-85, UC-86, decision D-5). Treated as a refinement rather than a conflict — the register specifies the mechanism the dedicated doc's phrase implies. The register's stricter formulation is the one to implement.

### 9.5 OA authority over commercial matters

The dedicated doc grants OA only "Views plan and entitlement status", consistent with an MVP where the sole plan is free. The register grants OA the full subscription, order, payment and invoice surface (UC-96 … UC-122, UC-132, UC-153, UC-157). The register is followed, and the dedicated doc's phrase is read as describing the free-plan state rather than bounding the role. Both statements are retained in §3 and §4 so the difference is visible.

### 9.6 Functional requirement identifiers

The combined doc §3 uses FR-1 … FR-23; the current FR register renumbers to a 176-use-case-derived set and declares this the one deliberate breach of the stable-ID rule, with `FR-23` and `FR-15` carrying different meanings across the two. **Every FR citation in sections 1–8 of this document now uses the current register (`FR-1` … `FR-175`).** The pre-consolidation citations and their current equivalents, per the mapping table in the FR register's own legacy-ID section, are:

| Pre-consolidation citation (combined doc) | Meaning | Current register |
|---|---|---|
| FR-22 | Typed organization relationship model | FR-14 |
| FR-23 | Central entitlement/plan-check service plus metering events | FR-99 (central check), FR-100 (gating held outside the gated feature), FR-105 (metering event stream) |
| FR-19 | Opt-in public disclosure portal (Phase 3) | FR-174 |
| FR-11 | More than one user per org viewing/editing a shared report | FR-25, FR-57, FR-58 — no single current FR carries it; the concern is split across the accessible-report list honouring per-report permissions (FR-25), invitation with an edit or view-only role (FR-57) and role change on an existing membership (FR-58) |
| FR-8 | Romanian and English for interface and exported labels | FR-63 (locale registration, RO and EN live at MVP); FR-10 and FR-52 carry the interface- and export-language selection |

NFR references in this document (NFR-7, NFR-9, NFR-11, NFR-12, NFR-13) are unchanged in meaning between the two registers.

### 9.7 Locale count

The combined doc and the dedicated doc treat Romanian and English as the live locales (FR-63, NFR-4, UC-14). The interface specification states three live locales, adding Russian as platform-authored with no official EFRAG standing. Not an actor-level conflict; noted because it affects PA's content scope (UC-73) and RC's export-language choice (UC-48).

---

## 10. Open questions

| ID | Question | Status / notes |
|---|---|---|
| OQ-1 | **Closed 18 Aug 2026 — this document supersedes the dedicated "System Actors (MVP)" doc, which is retired rather than amended.** All six actors — CA, RC, OA, PA, BO, SYS — are canonical here. | Of the two options the question offered, replacement is the correct one: the dedicated doc's three-actor list predates the billing and notification domains, so amending it would mean rewriting most of it to say what §1–§8 here already say. CA is a factoring of capabilities its three actors all held, SYS is automated behaviour it never addressed, and BO is a privilege separation its PA definition does not contemplate. "System Actors (MVP)" is now a superseded source, cited in the footer like the others. Also closed in `use_cases.md` OQ-1 and `functional_requirements.md` OQ-2. |
| OQ-2 | **Closed 18 Aug 2026 — no numbered actor scheme is introduced. The codes are the identifiers.** CA, RC, OA, PA, BO and SYS remain canonical and are the only permitted citation form. | Decided against adding one. Four documents cite actors by code; a numbered scheme would either break those citations or run alongside them as a second name for the same thing, which is worse than having one. The codes are already short, mnemonic and unambiguous — the properties a numbered scheme would have been introduced to provide. |
| OQ-3 | **Closed 18 Aug 2026 — convention set.** The current register is `UC-01` … `UC-176`, **zero-padded through UC-09**. Any reference to the superseded coarse set is written `UC-n (legacy)` and never bare. A bare `UC-n` always means the current register. | This costs nothing and removes the ambiguity without re-identifying anything. It also covers the specific case the question raised: the forward-looking actors' mapping — Advisor `UC-17 (legacy)`, Buyer `UC-18 (legacy)`, Licensee `UC-19 (legacy)` — is now readable without collision against the current UC-17 … UC-19. Re-identification into a reserved range is rejected as churn on a set that is superseded and will not grow. |
| OQ-4 | **The Assurance / Referral Partner actor is named but not use-cased.** | The combined doc states this needs its own pass once a referral-partner list exists. Its permission boundary — what a consented referral exposes, and to whom — is undefined. Also logged in `use_cases.md` OQ-3, `functional_requirements.md` OQ-8 |
| OQ-5 | **Whether Advisor, Corporate Buyer or Institution/Licensee Admin is built first is undecided and demand-driven.** | Gated on the MVP success metrics (UC-83, UC-84, UC-161). The actor definitions above are therefore deliberately descriptive rather than specified to build depth. Also logged in `use_cases.md` OQ-2, `functional_requirements.md` OQ-6, `problem_overview.md` OQ-11, `architecture.md` OQ-24 |
| OQ-6 | **BO's separation from PA is asserted but its account provisioning path is not specified.** | PA manages platform administrator accounts and privilege levels (UC-87); whether BO accounts are provisioned through that same mechanism — which would put BO's creation inside PA's authority, partly undoing the separation-of-duties argument — is not stated in any source. |
| OQ-7 | **RC's relationship to a locked period versus its own change history is only partly specified.** | UC-57 makes locked periods read-only for RC and UC-47 gives RC the per-field change history, but no source states whether an RC removed from an organization (UC-63) retains any read access to reports they contributed to. The sources confirm only that their attribution survives. |
| OQ-8 | **Closed 18 Aug 2026 — opt-in TOTP for tenant users is in MVP scope**, entered as NFR-95 in `non_functional_requirements.md` §4.5, promoted from the deferred register and restated as opt-in rather than enforced. PA MFA remains mandatory (UC-68, NFR-65). | Resolved. The asymmetry that made this worth re-testing — an OA holds payment-instrument and user-management authority — is answered by making TOTP available to every tenant user and prompting OA enrolment, without enforcing it. The identity model already supports it; the cost is a fraction of retrofitting after a first incident. Ratified per `architecture.md` §17.1 / `non_functional_requirements.md` C-3. |
| OQ-9 | **Closed 18 Aug 2026 — three live locales at MVP: Romanian (source), English and Russian**, each separately authored. Ratified into NFR-23 and FR-63. | Resolved. PA content scope is three locales on every content publish; RC export choice is three, with the Russian export carrying the platform-authored caveat (no EFRAG standing — confirmed, Russian is not in EFRAG's official label set). Also closed in `design_spec.md` OQ-1 and `non_functional_requirements.md` C-3. |

---

*Consolidates "ESG Platform System Actors (MVP)" (authoritative for actor definitions) and section 1 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" (authoritative for forward-looking actors and external systems). Actor codes and actor-to-use-case mapping follow "ESG Platform Use Case Register (MVP)"; frequency, device and density characterisations in section 4 follow "ESG Platform Interface and Interaction Design Specification (MVP)" section 2. Use cases follow "ESG Platform Use Case Register (MVP)". Functional requirement citations in sections 1–8 were renumbered into the current register (`FR-1` … `FR-175`) of "ESG Platform Functional Requirements (MVP)"; the pre-consolidation citations they replace are recorded in §9.6, and §9.1 and §9.6 deliberately retain legacy identifiers as the labelled legacy record. Design decisions follow "ESG Platform Use Case Design Decisions and Constraints (MVP)".*
