# ESG Platform — Non-Functional Requirements (MVP)

| Field | Value |
|---|---|
| Document ID | non_functional_requirements.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | "ESG Platform Non-Functional Requirements (MVP)" (primary); "ESG Platform Non-Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)" (primary); "ESG Platform Actors, Use Cases, FR and NFR (MVP)" section 4 (earlier combined statement — legacy NFR-1 … NFR-13, retained not superseded); "ESG Platform Functional Requirements (MVP)" and its Deferred Scope companion (referenced for `FR-n` resolution and reverse traceability); "ESG Platform Use Case Register (MVP)" (referenced for `UC-n` resolution); "ESG Platform Use Case Design Decisions and Constraints (MVP)" (referenced for `D-n` resolution) |

---

## 1. Purpose and scope

### 1.1 Purpose

This document is the canonical non-functional requirements specification for the ESG Platform MVP. It consolidates the dedicated Non-Functional Requirements register and its Deferred Scope, Coverage and Traceability companion into a single baseline that a delivery team can design, build and verify against, and that a reviewer can check for coverage against the functional register.

It restates existing requirements. It introduces none. Every requirement statement, threshold, verification method and citation below is carried from the source documents. Where a source requirement is unquantified, this document says so explicitly — the metric cell reads `— (unquantified in source)` — and the missing value is logged in section 10 rather than supplied here. No threshold, latency, percentage, retention period or service level appears below that is not present in a source.

### 1.2 What a non-functional requirement is here

A non-functional requirement states a quality the system must exhibit rather than a capability it must provide. It is the complement of a functional requirement: a functional requirement says what the system does, a non-functional requirement says how well, how fast, how safely, and under what conditions it must keep doing it.

The two are deliberately not in one-to-one correspondence and should not be forced into it. A single quality constrains many capabilities — the tenant-scoping rule in NFR-63 governs every read path in the system — and a single capability is frequently constrained by several qualities, because the ways a working feature can still be unacceptable are more numerous than the feature itself. Section 7 states where this deviation is intentional, so a reader checking coverage by counting rows does not read the difference as a gap.

### 1.3 Scope

In scope: the 93 MVP non-functional requirements NFR-1 … NFR-93; the scale envelope their thresholds are indexed to; the 12 deferred requirements NFR-94 … NFR-105; the coverage and traceability analysis; and the reading key for the legacy NFR-1 … NFR-13 set.

Out of scope, by explicit decision of the sources rather than by omission here:

| Not specified | Where it lives instead |
|---|---|
| Technology and vendor selection — no requirement names a database, cloud provider, payment processor or identity provider. NFR-11 and NFR-14 exist to keep those choices reversible, and naming one would defeat both. | "ESG Platform System Architecture (MVP)" |
| Contractual service levels — their exclusions, measurement window and credit schedule. NFR-48 states an engineering target; NFR-92 states the measurement that evidences it. | Commercial documents, held against FR-144 and the deferred NFR-97 |
| Cost and effort budgets. The single exception is NFR-47, the free-tier unit-cost ceiling, which is in the register because a freemium model with an unbounded marginal cost per free organization is an architectural failure rather than a budgeting one. | Commercial planning |
| Organisational process — incident response, on-call rotation, change advisory, security awareness training, and the regulatory-watch process itself. The register constrains what the system must make possible (NFR-85 the publication latency, NFR-91 the alert inventory), not who performs the work or on what rota. | Operating organization |
| Interface design — screen composition and field-level copy. NFR-75 … NFR-80 constrain the outcome: conformance level, task success rate, breakpoint behaviour, message structure. | `design_spec.md`, seeded by `moldova-guide/04_report_structure.md` and `moldova-guide/05_indicators.md` — project-knowledge documents outside this seven-document baseline |
| The compliance artefacts themselves — the data protection impact assessment, records of processing, sub-processor register and SAQ-A attestation. These are the evidence that NFR-5, NFR-27 and NFR-60 are met; the register requires them to exist and to be reviewed, and does not contain them. | Compliance function |

---

## 2. Conventions

### 2.1 Identifier scheme

| Prefix | Meaning | Authority |
|---|---|---|
| `NFR-n` | Non-functional requirement | This document. NFR-1 … NFR-93 are MVP (section 4); NFR-94 … NFR-105 are deferred (section 6) |
| `FR-n` | Functional requirement | "ESG Platform Functional Requirements (MVP)", FR-1 … FR-173, and its Deferred Scope companion |
| `UC-n` | Use case | "ESG Platform Use Case Register (MVP)" |
| `D-n` | Design decision | Section 1 of "ESG Platform Use Case Design Decisions and Constraints (MVP)", D-1 … D-14 |
| ▪ | Marks an NFR retained verbatim in meaning from the legacy combined statement (NFR-1 … NFR-13) | Section 8 |

Rules governing identifiers:

1. **NFR IDs are stable and are never reused or renumbered.** This is the deliberate difference from how the functional register treated its legacy set. The old FR IDs carried different meanings and were renumbered; the old NFR IDs carry the same meanings and are cited from eleven places inside the functional register, so they are **retained, not superseded**. A citation of `NFR-n` written before the dedicated register continues to mean exactly what it meant when written.
2. **The register is ordered by quality attribute, not by ID.** The ID sequence is therefore not monotonic: NFR-1 … NFR-13 appear inside the attribute groups they belong to, alongside the newer entries that quantify or decompose them.
3. **Legacy NFR-1 … NFR-13 are restated in normative form, not rewritten.** What changed between the legacy statement and the dedicated register is form, not content. Section 8 carries both readings verbatim.
4. **Deferred IDs continue the sequence rather than starting a parallel one**, so an ID promoted from deferred to build scope moves document without changing.
5. **Actor codes** are `CA` Common Access, `RC` Reporting Contributor, `OA` Organization Administrator, `PA` Platform Administrator, `BO` Billing Operator, `SYS` system-initiated. There is no `ACT-*` scheme in this project.
6. **The `FR-n` collision affecting section 6 citations is resolved (18 Aug 2026)** — the deferred functional set is renumbered FR-176 … FR-189, and the nine affected citations here are rewritten. See section 9, C-1.

### 2.2 Quality attribute taxonomy

The sources group the register into fifteen categories. Those category names are the taxonomy of record and are carried verbatim as the `###` headings of section 4. The grouping is a reading and estimating aid, not a system boundary, and category size is not a weighting for estimation, staffing or risk.

| § | Source category (verbatim) | Quality attribute it covers |
|---|---|---|
| 4.1 | Performance | Performance and responsiveness |
| 4.2 | Capacity & scalability | Scalability and capacity |
| 4.3 | Availability & continuity | Availability, reliability, backup and recovery, deployment |
| 4.4 | Integrity & reliability | Data integrity, idempotency, monetary and fiscal correctness |
| 4.5 | Security | Security |
| 4.6 | Data protection & privacy | Privacy and data protection (GDPR, Moldovan data-protection law), data retention |
| 4.7 | Auditability & assurance | Auditability and traceability |
| 4.8 | Usability & accessibility | Usability, accessibility, supportability of messages |
| 4.9 | Localization | Localization and internationalization |
| 4.10 | Standards conformance & data fidelity | Standards conformance (VSME, EFRAG taxonomy), data fidelity |
| 4.11 | Compatibility & interoperability | Interoperability, format and API conformance |
| 4.12 | Architecture & modularity | Configurability, extensibility, vendor substitutability |
| 4.13 | Maintainability & changeability | Maintainability, buildability, regression control |
| 4.14 | Observability & operability | Observability and operability |
| 4.15 | Fiscal & regulatory compliance | Legal, fiscal and regulatory compliance |

Two attribute groups conventional in an NFR taxonomy have **no separate source category**, and are not invented here:

- **Portability and deployment** is not a category. Its obligations sit inside other groups: NFR-53 (zero-downtime, reversible deployment) and NFR-52 (restorable backups) under Availability & continuity; NFR-89 (build and environment reproducibility) under Maintainability & changeability; NFR-27 (EU/EEA regions for every store) under Data protection & privacy. No source requirement addresses portability between hosting providers except NFR-72's obligation that fiscal documents be retrievable independently of the application, the database and the hosting provider.
- **Supportability** is not a category. Its obligations sit as NFR-66 (time-boxed, reasoned staff access grants) under Security, and NFR-78, NFR-79, NFR-80 (help text, message structure, destructive-action confirmation) under Usability & accessibility.

### 2.3 How each NFR is made measurable

Each requirement is stated in the normative form of ISO/IEC/IEEE 29148: a single "the system shall" obligation, one requirement per statement, quantified wherever a threshold applies, and paired with a verification method. Rationale is not carried in the requirement text; it resolves through the `D-n`, `FR-n` and `UC-n` citations.

Three conventions govern the `Metric / target` column:

1. **A stated threshold is carried verbatim.** Percentiles, latencies, percentages, retention periods and conformance levels appear exactly as the source states them, indexed to the scale envelope in section 3. If any scale-envelope figure moves by an order of magnitude, the affected thresholds are re-derived.
2. **An unquantified source requirement is marked, not filled in.** Twelve MVP register rows carry `— (unquantified in source)`. Two of them — NFR-8 and NFR-13 — are unquantified because they are umbrella statements decomposed rather than tested, which is deliberate and is not a defect. The remaining ten state an obligation whose threshold the sources leave open, typically as "the stated ceiling", "the stated delivery rate" or "the stated target completion time": **NFR-6** (AI retention period), **NFR-47** (free-tier cost ceiling), **NFR-64** (lockout threshold, token entropy and lifetime), **NFR-71** (e-Factura reconciliation tolerance), **NFR-76** (target completion time), **NFR-78** (reading level), **NFR-83** (deprecation window), **NFR-84** (delivery rate), **NFR-88** (coverage floor) and **NFR-91** (alert tolerances and lag thresholds, held as operational configuration). Each is logged in section 10. No number is supplied here.
3. **A configuration-held value is not fixed by the requirement.** Where a source holds a rate, ceiling, threshold or interval as effective-dated data (NFR-73, and the thresholds NFR-12 and NFR-85 govern), the measurable obligation is that the value is read from configuration and applied without a deployment, not that it equals any particular number.

Three requirements are **verified through another requirement** rather than by their own method — NFR-4 by NFR-25, NFR-7 by NFR-35, NFR-72 by NFR-36. In each case the higher-level requirement asserts a property the more specific one already tests exhaustively, and writing a second method would run the same evidence twice under two names. These are not unverified requirements; their verification is named once.

Three requirements are **umbrella statements decomposed rather than tested** — NFR-8, NFR-12 and NFR-13. They are not testable as written, are retained at their original IDs because they are cited from inside the functional register and from the design decisions, and what gets tested is the decomposition, never the umbrella.

### 2.4 Verification methods

| Code | Method | Meaning |
|---|---|---|
| **I** | Inspection | Review of a document, configuration, schema, log, attestation or content set |
| **A** | Analysis | Static analysis, a CI gate, a continuous production indicator, or a derived reconciliation |
| **D** | Demonstration | An exercise or rehearsal performed in staging or against production configuration |
| **T** | Test | An executable test, benchmark, load test, fault injection or independent penetration test |

Where a source names more than one method for one requirement, both are carried and separated by `·`.

### 2.5 Priority scheme

The sources use no MoSCoW scale and state **no intra-MVP priority ordering**. Priority is expressed solely as the phase tag, and it is carried verbatim.

| Phase tag | Meaning | MoSCoW reading |
|---|---|---|
| **MVP** | In MVP scope. All 93 requirements in section 4 carry this tag. | Must |
| **P2** | Deferred to Phase 2. Recorded because the MVP architecture is required not to block it. | Could (not this release) |
| **P2/P3** | Deferred, phase not yet fixed; sequencing is demand-driven on the MVP success metrics. | Could (not this release) |
| **P3** | Deferred to Phase 3. | Could (not this release) |

The absence of an intra-MVP ranking across 93 requirements is logged as OQ-11. It is a real planning gap: the sources state explicitly that category size is not a proxy for priority.

### 2.6 Register column meanings

| Column | Content |
|---|---|
| **NFR ID** | Stable identifier, verbatim. `▪` marks an ID retained from the legacy combined statement. |
| **Requirement** | The obligation, stated with "shall", carried verbatim from the NFR register. |
| **Metric / target** | The measurable threshold, extracted from the requirement statement and its verification method. `— (unquantified in source)` where the sources state none. |
| **Verification** | Method code and evidence, verbatim. `Verified by NFR-n` and `Decomposed into NFR-n` are carried as the sources state them. |
| **Pri** | Phase tag per section 2.5. |
| **Related FR / UC / D** | Citations carried verbatim from the requirement statement and its verification method. `—` where the source cites none; absence is not necessarily a coverage gap (see section 7.3). |

---

## 3. Scale envelope

Every threshold in section 4 is indexed to this envelope. It states year-one assumptions for a freemium, direct-to-SME Moldovan product (Model 1). If any figure moves by an order of magnitude, the affected thresholds are re-derived.

