# ESG Platform — Problem Overview (MVP)

| Field | Value |
|---|---|
| Document ID | problem_overview.md |
| Version | 1.0 |
| Status | Consolidated baseline |
| Date | 2026-08-17 |
| Consolidates | *ESG Platform Research and Architecture Notes*; *ESG Platform Revised Scope and Decision* (Build-vs-Partner Decision & Re-Scoped MVP ToR); *ESG Platform Private Monetization Architecture*; *ESG Platform Architecture Overview (MVP)* (scope boundaries only); *(draft) ToR platforma ESG* and the Moldova ESG reporting guide (context) |

---

## 1. Purpose of this document

This document is the top of the specification set. It states **why the platform exists, who it is for, what the MVP does and does not include, on what commercial basis it operates, and which decisions have already been taken and closed**. It is the reference every other document in the set defers to on questions of problem framing and scope boundary.

It does not specify behaviour, interfaces, requirements or technology. Those live in the six companion documents listed in §12. Where this document names a scope item, the companion registers are authoritative for its detail; where a companion document appears to widen scope beyond §6 of this document, this document governs until amended.

This is a consolidation, not a new analysis. Every substantive statement traces to one of the sources named in the metadata table above. Where sources disagreed, the more recent and more decision-bearing document was preferred and the resolution is recorded in §7.1. Genuine gaps are recorded in §13 rather than filled.

---

## 2. Problem statement

### 2.1 Who has the problem

The small and micro business — typically 10 to 250 employees, with no sustainability function, no ESG specialist, and no dedicated compliance budget. In practice the person who has to solve the problem is an owner, an office manager, or a bookkeeper, working from invoices and payroll records rather than from an emissions inventory.

### 2.2 What the problem is

The EU's Corporate Sustainability Reporting Directive (CSRD) obliged large companies to disclose detailed sustainability data covering their **value chains** — that is, data about their suppliers and customers. Because no shared request format existed, the practical consequence for small suppliers was a stream of **ad-hoc, mutually inconsistent ESG questionnaires** arriving from banks, investors, corporate customers, and tender processes. Each request asked for overlapping data in a different shape, each had to be answered separately, and none of the answers could be reused.

### 2.3 What it costs them today

- **Duplicated effort.** The same energy, workforce and governance data is re-derived and re-typed for every requesting counterparty. Eliminating this duplication is the problem the VSME standard was itself created to solve, and it is the metric the platform proposes to measure itself against (§9).
- **Exposure on access to markets and finance.** Demand is not driven by a direct legal mandate on the SME. It is driven by banks, buyers, tenders and export-market access — the same channels through which the cost of *not* answering is loss of a customer, a credit facility, or a contract.
- **No credible cheap route to a compliant answer.** The official free instrument — EFRAG's VSME Excel Digital Template — is a spreadsheet with dropdowns, conditional checkboxes and consistency formulas. It is correct and free, and it presumes a reader who can interpret the standard. That is not the target user.
- **Tooling that is priced or scoped for someone else.** The tools that automate this work either target the upper end of the SME range or are enterprise platforms whose cost structure is an order of magnitude above what a micro-business will spend on compliance software.

### 2.4 The one-sentence framing

The platform's job is **not** "help SMEs comply with a mandate" — for most SMEs there is not yet one. It is:

> Give an SME a free, credible, low-effort way to produce a VSME-standard sustainability report that satisfies banks, EU buyers and future domestic requirements — **once, reusably**.

---

## 3. Business and regulatory context

### 3.1 The chain of causation

CSRD obliged large companies to disclose value-chain data → SMEs received unstandardised questionnaires → the EU simultaneously (a) narrowed mandatory CSRD scope sharply through the "Omnibus" simplification package and (b) issued a free, standardised **voluntary** SME format, VSME, which also acts as a **legal ceiling** on what large companies may demand from small ones. That ceiling is the platform's regulatory anchor.

### 3.2 EU instruments and dates as evidenced in the sources

| Instrument | State as recorded | Relevance |
|---|---|---|
| **CSRD, post-Omnibus** | Mandatory scope narrowed to >1,000 employees **and** >€450M net turnover (previously any two of: 250+ employees / €40M turnover / €20M balance sheet), removing roughly 80% of previously in-scope companies. Wave 3 "listed SME" obligations eliminated entirely. 250–1,000 employee band delayed to FY2027 (filed 2028). Assurance softened from reasonable to limited. Legal basis Directive (EU) 2026/470 — Official Journal 26 Feb 2026, in force 19 Mar 2026, transposition due 19 Mar 2027 (CSDDD parts 26 Jul 2028) | Almost no European SME is *directly* obliged to report. Demand is indirect and voluntary |
| **Revised ESRS** | EFRAG technical advice Dec 2025; Commission delegated act adopted 3 Jul 2026, cutting ~1,073 data points by roughly 70% (to ~320). FY2027+, voluntary early adoption FY2026. Still inside the Parliament/Council scrutiny window at time of research — figures near-final, not locked | Not the platform's reporting target, but sets the shape of what large counterparties will hold |
| **VSME** | Voluntary Sustainability Reporting Standard for non-listed micro, small and medium undertakings. Built by EFRAG at the Commission's request; final standard 17 Dec 2024; adopted as Commission Recommendation (EU) 2025/1710 on 30 Jul 2025; formalised by delegated act 3 Jul 2026 (now sometimes styled "Voluntary Standard (VS)"). Effective FY2027, early adoption FY2026 | **The platform's core data model** |
| **Value chain cap** | Omnibus mechanism now in the amended CSRD text: CSRD-obligated companies may not demand more sustainability data from value-chain counterparties with ≤1,000 employees than VSME's "necessary" disclosures cover. Classification of which data points count as "necessary" was still under public consultation as of May 2026 | Makes VSME's Basic Module the de facto and de jure ceiling on counterparty requests — the reason a VSME-native model beats a proprietary one |
| **ESAP** | EU-wide machine-readable registry of financial and sustainability disclosures, built on XBRL. Data collection from July 2026; full public launch July 2027 | Eventual submission target; VSME's XBRL taxonomy is designed to be ESAP-ready. Roadmap, not committed |

