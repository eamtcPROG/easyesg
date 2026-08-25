# ESG Platform — Use Cases (MVP)

| Field | Value |
|---|---|
| Document ID | use_cases.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | "ESG Platform Use Case Register (MVP)", "ESG Platform Use Case Design Decisions and Constraints (MVP)", "ESG Platform System Actors (MVP)", "ESG Platform Actors, Use Cases, FR and NFR (MVP)" (use-case sections, superseded) |

---

## 1. Purpose and scope

This document is the canonical use case specification for the ESG Platform MVP. It consolidates the previously separate use case register and its companion design-decisions document into a single baseline, reconciled against the actor definitions and against the earlier combined requirements document that it supersedes.

A use case here is a single, distinct outcome an actor sets out to achieve in the platform, stated from the actor's point of view rather than the system's. Each one stands on its own: registering an account, verifying it, and logging in are three use cases, not one, because they have different preconditions, different failure modes, and can be designed, built, and tested independently. A use case is not a screen and not a feature — one screen may serve several use cases, and one use case may span several screens or run with no interface at all.

**In scope.** The 176 MVP use cases covering the reporting platform (UC-01 … UC-88), the billing, payment and subscription domain (UC-89 … UC-164), and notifications (UC-165 … UC-176); the design decisions `D-1` … `D-14` that resolve contradictions and gaps between them; the external Moldovan payment and fiscal constraints the billing use cases are shaped around; traceability from use case to actor and to functional requirement.

**Out of scope of this document.** The functional requirement statements themselves, held in `functional_requirements.md`; non-functional requirements, held in `non_functional_requirements.md`; interface and interaction design, held in `design_spec.md`; system decomposition, held in `architecture.md`. FR definitions and the FR → UC source mapping are held in `functional_requirements.md`.

**MVP framing.** The MVP is Model 1 — freemium, direct-to-SME, VSME Basic Module. Phase 2/3 actors and capabilities are recorded in section 7 as deferred, not as use cases, because the architecture principle established earlier is that the organization-relationship and entitlement layers are built generically from day one even though only one packaging is active.

---

## 2. Use case model conventions

**ID scheme.** Use case identifiers take the form `UC-nn`. Identifiers UC-01 … UC-09 are zero-padded; UC-10 … UC-182 are not. This is the form in which the identifiers were originally assigned and it is preserved verbatim. IDs are stable: they are never reused and never renumbered once assigned, so they can be cited from designs, backlog items, and test cases.

**Level.** Every entry in this register is a user-goal-level use case — a single distinct outcome, not a sub-step and not a business summary. Sub-steps that cannot fail, be built, or be tested independently are not registered as use cases; they appear inside a flow.

**Primary actor.** The primary actor is the *initiator* — the party whose goal the use case exists to serve and who sets it in motion. The initiator is not necessarily the only participant: a Billing Operator issues a credit note that an Organization Administrator receives, and both facts belong to the same use case. Where the initiator is the platform itself, acting on a schedule or an event rather than on a human instruction, the primary actor is `SYS`. Those are registered here rather than left implicit because each has a defined trigger, outcome, and failure path that must be specified and tested like any other use case.

**Actor codes.** Actor definitions follow "ESG Platform System Actors (MVP)" as extended by this register. The codes below are the actor identifiers used throughout; no other actor identifier scheme exists in the source set.

| Code | Actor | Definition | Source |
|---|---|---|---|
| **CA** | Common Access | Any authenticated user, regardless of role. Account, credential, and membership actions available to every actor below. | Access grouping introduced by the use case register; not a role in the System Actors doc |
| **RC** | Reporting Contributor | Creates and edits report content for one or more reporting entities. No access to organization settings, user list, or billing screens. | System Actors (MVP) |
| **OA** | Organization Administrator | Manages the organization account: legal entity data, identifiers, reporting periods, users and permissions. Does not edit report field data directly. | System Actors (MVP) |
| **PA** | Platform Administrator | Maintains platform-wide content and infrastructure across all tenants. No standing access to any organization's report data. | System Actors (MVP) |
| **BO** | Billing Operator | Internal finance role: plan catalogue and pricing, invoice issuance and correction, bank reconciliation, collections, refunds, and fiscal reporting. Separated from PA because issuing a credit note and running a taxonomy migration are different privileges that should not sit in one account. | Use case register — recommended addition to the System Actors doc |
| **SYS** | System (scheduled/event-driven) | Automated behaviour with no human initiator: recurring charge execution, dunning runs, entitlement evaluation, metering, e-Factura transmission, notification dispatch. | Use case register |
| **VI** | Visitor | A person who has not identified themselves, reading what the platform publishes for unidentified readers: the marketing home, the legal documents and the cookie choice, the help centre and its articles, and the route to support. Holds no session and reaches no tenant data. | Added 24 Aug 2026 by `design_spec.md` OQ-12; profiled in `actors.md` §4 |

**Module.** The module groups each use case with those it is functionally adjacent to. Modules are an organizing aid for reading, estimating, and assigning work; they are not a system boundary and carry no permission meaning of their own.

**Notation and fidelity rules applied in section 5.** The source register specifies use cases in brief form: an actor, a name, and a narrative description that embeds the preconditions, rules, alternate paths, and cross-references that matter. Section 5 decomposes each description into named fields without adding content. Consequently:

- A field is present only where the sources support it. Where a source use case states no exception path, no exception path is listed — the entry stays thin rather than being embellished.
- Main success scenarios restate the actions the source description states, in order. Where the source describes an outcome rather than a sequence, the scenario is short by design.
- `D-n` citations resolve to section 6. `FR-n` citations resolve to "ESG Platform Functional Requirements (MVP)". `UC-nn` cross-references resolve within this document.
- Related FRs are taken by inversion of the authoritative `Source UC` column of the FR register, not derived independently.

**Priority.** Every use case in this register is MVP scope. Where an MVP use case is deliberately built but inactive — UC-122 — that is stated in its entry. Capabilities that are not MVP are not registered as use cases at all; they are listed in section 7.

---

## 3. Use case register

Priority is MVP for every entry. "Related FRs" inverts the `Source UC` column of "ESG Platform Functional Requirements (MVP)".

| ID | Name | Primary actor | Goal | Priority | Related FRs |
|---|---|---|---|---|---|
| UC-01 | Register a user account with email and password | CA | Obtain an account by supplying email and password | MVP | FR-1 |
| UC-02 | Register with a social identity provider | CA | Obtain an account by authenticating with Google or Microsoft | MVP | FR-2 |
| UC-03 | Verify email address | CA | Prove control of the registered address and activate the account | MVP | FR-3 |
| UC-04 | Log in with email and password | CA | Obtain a session scoped to the user's memberships and roles | MVP | FR-4 |
| UC-05 | Log in with a social identity provider | CA | Obtain a session through a linked provider identity | MVP | FR-4 |
| UC-06 | Log out | CA | Terminate the session server-side | MVP | FR-5 |
| UC-07 | Re-authenticate after session expiry | CA | Resume work at the exact point the session ended | MVP | FR-5 |
| UC-08 | Request a password reset | CA | Obtain a reset link without revealing whether the address is registered | MVP | FR-6 |
| UC-09 | Set a new password via reset link | CA | Regain access with a new password and invalidate old sessions | MVP | FR-6 |
| UC-10 | Change own password | CA | Replace the current password while authenticated | MVP | FR-7 |
| UC-11 | Link a social identity provider to an existing account | CA | Add a provider credential to an account already held | MVP | FR-8 |
| UC-12 | Unlink a social identity provider | CA | Remove a provider credential without losing account access | MVP | FR-8 |
| UC-13 | View and edit own user profile | CA | Maintain personal display name, contact email, notification preferences | MVP | FR-9 |
| UC-14 | Set preferred interface language | CA | Persist Romanian or English as the interface language | MVP | FR-10, FR-64 |
| UC-15 | Accept an invitation to join an organization | CA | Gain the assigned role in the inviting organization | MVP | FR-11 |
| UC-16 | View memberships and switch active organization | CA | Select which organization the session is scoped to | MVP | FR-12 |
| UC-17 | View accessible reporting entities and periods | RC | See which reports are open to the user and their status | MVP | FR-25 |
| UC-18 | Open a report for editing | RC | Enter the guided wizard at the first incomplete step | MVP | FR-24, FR-26 |
| UC-19 | Complete B1 — Basis for preparation | RC | Record the basis-for-preparation disclosure that drives applicability | MVP | FR-24, FR-27, FR-28 |
| UC-20 | Complete B2 — Practices, policies and future initiatives | RC | Record sustainability policies, practices, targets and initiatives | MVP | FR-24 |
| UC-21 | Complete B3 — Energy and GHG emissions | RC | Report energy consumption, Scope 1 and 2 emissions, GHG intensity | MVP | FR-24, FR-29 |
| UC-22 | Complete B4 — Pollution | RC | Report or explicitly exclude emissions to air, water and soil | MVP | FR-24, FR-29 |
| UC-23 | Complete B5 — Biodiversity | RC | Disclose site proximity to biodiversity-sensitive areas | MVP | FR-24, FR-28 |
| UC-24 | Complete B6 — Water | RC | Report water withdrawal, high-stress share and consumption | MVP | FR-24, FR-28, FR-29 |
| UC-25 | Complete B7 — Resource use, circular economy and waste | RC | Report circularity practices and waste quantities | MVP | FR-24, FR-29 |
| UC-26 | Complete B8 — Workforce characteristics | RC | Report headcount and FTE by contract type, gender and country | MVP | FR-24, FR-28, FR-29 |
| UC-27 | Complete B9 — Health and safety | RC | Report recordable accidents, accident rate and fatalities | MVP | FR-24, FR-30 |
| UC-28 | Complete B10 — Remuneration, collective bargaining and training | RC | Report wage floor compliance, bargaining coverage and training hours | MVP | FR-24, FR-28, FR-29 |
| UC-29 | Complete B11 — Corruption and bribery | RC | Report convictions and fines for corruption and bribery | MVP | FR-24, FR-30 |
| UC-30 | Declare a section not material or not applicable | RC | Record a reasoned exclusion that satisfies validation | MVP | FR-31 |
| UC-31 | Declare an individual field not available, with reason | RC | Record an explained gap as a valid terminal field state | MVP | FR-32 |
| UC-32 | Enter energy and fuel consumption data | RC | Capture consumption by source and site in invoice units | MVP | FR-33 |
| UC-33 | Calculate Scope 1 and location-based Scope 2 emissions | RC | Obtain computed emissions written into B3 | MVP | FR-34, FR-35 |
| UC-34 | Review, annotate or override calculated emissions | RC | Accept, explain or replace a computed emissions figure | MVP | FR-36 |
| UC-35 | Autosave in-progress report data | RC | Have every field change persisted without an explicit save | MVP | FR-37, FR-38 |
| UC-36 | Resume an in-progress report draft | RC | Return to the previous state on any device without data loss | MVP | FR-39 |
| UC-37 | View field-level validation state | RC | See each field's validation state inline at the point of entry | MVP | FR-40 |
| UC-38 | View section- and report-level completion status | RC | Obtain a single readiness signal before export | MVP | FR-41 |
| UC-39 | Navigate from a validation finding to the affected field | RC | Reach the field that produced a finding directly | MVP | FR-42 |
| UC-40 | Re-run validation after corrections | RC | Re-evaluate the report at any level of completeness | MVP | FR-43 |
| UC-41 | Preview the assembled report before export | RC | See the assembled report without generating a file | MVP | FR-48 |
| UC-42 | Export the report as PDF | RC | Obtain a publication-ready PDF in the selected language | MVP | FR-44, FR-49 |
| UC-43 | Export into the EFRAG Excel Digital Template | RC | Obtain the official template populated at the pinned version | MVP | FR-50, FR-51 |
| UC-44 | View and re-download previous exports | RC | Retrieve a prior export exactly as distributed | MVP | FR-53 |
| UC-45 | View prior-period values alongside current fields | RC | See last year's value next to this year's input | MVP | FR-45, FR-46 |
| UC-46 | Carry a prior-period value forward | RC | Copy an unchanged prior-year value into the current period | MVP | FR-47 |
| UC-47 | View the change history of a report | RC | See who changed which value, when, and from what | MVP | FR-54, FR-55 |
| UC-48 | Select the language of an exported report | RC | Choose export language independently of interface language | MVP | FR-52 |
| UC-49 | Create an organization | OA | Establish the organization record and become its administrator | MVP | FR-13, FR-14 |
| UC-50 | View and edit the organization profile | OA | Maintain legal form, name, address and contact details | MVP | FR-15 |
| UC-51 | Maintain entity identifiers | OA | Record and validate LEI, DUNS, EU ID or PermID | MVP | FR-16 |
| UC-52 | Create a reporting entity | OA | Establish a legal entity that will be reported on | MVP | FR-17 |
| UC-53 | Edit reporting entity master data | OA | Keep entity master data current without altering filed reports | MVP | FR-17, FR-18 |
| UC-54 | Define the consolidation scope of an entity | OA | Set the individual or consolidated reporting boundary | MVP | FR-19 |
| UC-55 | Archive a reporting entity | OA | Retire an entity while retaining its historical reports | MVP | FR-20 |
| UC-56 | Open a reporting period | OA | Create the period shell with version pinning and comparatives | MVP | FR-21, FR-45, FR-66 |
| UC-57 | Lock a reporting period | OA | Make a final, distributed report stable and read-only | MVP | FR-22 |
| UC-58 | Reopen a locked reporting period | OA | Permit a recorded post-publication correction | MVP | FR-22 |
| UC-59 | View the organization's users and access levels | OA | Answer who can see the organization's ESG data | MVP | FR-56 |
| UC-60 | Invite a user to the organization | OA | Bring a colleague or bookkeeper into the report | MVP | FR-57 |
| UC-61 | Resend or revoke a pending invitation | OA | Re-issue or withdraw an outstanding invitation | MVP | FR-57 |
| UC-62 | Change a user's role | OA | Move a member between edit and view-only with immediate effect | MVP | FR-58 |
| UC-63 | Remove a user from the organization | OA | Withdraw access without erasing the audit trail | MVP | FR-55, FR-59 |
| UC-64 | Grant Organization Administrator rights to another user | OA | Avoid the single-admin lockout scenario | MVP | FR-60 |
| UC-65 | View plan and entitlement status | OA | See the plan, entitlements, cycle and renewal date | MVP | FR-90 |
| UC-66 | View organization usage counters | OA | See consumption against entitlement limits | MVP | FR-105 |
| UC-67 | View the organization-wide report status overview | OA | Answer whether everything is ready before the deadline | MVP | FR-23 |
| UC-68 | Log in with elevated privileges | PA | Authenticate to the administrative surface with MFA | MVP | FR-75 |
| UC-69 | View and search the organization register | PA | Support triage and oversight without seeing report content | MVP | FR-76, FR-77 |
| UC-70 | Manage social identity provider configuration | PA | Register, enable, disable and rotate provider credentials | MVP | FR-82 |
| UC-71 | Create or edit a translatable content string | PA | Correct wording without a release | MVP | FR-61, FR-74 |
| UC-72 | Publish a translation set | PA | Make a reviewed content set live across all tenants at once | MVP | FR-62 |
| UC-73 | Register an additional locale | PA | Add an interface and export language by authoring its catalogue | MVP | FR-63 |
| UC-74 | Review untranslated content keys | PA | Work localization gaps as a maintained queue | MVP | FR-64 |
| UC-75 | Register a new taxonomy or template version | PA | Bring a newly published EFRAG version into the platform | MVP | FR-65, FR-66 |
| UC-76 | Define the field mapping between versions | PA | Author the input that migration depends on | MVP | FR-67 |
| UC-77 | Identify reports on a superseded version | PA | Quantify exposure before attempting a migration | MVP | FR-68 |
| UC-78 | Execute a taxonomy migration run | PA | Move selected reports to a new version reversibly | MVP | FR-51, FR-69 |
| UC-79 | Notify affected organizations of a version change | PA | Tell customers in-product that their report moved version | MVP | FR-70 |
| UC-80 | Maintain the emission factor set | PA | Keep versioned emission and conversion factors current | MVP | FR-71 |
| UC-81 | Maintain conditional-applicability thresholds | PA | Keep applicability rules as configuration, not code | MVP | FR-72, FR-74 |
| UC-82 | Maintain validation rule definitions | PA | Keep consistency and completeness rules as configuration | MVP | FR-73, FR-74 |
| UC-83 | View the adoption and usage dashboard | PA | Read the defined MVP success metrics | MVP | FR-83 |
| UC-84 | Export platform metrics | PA | Produce the evidence for the Phase 2 go/no-go decision | MVP | FR-83 |
| UC-85 | Raise a time-boxed support access request | PA | Obtain scoped, expiring access to act on a support request | MVP | FR-77, FR-78 |
| UC-86 | Review the support-access audit log | PA | Hold the support-access privilege accountable | MVP | FR-79 |
| UC-87 | Manage platform administrator accounts and roles | PA | Separate content, operations and support privileges | MVP | FR-80 |
| UC-88 | View the platform-wide system audit log | PA | Make a platform-side change explicable after the fact | MVP | FR-81 |
| UC-89 | Define a subscription plan | BO | Create a plan as a versioned first-class record | MVP | FR-84 |
| UC-90 | Define plan entitlements and quotas | BO | Declare what each plan grants, as data | MVP | FR-85 |
| UC-91 | Set plan pricing per currency and billing cycle | BO | Author deliberate prices per currency and cycle | MVP | FR-86 |
| UC-92 | Version a plan and grandfather existing subscribers | BO | Change price or entitlements without restating live agreements | MVP | FR-87 |
| UC-93 | Publish or retire a plan | BO | Open a plan to purchase or close it without ending service | MVP | FR-88 |
| UC-94 | Define a discount or promotional code | BO | Issue a commercial incentive without a release | MVP | FR-89 |
| UC-95 | Define trial terms for a plan | BO | Set trial length, instrument requirement and expiry behaviour | MVP | FR-89 |
| UC-96 | Compare available plans | OA | Decide on a plan against the organization's actual consumption | MVP | FR-91 |
| UC-97 | Start a paid subscription | OA | Move the organization from Free to a paid plan | MVP | FR-92 |
| UC-98 | Start a free trial | OA | Try a paid plan with full entitlements and a known expiry | MVP | FR-93 |
| UC-99 | Change the billing cycle | OA | Switch between monthly and annual billing | MVP | FR-95 |
| UC-100 | Upgrade the plan | OA | Obtain higher entitlements immediately, prorated | MVP | FR-94 |
| UC-101 | Downgrade the plan | OA | Move to a lower plan at period end with known consequences | MVP | FR-94 |
| UC-102 | Add or remove billable units mid-cycle | OA | Adjust seats or entities within the current period | MVP | FR-96 |
| UC-103 | Enable or disable auto-renewal | OA | Control whether the subscription renews automatically | MVP | FR-97 |
| UC-104 | Cancel a subscription | OA | End the subscription at the close of the paid period | MVP | FR-97 |
| UC-105 | Reactivate a cancelled or lapsed subscription | OA | Restore entitlements and editability | MVP | FR-97 |
| UC-106 | View subscription status and renewal date | OA | See the subscription state, plan version and next amount due | MVP | FR-90 |
| UC-107 | View subscription change history | OA | Settle a billing question without recourse to support | MVP | FR-98 |
| UC-108 | Maintain billing account details | OA | Hold the data every Moldovan fiscal document requires | MVP | FR-106 |
| UC-109 | Validate fiscal identifiers | SYS | Prevent an invoice being rejected by e-Factura | MVP | FR-107 |
| UC-110 | Place an order | OA | Express commercial intent as its own tracked object | MVP | FR-108 |
| UC-111 | Apply a discount code to an order | OA | Reduce the order total under a valid code | MVP | FR-109 |
| UC-112 | Review the order summary with VAT before confirming | OA | See net, VAT, gross and available rails before committing | MVP | FR-110 |
| UC-113 | Confirm the order and accept terms | OA | Conclude the agreement with evidence of what was agreed | MVP | FR-111 |
| UC-114 | Track order status | OA | Follow an asynchronous settlement to its conclusion | MVP | FR-112 |
| UC-115 | Cancel an unpaid order | OA | Withdraw an order before any fiscal document exists | MVP | FR-113 |
| UC-116 | Pay by domestic card | OA | Settle an order by card through the acquirer | MVP | FR-114, FR-115, FR-116 |
| UC-117 | Complete a 3-D Secure challenge | OA | Satisfy the issuer's strong-authentication step | MVP | FR-116 |
| UC-118 | Save a card for recurring billing | OA | Consent to automatic renewal charges | MVP | FR-117 |
| UC-119 | Manage saved payment instruments | OA | View, replace, remove and default stored cards | MVP | FR-117 |
| UC-120 | Pay by MIA instant payment | OA | Settle within seconds through the national instant rail | MVP | FR-114, FR-118 |
| UC-121 | Pay by bank transfer against a proforma invoice | OA | Settle through the customer's own bank with no amount ceiling | MVP | FR-114, FR-119 |
| UC-122 | Pay through the merchant-of-record checkout | OA | Serve a non-resident customer (adapter registered, inactive at MVP) | MVP (inactive) | FR-114 |
| UC-123 | Execute a scheduled recurring charge | SYS | Charge the stored token on the renewal date, idempotently | MVP | FR-120 |
| UC-124 | Retry a failed recurring charge | SYS | Recover a soft decline without retrying a hard one | MVP | FR-120 |
| UC-125 | Notify the customer of a payment failure | SYS | Prevent involuntary churn from an unnoticed card failure | MVP | FR-120 |
| UC-126 | Issue a proforma invoice | SYS | Request payment without creating a fiscal document | MVP | FR-121 |
| UC-127 | Issue a fiscal invoice on payment | SYS | Produce the statutory invoice generated from the order | MVP | FR-122 |
| UC-128 | Calculate VAT on an invoice | SYS | Apply the correct treatment for the customer's status | MVP | FR-124 |
| UC-129 | Transmit the invoice to the national e-Factura platform | SYS | Meet the B2B e-invoicing mandate | MVP | FR-126 |
| UC-130 | Resolve an e-Factura transmission failure | BO | Correct and reissue a rejected transmission | MVP | FR-127 |
| UC-131 | Deliver the invoice to the customer | SYS | Place the invoice with the billing contact, recorded | MVP | FR-128 |
| UC-132 | View and download invoices | OA | Retrieve invoice history and documents at any time | MVP | FR-128 |
| UC-133 | Issue a credit note or corrective invoice | BO | Change an issued invoice's effect lawfully | MVP | FR-125 |
| UC-134 | Maintain invoice numbering series | BO | Keep the statutory series gapless and monotonic | MVP | FR-123 |
| UC-135 | Archive fiscal documents for the statutory retention period | BO | Guarantee retention over the statutory term | MVP | FR-130 |
| UC-136 | Record the exchange rate on a foreign-currency invoice | SYS | Fix the MDL equivalent the fiscal return is built from | MVP | FR-129 |
| UC-137 | Import a bank statement | BO | Bring settlement data into the platform | MVP | FR-131 |
| UC-138 | Reconcile an incoming payment automatically | SYS | Match, settle and provision without manual work | MVP | FR-132 |
| UC-139 | Resolve an unmatched or partial payment | BO | Work reconciliation exceptions with recorded rationale | MVP | FR-133 |
| UC-140 | Manually mark an invoice paid | BO | Settle outside the automated flow, accountably | MVP | FR-134 |
| UC-141 | Run the dunning sequence for an overdue invoice | SYS | Escalate an unpaid invoice through configured reminders | MVP | FR-135 |
| UC-142 | Restrict service after the grace period expires | SYS | Suspend without deleting anything | MVP | FR-104, FR-136 |
| UC-143 | Restore service on payment | SYS | Return full entitlements automatically on settlement | MVP | FR-137 |
| UC-144 | Write off an uncollectible invoice | BO | Record a bad debt without deleting the fiscal document | MVP | FR-138 |
| UC-145 | Issue a full or partial refund | BO | Return funds and generate the corresponding credit note | MVP | FR-139 |
| UC-146 | Process a card chargeback | BO | Defend or accept a disputed card transaction | MVP | FR-140 |
| UC-147 | Reverse entitlements following a refund or chargeback | SYS | Align entitlements with a reversed payment | MVP | FR-141 |
| UC-148 | Evaluate an entitlement check | SYS | Decide centrally whether a gated action is permitted | MVP | FR-99, FR-100 |
| UC-149 | Notify a customer approaching a quota limit | SYS | Warn before a limit is hit | MVP | FR-101 |
| UC-150 | Handle a quota-exceeded action | SYS | Block clearly and offer the upgrade path without losing work | MVP | FR-102 |
| UC-151 | Apply the downgrade data-retention rule | SYS | Select read-only content by a deterministic published rule | MVP | FR-103, FR-104 |
| UC-152 | Emit and store a metering event | SYS | Maintain the single append-only usage stream | MVP | FR-105 |
| UC-153 | Request an Enterprise quote | OA | Enter the contract path for Enterprise terms | MVP | FR-142 |
| UC-154 | Prepare and issue a quote | BO | Offer negotiated terms as provisioning-ready structured data | MVP | FR-143 |
| UC-155 | Record a signed contract and its negotiated terms | BO | Hold the authoritative record the subscription is built from | MVP | FR-144 |
| UC-156 | Provision an Enterprise subscription from a contract | BO | Activate negotiated entitlements as overrides | MVP | FR-145 |
| UC-157 | Record a purchase order reference | OA | Get invoices through the customer's own AP process | MVP | FR-146 |
| UC-158 | Bill an Enterprise contract on a custom schedule | BO | Invoice to match the contract, driven by data | MVP | FR-147 |
| UC-159 | Manage contract renewal and expiry | BO | Track and act within the notice period | MVP | FR-147 |
| UC-160 | Maintain VAT rates and tax rules | BO | Change a rate without a deployment | MVP | FR-148 |
| UC-161 | View the billing revenue dashboard | BO | Read the commercial performance of the platform | MVP | FR-149 |
| UC-162 | Export the revenue and VAT report for accounting | BO | Hand over to the company's own accounting obligations | MVP | FR-150 |
| UC-163 | Review the immutable billing audit ledger | BO | Rely on an append-only record as evidence | MVP | FR-151 |
| UC-164 | Reconcile provider settlement against recorded payments | BO | Know what was actually received, not only what was charged | MVP | FR-152 |
| UC-165 | View the in-app notification centre | CA | Read the notifications addressed to the user | MVP | FR-160, FR-161 |
| UC-166 | Open a notification and act on its subject | CA | Reach the object that raised the notice directly | MVP | FR-162 |
| UC-167 | Mark a notification read or dismiss it | CA | Clear a handled item for this user only | MVP | FR-161 |
| UC-168 | Set own notification preferences | CA | Choose channels per notification category | MVP | FR-9, FR-163 |
| UC-169 | Notify that a report still requires updating | SYS | Name the specific outstanding modules and fields | MVP | FR-164, FR-167 |
| UC-170 | Notify that a reporting deadline is approaching | SYS | Give lead time against the period's due date | MVP | FR-165, FR-167 |
| UC-171 | Notify that a regulatory or template change requires a report update | SYS | Tell affected organizations what a change obliges | MVP | FR-70, FR-166 |
| UC-172 | Deliver a notification in-app | SYS | Deliver without dependency on an external provider | MVP | FR-160, FR-168 |
| UC-173 | Deliver a notification by email | SYS | Reach a user who does not log in between sessions | MVP | FR-169 |
| UC-174 | Record delivery outcome and handle a failed send | SYS | Distinguish an undeliverable address from an ignored notice | MVP | FR-160, FR-170, FR-171 |
| UC-175 | Send a manual reminder to a user | OA | Prompt a colleague without waiting for the schedule | MVP | FR-173 |
| UC-176 | Maintain notification categories and templates | PA | Change a notice or its wording as configuration | MVP | FR-173 |
| UC-177 | Evaluate the platform before registering | VI | Decide whether the platform does what the company needs, without creating an account | MVP | — |
| UC-178 | Read a published legal document | VI | Know what is being agreed to and how personal data is handled, before agreeing to either | MVP | — |
| UC-179 | Set the cookie choice | VI | Decide what non-essential storage the site may set | MVP | — |
| UC-180 | Browse the help centre | VI | Find guidance for the task in hand, signed in or not | MVP | FR-61 |
| UC-181 | Read a published help article | VI | Follow one piece of guidance through to an answer | MVP | FR-61 |
| UC-182 | Contact support | VI | Ask a question the published guidance does not answer | MVP | — |
| UC-183 | Complete C1 — Strategy: business model and sustainability-related initiatives | RC | Describe the business model and the sustainability initiatives it carries | MVP | FR-177, FR-24, FR-27 |
| UC-184 | Complete C2 — Practices, policies and future initiatives for the transition | RC | Extend B2's practices and policies to the transition toward a sustainable economy | MVP | FR-177, FR-24, FR-27 |
| UC-185 | Complete C3 — GHG reduction targets and climate transition | RC | State reduction targets against a base year and the transition that meets them | MVP | FR-177, FR-24, FR-27 |
| UC-186 | Complete C4 — Climate risks | RC | Disclose physical and transition climate risks and the response to them | MVP | FR-177, FR-24, FR-27 |
| UC-187 | Complete C5 — Additional workforce characteristics | RC | Extend B8's headcount with the further breakdowns a lender asks for | MVP | FR-177, FR-24, FR-27 |
| UC-188 | Complete C6 — Human rights policies and processes | RC | Disclose the policies and due-diligence processes covering own workforce | MVP | FR-177, FR-24, FR-27 |
| UC-189 | Complete C7 — Severe negative human rights incidents | RC | Report severe incidents, or record their absence as a positive statement | MVP | FR-177, FR-24, FR-27 |
| UC-190 | Complete C8 — Revenues from certain sectors and benchmark exclusion | RC | Answer the sector-exclusion question a bank's benchmark screening asks | MVP | FR-177, FR-24, FR-27 |
| UC-191 | Complete C9 — Gender diversity ratio in the governance body | RC | Report the governance-body gender ratio | MVP | FR-177, FR-24, FR-27 |
| UC-192 | Add the Comprehensive Module to a report in progress | RC | Extend a report already under way when a bank or large customer asks for Comprehensive scope | MVP | FR-177 |

