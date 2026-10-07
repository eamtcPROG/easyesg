# Functional requirements — Part 4: Validation, comparatives, export and traceability

Part 4 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.8 Validation | FR-40 … FR-44 |
| 3.9 Comparatives | FR-45 … FR-47 |
| 3.10 Export | FR-48 … FR-53 |
| 3.11 Traceability | FR-54, FR-55 |

Business rules held here: BR-VAL-1 … BR-VAL-4, BR-VER-2 (§4). Entities held here: §5.

**What is built and what is not.** Comparatives (FR-45 … FR-47) are built end to end. Traceability is half built: the capture of every change is the database's and has been since task 14, and nothing yet reads the trail as a screen (tasks 84.1, 84.2). Validation has its interpreter since task 40 — `packages/validation` holds the rule definition, the reader that admits a rule set and the interpreter, proven identical in the api's runtime and the browser application's over one corpus — and its run, findings and screens (tasks 41, 42) are not started; export (tasks 43 … 47, with the template package, 45) is not started either: `core/validation`, `core/export` and `core/trace` are empty module shells, `packages/xlsx-patch` does not exist, and the contract has no path for validating, previewing or exporting. The blocks for those requirements state what the sources decided and, where no source decided, what the owner settled on 5 Oct 2026 (`architecture.md` §12.5.6's task-182 rows).

**Who uses these capabilities.** Two facts are built. The prior-period read (FR-45) is open to every member of the active organization, view-only included. The change trail is captured for every write, whoever makes it. For the rest, **the rule settled on 5 Oct 2026** (project owner, task 182; `architecture.md` §12.5.6 task-182 validation row, 182/22) is this. An **editor** and the **Organization Administrator** run validation, preview and export, re-download exports and read the change trail. A **view-only** member reads validation findings and the roll-up and nothing else of these: no validation run, no preview, no export, no export history or re-download and no trail (403 `insufficient-role` where a route is asked). `actors.md` §5 had granted the Organization Administrator a roll-up read and none of the others, and said nothing of a view-only member; it is amended to match. The blocks below write *editor or OA* for these, as part 3 does for writes.

## 1. Validation (index §3.8)

### FR-40 — Per-field validation state, inline

**Status.** Partial — delivered 40 (the rule definition and the interpreter, identical in both runtimes) · remaining 41.1, 41.2, 42.1, 42.4

**Obligation.** The system shall expose a validation state for every field, among `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL`, plus the declared-not-available state (FR-32), inline at the point of entry rather than only in a separate report.