### 3.3 Moldova

- The **Ministry of Finance** has a draft amendment to the Law on Accounting and Financial Reporting adding a sustainability-reporting chapter, modelled on the post-Omnibus EU approach: mandatory disclosure only above **>1,000 employees and >9,024,165,000 MDL (~€450M) revenue**, with an **opt-out for smaller value-chain suppliers** — replicating the EU's value-chain-cap logic domestically. Public consultation ran to **19 August 2026**. This is the platform's concrete near-term domestic legal hook.
- The **Ministry of Economic Development (MDED)** runs a sustainability-outreach webpage; **40 business associations** including AmCham Moldova signed a joint declaration backing ESG adoption; UNDP has held ESG conferences in Chișinău. This is available institutional momentum for outreach and pilot recruitment.
- **Filing seasonality is a domestic legal fact, not a preference.** The reporting peak is April–May, concentrated in the last two weeks of May, deriving from Art. 33(3) of Law 287/2017 (150 days after year end).
- **National e-invoicing (e-Factura) becomes mandatory for B2B from 1 October 2026** — a hard external date on the platform's billing scope.
- Moldova's own larger reporters (per the ministry's Annex 6 list — Purcari, maib, Moldcell) report under ESRS or GRI, not VSME. The SME/VSME segment locally is genuinely greenfield, and those large reporters sit on the **demand** side of an SME's VSME report.

### 3.4 Standard-side facts that constrain the build

- VSME is **two-tier and additive**: Basic Module **B1–B11** first, Comprehensive Module **C1–C9** on top. Micro-undertakings may use a reduced subset of Basic. The July 2026 formalisation did not change this structure.
- **Basic Module contents:** B1 basis for preparation · B2 practices, policies, future initiatives · B3 energy and GHG emissions · B4 pollution · B5 biodiversity · B6 water · B7 resource use, circular economy and waste · B8 workforce characteristics · B9 health and safety · B10 remuneration, bargaining and training · B11 corruption and bribery.
- **Comprehensive Module contents:** C1 strategy — business model and sustainability-related initiatives · C2 practices, policies and future initiatives for the transition · C3 GHG reduction targets and climate transition · C4 climate risks · C5 additional workforce characteristics · C6 human rights policies and processes · C7 severe negative human rights incidents · C8 revenues from certain sectors and exclusion from EU reference benchmarks · C9 gender diversity ratio in the governance body. **Added 25 Aug 2026 with OQ-12's promotion**; names follow the published EFRAG standard because NFR-2 makes element names the schema's vocabulary, not labels over it.
- **Conditional applicability is part of the standard**, not a UI nicety: B8 turnover rate only at ≥50 employees, B10 gender pay gap only at ≥150 employees, biodiversity site-driven, water sector-driven.
- **Comparative-year data is mandatory from year two onward** — multi-period records per entity are a day-one requirement, not a later feature.
- **The official tooling is free.** The Digital Template (v1.3.0 as of June 2026, 11 languages, with a data-migration tool) maps each named range **exactly by local name** to an XBRL taxonomy element; the Digital-Template→XBRL converter is **MIT-licensed, open-source and self-hostable**.
- **The taxonomy churns.** Entry points seen at `2026-02-01` and `2026-05-01`; the February 2026 release carried **backwards-incompatible changes**. Taxonomy version must be pinned per report.
- **The taxonomy carries no business-rule validation.** As of the February 2026 explanatory note, completeness and consistency checking exists only in the Excel template's formulas. The platform must own that logic, including reproducing the template's validation states (`OK` / `MISSING VALUE` / `VALUE INCONSISTENCY` / `ERROR` / `INVALID URL`).
- **Entity identifiers supported by the standard:** LEI (preferred, supports digital signatures), DUNS, EU ID, PermID.

### 3.5 Competitive position

Three tiers exist: VSME-native SME-first SaaS (often €0–250/month, wizard-driven, frequently AI-assisted); multi-framework platforms scaled down from enterprise tooling; and true enterprise platforms that are not SME-targeted and function as non-competitors. Two findings matter for scope:

1. **Integrations are the market's white space.** Integrations with accounting software, ERPs, energy providers and banks are almost never documented publicly, even by dedicated comparison sites. A platform that ships genuine energy-provider and accounting integrations would be ahead of the field — but this is also the technically hardest item, and it is deliberately outside the MVP (§6).
2. **The local segment is open.** CO2Later is the only Romania-headquartered VSME tool identified and it targets SMEs above ~100 employees / €10M revenue. A micro/small-first, Romanian-language product has room.

---

## 4. Target users and market segment

### 4.1 Segment

Non-listed micro, small and medium undertakings — the population VSME was written for — with Moldova as the home market and the EU/EEA as the addressable market. The initial planning envelope is **≤ 2,000 organizations, ≤ 3,000 users and ≤ 2,500 reports per year**, with the load concentrated in the April–May filing window.

Priority sectors named in the original ToR for early implementation were energy, agriculture and manufacturing, on environmental-impact grounds. Moldova's export orientation toward EU markets is the practical reason an SME here encounters a VSME request at all.

### 4.2 Recognised roles at MVP

The platform recognises six actor codes. These are permission boundaries, not job titles; one person may hold several.

| Code | Actor | Role in the problem |
|---|---|---|
| **CA** | Common Access | Any authenticated user: registration, credentials, profile, memberships |
| **RC** | Reporting Contributor | The person who actually fills the report, runs the calculator and exports |
| **OA** | Organization Administrator | Entities, identifiers, periods, users, plan and billing |
| **PA** | Platform Administrator | Content, translations, taxonomy versions, factor sets, plans, support grants |
| **BO** | Billing Operator | Internal finance: reconciliation, dunning, refunds, fiscal reporting |
| **SYS** | System | Scheduled and event-driven behaviour with no human initiator |

### 4.3 Roles anticipated but not built at MVP