**Count:** 192 use cases — 20 CA, 42 RC, 49 OA, 22 PA, 27 BO, 26 SYS, 6 VI, across 39 modules. **UC-183 … UC-192 added 25 Aug 2026** with the Comprehensive Module's promotion into MVP scope (`problem_overview.md` OQ-12); they are RC use cases and sit in the reporting-platform group despite their numbers, which are appended rather than inserted. UC-01 … UC-88 cover the reporting platform, UC-89 … UC-164 the billing, payment and subscription domain, UC-165 … UC-176 notifications, and UC-177 … UC-182 the public tier. The register ran to 176 across 37 modules until 24 Aug 2026, when `design_spec.md` OQ-12 closed by registering the Visitor actor rather than exempting its screens from UX-7.

---

## 4. Use case groupings and functional areas

Three domains, thirty-seven modules. Modules are a reading and estimating aid, not a system boundary and not a permission boundary.

### 4.1 Reporting platform (UC-01 … UC-88)

| Module | Use cases | Primary actors |
|---|---|---|
| Account & registration | UC-01 … UC-03 | CA |
| Authentication | UC-04 … UC-07 | CA |
| Credential management | UC-08 … UC-12 | CA |
| User profile | UC-13, UC-14 | CA |
| Organization membership | UC-15, UC-16 | CA |
| Report access | UC-17, UC-18 | RC |
| Basic Module data entry | UC-19 … UC-31 | RC |
| Carbon calculator | UC-32 … UC-34 | RC |
| Draft management | UC-35, UC-36 | RC |
| Validation | UC-37 … UC-40 | RC |
| Export | UC-41 … UC-44 | RC |
| Comparative periods | UC-45, UC-46 | RC |
| Traceability | UC-47, UC-48 | RC |
| Organization profile | UC-49 … UC-51 | OA |
| Reporting entity | UC-52 … UC-55 | OA |
| Reporting period | UC-56 … UC-58 | OA |
| Users & access | UC-59 … UC-64 | OA |
| Plan & oversight | UC-65 … UC-67 | OA |
| Admin access | UC-68, UC-69 | PA |
| Identity providers | UC-70 | PA |
| Content & localization | UC-71 … UC-74 | PA |
| Taxonomy & versioning | UC-75 … UC-79 | PA |
| Calculation & rules | UC-80 … UC-82 | PA |
| Metrics | UC-83, UC-84 | PA |
| Support & audit | UC-85 … UC-88 | PA |

### 4.2 Billing, payment and subscription (UC-89 … UC-164)

| Module | Use cases | Primary actors |
|---|---|---|
| Plan catalogue | UC-89 … UC-95 | BO |
| Subscription lifecycle | UC-96 … UC-107 | OA |
| Billing account | UC-108, UC-109 | OA, SYS |
| Order & checkout | UC-110 … UC-115 | OA |
| Payment (external provider) | UC-116 … UC-125 | OA, SYS |
| Invoicing | UC-126 … UC-136 | SYS, BO, OA |
| Reconciliation & collections | UC-137 … UC-144 | BO, SYS |
| Refunds & disputes | UC-145 … UC-147 | BO, SYS |
| Entitlement enforcement | UC-148 … UC-152 | SYS |
| Enterprise contracting | UC-153 … UC-159 | OA, BO |
| Financial reporting & audit | UC-160 … UC-164 | BO |

### 4.3 Notifications (UC-165 … UC-176)

| Module | Use cases | Primary actors |
|---|---|---|
| Notifications | UC-165 … UC-176 | CA, SYS, OA, PA |

**One mechanism, every producer.** UC-172, UC-173 and UC-174 are not private to the notifications module. Payment failure (UC-125), quota approach (UC-149), trial expiry (UC-98), dunning (UC-141), invitation (UC-60), invoice delivery (UC-131) and version change (UC-79) all run through the same delivery and recording path.

**Two things are deliberately kept out of the notifications module.** There is no per-notification ownership or assignment model: a notice about an incomplete report goes to everyone with edit access on it, and the Organization Administrator sees the same picture through the report status overview (UC-67). And there is no escalation chain — a notice repeats at a configured interval and stops when the report is complete. Both can be added later if usage shows they are needed; neither is worth building for an SME with two people on the report.

---

### 4.4 Public tier (UC-177 … UC-182)

Added 24 Aug 2026 with the Visitor actor, closing `design_spec.md` OQ-12. These six are the use cases the six unauthenticated screens of `architecture.md` §15.4's ninth step trace to, and they exist because UX-7 requires every screen to trace to at least one — which these screens did not, for as long as no actor could initiate them.

| Module | Use cases | Primary actor |
|---|---|---|
| Public tier | UC-177 … UC-182 | VI |

Two of them carry an open question rather than a settled mechanism, stated in their §5 entries rather than resolved here: **UC-179** does not decide whether the cookie choice is *recorded* server-side or implied (`design_spec.md` OQ-16), and **UC-182** does not decide by what channel support is reached (`task.md` task 77). Both are registered because the goal is real and the screen exists; neither is specified past what the sources support.


### 4.5 Comprehensive Module (UC-183 … UC-192)

Added 25 Aug 2026 with the Comprehensive Module's promotion into MVP scope (`problem_overview.md` OQ-12, FR-177). Nine disclosures plus the act of adding the module to a report already in progress — the state `EasyESG Reporting Screens` draws and UC-192 names. Disclosure names follow the published EFRAG standard, because NFR-2 makes element names the schema's own vocabulary rather than labels over it. They are **additive over B1–B11 and share its mechanisms**: D-A's report-level scope flag drives which are shown, and conditional applicability, validation and both export formats are FR-27 … FR-32's, not parallel ones.

| Module | Use cases | Primary actor |
|---|---|---|
| Comprehensive Module | UC-183 … UC-192 | RC |

---

## 5. Detailed use case specifications

Specified in the brief-to-casual form the sources support. Fields absent from the sources are omitted rather than invented; see the fidelity rules in section 2.

### UC-01 — Register a user account with email and password

- **Primary actor:** CA (Common Access)
- **Module:** Account & registration
- **Stakeholders and interests:** Prospective user — wants an account; platform — wants no application data reachable by an unverified party.
- **Preconditions:** None. No organization exists yet.
- **Trigger:** A prospective user chooses to create an account with an email address and password.
- **Main success scenario:**
  1. The user supplies an email address and a password.
  2. The system creates an unverified account record.
  3. The system issues a verification challenge.
- **Alternate flows:** Registration through a social identity provider (UC-02) is the alternative path and produces the same account record.
- **Postconditions:** An unverified account record exists. No application data is reachable until verification completes (UC-03).
- **Business rules:** The founding user of a new organization is auto-granted the Organization Administrator role (D-1), which applies when the account proceeds to UC-49.
- **Related FRs:** FR-1
- **Related UCs:** UC-02, UC-03, UC-49

### UC-02 — Register with a social identity provider

- **Primary actor:** CA
- **Module:** Account & registration
- **Stakeholders and interests:** Prospective user — wants access without another password; identity provider — asserts identity and email verification state; platform — must not allow a provider assertion to become an account-takeover path.
- **Preconditions:** The provider is registered and enabled (UC-70).
- **Trigger:** A prospective user chooses to authenticate with Google or Microsoft instead of choosing a password.
- **Main success scenario:**
  1. The user selects a provider.
  2. The platform requests only minimum profile scopes — identifier, email address, display name.
  3. The system creates an account holding the provider identity as its credential, with no password set.
  4. Where the provider asserts the email is verified, UC-03 is satisfied without a separate verification email.
- **Alternate flows:** Where an account already exists for the asserted address, no duplicate is created; the user is routed through identity linking (UC-11) after proving control of the existing account.
- **Postconditions:** An account exists with a provider identity credential and no password.
- **Business rules:** Social sign-in is in MVP scope; enterprise SSO is not (D-6). A provider assertion alone is never sufficient to attach to an existing account.
- **Related FRs:** FR-2
- **Related UCs:** UC-01, UC-03, UC-05, UC-11, UC-70

### UC-03 — Verify email address

- **Primary actor:** CA
- **Module:** Account & registration
- **Stakeholders and interests:** User — wants an active account; platform — wants proof of control of the address.
- **Preconditions:** An unverified account record exists (UC-01), or a provider has asserted the address (UC-02).
- **Trigger:** The user follows the time-limited verification link.
- **Main success scenario:**
  1. The user follows the verification link.
  2. The account transitions from unverified to active.
  3. The founding-organization flow (UC-49) or a pending invitation (UC-15) becomes available.
- **Alternate flows:** Satisfied automatically where a social provider asserts an already-verified address.
- **Exception flows:** Unverified accounts expire after a defined window.
- **Postconditions:** The account is active.
- **Related FRs:** FR-3
- **Related UCs:** UC-01, UC-02, UC-15, UC-49

### UC-04 — Log in with email and password

- **Primary actor:** CA
- **Module:** Authentication
- **Stakeholders and interests:** User — wants access to their organizations' reports; platform — must resist credential stuffing.
- **Preconditions:** The account is active and holds a password credential.
- **Trigger:** The user submits email and password.
- **Main success scenario:**
  1. The user submits email and password.
  2. The system authenticates the credential.
  3. The system issues a session scoped to the user's organization memberships and roles.
- **Alternate flows:** Users who registered socially and never set a password use UC-05 instead.
- **Exception flows:** Failed attempts are rate-limited and locked out after a threshold.
- **Postconditions:** A session exists, scoped to memberships and roles.
- **Related FRs:** FR-4
- **Related UCs:** UC-05, UC-09, UC-16

### UC-05 — Log in with a social identity provider

- **Primary actor:** CA
- **Module:** Authentication
- **Stakeholders and interests:** Returning user — wants one-click access; platform — must resolve identity stably across email changes at the provider.
- **Preconditions:** The provider is linked to the account and enabled.
- **Trigger:** The user authenticates through a linked provider.
- **Main success scenario:**
  1. The user authenticates at the provider.
  2. The system matches the provider's subject identifier — not the email address — to the account.
  3. The system issues a session identical in scope and lifetime to a password session.
- **Alternate flows:** If the presented identity is not linked to any account, the user is offered registration (UC-02) rather than being silently signed in to a new empty account.
- **Business rules:** The subject identifier is the matching key, so a user who later changes their email at the provider still resolves to the same account.
- **Related FRs:** FR-4
- **Related UCs:** UC-02, UC-11, UC-70

### UC-06 — Log out

- **Primary actor:** CA
- **Module:** Authentication
- **Stakeholders and interests:** User — wants the session genuinely ended, particularly on a shared computer.
- **Preconditions:** An active session exists.
- **Trigger:** The user explicitly logs out.
- **Main success scenario:**
  1. The user logs out.
  2. The system invalidates the session token server-side rather than only clearing it client-side.
  3. Any unsynced draft changes are flushed, or the user is warned first.
- **Postconditions:** The session is invalid server-side.
- **Business rules:** Logging out of the platform does not terminate the user's session at a social identity provider, and the interface says so.
- **Related FRs:** FR-5
- **Related UCs:** UC-35

### UC-07 — Re-authenticate after session expiry

- **Primary actor:** CA
- **Module:** Authentication
- **Stakeholders and interests:** User — must not lose in-progress work to a timeout.
- **Preconditions:** A session has expired through inactivity or timeout.
- **Trigger:** Session expiry during use.
- **Main success scenario:**
  1. The user is prompted to re-authenticate using whichever credential the account holds.
  2. On success the user returns to exactly the screen and record they were on.
  3. Any locally queued draft changes are submitted rather than discarded.
- **Postconditions:** A new session exists; queued draft changes are persisted.
- **Related FRs:** FR-5
- **Related UCs:** UC-04, UC-05, UC-35, UC-36

### UC-08 — Request a password reset

- **Primary actor:** CA
- **Module:** Credential management
- **Stakeholders and interests:** Locked-out user — wants recovery; platform — must not allow account enumeration.
- **Preconditions:** None beyond possession of an email address.
- **Trigger:** The user cannot log in and requests a reset.
- **Main success scenario:**
  1. The user enters their email address.
  2. The system issues a single-use, time-limited reset link.
  3. The system returns an identical response whether or not the address is registered.
- **Alternate flows:** Where the address belongs to a social-only account with no password, the message sent instead directs the user to sign in with their provider.
- **Business rules:** The endpoint cannot be used to enumerate accounts.
- **Related FRs:** FR-6
- **Related UCs:** UC-09

### UC-09 — Set a new password via reset link

- **Primary actor:** CA
- **Module:** Credential management
- **Stakeholders and interests:** User — wants access restored; platform — must ensure a compromised session does not survive the reset.
- **Preconditions:** A valid, unconsumed reset link (UC-08).
- **Trigger:** The user follows the reset link.
- **Main success scenario:**
  1. The user follows the link and sets a new password meeting the password policy.
  2. The link is consumed on use.
  3. All existing sessions for that account are invalidated.
- **Alternate flows:** A social-only account completing this flow gains a password credential in addition to its linked identity.
- **Postconditions:** The account holds a new password; no prior session remains valid.
- **Related FRs:** FR-6
- **Related UCs:** UC-08, UC-12

### UC-10 — Change own password

- **Primary actor:** CA
- **Module:** Credential management
- **Preconditions:** The user is authenticated and holds a password credential.
- **Trigger:** The user chooses to change their password.
- **Main success scenario:**
  1. The user supplies the current password and a new one.
  2. The system replaces the credential.
  3. Other active sessions are optionally terminated.
- **Business rules:** Distinct from UC-09 because the user is authenticated and no reset token is involved.
- **Related FRs:** FR-7
- **Related UCs:** UC-09

### UC-11 — Link a social identity provider to an existing account

- **Primary actor:** CA
- **Module:** Credential management
- **Stakeholders and interests:** User — wants either credential to work; platform — must not let a provider assertion attach to an account it cannot prove control of.
- **Preconditions:** The user is authenticated by their existing credential.
- **Trigger:** Either a deliberate request to add one-click access, or a collision where someone attempts social registration with an already-registered address.
- **Main success scenario:**
  1. The authenticated user initiates linking.
  2. The user authenticates at the provider.
  3. The system attaches the provider identity to the existing account.
- **Postconditions:** Either credential signs the user in.
- **Business rules:** The user must be authenticated by their existing credential before the link is established; a provider assertion alone is never sufficient.
- **Related FRs:** FR-8
- **Related UCs:** UC-02, UC-05, UC-12

### UC-12 — Unlink a social identity provider

- **Primary actor:** CA
- **Module:** Credential management
- **Stakeholders and interests:** User — typically has lost access to the provider account or left the employer that issued it; organization — would lose the user's memberships if the account became unrecoverable.
- **Preconditions:** The account holds a linked provider identity.
- **Trigger:** The user removes a linked provider identity.
- **Main success scenario:**
  1. The user selects the linked identity to remove.
  2. The system removes it.