| Dimension | Assumption |
|---|---|
| Registered organizations | ≤ 2,000 |
| Users | ≤ 3,000; ≈ 1.5 per organization |
| Reporting entities | ≈ 1.2 per organization |
| Reports | ≤ 2,500 per annum |
| Concurrency, annual median | ≈ 15 concurrent sessions |
| Concurrency, filing-window peak | ≈ 150 concurrent sessions (10× median) |
| Export volume, peak | ≈ 200 generations per hour |
| Paying organizations | 100–200 (5–10% conversion) |
| Fiscal documents | ≈ 200 per month, essentially all in e-Factura scope (D-9) |
| Metering events | ≤ 50,000 per day at peak (FR-105) |
| Stored data | < 100 GB, excluding backups |
| Seasonality | Concentrated in the window following a 31 December fiscal year end — **April–May, peaking in the final two weeks of May** (Art. 33(3), Law 287/2017: 150 days after year end; the 120-day/30 April deadline applies only to public-interest entities, which are outside this population). VSME reporting is voluntary and has no deadline of its own, so this is a labelled proxy for the financial-statement date |

**The seasonality row is ratified.** NFR-44, NFR-48 and NFR-92 all key off that window — the load-test date, the tightened availability target and the error-budget review period respectively — and all three are now planned against April–May on the authority of Article 33(3) of Law 287/2017. The window is a labelled proxy for the financial-statement date rather than a VSME deadline, because VSME reporting is voluntary and carries no deadline of its own. The resolution is recorded in section 9, C-3, and closed at OQ-2; it reopens only if Moldova's draft sustainability-reporting law sets a date of its own.

---

## 4. NFR register by quality attribute

93 MVP non-functional requirements across 15 categories. NFR-1 … NFR-13 are retained from the legacy combined statement and restated in normative form; NFR-14 … NFR-93 are newly authored by the dedicated register. Distribution: Architecture & modularity 8, Standards conformance & data fidelity 7, Localization 5, Data protection & privacy 8, Auditability & assurance 5, Performance 7, Capacity & scalability 5, Availability & continuity 6, Integrity & reliability 6, Security 12, Fiscal & regulatory compliance 4, Usability & accessibility 6, Compatibility & interoperability 4, Maintainability & changeability 6, Observability & operability 4.

Security is the largest group because it is the area where a single unquantified statement — the legacy NFR-13 — hid the most independently failing obligations, not because it is the largest area of build effort. Fiscal & regulatory compliance is among the smallest yet carries the highest consequence of failure, since an untransmitted invoice or a gapped number series is a regulatory event rather than a defect.

### 4.1 Performance (NFR-37 … NFR-43)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-37 | The system shall respond to interactive read operations in p95 ≤ 300 ms and p99 ≤ 800 ms server-side at filing-window peak concurrency | p95 ≤ 300 ms; p99 ≤ 800 ms; measured server-side at filing-window peak concurrency (§3) | **T** load test at peak envelope · **A** continuous production SLI | MVP | — |
| NFR-38 | The system shall acknowledge an autosave in p95 ≤ 250 ms without blocking input, queuing unacknowledged changes locally for retry (FR-37, FR-38) | p95 ≤ 250 ms to acknowledge; input never blocked; unacknowledged changes queued locally and retried | **T** — instrumented client metric; offline-interruption test | MVP | FR-37, FR-38 |
| NFR-39 | The system shall complete full-report validation in p95 ≤ 2 s for a fully populated Basic Module report (FR-43) | p95 ≤ 2 s against the maximum-population fixture | **T** — benchmark against the maximum-population fixture | MVP | FR-43 |
| NFR-40 | The system shall complete carbon calculation across a full set of sites, sources and fuels in p95 ≤ 1 s (FR-34) | p95 ≤ 1 s across a full set of sites, sources and fuels | **T** — benchmark against the maximum-population fixture | MVP | FR-34 |
| NFR-41 | The system shall return an entitlement decision in p95 ≤ 20 ms, and in no more than 100 ms on a cache miss (FR-99) | p95 ≤ 20 ms; ≤ 100 ms on cache miss | **T** service benchmark · **A** production SLI | MVP | FR-99 |
| NFR-42 | The system shall complete PDF and Excel export in p95 ≤ 10 s, and shall execute asynchronously with progress indication and completion notification any generation projected beyond 30 s (FR-49, FR-50) | p95 ≤ 10 s; asynchronous execution with progress and completion notification above a projected 30 s | **T** — export benchmark at peak queue depth | MVP | FR-49, FR-50 |
| NFR-43 | The system shall achieve largest contentful paint ≤ 2.5 s and interaction-to-next-paint ≤ 200 ms at the 75th percentile on a 4G connection and mid-range device | LCP ≤ 2.5 s; INP ≤ 200 ms; at p75, on 4G and a mid-range device | **T** throttled synthetic runs in CI · **A** field metrics | MVP | NFR-8 (decomposition) |

### 4.2 Capacity and scalability (NFR-8 ▪, NFR-44 … NFR-47)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-8 ▪ | The system shall be responsive across devices and shall scale for usage spikes around the fiscal year-end reporting deadline | — (unquantified in source; umbrella statement conflating capacity with device usability) | Decomposed into NFR-44 (spike), NFR-43 and NFR-77 (devices) | MVP | — (no FR written against it — see 7.3) |
| NFR-44 | The system shall sustain 10× median concurrency within the NFR-37 … NFR-42 thresholds, scaling horizontally with no scheduled maintenance window | 10× median concurrency (≈ 150 sessions, §3) held within every NFR-37 … NFR-42 threshold; horizontal scaling; zero scheduled maintenance windows | **T** — 10× load test and 24-hour soak at 3× before each filing window | MVP | — |
| NFR-45 | The system shall accommodate 100× the scale-envelope data volume without redesign, introducing no append-only store without a partitioning and archival plan | 100× the §3 volumes without redesign; zero append-only stores lacking a partitioning and archival plan | **I** design gate per new store · **A** annual volume projection | MVP | — |
| NFR-46 | The system shall decouple export generation from the request tier by queue, confining the effect of an export burst to export latency | NFR-37 thresholds held while the export queue is flooded; export burst impact confined to export latency | **T** — fault injection flooding the export queue while measuring NFR-37 | MVP | NFR-37 |
| NFR-47 | The system shall keep marginal infrastructure cost per active free-tier organization below **€0.50 per active free-tier organization per month** (D-12) | ≤ €0.50 per active free-tier organization per month, attributed monthly. Functions as an alarm threshold rather than an operating constraint: at the 2,000-organization envelope it is €1,000/month, comfortably above a three-VM EU footprint plus object storage and mail | **A** — monthly per-organization cost attribution derived from metering events | MVP | D-12; FR-105 (metering stream). **Ratified 18 Aug 2026** (architecture.md §17.1). Closes OQ-3 |

### 4.3 Availability and continuity (NFR-48 … NFR-53)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-48 | The system shall achieve ≥ 99.5% monthly **application** availability outside the filing window and ≥ 99.9% within it, with announced maintenance capped at 4 hours per month outside the window and none within it. **Single-host infrastructure loss is excluded** and is bounded instead by a stated recovery time | ≥ 99.5% monthly outside the filing window; ≥ 99.9% within it, measured on application availability; announced maintenance ≤ 4 h per month outside the window; zero within it. Loss of `edge`, `redis` or VM-1 is out of scope of the percentage and in scope of the recovery-time objective | **A** — production availability SLI, monthly review · **D** — host-loss recovery rehearsed against the stated RTO | MVP | **Ratified 18 Aug 2026** (architecture.md §17.1). The three-VM topology buys durability, not uptime; the second application VM behind the CDN remains the standing alternative (architecture.md R-11, T-7, OQ-4) |
| NFR-49 | The system shall continue to serve UC-17 … UC-48 on cached entitlements when the billing context is unavailable, failing open for entitlements already granted and closed for new purchases (D-11) | UC-17 … UC-48 remain served with the billing context down; fail open for granted entitlements, closed for new purchases | **T** — chaos test disabling the billing context mid-session | MVP | D-11, UC-17 … UC-48 |
| NFR-50 | The system shall confine external-provider unavailability to the affected path, queuing the operation or offering an alternative rail, and shall lose no acknowledged customer action (D-8, D-9) | Impact confined to the affected path; operation queued or an alternative rail offered; zero loss of acknowledged customer actions | **T** — provider-outage simulation per adapter | MVP | D-8, D-9 |
| NFR-51 | The system shall meet a recovery point objective ≤ 15 minutes and recovery time objective ≤ 4 hours for the compliance core, and RPO = 0 for issued fiscal documents, payments and audit entries | Compliance core: RPO ≤ 15 min, RTO ≤ 4 h. Issued fiscal documents, payments, audit entries: RPO = 0 | **D** — restore drill measured against both objectives | MVP | — |
| NFR-52 | The system shall provide backups demonstrably restorable within the NFR-51 objectives | Restore completes within the NFR-51 objectives; rehearsal at least quarterly | **D** — full restore rehearsal at least quarterly | MVP | NFR-51 |
| NFR-53 | The system shall support zero-downtime, reversible deployment, admitting no schema change that cannot be reversed while the prior version runs and losing no data on rollback | Zero downtime on deploy; every schema change reversible while the prior version runs; zero data loss on rollback | **D** — rollback drill per release train | MVP | — |

### 4.4 Integrity and reliability (NFR-54 … NFR-59)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-54 | The system shall process payment callbacks, provider webhooks and e-Factura acknowledgements idempotently, converging on a single state under repeated, delayed or out-of-order delivery | Single converged state under repeated, delayed and out-of-order delivery, per adapter, under concurrency | **T** — replay, reorder and duplicate-delivery test per adapter under concurrency | MVP | — |
| NFR-55 | The system shall allocate fiscal document numbers gaplessly and sequentially per series per fiscal year under concurrent issuance and partial failure, consuming a number only on issuance (D-10, FR-123) | Zero gaps and zero duplicates per series per fiscal year, under concurrent issuance and induced mid-transaction failure; a number consumed only on issuance | **T** concurrency test with induced mid-transaction failure · **A** sequence audit for gaps and duplicates | MVP | D-10, FR-123 |
| NFR-56 | The system shall lose no acknowledged disclosure change under process failure, deployment or network interruption, acknowledging only after durable write (FR-37) | Zero loss of acknowledged disclosure changes; acknowledgement strictly after durable write | **T** — kill-during-write fault injection across the autosave path | MVP | FR-37 |
| NFR-57 | The system shall deliver metering events at least once and de-duplicate them on a stable event key, producing exact rather than approximate counters (FR-105) | At-least-once delivery with de-duplication on a stable event key; counters exact, not approximate | **A** — continuous reconciliation of the event stream against derived counters | MVP | FR-105 |
| NFR-58 | The system shall hold and compute monetary amounts as integer minor units or fixed-point decimals, and shall compute the MDL equivalent of a foreign-currency document once at issuance from the stored BNM rate (D-14, FR-129) | Zero floating-point monetary types; MDL equivalent computed exactly once, at issuance, from the stored BNM rate | **A** static analysis prohibiting float in monetary types · **T** property-based rounding and VAT tests | MVP | D-14, FR-129 |
| NFR-59 | The system shall apply an order, its payment, its fiscal document and its entitlement change as an all-or-nothing outcome reconciled by a durable outbox or saga, and shall surface residual inconsistency to the Billing Operator (NFR-15) | All-or-nothing across order, payment, fiscal document and entitlement change; residual inconsistency surfaced to `BO` and reported as an operational metric | **T** — fault injection at each step boundary; inconsistency count reported as an operational metric | MVP | NFR-15 |