Each maps to a monetization model in §8 and to a tenancy shape the data model must not preclude: **Advisor / Accountant** (one org managing many client orgs, Model 3); **Corporate Buyer / Enterprise User** (a large obligated company monitoring supplier VSME data, Model 4); **Institution / Licensee Administrator** (a government, chamber of commerce or association white-labelling the platform — this is where the original Moldova/MDED scenario now sits, Model 6); **Assurance / Referral Partner** (Model 5).

### 4.4 The external reader

An SME's report is produced for someone else to read: a bank, an EU corporate buyer, an auditor, a tender evaluator. The generated document is therefore a first-class surface with its own audience, not a print view of the application.

---

## 5. Product vision and value proposition

### 5.1 Vision

A multi-tenant SaaS on which a Moldovan SME can produce a VSME Basic Module (B1–B11) sustainability report — and, since 25 Aug 2026 (OQ-12), the Comprehensive Module (C1–C9) additively over it — in Romanian, English or Russian, calculate Scope 1 and location-based Scope 2 emissions, and export to PDF and the official EFRAG Excel Digital Template.

### 5.2 The guiding architectural principle

**Build the reporting core around VSME's free, open data model and export tooling; treat everything else as modules layered on a VSME-shaped data spine.** A proprietary schema has no legal standing and no efficiency gain — a company would still have to fill out VSME for other counterparties. Modelling the internal schema on the VSME taxonomy's own element names minimises translation cost at export and keeps the platform aligned to a moving but authoritative external standard.

### 5.3 Value proposition

| Value | Mechanism |
|---|---|
| **Enter once, export many** | One VSME dataset produces a PDF for a bank, the official Excel for a buyer's portal, and later iXBRL and public/ESAP submission. This is the standard's own stated purpose and the platform's headline feature |
| **The standard interpreted for you** | Guided wizard over B1–B11 with conditional applicability evaluated live from B1 — fields are shown or hidden, never presented and then rejected |
| **Emissions without an emissions specialist** | Energy, fuel and fleet inputs in invoice units → conversion → factor set → Scope 1 and location-based Scope 2 in tCO2e, written straight into B3 |
| **Output an external reader will accept** | Official EFRAG template as the export target rather than an invented format; accessible, conformant PDF |
| **In the user's own language** | Romanian (source), English and Russian, all separately authored, none machine-translated |
| **Zero-cost entry** | The report-producing core is free to the SME; the commercial model monetizes elsewhere (§8) |

### 5.4 What cannot be the value proposition

EFRAG's Excel template and open-source converter are free, official and already available to any European SME. **The ability to produce a compliant VSME report is a commodity given away by the EU itself.** Every viable revenue path must sell convenience, automation, integration, collaboration, aggregation or distribution — never the compliance content. This constraint disciplines both pricing (§8) and scope: the platform's defensible work is the guidance, validation, calculation, reuse and distribution around the standard, not the standard.

---

## 6. Scope of the MVP

### 6.1 In scope

| # | Item | Note |
|---|---|---|
| 1 | Guided VSME **Basic Module** form, B1–B11 | Core reporting engine. Module choice is a **report-level flag** (D-A) — Basic is the default and Comprehensive is row 15, promoted into scope 25 Aug 2026 (OQ-12) |
| 2 | Conditional-applicability logic as business rules | ≥50 employees turnover rate, ≥150 employees gender pay gap, site-driven biodiversity, sector-driven water — evaluated from B1, configured not hard-coded |
| 3 | **Carbon footprint calculator** | Energy/fuel input → Scope 1 and location-based Scope 2 tCO2e → auto-populates B3. Raw inputs retained permanently in invoice units; every run pins its factor-set version |
| 4 | Validation engine | Presence, applicability, consistency (taxonomy calculation linkbase), range/format and cross-period rules; the template's validation states reproduced as first-class platform states, because the taxonomy does not enforce them |
| 5 | **Export to PDF and the official EFRAG Excel Digital Template** | The official `.xlsx` is populated, not replaced. Export history immutable |
| 6 | Multi-entity, multi-period reporting with comparatives | Comparative-year data is mandatory from year two; each period pins template and taxonomy version and links the prior period |
| 7 | Organizations, reporting entities, periods, users and permissions | Including a generic organization-relationship model from day one, so the §4.3 tenancy shapes need no schema change later |
| 8 | Identity and access | Email/password and Google/Microsoft social sign-in, invitations, opt-in TOTP, separate administrative realm with mandatory MFA |
| 9 | Three live locales — **ro** (source), **en**, **ru** | Interface, export and email language selected independently. Adding a fourth locale is configuration only |
| 10 | Notifications | In-app centre and email, per-recipient language, delivery records as compliance evidence |
| 11 | Self-serve billing and entitlements | Plan catalogue, entitlement service, orders, card and transfer rails, invoicing and numbering, **e-Factura** (mandatory from 1 Oct 2026), reconciliation, collections, refunds |
| 12 | Administrative console | Content and translation publishing, taxonomy-version registration and migration runs, factor sets, thresholds, validation rules, plans, adoption metrics, time-boxed support access |
| 13 | Regulatory-watch process | Quarterly cadence over EFRAG taxonomy releases, the value-chain-cap "necessary data points" classification, and Moldova's draft law — an ongoing function, not a kickoff task |
| 14 | Training and onboarding materials | Carried forward from the ToR deliverables |
| 15 | Guided VSME **Comprehensive Module** form, C1–C9, and the scope tier that sells it | **Added 25 Aug 2026 (OQ-12).** Additive over row 1 per D-A's report-level flag and NFR-2's element-name mirroring; carries its own conditional applicability, its own validation and export treatment, and a *Basic and Comprehensive* plan scope with upgrade pricing |

Registered but **inactive** at MVP: the merchant-of-record path.

### 6.2 Out of scope for the MVP

