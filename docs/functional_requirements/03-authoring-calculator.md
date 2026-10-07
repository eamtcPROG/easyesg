# Functional requirements — Part 3: Report authoring, calculator and draft persistence

Part 3 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.5 Report authoring | FR-24 … FR-32, FR-177, FR-210 |
| 3.6 Carbon calculator | FR-33 … FR-36 |
| 3.7 Draft persistence | FR-37 … FR-39 |

Business rules held here: BR-APP-1 … BR-APP-5, BR-DIS-1 … BR-DIS-4, BR-CALC-1 … BR-CALC-3 (§4). Entities held here: §5.

**Who writes a report.** Every write in this part is admitted for a member holding the **editor** or **Organization Administrator** role. A member holding **view-only** rights reads and never writes (403 `insufficient-role`). A **locked** period refuses every write, the administrator's included (409 `report-not-editable`; FR-22). The Organization Administrator's admission was settled on 5 Oct 2026 (`architecture.md` §12.5.6's task-182 row (1); D-2 amended). It was never a role gate: entity master data stays the Organization Administrator's alone (FR-17), and the report is something either role may fill. The blocks below say *editor or OA* for this rule rather than restating it. **Deleting a report is the Organization Administrator's alone** (FR-210, 5 Oct 2026, 182/23).

## 1. Report authoring (index §3.5)

### FR-24 — The guided wizard

**Status.** Partial — delivered 35.1, 35.2, 35.3, 36.1 … 36.14, 89, 91.1 … 91.4, 179, 180, 183 · remaining 94 (help for undocumented elements)

**Obligation.** The system shall provide a guided, stepped wizard over every VSME Basic Module disclosure B1 … B11, one step per module, capturing a module's structured and narrative content together, and entering a report at the module where work last happened or, where nothing is answered, at the first incomplete step.

| | |
|---|---|
| **Actors** | Editor or OA writes. A view-only member reads the same steps read-only. |
| **Traces** | UC-18, UC-19 … UC-29 (UC-20 named, OQ-4) · D-2 · AD-3 · AD-9 · UX-9, UX-10, UX-13 · FR-155 |
| **Surfaces** | S-07 (Wizard archetype) · `GET /reports/{id}/modules` · `GET /reports/{id}/modules/{module}` · `PUT /reports/{id}/values` · `PUT /reports/{id}/derivation-inputs` |

**Preconditions.** A report exists for an open or locked period (FR-21). A locked period serves its steps read-only.

**Behaviour.**
1. The api joins the taxonomy, the labels and the stored values. The screen joins none of them (§12.5.6 task-89 row).
2. The steps are the modules of the taxonomy version pinned to the report (FR-66). A module's code (`B1` … `C9`) is data and renders untranslated (task-35.1 row).
3. An element may belong to several modules, as B3 and C3 share eight (task-36.4 row).
4. Within a step, single questions come first and repeating groups after. A typed axis renders as a group per ordinal, and the reporter may add one (task-179.2 and task-36.2 rows).
5. The module list derives each module's state in the browser — omitted, not applicable (waiting on B1 / ruled out), complete, in progress, not started — and never gates navigation (task-179.1 row).
6. Entry follows FR-39's position rule.
7. Help is EFRAG's documentation label where one exists. For the elements EFRAG leaves undocumented, help is task 94's (task-91.1 row).

**Refusals.**
- A step read for a module the pinned taxonomy lacks → 404 `not-found` (`core.report.module_not_found`; task 183; §12.5.6's task-182 row (6))
- A report pinned to a withdrawn taxonomy version → 500 `taxonomy-version-unavailable` (task-89 row)
- Unknown report, or one outside the active organization → 404 `not-found`

**Boundaries.** Conditional display is FR-28. Saving is FR-37. The Comprehensive modules are FR-177. Validation findings are FR-40 and FR-41.

**Acceptance criteria.**
- **AC-1** Given a Basic report, then every applicable B1 … B11 disclosure is reachable as a field in the wizard. A disclosure that FR-28 rules out is not shown. *(source: FR text; §12.5.6 task-36.9 row)*
- **AC-2** Given a module with both structured and narrative disclosures, then both are on its one step. *(source: FR text; UC-25)*
- **AC-3** Given answers in several modules, when the report is opened, then it enters at the module with the latest answer. If nothing is answered, it enters at the first incomplete step. *(source: §12.5.6 task-35.3 row)*
- **AC-4** Given a view-only member, then every step reads with no editable control and a banner naming the cause. *(source: §12.5.6 task-35.2 row; UX-13)*
- **AC-5** Given a module code the pinned taxonomy lacks, when its step is read, then the answer is 404. *(source: §12.5.6 task-182 row (6))*

**History.**
- 18 Aug 2026 · OQ-4 closed · UC-20 named explicitly in Source UC · index §10
- 2 Sep 2026 · project owner · entry at the module of last work, with the first incomplete step only where nothing is answered · §12.5.6 task-35.3 row; UC-18, UX-10
- 5 Oct 2026 · project owner · an unknown module is a 404 · §12.5.6 task-182 row (6)

### FR-25 — The reports list

**Status.** Partial — delivered 31.3, 32.2, 32.2.1, 32.2.2 · remaining 40, 41.1, 41.3 (completion and validation summary)

**Obligation.** The system shall list the reports of the active organization, each with its entity, period, scope, status and last activity and its completion and validation summary, showing a view-only member the same entries without edit affordances.

| | |
|---|---|
| **Actors** | Every member of the active organization reads. Editor or OA may create a report from the list. |
| **Traces** | UC-17 · `architecture.md` OQ-30 · UX-68 |
| **Surfaces** | S-06 (Index archetype) · `GET /reports` · `GET /reports/{id}` · `POST /reports` · S-39 |

**Behaviour.**
1. Each row answers its subject (entity name, period year and dates), resolved server-side rather than assembled by the screen (task-32.2 row).
2. Rights are derived per request from the member's role, the period's state and the entity. Nothing is set per report (OQ-30).
3. The completion and validation columns are **refused until their producers exist** (41.3 and 40/41), not drawn as *"not yet available"* (task-32.2 row).
4. Last activity shows the instant without the person, until a read serving UX-68 exists (task-32.2.2 row).
5. A deleted report (FR-210) is not listed.

**Refusals.** No membership in the active organization → 403 `membership-required` · Unknown report → 404 `not-found`

**Acceptance criteria.**
- **AC-1** Given reports in the active organization, then each is listed with entity, period dates, scope and status. *(source: FR text; §12.5.6 task-32.2 row)*
- **AC-2** Given a view-only member, then the same entries are listed and no create or edit control is offered. *(source: FR text; UC-17)*
- **AC-3** Given validation and completion have run, then each entry shows its completion and validation summary. *(source: FR text)* Unmet until 41.3.

**History.**
- 31 Aug 2026 · project owner · rows answer their subject; the summary columns are refused until their producers exist · §12.5.6 task-32.2 rows

### FR-26 — Who may edit, and when

**Status.** Built — delivered 31.2, 31.3, 31.4, 34.1, 35.2, 89

**Obligation.** The system shall admit a write to a report only from a member holding the editor or Organization Administrator role, and only while the report's period is open, refusing it on every route and in the database rather than only in the interface.

| | |
|---|---|
| **Actors** | Editor or OA. View-only refused. The lock refuses everyone. |
| **Traces** | UC-18, UC-57 · FR-22, FR-158 · OQ-30 · UX-13 · BR-PER-1 |
| **Surfaces** | S-07 and S-06 read-only states · every report write route · S-39 |

**Behaviour.**
1. There is no stored "editable session". The check runs per request: the role at the guard, and the lock as a trigger beneath the store that also refuses a DELETE (task-89 and task-34.1 rows).
2. Every tenant table referencing a report or period either carries the lock trigger or is declared exempt, which a schema invariant asserts (task-31.4 row).
3. Read-only names its cause. The lock outranks the role, so a viewer on a locked period sees the lock named (task-35.2 row).

**Refusals.** View-only → 403 `insufficient-role` · Period locked → 409 `report-not-editable`

**Boundaries.** The third read-only cause, a suspended entitlement (UX-13, UC-142), is FR-104's and task 54's.

**Acceptance criteria.**
- **AC-1** Given a view-only member, when they write any value, then the write is refused with 403 and nothing is stored. *(source: FR text; §12.5.6 task-31.3 row)*
- **AC-2** Given a locked period, when an editor or OA writes, then the write is refused with 409, including a delete. *(source: §12.5.6 task-31.2 and task-34.1 rows)*
- **AC-3** Given a write that bypasses the use case and reaches the store directly on a locked report, then the database refuses it. *(source: §12.5.6 task-89 row; P-4)*

**History.**
- 30 Aug 2026 · project owner · the lock refuses every write, the administrator's included · §12.5.6 task-31.2 row; FR-22
- 31 Aug 2026 · project owner · the report follows the editor; rights are derived, not stored · §12.5.6 task-31.3 row; OQ-30
- 5 Oct 2026 · project owner · obligation restated around the two roles that write · §12.5.6 task-182 row (1)

### FR-27 — B1 pre-filled from the company record

**Status.** Built — delivered 31.1, 36.2, 91.2, 180.2, 180.3

**Obligation.** The system shall pre-fill B1 from the reporting entity's point-in-time snapshot (FR-18), keep every pre-filled value editable in the report without altering the entity record, and refresh the snapshot from the entity until B1 is first opened.

| | |
|---|---|
| **Actors** | Editor or OA answers B1. OA alone edits the entity record (FR-17). |
| **Traces** | UC-19, UC-52, UC-53 · D-2 · FR-18 · UX-34, UX-109 · BR-DIS-4 |
| **Surfaces** | S-07 B1 step (`defaultValue`, `fromRecord`, "From the company record") · S-13 · `PATCH /entities/{id}` |

**Behaviour.**
1. The step read serves a `defaultValue` per field, resolved from the period's snapshot and the report's scope. It is `null` once any row for that field exists, in any state. The api never writes on a read (task-91.2 row).
2. Legal form maps to EFRAG's five members through the country's legal-form artefact. An activity code with no NACE member is left out and logged. The basis for preparation defaults from the scope (Basic → Option A; Basic-and-Comprehensive → Option B).
3. A shown default becomes the report's answer when the reporter leaves the field, and otherwise **when its step opens**. An unvisited step holds nothing (task-36.2 row).
4. **The snapshot follows the entity until B1 is opened.** Saving the entity re-takes the snapshot of each unlocked period whose report holds none of B1's record answers. After that, a correction does not re-fill. A locked period's snapshot never moves (task-180.2 row).
5. A pre-filled value is marked as coming from the company record (task-180.3 row).

**Configuration-held values.** The legal-form classification (`organization-legal-form.md.json`), the NACE mapping (`nace-code.md.json`, `vsme-nace-classification.*.json`) and the template default (`disclosure-template-default.vsme.json`).

**Acceptance criteria.**
- **AC-1** Given an entity with legal form, NACE codes and sites, when B1 is opened for the first time, then those values show pre-filled and marked as from the record. *(source: FR text; §12.5.6 task-91.2 and task-180.3 rows)*
- **AC-2** Given a pre-filled value, when it is edited in the report, then the entity record is unchanged. *(source: FR text; D-2)*
- **AC-3** Given B1 has not been opened, when the entity is saved with new values, then B1 opens showing the new values. *(source: §12.5.6 task-180.2 row)*
- **AC-4** Given B1 has been opened, when the entity is corrected, then B1's answers are unchanged. *(source: §12.5.6 task-180.2 row)*
- **AC-5** Given B1 was opened and left without an edit, then its shown defaults are stored as answers. *(source: §12.5.6 task-36.2 row)*

**History.**
- 2 Sep 2026 · project owner · "the entity master record" means the period's point-in-time snapshot · §12.5.6 task-91.2 rows
- 3 Sep 2026 · project owner · a shown default commits when its step opens · §12.5.6 task-36.2 row
- 30 Sep 2026 · project owner · the snapshot follows the entity until B1 is opened · §12.5.6 task-180.2 row

### FR-28 — Conditional applicability

**Status.** Partial — delivered 91.3, 36.7, 36.9, 36.11, 179.1 · remaining 95 (the announcement and the retained value's notice), 80.1 (C modules)

**Obligation.** The system shall decide from B1's stored answers, by effective-dated rules held as configuration, which disclosures apply, showing those that do and not showing those that do not rather than presenting a field and rejecting it later.

| | |
|---|---|
| **Actors** | Evaluated by the api for every reader. PA maintains the rules (FR-72). |
| **Traces** | UC-19, UC-22, UC-23, UC-24, UC-26, UC-28, UC-81 · VSME ¶13 · UX-9, UX-26 … UX-28 · BR-APP-1 … BR-APP-5 |
| **Surfaces** | S-07 (fields and module states) · `applicable` and its cause on both module and step reads |

**Behaviour.**
1. Four rules, evaluated on every module and step read: turnover at ≥ 50 employees; the pay gap and its two inputs at ≥ 150; B5's three site-dimensioned disclosures where B1 records any site; B6's four water disclosures where B1's NACE answer falls within sections A … E, matched member-or-descendant (task-91.3 rows).
2. **A rule whose B1 driver is unanswered does not apply yet** (UX-9).
3. Rules resolve as of today, not the period's start, so a published change reaches reports in progress (UC-81). An unparsable artefact **fails open**: every field applies.
4. **Applicability shapes what is shown and counted, never the write.** A value stored under a field that stops applying is kept and returned marked. It is restored if the field applies again.
5. An inapplicable field is not rendered (task-36.9 row).

**Configuration-held values.** `config/seed/disclosure-applicability.vsme.json`: `numeric_at_least NumberOfEmployees 50` and `150`; `any_row_answered` over B1's five site elements; `member_within NaceSectorClassificationCodes` ∈ `NACE_A` … `NACE_E`.

**Boundaries.** The announcement that a field appeared, and the notice on a retained value (UX-27, UX-28), are task 95's. Notifying reports in progress of a rule change is FR-166's. The C modules' rules are task 80.1's.

**Acceptance criteria.**
- **AC-1** Given B1 headcount 49, then turnover is not shown. At 50 it is shown the next time its step is read, with no page reload and no rejected submission. *(source: FR text; disclosure-applicability artefact)*
- **AC-2** Given B1 headcount 149, then the pay gap is not shown. At 150 it is shown, with its two inputs. *(source: FR text; UC-28)*
- **AC-3** Given B1 records no site, then B5's site-dimensioned disclosures are not shown, and B5's other disclosures still are. *(source: §12.5.6 task-91.3 row)*
- **AC-4** Given a NACE answer in section C, then B6's four disclosures show. In section G, none do. *(source: §12.5.6 task-91.3 row)*
- **AC-5** Given B1's headcount is unanswered, then neither threshold-driven disclosure is shown. *(source: BR-APP-5; UX-9)*
- **AC-6** Given a stored turnover value, when headcount drops below 50, then the value is kept, hidden, and restored when headcount returns to 50. *(source: §12.5.6 task-91.3 row)*
- **AC-7** Given the threshold is changed in configuration, then the next read applies it with no deployment. *(source: FR-72; UC-81)*

**History.**
- 2–3 Sep 2026 · project owner · the rules as a thresholds artefact evaluated by the api; water as NACE A–E; the site rule scoped to B5's dimensioned elements; resolves as of today and fails open · §12.5.6 task-91.3 rows; BR-APP-3, BR-APP-4, BR-APP-5
- 8–9 Sep 2026 · project owner · water governs all four of B6; an inapplicable field is not rendered · §12.5.6 task-36.7 and task-36.9 rows

### FR-29 — Quantities in the standard's units, intensities derived

**Status.** Partial — delivered 36.4 … 36.12, 38.4, 91.4, 183 · remaining 39.2

**Obligation.** The system shall capture each quantitative disclosure in the unit the standard states for it, or with no unit where it states none, letting the reporter choose where several are admitted and defaulting to none; and shall derive, rather than accept typed, the figures the standard computes. Those figures are B3's total and GHG intensity, B8's turnover rate, B9's accident rate and B10's collective-agreement coverage and pay gap.

| | |
|---|---|
| **Actors** | Editor or OA enters. Nobody writes a derived figure. |
| **Traces** | UC-21 … UC-28 · `design_spec.md` OQ-22 · FR-34 |
| **Surfaces** | S-07 (unit chooser, currency, derived figure shown beside its inputs) · `unitCodes` and `currency` on the step read · `PUT /reports/{id}/derivation-inputs` |

**Inputs.** A value with its `unitCode` where the element admits several units. A fixed unit is the field's own. A monetary value is in the report's single currency (`core.report.reporting_currency`, ISO 4217, default MDL). Derivation inputs that the taxonomy does not carry (B8, B9) go through `derivation-inputs`.

**Behaviour.**
1. The unit lists are EFRAG's `measurementGuidance`. Of 42 elements, 25 admit one unit, 13 admit several and 4 (the intensities) admit none. The unit is chosen per element, not per row (task-91.4 and task-36.5 rows).
2. Headcount and FTE are B1's two **bases** of a count, not units (task-36.9).
3. Derivations: turnover rate; accident rate = accidents ÷ (hours × headcount) × 200 000, where hours default to 2 000 as data; coverage = covered ÷ headcount; pay gap = (male − female) ÷ male, kept signed; B3 total = Scope 1 + location-based Scope 2; **B3 intensity = that total ÷ B1 turnover, in the report's currency** (task-36.10, task-36.11, task-38.4 rows; §12.5.6 task-182 row (2)).
4. **Rounding.** Derived and computed figures are stored exact, apart from intensity at ten significant figures half-up. Each surface rounds once, half-up, to a per-unit precision held as configuration and set by its presentation task (§12.5.6 task-182 row (3)).

**Refusals.**
- A derived figure written → 400 `validation-failed` (`core.report.derived_disclosure_not_writable`)
- An unknown derivation input → 400
- A unit outside the element's list → 400 `validation-failed` (`core.report.unit_not_admitted`; task 183). An element whose list is empty admits any unit, since empty means the standard states none; a value with no unit is not refused (§12.5.6's task-182 row (6), read on task 183)

**Configuration-held values.** `disclosure-derivation.vsme.json` (formula kinds; hours default `2000`). Unit lists in the taxonomy artefact (seven codes: `MWh ha kg m3 sqkm t tCO2e`).

**Boundaries.** The 40 of 78 quantitative elements with no stated unit are OQ-22's in `design_spec.md`. B3's two scopes are FR-34's.

**Acceptance criteria.**
- **AC-1** Given an element admitting one unit, then its value is stored in that unit with no choice offered. *(source: §12.5.6 task-91.4 row)*
- **AC-2** Given an element admitting several units, then nothing is preselected, and the value is stored with the chosen unit. *(source: FR text; §12.5.6 task-91.4 row)*
- **AC-3** Given an element with no stated unit, then no unit is stored or shown. *(source: FR text)*
- **AC-4** Given a write naming a unit outside the element's list, then it is refused with 400. *(source: §12.5.6 task-182 row (6))*
- **AC-5** Given the inputs of each derived figure, then the figure is computed by its formula, and a write to it is refused with 400. *(source: §12.5.6 task-36.10, task-36.11 and task-38.4 rows)*
- **AC-6** Given turnover is absent or zero, then there is no B3 intensity. *(source: §12.5.6 task-38.4 row)*

**History.**
- 8 Sep 2026 · project owner · unit lists from EFRAG, chosen per element, no default · §12.5.6 task-91.4 and task-36.5 rows
- 9 Sep 2026 · project owner (spec-reviewed) · headcount and FTE are not units but B1 bases; the criterion gains *no unit where the standard states none*; the first version of this amendment wrongly said no FTE existed · task 36.9; UC-19, UC-26; OQ-22
- 9 Sep 2026 · project owner · EFRAG's derivations computed; the currency on the report · §12.5.6 task-36.10, task-36.11 and task-36.12 rows
- 5 Oct 2026 · project owner · the derived set named; intensity over turnover; one rounding rule · §12.5.6 task-182 row (2), (3)

### FR-30 — Zero is an answer

**Status.** Partial — delivered 34.1, 36.10, 36.12 · remaining 44.3, 46.1 (rendered distinctly in each export)

**Obligation.** The system shall store a numeric zero as an affirmative nil return, distinct from a field never answered, and shall render it as a stated answer on every surface.

| | |
|---|---|
| **Traces** | UC-27, UC-29 · `architecture.md` §7.3 · BR-DIS-1 |
| **Surfaces** | S-07 field state · the field's `state` on step reads and on the write's answer |

**Behaviour.**
1. The server decides the state, not the client. A numeric zero is stored as `nil_return`, a non-zero number as `ok`, for every numeric kind and not only B9's (task-36.10 row).
2. A derived zero is a nil return too.
3. An unanswered field has no row. A nil return is a row.

**Boundaries.** The rule binds numeric kinds (task-36.10 row). No gating question precedes B11, because a zero answers it (UC-29).

**Acceptance criteria.**
- **AC-1** Given 0 is written for a numeric field, then it is stored with state `nil_return`, and the step shows it as answered. *(source: FR text; §12.5.6 task-36.10 row)*
- **AC-2** Given a field never written, then it has no stored row and shows as unanswered. *(source: FR text; §7.3)*
- **AC-3** Given a client sends `nil_return` with a non-zero value, then it is stored as `ok`. *(source: §12.5.6 task-36.10 row)*
- **AC-4** Given a nil return, then the PDF and the Excel export each show it as a stated zero, not a gap. *(source: FR text)* Unmet until 44.3 and 46.1.

**History.**
- 9 Sep 2026 · project owner · a zero is an answer for every numeric kind · §12.5.6 task-36.10 row

### FR-31 — A section omitted as classified or sensitive

**Status.** Partial — delivered 36.13, 91.1, 179.1 · remaining 41.2, 41.3 (validation and roll-up), 44.3, 46.1 (both exports), 94 (help replaces the notice)

**Obligation.** The system shall allow a disclosure section to be declared omitted as classified or sensitive information, the one ground VSME ¶19 permits, recording it in B1's list of omitted disclosures without a rationale (¶24(b)). The declaration shall satisfy validation rather than suppress it, be discounted in completion, and appear in both exports.

| | |
|---|---|
| **Traces** | UC-30 · VSME ¶13, ¶19, ¶21, ¶24(b) · UX-21, UX-29, UX-30 · BR-DIS-2, BR-VAL-2 |
| **Surfaces** | S-07 (the B1 choice field; the module list's *Omitted* state; UX-30's notice) · `PUT /reports/{id}/values` on `ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation` |

**Behaviour.**
1. The declaration is an ordinary B1 choice over a 51-section domain, stored as the members' qualified names (task-36.13 rows).
2. A module reads as omitted when its own member is selected, or when all of its sections are. EFRAG's own roll-up formula is not copied (task-36.13 row).
3. Deselecting the member restores the section.
4. At the point of entry the interface says that this is a statement a third party reads. Until help exists for that element, the notice is a fallback (task 94).
5. "Not applicable" is FR-28's, by rule, and needs no declaration (¶13).

**Acceptance criteria.**
- **AC-1** Given a section selected in the B1 list, then the declaration is stored there with no rationale field. *(source: FR text; ¶24(b))*
- **AC-2** Given a module's own member is selected, then the module list shows it *Omitted*, distinct from complete or incomplete. *(source: UC-30; §12.5.6 task-36.13 row)*
- **AC-3** Given an omitted section, then validation reports it satisfied and completion discounts it. *(source: FR text; UC-30)* Unmet until 41.2 and 41.3.
- **AC-4** Given an omitted section, then both exports state it, and the Excel export does so in the template's own element. *(source: FR text)* Unmet until 44.3 and 46.1.
- **AC-5** Given the member is deselected, then the section reads as before the declaration. *(source: UC-30)*

**History.**
- 9 Sep 2026 · project owner · the ground was "not material or not applicable, with a rationale", which VSME does not permit; realigned to ¶19 with no rationale; "not applicable" moved to FR-28 · §12.5.6 task-36.13 rows; UC-30, UX-29, UX-30, BR-DIS-2, BR-APP-4, FR-41

### FR-32 — A field not available, with a reason

**Status.** Partial — delivered 34.1, 36.5, 183 · remaining 41 (reported separately by validation)

**Obligation.** The system shall allow any field to be declared not available with a stated reason, as a terminal state distinct from `MISSING VALUE`, refusing the declaration without a reason.

| | |
|---|---|
| **Traces** | UC-31 · D-4 · UX-15 · BR-DIS-3, BR-VAL-1 |
| **Surfaces** | S-07's *Mark not available* control · `PUT /reports/{id}/values` with `state: not_available` and `notAvailableReason` |

**Behaviour.** The declaration is a first-class action on every field, not an alternative found after failing to answer (task-36.5 row). The reason is stored exactly when the state is `not_available` (§7.3). **A later answer supersedes the declaration** with no separate withdrawal, and the declaration and its reason stay in the change trail (§12.5.6 task-182 row (13)).

**Refusals.** No reason, or a blank one (no visible character) → 400 `validation-failed` (`core.report.not_available_reason_required`); a reason with any other state → 400 `validation-failed` (`core.report.not_available_reason_unexpected`). Judged before the write (task 183); until then the store's CHECK answered both as 500.

**Acceptance criteria.**
- **AC-1** Given a field declared not available with a reason, then it is stored in that state with the reason. *(source: FR text; §7.3)*
- **AC-2** Given the declaration with no reason, or with only whitespace, then it is refused with 400 and nothing changes. *(source: §12.5.6 task-182 row (6))*
- **AC-3** Given a declared field, then validation reports it separately from `MISSING VALUE`. *(source: FR text; D-4)* Unmet until 41.
- **AC-4** Given a declared field, when a value is written to it, then the value is stored, and the trail keeps the declaration and its reason. *(source: §12.5.6 task-182 row (13))*

**History.**
- 8 Sep 2026 · build · field-level declaration shipped for every module at B4 · §12.5.6 task-36.5 row
- 5 Oct 2026 · project owner · a malformed declaration is a 400, not a 500; a later answer supersedes the declaration · §12.5.6 task-182 row (6), (13)

### FR-177 — The Comprehensive Module

**Status.** Partial — delivered 31.3, 33.1, 33.3, 36.4, 78.2, 179 · remaining 78.1, 78.3, 78.4, 79.1 … 79.9, 80.1 … 80.3, 81.1

**Obligation.** The system shall support the VSME Comprehensive Module C1 … C9 as an additive extension of Basic, selected by the report's scope flag at creation or on a report in progress, and authored, made conditional, validated and exported by the same mechanisms as B1 … B11.

| | |
|---|---|
| **Actors** | Editor or OA sets the scope and authors. |
| **Traces** | UC-183 … UC-192 · D-A · `problem_overview.md` OQ-12 · FR-155 · NFR-1 |
| **Surfaces** | S-06 (creation flow, scope column) · S-07 (the Comprehensive group) · `POST /reports` and `PATCH /reports/{id}` (`scope`) · S-39 |

**Inputs.** Scope: `basic` or `basic_and_comprehensive`, defaulting to `basic`.

**Behaviour.**
1. The scope is a column on the report, checked by a constraint and audited on change (task-31.3 row). It also sets B1's basis for preparation (FR-27).
2. The C1 … C9 elements are taxonomy data in every registered version. The api serves every module, and the module list shows a Basic report's eleven (task-179.1 row).
3. **Raising** the scope keeps every B answer and re-runs applicability (task 78.3).
4. **Lowering** the scope is admitted behind a consequence dialogue. C answers are retained, not shown, not counted and not exported, and are restored on raising again (§12.5.6 task-182 row (10)).
5. **A write to a C element on a Basic report is refused**, and a C step read on it answers out of scope (row (11)).
6. With billing disabled, Comprehensive stays authorable (NFR-1). Gating it by plan is task 81.1's.
7. Each C module's use case is specified by its own slice before it is built (row (8)).

**Refusals.**
- A C write on a Basic report → 409 `conflict` (78.1)
- A scope change on a locked period → 409 `report-not-editable`
- A second report for a period → 409 `report-already-exists`

**Acceptance criteria.**
- **AC-1** Given a report created as Basic-and-Comprehensive, then its wizard lists C1 … C9 after B1 … B11. *(source: FR text; §12.5.6 task-182 row (9))*
- **AC-2** Given a Basic report in progress, when the scope is raised, then every B answer is unchanged and C1 … C9 appear. *(source: FR text; task 78.3)*
- **AC-3** Given C answers, when the scope is lowered, then they are kept and not shown or exported. When the scope is raised again, they reappear. *(source: §12.5.6 task-182 row (10))*
- **AC-4** Given a Basic report, when a C element is written, then it is refused with 409. *(source: §12.5.6 task-182 row (11))*
- **AC-5** Given a Comprehensive report, then FR-28's applicability, validation and both exports treat C1 … C9 by the same mechanisms as B1 … B11. *(source: FR text)* Unmet until 80.1 … 80.3.
- **AC-6** Given the three locales, then every C module is authorable in each. *(source: FR text)* Unmet until 79.x.

**History.**
- 25 Aug 2026 · project owner · promoted from §8 into MVP, keeping its identifier · `problem_overview.md` OQ-12
- 29 and 31 Aug 2026 · project owner · the flag ships with the report table; a report is created explicitly with its scope · §12.5.6 task-31.3 rows
- 5 Sep 2026 · review · the creation flow sends no scope, recorded as a deferral · §12.5.6 task-32.3 row
- 5 Oct 2026 · project owner · scope asked at creation; lowering admitted with C answers hidden; C writes refused on Basic; task 78 re-cut · §12.5.6 task-182 row (8) … (12)

### FR-210 — Delete a report

**Status.** Not started — remaining 192

**Obligation.** The system shall let the Organization Administrator delete a report, only while the report's period is open and only if the report has never been exported, by removing it from every list and route while its values, calculation runs, change trail and export records stay stored until the organization's retention ends.

| | |
|---|---|
| **Actors** | OA alone. An editor and a view-only member are refused. An advisor acting in a client organization acts as an editor there (`actors.md` §5) and is refused too. |
| **Traces** | UC-213 · UC-42, UC-43, UC-57, UC-58 · D-13 · FR-22, FR-26, FR-33, FR-45, FR-53, FR-54, FR-153, FR-159, FR-164, FR-207 · UX-70 · `architecture.md` §12.5.7, OQ-20 · entity *Report* |
| **Surfaces** | S-06 and S-07 (the control and its consequence dialogue; the placement is drawn by 192) · `DELETE /reports/{id}`, not yet in `openapi/v1.json` |

**Preconditions.** A report in the active organization. Its period is open. No export of it has completed.

**Behaviour.**
1. **The conditions are checked together with the deletion.** The role (OA), the period's state (open) and the absence of any export record (FR-53) are read, and the report marked deleted, in one transaction.
2. **Once a PDF or an Excel file has left the platform, the report is distribution evidence (FR-53) and cannot be deleted.** A history entry is written when an export completes (FR-53), so a preview, which produces no file and no record (FR-48/AC-2), does not count. A report with an export record stays refused whatever its period's state later becomes.
3. **The deletion is soft.** The report is marked deleted and no row is removed. From that moment it is absent from every list (FR-25, the organization's overview of FR-23, S-05) and from every route over it, which answer 404 `not-found` as they do for a report outside the organization. It is not one of the organization's reports for FR-164's notices.
4. **What stays.** Its disclosure values, derivation inputs, calculator lines, calculation runs with their retained inputs and results, change trail and any export record remain stored until the organization's retention ends, which is organization life plus one year (`architecture.md` §12.5.7). Erasure is FR-207's. Run permanence (FR-33; OQ-20) is untouched, because nothing is physically removed.
5. **The deletion is audited** (FR-159). Marking the report is a change to its row, which the change-trail trigger records with the actor and the instant (FR-54); the trail row outlives the report's disappearance.
6. **The period keeps its place.** The deletion changes neither the period nor the entity: the period stays open. A new report may be created for the period, the rule of one report per period counting only reports that are not deleted. The next period's prior-period read answers `no_prior_report` while no report stands against the prior period (FR-45). *Recorded as an assumption on 5 Oct 2026 (182/23): a deleted report that kept the period's single slot would be invisible and still block its replacement.*
7. **The control sits behind a consequence dialogue** (UX-70) that names the report and says what follows: it disappears from the lists, and its data is held until the organization's retention ends. No restore is offered at MVP (assumption, 182/23).

**Refusals.**
- Not the Organization Administrator (editor, view-only member, advisor acting in the client) → 403 `insufficient-role`
- Period locked → 409 `report-not-editable` (FR-22: the lock outranks the role)
- Report exported → 409, with a problem type of its own so that the screen can name the reason (the report is distribution evidence), named by 192 as `report-already-exists` was
- Unknown report, one outside the active organization, or one already deleted → 404 `not-found`

**Effects.** The report is marked deleted, with the instant, and the change-trail trigger records who did it. Nothing is removed.

**Configuration-held values.** None. The retention period is `architecture.md` §12.5.7's.

**Boundaries.** Deleting what a report holds (a calculator line, FR-33) is not this requirement, and a locked report's values refuse a DELETE (FR-26). Erasing an organization's data is FR-207's and NFR-28's. Locking and reopening a period are FR-22's. The export history is FR-53's.

**Acceptance criteria.**
- **AC-1** Given the Organization Administrator, a report whose period is open and which has never been exported, when they delete it, then it is absent from the reports list and every route over it answers 404. *(source: §12.5.6 task-182 validation row, 182/23)* Unmet until 192.
- **AC-2** Given an editor, a view-only member or an advisor acting in the client, when they delete a report, then it is refused with 403 and the report is unchanged. *(source: §12.5.6 task-182 validation row, 182/23)* Unmet until 192.
- **AC-3** Given a locked period, when the Organization Administrator deletes a report in it, then it is refused with 409 `report-not-editable`. *(source: §12.5.6 task-182 validation row, 182/23; FR-22)* Unmet until 192.
- **AC-4** Given a report from which a PDF or Excel export has completed, when the Organization Administrator deletes it, then it is refused with 409 and the report stays. *(source: §12.5.6 task-182 validation row, 182/23; FR-53)* Unmet until 192.
- **AC-5** Given a report that was only previewed, then it can be deleted. *(source: FR-48/AC-2; FR-53)* Unmet until 192.
- **AC-6** Given a deleted report, then its values, calculation runs with their retained inputs, change trail and export records are still stored, and no row has been removed. *(source: §12.5.6 task-182 validation row, 182/23)* Unmet until 192.
- **AC-7** Given a deletion, then the change trail holds a row naming the actor and the instant. *(source: §12.5.6 task-182 validation row, 182/23; FR-159)* Unmet until 192.
- **AC-8** Given a deleted report, then the organization's overview and FR-164's notices do not count it. *(source: §12.5.6 task-182 validation row, 182/23)* Unmet until 192.
- **AC-9** Given the period of a deleted report, then a new report can be created for it. *(source: §12.5.6 task-182 validation row, 182/23, recorded assumption)* Unmet until 192.

**History.**
- 5 Oct 2026 · project owner · a report is deletable by the Organization Administrator alone, while its period is open and only if never exported; the deletion is soft; FR-153 keeps *delete* and points here · §12.5.6 task-182 validation row (182/23)

## 2. Carbon calculator (index §3.6)

### FR-33 — Record consumption in invoice units, retained permanently

**Status.** Built — delivered 38.1, 39.1

**Obligation.** The system shall record energy and fuel consumption by source and by site in the units of the company's own invoices, retaining the raw inputs permanently alongside every figure derived from them so that a calculation can be retraced.

| | |
|---|---|
| **Actors** | Editor or OA records lines. A view-only member reads them. |
| **Traces** | UC-32, UC-52 · P-11 · `architecture.md` OQ-20 (*`CALC_INPUT` permanent*), §7.2, §9.9 · BR-CALC-1 · entity *Energy / fuel consumption input* |
| **Surfaces** | S-09 (entered from S-07's B3 step) · `GET /reports/{id}/calculator` (what a line may say: the factor set's sources and units, the B1 sites, the monthly form's months — task 39.1) · `GET`, `PUT`, `DELETE /reports/{id}/calculator/sources[/{sourceId}]` |

**Preconditions.** An editable report session (FR-26). The report's B1 records at least one site.

**Inputs.** One **line** per invoice: a source, a site, and either a quantity with its unit or the reason there is no quantity. The client chooses the line's identifier, so an autosave that is replayed rewrites the same line. The admitted sources and their units are the factor set's (§2.4 below), never a list in code. The site is one of the report's own B1 site rows.

**Behaviour.**
1. A line holds **one figure for the period**, or, where the period spans twelve calendar months, **twelve month figures whose sum is its quantity** (task 39.1). The months are counted from the period's start month; the server computes the sum, so quantity and months cannot disagree; a month left empty is flagged on the line and never refused, and at least one month holds a figure. A period of any other length keeps the single figure (§12.5.6 task-39 row (1)).
2. Source and unit are checked against the factor set the period resolves to when the line is written (FR-35), and checked again when a run reads them.
3. The lines are the report's **working set**. A run copies them into its own retained inputs in the run's transaction, so later edits to a line never alter what a past run read.
4. A B1 site that still holds lines cannot be removed until its lines are.

**Refusals.**
- Unknown source → 400 · `validation-failed` (`core.calculator.unknown_source`)
- Unit the source does not admit → 400 · `validation-failed` (`core.calculator.unit_not_admitted`)
- Site the report does not hold → 400 · `validation-failed` (`core.calculator.unknown_site`)
- Neither a quantity with a unit nor a reason, or both → 400 · `validation-failed` (`core.calculator.contents_invalid`)
- Month figures on a period that does not span twelve calendar months, not twelve of them, or sent with a quantity → 400 · `validation-failed` (task 39.1)
- Line identifier already used by another report → 409 · `conflict` (`core.calculator.source_elsewhere`)
- No factor set serves the period → 409 · `conflict` (`core.calculator.no_factor_set`)
- Period locked → 409 · `report-not-editable` (FR-22) · Unknown report → 404

**Effects.** Each line write is recorded in the field change trail (FR-54). The inputs a run retained are immutable and permanent: the runtime role holds SELECT and INSERT only, and the report a run rests on cannot be physically removed: FR-210's deletion hides a report and removes nothing.

**Configuration-held values.** The sources and the units each admits are held in the factor set artefact (`config/seed/emission-factor-set.md.json`, kind `emission_factor_set`, scope `md`). For example, natural gas is admitted in m³ and grid electricity in kWh or MWh.

**Boundaries.** Conversion and computation are FR-34's. Organizations whose sites span several countries are not served: the factor set is the organization's country's (`architecture.md` §12.5.6, task 38.1). Connectors to energy providers are deferred to FR-187.

**Acceptance criteria.**
- **AC-1** Given an editable report with a B1 site, when a line is written with a source, a site, a quantity and an admitted unit, then it is stored in that unit with no conversion applied. *(source: FR text; UC-32 step 1)*
- **AC-2** Given a line with a unit its source does not admit, when it is written, then it is refused with 400 and nothing is stored. *(source: §12.5.6 task-38.1 row)*
- **AC-3** Given a line that has no figure, when it is written with a reason instead of a quantity, then it is stored. A line carrying neither or both is refused. *(source: §12.5.6 task-38.1 row)*
- **AC-4** Given a run has read a set of lines, when a line is later edited or deleted, then that run's retained inputs are unchanged and still retrievable. *(source: FR text; OQ-20; §12.5.6 task-38.1 row)*
- **AC-5** Given the period is locked, when any member, the administrator included, writes a line, then the write is refused with 409 `report-not-editable`. *(source: FR-22)*
- **AC-6** Given the same line write is replayed with the same identifier, then one line results and no duplicate exists. *(source: §12.5.6 task-38.1 row)*

**History.**
- 1 Oct 2026 · project owner · the two layers (working lines, a run's copy), lines on B1 sites, one figure per period with the monthly form deferred, and run permanence · `architecture.md` §12.5.6 task-38.1 row, §7.2
- 7 Oct 2026 · project owner · twelve month rows from the period's start, summed, a missing month flagged; only on a twelve-month period; lines through the queue, the run and B3 figure actions direct · §12.5.6 task-39 row (1), (2)

### FR-34 — Compute Scope 1 and location-based Scope 2

**Status.** Built — delivered 37.1, 37.2, 38.2, 38.3, 38.4, 39.2

**Obligation.** The system shall convert each consumption line to MWh, apply the emission factor set in force for the reporting period, and compute Scope 1 and location-based Scope 2 in tCO₂e, writing them into B3. From those figures it derives B3's total and its GHG intensity: the total divided by B1 turnover, in the report's currency.

| | |
|---|---|
| **Actors** | Editor or OA runs the calculation. A view-only member cannot. SYS performs the computation. |
| **Traces** | UC-33, UC-21 · NFR-19, NFR-87 · §9.9 (p95 ≤ 1 s) · BR-CALC-1 · entity *Computed emission result* |
| **Surfaces** | S-09 (UX-42: input → conversion → factor → result, naming the set's label) · S-07 B3 · `POST /reports/{id}/calculator/runs` · `GET /reports/{id}/calculator/runs/{runId}` |

**Preconditions.** At least one line (FR-33). A factor set serves the period's start date (FR-35).

**Behaviour.**
1. Each line's figure is *quantity × MWh per unit × tCO₂e per MWh*, summed per scope. The arithmetic is **exact decimal**, with no rounding stored. Each surface rounds once, half-up, to a per-unit precision held as configuration (§12.5.6 task-182 row (3); the digits are 39.2's, 44's and 46's). S-07 rounds a computed or derived figure to the same places as S-09, read with the step; a figure the reporter typed is shown as typed (§12.5.6 task-39 row (7)).
2. Which scope a source counts toward is the factor set's `ghgScope` (`scope_1`, `scope_2_location_based`), never a list of fuels in code.
3. A run writes Scope 1 and location-based Scope 2 into B3. **The total and the GHG intensity are derivations.** They are recomputed whenever a scope, an override or their other input changes, and they are read-only in the wizard.
4. **A scope with no measured line has no figure, not zero** (FR-30). A scope that is only partly explained totals its measured lines and lists the rest.
5. A scope a run measured nothing for clears a figure an earlier run wrote. It never clears a figure the reporter typed.
6. A run's results are stored with the run, immutable and permanent. Replaying a run recomputes its retained inputs against its own pinned set and answers whether the result reproduces.

**Refusals.**
- No lines → 409 · `conflict` (`core.calculator.no_sources`). *Zero is an answer someone might file*, so an empty run is not one.
- No factor set serves the period → 409 · `conflict` (`core.calculator.no_factor_set`)
- A line the pinned set does not cover → 400 · `validation-failed`
- Replaying a run that does not exist → 404 (`core.calculator.run_not_found`)
- A pinned set that reads as nothing on replay → 500, never `reproduces: false`

**Effects.** The run record, its retained inputs and its results are written in one transaction. B3's Scope 1 and Scope 2 values carry `origin = calculated`.

**Configuration-held values.** Per source: MWh per invoice unit, tCO₂e per MWh, `ghgScope` and a citation (`emission-factor-set.md.json`, label `2026.1`). The places each surface rounds a figure to, by unit: `presentation-precision.global.json` (kind `presentation_precision`), starting at two places for `tCO2e` and `MWh` (task 39.2; §12.5.6 task-39 row (5)). Two examples: natural gas is 0.0095773 MWh/m³ at 0.202544 tCO₂e/MWh, and grid electricity is 0.594645 tCO₂e/MWh. The derivation formulas `sum` and `intensity` are in `config/seed/disclosure-derivation.vsme.json`. The intensity's significant-figure rule is in code (`INTENSITY_SIGNIFICANT_FIGURES = 10`, half-up).

**Boundaries.** Market-based Scope 2 is not computed; it would be a new `ghgScope` member. Scope 3 is out of scope. Version stamping is FR-35's, and overrides are FR-36's.

**Acceptance criteria.**
- **AC-1** Given lines in invoice units, when a run is made, then each line is converted to MWh before its factor is applied, and the scope figure equals the exact sum over its lines. *(source: FR text; §12.5.6 task-37 and task-38.2 rows)*
- **AC-2** Given a run, then B3's Scope 1 and location-based Scope 2 hold its results, and the total and intensity are recomputed from them. *(source: FR text; §12.5.6 task-38.4 row)*
- **AC-3** Given no line falls in a scope, when a run is made, then that scope has no figure (not 0), and a figure the reporter typed for it is untouched. *(source: §12.5.6 task-38.2 and task-38.4 rows; FR-30)*
- **AC-4** Given a report with no lines, when a run is requested, then it is refused with 409 and no run is recorded. *(source: §12.5.6 task-38.1 row)*
- **AC-5** Given a past run, when it is replayed, then its retained inputs recomputed against its pinned set reproduce its stored results. *(source: §12.5.6 task-38.4 row; NFR-19)*
- **AC-6** Given no turnover or a zero turnover, then there is no intensity figure. *(source: §12.5.6 task-38.4 row; task-182 row (2))*

**History.**
- 8 Sep 2026 · project owner · taxonomy elements may belong to several modules, which makes this requirement's "results appear in the B3 fields" meetable (8 of B3's 17 elements are filed under C3) · §12.5.6 task-36.4 row
- 1 Oct 2026 · project owner · convert, then apply; one effective-dated set per country · §12.5.6 task-37 row
- 1 Oct 2026 · build · exact arithmetic, absent rather than zero, scope from data · §12.5.6 task-38.2 row
- 1 Oct 2026 · project owner · total and intensity as derivations; results retained; replay · §12.5.6 task-38.4 row
- 5 Oct 2026 · project owner · intensity divides by turnover; one rounding rule · §12.5.6 task-182 row (2), (3)
- 7 Oct 2026 · project owner · the places are a configuration artefact; S-09 shows the derivation in MWh and tCO₂e, as the set publishes · §12.5.6 task-39 row (5), (6)
- 7 Oct 2026 · project owner · S-07 rounds computed and derived figures to S-09's configured places · §12.5.6 task-39 row (7)

### FR-35 — Pin the factor set version to every result

**Status.** Built — delivered 37.1, 37.2, 37.3, 38.1, 38.4, 39.2

**Obligation.** The system shall store against every computed result the emission factor set version it was computed under, so that a later factor update never silently restates a figure already reported.

| | |
|---|---|
| **Actors** | RC runs. PA publishes factor sets (FR-71, A-05, elevated session). |
| **Traces** | UC-33 step 5, UC-80, UC-171 · DR-4 · NFR-34, NFR-87 · UX-44 · BR-CALC-2 · entity *Emission factor set* |
| **Surfaces** | S-09 (the set's label on each result; UX-44's notice) · A-05 · `CalcRunDto.pinnedFactorSet` (country, revision, label) |

**Behaviour.**
1. The set used is the one **in force on the reporting period's start date**, resolved as a calendar-date question (NFR-34), not the date the run happens.
2. A run pins `(country, revision)`. The revision is unique per country and immutable. The label (for example `2026.1`) is what a reader sees.
3. One effective-dated artefact exists per country, and no two sets may overlap one period.
4. A correction to a set published for a window applies only to runs made after it. Earlier runs keep their pin.
5. When a set changes for a period that existing runs used, those results are not restated. The reporter is told and may recalculate (UX-44; the notice is FR-166's). S-09 shows UX-44's notice while the latest run's pinned set differs from the set in force, naming both by label with each figure *now* and *would be*, and offering recalculation; no dismissal is stored (§12.5.6 task-39 row (4)).

**Refusals.** No set serves the period's start → 409 `core.calculator.no_factor_set`.

**Effects.** `calc_run` carries the pin. Replay reads the pinned set from the configuration history, never the set now in force.

**Configuration-held values.** The set's validity window: today one set (`2026.1`) serves periods starting before 1 Jan 2027, bounded so that a 2027 set can be an adjacent window.

**Boundaries.** Publishing a set is FR-71's. Telling affected organizations is FR-166's (task 37.3, built: an open report whose latest run used the set replaced). Recalculating is the reporter's explicit act, never automatic.

**Acceptance criteria.**
- **AC-1** Given a run, then its stored record names the set's country and revision, and its label is resolvable. *(source: FR text; §12.5.6 task-37 row (3))*
- **AC-2** Given a period starting in 2026, when a run is made on any date, then the set in force on the period's start is pinned. *(source: §12.5.6 task-37 row (2))*
- **AC-3** Given existing runs, when a new or corrected set is published, then their stored results and pins are unchanged. *(source: FR text; UC-80 rule)*
- **AC-4** Given a run, when it is replayed after a newer set is published, then it is recomputed against its own pinned set. *(source: §12.5.6 task-38.4 row)*

**History.**
- 1 Oct 2026 · project owner · the set is resolved by the period's start and not the run date, which supersedes A-05's artboard lines · §12.5.6 task-37 row; §9.9 amended
- 6 Oct 2026 · project owner · a replaced set tells the organizations whose open reports' latest runs used it; a revert replaces too · §12.5.6 task-37.3/37.4 row (2), (3) (task 37.3)
- 7 Oct 2026 · project owner · UX-44's notice on S-09 stores no dismissal · §12.5.6 task-39 row (4)

### FR-36 — Annotate or override a computed figure

**Status.** Partial — delivered 38.4 (38.5 closed inside it), 39.3, 39.4 · remaining 43.2 (the person in the preview), 44.6, 46.5 (the marker in each export)

**Obligation.** The system shall allow a computed figure to be annotated, or replaced by an externally calculated figure with a stated reason, flagging the replacement, naming on the figure the person who made it, and retaining the superseded computed figure.

| | |
|---|---|
| **Actors** | Editor or OA. |
| **Traces** | UC-34, UC-47 · UX-43 · DR-6 · BR-CALC-3 · entity *Override record* |
| **Surfaces** | S-09 (annotate; override with a reason) · S-10 preview and export (the marker) · `PUT`/`DELETE /reports/{id}/calculator/figures/{elementKey}/override` · `PUT …/figures/{elementKey}/explanation` · line override fields on `PUT …/sources/{sourceId}` |

**Inputs.** For a figure override: B3 Scope 1 or location-based Scope 2, a tonnes value and a reason. For a line override: the line's tonnes and a reason, where the reason and the value are required together. For an annotation: an explanation on a calculated figure.

**Behaviour.**
1. Overrides come at **two granularities**. A whole B3 scope can be replaced with a reason (`origin = overridden`). A single line's tonnes can be replaced with a reason; this is an input, copied into the run so that replay reproduces it.
2. **A later run replaces a scope override**, and its reason clears with it. The field's trail keeps both. **A line override survives every run.**
3. Removing a scope override restores the latest run's stored result in one action, with nothing re-entered.
4. An annotation on a calculated figure is kept through a re-run.
5. The ordinary disclosure write refuses a calculated or overridden figure. The derived total and intensity are never writable.
6. The superseded figure is shown beside the substituted one with its reason (UX-43). An unexplained substitution can never be presented.

**Refusals.**
- Not a number of tonnes, no reason, or a line with no computed figure → 400 `core.calculator.override_invalid`
- A figure other than the two B3 scopes → 400 `core.calculator.unknown_figure`
- Overriding before any run has produced the figure → 409 `core.report.no_computed_figure`
- An ordinary write to a computed or overridden figure → 409 `core.report.computed_figure_not_writable`
- Period locked → 409 `report-not-editable`

**Effects.** `report_disclosure_value.origin` becomes `overridden`, with an `explanation` required by a database check. Line overrides are non-negative and require a reason, also by check. The figure names who overrode it, on the stored value and its read shape (task 39.4): the account is stored with no foreign key and its display name is resolved at read, so an erased account reads as no name. The account is the request's own binding, written by the table rather than sent by the caller, and it is the account that last changed the substituted figure or its reason: a line written again with its override unchanged keeps the person who made it, and clearing an override, or a run replacing a scope override, clears the person with it. A run retains each line's person with the line. Every change also enters the field change trail, which records who, when and the previous value (FR-54). The B3 figure actions are direct requests that need a connection; a line override rides the line's queued write (§12.5.6 task-39 row (2), (3)).

**Boundaries.** The *company estimate* marker and footnote are 44.6's in the PDF and 46.5's in the Excel export. The screen is 39.3's.

**Acceptance criteria.**
- **AC-1** Given a calculated B3 scope, when it is overridden with tonnes and a reason, then it reads as overridden, carries the reason, and the latest run's result remains retrievable. *(source: FR text; §12.5.6 task-38.4 row)*
- **AC-2** Given an override with no reason, then it is refused with 400 and nothing changes. *(source: UX-43; §12.5.6 task-38.4 row)*
- **AC-3** Given an overridden scope, when the override is removed, then the latest run's result is restored with nothing re-entered. *(source: §12.5.6 task-38.4 row)*
- **AC-4** Given an overridden scope, when a new run is made, then the run's result replaces it and the trail holds both. A line override, by contrast, survives the run. *(source: §12.5.6 task-38.4 row)*
- **AC-5** Given an override, then the figure's read names the person who made it, and the change trail records that person, the timestamp and the superseded value. *(source: FR text; §12.5.6 task-182 row (4); FR-54)*
- **AC-6** Given a computed or overridden figure, when it is written through the ordinary value route, then it is refused with 409. *(source: §12.5.6 task-38.4 row)*

**History.**
- 8 Sep 2026 · project owner · `origin` marker added ahead of its producer; an override is a component that shows both values, not a word · §12.5.6 task-36.4 row
- 1 Oct 2026 · project owner · both granularities, built in 38.4 rather than 38.5 · §12.5.6 task-38.4 row; §7.3 amended
- 5 Oct 2026 · project owner · the person named on the figure; the marker owned by 44.6 and 46.5 · §12.5.6 task-182 row (4), (7)
- 7 Oct 2026 · project owner · the person is an account named at read; the preview's half is 43.2's · §12.5.6 task-39 row (3)
- 7 Oct 2026 · build · the screens: a line override rides the line's queued write; on S-07 a B3 scope is replaced, explained or put back beside the run's stored result, read with the step (task 39.3) · §12.5.6 task-39 row (2)
- 7 Oct 2026 · build · the person stored by the table from the binding, named at read on S-09 and S-07; a line written again keeps its override's person (task 39.4) · §12.5.6 task-39 row (3)

## 3. Draft persistence (index §3.7)

### FR-37 — Autosave with no save action

**Status.** Built — delivered 35.2, 36.2, 89

**Obligation.** The system shall persist each field change automatically on blur and on step change, with no explicit save action, acknowledging a change only once it is durably committed.

| | |
|---|---|
| **Actors** | Any member with edit rights on an open period (FR-26). |
| **Traces** | UC-35 · AD-9 · UX-34 … UX-36 · NFR-38, NFR-56 |
| **Surfaces** | S-07's save-state indicator · `PUT /reports/{id}/values` · `PUT /reports/{id}/derivation-inputs` |

**Behaviour.**
1. A control commits on blur. Writes coalesce while one is on the wire, with no timer.
2. Leaving a step sends no request at unmount. The queue is already durable, and the next step's mount flushes it.
3. A value the platform shows as a default is committed when its step **opens** (FR-27).
4. One endpoint takes a list of values and upserts on the natural key `(report, element, dimension, ordinal)`, so a replay is idempotent with no token.
5. Every element is checked against the report's pinned taxonomy before any write. The lock is enforced beneath the store.
6. Conflicts resolve last-write-wins per field, with the change trail (FR-54) as the reconciliation record.

**Refusals.**
- Unknown element or dimension, or a derived element → 400
- Computed or overridden figure → 409 (FR-36)
- Period locked → 409 `report-not-editable` · Unknown report → 404

**Acceptance criteria.**
- **AC-1** Given an edited field, when it loses focus, then the value is durably stored with no save action, and the indicator reads *saved* only after commit. *(source: FR text; UX-36; NFR-56)*
- **AC-2** Given a pending change, when the step changes, then the change persists. *(source: FR text; §12.5.6 task-35.2 row)*
- **AC-3** Given the same batch is sent twice, then the stored state equals sending it once. *(source: §12.5.6 task-89 row)*
- **AC-4** Given acknowledgement, then it arrives within NFR-38's p95 of 250 ms and does not block input. *(source: NFR-38)*

**History.**
- 1 Sep 2026 · project owner · one list endpoint, idempotent by natural key · §12.5.6 task-89 row
- 2 Sep 2026 · build · transport is Query's mutation; the queue is not; batching coalesces · §12.5.6 task-35.2 rows
- 3 Sep 2026 · project owner · a shown default commits when its step opens · §12.5.6 task-36.2 row; FR-27 amended

### FR-38 — Queue offline and warn while unsynced

**Status.** Built — delivered 35.2, 36.2, 92, 93, 39.1

**Obligation.** The system shall queue changes durably on the device and retry them when the network or the session is unavailable, warning the user while anything remains unsynced and before any action that would abandon the queue.

| | |
|---|---|
| **Actors** | Editor or OA. The queue belongs to their account. |
| **Traces** | UC-35 exception, UC-06, UC-07 · UX-35, UX-37, UX-38 · NFR-56 |
| **Surfaces** | S-07's banner and indicator · the exit, sign-out and organization-switch consequence dialogues · inline re-authentication |

**Behaviour.**
1. The queue is held in IndexedDB under `<accountId>/<reportId>`. Where IndexedDB is unavailable, it is held in memory and the banner says that survival across closing the tab is given up.
2. A queued write is retried when connectivity returns. A write refused with 401 is kept under the account's key and sent after inline re-authentication, which happens in place and never as a redirect.
3. Signing out sends what is unsent. Only when it cannot go (offline, refused, or the session has ended) does the dialogue ask. Switching organization and leaving the wizard do the same.
4. Every queue operation is ordered behind the last, over one connection.

**Configuration-held values.** None. The retry policy is code: 3 transport retries with a delay doubling from 1 s up to 30 s, then a 30 s retry while unreachable.

**Boundaries.** Nothing in the report is outside the queue: calculator lines (FR-33) go through it too (§12.5.6 task-182 row (5); task 39.1).

**Acceptance criteria.**
- **AC-1** Given the network is unavailable, when a field changes, then it is queued durably, the field reads *queued*, and a warning shows until the queue drains. *(source: FR text; UX-35)*
- **AC-2** Given a queued change, when connectivity returns, then it is submitted with no user action. *(source: FR text)*
- **AC-3** Given the session has expired, when a write is refused with 401, then it is kept, and it is sent after re-authentication in place. *(source: §12.5.6 task-35.3 and task-92 rows)*
- **AC-4** Given an unsent queue, when the user signs out, switches organization or leaves the wizard and the queue cannot be sent, then a dialogue warns and offers to cancel. *(source: UX-37; §12.5.6 task-93 and task-83 rows)*
- **AC-5** Given the network is unavailable, when a calculator line is written, then it is queued and sent on reconnection like any field. *(source: §12.5.6 task-182 row (5); `e2e/web/calculator.spec.ts`)*

**History.**
- 2 Sep 2026 · build · the queue is scoped to the account · §12.5.6 task-35.2 row
- 4 Sep 2026 · build · one connection, operations ordered · §12.5.6 task-36.2 row
- 15–16 Sep 2026 · project owner · inline re-authentication; sign-out drains or asks · §12.5.6 task-92 and task-93 rows
- 5 Oct 2026 · project owner · calculator lines share the queue · §12.5.6 task-182 row (5)

### FR-39 — Resume where the work was left

**Status.** Partial — delivered 35.1, 35.3, 89 · remaining 41 (validation flags)

**Obligation.** The system shall restore a returning user to the report as it was left — field values, the wizard position and validation flags — on any device and in any session, with the position derived per report from the module where work last happened.

| | |
|---|---|
| **Actors** | Any member who can read the report. |
| **Traces** | UC-36, UC-18 · UX-10, UX-39 · FR-24, FR-43 · `architecture.md` OQ-49 |
| **Surfaces** | S-07's entry route · `GET /reports/{id}/modules` (`lastAnsweredAt` per module) · `GET /reports/{id}/modules/{module}` |

**Behaviour.**
1. Values are server-held, so any device reads them, including the three answered-but-not-a-number states (FR-30, FR-31, FR-32).
2. The position is the module with the most recent answer. If nothing is answered, it is the first incomplete step (FR-24). **Nothing records a person's position**, so two people resume where either last worked.
3. Validation flags are **recomputed, not resumed**: validation is idempotent (FR-43). Until task 41 there are no flags to restore.

**Acceptance criteria.**
- **AC-1** Given values saved on one device, when the report is opened on another, then every value reads as stored. *(source: FR text; `e2e/web/resume.spec.ts`)*
- **AC-2** Given answers in several modules, when the report is opened, then it enters at the module with the latest answer. *(source: §12.5.6 task-35.3 row)*
- **AC-3** Given validation has run, when the report is reopened, then the same findings show, recomputed. *(source: §12.5.6 task-35.3 row; FR-43)*. Unmet until task 41.

**History.**
- 2 Sep 2026 · project owner · position per report, derived from the values; validation flags recomputed, not resumed · §12.5.6 task-35.3 row; FR-24, UX-10, UC-18 amended

## 4. Business rules held in this part

Moved from the index's §4.1 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-APP-1 | Employee turnover disclosure applies at a B1 headcount of ≥ 50. | FR-28, FR-72 |
| BR-APP-2 | The unadjusted gender pay gap, and the two pay figures it is derived from, apply at a B1 headcount of ≥ 150. | FR-28, FR-72 |
| BR-APP-3 | Biodiversity applicability is site-driven, evaluated from the B1 site rows, and **governs B5's site-dimensioned disclosures only**. The module's undimensioned disclosures carry no condition, which is where a negative determination is recorded (task 91.3). | FR-28, FR-19 |
| BR-APP-4 | Water relevance is sector-driven: NACE sections A … E, held as data and matched member-or-descendant against B1's activity answer (task 91.3). The clause *"and supports a documented immateriality determination"* was struck on 9 Sep 2026 (task 36.13), because VSME carries no materiality assessment. | FR-28 |
| BR-APP-5 | A field that does not apply is not shown, rather than presented and later rejected. A field whose B1 driver is unanswered does not yet apply (UX-9). Applicability shapes what is shown and counted, never the write (task 91.3). | FR-28 |
| BR-DIS-1 | A numeric zero is an affirmative nil return, stored and rendered distinctly from an unanswered field. | FR-30 |
| BR-DIS-2 | A section may be declared omitted only on the standard's own ground, classified or sensitive information (VSME ¶19). It is stated in B1 as ¶24(b) requires, with no rationale, satisfies validation, and carries into both export formats. | FR-31 |
| BR-DIS-3 | A field declared not available requires a stated reason and is a terminal state distinct from `MISSING VALUE`. | FR-32, D-4 |
| BR-DIS-4 | B1 pre-populates from the entity's point-in-time snapshot and remains editable in-report; editing it does not alter master data. | FR-27, D-2 |
| BR-CALC-1 | Consumption is entered in invoice units, converted to MWh, and results are expressed in tCO₂e; raw inputs are retained permanently. | FR-33, FR-34 |
| BR-CALC-2 | Every computed emission result stores the factor set version used; a later factor update never restates an existing result. | FR-35, FR-71 |
| BR-CALC-3 | An override of a computed value is flagged, names its person, and retains the superseded computed value. | FR-36 |

## 5. Entities held in this part

Moved from the index's §5.2 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Report | Scope (`basic` / `basic_and_comprehensive`), reporting currency (ISO 4217), pinned template and taxonomy version, status, deleted marker (FR-210) | FR-177, FR-29, FR-66, FR-210 |
| Report / disclosure field value | Value, unit, origin (reported / calculated / overridden), explanation, applicability state, answer state (`ok`, `nil_return` or `not_available`; a validation verdict is a finding's, FR-40), carried-forward marker | FR-24, FR-29, FR-30, FR-36, FR-40, FR-47 |
| Derivation input | The inputs EFRAG's derived figures need that the taxonomy does not carry | FR-29 |
| Omitted-disclosure declaration | Section (VSME ¶24(b)), held as B1's list of omitted disclosures, with no rationale | FR-31 |
| Not-available declaration | Field, stated reason | FR-32 |
| Energy / fuel consumption input | Source, site, quantity and invoice unit or the reason there is none, line override with reason | FR-33, FR-36 |
| Calculation run | Pinned factor set (country, revision), retained inputs, results; immutable and permanent | FR-33, FR-34, FR-35 |
| Computed emission result | Scope 1, location-based Scope 2, factor set version | FR-34, FR-35 |
| Override record | Overriding value, reason, the person who overrode it, superseded computed value | FR-36 |