- **Exception flows:** The system refuses to remove the last remaining credential, prompting the user to set a password first.
- **Business rules:** An account with no usable credential is unrecoverable and takes its organization memberships down with it.
- **Related FRs:** FR-8
- **Related UCs:** UC-09, UC-11

### UC-13 — View and edit own user profile

- **Primary actor:** CA
- **Module:** User profile
- **Preconditions:** The user is authenticated.
- **Trigger:** The user opens their profile.
- **Main success scenario:**
  1. The user views their display name, contact email and notification preferences.
  2. The user edits and saves them.
- **Business rules:** Profile data is personal to the user and independent of any organization they belong to, since one account may hold roles in several organizations.
- **Related FRs:** FR-9
- **Related UCs:** UC-16, UC-168

### UC-14 — Set preferred interface language

- **Primary actor:** CA
- **Module:** User profile
- **Preconditions:** The user is authenticated; the locale is registered (UC-73).
- **Trigger:** The user selects an interface language.
- **Main success scenario:**
  1. The user selects Romanian or English.
  2. The choice persists to their profile.
  3. It applies on every subsequent login and device.
- **Alternate flows:** Where a string has no translation in the chosen locale, the system falls back per-string to the default locale and records the gap for content follow-up (UC-74).
- **Business rules:** Interface language is independent of export language (UC-48).
- **Related FRs:** FR-10, FR-64
- **Related UCs:** UC-48, UC-73, UC-74

### UC-15 — Accept an invitation to join an organization

- **Primary actor:** CA
- **Module:** Organization membership
- **Stakeholders and interests:** Invited person — wants access to the report; inviting Organization Administrator — assigned the role and expects it honoured; organization — wants access bound to the intended person.
- **Preconditions:** A single-use, unexpired invitation issued by UC-60 exists for the invited email address.
- **Trigger:** The invited person opens the invitation link.
- **Main success scenario:**
  1. The invited person opens the link.
  2. They either create an account — by password or social provider — or link an existing one.
  3. On acceptance they gain the role the inviting Organization Administrator assigned, edit or view-only, scoped to that organization's reports.
- **Exception flows:** Invitations are single-use and expire if unaccepted; a revoked invitation's link is invalid immediately (UC-61).
- **Business rules:** The invitation binds to the invited email address, so a social sign-in is accepted only where the provider asserts that same address.
- **Related FRs:** FR-11
- **Related UCs:** UC-01, UC-02, UC-60, UC-61

### UC-16 — View memberships and switch active organization

- **Primary actor:** CA
- **Module:** Organization membership
- **Preconditions:** The user holds at least one membership.
- **Trigger:** A user belonging to more than one organization selects which is active.
- **Main success scenario:**
  1. The user sees their memberships.
  2. The user selects which is active for the current session.
  3. All subsequent data access, permissions and screens are scoped to the selection.
- **Business rules:** Present at MVP even though most users will have exactly one membership, because the org-relationship model is built generically from day one.
- **Related FRs:** FR-12
- **Related UCs:** UC-13, UC-15, UC-49

### UC-17 — View accessible reporting entities and periods

- **Primary actor:** RC (Reporting Contributor)
- **Module:** Report access
- **Stakeholders and interests:** Contributor — needs to know what is open to them; Organization Administrator — sets the per-report permissions this view reflects.
- **Preconditions:** The user holds a membership in the active organization.
- **Trigger:** The Contributor opens the reports list.
- **Main success scenario:**
  1. The Contributor sees the reporting entities within the active organization and the periods open to them.
  2. Each entry shows its completion and validation summary.
- **Business rules:** The list reflects per-report permissions set by the Organization Administrator, so a view-only member sees the same entries without edit affordances.
- **Related FRs:** FR-25
- **Related UCs:** UC-18, UC-38, UC-67

### UC-18 — Open a report for editing

- **Primary actor:** RC
- **Module:** Report access
- **Preconditions:** The reporting period is open (not locked per UC-57) and the user holds edit rather than view-only rights.
- **Trigger:** The Contributor selects a specific entity/period combination.
- **Main success scenario:**
  1. The Contributor opens the entity/period combination.
  2. The system checks that the period is open and that the user holds edit rights.
  3. The Contributor enters the guided wizard at the first incomplete step.
- **Exception flows:** Where the period is locked or the user holds view-only rights, no editable session is granted.
- **Postconditions:** An editable session exists on the report.
- **Related FRs:** FR-24, FR-26
- **Related UCs:** UC-17, UC-19, UC-57

### UC-19 — Complete B1 — Basis for preparation

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Stakeholders and interests:** Contributor — completes the disclosure; Organization Administrator — owns the entity master record the values pre-populate from (D-2).
- **Preconditions:** An editable report session (UC-18); entity master data exists (UC-52 … UC-54).
- **Trigger:** The Contributor enters the first wizard step.
- **Main success scenario:**
  1. The Contributor confirms or completes module choice (Basic at MVP), legal form, NACE code(s), employee headcount and FTE, site geolocations, and consolidation scope.
  2. The Contributor records any sensitive information omitted under the standard's omission provision.
  3. The system uses the answers to drive conditional-applicability logic for every subsequent module.
- **Business rules:** Values pre-populate from the entity master record (D-2) but remain editable here, because B1 is a disclosure, not master data. B1 is entered first because its answers drive conditional applicability.
- **Related FRs:** FR-24, FR-27, FR-28
- **Related UCs:** UC-26, UC-28, UC-54, UC-81

### UC-20 — Complete B2 — Practices, policies and future initiatives

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B2 step.
- **Main success scenario:**
  1. The Contributor describes existing sustainability policies, practices, targets and planned initiatives.
  2. The Contributor states whether an ESG-responsible person or contact point exists.
- **Business rules:** This is the report's principal narrative module, largely free-text with structured yes/no anchors.
- **Related FRs:** FR-24
- **Related UCs:** UC-30, UC-46

### UC-21 — Complete B3 — Energy and GHG emissions

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B3 step.
- **Main success scenario:**
  1. The Contributor reports energy consumption split by renewable and non-renewable source (MWh).
  2. Scope 1 and location-based Scope 2 emissions (tCO₂e) and GHG intensity are recorded.
- **Alternate flows:** Quantitative values are normally produced by the carbon calculator (UC-33) rather than typed directly, but the module remains completable by direct entry where the company already holds calculated figures.
- **Related FRs:** FR-24, FR-29
- **Related UCs:** UC-32, UC-33, UC-34

### UC-22 — Complete B4 — Pollution

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B4 step.
- **Main success scenario:**
  1. The Contributor reports emissions to air, water and soil where legally required or where the company operates under an environmental management system.
- **Alternate flows:** For most Moldovan SMEs the module resolves to not-applicable, which is recorded explicitly with rationale (UC-30) rather than left blank.
- **Related FRs:** FR-24, FR-29
- **Related UCs:** UC-30

### UC-23 — Complete B5 — Biodiversity

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session; site geolocations captured in B1 (UC-19).
- **Trigger:** The Contributor reaches the B5 step.
- **Main success scenario:**
  1. The Contributor discloses whether any operating site is located in or near a biodiversity-sensitive area, using the B1 site geolocations.
- **Alternate flows:** A company with no sites near such areas records a negative determination rather than an empty section.
- **Business rules:** Applicability is site-driven.
- **Related FRs:** FR-24, FR-28
- **Related UCs:** UC-19, UC-81

### UC-24 — Complete B6 — Water

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B6 step.
- **Main success scenario:**
  1. The Contributor reports water withdrawal, the portion withdrawn in areas of high water stress, and water consumption.
- **Alternate flows:** The module supports a documented immateriality determination (UC-30), since sector relevance varies sharply — material for manufacturing and agri-processing, typically immaterial for services.
- **Related FRs:** FR-24, FR-28, FR-29
- **Related UCs:** UC-30, UC-81

### UC-25 — Complete B7 — Resource use, circular economy and waste

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B7 step.
- **Main success scenario:**
  1. The Contributor describes circularity practices.
  2. The Contributor reports waste quantities split into hazardous and non-hazardous, with the share diverted to recycling or reuse.
- **Business rules:** Narrative and quantitative content are captured together so a figure can be explained in context.
- **Related FRs:** FR-24, FR-29

### UC-26 — Complete B8 — Workforce characteristics

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session; B1 headcount recorded (UC-19).
- **Trigger:** The Contributor reaches the B8 step.
- **Main success scenario:**
  1. The Contributor reports headcount and FTE broken down by contract type, gender and country.
  2. Where the B1 headcount reaches 50 or more, the Contributor additionally reports employee turnover.
- **Business rules:** The system shows or hides the turnover field dynamically on the 50-employee threshold rather than presenting it and rejecting it later. The threshold itself is maintained configuration (UC-81).
- **Related FRs:** FR-24, FR-28, FR-29
- **Related UCs:** UC-19, UC-81

### UC-27 — Complete B9 — Health and safety

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B9 step.
- **Main success scenario:**
  1. The Contributor reports the number of recordable work-related accidents, the corresponding accident rate, and any work-related fatalities.
- **Business rules:** Zero is an affirmative, reportable value and is captured distinctly from an unanswered field.
- **Related FRs:** FR-24, FR-30
- **Related UCs:** UC-29, UC-31

### UC-28 — Complete B10 — Remuneration, collective bargaining and training

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session; B1 headcount recorded (UC-19).
- **Trigger:** The Contributor reaches the B10 step.
- **Main success scenario:**
  1. The Contributor confirms all employees are paid at or above the applicable minimum wage.
  2. The Contributor reports collective-bargaining coverage and average training hours per employee.
  3. Where the B1 headcount reaches 150 or more, the Contributor additionally reports the unadjusted gender pay gap.
- **Business rules:** The gender pay gap field is shown conditionally on the 150-employee threshold, maintained as configuration (UC-81).
- **Related FRs:** FR-24, FR-28, FR-29
- **Related UCs:** UC-19, UC-81

### UC-29 — Complete B11 — Corruption and bribery

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session.
- **Trigger:** The Contributor reaches the B11 step.
- **Main success scenario:**
  1. The Contributor reports the number of convictions and the total value of fines for corruption and bribery during the reporting period.
- **Business rules:** As with B9, a nil return is an affirmative disclosure and is recorded as such.
- **Related FRs:** FR-24, FR-30
- **Related UCs:** UC-27

### UC-30 — Declare a section not material or not applicable

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Stakeholders and interests:** Contributor — needs a legitimate way to exclude a module; report reader — should see a reasoned exclusion rather than an unexplained gap.
- **Preconditions:** An editable report session on a module the Contributor judges not material or not applicable.
- **Trigger:** The Contributor marks a module not material or not applicable rather than leaving it empty.
- **Main success scenario:**
  1. The Contributor marks the module not material or not applicable.
  2. The Contributor records a short rationale.
  3. The declaration is carried into both exports.
- **Business rules:** The declaration satisfies validation rather than suppressing it, and is discounted in the completion rollup (UC-38).
- **Related FRs:** FR-31
- **Related UCs:** UC-22, UC-24, UC-31, UC-38, UC-42, UC-43

### UC-31 — Declare an individual field not available, with reason

- **Primary actor:** RC
- **Module:** Basic Module data entry
- **Preconditions:** An editable report session on a field whose data is not held.
- **Trigger:** The Contributor cannot supply a specific field value.
- **Main success scenario:**
  1. The Contributor marks the field as not currently available.
  2. The Contributor states why — typically that data collection for that metric is not yet established.
- **Business rules:** A distinct terminal state from `MISSING VALUE` (D-4), mirroring the disclosure practice observed across every reference report in this project.
- **Related FRs:** FR-32
- **Related UCs:** UC-30, UC-37

### UC-32 — Enter energy and fuel consumption data

- **Primary actor:** RC
- **Module:** Carbon calculator
- **Stakeholders and interests:** Contributor — enters data from their own invoices; a future assurance reviewer — must be able to retrace the calculation.
- **Preconditions:** An editable report session; sites defined on the entity (UC-52).
- **Trigger:** The Contributor begins the carbon calculation.
- **Main success scenario:**
  1. The Contributor records consumption by energy source (electricity, natural gas, diesel, heating fuel and so on) and by site, in the units their own invoices use.
  2. The system stores the raw inputs permanently alongside the derived figures.
- **Postconditions:** Raw inputs are retained for retracing.
- **Related FRs:** FR-33
- **Related UCs:** UC-33, UC-52

### UC-33 — Calculate Scope 1 and location-based Scope 2 emissions

- **Primary actor:** RC
- **Module:** Carbon calculator
- **Stakeholders and interests:** Contributor — wants B3 populated; Platform Administrator — maintains the factor set (UC-80).
- **Preconditions:** Consumption data entered (UC-32); an emission factor set is active (UC-80).
- **Trigger:** The Contributor runs the calculation.
- **Main success scenario:**
  1. The system converts entered consumption to MWh.
  2. The system applies the versioned emission factor set maintained by the Platform Administrator (UC-80).
  3. The system computes Scope 1, location-based Scope 2 and GHG intensity in tCO₂e.
  4. The system writes the results into the B3 fields.
  5. The system stores the factor-set version used with the result.
- **Business rules:** The factor-set version is stored with the result so a later factor update does not silently restate a filed report.
- **Related FRs:** FR-34, FR-35
- **Related UCs:** UC-21, UC-32, UC-34, UC-80, UC-171

### UC-34 — Review, annotate or override calculated emissions

- **Primary actor:** RC
- **Module:** Carbon calculator
- **Preconditions:** A computed emissions result exists (UC-33).
- **Trigger:** The Contributor inspects the computed result.
- **Main success scenario:**
  1. The Contributor inspects the computed result.
  2. The Contributor adds an explanatory note, or replaces the computed value with an externally calculated figure.
- **Business rules:** Any override is flagged, attributed, and retains the superseded computed value, so the report never presents an unexplained substitution.
- **Related FRs:** FR-36
- **Related UCs:** UC-33, UC-47

### UC-35 — Autosave in-progress report data

- **Primary actor:** RC
- **Module:** Draft management
- **Preconditions:** An editable report session.
- **Trigger:** A field change, on blur or step change.
- **Main success scenario:**
  1. The system persists each field change automatically, without an explicit save action.
- **Exception flows:** If the network is unavailable the change is queued locally and retried, and the Contributor is warned while anything remains unsynced.
- **Related FRs:** FR-37, FR-38
- **Related UCs:** UC-06, UC-07, UC-36

### UC-36 — Resume an in-progress report draft

- **Primary actor:** RC
- **Module:** Draft management
- **Preconditions:** A draft exists for the entity/period.
- **Trigger:** The Contributor returns to a report.
- **Main success scenario:**
  1. The Contributor is restored to their previous state — field values, wizard position, validation flags intact.
  2. Restoration is independent of the device or session that ended.
- **Business rules:** Reporting for an SME is intermittent work spread over weeks, so lossless resumption is a core requirement rather than a convenience.
- **Related FRs:** FR-39
- **Related UCs:** UC-18, UC-35

### UC-37 — View field-level validation state

- **Primary actor:** RC
- **Module:** Validation
- **Preconditions:** A report session; validation rule definitions are in force (UC-82).
- **Trigger:** The Contributor views or edits a field.
- **Main success scenario:**
  1. For any individual field the Contributor sees its state among `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL`, plus the declared-not-available state from UC-31.
  2. State is shown inline at the point of entry, not only in a separate report.
- **Related FRs:** FR-40
- **Related UCs:** UC-31, UC-38, UC-39, UC-82

### UC-38 — View section- and report-level completion status

- **Primary actor:** RC
- **Module:** Validation
- **Preconditions:** A report session.
- **Trigger:** The Contributor checks readiness, typically before export.
- **Main success scenario:**
  1. The Contributor sees validation states rolled up per module and across the whole report.
  2. The rollup gives a single readiness signal before export.
- **Business rules:** The rollup accounts for declared not-material sections (UC-30) so a legitimately excluded module does not depress the completion figure. The rollup also supplies the named outstanding items used by UC-169.
- **Related FRs:** FR-41
- **Related UCs:** UC-30, UC-37, UC-67, UC-169

### UC-39 — Navigate from a validation finding to the affected field

- **Primary actor:** RC
- **Module:** Validation
- **Preconditions:** At least one validation finding exists.
- **Trigger:** The Contributor selects a finding.
- **Main success scenario:**
  1. The Contributor selects a finding.
  2. The system takes the Contributor directly to the field that produced it, focused, with the rule explanation shown.
- **Business rules:** This keeps a long report navigable without hunting through eleven modules.
- **Related FRs:** FR-42
- **Related UCs:** UC-37, UC-38

### UC-40 — Re-run validation after corrections

- **Primary actor:** RC
- **Module:** Validation
- **Preconditions:** A report session.
- **Trigger:** The Contributor re-evaluates the report after making changes.
- **Main success scenario:**
  1. The Contributor re-runs validation.
  2. The system returns updated states.
- **Business rules:** Validation is idempotent and can be run at any completeness level, so it functions as a working tool during drafting rather than only as a pre-export gate.
- **Related FRs:** FR-43
- **Related UCs:** UC-37, UC-38

### UC-41 — Preview the assembled report before export

- **Primary actor:** RC
- **Module:** Export
- **Preconditions:** A report session.
- **Trigger:** The Contributor requests a preview.
- **Main success scenario:**
  1. The Contributor views the fully assembled report — narrative, indicator tables, comparatives — as it will appear when exported, without generating a file.
- **Business rules:** This catches presentation problems, such as a narrative reading oddly next to its figure, before anything leaves the platform.
- **Related FRs:** FR-48
- **Related UCs:** UC-42, UC-45

### UC-42 — Export the report as PDF

- **Primary actor:** RC
- **Module:** Export
- **Stakeholders and interests:** Contributor — needs a publication-ready document; platform operator — counts the export event for adoption metrics (UC-83).
- **Preconditions:** A report session; an export language selected (UC-48).
- **Trigger:** The Contributor requests a PDF export.
- **Main success scenario:**
  1. The system renders a formatted, publication-ready PDF from stored data in the Contributor's selected language.
  2. The export event is recorded for the adoption metrics.
- **Alternate flows:** Export is permitted with unresolved findings, but the Contributor is warned first and any gaps appear visibly marked rather than silently omitted.
- **Postconditions:** The export is retrievable from export history (UC-44).
- **Related FRs:** FR-44, FR-49
- **Related UCs:** UC-41, UC-44, UC-48, UC-83, UC-152

### UC-43 — Export into the EFRAG Excel Digital Template

- **Primary actor:** RC
- **Module:** Export
- **Preconditions:** A report session; a template version pinned to the report (UC-56, UC-75).
- **Trigger:** The Contributor requests an Excel Digital Template export.
- **Main success scenario:**
  1. The system writes stored values into the named ranges of the official EFRAG Digital Template at the version pinned to the report.
  2. The template's own dropdowns and consistency-check formulas are preserved.
- **Alternate flows:** If the report is pinned to a superseded version the Contributor is prompted to migrate first (UC-78) or to export against the original version with an explicit notice.
- **Related FRs:** FR-50, FR-51
- **Related UCs:** UC-44, UC-56, UC-75, UC-77, UC-78

### UC-44 — View and re-download previous exports

- **Primary actor:** RC
- **Module:** Export
- **Preconditions:** At least one export has been generated.
- **Trigger:** The Contributor opens export history.
- **Main success scenario:**
  1. The Contributor sees the history of exports generated for a report — format, language, taxonomy version, timestamp, generating user.
  2. The Contributor re-downloads any of them.
- **Business rules:** A filed or circulated PDF must remain retrievable in exactly the form it was distributed, even after the underlying data has moved on.
- **Related FRs:** FR-53
- **Related UCs:** UC-42, UC-43, UC-142

### UC-45 — View prior-period values alongside current fields

- **Primary actor:** RC
- **Module:** Comparative periods
- **Preconditions:** A prior reporting period exists for the same entity and is linked (UC-56).
- **Trigger:** The Contributor edits a field for which a prior-period value exists.
- **Main success scenario:**
  1. The Contributor sees last year's value next to this year's input.
- **Business rules:** Comparative data is mandatory from a company's second reporting year, and showing it at the point of entry is what makes an implausible year-over-year movement visible while it can still be checked. Comparatives are MVP for storage and inline display; the standalone year-over-year dashboard is Phase 2 (D-3).
- **Related FRs:** FR-45, FR-46
- **Related UCs:** UC-46, UC-56

### UC-46 — Carry a prior-period value forward

- **Primary actor:** RC
- **Module:** Comparative periods
- **Preconditions:** A linked prior period with a value for the field.
- **Trigger:** The Contributor judges that a value has not changed.
- **Main success scenario:**
  1. The Contributor copies the prior-year value into the current period — for fields that genuinely have not changed, such as a policy statement or site list.
  2. The system marks the value as carried forward.
- **Business rules:** Carried-forward values are marked as such so they can be reviewed rather than accumulating unnoticed across years.
- **Related FRs:** FR-47
- **Related UCs:** UC-20, UC-45

### UC-47 — View the change history of a report

- **Primary actor:** RC
- **Module:** Traceability
- **Stakeholders and interests:** Contributor — needs to see what changed; a future limited-assurance reviewer — requires exactly this trail.
- **Preconditions:** A report exists with recorded changes.
- **Trigger:** The Contributor opens the change history.
- **Main success scenario:**
  1. The Contributor sees, per field, who changed a value, when, and what the previous value was.
- **Business rules:** This exists at MVP because retrofitting attribution later is not possible. Historical attribution survives removal of a user's access (UC-63).
- **Related FRs:** FR-54, FR-55
- **Related UCs:** UC-34, UC-58, UC-63

### UC-48 — Select the language of an exported report

- **Primary actor:** RC
- **Module:** Traceability *(as grouped in the source register)*
- **Preconditions:** More than one locale is published (UC-72, UC-73).
- **Trigger:** The Contributor generates an export.
- **Main success scenario:**
  1. Independently of their interface language, the Contributor chooses the language of labels and help text in the generated export.
- **Business rules:** A Moldovan SME frequently works in Romanian but must deliver an English report to a foreign buyer or bank, so the two settings are deliberately decoupled.
- **Related FRs:** FR-52
- **Related UCs:** UC-14, UC-42, UC-43

### UC-49 — Create an organization

