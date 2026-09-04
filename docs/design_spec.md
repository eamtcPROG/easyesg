# ESG Platform — Interface and Interaction Design Specification (MVP)

| Field | Value |
|---|---|
| Document ID | design_spec.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | *ESG Platform Interface and Interaction Design Specification (MVP)* (primary source); *ESG Platform Use Case Register (MVP)* (UC identifiers); *ESG Platform Functional Requirements (MVP)* (FR identifiers); *ESG Platform System Actors (MVP)* (actor codes) |

---

## 1. Purpose and scope

### 1.1 What this document is

This is the canonical design specification for every human-facing surface of the ESG Platform: the tenant application, the administrative console, the generated documents, and notifications. It states what the interface must do and why, in terms that survive a change of framework, component library or visual identity.

### 1.2 What this document is not

It is not a visual style guide, a page-by-page mockup set, or a component library implementation. It defines the rules a mockup must satisfy and the contract a component library must fulfil. Pixel values, brand colour values and font families are deliberately absent from the source material and therefore absent here; they are supplied by the visual identity layer (§11.2) and swapped without touching this document — including, where required, by substituting the Moldovan state design system wholesale (§11.7).

### 1.3 Normative conventions

- Design rules carry the stable identifiers `UX-n` and use *shall*. They are citable from designs, backlog items and review checklists, and are not renumbered once assigned. All `UX-n` identifiers in this document are reproduced verbatim from the source specification.
- Screen identifiers are `S-nn` for tenant screens and `A-nn` for administrative screens, reproduced verbatim.
- Use cases are `UC-01 … UC-176`. Functional requirements are `FR-1 … FR-173`. Non-functional requirements are `NFR-1` … `NFR-93` (MVP) and `NFR-94` … `NFR-105` (deferred). Design decisions are `D-n`. Architecture decisions are `AD-1 … AD-14`.
- Actor codes are the letter codes `CA`, `RC`, `OA`, `PA`, `BO`, `SYS`. There is no `ACT-*` scheme.
- Descriptive prose carries no obligation.

### 1.4 Scope boundary

MVP scope is the VSME Basic Module B1–B11 **and the Comprehensive Module C1–C9** (promoted 25 Aug 2026, `problem_overview.md` OQ-12 — Comprehensive is a report-level scope flag per D-A, additive over Basic and sold as its own plan scope), self-serve billing, and three live locales — RO (source), EN, RU (§9.1, OQ-1, resolved 18 Aug 2026).

Deliberately not designed for MVP: per-user density switching; user-configurable dashboards; in-product chat support; report collaboration with simultaneous multi-user editing and presence; commenting and review workflow on disclosures; notification assignment and escalation chains; right-to-left support for a fourth locale; native mobile applications; Comprehensive Module screens beyond the Basic Module; XBRL viewer surfaces (Phase 2); advisor and buyer portal surfaces (Phase 2 relationship types).

Each deferred item is an addition to the screen inventory (§4.4) and the component inventory (§11.5) when its requirement is admitted, not a redesign of this specification.

### 1.5 Companion documents and precedence

This document is one of seven baseline files. Each register is owned by exactly one file:

| File | Owns |
|---|---|
| `problem_overview.md` | Problem statement, scope, closed scope decisions |
| `actors.md` | Actors `CA`, `RC`, `OA`, `PA`, `BO`, `SYS` |
| `use_cases.md` | `UC-01` … `UC-176`, design decisions `D-1` … `D-14` |
| `functional_requirements.md` | `FR-1` … `FR-173` |
| `non_functional_requirements.md` | `NFR-1` … `NFR-93` (MVP) and `NFR-94` … `NFR-105` (deferred) |
| `architecture.md` | `AD-1` … `AD-14`, `DR-1` … `DR-11` — this file consolidates, and replaces, the two source titles *Architecture Overview (MVP)* and *System Architecture (MVP)* |
| `design_spec.md` (this file) | `UX-1` … `UX-135`, `S-01` … `S-28`, `A-01` … `A-18` |

Where this document and any of those disagree, they win on their subject and this document is amended.

---

## 2. Design principles and rationale

### 2.1 The single design mandate

> **NFR-76** — a user with no sustainability training completes a first Basic Module report unaided, at ≥ 80 % task success within the target completion time.

Everything in this document is subordinate to that sentence. The platform's competitive position is not that it stores ESG data — a spreadsheet does that — but that it converts a standard written for accountants into a sequence of questions a company owner can answer. The interface is the product. A correct backend behind an interface that an SME owner abandons at module B3 has produced nothing.

### 2.2 Two structural facts

- **The work is intermittent.** A VSME report is assembled over weeks, in short sessions, by people whose day job is something else. Nothing may depend on a session being completed in one sitting, on one device, by one person.
- **The work is seasonal and deadline-bound.** Volume concentrates in April–May, peaking in the final two weeks of May (Art. 33(3), Law 287/2017). Under deadline pressure users do not read; they scan, guess and retry. Every screen shall be designed for the hurried, not the attentive, reader.

### 2.3 Principles

Each principle is stated with the consequence that makes it testable. A principle with no consequence is decoration.

| # | Principle | Consequence |
|---|---|---|
| P1 | **Ask, never quiz.** The user answers questions about their own business; they are never asked to interpret the standard. | Every field carries plain-language help authored at the reading level of a non-specialist (NFR-78). Regulatory citations are available on demand, never in the primary label. |
| P2 | **Never present what will be rejected.** Applicability is resolved before display, not validated after entry. | Conditional fields are shown or hidden live from B1 answers (UC-26, UC-28). The system never renders a field and then refuses its value on grounds the system already knew. |
| P3 | **A gap is an answer.** Absence is always an explicit, reasoned state. | Eight terminal states, never a silent blank (§6.4). "Not material", "not available" and "nil return" are first-class and carried into exports. |
| P4 | **Progress is never lost.** | Autosave without a save action, offline queueing, lossless resume across device and session (UC-35, UC-36), draft flush before logout (UC-06). |
| P5 | **State the consequence before the action.** | Every destructive, irreversible or entitlement-reducing action discloses precisely what changes, before it is committed (NFR-80). |
| P6 | **One finding, one destination.** | Every error, warning and notification resolves to the exact field, record or screen that fixes it (UC-39, UC-166). A message that says something is wrong without saying where is a defect. |
| P7 | **Compliance is legible.** | Version pinning, factor-set version, override attribution, change history and export provenance are visible to the user, not buried in an audit table (UC-34, UC-44, UC-47). |
| P8 | **Money is explained.** | Every charge shows net, VAT with rate and basis, gross, currency and — where a payment rail is unavailable — the reason it is unavailable (UC-112). |
| P9 | **Accessibility is structural, not remedial.** | WCAG 2.2 AA is a design input to the component contract (§10), not an audit performed on finished screens. It extends to the exported PDF (PDF/UA-1). |

### 2.4 Anti-goals

The interface shall not attempt: dashboard-first design (the primary object is a report in progress, not a metrics wall); gamification of compliance progress; AI-authored narrative content presented as the user's own disclosure; dense enterprise data grids as the primary tenant surface; or a mobile-first data-entry model (see §11.4).

---

## 3. Users, contexts of use and device assumptions

### 3.1 Actors as design inputs

Actor definitions are normative in *System Actors (MVP)*. This table adds only what design needs.

| Actor | Typical person | Frequency | Primary device | Domain expertise | Design consequence |
|---|---|---|---|---|---|
| **RC** Reporting Contributor | Owner, office manager, accountant, external bookkeeper | Weeks of intermittent sessions, once a year | Desktop / laptop ≥ 1024 px; tablet for review | None to low | The wizard is the whole product for this actor. Optimise for resumption and for answering without prior knowledge. |
| **OA** Organization Administrator | Owner or finance lead; often the same human as RC | Setup, then oversight; billing events | Desktop | Low on ESG, moderate on business admin | Administration is a *separate mode*, not a permission-filtered variant of the report. |
| **CA** Common Access | Any authenticated user | Every session | Any | — | Account, credential, membership and notification surfaces are identical for all actors. |
| **BO** Billing Operator | Internal finance | Daily, in queues | Desktop, dual-monitor | High | Exception-queue design, keyboard-first, information-dense. Opposite end of the density scale from RC. |
| **PA** Platform Administrator | Internal operations, content, translation | Campaign-shaped (a publish, a migration) | Desktop | High | Staged, reversible, previewable operations with explicit blast-radius disclosure. |
| **SYS** System | — | — | — | — | Has no interface, but *every* SYS use case terminates in something a human sees: a notification, a state change, an exception in a queue. Each shall have a named destination surface (§6.12). |

### 3.2 Surfaces

| Surface | Audience | Auth realm | Device target | Design system relationship |
|---|---|---|---|---|
| **Tenant application** | CA, RC, OA | Tenant session | Entry ≥ 1024 px · full operation at tablet · full readability at phone | Canonical consumer of the design system |
| **Administrative console** | PA, BO | Separate realm, separate host, mandatory MFA | Desktop only (`wide` and `extra`, UX-77) | Same tokens and primitives, different density and composition (§12). **Romanian-only interface**, no locale segment in its URLs — amended 19 Aug 2026, `non_functional_requirements.md` NFR-23 and `architecture.md` OQ-42. Strings are still message keys, so this narrows how many catalogues the chrome ships in, not whether wording is configuration |
| **Generated document** (PDF, Excel) | External readers — banks, buyers, auditors | None | Print and screen reading | Separate print layer sharing tokens; typography and layout diverge deliberately (§11.8) |
| **Notification** (in-app, email) | All | Tenant session / none | Any, including phone | In-app uses the design system; email uses a constrained, client-tolerant subset (§6.12) |
| **External checkout** (acquirer, MIA) | OA | Provider-controlled | Provider-controlled | **Not designable.** The platform designs the hand-off and the return, never the payment page itself (§6.11) |

**UX-1** Every surface shall be reachable and operable without reference to any other surface. A user shall never be told to "ask an administrator" without being told who that administrator is.

### 3.3 Device and connectivity assumptions

Four named breakpoints, defined by capability rather than device. Values live in tokens; the source specifies no pixel values other than the `wide` entry threshold of 1024 px.

| Name | Capability | Tenant behaviour |
|---|---|---|
| `compact` | Phone | Full readability and review; wizard navigation collapses; sustained entry discouraged but not blocked |
| `medium` | Tablet | **Fully operable**, including data entry (NFR-77) |
| `wide` | Laptop ≥ 1024 px | **Optimised for sustained entry** (NFR-8): module list, field content and validation panel simultaneously visible |
| `extra` | Large desktop | Additional context, not additional density — comparatives and history gain space |

**Connectivity.** Assume intermittent, moderate-quality connections and mid-range hardware on 4G for the web-vitals budget (§8.5).

### 3.4 Language context

Interface language, export language and email language are selected independently (UC-14, UC-48; source cites FR-169). Romanian and Russian VSME labels are both platform-authored and carry no official EFRAG standing — **corrected 31 Aug 2026**, when `problem_overview.md` OQ-5 closed and the `2026-05-01` package turned out to ship an empty Romanian label linkbase; **English alone is official at this version**. The interface says so at the point of export selection, not in a help centre. Three locales are live at MVP — Romanian as source, English and Russian each separately authored — resolved 18 Aug 2026; see §9.1 and OQ-1.

**UX-135** Every locale that distinguishes them shall address the reader in the **formal register**, on every surface, without exception — Romanian *dumneavoastră*, Russian *вы*. English has no T-V distinction and is unaffected. **Set 27 Aug 2026, project owner**, closing a question the set had never asked.

It is one rule and not a per-surface judgement, because the surfaces do not partition the way an intuition about "onboarding versus product" suggests. Measured on 27 Aug 2026, Romanian was split almost evenly — informal across the credential funnel (`register`, `verify`, `signIn`, `factor`, `resetRequest`, `setPassword`) and formal across `social`, `invitation`, `credentials` and `organizationUnavailable` — and the two met **inside a single viewport**: S-01 rendered *"Intră în contul tău"* directly beside *"Continuați cu Google"*, because the provider buttons belong to a different namespace from the form they sit under. A rule drawn at the screen boundary would not have caught that, since it is not a screen boundary.

Three things decided it, and the first is the one that makes it cheap:

- **Russian had already chosen.** All eleven namespaces were formal, authored that way independently. Choosing formal changes one file; choosing informal would have meant rewriting Romanian *and* overriding a consistent choice already made in Russian.
- **The register is a property of the product, not of the moment.** This is a statutory-filing tool whose reader is an SME owner, an accountant or a bookkeeper producing a document with legal force. The identity funnel is six namespaces of what will be roughly fifty; the in-product surfaces were already formal, and every screen still to be written — reports, the calculator, exports, invoices, dunning — is closer to them than to a sign-up form.
- **A split register is not a style preference, it is an inconsistency the reader can see.** Task 26.3 already has a reader crossing between S-03 and S-01 twice inside a minute, and the pronoun changed each way.

Accepted cost: formal Romanian is wordier, so the UX-73 +40 % expansion budget is measured against a longer source. That is a layout constraint to meet, not a reason to address the reader inconsistently.

---

## 4. Information architecture and navigation model

### 4.1 The object model as the user experiences it

```
User account  (personal: profile, credentials, language, notification preferences)
  └── Membership → Organization          ← exactly one is "active" per session
        ├── Reporting entity             ← one or many; most SMEs hold one
        │     └── Reporting period       ← pins template + taxonomy version, links prior period
        │           └── Report
        │                 └── Module B1 … B11
        │                       └── Disclosure field  ← the atomic unit of the product
        ├── Users & access
        ├── Plan, usage, billing account, invoices
        └── Notifications (scoped to the active organization)
```

**UX-2** The active organization shall be visible at all times on every authenticated screen, and shall never be inferred from a URL segment or a request header — it is a property of the session (UC-16).

**UX-3** Switching the active organization shall return the user to the equivalent screen in the new organization where one exists, and to that organization's home otherwise. It shall never silently discard unsaved work; unsynced changes are flushed first.

**UX-4** Every addressable state — a report module, a validation finding, an invoice, an admin queue filter — shall have a stable, shareable, bookmarkable address that restores the same state on load. Deep links are how notifications discharge P6.

### 4.2 Navigation tiers

Three tiers, and no fourth.

| Tier | Contains | Persistence |
|---|---|---|
| **Global** | Active organization switcher, notification centre, user menu (profile, language, sign out), help | Present on every authenticated screen |
| **Workspace** | Reports · Entities & periods · Organization · Users & access · Plan & billing | Present outside the wizard; collapsed or hidden inside it |
| **Contextual** | Module list within a report; tab set within a record; step sequence within a flow | Scoped to the current object |

**UX-5** The wizard shall suppress the workspace tier and replace it with the module list, so that the user's only navigational choice inside a report is *which module*. Exit from the wizard shall be a single, always-visible, explicitly labelled control that states that work is saved.

### 4.3 Primary navigation flow

```mermaid
graph LR
    A["Sign in"] --> B{"Memberships"}
    B -->|none| C["Create organization<br/>UC-49"]
    B -->|one| D["Home"]
    B -->|many| E["Choose organization<br/>UC-16"] --> D
    D --> F["Reports<br/>UC-17"]
    D --> G["Entities & periods<br/>UC-52…58"]
    D --> H["Organization<br/>UC-50, 51"]
    D --> I["Users & access<br/>UC-59…64"]
    D --> J["Plan & billing<br/>UC-65, 96…132"]
    D --> K["Notifications<br/>UC-165"]
    F --> W["Report wizard<br/>UC-18…46"]
    W --> V["Validation panel"]
    W --> P["Preview"] --> X["Export<br/>UC-41…44"]
```

**UX-6** The authenticated home screen shall answer three questions above the fold, in this order: *what needs my attention*, *where did I leave off*, *what is the state of everything*. For a single-entity organization this reduces to one resumable report and its completion state; the same template shall scale to a multi-entity organization without a different screen (UC-67).

### 4.4 Screen inventory (sitemap)

Screens are design containers; a screen may serve several use cases and a use case may span several screens. Identifiers are verbatim from the source. The archetype column refers to §4.6.

| # | Screen | Actor | Serves | Archetype |
|---|---|---|---|---|
| S-01 | Sign in / register / provider choice | CA | UC-01 … 05, UC-194, UC-195 | Focus |
| S-02 | Verify email · reset password · set password | CA | UC-03, 08, 09 | Focus |
| S-03 | Accept invitation | CA | UC-15 | Focus |
| S-04 | Create organization | OA | UC-49 | Focus |
| S-05 | Home / organization overview | all | UC-16, 67 | Workspace |
| S-06 | Reports index | RC, OA | UC-17 | Index |
| S-07 | **Report wizard — module step** | RC | UC-18 … 31, 37, 45, 46, 183 … 192 | Wizard |
| S-08 | Validation panel (in-wizard, persistent) | RC | UC-37 … 40 | Panel |
| S-09 | Carbon calculator | RC | UC-32 … 34 | Wizard sub-flow |
| S-10 | Report preview | RC | UC-41 | Document |
| S-11 | Export dialogue and history | RC | UC-42 … 44, 48 | Panel + Index |
| S-12 | Field change history | RC, OA | UC-47 | Panel |
| S-13 | Entities index and entity record | OA | UC-52 … 55 | Index + Record |
| S-14 | Reporting periods | OA | UC-56 … 58 | Index + Record |
| S-15 | Organization profile and identifiers | OA | UC-50, 51 | Record |
| S-16 | Users & access | OA | UC-59 … 64, 175 | Index |
| S-17 | Plan, entitlements and usage | OA | UC-65, 66 | Status |
| S-18 | Plan comparison and selection | OA | UC-96 … 98 | Comparison |
| S-19 | Order, summary and confirmation | OA | UC-110 … 115 | Wizard |
| S-20 | Payment hand-off and return | OA | UC-116 … 121 | Focus + Status |
| S-21 | Payment instruments | OA | UC-118, 119 | Index |
| S-22 | Invoices and documents | OA | UC-132, 157 | Index |
| S-23 | Billing account | OA | UC-108 | Record |
| S-24 | Subscription status and history | OA | UC-99 … 107 | Status + Index |
| S-25 | Enterprise request | OA | UC-153 | Focus |
| S-26 | Notification centre | CA | UC-165 … 167 | Index |
| S-27 | Profile, language, notification preferences | CA, all | UC-13, 14, 168 | Record |
| S-28 | Credentials and linked identities | CA | UC-10 … 12, UC-193 | Record |
| S-29 | Marketing home | VI | UC-177 | *escalated — OQ-17* |
| S-30 | Legal documents (terms · privacy · cookies) | VI, all | UC-178 | *escalated — OQ-17* |
| S-31 | Cookie choice | VI | UC-179 | Focus |
| S-32 | Help centre | VI, CA | UC-180 | Index |
| S-33 | Help article | VI, CA | UC-181 | *escalated — OQ-17* |
| S-34 | Write to support | VI, CA | UC-182 | Focus |
| S-35 | Organization unavailable | CA | UC-16 (failure path) | Focus |
| A-01 | Admin sign-in (MFA) | PA, BO | UC-68 | Focus |
| A-02 | Organization register | PA | UC-69 | Index |
| A-03 | Content and translation console | PA | UC-71 … 74 | Editor + Publish |
| A-04 | Taxonomy versions, mappings, migration runs | PA | UC-75 … 79 | Editor + Batch |
| A-05 | Factor sets, thresholds, validation rules | PA | UC-80 … 82 | Editor |
| A-06 | Adoption metrics | PA | UC-83, 84 | Dashboard |
| A-07 | Support access request and audit log | PA | UC-85, 86 | Focus + Index |
| A-08 | Admin accounts and system audit log | PA | UC-87, 88 | Index |
| A-09 | Plan catalogue, entitlements, pricing, discounts | BO | UC-89 … 95 | Editor |
| A-10 | Reconciliation workspace | BO | UC-137 … 140 | Exception queue |
| A-11 | Collections and dunning | BO | UC-141 … 144 | Exception queue |
| A-12 | Invoicing, credit notes, numbering series | BO | UC-126 … 136 | Index + Record |
| A-13 | e-Factura transmission exceptions | BO | UC-130 | Exception queue |
| A-14 | Refunds and chargebacks | BO | UC-145 … 147 | Exception queue |
| A-15 | Enterprise quotes and contracts | BO | UC-153 … 159 | Record |
| A-16 | Revenue, VAT export, billing audit ledger | BO | UC-160 … 164 | Dashboard + Index |
| A-17 | Notification categories and templates | PA | UC-176 | Editor + Publish |
| A-18 | Identity provider configuration | PA | UC-70 | Editor |

**Count:** 52 screens — 34 tenant (`S-01 … S-34`) and 18 administrative (`A-01 … A-18`). `S-29 … S-34` were added 24 Aug 2026 closing OQ-12, with the Visitor actor (`actors.md` §4) and UC-177 … UC-182 that UX-7 requires them to trace to. **UX-7 gains no exemption class** — the horn OQ-12 offered — because these screens now trace to use cases like every other, which is what the rule asks for rather than a way around it.

### 4.5 Use cases served without a dedicated screen

Three use cases are served by global-tier elements and inline patterns rather than dedicated screens:

| Use case | Destination |
|---|---|
| UC-06 — log out | User menu, with draft flush per UX-37 |
| UC-07 — re-authenticate after session expiry | Inline over preserved context, UX-38 |
| UC-16 — switch active organization | Global switcher, UX-2, UX-3 |

`SYS` use cases have no screen of their own and terminate in a destination named under UX-61.

**UX-7** No screen shall exist that is not traceable to at least one use case, and no use case with a human actor shall be without a screen, a named global-tier pattern or a **named exemption below**. **Amended 18 Aug 2026 (OQ-5) — two exemption classes, each exhaustively enumerated.** *Pattern-discharged:* **UC-35** (autosave in-progress report data) and **UC-36** (resume an in-progress report draft), both discharged by the draft-integrity pattern inside S-07 (UX-34 … UX-39) — they are continuous behaviours of a screen, not destinations, and inventing inventory entries for them would make the inventory describe things that are not screens. *Inactive at MVP:* **UC-122** (pay through the merchant-of-record checkout), registered as an adapter and inactive per D-8 and FR-114; it gains a screen when the rail is activated, not before. Any addition to either list is an amendment to this rule, not a note. The inventory in §4.4 remains the coverage contract.

> **Resolved 18 Aug 2026 (OQ-6) — UC-16 is split by behaviour, not assigned twice.** UC-16 is *View memberships **and** switch active organization*, which is two behaviours in one use case. **S-05 owns "view memberships"** — the list of organizations the user belongs to is screen content. **The global-tier switcher owns "switch active organization"** — changing session scope is a persistent global action available from every screen, not a behaviour of any one of them. A coverage audit counts UC-16 once, against both owners, with no double count.

### 4.6 Page archetypes

Ten templates. Every screen is an instance of one; a screen that fits none is an escalation to design review, not a licence to invent — a clause used once, on 24 Aug 2026, and answered by the tenth row below rather than by an exception.

| Archetype | Purpose | Fixed elements | Notes |
|---|---|---|---|
| **Focus** | One task, no navigation | Single column, centred, one primary action | Auth, invitation, organization creation, payment return |
| **Index** | Find one among many | Filter, sort, empty state, row action, pagination or progressive load | Never the primary tenant surface; always has an empty state that teaches |
| **Record** | View and edit one object's attributes | Identity header, grouped fields, save/cancel affordance, change attribution | Explicit save, unlike the wizard |
| **Wizard** | Ordered progression with completion state | Step list, step content, progress, autosave indicator, exit | The report, the calculator, the order |
| **Panel** | Auxiliary context beside a primary task | Dismissible, non-modal, retains position | Validation, history, export |
| **Document** | Faithful preview of a rendered artefact | Page-shaped, paginated, print-accurate | Report preview |
| **Status** | Current state of a long-lived thing | State name, what it means, what changes it, next date | Subscription, plan, entitlements |
| **Exception queue** | Work a human must resolve | Dense table, saved filters, bulk action, per-item resolution with mandatory rationale | Admin only; keyboard-first |
| **Dashboard** | Aggregate view | Figures with confidence marking, period filter, export | Admin only; never the tenant home |
| **Content** | Be read | Reading measure rather than the workspace grid — 64–70ch for prose, up to 100ch for wider blocks; heading hierarchy as the navigation; a peer strip where the page is one of a set; no primary action required; no chrome of its own beyond the public shell | The only archetype with no authenticated instance, and the only one §14.2 permits the framework to cache |

**UX-8** Each archetype shall define every state in §8.1 before any instance of it is designed.

**Resolved 24 Aug 2026 (OQ-17) — a tenth archetype, not a composition.** The nine were derived from an authenticated application and had no template for a page whose job is to be read, which only became visible when `S-29`, `S-30` and `S-33` entered the inventory. **OQ-7's own test decided it**: OQ-7 rejected promoting compositions to archetypes because that "would put two names on one state set", and the inverse applies here — composing *Content* from *Document* would put one name on two different sets, since Document's states are those of a generating artefact preview (loading, pending — async, partial) and a reading surface's are ready, error — recoverable and error — not found. The eight states **Content** excludes are excluded because nothing on it is a task; that exclusion list is the argument for the row. **Derived from the delivered prototypes**, per OQ-10 — the reading measures above are the dominant values in `EasyESG Public Legal.dc.html` (70ch across thirty blocks) and `EasyESG Public Home.dc.html` (64ch), and the peer strip is the legal set's tab strip. Values are to be extracted through `packages/ui`, never copied as markup.