| # | Item | Disposition |
|---|---|---|
| 1 | VSME **Comprehensive Module** C1–C9 | **Promoted to §6.1 row 15 on 25 Aug 2026** (OQ-12, project owner). Was Phase 2, deferred on FR-177's reasoning that the schema already mirrors C1–C9 so the module is additive. The row is kept rather than deleted so the disposition column records the move and rows 2–6 keep their numbers |
| 2 | **XBRL / iXBRL export** via EFRAG's self-hosted open-source converter | Phase 2. The integration port exists; the adapter is Phase 2 |
| 3 | Company dashboards and deadline reminders beyond MVP notification categories | Phase 2 |
| 4 | **Energy-provider and accounting-software integrations** | Phase 3. Genuine market white space and the hardest item; needs provider-by-provider scoping and a feasibility study |
| 5 | **AI assistance** — narrative drafting, consistency and anomaly flagging | Phase 3. Consider IFC's free MALENA API for document-level risk-term flagging rather than an in-house model; legal authorship of report text stays with the company |
| 6 | **Public disclosure portal** | Phase 3, opt-in, field structure aligned to what ESAP will expect |
| 7 | **ESAP submission bridge** | Roadmap, **not committed** — blocked on Moldova's accession/connection status; ESAP itself only reaches full public launch July 2027 |
| 8 | **Blockchain traceability** | Roadmap, **not committed** — no concrete use case identified that XBRL plus an audit trail does not already serve. Speculative until a specific problem statement justifies it |
| 9 | Advisor multi-client management; buyer/supplier value-chain portal; marketplace and referral; institutional white-label instances; aggregate benchmarking | Anticipated in the tenancy and entitlement design (§8), not built at MVP |
| 10 | Integration with **Workiva** or **Greenstone/Cority** as SME-facing components | Dropped — see §7.1 |
| 11 | Regulator-facing enforcement, penalty and compliance-monitoring workflow from the original ToR | Not an MVP concern for a privately operated platform |
| 12 | Full ESRS/CSRD reporting for large obligated companies | Not the product. Named only as a non-competitor reference point |

---

## 7. Key scope decisions and their rationale

| ID | Decision | Rationale |
|---|---|---|
| **D-A** | **Model the platform on VSME, natively** — internal schema follows the VSME taxonomy's element names; Basic vs Comprehensive is a report-level flag driving form UI, validation and export | A proprietary schema has no legal standing and no efficiency gain; VSME's Basic Module is the legal ceiling on counterparty requests, so it is also the natural product boundary |
| **D-B** | **Hybrid delivery (Option 4 of the build-vs-partner matrix)** — own a thin reporting core, since EFRAG has already done the standard-setting and tooling work; partner, license or refer for anything expensive and fast-moving (AI, deep integrations, advanced analytics) | A full custom build re-invents a free EU standard and pipeline and takes on taxonomy-churn maintenance risk; pure subsidise-and-refer forfeits the guarantee of a free RO/EN on-ramp for the smallest businesses. Hybrid also matches EU funding instruments as written (TSI 2025 Flagship) |
| **D-C** | **Excel-first export before XBRL-first** — populate the official Digital Template, then pipe through EFRAG's converter when XBRL lands in Phase 2; keep XBRL-first generation as a later target | Lowest risk: reuses EFRAG's maintained validation logic and stays compatible with future template tweaks. XBRL-first means owning taxonomy-version tracking and migration, which the February 2026 breaking change shows is an ongoing job, not a one-off |
| **D-D** | **Privately owned and commercially operated, EU/EEA-hosted, with a monetization-flexible architecture** — the government/institutional scenario becomes one possible channel, not the plan | Removes dependency on any single government's e-ID and procurement cycle, lets any EU SME self-register, and reduces the cross-border data-protection question to ordinary GDPR compliance for an EU-hosted SaaS |
| **D-E** | **Free core, monetize around it; launch on freemium (Model 1)** with the entitlement and tenancy layers built correctly from day one | The compliance content is a commodity the EU gives away; the market has already converged on almost exactly this free/paid boundary. Retrofitting a multi-tenant hierarchy or a metering layer later is among the most expensive re-architectures available |
| **D-F** | **Taxonomy-version discipline and configuration-driven rules** — store the taxonomy version against every report, author version-to-version mappings deliberately, keep thresholds and validation rules as published configuration | The taxonomy and the "necessary data points" classification are both still moving; a compatible rollout must not require a code release |
| **D-G** | **The platform owns validation logic** | The taxonomy carries no formula/business-rule validation; delegating to it would leave reports unchecked |
| **D-H** | ~~**LEI as primary entity identifier**, DUNS / EU ID / PermID as fallbacks~~ — **superseded 18 Aug 2026 by `architecture.md` OQ-18: IDNO is primary, LEI is an optional additional identifier, and DUNS / EU ID / PermID are not modelled at MVP** | The original reason stands as far as it goes — the standard's own preference; LEI supports digital signatures and keeps the platform interoperable with EU registries and eventually ESAP. It was reversed on **population** grounds, which this decision did not weigh: LEI carries an annual fee and is held by very few Moldovan SMEs, so as the primary key it would be empty for the large majority, while IDNO is universal, free and already the `billing` context's identifier. LEI is retained as an optional field so B1 stays VSME-conformant for the banks and EU buyers who need one. **This row is the source every stale downstream mention was derived from** (FR-16's acceptance column, UC-51, S-15, actors.md's OA row), all corrected 28 Aug 2026 |
| **D-I** | **Success metrics defined before build, and used to gate Phase 3** | None were specified in the original ToR. Adoption is voluntary near-term; the expensive later features should be justified by demand data, not by assumption |
| **D-J** | **Quarterly regulatory watch as a funded ongoing function** | Not a one-time "we researched this at kickoff" assumption |

### 7.1 Superseded decisions