- **Primary actor:** OA (Organization Administrator)
- **Module:** Organization profile
- **Stakeholders and interests:** Founding user — becomes the administrator; platform — needs the generic org-relationship model in place from day one.
- **Preconditions:** The user's account is verified (UC-03).
- **Trigger:** A verified user creates an organization.
- **Main success scenario:**
  1. The user creates the organization record — legal name, country, contact details.
  2. The system automatically grants the creating user the Organization Administrator role over it (D-1).
- **Business rules:** The organization is created against the generic org-relationship model, with only the "direct SME org" type active at MVP, so Advisor, Buyer and Licensee relationship types can be introduced later without a schema change.
- **Related FRs:** FR-13, FR-14
- **Related UCs:** UC-01, UC-02, UC-03, UC-52

### UC-50 — View and edit the organization profile

- **Primary actor:** OA
- **Module:** Organization profile
- **Preconditions:** The organization exists and the user holds the OA role.
- **Trigger:** The Administrator opens the organization profile.
- **Main success scenario:**
  1. The Administrator maintains the organization's legal form, registered name, registered address and contact details.
  2. Changes are attributed and timestamped.
- **Business rules:** These values propagate into every report the organization produces. They are distinct from billing account details (UC-108), because the invoiced legal person is not always the reporting entity.
- **Related FRs:** FR-15
- **Related UCs:** UC-51, UC-108

### UC-51 — Maintain entity identifiers

- **Primary actor:** OA
- **Module:** Organization profile
- **Preconditions:** The organization exists.
- **Trigger:** The Administrator records or updates an identifier.
- **Main success scenario:**
  1. The Administrator records the LEI as primary identifier, or a DUNS number, EU ID or PermID where no LEI exists.
  2. The system validates format and checksum on entry.
- **Business rules:** An identifier that fails validation downstream in EFRAG's own tooling is expensive to discover at filing time.
- **Related FRs:** FR-16
- **Related UCs:** UC-50

### UC-52 — Create a reporting entity

- **Primary actor:** OA
- **Module:** Reporting entity
- **Preconditions:** The organization exists.
- **Trigger:** The Administrator creates a legal entity that will be reported on.
- **Main success scenario:**
  1. The Administrator captures the entity's legal form, NACE code(s) and site locations.
- **Business rules:** An organization may hold several entities; most SMEs will hold exactly one, but the model does not assume it.
- **Related FRs:** FR-17
- **Related UCs:** UC-19, UC-53, UC-54, UC-56

### UC-53 — Edit reporting entity master data

- **Primary actor:** OA
- **Module:** Reporting entity
- **Preconditions:** The entity exists.
- **Trigger:** Entity master data changes — a new site, a revised NACE classification, a change of legal form.
- **Main success scenario:**
  1. The Administrator updates the entity's master data.
- **Business rules:** Reports already filed for closed periods retain the values in force at the time, so a later correction does not retroactively alter a distributed report.
- **Related FRs:** FR-17, FR-18
- **Related UCs:** UC-19, UC-52, UC-57

### UC-54 — Define the consolidation scope of an entity

- **Primary actor:** OA
- **Module:** Reporting entity
- **Preconditions:** The entity exists.
- **Trigger:** The Administrator sets or revises the reporting basis.
- **Main success scenario:**
  1. The Administrator specifies whether the entity reports on an individual or consolidated basis.
  2. If consolidated, the Administrator specifies which subsidiaries are inside the reporting boundary.
- **Business rules:** This feeds directly into B1 (UC-19) and determines the boundary against which every quantitative figure in the report must be gathered.
- **Related FRs:** FR-19
- **Related UCs:** UC-19, UC-52

### UC-55 — Archive a reporting entity

- **Primary actor:** OA
- **Module:** Reporting entity
- **Preconditions:** The entity is no longer reported on — sold, merged or dissolved.
- **Trigger:** The Administrator archives the entity.
- **Main success scenario:**
  1. The system removes the entity from active selection.
  2. The system retains its historical reports and exports intact.
- **Business rules:** Prior filings must remain retrievable.
- **Related FRs:** FR-20
- **Related UCs:** UC-44, UC-52

### UC-56 — Open a reporting period

- **Primary actor:** OA
- **Module:** Reporting period
- **Stakeholders and interests:** Administrator — opens the period; Contributor — works inside it; platform — pins the version the report is prepared under.
- **Preconditions:** The entity exists (UC-52); a current template and taxonomy version is registered (UC-75).
- **Trigger:** The Administrator opens a reporting period for an entity.
- **Main success scenario:**
  1. The Administrator specifies the fiscal year and its start and end dates.
  2. The system creates the period shell.
  3. The system pins the current VSME template and taxonomy version to it.
  4. The system links the immediately preceding period so comparatives resolve automatically.
  5. Optionally, the Administrator records a due date — the date by which the report must be complete, which is not the same as the period end.
- **Business rules:** The optional due date is what deadline notifications count down to (UC-170).
- **Related FRs:** FR-21, FR-45, FR-66
- **Related UCs:** UC-45, UC-52, UC-57, UC-75, UC-170

### UC-57 — Lock a reporting period

- **Primary actor:** OA
- **Module:** Reporting period
- **Preconditions:** The report is final and distributed.
- **Trigger:** The Administrator locks the period.
- **Main success scenario:**
  1. The system makes the period read-only for Reporting Contributors.
- **Business rules:** Locking is what makes a published figure stable and gives the change history a defensible endpoint.
- **Related FRs:** FR-22
- **Related UCs:** UC-18, UC-47, UC-58

### UC-58 — Reopen a locked reporting period

- **Primary actor:** OA
- **Module:** Reporting period
- **Preconditions:** The period is locked and a genuine correction is required.
- **Trigger:** The Administrator reopens the period.
- **Main success scenario:**
  1. The Administrator reopens the period.
  2. The system records the reopening with acting user, timestamp and a stated reason.
- **Business rules:** A post-publication amendment is visible as an amendment rather than appearing as ordinary editing.
- **Related FRs:** FR-22
- **Related UCs:** UC-47, UC-57

### UC-59 — View the organization's users and access levels

- **Primary actor:** OA
- **Module:** Users & access
- **Preconditions:** The user holds the OA role in the active organization.
- **Trigger:** The Administrator opens the user list.
- **Main success scenario:**
  1. The Administrator sees every user with access to the organization, their role, status (active or pending invitation), and last activity.
- **Business rules:** This is the single place where "who can see our ESG data" is answerable.
- **Related FRs:** FR-56
- **Related UCs:** UC-60, UC-62, UC-63

### UC-60 — Invite a user to the organization

- **Primary actor:** OA
- **Module:** Users & access
- **Stakeholders and interests:** Administrator — needs a second person on the report; invitee — receives the invitation (UC-15); entitlement service — evaluates seat quota.
- **Preconditions:** The organization has seat entitlement available, or the quota path applies.
- **Trigger:** The Administrator invites a person by email.
- **Main success scenario:**
  1. The Administrator supplies the invitee's email and assigns an edit or view-only role.
  2. The system issues the invitation through the common notification mechanism.
- **Exception flows:** Inviting beyond the plan's seat entitlement triggers the quota path (UC-150).
- **Business rules:** A capped number of users is included on the Free plan, because the realistic SME pattern is an owner plus a bookkeeper and gating that entirely would block the primary workflow.
- **Related FRs:** FR-57
- **Related UCs:** UC-15, UC-61, UC-148, UC-150, UC-173

### UC-61 — Resend or revoke a pending invitation

- **Primary actor:** OA
- **Module:** Users & access
- **Preconditions:** An invitation is outstanding.
- **Trigger:** The invitation was not received or acted on, or was issued in error or is no longer wanted.
- **Main success scenario:**
  1. The Administrator resends the invitation, or revokes it.
  2. Revocation invalidates the outstanding link immediately.
- **Related FRs:** FR-57
- **Related UCs:** UC-15, UC-60

### UC-62 — Change a user's role

- **Primary actor:** OA
- **Module:** Users & access
- **Preconditions:** The target user is an existing member.
- **Trigger:** The Administrator changes a member's role.
- **Main success scenario:**
  1. The Administrator moves the member between edit and view-only.
  2. The change takes effect on that user's next request.
- **Business rules:** Effect on next request rather than next login, so a downgrade is immediate.
- **Related FRs:** FR-58
- **Related UCs:** UC-59, UC-64

### UC-63 — Remove a user from the organization

- **Primary actor:** OA
- **Module:** Users & access
- **Stakeholders and interests:** Administrator — closing off a departing employee or an ended accountant engagement; assurance reviewer — depends on attribution surviving.
- **Preconditions:** The target user is a member.
- **Trigger:** The Administrator removes a member's access.
- **Main success scenario:**
  1. The system removes the member's access entirely.
- **Postconditions:** The user's account continues to exist; their historical contributions remain attributed in the change history.
- **Business rules:** Removing access must not erase the audit trail.
- **Related FRs:** FR-55, FR-59
- **Related UCs:** UC-47, UC-59

### UC-64 — Grant Organization Administrator rights to another user

- **Primary actor:** OA
- **Module:** Users & access
- **Preconditions:** The target user is a member.
- **Trigger:** The Administrator promotes another member.
- **Main success scenario:**
  1. The Administrator promotes the member to Organization Administrator.
- **Business rules:** This exists at MVP specifically to avoid the single-admin lockout scenario, in which the only administrator leaves the company and no one can reach the organization's settings.
- **Related FRs:** FR-60
- **Related UCs:** UC-59, UC-62

### UC-65 — View plan and entitlement status

- **Primary actor:** OA
- **Module:** Plan & oversight
- **Preconditions:** The organization has a subscription in some state.
- **Trigger:** The Administrator opens the plan status view.
- **Main success scenario:**
  1. The Administrator views the organization's current plan — Free, Standard or Enterprise — the specific entitlements and quotas it grants, the current billing cycle, and the next renewal date.
- **Business rules:** This is the read-only status view; the actions that change any of it are the subscription lifecycle use cases (UC-96 onward). Three plans at MVP (D-12).
- **Related FRs:** FR-90
- **Related UCs:** UC-66, UC-96, UC-106

### UC-66 — View organization usage counters

- **Primary actor:** OA
- **Module:** Plan & oversight
- **Preconditions:** Metering events exist for the organization (UC-152).
- **Trigger:** The Administrator opens the usage view.
- **Main success scenario:**
  1. The Administrator sees the organization's own usage against plan quotas as derived from the metering event stream: reporting entities, active users, reports created, exports generated by format, API calls.
  2. Consumption is shown against the entitlement limit rather than as a bare number.
- **Business rules:** Showing consumption against the limit lets the Administrator see a limit approaching before it is hit.
- **Related FRs:** FR-105
- **Related UCs:** UC-149, UC-150, UC-152

### UC-67 — View the organization-wide report status overview

- **Primary actor:** OA
- **Module:** Plan & oversight
- **Preconditions:** At least one entity and period exist.
- **Trigger:** The Administrator opens the overview.
- **Main success scenario:**
  1. The Administrator sees every entity and period in the organization with completion and validation status in one view.
- **Business rules:** For a multi-entity organization this is the only place the question "is everything ready before the deadline" is answerable without opening each report individually. It is also the Administrator's substitute for a per-notification assignment model in the notifications module.
- **Related FRs:** FR-23
- **Related UCs:** UC-17, UC-38, UC-169, UC-175

### UC-68 — Log in with elevated privileges

- **Primary actor:** PA (Platform Administrator)
- **Module:** Admin access
- **Stakeholders and interests:** Platform Administrator — needs cross-organization operational access; every tenant — depends on that access not being exposed by a compromised password.
- **Preconditions:** An elevated administrator account exists (UC-87) with MFA enrolled.
- **Trigger:** The Platform Administrator authenticates on the administrative surface.
- **Main success scenario:**
  1. The Administrator authenticates through a separate administrative surface.
  2. Multi-factor authentication is required.
- **Business rules:** Elevated credentials are held apart from ordinary tenant accounts. MFA is required now for the Platform Administrator, while MFA for ordinary tenant users is deferred.
- **Related FRs:** FR-75
- **Related UCs:** UC-69, UC-87

### UC-69 — View and search the organization register

- **Primary actor:** PA
- **Module:** Admin access
- **Preconditions:** An elevated session (UC-68).
- **Trigger:** Support triage or operational oversight.
- **Main success scenario:**
  1. The Administrator browses and searches all organizations on the platform.
  2. The Administrator sees account-level metadata — registration date, entity count, plan, activity — but not report content.
- **Business rules:** Holds the boundary set in D-5: no standing access to tenant report data.
- **Related FRs:** FR-76, FR-77
- **Related UCs:** UC-68, UC-85

### UC-70 — Manage social identity provider configuration

- **Primary actor:** PA
- **Module:** Identity providers
- **Stakeholders and interests:** Platform Administrator — rotates credentials; users of the provider — must not be stranded when it is withdrawn.
- **Preconditions:** An elevated session.
- **Trigger:** A provider is added, withdrawn, or its client secret must be rotated.
- **Main success scenario:**
  1. The Administrator registers, enables and disables the social identity providers offered on the sign-in screen.
  2. The Administrator maintains each provider's client credentials, requested scopes and redirect configuration.
- **Alternate flows:** Disabling a provider stops new registrations and links through it while leaving existing accounts able to authenticate by their other credential.
- **Business rules:** Credential rotation happens here rather than through a redeploy, which keeps an expiring or leaked client secret from becoming a platform-wide outage.
- **Related FRs:** FR-82
- **Related UCs:** UC-02, UC-05, UC-11, UC-12

### UC-71 — Create or edit a translatable content string

- **Primary actor:** PA
- **Module:** Content & localization
- **Preconditions:** An elevated session; the locale is registered (UC-73).
- **Trigger:** A wording correction or a new string is required.
- **Main success scenario:**
  1. The Administrator maintains field labels, help text and validation messages per locale through a content console.
- **Business rules:** Content is data rather than code, so a wording correction reaches users without a release — the mechanism that makes a quarterly regulatory-watch cadence sustainable.
- **Related FRs:** FR-61, FR-74
- **Related UCs:** UC-72, UC-73, UC-74, UC-176

### UC-72 — Publish a translation set

- **Primary actor:** PA
- **Module:** Content & localization
- **Preconditions:** A reviewed set of content changes exists (UC-71).
- **Trigger:** The Administrator publishes the set.
- **Main success scenario:**
  1. The Administrator publishes the reviewed set.
  2. The changes take effect across all tenants at once.
- **Business rules:** Publishing is an explicit, versioned, reversible step rather than a side effect of editing, so half-finished translations are never live.
- **Related FRs:** FR-62
- **Related UCs:** UC-71, UC-176

### UC-73 — Register an additional locale

- **Primary actor:** PA
- **Module:** Content & localization
- **Preconditions:** An elevated session.
- **Trigger:** A language beyond Romanian and English is required.
- **Main success scenario:**
  1. The Administrator adds a new interface and export language.
- **Business rules:** Localization is not hardcoded to two languages — EFRAG's own template ships in eleven — so adding one requires no schema change, no route change and no per-locale branch in application code. **Amended 19 Aug 2026 (architecture.md OQ-43):** authoring the catalogue and rebuilding is the mechanism; it is a content task that ships on the release cadence rather than a pure configuration task.
- **Related FRs:** FR-63
- **Related UCs:** UC-14, UC-48, UC-71

### UC-74 — Review untranslated content keys

- **Primary actor:** PA
- **Module:** Content & localization
- **Preconditions:** Runtime fallbacks have been logged (UC-14).
- **Trigger:** The Administrator reviews the fallback log.
- **Main success scenario:**
  1. The Administrator reviews the log of keys that fell back to the default locale at runtime, showing exactly where a translation is missing.
- **Business rules:** This turns localization gaps from user-reported complaints into a maintained work queue.
- **Related FRs:** FR-64
- **Related UCs:** UC-14, UC-71

### UC-75 — Register a new taxonomy or template version

- **Primary actor:** PA
- **Module:** Taxonomy & versioning
- **Stakeholders and interests:** Platform Administrator — registers the version; organizations — have periods pinned to it.
- **Preconditions:** EFRAG has published a new VSME Digital Template or XBRL taxonomy version.
- **Trigger:** Publication of a new version.
- **Main success scenario:**
  1. The Administrator registers the version.
  2. The Administrator uploads the template artefact.
  3. The Administrator records whether the change is backwards-compatible.
  4. Newly opened reporting periods pin to it from that point forward.
- **Related FRs:** FR-65, FR-66
- **Related UCs:** UC-43, UC-56, UC-76, UC-77, UC-78, UC-171

### UC-76 — Define the field mapping between versions

- **Primary actor:** PA
- **Module:** Taxonomy & versioning
- **Preconditions:** Both the outgoing and incoming versions are registered (UC-75).
- **Trigger:** A migration is contemplated.
- **Main success scenario:**
  1. The Administrator defines how fields in the outgoing version map to the incoming one, including added, removed and semantically altered fields.
- **Business rules:** This is the essential input to migration and must be authored deliberately — the February 2026 taxonomy release contained a backwards-incompatible change that no automatic mapping would have resolved correctly.
- **Related FRs:** FR-67
- **Related UCs:** UC-75, UC-78

### UC-77 — Identify reports on a superseded version

- **Primary actor:** PA
- **Module:** Taxonomy & versioning
- **Preconditions:** A newer version is registered.
- **Trigger:** The Administrator assesses exposure before a migration.
- **Main success scenario:**
  1. The Administrator lists every report still pinned to an older version, grouped by organization and by version.
- **Business rules:** This is the exposure view: it answers how many customers would be affected before any migration is attempted.
- **Related FRs:** FR-68
- **Related UCs:** UC-43, UC-75, UC-78

### UC-78 — Execute a taxonomy migration run

- **Primary actor:** PA
- **Module:** Taxonomy & versioning
- **Stakeholders and interests:** Platform Administrator — runs the migration; affected organizations — must be notified (UC-79, UC-171) and must not lose the pre-migration state.
- **Preconditions:** A defined mapping (UC-76) and a selected report set (UC-77).
- **Trigger:** The Administrator initiates a migration run.
- **Main success scenario:**
  1. The Administrator runs the defined mapping against a selected set of reports.
  2. For a compatible change, the run proceeds in bulk; for a breaking one, report-by-report with manual review.
  3. The system preserves the pre-migration state.
- **Business rules:** Migration is a versioned transformation with a preserved pre-migration state, never an in-place overwrite.
- **Related FRs:** FR-51, FR-69
- **Related UCs:** UC-43, UC-76, UC-77, UC-79, UC-171

### UC-79 — Notify affected organizations of a version change

- **Primary actor:** PA
- **Module:** Taxonomy & versioning
- **Stakeholders and interests:** Organization Administrator — receives the notice in-app and by email.
- **Preconditions:** Reports were migrated or now need re-export (UC-78).
- **Trigger:** Completion of a migration run, or a version change requiring re-export.
- **Main success scenario:**
  1. The Administrator issues a notice to affected organizations.
  2. The notice is delivered through the common notification mechanism, reaching the Organization Administrator by email as well as in-app.
- **Business rules:** Users are told in the product that their report has moved version rather than discovering it when an export behaves unexpectedly. UC-171 is the mechanised form of this use case.
- **Related FRs:** FR-70
- **Related UCs:** UC-78, UC-171, UC-172, UC-173

### UC-80 — Maintain the emission factor set

- **Primary actor:** PA
- **Module:** Calculation & rules
- **Preconditions:** An elevated session.
- **Trigger:** National or international factors are updated, typically annually.
- **Main success scenario:**
  1. The Administrator maintains the versioned emission and conversion factors used by the carbon calculator.
  2. The Administrator adds a new annual set.
- **Business rules:** Existing results retain the factor version they were computed under, so a factor update never silently restates a filed report. A factor update that obliges review of an existing report raises a notice (UC-171).
- **Related FRs:** FR-71
- **Related UCs:** UC-33, UC-171

### UC-81 — Maintain conditional-applicability thresholds

- **Primary actor:** PA
- **Module:** Calculation & rules
- **Preconditions:** An elevated session.
- **Trigger:** A threshold moves with the standard or with Moldova's transposing legislation.
- **Main success scenario:**
  1. The Administrator maintains the rules determining which fields apply to which reporters — the 50-employee turnover threshold, the 150-employee gender pay gap threshold, and sector-driven applicability.
- **Business rules:** These are configuration rather than code. A threshold change that obliges review of an existing report raises a notice (UC-171).
- **Related FRs:** FR-72, FR-74
- **Related UCs:** UC-19, UC-23, UC-24, UC-26, UC-28, UC-171

### UC-82 — Maintain validation rule definitions

- **Primary actor:** PA
- **Module:** Calculation & rules
- **Preconditions:** An elevated session.
- **Trigger:** A consistency or completeness rule, or its message, must change.
- **Main success scenario:**
  1. The Administrator maintains the consistency and completeness rules behind the five validation states, and the message shown when each fires.
- **Business rules:** Separate from threshold maintenance: one decides whether a field applies, the other whether a supplied value is coherent.
- **Related FRs:** FR-73, FR-74
- **Related UCs:** UC-37, UC-81

### UC-83 — View the adoption and usage dashboard

- **Primary actor:** PA
- **Module:** Metrics
- **Preconditions:** Metering events exist (UC-152).
- **Trigger:** The Administrator opens the dashboard.
- **Main success scenario:**
  1. The Administrator views the defined MVP success metrics: SMEs completing a full report, exports by format, average completion time, and export-usage rate.
  2. The metrics are filterable by period and segment.
- **Business rules:** Where volume is too low to be meaningful, figures are marked low-confidence rather than presented as reliable.
- **Related FRs:** FR-83
- **Related UCs:** UC-42, UC-84, UC-152, UC-161

### UC-84 — Export platform metrics

- **Primary actor:** PA
- **Module:** Metrics
- **Preconditions:** Metrics are available (UC-83).
- **Trigger:** Stakeholder reporting, or the Phase 2 go/no-go decision.
- **Main success scenario:**
  1. The Administrator extracts the metrics.
- **Business rules:** Which monetization model is activated after MVP is explicitly demand-driven, and this export is the evidence that decision rests on.
- **Related FRs:** FR-83
- **Related UCs:** UC-83, UC-161

### UC-85 — Raise a time-boxed support access request

- **Primary actor:** PA
- **Module:** Support & audit
- **Stakeholders and interests:** Platform Administrator — needs to act on a support request; the organization — must have that access scoped, justified and expiring.
- **Preconditions:** A support request exists with a ticket reference.
- **Trigger:** The Administrator needs report data to act on a support request.
- **Main success scenario:**
  1. The Administrator requests scoped, time-limited access to a specific organization's report data.
  2. The Administrator states a reason and references the ticket.
  3. Access expires automatically.
