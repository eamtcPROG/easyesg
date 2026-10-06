# Functional requirements — Part 5: Localization, taxonomy, rules and platform administration

Part 5 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.13 Localization and content | FR-61 … FR-64 |
| 3.14 Taxonomy and versioning | FR-65 … FR-70 |
| 3.15 Rules and factors | FR-71 … FR-74 |
| 3.16 Platform administration | FR-75 … FR-83 |

Business rules held here: BR-VER-1, BR-VER-3, BR-ID-6, BR-ACC-6 (§5). Entities held here: §6.

**Who operates the console.** Every operation in §1 … §4 below that names PA is an admin-realm route. It is refused to a caller without a live console session (401 `authentication-required`, or `session-expired` once a clock has run), to a tenant bearer (the tenant guard stands aside for the realm, and the realm's guard finds no console cookie), and to a session whose role the route does not name (403 `insufficient-role`). A state-changing request is written to the system audit log under the action its route declares (FR-81). The Platform Administrator (PA) operates this part. The Billing Operator (BO) shares the realm's credential and A-19 and holds no platform power (`architecture.md` §12.5.6's task-67.3 and task-67.4 rows (1)). The blocks below say *PA* for this rule rather than restating it.

**Where wording lives.** FR-61 … FR-64 and FR-73 are bound by OQ-43 (`architecture.md`, closed 19 Aug 2026): text divides by who is blocked waiting on a release. Application chrome, VSME disclosure labels and help text, units, validation finding messages and notification wording are **committed message catalogues** that ship with the release. Help-centre articles and plan presentation copy are **versioned configuration**. Every non-text artefact (thresholds, factor sets, rule definitions, effective dates, notification behaviour) is configuration and is untouched by that line.

## 1. Localization and content (index §3.13)

### FR-61 — Help-centre articles and plan copy as versioned data

**Status.** Not started — remaining 53.3 (plan presentation copy), 67.5 (A-03's editor), 76 (76.1 … 76.5, the published read path). The substrate is built: task 16's generic store, with immutable versions, publish and revert, already serves other artefacts.

**Obligation.** The system shall hold help-centre articles and plan presentation copy, the text edited by people who cannot deploy, as versioned data editable through an administrative console, so that a wording correction by support or marketing reaches users without a release.

| | |
|---|---|
| **Actors** | PA edits (A-03). A visitor or a signed-in user reads published content. |
| **Traces** | UC-71 · UC-180, UC-181 (the readers) · NFR-12, NFR-85 · AD-4 · OQ-43, OQ-44 · entity *Content string* |
| **Surfaces** | A-03 · S-32, S-33 · the `platform/content` module · no route exists yet |

**Inputs.** A content string: key, locale, value and version (§6, *Content string*).

**Behaviour.**
1. Two kinds of text are rows: help-centre articles and plan presentation copy. Field labels, help text, validation messages, notification wording and the application chrome are not rows. They are catalogues in `packages/i18n` (OQ-43).
2. Content is published-only by construction: what the store holds as in force is the only thing a reader can address, so a draft has no address (task-76 row).
3. Each of the three locales is authored separately. None is machine-translated, and editorial sign-off is recorded per locale per publication (NFR-23; task-67.5 row).
4. Readers reach published content through the public API. `apps/web` does not read the store around it (DR-11, AD-9; task 76.3).
5. The read side is a module of its own, `platform/content`, apart from `platform/configuration`, which owns the store mechanism and knows nothing of any artefact's meaning (OQ-44).
6. The unauthenticated read of published content is limited as generic unauthenticated traffic: the unauthenticated budget of 60 requests a minute per IP at the edge, with 429 beyond it, named for the route in `architecture.md` §12.5.6's limits table. It is not an authentication path (the window of 5 attempts in 15 minutes), and it does not take the webhook bucket (182/45).

**Effects.** A content publication is a platform event for the system audit log (FR-81).

**Boundaries.** Publishing is FR-62's. The runtime fallback is FR-64's. Whether the terms of service, privacy notice and cookie policy are FR-61 content is task 75.1's decision: FR-61 as narrowed names help-centre articles and plan copy and not legal documents (task-75.1 row). Who seeds the first rows is task 76.5's.

**Acceptance criteria.**
- **AC-1** Given a help-centre article or a plan description edited in the console and published, then users read it with no deployment. *(source: FR text; NFR-85)* Unmet until 67.5 and 76.
- **AC-2** Given a version that is not published, then no address serves it. *(source: task-76 row)* Unmet until 76.1.
- **AC-3** Given a published article and a plan description, then each is readable in the three locales through the public API by a caller with no session. *(source: task-76 row, Expected result)* Unmet until 76.
- **AC-4** Given a correction to a field label, a validation message or a notification text, then it ships with a release, and the console offers no editor for it. *(source: OQ-43; A-03's purpose)* Unmet until 67.5.
- **AC-5** Given an unauthenticated caller who reads published content more than 60 times a minute from one address, then the excess is answered 429, and a reader who opens four articles in a minute is not refused. *(source: §12.5.6 task-182 content row, 182/45)* Unmet until 76.4.

**History.**
- 19 Aug 2026 · architecture.md OQ-43 · narrowed from *field labels, help text and validation messages* to help-centre articles and plan presentation copy; the rest ships as committed catalogues · `architecture.md` OQ-43; FR-61 row
- 24 Aug 2026 · project owner · the read side is `platform/content`, a module of its own · `architecture.md` OQ-44
- 5 Oct 2026 · project owner · the public read is limited as generic unauthenticated traffic, 60 a minute per IP · §12.5.6 task-182 content row (182/45)

### FR-62 — Publish a reviewed content set, all tenants at once

**Status.** Not started — remaining 67.14 (the multi-slot publication), 67.15 (drafts, review and sign-off), 67.5, 76. The publish and revert mechanism for one slot is task 16's and is built.

**Obligation.** The system shall publish a reviewed set of the content held under FR-61 as an explicit, versioned and reversible step taking effect across all tenants at once, so that a half-finished translation is never live. Catalogue wording is not published by a step: it is published by deploying the release that contains it, and a half-finished catalogue is prevented at build time (FR-64).

| | |
|---|---|
| **Actors** | PA publishes and reverts. |
| **Traces** | UC-72 · UX-123 · NFR-23, NFR-85 · AD-4, DR-3 · OQ-43 · entity *Translation set publication* |
| **Surfaces** | A-03 (the publish surface) · A-08 (the log) |

**Behaviour.**
1. Publication is one transactional action that writes a new immutable version and moves a pointer. Revert moves the pointer back to a version that exists and was never altered (AD-4; NFR-85's single step).
2. A published version cannot be edited, and the version it replaces is superseded and not deleted (AD-4, DR-3).
3. A publication reaches every replica within the store's poll interval of at most 5 seconds (AD-4).
4. The publish surface follows UX-123: preview, scope disclosure (how many organizations and reports are affected), confirm, progress, result, revert (A-03).
5. Editorial sign-off is recorded per locale per publication (NFR-23; task-67.5 row).
6. A reviewed set is several slots of the store (each help-centre article or plan-copy item is a slot) published by **one transaction**: the set takes effect whole or not at all, and every version it writes records the same set identifier. **Revert stays per item**: it moves one slot's pointer back and leaves the rest of the set in force (182/36).
7. Before publication an edit lives in the store as a **draft**, a version with no schedule entry and therefore no address. Review moves it to **in review**, and publication to **published** (AD-4). The editorial sign-off of item 5 is a field of the publication, one for each locale (182/37).

**Effects.** The publication enters the system audit log as a content publication (FR-81).

**Boundaries.** What is published is FR-61's content only. The wording of a catalogue is not (OQ-43).

**Acceptance criteria.**
- **AC-1** Given an edit to FR-61 content, then it is not live until it is published. *(source: FR text; UC-72)* Unmet until 67.5.
- **AC-2** Given a publication, then it applies to all tenants at once. *(source: FR text; UC-72)* Unmet until 67.5.
- **AC-3** Given a publication, when it is reverted, then the prior version is in force again in one step. *(source: FR text; AD-4; NFR-85)* Unmet until 67.5.
- **AC-4** Given a published version, then it cannot be changed. A correction is a successor version. *(source: AD-4; `config.reject_published_edit`)*
- **AC-5** Given a publication, then the publish surface discloses how many organizations and reports it reaches before the operator confirms. *(source: UX-123; A-03)* Unmet until 67.5.
- **AC-6** Given a publication, then the system audit log records who published it and when. *(source: FR-81; UC-88)* Unmet until 67.5.
- **AC-7** Given a set of several items, when any one of them cannot be written, then none of them takes effect. *(source: §12.5.6 task-182 content row, 182/36)* Unmet until 67.14.
- **AC-8** Given a published set, then every version it wrote carries the same set identifier, and reverting one item leaves the others of the set in force. *(source: §12.5.6 task-182 content row, 182/36)* Unmet until 67.14.
- **AC-9** Given an edit not yet published, then it is stored as a draft with no address, and then as in review, and the publication records the sign-off of each locale. *(source: §12.5.6 task-182 content row, 182/37)* Unmet until 67.15.

**History.**
- 19 Aug 2026 · architecture.md OQ-43 · scope follows FR-61 as narrowed; catalogue wording is published by deploying the release, and a half-finished catalogue is stopped by the key-parity gate · `architecture.md` OQ-43; FR-62 row
- 5 Oct 2026 · project owner · a reviewed set is several slots published in one transaction with a set identifier, revert per item; drafts and review live in the store, sign-off per locale on the publication · §12.5.6 task-182 content row (182/36, 182/37)

### FR-63 — A locale is registered by authoring its catalogue

**Status.** Partial — delivered 6 (the registry, the three catalogues, the +40% harness) · remaining 67.5 (A-03's registration control), 67.16 (the registry reads the registration), 73.8 (the fourth-locale rehearsal)

**Obligation.** The system shall allow an additional interface and export locale to be registered and populated without redesigning any screen, route or schema, with **Romanian (source), English and Russian live at MVP**, each separately authored and never machine-translated, and no architectural limit. A new locale is a catalogue file plus a build.

| | |
|---|---|
| **Actors** | PA registers (A-03). A translator authors the catalogue. |
| **Traces** | UC-73, UC-14, UC-48 · NFR-4, NFR-23, NFR-25 · OQ-42, OQ-43 · entity *Locale registration* |
| **Surfaces** | A-03 · `apps/web`'s `[locale]` segment · `packages/i18n`'s registry (`LOCALES`) · the `locale_registration` artefact |

**Behaviour.**
1. Three locales are live: `ro` (the source), `en` and `ru` (NFR-23, ratified 18 Aug 2026).
2. Adding a locale is authoring its catalogue and rebuilding. It needs no schema change, no route change and no per-locale branch in application code (NFR-25).
3. The console's own interface ships in Romanian only, ready for more, and has no locale segment in its URLs (OQ-42).
4. A registration records which locales are offered for interface and export. The registry itself is `packages/i18n` (§6, *Locale registration*; AD-4's artefact table).
5. Whether EFRAG publishes a translation of a VSME label is a property of each `(taxonomy version, locale)` and not of a locale alone (task-33.2 rows).
6. A locale is offered only when both hold: its catalogue is in the build (`packages/i18n`'s registry) and its registration is published in the store. A built locale with no published registration is not offered, and a registration with no catalogue behind it is not offered either (the parity suite also fails, AC-5). Whether EFRAG translates a VSME label is `standing.json`'s, per taxonomy version and locale (item 5), so the registration carries no flag for it (182/46).

**Configuration-held values.** `locale-registration.global.json`: `ro` (source), `en` and `ru`. The artefact today also carries an `efragTranslation` flag on each, which duplicates `standing.json`, and 67.16 removes it. Nothing in the running application reads the artefact today; one end-to-end spec does.

**Boundaries.** Interface language is FR-10's. Export language is FR-52's. Email language is FR-169's. They are selected independently (UC-14).

**Acceptance criteria.**
- **AC-1** Given a member, then the interface can be set to Romanian, English or Russian. *(source: FR text; NFR-23; UC-14)*
- **AC-2** Given a fourth locale whose catalogue is authored and built, then it appears with no schema change, no route change and no per-locale branch in code. *(source: FR text; NFR-25)* Unmet until 73.8, the staging rehearsal NFR-25 names.
- **AC-3** Given the English or Russian text of any publication, then it is separately authored and signed off, not machine-translated. *(source: FR text; NFR-23)*
- **AC-4** Given the console, then it renders in Romanian with no locale in its URLs. *(source: OQ-42)*
- **AC-5** Given a locale added to the registry with no catalogue behind it, then the parity suite fails. *(source: FR-64; OQ-43)*
- **AC-6** Given a locale whose catalogue is in the build and whose registration is published, then it is offered. Given either one missing, then it is not. *(source: §12.5.6 task-182 content row, 182/46)* Unmet until 67.16.

**History.**
- 18 Aug 2026 · project owner · Romanian, English and Russian live at MVP, Russian separately authored · `architecture.md` §17.1 and OQ-3; NFR-23; `actors.md` OQ-9
- 19 Aug 2026 · architecture.md OQ-43 · a new locale is a catalogue file plus a build, not a pure configuration task; the property NFR-4 protects is kept · `architecture.md` OQ-43; FR-63 row; NFR-25 amended
- 19 Aug 2026 · architecture.md OQ-42 · the console ships Romanian only, i18n-ready · `architecture.md` OQ-42
- 5 Oct 2026 · project owner · a locale is offered when its catalogue is built and its registration published; the `efragTranslation` flag is dropped; the fourth-locale rehearsal gets a task row · §12.5.6 task-182 content row (182/46)

### FR-64 — No untranslated key reaches a user

**Status.** Partial — delivered 6, 33.2 · remaining 76.6 (the queue's store), 67.5 (the queue's screen), 76.2 (the runtime fallback for FR-61 content)

**Obligation.** The system shall prevent an untranslated key from reaching a user, by a build-time parity gate for catalogue text and a reviewable runtime fallback queue for the content held under FR-61.

| | |
|---|---|
| **Actors** | The build refuses. PA works the queue (A-03). A user sees the fallback and nothing else. |
| **Traces** | UC-74, UC-14 · UX-97 · NFR-91 · OQ-43 · entity *Fallback log entry* |
| **Surfaces** | `pnpm test` in `packages/i18n` and `apps/web` · A-03's queue · `FallbackReporter` |

**Behaviour.**
1. **Catalogue text.** Every locale's catalogue is present at build time. A key in the source catalogue (`ro`) and absent from another locale fails the build (OQ-43). The same comparison runs over `packages/i18n`'s shared catalogues, over each taxonomy version's disclosure catalogues and over `apps/web`'s messages.
2. UX-97 prohibits a visible *missing translation* marker, so a missing key is invisible at runtime. For that reason the parity suite also refuses a key present in a translation and absent from the source, and an empty value (`packages/i18n/src/parity.ts`).
3. **FR-61 content.** Where a translation is absent, the reader is served the source-locale text without decoration, and the gap is reported per key (UC-14; UX-97). A catalogue gap never takes this path. The fallback is for FR-61 content only (task 76.2).
4. The reporting seam is `FallbackReporter`. The queue behind it is not built (`packages/i18n/src/fallback-reporter.ts`).
5. The queue holds **one row per key and locale**, with when it was first seen, when it was last seen and a count of occurrences. A row leaves the queue when a published translation exists for that key and locale (182/38).

**Boundaries.** The alert on locale-fallback spikes is NFR-91's, an operational alert. FR-63 owns how a locale is added.

**Acceptance criteria.**
- **AC-1** Given a key in the Romanian catalogue and absent from the English or the Russian one, then the build fails. *(source: FR text; OQ-43)*
- **AC-2** Given a translation that carries a key the source lacks, then the build fails. *(source: FR-63; `packages/i18n/src/parity.ts`)*
- **AC-3** Given FR-61 content with no translation in the chosen locale, then the reader sees the source-locale text with no marker, and the key is added to the review queue. *(source: FR text; UX-97)* Unmet until 76.2 and 76.6.
- **AC-4** Given the review queue, then PA sees each key that fell back, with its locale. *(source: UC-74; §6, *Fallback log entry*)* Unmet until 67.5 and 76.6.
- **AC-5** Given a catalogue gap, then it is stopped before release and never reaches the runtime queue. *(source: OQ-43)*
- **AC-6** Given a key and locale already in the queue, when it falls back again, then that row's last-seen time and count move and no second row appears. Given a published translation for that key and locale, then the row leaves the queue. *(source: §12.5.6 task-182 content row, 182/38)* Unmet until 76.6.

**History.**
- 19 Aug 2026 · architecture.md OQ-43 · catalogue gaps fail the build; the runtime queue remains for FR-61 content only · `architecture.md` OQ-43; FR-64 row
- 5 Oct 2026 · project owner · the queue is one row per key and locale with first seen, last seen and a count, cleared when a published translation exists · §12.5.6 task-182 content row (182/38)

## 2. Taxonomy and versioning (index §3.14)

Registering a version and authoring a mapping write configuration. A migration run is a worker job over report data (`architecture.md` §11.5; AD-10). None of them is a schema migration (NFR-86). The console for all six requirements is A-04, whose rows are 67.6 and 67.7 and are `TODO`. **The api half has rows of its own** (§12.5.6 task-182 tracking row, 182/160): 67.21 registers a version and authors a mapping, 67.22 lists exposure, 67.23 starts and reads a migration run, and 67.24 is the run's worker job, a sub-step of its own because AD-10 keeps it off the request tier. Each is ahead of the console row over it, as 67.9 and 67.11 were built, because DR-11 and AD-9 require the console to be an ordinary client of the public API.

### FR-65 — Register a template and taxonomy version

**Status.** Partial — delivered 31.1, 33.1, 33.3 · remaining 67.17 (the determination held per pair), 67.21 (the api), 67.6 (the console's registration)

**Obligation.** The system shall allow a new VSME Digital Template or XBRL taxonomy version to be registered from its committed artefact, with an explicit backwards-compatibility determination recorded for the pair it forms with the version before it, and pinned by periods opened from that point forward.

| | |
|---|---|
| **Actors** | PA registers (A-04). A period opened afterwards pins the version its adoption names. |
| **Traces** | UC-75 · NFR-3, NFR-86 · DR-4, AD-3, AD-4 · R-7 · OQ-45 · BR-VER-1 · entity *Template / taxonomy version* |
| **Surfaces** | A-04 · the `vsme_taxonomy`, `vsme_*_classification` and `reporting_taxonomy` artefacts · `TAXONOMY_REGISTRY` |

**Inputs.** The version's identifier, EFRAG's own release identifier verbatim (`YYYY-MM-DD`; OQ-45). The artefact (UC-75 step 2), which is **committed in the release under `config/efrag/` and registered, not uploaded** (182/48). The compatibility determination (UC-75 step 3), which is **not a property of the version but of a pair of versions**: it is recorded with the FR-67 mapping for that pair, and FR-69 reads it to choose bulk or report-by-report (182/39).

**Behaviour.**
1. The identifier is EFRAG's release identifier and not a platform sequence. It sorts chronologically as text, and it is the configuration scope of the registered version, so every registered version stays readable by name (OQ-45; DR-4).
2. The shipped artefacts are **extracted from EFRAG's package, never authored** (`tools/extract-vsme-taxonomy.mjs`). Two versions are registered from day one, `2026-02-01` and `2026-05-01`, so the version dimension is exercised continuously (R-7; task-33.3 rows).
3. Registering writes configuration and is not a schema change or a change to application code (NFR-86 as amended 5 Oct 2026; `architecture.md` §11.5). A new version's labels, which are committed catalogues (OQ-43), and its generated typed facade (`packages/vsme`) ship in a content release; that is not a code change in NFR-86's sense (182/47).
4. **Registering is not adopting.** Which version a new period pins is the separate effective-dated artefact `reporting_taxonomy`, because the date EFRAG publishes a release and the date this platform adopts it are different facts (OQ-45). The adoption boundary is the fiscal year: a period starting before 1 Jan 2026 pins `2026-02-01`, and one starting on or after it pins `2026-05-01` (task-33.3 row).
5. The seed loader refuses to reshape an adoption schedule already in force. Reshaping one is an operator action with a revert path (NFR-85; task-33.3 row).
6. Periods already open keep their pin (FR-66).
7. A-04 registers a version whose artefacts are committed in the release; it uploads nothing. The extractor stays an offline script that asserts and fails loudly on a shape it does not know (`tools/extract-vsme-taxonomy.mjs`), and is not put behind an upload (182/48).
8. Registering a version and changing the adoption schedule are **two actions** in the system audit log (FR-81), because registering is not adopting (OQ-45) and either can be what an operator is asked about (182/52).

**Refusals.** No version is registered at all → a period cannot be opened: 409 `taxonomy-version-unavailable` (`core.period.taxonomy_version_unavailable`).

**Configuration-held values.** `reporting-taxonomy.vsme.json`: two windows, `validTo 2026-01-01` → `2026-02-01` and `validFrom 2026-01-01` → `2026-05-01`, each carrying `compatibleWith: null`, which nothing reads and which 67.17 removes, the determination being held per pair (182/39).

**Boundaries.** The mapping between two versions is FR-67's. The labels of a version are committed catalogues in a per-version directory (OQ-43; `architecture.md` §9.4).

**Acceptance criteria.**
- **AC-1** Given a registered version, then it is readable by its identifier for as long as the platform runs. *(source: OQ-45; DR-4)*
- **AC-2** Given the two shipped windows, then a period starting before 1 Jan 2026 pins `2026-02-01`, and one starting on or after it pins `2026-05-01`. *(source: §12.5.6 task-33.3 row)*
- **AC-3** Given a version registered and adopted, when a period is opened afterwards, then it pins that version. A period already open keeps its own. *(source: FR text; §12.5.6 task-31.3 row)* Registration through the console is unmet until 67.6.
- **AC-4** Given two registered versions, then the pair carries an explicit backwards-compatibility determination, recorded with its mapping, and the adoption artefact carries none. *(source: FR text; UC-75 step 3; §12.5.6 task-182 content row, 182/39)* Unmet until 67.17 and 67.6.
- **AC-5** Given a backwards-compatible version, then it is registered and rolled out with no change to application code, its labels and typed facade shipping in a content release. *(source: NFR-86 as amended; §12.5.6 task-182 content row, 182/47)* Unmet until 73.6's rehearsal.
- **AC-6** Given no registered version, when a period is opened, then it is refused with 409. *(source: §12.5.6 task-89 row)*
- **AC-7** Given an artefact committed under `config/efrag/` and not yet registered, when an operator registers it in A-04, then the version is registered and nothing is uploaded. *(source: §12.5.6 task-182 content row, 182/48)* Unmet until 67.6.
- **AC-8** Given a version registered and, separately, the adoption schedule changed, then the system audit log holds two different actions. *(source: §12.5.6 task-182 content row, 182/52)* Unmet until 67.6.

**History.**
- 29 Aug 2026 · project owner · the identifier is EFRAG's own release identifier; adoption is a separate effective-dated artefact · `architecture.md` OQ-45
- 31 Aug 2026 · project owner · a report's pin is copied from its period · §12.5.6 task-31.3 rows
- 1 Sep 2026 · project owner · two versions registered from day one; the adoption boundary is the fiscal year · §12.5.6 task-33.3 rows
- 5 Oct 2026 · project owner · the determination is held per pair of versions with the mapping; a version's labels and facade ship in a content release and NFR-86 reads "no code change"; artefacts are committed and registered, not uploaded; registering and adopting are two audit actions · §12.5.6 task-182 content row (182/39, 182/47, 182/48, 182/52)

### FR-66 — Every report stores its template and taxonomy version

**Status.** Built — delivered 31.1, 31.3, 33.1, 33.3, 89

**Obligation.** The system shall store an explicit template and taxonomy version against every report. The pair is determined when the period is opened, copied to the report when it is created, and moved only by an explicit migration.

| | |
|---|---|
| **Actors** | Every member of the organization reads the pair. No request-tier caller writes it. |
| **Traces** | UC-56, UC-75 · NFR-3 · DR-4, DR-6, P-4 · BR-VER-1 · entities *Report*, *Reporting period* |
| **Surfaces** | `templateVersion`, `taxonomyVersion` on `GET /reports`, `GET /reports/{id}` and the period reads · S-06 and S-14 |

**Behaviour.**
1. The period is where the version is **determined**, by the adoption schedule at the period's start. The report is where it is **stored**. The report's pair is copied from its period when the report is created and is never resolved a second time (§12.5.6 task-31.3 row).
2. `pinFor()` is the only resolver of a pin anywhere, and `max(registeredVersions)` appears nowhere (task-31.3 row).
3. `esg_app` holds `UPDATE` on every `core.report` column except `template_version` and `taxonomy_version`. A schema invariant asserts that exception list in both directions (task-31.3 row). FR-69's run is the explicit act that may move a pin.
4. A report pinned to a version the registry no longer holds fails explicitly. Saved answers stay intact (task-89 row).
5. A comparative says which two versions produced it (task 34.3).

**Refusals.** A report whose own version is gone → 500 `taxonomy-version-unavailable` (`core.report.taxonomy_version_unavailable`). It is not a 404, because nothing the caller sent is wrong (task-89 row).

**Acceptance criteria.**
- **AC-1** Given any report, then it exposes the template version and the taxonomy version it is pinned to. *(source: FR text; NFR-3)*
- **AC-2** Given a report created for a period, then its pair equals the period's pair at creation. *(source: §12.5.6 task-31.3 row)*
- **AC-3** Given the request tier, when it tries to update either column, then the database refuses. *(source: §12.5.6 task-31.3 row; P-4)*
- **AC-4** Given an adoption registered after a report was created, then that report's pair does not change. *(source: FR-65; §12.5.6 task-31.3 row)*
- **AC-5** Given a report pinned to a withdrawn version, when its step is read, then the answer is 500 and the saved answers are intact. *(source: §12.5.6 task-89 row)*

**History.**
- 29 Aug 2026 · project owner · the registry was built ahead of the report table that pins it · §12.5.6 task-31 row
- 31 Aug 2026 · project owner · the report copies its period's pin; the request tier cannot move it, by column privilege · §12.5.6 task-31.3 rows
- 1 Sep 2026 · project owner · a report pinned to a withdrawn version fails explicitly · §12.5.6 task-89 row

### FR-67 — Author the field mapping between two versions

**Status.** Not started — remaining 67.17 (the determination held per pair), 67.21 (the api), 67.22 (the exposure read), 67.6

**Obligation.** The system shall allow the field mapping between an outgoing and an incoming version to be authored deliberately, covering added, removed and semantically altered fields.

| | |
|---|---|
| **Actors** | PA authors (A-04). |
| **Traces** | UC-76 · NFR-3, NFR-86 · BR-VER-3 · entity *Field mapping* |
| **Surfaces** | A-04 · a configuration artefact pinned to a version pair |

**Preconditions.** Both versions are registered (UC-76; FR-65).

**Behaviour.**
1. A mapping is authored per field pair. It distinguishes added, removed and semantically altered fields (FR text; UC-76).
2. It is held as configuration, pinned to the pair of versions it connects (AD-4's artefact table; `architecture.md` §7.5).
3. It is not derived. The February 2026 release carried a backwards-incompatible change that no automatic mapping would have resolved correctly (UC-76).
4. It is the input FR-69 consumes (FR text).
5. A breaking change is confined to mapping content and never to schema (NFR-86).
6. A mapping records each field's **kind alone**: added, removed or semantically altered. It holds no transformation. A field marked altered is never carried by a run automatically; it goes to manual review (FR-69). Transformations, such as converting a unit or mapping a value, can be added as data once the first breaking rollout shows which occur (182/40).
7. The mapping for a pair carries the pair's backwards-compatibility determination, compatible or breaking, which FR-69 reads to choose its mode (182/39). (the api half is 67.21; §12.5.6 task-182 tracking row, 182/160)

**Acceptance criteria.**
- **AC-1** Given two registered versions, then a mapping for the pair can be authored per field pair, marking each as added, removed or semantically altered. *(source: FR text; UC-76)* Unmet until 67.6.
- **AC-2** Given a mapping, then publishing it needs no change to application code and no schema change. *(source: NFR-86 as amended; §12.5.6 task-182 content row, 182/47)* Unmet until 73.6's rehearsal.
- **AC-3** Given a mapping, then FR-69's run takes it as input. *(source: FR text)* Unmet until 67.7.
- **AC-4** Given a mapping, then each field is recorded as added, removed or semantically altered and nothing more, and the pair carries an explicit determination. *(source: §12.5.6 task-182 content row, 182/39, 182/40)* Unmet until 67.17 and 67.6.
- **AC-5** Given a field marked altered, then a run does not carry it without review. *(source: §12.5.6 task-182 content row, 182/40)* Unmet until 67.7.

**History.**
- 5 Oct 2026 · project owner · the mapping records a field's kind alone and every altered field goes to manual review; the determination is held per pair · §12.5.6 task-182 content row (182/39, 182/40)

### FR-68 — The exposure view

**Status.** Not started — remaining 67.22 (the exposure read), 67.6 (UC-77), 67.7 (FR-68)

**Obligation.** The system shall list every report still pinned to a superseded version, grouped by organization and by version, as the exposure view preceding any migration.

| | |
|---|---|
| **Actors** | PA reads (A-04). |
| **Traces** | UC-77 · D-5 · FR-77 · UX-123 |
| **Surfaces** | A-04 |

**Preconditions.** A newer version is registered (UC-77).

**Behaviour.**
1. The list answers how many customers a migration would affect before one is attempted (UC-77).
2. It is grouped by organization and by version (FR text).
3. It carries the blast radius, the number of organizations and reports, that UX-123 requires before any confirmation.
4. It reads no report content (FR-77; D-5).
5. **Superseded** means older than the newest registered version. A report pinned to any registered version other than the newest is listed, so a report of FY2025 pinned to `2026-02-01` appears once `2026-05-01` is registered, which is what lets the view size a migration before it is chosen (182/49).

**Acceptance criteria.**
- **AC-1** Given reports on a superseded version, then the list shows all of them, grouped by organization and by version. *(source: FR text; UC-77)* Unmet until 67.6 and 67.7.
- **AC-2** Given the list, then it shows no report value. *(source: FR-77; D-5)* Unmet until 67.6 and 67.7.
- **AC-3** Given the list, then it states how many organizations and reports it covers. *(source: UX-123; A-04)* Unmet until 67.6 and 67.7.
- **AC-4** Given a report pinned to a registered version other than the newest, then it is listed. Given a report pinned to the newest, then it is not. *(source: §12.5.6 task-182 content row, 182/49)* Unmet until 67.6 and 67.7.

**History.**
- 5 Oct 2026 · project owner · a version is superseded when it is older than the newest registered one · §12.5.6 task-182 content row (182/49)

### FR-69 — Execute a migration run

**Status.** Not started — remaining 67.18 (the worker's right to move a pin), 67.19 (the retained pre-migration state), 67.20 (the organization's acceptance), 67.7, 67.23 (the run's route), 67.24 (the run's worker job)

**Obligation.** The system shall execute a migration run against a selected set of reports, in bulk for a compatible change or report-by-report with manual review for a breaking one, preserving the pre-migration state rather than overwriting in place.

| | |
|---|---|
| **Actors** | PA starts a run (A-04). The worker executes it. For a breaking change, the Organization Administrator of each organization reviews, accepts or declines its own migrated report. |
| **Traces** | UC-78 · NFR-3, NFR-86 · DR-4, AD-10 · UX-123 · BR-VER-3 · entity *Migration run* |
| **Surfaces** | A-04 · a worker job |

**Preconditions.** A mapping exists for the version pair (FR-67), and a report set is selected (FR-68).

**Behaviour.**
1. The run applies the FR-67 mapping to the selected set (FR text).
2. A compatible change proceeds in bulk. A breaking one proceeds report by report, with manual review (UC-78 step 2).
3. The run preserves the pre-migration state and is never an in-place overwrite, so a bad mapping is reversible (`architecture.md` §11.5 step 4).
4. It is enqueued as a worker job over a selected set (`architecture.md` §11.5 step 3; AD-10).
5. Reports not migrated keep their pinned version and continue to export and validate against it (NFR-3; §11.5 step 6).
6. The surface shows the blast radius before confirmation, progress while it runs, a partial result (some migrated, some failed) with a retry per part, and a one-step revert or a documented compensation (UX-123; A-04).
7. Moving a pin is the privilege the request tier lacks, and the executing role holds it (§12.5.6 task-31.3 row). That role is `esg_worker`: one transaction per report, under that report's organization binding, holding `UPDATE` on the two pin columns alone. `esg_admin_ro` is read-only and runs no migration (182/42).
8. A report is migrated **in place**: it stays the same report in the same period (one report per period, FR-177), its pin moves, and its prior values are kept in retained rows, so the pre-migration report can be retrieved and exported under the version it was made under (182/41).
9. Every field the mapping marks as semantically altered goes to manual review (FR-67; 182/40).
10. For a breaking change, the review is the organization's: the Organization Administrator of the organization that owns a migrated report accepts or declines it, notified by FR-70, and declining restores the pre-migration state. The PA starts the run and sees counts and outcomes, never report values, so FR-77 and DD-5 stand (182/43).

**Effects.** A migration run is a platform event for the system audit log (FR-81). The affected organizations are told (FR-70).

**Acceptance criteria.**
- **AC-1** Given a selected set and a mapping, when a run executes, then each report moves to the incoming version by the mapping. *(source: FR text; UC-78)* Unmet until 67.7.
- **AC-2** Given a compatible change, then the run proceeds in bulk. Given a breaking one, then each report is migrated after its own review. *(source: UC-78 step 2; BR-VER-3)* Unmet until 67.7.
- **AC-3** Given a completed run, then each migrated report's pre-migration state is still retrievable. *(source: FR text; UC-78 step 3)* Unmet until 67.7.
- **AC-4** Given a report outside the selected set, then it keeps its pin and still exports and validates against it. *(source: NFR-3; §11.5 step 6)* Unmet until 67.7.
- **AC-5** Given a run in which some reports fail, then the others stay migrated and the failures are listed with a retry for each. *(source: A-04's states)* Unmet until 67.7.
- **AC-6** Given a compatible and a breaking rollout, then both are executed with no change to application code and no schema change. *(source: NFR-86 as amended; §12.5.6 task-182 content row, 182/47)* Unmet until 73.6's rehearsal.
- **AC-7** Given a run, then each report is moved in its own transaction, under its own organization, by `esg_worker`, and the request tier still cannot move a pin. *(source: §12.5.6 task-182 content row, 182/42)* Unmet until 67.18 and 67.7.
- **AC-8** Given a migrated report, then it is the same report in the same period, pinned to the incoming version, and its prior values are retained and retrievable. *(source: §12.5.6 task-182 content row, 182/41)* Unmet until 67.19 and 67.7.
- **AC-9** Given a breaking change, when a report is migrated, then its Organization Administrator is told and may accept or decline it, declining restores the pre-migration state, and the PA sees no value. *(source: §12.5.6 task-182 content row, 182/43)* Unmet until 67.20 and 67.7.

**History.**
- 5 Oct 2026 · project owner · the run is `esg_worker`'s, migrates in place and retains prior values, and a breaking change is reviewed by each organization's administrator · §12.5.6 task-182 content row (182/41, 182/42, 182/43)

### FR-70 — Tell the organizations a version change reaches

**Status.** Not started — remaining 67.6, 67.7 (each raises the notice when it makes its change)

**Obligation.** The system shall notify organizations whose reports were migrated or now require re-export, rather than leaving them to discover it at export time, dispatched per FR-166 and delivered through the notification mechanism (FR-160 … FR-171) rather than shown as an in-product banner alone.

| | |
|---|---|
| **Actors** | The system raises it. The Organization Administrator receives it, in-app and by email. |
| **Traces** | UC-79, UC-171 · FR-166 · NFR-3 |
| **Surfaces** | A-04 · the notification centre (S-26) |

**Behaviour.**
1. A migration run that moves reports to another taxonomy or template version raises the report-update notice to the organizations it reaches (task-67.7 row).
2. A registered version that obliges existing reports to be re-exported with no migration run behind it raises the same notice (task-67.6 row).
3. The notice reaches the Organization Administrator by email as well as in-app (UC-79).
4. Each task registers the notification category it raises (task-49.1 convention in the 67.6 and 67.7 rows).
5. For a breaking change the notice is also the Organization Administrator's invitation to review, and to accept or decline, the migrated report (FR-69; 182/43).

**Boundaries.** The notification mechanism is built (49, 50, 51, 52). Only the producer is not.

**Acceptance criteria.**
- **AC-1** Given a migration run, then each organization it reaches receives a notice naming the change. *(source: FR text; task-67.7 row)* Unmet until 67.7.
- **AC-2** Given a registered version that obliges a re-export, then affected organizations receive the notice. *(source: UC-79; task-67.6 row)* Unmet until 67.6.
- **AC-3** Given the notice, then it reaches the Organization Administrator in-app and by email. *(source: UC-79)* Unmet until 67.6 and 67.7.
- **AC-4** Given a breaking migration of a report, then the notice leads the Organization Administrator to the review of that report. *(source: §12.5.6 task-182 content row, 182/43)* Unmet until 67.7 and 67.20.

**History.**
- 21 Sep 2026 · project owner · the notice is dispatched per FR-166 by the task that makes the change · `task.md` 67.6, 67.7 (task 49.1)
- 5 Oct 2026 · project owner · for a breaking change the notice is the administrator's invitation to review the migrated report · §12.5.6 task-182 content row (182/43)

## 3. Rules and factors (index §3.15)

All four requirements ride on task 16's configuration store (AD-4, DR-3): immutable versions, publication as one transaction that moves a pointer, revert as moving it back, effective dating by `PRIMARY KEY (kind, scope, validity WITHOUT OVERLAPS)` on what is in force, and a replica cache invalidated by a poll of at most 5 seconds. Their editor is A-05, whose row is 67.8 (`TODO`). Until it ships, an artefact reaches the store by the seed loader or by a publication made in code. The loader publishes a file only over a slot that is empty or seed-owned, and keeps an operator's edit (`config/seed/README.md`; task 172).

### FR-71 — Emission and conversion factor sets as data

**Status.** Partial — delivered 16, 37.1, 37.2 · remaining 37.4 (validation at publication), 201 (the version-pinned regression suite), 67.8 (A-05's editor)

**Obligation.** The system shall maintain versioned, effective-dated emission and conversion factor sets as data, one artefact per country, so that a set serves the periods that start within its window and no two sets are in force for one period.

| | |
|---|---|
| **Actors** | PA maintains (A-05, elevated session). RC and SYS read the set a run applies (FR-34). |
| **Traces** | UC-80, UC-171 · FR-34, FR-35 · NFR-19, NFR-34, NFR-85, NFR-87 · DR-3, DR-4, AD-4 · BR-CALC-2 · entity *Emission factor set* |
| **Surfaces** | A-05 · the `emission_factor_set` artefact · the calculator's `FactorSets` port |

**Inputs.** A set per country, carrying: a label a reader is shown (for example `2026.1`); a validity window of calendar dates (NFR-34); and per energy source the invoice units it may be entered in with each unit's MWh, a tCO₂e per MWh factor, a GHG scope (`scope_1` or `scope_2_location_based`) and a citation printed beside the figure it produces. Decimals are strings (§7.3). Names are catalogue keys, not wording (OQ-43). (§12.5.6 task-37 row (1).)

**Behaviour.**
1. **One effective-dated artefact per country**: kind `emission_factor_set`, scope the country (`md`), one schedule window per set. The store's `WITHOUT OVERLAPS` key refuses two sets over one period as a write (task-37 row (1)).
2. A set is identified by `(country, revision)`. The revision is unique per scope and immutable, and the label is what a reader is shown (task-37 row (3)).
3. Which set a period uses is decided by the period's start date. That resolution, and the pin on a run, are FR-35's (task-37 row (2)).
4. Each configuration version records the window it was published for. **Revert moves that one slot**, so reverting a 2026 correction cannot put 2026's factors in force for 2027. A superseded version of a multi-window scope with no recorded window cannot be reverted to (task-37 row (4); task 37.2).
5. A correction supersedes the set for later runs. A run already made keeps the pin it was made under (FR-35; UC-80).
6. A set that cannot be read whole answers no set, and a calculation is refused with that said, rather than run against a half-read payload (`FactorSetCatalog`; task 37.2).
7. A factor update that obliges review of an existing report raises a notice (UC-80; UC-171; FR-166; task 37.3).
8. A factor-set payload is validated at publication against the schema the reader parses with, and a payload that fails is refused and nothing is published, as A-18 refuses an incomplete provider. Without this a set could publish and then not be read, and every run for its window would be refused until someone reverted (182/50).

**Refusals.** A factor-set payload that does not parse with the reader's schema → 400 `validation-failed`.

**Effects.** A factor-set update is a platform event for the system audit log (FR-81).

**Configuration-held values.** `emission-factor-set.md.json`, country `md`, label `2026.1`, serving periods starting before 1 Jan 2027 so that a 2027 set can be an adjacent window (task-37 row (6)). Ten fuels at IPCC 2006 Tier-1 defaults with AR6 GWPs, natural gas at Moldovatransgaz's 8 235 kcal/m³, litres at CDP's densities, and grid electricity at 0.594645 tCO₂e/MWh, the European Commission JRC's Covenant of Mayors 2024 figure for Moldova (2020), reviewed source by source by the owner on 1 Oct 2026 (task-37 row (5)). These are the values the sources record. The testable obligation is that a run reads the set from configuration and applies it.

**Boundaries.** Pinning and resolution are FR-35's. Computation is FR-34's. The notice is FR-166's (37.3 closes after task 38). 201 builds the version-pinned regression suite NFR-87 requires on every factor change (§12.5.6 task-182 tracking row, 182/160).

**Acceptance criteria.**
- **AC-1** Given two sets whose windows overlap for one country, then the second is refused as a write by the store. *(source: §12.5.6 task-37 row (1); task 37.1 Expected result)*
- **AC-2** Given a published set, then it cannot be edited. A correction is a successor revision. *(source: AD-4; task-37 row (3))*
- **AC-3** Given a correction published for the 2026 window, when it is reverted, then the 2026 slot returns to the earlier revision and no other window of the scope moves. *(source: §12.5.6 task-37 row (4); task 37.2 Expected result)*
- **AC-4** Given a new set with a version and an effective date, then the calculator applies the set in force on the period's start with no deployment. *(source: FR text; task 37.2 Expected result)* Publication by PA through the console is unmet until 67.8.
- **AC-5** Given a factor update that supersedes a set a stored calculation used, then each affected organization receives a notice that the figure must be recalculated, and an organization no run of which used the set receives none. *(source: UC-80; UC-171; task 37.3 Expected result)* Unmet until 37.3.
- **AC-6** Given a set that cannot be read whole, when a run is requested, then it is refused and no figure is filed. *(source: `FactorSetCatalog`; FR-34)*
- **AC-7** Given a factor-set payload the reader could not parse, when it is published, then it is refused with 400 and the set in force is unchanged. *(source: §12.5.6 task-182 content row, 182/50)* Unmet until 37.4.

**History.**
- 1 Oct 2026 · project owner · one effective-dated artefact per country, chosen by the period's start; the revert stays in its window; the starting values reviewed source by source · §12.5.6 task-37 row; §9.9 amended
- 5 Oct 2026 · project owner · a factor-set payload is validated before it is published and refused with 400 · §12.5.6 task-182 content row (182/50)

### FR-72 — Applicability thresholds as configuration

**Status.** Partial — delivered 16, 91.3 · remaining 67.8 (A-05's editor)

**Obligation.** The system shall maintain conditional-applicability thresholds as effective-dated configuration rather than code, read as of today so that a published change reaches reports already in progress.

| | |
|---|---|
| **Actors** | PA maintains (A-05). The api evaluates for every reader (FR-28). |
| **Traces** | UC-81, UC-171 · NFR-12, NFR-85 · AD-4, DR-3, P-2 · BR-APP-1 … BR-APP-5 · entity *Applicability threshold* |
| **Surfaces** | A-05 · the `disclosure_applicability` artefact |

**Behaviour.**
1. FR-28's four rules are the artefact: the ≥ 50-employee turnover threshold, the ≥ 150-employee pay-gap threshold, site-driven biodiversity and sector-driven water. They are held in task 16's store and evaluated by the api against B1's stored answers on every module and step read (task-91.3 rows).
2. **Scope is the standard.** The numbers are VSME's own, and what transposing legislation moves in time is carried by the store's effective dating. A country that diverges becomes a second scope resolved from the entity's country, which is a seed addition and not a code change (§12.5.6 task-91.3 row; §7.2).
3. The artefact is read as at today, so a published change reaches reports in progress. The cost is stated: a report's shape is not pinned the way its taxonomy version is (task-91.3 row).
4. **A payload that will not parse leaves every field applicable.** An unreadable list would hide disclosures, and nobody can see what they were never shown (task-91.3 row).
5. A rule says what makes a field apply. An element no rule names always applies, so a taxonomy version that adds elements needs no line (`config/seed/README.md`).
6. An element governed by several rules applies when every one holds (task-91.3 row).
7. A threshold change that obliges review of an existing report raises a notice to the organizations it reaches (UC-81; UC-171; FR-166; task-67.8 row).

**Effects.** A threshold publication is a platform event for the system audit log (FR-81).

**Configuration-held values.** `disclosure-applicability.vsme.json`: `numeric_at_least NumberOfEmployees` 50 and 150; `any_row_answered` over B1's five site elements; `member_within NaceSectorClassificationCodes` for `NACE_A` … `NACE_E`. These are the values the sources record; the testable obligation is that FR-28 reads them from configuration.

**Boundaries.** Evaluation, display and retained values are FR-28's. Validation rules are FR-73's, separate from thresholds. The notice is FR-166's.

**Acceptance criteria.**
- **AC-1** Given a threshold changed in the store, then the next read of a step applies the new value with no deployment. *(source: FR text; UC-81; FR-28/AC-7)* Publication by PA through the console is unmet until 67.8.
- **AC-2** Given a change published while a report is in progress, then that report's next read applies it. *(source: §12.5.6 task-91.3 row)*
- **AC-3** Given a payload that will not parse, then every field applies. *(source: §12.5.6 task-91.3 row)*
- **AC-4** Given a taxonomy version that adds elements no rule names, then they apply with no change to the artefact. *(source: `config/seed/README.md`; AD-4)*
- **AC-5** Given a threshold change that obliges review of an existing report, then each organization it reaches receives a notice. *(source: UC-81; task-67.8 row)* Unmet until 67.8.

**History.**
- 2–3 Sep 2026 · project owner · the rules are an effective-dated artefact scoped by the standard, resolved as at today, failing open · §12.5.6 task-91.3 rows
- 21 Sep 2026 · project owner · publishing a threshold change raises the report-update notice · `task.md` 67.8 (task 49.1)

### FR-73 — Validation rule definitions as configuration

**Status.** Not started — remaining 40.1, 40.2, 40.3 (the interpreter), 41.1 (rule sets from the store), 201 (the version-pinned regression suite), 67.8 (A-05's editor)

**Obligation.** The system shall maintain validation rule definitions as configuration, each naming the message it fires by a key whose wording is committed in the catalogues, separately from applicability thresholds.

| | |
|---|---|
| **Actors** | PA maintains (A-05). The api and the browser evaluate. |
| **Traces** | UC-82 · FR-40, FR-42 · NFR-12, NFR-85, NFR-87 · AD-4 · OQ-43, OQ-49 · `architecture.md` §9.8 · entity *Validation rule definition* |
| **Surfaces** | A-05 · `packages/validation` · no route exists yet |

**Behaviour.**
1. Rules are data interpreted by one interpreter in `packages/validation`, which `apps/api` and `apps/web` both run, so the server verdict and the inline verdict cannot drift (§9.8; task 40).
2. Rule types are presence, consistency, range and format, and cross-period (§9.8). Applicability is FR-72's artefact and not a rule kind here: §9.8's list also names it, and the task-91.3 row decided against that (§12.5.6).
3. Each rule names a message key. The wording is in the committed catalogues (AD-4's artefact table; OQ-43). A rule change is a configuration publish; a wording change is a release.
4. Rule definitions are effective-dated: exactly one version is in force for a date (AD-4's artefact table).
5. The rule set reaches the api as effective-dated rows, so a rule change takes effect with no redeploy and reverts in one step (task 41.1).
6. Rules are separate from thresholds. One decides whether a field applies, the other whether a supplied value is coherent (UC-82).
7. How a verdict reaches a form field is OQ-49, deferred with its assumption recorded. This requirement does not close it.
8. A publication is refused with 400 `validation-failed` when any locale's catalogue lacks the message key a rule names, as A-17 refuses a notification category with no wording. UX-97 makes a missing key invisible at runtime, so publication is the only place the gap is seen (182/51).
9. Rules are read as at today while a period is open, and as at the date the period was locked once it is. A rule published mid-year reaches drafts, and a locked report's findings do not move under a later rule (NFR-87). A reopened period is open again and reads as at today (182/44).

**Boundaries.** The five validation states and who they roll up to are FR-40 and FR-41. The finding's shape (field, rule, plain-language explanation, link) is FR-42. The notice a rule change may owe is FR-166's (task 67.8).

**Acceptance criteria.**
- **AC-1** Given the same rule set and the same values, then `apps/api` and `apps/web` return identical verdicts. *(source: §9.8; task 40.3 Expected result)* Unmet until 40.3.
- **AC-2** Given a rule or its message key edited in configuration, then it takes effect with no deployment, independently of the thresholds. *(source: FR text; UC-82)* Unmet until 41.1 and 67.8.
- **AC-3** Given a rule change, then it reverts in one step. *(source: NFR-85; task 41.1 Expected result)* Unmet until 41.1.
- **AC-4** Given a change to the wording of a finding, then it ships with a release and is not a publication. *(source: OQ-43; NFR-85 as amended)*
- **AC-5** Given a rule or factor change, then the version-pinned regression suite runs and no previously reported figure is silently restated. *(source: NFR-87)* Unmet until 201.
- **AC-6** Given a rule whose message key has no wording in some locale's catalogue, when it is published, then it is refused with 400 and nothing is published. *(source: §12.5.6 task-182 content row, 182/51)* Unmet until 41.1 and 67.8.
- **AC-7** Given a rule published after a period was locked, then the locked report's findings are those of the rule set in force on the date of the lock. Given a rule published while the period is open, then the next validation applies it. *(source: §12.5.6 task-182 content row, 182/44)* Unmet until 41.1.

**History.**
- 19 Aug 2026 · architecture.md OQ-43 · the message a rule fires is a key whose wording is committed; the rule stays configuration · `architecture.md` OQ-43, AD-4's artefact table; NFR-85
- 5 Oct 2026 · project owner · a rule whose message key lacks wording is refused at publication; rules are read as at today while the period is open and as at the lock once locked · §12.5.6 task-182 content row (182/44, 182/51)

### FR-74 — Content-only and rule-only changes without a redeploy

**Status.** Partial — delivered 16, 67.10, 67.11, 172 · remaining 67.5, 67.8 (the editors), 73.5 (the timed rehearsal)

**Obligation.** The system shall apply content-only and rule-only changes without a redeploy, supporting a quarterly regulatory-watch cadence. Content is FR-61's. A rule is a threshold, a factor set, a validation rule, an effective date or a notification behaviour.

| | |
|---|---|
| **Actors** | PA publishes. |
| **Traces** | UC-71, UC-81, UC-82 · NFR-12, NFR-85 · AD-4, DR-3 · OQ-43 |
| **Surfaces** | A-03, A-05, A-17, A-18 |

**Behaviour.**
1. A published change reaches every replica within the store's poll of at most 5 seconds. A Redis message is only a latency optimisation (AD-4).
2. Publication takes at most one working day from approval, and reverts in one step (NFR-85).
3. A change to the wording of a label, a help text, a finding message or a notification template is not covered. It ships with a release (NFR-12 as amended; OQ-43).
4. A seed run never undoes an operator's edit. A version the console publishes carries the operator's account, and the loader publishes only over an empty or seed-owned slot (task 172).
5. A publication made against a revision no longer in force is refused, so two operators editing one artefact never silently overwrite each other (task-67.11 row). A-18 uses it, and 409 `identity-provider-changed` is its answer.
6. The built editors are A-17 (notification categories, task 67.10) and A-18 (identity providers, task 67.11). A-03 and A-05 are not built.

**Boundaries.** Notification behaviour is FR-163 and FR-173's. The notices a change may owe are FR-166's.

**Acceptance criteria.**
- **AC-1** Given a notification category or an identity provider published from the console, then the next read applies it with no deployment. *(source: FR text; NFR-12)*
- **AC-2** Given a content change, then it reaches users with no deployment. *(source: FR text)* Unmet until 67.5 and 76.
- **AC-3** Given a threshold, a factor-set or a validation-rule change, then it reaches users with no deployment. *(source: FR text)* Threshold and factor publication through the console are unmet until 67.8; validation rules until 41.1.
- **AC-4** Given a seed run after an operator edited a slot, then the operator's version stays in force. *(source: `config/seed/README.md`; task 172)*
- **AC-5** Given a configuration-only change approved, then it is in production within one working day and can be reverted in a single step. *(source: NFR-85)* Unmet until 73.5's rehearsal.

**History.**
- 19 Aug 2026 · architecture.md OQ-43 · scope narrowed to non-wording changes; a catalogue wording change is a release · NFR-12 and NFR-85 amended
- 25 Sep 2026 · project owner · the seeder keeps what an operator published · task 172

## 4. Platform administration (index §3.16)

The administrative console is a separate application on a separate host, a client of the same public API as the tenant application (DR-11, AD-9). Its realm has its own credential store (`identity.admin_account`), its own session cookie and its own secrets, disjoint from the tenant realm's (NFR-65). Its lists, dialogues and paging follow the decisions of task 170 (`design_spec.md` §5.2's preamble).

### FR-75 — Administrator sign-in on a separate surface, with a second factor every time

**Status.** Built — delivered 23, 27.1, 28.4, 67.3, 145, 144, 151

**Obligation.** The system shall authenticate Platform Administrators, and the Billing Operators who share the realm, through a separate administrative surface with multi-factor authentication mandatory on every sign-in, holding elevated credentials apart from ordinary tenant accounts.

| | |
|---|---|
| **Actors** | PA and BO sign in. A tenant account is refused. |
| **Traces** | UC-68, UC-212 · D-5 · NFR-64, NFR-65, NFR-69 · AD-9, AD-12 · entity *Platform administrator account* |
| **Surfaces** | A-01 · `POST /auth/admin/session/challenge` · `POST /auth/admin/session` · `GET /auth/admin/session` · `DELETE /auth/admin/session` · `POST /auth/admin/session/recovery` |

**Preconditions.** An administrator account exists with a second factor enrolled (UC-68). An account comes into existence only through an invitation whose acceptance sets a password and confirms the factor (FR-80), or through the provisioning CLI.

**Behaviour.**
1. **Two steps.** The first verifies the password and seals `{account, issuedAt}` into its own `SameSite=Strict` cookie for five minutes. The second takes a current TOTP code (RFC 6238, 30-second step, ±1 window). The factor is challenged on every sign-in, without exception (FR text; §12.5.6 task-23 Admin MFA row).
2. **The second factor may be a recovery code.** An administrator whose authenticator is lost, or whose account is locked, signs in with the address, the password and one recovery code in one request. The code is judged before the password, it is spent, and the lock is released (UC-68 as amended; UC-212; §12.5.6 task-144 row (1)).
3. A wrong address, a deactivated account and a wrong password answer one way. A wrong code is disclosed only to a caller who presented the right password (NFR-64; task-23 rows).
4. **Attempts.** 5 per 15 minutes per (IP, account). Ten consecutive failures lock the account. The recovery path has its own window (§12.5.6 rate-limit table; task-144 row (1)).
5. The session cookie is `easyesg_admin_session`, `Secure; SameSite=Strict`, set by the api. It holds an access token of at most 15 minutes and a rotating refresh token, with 8 hours idle and 12 hours absolute lifetimes (§12.5.6 task-23 and Lifetimes rows).
6. The session is resolved on every request. A revoked session answers `authentication-required`, never announcing the revocation to whoever tripped it (§12.5.6 task-145 row).
7. A state-changing admin request must present an `Origin` equal to the configured console origin (§12.5.6 task-23 CORS row).
8. The TOTP secret is encrypted at rest (task 27.1).
9. Every sign-in attempt, successful or not, is written to the system audit log (FR-81).

**Refusals.**
- Unknown address, deactivated account or wrong password → 401 `credential-invalid`
- Right password, wrong or malformed code → 401 `factor-invalid`
- Ten consecutive failures → 403 `admin-account-locked`
- A spent window → 429 `rate-limited`
- A recovery refused for any reason → 401 `credential-invalid`
- No live session on a console route → 401 `authentication-required` or `session-expired`
- A write whose `Origin` is not the console's → 403, with no body to calibrate against

**Configuration-held values.** None. The windows and lifetimes above are code constants fixed by §12.5.6.

**Boundaries.** The network restriction of the host (an IP allowlist at the edge, NFR-65) belongs to `infra/caddy`, which is not started. A tenant user's optional second factor is FR-8's and NFR-95's.

**Acceptance criteria.**
- **AC-1** Given an administrator with the right password, when they sign in, then a current code is required every time. *(source: FR text; §12.5.6 task-23 Admin MFA row)*
- **AC-2** Given a tenant account's address and password, when presented to the console, then they are refused with the same 401 as any wrong credential. *(source: FR text; NFR-65; task-23 row)*
- **AC-3** Given a tenant access token, when presented to an admin route, then it is refused. *(source: NFR-65; §12.5.6 task-67.3 row)*
- **AC-4** Given the right password and a wrong code, then the answer is `factor-invalid`. Given a wrong password, then it is `credential-invalid`, whether or not the account exists. *(source: NFR-64; §12.5.6 task-23 rows)*
- **AC-5** Given ten consecutive failures, then the account is locked and a correct password is not verified until the lock is released. *(source: §12.5.6 task-23 and task-144 rows)*
- **AC-6** Given a revoked session, when its next request arrives, then it is refused. *(source: §12.5.6 task-145 row)*
- **AC-7** Given a sign-in attempt that succeeds or fails, then a row for it is in the system audit log. *(source: §12.5.6 task-28.4 row)*

**History.**
- 21 Aug 2026 · project owner · TOTP challenged on every sign-in; the session mirrors the tenant mechanism; strict cookie; the Origin proof · §12.5.6 task-23 rows
- 24 Aug 2026 · project owner · the factor challenge is a two-step handshake with a five-minute sealed cookie; a library replaces hand-rolled TOTP · §12.5.6 task-23 review row; build-log task 23 addendums
- 27 Aug 2026 · project owner · every attempt, both outcomes, is logged with a pseudonymous subject · §12.5.6 task-28.4 row
- 13 Sep 2026 · project owner · the session is read on every request; an operator account is created by invitation · §12.5.6 task-145 and task-67.4 rows
- 14 Sep 2026 · project owner · a recovery code may stand in for the TOTP code, on a route of its own · §12.5.6 task-144 row; UC-68 amended

### FR-76 — A register of organizations, with no report content

**Status.** Partial — delivered 67.3, 167, 170 · remaining 54.4 (the plan field, read through a billing port)

**Obligation.** The system shall provide a searchable register of all organizations exposing account-level metadata (registration date, entity count, plan, activity) and shall never expose report content.

| | |
|---|---|
| **Actors** | PA reads. A BO is refused. |
| **Traces** | UC-69 · D-5 · FR-77 · NFR-66 · `architecture.md` §7.6 |
| **Surfaces** | A-02 · `GET /admin/organizations` · `GET /admin/organizations/{organizationId}` · `…/entities` · `…/members` · `POST …/members/{accountId}/phone-disclosure` |

**Behaviour.**
1. A row carries the organization's name, its IDNO (that of its earliest entity holding one, and any entity's IDNO finds the organization), its registration date, its active entity count, its report count, and its activity: the most recent sign-in by any active member (§12.5.6 task-67.3 row; A-02).
2. A report **count** is account-level metadata. A report's stage, drafts, findings and values are content and are not shown (A-02).
3. Search is its own `search` parameter. It matches the name case-insensitively anywhere in it and the IDNO as a prefix. Order is total and ties break on the id (task-67.3 row). Paging and the page size are in the URL (UX-4; task 170).
4. There are no saved filters (task-67.3 row).
5. **Every read acquires the `BYPASSRLS` role, and the acquisition is written to `audit.support_access_log` before the read begins. A read the log cannot record is refused** (task-67.3 row; §7.6).
6. The organization's record lists its active members: name, sign-in address and role. A member's phone is behind a *Show* control, one person at a time, and **each reveal writes one row to the system audit log** (operator, whose phone, when). A member who gave no phone is said to have given none. A PA reveals it and a BO does not (§12.5.6 task-167 row (1)).
7. No support-access grant is needed for those two reads. The phone was given for support to reach the person about their account (FR-9), which is not the report content FR-77 guards (task-167 row (1)).
8. **Plan** is read through a port from the billing context, so no query crosses the schema boundary (DR-1). With `BILLING_ENABLED=false` the port answers none and the register shows no plan. With billing on, an organization with no subscription record is on Free, and the register says so (182/53; 182/57). PA holds no billing authority: the column reads and edits nothing (actors.md).

**Refusals.** A BO → 403 `insufficient-role` · An unknown organization → 404 `not-found` (`platform.admin.organization_not_found`) · A member with no phone to reveal → 404 `not-found` (`platform.admin.member_phone_not_found`)

**Boundaries.** What a PA may read of a report is FR-77's. The member's phone as profile data is FR-9's.

**Acceptance criteria.**
- **AC-1** Given the register, then each row shows the named metadata other than plan, and no report content. *(source: FR text; A-02)*
- **AC-2** Given a search by a fragment of the name or the start of an IDNO, then matching organizations are listed. *(source: §12.5.6 task-67.3 row; A-02)*
- **AC-3** Given the register is read, then an acquisition row is in the support-access log first, and when it cannot be written the read is refused. *(source: §12.5.6 task-67.3 row)*
- **AC-4** Given a Billing Operator, then the register is refused with 403. *(source: A-02; §12.5.6 task-67.3 row)*
- **AC-5** Given a member's phone is revealed, then the system audit log records the operator, whose phone it was and when. *(source: §12.5.6 task-167 row (1))*
- **AC-6** Given the plan of an organization, then the register shows it. *(source: FR text; §12.5.6 task-182 content row, 182/53)* Unmet until 54.4.
- **AC-7** Given `BILLING_ENABLED=false`, then the register shows no plan and every other column is unchanged. *(source: §12.5.6 task-182 content row, 182/53)* Unmet until 54.4.
- **AC-8** Given billing on and an organization with no subscription record, then the register shows it on Free. *(source: §12.5.6 task-182 content row, 182/53; 182/57)* Unmet until 54.4.

**History.**
- 13 Sep 2026 · project owner · columns, search, no saved filters, plan deferred · §12.5.6 task-67.3 row
- 23 Sep 2026 · project owner · the record lists the active members, and a phone is revealed one at a time and logged · §12.5.6 task-167 row
- 29 Sep 2026 · project owner · the IDNO shown is the earliest entity's, and any entity's finds the organization · §12.5.6 task-175 row; A-02
- 5 Oct 2026 · project owner · the plan is read through a billing port that answers none when billing is off; the deferral of 13 Sep 2026 is closed · §12.5.6 task-182 content row (182/53)

### FR-77 — No standing access to report data

**Status.** Built — delivered 67.3, 67.9

**Obligation.** The system shall grant no standing Platform Administrator access to any organization's report data at any point.

| | |
|---|---|
| **Actors** | PA is refused. |
| **Traces** | UC-69, UC-85 · D-5 · NFR-66 · BR-ACC-6 · P-4 |
| **Surfaces** | `/admin/organizations/{organizationId}/support-access/{requestId}/reports[…]` · the admin routes as a whole |

**Behaviour.** This requirement is verified by showing the prohibited state is unreachable (index §2.5.3).
1. No admin-realm route returns report content except the reads under a live grant (FR-78). The register returns counts and metadata only (FR-76).
2. The cross-tenant role `esg_admin_ro` (`BYPASSRLS`, read-only) is used through one path. Each acquisition is logged before the read, and a read that cannot be logged is refused (§12.5.6 task-67.3 row; §7.6).
3. A read under a grant does not use `esg_admin_ro`. It runs as `esg_app` in a `READ ONLY` transaction under the granted organization's tenant binding, so the same policies scope it as scope a member's read (§12.5.6 task-67.9 row (2)).
4. Each read under a grant is logged before it runs (FR-79).
5. A grant is the asking operator's alone to read under. Another operator holding no grant of their own is refused (task-67.9 row).

**Refusals.** A read under a grant that does not permit it (not this operator's, or not active, or ended or expired) → 403 `support-access-required`, one answer for every reason.

**Acceptance criteria.**
- **AC-1** Given a Platform Administrator with no live grant, then no admin route returns a report, a module or a value. *(source: FR text; D-5)*
- **AC-2** Given a live grant, then reads under it return the organization's reports read-only, and nothing under it enters a value, resolves a finding, files a report or exports a document. *(source: UC-85 business rules)*
- **AC-3** Given another operator's grant, then a read under it is refused with 403. *(source: §12.5.6 task-67.9 row)*
- **AC-4** Given a grant that has ended or expired, then a read under it is refused with 403. *(source: FR-78; §12.5.6 task-67.9 row)*
- **AC-5** Given a read under a grant, then it is scoped by row-level security to the granted organization alone. *(source: §12.5.6 task-67.9 row (2))*

**History.**
- 13 Sep 2026 · project owner · the cross-tenant read path is logged first and fails closed · §12.5.6 task-67.3 row
- 14 Sep 2026 · project owner · a live grant reads under the tenant binding as `esg_app`, not through `esg_admin_ro` · §12.5.6 task-67.9 row (2)

### FR-78 — Support access that the organization grants

**Status.** Built — delivered 67.9, 170

**Obligation.** The system shall issue scoped, time-limited support-access grants only on a request stating a reason and a ticket reference **and granted by an Organization Administrator of the named organization**, expiring automatically without administrator action.

| | |
|---|---|
| **Actors** | PA raises a request and may end any grant. An Organization Administrator of the organization grants, declines or ends. Every member sees a running grant. |
| **Traces** | UC-85 · D-5 · UX-124 · BR-ACC-6 · entity *Support-access grant* |
| **Surfaces** | A-07 · `POST /admin/support-access` · `POST /admin/organizations/{organizationId}/support-access/{requestId}/end` · the tenant banner · `GET /support-access` · `POST /support-access/{requestId}/grant`, `/decline`, `/end` |

**Inputs.** The organization, a ticket reference of at most 64 characters and a reason of at most 500, which the organization reads. Both are mandatory (A-07). The ticket reference is **free text**: required, at most 64 characters, and checked against nothing until task 77.1 decides the support channel, which revisits it (§12.5.6 task-182 identity and organization row, 182/7).

**Behaviour.**
1. A request is only a request. **Nobody at the platform can grant it on the organization's behalf.** An active Organization Administrator of the named organization grants or declines it (task-67.9 row (1)).
2. A grant lasts **60 minutes, fixed**, and is **read-only, fixed**. A longer need is a new request with its own reason and its own grant. There is no extension (task-67.9 row (3); A-07).
3. A request nobody answers lapses after **24 hours** and permits nothing (task-67.9 row (6)).
4. Any Organization Administrator of the organization, or any Platform Administrator, may end a grant early (task-67.9 rows (4), (7)).
5. An operator holds at most one waiting or running request per organization (task-67.9 row).
6. **Nothing expires by a job.** The limits are the clock read against the log's rows, so expiry needs no worker and no row at expiry. The first answer wins, an answer after a lapse is no answer, and an end counts only while the grant is live (task-67.9 row; `support-access-request.ts`).
7. **Consent is enforced by the log's own policies and not by the api.** The insert policy an unbound connection meets never admits a grant or a decline, and the organization's policy admits one only for the bound organization, in the organization's realm, with the bound member as actor (task-67.9 row).
8. Every active Organization Administrator sees a pending request, from a banner across the signed-in tenant screens, with *Grant* and *Decline*. While access lasts every member sees the operator, the ticket, the reason and the time left, and any Organization Administrator can end it (A-07; UX-124).
9. There is no email until the notification tasks reach it, so a request is seen when an administrator next opens the application (task-67.9 row (5)).

**Refusals.**
- No reason or ticket, or one over its length → 400 `validation-failed`
- An unknown organization → 404 `not-found`
- A second waiting or running request by the same operator for the organization → 409 `support-access-outstanding`
- A grant or decline for a request no longer waiting → 409 `conflict`
- An end for access not running → 409 `conflict`
- A non-administrator member answering → 403 `insufficient-role`
- An unknown request → 404 `not-found`

**Configuration-held values.** None. The 60 minutes and the 24 hours are code constants fixed by the owner on 14 Sep 2026.

**Boundaries.** The log is FR-79's. What a grant opens is FR-77's. The count of requests per operator in the last 30 days is a column on A-08 (FR-80).

**Acceptance criteria.**
- **AC-1** Given a request, when no Organization Administrator has answered, then no read is permitted. *(source: FR text; §12.5.6 task-67.9 row (1))*
- **AC-2** Given a request granted by an Organization Administrator, then the asking operator reads the organization's reports, read-only, for 60 minutes and no longer, with no action by anyone at expiry. *(source: FR text; UC-85)*
- **AC-3** Given a request declined, lapsed after 24 hours, or ended, then it permits nothing. *(source: UC-85 alternate flows; FR text)*
- **AC-4** Given a request made without a reason or without a ticket reference, then it is refused with 400. *(source: FR text; A-07)*
- **AC-5** Given a running grant, then every member of the organization sees the operator, the ticket, the reason and the time left, and an Organization Administrator can end it. *(source: UX-124; A-07)*
- **AC-6** Given a platform session with no organization binding, when it tries to insert a grant, then the database refuses. *(source: §12.5.6 task-67.9 row)*
- **AC-7** Given a second request by the same operator for the same organization while one is waiting or running, then it is refused with 409. *(source: §12.5.6 task-67.9 row)*
- **AC-8** Given a ticket reference of any text up to 64 characters, then the request is accepted, and nothing is looked up. *(source: §12.5.6 task-182 identity and organization row, 182/7; `RaiseSupportAccessRequestDto`)*

**History.**
- 14 Sep 2026 · project owner (task 67.9) · **consent is the organization's**: a request is only a request, a grant is read-only and lasts 60 minutes, an unanswered request lapses after 24 hours, and any Organization Administrator or any PA may end a grant · §12.5.6 task-67.9 row; UC-85, UX-124, A-07 amended
- 5 Oct 2026 · project owner · the ticket reference stays free text until the support channel is decided (task 77.1) · §12.5.6 task-182 identity and organization row (182/7)

### FR-79 — The support-access log

**Status.** Built — delivered 13, 67.3, 67.9, 170

**Obligation.** The system shall maintain a support-access audit log recording the requester, the organization, the reason and what was accessed, together with what the organization decided and who decided it and how the grant ended, reviewable but not editable from within the administrative console.

| | |
|---|---|
| **Actors** | Every PA reads the whole log. Nobody edits it. |
| **Traces** | UC-86 · D-5 · NFR-33, NFR-66 (verified by a monthly log review against ticket references) · DR-6 · BR-ACC-6 · entity *Support-access grant* |
| **Surfaces** | A-07 · `GET /admin/support-access` |

**Behaviour.**
1. The log is `audit.support_access_log`, append-only at database privilege level through `audit.enforce_append_only`. No console route edits or deletes an entry (task 13; task-67.3 row; NFR-33).
2. A row has one of six kinds: an `acquisition` of the cross-tenant role, a `request`, a `grant`, a `decline`, an `end` and an `access` (a read under a grant). A request and every decision against it are rows carrying the request's id, and the state is folded from them. *Lapsed* and *expired* are derived states (task-67.9 row).
3. An `access` row names what was read: the report list, a report's modules, or one module of one report. It is written before the read runs (task-67.9 row (2)).
4. The list is newest first and paged, and carries the requester, the organization, the ticket, the reason, what the organization decided and who decided it, how the grant ended, and every read made under it (`GET /admin/support-access`).
5. **Every Platform Administrator reads the whole log**, so a privilege that needs restraining is restrained by peers (task-67.9 row (4)). Reading it is itself recorded as an acquisition.
6. The organization sees only its own requests and answers, and never an acquisition or an access (task-67.9 row).

**Acceptance criteria.**
- **AC-1** Given a request, a grant, a decline, an end and a read under a grant, then each is a row naming who, which organization and when. *(source: FR text; UC-86)*
- **AC-2** Given the log, then no route or database privilege available to the application edits or deletes a row. *(source: FR text; NFR-33; P-4)*
- **AC-3** Given a read under a grant, then its `access` row exists before the read returns and names what was opened. *(source: FR text; §12.5.6 task-67.9 row (2))*
- **AC-4** Given a request that lapsed or a grant that expired, then the log shows it as lapsed or expired with no row written at that moment. *(source: §12.5.6 task-67.9 row)*
- **AC-5** Given an organization's own read, then it shows its requests and answers and no acquisition or access. *(source: §12.5.6 task-67.9 row)*

**History.**
- 13 Sep 2026 · project owner · the table is created with its acquisition half · §12.5.6 task-67.3 row
- 14 Sep 2026 · project owner · the grant half: decisions, ends and accesses, with the state folded from rows · §12.5.6 task-67.9 row; UC-86 amended

### FR-80 — Administrator accounts and their own credentials

**Status.** Partial — delivered 23, 67.4, 144, 151 · remaining 67.13 (the permission model and the role assignment on A-08)

**Obligation.** The system shall allow platform administrator accounts to be created, modified and deactivated with **roles composed of permissions**, so that content, operations and support functions do not require one another's rights, **and shall allow an administrator to manage their own credentials (password, second factor and recovery codes) without another administrator's involvement**.

| | |
|---|---|
| **Actors** | PA manages accounts of both realms (A-08). PA and BO each manage their own credentials (A-19). The invitee accepts (A-20). |
| **Traces** | UC-87, UC-212, UC-68 · NFR-64, NFR-65 · D-5 · `actors.md` OQ-6 · entity *Platform administrator account* |
| **Surfaces** | A-08, A-19, A-20 · `/admin/accounts` · `/admin/invitations` · `/auth/admin/invitation/{preview,enrolment,acceptance}` · `/admin/credentials` |

**Behaviour.**
1. **A PA manages both realms' accounts.** Managing an account is not billing authority, so separation of duties holds at the level of the actions each realm may take (`actors.md` OQ-6; task-67.4 row (1)).
2. **An account is created by invitation.** The inviting operator gives an address and a realm. The link is single-use and lasts 24 hours. A resend rotates the token and restarts the 24 hours on the same row. The account exists only when the invitee sets a password under OQ-51's policy and confirms a current TOTP code, in one transaction. Acceptance issues no session (task-67.4 row (3)).
3. **The lifecycle is suspend, reactivate and remove, and removal is final.** The address is unique among accounts that are not removed, so a removed operator's address can be invited again as a new account. Suspension and removal revoke the account's live sessions in the same transaction (task-67.4 row (4)).
4. An operator cannot suspend or remove their own account, nor the last active Platform Administrator (task-67.4 row (4)).
5. There is no realm change (changing function is removal and a new invitation) and no second-factor reset by another operator. A lost device is the operator's own re-enrolment (task-67.4 row (4); A-08).
6. A lockout is released by a PA on A-08. The release is refused for an account that is not locked (task-67.4 row (4)). This is an operator's lock; releasing a tenant account's is FR-209's.
7. **An operator's own credentials.** Every operation asks for the current password, the confirming step of a re-enrolment included. Changing the password may end the account's other sessions and spares the one making the request. A re-enrolment stages the new secret beside the one in force and activates it only on a current code from it. Recovery codes are ten, hashed, single-use, issued only by the operator's explicit action, and the whole set is replaced on re-issue (task-144 row (2)–(6); UC-212).
8. The four credential writes share one window of 5 per 15 minutes per (IP, account), which does not feed the lockout (task-144 row (4)).
9. Account and credential changes are attributed by `AuditInterceptor` under their own actions (task-67.4 row (5); task-144 row (7)).
10. **Access to the console is role-based.** A *permission* is the unit, one for each guarded action or screen capability. A *role* is a named set of permissions. An administrator account holds one or more roles, assigned on A-08 by an administrator who holds the permission to assign. FR-80's separation of content, operations and support is expressed as roles composed of permissions, not as three fixed levels, so a translator's role holds none of a taxonomy migration operator's permissions. The realm (Platform Administrator or Billing Operator) stays what NFR-65 makes it, the account's credential store; roles govern what an account may do. This replaces the deferral that the realm was the only level (§12.5.6 task-182 identity and organization row, 182/3; 67.13).

**Refusals.**
- An address held by an account that is not removed → 409 `admin-account-exists`
- An address already carrying a pending invitation → 409 `invitation-outstanding`
- Suspending, reactivating or removing an account not in a state that allows it → 409 `conflict`
- Suspending or removing one's own account → 409 `conflict`
- Suspending or removing the last active Platform Administrator → 409 `last-administrator`
- A lockout release for an account not locked → 409 `conflict`
- A link expired, revoked, replaced or already used → 410 `invitation-not-acceptable`
- A wrong current password on a credential write → 403 `credential-invalid`
- A re-enrolment confirmation with no staged secret → 409 `conflict`; with a code that is not current → 403 `factor-invalid`
- A password the policy refuses → 400 `validation-failed`
- An unknown account or invitation → 404 `not-found`
- Invitations and resends past 5 per 15 minutes per address → 429 `rate-limited`

**Configuration-held values.** None. The 24-hour link, the windows and the lockout threshold are code constants fixed by §12.5.6.

**Boundaries.** The sign-in itself is FR-75's. The log of these actions is FR-81's.

**Acceptance criteria.**
- **AC-1** Given an invitation, when the invitee sets a password and confirms a current code, then the account exists and not before. *(source: §12.5.6 task-67.4 row (3); A-20)*
- **AC-2** Given an account suspended or removed, then its live sessions end on their next request. *(source: §12.5.6 task-67.4 row (4))*
- **AC-3** Given the last active Platform Administrator or the operator's own account, then suspending or removing it is refused with 409. *(source: §12.5.6 task-67.4 row (4); FR-60's rule applied)*
- **AC-4** Given an operator, then they change their password, re-enrol a second factor and issue recovery codes without another administrator acting. *(source: FR text; UC-212)*
- **AC-5** Given a re-enrolment, then the factor in force keeps signing the operator in until a current code from the new secret confirms it. *(source: §12.5.6 task-144 row (5))*
- **AC-6** Given a recovery code, then it is accepted once and refused after. *(source: FR text; §12.5.6 task-144 row (1))*
- **AC-7** Given any credential write, then it is refused without the current password. *(source: §12.5.6 task-144 row (4))*
- **AC-8** Given an administrator whose roles hold the content permissions only, then every operations and support permission is refused to them with 403. *(source: FR text; UC-87; §12.5.6 task-182 identity and organization row, 182/3)* Unmet until 67.13.
- **AC-9** Given an administrator account, then it holds one or more roles, shown and changed on A-08 by an administrator who holds the permission to assign roles, and each change is a system audit row. *(source: §12.5.6 task-182 identity and organization row, 182/3; FR-81)* Unmet until 67.13.
- **AC-10** Given an admin-realm route that declares no permission, then the route-permissions spec fails. *(source: §12.5.6 task-182 identity and organization row, 182/3; the model of FR-81 behaviour 2)* Unmet until 67.13.
- **AC-11** Given the model ships, then every existing administrator account holds every permission, so no power changes that day; narrowing is done afterwards by assigning roles. *(source: §12.5.6 task-182 identity and organization row, 182/3, its stated assumption)* Unmet until 67.13.

**History.**
- 12 Sep 2026 · project owner (task 144) · self-service added: a sole operator who lost their second factor was recoverable only through the shell · FR-80 row; UC-212 added
- 13 Sep 2026 · project owner · accounts by invitation; a PA manages both realms; the lifecycle and its guards; privilege levels within the PA role deferred · §12.5.6 task-67.4 row; `actors.md` OQ-6
- 14 Sep 2026 · project owner · re-authentication on every operation, the staged re-enrolment, recovery codes minted only by explicit issue · §12.5.6 task-144 row
- 5 Oct 2026 · project owner · platform administration is role-based access control: permissions, roles of permissions, accounts holding roles; replaces the deferred privilege levels · §12.5.6 task-182 identity and organization row (182/3)

### FR-81 — The platform-wide system audit log

**Status.** Partial — delivered 13, 28.4, 67.4, 67.9, 67.10, 67.11, 167 · remaining 67.5, 67.6, 67.7, 67.8 (the rollout, publication, migration and factor-set events join with their screens), 69.1 (the metrics export)

**Obligation.** The system shall maintain a platform-wide system audit log of version rollouts, content publications, migration runs, factor-set updates and administrator account changes, each attributed and timestamped.

| | |
|---|---|
| **Actors** | PA reads (A-08). The system writes. |
| **Traces** | UC-88 · NFR-30, NFR-33 · FR-159, FR-151 · `architecture.md` §7.7, §12.5.7 · entity *System audit log entry* |
| **Surfaces** | A-08's log · `GET /admin/audit-log` (filters `operator`, `action`, `from`, `to`; paged, newest first) |

**Behaviour.**
1. The log is `audit.system_audit_log`, append-only at database privilege level and retained 24 months (§12.5.7; NFR-33).
2. **`AuditInterceptor` records every successful state-changing admin-realm request**, one row each, under the action its route declares (`@AuditAction`). A route that declares none is refused by the route-permission spec. The row holds the operator, the action, the target and the time (§12.5.6 task-67.4 row (5)).
3. A use case writes explicitly only where no session-bearing request carries the event: every sign-in attempt (task 28.4), an invitation's acceptance, and the provisioning CLI (task-67.4 row (5)).
4. **Both outcomes of a sign-in are recorded**, so the log answers who tried as well as who got in. A row carries a `subject`, the SHA-256 of the normalised presented address and never the address (§12.5.6 task-28.4 row).
5. The actions recorded today: sign-in (succeeded, credential refused, factor refused, blocked, throttled, recovered, recovery refused), invitation (issued, resent, revoked, accepted), account (suspended, reactivated, removed, lockout released, provisioned), credentials (password changed, re-enrolment started, re-enrolled, recovery codes issued), support access (requested, ended), identity provider (configured, enabled, disabled), notification category (published, reverted) and a member's phone disclosed (`SYSTEM_AUDIT_ACTION`).
6. Reading it is an acquisition of the cross-tenant role, logged before the read (task-67.4 row (6)).
7. Tenant mutations are not this log's. `core.field_change` attributes them per field (FR-54) and billing's ledger its own (DR-6) (task-67.4 row (5)).
8. A version rollout is **two actions**: a taxonomy version registered, and the adoption schedule changed. Registering is not adopting (OQ-45), and either can be what an operator is asked about (182/52).
9. The export of the platform metrics (FR-83) is an action in this log, so that who took the evidence the Phase 2 decision rests on is recorded. An export is a read, so its use case writes the row explicitly (behaviour 3; 182/56).

**Acceptance criteria.**
- **AC-1** Given an administrator account change, then it appears in the log with the operator, the action and the time. *(source: FR text; UC-88)*
- **AC-2** Given an admin sign-in that fails or succeeds, then it appears in the log. *(source: §12.5.6 task-28.4 row)*
- **AC-3** Given a state-changing admin route that declares no audit action, then the route-permission spec fails. *(source: §12.5.6 task-67.4 row (5))*
- **AC-4** Given a sign-in against an address that matches no account, then its row groups with other attempts against the same address and holds no address. *(source: §12.5.6 task-28.4 row)*
- **AC-5** Given a content publication, a version rollout, a migration run and a factor-set update, then each appears in the log. *(source: FR text; UC-88)* Unmet until 67.5, 67.6, 67.7 and 67.8.
- **AC-6** Given the log, then no console route edits or deletes an entry. *(source: A-08; NFR-33)*
- **AC-7** Given a taxonomy version registered and, separately, an adoption schedule changed, then the log holds two different actions. *(source: §12.5.6 task-182 content row, 182/52)* Unmet until 67.6.
- **AC-8** Given the platform metrics exported, then the log records the operator and the time. *(source: §12.5.6 task-182 content row, 182/56)* Unmet until 69.1.

**History.**
- 27 Aug 2026 · project owner · admin sign-in attempts are logged, both outcomes, with a pseudonymous subject · §12.5.6 task-28.4 row
- 13 Sep 2026 · project owner · `AuditInterceptor` records every state-changing admin request; the log is read through `esg_admin_ro` · §12.5.6 task-67.4 row
- 5 Oct 2026 · project owner · a version rollout is two actions, registering and adopting; the metrics export is logged · §12.5.6 task-182 content row (182/52, 182/56)

### FR-82 — Social identity providers managed without a redeploy

**Status.** Partial — delivered 24, 67.11, 170, 172 · remaining 154 (the client secret rotates without a restart)

**Obligation.** The system shall allow the social identity providers FR-2 names to be registered, enabled, disabled and have their credentials rotated without a redeploy, with disabling stopping new registrations and links while leaving existing accounts able to authenticate by another credential. The client id, issuer and redirect addresses rotate without a deployment through A-18. The client secret rotates by an environment change and a restart until task 154 moves it into the secret manager.

| | |
|---|---|
| **Actors** | PA configures (A-18). A user meets the result on S-01. |
| **Traces** | UC-70, UC-02, UC-05, UC-09 · D-6 · NFR-69 · BR-ID-6 · entity *Provider identity* |
| **Surfaces** | A-18 · `GET /admin/identity-providers` · `POST /admin/identity-providers/{provider}/configuration`, `/enablement`, `/disablement` · `GET /auth/social/providers` |

**Inputs.** For Google or Microsoft: a client id, an issuer, redirect addresses and the revision the edit was read at. The requested scopes are shown and fixed at FR-2's three.

**Behaviour.**
1. **A-18 configures the two providers FR-2 names, and no others.** Registering one is saving its first client id. A third provider is a release (task-67.11 row (1); UC-70 amended).
2. Behaviour is configuration-store data (kind `identity-provider`, scope the provider): enabled state, client id, issuer, scopes and the redirect-URI allowlist. **The client secret is an environment variable** (`AUTH_SOCIAL_<PROVIDER>_CLIENT_SECRET`) read by the api. A-18 shows whether the server holds it and the setting that holds it, never a value (§12.5.6 task-24 and task-67.11 rows).
3. **Enabling is refused, with the reason, while the provider has no client id, no redirect address or no secret held** (task-67.11 row (4)).
4. **Disabling stops sign-in, registration and linking through the provider**, in force within seconds, with nobody signed out. An existing account keeps its other credentials. An account whose only credential is the provider recovers by a password reset, which gives it a first password (UC-09; task-67.11 row (3)). The confirmation names the provider, the accounts using it and those with no other credential.
5. A publication carries the revision it was made against, so two operators editing one provider never silently overwrite each other. **A save carries the enabled state and never sets it**, and a save identical to what is in force is refused (task-67.11 row).
6. A disabled and an unregistered provider are indistinguishable to a caller (UC-05; task 24).
7. Each write is attributed under its own audit action, naming the configuration version it put in force (FR-81).
8. What the project owner declined from the artboard (the eID gateway, sign-in and failure counts, the connection test, the seven-day notice before a disable) is recorded in A-18 and is not required (task-67.11 row (2)).

**Refusals.**
- A provider FR-2 does not name → 404 `not-found`
- A save or enablement made against a revision no longer in force → 409 `identity-provider-changed`
- Enabling a provider that could not sign anyone in, or saving an enabled one into that state → 409 `identity-provider-incomplete`
- A save identical to what is in force, or a state change to the state already held → 409 `conflict`
- An issuer discovery cannot run against, or a redirect address the web tier could never present → 400 `validation-failed`
- Sign-in, registration or linking through a disabled provider → 403 `social-provider-unavailable`

**Configuration-held values.** `identity-provider.google.json` and `identity-provider.microsoft.json`: shipped disabled, with an empty client id, FR-2's three scopes and a local redirect address.

**Boundaries.** Rotating the client secret without a restart is task 154's (OpenBao). Linking and unlinking are FR-8's.

**Acceptance criteria.**
- **AC-1** Given a provider whose client id, issuer and redirect address are saved and whose secret is held, when it is enabled, then S-01 offers it within the store's poll interval with no deployment. *(source: FR text; §12.5.6 task-67.11 row)*
- **AC-2** Given a provider disabled, then new registrations and links through it are refused with 403, and an existing account with another credential still signs in. *(source: FR text; BR-ID-6)*
- **AC-3** Given an account whose only credential was the disabled provider, then a password reset gives it a first password. *(source: UC-70; UC-09; task-67.11 row (3))*
- **AC-4** Given a provider with no secret held, when an operator enables it, then it is refused with 409 naming the reason. *(source: UC-70; task-67.11 row (4))*
- **AC-5** Given two operators who read the same revision, when the second saves after the first, then the second is refused with 409. *(source: §12.5.6 task-67.11 row)*
- **AC-6** Given a client secret, then it rotates with no redeploy and no restart. *(source: FR text)* Unmet until 154.
- **AC-7** Given a seed run after an operator configured a provider, then the operator's configuration stays in force. *(source: task 172)*

**History.**
- 24 Aug 2026 · project owner · behaviour is store data and the secret stays in the environment; rotation by restart is a recorded deferral · §12.5.6 task-24 configuration row
- 14 Sep 2026 · project owner (task 67.11) · A-18 configures the two FR-2 providers; the secret's location is stated on the screen; enabling is refused while incomplete; task 154 is appended to own the deferral · §12.5.6 task-24 and task-67.11 rows; UC-70, A-18 amended; NFR-69 noted

### FR-83 — The adoption and usage dashboard

**Status.** Not started — remaining 62.1 (the metering substrate), 62.4 (the events the metrics read), 69.1, 69.2

**Obligation.** The system shall provide an adoption and usage dashboard covering the defined MVP success metrics (SMEs completing a full report, exports by format, average completion time, export-usage rate), filterable by period and segment, marking low-volume figures as low-confidence, and exportable for stakeholder reporting.

| | |
|---|---|
| **Actors** | PA reads and exports (A-06). |
| **Traces** | UC-83, UC-84, UC-152, UC-161 · `problem_overview.md` §9.1 (M1 … M5) and D-I · `architecture.md` §12.5.7 · entity: none named |
| **Surfaces** | A-06 · no route exists yet |

**Preconditions.** Metering events exist (UC-83; FR-105).

**Behaviour.**
1. The metrics are computed from the metering substrate and not from a second counter kept beside it (task 69.1).
2. The four are SMEs completing a full report, exports by format, average completion time and export-usage rate (FR text; UC-83), each defined over metering events (182/54):
   - **SMEs completing a full report**: the number of organizations with a Basic report that has had a first successful export. A report is complete at its first successful export, and counts once. A report carrying the Basic Module counts whether or not the Comprehensive Module is added over it (FR-177).
   - **Exports by format**: successful exports, counted per format, PDF and Excel.
   - **Average completion time**: from a report's first value saved to its first successful export, averaged over the reports completed in the period. The first value saved is not a billable-shaped action, so it is metered for this purpose (FR-105).
   - **Export-usage rate**: Excel exports as a share of all successful exports.
3. They are filterable by period and segment (UC-83). A **segment** is account-level data only: the plan once billing exists, the interface locale, and the legal form. No segment is drawn from report content (FR-77; DD-5). Sector (NACE) is not a segment at MVP (182/54).
4. Where volume is too low to be meaningful, a figure is marked low-confidence and not presented as reliable. The marking is a required presentation (UC-83; A-06). **Each metric has its own volume threshold, held in configuration (AD-4)**, below which its figures are low-confidence. Every threshold starts at 10 contributing organizations, each adjustable on its own (§12.5.6 task-182 starting-values row); a metric with no threshold set marks every figure low-confidence (182/55).
5. The metrics can be exported, which is the evidence the Phase 2 decision rests on (UC-84). The export is a **CSV of the filtered figures with their confidence marks**, and it is recorded in the system audit log (FR-81; 182/56).
6. Metering events are retained 24 months (§12.5.7).
7. Charts are admin-only at MVP (A-06; §11.5).

**Boundaries.** No numeric target for M1 … M5 exists in any source (`problem_overview.md` OQ-7). M4, user-reported reduction of duplicate questionnaire effort, is not among the four this requirement names.

**Configuration-held values.** **Starting value: each metric's threshold is 10 contributing organizations**; below it the metric's figure is low-confidence, and each threshold is adjustable on its own (§12.5.6 task-182 starting-values row).

**Acceptance criteria.**
- **AC-1** Given metering events, then the dashboard shows the four metrics. *(source: FR text; UC-83)* Unmet until 69.
- **AC-2** Given a period or a segment, then the figures narrow to it. *(source: FR text; UC-83)* Unmet until 69.
- **AC-3** Given a figure below its metric's volume threshold, then it is marked low-confidence. Given a metric with no threshold set, then every figure of it is marked low-confidence. *(source: FR text; UC-83; §12.5.6 task-182 content row, 182/55)* Unmet until 69.
- **AC-4** Given the dashboard, then the filtered figures export as a CSV that carries their confidence marks, and the export is recorded in the system audit log. *(source: FR text; UC-84; §12.5.6 task-182 content row, 182/56)* Unmet until 69.2.
- **AC-5** Given the dashboard, then each figure derives from metering events and from no second counter. *(source: task 69.1 row)* Unmet until 69.1.
- **AC-6** Given a Basic report with a first successful export in the period, then its organization counts once among the SMEs completing a full report, and a second export of the same report does not count again. *(source: §12.5.6 task-182 content row, 182/54)* Unmet until 62.4 and 69.1.
- **AC-7** Given a segment filter, then it offers the plan, the interface locale and the legal form, and nothing read from report content. *(source: §12.5.6 task-182 content row, 182/54)* Unmet until 69.

**History.**
- 5 Oct 2026 · project owner · the four metrics are defined over metering events; a segment is account-level data; each metric has its own low-confidence threshold in configuration, each starting at 10 contributing organizations; the export is a CSV recorded in the audit log · §12.5.6 task-182 content row (182/54, 182/55, 182/56)
- 5 Oct 2026 · project owner · every metric's threshold starts at 10 contributing organizations (182/55) · §12.5.6 task-182 starting-values row

## 5. Business rules held in this part

Moved from the index's §4.1 and §4.2 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-VER-1 | Every report carries an explicit template and taxonomy version; periods pin the version the adoption schedule names for the period's start. *(Clarified: the original read "the version current when they are opened". OQ-45, 29 Aug 2026, and the task-33.3 row, 1 Sep 2026, decided that adoption is an effective-dated artefact keyed on the period's start and is not the newest registered version.)* | FR-66, FR-65 |
| BR-VER-3 | Migration preserves the pre-migration state; a breaking change is migrated report-by-report with manual review. *(Clarified 5 Oct 2026, task 182, 182/41 and 182/43: the report is migrated in place with its prior values retained, and the review is made by the Organization Administrator of the organization that owns the report.)* | FR-69, FR-67 |
| BR-ID-6 | Disabling a social provider stops new registrations and links while leaving existing accounts able to authenticate by another credential. | FR-82 |
| BR-ACC-6 | The Platform Administrator holds no standing access to tenant report data; access exists only under a scoped, time-limited, logged grant that an Organization Administrator of that organization gave, and that expires without action. | FR-77, FR-78, FR-79, D-5 |

## 6. Entities held in this part

Moved from the index's §5.3, and the *Emission factor set* row from §5.2, on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Content string | Key, locale, value, version — help-centre articles and plan presentation copy only; catalogue text is a committed message file, not a row (19 Aug 2026, architecture.md OQ-43) | FR-61, FR-62 |
| Translation set publication | Version, published state, reversibility; the set identifier carried by each version a set wrote; the editorial sign-off of each locale (5 Oct 2026, 182/36 and 182/37) | FR-62 |
| Locale registration | Interface and export availability. The registry itself is `packages/i18n`; a registration records which locales are offered, and a locale is offered only when its catalogue is built and its registration is published (5 Oct 2026, 182/46) | FR-63 |
| Fallback log entry | Content key, locale, first seen, last seen, count — one entry per key and locale; FR-61 content only; catalogue gaps fail the build instead (FR-64 as amended; 182/38) | FR-64, FR-10 |
| Template / taxonomy version | Artefact (committed in the release and registered, not uploaded; 182/48). The backwards-compatibility determination belongs to a pair of versions and is held with the *Field mapping* (182/39) | FR-65 |
| Field mapping | Outgoing version, incoming version, each field's kind (added / removed / semantically altered) and nothing more, and the pair's backwards-compatibility determination (182/39, 182/40) | FR-67 |
| Migration run | Selected reports, mode (bulk / per-report review), pre-migration state (retained rows; the report is migrated in place, 182/41), the organization's acceptance or refusal of a breaking result (182/43) | FR-69, FR-68 |
| Applicability threshold | Threshold values as configuration | FR-72 |
| Validation rule definition | Rule, message (a key whose wording is committed, OQ-43) | FR-73 |
| Support-access grant | Requester, organization, reason, ticket reference, the organization's decision and who took it (granted, declined, ended), expiry | FR-78, FR-79 |
| Platform administrator account | Privilege level, active state | FR-80, FR-75 |
| System audit log entry | Event class, actor, timestamp | FR-81, FR-159 |
| Emission factor set | Version, effective date, factors. *Named further by the sources:* country (the scope), revision, label, validity window, and per source the invoice units with MWh per unit, tCO₂e per MWh, GHG scope and citation (§12.5.6 task-37 row) | FR-71, FR-35 |