| Superseded position | Source | Resolution in this baseline |
|---|---|---|
| Government-owned platform, delivered by MDED, hosted on `sustenabilitate.gov.md`, free to all Moldovan SMEs | Research Notes; Revised Scope and Decision, Part B | **Superseded** by the Private Monetization Architecture (later document, and the reframe that the Moldova ToR and communication plan were illustrative examples rather than the target). The platform is privately owned and commercially operated; the ministry/association scenario is retained as monetization **Model 6** and the original ToR is retained as a target-account brief. The hybrid *build* logic (D-B) survives the change of owner intact |
| Integrate **Workiva** and **Greenstone** as SME-facing reporting components; integrate **Malena** | Original ToR | **Superseded.** Workiva is confirmed enterprise-positioned (third-party median annual spend ~$49,957, range ~$12,596–$153,530, before implementation) and contradicts the platform's own cost-reduction goal. Greenstone was acquired by Cority in May 2023 and folded into Cority Sustainability Cloud — any procurement conversation goes to Cority, and SME-friendliness claims are unverified. "Malena" is identified with high confidence as IFC's free MALENA document-analysis tool, which is a document/text risk-flagging service, not a reporting engine — scoped to optional Phase 3 at most. All three are out of MVP scope |
| Report against **CSRD/ESRS** as the platform's target framework | Original ToR | **Superseded** by VSME (D-A). Post-Omnibus, almost no SME is in direct CSRD scope, and VSME is both free and the legal ceiling on what counterparties may request |
| **8 months** for the full original scope | Original ToR | **Superseded.** 8 months was assessed as realistic only for an MVP, and the Revised Scope proposed ~4–6 months for a free government core. The current MVP register — 173 FRs and 93 MVP NFRs, including self-serve billing, Moldovan fiscal compliance and three locales — carries an **8–12 month build** estimate. The later, larger estimate governs; the difference is the commercial and fiscal scope added by D-D and D-E, not scope creep in the reporting core |
| **Romanian and English** only | Revised Scope and Decision | **Superseded.** Three live locales: Romanian (source), English, Russian. Note the standing caveat, **corrected 31 Aug 2026** (OQ-5 closed): EFRAG publishes no Russian template *and* ships an empty Romanian label linkbase, so **both** are platform-authored and carry no official standing; an export intended for a bank or EU buyer should be produced in **English** |
| Public consultation on Moldova's draft law described as *open* in one source and *closed* in another | Research Notes vs. Revised Scope and Decision | Both refer to the same date, **19 August 2026**. Treated here as a date to monitor; the final text is an open question (§13) |

---

## 8. Business model and monetization approach

### 8.1 The launch model

**Model 1 — freemium to subscription tiers, direct-to-SME, self-serve.** The free tier covers the VSME Basic Module wizard and PDF export. Paid tiers unlock the Comprehensive Module, XBRL/iXBRL export, multi-year comparative reporting, AI-assisted narrative drafting, integrations and multi-user collaboration. Model 1 is chosen for launch because it needs the least go-to-market complexity, validates product-market fit fastest and cheapest, and matches the segment's price sensitivity. Market evidence for this boundary: ExecutESG (free Basic / €49/mo Pro), Sustain Republic (from €149/year), Leadity (~€199/mo), GoClimate (€30–215/mo), Planted (free tier + €169/mo).

### 8.2 The model menu the architecture must keep open

| Model | Mechanics | Evidence / note |
|---|---|---|
| **1. Freemium → subscription** | Free Basic + PDF; paid tiers unlock the rest | **Active at launch.** Free users cost money to support — needs real usage limits and a genuine upgrade trigger |
| **2. Usage / consumption** | Per report, per XBRL export, per API call, per supplier monitored | Needs metering infrastructure most SME competitors have not built — an opportunity as much as a cost |
| **3. B2B2B embedded / white-label for advisors** | Seats or API access sold to accountants, auditors, ESG consultants and banks who serve many SME clients | groeneotter's done-for-you VSME service (~€960/year) evidences advisor-delivered demand. Requires "one org manages many client orgs" from day one |
| **4. Enterprise value-chain monitoring** | Charge the large obligated **buyer** for a supplier portal, aggregated dashboards and benchmarking; keep supplier-side SME accounts free or near-free | This is where the highest willingness-to-pay in the ecosystem sits, and it solves the structural problem that SMEs will not pay much for compliance software. Precedent: Greenstone SupplierPortal, EcoVadis-style platforms |
| **5. Marketplace / referral** | Consented referrals to assurance providers, offset providers, green finance, renewable suppliers | Monetizes the free base without raising its price. Must be a decoupled module with explicit consent gating |
| **6. Institutional licensing / white-label (B2G, associations)** | A branded instance licensed to a government, chamber of commerce or association that offers it free or subsidised to its constituency | **This is the Moldova/MDED scenario, recast as a customer segment.** Precedents: Enterprise Singapore's subsidised reporting programme (up to 70% of report-preparation cost via accredited providers); EU TSI 2025 Flagship funding for public authorities; an Italian ESRS/VSME platform already listed on Enterprise Europe Network seeking non-EU distribution partners through September 2026. Slow procurement; needs real white-label theming, per-tenant residency and per-licensee legal terms |
| **7. Aggregate benchmarking insights** | Anonymised sector/peer benchmarks sold to banks, investors, policymakers, or back to SMEs as premium insight | Needs anonymisation and consent rules designed in from the start; far harder to retrofit than to allow for |

### 8.3 The three-layer separation that makes this possible without a rebuild

1. **Compliance core — "the truth."** The VSME-shaped entity model (B1–B11, C1–C9), validation engine and PDF/Excel/XBRL generators. **No concept of plan, price or tenant type.** Identical for a free user and an enterprise contract. This is the trust asset.
2. **Commerce / entitlement layer.** An isolated service answering "can this org perform this action now," owning per-plan feature flags, usage counters, a metering event stream in which every billable action emits an event regardless of the active model, and billing-provider integration. Because it supports several pricing *units* concurrently (per seat, per report, per API call, per managed supplier), Models 1, 2 and 4 can run for different segments simultaneously.
3. **Distribution / tenancy layer.** A generic "orgs can hold typed parent/child/peer relationships with scoped permissions" graph, covering a direct SME org, an advisor org with N clients, a buyer org with N suppliers, and a licensee org with M sub-orgs — without schema change.

**Cross-cutting: API-first.** A complete documented API from day one, not a UI with an API bolted on, because that is what makes usage billing, B2B2B embedding, enterprise integration and white-labelling possible later without a separate engineering effort per channel — and it gives entitlement enforcement and metering a single natural chokepoint.

### 8.4 Sequencing

Launch on Model 1 with Layers 2 and 3 built correctly. Switch on Models 3, 4 and 6 later as **different packagings of the same core product**, once usage data justifies the heavier sales motions each requires. Treat Models 5 and 7 as adjacent revenue lines once report volume makes them worth building.