| | |
|---|---|
| **Actors** | Evaluated by SYS in the api and by the browser's copy of the same interpreter. The writer sees it while entering. PA maintains the rule definitions (FR-73). Every member reads the findings; an editor or the OA runs validation, and a view-only member does not (182/22). |
| **Traces** | UC-37, UC-82 · D-4, D-G · AD-4, AD-9 · `architecture.md` §9.8, OQ-49 · UX-20, UX-23, UX-33 · NFR-39, NFR-78, NFR-79 · BR-VAL-1 · FR-32, FR-73 · entity *Validation finding* |
| **Surfaces** | S-07 (the field's state marker) · S-08 (findings) · the validate path `architecture.md` §6.8 lists, not yet in `openapi/v1.json` |

**Preconditions.** A report, and rule definitions in force (UC-37).

**Behaviour.**
1. A field resolves to exactly one state (BR-VAL-1). The meanings are the design vocabulary's (`design_spec.md` §6.4): `OK` answered and coherent; `MISSING VALUE` required and unanswered; `VALUE INCONSISTENCY` conflicts with another value, with a link to the conflicting field; `ERROR` violates a rule outright; `INVALID URL` an address that is not a well-formed absolute URL — an `http` or `https` scheme and a host, so a bare `www.` address is not one, though the template's own check accepts it (§12.5.6's task-40 row) — the failing URL shown verbatim; the check is of the address only and never reaches it (182/25). **Which fields are *required* is the template's own call** (182/24): an element is required where EFRAG's Digital Template validation sheet flags it, held as data and written by task 41.1 from that sheet. No platform-authored list is added, so what the reporter sees agrees with what the Excel export's own checks say when the file is opened. The same set names the outstanding items FR-164's notice carries.
2. **Three of the design vocabulary's eight states are not verdicts.** `nil_return` is an answer, and a field carrying it is `OK` (design_spec.md OQ-4). `not_material` is unreachable since 9 Sep 2026 and nothing writes it. `not_available` is the declared state of FR-32, reported separately from `MISSING VALUE` (D-4).
3. The rule types are presence, consistency (the taxonomy's calculation linkbase: headcount by gender and contract totals headcount, waste fractions total waste, GHG roll-ups reconcile), range and format (units, non-negativity, URL validity), and cross-period (FR-46). **Applicability is not one of them**: it is a shape of the form evaluated from a thresholds artefact, not a verdict (task-91.3 rows; FR-28). A field that does not apply is not validated and not counted (task-91.3 rows).
4. One interpreter in `packages/validation`, run by the api authoritatively and by the browser inline, so the two verdicts cannot disagree. A shared fixture corpus run in both runtimes is the proof (tasks 40.2, 40.3).
5. **How a verdict reaches a `react-hook-form` field is `architecture.md` OQ-49, deferred on 19 Aug 2026 with its assumption recorded**: the interpreter is authoritative and the form adapts to it by pushing findings in with `setError`; no resolver package is installed; field-level UX that carries no business meaning (required, input mask, must-be-a-number) may stay in the form. Task 42.1 is where it closes. This block does not close it.
6. Every finding carries the field, the rule, its plain-language explanation and a deep link (§9.8; NFR-78). Its wording is a catalogue key resolved in the reader's locale, in NFR-79's three parts, with no rule id, enum member or taxonomy key in what the reader sees (task 42.4).
7. State is never carried by colour alone: each has a mark, a label and a colour role (UX-23).
8. **A verdict lives in the findings, and only there** (182/17). A value row's `state` carries answer semantics only: `ok` (the default), `nil_return` and `not_available`. The verdict members the row's database check still lists (`missing`, `inconsistency`, `error`, `invalid_url`, and the unreachable `not_material`) stay there as frozen history, and the platform writes none of them. A field with no row is unanswered, and its `MISSING VALUE` is the finding that says so.
9. **A value is always stored, and a verdict never refuses a write.** An answer that breaks a rule is stored and a finding is raised about it; autosave never refuses a committed keystroke (FR-37; NFR-38).

**Refusals.** None from a verdict (item 9). A write whose state names a verdict member → 400 `validation-failed` (task 41.2). A view-only member asking for a validation run → 403 `insufficient-role` (FR-43). The refusals a write already has (unknown element, locked period) are FR-37's.

**Configuration-held values.** Rule definitions are effective-dated rows in the configuration store (task 41.1, AD-4). None is seeded yet: `config/seed` holds no validation artefact. The set of required elements is among them (182/24). **The wording of a finding is a committed catalogue, not configuration** (`architecture.md` OQ-43): the rule carries a message key.

**Boundaries.** Applicability is FR-28's, the declarations FR-31's and FR-32's, the roll-up FR-41's, navigation FR-42's, re-running FR-43's, rule maintenance FR-73's. The year-over-year rule is FR-46's.

**Acceptance criteria.**
- **AC-1** Given a field, then it shows exactly one of the five states or the declared-not-available state, inline at the point of entry. *(source: FR text; BR-VAL-1; UC-37)* Unmet until 42.1.
- **AC-2** Given an applicable required field never answered, then it is `MISSING VALUE`. *(source: design_spec.md §6.4)* Unmet until 41.1, 42.1.
- **AC-3** Given a field declared not available with a reason, then it shows that state and not `MISSING VALUE`. *(source: FR text; D-4; FR-32/AC-3)* Unmet until 41.
- **AC-4** Given a field holding an affirmative zero, then its verdict is `OK`. *(source: design_spec.md §6.4 vocabulary note)* Unmet until 41.1.
- **AC-5** Given a field that does not apply, then it is neither validated nor counted. *(source: §12.5.6 task-91.3 rows)* Unmet until 41.1.
- **AC-6** Given the same answers, then the api and the browser return identical verdicts over the shared corpus. *(source: `architecture.md` §9.8; task 40.3)*
- **AC-7** Given any finding, then its text names what happened, what follows and what to do, in the reader's locale, and contains no internal identifier. *(source: NFR-79; task 42.4)* Unmet until 42.4.
- **AC-8** Given a rule definition changed and published, then the next evaluation applies it with no deployment. *(source: FR-73; AD-4; NFR-85)* Unmet until 41.1.
- **AC-9** Given any state, then it is distinguishable without colour. *(source: UX-23)* Unmet until 42.1.
- **AC-10** Given an answer that breaks a rule, then it is stored and a finding is raised about it, and the write is not refused. *(source: §12.5.6 task-182 validation row, 182/17)* Unmet until 41.2.
- **AC-11** Given a stored value, then its state is `ok`, `nil_return` or `not_available`, and a write naming `missing`, `inconsistency`, `error` or `invalid_url` as its state is refused with 400. *(source: §12.5.6 task-182 validation row, 182/17)* Unmet until 41.2.
- **AC-12** Given an element that the template's validation sheet flags as required and that is applicable and unanswered, then it is `MISSING VALUE`; given one the sheet does not flag, then it is not. *(source: §12.5.6 task-182 validation row, 182/24)* Unmet until 41.1.
- **AC-13** Given text that is not a well-formed absolute URL in a URL field, then the field is `INVALID URL` with the text shown verbatim; given a well-formed address that nothing answers, then it is `OK`, and no request is made to the address. *(source: §12.5.6 task-182 validation row, 182/25)* Unmet until 41.1.
- **AC-14** Given a view-only member, then the findings are readable and a validation run is refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 41.2.

**History.**
- 18 Aug 2026 · requirements owner with design · the machine states are canonical and the design states derive from them; `nil_return` and section materiality are not field validation states · design_spec.md OQ-4, §6.4
- 19 Aug 2026 · architecture · how a verdict reaches a form field deferred, assumption recorded · `architecture.md` OQ-49
- 19 Aug 2026 · project owner · finding wording ships as committed catalogues, the rule keeps the key · `architecture.md` OQ-43
- 3 Sep 2026 · project owner · applicability is a shape, not a verdict · §12.5.6 task-91.3 rows
- 9 Sep 2026 · project owner · `not_material` unreachable, kept in the vocabulary as frozen history · §12.5.6 task-36.13 rows; design_spec.md §6.4
- 5 Oct 2026 · project owner · the verdict lives in the findings only, the value row keeps answer semantics, and no verdict refuses a write · §12.5.6 task-182 validation row (182/17)
- 5 Oct 2026 · project owner · *required* means flagged by the template's validation sheet · §12.5.6 task-182 validation row (182/24)
- 5 Oct 2026 · project owner · `INVALID URL` checks the form of an address and never reaches it; design_spec.md §6.4 amended · §12.5.6 task-182 validation row (182/25)
- 5 Oct 2026 · project owner · every member reads findings; an editor or the OA runs validation · §12.5.6 task-182 validation row (182/22)
- 7 Oct 2026 · project owner · rules are a closed vocabulary of eight kinds, each carrying its verdict; a field holding several findings shows the most severe; an absolute address is an `http` or `https` scheme and a host, so a bare `www.` address is `INVALID URL` · §12.5.6 task-40 row

### FR-41 — Roll-up per module and per report

**Status.** Not started — remaining 41.2, 41.3, 42.2, 47.5 (marking a report filed). The wizard's module list counts in the browser meanwhile (task 179.1, delivered); that count is an interim and is not this requirement.

**Obligation.** The system shall roll validation state up per module and across the whole report, discounting sections declared omitted as classified or sensitive information (FR-31) so that a legitimate omission does not depress completion.

| | |
|---|---|
| **Actors** | SYS computes. Every member reads the roll-up, a view-only member included (FR-25; 182/22). |
| **Traces** | UC-38, UC-169 · D-4 · BR-VAL-2 · UX-20, UX-21 · `architecture.md` §9.8 · FR-31, FR-164 · entity *Validation finding* |
| **Surfaces** | S-08 (roll-up and meter) · S-07's module list · S-06 and S-05's completion and validation columns · the validate path of §6.8, not yet built |

**Preconditions.** Persisted findings (task 41.2).

**Behaviour.**
1. Module-level and report-level states are derived from field states, **server-side, once**: *two counters would be two answers* (§12.5.6 task-32.4 row). The wizard's list counts in the browser until 41.3 lands, *done* meaning every applicable field answered, and reads the server status then (task-179.1 row).
2. **What the roll-up counts.** A module declared omitted leaves the denominator, whether its own member is selected or all its sections are (UX-21; task-36.13 rows). A module ruled out by FR-28 leaves it too; a module waiting on B1 stays in it. A field that does not apply is not counted (task-91.3 rows).
3. **What counts as resolved** (design_spec.md §6.4): `OK`, `nil_return` and `not_available` do (the last *reasoned*); `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL` do not.
4. The roll-up supplies the named outstanding modules and fields that FR-164's notice carries (UC-38, UC-169; task 51.2 waits for 41.3).
5. **What the roll-up returns** (182/18). *Counts*, per module and for the report: **resolved** (answered, including a nil return), **reasoned** (declared not available, FR-32) and **outstanding** (what item 3 does not count as resolved); and a **derived status**: *not started* (nothing resolved or reasoned), *in progress* (something outstanding) or *complete* (nothing outstanding) for a module, the wizard's own derivation (task-179.1 row), and the same three for the report, where *complete* reads *ready* (item 6). That is the single readiness signal UC-38 asks for, and it is what the completeness meter draws: *resolved / reasoned / outstanding and never a single percentage* (design_spec.md §11.5). A surface that needs a figure derives one from the counts for display, as the advisor board does (FR-200); the roll-up never returns one.
6. **The report's status** (182/19). `ready_to_file` is *computed* from the roll-up: a report is ready when nothing is outstanding, and stops being ready when a run finds something outstanding. No user act sets it. `filed` is the reporter's explicit act, *Mark as filed* on S-11 (`design/IMPLEMENTATION_PLAN.md`), and never the result of an export: an export may be a draft for a bank, and only the reporter knows a document has left the building. The period lock stays the only writer of `open` and `locked` (task-31.3 row).
7. S-06 and S-05 refuse the completion and validation columns until this exists (task-32.2 and task-32.4 rows); FR-25/AC-3 is unmet until 41.3.
8. **The roll-up is as current as the findings it is read from** (182/26): the api evaluates when asked, not on each write (FR-43), so a report edited since the last run reads as the run left it, and an export request runs validation first (FR-44).

**Boundaries.** What *omitted* means is FR-31's. The state of each field is FR-40's. The notice is FR-164's.

**Acceptance criteria.**
- **AC-1** Given field states, then a module-level and a report-level state are derived from them. *(source: FR text; UC-38)* Unmet until 41.3.
- **AC-2** Given a section declared omitted under FR-31, then it does not reduce the completion. *(source: FR text; BR-VAL-2; FR-31/AC-3)* Unmet until 41.3.
- **AC-3** Given a module ruled out by FR-28, or a field that does not apply, then it is not counted. *(source: §12.5.6 task-91.3 and task-179.1 rows)* Unmet until 41.3.
- **AC-4** Given a field declared not available with a reason, then it counts as resolved and reasoned. *(source: design_spec.md §6.4)* Unmet until 41.3.
- **AC-5** Given the roll-up, then the wizard's module list reads it and the browser's own count is gone. *(source: §12.5.6 task-179.1 row)* Unmet until 41.3.
- **AC-6** Given outstanding items, then the roll-up names the modules and fields. *(source: UC-38; UC-169; FR-164)* Unmet until 41.3.
- **AC-7** Given a report, then the roll-up returns counts per module and for the report (resolved, reasoned, outstanding) and a derived status, and returns no percentage. *(source: §12.5.6 task-182 validation row, 182/18)* Unmet until 41.3.
- **AC-8** Given a report with nothing outstanding, then it reads ready to file; given a later run that finds something outstanding, then it no longer does. No user act sets either. *(source: §12.5.6 task-182 validation row, 182/19)* Unmet until 41.3.
- **AC-9** Given a completed export, then the report's status is unchanged; given the reporter marks the report filed, then it reads filed. *(source: §12.5.6 task-182 validation row, 182/19)* Unmet until 47.5.

**History.**
- 31 Aug and 7 Sep 2026 · project owner · S-06 and S-05 refuse the completion column until this exists, rather than draw a count the roll-up would contradict · §12.5.6 task-32.2 and task-32.4 rows
- 9 Sep 2026 · project owner · the discounted ground is classified or sensitive information, not materiality · §12.5.6 task-36.13 rows; UX-21; BR-VAL-2
- 21 Sep 2026 · project owner · FR-164's named list is read from this roll-up · §12.5.6 task-49.1 row
- 1 Oct 2026 · project owner · the module list counts in the browser as an interim for 41.3 · §12.5.6 task-179.1 row
- 5 Oct 2026 · project owner · the roll-up returns counts and a derived status, never a percentage · §12.5.6 task-182 validation row (182/18)
- 5 Oct 2026 · project owner · `ready_to_file` is computed from the roll-up; `filed` is the reporter's explicit act, never an export's · §12.5.6 task-182 validation row (182/19)
- 5 Oct 2026 · project owner · every member reads the roll-up · §12.5.6 task-182 validation row (182/22)

### FR-42 — From a finding to its field

**Status.** Not started — remaining 42.3. The findings it follows are 41.2's.

**Obligation.** The system shall allow navigation from any validation finding directly to the affected field, focused, with the rule explanation shown.

| | |
|---|---|
| **Actors** | Every member who reads the findings, a view-only member included (182/22). |
| **Traces** | UC-39 · UX-4, UX-22 · P6 · `architecture.md` §9.8 · design_spec.md §10.4 |
| **Surfaces** | S-08 (the finding as a link) · S-07 (the field) |

**Preconditions.** At least one finding exists (UC-39).

**Behaviour.**
1. Selecting a finding moves focus to the field that produced it, scrolls it into view and displays the rule explanation (UX-22). Scrolling without moving focus is an accessibility failure (design_spec.md §10.4).
2. The destination is an address (UX-4): a finding is a URL that lands on its field, not a scroll handler (task 42.3).
3. A finding in another module takes the reader to that module's step, so a long report is navigable without hunting through eleven modules (UC-39).
4. A finding of inconsistency also links the field it conflicts with (design_spec.md §6.4).
5. Every finding carries a deep link (§9.8).

**Boundaries.** What a finding says is FR-40's. How findings are listed and grouped is S-08's content (FR-41).

**Acceptance criteria.**
- **AC-1** Given a finding, when it is selected, then focus moves to the field that produced it and the rule explanation is shown. *(source: FR text; UX-22)* Unmet until 42.3.
- **AC-2** Given a finding, then selecting it moves focus and does not only scroll. *(source: UX-22; design_spec.md §10.4)* Unmet until 42.3.
- **AC-3** Given a finding's address opened directly, then it lands on the field. *(source: UX-4; task 42.3)* Unmet until 42.3.
- **AC-4** Given a finding in a module other than the open one, then selecting it opens that module's step at the field. *(source: UC-39)* Unmet until 42.3.
- **AC-5** Given a finding of inconsistency, then the conflicting field is linked. *(source: design_spec.md §6.4)* Unmet until 42.3.

**History.**
- 5 Oct 2026 · project owner · every member reads the findings, a view-only member included · §12.5.6 task-182 validation row (182/22)

### FR-43 — Validation re-run at any completeness

**Status.** Partial — delivered 40.2 (the interpreter, whose findings depend on the answers alone and not on their order) · remaining 41.2 (the run and the findings it stores)

**Obligation.** The system shall re-run validation idempotently at any level of completeness, so that it functions as a working tool during drafting and not only as a pre-export gate.

| | |
|---|---|
| **Actors** | An editor or the OA runs it. SYS also evaluates (FR-164's notice). Every member reads the findings; a view-only member does not run it (182/22). |
| **Traces** | UC-40 · BR-VAL-3 · UX-24 · NFR-39 · FR-39 · `architecture.md` §9.8 |
| **Surfaces** | S-08 (*check my report*, never *submit*) · the validate path of §6.8, not yet built |

**Preconditions.** A report session (UC-40). **The period may be locked**: validation runs, and its findings are stored, on a locked report (182/21).

**Behaviour.**
1. Validation runs at any completeness. Repeated runs over unchanged data give identical results (BR-VAL-3).
2. **A re-run replaces a report's findings rather than accumulating them**, and a corrected field clears its finding (task 41.2).
3. The primary control is *check my report*, not *submit* (UX-24). While a run is in flight the roll-up shows inline progress and the wizard stays interactive (S-08's pending state).
4. A full-report run takes p95 ≤ 2 s for a fully populated Basic Module report, against the maximum-population fixture (NFR-39).
5. **Findings are recomputed, not resumed** (FR-39; §12.5.6 task-35.3 row). That equivalence rests on a recorded assumption: no finding carries state a re-run cannot reproduce (a dismissed warning, say). If one ever does, task 41 inherits the question.
6. **When findings are refreshed** (182/26). The api evaluates only when asked: an explicit run (*check my report*), an export request (FR-44) and a notice's schedule (FR-164). It does not re-evaluate after each write, because autosave is the highest-volume path (NFR-38) and a full run on each write would multiply a 2 s budget (NFR-39) by it. The browser's inline verdicts are always live (FR-40). A finding whose field no longer applies (FR-28) is dropped when findings are read, without waiting for the next run.
7. **A locked report is validated like any other** (182/21). The findings table is declared exempt from the lock trigger in the schema invariant (task-31.4's rule: a table keyed to a report carries the lock or is declared exempt), because findings are derived and not filed content. A locked report is the one about to be exported, and a warning computed from frozen findings would be wrong whenever a rule changed after the lock.

**Refusals.**
- Unknown report, or one outside the active organization → 404 `not-found` (every route over a report; `core.report.not_found`)
- A view-only member asking for a run → 403 `insufficient-role` (182/22); reading the findings is not refused

**Boundaries.** The verdicts are FR-40's, the roll-up FR-41's, the pre-export warning FR-44's.

**Acceptance criteria.**
- **AC-1** Given an incomplete report, when validation is run, then it returns findings. *(source: FR text; UC-40)* Unmet until 41.2.
- **AC-2** Given unchanged data, when validation is run twice, then the findings are identical. *(source: FR text; BR-VAL-3)* Unmet until 41.2.
- **AC-3** Given a corrected field, when validation is re-run, then its finding is gone and no stale finding remains. *(source: task 41.2)* Unmet until 41.2.
- **AC-4** Given a fully populated Basic report, then a run completes within p95 2 s. *(source: NFR-39)* Unmet until 41.2.
- **AC-5** Given a report reopened on another device, then the same findings show, recomputed. *(source: FR-39/AC-3; §12.5.6 task-35.3 row)* Unmet until 41.2.
- **AC-6** Given a report in another organization, then a run answers 404. *(source: `core/disclosure/errors/report.errors.ts`)* Unmet until 41.2.
- **AC-7** Given a locked period, when validation is run, then it runs and its findings are stored. *(source: §12.5.6 task-182 validation row, 182/21)* Unmet until 41.2.
- **AC-8** Given an answer written after the last run, when findings are read before another run, then they are the last run's, except that a finding for a field that no longer applies is not returned. *(source: §12.5.6 task-182 validation row, 182/26)* Unmet until 41.2.
- **AC-9** Given a view-only member, then they read the findings and a run is refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 41.2.

**History.**
- 2 Sep 2026 · project owner · validation flags are recomputed, not resumed; the assumption that no finding carries irreproducible state is recorded · §12.5.6 task-35.3 row; FR-39
- 5 Oct 2026 · project owner · validation runs and stores findings on a locked report; the findings table is exempt from the lock · §12.5.6 task-182 validation row (182/21)
- 5 Oct 2026 · project owner · the api evaluates when asked, not on each write; a finding for a field that no longer applies is dropped at read · §12.5.6 task-182 validation row (182/26)
- 5 Oct 2026 · project owner · an editor or the OA runs validation; a view-only member reads · §12.5.6 task-182 validation row (182/22)
- 7 Oct 2026 · build · the interpreter is deterministic over its input: findings in rule order, then natural-key order, whatever order the values arrive in · §12.5.6 task-40 row; task 40.2

### FR-44 — Export with unresolved findings, after a warning

**Status.** Not started — remaining 41.2, 44.3, 46.1, 46.5, 47.3, 47.4. Both 44.3 and 47.3 cite this requirement, 47.3 since 182/165, and the warning is S-11's content (47.3), the api's half of it is 47.4's, and the Excel marking is 46.5's.

**Obligation.** The system shall permit export with unresolved findings after an explicit warning, marking the gaps visibly in the output rather than omitting them silently.

| | |
|---|---|
| **Actors** | An editor or the OA exports. A view-only member is refused (182/22). |
| **Traces** | UC-42 · BR-VAL-4 · UX-25, UX-45, UX-119, UX-121 · `problem_overview.md` A3 · D-11, NFR-1 · FR-40, FR-49, FR-50, FR-51 |
| **Surfaces** | S-11 (the warning before the export) · S-08 (the export warning path into S-11) · S-10 (the same marked gaps) · the PDF and the Excel export |

**Preconditions.** A report with unresolved findings.

**Behaviour.**
1. Export is never silently blocked by findings (S-11). The user is warned first, with a list of what is unresolved, and then proceeds (UX-25). **The api requires the acknowledgement too** (182/20). A request to export a report with unresolved findings that carries no acknowledgement is refused with a problem document listing the unresolved findings as evaluated at that request; the same request carrying an acknowledgement is accepted. The refusal only asks, and nothing is refused permanently. An api client (FR-153) meets the same protocol as the screen.
2. **The warning belongs to the compliance core.** With billing disabled UC-17 … UC-48 still pass (D-11, NFR-1), so the warning cannot depend on an entitlement decision. `architecture.md` §11.3's sequence once drew it as an entitlement outcome; entitlement outcomes are quota's alone (AD-5; FR-101; 182/20).
3. **Gaps are marked visibly and consistently in the produced document** (UX-119): a field *not available* with its stated reason, a section omitted as classified or sensitive named as such, and unresolved findings shown rather than omitted. A reader can always tell a zero, a gap and an omission apart. The marking survives monochrome print (UX-121).
4. The preview shows the same gaps, marked the same way (UX-45).
5. Export never proceeds silently against a version the report was not prepared under (S-11; FR-51).
6. **How the Excel export marks a gap** (182/30), given that the template's presentation is preserved (UX-122): through the template's own states where it has an element for the thing (its list of omitted disclosures, its not-available choices), and elsewhere through a cell note, placed by task 46.5 beside the override marker. No platform sheet is added, and no gap is left blank.
7. **Nothing is gated by findings** (182/27). The *submission* that tasks 42 and 42.2 said the roll-up gates is the report reading *ready to file*, which the roll-up computes per the rule definitions (FR-41; 182/19). No other step is gated, and export never is. Both task rows are reworded.
8. **Validation is evaluated at the export request** (182/26), so the warning lists what is unresolved at that moment, on a locked period too (182/21).

**Refusals.** Unresolved findings and no acknowledgement → 409, with a problem type of its own so that the dialogue can branch on it, listing the findings (named by 47.4, as `report-already-exists` was); with the acknowledgement there is no refusal for findings, so an export with unresolved findings is never refused for good. View-only → 403 `insufficient-role` (182/22).

**Boundaries.** Entitlement refusals (suspension, quota) are FR-99 … FR-105's. Findings are FR-40's.

**Acceptance criteria.**
- **AC-1** Given unresolved findings, when an export is requested, then the user is warned first, with the list of what is unresolved, and the export proceeds only after they confirm. *(source: FR text; UX-25; S-11)* Unmet until 47.3.
- **AC-2** Given an export with unresolved findings, then the produced PDF marks each gap visibly and omits none silently. *(source: FR text; UX-119; task 44.3)* Unmet until 44.3.
- **AC-3** Given a field not available, then the PDF states its reason. Given a section omitted, then it is named as omitted. *(source: UX-119)* Unmet until 44.3.
- **AC-4** Given a zero, a gap and an omission, then a reader can tell all three apart in the PDF. *(source: UX-119)* Unmet until 44.3.
- **AC-5** Given billing disabled, then the warning still appears. *(source: D-11; NFR-1; UC-42)* Unmet until 47.3.
- **AC-6** Given the preview, then it marks the same gaps as the export. *(source: UX-45)* Unmet until 43.2.
- **AC-7** Given unresolved findings and an export request that carries no acknowledgement, then it is refused, the refusal lists the unresolved findings as evaluated at the request, and no job is enqueued. *(source: §12.5.6 task-182 validation row, 182/20)* Unmet until 47.4.
- **AC-8** Given the same request carrying an acknowledgement, then it is accepted; given no unresolved findings, then no acknowledgement is needed. *(source: §12.5.6 task-182 validation row, 182/20)* Unmet until 47.4.
- **AC-9** Given an Excel export of a report holding a field declared not available, a section omitted and an unresolved finding, then each is marked in the template's own element where it has one and in a cell note where it has not, and none is left blank. *(source: §12.5.6 task-182 validation row, 182/30)* Unmet until 46.5.
- **AC-10** Given a locked period, then the warning and the acknowledgement protocol work as on an open one. *(source: §12.5.6 task-182 validation row, 182/21)* Unmet until 47.4.
- **AC-11** Given a view-only member, when an export is requested, then it is refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 47.4.

**History.**
- 18 Aug 2026 · design owner · UX-25's citation corrected to UC-42, FR-44 and BR-VAL-4 · design_spec.md OQ-8
- 5 Oct 2026 · project owner · the api requires the acknowledgement the warning collects · §12.5.6 task-182 validation row (182/20)
- 5 Oct 2026 · project owner · nothing is gated by findings; *submission* in tasks 42 and 42.2 meant readiness to file · §12.5.6 task-182 validation row (182/27)
- 5 Oct 2026 · project owner · the Excel export marks gaps through the template's own states, else a cell note · §12.5.6 task-182 validation row (182/30)
- 5 Oct 2026 · project owner · an editor or the OA exports; a view-only member is refused · §12.5.6 task-182 validation row (182/22)

## 2. Comparatives (index §3.9)

### FR-45 — Prior period resolved from the linkage

**Status.** Built — delivered 31.1, 34.3

**Obligation.** The system shall store multiple reporting periods per entity and resolve the prior period automatically from the period linkage, with no manual selection.

| | |
|---|---|
| **Actors** | Every member of the active organization reads, view-only included. OA opens the periods (FR-21). |
| **Traces** | UC-45, UC-56 · D-3 · NFR-3 · FR-21 · `architecture.md` §17.5 (`core/comparatives`) · `problem_overview.md` C5 |
| **Surfaces** | S-07 (the field's comparative) · S-14 (the link is made when a period is opened) · `GET /reports/{id}/prior-period` |

**Preconditions.** A report. A prior period, linked, for there to be a comparative.

**Behaviour.**
1. The linkage is resolved, never chosen: nothing in the request names a period (use case, task 34.3).
2. **The link is maintained, not merely set.** Creating a period repoints the neighbour that should now follow it, so opening FY2026 first and backfilling FY2025 later does not leave FY2026 with no prior forever (§12.5.6 task-31.1 row).
3. The answer says why there is nothing to show: `no_prior_period` (normally the entity's first year), `no_prior_report` (a prior period is linked and no report was made against it), or `available`.
4. When available, the answer carries the prior report's pin (report, period, fiscal year, taxonomy version) beside this report's, and every prior value with its comparability: `comparable`, `element_absent` or `shape_changed`. These are facts read from the registry, not a decision about what to show (task 36.14 decides that, FR-46).
5. A value whose element the current taxonomy no longer names is returned and marked, never dropped: a version change must not cost a reporter the comparative that is mandatory from year two.
6. Where both reports pin the same version the value is comparable without a lookup. A withdrawn prior version reads as `element_absent`.
7. **The prior read leaves out two things**: the prior value's reason for not being available, and whether it was itself carried forward.
8. The standard is assumed to be VSME, because the report stores no standard column; that is true while VSME is the only registered standard, and a second one needs a migration (§12.5.6 task-34.3 row).
9. The read carries no entitlement gate and will carry none: inline comparatives are free on every plan. D-12's *comparative-period features* means the deferred standalone view (FR-179), not the inline value (D-3; 182/67).

**Refusals.**
- Unknown report, or one outside the active organization → 404 `not-found`

**Boundaries.** The standalone year-over-year view is deferred (FR-179, D-3). Showing the comparative beside the input is FR-46's.

**Acceptance criteria.**
- **AC-1** Given two periods of one entity, the later linked to the earlier, when the later report's prior-period read is made, then the earlier report's values are returned with no period supplied by the caller. *(source: FR text; FR-21; task 34.3 e2e)*
- **AC-2** Given a first-year report, then the read answers `no_prior_period` and no values. *(source: §12.5.6 task-34.3 row)*
- **AC-3** Given a linked prior period with no report, then the read answers `no_prior_report`. *(source: §12.5.6 task-34.3 row)*
- **AC-4** Given a prior report pinned to a different version, then both pins are on the answer and each value carries its comparability. *(source: §12.5.6 task-34.3 row)*
- **AC-5** Given a prior value whose element the current version no longer names, then it is returned marked `element_absent`, not dropped. *(source: §12.5.6 task-34.3 row)*
- **AC-6** Given FY2026 opened first and FY2025 created afterwards, then FY2026's prior period is FY2025. *(source: §12.5.6 task-31.1 row)*
- **AC-7** Given a report outside the active organization, then the read answers 404. *(source: `core/disclosure/errors/report.errors.ts`)*
- **AC-8** Given an organization on any plan, Free included, then the prior-period read is answered and is not gated by an entitlement. *(source: §12.5.6 task-182 billing-catalogue row, 182/67)*

**History.**
- 29 Aug 2026 · project owner · the prior link is maintained when a period is created · §12.5.6 task-31.1 row
- 1 Sep 2026 · project owner · the comparative says which two versions produced it; nothing is dropped; absence is split in two · §12.5.6 task-34.3 rows
- 1 Sep 2026 · build · `core/comparatives` owns a route, correcting two statements that said it owned none; the VSME assumption recorded · §12.5.6 task-34.3 rows
- 5 Oct 2026 · project owner · inline comparatives are free on every plan; the read has no entitlement gate · §12.5.6 task-182 billing-catalogue row (182/67)

### FR-46 — The prior-period value beside the input

**Status.** Partial — delivered 34.3, 36.14, 40 (the year-over-year rule kind) · remaining 41.1, 42.1 (the rule seeded, and shown at the field, UX-33)

**Obligation.** The system shall display the prior-period value alongside the current input at the point of entry, so that an implausible year-over-year movement is visible while it can still be checked.

| | |
|---|---|
| **Actors** | Every member who opens the step. |
| **Traces** | UC-45 · D-3 · UX-31, UX-33 · `architecture.md` §9.8 · FR-45, FR-73 |
| **Surfaces** | S-07 (the field's prior-period row) · `GET /reports/{id}/prior-period` |

**Preconditions.** A prior period exists (FR-45).

**Behaviour.**
1. The prior value sits adjacent to the current input, not in a separate comparison view (UX-31).
2. **Only `comparable` values are shown** (FR-45). `element_absent` has no field to sit beside, and `shape_changed` has one whose kind or period type moved: a duration that became an instant is not last year's figure, and showing it would invite the false comparison this requirement exists to prevent (task 36.14).
3. **The index is the whole natural key** `(element, dimension member, ordinal)`, the function the autosave queue addresses a field with. B8's Moldova row and its Romania row are different answers to one element, and an element-keyed index would put one country's headcount beside another's (task 36.14).
4. Shown only where last year holds a value in the column this field's kind uses. A field answered not available last year shows no comparative row.
5. **The movement rule** (UX-33, §9.8's cross-period type): a movement beyond a configured proportional threshold raises `VALUE INCONSISTENCY`, not `ERROR`, because the movement may be real. The message states both values and the change. **One global proportion** (182/28): it applies to every numeric element alike, a prior value of zero is skipped (a proportion of zero is undefined), and it is held as data (FR-73) and not as one per unit, module or element. **Its value is ±50%** (§12.5.6 task-182 starting-values row). *Beyond* is strictly greater, so a movement of exactly the proportion is not flagged, and a pair in different units is not compared (§12.5.6 task-40 row).
6. A Free-plan organization sees the prior value, as every plan does: inline comparatives are not plan-gated (182/67).

**Configuration-held values.** The movement threshold is configuration (UX-33, FR-73): one proportion for every numeric element (182/28). Task 41.1 seeds it. **Starting value: ±50%** — a movement of more than half against the prior period is flagged; a prior value of zero is skipped (§12.5.6 task-182 starting-values row).

**Boundaries.** The standalone year-over-year view is deferred (FR-179). Carrying a value forward is FR-47's. The PDF and preview include comparatives in their indicator tables (FR-48, FR-49); the Excel template has no prior-period cells, so the Excel export carries none (182/33).

**Acceptance criteria.**
- **AC-1** Given a prior period, then each field with a comparable prior value displays it next to the current input, on every plan including Free. *(source: FR text; UX-31; §12.5.6 task-182 billing-catalogue row, 182/67)*
- **AC-2** Given a prior value that is `element_absent` or `shape_changed`, then it is not shown. *(source: §12.5.6 task-36.14 row)*
- **AC-3** Given B8's rows for two countries, then each shows its own prior value. *(source: §12.5.6 task-36.14 row)*
- **AC-4** Given a field answered not available last year, then no empty comparative row appears. *(source: §12.5.6 task-36.14 row)*
- **AC-5** Given a movement beyond the threshold, then the field is `VALUE INCONSISTENCY`, and its message states both values and the change. *(source: UX-33; `architecture.md` §9.8)* Unmet until 41.1, 42.1.
- **AC-6** Given a prior value of zero, then no movement finding is raised for the field. *(source: §12.5.6 task-182 validation row, 182/28)* Unmet until 41.1.
- **AC-7** Given the threshold is changed in configuration, then the next evaluation applies it with no deployment, and one value serves every numeric element. *(source: FR-73; §12.5.6 task-182 validation row, 182/28)* Unmet until 41.1.

**History.**
- 9 Sep 2026 · project owner · the wizard shows only comparable values, indexed by the whole natural key · §12.5.6 task-36.14 row
- 5 Oct 2026 · project owner · a Free-plan organization sees the prior value · §12.5.6 task-182 billing-catalogue row (182/67)
- 5 Oct 2026 · project owner · one global movement proportion, a zero prior skipped, held as data · §12.5.6 task-182 validation row (182/28)
- 5 Oct 2026 · project owner · starting value set (182/28) · §12.5.6 task-182 starting-values row
- 7 Oct 2026 · project owner · the movement rule is one kind of the rule vocabulary, its proportion one per set; *beyond* is strictly greater and a pair in different units is not compared · §12.5.6 task-40 row

### FR-47 — Carry a prior value forward, marked

**Status.** Partial — delivered 34.1, 36.14 · remaining 191 (the confirm action)

**Obligation.** The system shall allow a prior-period value to be carried forward into the current period, marking it as carried forward so that it is reviewed rather than accumulating unnoticed.

| | |
|---|---|
| **Actors** | Editor or OA, per field. A view-only member is not offered the action. |
| **Traces** | UC-46 · D-3 · UX-32 · FR-45 · FR-37 |
| **Surfaces** | S-07 (the field's carry-forward action and *carried* marker) · `PUT /reports/{id}/values` (`carriedForward`) |

**Preconditions.** A linked prior period with a comparable value for the field (FR-46). An editable report (FR-26).

**Behaviour.**
1. The action is **per field**. UX-32's module-level bulk action is optional, and is deliberately not built: one action that marks a whole module carried is the *accumulating unnoticed* this requirement exists to prevent (task-36.14 row).
2. **Offered only on an empty field.** UC-46's trigger is the reporter judging that a value has not changed; overwriting an answer is a different act. It is also absent on a read-only step and where there is nothing comparable to copy.
3. Carrying is an ordinary value write with `carriedForward: true`, through the autosave queue (FR-37, FR-38). The store holds the flag (`carried_forward`, default false) and the step read serves it.
4. **Any later write that does not send the flag stores it false**: editing a carried value clears the mark (UX-32, *until edited*). **Clearing it without editing is a per-field *confirm* action** (182/29): a reporter who reviewed a carried value and found it right confirms it, and the value is rewritten with the flag off, without retyping. It is offered on a carried value only, to an editor or the OA, and enters the trail like any write (FR-54). UX-32's *explicitly confirmed* is this action.
5. The mark is internal and **is not exported**: VSME has no element for it, and its purpose is a reader's obligation on this platform rather than a disclosure (task-36.14 row; UC-46).
6. **It is not VSME's mechanism for unchanged disclosures.** B1 carries three elements for that (a boolean, a list of sections over the 51-section domain, and a link to the previous report), already shipping as ordinary B1 fields. Carrying forward produces this year's disclosure, which a standalone report needs and which the comparative checks against. Neither is amended (task-36.14 row).
7. A prior value's own carried flag is not inherited (FR-45).

**Refusals.** As any value write (FR-37): view-only → 403 `insufficient-role`; locked period → 409 `report-not-editable`; a computed or overridden figure → 409.

**Acceptance criteria.**
- **AC-1** Given a linked prior period with a value for an empty field, when carry forward is chosen, then the value is copied into the current period and identifiable as carried forward. *(source: FR text; UC-46)*
- **AC-2** Given a field that already holds an answer, then carry forward is not offered. *(source: UC-46; §12.5.6 task-36.14 row)*
- **AC-3** Given a carried value, when it is edited, then the mark clears. *(source: UX-32; `PUT /reports/{id}/values`)*
- **AC-4** Given a carried value, then neither export carries the mark. *(source: UC-46 note; §12.5.6 task-36.14 row)* Unmet until 44, 46.
- **AC-5** Given a module, then no single action carries all its values. *(source: §12.5.6 task-36.14 row)*
- **AC-6** Given a locked period, then carrying a value is refused with 409. *(source: FR-26/AC-2)*
- **AC-7** Given a carried value, when the reporter confirms it without editing, then it is stored unchanged with the mark cleared and no longer reads as carried, and the trail records the change. *(source: §12.5.6 task-182 validation row, 182/29)* Unmet until 191.

**History.**
- 9 Sep 2026 · project owner · carrying forward and VSME's own unchanged-disclosure fields are both real and not alternatives; the mark is internal; the offer is on an empty field only; the bulk action is not built · §12.5.6 task-36.14 rows; UC-46's note
- 5 Oct 2026 · project owner · a carried value is cleared of its mark by editing it or by an explicit per-field confirmation · §12.5.6 task-182 validation row (182/29)

## 3. Export (index §3.10)

### FR-48 — Preview of the assembled report

**Status.** Not started — remaining 39.4 (the overriding person, in the preview), 43.1, 43.2

**Obligation.** The system shall render a preview of the fully assembled report — narrative, indicator tables, comparatives — as it will appear when exported, without generating a file.

| | |
|---|---|
| **Actors** | An editor or the OA. A view-only member is refused (182/22). |
| **Traces** | UC-41 · UX-45, UX-117 · AD-10 · T-13 · `architecture.md` OQ-38 · NFR-18 · FR-49 |
| **Surfaces** | S-10 (the Document archetype) · the preview path of `architecture.md` §6.8, not yet in the contract |

**Preconditions.** A report session (UC-41).

**Behaviour.**
1. The preview shows narrative, indicator tables and comparatives as the export will, and produces no file and no export record (UC-41).
2. **One rendering, two consumers**: the PDF is Chromium rendering the same React templates the preview uses, so the two cannot drift (AD-10; task 43.1). Where those templates live is `architecture.md` OQ-38, open, needed before the export phase.
3. A faithful rendering: same content, same order, same marked gaps (UX-45; FR-44).
4. S-10 is page-shaped, paginated and print-accurate, laid out by the document system of design_spec.md §11.8 and not the interface's. It shows the override attribution markers (UX-43) and the version pin indicators.
5. Because it shares the PDF's rendering, a figure rounds once, half-up, to the per-unit precision configuration holds, as the PDF does (NFR-18; §12.5.6 task-182 row (3)).
6. The preview is built in the three live locales (task 43.2). **It opens in the account's export default** (FR-52) until an export language is chosen, and S-10 offers that choice, so that the preview is of the document the export will produce (182/34).

**Refusals.**
- Unknown report, or one outside the active organization → 404 `not-found`
- View-only → 403 `insufficient-role` (182/22)

**Acceptance criteria.**
- **AC-1** Given a report, then the preview shows its narrative, indicator tables and comparatives. *(source: FR text; UC-41)* Unmet until 43.2.
- **AC-2** Given a preview, then no file is generated and no export is recorded. *(source: FR text; UC-41)* Unmet until 43.2.
- **AC-3** Given the preview and the export of the same report, then content, order and marked gaps are the same. *(source: UX-45)* Unmet until 44.3.
- **AC-4** Given an overridden figure, then the preview shows its attribution marker and the person who overrode it. *(source: UX-43; design_spec.md S-10; §12.5.6 task-182 row (4))* Unmet until 39.4.
- **AC-5** Given the preview and the PDF, then both come from one rendering module. *(source: AD-10; task 43.1)* Unmet until 43.1.
- **AC-6** Given each of the three locales, then a full report previews in it. *(source: task 43.2)* Unmet until 43.2.
- **AC-7** Given the preview opened from S-07, then it is in the account's export default until another language is chosen on S-10. *(source: §12.5.6 task-182 validation row, 182/34)* Unmet until 43.2.
- **AC-8** Given a view-only member, when a preview is requested, then it is refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 43.1.

**History.**
- 5 Oct 2026 · project owner · the preview opens in the account's export default · §12.5.6 task-182 validation row (182/34)
- 5 Oct 2026 · project owner · an editor or the OA previews; a view-only member is refused · §12.5.6 task-182 validation row (182/22)

### FR-49 — The PDF

**Status.** Not started — remaining 43.1, 44.1 … 44.6, 44.7 (the platform-authored-labels statement), 47.1, 47.4

**Obligation.** The system shall generate a formatted, publication-ready PDF from stored data in the selected export language.

| | |
|---|---|
| **Actors** | An editor or the OA exports; a view-only member is refused (182/22). SYS (the worker and the renderer) generates. |
| **Traces** | UC-42 · AD-10 · T-13 · DR-10 · NFR-18, NFR-22, NFR-42, NFR-46, NFR-70, NFR-75, NFR-82 · UX-46, UX-98, UX-117 … UX-121 · FR-52 |
| **Surfaces** | S-11 (the dialogue) · `POST /reports/{id}/exports` → 202 and a job id, `GET /exports/{id}` (`architecture.md` §6.8, not yet in the contract) |

**Preconditions.** A report. A language selected (UC-42; FR-52).

**Behaviour.**
1. **Always a job.** The request answers 202 with a job id, enqueued through the outbox, generated on the worker and never in the request tier (AD-10, NFR-46). The screen watches the job, polling every 5 s while it runs (`architecture.md` OQ-36); beyond a projected 30 s the result is delivered by notification (NFR-42, UX-46). Completion raises a notification (task 44.2). Generation takes p95 ≤ 10 s (NFR-42).
2. **Concurrency.** 10 exports at once per organization; the rest queue and are never rejected (§12.5.6). Whether export needs a queue of its own is task 44.5's to measure.
3. **The pipeline.** Headless Chromium through Playwright, `tagged: true`, over semantic HTML. The output intent, ICC profile and conformance metadata are injected in place with `qpdf` or `pikepdf`; Ghostscript is not in the path. Conformance is PDF/A-2a and PDF/UA-1, validated with veraPDF in CI and in the export regression suite (NFR-75, NFR-82; task 44.3). A render that hangs is killed and retried on a fresh instance (T-13; task 44.4).
4. **The document** has its own layout system (UX-117): a cover with entity, period, module scope, taxonomy version and generation date; a contents list; one section per module in the standard order; indicator tables with comparatives; and a provenance page naming template version, taxonomy version, factor-set version and the generating user. Print structure is controlled (UX-118), the structure is tagged (UX-120), and nothing depends on colour (UX-121).
5. Every export embeds the entity, period, template and taxonomy version, factor-set version, language and generation timestamp (NFR-22).
6. **What the values say.** Each figure rounds once, half-up, to the per-unit precision configuration holds, set by task 44's artboard (task-182 row (3)). A nil return renders as a stated zero (FR-30/AC-4). A section declared omitted is stated (FR-31). A figure that replaced a computed one carries a *company estimate* marker and a footnote with its reason and the superseded value (task 44.6; task-182 row (7)). Gaps are marked (FR-44).
7. **Labels.** Where the export language's VSME labels are platform-authored (Romanian and Russian at `2026-05-01`), the document says so (UX-98; T-14).
8. User-entered text is escaped for markup and script (NFR-70; `architecture.md` §9.7).
9. Pinned versions govern which template and labels are used (FR-51).
10. The export event is recorded for adoption metrics (UC-42 step 2; FR-83). The gate `report.export.pdf` is the entitlement's (FR-99, FR-100); with billing disabled everything is granted (§11.4).

**Refusals.** An entitlement refusal (suspension: new exports blocked, previous ones still downloadable) is FR-104's. Unresolved findings without an acknowledgement are FR-44's refusal. View-only → 403 `insufficient-role` (182/22). Unknown report → 404 `not-found`.

**Configuration-held values.** The per-unit display precision (task 44's). Template and label catalogues are per taxonomy version (`architecture.md` §9.4).

**Boundaries.** The preview is FR-48's. Language is FR-52's. History is FR-53's. Version prompts are FR-51's. The Excel export is FR-50's.

**Acceptance criteria.**
- **AC-1** Given a report, when a PDF is requested, then the answer is 202 with a job id and no rendering happens in the request. *(source: AD-10; NFR-46)* Unmet until 44.2.
- **AC-2** Given a PDF, then it is generated from stored data in the selected language. *(source: FR text)* Unmet until 44.2.
- **AC-3** Given a record-intended PDF, then it conforms to PDF/A-2a and PDF/UA-1, validated by veraPDF. *(source: NFR-82; task 44.3)* Unmet until 44.3.
- **AC-4** Given a PDF, then it has a cover, contents, one section per module in standard order, indicator tables with comparatives and a provenance page. *(source: UX-117)* Unmet until 44.
- **AC-5** Given a PDF, then the seven metadata elements are embedded. *(source: NFR-22)* Unmet until 44.
- **AC-6** Given an overridden figure, then the PDF marks it *company estimate* and footnotes its reason and the superseded value. *(source: UX-43; task 44.6)* Unmet until 44.6.
- **AC-7** Given a nil return, then the PDF shows it as a stated zero. *(source: FR-30/AC-4)* Unmet until 44.3.
- **AC-8** Given an export in a language whose labels are platform-authored, then the document states it. *(source: UX-98; T-14)* Unmet until 44.7.
- **AC-9** Given a render that hangs, then it is killed and the job completes on a fresh instance. *(source: T-13; task 44.4)* Unmet until 44.4.
- **AC-10** Given user text beginning with markup, then the PDF shows it as text. *(source: NFR-70; §9.7)* Unmet until 44.
- **AC-11** Given a PDF, then a figure agrees with the Excel export's. *(source: NFR-18; task 46.4)* Unmet until 46.4.

**History.**
- 18 Aug 2026 · architecture · the conformance target is PDF/A-2a and PDF/UA-1, not PDF/A-2b · NFR-82 amended, `architecture.md` §17.1, AD-10
- 31 Aug 2026 · project owner · the platform-authored-labels caveat covers Romanian as well as Russian · design_spec.md UX-47, UX-98 amended
- 5 Oct 2026 · project owner · one rounding rule; the override marker owned by 44.6 · §12.5.6 task-182 row (3), (7)
- 5 Oct 2026 · project owner · an editor or the OA exports; a view-only member is refused · §12.5.6 task-182 validation row (182/22)

### FR-50 — The EFRAG Excel Digital Template

**Status.** Not started — remaining 45.1 … 45.3, 46.1 … 46.5

**Obligation.** The system shall write stored values into the named ranges of the official EFRAG Excel Digital Template at the version pinned to the report, preserving the template's own dropdowns and consistency-check formulas.

| | |
|---|---|
| **Actors** | An editor or the OA exports; a view-only member is refused (182/22). SYS (the worker) patches. |
| **Traces** | UC-43 · AD-10 · D-C · T-12, T-14 · NFR-18, NFR-20, NFR-22, NFR-42, NFR-70 · UX-122 · FR-51, FR-155 |
| **Surfaces** | S-11 · `POST /reports/{id}/exports` (`architecture.md` §6.8, not yet in the contract) · `config/efrag/` |

**Preconditions.** A report with a pinned template version, whose binary is registered (task 45.3).

**Behaviour.**
1. **The template is patched, not regenerated.** The workbook is a zip of XML parts. The export resolves the named ranges from `xl/workbook.xml`, rewrites only the target cells in the relevant sheet, deletes `xl/calcChain.xml`, sets full recalculation on load, and rezips every other part byte for byte. A library that rebuilds the workbook (ExcelJS) was rejected, because it loses data validation and defined names on a round trip (AD-10).
2. **The template** is the official EFRAG VSME Digital Template, MIT-licensed, tracked in `config/efrag/` (version `1.3.0` and its sample). Measured: sixteen sheets, 121 data validations, 3,720 formulas. The licence sheet inside the workbook travels with every export and is not removed. A no-op patch must be provably a no-op (task 45.1); values land in the template's own cells with formulas, formatting and validation untouched (task 45.2).
3. A template version is a dimension separate from the taxonomy version a report pins; the registry that resolves a report's pin to a template binary is task 45.3's (DR-4). How `config/efrag/` is laid out per version is OQ-45's, deferred to 45.3.
4. The template's own verdicts (its *Table of Contents & Validation* sheet) are EFRAG's and stay working; they are not `packages/validation`'s (`config/efrag/README.md`).
5. Opens without a repair prompt in Microsoft 365, current Excel and LibreOffice Calc, with named ranges, dropdowns and formulas intact (NFR-20). LibreOffice Calc headless is the CI gate (task 46.2); Microsoft 365 and desktop Excel are a manual item on the release checklist, because server-side Office automation is unsupported on Linux (T-12).
6. **The entity identifier written is the LEI where the entity has one, otherwise the IDNO** (`architecture.md` OQ-18, cross-logged 29 Sep 2026).
7. A section declared omitted is written in the template's own element (FR-31). A nil return is a stated zero (FR-30/AC-4). The override marker is placed where the template permits a note, not in a cell of its own, so its checks still pass (task 46.5; task-182 row (7)).
8. User text beginning with `=`, `+`, `-` or `@` is neutralised (NFR-70; §9.7). Romanian and Russian wording is platform-authored with no EFRAG standing (the template's own labels stay English, item 10), and the export says so in the file (task 46.3; T-14; UX-98).
9. Figures round once, half-up, at the surface's per-unit precision (task-182 row (3)); the platform's PDF and Excel figures agree (NFR-18), proven on a golden-report corpus (task 46.4).
10. **Language** (182/31). The template carries its labels in English and eleven other languages, neither Romanian nor Russian. The export sets the template's language cell to English, so the file carries the one language with official labels; the platform writes the values, its narrative text in the language the reporter chose, and the platform-authored statement (item 8). Choosing Romanian or Russian chooses the narrative language only. The template's translations sheet is not touched (UX-122).
11. **Formulas** (182/32). Where the template computes a figure (B8's turnover rate, B9's accident rate), the export writes the inputs only and leaves the formula cells alone, so the template's own consistency checks keep working. The golden-report corpus (task 46.4) proves that the formula's result equals the platform's stored figure for the same inputs.
12. **Gaps** (182/30). A field declared not available, a section omitted and an unresolved finding are marked through the template's own states where it has an element, and otherwise through a cell note (FR-44 item 6; task 46.5).
13. **Comparatives** (182/33). The template has no prior-period cells, so no prior-period value is written. The three B1 statements about unchanged disclosures (FR-47 item 6) carry the standard's own wording.
14. The export is a job, with the same pipeline, concurrency and notification as FR-49.

**Boundaries.** XBRL and iXBRL export are Phase 2 (AD-8). The version prompt is FR-51's.

**Acceptance criteria.**
- **AC-1** Given a report, then values land in the named ranges of the template version the report pins. *(source: FR text)* Unmet until 46.1.
- **AC-2** Given the exported file, then the template's dropdowns and consistency-check formulas remain functional. *(source: FR text; NFR-20)* Unmet until 46.2.
- **AC-3** Given a no-op patch of the template, then the output is identical to the input, or every difference is enumerated and explained. *(source: task 45.1)* Unmet until 45.1.
- **AC-4** Given the exported file, then it opens in LibreOffice Calc with no repair prompt. *(source: NFR-20; task 46.2)* Unmet until 46.2.
- **AC-5** Given an entity with an LEI, then the LEI is written. Given none, then the IDNO. *(source: `architecture.md` OQ-18)* Unmet until 46.1.
- **AC-6** Given an overridden figure, then the file marks and explains it, and the template's checks still pass. *(source: task 46.5)* Unmet until 46.5.
- **AC-7** Given a nil return, then the file shows a stated zero. *(source: FR-30/AC-4)* Unmet until 46.1.
- **AC-8** Given an omitted section, then the file states it in the template's own element. *(source: FR-31/AC-4)* Unmet until 46.1.
- **AC-9** Given user text starting with `=`, then the cell holds text, not a formula. *(source: NFR-70; §9.7)* Unmet until 46.1.
- **AC-10** Given a Romanian or Russian export, then the file states, as the platform's own statement, that the Romanian or Russian wording in it carries no EFRAG standing. *(source: task 46.3; T-14; §12.5.6 task-182 validation row, 182/31)* Unmet until 46.3.
- **AC-11** Given an export in any language, then the template's language cell reads English and its translations sheet is unchanged. *(source: §12.5.6 task-182 validation row, 182/31)* Unmet until 46.1.
- **AC-12** Given a figure the template computes by formula, then its cell still holds the formula and no stored value is written over it; given the golden corpus, then the formula's result equals the stored figure. *(source: §12.5.6 task-182 validation row, 182/32)* Unmet until 46.1, 46.4.
- **AC-13** Given a report holding prior-period values, then the Excel export writes none of them. *(source: §12.5.6 task-182 validation row, 182/33)* Unmet until 46.1.

**History.**
- 18 Aug 2026 · architecture · the Excel verification is split: Calc in CI, Excel by hand · NFR-20 ratified, `architecture.md` §17.1
- 31 Aug 2026 · project owner · Romanian and Russian VSME labels are platform-authored; the export says so · T-14, design_spec.md UX-47, UX-98, task 46.3
- 29 Sep 2026 · project owner · the LEI is written where there is one, otherwise the IDNO · `architecture.md` OQ-18 cross-log, §12.5.6 task-175 row
- 5 Oct 2026 · project owner · the override marker is 46.5's · §12.5.6 task-182 row (7)
- 5 Oct 2026 · project owner · the language cell stays English; formula cells are left alone; no comparatives; gaps marked through the template's states or a cell note · §12.5.6 task-182 validation row (182/30, 182/31, 182/32, 182/33)
- 5 Oct 2026 · project owner · an editor or the OA exports; a view-only member is refused · §12.5.6 task-182 validation row (182/22)

### FR-51 — Never an export against an unplanned version

**Status.** Not started — remaining 47.1, 47.3, 67.7. Row 47.3 cites this requirement since 182/165; the dialogue is S-11's and 47.3 builds S-11.

**Obligation.** Where a report is pinned to a superseded version, the system shall prompt migration or export against the original version with an explicit notice, and shall never silently export against a version the report was not prepared under.

| | |
|---|---|
| **Actors** | An editor or the OA exports; a view-only member is refused (182/22). PA runs migrations (FR-69). |
| **Traces** | UC-43, UC-78 · DR-4 · NFR-3 · UX-48 · BR-VER-2 · FR-65 … FR-70 · `architecture.md` §7.5, §11.5 |
| **Surfaces** | S-11 (the dialogue) · A-04 (migration runs, PA) |

**Preconditions.** A report pinned to a version for which a newer one is registered (FR-65, FR-68).

**Behaviour.**
1. **A report's pin is copied from its period when the report is created and nothing in the request tier can move it**, enforced by column privilege (§12.5.6 task-31.3 row). Re-export resolves the pinned version, not the current one (NFR-3; §7.5).
2. When the pin is superseded, the export dialogue offers the choice and an explicit notice, and does not proceed silently (UX-48; S-11). **The reporter does not run a migration** (182/35): a migration run is the Platform Administrator's act (FR-69; UC-78). The dialogue says that the platform runs migrations and that organizations are told when one is (FR-70), and offers the export against the original version now. UX-48's *offer migration* is met by that notice.
3. A migration run preserves the pre-migration state rather than overwriting in place, in bulk for a compatible change and report by report with review for a breaking one (FR-69; UC-78). Affected organizations are told (FR-70, FR-166).
4. Exporting against the original uses that version's template binary and label catalogue (both kept per version, append-only; `architecture.md` §9.4).
5. Reports not migrated keep their pin and continue to export and validate against it (§11.5 step 6; NFR-3).
6. The version an export was made under is recorded with it (FR-53).

**Acceptance criteria.**
- **AC-1** Given a report pinned to a superseded version, when an export is requested, then the user is shown an explicit notice that migration is the platform's to run and organizations are told when, and is offered the export against the original version now, before anything is generated. *(source: FR text; UX-48; §12.5.6 task-182 validation row, 182/35)* Unmet until 47.3.
- **AC-5** Given the dialogue, then it offers no control that runs a migration. *(source: §12.5.6 task-182 validation row, 182/35)* Unmet until 47.3.
- **AC-2** Given any path to an export, then it never uses a version other than the report's pin without that notice. *(source: FR text; BR-VER-2)* Unmet until 47.1.
- **AC-3** Given export against the original is chosen, then the file uses the pinned version's template and labels, and its record names that version. *(source: FR text; §12.5.6 task-31.3 row)* Unmet until 47.1.
- **AC-4** Given a report not migrated, when a newer version is registered, then it still exports and validates against its pin. *(source: `architecture.md` §11.5; NFR-3)* Unmet until 47.1.

**History.**
- 31 Aug 2026 · project owner · the report's pin is copied, never re-resolved, and no request-tier path moves it · §12.5.6 task-31.3 row
- 5 Oct 2026 · project owner · the reporter does not run a migration; the dialogue gives the notice and offers export against the original · §12.5.6 task-182 validation row (182/35)
- 5 Oct 2026 · project owner · an editor or the OA exports; a view-only member is refused · §12.5.6 task-182 validation row (182/22)

### FR-52 — Export language, independent of the interface

**Status.** Partial — delivered 52.3 · remaining 47.2, 47.3

**Obligation.** The system shall allow the export language to be selected independently of the user's interface language.

| | |
|---|---|
| **Actors** | An editor or the OA. A view-only member exports nothing and chooses nothing (182/22). |
| **Traces** | UC-48, UC-14 · NFR-23, NFR-24 · UX-47, UX-98 · T-14 · FR-9, FR-10, FR-63 |
| **Surfaces** | S-11 (the language decision) · S-27 (the account's export default) |

**Behaviour.**
1. The language is one of the export dialogue's two decisions, taken per export (UX-47).
2. **A new export starts from the account's export default** (`identity.account.export_locale`, chosen on S-27 since task 52.3). It is the account's, not the organization's: S-15 carries no default report language (design_spec.md S-15, task 30.3).
3. The languages offered are those registered for export (FR-63): Romanian, English and Russian at MVP, each separately authored.
4. Where the language's VSME labels are platform-authored, the dialogue says so at the point of selection and recommends the language that has official EFRAG standing for a bank or EU buyer (English at `2026-05-01`) (UX-47, UX-98).
5. The language is recorded with the export (FR-53).
6. **For the Excel export** the choice sets the language of the narrative text only: the template's language cell stays English, whose labels are the official ones (FR-50 item 10; 182/31).

**Acceptance criteria.**
- **AC-1** Given an interface language, then the export language can be set to another, and the export honours it. *(source: FR text; UC-48)* Unmet until 47.2.
- **AC-2** Given a new export, then its language starts as the account's export default. *(source: §12.5.6 task-52.3 row (6); task 47.2)* Unmet until 47.2.
- **AC-3** Given a language whose labels carry no official EFRAG standing, then the dialogue states it and recommends English. *(source: UX-47; UX-98)* Unmet until 47.3.
- **AC-4** Given an export, then its language is on its history record. *(source: UX-49; FR-53)* Unmet until 47.1.
- **AC-5** Given an Excel export in Romanian or Russian, then the template's language cell reads English and the narrative text is in the chosen language. *(source: §12.5.6 task-182 validation row, 182/31)* Unmet until 46.1.

**History.**
- 31 Aug 2026 · project owner · the caveat is written against which labels are official, and English alone is · design_spec.md UX-47 amended; `architecture.md` §9.4, T-14
- 23 Sep 2026 · project owner · the account's export default is the language exports start in; task 47.2 gains it · §12.5.6 task-52.3 row (6)
- 5 Oct 2026 · project owner · for the Excel export the language sets the narrative only; the template's language cell stays English · §12.5.6 task-182 validation row (182/31)

### FR-53 — Immutable export history

**Status.** Not started — remaining 44.2, 46.1, 47.1, 47.3

**Obligation.** The system shall maintain an immutable export history recording format, language, taxonomy version, timestamp and generating user, and shall allow any prior export to be re-downloaded in exactly the form it was distributed.

| | |
|---|---|
| **Actors** | An editor or the OA reads the history and re-downloads; a view-only member does neither (182/22). SYS (the worker) records. |
| **Traces** | UC-44, UC-142 · DR-4, DR-6 · NFR-22, NFR-82 · UX-49, UX-54 · D-13 · FR-104 · entity *Export record* |
| **Surfaces** | S-11 (the history Index) · `GET /exports/{id}` (`architecture.md` §6.8, not yet in the contract) |

**Behaviour.**
1. A history entry is written when an export completes: format, language, taxonomy version, timestamp (an instant, epoch milliseconds on the wire) and generating user. It also names the template version the export was produced at (task 47.1; DR-4).
2. **The artefact is stored, not regenerated.** UC-44 asks for the prior export *exactly as distributed*, which regeneration cannot promise once anything upstream has moved (task 47.1). The record points at the file in EU object storage (§11.3; NFR-22); `core.export_artifact` *retains the distributed file byte for byte* (§12.5.6 task-31.4 row).
3. Immutable: an entry cannot be altered (FR text). The enforcement mechanism for this table is not stated beyond the append-only rule DR-6 gives audit, ledger and metering.
4. Re-download returns the original, byte for byte, after the underlying data has changed. A download is a binary response that bypasses the response envelope (`architecture.md` §6.8).
5. Every export embeds the entity, period, template and taxonomy version, factor-set version, language and generation timestamp (NFR-22).
6. **Re-download survives a downgrade, a lapse or a suspension**: new exports are blocked, previous documents stay downloadable (FR-104; UC-142 step 3; UX-54).
7. S-11 lists the history with the pinned version visible (task 47.3). **An artefact and its history entry are kept for the life of the organization plus one year**, like report content, and are not removed at 24 months (`architecture.md` §12.5.7 as amended; §12.5.6 task-182 data-subject requests row, 182/126). The status a report takes once it has been exported: (the report's status is not changed by an export, 182/19; FR-41).

**Refusals.** Suspension blocks new exports and nothing else (FR-104). View-only → 403 `insufficient-role` (182/22). Unknown report → 404 `not-found`.

**Boundaries.** The record of a migration is FR-69's. The adoption count of exports is FR-83's.

**Acceptance criteria.**
- **AC-1** Given an export, then it is recorded with format, language, taxonomy version, timestamp and generating user. *(source: FR text; UX-49)* Unmet until 47.1.
- **AC-2** Given a history entry, then it cannot be altered. *(source: FR text)* Unmet until 47.1.
- **AC-3** Given an export, when its data later changes and it is re-downloaded, then the file is the original, byte for byte. *(source: FR text; UC-44; task 47.1)* Unmet until 47.1.
- **AC-4** Given an export, then its file carries entity, period, template and taxonomy version, factor-set version, language and generation timestamp. *(source: NFR-22)* Unmet until 44.2, 46.1.
- **AC-5** Given a downgrade, lapse or suspension, then previously generated documents remain downloadable and new exports are blocked. *(source: FR-104; UC-142)* Unmet until 47.3.
- **AC-6** Given the history, then each entry's pinned version is visible. *(source: task 47.3; UX-49)* Unmet until 47.3.
- **AC-7** Given an export, then the file and its history entry are kept for the life of the organization plus one year. *(source: §12.5.6 task-182 data-subject requests row, 182/126)* Held while nothing removes them; no task yet removes them when that period ends.
- **AC-7** Given a view-only member, then the history and a re-download are refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 47.1.
- **AC-8** Given a completed export, then the report's status is unchanged. *(source: §12.5.6 task-182 validation row, 182/19)* Unmet until 47.1.

**History.**
- 29 Aug 2026 · project owner · there is no report snapshot table: the lock and the retained distributed file carry the guarantee that an export and a locked report cannot disagree · §12.5.6 task-31.4 row
- 5 Oct 2026 · project owner · an export is kept for the organization's life plus one year, replacing 24 months and *regenerable*, because regeneration cannot promise the original bytes · §12.5.6 task-182 data-subject requests row (182/126)
- 5 Oct 2026 · project owner · an export does not change the report's status; `filed` is the reporter's own act · §12.5.6 task-182 validation row (182/19)
- 5 Oct 2026 · project owner · an editor or the OA reads the history and re-downloads; a view-only member does neither · §12.5.6 task-182 validation row (182/22)

## 4. Traceability (index §3.11)

### FR-54 — Who changed a field, when, and from what

**Status.** Partial — delivered 14, 30.3 (one reader), 34.1, 38.1 · remaining 84.1, 84.2

**Obligation.** The system shall record, per field, who changed a value, when, and what the previous value was.

| | |
|---|---|
| **Actors** | Recorded for every write, whoever makes it. An editor or the OA reads the trail; a view-only member does not (182/22). |
| **Traces** | UC-47 · P-11 · DR-6 · NFR-7, NFR-35 · UX-68 · AD-14 constraint 5 · FR-55, FR-159 · entity *Field change record* |
| **Surfaces** | S-12 (the Panel) · S-07 (the field's history entry point) · S-05 and S-13 (record-level history) · `GET /organization` (`updatedBy`) |

**Behaviour.**
1. **Capture is a database trigger.** `core.capture_field_change` runs `AFTER INSERT OR UPDATE OR DELETE` on each audited table, so no application path can skip it and a plain `UPDATE` written later cannot bypass it. The function is `SECURITY DEFINER`: the application role holds `SELECT` on `core.field_change` and no `INSERT`, and the table is append-only and partitioned by year (task 14).
2. One row per changed column: the table, the record's id, the field's name, the old and new value (as text), the operation, the instant (`timestamptz`) and the actor taken from the request's session. `updated_at` is not recorded.
3. **Audited**: organization, relationship, reporting entity, site, consolidation member, period, report, disclosure value, derivation input, invoice line (`calc_source`), membership and invitation. A gate requires every tenant table to be either audited or listed unaudited with its reason, and every audited table to carry the trigger (`schema-invariants`).
4. **Not audited, with reasons**: the immutable record tables (entity snapshot, period reopening, calculation run, input and result), whose writing is the record; the audit tables; the trail itself; and the account's name columns, because FR-54 and FR-55 govern disclosure attribution inside an organization and a person's edits to their own profile are not that (task 139, 12 Sep 2026).
5. The disclosure value table has a surrogate id so the trigger has a subject; a composite key would have raised on every write (§12.5.6 task-34.1 row). Any disclosure field is covered (FR-54's acceptance).
6. A change by an account since erased still states the field and the moment: the actor is nullable and its name a left join (task-30.3 row; task 84.1).
7. The trail is the reconciliation record for last-write-wins autosave (FR-37).
8. **One reader exists today**: `GET /organization` answers `updatedBy` from the newest row for the record, not from a column the application maintains (task-30.3 row). The trail's own read and screen are tasks 84.1 and 84.2. That attribution is a single line served to every member and is not the trail: the trail's read admits an editor or the OA, and refuses a view-only member with 403 `insufficient-role` (182/22).
9. S-12 is a Panel: who, when and the previous value per field, reachable from the field itself and not only from an audit screen (UX-68). The old and new values it shows are user-facing text: no internal key or enum member reaches it (task 84.2).

**Refusals.** Another organization's records read as absent, by the same row-level policy as the rows they describe.

**Acceptance criteria.**
- **AC-1** Given a change to any audited record, then a trail row holds the actor, the instant and the previous value, written by the database in the same statement. *(source: FR text; task 14; §12.5.6 task-34.1 row)*
- **AC-2** Given the application role, then it can read the trail and cannot insert, alter or delete a row of it. *(source: task 14 build-log; `architecture.md` AD-14 constraint 5)*
- **AC-3** Given a tenant table, then it is audited or declared unaudited with a reason, and every audited table carries the trigger. *(source: task 14; `schema-invariants.e2e-spec.ts`)*
- **AC-4** Given a change by an account since erased, then the entry still states the field and the moment. *(source: §12.5.6 task-30.3 row)* Unmet until 84.1 for the screen.
- **AC-5** Given a disclosure field with changes, then S-12 lists, for each, who changed it, when and the previous value. *(source: FR text; design_spec.md S-12)* Unmet until 84.1, 84.2.
- **AC-6** Given a field, then its history is reachable from the field. *(source: UX-68)* Unmet until 84.2.
- **AC-7** Given the old and new values, then they read in the reader's language with no internal identifier. *(source: task 84.2; user-facing text rule)* Unmet until 84.2.
- **AC-8** Given a view-only member, when they read a field's trail, then it is refused with 403. *(source: §12.5.6 task-182 validation row, 182/22)* Unmet until 84.1.

**History.**
- 20 Aug 2026 · project owner · capture is a trigger, not an application function · `architecture.md` AD-14 constraint 5 amended, §12.3; task 14
- 29 Aug 2026 · project owner · attribution on a record is read from the trail, not from a column; the trail's screen gets its own task, 84 · §12.5.6 task-30.3 row
- 1 Sep 2026 · project owner · the disclosure value table takes a surrogate id so it can be audited · §12.5.6 task-34.1 row
- 12 Sep 2026 · project owner · the account's name columns carry no trail · build-log task 139
- 1 Oct 2026 · project owner · the invoice lines are audited and the immutable run records are not · task 38.1 (`schema-invariants`)
- 5 Oct 2026 · project owner · an editor or the OA reads the trail; a view-only member does not · §12.5.6 task-182 validation row (182/22)

### FR-55 — Attribution survives removal of access

**Status.** Partial — delivered 14, 25.1, 25.2, 26.4 · remaining 84.1, 84.2

**Obligation.** The system shall retain historical attribution after a user's access to the organization is removed, so that revoking access never erases the audit trail.

| | |
|---|---|
| **Actors** | OA removes (FR-59). An editor or the OA reads the trail (FR-54; 182/22). |
| **Traces** | UC-47, UC-63 · UX-69, UX-70 · D-13 · FR-54, FR-59 · entity *Field change record* |
| **Surfaces** | S-16 (the removal dialogue) · S-12 |

**Behaviour.**
1. The trail's actor column holds no foreign key to the account, so the attribution survives the account itself; a gate asserts it (task 14).
2. **Removal is a status change, and no runtime role holds `DELETE` on a membership.** The membership's own history (who held which role, granted by whom, and when access was withdrawn) is kept as well (`architecture.md` §6.5; task 25.1).
3. A removed member's sessions are not revoked: the role and the active organization are re-read on every request, so the next request finds no active membership and is refused (task 25.2). Their other organizations are untouched.
4. **The dialogue says so at the point of removal**: what they entered stays in the change history, attributed to them (UX-69; task 26.4).
5. The account continues to exist; their contributions stay attributed (UC-63).

**Refusals.** Removing the only administrator → 409 `last-administrator` (FR-59). An already-removed member → 404 `not-found`.

**Acceptance criteria.**
- **AC-1** Given a member removed under FR-59, then their earlier changes remain attributed in the trail. *(source: FR text; UC-63)*
- **AC-2** Given the removal dialogue, then it states that what the member entered stays attributed. *(source: UX-69; task 26.4)*
- **AC-3** Given the trail, then its actor column has no foreign key to the account. *(source: task 14 build-log)*
- **AC-4** Given a membership, then no runtime role can delete it. *(source: task 25.1)*
- **AC-5** Given a removed member's changes, then the history screen still names them. *(source: UX-69; design_spec.md S-12)* Unmet until 84.1, 84.2.

**History.**
- 5 Oct 2026 · project owner · who reads the trail: an editor or the OA · §12.5.6 task-182 validation row (182/22)

## 5. Business rules held in this part

Moved from the index's §4.1 on 5 Oct 2026 (task 182), with their identifiers and statements unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-VAL-1 | Field validation resolves to exactly one of `OK`, `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR`, `INVALID URL`, or the declared-not-available state. | FR-40, FR-32 |
| BR-VAL-2 | Rollup discounts sections declared omitted as classified or sensitive information, so a legitimate omission does not depress completion. | FR-41, FR-31 |
| BR-VAL-3 | Validation is idempotent and runnable at any completeness level; it is a drafting tool, not only a pre-export gate. | FR-43 |
| BR-VAL-4 | Export is permitted with unresolved findings after an explicit warning; gaps are marked visibly in the output, never omitted silently. The api requires the acknowledgement the warning collects (amended 5 Oct 2026, §12.5.6 task-182 validation row, 182/20). | FR-44 |
| BR-VER-2 | A report is never exported against a version it was not prepared under; the choice is migrate or export against the original with an explicit notice. | FR-51 |

## 6. Entities held in this part

Moved from the index's §5.2 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Field change record | Acting user (held without a foreign key, so it survives the account), timestamp, previous value; as built also the new value, the table, record and field, and the operation | FR-54, FR-55, FR-159 |
| Validation finding | Rule, state, affected field, message; replaced on each run; the only home of a verdict, and exempt from the report lock because it is derived (182/17, 182/21) | FR-40, FR-42, FR-43, FR-73 |
| Export record | Format, language, taxonomy version (and the template version, task 47.1), timestamp, generating user, immutable artefact | FR-53, FR-49, FR-50 |