### 4.5 Security (NFR-13 ▪, NFR-60 … NFR-70, NFR-95)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-13 ▪ | The system shall implement a security baseline of encryption in transit and at rest, role-based access control per organization and role, secure authentication and an authenticated API surface | — (unquantified in source; the legacy entry was a category label rather than a testable requirement) | Decomposed into NFR-60 … NFR-70 | MVP | FR-158 (cites NFR-13) |
| NFR-60 | The system shall neither transmit, process nor store card data, confining capture to the acquirer's hosted page or SDK and the platform to PCI DSS SAQ-A scope (D-7) | Zero card data transmitted, processed or stored; PCI DSS SAQ-A scope only; no platform-served PAN field | **I** — annual SAQ-A attestation; network and DOM review confirming no platform-served PAN field | MVP | D-7 |
| NFR-61 | The system shall enforce TLS 1.2 minimum with HSTS on external traffic, AES-256 or equivalent at rest across store, backups and exports, and key rotation at least annually and on personnel change | TLS 1.2 minimum with HSTS on all external traffic; AES-256 or equivalent at rest across store, backups and exports; key rotation at least annually and on every personnel change | **A** configuration scan · **I** rotation record | MVP | — |
| NFR-62 | The system shall evaluate authorization server-side on every request against the acting user's role in the active organization and their per-report rights, treating the interface layer as untrusted (FR-158) | Server-side authorization on 100% of requests; interface layer treated as untrusted; every endpoint exercised under every role, including revoked and cross-organization sessions | **T** — authorization suite exercising every endpoint under every role, including revoked and cross-organization sessions | MVP | FR-158 |
| NFR-63 | The system shall apply organization scoping at the data-access layer, structurally preventing cross-tenant access rather than filtering at call sites | Cross-tenant access structurally impossible; an unscoped query path fails the build | **T** — cross-tenant probe suite in CI; an unscoped query path fails the build | MVP | — |
| NFR-64 | The system shall rate-limit and lock out authentication paths, issue single-use, high-entropy, time-limited tokens, and return uniform responses irrespective of whether an account exists (FR-4, FR-6, FR-11) | Authentication paths rate-limited and locked out; tokens single-use, high-entropy and time-limited; responses uniform whether or not an account exists. Lockout threshold, token entropy and token lifetime: — (unquantified in source — see OQ-4) | **T** — abuse-path test suite; token entropy and lifetime review | MVP | FR-4, FR-6, FR-11 |
| NFR-65 | The system shall serve the administrative surface separately addressed, network-restricted and MFA-mandatory, sharing no session, cookie scope or credential with the tenant surface (D-5, FR-75) | Administrative surface separately addressed and network-restricted; MFA mandatory; zero shared session, cookie scope or credential with the tenant surface | **I** configuration review · **T** penetration-test scope item | MVP | D-5, FR-75 |
| NFR-66 | The system shall permit staff access to tenant report content only under an active, time-boxed, reasoned grant, and shall enforce its expiry automatically (D-5, FR-78) | Staff access to report content only under an active, time-boxed, reasoned grant; expiry enforced automatically without administrator action | **T** grant-expiry test · **I** monthly log review against ticket references | MVP | D-5, FR-78 |
| NFR-67 | The system shall carry no known critical vulnerability into a release, remediating critical findings within 7 days and high findings within 30 | Zero known critical vulnerabilities per release; critical findings remediated ≤ 7 days; high findings ≤ 30 days | **A** — software-composition-analysis gate in CI with an auditable exception process | MVP | — |
| NFR-68 | The system shall carry no unremediated penetration-test finding rated high or above into a release train | Zero unremediated findings rated high or above per release train; independent test before first paid launch and at least annually | **T** — independent test before first paid launch and at least annually, covering tenant isolation, the billing flow and the administrative surface | MVP | — |
| NFR-69 | The system shall hold secrets in a managed secret manager, scoped per environment and access-logged, with none present in source, container images or configuration artefacts | Zero secrets in source, container images or configuration artefacts; all secrets in a managed secret manager, scoped per environment and access-logged | **A** — secret scanning in CI and on the image registry | MVP | — |
| NFR-70 | The system shall neutralise user-entered text for its destination, admitting no formula injection into Excel exports, no markup or script injection into PDF or interface rendering, and no XML injection into e-Factura payloads | Zero formula injection into Excel; zero markup or script injection into PDF or interface rendering; zero XML injection into e-Factura payloads | **T** — injection corpus in the export regression suite covering all three destinations | MVP | — |
| NFR-95 | The system shall offer **opt-in TOTP** multi-factor authentication to ordinary tenant users, not enforced, and shall recommend it to Organization Administrators | TOTP enrolment available to every tenant user; enrolment prompted for Organization Administrators; no enforcement at MVP | **T** — enrolment, challenge and recovery-code paths per role | MVP | NFR-65 (PA MFA remains mandatory). **Ratified 18 Aug 2026** (architecture.md §17.1). **Promoted from the deferred register (§6.2) into MVP scope**, restated as opt-in rather than enforced. An OA can authorise payments and export the organization's full regulatory record; the identity model already supports TOTP, and the cost is a fraction of retrofitting after a first incident. Closes actors.md OQ-8 |

### 4.6 Data protection and privacy (NFR-5 ▪, NFR-6 ▪, NFR-27 … NFR-32)

Covers GDPR and Moldovan data-protection law. **The Moldovan instrument is Law No. 195/2024 on personal data protection**, which replaces Law No. 133/2011 and becomes applicable **23 August 2026**. Law 195/2024 substantially transposes Regulation (EU) 2016/679, so the GDPR-versus-Moldova divergences that drive retention and cross-border transfer decisions are far narrower than the register previously had to assume. Confirmed 18 Aug 2026; closes OQ-5.

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-5 ▪ | The system shall be hosted in the EU/EEA and operated in compliance with GDPR and **Moldovan Law No. 195/2024 on personal data protection** (applicable from 23 August 2026; replaces Law No. 133/2011) | Hosting within the EU/EEA; compliance with GDPR and Law 195/2024; records of processing maintained. No numeric target applies — this is a binary compliance obligation | **I** — annual compliance review; records of processing maintained | MVP | — (no FR written against it — see 7.3) |
| NFR-6 ▪ | The system shall submit no customer data to model training and shall apply a stated retention and deletion policy to every AI-assisted feature | Zero customer data submitted to model training; a stated retention and deletion policy applied to every AI-assisted feature. Retention period: — (unquantified in source; the policy itself is the artefact) | **I** — provider contractual terms and published policy, re-verified on provider change | MVP | Quantified only by the deferred NFR-102 (with FR-172, P3) |
| NFR-27 | The system shall hold all customer data at rest in EU/EEA regions — **wherever it rests and whoever holds it, sub-processors included** — at providers not subject to third-country access law, **relying on no adequacy decision and no standard contractual clauses** to place it there. The primary store, replicas, backups, generated exports and logs enumerate *where* data rests; they are not a closed list of *whose* systems are in scope | 100% of customer data at rest in EU/EEA regions across primary store, replicas, backups, generated exports and logs, and across every sub-processor holding customer data; zero reliance on an adequacy decision or on SCCs for data at rest | **A** region assertion in deployment checks · **I** quarterly sub-processor register review | MVP | NFR-5. **Amended 25 Aug 2026 (OQ-16)** — the enumeration is illustrative rather than exhaustive, and the no-transfer-mechanism position is stated here rather than left to `architecture.md` §12.5 to act on |
| NFR-28 | The system shall permit access, rectification, erasure and portability requests to be fulfilled within 30 calendar days, retaining a record of what was disclosed | Data subject requests fulfillable within 30 calendar days; a record of what was disclosed retained | **D** — annual runbook rehearsal against a seeded tenant | MVP | — |
| NFR-29 | The system shall retain statutorily required data on an erasure request — fiscal documents for six years, the disclosure audit trail for the life of the report — and shall report the retained categories to the requester | Fiscal documents retained 6 years; disclosure audit trail retained for the life of the report; retained categories reported to the requester | **D** — rehearsed alongside NFR-28 | MVP | NFR-28; FR-130 (statutory retention takes precedence over erasure) |
| NFR-30 | The system shall exclude personal data from application logs, error traces, metering events and analytics, using pseudonymous identifiers in those streams | Zero personal data in application logs, error traces, metering events and analytics; pseudonymous identifiers used throughout those streams | **A** — log scanning gate in CI and sampled scanning in production | MVP | — |
| NFR-31 | The system shall permit full customer data export in an open format irrespective of subscription state (D-13) | Full customer data export in an open format available in every subscription state, including lapsed | **D** — exit rehearsal performed from a lapsed tenant | MVP | D-13 |
| NFR-32 | The system shall hold no production customer data in non-production environments, anonymising any dataset copied downward | Zero production customer data in non-production environments; every downward dataset copy anonymised | **I** — environment audit at each release train | MVP | — |

### 4.7 Auditability and assurance (NFR-7 ▪, NFR-33 … NFR-36)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-7 ▪ | The system shall attribute every disclosure field change to a user with a timestamp (FR-54, FR-55) | 100% of disclosure field changes attributed to a user with a timestamp | Verified by NFR-35 | MVP | FR-54, FR-55 |
| NFR-33 | The system shall enforce append-only storage of audit and ledger records at database privilege level, permitting no UPDATE or DELETE from any application path (D-10, FR-151, FR-159) | Zero UPDATE and zero DELETE on audit and ledger records from any application path; enforcement at database privilege level, not in application code | **T** — attempted mutation fails at the store, not in application code | MVP | D-10, FR-151, FR-159 |
| NFR-34 | The system shall record timestamps in UTC to at least second precision from a clock synchronised to a stratum-2-or-better source, storing the originating timezone wherever a legal date is determined | UTC, precision ≥ 1 second; clock synchronised to a stratum-2-or-better source with drift alarm above 1 second; originating timezone stored wherever a legal date is determined | **A** — clock-drift monitoring with alarm above one second | MVP | — |
| NFR-35 | The system shall retain, for any reported figure, its input values, the rule and factor versions applied, and its full change history with actor and time (NFR-7) | Any reported figure independently reconstructible from stored inputs, rule and factor versions, and full change history with actor and time | **D** — independent reconstruction of a completed report before first launch | MVP | NFR-7; FR-33, FR-35 (stored inputs and factor-set version) |
| NFR-36 | The system shall retain fiscal documents and billing audit records for at least six years in a form readable independently of the application | ≥ 6 years retention; readable independently of the application; verified annually | **T** — annual restore-and-read from cold storage | MVP | Verifies NFR-72 |

### 4.8 Usability and accessibility (NFR-75 … NFR-80)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-75 | The system shall meet **WCAG 2.2 AA** on all tenant-facing screens and shall produce tagged PDF exports with a correct reading order | WCAG 2.2 AA on 100% of tenant-facing screens; PDF exports tagged with a correct reading order | **A** automated accessibility pass in CI · **T** manual keyboard and screen-reader audit of the wizard | MVP | **Ratified 18 Aug 2026** (architecture.md §17.1). Superset of 2.1 AA, aligned with EN 301 549 v4.x. The four additions that bite are Target Size (Minimum), Focus Appearance, Dragging Movements and **Accessible Authentication** — the last constrains the login path, so AD-12 and D-6's social sign-in are designed against it rather than audited against it later |
| NFR-76 | The system shall enable a user with no sustainability training to complete a first Basic Module report unaided, at ≥ 80% task success within the stated target completion time | ≥ 80% task success, unaided, by users with no sustainability training; sample ≥ 8 representative Moldovan SME participants. Target completion time: — (unquantified in source — see OQ-6) | **T** — moderated usability test with ≥ 8 representative Moldovan SME participants before launch and on any wizard restructure | MVP | — |
| NFR-77 | The system shall be fully operable at tablet width and fully readable and reviewable at phone width, with sustained data entry optimised for ≥ 1024 px (NFR-8) | Fully operable at tablet width; fully readable and reviewable at phone width; sustained data entry optimised for ≥ 1024 px | **T** — breakpoint review and task-based test of review-on-phone and entry-on-tablet | MVP | NFR-8 (decomposition) |
| NFR-78 | The system shall present field help text and validation messages at a plain-language reading level in every live locale, expressing what the standard requires (UC-72) | Plain-language reading level in every live locale, for field help text and validation messages. Reading level or index: — (unquantified in source — see OQ-7) | **I** — editorial review at every content publication | MVP | UC-72 |
| NFR-79 | The system shall state, in every error and system message, what failed, what the consequence is, and what action resolves it (UC-125) | All three elements present in 100% of error and system messages; no message ships without all three | **I** — message inventory review; no message ships without all three elements | MVP | UC-125 |
| NFR-80 | The system shall require explicit confirmation before any destructive or overwriting action, and shall disclose which content will become read-only before an entitlement reduction takes effect (D-13, FR-102, FR-103) | Explicit confirmation before 100% of destructive or overwriting actions; the affected content disclosed before an entitlement reduction takes effect | **I** — destructive-path inventory reviewed per release | MVP | D-13, FR-102, FR-103 |

### 4.9 Localization (NFR-4 ▪, NFR-23 … NFR-26)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-4 ▪ | The system shall impose no architectural limit on the number of supported locales (FR-63) | No architectural limit on locale count | Verified by NFR-25 | MVP | FR-63 |
| NFR-23 | The system shall hold Romanian as the source locale, with English **and Russian** as separately authored locales, neither a machine translation (UC-72) | Romanian as source locale; English and Russian each separately authored; zero machine-translated live content across three live locales | **I** — editorial sign-off recorded per translation publication, per locale | MVP | UC-72. **Ratified 18 Aug 2026** (architecture.md §17.1). Architecturally free (NFR-4, NFR-25) and it replaces the staging-locale rehearsal. Real costs: a third translation set reviewed on every content publish, and **no official EFRAG source for Russian VSME labels** — NFR-24 applies to RO/EN only, and Russian labels are platform-authored with no EFRAG standing (design_spec.md UX-47, UX-98). Closes design_spec.md OQ-1 and actors.md OQ-9. **Scope amended 19 Aug 2026 (architecture.md OQ-42), with the `apps/admin` scaffold:** the three live locales bind the **tenant-facing** interface, the exports and email. The *administrative console*'s own chrome is **Romanian only** at MVP and its URLs carry no locale segment — its users are a small internal population of Platform Administrators and Billing Operators, and separately authoring a third console chrome buys nothing while costing the same editorial review as tenant content. This narrows which surfaces ship three catalogues and nothing else: every console string remains a message key rather than a literal, and FR-63's "no architectural limit" is preserved — adding a console locale is authoring one more catalogue file. **Further amended 19 Aug 2026 (architecture.md OQ-43):** the console's keys resolve from a committed catalogue rather than the configuration store, so NFR-85 no longer binds here; a console wording change ships with a release. The Romanian-only decision and the absent locale segment are unaffected — both rest on locale count, not on where the catalogue lives. The three-locale registry is still read by the console, because A-03 is the screen on which an operator authors all three and registers a fourth |
| NFR-24 | The system shall use the official EFRAG translation of a VSME label wherever one is published (FR-51) | Official EFRAG translation used for 100% of VSME labels where one is published | **I** — label diff against the official template per version rollout | MVP | FR-51 |
| NFR-25 | The system shall permit an additional locale to be added by authoring its catalogue, with no schema change, no route change and no per-locale branch in application code | A locale added with zero schema changes, zero route changes and zero per-locale code branches; a build and deploy are expected | **D** — a fourth locale added in staging | MVP | Verifies NFR-4. **Amended 19 Aug 2026 (architecture.md OQ-43):** catalogue text ships in the release, so a new locale needs a build. The property NFR-4 exists to protect is intact and is the one that mattered — no architectural limit and no per-locale code path. The earlier "zero redeploys" wording described the mechanism, not the goal; it is the mechanism that changed |
| NFR-26 | The system shall format all dates, numbers, units and currency values from the active locale, using no hardcoded format pattern | Zero hardcoded format patterns; all dates, numbers, units and currency values formatted from the active locale | **A** static analysis rule in CI · **I** locale-switch screenshot review | MVP | — |