- **Business rules:** Standing access to tenant report data does not exist at any point (D-5).
- **Related FRs:** FR-77, FR-78
- **Related UCs:** UC-69, UC-86

### UC-86 — Review the support-access audit log

- **Primary actor:** PA
- **Module:** Support & audit
- **Preconditions:** Support access grants have been issued (UC-85).
- **Trigger:** Review of the support-access privilege.
- **Main success scenario:**
  1. The Administrator reviews every support access grant — who requested it, over which organization, for what reason, and what was accessed.
- **Business rules:** Because it is exactly this role's privilege that most needs restraining, the log is reviewable and cannot be edited from within the console.
- **Related FRs:** FR-79
- **Related UCs:** UC-85, UC-88

### UC-87 — Manage platform administrator accounts and roles

- **Primary actor:** PA
- **Module:** Support & audit
- **Preconditions:** An elevated session with the privilege to manage administrators.
- **Trigger:** An administrator joins, changes function, or leaves.
- **Main success scenario:**
  1. The Administrator creates, modifies and deactivates other platform administrator accounts and their privilege levels.
- **Business rules:** Operational, content and support functions are separable, so a translator does not require the privileges of a taxonomy migration operator.
- **Related FRs:** FR-80
- **Related UCs:** UC-68, UC-88

### UC-88 — View the platform-wide system audit log

- **Primary actor:** PA
- **Module:** Support & audit
- **Preconditions:** An elevated session.
- **Trigger:** A platform-side change must be explained after the fact.
- **Main success scenario:**
  1. The Administrator reviews platform-level events: version rollouts, content publications, migration runs, factor-set updates and administrator account changes.
- **Business rules:** This is the operational counterpart to the per-report change history (UC-47).
- **Related FRs:** FR-81
- **Related UCs:** UC-47, UC-72, UC-78, UC-80, UC-86, UC-87

### UC-89 — Define a subscription plan

- **Primary actor:** BO (Billing Operator)
- **Module:** Plan catalogue
- **Preconditions:** None.
- **Trigger:** A plan must be created or restated.
- **Main success scenario:**
  1. The Operator creates a plan — Free, Standard or Enterprise — giving it a code, description and customer-facing positioning.
- **Business rules:** The plan is a first-class versioned record rather than a constant in code, because pricing and packaging will change more often than the compliance core ever does. Three plans at MVP (D-12).
- **Related FRs:** FR-84
- **Related UCs:** UC-90, UC-91, UC-92, UC-93

### UC-90 — Define plan entitlements and quotas

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Preconditions:** The plan exists (UC-89).
- **Trigger:** Entitlements must be set or changed.
- **Main success scenario:**
  1. The Operator sets what each plan grants: number of reporting entities, seats, reports per period, exports per format, API call allowance, module access and support tier.
- **Business rules:** Entitlements are declarative data consumed by the entitlement service, so adding a new gated capability later means adding an entitlement key, not changing plan logic.
- **Related FRs:** FR-85
- **Related UCs:** UC-89, UC-92, UC-148

### UC-91 — Set plan pricing per currency and billing cycle

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Preconditions:** The plan version exists.
- **Trigger:** Pricing must be set or changed.
- **Main success scenario:**
  1. The Operator sets the price of a plan in MDL and, where applicable, EUR or USD, for each supported cycle (monthly, annual).
- **Business rules:** Prices are authored per currency rather than converted at display time (D-14), so an annual MDL price is a deliberate commercial decision and not an artefact of an exchange rate on the day.
- **Related FRs:** FR-86
- **Related UCs:** UC-89, UC-92, UC-136

### UC-92 — Version a plan and grandfather existing subscribers

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Stakeholders and interests:** Operator — changes commercial terms; existing subscribers — must not be silently restated.
- **Preconditions:** A plan with active subscribers.
- **Trigger:** Price or entitlements change.
- **Main success scenario:**
  1. The Operator issues a new version of the plan.
  2. The Operator chooses whether existing subscribers migrate at their next renewal or remain on their original terms.
- **Business rules:** Every subscription references the exact plan version it was sold under, so a price rise never silently restates an in-force agreement.
- **Related FRs:** FR-87
- **Related UCs:** UC-89, UC-90, UC-91, UC-107

### UC-93 — Publish or retire a plan

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Preconditions:** The plan version exists.
- **Trigger:** A plan is opened for sale or withdrawn.
- **Main success scenario:**
  1. The Operator makes a plan visible for new purchase, or withdraws it.
- **Business rules:** Retiring a plan closes it to new subscriptions while leaving existing subscribers on it until they change or renew, so a withdrawn plan does not terminate anyone's service.
- **Related FRs:** FR-88
- **Related UCs:** UC-92, UC-96

### UC-94 — Define a discount or promotional code

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Preconditions:** Eligible plans exist.
- **Trigger:** A commercial incentive is required.
- **Main success scenario:**
  1. The Operator creates a discount — percentage or fixed amount, first-period or recurring — with validity dates, redemption limits and plan eligibility.
- **Business rules:** Early adoption of voluntary sustainability reporting will need commercial incentives, and issuing one should not require a release.
- **Related FRs:** FR-89
- **Related UCs:** UC-111

### UC-95 — Define trial terms for a plan

- **Primary actor:** BO
- **Module:** Plan catalogue
- **Preconditions:** The plan version exists.
- **Trigger:** A trial offer is created, changed or withdrawn.
- **Main success scenario:**
  1. The Operator sets whether the plan offers a trial, its length, whether a payment instrument is required up front, and what happens at expiry — lapse to Free or convert to paid.
- **Business rules:** Trial terms are per plan version, so a trial offer can be tested and withdrawn without affecting existing customers.
- **Related FRs:** FR-89
- **Related UCs:** UC-98

### UC-96 — Compare available plans

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** Published plans exist (UC-93); usage counters are available (UC-66).
- **Trigger:** The Administrator considers changing plan.
- **Main success scenario:**
  1. The Administrator views the published plans side by side, with entitlements, quotas and price for each cycle.
  2. The Administrator sees which limits their current usage would exceed on each.
- **Business rules:** Showing the comparison against actual consumption is what turns a pricing page into a decision the Administrator can make without contacting sales.
- **Related FRs:** FR-91
- **Related UCs:** UC-65, UC-66, UC-97, UC-100

### UC-97 — Start a paid subscription

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** The organization is on Free; a published paid plan version exists.
- **Trigger:** The Administrator elects to move from Free to Standard.
- **Main success scenario:**
  1. The Administrator selects a plan version and billing cycle.
  2. The system creates an order (UC-110) rather than activating the plan directly.
  3. Entitlements change on confirmed payment or, for approved bank transfer terms, on invoice issuance.
- **Business rules:** Entitlements never change on order creation.
- **Related FRs:** FR-92
- **Related UCs:** UC-96, UC-110, UC-116, UC-121, UC-126, UC-127

### UC-98 — Start a free trial

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** The plan version offers a trial (UC-95).
- **Trigger:** The Administrator activates a trial.
- **Main success scenario:**
  1. The Administrator activates a trial of a paid plan.
  2. The subscription enters a trialling state with full paid entitlements and a known expiry.
  3. The Administrator is notified before it ends.
- **Business rules:** The Administrator is notified before expiry rather than discovering the change when a feature stops working. Trial-expiry notice runs on the common notification mechanism.
- **Related FRs:** FR-93
- **Related UCs:** UC-95, UC-106, UC-172, UC-173

### UC-99 — Change the billing cycle

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** An active paid subscription.
- **Trigger:** The Administrator switches between monthly and annual billing.
- **Main success scenario:**
  1. The Administrator selects the new cycle.
  2. Moving to annual takes effect at the next renewal with the annual price applied.
- **Business rules:** The choice of rail may change with the cycle, since an annual total commonly exceeds the MIA per-transaction ceiling described in D-8.
- **Related FRs:** FR-95
- **Related UCs:** UC-112, UC-120, UC-121

### UC-100 — Upgrade the plan

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** An active subscription on a lower plan.
- **Trigger:** The Administrator moves to a higher plan — usually because they are blocked.
- **Main success scenario:**
  1. The Administrator selects the higher plan.
  2. The upgrade takes effect immediately and the new entitlements apply at once.
  3. The unused remainder of the current period is credited against the new plan's charge on a prorated basis.
- **Business rules:** Upgrades are immediate because the Administrator is usually upgrading precisely because they are blocked.
- **Related FRs:** FR-94
- **Related UCs:** UC-96, UC-101, UC-150

### UC-101 — Downgrade the plan

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Stakeholders and interests:** Administrator — wants to know the consequences in advance; the organization's reports — must not be deleted.
- **Preconditions:** An active paid subscription.
- **Trigger:** The Administrator moves to a lower plan or to Free.
- **Main success scenario:**
  1. The Administrator selects the lower plan or Free.
  2. The system shows in advance exactly which entities, seats and features will move to read-only under D-13.
  3. The change takes effect at the end of the paid period.
- **Business rules:** No refund arises. Nothing is deleted (D-13); the selection of read-only content follows the deterministic rule in UC-151.
- **Related FRs:** FR-94
- **Related UCs:** UC-100, UC-142, UC-151

### UC-102 — Add or remove billable units mid-cycle

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** The plan prices seats or reporting entities per unit.
- **Trigger:** The Administrator adds or removes seats or entities within the current period.
- **Main success scenario:**
  1. The Administrator changes the unit count.
  2. Additions are prorated to the period end and charged on the next invoice.
  3. Removals reduce the following period.
- **Business rules:** Removals do not generate a mid-cycle refund.
- **Related FRs:** FR-96
- **Related UCs:** UC-60, UC-127

### UC-103 — Enable or disable auto-renewal

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** An active subscription.
- **Trigger:** The Administrator changes the auto-renewal setting.
- **Main success scenario:**
  1. The Administrator enables or disables automatic renewal at period end.
  2. Disabling schedules a lapse to Free rather than a service cut-off.
  3. The Administrator is reminded before the date arrives.
- **Related FRs:** FR-97
- **Related UCs:** UC-104, UC-119, UC-123

### UC-104 — Cancel a subscription

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** An active subscription.
- **Trigger:** The Administrator cancels.
- **Main success scenario:**
  1. The Administrator cancels.
  2. The subscription ends at the close of the paid period; service continues unchanged until that date.
- **Business rules:** Cancellation is not immediate termination, because the customer has already paid for the period and their report deadline may fall inside it.
- **Related FRs:** FR-97
- **Related UCs:** UC-103, UC-105, UC-106

### UC-105 — Reactivate a cancelled or lapsed subscription

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** The subscription was cancelled, lapsed or suspended and the organization's data is still within the retention window.
- **Trigger:** The Administrator restores the subscription.
- **Main success scenario:**
  1. The Administrator reactivates the subscription.
  2. Previously read-only entities and reports return to editable at the moment entitlement is restored.
- **Related FRs:** FR-97
- **Related UCs:** UC-104, UC-142, UC-143, UC-151

### UC-106 — View subscription status and renewal date

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** A subscription exists.
- **Trigger:** The Administrator opens the subscription view.
- **Main success scenario:**
  1. The Administrator sees the subscription's current state — trialling, active, past due, suspended, cancelled, lapsed — the plan version in force, the renewal or expiry date, and the next amount due.
- **Business rules:** The state machine is exposed plainly, because "past due" and "suspended" have different consequences and a customer must be able to tell which they are in.
- **Related FRs:** FR-90
- **Related UCs:** UC-65, UC-104, UC-141, UC-142

### UC-107 — View subscription change history

- **Primary actor:** OA
- **Module:** Subscription lifecycle
- **Preconditions:** Changes have been made to the subscription.
- **Trigger:** A billing question or dispute.
- **Main success scenario:**
  1. The Administrator reviews every change to the subscription: upgrades, downgrades, cycle changes, plan version migrations, cancellations and reactivations, each with date, acting user and resulting entitlements.
- **Business rules:** This is the record that settles a billing dispute without recourse to support.
- **Related FRs:** FR-98
- **Related UCs:** UC-92, UC-163

### UC-108 — Maintain billing account details

- **Primary actor:** OA
- **Module:** Billing account
- **Stakeholders and interests:** Administrator — supplies the data; e-Factura platform — rejects an invoice whose fiscal data is wrong.
- **Preconditions:** The organization exists.
- **Trigger:** The Administrator enters or updates billing data.
- **Main success scenario:**
  1. The Administrator maintains the data every Moldovan fiscal document requires: registered legal name, IDNO, VAT registration code where the company is registered, legal address and billing contact.
- **Business rules:** These are distinct from the organization profile (UC-50) because the invoiced legal person is not always the reporting entity, particularly in a group structure.
- **Related FRs:** FR-106
- **Related UCs:** UC-50, UC-109, UC-127

### UC-109 — Validate fiscal identifiers

- **Primary actor:** SYS
- **Module:** Billing account
- **Preconditions:** An IDNO and, where applicable, a VAT code have been supplied (UC-108).
- **Trigger:** Submission or change of a fiscal identifier.
- **Main success scenario:**
  1. The system checks the format of the supplied IDNO and VAT code.
  2. Where a lookup is available, the system checks existence and VAT status.
- **Business rules:** An invoice carrying an invalid fiscal code will be rejected by the national e-Factura platform and cannot be corrected by editing (D-10).
- **Related FRs:** FR-107
- **Related UCs:** UC-108, UC-129, UC-130

### UC-110 — Place an order

- **Primary actor:** OA
- **Module:** Order & checkout
- **Preconditions:** A published plan version and cycle are selectable.
- **Trigger:** The Administrator commits to a purchase intent.
- **Main success scenario:**
  1. The Administrator creates an order for a plan version, cycle and quantity.
  2. The order carries its own lifecycle — draft, awaiting payment, paid, provisioned, expired, cancelled, failed.
- **Business rules:** The order is the unit of commercial intent, deliberately separate from both the subscription and the invoice, so an unpaid attempt leaves no orphaned subscription and no issued fiscal document.
- **Related FRs:** FR-108
- **Related UCs:** UC-97, UC-111, UC-112, UC-113, UC-114, UC-115

### UC-111 — Apply a discount code to an order

- **Primary actor:** OA
- **Module:** Order & checkout
- **Preconditions:** An order in draft; a defined discount code (UC-94).
- **Trigger:** The Administrator enters a promotional code.
- **Main success scenario:**
  1. The Administrator enters the code.
  2. The system validates it against plan eligibility, validity window and remaining redemptions.
  3. The system recalculates the order total.
- **Exception flows:** An invalid or exhausted code is rejected at entry with the reason, not silently ignored.
- **Related FRs:** FR-109
- **Related UCs:** UC-94, UC-110, UC-112

### UC-112 — Review the order summary with VAT before confirming

- **Primary actor:** OA
- **Module:** Order & checkout
- **Preconditions:** An order with a computed total; VAT rules in force (UC-160).
- **Trigger:** The Administrator reaches the order summary.
- **Main success scenario:**
  1. The Administrator sees the net amount, the VAT applied with its rate and basis, and the gross total in the order currency.
  2. The Administrator sees the payment rails available for that total.
- **Alternate flows:** Where a rail is excluded for exceeding the MIA ceiling, the reason is shown rather than the option simply being absent.
- **Business rules:** Rail availability is a function of order total (D-8).
- **Related FRs:** FR-110
- **Related UCs:** UC-99, UC-113, UC-120, UC-121, UC-128, UC-160

### UC-113 — Confirm the order and accept terms

- **Primary actor:** OA
- **Module:** Order & checkout
- **Stakeholders and interests:** Administrator — enters a contract; the platform — must be able to evidence what was agreed, including in a chargeback (UC-146).
- **Preconditions:** An order summary reviewed (UC-112).
- **Trigger:** The Administrator confirms the order.
- **Main success scenario:**
  1. The Administrator confirms, accepting the subscription terms and the plan's specific conditions.
  2. The system records the accepted terms version, timestamp and acting user against the order.
- **Business rules:** A subscription agreement is a contract and the platform must be able to evidence what was agreed.
- **Related FRs:** FR-111
- **Related UCs:** UC-110, UC-146

### UC-114 — Track order status

- **Primary actor:** OA
- **Module:** Order & checkout
- **Preconditions:** A confirmed order.
- **Trigger:** The Administrator checks on an outstanding order — most often on the bank transfer rail.
- **Main success scenario:**
  1. The Administrator follows the order through its lifecycle.
  2. The order shows what is outstanding, what reference the payer must quote, and what will happen if payment does not arrive.
- **Business rules:** This matters most on the bank transfer rail where settlement is asynchronous and can take days.
- **Related FRs:** FR-112
- **Related UCs:** UC-110, UC-121, UC-126, UC-138

### UC-115 — Cancel an unpaid order

- **Primary actor:** OA
- **Module:** Order & checkout
- **Preconditions:** The order has not been paid.
- **Trigger:** Wrong plan, wrong cycle, or changed mind.
- **Main success scenario:**
  1. The Administrator cancels the order.
  2. Cancellation voids any associated proforma invoice.
- **Business rules:** Voiding is possible precisely because a proforma is not a fiscal document; a fiscal invoice, once issued, can only be reversed by credit note (UC-133, D-10).
- **Related FRs:** FR-113
- **Related UCs:** UC-110, UC-126, UC-133

### UC-116 — Pay by domestic card

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Stakeholders and interests:** Administrator — pays; acquiring bank (maib, Victoriabank or MICB) — performs the money movement and holds the card data.
- **Preconditions:** A confirmed order; the card rail is available for the order total.
- **Trigger:** The Administrator elects card payment.
- **Main success scenario:**
  1. The platform redirects to the acquiring bank's own hosted payment page or SDK.
  2. The Administrator pays at the acquirer.
  3. The platform receives the result and stores only the acquirer's transaction reference and a masked descriptor.
- **Business rules:** The platform builds no card processing (D-7). This is the only MVP rail supporting genuinely unattended recurring billing (D-8).
- **Related FRs:** FR-114, FR-115, FR-116
- **Related UCs:** UC-112, UC-117, UC-118, UC-123, UC-127

### UC-117 — Complete a 3-D Secure challenge

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Preconditions:** The acquirer requires the issuer's strong-authentication step.
- **Trigger:** The acquirer initiates the challenge during UC-116.
- **Main success scenario:**
  1. The Administrator completes the issuer's strong-authentication step.
  2. The Administrator returns to the platform with the authentication result carried on the transaction.
- **Exception flows:** The order must survive the round trip and the user's possible abandonment mid-challenge without duplicating either the charge or the order.
- **Related FRs:** FR-116
- **Related UCs:** UC-110, UC-116

### UC-118 — Save a card for recurring billing

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Preconditions:** A card payment through the acquirer (UC-116).
- **Trigger:** The Administrator consents to storing a card token for automatic renewal.
- **Main success scenario:**
  1. The Administrator gives explicit consent.
  2. The system records the consent separately from the payment itself and stores the acquirer's card token.
- **Business rules:** An authorisation to charge once and an authorisation to charge every month are different permissions.
- **Related FRs:** FR-117
- **Related UCs:** UC-116, UC-119, UC-123

### UC-119 — Manage saved payment instruments

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Preconditions:** At least one stored instrument (UC-118).
- **Trigger:** The Administrator reviews or changes stored cards.
- **Main success scenario:**
  1. The Administrator views, replaces or removes stored cards.
  2. The Administrator sees which is the default for renewal.
- **Exception flows:** Removing the last instrument on an auto-renewing subscription warns that renewal will fail rather than allowing the organization to discover it at suspension.
- **Related FRs:** FR-117
- **Related UCs:** UC-103, UC-118, UC-123, UC-125

### UC-120 — Pay by MIA instant payment

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Stakeholders and interests:** Administrator — pays from their own bank; participating banks — execute the instant transfer.
- **Preconditions:** The order total is within the per-transaction ceiling.
- **Trigger:** The Administrator elects MIA payment.
- **Main success scenario:**
  1. The Administrator pays through the national instant rail by QR code, payment link or request-to-pay against their own bank.
  2. Settlement is confirmed within seconds.
  3. The order is provisioned immediately.
- **Business rules:** Offered only where the order total is within the per-transaction ceiling; the platform reads the applicable limit from configuration rather than hard-coding it, since the National Bank adjusts it (D-8).
- **Related FRs:** FR-114, FR-118
- **Related UCs:** UC-99, UC-112, UC-127

### UC-121 — Pay by bank transfer against a proforma invoice

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Stakeholders and interests:** Administrator and their finance department — insist on this rail; Billing Operator — must reconcile the inbound payment.
- **Preconditions:** A proforma invoice has been issued (UC-126).
- **Trigger:** The Administrator elects bank transfer.
- **Main success scenario:**
  1. The Administrator downloads a proforma invoice carrying a unique payment reference.
  2. The Administrator settles it through their own bank.
  3. Provisioning waits on reconciliation (UC-138).
- **Business rules:** This is the default path for annual and Enterprise billing because it carries no amount ceiling, and it is the rail most Moldovan finance departments will insist on regardless of what else is offered (D-8).
- **Related FRs:** FR-114, FR-119
- **Related UCs:** UC-114, UC-126, UC-137, UC-138

### UC-122 — Pay through the merchant-of-record checkout

- **Primary actor:** OA
- **Module:** Payment (external provider)
- **Stakeholders and interests:** Non-resident customer — cannot be served by domestic rails; merchant of record — acts as legal seller and assumes the cross-border tax and chargeback burden.
- **Preconditions:** The adapter is activated by configuration. **Registered but inactive at MVP (D-8).**
- **Trigger:** A non-resident customer reaches checkout.
- **Main success scenario:**
  1. The customer pays through the merchant-of-record adapter.
  2. The merchant of record acts as legal seller and assumes the cross-border tax and chargeback burden.
- **Business rules:** Built as a registered adapter and inactive at MVP; it becomes the rail for Phase 2 Advisor, Corporate Buyer and Licensee customers, who cannot be served by domestic-only acquiring.
- **Related FRs:** FR-114
- **Related UCs:** UC-112, UC-128

### UC-123 — Execute a scheduled recurring charge

- **Primary actor:** SYS
- **Module:** Payment (external provider)
- **Preconditions:** An auto-renewing subscription with a stored card token (UC-118).
- **Trigger:** The renewal date.
- **Main success scenario:**
  1. The system charges the stored card token for the renewal amount.
  2. The system creates the order and invoice automatically.
