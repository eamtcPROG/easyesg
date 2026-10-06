# Functional requirements — Part 9: Notifications and their delivery

Part 9 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.30 Notifications | FR-160 … FR-167, FR-173 |
| 3.31 Notification delivery | FR-168 … FR-172 |

Business rules held here: BR-NOT-1 … BR-NOT-8 (§3). Entities held here: §4.

**What a notice is, and who it reaches.** A producer raises a notice through the one mechanism FR-157 requires and names its recipients by account. The notification module resolves each recipient's address and email language when it sends, and checks nothing about membership or standing at dispatch: the producer named the recipients, and that is where the decision belongs (`architecture.md` §12.5.6's task-49.3 row (4)). The four notices that carry a token in their link (verification, reset and both invitations) take the same path, and a recipient who holds no account, an invitee, is recorded by the address the email went to (task-50.1 rows (14), (16)). **Every member of an organization, in any role, has a centre** and reads and clears only their own notices; no plan or entitlement gates it (task 50.1.2). Only the Organization Administrator sends a manual reminder (UC-175).

**Where the requirement set stands.** The mechanism is built end to end: dispatch (task 49), the record and a delivery per recipient and channel (50.1), the centre and its unread count (50.2), delivery evidence, suppression and retry (51.4), preferences and the one-click unsubscribe (52), the console editor (67.10), and the live count over the socket (AD-15, tasks 146 … 150). One producer is built, the administrator's reminder (50.3), beside the four address notices. The producers that watch a condition (FR-164, FR-165), the three report-update notices (FR-166) and retention of delivery evidence (task 163) are not.

*On numbering.* FR-160 … FR-173 mean the notification requirements and nothing else. The deferred set that once shared those identifiers was renumbered FR-176 … FR-189 on 18 Aug 2026 (index §2.2 rule 3, OQ-1 closed).

## 1. Notifications (index §3.30)

**These requirements specify FR-157 rather than compete with it.** FR-157 requires that every system-initiated notification runs through one channel-agnostic mechanism; it does not say what that mechanism does. FR-160 … FR-172 are that specification, and every existing producer — payment failure (FR-120), quota approach (FR-101), trial expiry (FR-93), dunning (FR-135), service restriction (FR-136), invitation (FR-57), invoice delivery (FR-128), version change (FR-70) — is bound by them rather than acquiring its own delivery path.

**Scope held down deliberately.** There is no ownership or assignment model on a notice and no escalation chain: an outstanding-report notice addresses everyone with edit access, repeats at a configured interval, and stops when the condition clears. The Organization Administrator's view of what is outstanding remains the report status overview of FR-23. Both refinements can be added later if usage warrants; neither earns its complexity for an SME with two people on the report.

### FR-160 — A notification is one record, held apart from its deliveries

**Status.** Built — delivered 49.3, 50.1.1, 50.1.3

**Obligation.** The system shall model a notification as a first-class record carrying category, subject reference, recipients and state — raised, delivered or cancelled, with *read* held on each recipient's in-app delivery record and not on the notification — held separately from the channel or channels it is delivered on, so that one notice to two people on two channels remains one notification.

| | |
|---|---|
| **Actors** | SYS records. A producer (any context) raises. No human acts on the record directly. |
| **Traces** | UC-165, UC-172, UC-174 · FR-157 · AD-11 · BR-NOT-1 · entities *Notification*, *Delivery record* |
| **Surfaces** | `NOTIFICATION_PORT.raise()` and `cancel()` (a port, not a route) · outbox event `platform.notification.raised` · no HTTP operation · S-26 |

**Inputs.** A category key from the closed vocabulary (FR-173), the organization, the recipients by account id, a subject reference, an optional recipient scope, a deep link (FR-162) and the notice's parameters.

**Behaviour.**
1. A producer raises on **its own request transaction**: `raise()` writes an outbox event, so the notice commits with the decision that caused it or not at all (P-8; task-49.3 row (3)). A producer on the worker holds no request transaction; where a worker's notice is raised from is decided by the first such producer built, which is task 51.2's (task-49.3 row (3)).
2. The **worker** writes the record from the raised event, adopting the outbox row's key as the notice's id, and one delivery row per recipient and channel. No producer's transaction writes the `notification` schema (task-50.1 row (3)).
3. The record's state is `raised` once recorded, `delivered` once a dispatch of it has finished, and `cancelled` when its condition clears (FR-167). Read and dismissed belong to each recipient's in-app delivery (task-50.1 row (4)).
4. **A notice's content is fixed when it opens**: its parameters, its link and its application. A later raise folded into it adds recipients and moves `last_raised_at`, and rewrites nothing the notice says (task-50.1 row (18); task 165).
5. A link that carries a token (verification, reset, invitation) is kept encrypted on the record, beside a deep link with no token (task-50.1 row (15)).
6. A notice that belongs to no organization is recorded under a reserved organization id (the nil UUID), which `core.organization` refuses to any organization (task-50.1 row (17)).
7. A recipient id that resolves to no account is skipped and logged; it does not fail the notice (task-49.3 row (4)).

**Effects.** The `notification` schema is the sixth domain schema, owned by `platform/notification`. Its tenant rows are under RLS, and organization and account are referenced by id, unenforced, because NFR-109 retains delivery evidence a year past the organization (task-50.1 row (2)).

**Boundaries.** Read and dismissed state is FR-161's. Deduplication and cancellation are FR-167's. The category's behaviour is FR-173's. The delivery evidence is FR-170's.

**Acceptance criteria.**
- **AC-1** Given a notice raised to two recipients on a category that travels in-app and by email, then there is one notification record and four delivery rows (two recipients × two channels). *(source: FR text; BR-NOT-1; AD-11)*
- **AC-2** Given a notification record, then its state is one of `raised`, `delivered` or `cancelled`, and no read marker exists on it. *(source: FR-160 as amended 21 Sep 2026; task-50.1 row (4))*
- **AC-3** Given a raise made in a request whose transaction is rolled back, then no notice exists. *(source: §12.5.6 task-49.3 row (3); P-8)*
- **AC-4** Given a raise folded into an open notice, then the later recipients receive the parameters and link the notice was opened with. *(source: §12.5.6 task-50.1 row (18))*
- **AC-5** Given a notice that belongs to no organization, then it is recorded under the reserved organization id, and no tenant session can bind that id. *(source: §12.5.6 task-50.1 row (17))*

**History.**
- 21 Sep 2026 · project owner · task 50.1 · *read* is each recipient's, so the record's own state is raised, delivered or cancelled; the record is written by the worker · §12.5.6 task-50.1 rows (3), (4)
- 22 Sep 2026 · project owner · a notice that belongs to no organization carries a reserved id; a link carrying a token is kept encrypted · §12.5.6 task-50.1 rows (15), (17)

### FR-161 — The in-app notification centre

**Status.** Built — delivered 50.1.2, 50.2.1, 50.2.2, 147, 148, 149, 150

**Obligation.** The system shall provide an in-app notification centre listing the user's notifications for the active organization with an unread count available from any screen, persisting each item until read or dismissed rather than only while the user is present, and holding read state per user.

| | |
|---|---|
| **Actors** | Every member of the active organization, in any role, reads and clears their own notices. |
| **Traces** | UC-165, UC-166, UC-167, UC-172 · UX-62, UX-63, UX-64, UX-116 · AD-15 · NFR-110 · `architecture.md` OQ-36 · BR-NOT-5 · entity *Delivery record* |
| **Surfaces** | S-26 (Index) and the panel the global tier's bell opens · `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/read` · `POST /notifications/{notificationId}/read` · `POST /notifications/{notificationId}/dismiss` · event `notification.unread_changed` · `POST /session/socket-ticket` |

**Preconditions.** An authenticated session with an active organization. A notice reaches the centre only through an in-app delivery whose outcome is `delivered` (FR-168).