### 4.10 Standards conformance and data fidelity (NFR-2 ▪, NFR-3 ▪, NFR-18 … NFR-22)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-2 ▪ | The system shall name and structure internal schema elements to mirror the VSME taxonomy (FR-155) | Internal schema element names and structure mirror the VSME taxonomy; no custom schema | **I** — element mapping review at each version registration | MVP | FR-155 |
| NFR-3 ▪ | The system shall store an explicit template and taxonomy version on every report and permit its re-export or migration against a later release (FR-66, FR-69) | Explicit template and taxonomy version on 100% of reports; a superseded-version report re-exportable and its migrated copy re-exportable | **T** — re-export of a superseded-version report and of its migrated copy | MVP | FR-66, FR-69 |
| NFR-18 | The system shall retain full precision in storage and apply rounding once at presentation, producing identical values across screen, PDF, Excel and XBRL renderings | Full precision in storage; rounding applied exactly once, at presentation; identical field values across screen, PDF, Excel and XBRL | **T** — golden-report cross-format field comparison | MVP | — |
| NFR-19 | The system shall reproduce a stored calculation exactly when re-run against its stored raw inputs and stored factor-set version (FR-33, FR-35) | Exact reproduction on replay; any divergence across the nightly report-corpus replay blocks the release | **T** — nightly replay of the report corpus; divergence blocks release | MVP | FR-33, FR-35 |
| NFR-20 | The system shall produce EFRAG Excel exports that open without a repair prompt in Microsoft 365, current Excel and LibreOffice Calc, with named ranges, dropdowns and formulas intact (FR-50) | Zero repair prompts in Microsoft 365, current Excel and LibreOffice Calc; named ranges, dropdowns and formulas intact; per template version | **T** — automated open-and-diff in **LibreOffice Calc as a CI gate** per template version · **I** — **Microsoft 365 open-and-inspect as a manual release-checklist item** | MVP | FR-50. **Ratified 18 Aug 2026** (architecture.md §17.1). The verification is split because server-side Office automation on Linux is unsupported; the requirement itself is unchanged |
| NFR-21 | The system shall round-trip UTF-8 input, including Romanian diacritics, without loss or substitution through storage, PDF, Excel, e-Factura XML, email and the API | Zero loss and zero substitution of UTF-8 input, including Romanian diacritics, across storage, PDF, Excel, e-Factura XML, email and the API | **T** — diacritic and edge-character corpus in the export regression suite | MVP | — |
| NFR-22 | The system shall embed entity, period, template and taxonomy version, factor-set version, language and generation timestamp in every export (FR-53) | All seven metadata elements present in 100% of exports | **T** — metadata assertion in the export regression suite | MVP | FR-53 |

### 4.11 Compatibility and interoperability (NFR-81 … NFR-84)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-81 | The system shall support the current and previous major versions of Chrome, Edge, Firefox and Safari, and shall fail explicitly rather than silently outside that matrix | Current and previous major versions of the four named browsers; explicit rather than silent failure outside the declared matrix | **T** — cross-browser suite in CI on the declared matrix | MVP | — |
| NFR-82 | The system shall produce record-intended PDF exports conforming to **PDF/A-2a and PDF/UA-1** (FR-49, FR-53) | PDF/A-2a **and** PDF/UA-1 conformance for 100% of record-intended PDF exports | **T** — veraPDF conformance validation in CI and in the export regression suite | MVP | FR-49, FR-53. **Ratified 18 Aug 2026** (architecture.md §17.1). Archival conformance *and* accessible structure, both machine-validated, which makes NFR-75's tagged reading order testable rather than asserted. Costs the harder renderer pipeline in AD-10: Chromium `tagged: true`, in-place metadata injection, table header scope, artifact marking. If accessible tagging proves unreachable through Chromium, this escalates as a conflict rather than being left claimed and untested (architecture.md OQ-7) |
| NFR-83 | The system shall publish a versioned OpenAPI 3.x specification, introducing breaking changes only in a new version and only after a stated deprecation window (FR-153) | Versioned OpenAPI 3.x specification published; zero breaking changes within a published version; a stated deprecation window observed. Window length: — (unquantified in source — see OQ-8) | **A** spec-to-implementation diff in CI · **T** contract tests per published version | MVP | FR-153 |
| NFR-84 | The system shall send transactional mail SPF-, DKIM- and DMARC-aligned, shall meet the stated delivery rate, and shall record bounces and complaints against the notification record (FR-157, UC-131) | SPF, DKIM and DMARC alignment on all transactional mail; bounces and complaints recorded against the notification record; delivery evidenced with timestamp and channel. Delivery rate: **≥ 99% accepted delivery**, monthly | **A** — deliverability monitoring, monthly review; delivery evidenced with timestamp and channel | MVP | FR-157, UC-131. **Ratified 18 Aug 2026** (architecture.md §17.1). Extended by NFR-108. Closes the transactional-mail half of OQ-9; NFR-71's e-Factura reconciliation tolerance remains open |

### 4.12 Architecture and modularity (NFR-1 ▪, NFR-9 ▪, NFR-10 ▪, NFR-11 ▪, NFR-14 … NFR-17)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-1 ▪ | The system shall implement the compliance core — report data model, validation engine, export generation — with no dependency on plan, price or tenant type (FR-154) | Zero dependencies of the compliance core on plan, price or tenant type; the UC-17 … UC-48 suite passes with the billing context disabled | **D** — with the billing context disabled, the UC-17 … UC-48 suite passes | MVP | FR-154, D-11, UC-17 … UC-48 |
| NFR-9 ▪ | The system shall accept the addition of Advisor, Buyer and Licensee organization relationship types without a schema migration (FR-14) | Zero schema migrations to add a relationship type; a fourth type registered as data | **D** — a fourth relationship type registered as data in staging | MVP | FR-14 |
| NFR-10 ▪ | The system shall support concurrent pricing units — per-seat, per-report, per-API-call, per-managed-supplier (FR-85, FR-105) | Four named pricing units supported concurrently; an unsold unit evaluated end to end with zero code change | **D** — an unsold pricing unit evaluated end to end without code change | MVP | FR-85, FR-105 |
| NFR-11 ▪ | The system shall access all third-party components through internal interfaces, referencing no vendor type outside its adapter (FR-156) | Zero vendor types referenced outside their adapter | **I** — dependency review per release | MVP | FR-156; also cited by FR-114, FR-169 |
| NFR-14 | The system shall confine the addition or replacement of a payment rail to an adapter implementation and routing configuration (D-8, FR-114) | Diff limited to adapter implementation and routing configuration; zero changes elsewhere | **D** — merchant-of-record adapter activated in staging; diff limited to adapter and configuration | MVP | D-8, FR-114 |
| NFR-15 | The system shall maintain billing and the compliance core as separate bounded contexts sharing no transaction, foreign key or table (D-11) | Zero shared transactions, zero shared foreign keys, zero shared tables between billing and the compliance core | **I** — schema and dependency review per release | MVP | D-11 |
| NFR-16 | The system shall expose every tenant-facing capability through the documented API under identical authorization, providing no interface-only privileged route (FR-153) | 100% of tenant-facing capabilities reachable through the documented API under identical authorization; zero interface-only privileged routes | **A** — route-coverage diff in CI | MVP | FR-153 |
| NFR-17 | The system shall require no change to the entitlement service when a gated capability is added, and no change to a gated capability when a plan or quota changes (FR-99, FR-100) | Zero entitlement-service changes to add a gated capability; zero gated-capability changes when a plan or quota changes | **D** — synthetic entitlement key and synthetic plan introduced in test | MVP | FR-99, FR-100 |

### 4.13 Maintainability and changeability (NFR-12 ▪, NFR-85 … NFR-89)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-12 ▪ | The system shall support a quarterly regulatory-watch update cadence, with no redeploy for a change to a configuration value (FR-74) | Quarterly cadence sustainable; zero redeploys for a change to a threshold, factor set, rule definition, effective date or notification behaviour | Decomposed into NFR-85 and NFR-86 | MVP | FR-74. **Amended 19 Aug 2026 (architecture.md OQ-43):** a regulatory change that moves a threshold, factor set or rule definition still needs no redeploy — that is the expensive half and it is unchanged. A change to the *wording* of a label or a finding message now ships with a release. The cadence is sustained by the first, not the second |
| NFR-85 | The system shall publish a configuration-only change — thresholds, factor sets, rule definitions, notification behaviour, help-centre articles, plan presentation copy — to production within one working day of approval, reversible in a single step (FR-61, FR-62, FR-71 … FR-73) | ≤ 1 working day from approval to production; revert achievable in a single step | **D** — timed publish-and-revert rehearsal against production configuration | MVP | FR-61, FR-62, FR-71 … FR-73. **Amended 19 Aug 2026 (architecture.md OQ-43):** label, help-text, validation-message and notification-template wording left this scope with FR-61. Those reach production on the release cadence instead, and their revert is a revert of the commit |
| NFR-86 | The system shall permit registration, mapping and rollout of a backwards-compatible template or taxonomy version with no code release, and shall confine a breaking change to mapping content rather than schema change (FR-65 … FR-69) | Zero code releases for a backwards-compatible version rollout; a breaking change confined to mapping content, with zero schema changes | **D** — rehearsal of both a compatible and a breaking rollout in staging | MVP | FR-65 … FR-69 |
| NFR-87 | The system shall execute a version-pinned regression suite on every rule or factor change, admitting no silent restatement of a previously reported figure (NFR-19, FR-35) | Suite executed against every prior pinned version on every rule or factor change; zero silent restatements of a previously reported figure | **T** — suite executed against every prior pinned version | MVP | NFR-19, FR-35 |
| NFR-88 | The system shall meet the stated per-component test coverage floor for the calculator, validation engine, entitlement service, invoice numbering and VAT calculation, including property-based tests | Coverage reported per component for the five named components, not as a project-wide average; property-based tests included. Coverage floor: — (unquantified in source — see OQ-10) | **A** — coverage gate in CI reported per component, not as a project-wide average | MVP | — |
| NFR-89 | The system shall be buildable to a deployable artefact from source with no manual step, and every environment reproducible from version-controlled configuration | Zero manual steps from source to deployable artefact; every environment reproducible from version-controlled configuration | **D** — clean-room rebuild and environment recreation per release train | MVP | — |

### 4.14 Observability and operability (NFR-90 … NFR-93)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-90 | The system shall propagate a single correlation identifier across order, payment, fiscal document, e-Factura transmission and entitlement change | One correlation identifier spanning all five stages; trace completeness sampled weekly | **A** — weekly sampled trace-completeness check | MVP | — |
| NFR-91 | The system shall raise operational alerts for unreconciled settlements beyond tolerance, e-Factura rejections, dunning backlog, metering-event lag, migration-run failures and locale-fallback spikes in FR-61 content (FR-152, FR-64, UC-130) | Alerts present for all six named conditions; each exercised at least annually. Tolerance and lag thresholds: — (unquantified in source; held as operational configuration) | **I** alert inventory reviewed per release · **T** each alert exercised at least annually | MVP | FR-152, FR-64, UC-130 |
| NFR-92 | The system shall collect the NFR-37 … NFR-42 and NFR-48 indicators continuously in production against a monthly-reviewed error budget | Continuous production collection of the NFR-37 … NFR-42 and NFR-48 indicators; error budget reviewed monthly | **I** — dashboard and monthly review record | MVP | NFR-37 … NFR-42, NFR-48 |
| NFR-93 | The system shall report explicit success or failure for every scheduled job — dunning, trial and invitation expiry, reconciliation import, backup, taxonomy migration | Explicit success or failure reported for 100% of scheduled jobs; absence alerting per job | **A** — heartbeat monitoring with absence alerting per job | MVP | — |