---

## 9. Success criteria and MVP acceptance

### 9.1 Adoption metrics — defined before build, and used as a gate

None were specified in the original ToR; these are the agreed set. Their purpose is explicitly to give the platform's owners a factual basis for deciding whether the expensive Phase 3 features (AI, live integrations, blockchain) are justified by demand rather than committing to them on assumption.

| # | Metric |
|---|---|
| M1 | Number of SMEs completing a full VSME Basic report within 6 months of launch |
| M2 | Number of reports exported or shared with a bank or corporate buyer |
| M3 | Average time to complete a report |
| M4 | User-reported reduction in duplicate ESG-questionnaire effort — the core problem VSME itself was created to solve |
| M5 | Excel/XBRL export usage rate, as a proxy for downstream reuse |

No numeric targets are set in the sources; setting them is an open question (§13).

### 9.2 MVP acceptance conditions

| # | Condition |
|---|---|
| A1 | An SME can complete B1–B11 for one entity and period, in any of the three live locales, and export a PDF and a populated official EFRAG Excel Digital Template |
| A2 | The carbon calculator produces Scope 1 and location-based Scope 2 figures that populate B3, with raw inputs retained and the factor-set version pinned per run |
| A3 | Validation reports per field, per module and per report, is idempotent at any level of completeness, and export is permitted with findings only after explicit warning, with gaps marked in the output |
| A4 | Every report pins its template and taxonomy version, and a version rollout can be executed as configuration plus a migration run, without a code release |
| A5 | Billing operates end to end — plan selection, order, payment, invoice issuance and numbering — and **e-Factura transmission is live by the 1 October 2026 statutory date** |
| A6 | The reporting core is demonstrably operable with billing disabled — the free-tier pilot milestone, which is also a standing verification that Layer 1 holds no commercial logic |
| A7 | Non-functional targets in the NFR register are met, including the filing-window posture for the April–May peak |
| A8 | Operational runbooks are delivered as artefacts, since several NFRs are verified by rehearsal rather than by test |

### 9.3 Phase gate

Phase 2 and Phase 3 are a **separately scoped engagement** informed by MVP usage data and funding availability — not a fixed continuation of the MVP clock.

---

## 10. Assumptions, constraints and risks

### 10.1 Assumptions

| # | Assumption |
|---|---|
| AS1 | Demand is indirect — driven by banks, buyers, tenders and export-market access, plus a forthcoming domestic law — not by a direct legal mandate on the SME |
| AS2 | VSME's Basic Module remains the practical ceiling on what counterparties may request from an SME |
| AS3 | EFRAG's Digital Template and converter remain free and openly licensed, and the standard's module structure remains stable |
| AS4 | The target user is not a sustainability specialist; guidance and validation are the product, not optional polish |
| AS5 | The institutional momentum in Moldova (MDED outreach, the 40-association declaration, UNDP activity) is available for pilot recruitment and onboarding partnerships |

### 10.2 Constraints

| # | Constraint | Origin |
|---|---|---|
| C1 | **The compliance content cannot be sold.** The official template and converter are free | Market/regulatory fact (§5.4) |
| C2 | **VSME structure and conditional-applicability thresholds are external** — the platform implements them, it does not choose them | The standard |
| C3 | **Taxonomy releases break compatibility** and must be pinned and migrated | Feb 2026 release |
| C4 | **The taxonomy enforces no business rules** — validation is the platform's own liability | Feb 2026 explanatory note |
| C5 | **Comparative-year data is mandatory from year two** — multi-period from day one | The standard |
| C6 | **e-Factura is mandatory for B2B from 1 October 2026** | Moldovan law |
| C7 | **Filing seasonality is fixed by proxy** — April–May, peaking in the last two weeks of May, derived from the financial-statement deadline in Art. 33(3), Law 287/2017 (150 days after year end). VSME reporting is itself voluntary and carries no statutory deadline; revisit if Moldova's draft sustainability-reporting law sets its own date (OQ-1) | Moldovan law, as a labelled proxy |
| C8 | **EU/EEA data residency** for primary store, replicas, backups, exports and logs; GDPR and Moldovan data-protection compliance | D-D, ToR |
| C9 | **Three locales, separately authored, none machine-translated**; Russian VSME labels carry no official EFRAG standing | Scope decision |
| C10 | **Russian and Romanian label sourcing depends on EFRAG's own translations** where they exist, used verbatim and diffed on every version rollout | Standard alignment |

### 10.3 Risks