**Behaviour.**
1. **The centre** is the recipient's in-app deliveries of notices that are neither dismissed nor cancelled. The page, both counts and the unread count read that one definition, so they cannot describe different sets (task 50.1.2 build entry).
2. **Read is each recipient's own.** Reading writes that recipient's `read_at` once; a second read does not move it, and a colleague's reading of the same notice leaves it unread here. The database holds this, by restrictive policies narrowing the request tier to the bound recipient (task-50.1 rows (4), (8); task 50.1.2 build entry).
3. **Dismissing hides a notice and leaves its read time as it stands.** A dismissed notice leaves the list and the unread count, and a notice dismissed unread was never read (task-50.1 row (9)).
4. **Opening a notice records it read, then opens its subject.** *Mark all as read* marks every notice the unread count counts, writes only `read_at`, and leaves a dismissed notice as it is (task-50.2 row (2)).
5. **The list** is newest first by default, oldest first on request, paginated at 25 a page with `-1` (all rows) refused, and filters on read state and category in the compact format. It answers `total` for the filtered set and `unfiltered` for the centre, so an empty page can tell *nothing has arrived* from *the filter matched nothing* (task-50.1 row (11); `openapi/v1.json`). The screen offers the read-state tabs only, and the category filter waits until a second category travels in-app (task-50.2 row (4), (7)).
6. **The API resolves a notice's in-app wording** in the request's negotiated language: the category's name, the title, the text and the action's words, each omitted where no wording is written. The category key stays a key the client acts on and is never shown (task-50.1 row (10); task-50.2 row (3)).
7. **The unread count is on every signed-in screen**, as the bell in the global tier, drawn at every frame width, and it opens a panel of the latest ten notices with the read-state tabs, *Mark all as read* and the way to S-26. The panel is always newest first (task-50.2 rows (1), (6)).
8. **Freshness.** The count is polled every 60 s while the tab is visible and not at all while it is hidden (OQ-36; UX-116). With the socket connected a contentless hint triggers the same authorized read sooner. The hint is raised by an in-app notice delivered, read, dismissed, marked all read, or withdrawn (task-148 row (2)). **The poll is the floor and the hint never the authority** (AD-15).
9. **Each notification query is keyed by the organization the band was rendered for**, so an organization switch cannot show the organization left (task-50.2 row, implementation notes).

**Refusals.**
- Read or dismiss of a notice the caller holds no in-app delivery of — a colleague's, an email-only one, or one that does not exist — → 404 `not-found` (`platform.notification.not_found`). The three are one answer, so the route is not an existence oracle (task 50.1.2 build entry).
- No membership in the active organization → 403 `membership-required`; no session → 401 `authentication-required`.

**Configuration-held values.** The unread poll interval, 60 s, and its full-jitter backoff to a 5-minute cap are `architecture.md` OQ-36's, held in code.

**Boundaries.** What raises a notice is each producer's. How long a notice is kept is task 163's (NFR-109). The centre states no retention period while nothing enforces one (task-50.2 row, implementation notes). The panel's wording of *today* is formatted in the browser with the configured timezone (task-50.2 row (5)).

**Acceptance criteria.**
- **AC-1** Given a notice delivered in-app while the member was signed out, when they next sign in, then it is listed in the centre and counted unread. *(source: FR text; UC-165; UX-62)*
- **AC-2** Given a notice delivered to two members, when one reads it, then it stays unread for the other. When the first reads it again, their read time is unchanged. *(source: BR-NOT-5; §12.5.6 task-50.1 row (4); task 50.1.2 build entry)*
- **AC-3** Given a dismissed notice, then it is absent from the list and the unread count, and its read time is as it was. *(source: §12.5.6 task-50.1 row (9))*
- **AC-4** Given a notice addressed to a colleague, an email-only notice, or an unknown id, when it is read or dismissed by id, then the answer is 404. *(source: task 50.1.2 build entry)*
- **AC-5** Given unread notices and a dismissed one, when *Mark all as read* is pressed, then every notice the count counted is read and the dismissed one is unchanged. *(source: §12.5.6 task-50.2 row (2))*
- **AC-6** Given a notice, when it is opened, then it is recorded read and its subject opens. *(source: §12.5.6 task-50.2 row (2); UC-166)*
- **AC-7** Given a cancelled notice (FR-167), then it is absent from every recipient's list and count. *(source: §12.5.6 task-50.1 row; task 50.1.2 build entry)*
- **AC-8** Given a signed-in screen, then the unread count is visible on it, polled every 60 s while the tab is visible and not while it is hidden. *(source: FR text; OQ-36; UX-116; task 50.2.1)*
- **AC-9** Given the socket connected, when an in-app notice is delivered, then the count reflects it within p95 ≤ 3 s of commit; given the socket disabled, then within the 60 s poll. *(source: NFR-110; task 150)*
- **AC-10** Given a switch of the active organization, then the list and the count show the new organization's notices only. *(source: UC-165; §12.5.6 task-50.2 row, implementation notes)*
- **AC-11** Given a category with no in-app wording written, then the item carries no title or body, and the link is the item. *(source: `openapi/v1.json` `NotificationItemResponseDto`; §12.5.6 task-50.2 row (3))*

**History.**
- 12 Sep 2026 · project owner · OQ-36 closed: the unread count is polled at 60 s, stopped while the tab is hidden · `architecture.md` OQ-36
- 22 Sep 2026 · project owner · the centre is a tenant route `/notifications`; dismissing leaves the read time; the API resolves the words; the list filters on read state and category · §12.5.6 task-50.1 rows (8) … (11)
- 22 Sep 2026 · project owner · the count opens a panel; opening records read; *Mark all as read*; the category filter waits for a second in-app category · §12.5.6 task-50.2 rows (1) … (7); S-26 amended
- 23 Sep 2026 · project owner · the count and list are hurried by a contentless socket hint, with the poll as the floor · AD-15; §12.5.6 task-148 row

### FR-162 — Every notice carries a deep link to its subject

**Status.** Built — delivered 50.1.1, 50.2.1, 50.3, 165

**Obligation.** The system shall carry on every notification a deep link to the object that raised it — module, field, reporting period, invoice — so that acting on it requires no navigation.

| | |
|---|---|
| **Actors** | Every recipient follows the link. The producer supplies it. |
| **Traces** | UC-166 · UX-63, P6 · `architecture.md` NFR-109 · entity *Notification* |
| **Surfaces** | S-26 and its panel (the item is the link) · the link in every email · `deepLink` on `GET /notifications` |

**Behaviour.**
1. `RaiseNotificationCommand.deepLink` is required. The record keeps a path with no locale prefix and no token (task-50.1 row (15)).
2. In the centre the item is a link to that path in the tenant application. Where the category has an action's words, the action carries them; where it has none, the title is the link (task-50.2 row (3)).
3. In an email the worker makes the path absolute against the origin of the application the notice opens, prefixed with the recipient's email language (task-50.1 row (14)).
4. **The record names the application its link opens**, `web` or `console`, as a column written when the notice opens and never moved. Every notice a tenant's centre shows opens the tenant application (task 165; task-50.1 row (20)).
5. Which module or field a link lands on is each producer's. Today's only report link is the manual reminder's, which opens the report (task-50.3 row (1)).