### 4.15 Fiscal and regulatory compliance (NFR-71 … NFR-74)

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-71 | The system shall transmit every in-scope B2B invoice to e-Factura and store its acknowledgement, recording any untransmitted invoice as a tracked exception with an owner (D-9, FR-126, UC-130) | 100% of in-scope B2B invoices transmitted with acknowledgement stored; zero unacknowledged invoices beyond tolerance on the daily reconciliation; every untransmitted invoice a tracked exception with a named owner. Tolerance: — (unquantified in source — see OQ-9) | **A** — daily transmission reconciliation showing zero unacknowledged invoices beyond tolerance | MVP | D-9, FR-126, UC-130 |
| NFR-72 | The system shall archive fiscal documents in statutory form for at least six years, retrievable independently of the application, the database and the hosting provider (D-9) | ≥ 6 years in statutory form; retrievable independently of the application, the database and the hosting provider | Verified by NFR-36 | MVP | D-9; FR-130 |
| NFR-73 | The system shall hold VAT rates and treatment rules, MIA per-transaction and cumulative ceilings, and BNM rate sourcing as effective-dated configuration requiring no deployment to change (D-14, FR-118, FR-148) | Zero deployments required to change a VAT rate, treatment rule, MIA ceiling or BNM rate source; effective dating verified against historic documents | **D** rate and ceiling changed in staging without release · **T** effective-dating verified against historic documents | MVP | D-14, FR-118, FR-148 |
| NFR-74 | The system shall neither hold customer funds nor execute money movement, all rails being provider-executed behind the adapter interface (D-8, FR-114) | Zero customer funds held; zero money movement executed by the platform; no custody or settlement code path exists | **I** architecture review recording this as an explicit non-goal · **A** no custody or settlement code path exists | MVP | D-8, FR-114 |

### 4.16 Notifications (NFR-106 … NFR-109)

Ratified 18 Aug 2026 from `architecture.md` §17.3. FR-160 … FR-173 previously had no quality counterpart, which left FR-170's delivery records — explicitly *the evidence that a required update was actually requested* — with no acceptance threshold. Originally drafted as NFR-94 … NFR-97, which collide with the deferred register; they carry NFR-106 … NFR-109 here, above it. Closes OQ-13, `use_cases.md` OQ-5, `functional_requirements.md` OQ-3, `architecture.md` OQ-2 and `design_spec.md` OQ-11.

| NFR ID | Requirement | Metric / target | Verification | Pri | Related FR / UC / D |
|---|---|---|---|---|---|
| NFR-106 | The system shall dispatch a raised notification to its first channel within p95 ≤ 60 s | p95 ≤ 60 s from raise to dispatch, per channel | **A** — production SLI on raise-to-dispatch latency | MVP | FR-160 … FR-173; AD-11 |
| NFR-107 | The system shall retry a transient delivery failure on an exponential schedule bounded at 24 hours, and shall suppress a recipient address on its first hard bounce (FR-171) | Exponential retry bounded at 24 h; suppression on first hard bounce, per recipient address | **T** — bounce and transient-failure simulation per channel | MVP | FR-171 |
| NFR-108 | The system shall achieve ≥ 99% accepted delivery for transactional mail, SPF-, DKIM- and DMARC-aligned (extends NFR-84) | ≥ 99% accepted delivery, monthly; SPF, DKIM and DMARC aligned | **A** — deliverability monitoring, monthly review | MVP | NFR-84; FR-157, FR-169 |
| NFR-109 | The system shall retain per-recipient delivery records — channel, dispatch timestamp, outcome, read state — for the life of the organization plus one year | Delivery records retained for organization life + 1 year, readable independently of the notification centre | **I** — retention policy review; independent readability confirmed | MVP | FR-170 |

---

## 5. Cross-cutting quality scenarios

Six scenarios in which several qualities are exercised at once. Each is drawn from a source statement or verification method; none introduces a new threshold. They exist because the requirements most likely to be individually satisfied and jointly violated are the ones that meet at these points.

### 5.1 Billing context unavailable while reporting continues

**Stimulus.** The billing bounded context becomes unavailable mid-session during report authoring.
**Required response.** Every reporting use case UC-17 … UC-48 continues to be served on cached entitlements; already-granted entitlements fail open; new purchases fail closed (NFR-49). The compliance core has no dependency on plan, price or tenant type, so nothing in the reporting path is waiting on billing (NFR-1, NFR-15, FR-154, D-11). Interactive read latency stays within NFR-37.
**Evidence.** Chaos test disabling the billing context mid-session (NFR-49); the UC-17 … UC-48 suite passing with the billing context disabled (NFR-1).
**Qualities in tension.** Availability against commercial control. The sources resolve it explicitly: open for what was granted, closed for what is being bought.

### 5.2 Filing-window peak with an export burst

**Stimulus.** Filing-window peak concurrency (10× median, ≈ 150 sessions) coincides with an export burst at ≈ 200 generations per hour.
**Required response.** All NFR-37 … NFR-42 thresholds hold at 10× median concurrency (NFR-44). Export generation is queue-decoupled from the request tier, so the burst degrades export latency and nothing else (NFR-46). Any generation projected beyond 30 s runs asynchronously with progress indication and completion notification (NFR-42). No scheduled maintenance window is taken inside the filing window and availability holds at ≥ 99.9% (NFR-44, NFR-48).
**Evidence.** 10× load test plus 24-hour soak at 3× before each filing window (NFR-44); fault injection flooding the export queue while measuring NFR-37 (NFR-46).
**Open dependency.** The window date itself is an assumption (§3, OQ-2), and it determines when this scenario is rehearsed.

### 5.3 Erasure request against statutory retention

**Stimulus.** A data subject submits an erasure request against an organization that holds issued fiscal documents and completed reports.
**Required response.** The request is fulfillable within 30 calendar days with a record of what was disclosed (NFR-28). Statutorily required data is retained rather than erased — fiscal documents for six years, the disclosure audit trail for the life of the report — and the retained categories are reported back to the requester (NFR-29). The audit trail cannot be mutated to effect the erasure, because append-only is enforced at database privilege level (NFR-33). Historical attribution survives removal of the user's access (FR-55).
**Evidence.** Annual runbook rehearsal against a seeded tenant, with NFR-29 rehearsed alongside (NFR-28, NFR-29).
**Qualities in tension.** Privacy against auditability and fiscal compliance. The sources resolve in favour of retention, with disclosure of what was retained.

### 5.4 Provider outage on a payment or fiscal rail

**Stimulus.** An external provider — acquirer, MIA participant bank, e-Factura, email provider — becomes unavailable mid-transaction.
**Required response.** Impact is confined to the affected path; the operation is queued or an alternative rail offered; no acknowledged customer action is lost (NFR-50). Callbacks, webhooks and acknowledgements arriving late, repeated or out of order converge on one state (NFR-54). The order, its payment, its fiscal document and its entitlement change resolve all-or-nothing through a durable outbox or saga, with residual inconsistency surfaced to the Billing Operator (NFR-59). A fiscal number is consumed only on issuance, so a failed attempt leaves no gap (NFR-55). An untransmitted invoice becomes a tracked exception with an owner rather than a silent success (NFR-71).
**Evidence.** Provider-outage simulation per adapter (NFR-50); replay, reorder and duplicate-delivery tests per adapter under concurrency (NFR-54); fault injection at each step boundary (NFR-59).

### 5.5 Entitlement reduction on downgrade, lapse or suspension

**Stimulus.** A subscription is downgraded, lapses, or is suspended for non-payment.
**Required response.** No disclosure content is deleted; out-of-entitlement content becomes read-only and previously generated documents remain downloadable (D-13, FR-104). Which content will become read-only is disclosed before the change takes effect, and the action requires explicit confirmation (NFR-80). Full customer data export in an open format remains available irrespective of subscription state (NFR-31). The message explaining the change states what failed, the consequence, and the action that resolves it (NFR-79).
**Evidence.** Destructive-path inventory reviewed per release (NFR-80); exit rehearsal performed from a lapsed tenant (NFR-31).
**Qualities in tension.** Commercial enforcement against the customer's ownership of its own regulatory records. The sources resolve in favour of the customer.

### 5.6 Factor or rule change against an already-reported figure

**Stimulus.** An emission factor set, applicability threshold or validation rule is updated after reports have been issued.
**Required response.** The change publishes as content within one working day of approval and is reversible in a single step (NFR-85), with no redeploy (NFR-12). A version-pinned regression suite runs against every prior pinned version and admits no silent restatement of a previously reported figure (NFR-87). Every stored calculation still reproduces exactly against its stored raw inputs and stored factor-set version (NFR-19, FR-35). Every report carries its explicit template and taxonomy version and can be re-exported or migrated (NFR-3). Affected organizations are notified rather than left to discover it at export time (FR-70, FR-166), and a locale-fallback or migration-run failure raises an operational alert (NFR-91).
**Evidence.** Nightly replay of the report corpus, divergence blocking release (NFR-19); the version-pinned suite (NFR-87); timed publish-and-revert rehearsal (NFR-85).

## 6. Deferred non-functional scope (post-MVP)

### 6.1 Why deferred qualities are recorded at all

These twelve requirements are **not MVP build items**. They are recorded because the MVP architecture is required not to block them, and because several MVP requirements exist specifically to make them additive later:

- NFR-57 makes metering counters exact so that NFR-99 can bill from them.
- NFR-65 establishes the MFA path that NFR-95 extends to tenant users.
- NFR-18 already requires XBRL renderings to agree with the other formats before NFR-98 makes XBRL a deliverable.
- NFR-9 already carries organization relationship types that NFR-96 turns into per-tenant residency and branding isolation.
- NFR-19 already requires exact calculation replay before NFR-103 introduces restatable external data sources.
- NFR-51 already states single-region recovery objectives that NFR-104 tightens.

IDs continue the register's sequence rather than starting a parallel one, so an ID promoted from deferred into build scope moves document without changing.

### 6.2 Deferred register (NFR-94 … NFR-105)

| NFR ID | Category | Requirement | Metric / target | Pri | Related FR / NFR / D |
|---|---|---|---|---|---|
| NFR-94 | Security | The system shall validate federated SSO assertions for signature, audience and replay, and shall support domain claiming and directory-driven deprovisioning within a stated latency (D-6, FR-164) | Signature, audience and replay validated on every assertion; domain claiming and directory-driven deprovisioning supported. Latency: — (unquantified in source) | P2 | D-6, FR-180 † |
| ~~NFR-95~~ | Security | **Promoted to MVP — see §4.5.** Restated as opt-in TOTP for ordinary tenant users, recommended to Organization Administrators; PA MFA remains mandatory (NFR-65). The ID is retained rather than reissued, so existing citations still resolve | See §4.5 | **MVP** | NFR-65, FR-181 †. **Ratified 18 Aug 2026** (architecture.md §17.1). |
| NFR-96 | Architecture & modularity | The system shall support per-tenant data residency and branding isolation for white-label Licensee instances (NFR-9, FR-168) | Per-tenant data residency and branding isolation | P2/P3 | NFR-9, FR-184 † |
| NFR-97 | Availability & continuity | The system shall meet the contractual Enterprise availability commitment and shall produce the measurement record supporting service credits (NFR-48, FR-144) | Contractual commitment met; measurement record produced. The commitment itself is a commercial document, not stated here | P2 | NFR-48, FR-144 |
| NFR-98 | Standards conformance & data fidelity | The system shall generate iXBRL, XBRL-JSON and XBRL-CSV instances validating against the EFRAG taxonomy under the official validator with zero errors (NFR-18, FR-160) | Zero validator errors against the EFRAG taxonomy, all three instance formats | P2 | NFR-18, FR-176 † |
| NFR-99 | Integrity & reliability | The system shall reconcile every usage-priced invoice line to its individual metered events, re-derivable on dispute (NFR-57, FR-169) | 100% of usage-priced invoice lines re-derivable from individual metered events | P2 | NFR-57, FR-185 † |
| NFR-100 | Data protection & privacy | The system shall be operated under a certified control framework — SOC 2 Type II or ISO/IEC 27001 | Certification held under one of the two named frameworks | P2/P3 | — (accompanies no deferred capability) |
| NFR-101 | Data protection & privacy | The system shall publish no benchmarking figure derived from a cohort below the stated minimum size (FR-167) | Zero published figures below the minimum cohort size. Minimum size: — (unquantified in source) | P3 | FR-183 † |
| NFR-102 | Data protection & privacy | The system shall enforce human review before save of generated narrative content and shall record model and prompt provenance (NFR-6, FR-172) | Human review enforced before save on 100% of generated narrative content; model and prompt provenance recorded | P3 | NFR-6, FR-188 † |
| NFR-103 | Integrity & reliability | The system shall handle connector rate limits, backfill and source restatement of historic data without corrupting a reported figure (NFR-19, FR-171) | Zero corruption of a reported figure under connector rate limiting, backfill or source restatement | P3 | NFR-19, FR-187 † |
| NFR-104 | Availability & continuity | The system shall support multi-region disaster recovery, tightening the NFR-51 objectives | Objectives tighter than NFR-51's RPO ≤ 15 min / RTO ≤ 4 h; the tightened values are not stated | P3 | NFR-51 (accompanies no deferred capability) |
| NFR-105 | Capacity & scalability | The system shall meet the read-scale, caching and anti-scraping requirements of the public disclosure portal (FR-174) | — (unquantified in source) | P3 | FR-174 |