**Resolved 18 Aug 2026 (OQ-7).** Two labels in the inventory are not among the nine: *Wizard sub-flow* (S-09) and *Comparison* (S-18). They are **compositions, not archetypes** — S-09 composes **Wizard**, S-18 composes **Index/Status** — and the rule is now stated rather than implied: **a composition inherits the complete state set of its base archetype and defines no states of its own.** That satisfies UX-8, which requires every archetype to define every state before an instance is designed: a composition has a full state definition, inherited. Adding two more archetypes was rejected — it would put two names on one state set, which is what OQ-4's validation-state finding shows going wrong elsewhere.

---

## 5. Screen specifications

### 5.0 How to read these specifications

Each screen below is specified against a fixed template: identifier and name (verbatim), purpose, primary actors, entry points, layout and regions, content and data shown, controls and actions, states, validation behaviour, exits, and related use cases and functional requirements.

Three limits on what follows must be stated plainly, because the alternative is invention:

1. **Layout and regions** are given as the fixed elements the screen inherits from its archetype (§4.6) plus any region the source names explicitly (for example the wizard's module list, the disclosure field anatomy, the save-state indicator). The source specifies no per-screen wireframes, no column allocations and no pixel geometry. Where nothing further is stated, this document says so rather than filling the gap.
2. **States** are drawn from the eleven-state model in §8.1. Only the states the source makes applicable are listed. `UX-90` requires every applicable state to be designed before implementation; the enumeration here is the checklist, not a design.
3. **Entry points and exits** are derived from the navigation flow (§4.3), the use case preconditions, and the notification deep-link obligation (UX-4, UX-63). Where a route is not evidenced in the sources it is not asserted.

### 5.1 Tenant screens

### S-01 — Sign in / register / provider choice

- **Purpose:** admit a user to the platform, or create the account that will hold their memberships.
- **Primary actors:** CA.
- **Archetype:** Focus.
- **Entry points:** unauthenticated arrival at the tenant application; an expired invitation or reset link that requires a fresh sign-in; **a live invitation handed off from S-03** (added 25 Aug 2026, task 26.3) — which carries `?return=` back to S-03 and, on the registration route, the invitation itself, so the account created there is already verified and the invitee returns able to accept. The screen states which organization is inviting them, because a credential form arrived at from an email link is otherwise unexplained.
- **Layout and regions:** single column, centred, one primary action (Focus fixed elements). Email/password entry and the enabled social provider choices are presented on the same surface — **one card, with the provider choices below the rule inside it, and the route to password reset on the password field's own label row** (added 4 Sep 2026 from the artboard, which draws all three at 1440, 834 and 390; this row previously read *"no further per-screen layout is specified in the source"*, which left placement to whoever built the screen and produced a reset link floating below the card).
- **Content and data shown:** email address and password inputs; **the choice to be kept signed in on this device**; the set of currently enabled identity providers (Google and Microsoft at MVP, per FR-2, enabled or disabled through A-18 / FR-82); route to registration; route to password reset.
- **Controls and actions:** sign in with password; sign in with a provider; register; request a password reset; **choose whether the session persists on this device — the choice governs the credential form, the provider choices being plain anchors that carry no client state**; **supply a second-factor code, or a recovery code instead, where the account has one enrolled**.
- **States:** loading — initial; **second factor required** — a staged step reached only after a correct password on an *enrolled* account, offering the code field and the route to a recovery code (UC-194, UC-195; added 26 Aug 2026); error — recoverable (failed credential, rate-limited, locked out after threshold, per FR-4); error — recoverable (a wrong or spent second-factor code, which leaves the user on the staged step to retype it and counts toward the same FR-4 threshold); error — recoverable (verification pending — the account is unverified and the presented password was **correct**; the answer names verification as the blocker and routes to S-02's resend. Added 21 Aug 2026, `architecture.md` OQ-57 — a wrong password on an unverified account stays inside the uniform failed-credential state); error — permission (an identity presented that is linked to no account is offered registration rather than silently signed in, UC-05).
- **Validation behaviour:** credential failures are rate-limited and locked out after a threshold. **UX-108** applies with force here: no cognitive function test shall be required to sign in, and password managers and paste shall work everywhere.
- **Exits:** per §4.3 — no memberships → S-04; exactly one membership → S-05; more than one → organization choice then S-05. Registration by password exits to the verification challenge (S-02).
- **Use cases:** UC-01, UC-02, UC-03 (provider-asserted case), UC-04, UC-05, **UC-194, UC-195**.
- **FRs:** FR-1, FR-2, FR-4, FR-82. **Requirements:** NFR-95.

**The second-factor step was added 26 Aug 2026** (task 27.2's open-question batch), with UC-194 and
UC-195. It is the same two-step shape A-01 already stages for the admin realm and it is deliberately
**not** the same screen: NFR-65 keeps the two realms disjoint, so the tenant step is built here over
task 21's sign-in rather than reached from the console's. Two properties the artboard must hold.
**An account with no factor is never challenged** — NFR-95 is opt-in, and a step everyone sees is
enforcement. And the step must not say more than a correct password already says: reaching it
discloses that this account has a factor, which is why nothing before the password may hint at one
(NFR-64).

**It is a staged step with its own address** (`/sign-in/factor`, built 27 Aug 2026). That is not a
contradiction: S-02 is already one `S-nn` over three routes, and UX-4 requires an addressable state
to be addressable. What makes the step *staged* is its precondition — it renders only while the
sign-in challenge is held, and opened directly it returns the reader to the password. Two
affordances share it, per the controls list above: the authenticator code, and the recovery code
offered on the same surface rather than behind a support request, because UX-108's point is that a
person without their authenticator must not need a second device to get in. The step carries its
own **expired** state, since the challenge is time-bounded and the reader may be reading it from a
phone screen: the form is replaced by what happened, what it means and the way back to S-01
(NFR-79), not by a refusal that invites a retype the server would reject.

### S-02 — Verify email · reset password · set password

- **Purpose:** prove control of an email address, and set or replace a password from a link.
- **Primary actors:** CA.
- **Archetype:** Focus.
- **Entry points:** a time-limited verification link; a single-use, time-limited reset link; the reset-request route from S-01.
- **Layout and regions:** single column, centred, one primary action. No further per-screen layout is specified in the source.
- **Content and data shown:** the address being verified or reset; the password policy; for a reset request, a response identical whether or not the address is registered (UC-08).
- **Controls and actions:** request a reset; set a new password; confirm verification; **request a new confirmation link** (added 20 Aug 2026, `architecture.md` OQ-55 — the link expires in 24 h while the unverified account lives 7 days, so this is the state's only exit). Like the reset request, its response is identical whether or not the address is registered.
- **States:** loading — initial; success (account active, next step offered); error — recoverable (link expired, link already consumed, password fails policy).
- **Validation behaviour:** password policy enforced on entry with the three-part message formula (§8.2). **The policy is stated as of 20 Aug 2026** — ≥ 8 and ≤ 128 characters requiring a lowercase letter, an uppercase letter, a digit and one further character (`architecture.md` §12.5.6, OQ-51); it is displayed before entry rather than only on failure, and **UX-108** binds here as it does on S-01, so paste and password-manager autofill must work on every field. Account enumeration is prevented by an invariant response. Consuming a reset link invalidates all existing sessions for the account (FR-6), which the screen must state as a consequence before it happens (P5).
- **Exits:** on verification, the founding-organization flow (S-04) or a pending invitation (S-03) becomes available; on reset completion, S-01.
- **Use cases:** UC-03, UC-08, UC-09.
- **FRs:** FR-3, FR-6.

### S-03 — Accept invitation

- **Purpose:** convert an invitation into a membership with an assigned role.
- **Primary actors:** CA.
- **Archetype:** Focus.
- **Entry points:** the single-use invitation link sent from S-16.
- **Layout and regions:** single column, centred, one primary action. No further per-screen layout is specified in the source.
- **Content and data shown:** the inviting organization; the role being granted (edit or view-only); the invited email address, to which the invitation is bound.
- **Controls and actions:** create an account by password; create an account by provider; sign in to link an existing account; accept. **Amended 25 Aug 2026 (task 26.3's unknowns batch, project owner):** the first three are **routes, not forms**. S-03 hands off to S-01 carrying `?return=` back to itself, rather than hosting a second copy of the registration and sign-in forms — which keeps this screen a true Focus (one task, one primary action, and `accept` is it) and keeps S-01 the single place a credential is entered. The registration route additionally carries the invitation, so the account it creates is already verified (FR-3, `architecture.md` §12.5.6's task-26.2 row); without that the invitee would wait for a second email in the one flow that amendment exists to spare them.
- **States:** loading — initial; error — recoverable (invitation expired, already used, revoked — and **not found**, added 25 Aug 2026: a mistyped or truncated link is its own sentence rather than a variant of "expired", and `architecture.md` §12.5.6's task-26.2 row carries the four as a closed vocabulary the API publishes); error — permission (a provider identity asserting an address other than the invited one is refused, UC-15 — **and equally an existing session signed in as any other address**, which is the same refusal reached without a provider). **The permission state carries its own resolving action (25 Aug 2026):** it names the address the invitation is bound to alongside the one currently signed in, and offers to sign out and return here as the invited person — the second way out being to ask the administrator for an invitation to the address actually in use.
- **Validation behaviour:** the invitation binds to the invited email address; a social sign-in is accepted only where the provider asserts that same address.
- **Exits:** S-05 in the newly joined organization.
- **Use cases:** UC-15.
- **FRs:** FR-11.

### S-04 — Create organization

- **Purpose:** create the organization record and make its creator its administrator.
- **Primary actors:** OA (the creating user is granted the role by the act, D-1).
- **Archetype:** Focus.
- **Entry points:** a verified account with no memberships (§4.3); an existing user creating an additional organization.
- **Layout and regions:** single column, centred, one primary action. No further per-screen layout is specified in the source.
- **Content and data shown:** legal name, country, contact details.
- **Controls and actions:** create.
- **States:** loading — initial; error — recoverable; success (administrator role granted, home offered).
- **Validation behaviour:** required-field validation on the identity fields; the deeper fiscal and identifier validation belongs to S-15 and S-23.
- **Exits:** S-05.
- **Use cases:** UC-49.
- **FRs:** FR-13, FR-14.

### S-05 — Home / organization overview

- **Purpose:** answer, above the fold and in this order, *what needs my attention*, *where did I leave off*, *what is the state of everything* (UX-6).
- **Primary actors:** all authenticated actors in the tenant realm (CA, RC, OA).
- **Archetype:** Workspace composition (global tier + workspace tier + content).
- **Entry points:** sign-in; organization switch; notification deep link; wizard exit; the workspace navigation.
- **Layout and regions:** global tier persistent (organization switcher, notification centre, user menu, help); workspace tier present; content answers the three UX-6 questions in order. The same template shall scale from a single-entity organization to a multi-entity organization without a different screen.
- **Content and data shown:** the resumable report and its completion state; every entity and period in the organization with completion and validation status (UC-67, FR-23); attention items.
- **Controls and actions:** resume a report; open an entity or period; switch active organization; open the notification centre.
- **States:** empty — first use (no entity or period yet: teaches the object and offers the one action that creates it); loading — initial (skeleton matching final layout); loading — refresh (prior content stays visible); partial (some data resolved, some failed, with per-part retry); error — recoverable; read-only.
- **Two amendments taken with task 30.5** (29 Aug 2026, project owner), both because the prototype describes a screen with data behind it and this one has none yet. **UX-6's three regions ship as one**, named for what it will hold: all three are report-derived, reports arrive with task 31, and three "nothing yet" boxes above the fold teach a reader that two thirds of their home is broken where one honest region says the product is unfinished here. Task 32.4 splits it into UX-6's order once there is data to order. **The heading names the active organization, not the reader.** *"Good afternoon, Ana"* needs a display name registration does not collect (OQ-16, open) and a time-of-day the server cannot know for the reader; the organization's name is what UX-2 already requires to be visible and is the more useful thing on a screen whose whole job is orientation. The greeting returns if OQ-16 closes with a name.
- **The arrival sentence** (recorded 26 Aug 2026, review; built with task 30.5): `POST /invitations/acceptance` answers a `grant` of `created` / `reactivated` / `already_member`, and S-03's exit lands here — so this screen says which happened. Without it somebody who already had access sees exactly the landing a new member sees, and learns nothing from having clicked.
- **Validation behaviour:** none of its own; it presents roll-ups computed by the validation service (§6.4).
- **Exits:** S-06, S-07, S-13, S-14, S-15, S-16, S-17, S-26.
- **Use cases:** UC-16, UC-67.
- **FRs:** FR-12, FR-23.

### S-06 — Reports index

- **Purpose:** find the entity/period combination to work on.
- **Primary actors:** RC, OA.
- **Archetype:** Index.
- **Entry points:** workspace navigation; S-05. **The workspace navigation tier is built with this screen** (26 Aug 2026, task 26.4's batch): S-16 is the first `(app)/(workspace)` instance, and §4.2's second tier is a named entry in §11.5's inventory, so it lands in `packages/ui` with its state set rather than as chrome inlined in a layout (UX-89). **Task 30.1 built the global tier above it (29 Aug 2026)** and, rather than extending this tier's link set, took one entry out of it: S-28 sat here only because no account corner existed to hold it, and §4.2 puts credentials under the user menu. The set grows again with tasks 30.3, 30.4 and 30.5, whose screens are the ones §4.2 actually names here.
- **Layout and regions:** Index fixed elements — filter, sort, empty state, row action, pagination or progressive load. **All five ship (26 Aug 2026, task 26.4's batch), pagination included**, even though `/members` and `/invitations` are unpaginated by design — the API bounds the collection by the plan's seat allowance, so the paging is over the loaded list. Decided by the project owner against building a partial instance of the archetype: S-16 is the product's **first Index**, and what it does is what the next four Index screens will be read as licence to do.
- **Content and data shown:** accessible entities and periods with completion and validation summary, reflecting per-report permissions so a view-only member sees the same entries without edit affordances (UC-17, FR-25).
- **Controls and actions:** filter; sort; open a report.
- **States:** empty — first use (teaching empty state, per Index note in §4.6); empty — filtered (distinguishes "nothing matches" from "nothing exists" and offers to clear the filter); loading — initial; loading — refresh; error — recoverable; read-only (view-only membership).
- **Validation behaviour:** none of its own.
- **Exits:** S-07.
- **Use cases:** UC-17.
- **FRs:** FR-25.

### S-07 — Report wizard — module step

- **Purpose:** the whole product for the RC actor: capture the eleven Basic Module sections B1–B11 — and, when the report's scope flag is Comprehensive, the nine C1–C9 sections additively over them (FR-177, OQ-12) — as a sequence of answerable questions.
- **Primary actors:** RC.
- **Archetype:** Wizard.
- **Entry points:** S-06; S-05 resume; a validation finding deep link (UX-22); a notification deep link (UX-63); return from S-09, S-10, S-11.
- **Layout and regions:**
  - Workspace tier suppressed and replaced by the **module list** (UX-5), persistent and always visible, carrying a per-module state indicator.
  - **Step header** showing, without scrolling, the module name in plain language alongside its standard reference (`B8 — Workforce characteristics`), completion and validation state, and how many fields remain outstanding (UX-11).
  - **Step content** composed of disclosure fields (§7.1), constrained to the reading measure of UX-74.
  - **Save-state indicator** in one fixed location (UX-35).
  - **Exit control**, single, always visible, explicitly labelled, stating that work is saved (UX-5).
  - **Validation panel** (S-08) beside the step content, simultaneously visible at `wide` (§3.3).
- **Content and data shown:** disclosure field labels, help text, values, units, state markers; prior-period value adjacent to the current input where a prior period exists (UX-31); provenance for values derived elsewhere, such as B3 from the calculator (UX-12); B1 values pre-populated from the entity master record but editable in place (FR-27, UX-109).
- **Controls and actions:** enter a value; choose a unit from a constrained list; mark a field not available with a reason; declare a section not material with a rationale; carry a prior value forward per field or per module; run validation; open the calculator; open field history; preview; export; exit.
- **States:** empty — first use (a period newly opened, no answers yet); loading — initial (skeleton matching final layout, no shift on resolve); loading — refresh; partial; error — recoverable; error — permission; **read-only** (a locked period UC-57, a view-only membership, or a suspended entitlement UC-142 — same layout as edit mode with affordances removed and a persistent banner naming which of the three causes applies and what restores editing, UX-13); offline / queued; pending — async (export or calculation in flight); success.
- **Validation behaviour:** inline at the point of entry and rolled up per module and per report (UX-20); conditional fields appear and disappear live from B1 answers with an announcement naming the cause (UX-26, UX-27); a value entered into a field that subsequently disappears is retained and the user is told so (UX-28); year-over-year movement beyond a configured threshold raises `inconsistency`, not `error`, and states both values and the change (UX-33); B1 shall be completed before any conditional module is presented (UX-9).
- **Exits:** exit control → S-05 or S-06; S-08; S-09; S-10; S-11; S-12.
- **Use cases:** UC-18, UC-19, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-26, UC-27, UC-28, UC-29, UC-30, UC-31, UC-37, UC-45, UC-46; and, through the draft-integrity pattern, UC-35 and UC-36 (see OQ-5).
- **FRs:** FR-24, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-37, FR-38, FR-39, FR-40, FR-46, FR-47.

### S-08 — Validation panel (in-wizard, persistent)

- **Purpose:** make an eleven-module report navigable by finding, and present validation as a working tool rather than a gate.
- **Primary actors:** RC.
- **Archetype:** Panel.
- **Entry points:** S-07 (persistent, simultaneously visible at `wide`); a deep link to a specific finding (UX-4).
- **Layout and regions:** dismissible, non-modal, retains position (Panel fixed elements). Positioned beside the step content.
- **Content and data shown:** findings grouped and rolled up per module and per report; the rule explanation for each finding; the roll-up discounting modules declared not material (UX-21).
- **Controls and actions:** run or re-run validation — the primary control is *check my report*, not *submit* (UX-24); select a finding.
- **States:** empty — first use; empty — filtered; loading — initial; pending — async (validation in flight, with inline progress on the roll-up while the wizard stays interactive, §8.5); error — recoverable; read-only.
- **Validation behaviour:** this screen *is* the validation surface. Validation is runnable at any completeness and is idempotent (UX-24). Every finding shall be a link that moves focus to the originating field, scrolls it into view, and displays the rule explanation (UX-22); silent scroll without focus movement is an accessibility failure (§10.4).
- **Exits:** focus moves into the originating field in S-07; export warning path into S-11.
- **Use cases:** UC-37, UC-38, UC-39, UC-40.
- **FRs:** FR-40, FR-41, FR-42, FR-43.

### S-09 — Carbon calculator

- **Purpose:** turn utility invoices into Scope 1 and location-based Scope 2 figures without asking the user to convert anything.
- **Primary actors:** RC.
- **Archetype:** Wizard sub-flow (an instance of Wizard, §4.6).
- **Entry points:** S-07 from the B3 module step; a provenance route from a B3 derived field (UX-12).
- **Layout and regions:** Wizard fixed elements — step list, step content, progress, autosave indicator, exit — scoped as a sub-flow of the report wizard. Inputs organised by energy source and by site.
- **Content and data shown:** consumption by source (electricity, natural gas, diesel, heating fuel and so on) and by site, in the units of the user's own invoices; raw inputs, which remain visible and editable after calculation as the permanent assurance record (UX-41); results with the derivation available in one step — input → conversion → factor applied → result — naming the factor set version (UX-42); an override's superseded computed value alongside the substituted one, with attribution (UX-43); a non-blocking notice where the factor set has been updated since the result was computed, naming the pinned version and offering recalculation (UX-44).
- **Controls and actions:** enter consumption; choose unit; calculate; annotate; override with a reason; recalculate against a newer factor set.
- **States:** empty — first use; loading — initial; pending — async (calculation, though at p95 ≤ 1 s synchronous presentation is acceptable, §8.5); error — recoverable; read-only; success.
- **Validation behaviour:** units are fixed or chosen from a constrained list, never free text (UX-14). An override requires a reason and shall never present an unexplained substituted figure (UX-43). Results write into the B3 fields, where the standard validation rules then apply.
- **Exits:** back to the B3 step in S-07.
- **Use cases:** UC-32, UC-33, UC-34.
- **FRs:** FR-33, FR-34, FR-35, FR-36; consumes FR-71.

### S-10 — Report preview

- **Purpose:** let the user see the artefact a bank, buyer or auditor will read, before anything leaves the platform.
- **Primary actors:** RC.
- **Archetype:** Document.
- **Entry points:** S-07; S-11.
- **Layout and regions:** page-shaped, paginated, print-accurate (Document fixed elements). The rendering follows the document layout system of §11.8, not the interface layout.
- **Content and data shown:** the fully assembled report — narrative, indicator tables, comparatives — in the same content, same order and with the same marked gaps as the export (UX-45); override attribution markers (UX-43); version pin indicators.
- **Controls and actions:** paginate; proceed to export.
- **States:** loading — initial; pending — async (assembly); error — recoverable; read-only by nature.
- **Validation behaviour:** none of its own; unresolved findings and reasoned gaps appear visibly marked rather than omitted (UX-25, UX-119).
- **Exits:** S-11; back to S-07.
- **Use cases:** UC-41.
- **FRs:** FR-48.

### S-11 — Export dialogue and history

- **Purpose:** produce the distributable artefact, and keep every previously distributed artefact retrievable exactly as distributed.
- **Primary actors:** RC.
- **Archetype:** Panel + Index.
- **Entry points:** S-07; S-10; a notification announcing a completed export job (UX-46).
- **Layout and regions:** Panel for the dialogue (dismissible, non-modal, retains position); Index for the history (filter, sort, empty state, row action).
- **Content and data shown:**
  - Dialogue: exactly two decisions and no more — **format** (PDF · EFRAG Excel) and **language**, independent of interface language (UX-47). Where a language whose labels are platform-authored is selected — Romanian and Russian at `2026-05-01`, per T-14 as amended — a statement that those labels carry no official EFRAG standing, with **English** recommended for a bank or EU buyer. Where the report is pinned to a superseded taxonomy version, the choice between migration and export-against-original with an explicit notice (UX-48). Where findings are unresolved, an explicit warning listing what is unresolved (UX-25).
  - History: format, language, taxonomy version, timestamp and generating user for every prior export (UX-49).
- **Controls and actions:** choose format; choose language; export; migrate first; export against the original version; re-download any prior artefact.
- **States:** empty — first use (no exports yet); empty — filtered; loading — initial; **pending — async** (the defining state: export is presented as a job from the first interaction, with immediate acknowledgement, a named place to watch, and freedom to leave the screen; beyond 30 s the result is delivered by notification, UX-46, §8.5); error — recoverable; read-only (new exports blocked under suspension, UC-142, while previously generated documents remain downloadable, UX-54).
- **Validation behaviour:** export is permitted with unresolved findings after the explicit warning; it is never silently blocked, and it never proceeds silently against a version the report was not prepared under.
- **Exits:** the produced file; the notification centre (S-26) for a long-running job; back to S-07 or S-10.
- **Use cases:** UC-42, UC-43, UC-44, UC-48.
- **FRs:** FR-44, FR-49, FR-50, FR-51, FR-52, FR-53.

### S-12 — Field change history

- **Purpose:** make attribution legible at the point of the value, not only in an audit screen (P7).
- **Primary actors:** RC, OA.
- **Archetype:** Panel.
- **Entry points:** the field itself in S-07 (UX-68); S-05 or S-13 for record-level history.
- **Layout and regions:** dismissible, non-modal, retains position. Presented as a timeline / history list (§11.5).
- **Content and data shown:** per field — who changed the value, when, and what the previous value was. Attribution is retained for users removed from the organization (UX-69, FR-55).
- **Controls and actions:** open from a field; close; navigate entries.
- **States:** empty — first use (no changes yet); loading — initial; loading — refresh; error — recoverable; read-only by nature.
- **Validation behaviour:** none.
- **Exits:** back to the originating field.
- **Use cases:** UC-47.
- **FRs:** FR-54, FR-55.

### S-13 — Entities index and entity record

- **Purpose:** maintain the legal entities that are reported on, and the boundary each reports against.
- **Primary actors:** OA.
- **Archetype:** Index + Record.
- **Entry points:** workspace navigation; S-05.
- **Layout and regions:** Index (filter, sort, empty state, row action, pagination) for the list; Record (identity header, grouped fields, explicit save/cancel, change attribution) for the entity.
- **Content and data shown:** legal form; NACE code(s); site locations; consolidation basis and, where consolidated, the subsidiaries inside the reporting boundary (UC-54, FR-19); archived state.
- **Controls and actions:** create; edit; define consolidation scope; archive.
- **States:** empty — first use (teaching empty state offering entity creation); empty — filtered; loading — initial; loading — refresh; error — recoverable; error — permission; read-only (entitlement-reduced entities, UC-151); success.
- **Validation behaviour:** explicit save with field-level validation on the Record archetype, unlike the wizard. Entity master data is retained point-in-time so a closed period's report continues to reflect the values in force (FR-18) — a consequence the interface states before an edit that would otherwise read as retroactive. Archiving is a consequence-disclosing action (§6.14): historical reports and exports remain intact and the interface says so.
- **Exits:** S-14 for the entity's periods; S-05.
- **Use cases:** UC-52, UC-53, UC-54, UC-55.
- **FRs:** FR-17, FR-18, FR-19, FR-20.

### S-14 — Reporting periods

- **Purpose:** open, lock and reopen the period that a report is prepared against.
- **Primary actors:** OA.
- **Archetype:** Index + Record.
- **Entry points:** S-13; workspace navigation; S-05.
- **Layout and regions:** Index for the period list; Record for the period.
- **Content and data shown:** fiscal year, start and end dates; the optional due date, distinct from the period end, which deadline notifications count down to (UC-56); the pinned template and taxonomy version (version pin indicator, §11.5); the linked preceding period from which comparatives resolve; lock state; and, where reopened, the persistent fact that the period was reopened together with the stated reason (UX-72).
- **Controls and actions:** open a period; lock; reopen with a stated reason.
- **States:** empty — first use; empty — filtered; loading — initial; error — recoverable; error — permission; read-only (locked); success.
- **Validation behaviour:** date and range validation on open. Locking and reopening are both irreversible-class actions under UX-71: they shall be visually and verbally distinguished from ordinary actions and shall state the compensating mechanism. Reopening requires a stated reason and is displayed thereafter — an amendment must look like an amendment (UX-72).
- **Exits:** S-07 for the report in the period; S-13.
- **Use cases:** UC-56, UC-57, UC-58.
- **FRs:** FR-21, FR-22, FR-45, FR-66.

### S-15 — Organization profile and identifiers

- **Purpose:** maintain the legal identity that propagates into every report the organization produces.
- **Primary actors:** OA.
- **Archetype:** Record.
- **Entry points:** workspace navigation; S-05.
- **Layout and regions:** identity header, grouped fields, save/cancel affordance, change attribution.
- **Content and data shown:** legal form, registered name, registered address, contact details; entity identifiers — **the IDNO as primary, and an LEI as an optional additional identifier** (UC-51); and **the contact name and address printed on the report cover** (FR-15, amended 29 Aug 2026 with task 30.3 — the prototype drew the region and no requirement named it; it is a second contact, not a rename of the platform one). *(Corrected 28 Aug 2026: this line carried the pre-amendment scheme — LEI primary with DUNS, EU ID or PermID as fallback — which `architecture.md` OQ-18 reversed on 18 Aug 2026. DUNS, EU ID and PermID are not modelled at MVP and this screen must not offer them.)*
- **The LEI field is labelled, never abbreviated bare** (28 Aug 2026, raised by the project owner). To a Moldovan reader **LEI reads as the currency** — the leu, plural *lei* — so a field labelled `LEI` on a screen that also carries fiscal data invites an SME owner to type an amount into an identifier. The hazard is specific to this product's market and does not exist in the standard's own English documentation, which is why it survived four documents unnoticed. The label carries the expansion in each locale, with the abbreviation in parentheses rather than alone — *Identificator de entitate juridică (LEI)* / *Legal Entity Identifier (LEI)* / *Идентификатор юридического лица (LEI)* — and the help text says what it is and that most Moldovan SMEs do not hold one, so an empty field reads as expected rather than as an omission. This is a labelling rule, not a new component: the field is the inventory's text field (UX-89).
- **Change attribution names the person, not only the moment** (29 Aug 2026, project owner, task 30.3). The artboard draws *"Last changed by Ana R. · 3 August 2026 · history"*, and `GET /organization` answered a timestamp and no actor — the same gap OQ-19 records for S-28's *"from Chișinău"*. It is closed here rather than deferred: the actor is read from `core.field_change`, the audit trail the capture trigger already writes (task 14), so the screen states what the database recorded rather than a second attribution the application maintains beside it. **The *history* link is not built here** — it is S-12's destination, and S-12 had no task until one was appended on the same day.
- **Controls and actions:** edit; save; cancel.
- **States:** loading — initial; loading — refresh; error — recoverable; error — permission; read-only; success.
- **Validation behaviour:** identifier format and checksum are validated on entry (FR-16), because an identifier that fails validation downstream in EFRAG's own tooling is expensive to discover at filing time. Messages follow the three-part formula (§8.2). Every change is attributed and timestamped, and the propagation consequence is stated.
- **Three regions the prototype draws here belong elsewhere, and the screen must not offer them** (29 Aug 2026, task 30.3, applying OQ-20's precedent). **VAT registration, the e-Factura recipient and the callout about issued invoices** are FR-106's billing account and belong to S-23, which is also where the Exits row already sends the reader. **A default language for reports** is not an organization setting at all: FR-52 makes export language a choice taken *per export*, at S-11, explicitly independent of the interface language — an organization-level default would be a second answer to a question that already has one. The artboard also **omits** legal form and the LEI, both of which the Content row above requires.
- **Exits:** S-05; S-23 for the billing counterpart.
- **Use cases:** UC-50, UC-51.
- **FRs:** FR-15, FR-16.

### S-16 — Users & access

- **Purpose:** answer the question "who can see our ESG data", and control the answer.
- **Primary actors:** OA.
- **Archetype:** Index.
- **Entry points:** workspace navigation; S-05.
- **Layout and regions:** Index fixed elements — filter, sort, empty state, row action, pagination or progressive load.
- **Content and data shown:** every user with access, their role, status (active or pending invitation) and last activity (UC-59); pending invitations; seat consumption against the plan's entitlement (§6.10). **The list is one union across two collections** — `/members` and `/invitations` — assembled in the read model, which is what task 25.1's schema records in advance: a pending invitation is not a member, and the single list is what the screen makes of them. **Seat consumption is deferred (26 Aug 2026, task 26.4's batch):** UX-50 requires the limit, the allowance, current consumption and the upgrade path *in that order*, and only consumption is knowable before `EntitlementPort` has an implementation — so the region and the gate state below ship with task 54.2 rather than as one value in four. A partial region would invite the reader to infer a ceiling nothing is checking.
- **Controls and actions:** invite by email with an edit or view-only role; resend an invitation; revoke an invitation; change a role; remove a member; promote a member to Organization Administrator; send a manual reminder to a user about an outstanding report (UC-175).
- **States:** empty — first use; empty — filtered; loading — initial; loading — refresh; error — recoverable; error — permission; success. Entitlement gate state where an invitation would exceed the seat allowance (§6.10, UX-50).
- **Validation behaviour:** email format on invite. Revocation invalidates the outstanding link immediately. Removing a member is a consequence-disclosing action naming the specific user (UX-70), and the interface shall state at the point of removal that their historical contributions remain attributed in the change history (UX-69). An invitation beyond the seat entitlement follows the quota path and states the limit, the allowance, current consumption and the upgrade path in that order (UX-50).
- **Exits:** S-17 or S-18 from the entitlement gate; S-05.
- **Use cases:** UC-59, UC-60, UC-61, UC-62, UC-63, UC-64, UC-175.
- **FRs:** FR-56, FR-57, FR-58, FR-59, FR-60; FR-173 for the reminder path.
- **Where the prototype exceeds this row (26 Aug 2026, project owner, from task 26.4's build).**
  `EasyESG Organization Admin.dc.html` draws five things this row does not list, and **this row
  governs** — OQ-10's standing rule, of which this is the worked example. Access is drawn **per
  entity** (an *Entities* column, an "Entities · at least one" invite field, over "Access is granted
  per entity"); nothing normative says so — FR-56 … FR-60 are organization-scoped throughout and
  `architecture.md` §6.5 states that a member holds exactly one role per organization, with
  per-report rights computed rather than granted. The prototype also lists **removed** members with
  a *Restore* action (no use case names a restore verb; the nearest built thing is task 26.2's
  `reactivated` grant, reached by re-inviting), shows **display names and initials** where the member
  record carries an address and no name, states that **"two administrators is the minimum the plan
  enforces"** where FR-60 sets the minimum at one, and presents the invite as a **modal** where the
  built screen uses a panel below the list. Per-entity access in particular is a data-model
  decision — it would need an entity dimension on the membership record and a second tenancy binding
  in every RLS policy — and becomes a live question only if an `FR` is written for it.

### S-17 — Plan, entitlements and usage

- **Purpose:** state plainly what the organization is entitled to and how much of it is consumed.
- **Primary actors:** OA.
- **Archetype:** Status.
- **Entry points:** workspace navigation; S-05; an entitlement gate from any gated action (§6.10); a quota-approach notification.
- **Layout and regions:** Status fixed elements — state name, what it means, what changes it, next date.
- **Content and data shown:** current plan (Free, Standard, Enterprise); the specific entitlements and quotas it grants; the current billing cycle and next renewal date; usage counters derived from the metering stream — reporting entities, active users, reports created, exports by format, API calls — each shown against the entitlement limit rather than as a bare number (UC-66, FR-105).
- **Controls and actions:** view; route to plan comparison; route to subscription status.
- **States:** loading — initial; loading — refresh; partial (a counter unavailable while others resolve); error — recoverable; read-only by nature. Approaching-limit warning shown against the counter in context, before the limit is reached (UX-52).
- **Validation behaviour:** none of its own.
- **Exits:** S-18; S-24; S-25.
- **Use cases:** UC-65, UC-66.
- **FRs:** FR-90, FR-105.

### S-18 — Plan comparison and selection

- **Purpose:** make the plan decision without contacting sales.
- **Primary actors:** OA.
- **Archetype:** Comparison (composed of Index and Status elements, §4.6).
- **Entry points:** S-17; an entitlement gate (UX-50); a trial-expiry notification.
- **Layout and regions:** published plans side by side with entitlements, quotas and price per cycle. Comparison table component (§11.5).
- **Content and data shown:** entitlements, quotas and price for each cycle per published plan; which limits the organization's *actual* consumption would exceed on each (UC-96); trial availability and terms where the plan version offers one.
- **Controls and actions:** select a plan and cycle; start a trial; request Enterprise terms.
- **States:** loading — initial; error — recoverable; read-only; success.
- **Validation behaviour:** none of its own; the order it creates carries the validation (S-19).
- **Exits:** S-19 for a self-serve plan; S-25 for Enterprise (Enterprise never passes through self-serve checkout, D-12, FR-142).
- **Use cases:** UC-96, UC-97, UC-98.
- **FRs:** FR-91, FR-92, FR-93.

### S-19 — Order, summary and confirmation

- **Purpose:** carry commercial intent to a confirmed, evidenced agreement without surprising the buyer on price or rail.
- **Primary actors:** OA.
- **Archetype:** Wizard.
- **Entry points:** S-18; S-24 for a cycle or unit change; S-25 acceptance path.
- **Layout and regions:** Wizard fixed elements — step list, step content, progress, autosave indicator, exit. Money summary component (§11.5) as the confirmation region.
- **Content and data shown:** plan version, cycle, quantity; discount code and its effect; **net amount, VAT rate and basis, gross total, currency** before confirmation (UX-55); the payment rails available for that total, with any excluded rail shown as unavailable **with its reason** — for example MIA excluded because the total exceeds the configured ceiling (UX-56); the terms being accepted; order status through its lifecycle, including the reference the payer must quote and what happens if payment does not arrive (UC-114).
- **Controls and actions:** apply a discount code; choose a rail; confirm and accept terms; track status; cancel an unpaid order.
- **States:** loading — initial; pending — async (awaiting payment, awaiting reconciliation); error — recoverable; success; read-only (once paid or provisioned).
- **Validation behaviour:** a discount code is validated at entry against plan eligibility, validity window and remaining redemptions, and an invalid or exhausted code is rejected with the reason rather than silently ignored (UC-111, FR-109). Confirmation records the accepted terms version, timestamp and acting user (FR-111). Cancelling an unpaid order voids any associated proforma and is a consequence-disclosing action (UX-70).
- **Exits:** S-20 for an external rail; S-22 for the proforma on the transfer rail; S-24 on provisioning.
- **Use cases:** UC-110, UC-111, UC-112, UC-113, UC-114, UC-115.
- **FRs:** FR-108, FR-109, FR-110, FR-111, FR-112, FR-113.

### S-20 — Payment hand-off and return

- **Purpose:** leave the platform for a licensed provider and come back with a truthful account of what happened.
- **Primary actors:** OA.
- **Archetype:** Focus + Status.
- **Entry points:** S-19; the provider's return redirect; a resumed indeterminate order.
- **Layout and regions:** Focus for the hand-off (single column, centred, one primary action); Status for the return (state name, what it means, what changes it, next date). The provider's own page is not designable (§3.2).
- **Content and data shown:** on hand-off — a warning that the user is leaving, the provider's name, and what returns them (UX-57); on the transfer rail — the payment reference as the single most prominent element, copyable in one action, alongside the proforma and the consequence of omitting the reference (UX-59); on return — the outcome.
- **Controls and actions:** proceed to the provider; copy the payment reference; download the proforma; retry; return to the order.
- **States:** all four return outcomes shall be designed — **success**, **failure**, **cancellation** and **abandonment mid-challenge** (UX-58); **pending — async** for an indeterminate return, showing *pending* with what happens next and when, rather than an error; error — recoverable; loading — initial.
- **Validation behaviour:** the platform shall never imitate a payment form — no card fields exist anywhere in the product (PCI SAQ-A, UX-57, FR-115). The order shall survive the round trip without duplication (UX-58). Saved-card consent is an explicit, separately recorded act, distinct from paying once, and worded as a recurring authorisation (UX-60).
- **Exits:** S-24 on provisioning; S-19 on failure or cancellation; S-22 for the invoice; S-21 for instrument management.
- **Use cases:** UC-116, UC-117, UC-118, UC-119, UC-120, UC-121.
- **FRs:** FR-114, FR-115, FR-116, FR-117, FR-118, FR-119.

### S-21 — Payment instruments

- **Purpose:** keep automatic renewal working, and make its failure modes visible before they bite.
- **Primary actors:** OA.
- **Archetype:** Index.
- **Entry points:** S-20; S-24; a payment-failure notification.
- **Layout and regions:** Index fixed elements. Instruments shown as masked descriptors only (FR-115).
- **Content and data shown:** stored instruments with masked descriptor; which is the default for renewal; consent state for recurring authorisation.
- **Controls and actions:** add; replace; remove; set default.
- **States:** empty — first use; loading — initial; error — recoverable; success; read-only.
- **Validation behaviour:** removing the last instrument on an auto-renewing subscription is a consequence-disclosing action that warns renewal will fail, rather than letting the organization discover it at suspension (UC-119, FR-117, UX-70).
- **Exits:** S-24; S-20 for adding an instrument through the provider.
- **Use cases:** UC-118, UC-119.
- **FRs:** FR-117.

### S-22 — Invoices and documents

- **Purpose:** give the customer permanent access to the fiscal documents they are obliged to retain.
- **Primary actors:** OA.
- **Archetype:** Index.
- **Entry points:** workspace navigation; S-19; S-20; an invoice-delivery notification; a dunning notification.
- **Layout and regions:** Index fixed elements — filter, sort, empty state, row action, pagination.
- **Content and data shown:** number, date, period, amount, VAT, status, payment date; proformas; credit notes; the customer's own purchase-order or contract reference reproduced on every invoice issued under it (UC-157); the recorded exchange rate on a foreign-currency document.
- **Controls and actions:** filter; download a document; record a purchase-order reference.
- **States:** empty — first use; empty — filtered; loading — initial; loading — refresh; error — recoverable; **read-only that survives entitlement loss** — invoice history and document download remain available after downgrade, cancellation and lapse, because the retention obligation outlives the subscription (UC-132, FR-128, UX-54).
- **Validation behaviour:** format validation on the purchase-order reference only; fiscal document content is not editable from the tenant surface (FR-125).
- **Exits:** S-23; S-24.
- **Use cases:** UC-132, UC-157.
- **FRs:** FR-128, FR-146.

### S-23 — Billing account

- **Purpose:** hold the fiscal identity of the invoiced legal person, which is not always the reporting entity.
- **Primary actors:** OA.
- **Archetype:** Record.
- **Entry points:** workspace navigation; S-19; an e-Factura rejection notification.
- **Layout and regions:** identity header, grouped fields, save/cancel affordance, change attribution.
- **Content and data shown:** registered legal name, IDNO, VAT registration code where registered, legal address, billing contact (UC-108).
- **Controls and actions:** edit; save; cancel.
- **States:** loading — initial; error — recoverable; read-only; success.
- **Validation behaviour:** fiscal identifier format is validated on entry and, where a lookup is available, existence and VAT status are verified (UC-109, FR-107). The consequence is stated: an invoice carrying an invalid fiscal code is rejected by the national e-Factura platform and cannot be corrected by editing (D-10) — so the message must be a three-part message, not a bare format error.
- **Exits:** S-22; S-24.
- **Use cases:** UC-108.
- **FRs:** FR-106, FR-107.

### S-24 — Subscription status and history

- **Purpose:** expose the subscription state machine plainly, because "past due" and "suspended" have different consequences and a customer must be able to tell which they are in.
- **Primary actors:** OA.
- **Archetype:** Status + Index.
- **Entry points:** S-17; S-19; S-20; a dunning, suspension, trial-expiry or renewal notification.
- **Layout and regions:** Status for the current state (state name, what it means, what changes it, next date); Index for the change history.
- **Content and data shown:** current state — trialling, active, past due, suspended, cancelled, lapsed; the plan version in force; entitlements granted; billing cycle; renewal or expiry date; next amount due; the full change history with date, acting user and resulting entitlements (UC-107). Under suspension: the exact amount, the date, and the single action that restores service (UX-54).
- **Controls and actions:** change billing cycle; upgrade; downgrade; add or remove billable units; enable or disable auto-renewal; cancel; reactivate.
- **States:** loading — initial; loading — refresh; error — recoverable; read-only; success; and the entitlement-reduced state in which previously generated documents remain downloadable (UX-54, FR-104).
- **Validation behaviour:** before any entitlement reduction — downgrade, cancellation, lapse — the interface shall list **by name** the entities and reports that will become read-only under the deterministic retention rule, and shall state explicitly that nothing is deleted (UX-53, UC-101, UC-151, FR-103, FR-104, NFR-80). Upgrade is immediate; downgrade takes effect at the end of the paid period; cancellation is not immediate termination. Each is a consequence-disclosing action naming the specific objects affected (UX-70).
- **Exits:** S-18; S-19; S-21; S-22.
- **Use cases:** UC-99, UC-100, UC-101, UC-102, UC-103, UC-104, UC-105, UC-106, UC-107.
- **FRs:** FR-90, FR-94, FR-95, FR-96, FR-97, FR-98; consumes FR-103, FR-104.

### S-25 — Enterprise request

- **Purpose:** be the entry point to the contract path, since Enterprise never passes through self-serve checkout.
- **Primary actors:** OA.
- **Archetype:** Focus.
- **Entry points:** S-18; S-17.
- **Layout and regions:** single column, centred, one primary action.
- **Content and data shown:** entity count, user count, required capabilities; what happens next.
- **Controls and actions:** submit the request.
- **States:** loading — initial; error — recoverable; success (a tracked opportunity created, not an email sent, FR-142); pending — async while the quote is prepared.
- **Validation behaviour:** required-field validation with three-part messages.
- **Exits:** back to S-17 or S-18; the quote arrives by notification and is handled by BO in A-15.
- **Use cases:** UC-153.
- **FRs:** FR-142.

### S-26 — Notification centre

- **Purpose:** be persistent storage for everything the system needs a human to know, not a stream of transient toasts.
- **Primary actors:** CA.
- **Archetype:** Index.
- **Entry points:** the global tier, from any authenticated screen, with the unread count visible there (UX-62).
- **Layout and regions:** Index fixed elements. Notification item component (§11.5) carrying category, subject link and read state.
- **Content and data shown:** notifications addressed to the user in the active organization; unread count; category; the deep link to the object that raised each one (UX-63).
- **Controls and actions:** open a notification; mark read; dismiss; route to preferences.
- **States:** empty — first use (teaching empty state); empty — filtered; loading — initial; loading — refresh; error — recoverable.
- **Validation behaviour:** none. Read state is per user: one recipient reading an organization-wide notice shall not clear it for colleagues (UX-64). A notice raised while the user was signed out is waiting on return (UX-62).
- **Exits:** the subject of the notification — a module in S-07, a period in S-14, an invoice in S-22, and so on; S-27 for preferences.
- **Use cases:** UC-165, UC-166, UC-167.
- **FRs:** FR-160, FR-161, FR-162.

### S-27 — Profile, language, notification preferences

- **Purpose:** hold what is personal to the user rather than to any organization they belong to.
- **Primary actors:** CA (all actors).
- **Archetype:** Record.
- **Entry points:** the global tier user menu; S-26.
- **Layout and regions:** identity header, grouped fields, save/cancel affordance.
- **Content and data shown:** display name; contact email; interface language; notification preferences **per category and per channel**, with transactional categories — security, account, invoice delivery, payment failure — shown as mandatory and non-disableable **with the reason stated** (UX-65, FR-163).
- **Controls and actions:** edit profile; set interface language; set per-category, per-channel preferences.
- **States:** loading — initial; error — recoverable; success; read-only for the mandatory categories.
- **Validation behaviour:** email format; language selection persists to the profile and applies on every subsequent login and device (FR-10). Preferences follow the user across organizations.
- **Exits:** S-26; S-28.
- **Use cases:** UC-13, UC-14, UC-168.
- **FRs:** FR-9, FR-10, FR-163.

### S-28 — Credentials and linked identities

- **Purpose:** let a user keep at least one working way in, and no fewer.
- **Primary actors:** CA.
- **Archetype:** Record.
- **Entry points:** the global tier user menu; S-27.
- **Layout and regions:** identity header, grouped fields, save/cancel affordance.
- **Content and data shown:** password state; linked provider identities; **second-factor state, and how many recovery codes remain unspent**.
- **Controls and actions:** change password; link a provider; unlink a provider; **enrol a second factor; turn it off; re-issue recovery codes**.
- **States:** loading — initial; **pending confirmation** (returned from a provider with a link awaiting the password); error — recoverable; error — permission; success.
- **Validation behaviour:** changing a password requires the current one (FR-7). A link is established only after authentication by an existing credential — a provider assertion alone is never sufficient (UC-11, FR-8). The system refuses to remove the last remaining credential and prompts the user to set a password first, with the consequence stated: an account with no usable credential is unrecoverable and takes its organization memberships down with it (UC-12, UX-70). **Enrolling or turning off a second factor requires the current password**, for the reason the link rule already gives — a second factor is the control that survives a compromised session, so a compromised session must not be able to install or strip one (UC-193). **Enrolment is not complete until a current code is returned**, and the recovery codes are shown exactly once, which the screen must say before it shows them rather than after.
- **Exits:** S-27.
- **Use cases:** UC-10, UC-11, UC-12, **UC-193**.
- **FRs:** FR-7, FR-8. **Requirements:** NFR-95.

**Linking asks for the password *after* the provider round trip, not before** (27 Aug 2026, task
27.7's batch). FR-8 requires an existing credential before a link is established, and the OAuth
redirect sits in the middle of the flow — so the screen returns from the provider with the link
pending and asks then, in one state that says what it is for. The alternative, sealing the password
into the short-lived transaction cookie before leaving, would put a live password into browser
storage for the duration of a provider round trip, which nothing else in this product does with
one. The consequence for this entry's **States** row is a further designed state — *pending
confirmation*, reached only by returning from a provider — and it is a state rather than a modal
because a user who abandons it must be able to leave the screen with nothing half-done.

**The prototype's resting shape is not what was built, and that is OQ-19** (28 Aug 2026). The artboard draws each section as a summary plus one trigger; the screen renders grouped fields, per this entry's own
Layout row. The register row carries the precedence reasoning and the two things it leaves open.

**The three TOTP rows above were added 26 Aug 2026** (task 27.2's open-question batch), and the
addition is the screen catching up with `non_functional_requirements.md` C-3: NFR-95 promoted
opt-in TOTP for tenant users into MVP on 18 Aug 2026, and this entry — the only screen where a
user manages their own credentials — went on listing a password and a provider list. UC-193 …
UC-195 were appended in the same batch. **The challenge and recovery paths belong to S-01, not
here** (UC-194, UC-195): they happen during sign-in, on the artboard that already stages a
credential step, and S-28 is where the factor is *managed* rather than answered.

### S-35 — Organization unavailable

**Added 25 Aug 2026 (task 25.4), and it is an addition to the inventory rather than a note** — UX-7
makes a new screen an amendment. It is numbered 35 because S-29 … S-34 are the public tier
(§5.1b, 24 Aug 2026); the identifier is appended, never inserted.

- **Purpose:** say plainly that the platform could not determine which organizations this account
  belongs to, and offer the way out — rather than land a signed-in person in an empty workspace that
  implies they belong to none.
- **Primary actors:** CA.
- **Archetype:** Focus.
- **Entry points:** the post-sign-in branch (§4.3), by password or by provider, when the membership
  read fails. No navigation reaches it and nothing links to it; arriving is always a consequence.
- **Layout and regions:** single column, centred, one primary action — the Focus fixed elements.
- **Content and data shown:** NFR-79's three parts and nothing else: the membership list could not
  be loaded, so the workspace cannot be opened yet; try again, or sign out. **It states no
  membership count**, because not knowing one is the entire reason the screen exists.
- **Controls and actions:** retry; sign out.
- **States:** error — recoverable (its only state; the screen *is* an error state).
- **Validation behaviour:** none of its own.
- **Exits:** the branch, re-run — so S-04, S-05, or back here. Sign-out exits to S-01.
- **Use cases:** UC-16 (failure path).
- **FRs:** FR-12.

**Why not S-05's own error state, which §4.6 and S-05's `States` line already provide.** That was
the alternative and it was considered: S-05 specifies "partial (some data resolved, some failed,
with per-part retry); error — recoverable", which fits. It was declined by the project owner on the
grounds that the branch has not resolved *where the user belongs*, so sending them to the
organization overview asserts an organization — and until task 30.5 builds S-05 they would see a
blank page rather than an explanation. The cost is recorded: two screens now own a "could not load
your organizations" state, and 30.5 must not duplicate this one's wording.

### 5.1b Public tier screens

`S-29 … S-34` are the unauthenticated surface — `architecture.md` §15.4's ninth step, `design/IMPLEMENTATION_PLAN.md` Phase 10, and the `(public)` route group in `apps/web`. Two properties hold across all six and are stated once here rather than per screen. They are the **only** screens `architecture.md` §14.2 permits the framework to cache, because they are the only tenant-independent ones. And they carry no session: nothing on them may read or imply an active organization, which is what keeps `web-public-is-a-leaf` — the CI rule forbidding `features/public` from importing an authenticated feature — enforceable rather than aspirational.

**Three of the six are the reason §4.6 has ten archetypes rather than nine.** `S-29`, `S-30` and `S-33` are long-form reading surfaces, and the nine — derived from an authenticated application — had no template for one. §4.6 makes that an escalation rather than a licence to invent; it was escalated as **OQ-17** and closed the same day with the **Content** archetype, drawn from the delivered prototypes. `S-31` and `S-34` are Focus, `S-32` is Index.

### S-29 — Marketing home

- **Purpose:** let a prospective customer decide whether the platform produces the report they need, before spending an email address on it.
- **Primary actors:** VI.
- **Archetype:** Content.
- **Entry points:** direct arrival at the platform's public address; a search result; the brand mark from any public screen.
- **Layout and regions:** full-width banded sections over the `--content-max` measure, at UX-73's three frames. The prototype's bands are a deep pine hero, then white, slate and pine-tinted sections; real interface fragments stand in for imagery, and UX-87's icon and illustration placeholders mean nothing here depends on an image existing.
- **Content and data shown:** what the platform produces and for whom; the eleven Basic sections named; how the work is sequenced; what it costs per company per reporting year; what is asked before signing up; where the answers sit and who can see them. **The pricing section presents FR-61 plan presentation copy**, which `task.md` task 76 serves and task 53 populates — until both exist, what it presents is a `task.md` task 74 decision, recorded there rather than assumed here.
- **Controls and actions:** register; sign in; language choice; routes to the help centre and the legal set.
- **States:** ready; error — system (the content read path unavailable, which must degrade to the page without its pricing section rather than to an error page, since the page's job is reachable without it).
- **Validation behaviour:** none of its own.
- **Exits:** S-01 for register or sign in; S-32; S-30.
- **Use cases:** UC-177.
- **FRs:** — (see `functional_requirements.md` G-9).

### S-30 — Legal documents (terms · privacy · cookies)

- **Purpose:** state what is being agreed to and how personal data is handled, before either is agreed to.
- **Primary actors:** VI, and every authenticated actor through the footer.
- **Archetype:** Content.
- **Entry points:** the `SiteFooter` legal links, present on every screen that renders it; S-29; a link from the registration screen.
- **Layout and regions:** one shared layout treating the three documents as a set — a tab strip across them, a plain-language summary above the formal text of each. Reading measure, not the workspace grid.
- **Content and data shown:** terms of service; privacy notice; cookie policy. **Where the text lives is a `task.md` task 75 decision and is open**: FR-61 as narrowed by `architecture.md` OQ-43 names help-centre articles and plan presentation copy and *not* legal documents, so a terms change is either a release or a store entry — and it carries a version and an effective date either way, which is a property this screen must display whichever answer is taken.
- **Controls and actions:** move between the documents; reach the cookie choice (S-31).
- **Open:** **how many documents the set holds is OQ-18.** This entry is written for three because three is what every normative source says; the prototype's tab strip draws five, adding a data processing agreement and a sub-processor list. The peer strip is a fixed element of the Content archetype either way, so the count changes the scope of task 75 and not the shape of this screen.
- **States:** ready; error — system.
- **Validation behaviour:** none of its own.
- **Exits:** S-31; back to the entry point.
- **Use cases:** UC-178.
- **FRs:** — (see `functional_requirements.md` G-9). NFR-5 is the obligation this screen discharges; no FR is written against it, which §7.3 of `non_functional_requirements.md` records as deliberate.

### S-31 — Cookie choice

- **Purpose:** tell the reader what is set before it is set, and let them answer.
- **Primary actors:** VI.
- **Archetype:** Focus.
- **Entry points:** first arrival at any public screen; the cookie policy, for a reader changing a previous answer.
- **Layout and regions:** Focus fixed elements — single column, one primary action — presented without obscuring the content behind it, since a reader who has not answered must still be able to read the privacy notice that explains the question.
- **Content and data shown:** every cookie the site sets, by purpose; what it does not set; storage that is not a cookie; the current answer where one exists.
- **Controls and actions:** accept non-essential storage; decline it; open the cookie policy.
- **States:** ready; ready — answered (the choice is restated rather than re-asked); error — system.
- **Validation behaviour:** the disclosure is a factual claim about shipped code, so it is verified against the build rather than authored as copy. Declining must be no more effort than accepting.
- **Exits:** back to the screen the reader was on; S-30.
- **Use cases:** UC-179.
- **FRs:** — (see `functional_requirements.md` G-9).
- **Open:** whether the answer is **recorded** server-side as a consent record or applied client-side as an implied-consent preference is **OQ-16**, and the two give this screen different postconditions. The screen exists either way, because the disclosure obligation does not depend on the answer being stored.

### S-32 — Help centre

- **Purpose:** get the reader to the one piece of guidance their task needs, whether or not they have an account.
- **Primary actors:** VI, CA.
- **Archetype:** Index.
- **Entry points:** the help affordance, which **UX-109** requires to sit in the same place on every screen; S-29; a deep link.
- **Layout and regions:** Index fixed elements — filter, empty state, row action. The signed-in and signed-out variants are **one screen with a session-dependent shell**, not two screens: the content is identical and only the surrounding chrome differs, which is the same relationship S-01 holds across its three artboards.
- **Content and data shown:** articles grouped by what the reader is doing; the most-read set; the full library. Every article names the module it belongs to.
- **States:** loading; ready; empty — the empty state teaches, per the Index archetype; error — system.
- **Validation behaviour:** none of its own.
- **Exits:** S-33; S-34; back into the product for a signed-in reader.
- **Use cases:** UC-180.
- **FRs:** FR-61.

### S-33 — Help article

- **Purpose:** answer one question in the reader's own terms.
- **Primary actors:** VI, CA.
- **Archetype:** Content.
- **Entry points:** S-32; a deep link; a contextual help affordance from the screen the article is about.
- **Layout and regions:** reading measure, with the module the article belongs to named at the top.
- **Content and data shown:** the article in the active locale, from the FR-61 store's published entries. A locale fallback is reported (FR-64), which reaches FR-61 content because catalogue gaps fail the build instead.
- **Controls and actions:** return to the help centre; contact support; follow the article into the product where it names a screen.
- **States:** loading; ready; error — not found (an unpublished or withdrawn article has no address, since `config.entry_schedule` holds only what is in force); error — system.
- **Validation behaviour:** none of its own.
- **Exits:** S-32; S-34; the screen the article is about.
- **Use cases:** UC-181.
- **FRs:** FR-61, FR-64.

### S-34 — Write to support

- **Purpose:** reach a person when the published guidance does not answer the question.
- **Primary actors:** VI, CA.
- **Archetype:** Focus.
- **Entry points:** S-32; S-33.
- **Layout and regions:** Focus fixed elements — single column, one primary action.
- **Content and data shown:** what to say, and what the reader will get back. For a signed-in reader, what the platform already knows and will not re-request (**UX-109**, Redundant Entry).
- **Controls and actions:** send the request.
- **States:** ready; loading — submitting; error — recoverable; ready — sent, showing the reference the reader can quote.
- **Validation behaviour:** the reference shown on success is a reference the reader is expected to cite, which the user-facing-text rule permits explicitly — it is not internal jargon.
- **Exits:** back to S-32.
- **Use cases:** UC-182.
- **FRs:** — (see `functional_requirements.md` G-9).
- **Open:** **the channel is undecided** — an address the screen publishes, a form posting to the API and dispatching through the outbox, or an external helpdesk (`task.md` task 77). UC-85's precondition that "a support request exists with a ticket reference" has never had a source that creates one; this screen is where that gap becomes a build decision.

### 5.2 Administrative screens

The administrative console shares tokens and primitives with the tenant application and deliberately diverges in density and composition (§12). All administrative screens: target `wide` and `extra` viewports only (UX-77); use compact density; are keyboard-first and bulk-capable; and sit behind a separate auth realm on a separate host with mandatory MFA (§3.2). Those properties are stated once here and are not repeated per screen. Every operation with cross-tenant blast radius follows the single pattern of UX-123 (§12.2).

### A-01 — Admin sign-in (MFA)

- **Purpose:** admit an internal operator to a realm with cross-organization visibility.
- **Primary actors:** PA, BO.
- **Archetype:** Focus.
- **Entry points:** direct arrival at the administrative host.
- **Layout and regions:** single column, centred, one primary action. No further per-screen layout is specified in the source.
- **Content and data shown:** credential entry; the second factor challenge.
- **Controls and actions:** authenticate; complete the second factor.
- **States:** loading — initial; error — recoverable (failed credential, failed factor); error — permission.
- **Validation behaviour:** multi-factor authentication is mandatory (FR-75). Elevated credentials are held apart from ordinary tenant accounts. **UX-108** applies: no cognitive function test, and password managers and paste shall work.
- **Exits:** the console home for the operator's privilege level.
- **Use cases:** UC-68.
- **FRs:** FR-75.

### A-02 — Organization register

- **Purpose:** support triage and operational oversight without crossing the tenant-data boundary.
- **Primary actors:** PA.
- **Archetype:** Index.
- **Entry points:** console navigation; a support request.
- **Layout and regions:** dense table with saved filters (compact density, §12.1).
- **Content and data shown:** account-level metadata only — registration date, entity count, plan, activity. **Never report content** (FR-76, FR-77, D-5).
- **Controls and actions:** search; filter; open an organization's account-level record; raise a support-access request (A-07).
- **States:** empty — filtered; loading — initial; loading — refresh; error — recoverable; error — permission (the boundary explained, naming what would be required to cross it).
- **Validation behaviour:** the absence of report content is a designed state, not an empty state: the console shall make the boundary explicit rather than showing a blank region.
- **Exits:** A-07.
- **Use cases:** UC-69.
- **FRs:** FR-76, FR-77.

### A-03 — Content and translation console

- **Purpose:** make the content edited by people who cannot deploy — help-centre articles and plan presentation copy — editable as data, and hold the locale registry and the translation-gap queue. **Amended 19 Aug 2026 (architecture.md OQ-43):** label, help-text and validation-message wording moved into committed message catalogues and is no longer edited here; a catalogue gap is now caught by a build-time parity gate rather than surfacing in this queue.
- **Primary actors:** PA.
- **Archetype:** Editor + Publish.
- **Entry points:** console navigation; the untranslated-key queue; a content review gate (§13.4).
- **Layout and regions:** editor for the FR-61 content set per locale; publish surface following UX-123 — preview → scope disclosure → confirm → progress → result → revert.
- **Content and data shown:** FR-61 content keys with their value per locale; platform-authored terms marked as such (UX-93); the queue of keys that fell back to the default locale at runtime in that content (UC-74); the diff against the EFRAG template on a version rollout, where EFRAG publishes an official translation of a VSME label — read against the committed label catalogue for that taxonomy version.
- **Controls and actions:** edit an article or plan description; register an additional locale; publish a reviewed set; revert a publication; review the fallback queue; review the EFRAG label diff.
- **States:** empty — filtered; loading — initial; pending — async (publication in progress); partial; error — recoverable; success.
- **Validation behaviour:** publication is an explicit, versioned, reversible step rather than a side effect of editing, so half-finished translations are never live (FR-62). Scope disclosure names how many organizations and reports are affected before confirmation (UX-123).
- **Exits:** back to the queue; the system audit log (A-08) records the publication.
- **Use cases:** UC-71, UC-72, UC-73, UC-74.
- **FRs:** FR-61, FR-62, FR-63, FR-64, FR-74.

### A-04 — Taxonomy versions, mappings, migration runs

- **Purpose:** absorb an EFRAG version change without silently restating anybody's filed report.
- **Primary actors:** PA.
- **Archetype:** Editor + Batch.
- **Entry points:** console navigation; an EFRAG release.
- **Layout and regions:** editor for the version record and the field mapping; batch surface for the migration run following UX-123.
- **Content and data shown:** registered template and taxonomy versions with the uploaded artefact and the explicit backwards-compatibility determination; the field mapping between outgoing and incoming versions, covering added, removed and semantically altered fields; the exposure view — every report still pinned to a superseded version, grouped by organization and by version (UC-77); the preserved pre-migration state.
- **Controls and actions:** register a version; author a mapping; list affected reports; execute a migration run in bulk or report-by-report with manual review; notify affected organizations.
- **States:** loading — initial; pending — async (migration run, with progress); partial (some reports migrated, some failed, with per-part retry); error — recoverable; success with result summary and one-step revert or documented compensation (UX-123).
- **Validation behaviour:** migration is a versioned transformation with a preserved pre-migration state, never an in-place overwrite (FR-69). A breaking change is migrated report-by-report with manual review. Blast radius — how many organizations, how many reports — is disclosed before confirmation.
- **Exits:** the notification path (FR-70, FR-166) reaching tenants; A-08.
- **Use cases:** UC-75, UC-76, UC-77, UC-78, UC-79.
- **FRs:** FR-65, FR-66, FR-67, FR-68, FR-69, FR-70.

### A-05 — Factor sets, thresholds, validation rules

- **Purpose:** hold the calculation and rule layer as configuration, because thresholds move with the standard and with Moldova's transposing legislation.
- **Primary actors:** PA.
- **Archetype:** Editor.
- **Entry points:** console navigation; an annual factor update; a legislative change.
- **Layout and regions:** editor per rule family, with the UX-123 publication pattern where the change has cross-tenant blast radius.
- **Content and data shown:** versioned, effective-dated emission and conversion factor sets; conditional-applicability thresholds (the ≥ 50-employee turnover threshold, the ≥ 150-employee gender pay gap threshold, sector-driven and site-driven applicability); validation rule definitions and the message each fires.
- **Controls and actions:** add a factor set version; edit a threshold; edit a rule and its message; publish.
- **States:** loading — initial; pending — async (publication); error — recoverable; success with revert.
- **Validation behaviour:** existing computed results retain the factor version they were computed under, so a factor update never silently restates a filed report (FR-35, FR-71); the interface shall state that consequence at the point of publication. Content-only and rule-only changes apply without a redeploy (FR-74).
- **Exits:** the notification path to affected organizations (FR-166); A-08.
- **Use cases:** UC-80, UC-81, UC-82.
- **FRs:** FR-71, FR-72, FR-73, FR-74.

### A-06 — Adoption metrics

- **Purpose:** hold the evidence the Phase 2 go/no-go decision rests on.
- **Primary actors:** PA.
- **Archetype:** Dashboard.
- **Entry points:** console navigation.
- **Layout and regions:** Dashboard fixed elements — figures with confidence marking, period filter, export. Charts are admin-only at MVP (§11.5).
- **Content and data shown:** SMEs completing a full report; exports by format; average completion time; export-usage rate; filterable by period and segment. Low-volume figures are **marked low-confidence** rather than presented as reliable (FR-83).
- **Controls and actions:** filter by period and segment; export the metrics.
- **States:** empty — filtered; loading — initial; partial; error — recoverable.
- **Validation behaviour:** the confidence marking is a required presentation, not an optional annotation.
- **Exits:** the exported extract.
- **Use cases:** UC-83, UC-84.
- **FRs:** FR-83.

### A-07 — Support access request and audit log

- **Purpose:** make it possible to help a customer, and evident that the help was observed.
- **Primary actors:** PA.
- **Archetype:** Focus + Index.
- **Entry points:** A-02; a support ticket.
- **Layout and regions:** Focus for the request; Index for the log. While access is active, the console shall display **its own expiry countdown** (UX-124).
- **Content and data shown:** the request — stated reason and ticket reference, scope, duration; the log — requester, organization, reason and what was accessed (FR-79).
- **Controls and actions:** raise a request; end access early; review the log.
- **States:** loading — initial; pending — async (grant in effect, with countdown); error — permission; success; read-only (the log is reviewable but not editable from within the console, FR-79).
- **Validation behaviour:** a stated reason and a ticket reference are mandatory. Access expires automatically without administrator action (FR-78). Standing access to tenant report data does not exist at any point (FR-77, D-5).
- **Exits:** the scoped tenant data for the granted window; A-02.
- **Use cases:** UC-85, UC-86.
- **FRs:** FR-78, FR-79.

### A-08 — Admin accounts and system audit log

- **Purpose:** separate internal privileges from one another, and make a platform-side change explicable after the fact.
- **Primary actors:** PA.
- **Archetype:** Index.
- **Entry points:** console navigation.
- **Layout and regions:** dense tables with saved filters.
- **Content and data shown:** administrator accounts with separable privilege levels; the platform-wide log of version rollouts, content publications, migration runs, factor-set updates and administrator account changes.
- **Controls and actions:** create, modify and deactivate an administrator account; set privilege level; filter and review the log.
- **States:** empty — filtered; loading — initial; loading — refresh; error — recoverable; error — permission; read-only (the log).
- **Validation behaviour:** deactivating an account is a consequence-disclosing action naming the account and what it currently holds (UX-70). Content, operations and support functions do not require one another's rights (FR-80).
- **Exits:** none beyond the console.
- **Use cases:** UC-87, UC-88.
- **FRs:** FR-80, FR-81.

### A-09 — Plan catalogue, entitlements, pricing, discounts

- **Purpose:** let packaging and pricing change more often than the compliance core, without a release.
- **Primary actors:** BO.
- **Archetype:** Editor.
- **Entry points:** console navigation.
- **Layout and regions:** editor per plan version; the publication of a plan version change follows UX-123, since it has cross-tenant blast radius.
- **Content and data shown:** plan record with code, description and positioning; entitlements and quotas as declarative data — entities, seats, reports per period, exports by format, API allowance, module access, support tier; prices per currency and per cycle, authored rather than converted; version and grandfathering choice; publication and retirement state; discount codes and trial terms per plan version.
- **Controls and actions:** create a plan; set entitlements; set prices; version a plan with an explicit grandfathering choice; publish; retire; define a discount; define trial terms.
- **States:** loading — initial; pending — async (version publication); error — recoverable; success with revert or documented compensation.
- **Validation behaviour:** a plan version change discloses scope — how many subscriptions are affected, and under which grandfathering outcome — before confirmation (UX-123). Retirement closes a plan to new subscriptions without terminating anyone's service, and the interface states that.
- **Exits:** A-16 for the revenue consequence.
- **Use cases:** UC-89, UC-90, UC-91, UC-92, UC-93, UC-94, UC-95.
- **FRs:** FR-84, FR-85, FR-86, FR-87, FR-88, FR-89.

### A-10 — Reconciliation workspace

- **Purpose:** keep the bank transfer rail from becoming a manual back office, and work the exceptions when it does.
- **Primary actors:** BO.
- **Archetype:** Exception queue.
- **Entry points:** console navigation; a statement import; an unmatched-payment event.
- **Layout and regions:** dense table, saved filters, bulk action, per-item resolution with mandatory rationale (Exception queue fixed elements); keyboard-first.
- **Content and data shown:** imported statement lines; open orders and invoices; confident automatic matches; exceptions — missing or mistyped reference, partial payment, overpayment, third-party payment, duplicate.
- **Controls and actions:** import a statement by file or bank API; accept or reject a proposed match; resolve an exception; manually mark an invoice paid.
- **States:** empty — first use; empty — filtered; loading — initial; loading — refresh; partial; error — recoverable; success.
- **Validation behaviour:** **UX-125** — every manual resolution requires a rationale, because each is a financial assertion. Manual settlement is written to the immutable billing audit ledger (FR-134). Provisioning follows a confident match.
- **Exits:** A-12 for the invoice; A-16 for the ledger entry.
- **Use cases:** UC-137, UC-138, UC-139, UC-140.
- **FRs:** FR-131, FR-132, FR-133, FR-134.

### A-11 — Collections and dunning

- **Purpose:** escalate an unpaid invoice on a schedule that is configuration, and stop the moment it is paid.
- **Primary actors:** BO.
- **Archetype:** Exception queue.
- **Entry points:** console navigation; a dunning-exhausted event.
- **Layout and regions:** dense table, saved filters, bulk action, per-item resolution with mandatory rationale; keyboard-first.
- **Content and data shown:** overdue invoices with amount, due date passed, dunning stage, and the date service will be restricted; suspended subscriptions; write-off candidates.
- **Controls and actions:** configure the sequence and intervals; advance or halt a sequence; suspend; restore; write off with reason and accounting treatment.
- **States:** empty — filtered; loading — initial; loading — refresh; error — recoverable; success.
- **Validation behaviour:** **UX-125** applies to a write-off. Suspension makes out-of-entitlement reports and entities read-only and blocks new exports while leaving previously generated documents downloadable, and the tenant-side statement of exactly what changed and how to restore it is mandatory (FR-136, UX-54). A write-off leaves the fiscal document in the ledger rather than deleting it, and the interface offers no affordance implying deletion.
- **Exits:** A-12; A-16.
- **Use cases:** UC-141, UC-142, UC-143, UC-144.
- **FRs:** FR-135, FR-136, FR-137, FR-138.

### A-12 — Invoicing, credit notes, numbering series

- **Purpose:** issue and correct fiscal documents under Moldovan constraints, without ever editing an issued one.
- **Primary actors:** BO.
- **Archetype:** Index + Record.
- **Entry points:** console navigation; A-10; A-11; A-14.
- **Layout and regions:** Index for the document register; Record for a single document and for the numbering series configuration.
- **Content and data shown:** proformas and fiscal invoices with supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, total, and the stated VAT basis; credit notes and corrective invoices referencing their original; the numbering series per document type per fiscal year, including the annual roll; the recorded National Bank of Moldova rate on a foreign-currency document; e-Factura acknowledgement and identifier; delivery timestamp and channel.
- **Controls and actions:** issue a credit note or corrective invoice; configure and monitor a numbering series; inspect a document; inspect its transmission and delivery record.
- **States:** loading — initial; loading — refresh; pending — async (transmission); partial; error — recoverable; **read-only for every issued document** — an issued invoice is immutable and its effect changes only through a credit note (FR-125, D-10); success.
- **Validation behaviour:** issuing an invoice and consuming an invoice number are irreversible-by-design actions under **UX-71**: they shall be visually and verbally distinguished from ordinary actions and shall state the compensating mechanism, which is the credit note. Numbers are allocated at issuance under a lock and never reserved optimistically (FR-123). An untransmitted invoice is never marked delivered.
- **Exits:** A-13 on a transmission failure; A-16 for the ledger.
- **Use cases:** UC-126, UC-127, UC-128, UC-129, UC-130, UC-131, UC-132, UC-133, UC-134, UC-135, UC-136.
- **FRs:** FR-121, FR-122, FR-123, FR-124, FR-125, FR-126, FR-127, FR-128, FR-129, FR-130.

### A-13 — e-Factura transmission exceptions

- **Purpose:** treat a failed B2B transmission as a compliance exposure rather than a delivery inconvenience.
- **Primary actors:** BO.
- **Archetype:** Exception queue.
- **Entry points:** A-12; a transmission rejection event.
- **Layout and regions:** dense table, saved filters, bulk action, per-item resolution with mandatory rationale; keyboard-first.
- **Content and data shown:** the rejection reason per invoice — schema failure, unknown or mismatched fiscal code, platform outage; the underlying data that must be corrected; reissue state.
- **Controls and actions:** inspect a rejection; correct the underlying data; reissue.
- **States:** empty — filtered (the healthy state); loading — initial; pending — async (retransmission); error — recoverable; success.
- **Validation behaviour:** the invoice is never silently marked delivered on a failed transmission (FR-127). A rejection caused by an invalid buyer fiscal code routes back to the tenant's billing account data (S-23), which cannot be fixed by editing the invoice.
- **Exits:** A-12.
- **Use cases:** UC-130.
- **FRs:** FR-127.

### A-14 — Refunds and chargebacks

- **Purpose:** reverse money and entitlements as two separate, evidenced steps.
- **Primary actors:** BO.
- **Archetype:** Exception queue.
- **Entry points:** console navigation; a chargeback notification from the acquirer.
- **Layout and regions:** dense table, saved filters, per-item resolution with mandatory rationale; keyboard-first.
- **Content and data shown:** refund cases with rail and amount; the generated credit note; chargeback cases with the evidence pack assembled from the order, the recorded terms acceptance and usage records; outcome.
- **Controls and actions:** issue a full or partial refund; assemble and submit evidence; record an outcome.
- **States:** loading — initial; pending — async (rail processing, dispute in flight); error — recoverable; success.
- **Validation behaviour:** **UX-125** applies. Refund authority is separated from invoice issuance authority, so no single account can both raise a charge and reverse it (FR-139) — a separation the console must make visible rather than merely enforce server-side. Entitlement reversal applies read-only treatment rather than deletion (FR-141).
- **Exits:** A-12 for the credit note; A-16 for the ledger.
- **Use cases:** UC-145, UC-146, UC-147.
- **FRs:** FR-139, FR-140, FR-141.

### A-15 — Enterprise quotes and contracts

- **Purpose:** keep sold terms and configured terms from drifting apart.
- **Primary actors:** BO.
- **Archetype:** Record.
- **Entry points:** console navigation; an S-25 quote request.
- **Layout and regions:** Record per opportunity, quote and contract — identity header, grouped fields, explicit save, change attribution.
- **Content and data shown:** the tracked opportunity; the quote as **structured data** — negotiated entitlement set, price, currency, billing schedule, validity date; the executed contract — term length, notice period, negotiated entitlements, SLA, price protection, and any non-standard clause with billing consequences; the additive per-subscription entitlement overrides; the custom billing schedule; approaching expiry and renewal state.
- **Controls and actions:** prepare and issue a quote; record a signed contract; provision a subscription from the contract; schedule custom billing; initiate renewal; record renegotiation or expiry.
- **States:** loading — initial; error — recoverable; success; read-only (an accepted quote, an executed contract).
- **Validation behaviour:** provisioning is by additive entitlement override, not a bespoke plan per customer (FR-145), which the editor must make structurally impossible to bypass. An unrenewed contract follows the standard lapse path rather than abrupt termination (FR-147), and the interface states that.
- **Exits:** A-12 for invoicing; A-16.
- **Use cases:** UC-153, UC-154, UC-155, UC-156, UC-157, UC-158, UC-159.
- **FRs:** FR-142, FR-143, FR-144, FR-145, FR-146, FR-147.

### A-16 — Revenue, VAT export, billing audit ledger

- **Purpose:** know what was charged, what was received, and be able to evidence both.
- **Primary actors:** BO.
- **Archetype:** Dashboard + Index.
- **Entry points:** console navigation.
- **Layout and regions:** Dashboard for the revenue view (figures with confidence marking, period filter, export); Index for the ledger and the settlement reconciliation.
- **Content and data shown:** recognised and deferred revenue, active subscriptions by plan, monthly recurring revenue, churn, collection rate, days sales outstanding; VAT rates and the rules selecting treatment by residency and VAT status, each with an effective date; the period's invoices, credit notes, payments and VAT summary including MDL equivalents of foreign-currency documents; the append-only ledger of every financial event, attributed and timestamped; acquirer and instant-rail settlement reports reconciled against recorded payments, with missing settlements, fee discrepancies and timing differences identified.
- **Controls and actions:** maintain VAT rates and rules; filter; export the revenue and VAT report; reconcile settlements; review the ledger.
- **States:** empty — filtered; loading — initial; loading — refresh; partial; error — recoverable; success; **append-only read-only** for the ledger.
- **Validation behaviour:** **UX-126** — the billing audit ledger shall be presented as append-only: entries are superseded, never edited, and the interface shall offer no affordance that implies otherwise. A VAT rate change is effective-dated and requires no deployment (FR-148).
- **Exits:** the exported extract; A-12.
- **Use cases:** UC-160, UC-161, UC-162, UC-163, UC-164.
- **FRs:** FR-148, FR-149, FR-150, FR-151, FR-152.

### A-17 — Notification categories and templates

- **Purpose:** make a notice's behaviour — channels, classification, lead times, repeat interval — configuration rather than a release. **Amended 19 Aug 2026 (architecture.md OQ-43):** template wording moved into the committed message catalogues, because a category cannot exist without code calling `raise()` for it, so its words always arrive with that release. What an operator tunes here is behaviour.
- **Primary actors:** PA.
- **Archetype:** Editor + Publish.
- **Entry points:** console navigation.
- **Layout and regions:** editor for the category catalogue; publish surface following UX-123. Template wording is shown read-only, resolved from the catalogue by category key.
- **Content and data shown:** the category catalogue — default channels, transactional-or-optional classification, deadline lead times, and the interval at which an outstanding-report notice repeats; the rendered in-app and email wording per locale, read-only, so an operator can see what a classification change affects.
- **Controls and actions:** edit a category's behaviour; publish; revert.
- **States:** loading — initial; pending — async (publication); error — recoverable; success with revert.
- **Validation behaviour:** transactional classification determines non-suppressibility on S-27, so reclassifying a category is a consequence-disclosing action naming what changes for recipients (FR-163, UX-65). Email templates shall degrade to plain text and shall not depend on images or external CSS to be comprehensible (UX-66) — a template-level obligation this editor must enforce.
- **Exits:** A-08 records the publication.
- **Use cases:** UC-176.
- **FRs:** FR-173.

### A-18 — Identity provider configuration

- **Purpose:** withdraw or rotate a provider without stranding users or redeploying.
- **Primary actors:** PA.
- **Archetype:** Editor.
- **Entry points:** console navigation; a credential expiry or leak.
- **Layout and regions:** editor per provider — identity header, grouped fields, explicit save, change attribution.
- **Content and data shown:** registered providers with client credentials, requested scopes and redirect configuration; enabled or disabled state.
- **Controls and actions:** register; enable; disable; rotate credentials.
- **States:** loading — initial; error — recoverable; success.
- **Validation behaviour:** disabling a provider is a consequence-disclosing action: it stops new registrations and links through that provider while leaving existing accounts able to authenticate by another credential, and the interface shall state which of the two it does (UC-70, FR-82, UX-70). Credential rotation happens here rather than through a redeploy.
- **Exits:** the effect is visible on S-01.
- **Use cases:** UC-70.
- **FRs:** FR-82.

---

## 6. Key interaction patterns

Patterns are defined once here and referenced from the screen specifications. This section carries the substance of the specification.

### 6.1 The report authoring wizard

**UX-9** The wizard shall present the report's sections as a persistent, always-visible list with a per-module state indicator, and shall permit free navigation between them. Sequence is guidance, not a gate — except that **B1 shall be completed before any conditional module is presented**, because B1 answers determine applicability (UC-19, P2). **Amended 25 Aug 2026 (`problem_overview.md` OQ-12):** the list was "the eleven Basic Module sections"; with Comprehensive promoted it is eleven or twenty depending on the report's scope flag (D-A), so the rule now names the report's sections rather than a count. Everything else about the rule is unchanged, B1's precedence included — it gates C's conditional sections for the same reason it gates B's.

**UX-10** Opening a report shall place the user at the module where work last happened and, where nothing has been answered, at the first incomplete step — never at the beginning (UC-18, UC-36). **Amended 2 Sep 2026 (task 35.3, project owner):** the rule read "the first incomplete step" alone; FR-39's restored position and this rule are one rule, recorded in `architecture.md` §12.5.6.

**UX-11** Each module step shall show, without scrolling: the module name in plain language alongside its standard reference (`B8 — Workforce characteristics`), its completion and validation state, and how many fields remain outstanding.

**UX-12** A module shall be completable in any order internally, and shall never block on an adjacent module's data. Where a value is derived elsewhere (B3 from the calculator), the field shall show its provenance and a route to the source rather than being disabled without explanation.

**UX-13** Read-only mode — a locked period (UC-57), a view-only membership, or a suspended entitlement (UC-142) — shall use the *same* layout as edit mode with affordances removed and a persistent banner stating which of the three causes applies and what restores editing. Three different causes shall never produce one indistinguishable read-only screen.

The eleven Basic Module steps, with their conditional dependencies, are:

| Step | Module | Conditional behaviour |
|---|---|---|
| B1 | Basis for preparation | Drives applicability for every subsequent module; pre-populated from entity master data (FR-27) and editable in place |
| B2 | Practices, policies and future initiatives | Principal narrative module with structured yes/no anchors |
| B3 | Energy and GHG emissions | Normally derived from the carbon calculator (§6.8); completable by direct entry |
| B4 | Pollution | Commonly resolves to not-applicable, recorded explicitly with rationale (§6.5) |
| B5 | Biodiversity | Applicability is site-driven from the B1 site geolocations |
| B6 | Water | Sector-driven relevance; supports a documented immateriality determination |
| B7 | Resource use, circular economy and waste | Narrative and quantitative content captured together |
| B8 | Workforce characteristics | Employee turnover appears once B1 headcount reaches 50 or more |
| B9 | Health and safety | Zero is an affirmative disclosure (`nil_return`) |
| B10 | Remuneration, collective bargaining and training | Unadjusted gender pay gap appears once B1 headcount reaches 150 or more |
| B11 | Corruption and bribery | Nil return is an affirmative disclosure (`nil_return`) |

### 6.2 The disclosure field

The single most-repeated component in the product. Its anatomy is normative.

```
┌────────────────────────────────────────────────────────────────┐
│ Label (plain language)                          [state marker] │
│ Help text — one or two sentences, plain language               │
│ ┌──────────────────────────┐ ┌──────────┐                      │
│ │ value input              │ │ unit     │  ← unit fixed or     │
│ └──────────────────────────┘ └──────────┘    chosen, never free│
│ Prior period: 1 240 MWh  ·  [Carry forward]   ← where a prior  │
│ ⓘ state message: what / consequence / action    period exists  │
│ [Mark not available ▾]                        ← always present │
│ ⌄ Why this is asked · standard reference · example             │
└────────────────────────────────────────────────────────────────┘
```

This anatomy is the source's only screen-level layout diagram. The field-level conventions it implies are stated in §7.

### 6.3 Conditional and dynamic field applicability

**UX-26** Conditional fields (turnover at ≥ 50 employees, gender pay gap at ≥ 150, site-driven biodiversity, sector-driven water) shall appear and disappear live as B1 answers change (UC-26, UC-28, UC-81).

**UX-27** When a field appears or disappears, the change shall be announced — a brief, non-modal, dismissible explanation naming the B1 answer that caused it. Fields shall not materialise silently; an unexplained new required field at deadline reads as a system fault.

**UX-28** Where a conditional field disappears after being answered, the entered value shall be retained and restored if the condition returns, and the user shall be told it has been retained rather than discarded.

### 6.4 Validation presentation and finding-to-field navigation

Eight terminal states. They are a design vocabulary, not merely a data enum.

Marks and colour roles below are from the delivered visual layer (18 Aug 2026, §11.3). **Every state carries a mark, a text label and a colour role** — remove the colour and the state still reads, which is what makes the monochrome print layer possible and what UX-23 requires.

| State | Mark | Meaning to the user | Field treatment | Colour role | Counts as resolved? |
|---|---|---|---|---|---|
| `ok` | ✓ | Answered and coherent | Neutral, no marker in the field itself | `state.ok` | Yes |
| `missing` | ! | Required and unanswered | Attention marker, non-alarming — nothing is wrong yet | `state.attention` | No |
| `inconsistency` | ≠ | Conflicts with another value | Warning, with a link to the conflicting field | `state.warning` | No |
| `error` | × | Violates a rule outright | Error, blocking within the field | `state.error` | No |
| `invalid_url` | × | Reference does not resolve | Error role, failing URL shown verbatim | `state.error` | No |
| `not_available` | — | Declared unavailable with reason | Reasoned marker, reason shown inline | `state.reasoned` | Yes — reasoned |
| `not_material` | ⊘ | Section declared immaterial with rationale | Section-level; collapses the module body, keeps the rationale visible | `state.reasoned` | Yes — reasoned |
| `nil_return` | 0 | Affirmatively zero | Neutral, labelled as an affirmative zero — **never an empty box** | `state.neutral` | Yes |

Eight design states, **six colour roles** — `error` and `invalid_url` share one, `not_available` and `not_material` share another. That is deliberate: colour carries severity, the mark and label carry identity.

**UX-20** Validation state shall be shown inline at the point of entry *and* rolled up per module and per report (UC-37, UC-38). Neither presentation replaces the other.

**UX-21** The roll-up shall discount modules declared not material, so a legitimately excluded module does not depress the completion figure (UC-38).

**UX-22** Every finding shall be a link that moves focus to the originating field, scrolls it into view, and displays the rule explanation (UC-39). Silent scroll without focus movement is a failure of §10.

**UX-23** Colour shall never be the sole carrier of state (§10.2). Each state has an icon, a text label and a colour role.

**UX-24** Validation shall be runnable at any completeness and shall be idempotent (UC-40). The interface shall present it as a working tool, not a pre-export gate — the primary control is *check my report*, not *submit*.

**UX-25** Export shall be permitted with unresolved findings after an explicit warning listing what is unresolved, and the gaps shall appear visibly marked in the produced document (UC-42, FR-44, BR-VAL-4 — corrected 18 Aug 2026 from the source's unresolvable "§15.4", OQ-8).

> **Vocabulary note — resolved 18 Aug 2026 (OQ-4). The machine states are canonical.** UC-37 and FR-40's enum is the contract: it is the API value, the stored value and the name used in `packages/contracts`, normalised to `SCREAMING_SNAKE_CASE` on the wire. The eight design states above remain the design vocabulary and become presentation labels derived from it, with the mapping declared once in `packages/contracts` and nowhere else.
>
> Reconciling the two exposed that the eight-state list is not a superset of six — it **conflates three different axes**, and separating them is the substance of this decision:
>
> | Design state | Canonical home |
> |---|---|
> | `ok` · `missing` · `inconsistency` · `error` · `invalid_url` · `not_available` | `ValidationState` — `OK`, `MISSING_VALUE`, `VALUE_INCONSISTENCY`, `ERROR`, `INVALID_URL`, `NOT_AVAILABLE`. Six field-level validation outcomes (UC-37, FR-40) |
> | `not_material` | **Not a field validation state.** Section-level materiality (FR-41, UX-21), which the roll-up discounts. Its own enum, on the module, not the field |
> | `nil_return` | **Not a validation state.** An affirmative zero is a property of the *answer*, not of its validation — a field carrying `nil_return` is `OK`. Belongs to answer semantics (UX-119's zero-versus-gap distinction) |
>
> The practical consequence is that a field can be `OK` *and* an affirmative zero *inside* a module declared immaterial, which the flat eight-state enum could not express — it forced one of the three to win. §6.4's table stands as the design's presentation contract; §10's requirement that each state carry an icon, a label and a colour role applies to all eight as displayed, across all three axes.

### 6.5 Not material, not applicable, not available

**UX-29** Declaring a section not material (UC-30) shall require a rationale, shall be reversible, and shall visibly change the module's state in the module list to a distinct third value — neither complete nor incomplete.

**UX-30** The rationale shall be presented as text a third party will read in the export, and the interface shall say so at the point of entry. This is the difference between a considered exclusion and an evasion.

### 6.6 Prior-period comparatives and carry-forward

**UX-31** Where a prior period exists, its value shall be shown adjacent to the current input at the point of entry, not in a separate comparison view (UC-45).

**UX-32** Carry-forward shall be a per-field action with an optional module-level bulk action, and every carried value shall remain visibly marked as carried until edited or explicitly confirmed (UC-46).

**UX-33** A year-over-year movement beyond a configured proportional threshold shall raise an `inconsistency`, not an `error` — the movement may be real. The message shall state both values and the change.

### 6.7 Autosave, offline queueing and draft recovery

**UX-34** There shall be no save button in the wizard. Values persist on blur or step change (UC-35).

**UX-35** Save state shall be continuously visible in one fixed location with four states: *saved*, *saving*, *queued — no connection*, *failed*. The indicator shall be text-labelled, not an icon alone, and shall be announced to assistive technology on change (§10.4).

**UX-36** Acknowledgement shall follow durable commit, not optimistic local state, within the p95 ≤ 250 ms budget. Where the budget is exceeded the indicator shall move to *saving* rather than showing a false *saved*.

**UX-37** Offline changes shall queue locally and retry. The user shall be warned while anything is unsynced, and shall be warned again — with a chance to cancel — on any navigation away, sign-out or organization switch that would abandon a queue (UC-06, UC-35).

**UX-38** Session expiry shall not lose work: on re-authentication the user returns to the exact screen and record, and queued changes are submitted (UC-07). Re-authentication shall be presented inline over the preserved context, never as a redirect to a blank sign-in screen.

**UX-39** Resumption shall restore field values, wizard position and validation state on any device (UC-36). **Cross-logged 2 Sep 2026 (task 35.3):** field values and position are restored from the store — position as the module where work last happened, per report; validation state is recomputed by task 41's validation rather than resumed, which FR-43's idempotent validation makes equivalent (`architecture.md` §12.5.6).

### 6.8 The carbon calculator

**UX-40** The calculator shall accept consumption **in the units of the user's own invoices**, by source and by site (UC-32). Unit conversion is the system's work, never the user's.

**UX-41** Raw inputs shall remain visible and editable after calculation, presented as the permanent record they are — the assurance trail depends on them.

**UX-42** Results shall be shown with their derivation available in one step: input → conversion → factor applied → result, naming the factor set version (UC-33).

**UX-43** An override (UC-34) shall require a reason, shall display the superseded computed value alongside the substituted one, and shall carry an attribution marker into the preview and the export. An unexplained substituted figure shall never be presentable.

**UX-44** Where a factor set is updated after a result was computed, the report shall show a non-blocking notice naming the pinned version and offering recalculation. A filed figure is never silently restated (P7).

### 6.9 Preview and export flow

**UX-45** Preview shall be a faithful rendering of the export — same content, same order, same marked gaps — not an approximation (UC-41).

**UX-46** Export shall be presented as an asynchronous job from the first interaction: the user requests it, receives immediate acknowledgement with a place to watch, and may leave the screen. Where a job exceeds 30 s the result is delivered by notification (§8.5).

**UX-47** The export dialogue shall require two decisions and no more: **format** (PDF · EFRAG Excel) and **language** (independent of interface language, UC-48). Where a language whose VSME labels are platform-authored is selected, the dialogue shall state that those labels carry no official EFRAG standing, and shall recommend the language that does for a bank or EU buyer. **Amended 31 Aug 2026** (project owner), from *"where Russian is selected … recommend RO or EN"*: opening EFRAG's published package for task 33.2 showed **Romanian is a stub** — the `2026-05-01` taxonomy ships label linkbases for 23 languages of which twelve carry labels, and `ro` holds zero, matching the Digital Template's own twelve-language selection. So **English alone carries official standing at this version**, and the old wording recommended Romanian for exactly the reader — a bank or an EU buyer — for whom the distinction exists. The rule is written against *which labels are official* rather than naming locales, because EFRAG ships the `ro` stub as a file it evidently intends to fill; NFR-12's quarterly watch is what re-checks it, and task 33.2's extractor fails loudly if a stub becomes populated.

**UX-48** Where a report is pinned to a superseded taxonomy version, the dialogue shall offer migration or export-against-original with an explicit notice, and shall not proceed silently (UC-43).

**UX-49** Export history shall show format, language, taxonomy version, timestamp and generating user, and every prior artefact shall remain re-downloadable exactly as distributed (UC-44).

### 6.10 Entitlement, quota and read-only

**UX-50** A quota block shall state the limit reached, what the current plan allows, current consumption, and the upgrade path — in that order (UC-150). "Upgrade to continue" alone is non-compliant with NFR-79.

**UX-51** Reporting work in progress shall never be lost to a quota block, and a started report shall always be finishable and exportable (UC-150). Quota gates apply at creation boundaries, never mid-task.

**UX-52** Approaching-limit warnings shall appear against the counter in context (UC-66, UC-149), before the limit, not only as a notification.

**UX-53** Before any entitlement reduction — downgrade, cancellation, lapse — the interface shall list **by name** the entities and reports that will become read-only under the deterministic retention rule (UC-101, UC-151, NFR-80). Nothing is deleted, and the interface shall say so explicitly, because "downgrade" is otherwise read as "data loss".

**UX-54** Suspension (UC-142) shall keep previously generated documents downloadable, and shall state the exact amount, the date, and the single action that restores service.

### 6.11 Checkout and the external payment round-trip

**UX-55** The order summary shall show net, VAT rate and basis, gross, and currency before confirmation (UC-112).

**UX-56** Payment rails shall be presented with availability reasons. Where MIA is excluded because the total exceeds the configured ceiling, the option shall be shown as unavailable **with the reason**, never omitted (UC-112, P8).

**UX-57** The hand-off to an external provider shall warn the user they are leaving, name the provider, and state what returns them. The platform shall never imitate a payment form — no card fields exist anywhere in the product (PCI SAQ-A).

**UX-58** The return path shall be designed for all four outcomes: success, failure, cancellation and **abandonment mid-challenge**. An order shall survive the round trip without duplication, and a user returning to an indeterminate state shall see *pending*, with what happens next and when, rather than an error (UC-117).

**UX-59** The bank-transfer path shall present the payment reference as the single most prominent element, copyable in one action, alongside the proforma and the consequence of omitting the reference (UC-121).

**UX-60** Saved-card consent (UC-118) shall be an explicit, separately-recorded act, distinct from paying once, and worded as a recurring authorisation.

### 6.12 The notification centre and notification model

**UX-61** Every SYS use case shall terminate in a named destination: the notification centre, an admin exception queue, or a visible state change on the affected object. No system action shall be invisible to the humans it affects.

**UX-62** The notification centre shall be persistent storage with an unread count visible from any screen — not transient toasts (UC-165). A notice raised while the user was signed out is waiting on return.

**UX-63** Every notification shall be a link to the object that raised it (UC-166, P6).

**UX-64** Read state shall be per-user; one recipient reading an organization-wide notice shall not clear it for colleagues (UC-167).

**UX-65** Preferences shall be per category, per channel, and transactional categories — security, account, invoice delivery, payment failure — shall be shown as mandatory and non-disableable, with the reason stated (UC-168).

**UX-66** Email shall render in the recipient's own language, degrade to plain text, carry a working unsubscribe on optional categories only, and shall not depend on images or external CSS to be comprehensible.

**UX-67** Transient toasts are permitted **only** for confirmation of a user's own immediate action, shall never carry information available nowhere else, and shall never be the sole carrier of an error.

### 6.13 Traceability and change history

**UX-68** Field-level history — who, when, previous value — shall be reachable from the field itself, not only from a separate audit screen (UC-47).

**UX-69** History shall remain attributed to users removed from the organization; removing access shall never erase the trail (UC-63), and the interface shall state this at the point of removal.

### 6.14 Destructive and irreversible actions

**UX-70** Every destructive, overwriting or irreversible action shall require explicit confirmation that **names the specific object and the specific consequence** (NFR-80). Generic "Are you sure?" is prohibited.

**UX-71** Actions that are irreversible by law or design — issuing an invoice, consuming an invoice number, locking then reopening a period, publishing a content set, executing a migration run — shall be visually and verbally distinguished from ordinary actions, and shall state the compensating mechanism where one exists (a credit note, a revert, a preserved pre-migration state).

**UX-72** Reopening a locked period shall require a stated reason and shall display, thereafter, that the period was reopened (UC-58) — an amendment must look like an amendment.

---

## 7. Form and input design conventions

### 7.1 Field anatomy and required elements

Every disclosure field follows the anatomy in §6.2: plain-language label, state marker, help text, value input, unit, prior-period comparative with carry-forward where a prior period exists, state message, the always-present "not available" declaration, and progressive disclosure carrying the rationale, standard reference and example.

### 7.2 Units

**UX-14** Every quantitative field shall carry an explicit unit, either fixed by the taxonomy or chosen from a constrained list. Free-text units are prohibited — they are the primary source of unusable ESG data.

Units the standard requires are captured as such: MWh for energy, tCO₂e for emissions, m³ for water, headcount and FTE for workforce, the hazardous/non-hazardous split for waste, and headcount broken down by contract type, gender and country (FR-29). Derived intensity figures are computed, not typed. In the calculator, the user enters the unit their own invoice uses and conversion is the system's work (UX-40).

### 7.3 Required, optional and conditional

Applicability is resolved before display, never validated after entry (P2). A field is therefore in exactly one of three conditions:

| Condition | Presentation |
|---|---|
| Applicable and required | Shown; `missing` until answered; counts against the module's outstanding count (UX-11) |
| Applicable and conditional | Shown or hidden live from B1 answers, with the appearance or disappearance announced and its cause named (UX-26, UX-27); a value entered before disappearance is retained (UX-28) |
| Not applicable | Not rendered. The system never renders a field and then refuses its value on grounds it already knew (P2) |

### 7.4 "Not available, with reason"

**UX-15** Every field shall offer the "not available, with reason" declaration (UC-31) as a first-class action, not as an alternative discovered after failing to answer.

It is a terminal state distinct from `missing` (D-4, FR-32), it satisfies validation as a *reasoned* resolution rather than suppressing it, and the stated reason is carried into both export formats.

### 7.5 Nil and zero as affirmative disclosure

**UX-16** Zero shall be enterable and distinguishable from unanswered in every numeric field. In B9 and B11 zero is an affirmative disclosure (`nil_return`) and shall be labelled as such, not rendered as an empty box.

### 7.6 Help text and progressive disclosure

**UX-17** Help text shall be visible by default at one to two sentences. Standard references, worked examples and rationale sit behind progressive disclosure. The user shall never have to open anything to answer a normal question (P1). **Cross-logged 2 Sep 2026 (task 91.1, `architecture.md` OQ-59):** EFRAG's own `documentation` labels cover 22 of 143 elements at `2026-05-01` and are shown; the remaining 121 render no help until task **94** authors it — the requirement is unmet there, stated rather than paraphrased.

**UX-18** Field labels, help text and validation messages are content, not code (UC-71). No design shall depend on a specific string length; every layout shall tolerate a **+40 % expansion** from the Romanian source (§9.5).

### 7.7 Narrative inputs

**UX-19** Narrative fields shall show a length indication and a soft target derived from the reference corpus, never a hard limit unless the taxonomy imposes one, and shall support paragraph structure only — no rich formatting that the PDF and Excel exports cannot faithfully carry. **The soft target is deferred (task 36.2, 3 Sep 2026): no reference corpus exists in this repository**, so the control ships with the count, the paragraph-only structure and no hard limit, and the target arrives with a corpus — `architecture.md` §12.5.6 records what is assumed meanwhile.

**UX-74** applies to narrative inputs specifically: they shall match the 60–75 character reading measure, because a full-width textarea produces unreadable text and worse writing.

### 7.8 Redundant entry

**UX-109** Information already supplied is never re-requested — entity master data pre-populates B1 (UC-19) rather than being retyped. The pre-populated values remain editable in the report, because B1 is a disclosure rather than master data (D-2, FR-27).

### 7.9 Form control inventory

The form controls a component library must supply, each with every applicable state from §8.1: Text · Textarea · Number-with-unit · Select · Combobox · Multi-select · Radio group · Checkbox · Switch · Date · Date range · Currency · File upload · Fieldset · Form-level error summary.

---

## 8. Feedback, messaging and error handling conventions

### 8.1 The state model

**UX-90** Every screen, panel and domain component shall define all applicable states before implementation. An undefined state is a defect, not an omission.

| State | Requirement |
|---|---|
| **Empty — first use** | Teaches what the object is and offers the one action that creates it. Never a bare "no data". |
| **Empty — filtered** | Distinguishes "nothing matches" from "nothing exists", and offers to clear the filter. |
| **Loading — initial** | Skeleton matching final layout; no layout shift on resolve. |
| **Loading — refresh** | Prior content stays visible and readable; never blanked. |
| **Partial** | Some data resolved, some failed: shows both, names what is missing, offers retry for that part only. |
| **Error — recoverable** | Three-part message (§8.2) plus retry. |
| **Error — permission** | Explains the boundary and names who can grant access (UX-1). |
| **Read-only** | Names which of the three causes applies and what restores editing (UX-13). |
| **Offline / queued** | Explicit, persistent, non-alarming; states what is queued and what happens next. |
| **Pending — async** | Names the job, where the result appears, and roughly when. |
| **Success** | Confirms *what* happened and offers the next step; never a bare toast for a consequential action. |

### 8.2 The message formula

**UX-92** Every error and system message shall state, in this order: **what failed · what the consequence is · what action resolves it** (NFR-79). No message ships without all three parts.

> *Not:* "Validation error in B8."
> *But:* "Employee turnover is required because you reported 50 or more employees in B1. Until it is answered, B8 stays incomplete and the report cannot be marked ready. Enter the number of employees who left during the period."

### 8.3 Message placement

| Vehicle | Permitted use |
|---|---|
| Inline field message | The state of one field, at the point of entry (UX-20) |
| Form-level error summary | At the top of the form, with links to each field (UX-111) |
| Callout (info · attention · warning · error · success) | Context-scoped feedback within a region |
| Banner (persistent, page-level) | A standing condition: read-only cause (UX-13), unsynced queue (UX-37), superseded version pin |
| Consequence dialogue | Before a destructive, overwriting or irreversible action, naming object and consequence (UX-70) |
| Toast | **Only** confirmation of a user's own immediate action. Never information available nowhere else, and never the sole carrier of an error (UX-67) |
| Notification centre | Anything the user must still see after they leave the screen or the session (UX-61, UX-62) |

### 8.4 Finding-to-destination discipline

Every error, warning and notification resolves to the exact field, record or screen that fixes it (P6, UX-22, UX-63). A message that says something is wrong without saying where is a defect, not a rough edge.

### 8.5 Performance-shaped feedback

The NFR budgets are design constraints, not backend-only concerns.

| Budget | Design consequence |
|---|---|
| Interactive read p95 ≤ 300 ms | No loading affordance below ~300 ms — a flashing skeleton reads as instability |
| Autosave ack p95 ≤ 250 ms | Indicator moves to *saving* only beyond the budget (UX-36) |
| Validation p95 ≤ 2 s | Inline progress on the roll-up; the wizard stays interactive throughout |
| Calculation p95 ≤ 1 s | Synchronous presentation is acceptable; anything slower moves to the async pattern of §6.9 |
| Export p95 ≤ 10 s, async beyond 30 s | Always presented as a job (UX-46); notification is the delivery channel past 30 s |
| Entitlement p95 ≤ 20 ms | Gating shall not produce a visible delay; never render an action then retract it |
| LCP ≤ 2.5 s · INP ≤ 200 ms at p75, 4G mid-range | Above-the-fold content is server-rendered; heavy panels (history, preview, charts) load on demand |

**UX-115** Skeletons shall match the final layout so that resolution causes no layout shift. Spinners are reserved for indeterminate waits with no known shape.

**UX-116** Under the April–May load, no interface element shall depend on a background poll more frequent than the state it reflects actually changes.

---

## 9. Localization and content design

### 9.1 Locales supported — resolved 18 August 2026

The sources did not agree on how many locales are live at MVP. **Settled by the requirements owner: three — Romanian as source, English and Russian, each separately authored.** Ratified into NFR-23 and FR-63; the table below is the record of the disagreement and what each source said before it was closed.

| Source | Statement |
|---|---|
| *Interface and Interaction Design Specification (MVP)* | "Three live locales — Romanian (source), English, Russian." Scope line: "three locales". Russian VSME labels are platform-authored and carry no official EFRAG standing, stated at the point of export selection (UX-47, UX-98) |
| *Use Case Register (MVP)*, UC-14 | "The user selects Romanian or English for the application interface." |
| *Functional Requirements (MVP)*, FR-63 | "…with Romanian and English live at MVP and no architectural limit to two" |
| *Use Case Register (MVP)*, UC-73 | Registering an additional locale is described as adding one "beyond Romanian and English" — a PA configuration task, not a development task |

Both readings were internally coherent: RO/EN as the requirement baseline, with Russian either an admitted third locale or one registered through UC-73 after MVP. The decision takes the interface specification's reading, so **all three design consequences are in MVP scope**: the Russian caveat pattern (UX-47, UX-98) ships, Cyrillic typeface coverage (UX-84) is an MVP procurement constraint, and the +40 % expansion budget is measured across three locales. NFR-23 and FR-63 are amended accordingly; UC-73 continues to govern any *fourth* locale.

**The caveat pattern is factually confirmed, and it is wider than this paragraph first said.** Russian is not an EU language and is not in EFRAG's official template or taxonomy label set — that much was right. **Amended 1 Sep 2026 (task 33.2)**: the sentence continued *"NFR-24's official-label obligation applies to RO/EN alone"*, and opening the published `2026-05-01` package showed **Romanian is a stub** — twelve of 23 label linkbases carry labels and `ro` holds zero. So of the three live locales **NFR-24 binds English alone**, Romanian and Russian VSME labels are both platform-authored, and UX-47's statement covers both. It remains a correct disclosure rather than a defensive one; it simply names two locales, including the source. See OQ-1, closed, and T-14 as amended.

### 9.2 Translatable content model

**UX-93** A single glossary shall be the source of truth for every domain term in every locale. Where EFRAG publishes an official translation of a VSME label, it is used verbatim and diffed against the template on every version rollout. Platform-authored terms are marked as such in the content console.

Content is data, not code (FR-61): labels, help text, validation messages, notification templates and email templates are all versioned, editable through A-03 and A-17, and published as an explicit, reversible, all-tenant step (FR-62). Every string is a content key; none is hardcoded (§13.4).

**UX-97** Where a string falls back to the source locale at runtime, the user sees the fallback without decoration; the gap is logged to the translation review queue (UC-74). A visible "missing translation" marker is prohibited in the tenant interface.

### 9.3 Export language independence

Interface language, export language and email language are three independent selections:

| Selection | Where set | Rule |
|---|---|---|
| Interface language | S-27, per user profile | Persists across devices and sessions (FR-10) |
| Export language | S-11, per export | Independent of interface language (UX-47, UC-48, FR-52); recorded in export history |
| Email language | Resolved per recipient | Email renders in the recipient's own language, resolved per recipient rather than per notification (UX-66, FR-169) |

**UX-98** The platform-authored-label caveat (§6.9, UX-47) shall appear at the point of export language selection and on the exported document itself, not only in documentation. **Amended 31 Aug 2026** with UX-47: it read *"the Russian caveat"*, and at `2026-05-01` it covers **Romanian as well** — including the source locale, which is the one most readers will export in.

### 9.4 Voice and term handling

Plain, specific, unhurried, second person. The reader is a competent business owner who does not know the standard. Regulatory vocabulary is translated at first use and never used to establish authority.

**UX-91** The interface shall not use "ESG", "materiality", "Scope 2", "value chain" or "double materiality" in a primary label without a plain-language gloss available in one step.

### 9.5 Localization constraints on layout

**UX-94** Layouts shall tolerate **+40 %** string expansion from the Romanian source without truncation, reflow into unreadability, or loss of an action.

**UX-95** No layout shall depend on string length, sentence structure or word order. Concatenated sentence fragments are prohibited; every message is a whole, translatable unit with named placeholders.

**UX-96** Numbers, dates, currency and units shall be formatted per locale, and the same value shall never appear in two formats on one screen.

---

## 10. Accessibility requirements

**Target: WCAG 2.2 AA on every tenant-facing screen; PDF/A-2a + PDF/UA-1 on record-intended exports** (NFR-75 as amended, NFR-82 as amended, EN 301 549 v4.x aligned).

This exceeds the WCAG 2.1 baseline of the Moldovan Unified Design Model (§11.7) and of EU Directive 2016/2102 as commonly transposed, so a MUD-themed public-sector deployment inherits a higher standard rather than a lower one (UX-133).

### 10.1 Structure

**UX-99** Every screen shall have a correct heading hierarchy, landmark regions, a skip link, and a document title reflecting the current object and state.

**UX-100** Semantic elements shall carry semantic meaning natively; ARIA is a supplement to correct structure, never a substitute for it.

### 10.2 Perception

**UX-101** Contrast: ≥ 4.5:1 for body text, ≥ 3:1 for large text, non-text UI components and state indicators — in both colour schemes.

**UX-102** No information shall be carried by colour alone (UX-23), by shape alone, or by position alone.

**UX-103** Content shall reflow without loss at 400 % zoom and shall remain usable with author styles overridden.

### 10.3 Operation

**UX-104** Every function shall be reachable and completable by keyboard, in a logical order, with no traps.

**UX-105** **Focus Appearance (2.4.11/2.4.13):** the focus indicator shall meet the minimum area and contrast requirements against every background it can appear on, and shall never be suppressed.

**UX-106** **Target Size (2.5.8):** interactive targets shall meet the 24 × 24 minimum, with exceptions used only where the criterion permits. This binds inline field actions — "not available", "carry forward", finding links — which are exactly where the temptation to shrink is greatest.

**UX-107** **Dragging Movements (2.5.7):** any reordering or drag interaction shall have a single-pointer alternative.

**UX-108** **Accessible Authentication (3.3.8):** no cognitive function test shall be required to sign in. Password managers and paste shall work everywhere. This constrains the sign-in and MFA design from the outset, not at audit.

**UX-109** **Consistent Help (3.2.6)** and **Redundant Entry (3.3.7):** help is in the same place on every screen, and information already supplied is never re-requested — entity master data pre-populates B1 (UC-19) rather than being retyped.

### 10.4 Forms and dynamic content

**UX-110** Every input shall have a programmatically associated visible label; placeholders are never labels.

**UX-111** Errors shall be identified in text, associated with their input, and summarised at the top of the form with links to each field.

**UX-112** Asynchronous state changes — autosave, validation completion, export ready, applicability change — shall be announced through polite live regions. Autosave shall not produce announcement noise on every keystroke; it announces on transition only (UX-35).

**UX-113** Focus shall be managed explicitly on step change, dialogue open and close, panel open, and finding navigation, and shall always return to a sensible origin.

### 10.5 Verification

**UX-114** Automated checks in CI, plus manual keyboard and screen-reader audit of the wizard, plus veraPDF conformance validation of exports, plus moderated usability testing with ≥ 8 representative Moldovan SME participants before launch and on any wizard restructure (NFR-75, NFR-76, NFR-82).

---

## 11. Visual design system references

> **The visual identity layer was delivered on 18 August 2026 and this section now carries values.** The original source deliberately omitted them — "pixel values, brand colour values and font families are deliberately absent — they are supplied by the visual identity layer and swapped without touching this document" — and §11 accordingly specified only structure. That layer now exists.
>
> **`design/tokens.css` is the single source of truth for every value below.** It is authored against the three-tier architecture UX-78 already required, and it graduates to `packages/ui/src/styles/tokens.css` when that package is scaffolded — moved, not copied, because two token files is how a design system dies. The rendered reference is `design/screens/` (fourteen hi-fi prototypes); `design/HANDOFF.md` is the as-delivered record and is **superseded by this section** — where the two differ, §11 governs, and the handoff is provenance.
>
> Values below are reproduced from the token set rather than restated independently, so a change is made in `tokens.css` and reflected here, never the reverse. **OQ-2 is closed**: the handoff covered colour, type, space, shape, elevation and motion, and UX-73's grid geometry — the one gap it left — was set from standard conventions on the same date, using steps the space scale already contained.

### 11.1 Layout grid and measure

**UX-73** Layout shall be defined by a **12-column fluid grid**. Column counts, not pixel widths, are the unit of layout description in any design artefact. Design frames are **1440 · 834 · 390**, and every screen in `design/screens/` is drawn at all three.

**Values set 18 Aug 2026, closing OQ-2** — standard conventions, taken from the existing space scale rather than invented:

| Token | Value | Notes |
|---|---|---|
| `--content-max` | **1200px** | Shell maximum. Regions inside may be narrower and are — the delivered screens use an ~1080px content card and a ~700px reading column |
| `--grid-columns` | **12** | Fluid: each column is `1fr`, so no integer column width is implied or needed |
| `--grid-gutter` | **24px** (`--space-6`) | At ≥ 1024, the `wide` threshold of §3.3 |
| `--grid-gutter-narrow` | **16px** (`--space-5`) | Below 1024, and the page margin at every width |

Two consequences worth stating rather than leaving to be rediscovered. **The gutter is not a free value** — it is a space step, so a layout cannot introduce a gutter the scale does not contain, which is UX-85 applied to layout. And **`--content-max` is a ceiling, not a target**: it bounds the shell, while UX-74's reading measure independently bounds text at `--measure-text` (68ch, ≈ 700px at body 15/24). A screen that stretches prose to 1200px satisfies this rule and violates UX-74.

**UX-74** Body text and help text shall be constrained to a comfortable reading measure (approximately 60–75 characters). Narrative disclosure inputs shall match that measure — a full-width textarea produces unreadable text and worse writing.

### 11.2 Token architecture

**UX-78** All visual values shall be expressed as tokens in three tiers, and no component shall reference a tier-1 token directly.

```
Tier 1  primitive     --pine-600 · --slate-100 · --space-4 · --radius-2 · --motion-quick
   ↓    (raw literals — the only place a literal exists; tier 2 may read it, nothing else)
Tier 2  semantic      --surface-default · --text-muted · --border-focus · --accent
   ↓    --state-ok · --state-attention · --state-warning · --state-error
   ↓    --state-reasoned · --state-neutral · --state-pending
Tier 3  component     --field-border-rest · --field-border-invalid · --field-border-missing
        --field-surface-reasoned · --wizard-step-complete · --savestate-queued
```

**These are the authored token names, not examples.** A component reading a tier-1 variable is a defect, catchable in review and in CI by grepping component sources for `--pine-`, `--slate-`, `--space-`, `--radius-` and the raw hue names.

**UX-79** Swapping the entire visual identity shall require editing tier 1 only — and tier 3 only where a component maps to a different role. Components never change. This is the operational meaning of "framework-agnostic" and shall be verified by producing a second, deliberately different theme before launch; the MUD-approximating theme of §11.7 is that verification.

**UX-80** Every semantic token shall be defined for both light and dark schemes and shall satisfy §10.2 contrast in both. Dark scheme support is a token obligation from the start, whether or not the toggle ships at MVP — retrofitting it after twenty screens is the expensive path.

**UX-80a** Focus shall be a **two-layer ring** — `0 0 0 2px var(--border-focus), 0 0 0 4px var(--border-focus-halo)` — applied globally to `:focus-visible` on every interactive element. **No component may remove an outline without replacing it.** Two layers rather than one because a single ring is illegible on either `--surface-default` or `--surface-sunken` depending on its colour; two are legible on both.

### 11.3 Colour roles

Colour is specified by role, never by hue — application code names the role, never the hue. The ramps below are tier 1 and exist so tier 2 can point at them.

**Accent — pine, exactly one.** `#2E6A4F` (`--pine-600`). Primary action and active state only, **never a validation state**, so an accent button is never mistaken for a success marker.

Pine: `50 #EDF5F0` · `100 #D6E8DE` · `200 #ADD1BE` · `300 #7CB49A` · `400 #4E8F72` · `500 #3A7A5C` · **`600 #2E6A4F`** · `700 #245540` · `800 #1B4031` · `900 #132C22`

**Neutral — slate, cool, chroma under 0.02.** Carries roughly 90% of every screen.
`0 #FFFFFF` · `25 #FAFBFC` · `50 #F4F6F8` · `100 #E8ECF0` · `200 #D5DBE2` · `300 #B4BDC7` · `400 #8B96A3` · `500 #67737F` · `700 #3A434C` · `900 #161B20`

**State hues — one text-safe step and one tint each, no ramps.** Deliberate: there is no room to improvise a shade.

| Role | Hue | Text-safe | Tint |
|---|---|---|---|
| Attention | amber | `#9A6510` | `#FDF4E3` |
| Warning | rust | `#B4501A` | `#FDF0E8` |
| Error | crimson | `#B32318` | `#FDEDEB` |
| Reasoned | iris | `#5A4FA3` | `#F0EFF9` |
| Pending | azure | `#0E6FA8` | `#E9F3FA` |

**Iris for `reasoned` is load-bearing, not decorative.** A declared gap is neither an answer nor an omission: green reads as complete, amber as outstanding. A hue from neither family is the only honest option, and it leaves the accent free for actions. This is UX-81 given a value.

Steps at 600 and above pass 4.5:1 on `surface.default`; 300 and below are surfaces and tints only.

**Semantic roles, with measured contrast:**

| Token | Source | Applied to | Contrast |
|---|---|---|---|
| `--surface-default` | slate.0 | Card, field, panel — the reading plane | — |
| `--surface-sunken` | slate.50 | Page ground, well, read-only field | — |
| `--text-default` | slate.900 | Labels, values, headings | 16.4:1 |
| `--text-body` | slate.700 | Help text, prose, message bodies | 10.3:1 |
| `--text-muted` | slate.500 | Captions, units, metadata — never sole carrier | 5.1:1 |
| `--border-default` | slate.200 | Card edge, divider, table rule | 1.4:1 |
| `--border-strong` | slate.400 | Input at rest — a field must look enterable | 3.1:1 |
| `--border-focus` | pine.600 + pine.200 | Two-layer ring, legible on every surface | 5.9:1 |
| `--accent` | pine.600 | Primary action, active nav | 5.9:1 |

| Role | Applied to |
|---|---|
| `surface` / `surface.raised` / `surface.sunken` | Page, card, panel, well |
| `text.default` / `text.muted` / `text.on-accent` | Content hierarchy |
| `border.default` / `border.strong` / `border.focus` | Separation and focus |
| `accent` | Primary action, active state — exactly one accent |
| `state.ok` · `state.attention` · `state.warning` · `state.error` · `state.reasoned` · `state.neutral` | The eight disclosure states of §6.4, mapped onto six roles |
| `state.pending` | Asynchronous work in flight — export, payment, reconciliation |

**UX-81** `state.reasoned` — covering `not_available`, `not_material` and `nil_return` — shall be visually distinct from both `ok` and `missing`. A reasoned gap is neither a completed answer nor an omission, and conflating it with either misrepresents the report.

### 11.4 Responsive strategy and density

Breakpoint names and capabilities are in §3.3.

**UX-75** The design target is `wide`. `medium` shall be a complete, non-degraded implementation of the same tasks. `compact` shall guarantee reading, reviewing, notification handling, approval and payment — the tasks an owner performs away from a desk — and shall present sustained data entry as possible but not optimised.

**UX-76** No task shall be *unavailable* at `compact` without an explicit statement of why and what device to use. Silent hiding of functionality by viewport is prohibited.

**UX-77** The administrative console targets `wide` and `extra` only, and shall state this rather than degrading (§12).

**Density.** Two density modes sharing one token set: **comfortable** (tenant default — infrequent users, high stakes per field) and **compact** (admin queues — trained operators, high volume). No third mode, and no per-user density switching at MVP.

### 11.5 Component inventory

The contract a component library must satisfy. Each entry requires every applicable state from §8.1. **Every specimen is rendered in every variant and state in `design/screens/EasyESG Components.dc.html`**, which is the reference for anything ambiguous below.

Six additions the delivered set makes to this inventory, each recorded because it is a decision rather than a detail:

- **Buttons are four variants and there is no fifth** — primary, secondary, ghost, destructive. Minimum target 24×24 everywhere, and 40 px height on anything a first-time user must hit (WCAG 2.2 Target Size, NFR-75).
- **A field at rest uses `--border-strong`, not `--border-default`** — a field must look enterable. This is the single most repeated mistake in enterprise form design and it is a token-level decision, not a per-component one.
- **Nothing in Feedback ships with fewer than three parts** — what happened, so what, and what now. Toasts confirm the *user's own* action; anything the *system* decided gets an inline message or banner.
- **The reporting-period picker is its own component**, separate from the date picker: reporting periods are the one place where a wrong date is expensive and invisible.
- **The reference sheet's library column binds only where the library is already pinned** — decided 26 Aug 2026 (project owner), on task 26.4's component review. `EasyESG Components.dc.html` names a shadcn/ui file and a Radix primitive under each entry ("the library supplies behaviour, focus management and ARIA; the values here supply the identity"), and this repository pins **Radix** but never shadcn/ui, `cva` or TanStack Table. So the sheet is authoritative for **anatomy, states and tokens** — which is all the sentence above it claims — and its library column is a note on how the specimen was built, *except* for Radix, which the delivered set adopts wherever the sheet names it. Select is Radix Select; the consequence dialogue is Radix AlertDialog; the data table stays hand-authored until a screen needs a column model.

  The reason is not fidelity to the sheet. **Every floating surface must live in one stacking world.** A native modal `<dialog>` occupies the browser's top layer while a Radix menu portals to `document.body`, so a select inside a native dialogue renders *behind its own backdrop* — a defect invisible until the two are composed, which UX-47's export dialogue (format and language, both chosen inside a dialogue) is the first screen to do. Choosing one world removes the bug class instead of the bug. The cost is paid knowingly: the platform's own top layer, `inert` background and `::backdrop` are better than any JS reimplementation of them, and are given up so that menus, tooltips, popovers, comboboxes and date pickers all compose with dialogues by construction.

- **A control carries a *tone* beside its variant, and the two are orthogonal** — added 4 Sep 2026 with task 74.1's public chrome. The variant says what the action **is**; the tone says what surface it is **on**. This is not a fifth button variant and the bullet above stands unamended: `--accent` is `--pine-600` and both dark bands are `--pine-800`, so a primary button on the chrome band sits at about 1.4:1 and the pairing has to **invert** rather than dim. `LanguageSwitcher` had already reached this answer alone (`SWITCHER_TONE`, task 20's dark Focus header); `Button` now shares the word rather than inventing a second one for it, and the tokens are tier 3 (`--button-band-*`) so UX-79's "re-skinning edits tier 1 only" survives.

  **Navigation's *Global bar* row serves both chromes, and there is no second band.** §4.2 describes the authenticated tier and §5.1b the public one, and neither names a component; UX-89's test for an inventory addition is a difference in **anatomy**, and there is none — brand at one end, actions at the other, one row, with the bar's own documented empty state (no organization plate) being exactly what an unauthenticated screen renders. Two differences are real and are the caller's, not the band's: the public actions slot holds three nodes where the authenticated corner holds one, so it wraps at the 390 frame where the authenticated band must not; and the section nav the marketing prototype draws arrives with the sections it points at (`task.md` task 74.3), which is the point at which this row should be re-read rather than assumed.

**Domain components** exist in no library and each owns its own state machine: **disclosure field** (the most-repeated component in the product — label, help text, input, unit, state marker, reason capture, prior-period value, carry-forward action, change-history entry point) · **module card** · **wizard shell** · **validation panel** · **completeness meter**, which reports resolved / reasoned / outstanding and **never a single percentage** · **carbon calculator row** (invoice quantity in the user's own unit → derived tonnes CO₂e, factor set, override).

**Five system states** the inventory must carry beyond the disclosure states of §6.4: loading, partial, pending, offline, success. No loading affordance appears below 300 ms; skeletons match the final layout; spinners are only for indeterminate waits with no known shape.

**Primitives** — Button (primary · secondary · subtle · destructive) · Link · Icon · Badge · Tag · Avatar · Divider · Skeleton · Spinner · Progress · Tooltip · Popover.

**Form controls** — Text · Textarea · Number-with-unit · Select · Combobox · Multi-select · Radio group · Checkbox · Switch · Date · Date range · Currency · File upload · Fieldset · Form-level error summary · **One-time code**.

**One-time code was added 26 Aug 2026** (task 27.4), and it is the first true addition to this enumeration rather than a variant of something already in it — which is what UX-89 means by *an addition to the inventory, reviewed once and reused*. The A-01 artboard draws it as six cells; S-01's second-factor step (UC-194) is its second consumer, and a one-off in either screen would be the defect UX-89 names.

**It is one input painted to look like several, and that is UX-108 rather than a preference.** Accessible Authentication requires paste and password managers to work everywhere, and the platform's own autofill — the code an authenticator sheet offers, and what a browser fills from an SMS — targets a *single* field carrying `autocomplete="one-time-code"`. Six inputs, which is how this control is usually built, defeat all of it: autofill has no single target, a paste lands in one cell, and a screen reader announces six unlabelled fields where there is one question. The cells are presentation, hidden from assistive technology, painted from the value.

**The code-window countdown the artboard draws beside the label is a slot, not part of the control.** Its two consumers time different things — a 30-second TOTP step on A-01, and the five-minute challenge of `architecture.md` §12.5.6's task-27.3 row on S-01 — so a timer inside the component would count a window it cannot know, and every consumer would inherit a per-second re-render of a shared control.

**Feedback** — Inline field message · Callout (info · attention · warning · error · success) · Banner (persistent, page-level) · Toast (UX-67) · Empty state · Error state · Confirmation dialogue · Consequence dialogue (§6.14).

**Navigation** — Global bar · Organization switcher · Workspace nav · Wizard step list · Tabs · Breadcrumb · Pagination · Back-to-context control.

**Data display** — Data table (sortable, filterable, selectable) · Definition list · Key figure · Comparison table · Timeline / history list · Status chip · Chart (admin only at MVP).

**Domain components** — the ones that carry the product:

| Component | Defined in | Notes |
|---|---|---|
| Disclosure field | §6.2 | The atomic unit; every variant shares one anatomy |
| Module card / step | §6.1, §6.4 | Carries the roll-up state including *reasoned* |
| Validation finding | §6.4 | Always a link to the field |
| Save-state indicator | §6.7 | Text-labelled, announced on change |
| Comparative cell | §6.6 | Prior value + carry-forward action + carried marker |
| Calculation trace | §6.8 | Input → conversion → factor version → result |
| Override marker | §6.8 | Attribution + superseded value |
| Entitlement gate | §6.10 | Limit, allowance, consumption, path |
| Consequence list | §6.10, §6.14 | Names affected objects before commit |
| Payment rail selector | §6.11 | Availability with reasons |
| Money summary | §6.11 | Net · VAT rate and basis · gross · currency |
| Notification item | §6.12 | Category, subject link, read state |
| Version pin indicator | §6.9 | Taxonomy / template / factor-set version in force |
| Provenance chip | §6.13 | Who, when, from where |

**UX-89** No screen shall introduce a one-off component. A need not met by this inventory is an addition to the inventory, reviewed once and reused.

### 11.6 Typography, space, shape, elevation, iconography, motion

**UX-82** Type shall be specified as a **role scale**, not a font list. Any typeface satisfying §9.5, §10 and UX-84 may be substituted. The delivered families are **Onest** (weights 400/500/600/700) for text and **IBM Plex Mono** (400/500) for identifiers, token names, payment references and code, both self-hosted.

| Role | Spec |
|---|---|
| `display` | Onest 600 · 40/44 · −0.02em |
| `heading.1` | Onest 600 · 28/34 |
| `heading.2` | Onest 600 · 21/26 |
| `heading.3` | Onest 600 · 17/22 |
| `body` | Onest 400 · 15/24 · max 68ch |
| `body.strong` | Onest 600 · 15/24 |
| `label` | Onest 600 · 14/20 |
| `caption` | Onest 400 · 13/19 |
| `numeric` | Onest 500 · 19/26 · **tabular lining figures** |
| `code` | IBM Plex Mono 400 · 14/22 |

**UX-83** A **tabular-lining numeric** treatment shall be used for every quantity, figure, money amount and identifier, so that columns align and digits do not shift between states.

**UX-84** The typeface shall carry complete Romanian diacritics (ș, ț with **comma-below**, not the Turkish cedilla forms, plus ă, â, î) and **full Cyrillic** coverage. A typeface substituting cedillas is disqualified regardless of appearance — Romanian readers see it immediately. **Now unconditional**: the locale question it was contingent on is closed at three live locales (§9.1, OQ-1). The realistic failure is not typeface choice but **font subsetting silently dropping Cyrillic**, which passes English review unnoticed; the self-hosted subsets are verified for both scripts at Phase 0, not at the end.

**UX-85** Spacing shall derive from a single 4px-based scale; **arbitrary values are prohibited**.

`--space-1 2` · `--space-2 4` · `--space-3 8` · `--space-4 12` · `--space-5 16` · `--space-6 24` · `--space-7 32` · `--space-8 48` · `--space-9 64` · `--space-10 96`

The two densities of §11.4 come from this one scale, differing only in which steps they choose — **comfortable** is the tenant default, **compact** belongs to the admin queues. Radius: `--radius-1 3px` inputs, chips, markers · `--radius-2 6px` cards and panels · `--radius-3 10px` dialogues · `--radius-pill` status chips only. **Nothing is rounder than a dialogue.**

**UX-86** Elevation shall carry meaning — **transience, not importance** — and never decoration. Exactly three levels: `--elevation-0` flat, for content, so **a card does not float**; `--elevation-1` `0 1px 2px rgba(22,27,32,.06), 0 2px 6px rgba(22,27,32,.05)` for popover and sticky bar; `--elevation-2` `0 4px 12px rgba(22,27,32,.10), 0 12px 32px rgba(22,27,32,.10)` for dialogues and re-authentication.

**UX-87** Icons shall be a single coherent set, shall never appear without an accessible name, and shall never be the sole carrier of meaning for state or action.

**UX-88** Motion shall be functional only: state transitions, entry and exit of transient surfaces, and progress. Nothing essential shall be conveyed by animation alone, and `prefers-reduced-motion` drops every motion to an instant state change. Four durations and **one curve**, which are the only permitted values: `--motion-instant 80ms` hover, focus, checkbox · `--motion-quick 160ms` toast, tooltip, inline message · `--motion-panel 240ms` validation panel, dialogue, applicability change · `--motion-ease cubic-bezier(.2, 0, .2, 1)` — no bounce, no overshoot.

**All values above are reproduced from `design/tokens.css`, which is authoritative.** UX-87's icon set is the one remaining placeholder — the prototypes use text glyphs (`✓ ! ≠ × — ⊘ 0`) where a real set belongs; pick one coherent set at 20 px and 24 px on a 24 px box, each with an accessible name, none the sole carrier of state or action. Illustration and photography are likewise placeholders and nothing in the set depends on imagery.

### 11.7 National baseline — the Unified Design Model (MUD)

| | |
|---|---|
| **Name** | *Modelul Unitar de Design* (MUD) — the Unified Design Model |
| **Owner** | Agenția de Guvernare Electronică (AGE) |
| **Legal basis** | Government Decision **HG 677/2025**, and AGE Director Order 3005-094 of 29 October 2025 |
| **Launched** | 11 November 2025 |
| **Location** | `https://mud.egov.md` · contact `design@egov.md` |
| **Structure** | Scop și Principii · **Fundamente** (colour, typography, spacing, icons, base styles) · **Componente** · **Șabloane și Modele** |
| **Accessibility baseline** | WCAG **2.1** |
| **Documentation language** | Romanian |
| **Licence** | **CC BY-NC-ND 4.0** — attribution, **non-commercial**, **no derivatives** |
| **Binding on** | Mandatory for service providers and specialised central public authorities building electronic platforms, services and official websites, under the State Information Resources Coordination Methodology. Voluntary for other public bodies. |

Under the private-SaaS posture recorded in *Private Monetization Architecture*, this platform is a commercial product and MUD is **not binding on it**. Two facts nonetheless make MUD a first-class design input: the public-sector deployment is an explicit target (a ministry-operated national platform repositioned as a future Licensee/Enterprise customer, at which point MUD conformance becomes a procurement precondition); and familiarity is a usability asset, since the target user has already used MPass, MSign and the `servicii.gov.md` portal.

The licence is a real constraint. CC BY-NC-ND 4.0 prohibits both commercial use and derivative works, so a commercial SaaS cannot lawfully ship MUD's foundations, components or assets — nor a modified version of them — on the strength of the public licence alone.

**UX-129** The platform shall be designed to be **MUD-compatible without being MUD-dependent**. MUD shall be treatable as an alternative theme and component mapping applied at tier 1 and tier 3 of the token architecture (§11.2), never as an assumption baked into layout, component contracts or interaction patterns.

**UX-130** The design system shall maintain a **MUD mapping table** — platform component → nearest MUD component, with divergences and their reasons recorded. The table is a deliverable (§13.5) and is reviewed whenever MUD publishes a new version.

**UX-131** MUD assets, components, foundations and derivative works **shall not be incorporated into the commercial product** without written licensing clearance from AGE beyond CC BY-NC-ND 4.0. Until such clearance exists, MUD informs *convention* — naming, structure, interaction expectations — and contributes no code, no asset and no token value. Obtaining a position from AGE on commercial and public-deployment licensing is an open action, owned outside the design team (OQ-3).

**UX-132** Where a public-sector deployment is in scope, MUD conformance shall be satisfied by swapping the theme and the component mapping — not by redesigning screens, flows or content. §4.4, §4.6, §6 and §8.1 are theme-independent by construction and shall remain so.

**UX-133** MUD's WCAG 2.1 baseline shall be treated as a **floor, not a target**. This specification holds WCAG 2.2 AA (§10), which is a superset; a MUD-themed deployment inherits the higher standard and shall not regress to 2.1.

**UX-134** MUD documentation is Romanian-only. Any MUD-derived convention adopted here shall be restated in this specification's own terms and translated into all live locales, so that no design obligation exists solely in a document the delivery team may not be able to read.

**Second theme.** The second theme required by UX-79 shall be a **MUD-approximating theme** built from MUD's publicly previewable foundations, converting an abstract portability claim into standing evidence for a public-sector tender.

### 11.8 The generated document as a design surface

The PDF is what a bank, buyer or auditor reads. It is a designed artefact, not a print of the screen.

**UX-117** The document shall have its own layout and typographic system, sharing tokens with the interface but not its layout: a cover carrying entity, period, module scope, taxonomy version and generation date; a contents list; one section per module in standard order; indicator tables with comparatives; and a provenance page naming template version, taxonomy version, factor-set version and generating user.

**UX-118** Print structure shall be controlled explicitly — page breaks, running headers, page counters, table header repetition, orphan and widow control, and no table split that separates a figure from its unit.

**UX-119** Gaps shall be marked visibly and consistently: `not available` with its stated reason, `not material` with its rationale, and unresolved findings shown rather than omitted (UC-42, UX-25). A reader shall never be unable to tell the difference between a zero, a gap and an omission.

**UX-120** Structure shall be tagged for accessibility — reading order, heading levels, table header scope, alternative text, artefact marking — and validated against PDF/UA-1 and PDF/A-2a in the export regression suite.

**UX-121** The document shall be legible in monochrome print. No state, emphasis or distinction shall depend on colour.

**UX-122** The Excel export preserves the official EFRAG template's own presentation exactly; the platform contributes values and nothing else. Its only design surface is the interface that produces it (§6.9).

---

## 12. Administrative interface specifics

Same tokens, same primitives, deliberately different composition.

### 12.1 Divergence from the tenant surface

| Dimension | Tenant | Admin |
|---|---|---|
| Density | Comfortable | Compact (§11.4) |
| Primary archetype | Wizard | Exception queue |
| Input model | Pointer-first, guided | Keyboard-first, bulk-capable |
| Expertise assumed | None | High |
| Viewport support | compact → extra | wide and extra only (UX-77) |

### 12.2 The blast-radius pattern

**UX-123** Every operation with cross-tenant blast radius — content publication, taxonomy migration, factor-set update, plan version change — shall follow one pattern: **preview → scope disclosure (how many organizations, how many reports) → confirm → progress → result → one-step revert or documented compensation** (UC-72, UC-78, UC-80, UC-92).

This pattern governs A-03, A-04, A-05, A-09 and A-17.

### 12.3 Support access

**UX-124** Support access to tenant content shall require a stated reason and a ticket reference, shall display its own expiry countdown while active, and shall be visibly logged (UC-85, UC-86). The console shall make it evident that the access is observed.

### 12.4 Exception queues as financial assertions

**UX-125** Exception queues shall require a rationale on every manual resolution — unmatched payment, manual mark-paid, write-off, refund — because each is a financial assertion (UC-139, UC-140, UC-144).

This governs A-10, A-11, A-13 and A-14.

### 12.5 The append-only ledger

**UX-126** The billing audit ledger shall be presented as append-only: entries are superseded, never edited, and the interface shall offer no affordance that implies otherwise (UC-163).

---

## 13. Traceability: screen ↔ use case ↔ functional requirement

### 13.1 Screen ↔ use case ↔ FR matrix

Use case citations reproduce the *Serves* column of §4.4 verbatim. FR citations are resolved from the `Source UC` column of the FR register; all lie within `FR-1 … FR-173`.

**Four rows cite no FR, and the dash is a record rather than an omission.** S-29, S-30, S-31 and S-34 serve UC-177, UC-178, UC-179 and UC-182, which originate no functional requirement — `functional_requirements.md` §9.4 **G-9** records that as a real gap, deliberately not closed by inventing numbers outside the MVP block, with the acceptance criteria living in §5.1b of this document instead. S-30's obligation is discharged non-functionally by NFR-5, for which G-4 is the precedent. *(The six public-tier rows were added 25 Aug 2026: they entered §4.4 with §5.1b on 24 Aug and this table was not updated in the same edit.)*

| Screen | Name | Actors | Use cases | Functional requirements |
|---|---|---|---|---|
| S-01 | Sign in / register / provider choice | CA | UC-01 … 05, UC-194, UC-195 | FR-1, FR-2, FR-4, FR-82, NFR-95 |
| S-02 | Verify email · reset password · set password | CA | UC-03, 08, 09 | FR-3, FR-6 |
| S-03 | Accept invitation | CA | UC-15 | FR-11 |
| S-04 | Create organization | OA | UC-49 | FR-13, FR-14 |
| S-05 | Home / organization overview | all | UC-16, 67 | FR-12, FR-23 |
| S-06 | Reports index | RC, OA | UC-17 | FR-25 |
| S-07 | Report wizard — module step | RC | UC-18 … 31, 37, 45, 46 | FR-24, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-37, FR-38, FR-39, FR-40, FR-46, FR-47 |
| S-08 | Validation panel (in-wizard, persistent) | RC | UC-37 … 40 | FR-40, FR-41, FR-42, FR-43 |
| S-09 | Carbon calculator | RC | UC-32 … 34 | FR-33, FR-34, FR-35, FR-36 (consumes FR-71) |
| S-10 | Report preview | RC | UC-41 | FR-48 |
| S-11 | Export dialogue and history | RC | UC-42 … 44, 48 | FR-44, FR-49, FR-50, FR-51, FR-52, FR-53 |
| S-12 | Field change history | RC, OA | UC-47 | FR-54, FR-55 |
| S-13 | Entities index and entity record | OA | UC-52 … 55 | FR-17, FR-18, FR-19, FR-20 |
| S-14 | Reporting periods | OA | UC-56 … 58 | FR-21, FR-22, FR-45, FR-66 |
| S-15 | Organization profile and identifiers | OA | UC-50, 51 | FR-15, FR-16 |
| S-16 | Users & access | OA | UC-59 … 64, 175 | FR-56, FR-57, FR-58, FR-59, FR-60, FR-173 |
| S-17 | Plan, entitlements and usage | OA | UC-65, 66 | FR-90, FR-105 |
| S-18 | Plan comparison and selection | OA | UC-96 … 98 | FR-91, FR-92, FR-93 |
| S-19 | Order, summary and confirmation | OA | UC-110 … 115 | FR-108, FR-109, FR-110, FR-111, FR-112, FR-113 |
| S-20 | Payment hand-off and return | OA | UC-116 … 121 | FR-114, FR-115, FR-116, FR-117, FR-118, FR-119 |
| S-21 | Payment instruments | OA | UC-118, 119 | FR-117 |
| S-22 | Invoices and documents | OA | UC-132, 157 | FR-128, FR-146 |
| S-23 | Billing account | OA | UC-108 | FR-106, FR-107 |
| S-24 | Subscription status and history | OA | UC-99 … 107 | FR-90, FR-94, FR-95, FR-96, FR-97, FR-98 (consumes FR-103, FR-104) |
| S-25 | Enterprise request | OA | UC-153 | FR-142 |
| S-26 | Notification centre | CA | UC-165 … 167 | FR-160, FR-161, FR-162 |
| S-27 | Profile, language, notification preferences | CA, all | UC-13, 14, 168 | FR-9, FR-10, FR-163 |
| S-28 | Credentials and linked identities | CA | UC-10 … 12, UC-193 | FR-7, FR-8, NFR-95 |
| S-29 | Marketing home | VI | UC-177 | — (G-9) |
| S-30 | Legal documents (terms · privacy · cookies) | VI, all | UC-178 | — (G-9); NFR-5 is the obligation this screen discharges |
| S-31 | Cookie choice | VI | UC-179 | — (G-9) |
| S-32 | Help centre | VI, CA | UC-180 | FR-61 |
| S-33 | Help article | VI, CA | UC-181 | FR-61, FR-64 |
| S-34 | Write to support | VI, CA | UC-182 | — (G-9) |
| S-35 | Organization unavailable | CA | UC-16 (failure path) | FR-12 |
| A-01 | Admin sign-in (MFA) | PA, BO | UC-68 | FR-75 |
| A-02 | Organization register | PA | UC-69 | FR-76, FR-77 |
| A-03 | Content and translation console | PA | UC-71 … 74 | FR-61, FR-62, FR-63, FR-64, FR-74 |
| A-04 | Taxonomy versions, mappings, migration runs | PA | UC-75 … 79 | FR-65, FR-66, FR-67, FR-68, FR-69, FR-70 |
| A-05 | Factor sets, thresholds, validation rules | PA | UC-80 … 82 | FR-71, FR-72, FR-73, FR-74 |
| A-06 | Adoption metrics | PA | UC-83, 84 | FR-83 |
| A-07 | Support access request and audit log | PA | UC-85, 86 | FR-78, FR-79 |
| A-08 | Admin accounts and system audit log | PA | UC-87, 88 | FR-80, FR-81 |
| A-09 | Plan catalogue, entitlements, pricing, discounts | BO | UC-89 … 95 | FR-84, FR-85, FR-86, FR-87, FR-88, FR-89 |
| A-10 | Reconciliation workspace | BO | UC-137 … 140 | FR-131, FR-132, FR-133, FR-134 |
| A-11 | Collections and dunning | BO | UC-141 … 144 | FR-135, FR-136, FR-137, FR-138 |
| A-12 | Invoicing, credit notes, numbering series | BO | UC-126 … 136 | FR-121 … FR-130 |
| A-13 | e-Factura transmission exceptions | BO | UC-130 | FR-127 |
| A-14 | Refunds and chargebacks | BO | UC-145 … 147 | FR-139, FR-140, FR-141 |
| A-15 | Enterprise quotes and contracts | BO | UC-153 … 159 | FR-142, FR-143, FR-144, FR-145, FR-146, FR-147 |
| A-16 | Revenue, VAT export, billing audit ledger | BO | UC-160 … 164 | FR-148, FR-149, FR-150, FR-151, FR-152 |
| A-17 | Notification categories and templates | PA | UC-176 | FR-173 |
| A-18 | Identity provider configuration | PA | UC-70 | FR-82 |
| *(global tier)* | User menu — log out | CA | UC-06 | FR-5 |
| *(inline)* | Re-authentication over preserved context | CA | UC-07 | FR-5 |
| *(global tier)* | Organization switcher | CA | UC-16 | FR-12 |

### 13.2 Design rule group ↔ requirements discharged

Reproduced from the source specification's traceability table, including its own ordering. **Four FR ranges were corrected on 18 Aug 2026 against the FR register (OQ-9); the source's own values are shown struck through.** Remaining observations are noted in §13.3 rather than corrected here.

| Design area | Rules | Discharges |
|---|---|---|
| Surfaces and IA | UX-1 … UX-8 | UC-16, UC-67, ~~FR-56 … 60~~ → **FR-12, FR-23, FR-75**, NFR-16 |
| Report wizard | UX-9 … UX-13 | UC-17 … 31, NFR-8, NFR-76 |
| Disclosure field | UX-14 … UX-19 | UC-19 … 31, ~~FR-13 … 40~~ → **FR-24 … FR-32**, NFR-78 |
| Validation | UX-20 … UX-25 | UC-37 … 40, ~~FR-41 … 45~~ → **FR-40 … FR-44** |
| Applicability | UX-26 … UX-30 | UC-26, 28, 30, 81, ~~FR-46~~ → **FR-28** |
| Comparatives | UX-31 … UX-33 | UC-45, 46 |
| Draft integrity | UX-34 … UX-39 | UC-06, 07, 35, 36, NFR-40 |
| Calculator | UX-40 … UX-44 | UC-32 … 34, FR-33 … 36 |
| Preview and export | UX-45 … UX-49 | UC-41 … 44, 48, NFR-42, NFR-82 |
| Entitlement | UX-50 … UX-54 | UC-101, 142, 149 … 151, NFR-80 |
| Checkout | UX-55 … UX-60 | UC-110 … 121, NFR-74 |
| Notifications | UX-61 … UX-67 | UC-165 … 176, NFR-106 … 109 |
| Traceability | UX-68 … UX-69 | UC-47, 63 |
| Destructive actions | UX-70 … UX-72 | UC-57, 58, NFR-80 |
| Layout | UX-73 … UX-77 | NFR-8, NFR-77 |
| National baseline (MUD) | UX-129 … UX-134 | HG 677/2025, NFR-16, NFR-75, NFR-88; Licensee/Enterprise path (UC-153 … 159) |
| Foundations | UX-78 … UX-88 | NFR-16, NFR-75 |
| Components | UX-89 | NFR-88 |
| States | UX-90 | NFR-79 |
| Content | UX-91 … UX-98 | UC-71 … 74, NFR-23 … 25, NFR-78, NFR-79 |
| Accessibility | UX-99 … UX-114 | NFR-75, NFR-76, NFR-82 |
| Performance | UX-115 … UX-116 | NFR-38 … 46 |
| Document design | UX-117 … UX-122 | UC-42, 43, NFR-75, NFR-82 |
| Admin console | UX-123 … UX-126 | UC-68 … 88, 137 … 164, NFR-65 |
| Governance | UX-127 … UX-128 | NFR-85 … 89 |

### 13.3 Coverage observations

All identifiers cited in this document fall inside `UC-01` … `UC-182` (extended from `UC-176` on 25 Aug 2026: the public tier added UC-177 … UC-182 with the Visitor actor on 24 Aug, and this sentence was not amended with it), `FR-1` … `FR-173`, `NFR-1` … `NFR-105`, and `NFR-106` … `NFR-109` (ratified into `non_functional_requirements.md` §4.16, 18 Aug 2026). The following are consistency observations against the source's own citations, carried forward as open questions rather than silently corrected:

| Observation | Detail | Logged as |
|---|---|---|
| Two RC use cases have no screen in the inventory | UC-35 (autosave in-progress report data) and UC-36 (resume an in-progress report draft) are RC use cases discharged by the draft-integrity pattern (§6.7) inside S-07, but neither appears in any *Serves* column. UX-7 requires every human-actor use case to have a screen or a named global-tier pattern; the pattern exists, the inventory entry does not | OQ-5 |
| One OA use case has no screen | UC-122 (pay through the merchant-of-record checkout) is an OA use case, registered as an adapter and inactive at MVP (D-8, FR-114). No screen serves it, which is consistent with its inactivity but leaves UX-7 formally unmet | OQ-5 |
| ~~UC-16 is listed twice~~ | **Resolved** — split by behaviour: S-05 owns *view memberships*, the global-tier switcher owns *switch active organization* | OQ-6, closed |
| ~~§13.2 FR ranges do not align with the FR register in four rows~~ **Resolved — all four corrected in §13.2** | *Surfaces and IA* cites FR-56 … 60, which are the users-and-access requirements rather than IA. *Disclosure field* cites FR-13 … 40, which begins at organization creation rather than at report authoring (FR-24). *Validation* cites FR-41 … 45, whereas validation is FR-40 … FR-44 and FR-45 is a comparatives requirement. *Applicability* cites FR-46, which is the prior-period display requirement, whereas applicability is FR-28 | OQ-9 |
| ~~Two archetype labels are not among the nine~~ | **Resolved** — *Wizard sub-flow* (S-09) and *Comparison* (S-18) are compositions inheriting their base's full state set | OQ-7, closed |
| ~~One internal cross-reference does not resolve~~ | **Resolved** — UX-25 now cites UC-42, FR-44, BR-VAL-4; UX-122 stands on FR-50, FR-51, NFR-20 | OQ-8, closed |

### 13.4 Definition of done for a screen

A screen is complete when: every state in §8.1 is designed · every string is a content key, none hardcoded · the layout survives +40 % expansion in all live locales · keyboard path and focus order are specified · the accessible name of every control is specified · loading, error and permission behaviour are specified · every action is traceable to a use case · every message satisfies the three-part formula · behaviour is specified at all four breakpoints · dark scheme is verified.

**Review gates.**

| Gate | Checks |
|---|---|
| Design review | Archetype conformance, component reuse, state completeness, consequence disclosure |
| Content review | Reading level, three-part messages, glossary conformance, all live locales (NFR-78, NFR-79) |
| Accessibility review | §10, automated plus manual, before merge |
| Usability testing | ≥ 8 SME participants, before launch and on any wizard restructure (NFR-76) |
| Print review | §11.8, on every taxonomy or template version rollout |

### 13.5 Governance and governed artefacts

**UX-127** Tokens are the single source of truth, authored once and consumed identically by the tenant application, the admin console, the print layer and email. A value that exists only in a design file or only in code is a defect.

**UX-128** This specification is versioned alongside the FR/NFR registers. A change to a `UX-n` rule is an amendment recorded with its rationale, not a silent edit.

Artefacts this specification governs, **with their delivered locations as of 18 Aug 2026**: token set — `design/tokens.css`, graduating to `packages/ui/src/styles/` at Phase 0 (a second, MUD-approximating theme per §11.7 is still outstanding) · screen designs — `design/screens/`, fourteen hi-fi prototypes covering every screen in the §4.4 inventory at 1440/834/390 · component library with documented states · **MUD mapping table (UX-130)** · page archetype templates · screen designs per §4.4 and §5 · content and glossary sets per locale · print stylesheet and document templates · email templates · accessibility conformance record · usability test report.

---

## 14. Open questions

| ID | Question | Why it matters | Owner |
|---|---|---|---|
| OQ-1 | **Closed 18 Aug 2026 — three live locales: RO source, EN and RU separately authored.** Ratified into NFR-23 and FR-63 per `architecture.md` §17.1 / `non_functional_requirements.md` C-3. Russian is separately authored, never machine-translated. | Resolved, and all three dependencies are now in MVP scope: the Russian export caveat (UX-47, UX-98) ships, full Cyrillic typeface coverage is an MVP procurement constraint (UX-84), and the +40 % expansion budget is measured against Romanian as source across three locales. **Confirmed independently:** Russian is not an EU language and is not in EFRAG's official template or taxonomy label set, so the caveat pattern is factually correct as written — Russian VSME labels are platform-authored with no EFRAG standing. **The clause that followed — *"and NFR-24 applies to RO/EN only"* — was corrected 1 Sep 2026 (task 33.2): `ro`'s label linkbase in the published package is a stub, so NFR-24 binds EN alone and the caveat covers Romanian too** (T-14, UX-47, UX-98, `problem_overview.md` OQ-5, all as amended). | Requirements owner — decided. Also closed in `actors.md` OQ-9 and `non_functional_requirements.md` C-3 |
| OQ-2 | **Closed 18 Aug 2026 — the visual identity layer is delivered and §11 carries every value.** `design/tokens.css` is the single source of truth: pine accent ramp, cool slate neutrals, five state hues with a text-safe step and a tint each, the 4px space scale, four radii, three elevations, four motion durations and one curve, the Onest / IBM Plex Mono families with ten type roles, a two-layer focus ring, and — set in the same pass from standard conventions — the layout values UX-73 required: **`--content-max` 1200px, 12 fluid columns, gutter 24px at ≥1024 and 16px below**, all drawn from the existing space scale rather than invented. | Every `UX-n` rule in §11 is now verifiable against a value, and the second theme UX-79 requires can be produced because tier 1 is swappable. `packages/ui` can fix its layout primitive at Phase 0 without a screen inventing its own. **One placeholder remains and is not this question**: UX-87's icon set — the prototypes use text glyphs where a real set belongs. | Visual identity layer — delivered and complete |
| OQ-3 | **AGE's written position on licensing MUD** for (a) a commercial deployment and (b) a public-sector deployment of this platform. Until it exists, UX-131 stands and MUD contributes convention only — no code, no asset, no token value | Determines whether the MUD-approximating second theme can ship, and what "MUD conformance" costs in a public-sector tender | Owned outside the design team |
| OQ-4 | **Closed 18 Aug 2026 — the machine states (UC-37, FR-40) are canonical; the design states are presentation labels derived from them.** The mapping is declared once in `packages/contracts`. Reconciliation exposed that the eight design states span three axes, not one: six are field validation outcomes, `not_material` is section-level materiality (FR-41) and `nil_return` is answer semantics. See the resolved vocabulary note in §6.4. | Resolved. The component contract, the API and the test suite are written against one enum — `ValidationState` — and the two mis-filed states move to the axes that own them, which the flat list could not express simultaneously. | Requirements owner with design — decided |
| OQ-5 | **Closed 18 Aug 2026 — UX-7 gains two exhaustively enumerated exemption classes**, rather than the inventory gaining invented entries. *Pattern-discharged:* UC-35 and UC-36, inside S-07's draft-integrity pattern. *Inactive at MVP:* UC-122, per D-8/FR-114. | Resolved. The question offered exactly this choice and the exemption is the right half: UC-35 and UC-36 are continuous behaviours of a screen rather than destinations, so an inventory entry for them would make the inventory describe things that are not screens — weakening the coverage contract UX-7 exists to hold. Both lists are closed sets; adding to either is an amendment to UX-7. | Design — decided |
| OQ-6 | **Closed 18 Aug 2026 — split by behaviour, not assigned twice.** S-05 owns *view memberships* (screen content); the global-tier switcher owns *switch active organization* (a session-scope action available everywhere). | Resolved, and the double count is gone: a coverage audit counts UC-16 once, against two owners of two distinct behaviours. The apparent duplication was the use case's own name — "view memberships **and** switch active organization" — carrying two behaviours that genuinely live in different places. | Design — decided |
| OQ-7 | **Closed 18 Aug 2026 — they are compositions, not archetypes**, and the inheritance rule is now stated: a composition inherits the complete state set of its base and defines none of its own. *Wizard sub-flow* (S-09) composes Wizard; *Comparison* (S-18) composes Index/Status. | Resolved. UX-8 is satisfied because a composition has a full state definition, inherited. Promoting them to archetypes ten and eleven was rejected: it would put two names on one state set, which is the same defect OQ-4 found in the validation vocabulary. | Design — decided |
| OQ-8 | **Closed 18 Aug 2026 — the citation is corrected to the obligation it actually depends on.** UX-25 now cites **UC-42, FR-44 and BR-VAL-4** (export permitted with unresolved findings after explicit warning, gaps marked visibly). The source's "§15.4" was unresolvable — its §15 has no numbered subsections. | Resolved. Traceability from the normative rule to its obligation holds. UX-122's citation was checked in the same pass and needs no change — it stands on FR-50, FR-51 and NFR-20, which resolve. | Design — decided |
| OQ-9 | **Closed 18 Aug 2026 — all four corrected in §13.2**, with the source's values struck through rather than deleted. *Surfaces and IA* ~~FR-56 … 60~~ → **FR-12, FR-23, FR-75** (the FRs UC-16 and UC-67 actually discharge, plus the administrative-surface split). *Disclosure field* ~~FR-13 … 40~~ → **FR-24 … FR-32**. *Validation* ~~FR-41 … 45~~ → **FR-40 … FR-44**. *Applicability* ~~FR-46~~ → **FR-28**. | Resolved. The traceability table is what a reviewer uses to check that a design discharges its requirements, and three of the four wrong ranges would have produced a **false pass** — citing requirements the design does not discharge while omitting the ones it does. Ranges verified against `architecture.md` §17.5's component-to-FR map. | Design, with the requirements owner — decided |
| OQ-10 | **Closed 18 Aug 2026 — the screen designs exist.** `design/screens/` holds fourteen hi-fi prototypes covering the public site, identity, workspace, all eleven Basic modules and the nine Comprehensive ones, the calculator, organization admin, commerce, help centre, the 22-screen admin console and the exported document — each drawn at 1440 / 834 / 390. | Resolved. §5 is no longer a brief for artefacts that do not exist; the artefacts §13.5 declares governed are now delivered and version-controlled. Two standing caveats carried from the handoff: **icons are placeholders** (text glyphs stand in for a real set — UX-87) and **illustration and photography are placeholders**, with nothing in the set depending on imagery. The prototypes are inline-styled by an authoring constraint of their format; values are exact and are to be extracted through `packages/ui`, never copied as markup. **Their authority is over values, not over content or scope (added 26 Aug 2026, project owner, from task 26.4).** Where a prototype shows a capability §5's screen row does not list, or that no `FR` requires, **§5 and `functional_requirements.md` govern and the prototype is ahead of scope** — a prototype owns neither the scope boundary (`problem_overview.md`) nor what the system does (`functional_requirements.md`), and treating a drawn affordance as a requirement is how a screen acquires a data model nobody asked for. Such a capability becomes a real question only when someone writes the requirement. The worked example is S-16 below. | Design — delivered |
| OQ-11 | **Closed 18 Aug 2026 — ratified as NFR-106 … NFR-109** into `non_functional_requirements.md` §4.16: dispatch p95 ≤ 60 s; exponential retry bounded at 24 h with suppression on first hard bounce; ≥ 99% accepted transactional-mail delivery, SPF/DKIM/DMARC-aligned; delivery records retained for organization life + 1 year. | Resolved. The notification centre (S-26) and the email surface now have a latency to design for (60 s p95 governs whether the centre needs optimistic display), and a retention behaviour to expose (organization life + 1 year, readable independently of the centre itself). | Requirements owner — decided. Also closed in `use_cases.md` OQ-5, `functional_requirements.md` OQ-3, `non_functional_requirements.md` OQ-13 and `architecture.md` OQ-2 |
| OQ-12 | **Closed 24 Aug 2026 — the six screens are numbered `S-29 … S-34`, and the Visitor (`VI`) is an MVP actor with `UC-177 … UC-182`.** Decided by the project owner over the row's own two horns. | **Resolved, and neither horn was taken.** The row offered *identifiers plus a third UX-7 exemption class*, or *the inventory declaring the unauthenticated surface out of scope*. The first buys the screens their state sets and their coverage but weakens the rule; the second closes the register row while leaving §5 silent, so `task.md` tasks 74–77 would have stayed exactly as unstartable as before — it answers the question without solving what the question was blocking. Making the visitor an actor removes the need for an exemption at all: **UX-7 is unamended**, because these screens now trace to use cases like every other. Cost accepted and paid in the same change: `actors.md` gains VI in §3, §4, §5's matrix and §8; `use_cases.md` gains UC-177 … UC-182 and a Public tier module; `actors.md` §6.2 splits, keeping the *public disclosure portal reader* out of MVP (FR-174) while the *visitor* comes in — the two senses of "unauthenticated" that one sentence had been carrying. **What it surfaced:** three of the six fit none of §4.6's nine archetypes, which §4.6 makes an escalation rather than a licence to invent — now **OQ-17**. And two screens carry an open question rather than a mechanism: S-31's consent recording is OQ-16, S-34's support channel is `task.md` task 77. Neither is closed here | Design, with the requirements owner — decided |
| OQ-13 | **`compact`, `medium` and `extra` have no pixel values.** §3.3 gives four named breakpoints and exactly one number — the `wide` entry threshold of 1024 px — and says "values live in tokens". `tokens.css` contains no breakpoint tokens | **Open.** The three design frames (1440 / 834 / 390, UX-73) are the obvious candidates but are frames, not thresholds, and UX-76 prohibits silently hiding functionality by viewport — which is unverifiable without the boundaries. Needed at Phase 0, since every component built before it is settled encodes a guess |
| OQ-14 | **`tokens.css` ships no dark-scheme map.** UX-80 requires every semantic token to be defined for both schemes and to satisfy §10.2 contrast in both, "whether or not the toggle ships at MVP", and `IMPLEMENTATION_PLAN` Phase 0 lists the dark token map as deliverable 6 | **Open, and scheduled as `task.md` task 82** (26 Aug 2026, project owner, from task 26.4's batch). The file as delivered — now at `packages/ui/src/styles/tokens.css` — defines tier 1, tier 2 and tier 3 for light only. UX-80 states the cost of deferring: "retrofitting it after twenty screens is the expensive path". **It is not a question with two answers** — UX-80 already decided it — so what this row tracks is unbuilt work, and the decision taken was *when*: its own appended task rather than folded into a screen task, because it is tier 1/2 work across every token and the §10.2 contrast verification is the deliverable a component task would bury. Raised again on task 26.4, when seven new components doubled the styled surface at four live screens. Phase 0's exit check cannot pass until it exists |
| OQ-15 | **Closed 19 Aug 2026 — Lucide** (`lucide-react` **1.32.0**, pinned and rationalised in `architecture.md` §12.1). An ISC-licensed, stroke-consistent set drawn on a 24 px box — UX-87's geometry — rendered as React components that take an accessible name per instance, tree-shakeable so only used icons ship, and inheriting `currentColor` so the tier-2 semantic tokens stay the only colour authority (UX-78). Heroicons was declined for coverage (~300 icons runs out before the domain glyphs do); Phosphor for its six weights, which invite exactly the incoherence UX-87's "one coherent set" exists to prevent | Resolved. Phase 1 (component library) is no longer blocked on this question. The eight disclosure-state glyphs map to named Lucide icons during Phase 1 — UX-102's prohibition on shape-alone meaning governs each mapping — and the prototypes' text glyphs (`✓ ! ≠ × — ⊘ 0`) remain placeholders until that pass | Product owner with design — decided |
| OQ-16 | **The Register prototype captures more than S-01 specifies and the API accepts.** `EasyESG Identity.dc.html`'s Register artboard shows a *full name* field and a *Terms of Service / Privacy Notice consent* checkbox; §5's S-01 content list ("email address and password inputs") and the task-19 registration API (`RegisterAccountRequestDto`: email + password) have neither. The artboard also states a pre-OQ-51 password rule ("at least 10 characters"), superseded by the closed policy (`architecture.md` OQ-51: 8–128 characters, four classes) | **Open — raised 20 Aug 2026 while building task 20, which followed the documents:** the shipped screen captures email + password and displays the OQ-51 policy, per §1.5 precedence (a prototype is a rendered reference, never a normative source — OQ-10). What remains open is whether the *product* should capture a display name at registration and whether consent must be **recorded** rather than implied — the latter is a legal/compliance question that also touches the unnumbered legal screens (OQ-12) and would need an API and identity-schema change, not a screen change. Deciding it here in passing would have closed a legal question by UI default | Requirements owner with design; consent wording with legal |
| OQ-17 | **Closed 24 Aug 2026 — a tenth archetype, `Content`.** Raised and closed the same day: raised by OQ-12 putting six unauthenticated screens into the inventory, closed once it was established that the delivered prototypes already specify the template. | **Resolved.** Two things had to be separated to answer it. **UX-8 versus UX-90:** UX-8 requires an archetype to define its states before an instance is designed, and §4.6 gives each archetype Purpose, Fixed elements and Notes — **no archetype in this document carries a written state set**, and §5.0's second limit says the per-screen enumeration is "the checklist, not a design". So a states pass in the prototype is a **UX-90** obligation at implementation, owned by `task.md` tasks 74, 75 and 77, and never was a precondition of defining an archetype. Holding the tenth to a bar the nine do not meet was the error, corrected here. **The decision** — tenth row rather than a composition of *Document* — follows OQ-7's own test, applied in §4.6. **The evidence** is the delivered set (OQ-10): three widths of the marketing home, the legal set's shared layout with its tab strip, banner fragment and preferences panel, and the help centre in signed-in and guest variants. That is more than most of the nine were written from | Design — decided |
| OQ-18 | **How many legal documents does the platform publish — three or five?** `EasyESG Public Legal.dc.html`'s tab strip carries **five**: terms of service, privacy notice, cookies, **data processing agreement** and **sub-processors**. Every other source says three — `design/HANDOFF.md` describes the file as "01 Terms of service · 02 Privacy notice · 03 Cookie policy · 04 The cookie choice", `apps/web`'s `SiteFooter` has linked to exactly three since task 20, and S-30 above is written for three | **Open — surfaced 24 Aug 2026 while deriving the Content archetype from the prototypes.** Not resolved by reading the mockup: §1.5 makes a prototype a rendered reference and never a normative source (OQ-10), so five tabs are evidence that someone intended five, not a decision that there are. It matters because the two extra are not marketing pages — a **data processing agreement** is the Article 28 instrument a customer's own compliance function will ask for, and a **sub-processor list** is already named in `non_functional_requirements.md` §4.6 as a compliance artefact with a quarterly review (NFR-27). Publishing them is a commitment to maintaining them. Blocks the scope of S-30 and `task.md` task 75, and belongs with that task's batch | Requirements owner with legal |
| OQ-19 | **S-28's resting shape: the artboard draws summary rows with one trigger each; §5's row says "grouped fields".** `EasyESG Identity.dc.html` shows, at all three widths, *"Last changed 12 February 2026 from Chișinău"* beside a **Change password** button, *"! Off"* beside **Turn on**, and a closing callout stating why the last credential cannot be unlinked. The screen built by task 27.7 renders open forms instead, with one record-level re-authentication field. | **Open, and deliberately not closed by the refactor of 28 Aug 2026** — the project owner was offered the rebuild and chose the narrower fix, so what shipped is the duplicate-field defect corrected inside the existing shape. **The implementation is not simply wrong:** OQ-10 makes a prototype authoritative over *values*, not content or scope, and §5's own Layout row for S-28 reads "identity header, grouped fields, save/cancel affordance" — which is what was built, so the two sources disagree and §5 governs. Two things are genuinely unresolved. **The attribution** — *last changed … from Chișinău* is password state §5's Content row arguably does list, and no API read returns it, so rendering it is an API change rather than a screen change. **The closing callout** — the artboard tells the reader why the last credential cannot be removed *before* they try; the screen says it only as the API's refusal afterwards, which is a worse place to learn it. Rebuilding to the artboard additionally needs a disclosure component §11.5 does not carry, which UX-89 makes an inventory addition with all eleven §8.1 states designed first. Assumed meanwhile: grouped fields are correct, and §5 governs. | Design with the requirements owner |
| OQ-20 | **S-04's artboard draws five fields; UC-49, §5 and the API name three between them.** `EasyESG Workspace.dc.html` shows **Legal name · IDNO · VAT code · Primary activity (CAEM-2) · Reporting currency**, each with help text asserting behaviour — *"13 digits · state identification number"*, *"Determines which sector questions appear in your report"*, *"Changeable until the first figure is entered"*. UC-49's main success scenario step 1 reads *"legal name, country, contact details"*; §5's Content row for S-04 says the same three; `CreateOrganizationRequestDto` (task 29.1) accepts `name`, `countryCode`, `contactEmail`, `contactPhone`. **Country, which all three of those carry and which selects the legal-form vocabulary, is on none of the three artboards.** | **Closed 29 Aug 2026 (project owner) — §5 governs S-04, and neither extra field is admitted.** Three decisions, taken on the escalation rather than by building: **reporting currency is deferred with its assumption recorded** — the platform serves Moldova-resident SMEs and BR-INV-5 already makes MDL the ledger currency, so a per-organization *choice* buys nothing until a second currency exists, and any monetary disclosure is denominated MDL; **what must change if that is wrong** is C8, revenues from certain sectors (UC-190), and task 79.8 is where it becomes knowable. **Primary activity stays on the reporting entity** — FR-17 governs, S-04 collects none, and S-13 owns it; modelling it on the organization as well would give conditional applicability two sources that can disagree, and for a multi-entity organization the entity's answer is the correct one. **S-04 builds §5's four fields** — legal name, country, contact email, contact phone — with country rendered even though the vocabulary holds one entry at MVP, because it is data (AD-4), it selects the legal-form set and it prints on the report. The analysis that produced those answers follows. OQ-10 already settles precedence: a prototype is authoritative over *values*, never content or scope, so the screen would follow §5. What that does not settle is whether two of the extra fields are requirements nobody wrote down. **Two of the four are traceable elsewhere and are not this question:** VAT registration code is FR-106's, on the **billing account**, which that requirement makes *"distinct from the organization profile"*; and IDNO is FR-16's, which §5's own S-04 Validation row defers to S-15 — though `architecture.md` OQ-18's rationale argues the other way in passing, calling IDNO *"the only candidate that is actually populated for every organization **at signup**"*, so the two sources lean opposite ways and the artboard follows the rationale rather than the requirement. **Two are genuinely unowned. Primary activity:** sector-driven applicability is real — `problem_overview.md` names *"water sector-driven"* — but FR-17 puts NACE on the **reporting entity**, not the organization, and task 29.3 registered CAEM Rev.2 as country-scoped configuration for entities; the artboard asserts an organization-level activity drives report content, which no FR states. **Reporting currency:** it appears in **no document in the set**. Every currency in the requirements is billing's — FR-86 prices, FR-110 order totals, FR-129 the BNM rate, FR-150 MDL equivalents — and no Basic-module disclosure carries a monetary amount (UC-28's B10 is minimum-wage *compliance*, coverage and hours, with a pay **gap** as a percentage). The Comprehensive module is where one would bite: **C8 is revenues from certain sectors** (UC-190, task 79.8), and `problem_overview.md` OQ-12 brought C1–C9 into MVP scope. So the deadline is real — P-11 puts what is expensive to retrofit on day one, and task 78.1's scope flag lands with task 31. | Requirements owner with design; the currency half also touches `architecture.md` §7 before task 78 |

---

## 15. Appendix A — External references

| Reference | Bearing on this specification |
|---|---|
| Modelul Unitar de Design — AGE (`https://mud.egov.md/`) | The Moldovan state design system: foundations, components, templates and patterns. Governs §11.7. Contact `design@egov.md` |
| AGE launch announcement, 11 November 2025 | Establishes the legal basis (HG 677/2025, Order 3005-094 of 29 Oct 2025), the mandatory scope, the WCAG 2.1 baseline and the CC BY-NC-ND 4.0 licence |
| HG 677/2025 (legis.md) | The Government Decision implementing MUD. Authoritative text for who is bound and from when |
| IPN — common rules and a unified visual language for public institution websites | Confirms mandatory application to service providers and central public authorities, recommended for local institutions |
| eGov4Dev integration hub | Where MPass / MSign / MPay integration libraries and brand components live — relevant if a public-sector deployment ever replaces the platform's own identity or payment rails |
| WCAG 2.2 (W3C) · EN 301 549 v4.x | The accessibility standard this specification holds (§10), a superset of MUD's baseline |
| EFRAG VSME Digital Template and XBRL taxonomy | Source of element keys, official label translations and the Excel export's presentation (§6.9, §11.8) |
| Art. 33(3), Law 287/2017 | The filing deadline that produces the April–May seasonal load (§2.2) |

**Open action, owned outside design:** obtain AGE's written position on licensing MUD for (a) a commercial deployment and (b) a public-sector deployment of this platform. Until it exists, UX-131 stands and MUD contributes convention only (OQ-3).