- **Business rules:** Each attempt is idempotent against the renewal period, so a retried or duplicated job never bills a customer twice for one period.
- **Related FRs:** FR-120
- **Related UCs:** UC-103, UC-118, UC-124, UC-127

### UC-124 — Retry a failed recurring charge

- **Primary actor:** SYS
- **Module:** Payment (external provider)
- **Preconditions:** A recurring charge has failed (UC-123).
- **Trigger:** A decline result from the acquirer.
- **Main success scenario:**
  1. On a soft decline the system retries on a defined schedule.
  2. If retries are exhausted the system escalates to dunning (UC-141).
- **Alternate flows:** Hard declines — closed account, stolen card — are not retried at all, since repeating them achieves nothing and can trigger acquirer penalties.
- **Related FRs:** FR-120
- **Related UCs:** UC-123, UC-125, UC-141

### UC-125 — Notify the customer of a payment failure

- **Primary actor:** SYS
- **Module:** Payment (external provider)
- **Stakeholders and interests:** Organization Administrator — needs to know the card failed while it can still be fixed.
- **Preconditions:** A charge has failed (UC-123, UC-124).
- **Trigger:** A failed charge.
- **Main success scenario:**
  1. The system notifies the Organization Administrator, stating what failed, what the consequence will be, by when, and what action fixes it.
- **Business rules:** Almost all involuntary churn is an expired card nobody was told about, so this notification is a retention mechanism, not a courtesy. Classified transactional, so it is never suppressed by a notification preference (UC-168).
- **Related FRs:** FR-120
- **Related UCs:** UC-119, UC-124, UC-141, UC-168, UC-172, UC-173

### UC-126 — Issue a proforma invoice

- **Primary actor:** SYS
- **Module:** Invoicing
- **Preconditions:** An order electing bank transfer (UC-121).
- **Trigger:** Election of the bank transfer rail on an order.
- **Main success scenario:**
  1. The system issues a proforma carrying the payment reference, bank details, amount and validity date.
- **Business rules:** A proforma is a payment request, not a fiscal document — it creates no VAT liability and consumes no invoice number, which is what allows UC-115 to void it cleanly.
- **Related FRs:** FR-121
- **Related UCs:** UC-115, UC-121, UC-127, UC-134

### UC-127 — Issue a fiscal invoice on payment

- **Primary actor:** SYS
- **Module:** Invoicing
- **Preconditions:** Payment is confirmed on a rail, or approved bank transfer terms apply.
- **Trigger:** Confirmed payment.
- **Main success scenario:**
  1. The system issues the fiscal invoice.
  2. The system draws the next number from the statutory series (UC-134).
  3. The system records supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, and total.
- **Business rules:** The invoice is generated from the order, not typed, so the document and the ledger cannot diverge. Once issued it is immutable (D-10).
- **Related FRs:** FR-122
- **Related UCs:** UC-108, UC-128, UC-129, UC-131, UC-133, UC-134, UC-136, UC-157

### UC-128 — Calculate VAT on an invoice

- **Primary actor:** SYS
- **Module:** Invoicing
- **Preconditions:** Customer residency and VAT status are known (UC-108, UC-109); VAT rules are in force (UC-160).
- **Trigger:** Invoice or order-total calculation.
- **Main success scenario:**
  1. The system applies the correct treatment from the customer's residency and VAT status: standard-rate Moldovan VAT for domestic supply, and the applicable export or reverse-charge treatment for non-resident customers.
  2. The basis is stated on the document.
- **Business rules:** The rule set is maintained data (UC-160), because rates and digital-services rules move independently of the platform's release cycle.
- **Related FRs:** FR-124
- **Related UCs:** UC-112, UC-122, UC-127, UC-160

### UC-129 — Transmit the invoice to the national e-Factura platform

- **Primary actor:** SYS
- **Module:** Invoicing
- **Stakeholders and interests:** Platform — carries the compliance obligation; customer — is the B2B counterparty the mandate covers.
- **Preconditions:** A fiscal invoice has been issued (UC-127) with valid fiscal identifiers (UC-109).
- **Trigger:** Issuance of a fiscal invoice or a corrective document.
- **Main success scenario:**
  1. The system renders the invoice into the required national XML format.
  2. The system transmits it.
  3. The system stores the platform's acknowledgement and identifier against the invoice record.
- **Exception flows:** On rejection, UC-130 applies.
- **Business rules:** Mandatory for B2B from October 2026 (D-9), and since every paying customer is a Moldovan business, this runs on essentially every invoice issued.
- **Related FRs:** FR-126
- **Related UCs:** UC-109, UC-127, UC-130, UC-133, UC-135

### UC-130 — Resolve an e-Factura transmission failure

- **Primary actor:** BO
- **Module:** Invoicing
- **Preconditions:** A transmission was rejected — schema failure, unknown or mismatched fiscal code, platform outage.
- **Trigger:** A rejected transmission.
- **Main success scenario:**
  1. The Operator sees the rejection reason.
  2. The Operator corrects the underlying data.
  3. The Operator reissues.
- **Business rules:** The invoice is not silently marked delivered on a failed transmission, because an untransmitted B2B invoice is a compliance exposure, not a delivery inconvenience.
- **Related FRs:** FR-127
- **Related UCs:** UC-108, UC-109, UC-129

### UC-131 — Deliver the invoice to the customer

- **Primary actor:** SYS
- **Module:** Invoicing
- **Preconditions:** A fiscal invoice has been issued; a billing contact exists (UC-108).
- **Trigger:** Invoice issuance.
- **Main success scenario:**
  1. The system delivers the invoice to the billing contact.
  2. The system makes it available in the billing area.
  3. Delivery is recorded with timestamp and channel.
- **Business rules:** Recorded delivery is what answers the recurring dispute over whether an invoice was ever received. Runs on the common notification mechanism (UC-172, UC-173) as a transactional category.
- **Related FRs:** FR-128
- **Related UCs:** UC-127, UC-132, UC-172, UC-173, UC-174

### UC-132 — View and download invoices

- **Primary actor:** OA
- **Module:** Invoicing
- **Preconditions:** Invoices exist for the organization.
- **Trigger:** The Administrator opens the billing area.
- **Main success scenario:**
  1. The Administrator sees the organization's full invoice history — number, date, period, amount, VAT, status, payment date.
  2. The Administrator downloads any document.
- **Business rules:** This remains available after downgrade, cancellation and lapse, because the customer's obligation to retain the document outlives their subscription.
- **Related FRs:** FR-128
- **Related UCs:** UC-131, UC-142

### UC-133 — Issue a credit note or corrective invoice

- **Primary actor:** BO
- **Module:** Invoicing
- **Stakeholders and interests:** Operator — corrects the record; customer — receives the corrective document; e-Factura platform — receives the correction.
- **Preconditions:** An issued invoice to correct — a refund, a cancelled service, or a genuine error.
- **Trigger:** A correction is required.
- **Main success scenario:**
  1. The Operator issues a corrective document referencing the original invoice.
  2. The correction is itself transmitted to e-Factura.
- **Business rules:** Under D-10 this is the only mechanism by which an issued invoice's effect can be changed. Refund authority is separated from invoice issuance (UC-145).
- **Related FRs:** FR-125
- **Related UCs:** UC-115, UC-127, UC-129, UC-145, UC-163

### UC-134 — Maintain invoice numbering series

- **Primary actor:** BO
- **Module:** Invoicing
- **Preconditions:** None.
- **Trigger:** Configuration of a series, monitoring, or the annual roll.
- **Main success scenario:**
  1. The Operator configures and monitors the sequential numbering series per document type and fiscal year, including the annual roll.
- **Business rules:** The series must be gapless and monotonic, which constrains implementation: numbers are allocated at issuance under a lock, never reserved optimistically at order creation where an abandoned order would leave a hole.
- **Related FRs:** FR-123
- **Related UCs:** UC-126, UC-127, UC-133

### UC-135 — Archive fiscal documents for the statutory retention period

- **Primary actor:** BO
- **Module:** Invoicing
- **Stakeholders and interests:** Operator — carries the obligation; a data subject requesting erasure — must defer to fiscal law.
- **Preconditions:** Issued documents and transmission receipts exist.
- **Trigger:** Issuance; and ongoing over the retention term.
- **Main success scenario:**
  1. The Operator ensures issued documents and their transmission receipts are retained in immutable storage for the statutory period, which for Moldovan VAT records runs to at least six years.
- **Business rules:** Retention is a system guarantee rather than a backup policy, and it survives customer deletion requests, which is the point at which the GDPR erasure workflow must defer to fiscal law.
- **Related FRs:** FR-130
- **Related UCs:** UC-127, UC-129, UC-163

### UC-136 — Record the exchange rate on a foreign-currency invoice

- **Primary actor:** SYS
- **Module:** Invoicing
- **Preconditions:** The invoice is denominated in EUR or USD.
- **Trigger:** Issuance of a foreign-currency invoice.
- **Main success scenario:**
  1. The system records the National Bank of Moldova official rate for the invoice date on the invoice record.
  2. The system reproduces the rate on the document.
- **Business rules:** The MDL equivalent, not the foreign amount, is what the fiscal return and the accounting ledger are built from (D-14).
- **Related FRs:** FR-129
- **Related UCs:** UC-91, UC-127, UC-162

### UC-137 — Import a bank statement

- **Primary actor:** BO
- **Module:** Reconciliation & collections
- **Preconditions:** Access to the account statement by file or bank API.
- **Trigger:** A statement becomes available.
- **Main success scenario:**
  1. The Operator imports the account statement into the reconciliation workspace.
- **Business rules:** This exists because the bank transfer rail settles asynchronously with no callback: without an inbound statement the platform has no way to know a customer has paid.
- **Related FRs:** FR-131
- **Related UCs:** UC-121, UC-138, UC-139

### UC-138 — Reconcile an incoming payment automatically

- **Primary actor:** SYS
- **Module:** Reconciliation & collections
- **Preconditions:** Statement lines imported (UC-137); open orders and invoices exist.
- **Trigger:** Import of statement lines.
- **Main success scenario:**
  1. The system matches statement lines to open orders and invoices on payment reference, amount and payer fiscal code.
  2. On a confident match the system marks the invoice paid.
  3. The system provisions the subscription.
- **Alternate flows:** Where no confident match is possible, UC-139 applies.
- **Business rules:** Automatic matching is what keeps the bank transfer rail from becoming a manual back office.
- **Related FRs:** FR-132
- **Related UCs:** UC-114, UC-121, UC-137, UC-139, UC-143

### UC-139 — Resolve an unmatched or partial payment

- **Primary actor:** BO
- **Module:** Reconciliation & collections
- **Preconditions:** An exception from automatic matching (UC-138).
- **Trigger:** A missing or mistyped reference, a partial payment, an overpayment, a payment from a third party on the customer's behalf, or a duplicate.
- **Main success scenario:**
  1. The Operator works the exception.
  2. Every resolution is recorded with its rationale.
- **Business rules:** A manual match is a financial assertion.
- **Related FRs:** FR-133
- **Related UCs:** UC-138, UC-140, UC-163

### UC-140 — Manually mark an invoice paid

- **Primary actor:** BO
- **Module:** Reconciliation & collections
- **Preconditions:** An open invoice settled outside the automated flow — an offline arrangement, an offset, or a payment received through an unsupported channel.
- **Trigger:** The Operator settles the invoice manually.
- **Main success scenario:**
  1. The Operator marks the invoice paid and states a reason.
  2. The action is written to the billing audit ledger (UC-163).
- **Business rules:** It is the single most abusable capability in the billing domain, so a reason is mandatory and the entry is immutable.
- **Related FRs:** FR-134
- **Related UCs:** UC-139, UC-163

### UC-141 — Run the dunning sequence for an overdue invoice

- **Primary actor:** SYS
- **Module:** Reconciliation & collections
- **Stakeholders and interests:** Organization Administrator — receives each reminder; platform — wants collection without abrupt cut-off.
- **Preconditions:** An unpaid invoice past its due date.
- **Trigger:** Passage of the due date, or exhaustion of charge retries (UC-124).
- **Main success scenario:**
  1. The system escalates the unpaid invoice through a configured sequence of reminders at defined intervals.
  2. Each reminder states the amount, the due date passed, and the date service will be restricted.
- **Alternate flows:** The sequence stops immediately on payment.
- **Exception flows:** When dunning is exhausted, UC-142 applies.
- **Business rules:** The schedule is configuration rather than code.
- **Related FRs:** FR-135
- **Related UCs:** UC-124, UC-142, UC-143, UC-172, UC-173

### UC-142 — Restrict service after the grace period expires

- **Primary actor:** SYS
- **Module:** Reconciliation & collections
- **Stakeholders and interests:** Customer — retains their own regulatory records regardless; platform — needs a consequence for non-payment.
- **Preconditions:** Dunning is exhausted (UC-141).
- **Trigger:** Exhaustion of the dunning sequence.
- **Main success scenario:**
  1. The system moves the subscription to suspended.
  2. Reports and entities beyond the Free entitlement become read-only and new exports are blocked.
  3. Previously generated documents remain downloadable.
  4. The Administrator is told exactly what has changed and how to restore it.
- **Business rules:** Under D-13 nothing is deleted. Selection of read-only content follows UC-151.
- **Related FRs:** FR-104, FR-136
- **Related UCs:** UC-44, UC-101, UC-132, UC-141, UC-143, UC-151

### UC-143 — Restore service on payment

- **Primary actor:** SYS
- **Module:** Reconciliation & collections
- **Preconditions:** A suspended subscription with an overdue amount.
- **Trigger:** Settlement of the overdue amount.
- **Main success scenario:**
  1. The system restores full entitlements.
  2. Read-only entities and reports return to editable.
- **Business rules:** Restoration is automatic because the failure that caused suspension is usually an expired card, not a decision; the customer is not required to contact support.
- **Related FRs:** FR-137
- **Related UCs:** UC-105, UC-138, UC-142

### UC-144 — Write off an uncollectible invoice

- **Primary actor:** BO
- **Module:** Reconciliation & collections
- **Preconditions:** A debt judged uncollectible.
- **Trigger:** The Operator writes the debt off.
- **Main success scenario:**
  1. The Operator records the reason and the accounting treatment.
- **Business rules:** The invoice is not deleted — it remains in the ledger with a write-off entry against it, since the fiscal document exists whether or not it was ever paid.
- **Related FRs:** FR-138
- **Related UCs:** UC-141, UC-163

### UC-145 — Issue a full or partial refund

- **Primary actor:** BO
- **Module:** Refunds & disputes
- **Stakeholders and interests:** Customer — receives the funds and the credit note; platform — separates the authority to charge from the authority to reverse.
- **Preconditions:** A recorded payment to refund.
- **Trigger:** A refund decision.
- **Main success scenario:**
  1. The Operator refunds the payment through the original rail where possible and by transfer where not.
  2. The system generates the corresponding credit note (UC-133).
- **Business rules:** Refund authority is separated from invoice issuance so that no single account can both raise a charge and reverse it.
- **Related FRs:** FR-139
- **Related UCs:** UC-133, UC-147, UC-163

### UC-146 — Process a card chargeback

- **Primary actor:** BO
- **Module:** Refunds & disputes
- **Stakeholders and interests:** Acquirer — runs the dispute process; platform — must produce evidence from data it already holds.
- **Preconditions:** A disputed card transaction.
- **Trigger:** Notification of a dispute.
- **Main success scenario:**
  1. The Operator records the case.
  2. The Operator assembles evidence from the order, terms acceptance and usage records.
  3. The Operator records the outcome.
- **Business rules:** The evidence pack is assembled from data the platform already holds, which is the reason UC-113 records the terms version and timestamp.
- **Related FRs:** FR-140
- **Related UCs:** UC-113, UC-147, UC-152, UC-164

### UC-147 — Reverse entitlements following a refund or chargeback

- **Primary actor:** SYS
- **Module:** Refunds & disputes
- **Preconditions:** A financial reversal has occurred (UC-145, UC-146).
- **Trigger:** A refund or chargeback outcome.
- **Main success scenario:**
  1. The system adjusts the subscription to reflect the reversed payment.
  2. The system applies the same read-only treatment as suspension rather than deletion.
- **Business rules:** Entitlement reversal is a distinct step from the financial reversal, because a refund may be partial, goodwill, or for a period already consumed.
- **Related FRs:** FR-141
- **Related UCs:** UC-142, UC-145, UC-146, UC-151

### UC-148 — Evaluate an entitlement check

- **Primary actor:** SYS
- **Module:** Entitlement enforcement
- **Preconditions:** The organization has a plan with declared entitlements (UC-90).
- **Trigger:** Any gated action.
- **Main success scenario:**
  1. The system asks the entitlement service whether the organization's current plan permits the action.
  2. The service returns allow, deny or allow-with-warning.
- **Business rules:** The check is centralised so that a new plan or a changed quota never requires a change to the feature that is being gated. The source register cites this obligation as `FR-23`; under the current FR register it is FR-99 and FR-100 (see section 6, conflict resolution).
- **Related FRs:** FR-99, FR-100
- **Related UCs:** UC-60, UC-90, UC-149, UC-150

### UC-149 — Notify a customer approaching a quota limit

- **Primary actor:** SYS
- **Module:** Entitlement enforcement
- **Stakeholders and interests:** Organization Administrator — needs warning before a reporting deadline turns a limit into a crisis.
- **Preconditions:** Consumption is measured against an entitlement ceiling (UC-66, UC-152).
- **Trigger:** Consumption nearing an entitlement ceiling — seats, entities, exports, API calls.
- **Main success scenario:**
  1. The system notifies the Organization Administrator before the limit is reached.
- **Business rules:** Warning ahead of the wall is what makes an upgrade a considered decision rather than a hostage situation at a reporting deadline.
- **Related FRs:** FR-101
- **Related UCs:** UC-66, UC-150, UC-152, UC-172, UC-173

### UC-150 — Handle a quota-exceeded action

- **Primary actor:** SYS
- **Module:** Entitlement enforcement
- **Preconditions:** An action would exceed entitlement (UC-148).
- **Trigger:** A deny result on a gated action.
- **Main success scenario:**
  1. The system blocks the action.
  2. The system states which limit was reached and what the current plan allows.
  3. The system offers the upgrade path.
- **Business rules:** Reporting work already in progress is never lost to a quota block, and a report already started can always be finished and exported.
- **Related FRs:** FR-102
- **Related UCs:** UC-60, UC-100, UC-148

### UC-151 — Apply the downgrade data-retention rule

- **Primary actor:** SYS
- **Module:** Entitlement enforcement
- **Stakeholders and interests:** Customer — must see the outcome before it happens and must not lose disclosure content.
- **Preconditions:** A lapse, downgrade, suspension or entitlement reversal.
- **Trigger:** A reduction in entitlement.
- **Main success scenario:**
  1. The system selects which entities and reports fall outside the new entitlement under a deterministic, published rule — most recently active retained.
  2. The system moves them to read-only.
- **Business rules:** The rule is deterministic and published rather than arbitrary. The customer is shown the outcome before the downgrade takes effect (UC-101). Nothing is deleted (D-13).
- **Related FRs:** FR-103, FR-104
- **Related UCs:** UC-101, UC-105, UC-142, UC-147

### UC-152 — Emit and store a metering event

- **Primary actor:** SYS
- **Module:** Entitlement enforcement
- **Preconditions:** None.
- **Trigger:** Every billable-shaped action.
- **Main success scenario:**
  1. The action emits a metering event carrying organization, action type, quantity and timestamp.
  2. The event is stored in an append-only stream.
- **Business rules:** The stream is the single source for usage counters (UC-66), quota evaluation, adoption metrics (UC-83) and any future usage-based pricing, so it is emitted for actions that are not currently billed.
- **Related FRs:** FR-105
- **Related UCs:** UC-42, UC-66, UC-83, UC-148, UC-149

### UC-153 — Request an Enterprise quote

- **Primary actor:** OA
- **Module:** Enterprise contracting
- **Stakeholders and interests:** Administrator — needs Enterprise terms; Billing Operator — receives the opportunity.
- **Preconditions:** None.
- **Trigger:** The Administrator requests Enterprise terms.
- **Main success scenario:**
  1. The Administrator describes entity count, user count and required capabilities.
  2. The request creates a tracked opportunity.
- **Business rules:** Enterprise never passes through self-serve checkout (D-12), so this request is the entry point to the contract path and creates a tracked opportunity rather than an email.
- **Related FRs:** FR-142
- **Related UCs:** UC-154

### UC-154 — Prepare and issue a quote

- **Primary actor:** BO
- **Module:** Enterprise contracting
- **Preconditions:** A tracked opportunity (UC-153).
- **Trigger:** The Operator responds to a quote request.
- **Main success scenario:**
  1. The Operator builds a quote against a negotiated entitlement set, price, currency and billing schedule.
  2. The Operator issues it with a validity date.
- **Business rules:** The quote is structured data rather than a document, so an accepted quote provisions directly and the sold terms and the configured terms cannot drift apart.
- **Related FRs:** FR-143
- **Related UCs:** UC-153, UC-155, UC-156

### UC-155 — Record a signed contract and its negotiated terms

- **Primary actor:** BO
- **Module:** Enterprise contracting
- **Preconditions:** An executed agreement exists.
- **Trigger:** Contract execution.
- **Main success scenario:**
  1. The Operator records term length, notice period, negotiated entitlements, SLA, price protection, and any non-standard clause with billing consequences.
- **Business rules:** This is the authoritative record the Enterprise subscription is provisioned from.
- **Related FRs:** FR-144
- **Related UCs:** UC-154, UC-156, UC-158, UC-159

### UC-156 — Provision an Enterprise subscription from a contract

- **Primary actor:** BO
- **Module:** Enterprise contracting
- **Preconditions:** A recorded contract (UC-155).
- **Trigger:** The Operator activates the subscription.
- **Main success scenario:**
  1. The Operator activates the subscription with the contract's negotiated entitlements, which override the standard plan's quotas per organization.
- **Business rules:** Overrides are additive data on the subscription rather than a bespoke plan per customer, which is what stops the plan catalogue from degenerating into one plan per client.
- **Related FRs:** FR-145
- **Related UCs:** UC-90, UC-155, UC-163

### UC-157 — Record a purchase order reference

- **Primary actor:** OA
- **Module:** Enterprise contracting
- **Preconditions:** A subscription exists.
- **Trigger:** The Administrator records their own PO or contract reference.
- **Main success scenario:**
  1. The Administrator records the reference against the subscription.
  2. The reference is reproduced on every invoice issued under it.