**Boundaries.** The outstanding-report notice's links to modules and fields are task 51.2's. The platform notice with no organization (the operator's invitation) opens the console.

**Acceptance criteria.**
- **AC-1** Given a raised notice, then it carries a deep link, and its item in the centre exposes the path without a locale prefix. *(source: FR text; `openapi/v1.json` `NotificationItemResponseDto.deepLink`)*
- **AC-2** Given a notice in the centre, when it is selected, then the object that raised it opens directly. *(source: FR text; UC-166; §12.5.6 task-50.2 row (2))*
- **AC-3** Given an email notice, then its link is absolute, against the application the notice opens, and in the recipient's email language. *(source: §12.5.6 task-50.1 row (14); task 165)*
- **AC-4** Given a notice record, then it names the application its link opens, `web` or `console`, and a folded raise does not change it. *(source: §12.5.6 task-165 row (1); task-50.1 row (18))*
- **AC-5** Given a manual reminder, then its link opens the report it names. *(source: §12.5.6 task-50.3 row (1))*

**History.**
- 22 Sep 2026 · project owner · the record carries the application its link opens, written once; rows before it backfilled by category · §12.5.6 task-165 row

### FR-163 — Preferences by category and channel, with mandatory kinds locked

**Status.** Partial — delivered 49.1, 49.3, 52.1, 52.2.1, 52.3, 67.10 · remaining 60.4, 61.2, 65.2, 121.1 (the producers of three of the five mandatory kinds, and of the advisor access notices, register theirs)

**Obligation.** The system shall maintain per-user notification preferences by category and channel, stored on the user profile so that they follow the user across organizations, permitting suppression only for categories classified optional; security, account, invoice-delivery, payment-failure and service-restriction notices, and the advisor access notices (FR-203), are non-suppressible and presented as such. Extends FR-9.

| | |
|---|---|
| **Actors** | Any signed-in person, for their own account. A Platform Administrator publishes what is switchable (FR-173). |
| **Traces** | UC-168 · FR-9 · UX-65 · BR-NOT-2 · entity *Notification preference* |
| **Surfaces** | S-27 (Record; the per-category group of checkboxes) · S-38 · `GET /account/notification-preferences` · `PUT /account/notification-preferences` |

**Inputs.** `PUT` carries the set of `(category, channel)` pairs switched off, replacing what is stored.

**Behaviour.**
1. A preference is a row in `notification.preference`, keyed by the account, with **no organization and no row security**, so it follows the person across organizations (task-52.1 row (1)). **Only a switch-off is stored**, so a channel a category gains later arrives switched on (row (4)).
2. The read lists every category a tenant account can receive — the catalogue less the categories that reach console operators alone — each on the channels dispatch would use. A mandatory category is listed **switched on and locked** on each of its channels, with its name where one is written. An optional category whose behaviour cannot be read is not listed (task-52.1 row (3)).
3. The write replaces only the pairs the read offers. A stored switch-off for a channel the category no longer travels on is left as it stands and holds again when the channel returns (row (4)).
4. **What may be switched off is one predicate**: the category is not mandatory and its behaviour in force is classified `optional`. The read, the write, dispatch and the unsubscribe footer all ask it (task-52.2 row, last paragraph).
5. **At dispatch** the preference is read on the worker, per recipient and channel, when the notice is sent. An opted-out recipient gets a delivery row with the outcome `opted_out` and nothing is sent on that channel. A mandatory category never consults a preference (task-52.2 row (1)).
6. A preference carries no audit action and no field-change trail: it is the account's own setting (task-52.1 row, implementation notes).
7. S-27 saves the profile and the preferences behind one Save, preferences first (task-52.3 row (6)).

**Refusals.** A pair the read does not offer — a mandatory category, a channel the category does not travel on, a category not listed — → 400 `validation-failed` (`platform.notification.preference_not_offered`). The whole write is refused and nothing is stored (task-52.1 row (4)). No session → 401.

**Configuration-held values.** An optional category's classification is configuration (`config/seed/notification-category.<key>.json`; today `reporting.manual_reminder` is `optional`). A mandatory category's classification is code: `MANDATORY_NOTIFICATION_CATEGORIES` holds the four identity categories, and the catalogue refuses a mandatory category's artefact classified `optional` (task-49.3 row (1)).

**Boundaries.** The invoice-delivery, payment-failure and service-restriction categories are registered by the task that first raises each (task-49.1 row (1)); the index §3.30 preamble binds FR-120, FR-128 and FR-136 to them, and tasks 60.4, 61.2 and 65.2 carry those producers. The unsubscribe link is FR-169's. There are five mandatory kinds and FR-163 is the authority: UC-168, UX-65 and S-27 are corrected to list all five, and the advisor access notices (FR-203, task 121.1) are non-suppressible beside them (§12.5.6 task-182 notifications row, 182/130).

**Acceptance criteria.**
- **AC-1** Given an optional category, then the person can switch it off per channel, and the choice holds in every organization they belong to. *(source: FR text; §12.5.6 task-52.1 row (1))*
- **AC-2** Given a mandatory category, then S-27 shows it locked on each channel, and a write naming it is refused with 400 and stores nothing. *(source: FR text; BR-NOT-2; §12.5.6 task-52.1 rows (3), (4))*
- **AC-3** Given a recipient who switched the manual reminder off in-app, when one is raised, then it is absent from their centre and their delivery row reads `opted_out`. *(source: §12.5.6 task-52.2 row (1))*
- **AC-4** Given a category an operator published as transactional that code does not declare mandatory, then it is not offered as a switch. *(source: §12.5.6 task-52.2 row, last paragraph)*
- **AC-5** Given an optional category made transactional by publication, then A-17 discloses before publishing how many people's switch-offs it overrides, and those switch-offs no longer apply. *(source: §12.5.6 task-67.10 row (2))*
- **AC-6** Given a channel a category gains, then it reaches everyone except those who had switched it off on that channel earlier. *(source: §12.5.6 task-52.1 row (4); task-67.10 row (2))*
- **AC-7** Given the five kinds the requirement names and the advisor access notices, then none can be switched off and each is shown as mandatory. *(source: FR text; BR-NOT-2; §12.5.6 task-182 notifications row, 182/130)* Unmet until 60.4, 61.2, 65.2 and 121.1 register their categories.

**History.**
- 21 Sep 2026 · project owner · task 49.3 · mandatory is declared in code with the category, so no artefact can make one optional · §12.5.6 task-49.3 row (1)
- 23 Sep 2026 · project owner · task 52.1 · a preference is a row keyed by the account, no organization; only a switch-off is stored; a pair not offered is refused whole · §12.5.6 task-52.1 rows (1) … (4)
- 23 Sep 2026 · project owner · task 52.2 · one predicate for what may be switched off; an opted-out recipient is recorded `opted_out` · §12.5.6 task-52.2 row (1)
- 5 Oct 2026 · project owner · five mandatory kinds, with FR-163 the authority over UC-168, UX-65 and S-27, and the advisor access notices non-suppressible beside them · §12.5.6 task-182 notifications row (182/130)

### FR-164 — The outstanding-report notice

**Status.** Not started — remaining 41.3, 51.2

**Obligation.** The system shall raise a notice, at a configured repeat interval while a reporting period is open, where mandatory disclosures remain unanswered or validation findings unresolved, naming the specific modules and fields outstanding rather than reporting only that the report is incomplete.

| | |
|---|---|
| **Actors** | SYS raises. The members with edit access receive: the editor and the Organization Administrator (§12.5.6 task-182 row (1); D-2). |
| **Traces** | UC-169 · FR-41, FR-23, FR-167 · UC-38, UC-67 · BR-NOT-3 |
| **Surfaces** | S-26 and its panel · email · the link opens the report (FR-162) |

**Preconditions.** The reporting period is open (FR-21) and the validation rollup (FR-41, task 41.3) reports mandatory disclosures unanswered or findings unresolved.

**Behaviour.**
1. The system evaluates the validation rollup while the period is open and notifies the members with edit access. The named list is the rollup's, which already computes it (UC-169).
2. The notice repeats at a configured interval and stops when the condition clears. There is no escalation chain and no per-notice assignment (index §3.30 preamble; `use_cases.md` §4.3).
3. A section declared omitted as classified or sensitive satisfies validation and is discounted in completion, so it is not outstanding (FR-31; `use_cases.md` UC-38).
4. **A notice's content is fixed when it opens.** When the outstanding fields change between checks, the producer cancels the open notice and raises again, because a raise folded into an open notice only adds recipients (§12.5.6 task-50.1 row (18); task 51.2).
5. The category is registered by task 51.2, which waits for task 41.3's completion status and decides the repeat interval (task-49.1 row (6)). It is the first producer on the worker (task-49.3 row (3)).
6. The Organization Administrator's own view of what is outstanding is the status overview of FR-23, not this notice.

**Configuration-held values.** The repeat interval is **7 days**, held in the category's behaviour (FR-173) once the category has one (task-49.1 row (3)), so changing it is a publication and not a release (§12.5.6 task-182 notifications row, 182/131). The owner set the value the same day (§12.5.6 task-182 starting-values row).

**Boundaries.** Cancelling it when the condition clears is FR-167's. Once edit access can be held through an advisor relationship the same notice reaches the advisor, with no new category (task 121.2). The manual reminder, which is not this notice, is FR-173's.

**Acceptance criteria.**
- **AC-1** Given an open period with outstanding mandatory disclosures or unresolved findings, then a notice naming the specific modules and fields is raised to the members with edit access. *(source: FR text; UC-169)* Unmet until 41.3 and 51.2.
- **AC-2** Given the condition still holds after the configured interval, then the notice is raised again at that interval. *(source: FR text; UC-169; §12.5.6 task-182 notifications row, 182/131)* Unmet until 51.2. The interval is 7 days.
- **AC-3** Given the set of outstanding fields changes between checks, then the open notice is cancelled and a notice naming the new set is raised. *(source: §12.5.6 task-50.1 row (18); task 51.2)* Unmet until 51.2.
- **AC-4** Given a view-only member, then they receive no outstanding-report notice. *(source: FR text, "the users with edit access")* Unmet until 51.2.
- **AC-5** Given a section declared omitted as classified or sensitive, then it is not named as outstanding. *(source: FR-31; UC-38)* Unmet until 41.3 and 51.2.

**History.**
- 21 Sep 2026 · project owner · task 49.1 · the producer is task 51.2, which waits for task 41.3; the repeat interval is decided there · §12.5.6 task-49.1 row (6)
- 5 Oct 2026 · project owner · the repeat interval is 7 days, one configuration value · §12.5.6 task-182 notifications row (182/131)
- 5 Oct 2026 · project owner · starting value set (182/131) · §12.5.6 task-182 starting-values row

### FR-165 — The deadline notice

**Status.** Not started — remaining 41.3, 51.2

**Obligation.** The system shall raise a deadline notice at each configured lead time before a period's due date stating the date, days remaining and current completion state, and shall raise none where the report is already complete and validated.

| | |
|---|---|
| **Actors** | SYS raises. The members with edit access receive (task 121.2's expected result). |
| **Traces** | UC-170 · FR-21, FR-167 · UC-56, UC-38 · BR-NOT-4 |
| **Surfaces** | S-26 and its panel · email · the link opens the report or the period (FR-162) |

**Preconditions.** The period carries a due date (FR-21, UC-56). The due date is optional, distinct from the period end, and a legal date held as a calendar date with its timezone (`openapi/v1.json` `LegalDateDto`).

**Behaviour.**
1. At each configured lead time before the due date the system notifies, stating the date, the days remaining and the current completion state (UC-170).
2. **Where the report is already complete and validated nothing is sent** (UC-170 alternate flow; BR-NOT-4).
3. A period with no due date has nothing to count down to (UC-56).
4. A locked period cancels an outstanding deadline notice (FR-167).
5. The category is registered by task 51.2, which decides the lead times (task-49.1 row (6)).

**Configuration-held values.** The lead times are **14, 7 and 1 days** before the due date, held in the category's behaviour (FR-173) once the category has one. **Each lead time is its own notice**: its subject names the period and the lead time, because a notice's content is fixed when it opens and the days remaining differ at each step (§12.5.6 task-182 notifications row, 182/132). **Days remaining** is whole calendar days from today's date, read in the due date's own timezone, to the due date, and negative when overdue; the advisor board counts the same way (§12.5.6 task-182 notifications row, 182/133).

**Boundaries.** The completion state the notice states, and the test of *complete and validated*, are task 41.3's. Standalone completion dashboards are deferred (FR-178).

**Acceptance criteria.**
- **AC-1** Given a period with a due date, then a notice is raised at each configured lead time, carrying the date, the days remaining and the completion state. *(source: FR text; UC-170; §12.5.6 task-182 notifications row, 182/132)* Unmet until 41.3 and 51.2. The lead times are 14, 7 and 1 days, each its own notice.
- **AC-2** Given the report is complete and validated, then no deadline notice is raised. *(source: FR text; BR-NOT-4)* Unmet until 41.3 and 51.2.
- **AC-3** Given a period with no due date, then no deadline notice is raised. *(source: UC-170 precondition; FR-21)* Unmet until 51.2.
- **AC-4** Given a deadline notice is outstanding, when the period is locked, then it is cancelled. *(source: FR-167)* Unmet until 51.2.
- **AC-5** Given a due date, then the days remaining a notice states are the whole calendar days from today's date, read in the due date's timezone, to the due date, so a due date that is today reads 0 and a past one reads negative. *(source: §12.5.6 task-182 notifications row, 182/133)* Unmet until 51.2.

**History.**
- 21 Sep 2026 · project owner · task 49.1 · the producer is task 51.2, which waits for task 41.3; the lead times are decided there · §12.5.6 task-49.1 row (6)
- 5 Oct 2026 · project owner · lead times of 14, 7 and 1 days, each its own notice; days remaining counted in calendar days in the due date's timezone · §12.5.6 task-182 notifications row (182/132, 182/133)

### FR-166 — The report-update notice

**Status.** Not started — remaining 37.3, 67.7, 67.8

**Obligation.** The system shall raise a report-update notice to affected organizations wherever a taxonomy or template version change, an applicability threshold change or an emission factor update means an existing report must be reviewed or re-exported, naming the change and what it obliges.

| | |
|---|---|
| **Actors** | SYS raises, as a consequence of a Platform Administrator's change. |
| **Traces** | UC-171 · UC-79, UC-75, UC-78, UC-80, UC-81 · FR-70, FR-35, FR-72 |
| **Surfaces** | S-26 and its panel · email · A-04 and A-05 are where the changes are made |

**Behaviour.**
1. The notice is the mechanised form of UC-79: affected organizations learn what a change obliges rather than discovering it at export (UC-171).
2. **Each class belongs to the task that makes the change it reports** (task-49.1 row (6)): the version half to task 67.7's migration runs, the factor half to task 37.3 and the threshold half to task 67.8, because A-05 is where a threshold is published.
3. **Factor half:** a published factor set that supersedes one a stored calculation used raises a notice to the affected organizations, naming the change and that the figure must be recalculated. An organization no run of which used the set receives none (task 37.3; FR-35).
4. **Version half:** a run that moves reports to another taxonomy or template version notifies the organizations it reaches (task 67.7).
5. **Threshold half:** publishing an applicability threshold change notifies the organizations whose existing reports it obliges to be reviewed or re-exported (task 67.8). A report is obliged when the new threshold changes its applicability outcome, found by evaluating the old and the new rule over the stored B1 answers (§12.5.6 task-182 notifications row, 182/137).
6. Each half registers its own category when it is built (tasks 37.3, 67.7, 67.8 rows). **The three halves share one category**, optional and delivered in-app and by email, registered by whichever of the three tasks is built first and used by the others. It is one row on S-27, for one audience and one obligation, and FR-163's list names none of the three, so a person may switch it off (§12.5.6 task-182 notifications row, 182/136).

**Boundaries.** Recalculating is the reporter's explicit act and is never automatic (FR-35). The advisor domain's request and outcome notices are FR-203's. The notice reaches the members of an affected organization with edit access, the editors and the Organization Administrator, as FR-164's does, and an advisor who holds edit access through a relationship receives it too (task 121.2; §12.5.6 task-182 notifications row, 182/135).

**Acceptance criteria.**
- **AC-1** Given a migration run that moves an organization's reports to another taxonomy or template version, then the organization is notified of the change and what it obliges. *(source: FR text; UC-171; task 67.7)* Unmet until 67.7.
- **AC-2** Given an applicability threshold change is published, then each organization whose existing reports it obliges to review or re-export is notified. *(source: FR text; task 67.8)* Unmet until 67.8. A threshold change obliges the reports whose applicability outcome it changes (behaviour 5).
- **AC-3** Given a factor set that supersedes one a stored calculation used, then one notice is raised per affected organization, naming the change and that the figure must be recalculated, and none to an organization no run of which used the set. *(source: FR text; task 37.3 expected result)* Unmet until 37.3.
- **AC-4** Given any of the three notices, then it names the change and the obligation it creates. *(source: FR text)* Unmet until 37.3, 67.7 and 67.8.
- **AC-5** Given an affected organization, then a member with edit access receives the notice and a view-only member does not. *(source: §12.5.6 task-182 notifications row, 182/135)* Unmet until 37.3, 67.7 and 67.8.
- **AC-6** Given the three kinds of change, then they raise one category, which a person can switch off per channel. *(source: §12.5.6 task-182 notifications row, 182/136)* Unmet until 37.3, 67.7 and 67.8.
- **AC-7** Given an applicability threshold change, when old and new rule are evaluated over an organization's stored B1 answers and the outcome of a report is the same under both, then that organization is not notified. *(source: §12.5.6 task-182 notifications row, 182/137)* Unmet until 67.8.

**History.**
- 21 Sep 2026 · project owner · task 49.1 · the notice belongs to the task that makes the change it reports, in three halves · §12.5.6 task-49.1 row (6)
- 5 Oct 2026 · project owner · members with edit access receive it; one optional category serves all three halves; a threshold change obliges the reports whose outcome it changes · §12.5.6 task-182 notifications row (182/135, 182/136, 182/137)

### FR-167 — Cancel when the condition clears; deduplicate on category and subject

**Status.** Partial — delivered 50.1.1, 50.1.3 · remaining 51.2 (the producers whose conditions clear)

**Obligation.** The system shall cancel an outstanding notice and stop its repetition as soon as its condition clears — the disclosure supplied, the section declared omitted as classified or sensitive, the period locked — and shall deduplicate on category and subject so that a repeatedly evaluated condition produces one notice rather than one per evaluation.

| | |
|---|---|
| **Actors** | SYS. A producer calls `cancel()` when its condition clears. |
| **Traces** | UC-169, UC-170 · FR-164, FR-165, FR-160 · BR-NOT-3 · entity *Notification* |
| **Surfaces** | `NOTIFICATION_PORT.raise()` and `cancel()` · outbox event `platform.notification.cancelled` · no HTTP operation |

**Behaviour.**
1. **The key is the organization, the category, the subject and the recipient scope** (task-50.1 row (6)). The scope is a label the producer names, one audience by default, and never a digest of the recipient list, so a notice whose audience grows is still one notice.
2. **While a notice is open**, raising it again delivers to the recipients it names that the notice has not yet reached, and to them alone. Its content is not rewritten (rows (6), (18)). **Once it is cancelled**, a raise opens a new notice.
3. **Cancellation** is an outbox event on the producer's own transaction, as a raise is, and names the raise's key, never a notice id. Nothing further is delivered, the notice leaves every recipient's centre and count, and an email already sent stays sent (rows (12), (13); `contracts/notification.port.ts`).
4. **A cancellation outlives its notice.** The worker records when the key was cancelled even where no notice is open, because replicas take jobs in parallel and a cancellation can be processed before the raise it cancels. A raise whose outbox row is older than the key's latest cancellation opens nothing and delivers nothing. A cancellation and a raise with the same time resolve to the cancellation (row (12) and its implementation notes).
5. A dispatch already sending when a cancellation lands finishes the recipients it is sending to (row (12) and its implementation notes).
6. Cancelling a key with no open notice is not an error (`contracts/notification.port.ts`).
7. **A manual reminder is not cancelled when its report's period locks.** This requirement binds the notices that watch a condition (UC-169, UC-170); a reminder is one person's message to another and stays as sent (task-50.3 row (7)).
8. The repetition schedule, and the producers that cancel on *disclosure supplied*, *section declared omitted* and *period locked*, are task 51.2's. **The write that clears the condition calls `cancel()` in its own transaction**, one call in each of those three paths, and the schedule's next evaluation is the backstop for a route with no such call, such as a bulk change or a migration (§12.5.6 task-182 notifications row, 182/134).

**Refusals.** None on the wire. Cancellation is an internal operation, and cancelling an absent key is not refused.

**Boundaries.** A producer that cancels and re-raises one key inside one transaction loses the raise and must raise in a transaction of its own (task-50.1 row, implementation notes). Who cancels, and when, is behaviour 8's.

**Acceptance criteria.**
- **AC-1** Given an open notice, when it is raised again naming the same recipients, then one notification exists and no recipient is delivered to twice. *(source: FR text; §12.5.6 task-50.1 row (6))*
- **AC-2** Given an open notice, when it is raised again naming further recipients, then only the new recipients are delivered to, and they receive the content the notice was opened with. *(source: §12.5.6 task-50.1 rows (6), (18))*
- **AC-3** Given a cancelled notice, then it delivers nothing more and is absent from every centre and count, and an email already sent stays sent. *(source: §12.5.6 task-50.1 rows (12), (13); task 50.1.3)*
- **AC-4** Given a cancellation processed before the raise it cancels, then the raise opens nothing and delivers nothing. *(source: §12.5.6 task-50.1 row (12))*
- **AC-5** Given a cancelled notice, when its key is raised later, then a new notice opens. *(source: §12.5.6 task-50.1 row (6))*
- **AC-6** Given a manual reminder, when its report's period locks, then the reminder stays in the recipient's centre. *(source: §12.5.6 task-50.3 row (7))*
- **AC-7** Given the disclosure is supplied, the section declared omitted as classified or sensitive, or the period locked, then the outstanding-report and deadline notices are cancelled and repetition stops. *(source: FR text; §12.5.6 task-182 notifications row, 182/134)* Unmet until 51.2. The write path cancels in its own transaction, and the schedule is the backstop.
- **AC-8** Given one unchanged condition evaluated repeatedly, then it yields one notification, not one per evaluation. *(source: FR text; §12.5.6 task-50.1 row (6))*

**History.**
- 21 Sep 2026 · project owner · task 50.1 · the key names its audience; deduplication folds a raise into an open notice · §12.5.6 task-50.1 row (6)
- 22 Sep 2026 · project owner · task 50.1.3 · a cancellation outlives its notice and names the raise's key · §12.5.6 task-50.1 rows (12), (13)
- 22 Sep 2026 · project owner · task 50.3 · a manual reminder is not a watcher and is not cancelled by a lock · §12.5.6 task-50.3 row (7)
- 5 Oct 2026 · project owner · the write that clears a condition cancels in its own transaction, the schedule being the backstop · §12.5.6 task-182 notifications row (182/134)

### FR-173 — Category behaviour as configuration; the manual reminder

**Status.** Partial — delivered 49.1, 49.3, 50.3, 51.3, 52.2.2, 67.10 · remaining 51.2 (lead times and the repeat interval, which no category has yet)

**Obligation.** The system shall hold the notification category catalogue's behaviour — default channels, transactional-or-optional classification, deadline lead times, repeat interval — as publishable configuration, so that tuning a notice needs no release, with its per-locale subject and body wording shipped in the release that raises it. The classification of a **mandatory system category** — security, account, invoice delivery, payment failure, service restriction, the advisor access notices (FR-203), and the identity notices registered under them — is declared in code, so no artefact can make one optional and an unreadable one still sends by email. An optional category's classification stays configuration.

| | |
|---|---|
| **Actors** | PA maintains the catalogue (A-17). OA sends a manual reminder (UC-175). SYS applies the behaviour. |
| **Traces** | UC-175, UC-176 · UC-168 · `architecture.md` OQ-43, AD-4 · NFR-85 · UX-65, UX-66, UX-123 · FR-163, FR-169 |
| **Surfaces** | A-17 (Editor + Publish) · `GET /admin/notification-categories` · `POST …/{category}/preview` · `POST …/{category}/publication` · `POST …/{category}/reversion` · S-16's reminder dialogue · `POST /reports/{id}/reminders` |

**Preconditions.** For A-17, a Platform Administrator's session in the console realm, which is the elevated, multi-factor credential FR-75 requires and UC-176 names as an *elevated session*. For a reminder, the report is one of the organization's, still `open`.

**Inputs.** A publication carries the category's `channels` (a non-empty set of `in_app` and `email`), its `classification` (`transactional` or `optional`) and the revision it was made against. A reminder carries the membership of the person to remind and an optional note of up to 500 characters.

**Behaviour.** *The catalogue*
1. **One artefact per category**, kind `notification_category`, scoped by the category key, so A-17 publishes and reverts one category in one action and each category's history reads alone (task-49.1 row (2); NFR-85).
2. **A category is registered by the task that first raises it.** A category cannot exist unless code raises it, so a catalogue row with no producer is behaviour nothing exhibits (task-49.1 row (1)). The keys are a closed vocabulary in `contracts/notification.port.ts`. Five are registered: `identity.email_verification`, `identity.password_reset`, `identity.invitation` and `platform.admin_invitation` (each email-only and transactional), and `reporting.manual_reminder` (in-app and email, optional).
3. **Cadence is not modelled until a category has one.** Lead times and the repeat interval arrive with the task that raises the notice that needs them (task-49.1 row (3)).
4. **The reader fails closed.** A mandatory category whose artefact is absent or refused still goes by email, the floor, with the revision named at `error`. An optional category's job fails, lands in the queue's failed set and sends on nothing (task-49.3 row (2)).
5. A publication reaches a replica on its next poll, with no redeploy (task 49.1).

*Wording*
6. **Wording ships in the release**, as committed catalogues in all three locales, never machine-translated: `notification.<category>.name`, `…in_app.title`, `…in_app.body`, `…in_app.action` for the centre, and `subject` and `body` for email, which is plain text (OQ-43; UX-66). **Every category in the seed must carry the wording its published channels need**, and every template key code names must resolve, which a spec holds (task 51.3).

*A-17*
7. The console lists every category with its behaviour in force, whether code declares it mandatory, and how many people switched it off per channel. Each category's wording is shown rendered with a specimen, read-only (task 67.10 row (1)).
8. **Rules the platform enforces on publish and on revert**: a mandatory category is `transactional`; a mandatory category travels by email; the four address notices refuse in-app; and a channel whose wording is missing from any catalogue is refused (task-67.10 row; task-50.1 row (20)).
9. **A publication discloses what changes for recipients** before it is made (UX-123): optional made transactional overrides the switch-offs of N people; a channel removed reaches nobody on it; a channel added reaches everyone, those who switched it off there staying off (task-67.10 row (2)). The preview writes nothing.
10. **A publication carries the revision it was made against.** A revert is one step: the revision before the one in force, published again, refused where it would break a rule above. Each write is audited naming the configuration version it put in force (task-67.10 row).

*The manual reminder (UC-175)*
11. An Organization Administrator picks the person (any active member but themselves, whatever their role), one of the organization's reports still `open`, and an optional note. The notice names the report's entity and fiscal year and the sender, carries the note as written, and links to the report (task-50.3 row (1), (4)).
12. **Each press is its own notice**, under a key of its own, with no throttle beyond the control's pending state, so a second reminder carries its own note (row (3)).
13. The category is optional, in-app and email. Its email shipped when the one-click unsubscribe landed (task-50.3 row (2); task 52.2.2). A recipient who switched it off is recorded `opted_out` (FR-163).
14. The sender's name follows UX-137's fallback, so an account with no name sends its address (row, implementation notes). The note is fixed at the raise (FR-160).
15. On S-16 the reminder is a dialogue over the list, opened from a button in the filter row and from a *remind* action on every active member's row but the sender's (task-50.3 row (5) as amended 28 Sep 2026).
16. The reminder's producer lives in `core/disclosure`, which owns the report, and raises on the request's own transaction (row (6)).

**Refusals.**
- *A-17:* a rule above forbids the behaviour → 400 `validation-failed` (`platform.notification.category_refused.<reason>`: `mandatory_classification`, `mandatory_without_email`, `address_notice_in_app`, `wording_missing`) · a newer revision is in force → 409 `notification-category-changed` · the change is what is in force, or nothing to revert to → 409 `conflict` (`platform.notification.category_unchanged`, `…category_nothing_to_revert`) · unknown category → 404 `not-found` · not a Platform Administrator → 403 `insufficient-role` · no session → 401.
- *Reminder:* not an Organization Administrator → 403 `insufficient-role` · unknown report, or no active member holds that membership → 404 (`core.report.reminder_recipient_not_found`) · the report is no longer open → 409 `conflict` (`core.report.reminder_not_outstanding`) · the membership is the sender's own → 409 `conflict` (`core.report.reminder_to_self`) · a note over 500 characters → 400 `validation-failed` (request DTO).

**Effects.** A reminder is accepted (202) and delivered by the worker. The categories' publications are audited (A-08).

**Configuration-held values.** `config/seed/notification-category.<key>.json` per category: `channels` and `classification`. The wording is not configuration. The mandatory set (`MANDATORY_NOTIFICATION_CATEGORIES`), the operator-only set and the address-notice set are code.

**Boundaries.** Whether any plan limits a reminder is task 54's, with the rest of the report controller's keys. An operator invitation reaches console operators alone and is not offered to tenant accounts (task-52.1 row (3)). Deadline lead times and the repeat interval are edited on A-17 only once a category has them, which is task 51.2's.

**Acceptance criteria.**
- **AC-1** Given a category's channels or classification changed and published in A-17, then the next notice raised follows the new behaviour with no deployment. *(source: FR text; §12.5.6 task-49.1 row; NFR-85)*
- **AC-2** Given a mandatory category, then A-17 shows its classification fixed, and a publication of it as `optional` or without email is refused with 400. *(source: §12.5.6 task-49.3 row (1), task-67.10 row)*
- **AC-3** Given a mandatory category whose artefact is unreadable, then its notice still goes by email. Given an optional category whose artefact is unreadable, then the job fails and nothing is sent. *(source: §12.5.6 task-49.3 row (2))*
- **AC-4** Given a category published with a channel whose wording a catalogue lacks, then the publication is refused with 400. *(source: §12.5.6 task-67.10 row)*
- **AC-5** Given a category's wording, then it resolves from the message catalogue by the category key in each of the three locales, and no template sentence is written in code. *(source: FR text; OQ-43; §12.5.6 task-51.3 row (1))*
- **AC-6** Given a publication made against a revision no longer in force, then it is refused with 409 `notification-category-changed`. *(source: §12.5.6 task-67.10 row)*
- **AC-7** Given an Organization Administrator, a report still open and an active member, when a reminder is sent, then the member receives a notice naming the report's entity, its fiscal year and the sender, with the note as written, and its link opens the report. *(source: UC-175; §12.5.6 task-50.3 row (1))*
- **AC-8** Given two reminders to one member about one report, then they are two notices, each carrying its own note. *(source: §12.5.6 task-50.3 row (3))*
- **AC-9** Given a reminder to the sender, to a person who is not an active member, or about a report no longer open, then it is refused and nothing is raised. *(source: §12.5.6 task-50.3 row (1), (4))*
- **AC-10** Given a user who is not an Organization Administrator, when they send a reminder, then the answer is 403. *(source: UC-175; `reports.controller.ts` `@RequiresRole`)*
- **AC-11** Given a category with a deadline lead time or a repeat interval, then both are edited and published as configuration with no deployment. *(source: FR text; UC-176 step 1)* Unmet until 51.2.

**History.**
- 19 Aug 2026 · architecture OQ-43 · template wording moved into the message catalogues; a new notice always arrives with a release because code must call `raise()` with its key, and what an operator tunes without a release is the behaviour · `architecture.md` OQ-43
- 21 Sep 2026 · project owner · task 49.1 · a category is registered by the task that first raises it; one artefact per category; cadence not modelled until a category has one · §12.5.6 task-49.1 row
- 21 Sep 2026 · project owner · task 49.3 · a mandatory system category's classification is code; an unreadable behaviour is answered by the category's kind · §12.5.6 task-49.3 rows (1), (2)
- 22 Sep 2026 · project owner · task 50.3 · UC-175 amended: the reminder is about a report the administrator picks, to any active member but the sender, each press its own notice · §12.5.6 task-50.3 row; `use_cases.md` UC-175
- 23 Sep 2026 · project owner · task 67.10 · A-17: the rules enforced on publish and revert, the consequence disclosure, the revision carried · §12.5.6 task-67.10 row
- 28 Sep 2026 · project owner · the reminder is a dialogue over S-16's list · §12.5.6 task-50.3 row (5) as amended; `design_spec.md` S-16

## 2. Notification delivery (index §3.31)

### FR-168 — In-app delivery with no external dependency

**Status.** Built — delivered 50.1.1

**Obligation.** The system shall deliver in-app by writing to each recipient's notification centre, with no dependency on any external provider, so that the channel continues to function during an email provider outage.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | UC-172 · FR-161, FR-160 · AD-11 · BR-NOT-8 |
| **Surfaces** | The recipient's centre (FR-161) · event `notification.unread_changed` |

**Behaviour.**
1. **In-app first, then email.** The worker writes each owed recipient's in-app delivery row, recorded `delivered` at once because the centre is the store, then hints the recipient's open screens that their count changed. A provider failure afterwards fails the job with in-app already done (`DeliverNotification`; task-50.1 row (7)).
2. A category published without `in_app` writes none. The four address notices ignore an in-app channel and go by email, because a token-carrying link has no use in a centre (task-50.1 row (20)).
3. A recipient who switched the category off in-app gets only an `opted_out` row there (FR-163).
4. A job run again after a failure delivers only to the recipients with no delivery row, so nobody is reached twice (`still-owed`; task 51.4).
5. The hint is lossy by design and the centre's poll is the authority. A publish that fails does not fail the delivery (task 148).

**Acceptance criteria.**
- **AC-1** Given the email provider is unavailable, when a notice is raised to a recipient on a category that travels in-app and by email, then the in-app delivery is written and the recipient's unread count rises. *(source: FR text; UC-172)*
- **AC-2** Given an in-app delivery, then its row is recorded `delivered` when written, and the notice is in the recipient's centre. *(source: §12.5.6 task-50.1 row (4); task-52.2 row (1))*
- **AC-3** Given a notice dispatched again after a failure, then a recipient already delivered to in-app is not delivered to twice. *(source: §12.5.6 task-51.4 row (3))*
- **AC-4** Given a verification, reset or invitation notice, then no in-app delivery is written whatever the category's published channels. *(source: §12.5.6 task-50.1 row (20))*

**History.**
- 21 Sep 2026 · project owner · task 50.1 · in-app delivery is written by the worker with the record, and the centre reads only delivered rows · §12.5.6 task-50.1 rows (3), (7); task-52.2 row (1)

### FR-169 — Email through the provider adapter, in the recipient's language, with a one-click unsubscribe

**Status.** Built — delivered 49.2, 50.1.4, 51.1, 51.3, 52.2.2, 52.3

**Obligation.** The system shall deliver by email through a provider reached behind the standard provider adapter, resolving language per recipient rather than per notification — the recipient's **email language**, a setting of its own chosen on S-27 apart from the interface language and starting as it — and including a working one-click unsubscribe in every optional-category message.

| | |
|---|---|
| **Actors** | SYS sends. The recipient unsubscribes, signed in or not. |
| **Traces** | UC-173 · FR-156, FR-163 · NFR-11, NFR-27, NFR-84, NFR-108 · UX-66 · BR-NOT-6 · `non_functional_requirements.md` OQ-17 |
| **Surfaces** | S-38 (Focus) · S-27's email-language control · the footer link and RFC 8058 headers on every optional email · `POST /account/notification-preferences/unsubscribe/preview` · `POST /account/notification-preferences/unsubscribe` · the web route `/mail/unsubscribe/{token}` |

**Preconditions.** The recipient's address and email language are known; for an account they are read when the email is sent.

**Behaviour.**
1. **One mail port, one caller.** The notification module is the only caller of the provider port `EmailPort`, and a boundary rule refuses any other module that imports it (task-49.2 row (4)).
2. **Language is the recipient's email language.** The invited address's account email language where one exists, the inviting administrator's negotiated locale otherwise, resolved once at issue and stored on the invitation (`architecture.md` §12.5.6's task-26.1 row; task-52.3 row (3)). A new account's email language starts as its interface language.
3. **The provider is an environment value** (`EMAIL_PROVIDER=smtp`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`) and changing it changes only the environment. The host is checked at boot against a permitted set, and a host outside it fails the boot (task-51.1 row; `architecture.md` §12.5.6's task-51.1 rows).
4. **Email is plain text.** Every message is wording from the catalogue (`subject` and `body`) with the link appended, and carries no images or external styling (UX-66).
5. **Every optional-category email carries the unsubscribe**: a footer link, one wording `notification.unsubscribe.footer` appended by the renderer, and RFC 8058's `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (task-52.2 rows (2), (3)). A mandatory category's email carries none (UX-66).
6. **The link is a page, and opening it changes nothing.** S-38 names the category and the recipient's masked address and offers one button; a mail client's own control posts to the same switch with no page. This keeps a scanner that prefetches links from unsubscribing anyone (task-52.2 rows (2), (6)).
7. **The token is signed, not stored**: an HMAC over the account, category and channel under `UNSUBSCRIBE_SIGNING_KEY` (the worker signs, the api verifies), carrying no expiry and no table. Its one effect is switching one optional email off, which the person reverses on S-27 (task-52.2 row (4)).
8. The unsubscribe stops that category's email only; what reaches the centre still does (S-38).
9. **Rotating the signing key retires every link already sent**, which is accepted (task-52.2 row (5)).

**Refusals.** An unsubscribe whose link is not signed by the platform, or names a category that may no longer be switched off → 400 `validation-failed` (`platform.notification.unsubscribe_link_unusable`); the preview of the same link answers `unusable` with 200 (task 52.2.2). The two routes are public: the token is the proof.

**Configuration-held values.** The permitted email hosts: `in-v3.mailjet.com` (the provider `architecture.md` OQ-12 chose and the only NFR-27-compliant member) and `smtp.gmail.com` (the OQ-17 carve-out, pre-production only). Gmail is the provider in force until `EMAIL_HOST` moves, and its 500 messages a day is a ceiling that NFR-108's target cannot be met through at load.

**Boundaries.** The headers' coverage by the message's DKIM signature, which RFC 8058 wants, is recorded and not verified; what verifies it is the first message's headers read from a real inbox (task-52.2 row (6)). Delivery outcomes are FR-170's and FR-171's. NFR-84 and NFR-108 govern SPF, DKIM and DMARC alignment and the ≥ 99% accepted-delivery target.

**Acceptance criteria.**
- **AC-1** Given two recipients with different email languages, when one notice is delivered, then each receives it in their own language. *(source: FR text; UC-173 step 2)*
- **AC-2** Given a new account, then its email language starts as its interface language, and changing either leaves the other as it was. *(source: §12.5.6 task-52.3 row (3))*
- **AC-3** Given an optional-category email, then it carries the footer link and the one-click headers; given a mandatory-category email, then it carries neither. *(source: FR text; UX-66; §12.5.6 task-52.2 row (3))*
- **AC-4** Given the unsubscribe link is opened, then nothing is switched off until the button is pressed. *(source: §12.5.6 task-52.2 row (2); S-38)*
- **AC-5** Given the button pressed, or the mail client's one-click control used, then that category's email stops for that account and the centre is unaffected. *(source: FR text; S-38; §12.5.6 task-52.2 row (2))*
- **AC-6** Given a link not signed by the platform, or one whose category may no longer be switched off, then it switches nothing and the answer is 400. *(source: §12.5.6 task-52.2 row, implementation notes)*
- **AC-7** Given the configured provider changes, then only the environment changes, and a host outside the permitted set fails the boot. *(source: §12.5.6 task-51.1 rows)*
- **AC-8** Given an invitation to an address with an account, then it is sent in that account's email language; given an address with none, in the inviting administrator's. *(source: §12.5.6 task-26.1 row)*
- **AC-9** Given the one-click headers, then they are covered by the message's DKIM signature. *(source: RFC 8058, as recorded in §12.5.6 task-52.2 row (6))* Recorded, not yet verified: the first real message's headers are the proof.

**History.**
- 12 Sep 2026 · project owner · task 51.1 · the provider is an environment value bounded by a permitted set; Gmail is a knowing NFR-27 exception for the pre-production period · `non_functional_requirements.md` OQ-17; §12.5.6 task-51.1 rows
- 21 Sep 2026 · project owner · task 49.2 · the notification module is the one caller of the provider port · §12.5.6 task-49.2 row
- 23 Sep 2026 · project owner · task 52.2 · the unsubscribe is a page plus RFC 8058 headers, on a signed token with no expiry · §12.5.6 task-52.2 rows (2) … (6)
- 23 Sep 2026 · project owner · task 52.3 · the email language is a setting of its own, starting as the interface language · §12.5.6 task-52.3 row (3); FR-169 and UC-173 amended

### FR-170 — A delivery record per notification, recipient and channel

**Status.** Partial — delivered 50.1.1, 50.1.4, 51.4, 52.2.1, 165 · remaining 163 (retention of the evidence)

**Obligation.** The system shall record per notification and recipient the channel used, dispatch timestamp and outcome, and read state for in-app, as the evidence that a required update was actually requested.

| | |
|---|---|
| **Actors** | SYS writes. The recipient's own reading writes the in-app read time. |
| **Traces** | UC-174 · FR-157, FR-160 · NFR-109 · BR-NOT-1, BR-NOT-5 · entity *Delivery record* |
| **Surfaces** | No screen or route returns delivery records. The evidence is readable in the `notification` schema independently of the centre (NFR-109; task 165) |

**Behaviour.**
1. **One row per notification, recipient and channel**, carrying channel, dispatch time and outcome; for in-app, also the recipient's read and dismissed markers.
2. **Outcomes** (`delivered`, `accepted`, `bounced`, `suppressed`, `opted_out`): in-app is `delivered` when its row is written; an email is `accepted` **when the provider accepts it**, so a provider error writes no row; `bounced` is a send the provider refused outright; `suppressed` is one the platform declined to attempt because the address had already bounced; `opted_out` is the recipient's own choice and is not `suppressed` (task-50.1 row (7); task 51.4; task-52.2 row (1)).
3. **A recipient without an account is recorded by the address the email went to**, which is personal data kept for NFR-109's period (task-50.1 row (16)).
4. A read or dismissed marker is refused by the database on any outcome but `delivered`. Both are write-once, and only the recipient's own reading writes `read_at` (task-50.1 row (9); task-52.2 row (1)).
5. The record names the application its link opens (FR-162).
6. **Retention.** Delivery records are kept for the life of the organization plus one year, and a platform notice for one year from sending, readable independently of the centre (NFR-109; task-50.1 row (19)). Nothing is removed until task 163 ships. A recipient's own rows are removed earlier when that recipient's account is erased under FR-207 (§12.5.6 task-182 data-subject requests row, 182/125).

**Boundaries.** **A recorded limit** (task 51.4): a transient failure that exhausts its attempts leaves the notice undelivered and the job in the queue's failed set with no delivery row, since a row is written only on acceptance. The outcome therefore covers what was sent, bounced, suppressed or declined, and not what was never accepted. **No read surface is owed.** The table is the evidence, read by an operator at the database (`esg_admin_ro`), and no route, console screen or export returns it. This is a recorded deferral: the billing producers (task 61.2) say what an invoice's delivery history needs (§12.5.6 task-182 notifications row, 182/138).

**Acceptance criteria.**
- **AC-1** Given a notice delivered to a recipient on a channel, then a row names the channel, the dispatch time and the outcome. *(source: FR text; UC-174)*
- **AC-2** Given an in-app delivery, then the row also carries the recipient's read state, and only that recipient's reading writes it. *(source: FR text; §12.5.6 task-50.1 rows (4), (9))*
- **AC-3** Given an email the provider accepts, then its row is recorded `accepted`; given a provider error, then no row is written. *(source: §12.5.6 task-50.1 row (7))*
- **AC-4** Given a recipient who switched the category off, then their row reads `opted_out` and nothing was sent on that channel. *(source: §12.5.6 task-52.2 row (1))*
- **AC-5** Given an invitee with no account, then the delivery row names the address the email went to. *(source: §12.5.6 task-50.1 row (16))*
- **AC-6** Given a delivery record, then it is retained for the life of the organization plus one year, and a platform notice's for one year from sending. *(source: NFR-109; §12.5.6 task-50.1 row (19))* Unmet until 163. *Organization life* ends only with deletion of the organization record; a lapse or suspension never ends it (DD-13; §12.5.6 task-182 billing-catalogue row, 182/74).
- **AC-7** Given the delivery rows, then they are readable without the notification centre. *(source: NFR-109; task 165)*

**History.**
- 21 Sep 2026 · project owner · task 50.1 · an email delivery is recorded when the provider accepts it; a platform notice is kept one year from sending · §12.5.6 task-50.1 rows (7), (19)
- 22 Sep 2026 · project owner · task 165 · the record names the application its link opens · §12.5.6 task-165 row
- 23 Sep 2026 · project owner · task 51.4 · the outcome vocabulary gains `bounced` and `suppressed`; the exhausted-transient limit is recorded · §12.5.6 task-51.4 row
- 23 Sep 2026 · project owner · task 52.2 · the outcome `opted_out`, distinct from `suppressed` · §12.5.6 task-52.2 row (1)
- 5 Oct 2026 · project owner · no read surface for delivery records is owed; the table is read at the database · §12.5.6 task-182 notifications row (182/138)

### FR-171 — Retry transient failures, suppress a hard bounce, surface it

**Status.** Built — delivered 51.4

**Obligation.** The system shall retry a transient send failure on a bounded schedule, suppress an address that hard-bounces, and surface a suppressed recipient to the Organization Administrator.

| | |
|---|---|
| **Actors** | SYS retries and suppresses. The Organization Administrator sees the suppressed recipient. |
| **Traces** | UC-174 · NFR-107 · FR-170 · BR-NOT-7 · entity *Suppression record* |
| **Surfaces** | S-16 (a chip beside the person's standing) · `emailSuppressed` on `GET /access` |

**Behaviour.**
1. **The signal is what SMTP reports**, normalised at the adapter onto two platform outcomes so no vendor type crosses the port. A **hard bounce** is a recipient rejected with a 5xx reply, never a bare 5xx: `535` is *authentication failed*, and reading it as a bounce would suppress every address a mistyped password wrote to. A **transient** failure is a 4xx, a timeout or a network error (task-51.4 row (1) and shipped note).
2. **Retry is the queue's.** Eleven attempts on an exponential backoff from 60 s (60, 120, 240 … 61 440 s), about 17 hours in all, which lands the last attempt inside NFR-107's 24. A retried job re-sends only the recipients with no delivery row (task-51.4 row (3); `DELIVERY_RETRY`).
3. **A hard bounce never retries.** The address is suppressed before the outcome is answered, the bounce is recorded `bounced`, and the next notice to that address is recorded `suppressed` and not attempted.
4. **Suppression is platform-wide**: one row per normalised address in `notification.suppressed_address`, with no organization and no row security, because a dead mailbox is dead for every tenant. The worker writes it, the request tier may only read it, and nobody deletes (task-51.4 row (2)).
5. **The administrator sees it on S-16**, as a second chip beside the standing, because an invitation can be both invited and undeliverable (task-51.4 row (4)).

**Boundaries.** An asynchronous bounce (accepted, then rejected hours later) returns over SMTP as a DSN to the sender mailbox and would need IMAP; **complaints** are out of reach, since a feedback loop is an ESP relationship. Neither is modelled, because nothing produces them (task-51.4 row (1)). A transient failure that exhausts its attempts leaves no delivery row (FR-170).

**Acceptance criteria.**
- **AC-1** Given a transient failure, then the send is retried on the bounded schedule and stops after the last attempt. *(source: FR text; NFR-107; §12.5.6 task-51.4 row (3))*
- **AC-2** Given a recipient rejected with a 5xx reply, then the address is suppressed on the first occurrence, the delivery is recorded `bounced`, and the send is not retried. *(source: FR text; NFR-107; §12.5.6 task-51.4 row)*
- **AC-3** Given an authentication failure (`535`), then no address is suppressed. *(source: task 51.4 shipped note)*
- **AC-4** Given a suppressed address, when a later notice is addressed to it, then the delivery is recorded `suppressed` and nothing is sent. *(source: §12.5.6 task-51.4 row; `EmailChannelService`)*
- **AC-5** Given a suppressed address on a member or an invitation, then S-16 shows the chip beside the standing, including an invitation that is also invited. *(source: FR text; §12.5.6 task-51.4 row (4); `openapi/v1.json` `emailSuppressed`)*
- **AC-6** Given an address suppressed through one organization, then it is suppressed for every organization. *(source: §12.5.6 task-51.4 row (2))*

**History.**
- 23 Sep 2026 · project owner · task 51.4 · the bounce signal is SMTP's own, since Gmail has no webhook; suppression is platform-wide; retry is the queue's; the administrator sees it on S-16 · §12.5.6 task-51.4 row

### FR-172 — Dispatch is asynchronous

**Status.** Partial — delivered 49.3 · remaining 202 (the production measurement of raise-to-dispatch)

**Obligation.** The system shall dispatch notifications asynchronously, so that no user-facing action blocks on delivery and a provider outage degrades delivery without degrading the application.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | *(architectural)* · FR-157 · AD-10, AD-11 · NFR-106 · BR-NOT-8 · P-8 |
| **Surfaces** | Outbox event `platform.notification.raised` · the worker's notification consumer |

**Behaviour.**
1. A raise writes an outbox event on the producer's own transaction. The dispatcher drains the outbox onto the queue every `DISPATCH_INTERVAL_MS` (1000 ms, `architecture.md` §12.1, set with task 15), passing the row's idempotency key as the job id, so a re-emitted duplicate is discarded by the queue (AD-6, AD-10; task 49.3).
2. The worker's consumer reads the category's channels and delivers each (FR-168, FR-169). A user-facing action that raises a notice completes on its own commit and waits for no delivery.
3. A provider failure fails the delivery job and leaves the action untouched (FR-171).
4. Dispatch to the first channel is within p95 ≤ 60 s of the raise (NFR-106).

**Acceptance criteria.**
- **AC-1** Given a user-facing action that raises a notice, then the action completes without waiting for delivery. *(source: FR text; §12.5.6 task-49.3 row (3))*
- **AC-2** Given the email provider is unavailable, then the action still completes and the in-app delivery still succeeds. *(source: FR text; UC-172)*
- **AC-3** Given a raise whose request transaction rolls back, then nothing is dispatched. *(source: §12.5.6 task-49.3 row (3); P-8)*
- **AC-4** Given the same outbox row emitted twice, then one job runs. *(source: AD-6; `OutboxDispatcher` job id)*
- **AC-5** Given a notice raised, then its first channel is dispatched within p95 ≤ 60 s, per channel. *(source: NFR-106)* Unmet until 202.

**History.**
- 21 Sep 2026 · project owner · task 49.3 · `raise()` is an outbox event on the producer's own transaction, delivered by a consumer on the worker · §12.5.6 task-49.3 row (3)
- 5 Oct 2026 · project owner · the raise-to-dispatch production measurement NFR-106 requires is a row of its own in the operations stage, not part of 51.2 · §12.5.6 task-182 tracking row (182/161)

## 3. Business rules held in this part

Moved from the index's §4.4 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-NOT-1 | One notice to several recipients over several channels remains one notification record with per-recipient delivery records. | FR-160 |
| BR-NOT-2 | Security, account, invoice-delivery, payment-failure and service-restriction categories and the advisor access notices (FR-203) are non-suppressible and presented as such; only optional categories can be switched off. *Amended 21 Sep 2026 (task 49.3):* a mandatory system category is declared in code, so no artefact can make one optional. *Amended 5 Oct 2026 (task 182, 182/130):* the advisor access notices join the list. | FR-163, FR-173 |
| BR-NOT-3 | A notice is cancelled and its repetition stops as soon as its condition clears; notices deduplicate on category and subject. | FR-167 |
| BR-NOT-4 | No deadline notice is raised where the report is already complete and validated. | FR-165 |
| BR-NOT-5 | Read state is per user; one recipient reading an organization-wide notice does not clear it for others. | FR-161 |
| BR-NOT-6 | Email language resolves per recipient, not per notification; every optional-category email carries a working one-click unsubscribe. *Amended 23 Sep 2026 (task 52.3):* the language is the recipient's email language, a setting of its own that starts as the interface language. | FR-169 |
| BR-NOT-7 | A transient send failure retries on a bounded schedule; a hard-bouncing address is suppressed and surfaced to the Organization Administrator. | FR-171 |
| BR-NOT-8 | Dispatch is asynchronous: no user-facing action blocks on delivery. | FR-172 |

## 4. Entities held in this part

Moved from the index's §5.5 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Notification | Category, subject reference, recipients, state (raised / delivered / cancelled — *read* is each recipient's, FR-160 as amended 21 Sep 2026), deep link, the application the link opens (task 165) | FR-160, FR-162, FR-167 |
| Delivery record | Notification, recipient, channel, dispatch timestamp, outcome, read state (in-app) | FR-170, FR-171 |
| Notification preference | User, category, channel, suppressible or mandatory | FR-163 |
| Notification category catalogue | Default channels, transactional-or-optional classification, deadline lead times, repeat interval. Template wording resolves from the message catalogue by category key (FR-173 as amended) | FR-173 |
| Suppression record | Hard-bounced address, visibility to Organization Administrator | FR-171 |