**Count:** 12 deferred requirements — 7 at P2 or P2/P3, 5 at P3.

**† These `FR-n` citations resolve against the *deferred* functional register — and since 18 Aug 2026 that is no longer ambiguous.** The deferred set was renumbered to **FR-176 … FR-189** in `functional_requirements.md` §8, above FR-175, so FR-160 … FR-173 now mean the MVP notification requirements and nothing else. Every `†` citation above was rewritten to the new identifier: FR-176 XBRL conversion, FR-180 enterprise SSO, FR-181 tenant MFA, FR-183 corporate-buyer benchmarking, FR-184 white-label administration, FR-185 usage-based pricing, FR-187 ingestion connectors, FR-188 AI-assisted narrative drafting. FR-174 (public disclosure portal) and FR-144 never collided. The `†` marker is retained as a reading aid — it now means "deferred register", not "ambiguous". Closes OQ-1 and C-1.

### 6.3 Two deferred qualities accompany no deferred capability

**NFR-100** (certified control framework) and **NFR-104** (multi-region disaster recovery) have no deferred functional requirement beside them. They are qualities the platform will be required to demonstrate by its customers and by its own risk position rather than by a feature on the roadmap, and neither is buildable retroactively without cost. That is why both are recorded now rather than when they are first demanded.

### 6.4 Two legacy qualities are quantified only by a deferred requirement

**NFR-6** (no model training on customer data; stated retention and deletion policy) is quantified only by NFR-102, at P3. **NFR-9** (relationship types added without schema migration) is quantified only by NFR-96, at P2/P3. Both remain **in force at MVP as stated obligations**. What is deferred is the specific quantification, because the feature that would make it testable is itself deferred. NFR-6's MVP verification is therefore documentary — provider contractual terms and published policy, re-verified on provider change — and NFR-9's is the staging demonstration of a fourth relationship type registered as data.

---

## 7. Coverage and traceability

### 7.1 NFR → FR / UC / D matrix

52 of the 93 MVP requirements carry at least one functional, use case or design-decision citation. Citations are verbatim from the requirement statements and their verification methods; no trace is inferred.

| NFR | FR | UC | D |
|---|---|---|---|
| NFR-1 ▪ | FR-154 | UC-17 … UC-48 | D-11 |
| NFR-2 ▪ | FR-155 | — | — |
| NFR-3 ▪ | FR-66, FR-69 | — | — |
| NFR-4 ▪ | FR-63 | — | — |
| NFR-7 ▪ | FR-54, FR-55 | — | — |
| NFR-9 ▪ | FR-14 | — | — |
| NFR-10 ▪ | FR-85, FR-105 | — | — |
| NFR-11 ▪ | FR-156 (also cited by FR-114, FR-169) | — | D-7 |
| NFR-12 ▪ | FR-74 | — | — |
| NFR-13 ▪ | FR-158 (cites it) | — | — |
| NFR-14 | FR-114 | — | D-8 |
| NFR-15 | — | — | D-11 |
| NFR-16 | FR-153 | — | — |
| NFR-17 | FR-99, FR-100 | — | — |
| NFR-19 | FR-33, FR-35 | — | — |
| NFR-20 | FR-50 | — | — |
| NFR-22 | FR-53 | — | — |
| NFR-23 | — | UC-72 | — |
| NFR-24 | FR-51 | — | — |
| NFR-31 | — | — | D-13 |
| NFR-33 | FR-151, FR-159 | — | D-10 |
| NFR-38 | FR-37, FR-38 | — | — |
| NFR-39 | FR-43 | — | — |
| NFR-40 | FR-34 | — | — |
| NFR-41 | FR-99 | — | — |
| NFR-42 | FR-49, FR-50 | — | — |
| NFR-47 | — | — | D-12 |
| NFR-49 | — | UC-17 … UC-48 | D-11 |
| NFR-50 | — | — | D-8, D-9 |
| NFR-55 | FR-123 | — | D-10 |
| NFR-56 | FR-37 | — | — |
| NFR-57 | FR-105 | — | — |
| NFR-58 | FR-129 | — | D-14 |
| NFR-60 | — | — | D-7 |
| NFR-62 | FR-158 | — | — |
| NFR-64 | FR-4, FR-6, FR-11 | — | — |
| NFR-65 | FR-75 | — | D-5 |
| NFR-66 | FR-78 | — | D-5 |
| NFR-71 | FR-126 | UC-130 | D-9 |
| NFR-72 | — | — | D-9 |
| NFR-73 | FR-118, FR-148 | — | D-14 |
| NFR-74 | FR-114 | — | D-8 |
| NFR-78 | — | UC-72 | — |
| NFR-79 | — | UC-125 | — |
| NFR-80 | FR-102, FR-103 | — | D-13 |
| NFR-82 | FR-49, FR-53 | — | — |
| NFR-83 | FR-153 | — | — |
| NFR-84 | FR-157 | UC-131 | — |
| NFR-85 | FR-61, FR-62, FR-71 … FR-73 | — | — |
| NFR-86 | FR-65 … FR-69 | — | — |
| NFR-87 | FR-35 | — | — |
| NFR-91 | FR-152, FR-64 | UC-130 | — |

### 7.2 FR → NFR reverse check

The functional register carries the trace in the reverse direction. There are **eleven citation sites** in the MVP functional register, and two more in its deferred companion:

| Citing FR | Legacy NFR cited | Register |
|---|---|---|
| FR-14 (typed organization relationships) | NFR-9 | MVP |
| FR-54 (per-field change attribution) | NFR-7 | MVP |
| FR-63 (additional locale as configuration) | NFR-4 | MVP |
| FR-66 (template and taxonomy version on every report) | NFR-3 | MVP |
| FR-74 (content-only change without redeploy) | NFR-12 | MVP |
| FR-114 (money movement behind a provider adapter) | NFR-11 | MVP |
| FR-154 (compliance core free of plan, price, tenant type) | NFR-1 | MVP |
| FR-155 (VSME taxonomy element names mirrored) | NFR-2 | MVP |
| FR-156 (third parties behind internal interfaces) | NFR-11 | MVP |
| FR-158 (server-side RBAC per organization and report) | NFR-13 | MVP |
| FR-169 (email delivery via the provider adapter) | NFR-11 | MVP |
| FR-172 (AI-assisted narrative drafting) | NFR-6 | Deferred |
| FR-169 (usage-based and metered pricing) | NFR-10 | Deferred |

Design decisions cite the legacy set from four further places: D-3 → NFR-3, D-7 → NFR-11, D-11 → NFR-1, and the exclusions section → NFR-10.

Counting distinct legacy IDs across both functional registers gives **eleven of the thirteen**, which is the claim the source coverage analysis makes. The two never cited are **NFR-5 and NFR-8**.

### 7.3 NFRs with no functional counterpart

41 of the 93 MVP requirements carry no `FR-n`, `UC-n` or `D-n` citation:

NFR-5, NFR-6, NFR-8, NFR-18, NFR-21, NFR-25, NFR-26, NFR-27, NFR-28, NFR-29, NFR-30, NFR-32, NFR-34, NFR-35, NFR-36, NFR-37, NFR-43, NFR-44, NFR-45, NFR-46, NFR-48, NFR-51, NFR-52, NFR-53, NFR-54, NFR-59, NFR-61, NFR-63, NFR-67, NFR-68, NFR-69, NFR-70, NFR-75, NFR-76, NFR-77, NFR-81, NFR-88, NFR-89, NFR-90, NFR-92, NFR-93.

**For most of these, absence is by design and is not a coverage gap.** A quality constrains a class of behaviour rather than an interaction, so it has no single owning use case: NFR-63 governs every read path, NFR-34 every stored timestamp, NFR-79 every message the system emits, NFR-37 every interactive read. The register carries no `Source UC` column for exactly this reason. Nine of the forty-one trace instead to another NFR — NFR-35 to NFR-7, NFR-43 and NFR-77 to NFR-8, NFR-46 to NFR-37, NFR-52 to NFR-51, NFR-59 to NFR-15, NFR-87 to NFR-19, NFR-92 to NFR-37 … NFR-42 and NFR-48, NFR-25 to NFR-4.

**Two are genuine gaps, and both are confirmed against the sources:**

| NFR | Quality | Confirmed status |
|---|---|---|
| **NFR-5 ▪** | Hosted in the EU/EEA; operated in compliance with GDPR and Moldovan data-protection law | **No functional requirement is written against it.** Verified: the MVP functional register cites NFR-1, NFR-2, NFR-3, NFR-4, NFR-7, NFR-9, NFR-11, NFR-12, NFR-13 and (in its deferred companion) NFR-6, NFR-10 — never NFR-5. The erasure-versus-retention interaction is stated only inside FR-130, and only for fiscal documents. The requirement is discharged architecturally (NFR-27 … NFR-32) and documentarily (annual compliance review, records of processing), not functionally. |
| **NFR-8 ▪** | Responsive across devices; scales for usage spikes around the fiscal year-end deadline | **No functional requirement is written against it.** It is an umbrella that conflated capacity with device usability, retained at its original ID because it is cited from sibling documents, and decomposed into NFR-44 (spike), NFR-43 and NFR-77 (devices). Nothing in the functional register carries either half. |

Both were raised independently in the consolidated functional baseline as its OQ-5, and are carried here as OQ-12.

### 7.4 FR areas with no NFR coverage

Derived by checking every FR domain in the functional register against the citations in section 7.1. Domains in which **no requirement is cited by any NFR** are listed below. Partial citation within a domain is normal and is not listed.

| FR domain | Range | Governed instead by | Assessment |
|---|---|---|---|
| **Notifications** | FR-160 … FR-167, FR-173 | NFR-84 (transactional mail alignment and bounce recording, cited against FR-157) | **Acknowledged gap.** The functional register's own closing note states that FR-160 … FR-173 have no counterpart in the non-functional register. See below. |
| **Notification delivery** | FR-168 … FR-172 | NFR-84 only | **Acknowledged gap.** FR-170's delivery records are described in the source as *the evidence that a required update was actually requested* — a compliance artefact — and carry no acceptance threshold. |
| Entity and period | FR-17 … FR-23 | NFR-37 (read latency), NFR-62/NFR-63 (authorization, tenant scoping), NFR-34 (timestamps), NFR-33 (append-only attribution) | Governed by cross-cutting qualities; no dedicated quality is missing that the sources identify. |
| Report authoring | FR-24 … FR-32 | NFR-38 (autosave), NFR-39 (validation), NFR-56 (durability), NFR-75 … NFR-79 (accessibility, task success, messages), NFR-2/NFR-3 (schema and version fidelity) | Heavily governed indirectly; the wizard is the subject of NFR-75's and NFR-76's verification. |
| Comparatives | FR-45 … FR-47 | NFR-3 (version pinning), NFR-18 (cross-format value identity), NFR-19 (replay) | Governed indirectly. |
| Users and access | FR-56 … FR-60 | NFR-62 (server-side authorization on every request, including revoked sessions), NFR-63 (tenant scoping), NFR-33 (attribution survives access removal) | Governed indirectly. |
| Subscription | FR-90 … FR-98 | NFR-41 (entitlement decision latency), NFR-49 (degradation), NFR-59 (all-or-nothing), NFR-80 (disclosure before reduction) | Governed indirectly. |
| Billing account | FR-106, FR-107 | NFR-71 (e-Factura transmission depends on valid fiscal identifiers) | Governed indirectly. |
| Order and checkout | FR-108 … FR-113 | NFR-54, NFR-59 (idempotency, saga), NFR-58 (monetary types) | Governed indirectly. |
| Reconciliation | FR-131 … FR-134 | NFR-91 (unreconciled-settlement alerting), NFR-33 (append-only ledger) | Governed indirectly. |
| Collections | FR-135 … FR-138 | NFR-91 (dunning backlog alert), NFR-93 (scheduled-job success), NFR-79/NFR-80 (message structure, disclosure) | Governed indirectly. |
| Refunds and disputes | FR-139 … FR-141 | NFR-33 (append-only), NFR-58 (monetary types), NFR-59 (entitlement reversal consistency) | Governed indirectly. |
| Enterprise | FR-142 … FR-147 | NFR-48 (availability target), deferred NFR-97 (contractual commitment and service-credit record) | The quality that Enterprise actually needs is explicitly deferred. |