- **Business rules:** Institutional and public-sector buyers — the Licensee model's eventual customers — will not process an invoice that omits it.
- **Related FRs:** FR-146
- **Related UCs:** UC-127, UC-155

### UC-158 — Bill an Enterprise contract on a custom schedule

- **Primary actor:** BO
- **Module:** Enterprise contracting
- **Preconditions:** A recorded contract with a billing schedule (UC-155).
- **Trigger:** Contract provisioning, and each scheduled billing point.
- **Main success scenario:**
  1. The Operator schedules invoicing to match the contract: annual in advance, semi-annual, milestone-based, or multi-year with an annual instalment.
- **Business rules:** The scheduler is data-driven, since the alternative is a manual diary entry that will eventually be missed.
- **Related FRs:** FR-147
- **Related UCs:** UC-127, UC-155

### UC-159 — Manage contract renewal and expiry

- **Primary actor:** BO
- **Module:** Enterprise contracting
- **Preconditions:** A contract approaching expiry.
- **Trigger:** Approach of the notice period or expiry date.
- **Main success scenario:**
  1. The Operator tracks approaching expiry.
  2. The Operator initiates renewal within the notice period.
  3. The Operator records renewal, renegotiation or expiry.
- **Alternate flows:** Where a contract expires without renewal, the subscription follows the standard lapse path (D-13) rather than terminating abruptly.
- **Related FRs:** FR-147
- **Related UCs:** UC-142, UC-151, UC-155

### UC-160 — Maintain VAT rates and tax rules

- **Primary actor:** BO
- **Module:** Financial reporting & audit
- **Preconditions:** None.
- **Trigger:** A legislative change to rates or digital-services rules.
- **Main success scenario:**
  1. The Operator maintains the applicable VAT rates and the rules selecting treatment by customer residency and VAT status, each with an effective date.
- **Business rules:** Rates and digital-services rules change by legislation on their own timetable, and a rate change must never require a deployment.
- **Related FRs:** FR-148
- **Related UCs:** UC-112, UC-128, UC-162

### UC-161 — View the billing revenue dashboard

- **Primary actor:** BO
- **Module:** Financial reporting & audit
- **Preconditions:** Billing activity exists.
- **Trigger:** The Operator opens the dashboard.
- **Main success scenario:**
  1. The Operator views recognised and deferred revenue, active subscriptions by plan, monthly recurring revenue, churn, collection rate and days sales outstanding.
- **Business rules:** Read alongside the adoption metrics (UC-83), this is what makes the Phase 2 monetization decision evidence-based rather than assumed.
- **Related FRs:** FR-149
- **Related UCs:** UC-83, UC-84

### UC-162 — Export the revenue and VAT report for accounting

- **Primary actor:** BO
- **Module:** Financial reporting & audit
- **Stakeholders and interests:** Operator — produces the extract; the company's accountant — consumes it for the fiscal return.
- **Preconditions:** A closed period with invoices, credit notes and payments.
- **Trigger:** Period end, or preparation of the quarterly VAT return.
- **Main success scenario:**
  1. The Operator extracts the period's invoices, credit notes, payments and VAT summary in the form the company's accountant and fiscal return require, including the MDL equivalents of foreign-currency documents.
- **Business rules:** This is the handover point between the platform and the company's own accounting obligations; the platform does not replace the accounting system.
- **Related FRs:** FR-150
- **Related UCs:** UC-136, UC-160, UC-163

### UC-163 — Review the immutable billing audit ledger

- **Primary actor:** BO
- **Module:** Financial reporting & audit
- **Preconditions:** Financial events have been recorded.
- **Trigger:** An audit, dispute or review.
- **Main success scenario:**
  1. The Operator reviews the append-only record of every financial event: order, invoice, payment, credit note, refund, manual match, write-off, entitlement override and price change, each attributed and timestamped.
- **Business rules:** Entries are never edited or deleted, only superseded, which is what makes the ledger evidence.
- **Related FRs:** FR-151
- **Related UCs:** UC-107, UC-133, UC-140, UC-144, UC-145, UC-156

### UC-164 — Reconcile provider settlement against recorded payments

- **Primary actor:** BO
- **Module:** Financial reporting & audit
- **Stakeholders and interests:** Operator — must know what was actually received; acquirer and instant rail — produce the settlement reports.
- **Preconditions:** Settlement reports are available from the acquirer and the instant rail.
- **Trigger:** Receipt of a settlement report.
- **Main success scenario:**
  1. The Operator reconciles the settlement reports against payments recorded in the platform.
  2. The Operator identifies missing settlements, fee discrepancies and timing differences.
- **Business rules:** Without this the platform knows what it charged but not what it actually received, and the two differ routinely.
- **Related FRs:** FR-152
- **Related UCs:** UC-116, UC-120, UC-146, UC-163

### UC-165 — View the in-app notification centre

- **Primary actor:** CA
- **Module:** Notifications
- **Preconditions:** The user is authenticated with an active organization selected.
- **Trigger:** The user opens the notification centre, or sees the unread count.
- **Main success scenario:**
  1. The user opens a persistent list of the notifications addressed to them in the active organization.
  2. An unread count is visible from anywhere in the application.
- **Business rules:** The centre is storage, not a transient toast: a notice raised while the user was logged out is waiting when they return, which is what makes in-app a real channel rather than a decoration.
- **Related FRs:** FR-160, FR-161
- **Related UCs:** UC-166, UC-167, UC-172

### UC-166 — Open a notification and act on its subject

- **Primary actor:** CA
- **Module:** Notifications
- **Preconditions:** A notification exists for the user.
- **Trigger:** The user selects a notification.
- **Main success scenario:**
  1. Selecting the notification takes the user straight to what raised it — the incomplete module, the reporting period, the invoice.
- **Business rules:** A notice saying something is missing but not where converts far worse than one that lands the user on the screen that fixes it.
- **Related FRs:** FR-162
- **Related UCs:** UC-39, UC-165, UC-169

### UC-167 — Mark a notification read or dismiss it

- **Primary actor:** CA
- **Module:** Notifications
- **Preconditions:** A notification exists for the user.
- **Trigger:** The user has handled or read the item.
- **Main success scenario:**
  1. The user marks the item read, or dismisses one they have already handled.
- **Business rules:** Read state is held per user, so one recipient of an organization-wide notice reading it does not clear it for their colleagues.
- **Related FRs:** FR-161
- **Related UCs:** UC-165, UC-174

### UC-168 — Set own notification preferences

- **Primary actor:** CA
- **Module:** Notifications
- **Preconditions:** The user is authenticated; a category catalogue exists (UC-176).
- **Trigger:** The user opens notification preferences.
- **Main success scenario:**
  1. The user chooses, per notification category, whether it reaches them in-app, by email, by both, or not at all.
- **Business rules:** Preferences sit on the user profile (UC-13) and follow the user across organizations. Transactional categories — security, account, invoice delivery, payment failure — are shown as mandatory, because a user should not be able to opt out of being told their card was declined.
- **Related FRs:** FR-9, FR-163
- **Related UCs:** UC-13, UC-125, UC-131, UC-176

### UC-169 — Notify that a report still requires updating

- **Primary actor:** SYS
- **Module:** Notifications
- **Stakeholders and interests:** Users with edit access — receive the notice; Organization Administrator — sees the same picture through UC-67.
- **Preconditions:** A reporting period is open and mandatory disclosures remain unanswered or validation findings unresolved.
- **Trigger:** Evaluation of the validation rollup while the condition holds; repeats at a configured interval.
- **Main success scenario:**
  1. The system notifies the users with edit access.
  2. The notice names the specific modules and fields outstanding rather than saying only that the report is incomplete.
- **Business rules:** The named list comes from the validation rollup (UC-38), which already computes it. The notice repeats at a configured interval and stops when the report is complete; there is no escalation chain and no per-notification assignment.
- **Related FRs:** FR-164, FR-167
- **Related UCs:** UC-38, UC-67, UC-166, UC-172, UC-173, UC-175, UC-176

### UC-170 — Notify that a reporting deadline is approaching

- **Primary actor:** SYS
- **Module:** Notifications
- **Preconditions:** The period carries a due date (UC-56).
- **Trigger:** Each configured lead time before the due date.
- **Main success scenario:**
  1. The system notifies at configured lead times, stating the date, the days remaining and the current completion state.
- **Alternate flows:** Nothing is sent where the report is already complete and validated.
- **Business rules:** A reminder that fires regardless of state trains users to ignore the channel.
- **Related FRs:** FR-165, FR-167
- **Related UCs:** UC-38, UC-56, UC-176

### UC-171 — Notify that a regulatory or template change requires a report update

- **Primary actor:** SYS
- **Module:** Notifications
- **Stakeholders and interests:** Affected organizations — must know what the change obliges.
- **Preconditions:** A taxonomy or template version change (UC-75, UC-78), an applicability threshold change (UC-81), or an emission factor update (UC-80) means an existing report must be reviewed or re-exported.
- **Trigger:** Any of those platform-side changes.
- **Main success scenario:**
  1. The system notifies the affected organizations, naming the change and what it obliges.
- **Business rules:** This is the mechanised form of UC-79.
- **Related FRs:** FR-70, FR-166
- **Related UCs:** UC-75, UC-78, UC-79, UC-80, UC-81

### UC-172 — Deliver a notification in-app

- **Primary actor:** SYS
- **Module:** Notifications
- **Preconditions:** A notification has been raised for one or more recipients.
- **Trigger:** Dispatch of a notification on the in-app channel.
- **Main success scenario:**
  1. The system writes the notification to each recipient's notification centre.
  2. The system updates their unread count.
- **Business rules:** In-app delivery depends on no external provider, so it is the channel that still works when the email provider is down.
- **Related FRs:** FR-160, FR-168
- **Related UCs:** UC-165, UC-174

### UC-173 — Deliver a notification by email

- **Primary actor:** SYS
- **Module:** Notifications
- **Preconditions:** A notification has been raised; the recipient's contact address and interface language are known.
- **Trigger:** Dispatch of a notification on the email channel.
- **Main success scenario:**
  1. The system sends the notification to the recipient's contact address.
  2. The message is rendered in that recipient's own interface language.
  3. Delivery runs through an email provider reached behind the standard provider adapter.
- **Business rules:** Email exists because the target user is an SME owner who does not log in between reporting sessions and would otherwise never see an in-app notice at all. Optional-category emails carry a working unsubscribe link.
- **Related FRs:** FR-169
- **Related UCs:** UC-14, UC-168, UC-174

### UC-174 — Record delivery outcome and handle a failed send

- **Primary actor:** SYS
- **Module:** Notifications
- **Stakeholders and interests:** Organization Administrator — is surfaced a suppressed recipient.
- **Preconditions:** A dispatch has been attempted (UC-172, UC-173).
- **Trigger:** Completion or failure of a dispatch.
- **Main success scenario:**
  1. The system records, per notification and recipient, the channel used, the dispatch timestamp, the outcome, and — for in-app — whether it was read.
- **Exception flows:** A transient failure is retried on a bounded schedule; an address that hard-bounces is suppressed and surfaced to the Organization Administrator.
- **Business rules:** A silently undeliverable address is otherwise indistinguishable from a person ignoring their notices.
- **Related FRs:** FR-160, FR-170, FR-171
- **Related UCs:** UC-131, UC-167, UC-172, UC-173

### UC-175 — Send a manual reminder to a user

- **Primary actor:** OA
- **Module:** Notifications
- **Preconditions:** A specific user has an outstanding report.
- **Trigger:** The Administrator prompts the user without waiting for the next scheduled notice.
- **Main success scenario:**
  1. The Administrator selects the user and optionally adds a note.
  2. The reminder goes out through the same mechanism and is recorded the same way.
- **Business rules:** Using the common mechanism keeps the delivery history from fragmenting.
- **Related FRs:** FR-173
- **Related UCs:** UC-67, UC-169, UC-172, UC-173, UC-174

### UC-176 — Maintain notification categories and templates

- **Primary actor:** PA
- **Module:** Notifications
- **Preconditions:** An elevated session.
- **Trigger:** A notice must be added, reclassified, retimed or reworded.
- **Main success scenario:**
  1. The Administrator maintains the category catalogue — default channels, transactional-or-optional classification, deadline lead times, and the interval at which an outstanding-report notice repeats.
  2. The Administrator authors the in-app and email templates per locale.
  3. Changes are published on the same publication mechanism as the rest of the platform's content (UC-71, UC-72).
- **Business rules:** Adding a notice or changing its wording is configuration, not a release.
- **Related FRs:** FR-173
- **Related UCs:** UC-71, UC-72, UC-168, UC-169, UC-170

### UC-177 — Evaluate the platform before registering

- **Primary actor:** VI (Visitor)
- **Module:** Public tier
- **Stakeholders and interests:** Prospective customer — wants to know whether the platform produces the report they are obliged or asked to produce, before spending an email address on it; platform — wants the free tier's on-ramp to be reachable without a sign-up wall.
- **Preconditions:** None. No account and no session exist.
- **Trigger:** A person arrives at the platform's public address.
- **Main success scenario:**
  1. The visitor reads what the platform produces, what it costs, and what is asked of them.
  2. The visitor proceeds to registration (UC-01, UC-02), or leaves.
- **Postconditions:** None on the platform. Nothing is stored against the visitor, and NFR-30 keeps personal data out of the analytics that would otherwise record the visit.
- **Business rules:** This is the only screen `architecture.md` §14.2 permits to be cached by the framework, because it is the only tenant-independent one; the same section prohibits `"use cache"` everywhere a tenant is in scope.
- **Related FRs:** —
- **Related UCs:** UC-01, UC-02, UC-178, UC-180

### UC-178 — Read a published legal document

- **Primary actor:** VI (Visitor); available to every authenticated actor through the footer
- **Module:** Public tier
- **Stakeholders and interests:** Reader — wants to know what is being agreed to and how personal data is handled; platform — is obliged to say so before collecting anything.
- **Preconditions:** None.
- **Trigger:** The reader follows a legal link, from the public site or from the footer of any screen.
- **Main success scenario:**
  1. The reader opens the terms of service, the privacy notice or the cookie policy.
  2. The reader reads a plain-language summary and, beneath it, the formal text.
- **Postconditions:** None on the platform.
- **Business rules:** The information duty is discharged **where personal data is collected**, which is registration (UC-01) — so this use case is a precondition of a lawful registration path rather than a companion to it. GDPR Article 13 and Law No. 195/2024 (applicable 23 August 2026) are the obligation; NFR-5 is where the platform holds it. The three documents are one set with one navigation, so a reader who arrives at the cookie policy can see the other two.
- **Related FRs:** —
- **Related UCs:** UC-01, UC-179, UC-177

### UC-179 — Set the cookie choice

- **Primary actor:** VI (Visitor)
- **Module:** Public tier
- **Stakeholders and interests:** Reader — wants to know what is set before it is set, and to change their mind later; platform — must not set non-essential storage it has not disclosed.
- **Preconditions:** None.
- **Trigger:** First arrival, or the reader returning to the cookie policy to change a previous answer.
- **Main success scenario:**
  1. The visitor is shown what the site sets and what it does not.
  2. The visitor accepts or declines the non-essential categories.
  3. The site honours the answer.
- **Postconditions:** **Undecided — `design_spec.md` OQ-16.** Whether the answer is *recorded* server-side as a consent record, or applied client-side as an implied-consent preference, is open; the two produce different postconditions and the second needs no API. Recorded rather than assumed, because deciding it here would close a legal question by UI default — which is what OQ-16 says about it.
- **Business rules:** What the application actually sets is a factual claim the screen makes about shipped code, not a template sentence; the prototype's "What we do not set" section has to be true of the build.
- **Related FRs:** —
- **Related UCs:** UC-178

### UC-180 — Browse the help centre

- **Primary actor:** VI (Visitor); the same screen serves CA signed in
- **Module:** Public tier
- **Stakeholders and interests:** Reader — wants guidance for the task in hand; platform — wants a support question answered before it is asked.
- **Preconditions:** Published help content exists (UC-71, UC-72).
- **Trigger:** The reader opens help, from the public site or from any screen's help affordance.
- **Main success scenario:**
  1. The reader browses articles grouped by what they are doing.
  2. The reader opens one (UC-181), or contacts support (UC-182).
- **Postconditions:** None on the platform.
- **Business rules:** **UX-109** (WCAG 2.2, Consistent Help) puts help in the same place on every screen, so this screen has one entry affordance and it does not move. Articles are the FR-61 configuration store's published entries, so a wording correction reaches the reader without a release; an unpublished version has no address.
- **Related FRs:** FR-61
- **Related UCs:** UC-71, UC-72, UC-181, UC-182

### UC-181 — Read a published help article

- **Primary actor:** VI (Visitor); the same screen serves CA signed in
- **Module:** Public tier
- **Stakeholders and interests:** Reader — wants one question answered in terms they use; platform — wants the article to name the module it belongs to, so the answer lands somewhere.
- **Preconditions:** The article is published in the reader's locale, or a fallback locale is available (FR-64).
- **Trigger:** The reader selects an article, or arrives on a deep link.
- **Main success scenario:**
  1. The reader reads the article in the active locale.
  2. The reader returns to the help centre, follows the article into the product, or contacts support.
- **Postconditions:** None on the platform. A locale fallback is reported (FR-64), which applies to FR-61 content because catalogue gaps fail the build instead.
- **Business rules:** Articles are written for people who run a business, not for people who read standards. No article may carry an internal identifier — `FR-`, an enum member, a taxonomy element key — under the user-facing-text rule.
- **Related FRs:** FR-61
- **Related UCs:** UC-180, UC-182, UC-71

### UC-182 — Contact support

- **Primary actor:** VI (Visitor); the same screen serves CA signed in
- **Module:** Public tier
- **Stakeholders and interests:** Reader — has a question the published guidance does not answer; platform — needs the request to arrive somewhere with a reference, since UC-85 presupposes exactly that.
- **Preconditions:** None.
- **Trigger:** The reader cannot resolve their question from the help centre.
- **Main success scenario:**
  1. The reader states their question.
  2. The request reaches support.
- **Postconditions:** A support request exists with a ticket reference — **which is what UC-85 has always assumed and no source has ever provided.** This use case is registered to close that gap in the register; it does not close the mechanism.
- **Business rules:** **The channel is undecided** (`task.md` task 77). The candidates are an address the screen publishes, a form posting to the API and dispatching through the outbox as verification email already does, or an external helpdesk — three different products with three different data-protection footprints, and the choice governs whether this use case has a postcondition inside the platform at all.
- **Related FRs:** —
- **Related UCs:** UC-85, UC-180, UC-181

---

## 6. Use case design decisions and constraints

Every `D-n` reference in section 5 resolves here. Decision identifiers are preserved verbatim from "ESG Platform Use Case Design Decisions and Constraints (MVP)".

### 6.1 Design decisions

**D-1 — Registration creates an Organization Administrator, not a Reporting Contributor.** The founding user of a new organization is auto-granted the Organization Administrator role at registration (UC-01/UC-02 → UC-49). This resolves the contradiction where "register & create org" sat under a role defined as having no access to organization settings. A person becomes a pure Reporting Contributor only by being invited into an existing org (UC-60 → UC-15). In a true micro-business the same person holds both roles, which the permission model allows.

**D-2 — Entity master data is Org Admin-owned; disclosure content is Contributor-owned.** The Organization Administrator maintains the legal entity record (legal form, NACE, identifiers, consolidation scope) and the reporting-period lifecycle. The Reporting Contributor fills the report itself, including the B1 disclosure fields — which pre-populate from the entity record but remain editable in-report, since B1 is a disclosure, not master data.

**D-3 — Comparatives are MVP for storage and inline display; the standalone year-over-year dashboard is P2.** UC-45 and UC-46 ship at MVP because the multi-period data model is already an MVP requirement (NFR-3) and comparative data becomes mandatory in a company's second reporting year. The legacy requirement `FR-15` — the year-over-year view — should be split accordingly; under the current FR register the MVP half of that split is FR-45, FR-46 and FR-47 (see 6.3).

**D-4 — "Not available, with reason" is a first-class field state.** Every reference report reviewed in this project explicitly discloses gaps rather than hiding them, so a declared, explained gap is a valid terminal state (UC-31), distinct from an unaddressed `MISSING VALUE`.

**D-5 — Platform Administrator has no standing access to tenant report data.** Access to a specific organization's report content is obtained only through a time-boxed, logged support-access grant (UC-85), itself auditable (UC-86).