| # | Risk | Mitigation as recorded |
|---|---|---|
| R1 | **Demand risk** — adoption is voluntary in the near term | The §9.1 metrics gate further investment rather than assuming uptake |
| R2 | **Standard-churn risk** — the taxonomy and the "necessary data points" classification are both still moving | Budget a recurring maintenance and regulatory-watch function; keep thresholds and rules as configuration; pin versions per report |
| R3 | **Vendor-dependency risk** if any licensing route is taken | Demonstrated by Greenstone's 2023 acquisition; any licence must carry data-portability and continuity clauses |
| R4 | **Scope-creep risk** — the original ToR's AI, blockchain and live-integration ambitions are reasonable long-term ideas but unvalidated near-term requirements | Keep them on the roadmap and explicitly out of MVP commitments (§6.2) |
| R5 | **Free-tier cost risk** — free users consume support and infrastructure | A per-organization free-tier cost ceiling is carried as a non-functional target; usage limits and a real upgrade trigger are required, not goodwill |
| R6 | **Commercial-scope risk** — billing, fiscal compliance and e-Factura are a statutory deadline sitting inside the MVP | Billing is sequenced so e-Factura lands in the first billing increment, against the 1 Oct 2026 date |
| R7 | **Overstated-partnership risk** — no public source confirms any contractual relationship between Workiva, Greenstone/Cority or MALENA and the Moldovan government; those pairings exist only in internal draft documents | Do not reference them as committed partners in any external communication |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **B1–B11** | The eleven disclosures of the VSME Basic Module |
| **C1–C9** | The nine disclosures of the VSME Comprehensive Module |
| **BNM** | Banca Națională a Moldovei — National Bank of Moldova; source of the official FX rate |
| **CBAM** | Carbon Border Adjustment Mechanism — named only in competitor framework coverage |
| **CSDDD** | Corporate Sustainability Due Diligence Directive |
| **CSRD** | Corporate Sustainability Reporting Directive — the EU directive obliging large companies to disclose sustainability data, including value-chain data |
| **DUNS** | Dun & Bradstreet entity identifier; VSME fallback identifier. **Not modelled at MVP** (OQ-18) |
| **e-Factura** | Moldova's national B2B electronic invoicing system; mandatory from 1 October 2026 |
| **EFRAG** | European Financial Reporting Advisory Group — author of ESRS and VSME, publisher of the Digital Template, XBRL taxonomy and converter |
| **Entitlement** | A decision on whether a given organization may perform a given action now, derived from its plan version plus any subscription-level override |
| **ESAP** | European Single Access Point — EU-wide machine-readable registry of financial and sustainability disclosures |
| **ESRS** | European Sustainability Reporting Standards — the CSRD reporting standards |
| **EU ID** | European unique identifier for companies; VSME fallback identifier. **Not modelled at MVP** (OQ-18) |
| **FTE** | Full-time equivalent |
| **GHG** | Greenhouse gas |
| **IDNO** | Numărul de identificare de stat — Moldova's state registry number for a legal person, assigned at registration. Free, universal across the tenant population, and already the `billing` context's identifier; the **primary** entity identifier per OQ-18 |
| **iXBRL** | Inline XBRL — human-readable document with embedded machine-readable tagging |
| **LEI** | Legal Entity Identifier — VSME's preferred entity identifier; supports digital signatures. **Optional here, not primary** (OQ-18): IDNO is the primary identifier, and few Moldovan SMEs hold an LEI. **Not the currency** — the Moldovan leu is written `MDL`, and its minor unit `bani`, everywhere in this set |
| **MALENA** | IFC's "Machine Learning ESG Analyst" — a free World Bank Group AI/NLP tool that scores unstructured ESG documents against ESG risk terms and IFC's E&S Performance Standards. Identified as the "Malena" of the original ToR |
| **MDED** | Moldova's Ministry of Economic Development (and Digitalization) — author of the original ToR; a Model 6 prospect |
| **MIA** | Moldova's instant payment system, operated under the National Bank, subject to a per-transaction ceiling |
| **NACE** | EU statistical classification of economic activities; a B1 field |
| **Omnibus** | The EU simplification package that narrowed CSRD scope and introduced the value chain cap |
| **PermID** | Refinitiv permanent identifier; VSME fallback identifier. **Not modelled at MVP** (OQ-18) |
| **Scope 1** | Direct GHG emissions from sources the undertaking owns or controls |
| **Scope 2 (location-based)** | Indirect GHG emissions from purchased energy, calculated using grid average emission factors |
| **SME** | Small and medium-sized enterprise; here specifically non-listed micro, small and medium undertakings |
| **tCO2e** | Tonnes of carbon dioxide equivalent |
| **TSI** | EU Technical Support Instrument; its 2025 Flagship funds public authorities building national ESG data hubs and automated SME disclosure tooling |
| **Value chain cap** | The Omnibus mechanism barring CSRD-obligated companies from demanding more sustainability data from counterparties with ≤1,000 employees than VSME's "necessary" disclosures cover |
| **VSME / VS** | Voluntary Sustainability Reporting Standard for non-listed micro, small and medium undertakings; styled "Voluntary Standard (VS)" after the July 2026 delegated act |
| **XBRL** | eXtensible Business Reporting Language — the machine-readable reporting syntax underlying the VSME taxonomy and ESAP |

---

## 12. Related documents

This document is one of seven. It governs problem framing and scope boundary; the others govern their own subjects.

| Document | Subject | Relationship to this document |
|---|---|---|
| `actors.md` | The actor register — CA, RC, OA, PA, BO, SYS — with definitions and permission boundaries | Expands §4.2 and §4.3 |
| `use_cases.md` | The MVP use case register, `UC-01` … `UC-176`, each with actor code and module, plus the design decisions (`D-n`) and constraints behind them | Realises §6.1 as discrete outcomes; `UC-17` … `UC-48` are the reporting-core set that must pass with billing disabled (§9.2 A6) |
| `functional_requirements.md` | The functional requirement register — 173 FRs, each traced to its source use case | The testable form of §6.1. Ranges as allocated: identity and profile `FR-1`…`FR-12`, `FR-56`…`FR-60`; reporting core `FR-13`…`FR-55`, `FR-83`; billing `FR-84`…`FR-152`. Export language is `FR-52`; per-recipient email language is `FR-169` |
| `non_functional_requirements.md` | The non-functional requirement register — 93 MVP NFRs (`NFR-1` … `NFR-93`) plus 12 deferred (`NFR-94` … `NFR-105`), with coverage and traceability | The measurable form of §9.2 A7 and A8, and of constraints C6–C9 |
| `architecture.md` | System architecture: containers, modules, data model, mechanisms, integrations, deployment, build order | Realises §5.2, §7 and §8.3. Its decision record (`AD-1` … `AD-14`) holds the rationale and rejected alternatives for architectural choices; §7 of this document holds the product-scope decisions |
| `design_spec.md` | Interface and interaction design: surfaces, information architecture, screen inventory (`S-01`…, `A-01`…), archetypes, print layer | Realises §4.4 and the guidance/validation value in §5.3 |

Identifier conventions that all seven share: actor codes are `CA` / `RC` / `OA` / `PA` / `BO` / `SYS`; use case IDs are zero-padded (`UC-01`, not `UC-1`) and are never renumbered or reused once assigned; FR and NFR IDs are unpadded (`FR-1`, `NFR-1`); design decisions are `D-n`, architecture decisions `AD-n`, screens `S-nn` for tenant surfaces and `A-nn` for administrative ones.

---

## 13. Open questions