**The notification gap, stated precisely.** The four qualities missing for FR-160 … FR-173 are: **dispatch latency** from raise to first channel; **retry bounds** for FR-171's "bounded schedule" and the hard-bounce suppression point; **email deliverability** as a target rather than as monitoring; and **retention of the per-recipient delivery records** in FR-170. NFR-84 is adjacent but insufficient — it requires SPF, DKIM and DMARC alignment, records bounces and complaints against the notification record, and requires delivery to be evidenced with timestamp and channel, but its own delivery rate is unquantified (OQ-9) and it says nothing about latency, retry or retention. A downstream document has proposed four requirements to close this; they collide with the deferred IDs NFR-94 … NFR-97 and are recorded in section 9, C-3, not applied here.

### 7.5 Where the documents deliberately do not align one-to-one

Four relationships would read as gaps to a reviewer counting rows, and are not:

1. **Requirements verified through another requirement.** NFR-4 by NFR-25, NFR-7 by NFR-35, NFR-72 by NFR-36. The higher-level requirement asserts a property the specific one already tests exhaustively. These are not unverified; their verification is named once. One of the three is imperfect — see C-8.
2. **Umbrella requirements decomposed rather than tested.** NFR-8 → NFR-44 plus NFR-43 and NFR-77; NFR-12 → NFR-85 and NFR-86; NFR-13 → NFR-60 … NFR-70. What gets tested is the decomposition, never the umbrella. They are retained at their original IDs because sibling documents cite them.
3. **No `Source UC` column.** Deliberate. A quality constrains a class of behaviour, not an interaction. Where a requirement exists because a specific capability demands it, the `FR-n` citation carries the trace, and the functional register carries it in reverse for the legacy set.
4. **Uneven category sizes.** Security's 12 entries against Fiscal and regulatory compliance's 4 reflects where a single unquantified legacy statement hid the most independently failing obligations, not relative build effort or risk. Fiscal compliance is among the smallest and carries the highest consequence of failure, since an untransmitted invoice or a gapped number series is a regulatory event rather than a defect.

## 8. Legacy NFR-1 … NFR-13 reading key

### 8.1 How to read a legacy citation

The legacy `NFR-1 … NFR-13` of section 4 of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" are **retained, not superseded, and not renumbered**. This is the deliberate asymmetry with the functional register: the old FR IDs carried different meanings and were renumbered, so a legacy `FR-n` citation must be translated; the old NFR IDs carry the **same meanings**, so a legacy `NFR-n` citation needs no translation at all.

**A citation of `NFR-n` written before the dedicated register continues to mean exactly what it meant when written.** What changed is form, not content: each legacy entry is restated in normative "the system shall" form and is quantified or decomposed by newer entries. The table below is therefore not a mapping between two numbering schemes — it is a reading key giving, for each legacy ID, the coarse original statement, the normative restatement that now carries the same ID, the requirements that make it measurable, and who cites it.

All thirteen legacy IDs are cited from at least one sibling document in this set. The seven cited from `functional_requirements.md` and `use_cases.md` — NFR-1, NFR-3, NFR-5, NFR-8, NFR-10, NFR-11, NFR-13 — all resolve below, as do the remaining six.

### 8.2 Reading key