**D-6 — Social sign-in is in MVP scope; enterprise SSO is not.** Sign-up and sign-in through consumer/business identity providers — Google and Microsoft at MVP — sit alongside email and password as separate authentication paths over a single account record. The target user is a small-business owner or bookkeeper who already holds a Google or Microsoft work account and for whom another password is a real barrier at first use. Enterprise SSO in the federated sense (SAML/OIDC against a customer's own directory, with domain claiming and provisioning) stays out of MVP, but the identity model is provider-agnostic so adding it is a provider registration rather than a rework.

**D-7 — "Built from the ground up" means owning the billing domain, not the card rails.** The platform builds and owns the plan catalogue, subscription state machine, order flow, invoice and credit-note documents, billing ledger, dunning, and entitlement enforcement — the parts a third-party billing vendor would otherwise have supplied and the parts that carry Moldovan fiscal law. It does not build card processing itself: accepting raw card data would place the platform in PCI DSS SAQ-D scope, which is disproportionate and avoidable. Card capture stays with a licensed acquirer's hosted page or SDK, reached through a provider adapter. This is the pattern NFR-11 already mandates for third-party components, applied to payments.

**D-8 — Four payment rails, all provider-executed, behind one adapter interface.** Nothing in the `Payment (external provider)` module is built in-house. Money movement is performed entirely by licensed third parties — maib, Victoriabank or MICB for card acquiring, the participating banks' APIs for MIA, the customer's own bank for transfers, and a merchant-of-record for non-residents. What the platform builds is the integration: the adapter interface, the order-to-rail routing, the callback and reconciliation handling, and the state machine that decides what a payment result means for a subscription. Executing payments without a licence is not something a software vendor may do in Moldova or anywhere else. No single Moldovan rail covers every case, so the order flow is rail-agnostic and the customer chooses at checkout.

| Rail | Use case | MVP status | Constraint that shapes it |
|---|---|---|---|
| (a) Bank transfer against a proforma invoice | UC-121 | MVP, default for annual and Enterprise | Dominant B2B settlement method in Moldova; the only rail with no amount ceiling; settles asynchronously and unattributed by default, so it requires reconciliation (UC-137 … UC-140) |
| (b) MIA instant payments | UC-120 | MVP, monthly billing and small orders | National Bank instant rail by QR, payment link or request-to-pay; settles in under ten seconds; commission-free below 10,000 MDL per month; capped near 5,000 MDL per transaction, which sits below an annual Standard or Enterprise price |
| (c) Domestic card acquiring | UC-116 … UC-119 | MVP | maib, Victoriabank or MICB; supports tokenisation and is the only rail giving true unattended recurring billing; domestic-only and will not accept a foreign card |
| (d) Merchant-of-record adapter | UC-122 | Registered but inactive at MVP | Paddle/Lemon Squeezy class, 5–8% of gross; reserved for non-resident customers arriving with the Phase 2 Advisor, Corporate Buyer and Licensee models; activation is configuration |

**D-9 — e-Factura integration is an MVP requirement, not a Phase 2 nicety.** Moldova's national e-Factura platform becomes mandatory for B2B invoicing from October 2026, following the B2G mandate already in force and a pilot that ran from January 2026. Since every paying customer of this platform is a Moldovan business, essentially every invoice the platform issues falls in scope from the first paid transaction. The internal invoice is therefore modelled as a platform-owned record that an adapter *renders* into the national XML format and transmits (UC-129), rather than as a PDF that happens to be emailed — with a Peppol path anticipated for cross-border exchange. Building this later would mean rebuilding the invoice document itself.

**D-10 — Issued invoices are immutable; corrections are credit notes.** Invoice numbering runs as a gapless sequential series per document type per fiscal year (UC-134), and an issued invoice is never edited. Any correction — price error, cancelled service, refund — is a separate corrective document referencing the original (UC-133). This is a statutory constraint, and it is also what makes the billing ledger auditable.

**D-11 — Billing is a separate bounded context from the compliance core.** NFR-1 already requires that the report data model, validation and export generation carry no dependency on plan, price or tenant type. Billing therefore owns its own data and publishes only entitlement changes into the core, which reads them through the entitlement service. The practical test: disabling billing entirely must leave every reporting use case (UC-17 … UC-48) functioning.

**D-12 — Three plans at MVP: Free, Standard, Enterprise.** Free is self-serve, covering a single reporting entity, the Basic Module, PDF and Excel export, and a capped number of users — deliberately enough to complete a real VSME report, because a first report that cannot be finished produces no adoption and no referral. Standard is self-serve and paid, adding multiple reporting entities, higher user and export quotas, comparative-period features, and support response commitments. Enterprise is contract-based, never passes through self-serve checkout, and is provisioned from a signed agreement with negotiated entitlements, custom billing schedule, purchase-order reference and an SLA (UC-153 … UC-159). The Advisor, Corporate Buyer and Licensee models arriving in Phase 2/3 will all be Enterprise-shaped, which is why the contract path exists at MVP even at low volume.

**D-13 — A downgrade or non-payment never destroys report data.** Lapsing to Free, or suspension for non-payment, moves out-of-entitlement entities and reports to read-only and blocks new exports (UC-142, UC-151); it does not delete disclosure content. The customer retains export of already-generated documents throughout (UC-44, UC-132). Sustainability records are the customer's own regulatory records, and holding them hostage against an unpaid invoice is both commercially self-defeating and legally exposed.

**D-14 — MDL is the ledger currency; foreign-currency invoices record the BNM rate.** Prices are set per plan per currency rather than converted at display time (UC-91). Where an invoice is issued in EUR or USD, the National Bank of Moldova official rate for the invoice date is stored on the invoice record itself and reproduced on the document (UC-136), because the MDL equivalent is what the fiscal return and the accounting ledger are built from.

### 6.2 Moldova payment and fiscal constraints driving the billing design

These are the external facts the billing use cases are shaped around. They are recorded because they are the reason the design departs from a conventional third-party-hosted SaaS billing stack, and because several of them carry dates.

**Stripe does not support Moldova-resident businesses.** The commonly used workarounds are incorporating a foreign entity — Stripe Atlas produces a Delaware C-Corp, which imports US filing obligations and can erode the 7% Moldova IT Park regime — or a merchant-of-record such as Paddle or Lemon Squeezy at roughly 5–8% of gross. PayPal availability for Moldovan businesses has fluctuated and is sector-sensitive, so it is not designed for as a primary rail.

**Domestic acquiring is domestic-only.** maib, Victoriabank and MICB provide e-commerce card acquiring for Moldovan merchants, but it does not serve international customers. This is why UC-122 exists as a registered-but-inactive adapter rather than being deferred entirely: the Phase 2 Advisor, Corporate Buyer and Licensee models bring non-resident customers that domestic acquiring structurally cannot bill.

**MIA instant payments carry a per-transaction ceiling.** The National Bank's instant rail settles in under ten seconds, operates 24/7 across fifteen-plus participating banks, and is commission-free below 10,000 MDL per month — but is capped near 5,000 MDL per transaction with a recommended daily cumulative limit around 25,000 MDL. An annual Standard or Enterprise price will sit above the per-transaction cap, which is precisely why UC-112 must present rail availability as a function of order total and why UC-120 reads the limit from configuration rather than code.

**e-Factura becomes mandatory for B2B in October 2026.** The national platform has been mandatory for B2G since 2023; a B2B pilot ran from January 2026 and the mandate takes effect 1 October 2026, using a national XML format with local archiving rules and a Peppol path for cross-border exchange. Every paying customer of this platform is a Moldovan business, so the mandate applies from the first paid invoice. Relative to this document's date this is a near-term deadline, not a roadmap item — hence D-9.

**VAT and retention.** The standard Moldovan VAT rate is 20%, with no reduced rate applicable to digital services. Invoices require sequential numbering and full supplier and buyer identification, with reverse-charge notation where applicable; VAT returns are quarterly, due by the 25th of the following month, and records must be retained for at least six years. UC-134, UC-135 and UC-160 exist to satisfy these directly.

**Sources:** MIA Instant Payments, National Bank of Moldova (`mia.bnm.md/en`) · maib — MIA in e-commerce solutions · Payment processing for Moldovan SRLs (Incorpore) · Moldova e-invoicing requirements and timeline (VATupdate) · Moldova mandatory e-Factura from 1 October 2026 (Global Indirect Tax Management) · SaaS VAT in Moldova (PayPro Global).

### 6.3 Conflicts between sources and how they are resolved here

| # | Conflict | Resolution in this document |
|---|---|---|
| 1 | Actor set. "ESG Platform System Actors (MVP)" defines three actors (Reporting Contributor, Organization Administrator, Platform Administrator). The Use Case Register uses six codes, adding **CA** as an access grouping, **BO** Billing Operator as a new role, and **SYS** for platform-initiated behaviour, with BO explicitly flagged as a "recommended addition to the System Actors doc". | The register's six codes are used, since the dedicated use case register and the FR register both depend on them. The three System Actors names are reproduced verbatim for RC, OA and PA. BO and CA/SYS remain open items against the System Actors document (section 9, OQ-1). |
| 2 | No `ACT-*` identifier scheme exists. Neither source assigns numeric actor IDs. | Actor identifiers are the two- and three-letter codes CA, RC, OA, PA, BO, SYS. No `ACT-*` IDs are invented. |
| 3 | Use case count. The Design Decisions companion refers to "the 164 use cases", while the Use Case Register contains 176 and states that count. | 176 is correct; the companion's figure predates the addition of the notifications module (UC-165 … UC-176). The dedicated register wins. |
| 4 | Legacy `FR-23` cited in UC-148. The register cites `FR-23` for the centralised entitlement check. The current FR register renumbered from FR-1 and its FR-23 is the organization-wide report status overview. | The obligation is now carried by **FR-99** and **FR-100**. The original citation is preserved in the UC-148 business rule with a note; no identifier is rewritten silently. |
| 5 | Legacy `FR-15` cited in D-3. D-3 says "FR-15 should be split accordingly", meaning the legacy year-over-year requirement. The current FR-15 is organization profile maintenance. | D-3 is reproduced verbatim with a bracketed note that the MVP half of the split is now FR-45, FR-46 and FR-47. |
| 6 | Sixteen coarse use cases UC-1 … UC-16 in "ESG Platform Actors, Use Cases, FR and NFR (MVP)" collide numerically with UC-01 … UC-16 of this register but mean different things. **Convention set 18 Aug 2026 (`actors.md` OQ-3): the current register is `UC-01` … `UC-176`, zero-padded through UC-09; the superseded set is always written `UC-n (legacy)` and never bare, so a bare `UC-n` always means this register.** | The earlier set is superseded and is retained only as the legacy mapping in section 8.2. Within this document, `UC-nn` always means the consolidated register. |
| 7 | Forward-looking use cases UC-17 … UC-24 in the earlier combined document describe Phase 2/3 capabilities and again collide numerically with this register. | Those are not use cases in this baseline. They appear in section 7 as deferred scope, by description rather than by their legacy IDs, to avoid two live meanings for one identifier. |
| 8 | Actor naming. The earlier combined document uses "SME Report Preparer", "SME Org Admin", "Platform Admin / Support". | The System Actors names — Reporting Contributor, Organization Administrator, Platform Administrator — are authoritative. |
| 9 | Module placement of UC-48 (export language) under the "Traceability" module in the register, though it is an export concern. | Preserved verbatim, since modules carry no system meaning; flagged in section 9 (OQ-6). |

---

## 7. Use cases deferred beyond the MVP

These are out of MVP scope by prior decision, recorded so the register reads as complete. No use case IDs are assigned to them; assigning IDs now would fix a decomposition that has not been made.

### 7.1 Platform and reporting scope

| Deferred capability | Phase | Rationale |
|---|---|---|
| Advisor portfolio management — managing a portfolio of client organizations from one login, completing or reviewing a report on a client's behalf | P2/P3 | Belongs to a Phase 2/3 actor. The organization-relationship model created in UC-49 is built to accept it without a schema change. |
| Corporate buyer supplier monitoring — inviting and monitoring supplier organizations, aggregated and benchmarked dashboards, consented data requests | P2/P3 | Same actor-arrival rationale; the generic relationship model is the MVP provision for it. |
| Licensee white-label administration — branding an instance (logo, domain, language pack) and managing sub-orgs under it | P2/P3 | This is where the original Moldova/MDED scenario now sits; it arrives with the licensing model, not with the MVP. |
| Enterprise SSO — federated SAML or OIDC against a customer's own directory, with domain claiming, just-in-time provisioning and directory-driven deprovisioning | Deferred | Distinct from the social sign-in that is in scope (D-6). Becomes relevant when Advisor and Corporate Buyer organizations arrive; the provider-agnostic identity model keeps it additive. |
| Multi-factor authentication for ordinary tenant users | Deferred | Required now only for the Platform Administrator (UC-68). |
| XBRL export — Inline XBRL, XBRL-JSON, XBRL-CSV via EFRAG's self-hosted open-source converter | P2 | The MVP export target is the Excel Digital Template (UC-43); the converter sits behind the third-party interface so adding it is additive. |
| Comprehensive Module (C1–C9) as an additive extension of Basic | P2 | MVP is Basic Module only; the internal schema mirrors VSME element names so the extension does not force a remodel. |
| Completion dashboards with deadline reminders as a standalone surface | P2 | The MVP equivalents are the report status overview (UC-67) and the deadline notice (UC-170). |
| Standalone year-over-year analytics view | P2 | Comparatives ship at MVP for storage and inline display only (D-3, UC-45, UC-46). |
| Automated data ingestion from energy providers and accounting software | P3 | Manual entry (UC-32) is the MVP path. |
| AI-assisted narrative drafting for qualitative fields | P3 | Requires the human-review and authorship guarantees stated in the NFR set before it can be scoped. |
| External document-risk flagging of narrative disclosures | P3 | Advisory-only warnings from a third-party service; no MVP requirement depends on it. |
| Public opt-in disclosure portal | P3 | Structured to align with anticipated ESAP requirements, which are not settled. |
| ESAP submission bridge | Roadmap, uncommitted | No requirements are written against it; it needs a concrete problem statement before being scoped. |
| Blockchain traceability | Roadmap, uncommitted | Same — no problem statement, no requirements. |

### 7.2 Billing domain scope

| Deferred capability | Rationale |
|---|---|
| Usage-based and metered pricing | Not offered at MVP, though UC-152 emits the events that would support it and NFR-10 already requires the entitlement layer to carry multiple pricing units. |
| Reseller and partner commission handling | Belongs with the Model 3 and Model 5 monetization scenarios. |
| Multi-currency price-list automation | Prices are authored per currency by hand (D-14, UC-91), because automatic conversion produces commercially meaningless numbers. |
| Direct debit and standing-order mandates | The bank transfer plus reconciliation path (UC-121, UC-137 … UC-140) covers the same need without a mandate scheme. |
| Virtual cash register and eBon digital receipt integration | The platform sells B2B to registered companies rather than to consumers; this becomes relevant only if individual entrepreneurs are ever billed as natural persons. |
| Full double-entry accounting | The platform maintains a billing ledger and exports to the company's accounting system (UC-162) rather than replacing it. |
| In-product payment collection *on behalf of* customers, which the Licensee model might eventually imply | Not contemplated at all; it would raise payment-institution licensing questions well beyond this scope. |

### 7.3 Notification scope held down deliberately

There is no per-notification ownership or assignment model and no escalation chain. An outstanding-report notice (UC-169) addresses everyone with edit access, repeats at a configured interval, and stops when the condition clears. The Organization Administrator's view of what is outstanding remains the report status overview (UC-67). Both refinements can be added later if usage warrants; neither earns its complexity for an SME with two people on the report.

---

## 8. Traceability

### 8.1 Use case → actor

| Actor code | Actor | Use cases | Count |
|---|---|---|---|
| CA | Common Access | UC-01 … UC-16, UC-165 … UC-168 | 20 |
| RC | Reporting Contributor | UC-17 … UC-48 | 32 |
| OA | Organization Administrator | UC-49 … UC-67, UC-96 … UC-108, UC-110 … UC-122, UC-132, UC-153, UC-157, UC-175 | 49 |
| PA | Platform Administrator | UC-68 … UC-88, UC-176 | 22 |
| BO | Billing Operator | UC-89 … UC-95, UC-130, UC-133 … UC-135, UC-137, UC-139, UC-140, UC-144 … UC-146, UC-154 … UC-156, UC-158 … UC-164 | 27 |
| SYS | System (scheduled/event-driven) | UC-109, UC-123 … UC-129, UC-131, UC-136, UC-138, UC-141 … UC-143, UC-147 … UC-152, UC-169 … UC-174 | 26 |
| VI | Visitor | UC-177 … UC-182 | 6 |
| | | **Total** | **182** |

Note that OA is the primary actor of UC-108 while UC-109 in the same module is SYS-initiated, and that the Invoicing module mixes SYS (issuance, transmission, delivery, exchange rate), BO (correction, numbering, archiving) and OA (viewing) initiators. The module is not an actor boundary.

### 8.2 Use case → functional requirement

The per-use-case FR links are held in the register in section 3 and repeated in each specification in section 5. They are the inverse of the authoritative `Source UC` column of "ESG Platform Functional Requirements (MVP)" and are not derived independently here.

Coverage observations from that inversion:

- Every use case UC-01 … UC-176 maps to at least one MVP functional requirement. **UC-177 … UC-182 do not, and four of them map to none at all** — UC-177, UC-178, UC-179 and UC-182, recorded as `functional_requirements.md` G-9 when the Visitor actor was registered on 24 Aug 2026. UC-180 and UC-181 map to FR-61. So the register does now hold orphan use cases, deliberately and with the reason written down, rather than by oversight; the sentence is left standing for UC-01 … UC-176 because that part of it is still true and is what a reader checking the original register needs.
- Seven functional requirements have no source use case because they are cross-cutting obligations no single use case owns: **FR-153** (documented API surface), **FR-154** (compliance core free of plan/price/tenant dependency, testable by disabling billing and re-running UC-17 … UC-48), **FR-155** (VSME-mirroring internal schema), **FR-156** (third-party components behind internal interfaces), **FR-157** (one channel-agnostic notification mechanism), **FR-158** (server-side RBAC on every request), **FR-159** (attribution of every state-changing action). **FR-172** (asynchronous notification dispatch) is likewise architectural.
- One-to-many and many-to-one relationships are normal and are not forced into alignment: FR-24 serves UC-18 and UC-19 … UC-29; UC-116 is served by FR-114, FR-115 and FR-116.

### 8.3 Legacy use case mapping

Maps the sixteen one-line use cases in "ESG Platform Actors, Use Cases, FR and NFR (MVP)" onto this register. The legacy IDs are shown as `UC-1` … `UC-16` exactly as written in that document and must not be read as `UC-01` … `UC-16` of this register.

| Legacy ID | Legacy title | Now covered by |
|---|---|---|
| UC-1 | Register & create org | UC-01, UC-03, UC-49 |
| UC-2 | Set up a reporting entity/period | UC-52, UC-54, UC-56, UC-19 |
| UC-3 | Complete the guided Basic Module form (B1–B11) | UC-19 … UC-31 |
| UC-4 | Run the carbon footprint calculator | UC-32, UC-33, UC-34 |
| UC-5 | Save and resume a draft | UC-35, UC-36 |
| UC-6 | Review validation status | UC-37, UC-38, UC-39, UC-40 |
| UC-7 | Export report as PDF | UC-41, UC-42, UC-44 |
| UC-8 | Export as EFRAG Excel Digital Template | UC-43, UC-44 |
| UC-9 | Switch UI/export language | UC-14, UC-48 |
| UC-10 | View prior-period data | UC-45, UC-46 |
| UC-11 | Manage org profile | UC-50, UC-51, UC-53 |
| UC-12 | Manage org users | UC-15, UC-59 … UC-64 |
| UC-13 | View plan/entitlement status | UC-65, UC-66 |
| UC-14 | Manage translated content | UC-71, UC-72, UC-73, UC-74 |
| UC-15 | Track and roll out taxonomy/template updates | UC-75 … UC-79 |
| UC-16 | Monitor MVP success metrics | UC-83, UC-84 |
| *(newly identified — platform)* | — | UC-02, UC-04 … UC-13, UC-16, UC-17, UC-18, UC-47, UC-55, UC-57, UC-58, UC-67, UC-68, UC-69, UC-70, UC-80, UC-81, UC-82, UC-85 … UC-88 |
| *(newly identified — billing domain)* | — | UC-89 … UC-164 |
| *(newly identified — notifications)* | — | UC-165 … UC-176 |

Legacy forward-looking entries UC-17 … UC-24 of that document are not carried into this register; they are recorded as deferred scope in section 7.

---

## 9. Open questions

| ID | Question | Origin | Status |
|---|---|---|---|
| OQ-1 | **Closed 18 Aug 2026 — `actors.md` supersedes the dedicated "System Actors (MVP)" doc and carries all six codes** (CA, RC, OA, PA, BO, SYS) as canonical. | Use Case Register, actor codes table | Resolved. The register's "recommended addition" is actioned by replacement rather than amendment — see `actors.md` OQ-1. Also closed in `functional_requirements.md` OQ-2. |
| OQ-2 | Which of the Advisor (Model 3), Corporate Buyer (Model 4) and Licensee (Model 6) models is activated first after MVP? Also logged in `functional_requirements.md` OQ-6, `actors.md` OQ-5, `problem_overview.md` OQ-11 and `architecture.md` OQ-24. | Earlier combined document, §5 | Open by design — explicitly demand-driven and gated by the MVP success metrics (UC-83, UC-84). This document intentionally does not sequence Phase 2/3 further than "the architecture must not block any of them". |
| OQ-3 | The Assurance / Referral Partner actor (Model 5 partner side) is named but has no use cases. Also logged in `functional_requirements.md` OQ-8 and `actors.md` OQ-4. | Earlier combined document, §5 | Open — needs its own pass once a referral-partner list exists. |
| OQ-4 | Blockchain traceability and the ESAP submission bridge have no concrete problem statement. Also logged in `functional_requirements.md` OQ-7. | Earlier combined document, §5 | Open — not committed; they need a problem statement before any use case is written. |
| OQ-5 | **Closed 18 Aug 2026.** UC-172 … UC-174 and FR-160 … FR-173 now have non-functional counterparts: **NFR-106 … NFR-109**, ratified into `non_functional_requirements.md` §4.16 — dispatch p95 ≤ 60 s; exponential retry bounded at 24 h with suppression on first hard bounce; ≥ 99% accepted transactional-mail delivery, SPF/DKIM/DMARC-aligned; delivery records retained for organization life + 1 year. | Note closing the functional register | Resolved. Also closed in `functional_requirements.md` OQ-3, `non_functional_requirements.md` OQ-13, `architecture.md` OQ-2 and `design_spec.md` OQ-11. |
| OQ-6 | **Closed 18 Aug 2026 — no change, deliberately.** UC-48 stays under Traceability and UC-108/UC-109 stay in one module. | This consolidation | Closed as *won't fix*, not as *done*. Modules carry no system, permission or build meaning — they are a reading aid — so regrouping would be a change to the source rather than a consolidation of it, and would break every citation that locates a use case by module for no functional gain. Recorded here so a future reader does not re-raise it as an oversight. |
| OQ-7 | The MIA per-transaction ceiling (~5,000 MDL) and the commission-free monthly threshold (10,000 MDL) are National Bank parameters that move. UC-120 reads the limit from configuration, but the source does not name who owns the value or on what cadence it is reviewed. | D-8, 6.2 | Open — an operational ownership question, not a design gap. |
| OQ-8 | Free plan seat cap and Standard plan quota values are described qualitatively ("a capped number of users", "higher user and export quotas") but no numbers are fixed anywhere in the source set. Also logged in `problem_overview.md` OQ-8. | D-12, UC-60, UC-90 | Open — a commercial decision to be recorded against UC-90 when taken. |

---

*Consolidated from "ESG Platform Use Case Register (MVP)" and "ESG Platform Use Case Design Decisions and Constraints (MVP)", which are the authoritative sources for use cases and decisions respectively; actor names follow `actors.md`; FR links invert the `Source UC` column of `functional_requirements.md`. Supersedes the use-case sections of "ESG Platform Actors, Use Cases, FR and NFR (MVP)"; its forward-looking actors and external systems are carried into `actors.md`, and its legacy non-functional requirements into `non_functional_requirements.md`.*