| ID | Question | Why it is open |
|---|---|---|
| OQ-1 | **Narrowed 18 Aug 2026 — no longer blocking; a watch item.** Verified: the consultation is genuinely **open to 19 August 2026** (the source calling it closed was wrong), and the draft's substance is now known — mandatory disclosure only above **>1,000 employees and ~€450M revenue**, reported as a section of the management report rather than on a deadline of its own, and **taking effect on Moldova's EU accession**. | Three consequences. It creates **no near-term mandated population**, so the platform's initial market stays voluntary and value-chain-driven, as the scope already assumed. It sets **no separate submission date**, so the Law 287/2017 April–May filing-window proxy stands rather than being replaced (`non_functional_requirements.md` OQ-2, `architecture.md` §17.2). And what remains open is only the **final adopted text**, which is a quarterly-regulatory-watch item (NFR-12, D-J) rather than a build dependency. Also logged in `architecture.md` OQ-8 |
| OQ-2 | **Which VSME data points count as "necessary" under the value chain cap?** | Still under EU public consultation as of May 2026. Do not hard-code a field boundary into eligibility or entitlement logic until settled |
| OQ-3 | **What are the exact input fields, emission factors and output format of `angajamentpentrumediu.ro`'s carbon calculator?** | Named in the original ToR as the model for the platform's calculator, but the site was unreachable from the research environment. Requires first-hand verification before the calculator is modelled on it |
| OQ-4 | **Is IFC's MALENA the "Malena" of the original ToR?** | Identified with high confidence — no other public ESG product by that name exists — but unconfirmed with the ToR's author |
| OQ-5 | **Closed 31 Aug 2026 — Romanian labels are NOT official, so platform-authored label content is Romanian *and* Russian.** Authority: project owner, who authorised the download this row said the answer required. The `2026-05-01` package ships label linkbases for 23 languages and **twelve carry labels** — `en` 467, `sl` 401, and `da de es fr ga it lt nl pl pt` 319 each — while eleven files including `ro` are 1,161 bytes and hold zero; the Digital Template already in `config/efrag/` corroborates it with the same twelve in its Language Selection sheet. | **This row called its own shot and the answer went the other way.** It said *"if Romanian labels are official, platform-authored label content shrinks to Russian alone"* — it does not shrink; it doubles, and it includes the **source locale**. NFR-24 therefore binds **English alone** of the three live locales. Amended in the same change: NFR-23's note, NFR-24, T-14, UX-47 and UX-98, which between them had told a reporter to prefer *RO or EN* for a bank or EU buyer — pointing at a locale with no more standing than the one being caveated. Recorded on `architecture.md` §12.5.6's task-33.2 row, with the stub's likely impermanence and what re-checks it |
| OQ-6 | **Has the build-vs-license evaluation of VSME-native vendors been carried out and concluded?** | The Revised Scope required a formal evaluation (Envoria, Coolset, Greenomy, the EEN-listed Italian ESRS/VSME platform, which sought non-EU distribution partners through September 2026) before further engineering commitment to the reporting core. No record of its conclusion exists in the sources; the build proceeded |
| OQ-7 | **What are the numeric targets for M1–M5?** | The metrics are agreed; no target values appear in any source. Required before they can gate Phase 3 |
| OQ-8 | **What is the plan and price structure of the paid tiers?** | Model 1 is the launch model and the free/paid feature boundary is stated, but no price points for this platform appear in the sources — the figures cited are competitors'. Also logged in `use_cases.md` OQ-8 |
| OQ-9 | **What is the contractual status, if any, of Workiva, Greenstone/Cority and MALENA with the Moldovan government?** | Unconfirmed in any public source; the pairings exist only in internal draft documents. Must be resolved before any external communication references them |
| OQ-10 | **Is `sustenabilitate.gov.md` live, and what does it host?** | Could not be reached from the research environment. Now a Model 6 consideration rather than the MVP's hosting target, but still unverified |
| OQ-11 | **Which channel activates Model 6, and when?** | The original ToR is retained as a target-account brief for a ministry, chamber of commerce or EU-funded national initiative, but no timeline, counterparty or funding route has been fixed. Eligibility of Moldova for TSI-style funding via pre-accession or twinning mechanisms is also unverified. Also logged in `use_cases.md` OQ-2, `functional_requirements.md` OQ-6, `actors.md` OQ-5, `architecture.md` OQ-24 |
| OQ-12 | **Closed 25 Aug 2026 — the Comprehensive Module C1–C9 is promoted into MVP scope, commercial tier included.** Authority: project owner. §6.2 row 1 is marked *Promoted* rather than deleted, so the disposition column records the move; §6.1 gains row 15; `functional_requirements.md` FR-177 leaves the deferred range; `use_cases.md` gains UC-183 … UC-192; `architecture.md` §15.4's third step and `task.md` carry the work. | **Raised by the design set, decided against it.** Seven prototypes carry Comprehensive — `Reporting Core` ("adds nine sections", cover and identity line), `Commerce` (a sellable *Basic → Basic and Comprehensive* tier with upgrade pricing), `Organization Admin` (disclosures hidden until a threshold is crossed), `Reporting Screens` (the module added mid-report), `Admin Console` (a Comprehensive taxonomy version), plus `Exported Document` and `Help Centre`. Under `design_spec.md` OQ-10 a prototype is a rendered reference and never a normative source, so that is evidence of intent rather than a decision — which is why this row exists instead of the design being read as settling it. **What the investigation changed:** the mechanism was already MVP and only the content was deferred. D-A makes *Basic vs Comprehensive a report-level flag driving form UI, validation and export*; NFR-2 mirrors element names for B1–B11 **and C1–C9**; FR-177 deferred the nine disclosures precisely because that made them "additive rather than a rework". Neither D-A's flag nor NFR-2's mirroring had a `task.md` row — MVP work, unplanned, and the reason the design looked out of scope when it was not. **Cost accepted:** R-8 re-scoped the timeline once already, and this adds nine disclosure modules, their conditional applicability, and a second sellable scope tier to a register that grew fourfold before. The trade is that the product boundary now matches what the design was drawn against, rather than the design running ahead of the scope it was drawn for. |
