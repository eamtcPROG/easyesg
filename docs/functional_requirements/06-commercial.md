# Functional requirements — Part 6: Plans, subscriptions, entitlements and checkout

Part 6 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.17 Plan catalogue | FR-84 … FR-89 |
| 3.18 Subscription | FR-90 … FR-98 |
| 3.19 Entitlement and metering | FR-99 … FR-105 |
| 3.20 Billing account | FR-106, FR-107 |
| 3.21 Order and checkout | FR-108 … FR-113 |

Business rules held here: BR-ENT-1 … BR-ENT-5, BR-SUB-1 … BR-SUB-7, BR-FIS-1 (§4). Entities held here: §5.

**Where this part stands.** Billing is Stage 4 of `task.md` and almost none of it is built. What exists is a port and one interim ceiling: the entitlement port's interface (`apps/api/src/contracts/entitlement.port.ts`) with no implementation, the thirteen empty `modules/billing/*` modules, and task 142's seat ceiling, which is configuration and deliberately not an entitlement (`architecture.md` §12.5.6's task-142 row). Every block below says which of its behaviour is built. Where a block names no wire outcome, none is built, and the block states only what a source states. Everything a tester needs that no source decided was settled by the owner on 5 Oct 2026, and each block cites the task-182 row that records it.

**Who acts.** The Billing Operator (BO) defines the catalogue in A-09 (`actors.md` §5). The Organization Administrator (OA) alone runs the commercial side of a tenant: plan and usage status, the subscription lifecycle, orders, the billing account and invoices. The editor and view-only roles hold no commercial authority (`actors.md` §5: the RC column is empty for every commercial row). The system (SYS) evaluates entitlements, emits metering events and reduces entitlement. The Platform Administrator has no authority over the catalogue or any subscription (`actors.md` §5).

**Billing off.** With `BILLING_ENABLED=false` the compliance core must still pass UC-17 … UC-48 (NFR-1, FR-154, D-11). In this part that means the entitlement service answers *allow* for everything through its null implementation (AD-5, task 54.1), and metering still flows, because the stream lives in `audit` and not in `billing` (`apps/api/src/modules/platform/metering/metering.module.ts` docblock). The blocks restate this only where a requirement's behaviour depends on it.

## 1. Plan catalogue (index §3.17)

### FR-84 — A plan is a versioned record, not a constant

**Status.** Not started — remaining 53.1 (plans as versioned records), 53.4 (publishing and retiring plan versions), 68.2 (A-09 plan definition and versioning)

**Obligation.** The system shall model a subscription plan as a first-class versioned record rather than a constant in code, so that a plan is created, described and versioned as data with no code change.

| | |
|---|---|
| **Actors** | BO creates and versions. OA reads published plans (FR-91). No other role has authority (`actors.md` §5). |
| **Traces** | UC-89 · D-12 · DR-3 · AD-4 · AD-5 · BR-SUB-5 · entity *Plan / plan version* |
| **Surfaces** | A-09 · S-18 (reads) · no API path exists |

**Inputs.** A plan's code, description and customer-facing positioning (UC-89).

**Behaviour.**
1. Three plans exist at MVP: Free, Standard, Enterprise (D-12).
2. Pricing and packaging change more often than the compliance core, which is why the plan is a record and not a constant (UC-89).
3. Plan versions, their entitlements, quotas, prices and discounts are **tables in the `billing` schema** (`architecture.md` §7.4, §7.10), each plan version carrying its own published or retired state and being published under UX-123. They are **not** configuration-store artefacts: the project owner's call of 5 Oct 2026, which amends `architecture.md` §4.5, DR-3 and §7.5 (§12.5.6 task-182 billing-catalogue row, 182/59). A change to the catalogue still needs no code change and no deployment, because the Operator edits the tables in A-09. A plan version has no effective-from date of its own: what is on sale is what is published (an assumption recorded in the task-182 row).
4. The publication of a plan version change follows UX-123: preview, scope disclosure, confirm, progress, result, one-step revert or documented compensation (A-09 in `design_spec.md`).
5. Customer-facing plan *wording* (positioning copy shown to buyers) is not this record: it is FR-61's store content, task 53.3.

**Boundaries.** What a version holds is FR-85 (entitlements), FR-86 (prices) and FR-89 (discounts and trial terms). Versioning and grandfathering are FR-87. Publishing and retiring are FR-88.

**Acceptance criteria.**
- **AC-1** Given a Billing Operator, when they create a plan with a code, a description and a positioning, then the plan exists as a record and no code change or deployment is needed. *(source: FR text; UC-89)*
- **AC-2** Given the MVP catalogue, then it holds three plans: Free, Standard and Enterprise. *(source: D-12)*
- **AC-3** Given a plan is edited in a way FR-87 counts as a change, then the edit produces a new version of the record. *(source: FR text; UC-92)* Unmet until 53.1.
- **AC-4** Given the catalogue, then plan versions, entitlements, prices and discounts are rows in the `billing` schema and no configuration-store artefact holds any of them. *(source: §12.5.6 task-182 billing-catalogue row, 182/59)* Unmet until 53.1.

**History.**
- 5 Oct 2026 · project owner · plan versions and the rest of the catalogue are `billing` tables, not AD-4 artefacts; architecture §4.5, DR-3 and §7.5 amended · §12.5.6 task-182 billing-catalogue row (182/59)

### FR-85 — Entitlements and quotas are declarative data

**Status.** Not started — remaining 53.2 (entitlements, quotas and pricing), 68.2

**Obligation.** The system shall hold plan entitlements and quotas as declarative data — entities, seats, reports in total, exports by format, API allowance, module access, support tier — consumed by the entitlement service, so that a new gated capability means a new entitlement key rather than new plan logic.

| | |
|---|---|
| **Actors** | BO sets, per plan version. SYS consumes. |
| **Traces** | UC-90 · D-12 · NFR-10 · NFR-17 · AD-5 · entity *Entitlement / quota* |
| **Surfaces** | A-09 · S-17 and S-18 (read) · no API path exists |

**Inputs.** For a plan version, a value for each of the seven named entitlements (UC-90).

**Behaviour.**
1. An entitlement is a **key** held as catalogue data in `billing` (182/59, 182/68), not a TypeScript list and not a method per feature (AD-5). The keys named in the sources are `report.export.pdf`, `org.entities.max`, `org.seats.max`, `api.calls.monthly` and `module.comprehensive` (`architecture.md` §4.6).
2. Adding a gated capability later is adding a key, not changing plan logic (UC-90, NFR-17).
3. The structure supports concurrent pricing units: per-seat, per-report, per-API-call, per-managed-supplier (NFR-10). Only the first three are among the seven named entitlements.
4. Keys follow the dotted pattern of the keys above. The names of the keys for *reports in total*, the other export formats and *support tier* are settled in task 53.2's batch, and a key holds one of three kinds of value: a **switch**, a **ceiling** or a **tier** (182/68). The five-key TypeScript list in `entitlement.port.ts` (`ENTITLEMENT_KEYS`) contradicts keys being data and is deleted by task 54.1.
5. The entitlements an organization actually holds are the plan version's plus its subscription's additive overrides (AD-5, FR-145). An organization with no subscription holds the Free plan's currently published version (FR-90; 182/57).
6. **Reports in total** (182/79). The entitlement counts the reports the organization holds, in total: not per fiscal year and not per billing cycle. A report deleted under FR-210 no longer counts, having left every list and route (an assumption recorded in the task-182 row).
7. **A ceiling carries a warning band**: data on the entitlement, defaulting to one unit remaining (182/70; FR-99 item 8).

**Catalogue-held values.** Entitlements are plan-version data in `billing`'s catalogue tables, and not in the AD-4 store (182/59). The interim seat ceiling (`config/seed/seat-allowance.global.json`, 10) is *not* an entitlement and is deleted by task 54.2 (FR-102).

**Boundaries.** There is no customer-facing API product at MVP, though `api.calls.monthly` exists as a key (`architecture.md` OQ-23). Free-plan seat and Standard quota values are an open commercial decision (`use_cases.md` OQ-8).

**Acceptance criteria.**
- **AC-1** Given a plan version, then each of entities, seats, reports in total, exports by format, API allowance, module access and support tier can be set as data. *(source: FR text; UC-90)*
- **AC-2** Given a synthetic entitlement key and a synthetic plan added in a test, then FR-99 honours them with no change to the entitlement service or to any gated capability. *(source: FR text; NFR-17, whose verification this is)*
- **AC-3** Given a quota changes on a plan version, then no gated capability's code changes. *(source: NFR-17)*
- **AC-4** Given a plan version, then each key's value is a switch, a ceiling or a tier. *(source: §12.5.6 task-182 billing-catalogue row, 182/68)* Unmet until 53.2.
- **AC-5** Given the reports entitlement, then it counts the organization's reports in total, whatever their fiscal year, and does not reset at a billing cycle. *(source: §12.5.6 task-182 billing-catalogue row, 182/79)* Unmet until 53.2 and 54.2.

**History.**
- 5 Oct 2026 · project owner · keys are catalogue data holding a switch, a ceiling or a tier; *reports per period* renamed *reports in total* and counted in total · §12.5.6 task-182 billing-catalogue row (182/68, 79)

### FR-86 — Prices per plan version, currency and billing cycle

**Status.** Not started — remaining 53.2, 68.3 (A-09 pricing and discounts)

**Obligation.** The system shall allow prices to be authored per plan version, per currency and per billing cycle rather than converted at display time.

| | |
|---|---|
| **Actors** | BO authors. OA reads (FR-91, FR-110). |
| **Traces** | UC-91 · D-14 · NFR-58 · entity *Price* |
| **Surfaces** | A-09 · S-18 and S-19 (read) · no API path exists |

**Inputs.** A price in MDL and, where applicable, EUR or USD, for each supported cycle: monthly and annual (UC-91).

**Behaviour.**
1. An annual MDL price is a deliberate commercial decision, not the result of an exchange rate on the day (D-14, UC-91).
2. MDL is the ledger currency (D-14).
3. A monetary amount is an integer in minor units or a fixed-point decimal, never a floating-point number (NFR-58).
4. Every priced plan version carries an MDL price; EUR and USD prices are optional. The customer picks the order's currency among the currencies the plan version is priced in (182/66; FR-108, FR-110). MDL stays the ledger currency (item 2).

**Acceptance criteria.**
- **AC-1** Given a plan version, then a price can exist for each combination of currency and cycle (MDL, EUR, USD × monthly, annual). *(source: FR text; UC-91)*
- **AC-2** Given a price, then no display, comparison or order derives it by converting another currency's price. *(source: FR text; D-14)*
- **AC-3** Given any stored price, then it is not held as a floating-point number. *(source: NFR-58)*
- **AC-4** Given a priced plan version, then it carries an MDL price, and EUR and USD prices are optional. *(source: §12.5.6 task-182 billing-catalogue row, 182/66)* Unmet until 53.2.

**History.**
- 5 Oct 2026 · project owner · MDL always priced; the customer picks the order's currency among the version's priced currencies · §12.5.6 task-182 billing-catalogue row (182/66)

### FR-87 — Versioning with an explicit grandfathering choice

**Status.** Not started — remaining 53.1, 68.2, 63.9 (S-24 history)

**Obligation.** The system shall version a plan on any price or entitlement change with an explicit grandfathering choice, every subscription referencing the exact plan version it was sold under.

| | |
|---|---|
| **Actors** | BO issues the version and makes the choice. SYS migrates at renewal. |
| **Traces** | UC-92 · UX-123 · BR-SUB-5 · FR-98 · entity *Plan / plan version* |
| **Surfaces** | A-09 · S-24 (history) · no API path exists |

**Behaviour.**
1. A price or entitlement change produces a **new version**. A published version is immutable (the rule AD-4 gave the store, which the catalogue keeps on its own tables: 182/59).
2. The Operator chooses, for the new version, whether existing subscribers **migrate at their next renewal** or **remain on their original terms** (UC-92 step 2).
3. Every subscription references the exact plan version it was sold under, so a price rise never silently restates an in-force agreement (UC-92).
4. Before the choice is confirmed, the console discloses how many subscriptions are affected and under which grandfathering outcome (A-09; UX-123).
5. A subscriber moved to a new version at renewal is a *plan version migration* in the change history (FR-98).
6. Grandfathering applies to subscriptions. An organization with no subscription is on Free and holds no version pin, so a new version of Free applies to every such organization from its publication (a consequence of 182/57, recorded in the task-182 row).
7. A subscriber whose plan is retired moves at renewal to the plan's named successor, which is also a plan version migration in the history (FR-88; 182/80).

**Refusals.** A version change submitted without a grandfathering choice is refused (FR text: "requires a grandfathering choice"). No wire outcome is built.

**Acceptance criteria.**
- **AC-1** Given a price change on a plan, when it is saved, then a new plan version exists and the previous version is unchanged. *(source: FR text; AD-4)*
- **AC-2** Given a version change with no grandfathering choice, then it is not saved. *(source: FR text)*
- **AC-3** Given the choice *remain on original terms*, then every existing subscription still references its original version after the change. *(source: FR text; UC-92)*
- **AC-4** Given the choice *migrate at next renewal*, then each existing subscription references the new version only from its next renewal, and the migration appears in its history. *(source: UC-92; FR-98)*
- **AC-5** Given a version change is about to be confirmed, then the number of affected subscriptions and the grandfathering outcome are shown first. *(source: A-09; UX-123)*
- **AC-6** Given a new version of Free, then it applies to every organization without a subscription from its publication. *(source: §12.5.6 task-182 billing-catalogue row, 182/57)* Unmet until 54.5.

**History.**
- 5 Oct 2026 · project owner · a published version's immutability is kept on the `billing` tables; Free holds no pin · §12.5.6 task-182 billing-catalogue row (182/57, 59)

### FR-88 — Publish a plan, retire a plan

**Status.** Not started — remaining 53.4 (publishing and retiring plan versions), 60.5 (renewal onto the successor), 68.3

**Obligation.** The system shall allow a plan version to be published for new purchase and a plan to be retired, with retirement naming a successor plan and closing every version of the plan to new subscriptions, and with existing subscribers keeping their service without a gap until they change or renew, when they move to the successor.

| | |
|---|---|
| **Actors** | BO publishes and retires. |
| **Traces** | UC-93 · BR-SUB-6 · UX-123 · entity *Plan / plan version* |
| **Surfaces** | A-09 · S-18 (lists published plans only) · no API path exists |

**Preconditions.** The plan version exists (UC-93).

**Behaviour.**
1. **Publication attaches to a plan version** (182/60). A published plan version is visible for new purchase; a version not published is not purchasable.
2. **Retirement attaches to the plan** and closes every one of its versions to new sales (182/60). It terminates no existing service (BR-SUB-6, as amended by 182/80): service continues without a gap, and at the subscriber's next renewal the subscription moves to the successor plan the Operator named when retiring.
3. **Retiring a plan requires naming its successor** (182/80). The console states, at the point of retirement, that no one's service is terminated, and which plan the subscribers move to and when (A-09). The successor is a plan that is on sale (an assumption recorded in the task-182 row). Before the renewal the subscriber may change plan or cancel as at any renewal (FR-94, FR-97).
4. **A retired plan returns to sale only by publishing a new version** (182/60); a retired version is not published again.
5. **The move is disclosed in advance** (182/80). From the moment of retirement S-24 shows each affected subscriber the successor and the date of the move, and a notice reaches the Administrator before the renewal through the common mechanism (FR-160). The notice's category and lead time are configuration set by the task that registers the category (FR-165); they are not fixed here.

**Refusals.** Retiring a plan with no successor named is refused (182/80). No wire outcome is built.

**Acceptance criteria.**
- **AC-1** Given a plan that is not published, then it cannot be purchased and S-18 does not list it. *(source: FR text; UC-96 precondition)*
- **AC-2** Given a retired plan, then no new subscription can be created on it. *(source: FR text)*
- **AC-3** Given a retired plan with existing subscribers, then each keeps its service without a gap until its next renewal, and at renewal moves to the successor plan named at retirement. *(source: FR text, as amended; BR-SUB-6; §12.5.6 task-182 billing-catalogue row, 182/80)* Unmet until 60.5.
- **AC-4** Given the Operator retires a plan, then the console states that existing subscribers are not terminated, which plan they move to and when. *(source: A-09; §12.5.6 task-182 billing-catalogue row, 182/80)*
- **AC-5** Given the Operator retires a plan without naming a successor, then the retirement is refused and the plan stays on sale. *(source: §12.5.6 task-182 billing-catalogue row, 182/80)* Unmet until 53.4.
- **AC-6** Given a plan with several versions, then publication changes one version only, and retiring the plan closes every one of its versions to new sales. *(source: §12.5.6 task-182 billing-catalogue row, 182/60)* Unmet until 53.4.
- **AC-7** Given a retired plan, then it returns to sale only through a newly published version. *(source: §12.5.6 task-182 billing-catalogue row, 182/60)* Unmet until 53.4.
- **AC-8** Given a retirement with subscribers, then each is shown the successor and the date of the move before the renewal. *(source: §12.5.6 task-182 billing-catalogue row, 182/80)* Unmet until 63.8 and 60.5.

**History.**
- 5 Oct 2026 · project owner · publication per plan version, retirement per plan, return to sale only by a new version · §12.5.6 task-182 billing-catalogue row (182/60)
- 5 Oct 2026 · project owner · a retired plan names a successor and its subscribers move to it at renewal, disclosed in advance; BR-SUB-6 amended · §12.5.6 task-182 billing-catalogue row (182/80)

### FR-89 — Discount codes and trial terms, per plan version

**Status.** Not started — remaining 53.4 (the discount and trial-terms records), 68.3 (the data's authoring); 53.2 holds the prices it sits beside

**Obligation.** The system shall allow discount codes and trial terms to be defined per plan version — percentage or fixed, first-period or recurring, validity dates, redemption limits, plan eligibility, trial length, payment-instrument requirement and expiry behaviour — without a release.

| | |
|---|---|
| **Actors** | BO defines. OA meets them at checkout (FR-109) and on activation (FR-93). |
| **Traces** | UC-94, UC-95 · UC-111 · D-12 · entities *Discount code*, *Trial terms* |
| **Surfaces** | A-09 · S-18 (shows trial availability and terms) · no API path exists |

**Inputs.**
- *Discount code:* percentage or fixed amount; first period or recurring; validity dates; redemption limits; plan eligibility (UC-94).
- *Trial terms:* whether the plan version offers a trial; its length; whether a payment instrument is required up front; what happens at expiry, **lapse to Free or convert to paid** (UC-95).

**Behaviour.**
1. Trial terms are per plan version, so a trial offer can be tested and withdrawn without affecting existing customers (UC-95).
2. Issuing a commercial incentive does not need a release (UC-94).
3. A **recurring** discount applies in every period until the subscription leaves the plan version it was applied to. A **fixed amount** is authored per currency, like a price (D-14; FR-86), and is never converted (182/78).

**Acceptance criteria.**
- **AC-1** Given a plan version, then each named discount attribute is settable and takes effect with no release. *(source: FR text; UC-94)*
- **AC-2** Given a plan version, then each named trial attribute is settable and takes effect with no release. *(source: FR text; UC-95)*
- **AC-3** Given trial terms, then they attach to the plan version and not to the plan. *(source: FR text)*
- **AC-4** Given a trial offer is withdrawn, then existing customers are unaffected. *(source: UC-95)*
- **AC-5** Given a recurring discount, then it applies in every period until the subscription leaves the plan version it was applied to. *(source: §12.5.6 task-182 billing-catalogue row, 182/78)* Unmet until 68.3.
- **AC-6** Given a fixed-amount discount, then its amount is authored in each currency it applies in and is not converted from another. *(source: §12.5.6 task-182 billing-catalogue row, 182/78)* Unmet until 68.3.

**History.**
- 5 Oct 2026 · project owner · a recurring discount lasts while the subscription stays on the version; a fixed amount is authored per currency · §12.5.6 task-182 billing-catalogue row (182/78)

## 2. Subscription (index §3.18)

### FR-90 — The subscription state machine, shown plainly

**Status.** Not started — remaining 63.8 (S-24 status), 63.10 (S-17), 54.5 (an organization with no subscription), 63.11 (the subscription record and its read)

**Obligation.** The system shall expose the subscription state machine — trialling, active, past due, suspended, cancelled, lapsed — to the Organization Administrator together with the plan version in force, entitlements granted, billing cycle, renewal or expiry date and next amount due.

| | |
|---|---|
| **Actors** | OA reads. No other tenant role. |
| **Traces** | UC-65, UC-106 · D-12 · UX-54 · FR-97 · FR-104 · entity *Subscription* |
| **Surfaces** | S-17 (plan, entitlements and usage) · S-24 (status half) · no API path exists |

**Behaviour.**
1. The state is exactly one of the six named values.
2. "Past due" and "suspended" have different consequences, and the customer must be able to tell which they are in (UC-106).
3. S-17 also shows the current plan (Free, Standard or Enterprise), the entitlements and quotas it grants, the cycle and the next renewal date (UC-65).
4. Under suspension the screen states the exact amount, the date, and the single action that restores service (UX-54).
5. **Free is the absence of a subscription** (182/57). An organization with no billing record is on Free and holds the entitlements of the Free plan's currently published version. A record appears at the first trial or the first order, and an organization holds at most one subscription in force. Founding is a core act and the core cannot write `billing` (DR-1), and with `BILLING_ENABLED=false` there is no record to hold (AD-5).
6. **What the states mean** (182/58). *Trialling*: a trial is running (FR-93). *Active*: a paid period is in force. *Past due*: a renewal charge or an invoice is overdue and dunning runs (UC-141). *Suspended*: dunning is exhausted (UC-142). *Cancelled*: cancellation has been requested, and service continues unchanged to the end of the paid period (UC-104). *Lapsed*: a subscription has ended and the organization is on Free, which is what remains after a cancelled or unrenewed paid period or a trial that was not converted (UC-95). A lapsed record is the history of a subscription that ended, never a stand-in for an organization that was always on Free (182/57).
7. **What moves a subscription** (182/58). A first order that is provisioned (FR-92) makes it active, and activating a trial (FR-93) makes it trialling. A trial converts to active or lapses at its expiry (FR-93). An active subscription becomes past due when a renewal charge or an invoice goes overdue, and returns to active when that is settled (UC-141, UC-143). A past due subscription becomes suspended when dunning is exhausted (UC-142), and a suspended one returns to active when the overdue amount is settled (UC-143, FR-137). Cancellation makes an active subscription cancelled, and withdrawing the cancellation before the period ends makes it active again (FR-97). A cancelled subscription, and an active one whose auto-renewal was disabled (UC-103), become lapsed at the close of the paid period. A lapsed subscription becomes active again through a new order (FR-97; 182/75).

**Boundaries.** The actions that change the state are FR-92 … FR-97. Suspension is produced by collections (FR-136, UC-142). Restoration on payment is FR-137.

**Acceptance criteria.**
- **AC-1** Given a subscription, then its state is one of trialling, active, past due, suspended, cancelled or lapsed, shown with the plan version in force, the entitlements granted, the billing cycle, the renewal or expiry date and the next amount due. *(source: FR text; UC-106)*
- **AC-2** Given a past due and a suspended subscription, then the two are shown as different states with different stated consequences. *(source: UC-106)*
- **AC-3** Given a suspended subscription, then the screen states the amount, the date and the single restoring action. *(source: UX-54; S-24)*
- **AC-4** Given an organization that has never started a trial or placed an order, then it has no subscription record, is on Free, and holds the entitlements of the Free plan's currently published version. *(source: §12.5.6 task-182 billing-catalogue row, 182/57)* Unmet until 54.5.
- **AC-5** Given a subscription, then its state means what item 6 says and changes only by the events of item 7. *(source: §12.5.6 task-182 billing-catalogue row, 182/58)* Unmet until the subscription record is built (no row yet).
- **AC-6** Given a subscription that has lapsed, then the organization's entitlements are Free's. *(source: §12.5.6 task-182 billing-catalogue row, 182/58)* Unmet until 54.5.

**History.**
- 5 Oct 2026 · project owner · Free is the absence of a subscription; at most one subscription in force · §12.5.6 task-182 billing-catalogue row (182/57)
- 5 Oct 2026 · project owner · the six states defined and the events that move a subscription between them · §12.5.6 task-182 billing-catalogue row (182/58)

### FR-91 — Compare plans against the organization's actual consumption

**Status.** Not started — remaining 63.11 (the read), 63.1 (S-18 plan comparison and selection)

**Obligation.** The system shall present published plans side by side with entitlements, quotas and price per cycle, and shall show which limits the organization's actual consumption would exceed on each.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-96 · UC-65, UC-66 · D-12 · FR-105 |
| **Surfaces** | S-18 (Comparison, composed of Index and Status) · no API path exists |

**Preconditions.** Published plans exist (UC-93). Usage counters are available (UC-66).

**Behaviour.**
1. Each published plan is shown with its entitlements, quotas and price for each cycle.
2. For each plan, the limits the organization's current usage would exceed are flagged. Consumption comes from the metering stream (FR-105).
3. Trial availability and terms are shown where the plan version offers a trial (S-18).
4. Enterprise is not selectable here: it is reached through the quote path (D-12, FR-142; S-18 exit to S-25).

**Acceptance criteria.**
- **AC-1** Given published plans, then the comparison lists each with its entitlements, quotas and price per cycle. *(source: FR text; UC-96)*
- **AC-2** Given an organization whose usage is above a plan's limit, then that limit is flagged on that plan. *(source: FR text; UC-96)*
- **AC-3** Given a plan that is not published, then it is not listed. *(source: FR-88)*

### FR-92 — A paid subscription starts through an order

**Status.** Not started — remaining 63.1, 58 (order saga), 59.3 (order → payment → entitlement)

**Obligation.** The system shall start a paid subscription through an order, changing entitlements only on confirmed payment or, for approved bank transfer terms, on invoice issuance, and never on order creation.

| | |
|---|---|
| **Actors** | OA elects. SYS provisions. |
| **Traces** | UC-97, UC-110 · D-8 · AD-6 · NFR-54 · NFR-59 · BR-SUB-1 · FR-108 |
| **Surfaces** | S-18 → S-19 · no API path exists |

**Preconditions.** The organization is on Free: it has no subscription, or its last one lapsed (182/57). A published paid plan version exists (UC-97).

**Behaviour.**
1. The Administrator selects a plan version and a billing cycle. The system creates an order (FR-108) and does not activate the plan directly (UC-97 step 2).
2. For a card or instant payment, the provider's server-to-server callback is the authoritative event. The order moves to paid, the invoice is issued, and only then are entitlements updated, through the outbox (`architecture.md` §11.2; AD-6).
3. Order, payment, fiscal document and entitlement change are all-or-nothing, reconciled by the saga and the outbox, with residual inconsistency surfaced to the Billing Operator (NFR-59).
4. The browser's return from a provider may arrive first and shows *pending* until the callback lands (§11.2; UX-58).
5. **Approved bank transfer terms are an Enterprise property recorded on the contract** (FR-144, FR-145), under which the invoice is issued at a scheduled billing point before payment and entitlements follow at issuance (182/81). They are not an approval a Billing Operator grants to any subscription. On the self-serve transfer rail there are none: the proforma and the order are the open document, the fiscal invoice is issued when reconciliation confirms the payment, and entitlements follow reconciliation (BR-PAY-4).

**Acceptance criteria.**
- **AC-1** Given an order is created, then no entitlement of the organization changes. *(source: FR text; BR-SUB-1)*
- **AC-2** Given a payment by card or instant rail is confirmed, then the entitlements of the ordered plan version apply. *(source: FR text; §11.2)* Unmet until 59.3.
- **AC-3** Given an order that is abandoned, then the organization's entitlements are unchanged and no subscription results. *(source: FR-108; UC-110)*
- **AC-4** Given an Enterprise subscription whose contract carries approved bank transfer terms, when the scheduled invoice is issued, then entitlements change at issuance. *(source: FR text; UC-97 step 3; §12.5.6 task-182 payment and fiscal row, 182/81)* Unmet until 59.3, 61.1 and 70.4.
- **AC-5** Given a self-serve order paid by transfer, then entitlements change on reconciliation and not on issuance of the proforma. *(source: BR-PAY-4; §12.5.6 task-182 payment and fiscal row, 182/81)* Unmet until 60.2 and 65.3.

**History.**
- 5 Oct 2026 · project owner · approved bank transfer terms are an Enterprise contract property; the self-serve transfer rail provisions on reconciliation · §12.5.6 task-182 payment and fiscal row (182/81)

### FR-93 — Start a free trial

**Status.** Not started — remaining 60.6 (trial activation, eligibility, expiry and conversion), 63.1 (S-18, hiding the control once a trial was used or on a paid plan)

**Obligation.** The system shall activate a trial where the plan version offers one, for an organization on Free that has never started a trial, granting full paid entitlements with a known expiry and notifying the Administrator before it ends.

| | |
|---|---|
| **Actors** | OA activates. SYS expires and notifies. |
| **Traces** | UC-98 · UC-95 · UC-172, UC-173 · FR-89 · FR-160 · FR-165 |
| **Surfaces** | S-18 (start a trial, hidden once a trial was used or on a paid plan) · S-24 (trial-expiry notification entry) · no API path exists |

**Preconditions.** The plan version offers a trial (UC-95). The organization is on Free and has never started a trial, of any plan (182/71).

**Behaviour.**
1. The subscription enters *trialling* with the full paid entitlements of the plan version and a known expiry (UC-98).
2. **An organization starts at most one trial in its life.** Every trial it ever started counts — of any plan, and whether it lapsed, converted or was cancelled — so a second activation is refused, as is one from a paid plan (182/71). **S-18 does not render the start-a-trial control** for an organization that has already started one or is on a paid plan; the server's refusals still stand for any other caller (182/71, amended 6 Oct 2026).
3. The Administrator is notified before the trial ends, through the common notification mechanism (UC-98; FR-160). The notice is a category registered by the task that first raises it (`architecture.md` §12.5.6's task-49.1 row (1)). How long before expiry it is raised is a lead time held in the category's configuration, its number set in task 51.2's cadence batch (182/132).
4. At expiry the plan version's trial terms apply: lapse to Free, or convert to paid (UC-95). Whether a payment instrument is required up front is also a trial term (FR-89). Where the terms require an instrument and recurring consent was recorded, conversion creates an order and charges the stored instrument (FR-120); otherwise the Administrator must confirm an order, and the trial lapses to Free if it is not confirmed (182/63; BR-PAY-5).

**Refusals.** A second trial, or a trial from a paid plan → refused, nothing changes (182/71). No wire outcome is built yet.

**Acceptance criteria.**
- **AC-1** Given a plan version that offers a trial, when the Administrator of an organization on Free that has never started a trial activates it, then the subscription is *trialling* with the paid entitlements of that plan version. *(source: FR text; UC-98)*
- **AC-2** Given a trial, then it records an expiry. *(source: FR text; UC-98)*
- **AC-3** Given a trial approaching its expiry, then a notice reaches the Administrator before it ends. *(source: FR text; FR-160)*
- **AC-4** Given a plan version that offers no trial, then no trial can be activated on it. *(source: UC-98 precondition)*
- **AC-5** Given the trial-expiry notice, then its lead time is read from its category's configuration and not from code. *(source: §12.5.6 task-182 notifications row, 182/132)* Unmet until its producer is built.
- **AC-6** Given an organization that has already started a trial — of any plan, whether that trial lapsed, converted or was cancelled — when a trial of any plan is activated, then it is refused and nothing changes. *(source: §12.5.6 task-182 billing-catalogue row, 182/71 as amended 6 Oct 2026; UC-98 precondition)* Unmet until 60.6.
- **AC-7** Given an organization on a paid plan, when a trial is activated, then it is refused. *(source: §12.5.6 task-182 billing-catalogue row, 182/71)* Unmet until 60.6.
- **AC-8** Given a trial that expires, the terms requiring an instrument and recurring consent recorded, then an order is created and the stored instrument is charged. *(source: §12.5.6 task-182 billing-catalogue row, 182/63)* Unmet until 60.6.
- **AC-9** Given a trial that expires without recorded consent, then no charge is made, the Administrator must confirm an order, and the trial lapses to Free if it is not confirmed. *(source: §12.5.6 task-182 billing-catalogue row, 182/63)* Unmet until 60.6.
- **AC-10** Given an organization that has already started a trial, when S-18 is shown, then no start-a-trial control is rendered on any plan. *(source: `design_spec.md` S-18 as amended 6 Oct 2026; 182/71)* Unmet until 63.1.
- **AC-11** Given an organization on a paid plan, when S-18 is shown, then no start-a-trial control is rendered on any plan. *(source: `design_spec.md` S-18 as amended 6 Oct 2026; 182/71)* Unmet until 63.1.

**History.**
- 5 Oct 2026 · project owner · one trial per organization per plan, from Free only · §12.5.6 task-182 billing-catalogue row (182/71)
- 5 Oct 2026 · project owner · conversion at expiry charges only where consent was recorded; otherwise confirmation or lapse · §12.5.6 task-182 billing-catalogue row (182/63)
- 5 Oct 2026 · project owner · the trial-expiry notice's lead time is category configuration, its number set in task 51.2's cadence batch · §12.5.6 task-182 notifications row (182/132)
- 6 Oct 2026 · project owner · one trial per organization **ever**, of any plan — no longer one per plan · §12.5.6 task-182 billing-catalogue row (182/71, amended)
- 6 Oct 2026 · project owner · S-18 hides the start-a-trial control once a trial was used, and on a paid plan · `design_spec.md` S-18; 182/71

### FR-94 — Upgrade immediately, downgrade at period end

**Status.** Not started — remaining 63.12 (the api), 63.8; 81.2 for the scope upgrade

**Obligation.** The system shall apply an upgrade immediately with the unused remainder of the current period credited on a prorated basis, and a downgrade at the end of the paid period with advance disclosure of exactly which entities, seats and features will become read-only.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-100, UC-101 · D-13 · UX-53 · UX-70 · NFR-80 · BR-SUB-2 · FR-103 · FR-104 |
| **Surfaces** | S-24 · S-19 (entered for a cycle or unit change) · no API path exists |

**Preconditions.** An active subscription on a lower plan, for an upgrade (UC-100). An active paid subscription, for a downgrade (UC-101).

**Behaviour.**
1. *Upgrade.* The new entitlements apply at once. The unused remainder of the current period is credited against the new plan's charge on a prorated basis (UC-100). The Administrator is usually upgrading because they are blocked, which is why it is immediate.
2. *Downgrade* to a lower plan or to Free. The system shows in advance exactly which entities, seats and features will move to read-only, listed by name, and states that nothing is deleted (UC-101 step 2; UX-53). The change takes effect at the end of the paid period.
3. No refund arises on a downgrade (UC-101). The read-only content is chosen by FR-103's rule.
4. Each is a consequence-disclosing action naming the specific objects affected (UX-70; S-24).
5. **Proration is daily** (182/72): the remaining whole days over the period's days, the credit rounded half-up to minor units. The credit offsets the new charge only; no cash is refunded.
6. **"Immediately" means at the confirmed payment of the upgrade order** (182/69), the credit already netted in its total. BR-SUB-1 holds: nothing changes on order creation. On the bank transfer rail the upgrade waits for settlement (FR-119), and the screen says so.

**Acceptance criteria.**
- **AC-1** Given an upgrade, then the new plan's entitlements apply immediately and the unused remainder of the period is credited on a prorated basis. *(source: FR text; UC-100)*
- **AC-2** Given a downgrade, then it takes effect at the end of the paid period, not before. *(source: FR text; UC-101)*
- **AC-3** Given a downgrade about to be confirmed, then the entities, seats and features that will become read-only are listed by name first, with a statement that nothing is deleted. *(source: FR text; UX-53)*
- **AC-4** Given a downgrade, then it generates no refund and deletes no content. *(source: UC-101; D-13)*
- **AC-5** Given an upgrade, then the credit is the current period's charge multiplied by the remaining whole days over the period's days, rounded half-up to minor units, and it reduces the new charge without a cash refund. *(source: §12.5.6 task-182 billing-catalogue row, 182/72)* Unmet until 63.8 and 81.2.
- **AC-6** Given an upgrade order, then the new entitlements apply at its confirmed payment, not at its creation; on the transfer rail, at settlement. *(source: §12.5.6 task-182 billing-catalogue row, 182/69)* Unmet until 63.8.

**History.**
- 5 Oct 2026 · project owner · daily proration; an upgrade takes effect at its confirmed payment · §12.5.6 task-182 billing-catalogue row (182/69, 72)

### FR-95 — Change the billing cycle at the next renewal

**Status.** Not started — remaining 63.12 (the api), 63.8

**Obligation.** The system shall allow the billing cycle to be changed effective at the next renewal, re-evaluating payment rail availability against the new total.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-99 · D-8 · FR-110 · FR-118 |
| **Surfaces** | S-24 · S-19 (entered for a cycle change) · no API path exists |

**Preconditions.** An active paid subscription (UC-99).

**Behaviour.**
1. The Administrator selects the new cycle, monthly or annual. Moving to annual takes effect at the next renewal with the annual price applied (UC-99).
2. The payment rails open to the organization are re-evaluated against the new total, because an annual total commonly exceeds the MIA per-transaction ceiling (UC-99; D-8; FR-110).
3. A cycle change is a class of the subscription change history (FR-98).

**Acceptance criteria.**
- **AC-1** Given a cycle change, then it takes effect at the next renewal and not before, with that cycle's price. *(source: FR text; UC-99)*
- **AC-2** Given a cycle change whose new total exceeds the MIA ceiling, then at checkout MIA is shown excluded with its reason. *(source: FR text; FR-110; BR-PAY-7)*

### FR-96 — Add or remove billable units mid-cycle

**Status.** Not started — remaining 63.12 (the api), 63.8 (dormant until a plan version prices a unit: 182/73)

**Obligation.** The system shall allow billable units to be added or removed mid-cycle, prorating additions to the period end and applying removals to the following period rather than as a mid-cycle refund.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-102 · UC-60 · UC-127 · BR-SUB-3 · NFR-10 |
| **Surfaces** | S-24 · S-19 (entered for a unit change) · no API path exists |

**Preconditions.** The plan prices seats or reporting entities per unit (UC-102). **No MVP plan does** (182/73): the requirement is specified and dormant until a plan version carries a unit price, and an order's quantity is 1. Fixing a unit price is `use_cases.md` OQ-8's commercial decision and is not pre-empted here.

**Behaviour.**
1. *Addition.* Prorated to the period end and charged on the next invoice (UC-102).
2. *Removal.* Reduces the following period. It generates no mid-cycle refund (UC-102; BR-SUB-3).

**Acceptance criteria.**
- **AC-1** Given a unit added mid-cycle, then it is prorated to the period end and charged on the next invoice. *(source: FR text; UC-102)*
- **AC-2** Given a unit removed mid-cycle, then the following period is reduced and no refund is generated for the current one. *(source: FR text; UC-102)*
- **AC-3** Given the MVP catalogue, then no plan version carries a unit price and every order's quantity is 1; AC-1 and AC-2 stay dormant until one does. *(source: §12.5.6 task-182 billing-catalogue row, 182/73)*

**History.**
- 5 Oct 2026 · project owner · no MVP plan is per-unit; the requirement is dormant · §12.5.6 task-182 billing-catalogue row (182/73)

### FR-97 — Auto-renewal, cancellation and reactivation

**Status.** Not started — remaining 63.12 (the api), 63.8, 63.9

**Obligation.** The system shall allow auto-renewal to be controlled, cancellation to take effect at the close of the paid period rather than immediately, and a cancelled, lapsed or suspended subscription to be reactivated, with read-only entities and reports returning to editable on restoration of entitlement.

| | |
|---|---|
| **Actors** | OA. SYS lapses at the scheduled date and restores on payment (FR-137). |
| **Traces** | UC-103, UC-104, UC-105 · UC-142, UC-143, UC-151 · D-13 · BR-SUB-4 · index §9.3 · entity *Subscription* |
| **Surfaces** | S-24 · no API path exists |

**Preconditions.** An active subscription, for auto-renewal and cancellation. For reactivation, the subscription was cancelled, lapsed or suspended. There is **no retention window**: reactivation is possible for as long as the organization exists, and UC-105's precondition about a window is struck (182/74).

**Behaviour.**
1. *Auto-renewal.* The Administrator enables or disables renewal at period end. Disabling schedules a **lapse to Free**, not a service cut-off, and the Administrator is reminded before the date arrives (UC-103).
2. *Cancellation.* The subscription ends at the close of the paid period. Service continues unchanged until then (UC-104; BR-SUB-4), because the customer has paid for the period and their report deadline may fall inside it.
3. *Reactivation.* Previously read-only entities and reports return to editable at the moment entitlement is restored (UC-105).
4. Auto-renewal, cancellation and reactivation are three transitions of one state machine (index §9.3).
5. **Three cases, three routes** (182/75). Withdrawing a cancellation before the period ends needs no payment. A lapsed subscription is bought again through an order on a published plan (FR-92). A suspended one is restored by paying the overdue amount (UC-143, FR-137).
6. **Organization life ends only with deletion of the organization record**; a lapse or suspension never ends it (DD-13; 182/74).

**Acceptance criteria.**
- **AC-1** Given auto-renewal disabled, then a lapse is scheduled for the period end and service is not cut off before it. *(source: FR text; UC-103)*
- **AC-2** Given a cancellation, then service is unchanged until the close of the paid period. *(source: FR text; UC-104)*
- **AC-3** Given a reminder date approaching for a scheduled lapse, then the Administrator is reminded before it arrives. *(source: UC-103 step 3)*
- **AC-4** Given a reactivation, then entities and reports that were read-only return to editable when entitlement is restored. *(source: FR text; UC-105)*
- **AC-5** Given a cancellation withdrawn before the period ends, then the subscription is active again and no payment is asked. *(source: §12.5.6 task-182 billing-catalogue row, 182/75)* Unmet until 63.8.
- **AC-6** Given a lapsed subscription of any age, then it is bought again through an order on a published plan while the organization exists. *(source: §12.5.6 task-182 billing-catalogue row, 182/75)* Unmet until 63.8 and 59.3.
- **AC-7** Given a suspended subscription, then it is restored by paying the overdue amount, with no other step. *(source: §12.5.6 task-182 billing-catalogue row, 182/75)* Unmet until 65.2.

**History.**
- 5 Oct 2026 · project owner · no reactivation window; organization life ends only with deletion of the organization record · §12.5.6 task-182 billing-catalogue row (182/74)
- 5 Oct 2026 · project owner · the three reactivation cases and how each is paid · §12.5.6 task-182 billing-catalogue row (182/75)

### FR-98 — The subscription change history

**Status.** Not started — remaining 63.12 (the change record), 63.9 (S-24 history)

**Obligation.** The system shall maintain a subscription change history covering every state-changing transition of a subscription, and at least every upgrade, downgrade, cycle change, plan version migration, cancellation and reactivation, with date, acting user and resulting entitlements.

| | |
|---|---|
| **Actors** | OA reads. |
| **Traces** | UC-107 · UC-92 · UC-163 · entity *Subscription change record* |
| **Surfaces** | S-24 (Index half) · no API path exists |

**Behaviour.**
1. Six change classes appear, each with its date, the acting user and the resulting entitlements (UC-107).
2. The record settles a billing dispute without recourse to support (UC-107).
3. **Every state-changing transition is recorded** (182/76), the six classes above being its first members and not its limit: unit changes, auto-renewal changes, the start and end of a trial, renewal, lapse, suspension and restoration are recorded too. For a change the system makes the acting user is the system. A later class joins the vocabulary without a change to the record.

**Acceptance criteria.**
- **AC-1** Given each of an upgrade, a downgrade, a cycle change, a plan version migration, a cancellation and a reactivation, then each appears in the history with its date, acting user and resulting entitlements. *(source: FR text; UC-107)*
- **AC-2** Given any other state-changing transition, then it appears with its date, its acting user and the resulting entitlements. *(source: §12.5.6 task-182 billing-catalogue row, 182/76)* Unmet until 63.9.
- **AC-3** Given a renewal, a lapse, a suspension or a restoration, then the acting user is the system. *(source: §12.5.6 task-182 billing-catalogue row, 182/76)* Unmet until 63.9.

**History.**
- 5 Oct 2026 · project owner · the history records every state-changing transition, the system acting for what it does · §12.5.6 task-182 billing-catalogue row (182/76)

## 3. Entitlement and metering (index §3.19)

### FR-99 — One central entitlement service

**Status.** Not started — remaining 54.1 (the port and its null implementation), 54.2, 54.3. The port's interface exists in `apps/api/src/contracts/entitlement.port.ts` and `EntitlementGuard` is not registered (`apps/api/src/app.module.ts:39`).

**Obligation.** The system shall answer every gated action through a central entitlement service returning allow, deny or allow-with-warning.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | UC-148 (its legacy `FR-23` citation, read through index §9.5) · AD-5 · DR-1 · P-9 · NFR-1 · NFR-17 · NFR-41 · NFR-49 · BR-ENT-1 · FR-154 |
| **Surfaces** | `EntitlementPort.check` (`contracts/`) · `@RequiresEntitlement('<key>')` and `EntitlementGuard` (`architecture.md` §6.2) · no HTTP path |

**Preconditions.** The organization has a plan with declared entitlements (UC-148): its subscription's plan version, or, with no subscription, the Free plan's currently published version (182/57).

**Inputs.** `check({ organizationId, key, requested? })`: the key is a registered entitlement key and `requested` is the units the caller wants to consume where the key is metered (entitlement.port.ts:46).

**Behaviour.**
1. The service returns exactly one of `allow`, `deny` or `allow_with_warning`, with a reason key, and where a ceiling applies its `limit` and the consumption `used` (AD-5; entitlement.port.ts:46).
2. The service is a **key lookup**, not a method per feature (AD-5). It is defined in `contracts/`, implemented in `modules/billing/entitlement` and consumed by the core, which may not import billing (DR-1).
3. A decision is computed from the plan version's entitlements plus the subscription's overrides, with quota keys evaluated against the metering counters (§11.4).
4. The decision is served from an in-process cache per `api` container, keyed by organization and an entitlement snapshot version. Invalidation is a version poll of a single-row table with Redis pub/sub as the fast path (§11.4).
5. **Billing unreachable:** the last-known-good snapshot serves. It is open for keys already granted and closed for new purchases (AD-5; NFR-49).
6. **`BILLING_ENABLED=false`:** the null implementation grants everything (AD-5; §11.4).
7. How "grants everything" is represented in a decision, and what then bounds the unpaginated member and invitation lists, is task 54.2's, recorded by the sources as its decision (`architecture.md` §12.5.6's task-142 row (c)). When the decision is a `deny` on a quota key, the seat precedent is `409` and `entitlement-quota-exceeded` (same row).
8. A decision is `allow_with_warning` when consumption of a ceiling key is inside the key's **warning band** and short of the ceiling. The band is data on the entitlement, defaulting to one unit remaining (the S-16 precedent), and its numbers are set in task 53.2 (182/70).

**Refusals.** A `deny` blocks the gated action. For a quota key the built precedent is 409 `entitlement-quota-exceeded` (FR-102).

**Configuration-held values.** The entitlement keys and their values are plan-version data (FR-85).

**Boundaries.** The interim seat ceiling is not routed through this service until task 54.2 (BR-ENT-1 note, §4). The call sites are enumerated by task 54.2. The decision latency is NFR-41.

**Acceptance criteria.**
- **AC-1** Given any gated action, then it resolves through the one service and the service returns exactly one of the three outcomes. *(source: FR text; BR-ENT-1)*
- **AC-2** Given a synthetic key and a synthetic plan introduced in a test, then the service honours them with no change to the service. *(source: NFR-17)*
- **AC-3** Given a decision from cache, then p95 is at most 20 ms, and at most 100 ms on a cache miss. *(source: NFR-41)*
- **AC-4** Given `BILLING_ENABLED=false`, then every check allows and UC-17 … UC-48 pass. *(source: AD-5; NFR-1)*
- **AC-5** Given the billing context unreachable mid-session, then keys already granted still allow and a new purchase is refused. *(source: NFR-49, whose chaos test this is)*
- **AC-6** Given a ceiling key with consumption inside its warning band and short of the ceiling, then the decision is allow-with-warning. *(source: §12.5.6 task-182 billing-catalogue row, 182/70)* Unmet until 53.2 and 54.2.
- **AC-7** Given an organization with no subscription, then decisions are computed from the Free plan's currently published version. *(source: §12.5.6 task-182 billing-catalogue row, 182/57)* Unmet until 54.5.

**History.**
- 5 Oct 2026 · project owner · a warning band is data on the entitlement; an organization with no subscription is answered from Free · §12.5.6 task-182 billing-catalogue row (182/57, 70)


### FR-100 — Gating logic lives outside the gated capability

**Status.** Not started — remaining 54.1, 54.2

**Obligation.** The system shall hold gating logic outside the gated capability, so that a new plan or a changed quota never requires a change to the feature being gated.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | UC-148 (legacy `FR-23`, index §9.5) · D-11 · NFR-17 · AD-5 · BR-ENT-1 |
| **Surfaces** | `@RequiresEntitlement('<key>')` decorator and `EntitlementGuard` (`architecture.md` §6.2) |

**Behaviour.**
1. A gated handler carries the decorator and nothing else about plans: the capability contains no gating logic (§6.2).
2. The guard runs after the tenant binding is made, since it reads per-organization subscription state (`apps/api/src/app/guards/tenant-transaction.guard.ts` docblock).
3. The seams at which a quota bites — report creation, export, entity count, user count — are enumerated by task 54.2. Enumerating them is that task's deliverable, so a plan limit cannot become advisory by omission. Inline comparatives are not a seam: they are free on every plan (FR-45; 182/67).

**Acceptance criteria.**
- **AC-1** Given a new plan, or a changed quota, then no code in any gated feature changes. *(source: FR text; NFR-17)*
- **AC-2** Given a gated route, then the capability's own code names an entitlement key and no plan, price or quota. *(source: FR text; §6.2)*
- **AC-3** Given the seams task 54.2 enumerates, then the prior-period read is not among them. *(source: §12.5.6 task-182 billing-catalogue row, 182/67)* Unmet until 54.2.

**History.**
- 5 Oct 2026 · project owner · inline comparatives are not gated by any plan · §12.5.6 task-182 billing-catalogue row (182/67)


### FR-101 — Warn before a limit is reached

**Status.** Not started — remaining 54.6 (the quota-approach producer and its category)

**Obligation.** The system shall notify the Organization Administrator as consumption approaches an entitlement ceiling, before the limit is reached.

| | |
|---|---|
| **Actors** | SYS raises. OA receives. |
| **Traces** | UC-149 · UC-66, UC-152 · UX-52 · FR-160 · FR-164, FR-165 |
| **Surfaces** | The notification centre and email (FR-160 mechanism) · the counter in context on S-16, S-17 |

**Preconditions.** Consumption is measured against an entitlement ceiling (UC-66, UC-152).

**Behaviour.**
1. As consumption of a metered entitlement nears its ceiling (seats, entities, exports, API calls), a notice is raised to the Administrator before the limit is reached (UC-149).
2. The notice runs on the common notification mechanism (FR-160); it does not acquire its own delivery path (`architecture.md` §4.12, AD-11's consequences).
3. A warning also appears against the counter in context, before the limit, and not only as a notification (UX-52). Built for the seat region: S-16 shows it when **one seat remains** (task 142.3; `design_spec.md` S-16 states).
4. Its category is registered by the task that first raises it, and its cadence is FR-164's repeat interval and FR-165's lead times, which task 51.2 decides (`architecture.md` §12.5.6's task-49.1 row (1), (6)).
5. **Approaching is the key's warning band** (182/70): data on the entitlement, defaulting to one unit remaining, as S-16's seat region already does. A percentage is not used, since it means nothing for a ceiling of ten seats. The numbers per key are set in task 53.2.

**Acceptance criteria.**
- **AC-1** Given consumption of a metered entitlement that approaches its ceiling, then a notice is raised to the Administrator before the ceiling is reached. *(source: FR text; UC-149)* Unmet: no producer exists.
- **AC-2** Given a seat count one below the ceiling, then S-16 shows an approaching warning against the counter. *(source: UX-52; S-16 states; task 142.3)*
- **AC-3** Given a ceiling key with a warning band, then consumption inside the band and short of the ceiling raises the notice and the warning in context, and consumption outside it raises neither. *(source: §12.5.6 task-182 billing-catalogue row, 182/70)* Unmet until 53.2 and 54.2.

**History.**
- 5 Oct 2026 · project owner · approaching means a warning band, data on the entitlement, defaulting to one unit remaining · §12.5.6 task-182 billing-catalogue row (182/70)

### FR-102 — A quota block informs, offers a way out, and never loses work

**Status.** Partial — delivered 142.1 (the seat ceiling enforced), 142.2 (the entitlement gate and counter components), 142.3 (S-16's seat region and gate) · remaining 54.2 (the general quota path; the seat block's upgrade path), 63.1 (the path's destination)

**Obligation.** On a quota-exceeded action the system shall block it, state which limit was reached and what the current plan allows, offer the upgrade path, and shall never discard reporting work in progress or prevent a started report from being finished and exported. **For the interim seat ceiling the upgrade-path clause is deferred, not met:** no plan exists to upgrade to until tasks 53 and 63, so the block names a way out the reader can take instead (withdraw an invitation, or remove someone's access).

| | |
|---|---|
| **Actors** | SYS blocks. OA meets the seat block (the organization-administrator role alone invites). The invitee meets the acceptance refusal. |
| **Traces** | UC-150, UC-60, UC-15 · UX-50, UX-51 · BR-ENT-2 · D-12 · `use_cases.md` OQ-8 |
| **Surfaces** | S-16's seat region and gate · `POST /invitations` · `POST /invitations/acceptance` · `GET /access/seats` |

**Behaviour.**
1. *The seat ceiling (built).* It is the `seat_allowance` artefact in the configuration store, one `global` scope, value 10 (`config/seed/seat-allowance.global.json`). 10 is an interim operational bound and **not** the Free plan's cap (`architecture.md` §12.5.6's task-142 row (1); `use_cases.md` OQ-8 stays open).
2. A seat is an active membership or a pending invitation, **lapsed invitations included**. The count is the union S-16 lists, so the screen and the gate cannot disagree (task-142 row (2)).
3. The issue gate checks after the insert, serialised per organization by a transaction-scoped advisory lock, so two simultaneous invitations at the last seat cannot both commit. `held` includes the invitation just inserted; the refusal's `used` excludes it (`issue-invitation.use-case.ts:140-146`).
4. Acceptance checks only where it creates or restores a membership. It converts a counted invitation into a counted member, so it refuses only an organization already over its ceiling, for example one that lowered the value after issuing (task-142 row, consequences).
5. **Fail closed.** An absent or malformed artefact (not a whole number of at least one) refuses both writes (task-142 row (3); `seat-ceiling.ts` `readSeatAllowance`).
6. The block states the limit reached, what the organization is allowed and the current consumption, and names a way out (UX-50; task-142 row (b)). The invitee's refusal carries no `limit` or `used`: a link holder is not a member (task-142 row (a)).
7. *The general quota path (unbuilt).* A deny on any other gated action blocks it, states the limit and what the plan allows, and offers the upgrade path (UC-150).
8. Reporting work in progress is never lost to a quota block, and a started report can always be finished and exported. Quota gates apply at creation boundaries, never mid-task (UX-51; BR-ENT-2).
9. `GET /access/seats` answers the ceiling in force (`allowance`, null when it cannot be read) and the seats held, to the organization-administrator role only.

**Refusals.**
- Invitation beyond the ceiling → 409 `entitlement-quota-exceeded`, with `limit` and `used` extension members (`seat.errors.ts:36`, message key `identity.seats.allowance_reached`)
- Acceptance into an organization already over its ceiling → 409 `entitlement-quota-exceeded`, no extension members; the invitation stays pending and the same link works once a seat is freed (`seat.errors.ts:60`, `identity.seats.acceptance_refused`)
- The ceiling cannot be read → 503 `seat-allowance-unavailable`, on both gates (`seat.errors.ts:78`, `identity.seats.unavailable`)
- `GET /access/seats` by another role → 403 `insufficient-role`; no membership → 403 `membership-required`

**Configuration-held values.** `config/seed/seat-allowance.global.json`: `{ "seats": 10 }`, kind `seat_allowance`, scope `global`. **Task 54.2 deletes it** with its constants, and replaces its source with an `org.seats.max` check; `SeatAllowanceUnavailableError`, its problem type and S-16's paused arm go with it if AD-5's degradation rule replaces fail-closed.

**Boundaries.** A seat is not yet what S-17's counter counts (*active users* from the metering stream; the artboard draws a pending invitation among the free seats). The disagreement is recorded and is task 54.2's with S-17 (`design_spec.md` S-17 note, 13 Sep 2026). The Free plan's seat cap and Standard's quotas are `use_cases.md` OQ-8. The invitation use cases are FR-57's.

**Acceptance criteria.**
- **AC-1** Given an organization holding as many seats as its ceiling, when an Organization Administrator issues an invitation, then it is refused with 409 `entitlement-quota-exceeded` carrying `limit` and `used`, and no invitation is stored. *(source: §12.5.6 task-142 row; archived task 142.1)*
- **AC-2** Given a lapsed invitation, then it still holds a seat until it is revoked. *(source: §12.5.6 task-142 row (2))*
- **AC-3** Given an organization over its ceiling, when an invitee accepts, then it is refused with 409 `entitlement-quota-exceeded` with no `limit` or `used`, and the invitation is still usable once a seat is freed. *(source: task-142 row (a); archived 142.1)*
- **AC-4** Given the ceiling cannot be read, then an invitation and an acceptance are each refused with 503 `seat-allowance-unavailable`. *(source: task-142 row (3))*
- **AC-5** Given two simultaneous invitations at the last seat, then exactly one commits. *(source: task-142 row, consequences)*
- **AC-6** Given the seat block, then it states the limit, what the organization is allowed and the current consumption, offers **no** upgrade path, and names revoking an invitation or removing someone's access. *(source: FR-102 note of 13 Sep 2026; task-142 row (b))*
- **AC-7** Given any quota block, then no reporting work in progress is discarded and a started report can be finished and exported. *(source: FR text; BR-ENT-2; UX-51)* Unmet until 54.2 for gated actions other than seats.
- **AC-8** Given a quota block on a gated action other than the seat ceiling, then it states the limit reached, what the plan allows and the upgrade path. *(source: FR text; UX-50)* Unmet until 54.2 and 63.1.

**History.**
- 13 Sep 2026 · project owner (task 142's batch; the S-16 decision of 12 Sep 2026) · the upgrade-path clause is deferred for the interim seat ceiling, not met; UX-50 does not itself permit its absence · `architecture.md` §12.5.6's task-142 row (b); `design_spec.md` S-16; `use_cases.md` UC-150 note

### FR-103 — Which content falls outside a reduced entitlement

**Status.** Not started — remaining 54.6 (the deterministic selection and the pre-change outcome; UC-151)

**Obligation.** The system shall select which entities and reports fall outside a reduced entitlement by a deterministic, published rule — most recently active retained — and shall show the outcome to the customer before the change takes effect.

| | |
|---|---|
| **Actors** | SYS selects. OA sees the outcome. |
| **Traces** | UC-151, UC-101, UC-142, UC-105 · D-13 · UX-53 · NFR-80 · BR-ENT-3 · AD-5 |
| **Surfaces** | S-24 (consequence disclosure) · no API path exists |

**Preconditions.** A lapse, a downgrade, a suspension or an entitlement reversal (UC-151).

**Behaviour.**
1. The system selects the entities and reports outside the new entitlement and moves them to read-only. Nothing is deleted (UC-151; D-13).
2. The rule is deterministic: the same data gives the same selection. The most recently active are retained.
3. The outcome is shown to the customer before the change takes effect, listing the affected entities and reports by name (UC-101; UX-53; NFR-80).
4. **Active** means the latest field change on a report, which the change trail holds; an entity's activity is the latest over its reports. Reads are not activity, since no access record exists. Ties go to the earlier-created. The number retained is the reduced entitlement's ceiling. The rule is published as a help-centre article (FR-61) and restated in the consequence dialogue (182/65).

**Acceptance criteria.**
- **AC-1** Given the same data, then the selection is the same on every evaluation. *(source: FR text)*
- **AC-2** Given more entities or reports than the reduced entitlement admits, then the most recently active are retained and the rest become read-only. *(source: FR text; UC-151)*
- **AC-3** Given a reduction that has not yet taken effect, then the outcome is displayed before it does. *(source: FR text; UX-53)*
- **AC-4** Given two reports or entities with the same latest activity, then the earlier-created is retained. *(source: §12.5.6 task-182 billing-catalogue row, 182/65)* Unmet: no row yet builds the selection.
- **AC-5** Given a reduced entitlement, then the number of entities and reports retained equals its ceiling. *(source: §12.5.6 task-182 billing-catalogue row, 182/65)* Unmet: no row yet builds the selection.
- **AC-6** Given a report that was only read, then reading does not make it more recently active. *(source: §12.5.6 task-182 billing-catalogue row, 182/65)* Unmet: no row yet builds the selection.

**History.**
- 5 Oct 2026 · project owner · activity is the latest field change; ties to the earlier-created; the count is the ceiling; the rule is a help article · §12.5.6 task-182 billing-catalogue row (182/65)

### FR-104 — Entitlement reduction never deletes

**Status.** Not started — remaining 65.2 (restriction after grace), 73.4 (exit from a lapsed tenant). 54.6 covers the downgrade and cancellation paths of this requirement.

**Obligation.** The system shall delete no disclosure content on lapse, downgrade, suspension or entitlement reversal, moving out-of-entitlement content to read-only and leaving previously generated documents downloadable throughout.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | UC-142, UC-151 · D-13 · NFR-31 · NFR-80 · BR-ENT-4 · FR-26 · FR-141 |
| **Surfaces** | S-07 and S-06 read-only states · S-22 (documents stay) · S-24 |

**Behaviour.**
1. After each of the four events, disclosure content still exists, out-of-entitlement content is read-only, and previously generated documents remain downloadable. This is a prohibition, verified by showing the deleting state unreachable (index §2.5.3).
2. *Suspension* (UC-142): the subscription moves to suspended; reports and entities beyond the Free entitlement become read-only; new exports are blocked; previously generated documents remain downloadable; the Administrator is told exactly what changed and how to restore it.
3. A read-only report names its cause. The third cause, a suspended entitlement, is task 54's and absent from the read-only vocabulary until a producer exists (`architecture.md` §12.5.6's task-35.2 row; FR-26).
4. Full customer data export in an open format works in every subscription state, including lapsed (NFR-31; rehearsed by task 73.4).
5. A **new** export of a read-only report is blocked only on suspension (UC-142). After a downgrade such reports stay exportable within Free's export entitlement, so UC-101 gains no block, and BR-ENT-2 remains a quota rule (182/64).

**Boundaries.** The reversal following a refund or chargeback is FR-141's. Invoice history stays available after downgrade, cancellation and lapse (FR-128, BR-INV-8).

**Acceptance criteria.**
- **AC-1** Given each of lapse, downgrade, suspension and entitlement reversal, then no disclosure content has been deleted. *(source: FR text; D-13)*
- **AC-2** Given content outside the reduced entitlement, then it is read-only. *(source: FR text; UC-151)*
- **AC-3** Given each of the four events, then previously generated documents remain downloadable. *(source: FR text; UC-142)*
- **AC-4** Given a suspension, then the Administrator is told exactly what has changed and how to restore it. *(source: UC-142 step 4; UX-54)*
- **AC-5** Given a suspended subscription, then a new export of a read-only report is refused. *(source: §12.5.6 task-182 billing-catalogue row, 182/64)* Unmet until 65.2.
- **AC-6** Given a downgrade, then a read-only report can still be exported, within Free's export entitlement. *(source: §12.5.6 task-182 billing-catalogue row, 182/64)* Unmet until 54.2.

**History.**
- 5 Oct 2026 · project owner · a new export from a read-only report is blocked only on suspension · §12.5.6 task-182 billing-catalogue row (182/64)

### FR-105 — The metering stream

**Status.** Not started — remaining 62.1 (the table, its partitions, append-only), 62.2 (event capture), 62.3 (usage counters), 63.10 (S-17), 69.1 (adoption metrics)

**Obligation.** The system shall emit an append-only metering event carrying organization, action type, quantity and timestamp for every billable-shaped action, including actions not currently billed, and shall serve organization usage counters, quota evaluation and adoption metrics from that single stream, presenting consumption against the entitlement limit rather than as a bare number.

| | |
|---|---|
| **Actors** | SYS emits. OA reads own usage. PA and BO read adoption metrics (`actors.md` §5). |
| **Traces** | UC-152, UC-66 · UC-83 · legacy `FR-23` (index §9.5) · P-10 · DR-6 · NFR-10 · NFR-47 · NFR-57 · BR-ENT-5 · entity *Metering event* |
| **Surfaces** | S-17 (usage counters) · A-06 adoption metrics (UC-83, FR-83) · no API path exists |

**Behaviour.**
1. Every billable-shaped action emits one event, including actions that are not currently billed, so a pricing unit can be evaluated end to end without a code change (UC-152; NFR-10; P-10).
2. An event carries the organization, the action type, the quantity, the timestamp and a stable event key (§9.6).
3. Delivery is at-least-once and the stream de-duplicates on the event key, so counters are exact (NFR-57; AD-6).
4. The stream is `audit.metering_event`. The runtime roles hold INSERT and SELECT only; UPDATE and DELETE are denied by trigger, TRUNCATE by a separate trigger, and the table is partitioned (§7.7; DR-6). It lives in `audit` and not in `billing`, so it keeps flowing with `BILLING_ENABLED=false`.
5. Three consumers read the one stream: organization usage counters, quota evaluation in the entitlement service (FR-99) and the adoption dashboard (§9.6).
6. S-17 shows reporting entities, active users, reports created, exports by format and API calls, each against its entitlement limit (UC-66).
7. Events are retained 24 months (`architecture.md` §12.5.7). The volume to size for is at most 50,000 events a day at peak (`non_functional_requirements.md` §3).
8. An instant is `timestamptz` in storage and an epoch-millisecond integer on the wire (OQ-50).
9. The list of billable-shaped actions is task 54.2's list, emitted from by 62.2: one list, two consumers. The reports entitlement counts the reports the organization holds, in total: not per fiscal year and not per billing cycle (182/79). Events are retained 24 months (item 7), so a lifetime total cannot be summed from them, and its counter is held as a maintained count (task 62.3).

**Boundaries.** Whether a seat is the stream's *active user* is the recorded disagreement of FR-102's boundaries. Usage-based pricing is later; the stream is what makes it a pricing decision (`architecture.md` §15.1).

**Acceptance criteria.**
- **AC-1** Given a billable-shaped action, including one not currently billed, then one event with the four attributes is stored. *(source: FR text; UC-152)*
- **AC-2** Given a stored event, then an update, a delete and a truncate are each refused by the database. *(source: FR text; DR-6; §7.7)*
- **AC-3** Given an event delivered twice, then one is counted. *(source: NFR-57)*
- **AC-4** Given usage counters, quota evaluation and adoption metrics, then each derives from the same stream and from no second counter. *(source: FR text; UC-152)*
- **AC-5** Given a counter shown to the Administrator, then it is shown against the entitlement limit and not as a bare number. *(source: FR text; UC-66)*
- **AC-6** Given `BILLING_ENABLED=false`, then events are still emitted. *(source: `metering.module.ts` docblock; NFR-1)*
- **AC-7** Given reports in more than one fiscal year, then the reports counter shows their total against the entitlement limit, and it does not reset at a billing cycle. *(source: §12.5.6 task-182 billing-catalogue row, 182/79)* Unmet until 62.3.

**History.**
- 5 Oct 2026 · project owner · the reports counter is a total, held as a maintained count · §12.5.6 task-182 billing-catalogue row (182/79)


## 4. Billing account (index §3.20)

### FR-106 — The billing account, distinct from the organization profile

**Status.** Not started — remaining 63.13 (the billing account record), 63.7 (S-23 billing account)

**Obligation.** The system shall maintain billing account data distinct from the organization profile: registered legal name, IDNO, VAT registration code where registered, legal address and billing contact.

| | |
|---|---|
| **Actors** | OA edits. AD edits the advisor's own firm's (`actors.md` §5). |
| **Traces** | UC-108 · D-10 · OQ-18 · NFR-71 · FR-15 · FR-17 · entity *Billing account* |
| **Surfaces** | S-23 (Record archetype) · no API path exists |

**Behaviour.**
1. The invoiced legal person is not always the reporting entity, particularly in a group structure, which is why the data is its own record (UC-108).
2. It is editable independently of the organization profile (FR-15). The identifiers of the *reporting entity* are the entity's (FR-16; task 175); the billing account's IDNO and VAT code are its own, retained in `billing` (`architecture.md` OQ-18).
3. The record lives in the `billing` schema, referencing the organization by identifier and no foreign key (§5.2; NFR-15).
4. The fiscal documents read this record. A change to it never alters an issued invoice (BR-INV-2; D-10).
5. **The billing account holds exactly the five fields above** (182/112). A billing contact is a name and an email. No e-Factura recipient is held: the buyer is identified by its IDNO (FR-126), and a distinct recipient identifier is added only if the e-Factura specification (55.4) requires one. The legal address includes its country, from which VAT residency is derived (FR-124; 182/85). **Required before an order are the legal name, the IDNO, the legal address and the contact email; the VAT registration code stays optional.** **An organization holds exactly one billing account** (182/113), which matches S-23 and the one-subscription model; a group that needs several invoiced persons runs several organizations.

**Acceptance criteria.**
- **AC-1** Given a billing account, then it holds a registered legal name, an IDNO, a VAT registration code where the company is registered, a legal address and a billing contact. *(source: FR text; UC-108)*
- **AC-2** Given a change to the billing account, then the organization profile is unchanged, and the reverse. *(source: FR text; UC-108)*
- **AC-3** Given an issued invoice, when the billing account changes, then the invoice is unchanged. *(source: BR-INV-2; D-10)*
- **AC-4** Given a billing account missing its legal name, IDNO, legal address or contact email, then an order cannot be confirmed, and a missing VAT registration code does not prevent it. *(source: §12.5.6 task-182 payment and fiscal row, 182/112)*
- **AC-5** Given an organization, then it holds at most one billing account. *(source: §12.5.6 task-182 payment and fiscal row, 182/113)*

**History.**
- 5 Oct 2026 · project owner · the five fields are exact, a contact is a name and an email, four are required before an order, no e-Factura recipient is held · §12.5.6 task-182 payment and fiscal row (182/112)
- 5 Oct 2026 · project owner · an organization holds exactly one billing account · §12.5.6 task-182 payment and fiscal row (182/113)

### FR-107 — Validate fiscal identifiers

**Status.** Not started — remaining 63.13 (the validation); 63.7 hosts the screen. The IDNO shape rule it will reuse is delivered (task 29.2), and its check digit arrives with 188.

**Obligation.** The system shall validate the format of supplied fiscal identifiers and, where a lookup is available, verify existence and VAT status.

| | |
|---|---|
| **Actors** | SYS validates, on submission or change by the OA. |
| **Traces** | UC-109 · UC-108 · D-10 · NFR-79 · BR-FIS-1 · FR-16 |
| **Surfaces** | S-23 · S-13 (the IDNO's *verified* marker is this requirement's) · no API path exists |

**Preconditions.** An IDNO and, where applicable, a VAT code have been supplied (UC-108).

**Behaviour.**
1. The format of the IDNO and the VAT code is checked on submission or change (UC-109).
2. A failing identifier is rejected at entry, because an invoice carrying an invalid fiscal code is rejected by the national e-Factura platform and cannot be corrected by editing (BR-FIS-1; D-10).
3. The message is a three-part message that states what failed, the consequence, and what resolves it, and not a bare format error (S-23; NFR-79).
4. **The IDNO rule:** thirteen digits and, from 188, the check digit (the first twelve digits weighted 7, 3, 1 repeating, the sum modulo 10). Until then the check digit is **not evaluated**, and the verdict says so rather than claiming a pass (`architecture.md` §7.2; archived task 29.2). The function is shared, so the check reaches this requirement with no change of its own (§12.5.6 task-182 identity and organization row, 182/12; FR-16).
5. Where a lookup is available, existence and VAT status are verified and the result recorded (UC-109). The VAT registration code gets **a shape check only**: no public checksum for it is known, which is an assumption recorded here and not a finding. The shape is the tax authority's published form of the code, which the task building this requirement cites, since no source in this set states it (§12.5.6 task-182 identity and organization row, 182/12). **No lookup exists at the MVP** (182/114): the format is checked and the *verified* marker is not shown (task 30.4.2 already draws none). A lookup behind a port, advisory and never blocking, is added when a register is named. The IDNO's check digit (182/12) is a local computation and is not a lookup.

**Refusals.** A malformed identifier is rejected at entry (FR text; BR-FIS-1). No wire outcome is built.

**Acceptance criteria.**
- **AC-1** Given an IDNO that is not thirteen digits, when it is submitted, then it is rejected at entry. *(source: FR text; BR-FIS-1; §7.2 on the shape rule)*
- **AC-2** Given a malformed VAT code, when it is submitted, then it is rejected at entry. *(source: FR text; BR-FIS-1; §12.5.6 task-182 identity and organization row, 182/12)* The check is of shape only; no checksum is run.
- **AC-3** Given the MVP, then no register lookup runs, an identifier is checked for format only, and no *verified* marker is shown, so existence and VAT status are never claimed. *(source: FR text; UC-109; §12.5.6 task-182 payment and fiscal row, 182/114)* Where a register is later named, a lookup behind a port records its result and is advisory, never blocking.
- **AC-4** Given a rejection, then the message states the consequence for the invoice and what resolves it. *(source: S-23; NFR-79)*

**History.**
- 5 Oct 2026 · project owner · no fiscal-register lookup at the MVP: format only, no verified marker · §12.5.6 task-182 payment and fiscal row (182/114)
- **AC-5** Given an IDNO of thirteen digits whose check digit is wrong, when it is submitted, then it is rejected at entry, by the same function FR-16 uses. *(source: FR text; BR-FIS-1; §12.5.6 task-182 identity and organization row, 182/12)* Unmet until 188.

## 5. Order and checkout (index §3.21)

### FR-108 — The order, with its own lifecycle

**Status.** Not started — remaining 58.5 (the order record and its api), 58 (order saga), 58.4 (order expiry), 63.2, 63.3

**Obligation.** The system shall model the order as an entity with its own lifecycle — draft, awaiting payment, paid, provisioned, expired, cancelled, failed — separate from both the subscription and the invoice, so that an unpaid attempt leaves no orphaned subscription and no issued fiscal document.

| | |
|---|---|
| **Actors** | OA creates. SYS advances (saga). |
| **Traces** | UC-110, UC-97 · D-7 · AD-6 · NFR-54 · NFR-59 · NFR-90 · BR-SUB-1 · BR-INV-1 · entity *Order* |
| **Surfaces** | S-19 · `POST /orders`, `POST /orders/:id/confirm`, `GET /orders/:id` (`architecture.md` §11.2, a sequence not a built contract) |

**Inputs.** A plan version, a billing cycle, a currency and a quantity (UC-110; `architecture.md` §11.2 sends the currency). The currency is picked among those the plan version is priced in (182/66). The quantity is 1 while no plan version carries a unit price (182/73).

**Behaviour.**
1. The order is the unit of commercial intent, separate from both the subscription and the invoice (UC-110).
2. An order is in exactly one of seven states.
3. The order → payment → invoice → entitlement sequence runs as a persisted saga with compensations (AD-6). The order is the aggregate that sits between the subscription and the invoice (§7.4).
4. No invoice number is reserved at order creation; numbers are allocated at issuance (BR-INV-1).
5. One correlation identifier spans order, payment, fiscal document, transmission and entitlement change (NFR-90).
6. **The transitions** (182/61). *Draft* becomes *awaiting payment* on confirmation. *Awaiting payment* becomes *paid* on settlement, and *paid* becomes *provisioned* when the entitlements are applied. *Awaiting payment* becomes *expired* when the proforma's validity ends, and *failed* on a hard decline or a provider failure. *Draft* and *awaiting payment* become *cancelled* on cancellation (FR-113). *Expired*, *cancelled*, *failed* and *provisioned* are end states.
7. **`inconsistent` is the saga's status beside the order, not an eighth state** (182/61): the customer sees seven states, and the saga's residue stays an operator concern (A-10, NFR-59).
8. **The expiry period is configuration** (AD-4), tied to the proforma's validity date; its value is set with the saga (task 58.1) and no source fixes it yet.

**Acceptance criteria.**
- **AC-1** Given an order, then it is in exactly one of draft, awaiting payment, paid, provisioned, expired, cancelled or failed. *(source: FR text; UC-110)*
- **AC-2** Given an abandoned order, then no subscription and no issued fiscal document results. *(source: FR text; UC-110)*
- **AC-3** Given an order created, then no invoice number is consumed. *(source: BR-INV-1)*
- **AC-4** Given an order, then it moves between states only by the transitions of item 6. *(source: §12.5.6 task-182 billing-catalogue row, 182/61)* Unmet until 58.1.
- **AC-5** Given an order awaiting payment whose proforma validity ends with no settlement, then the order is expired. *(source: §12.5.6 task-182 billing-catalogue row, 182/61)* Unmet until 58.4.
- **AC-6** Given a saga that ends inconsistent, then the order still reads as one of the seven states and the inconsistency is an operator work item. *(source: §12.5.6 task-182 billing-catalogue row, 182/61)* Unmet until 58.2.
- **AC-7** Given an order created, then its currency is one the plan version is priced in. *(source: §12.5.6 task-182 billing-catalogue row, 182/66)* Unmet until 63.2.

**History.**
- 5 Oct 2026 · project owner · the order's transitions, expiry and failure; `inconsistent` is not an eighth state · §12.5.6 task-182 billing-catalogue row (182/61)
- 5 Oct 2026 · project owner · the order is placed in a currency chosen among the version's priced currencies; quantity 1 · §12.5.6 task-182 billing-catalogue row (182/66, 73)

### FR-109 — Apply a discount code at entry

**Status.** Not started — remaining 58.5 (the code's validation), 63.2 (the order screen); 68.3 defines the codes

**Obligation.** The system shall validate a discount code at entry against plan eligibility, validity window and remaining redemptions, recalculating the order total or rejecting the code with its reason stated.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-111 · UC-94 · FR-89 · entity *Discount code* |
| **Surfaces** | S-19 · no API path exists |

**Preconditions.** An order in draft and a defined discount code (UC-111).

**Behaviour.**
1. The Administrator enters the code. The system validates it against plan eligibility, validity window and remaining redemptions, then recalculates the order total (UC-111).
2. An invalid or exhausted code is rejected at entry with the reason, and not silently ignored (UC-111; S-19).
3. **A redemption is reserved, consumed and released by the order** (182/77). The code is validated at entry, which consumes nothing; reserved at confirmation; consumed when the order is paid; and released when the order is cancelled, expired or failed. One code applies to one order. Consuming at entry would let an abandoned draft exhaust a limited code, and consuming at paid alone would let two concurrent buyers take the last redemption.

**Refusals.** An ineligible, expired or exhausted code is rejected with its reason stated (FR text). No wire outcome is built.

**Acceptance criteria.**
- **AC-1** Given a valid code, then the order total is recalculated. *(source: FR text; UC-111)*
- **AC-2** Given a code ineligible for the plan, outside its validity window or with no redemptions remaining, then it is rejected at entry and the reason is shown. *(source: FR text; UC-111)*
- **AC-3** Given a code entered on a draft order, then no redemption is consumed; given the order is confirmed, then one is reserved; given it is paid, then it is consumed; given it is cancelled, expired or failed, then the reservation is released. *(source: §12.5.6 task-182 billing-catalogue row, 182/77)* Unmet until 63.2.
- **AC-4** Given an order that already holds a code, then a second code is refused. *(source: §12.5.6 task-182 billing-catalogue row, 182/77)* Unmet until 63.2.

**History.**
- 5 Oct 2026 · project owner · a redemption is reserved at confirmation, consumed at paid and released on cancelled, expired or failed; one code per order · §12.5.6 task-182 billing-catalogue row (182/77)

### FR-110 — The order summary and the rails available for it

**Status.** Not started — remaining 58.5 (the summary), 63.2

**Obligation.** The system shall present an order summary showing net amount, VAT rate and basis, gross total in the order currency, and the payment rails available for that total, stating the reason where a rail is excluded rather than omitting the option.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-112 · D-8 · UX-55, UX-56 · BR-PAY-3, BR-PAY-7 · FR-118 · FR-124 |
| **Surfaces** | S-19 (money summary as the confirmation region) · `POST /orders` answers it (§11.2) |

**Preconditions.** An order with a computed total, and VAT rules in force (UC-112).

**Behaviour.**
1. The summary shows the net amount, the VAT applied with its rate and basis, and the gross total in the order currency, before confirmation (UC-112; UX-55).
2. It shows the payment rails available for that total. Rail availability is a function of the total (D-8).
3. A rail excluded for exceeding the MIA ceiling is shown unavailable **with the reason**, and is never omitted (UC-112; UX-56; BR-PAY-7). The ceiling is read from configuration (BR-PAY-3).
4. The VAT rule is FR-124's. The rails are FR-114 … FR-119. The order's currency is the one the customer picked among the plan version's priced currencies (182/66).

**Acceptance criteria.**
- **AC-1** Given an order, then the summary shows the net amount, the VAT rate and basis, and the gross total in the order currency. *(source: FR text; UX-55)*
- **AC-2** Given a total above the MIA ceiling, then MIA is shown as unavailable with its reason and is not hidden. *(source: FR text; UX-56)*
- **AC-3** Given a plan version priced in several currencies, then the customer chooses among them and the summary is in the one chosen. *(source: §12.5.6 task-182 billing-catalogue row, 182/66)* Unmet until 63.2.

**History.**
- 5 Oct 2026 · project owner · the order currency is chosen among the version's priced currencies · §12.5.6 task-182 billing-catalogue row (182/66)

### FR-111 — Evidence of what was agreed

**Status.** Not started — remaining 58.5 (the terms capture), 63.3; 75.1 (the terms document's version, which 63.3 records)

**Obligation.** The system shall record the accepted terms version, timestamp and acting user against the order on confirmation.

| | |
|---|---|
| **Actors** | OA confirms. |
| **Traces** | UC-113 · UC-146 · FR-140 · AD-6 · entity *Terms acceptance* |
| **Surfaces** | S-19 · `POST /orders/:id/confirm` (§11.2) |

**Preconditions.** An order summary has been reviewed (UC-113).

**Behaviour.**
1. The Administrator confirms, accepting the subscription terms and the plan's specific conditions (UC-113 step 1).
2. The system records the accepted terms version, the timestamp and the acting user against the order (UC-113 step 2).
3. A subscription agreement is a contract and the platform must be able to evidence what was agreed. The record is the input to the chargeback evidence pack (FR-140).
4. The terms text is committed to the release (FR-205), and a "terms version" is that document's version identifier. The record carries the plan version identifier beside it (§12.5.6 task-182 public tier row, 182/116).

**Acceptance criteria.**
- **AC-1** Given an order confirmed, then the terms version, the timestamp and the acting user are recorded against it. *(source: FR text; UC-113)*
- **AC-2** Given a confirmation, then the plan's specific conditions are among what is accepted. *(source: UC-113 step 1)*
- **AC-3** Given an order confirmed, then the record names the version identifier of the terms document and the plan version identifier. *(source: §12.5.6 task-182 public tier row, 182/116)* Unmet until 63.3 and 75.1.

**History.**
- 5 Oct 2026 · project owner · the terms version is the release-supplied version of the terms document, recorded with the plan version identifier · §12.5.6 task-182 public tier row (182/116)

### FR-112 — Track an order through settlement

**Status.** Not started — remaining 58.5 (the order status), 63.3

**Obligation.** The system shall track order status through its lifecycle, showing what is outstanding, the reference the payer must quote, and the consequence if payment does not arrive.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-114 · UC-121, UC-126, UC-138 · UX-58, UX-59 |
| **Surfaces** | S-19 (status) · S-20 (the reference on the transfer rail) · `GET /orders/:id` (§11.2) |

**Preconditions.** A confirmed order (UC-114).

**Behaviour.**
1. The order shows its current state, the outstanding amount, the payment reference to quote and what happens if payment does not arrive (UC-114).
2. It matters most on the bank transfer rail, where settlement is asynchronous and can take days (UC-114).
3. On that rail the reference is the single most prominent element, copyable in one action, beside the proforma and the consequence of omitting it (UX-59).
4. A return from a provider with an indeterminate result shows *pending* with what happens next and when, not an error (UX-58).
5. The reference's format is FR-119's and FR-121's. The consequence of non-payment is expiry: the order expires when the proforma's validity date passes (FR-108; 182/61), and the screen states the date.

**Acceptance criteria.**
- **AC-1** Given a confirmed order, then it displays its current state, the outstanding amount, the payment reference to quote and the consequence of non-payment. *(source: FR text; UC-114)*
- **AC-2** Given an indeterminate return, then the order reads *pending* with what happens next. *(source: UX-58)*
- **AC-3** Given an order awaiting payment, then it states the date on which it expires if payment does not arrive. *(source: §12.5.6 task-182 billing-catalogue row, 182/61)* Unmet until 63.3.

**History.**
- 5 Oct 2026 · project owner · the consequence of non-payment is expiry on the proforma's validity date · §12.5.6 task-182 billing-catalogue row (182/61)

### FR-113 — Cancel an unpaid order

**Status.** Not started — remaining 58.5 (the cancellation), 63.3; 61.1 for the proforma

**Obligation.** The system shall allow an unpaid order to be cancelled and shall void any associated proforma invoice.

| | |
|---|---|
| **Actors** | OA. |
| **Traces** | UC-115 · D-10 · UX-70 · BR-INV-3 · FR-121 |
| **Surfaces** | S-19 · no API path exists |

**Preconditions.** The order has not been paid (UC-115).

**Behaviour.**
1. The Administrator cancels. Cancellation voids any associated proforma (UC-115).
2. Voiding is possible because a proforma is not a fiscal document: it creates no VAT liability, consumes no invoice number and is voidable with its order (BR-INV-3).
3. A fiscal invoice, once issued, can only be reversed by credit note (D-10; UC-115). An order with an issued fiscal invoice is not cancellable by this path.
4. Cancelling is a consequence-disclosing action (UX-70; S-19).
5. **Unpaid means draft or awaiting payment**, and an order is cancellable in either whether or not a payment is in flight (182/62). A payment that arrives for an order already cancelled goes to reconciliation as an unmatched payment (FR-133).

**Acceptance criteria.**
- **AC-1** Given an unpaid order with a proforma, when it is cancelled, then the proforma is void. *(source: FR text; UC-115)*
- **AC-2** Given an order with an issued fiscal invoice, then it is not cancellable by this path. *(source: FR text; D-10)*
- **AC-3** Given a cancelled order, then no invoice number was consumed. *(source: BR-INV-3)*
- **AC-4** Given an order in draft or awaiting payment, then it can be cancelled, including while a payment is in flight. *(source: §12.5.6 task-182 billing-catalogue row, 182/62)* Unmet until 63.3.
- **AC-5** Given a payment that arrives after its order was cancelled, then it appears in reconciliation as an unmatched payment. *(source: §12.5.6 task-182 billing-catalogue row, 182/62)* Unmet until 65.4.

**History.**
- 5 Oct 2026 · project owner · an unpaid order is cancellable in flight; a late payment goes to reconciliation · §12.5.6 task-182 billing-catalogue row (182/62)

## 6. Business rules held in this part

Moved from the index's §4.3 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority. The other rules of §4.3 (BR-PAY, BR-INV, BR-COL, BR-LED) move with part 7.

| Rule | Statement | Held in |
|---|---|---|
| BR-ENT-1 | An entitlement check returns exactly one of allow, deny, allow-with-warning, and is answered by the central service. *(Until task 54.2, the interim seat ceiling is answered by a configured artefact and deliberately not by the service: `architecture.md` §12.5.6's task-142 row.)* | FR-99, FR-100 |
| BR-ENT-2 | A quota block never discards work in progress, and a started report can always be finished and exported. | FR-102 |
| BR-ENT-3 | On reduced entitlement, the entities and reports retained are selected deterministically — most recently active retained — and the outcome is shown before the change takes effect. | FR-103 |
| BR-ENT-4 | No disclosure content is deleted on lapse, downgrade, suspension or entitlement reversal; out-of-entitlement content becomes read-only and previously generated documents stay downloadable. | FR-104, FR-136, FR-141, D-13 |
| BR-ENT-5 | A metering event is emitted for every billable-shaped action, including actions not currently billed. | FR-105 |
| BR-SUB-1 | Entitlements change on confirmed payment, or on invoice issuance under approved bank transfer terms — never on order creation. | FR-92, FR-108 |
| BR-SUB-2 | An upgrade is immediate with a prorated credit; a downgrade takes effect at the end of the paid period with advance disclosure of what becomes read-only. | FR-94 |
| BR-SUB-3 | Mid-cycle additions are prorated to the period end; removals apply to the following period and generate no mid-cycle refund. | FR-96 |
| BR-SUB-4 | Cancellation takes effect at the close of the paid period, not immediately. | FR-97 |
| BR-SUB-5 | A plan version change requires an explicit grandfathering choice; each subscription references the plan version it was sold under. | FR-87 |
| BR-SUB-6 | Retiring a plan closes it to new subscriptions and requires a successor plan to be named; it terminates no existing service: each subscriber keeps its service without a gap and moves to the successor at its next renewal, disclosed in advance. *(Amended 5 Oct 2026, project owner, task 182, 182/80: the earlier statement left subscribers on the retired plan.)* | FR-88 |
| BR-SUB-7 | Enterprise never passes through self-serve checkout; it is provisioned from a quote or contract by additive entitlement overrides. | FR-142, FR-143, FR-145, D-12 |
| BR-FIS-1 | A fiscal identifier failing format validation is rejected at entry, because an invalid code cannot be corrected after issuance. | FR-107, D-10 |

## 7. Entities held in this part

Moved from the index's §5.4 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model. The remaining rows of §5.4 move with part 7.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Plan / plan version | Code, description, positioning, version, published state (per version), retired state and successor plan (per plan), grandfathering choice | FR-84, FR-87, FR-88 |
| Entitlement / quota | Key, value kind (switch, ceiling or tier), warning band; entities, seats, reports in total, exports by format, API allowance, module access, support tier | FR-85 |
| Price | Plan version, currency, billing cycle, amount | FR-86 |
| Discount code | Percentage or fixed (a fixed amount authored per currency), first-period or recurring, validity dates, redemption limits, plan eligibility | FR-89, FR-109 |
| Trial terms | Length, payment-instrument requirement, expiry behaviour, per plan version | FR-89, FR-93 |
| Subscription | State (trialling / active / past due / suspended / cancelled / lapsed), plan version, entitlements, billing cycle, renewal or expiry date, next amount due, auto-renewal flag; absent while the organization is on Free | FR-90, FR-97 |
| Entitlement override | Additive per-subscription overrides from contract | FR-145, FR-144 |
| Subscription change record | Change class, date, acting user (the system for what the system does), resulting entitlements | FR-98 |
| Metering event | Organization, action type, quantity, timestamp; append-only | FR-105 |
| Billing account | Registered legal name, IDNO, VAT registration code, legal address, billing contact | FR-106, FR-107 |
| Order | State (draft / awaiting payment / paid / provisioned / expired / cancelled / failed), plan version, cycle, quantity, currency, net, VAT, gross, payment reference | FR-108, FR-110, FR-112 |
| Terms acceptance | Terms version, timestamp, acting user | FR-111 |