| Legacy ID | Legacy statement (verbatim, coarse form) | Legacy rationale / source | Status | Now reads as (same ID, §) | Quantified or decomposed by | Cited from |
|---|---|---|---|---|---|---|
| **NFR-1** | The compliance-core (report data model, validation, export generation) has no dependency on plan, price, or tenant type | Monetization Architecture, Layer 1 | Retained, restated | NFR-1 ▪, §4.12 | NFR-15 (separate bounded contexts), NFR-49 (degradation on cached entitlements) | FR-154, D-11; `functional_requirements.md`, `use_cases.md`, `problem_overview.md` |
| **NFR-2** | Internal schema field names/structure mirror VSME taxonomy element names (B1–B11, C1–C9) rather than a custom schema | Research Notes §2.3 | Retained, restated | NFR-2 ▪, §4.10 | NFR-18 (precision and cross-format identity), NFR-22 (export metadata) | FR-155; `functional_requirements.md` |
| **NFR-3** | Every stored report carries an explicit template/taxonomy version; historic reports can be re-exported/migrated against newer taxonomy releases | Taxonomy had a backwards-incompatible change in Feb 2026 | Retained, restated | NFR-3 ▪, §4.10 | NFR-19 (exact replay), NFR-22 (export metadata), NFR-86 (version rollout without code release), NFR-87 (version-pinned regression suite) | FR-66, D-3; `functional_requirements.md`, `use_cases.md`, `actors.md` |
| **NFR-4** | Localization is not hardcoded to two languages in the architecture, even though RO/EN are the only ones live at MVP | EFRAG's own template ships in 11 languages | Retained, restated | NFR-4 ▪, §4.9 | NFR-23 … NFR-26 (source locale, official labels, locale-by-configuration, locale-driven formatting) | FR-63; `functional_requirements.md`, `actors.md` |
| **NFR-5** | GDPR / Moldovan data-protection compliance; EU/EEA hosting as data controller/processor under standard GDPR terms | Monetization Architecture §5 | Retained, restated | NFR-5 ▪, §4.6 | NFR-27 … NFR-32 (EU/EEA at rest, DSR fulfilment, statutory retention on erasure, no personal data in logs, exit export, no production data downward) | `functional_requirements.md`. **No FR is written against it** — see 7.3 and OQ-12 |
| **NFR-6** | Any AI-assisted feature does not train on submitted customer data and follows a stated deletion/retention policy | Matches IFC MALENA's own stated policy as the bar to hit | Retained, restated | NFR-6 ▪, §4.6 | NFR-102 only, deferred to P3 with the feature. In force at MVP as a stated obligation | Deferred FR-172; `functional_requirements.md` |
| **NFR-7** | Every disclosure field change is attributable (user, timestamp) to support a future "limited assurance" review | CSRD assurance requirement context | Retained, restated | NFR-7 ▪, §4.7 | NFR-33 … NFR-36 (append-only at DB privilege level, UTC precision, figure reconstruction, six-year independent readability) | FR-54; `functional_requirements.md`, `actors.md` |
| **NFR-8** | Platform is responsive across devices and scales for usage spikes around fiscal year-end reporting deadlines | Original ToR baseline | **Retained as umbrella; conflated two qualities.** Not testable as written | NFR-8 ▪, §4.2 | NFR-44 (capacity: 10× median concurrency); NFR-43 and NFR-77 (usability: web vitals, breakpoint behaviour) | `functional_requirements.md`, `actors.md`. **No FR is written against it** — see 7.3 and OQ-12 |
| **NFR-9** | The organization/relationship model supports adding Advisor, Buyer, and Licensee types without a schema migration | Monetization Architecture, Layer 3 | Retained, restated | NFR-9 ▪, §4.12 | NFR-96 only, deferred to P2/P3. In force at MVP as a stated obligation, demonstrated by registering a fourth relationship type as data | FR-14; `functional_requirements.md`, `actors.md` |
| **NFR-10** | The entitlement layer supports multiple concurrent pricing units (per-seat, per-report, per-API-call, per-managed-supplier) so Models 1/2/3/4 can run concurrently later | Monetization Architecture, Layer 2 | Retained, restated | NFR-10 ▪, §4.12 | NFR-57 (exact metering counters); NFR-99 (usage-line reconciliation, deferred) | Deferred FR-169, design decisions §4; `functional_requirements.md`, `use_cases.md` |
| **NFR-11** | Third-party components (EFRAG converter, MALENA API, future billing provider) sit behind an internal interface; compliance-core has no hard dependency on a single vendor | Vendor-continuity risk flagged in Revised Scope §10 (Greenstone/Cority precedent) | Retained, restated | NFR-11 ▪, §4.12 | NFR-14 (payment rail confined to adapter and routing configuration), NFR-50 (provider outage confined to its path) | FR-114, FR-156, FR-169, D-7; `functional_requirements.md`, `use_cases.md`, `actors.md` |
| **NFR-12** | Architecture supports a quarterly regulatory-watch update cadence (taxonomy releases, value-chain-cap classification, Moldova's draft law) without a full redeploy for content-only changes | Revised Scope §4, §10 | **Retained as umbrella** | NFR-12 ▪, §4.13 | NFR-73 (effective-dated fiscal configuration), NFR-85 (content publish within one working day, single-step revert), NFR-86 (version rollout without code release) | FR-74; `functional_requirements.md`, `actors.md` |
| **NFR-13** | Standard SaaS security baseline: encryption in transit/at rest, RBAC per org/role, secure auth (password + SSO), authenticated API surface | API-first requirement (legacy FR-21) implies a real auth/authz surface | **Retained as umbrella; was a category label, not a testable requirement** | NFR-13 ▪, §4.5 | NFR-60 … NFR-70 — eleven entries: PCI scope, TLS/HSTS/AES-256/key rotation, server-side authorization, tenant scoping at the data layer, auth abuse paths and tokens, admin surface isolation, time-boxed staff grants, vulnerability SLAs, penetration-test gate, secret management, output neutralisation | FR-158; `functional_requirements.md`, `actors.md` |

### 8.3 One caution on the legacy set

Legacy NFR-13's parenthetical "password + SSO" is the only place in the legacy statement whose meaning has since been narrowed by decision rather than restated. D-6 puts **social sign-in** (Google, Microsoft) in MVP scope and **enterprise federated SSO** out of it, with federated SSO's quality requirement deferred as NFR-94. A reader taking legacy NFR-13's "SSO" to mean federated SAML/OIDC at MVP would be reading it against a decision taken later. The retained NFR-13 statement in §4.5 uses "secure authentication" and does not carry the parenthetical forward.

---

## 9. Conflict resolutions

Eight discrepancies were found across the sources. In every case the dedicated NFR register and its deferred companion win over the earlier combined document, and no identifier is renumbered to resolve a conflict.

| # | Conflict | Resolution |
|---|---|---|
| **C-1** | **Resolved 18 Aug 2026 — the collision is gone.** The deferred functional set was renumbered **FR-176 … FR-189** in `functional_requirements.md` §8, and the nine affected citations in §6.2 were rewritten to the new identifiers. | The `†` markers stay as a reading aid meaning "resolves against the deferred register", but no citation in this document is ambiguous any more. NFR-98's "cites FR-160" now reads **FR-176** — XBRL conversion — with no second interpretation available. FR-144 and FR-174 never collided. |
| **C-2** | **Asymmetric treatment of the two legacy sets.** The functional register renumbered from FR-1 and superseded legacy FR-1 … FR-23 entirely; the NFR register retained legacy NFR-1 … NFR-13 unchanged. A reader who learns the FR rule first will wrongly assume legacy NFR citations need translating. | The asymmetry is intentional and is stated as a rule, not smoothed over: old FR IDs carried **different** meanings, old NFR IDs carry the **same** meanings. Conventions §2.1 rule 1 and the reading key §8.1 both state it. Legacy NFR citations are read directly; no translation table is needed and none is implied. |
| **C-3** | **Resolved 18 Aug 2026 — all eight amendments ratified.** "ESG Platform System Architecture (MVP)" §17.1 proposed eight changes to this register. All are now applied to the register text in section 4: NFR-82 → **PDF/A-2a + PDF/UA-1**; NFR-75 → **WCAG 2.2 AA**; NFR-48 **scoped to application availability** with single-host loss bounded by an RTO; NFR-47's ceiling **set at €0.50 per active free-tier organization per month**; **opt-in TOTP for tenant users at MVP**, entered as NFR-95 promoted from the deferred register; **Russian added as a third live locale** in NFR-23; the filing window **corrected to April–May** (ratified earlier, OQ-2); and NFR-20's verification **split** into a LibreOffice Calc CI gate plus a manual Microsoft 365 release-checklist item. NFR-106 … NFR-109 are entered as §4.16. | **The register in section 4 is now the record, and `architecture.md` §17.1 is history rather than the live statement.** The earlier objection — that consolidating would import numeric targets no NFR source states — is answered by the decision itself: the targets are now stated here, on the architecture's authority, with the ratification date recorded against each row. This closes OQ-3 and the register's half of `architecture.md` OQ-3, and cascades into OQ-13, `design_spec.md` OQ-1 and OQ-11, `actors.md` OQ-8 and OQ-9, `use_cases.md` OQ-5, `functional_requirements.md` OQ-3 and `architecture.md` OQ-2. |
| **C-4** | **A second, worse collision inside the proposed amendments.** The architecture document authors four notification qualities as **NFR-94 … NFR-97** (dispatch latency p95 ≤ 60 s; exponential retry bounded at 24 hours with hard-bounce suppression; ≥ 99% accepted transactional-mail delivery; delivery records retained for the life of the organization plus one year). Those four IDs are **already occupied** by the deferred register: NFR-94 federated SSO assertion validation, NFR-95 tenant MFA, NFR-96 per-tenant residency, NFR-97 Enterprise availability commitment. | The deferred register wins: **NFR-94 … NFR-105 mean what section 6.2 says they mean.** The four proposals have since been **renumbered to `NFR-106` … `NFR-109` in `architecture.md` §17.3**, above the deferred register, so the collision is now **closed** rather than open. **They are now ratified into this register as §4.16 (18 Aug 2026)**, at NFR-106 … NFR-109, leaving the deferred register's meanings untouched. Their substance is real and closes the section 7.4 gap; only their original numbering was wrong. |
| **C-5** | **Requirement count.** The task brief anticipated approximately 97 NFRs. The primary register states 93 and the count is verifiable row by row; the deferred companion adds 12. | **93 MVP requirements (NFR-1 … NFR-93) and 12 deferred (NFR-94 … NFR-105), 105 identifiers in total.** Verified by counting the register against its own stated per-category distribution, which reconciles exactly: 8+7+5+8+5+7+5+6+6+12+4+6+4+6+4 = 93. |
| **C-6** | **Stale cross-document boundary.** The deferred NFR companion states that functional IDs resolve to the FR register "and its own deferred companion", and the FR deferred companion states that the FR register holds **159** MVP requirements with "FR-160 and above" existing only in the deferred document. The FR register has since grown to **173** and occupies FR-160 … FR-173. | The current FR register wins on its own content: FR-1 … FR-173 are MVP. The FR deferred companion's boundary statement is stale, which is the root cause of C-1. Recorded, not corrected here — it is a functional-register defect. |
| **C-7** | **"Eleven of NFR-1 … NFR-13 are cited from inside the functional register."** The claim is ambiguous between eleven citation *sites* and eleven distinct *IDs*, and it matters because it is the evidence for which legacy requirements lack a functional counterpart. | Both readings verified and both hold: there are **eleven citation sites** in the MVP functional register (§7.2), and **eleven of the thirteen distinct legacy IDs** are cited once the deferred FR companion is included. The two uncited under either reading are **NFR-5 and NFR-8**, which confirms the coverage gap in §7.3 rather than contradicting it. |
| **C-8** | **NFR-72 is verified by NFR-36, but NFR-36 tests less than NFR-72 asserts.** NFR-72 requires fiscal documents retrievable independently of the application, **the database and the hosting provider**. NFR-36 requires them readable independently of **the application** only, verified by annual restore-and-read from cold storage. Hosting-provider independence is asserted and not tested. | Both statements preserved verbatim; the shortfall is recorded rather than papered over by rewriting either. NFR-36's verification method needs extending to cover retrieval without the database and without the hosting provider, or NFR-72 needs its own method. Carried as OQ-14. This is the one instance where the "verification named once" convention (§2.3) does not fully hold. |

---

## 10. Open questions

Sixteen items, of which **six are now closed** — OQ-2, OQ-3, OQ-5, OQ-13 and the mail half of OQ-9 as of 18 Aug 2026, and OQ-16 raised and closed on 25 Aug 2026. OQ-4, OQ-6, OQ-7, OQ-8, OQ-10 and OQ-15 remain open because a source states an obligation without a threshold, and no number has been supplied for any of them here.

| # | Question | Origin | Consequence if unresolved |
|---|---|---|---|
| **OQ-1** | **Closed 18 Aug 2026 — the deferred set is renumbered FR-176 … FR-189.** The mapping is permanent, carried as the `Was (source)` column of `functional_requirements.md` §8, so citations using source-numbered IDs still resolve. The nine dependent citations in §6.2 are rewritten. | C-1; carried from the consolidated functional baseline's OQ-1 | Resolved. Also closed in `functional_requirements.md` OQ-1. |
| **OQ-2** | **Closed — the filing window is April–May, peaking in the final two weeks of May.** Authority: Article 33(3) of Law 287/2017 (150 days after a 31 December year end); the 120-day/30 April deadline applies only to public-interest entities, which are outside this population. VSME reporting is voluntary and has no deadline of its own, so the window is carried as a labelled proxy for the financial-statement date. The scale envelope in §3 is amended accordingly and the earlier March–April assumption is superseded. | §3; C-3 | Resolved. NFR-44's load test and 24-hour soak, NFR-48's tightened availability target and change freeze, and NFR-92's error-budget review period are all now planned against April–May. Reopens only if Moldova's draft sustainability-reporting law sets a submission date of its own, in which case the proxy is replaced by that date and the three dependent requirements are re-planned. |
| **OQ-3** | **Closed 18 Aug 2026 — NFR-47's ceiling is €0.50 per active free-tier organization per month.** Authority: `architecture.md` §17.1, ratified per C-3. At the 2,000-organization envelope that is €1,000/month, comfortably above a three-VM EU footprint plus object storage and mail, so it functions as an alarm threshold rather than a constraint on normal operation. Measured from the FR-105 metering stream. | NFR-47; C-3 | Resolved. The register's only cost requirement is now verifiable. Reopens if the scale envelope in §3 moves by an order of magnitude, which re-derives it along with every other envelope-indexed threshold. |
| **OQ-4** | **Closed 18 Aug 2026 — NFR-64's bounds are set** by `architecture.md` §12.5.6: auth paths rate-limited to 5 attempts / 15 min per (IP, account); FR-4's lockout threshold is **10 consecutive failures**; tokens **≥ 256 bits** from a CSPRNG, stored SHA-256, compared in constant time, single-use; lifetimes — reset 60 min, verification 24 h, invitation 7 days. | NFR-64 | Resolved. The abuse-path suite has a pass condition and "high-entropy" has a number. See `architecture.md` §12.5 |
| **OQ-5** | **Closed 18 Aug 2026 — the instrument is Law No. 195/2024 on personal data protection.** It replaces Law No. 133/2011 (which the task brief named) and becomes applicable **23 August 2026**. It substantially transposes Regulation (EU) 2016/679. Recorded in §4.6 and in NFR-5. | NFR-5, NFR-27 | Resolved, and the resolution shrinks the problem: because 195/2024 transposes GDPR, the divergences that drive retention and cross-border transfer decisions are far narrower than a separate national regime would have implied. The annual compliance review (NFR-5's verification) now has a named instrument. **Note the date — the law becomes applicable five days after this decision**, so any DPA, records-of-processing template or privacy notice drafted against 133/2011 is drafted against a superseded act. |
| **OQ-6** | **What is NFR-76's target completion time for a first Basic Module report?** The requirement states ≥ 80% task success "within the stated target completion time"; no source states the time. | NFR-76 | The pre-launch usability test with ≥ 8 participants has a success-rate criterion and no time criterion, so a report completed successfully in four hours passes. |
| **OQ-7** | **What plain-language reading level does NFR-78 require, and measured by what index in Romanian?** | NFR-78 | Editorial review at content publication is a judgement call with no stated bar, in a locale where common readability indices are calibrated for English. |
| **OQ-8** | **How long is NFR-83's API deprecation window?** | NFR-83 | A breaking change can be introduced in a new version with any notice period and still comply. |
| **OQ-9** | **Partly closed 18 Aug 2026.** NFR-84's transactional-mail delivery rate is **≥ 99% accepted delivery, monthly**, ratified per C-3 and extended by NFR-108. **NFR-71's e-Factura reconciliation tolerance remains open** and is now the whole of this question. | NFR-84, NFR-71; C-3 | Deliverability monitoring has an alarm point. The remaining half is the sharper one: NFR-71's daily reconciliation must show "zero unacknowledged invoices beyond tolerance", and with no tolerance the check cannot distinguish a timing lag from a compliance failure — under a mandate that takes effect **1 October 2026**. This needs the e-Factura platform's own acknowledgement SLA to answer, which is a first-hand verification task against the national platform, not a decision. |
| **OQ-10** | **Closed 18 Aug 2026 — NFR-88's floors are set** by `architecture.md` §12.5.6: invoice numbering and VAT calculation **100% line and branch**; emissions calculator 95/90; validation engine 95/90; entitlement service 90/85; project-wide 80, reported alongside but never in place of the five. | NFR-88 | Resolved. The CI coverage gate has thresholds, and the requirement's real content — per component, not as a project average — is now enforceable as well as stated. The two 100% floors are set there because a missed branch in gapless numbering (DR-8) or VAT is a compliance defect on an immutable transmitted document, and both units are small and pure. See `architecture.md` §12.5 |
| **OQ-11** | **Is there any priority ordering inside the 93 MVP requirements?** The sources state none, and state explicitly that category size is not a weighting for estimation, staffing or risk. | §2.5 | 93 requirements are all "Must" against a schedule the architecture document elsewhere assesses as not fitting the original 4–6 month target. With no ranking, scope pressure will select silently rather than deliberately. |
| **OQ-12** | **Do NFR-5 and NFR-8 need functional requirements?** Neither GDPR / EU-EEA hosting nor responsiveness-and-year-end-scaling has any FR written against it. The erasure-versus-retention interaction is stated only inside FR-130, and only for fiscal documents. Also logged in `functional_requirements.md` OQ-5. | §7.3; confirmed against both functional registers | A data subject erasure request has one defined behaviour — fiscal documents are retained — and no defined behaviour for anything else. NFR-28's 30-day fulfilment obligation has no functional mechanism behind it. |
| **OQ-13** | **Closed 18 Aug 2026 — ratified as NFR-106 … NFR-109, §4.16.** Dispatch p95 ≤ 60 s; exponential retry bounded at 24 h with suppression on first hard bounce; ≥ 99% accepted transactional-mail delivery, SPF/DKIM/DMARC-aligned; delivery records retained for organization life + 1 year. The NFR-94 … NFR-97 numbering collision is closed by the renumbering. | §7.4; C-4; the FR register's own closing note | Resolved. FR-170's delivery records — the evidence that a required update was actually requested — now carry a retention period, and FR-171's "bounded schedule" is verifiable against 24 hours. Also closes `use_cases.md` OQ-5, `functional_requirements.md` OQ-3, `architecture.md` OQ-2 and `design_spec.md` OQ-11. |
| **OQ-14** | **Addressed 18 Aug 2026, verification pending first rehearsal.** `architecture.md` §12.5 answers this structurally rather than by amending NFR-36: the fiscal archive is placed on **a different provider from compute** (Scaleway vs Hetzner), so provider-independence is true by construction, and **one restore rehearsal per year must restore to a non-Hetzner host** from the object store alone. | C-8 | The gap between NFR-72's assertion and NFR-36's verification is closed by adding the provider-independent rehearsal, not by weakening the claim. **Remains open until the first such rehearsal is performed and recorded** — until then the six-year archive's survival of hosting-provider loss is planned for but still unevidenced. See `architecture.md` §12.5 |
| **OQ-15** | **Three deferred requirements are unquantified.** NFR-94 requires directory-driven deprovisioning "within a stated latency"; NFR-101 requires a minimum benchmarking cohort size; NFR-105 states no metric for public-portal read scale, caching or anti-scraping. NFR-97's contractual commitment is deliberately held in a commercial document, not here. | §6.2 | Not blocking at MVP. Each must be quantified at promotion into build scope, or it will be promoted as an untestable obligation. |
| **OQ-16** | **Raised and closed 25 Aug 2026 — NFR-27's enumeration is illustrative, and the requirement is stricter than GDPR by design.** The five artefacts it names enumerate *where* customer data rests, not *whose* systems are in scope: **sub-processors are bound**, and the rule relies on **no adequacy decision and no SCCs**. Authority: project owner. Both halves are amendments to the NFR-27 row in §4.9, applied in the same edit. | Raised while planning `task.md` 51.1: NFR-27 was being cited to exclude a US transactional-mail provider, and its own text did not say that. | **Resolved, and it is a correction rather than a new rule.** The document already read NFR-27 this way in three places — the row's own verification is a *quarterly sub-processor register review*; `architecture.md` §10.7 credits self-hosted observability with adding "no sub-processor"; §12.5 chooses Hetzner so "no CLOUD Act argument has to be made in a compliance product's sub-processor register". None of that is derivable from the sentence as written, which is the defect §17.1 corrected elsewhere: a requirement whose intent had outrun its own wording. **It also ends a live misuse.** GDPR does *not* forbid a DPF-certified US provider — the EU–US Data Privacy Framework is valid, the General Court dismissed the Latombe challenge in September 2025, and the appeal in C-703/25 P has not suspended it. NFR-27 excludes one anyway, and now says so **as a platform decision rather than being mistaken for the law**. Stating the position is also what makes the rule outlive its own dependency: Safe Harbour was annulled in 2015 and Privacy Shield in 2020, so a rule resting on the third adequacy decision would have to be re-argued on a judgment date rather than held. |

---

*Canonical non-functional requirements baseline. Consolidates "ESG Platform Non-Functional Requirements (MVP)" and "ESG Platform Non-Functional Requirements — Deferred Scope, Coverage and Traceability (MVP)". Functional requirements follow "ESG Platform Functional Requirements (MVP)" and its deferred-scope companion; use cases follow "ESG Platform Use Case Register (MVP)"; design decisions `D-1` … `D-14` follow "ESG Platform Use Case Design Decisions and Constraints (MVP)"; actor definitions follow "ESG Platform System Actors (MVP)" as extended by the use case register. Supersedes section 4 (Non-Functional Requirements) of "ESG Platform Actors, Use Cases, FR and NFR (MVP)" in presentation only, retaining NFR-1 … NFR-13 unchanged in meaning; that document's sections 1 and 2 remain in force for the forward-looking actors and external systems. Amendments proposed in "ESG Platform System Architecture (MVP)" §15 are recorded in section 9, C-3 and C-4, and are not applied.*

