# Functional requirements — Part 12: The monitoring domain

Part 12 of the twelve parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.35 Monitoring domain | FR-213 … FR-229 |

Business rules held here: none. The index's §4 assigns no rule to the monitoring domain, and none is invented here; the rules of this domain are carried in the requirements themselves and in `use_cases.md` D-17 and D-18. Entities held here: §2.

Added 17 Nov 2026 (project owner) with the promotion of **monitoring by a lender or buyer** out of `use_cases.md` §7.1 into MVP scope, and the registration of the `MO` actor. A **monitoring organization** — the first customers are banks following their SME borrowers, modelled generically so an EU buyer following its suppliers can reuse it — is a second typed relationship on FR-14's organization graph, beside the advisor type of part 10. These requirements mirror part 10 wherever the monitor's lifecycle is the advisor's, and say so; where they differ they say why. The decisions are `architecture.md` §12.5.6's monitoring row, cited below as *monitoring row (n)* with the owner's numbering: (1) per client and combined, (2) live, (3) the client grants, read-only, (4) the monitor asks, (5) officers and assigned clients, (6) the shared-figures copy, (7) opening a report, (8) one named report per request, (9) several monitors, (10) duration and end date, (11) adding a client, (12) the notice on the client's report screen, (13) the figures available, (14) downloads, exports and reminders, (15) selling deferred.

**The invariant this part protects.** The monitor reads across clients and **no query spans tenants**. Its board, table and totals are ordinary queries over rows that belong to its own tenant (FR-224, FR-229; D-18), and opening one client's report resolves to exactly one tenant in a read-only role (FR-225; D-15, D-17). The row-level isolation predicate (AD-2, DR-5) is unchanged, and the cross-tenant probe keeps its meaning. The copy is the consent boundary: what exists in the monitor's tenant is exactly what the client currently consents to share.

**Who acts.** The Monitoring Organization Administrator (`MO`) holds no authority over any client by virtue of the role, and **never edits, files or exports on the client's behalf**. The monitor asks and the client grants: **there is no path by which a monitor attaches itself to an organization** (D-17). The client's half (FR-218 … FR-220, FR-222) belongs to the client's Organization Administrator alone (`actors.md` §5).

**The state of the group.** No requirement here is built. Tasks 245 … 251 are `TODO` (`task.md`, provisional Stage 10). The advisor lifecycle they mirror (tasks 116 … 121) is itself open, and the monitoring tasks follow it. `organization_relationship_type` is seeded with `direct_sme` only; no monitoring route appears in `packages/contracts/openapi/v1.json`.

**What is decided that looked open.** The default figure columns are a **recorded assumption** from conversations with prospective banks, to be revisited when a bank confirms (OQ-11, closed 17 Nov 2026). The privacy notice's new wording is drafted as provisional by task 246, and monitoring access may be built and tested but is not enabled for real clients until counsel has checked the text (`design_spec.md` OQ-29, closed 17 Nov 2026).

**What is not decided**, and is recorded rather than assumed: the read-only role's reach (OQ-10), what a request shows before it is answered (OQ-12), the notice and reminder details (OQ-13), how an IDNO identifies a client (OQ-15), whether a monitor may hold reports of its own (OQ-16) and which acts an officer holds (OQ-17), all in `functional_requirements.md` §10; the copy's lag (`non_functional_requirements.md` OQ-18); the board's completion source and the named-report bound's enforcement (`architecture.md` OQ-62, OQ-63); and the screens (`design_spec.md` OQ-28). The blocks cite them where they bite. **Selling the capability** — a monitoring plan and a client quota — is deferred to billing and has no requirement (`use_cases.md` §7.1; OQ-14).

## 1. Monitoring domain (index §3.35)

### FR-213 — The monitoring organization

**Status.** Not started — delivered none · remaining 245.1, 245.3

**Obligation.** The system shall allow an organization of the monitoring type to be created from a verified account and shall automatically grant the creating user the Monitoring Organization Administrator role over it.

| | |
|---|---|
| **Actors** | A user holding a verified account creates it and becomes its Administrator. An unverified account cannot. |
| **Traces** | UC-216 (UC-49, UC-196, UC-217, UC-218) · D-1 · D-17 · FR-13, FR-14, FR-190 · NFR-9 · `actors.md` MO |
| **Surfaces** | No monitoring screen is designed (`design_spec.md` OQ-28); S-04's type choice gains the monitoring type, composed as the advisor type was (`design_spec.md` OQ-26 (10)). · S-04 |

**Preconditions.** The user holds a verified account (UC-216).

**Behaviour.**
1. The organization is created against the same generic relationship model as a direct SME organization (FR-14, UC-49); what differs is the type it may hold, not its schema (UC-216 rule).
2. **The organization's own type is the column part 10 introduced** (FR-190 beh. 2), holding a key of the registered vocabulary. Registering `monitor` is configuration and not a migration (NFR-9).
3. Creation grants the creating user the Administrator role in the same act, mirroring D-1; **that role is `organization_administrator`** read as `MO` for an organization of this type, as for `AD` (182/2).
4. Whether a monitoring organization may hold reporting entities and periods of its own is **not decided** (OQ-16). Until it is, nothing here forbids or builds them.

**Refusals.** Creation from an unverified account → not available (UC-216 precondition). The wire forms are named when built.

**Configuration-held values.** The organization types are the `organization_relationship_type` vocabulary (`config/seed/organization-relationship-type.global.json`); registering the monitoring type is configuration (NFR-9).

**Boundaries.** Officers are FR-214. Adding a client is FR-215. Reading a client's report is FR-225, in the client's context and never in this organization's.

**Acceptance criteria.**
- **AC-1** Given a verified account, when it creates an organization of the monitoring type, then the organization exists and the creating user holds the Administrator role over it. *(source: FR text; UC-216)*
- **AC-2** Given an unverified account, then creating a monitoring organization is not available. *(source: UC-216 precondition; FR-13)*
- **AC-3** Given the monitoring type is registered as configuration data, then no schema migration is required to create an organization of that type. *(source: NFR-9; FR-14; UC-216 rule)*

**History.**
- 17 Nov 2026 · project owner · added with UC-216 … UC-235 and the `MO` actor · index §3.35; `use_cases.md` §4.7; `architecture.md` §12.5.6 monitoring row

### FR-214 — Officers and their assigned clients

**Status.** Not started — delivered none · remaining 245.2, 245.3

**Obligation.** The system shall allow a Monitoring Organization Administrator to invite officers into the monitoring organization, remove them and change their role, and to limit each officer to assigned clients; an officer with no limit sees all clients, and an officer's board, combined numbers and openings of reports cover only their assigned clients.

| | |
|---|---|
| **Actors** | The Administrator invites, removes and limits. An officer outside a client's assignment is refused it. |
| **Traces** | UC-217 (UC-15, UC-60, UC-197, UC-219, UC-228 … UC-230) · D-17 · FR-57, FR-191 · monitoring row (5) · `actors.md` MO |
| **Surfaces** | None designed; the invitation and the assignment control are S-16's, composed from the shared archetypes as the advisor's staff scope is (FR-191). · S-16 |

**Preconditions.** A monitoring organization exists (UC-217).

**Behaviour.**
1. The Administrator invites a colleague, removes one and changes a role by the organization invitation of UC-15 and UC-60, and the member operations of FR-58 and FR-59 (UC-217 step 1).
2. The Administrator may limit an officer to **assigned clients**, choosing which roster clients they follow (step 2). **By default an officer sees all clients** — the opposite default to FR-191's, by the owner's decision (monitoring row (5)). The Administrator is bound by no assignment and sees every client, as the Advisor Administrator does (FR-191 beh. 2).
3. The limit is enforced by the server wherever the officer reads — the board (FR-223), the figures (FR-224), the exports (FR-227) and the entry (FR-225) — and not by hiding entries in the interface (UC-217 step 3).
4. Which acts beyond reading an officer holds is **not decided** (OQ-17).

**Refusals.** An officer outside a client's assignment who asks for its report, or names it directly rather than through the interface → refused (UC-217 rule). The wire forms are named when built.

**Boundaries.** The relationship's grant is FR-218. Entry itself is FR-225.

**Acceptance criteria.**
- **AC-1** Given an invited colleague, then they are a member of the monitoring organization. *(source: FR text; UC-217 step 1)*
- **AC-2** Given an officer with no limit, then their board and combined figures cover every client of the monitor. *(source: monitoring row (5); UC-217 rule)*
- **AC-3** Given an officer limited to assigned clients, then their board, combined numbers and totals cover only those clients, and a request that names another client directly is refused. *(source: FR text; UC-217 step 3; monitoring row (5))*
- **AC-4** Given the Administrator, then the roster, the board and the figures cover every client whatever any officer's assignment is. *(source: UC-217 rule; FR-191 beh. 2)*

**History.**
- 17 Nov 2026 · project owner · added with UC-217; default is all clients, the reverse of FR-191's · monitoring row (5)

### FR-215 — Add a client and request access

**Status.** Not started — delivered none · remaining 245.1, 245.3

**Obligation.** The system shall allow a monitoring organization to add a client company by its IDNO and a contact email, creating a relationship in a pending state that confers no access to any of the client's data, notifying the company's Organization Administrator if the company is on the platform and otherwise inviting it by email to register, the request waiting until the organization exists.

| | |
|---|---|
| **Actors** | The Administrator adds the client. The client's Organization Administrator is notified, or the company is invited. |
| **Traces** | UC-218 (UC-198, UC-219, UC-221, UC-222, UC-235) · D-17 · FR-16, FR-192, FR-228 · monitoring row (11) · `actors.md` MO |
| **Surfaces** | None designed; the add-a-client form, composed from the shared archetypes as the advisor's request form is. · S-45 |

**Preconditions.** A monitoring organization exists (UC-218).

**Behaviour.**
1. The Administrator gives the company's IDNO and a contact email (UC-218 step 1).
2. The system creates a relationship in `pending` state (step 2).
3. If the company is on the platform, its Organization Administrator receives the request (step 3; FR-228). If it is not, the email **invites the company to register**, and the request is waiting once the organization exists (step 4).
4. **A pending relationship confers no access of any kind**, and nothing is shared until the client's Organization Administrator grants (FR-218). There is no path by which a monitor attaches itself to an organization (D-17).
5. How an IDNO identifies the client organization, whether the answer to the monitor is the same whether or not the company is on the platform (NFR-64), whether the advisor's one-open-relationship rule and throttle (FR-192 beh. 6) carry over, and what bounds the invitation email are **not decided** (OQ-15).

**Refusals.** Not decided beyond OQ-15. The wire forms are named when built.

**Boundaries.** The client's reply is FR-218. The roster is FR-216. The notice is FR-228's.

**Acceptance criteria.**
- **AC-1** Given a monitoring organization, an IDNO and a contact email, when the Administrator adds the client, then a relationship in `pending` state exists. *(source: FR text; UC-218 step 2)*
- **AC-2** Given a pending relationship, then no user of the monitoring organization can read any record of the client. *(source: FR text; UC-218 rule; D-17)*
- **AC-3** Given a company on the platform, then its Organization Administrator is notified of the request. *(source: UC-218 step 3; monitoring row (11))*
- **AC-4** Given a company not on the platform, then the email invites it to register and the request is waiting once the organization exists. *(source: UC-218 step 4; monitoring row (11))*
- **AC-5** Given a pending relationship, then nothing is shared until the client grants. *(source: monitoring row (11); D-17)*

**History.**
- 17 Nov 2026 · project owner · added with UC-218 · monitoring row (11)

### FR-216 — The client roster

**Status.** Not started — delivered none · remaining 245.1, 245.3

**Obligation.** The system shall present to the Administrator a roster of every client company the monitor has added or been granted access to, and to an officer the clients assigned to them, each with its relationship state, the date on which the grant ends where one was set, and, for a pending request to a company not yet registered, that it has not registered.

| | |
|---|---|
| **Actors** | The Administrator reads all; an officer reads the clients assigned to them. |
| **Traces** | UC-219 (UC-199, UC-217, UC-218, UC-225) · FR-193, FR-214 · `actors.md` MO |
| **Surfaces** | The roster, on the Inventory archetype as the advisor's roster is. · S-44 |

**Preconditions.** A monitoring organization exists (UC-219).

**Behaviour.**
1. The roster lists every client the monitor has added or been granted (UC-219 step 1), limited for an officer by FR-214.
2. **The states are the advisor roster's, carried over whole:** `pending`, `active`, `revoked`, `expired`, `declined`, `ended` (UC-219 step 2; FR-193 beh. 2).
3. A client the monitor has no access to is named by its organization name only (UC-219 rule). **No plan is shown**, since no monitoring plan exists (`use_cases.md` §7.1).
4. It is built on the shared Inventory skeleton.

**Boundaries.** Ending a relationship is FR-217. The board is FR-223.

**Acceptance criteria.**
- **AC-1** Given clients the monitor has added and been granted, then every one is listed, a pending one included. *(source: FR text; UC-219 step 1)*
- **AC-2** Given a roster entry, then it shows its state among the six, and the end date where one was set. *(source: FR text; UC-219 step 2)*
- **AC-3** Given an officer limited to assigned clients, then the roster lists only those. *(source: FR-214; monitoring row (5))*
- **AC-4** Given a pending request to a company not on the platform, then the entry says it has not registered. *(source: UC-219 step 2; monitoring row (11))*

**History.**
- 17 Nov 2026 · project owner · added with UC-219; the states carried over from FR-193 · monitoring row (11)

### FR-217 — End a relationship from the monitor's side

**Status.** Not started — delivered none · remaining 245.1, 245.3

**Obligation.** The system shall allow a Monitoring Organization Administrator to end a client relationship, or withdraw a request not yet answered, without requiring an action by the client, removing the monitor's shared figures for that client and telling the client's Organization Administrators.

| | |
|---|---|
| **Actors** | The Administrator. No action by the client. |
| **Traces** | UC-220 (UC-200, UC-203, UC-234, UC-235) · FR-194, FR-229 · `actors.md` MO |
| **Surfaces** | None designed; the ending, composed as the advisor roster's is. · S-44 |

**Preconditions.** An active or pending relationship exists with the client (UC-220).

**Behaviour.**
1. The Administrator removes the client, and the system terminates the relationship without an action from the client (UC-220 steps 1, 2).
2. The relationship takes the state `ended`, as does a pending request withdrawn (UC-220 rule; FR-194 beh. 4).
3. An officer session already inside the client ends at its next action, as for a revocation (FR-219).
4. The monitor's shared figures for that client are removed (step 3; FR-229).
5. The client's Organization Administrators are told (FR-228). What the monitor has already downloaded or exported is outside the platform and is not recalled.

**Boundaries.** The client's own withdrawal is FR-219. The removal is FR-229's.

**Acceptance criteria.**
- **AC-1** Given an active relationship, when the Administrator ends it, then it terminates with no action by the client. *(source: FR text; UC-220 step 2)*
- **AC-2** Given an ended relationship, then no user of the monitor can open the client's report and the monitor's figures for it are gone. *(source: UC-220 step 3; D-18)*
- **AC-3** Given a pending relationship, when the Administrator ends it, then the request is withdrawn and takes the state `ended`. *(source: UC-220 precondition; FR-194)*
- **AC-4** Given an engagement the monitor ended, then the client's Organization Administrators are notified. *(source: UC-220 rule)* Unmet until 251.1.

**History.**
- 17 Nov 2026 · project owner · added with UC-220 · monitoring row (6)

### FR-218 — Grant or decline a monitoring access request

**Status.** Not started — delivered none · remaining 246.1, 246.2

**Obligation.** The system shall allow an Organization Administrator to grant a pending monitoring request as read-only access to the report the client names, with an optional end date, or to decline it with an optional reason, recording the declined request rather than deleting it.

| | |
|---|---|
| **Actors** | The client's Organization Administrator. Other roles are not granted this capability (`actors.md` §5). |
| **Traces** | UC-221, UC-222 (UC-201, UC-202, UC-218, UC-227, UC-235) · D-17 · FR-195, FR-196 · monitoring row (3), (9), (10) · `actors.md` MO |
| **Surfaces** | The client's review of a request. Provisional (`design_spec.md` OQ-28). · S-16 |

**Preconditions.** A pending monitoring relationship exists against the organization (UC-221, UC-222).

**Behaviour.**
1. The Administrator reviews the request: which monitoring organization, requested by whom, when (UC-221 step 1).
2. The Administrator optionally sets a date on which the access expires automatically (step 2). It is a calendar date in the organization's timezone with its last day included, and a date before today is refused, as FR-195 beh. 3 defines it (monitoring row (10); UC-221 rule).
3. The system activates the relationship **read-only** (step 3). **Granting opens the relationship and not a report:** no report is readable until the client names one (FR-222).
4. **The grant carries no entity scope.** The bound is the one named report, not a set of entities (UC-221 rule; D-17).
5. **A client may grant several monitoring organizations, each separately** (monitoring row (9)).
6. The monitor can never edit, file or export on the client's behalf (D-17).
7. The Administrator may decline with an optional reason (UC-222 step 1). The decline is recorded, and the outcome returns to the monitor (FR-228). A declined request is recorded rather than deleted, so repeated unsolicited requests show as a pattern (UC-222 rule).

**Refusals.** A grant, a decline or a change by a member who is not an Organization Administrator → refused (`actors.md` §5). An end date before today → refused as FR-195's is. The wire forms are named when built.

**Boundaries.** Revoking is FR-219. Naming a report is FR-222. The notice is FR-228's.

**Acceptance criteria.**
- **AC-1** Given a pending request, when the Administrator grants it, then the relationship is active, read-only, and reveals no report. *(source: FR text; UC-221 step 3 and rule)*
- **AC-2** Given a grant with an end date, then it is recorded against the relationship, and access ends at the start of the following day in the organization's timezone. *(source: UC-221 step 2; FR-195 beh. 3; monitoring row (10))* Unmet until 246.1.
- **AC-3** Given a pending request, when the Administrator declines it with or without a reason, then the decline is recorded and remains visible with its date. *(source: UC-222; FR-196)*
- **AC-4** Given a client that has granted two monitoring organizations, then each grant stands and falls on its own. *(source: monitoring row (9))*
- **AC-5** Given a member who is not an Organization Administrator, then the grant is refused. *(source: `actors.md` §5; UC-221 actor)*
- **AC-6** Given a granted relationship, then the monitor can neither edit, file nor export on the client's behalf. *(source: D-17; FR text)*

**History.**
- 17 Nov 2026 · project owner · added with UC-221 and UC-222; read-only, no entity scope, several monitors · monitoring row (3), (9), (10)

### FR-219 — Revoke monitoring access, or let it expire

**Status.** Not started — delivered none · remaining 246.1, 246.2

**Obligation.** The system shall allow an Organization Administrator to revoke an active monitoring relationship at any time with immediate effect, withdrawing access at the monitor's next request, terminating any officer session then inside at its next action and removing the monitor's shared figures for the client; and shall end the relationship automatically on its end date.

| | |
|---|---|
| **Actors** | The client's Organization Administrator; SYS at the end date. |
| **Traces** | UC-223 (UC-203, UC-210, UC-221, UC-224, UC-234, UC-235) · D-17 · FR-197, FR-203, FR-229 · AD-12 · monitoring row (3), (10) · `actors.md` MO |
| **Surfaces** | The client's access view (FR-220); where a terminated session lands. · S-16 · S-37 |

**Preconditions.** An active monitoring relationship exists (UC-223).

**Behaviour.**
1. The Administrator revokes the relationship (UC-223 step 1); the relationship takes the state `revoked`.
2. Access is withdrawn at the monitor's next request, not at the next login, as FR-197 does (step 2; UC-223 rule).
3. Any officer session inside is terminated at its next action with the reason shown, the session's active organization cleared and the user left signed in on S-37 (step 3; FR-197 beh. 2).
4. The monitor's shared figures for the client are removed (step 4; FR-229), so they are gone from its board, table and totals.
5. **At the end date** the system ends the relationship with no human action, at the start of the following day in the organization's timezone, and the state is `expired` (UC-223 alternate path; FR-203 beh. 1). Expiry is a scheduled job and not a check on read.
6. Both sides are told, and the lead times before the end date are held in configuration (FR-228).

**Boundaries.** Granting is FR-218. The removal of the copy is FR-229. The notices are FR-228's.

**Acceptance criteria.**
- **AC-1** Given an active relationship, when the Administrator revokes it, then the monitor is refused at its next request. *(source: FR text; UC-223 step 2)*
- **AC-2** Given an officer session inside the client, then it ends at its next action with the reason shown. *(source: UC-223 step 3; FR-197)*
- **AC-3** Given a revoked relationship, then the monitor's figures for that client are removed and appear in no board, table or total. *(source: UC-223 step 4; D-18)*
- **AC-4** Given a relationship with an end date, when the date has passed, then it has ended with no human action and the state is `expired`. *(source: UC-223 alternate path; FR-203 beh. 1)*
- **AC-5** Given any revocation, then it takes effect immediately and not at a later sign-in. *(source: monitoring row (3))*

**History.**
- 17 Nov 2026 · project owner · added with UC-223; expiry carried in the same use case · monitoring row (3), (10)

### FR-220 — Monitoring access beside members and advisors, and who opened a report

**Status.** Not started — delivered none · remaining 246.1, 246.2

**Obligation.** The system shall present to the Organization Administrator, in one place, direct members, advisor organizations and monitoring organizations holding access — each monitor with the report it may read, its end date and the officers currently able to open it — and the record of every opening of the organization's report by an officer.

| | |
|---|---|
| **Actors** | The Organization Administrator reads. |
| **Traces** | UC-224 (UC-59, UC-204, UC-221, UC-223, UC-230) · D-17 · FR-56, FR-198, FR-225 · monitoring row (7) · `actors.md` MO |
| **Surfaces** | The access view of S-16, beside direct members and advisors. · S-16 |

**Preconditions.** The user administers the organization (UC-224).

**Behaviour.**
1. The view shows direct members (UC-59) and advisor organizations (FR-198) as before, and **in the same place** each monitoring organization holding access (UC-224 step 2).
2. For each monitor: the report it may read, the end date where set, and the individual officers currently able to open it.
3. **Each opening of the client's report by an officer is recorded and visible to the client's Administrator** — which officer, of which monitor, which report, when (UC-224 step 3; monitoring row (7)). The record is written by the entry of FR-225.
4. Monitoring access is presented distinctly from direct membership and advisor access, because an organization and a person are revoked by different acts (UC-224 rule).

**Boundaries.** Revoking is FR-219. The opening itself is FR-225.

**Acceptance criteria.**
- **AC-1** Given a monitoring organization holding access, then it appears in the access view with its named report, end date and the officers able to open it. *(source: FR text; UC-224 step 2)*
- **AC-2** Given an officer who opened the client's report, then the view lists that opening with the officer, the monitor, the report and the time. *(source: UC-224 step 3; monitoring row (7))*
- **AC-3** Given a monitor whose access is revoked, then it no longer appears among those holding access, and its earlier openings stay in the record. *(source: UC-224; FR-198 rule that an access path absent here cannot be governed)*

**History.**
- 17 Nov 2026 · project owner · added with UC-224; the opening record is the client's to read · monitoring row (7)

### FR-221 — Ask for a report; change or withdraw the request

**Status.** Not started — delivered none · remaining 247.1, 247.2

**Obligation.** The system shall allow a Monitoring Organization Administrator to ask one or many clients for a report by year, scope (Basic or Comprehensive) and due date, recording one request per client, and to change or withdraw a request.

| | |
|---|---|
| **Actors** | The Administrator asks, changes and withdraws. The client's Organization Administrator is told. |
| **Traces** | UC-225, UC-226 (UC-192, UC-227, UC-234, UC-235) · D-17 · FR-177, FR-228, FR-229 · monitoring row (4) · `actors.md` MO |
| **Surfaces** | The report requests, composed from the shared archetypes. · S-46 |

**Preconditions.** At least one active relationship exists with a client (UC-225); a request exists to be changed or withdrawn (UC-226).

**Behaviour.**
1. The Administrator selects one client or many, and states the year, the scope and the due date (UC-225 steps 1, 2).
2. The system records **one request per client**, each answered separately, and tells each client's Administrator (step 3; FR-228).
3. The scope takes the values of the report-level scope flag (FR-177): Basic and Comprehensive (UC-225 rule).
4. The Administrator may change the year, the scope or the due date, or withdraw a request; the client is told (UC-226 steps 1, 2).
5. **On withdrawal** the monitor's shared figures for that request are removed (UC-226 step 3; FR-229).
6. What a change to the year or the scope does to a request the client has already answered, and in whose timezone the due date is judged, are **not decided** (OQ-12).

**Boundaries.** The client's answer is FR-222. Progress against the request is FR-223.

**Acceptance criteria.**
- **AC-1** Given three selected clients, when the Administrator asks for a report of 2026 at Basic scope due on a date, then three requests exist, one per client. *(source: FR text; UC-225)*
- **AC-2** Given a request, when it is changed, then the client's Administrator is told. *(source: UC-226 step 2)* Unmet until 251.1.
- **AC-3** Given a withdrawn request, then the figures shared against it are removed from the monitor's copy. *(source: UC-226 step 3; D-18)*
- **AC-4** Given a request for a year, then it exposes no other year. *(source: monitoring row (8); D-17)*

**History.**
- 17 Nov 2026 · project owner · added with UC-225 and UC-226 · monitoring row (4)

### FR-222 — Answer a request by naming a report

**Status.** Not started — delivered none · remaining 247.1, 247.2

**Obligation.** The system shall allow a client's Organization Administrator to answer a report request by naming one report, which is all the monitor may read for that request and from which its shared figures are written, and shall say on that report's screen, while the monitor has access, that the named organization can see the report as it is filled in.

| | |
|---|---|
| **Actors** | The client's Organization Administrator names. |
| **Traces** | UC-227 (UC-221, UC-225, UC-230, UC-234) · D-17 · FR-229 · monitoring row (8), (12) · `actors.md` MO |
| **Surfaces** | The naming is provisional on S-16 (`design_spec.md` OQ-28); the notice is on the report screen. · S-16 · S-07 |

**Preconditions.** An active monitoring relationship and a report request exist against the organization (UC-227).

**Behaviour.**
1. The Administrator sees the request — monitor, year, scope, due date (UC-227 step 1) — and **names one report** as the answer (step 2).
2. **One named report per request.** The monitor sees that report and no other, so a request for 2026 exposes no earlier year (UC-227 rule; monitoring row (8); D-17).
3. Naming starts the sharing: the report's figures are written to the monitor's copy (FR-229) and the monitor may open it read-only (FR-225).
4. The client may un-name the report, which ends the sharing for it and removes the monitor's figures (UC-227 rule; FR-229).
5. **While the monitor has access, the client's report screen says that the named organization can see the report as it is filled in** (step 4; monitoring row (12)).
6. Whether the named report must match the request's year and scope is **not decided** (OQ-12).

**Boundaries.** Granting the relationship is FR-218. The sharing is FR-229's. Opening is FR-225.

**Acceptance criteria.**
- **AC-1** Given a request, when the Administrator names a report, then the monitor may read that report. *(source: FR text; UC-227 step 3)*
- **AC-2** Given a named report of 2026, then no earlier year's report is readable by the monitor. *(source: UC-227 rule; monitoring row (8))*
- **AC-3** Given a named report with the monitor's access active, then the report's screen says that the named organization can see it as it is filled in. *(source: FR text; UC-227 step 4; monitoring row (12))*
- **AC-4** Given a report un-named, then the monitor can no longer read it and its figures are removed. *(source: UC-227 rule; D-18)*

**History.**
- 17 Nov 2026 · project owner · added with UC-227; the notice on the report screen · monitoring row (8), (12)

### FR-223 — The portfolio progress board

**Status.** Not started — delivered none · remaining 250.1

**Obligation.** The system shall present to the monitoring organization a board showing, for each report request, whether the client has not started, is in progress with its completion percentage, has filed, or is overdue, with the portfolio's counts, every figure on it saying whether it comes from a draft or a filed report, limited for an officer to their assigned clients.

| | |
|---|---|
| **Actors** | The Administrator reads all; an officer reads their assigned clients. |
| **Traces** | UC-228 (UC-38, UC-206, UC-225, UC-233) · D-18 · FR-41, FR-200, FR-214 · monitoring row (1), (2), (4) · `actors.md` MO |
| **Surfaces** | The board, composed as the advisor's status board is, with a reminder action. · S-47 |

**Preconditions.** At least one active relationship and a request exist (UC-228).

**Behaviour.**
1. For each request the board shows **not started**, **in progress** with its completion percentage, **filed** or **overdue** (UC-228 step 2; monitoring row (4)).
2. Progress is measured **against the request** — its year, scope and due date — and is **live**: a draft in progress counts (monitoring row (2)).
3. The board shows the portfolio's counts of each state, and each figure says whether it is from a draft or from a filed report (UC-228 step 3).
4. The completion percentage is the same roll-up FR-41 and UC-38 compute. **Where the board reads it from, given that the shared figures are numeric only, is not decided** (`architecture.md` OQ-63). What a request shows before the client has named a report is not decided either (OQ-12).
5. The board is limited for an officer by FR-214.

**Boundaries.** The figures table is FR-224. The advisor's board is FR-200 and is unchanged.

**Acceptance criteria.**
- **AC-1** Given a request, then the board shows exactly one of not started, in progress with a percentage, filed or overdue. *(source: FR text; monitoring row (4))*
- **AC-2** Given a client whose report is a draft in progress, then it appears in progress, not absent until it is filed. *(source: monitoring row (2); UC-228 rule)*
- **AC-3** Given an officer limited to assigned clients, then the board and its counts cover only those clients. *(source: FR-214; UC-228 rule)*
- **AC-4** Given the board, then no query backing it selects across organizations. *(source: D-18)*

**History.**
- 17 Nov 2026 · project owner · added with UC-228 · monitoring row (1), (2), (4)

### FR-224 — The combined figures

**Status.** Not started — delivered none · remaining 249.1, 250.2

**Obligation.** The system shall present to the monitoring organization a table of each client's figures and the portfolio's totals, live and including drafts, every numeric figure in the standard being available with Scope 1 emissions, Scope 2 emissions, energy, water, waste, headcount and accidents as the default columns, each figure carrying whether it is from a draft or a filed report and the totals saying how many clients they cover and how much comes from drafts, by queries over rows that belong to the monitor's own tenant.

| | |
|---|---|
| **Actors** | The Administrator reads all; an officer reads their assigned clients. |
| **Traces** | UC-229 (UC-33, UC-228, UC-232, UC-234) · D-18 · FR-214, FR-229 · monitoring row (1), (2), (6), (13) · `actors.md` MO |
| **Surfaces** | The table with its totals, sortable and filterable. · S-48 |

**Preconditions.** At least one named report is shared with the monitor (UC-229).

**Behaviour.**
1. The table has a row per client and a column per figure (UC-229 step 2); **every numeric figure in the standard is available** (monitoring row (13)). The default columns are Scope 1 emissions, Scope 2 emissions, energy, water, waste, headcount and accidents; every other numeric figure can be added by the officer. **This is a recorded assumption** from conversations with prospective banks, to be revisited when a bank confirms (OQ-11, closed 17 Nov 2026).
2. Each figure carries its state — from a draft, or from a filed report (step 3).
3. The totals say how many clients they cover and how much of the total comes from drafts (step 4).
4. The monitor sorts and filters (step 5). **The queries are ordinary tenant-scoped queries over the monitor's own rows** and no query spans tenants (D-18; monitoring row (6)).
5. An officer's table and totals cover only their assigned clients (FR-214).

**Boundaries.** What fills the rows is FR-229. The Excel export is FR-227.

**Acceptance criteria.**
- **AC-1** Given shared clients, then the table shows each client's figures with the default columns and allows any other numeric figure to be added. *(source: FR text; UC-229 step 2; monitoring row (13))*
- **AC-2** Given a figure, then it states whether it is from a draft or a filed report. *(source: FR text; UC-229 step 3; monitoring row (2))*
- **AC-3** Given the totals, then they state how many clients they cover and how much of them comes from drafts. *(source: FR text; UC-229 step 4)*
- **AC-4** Given the table, then no query backing it selects across organizations and none runs under a privilege that bypasses the row-level predicate. *(source: D-18; monitoring row (6))* Unmet until 249.1.
- **AC-5** Given an officer limited to assigned clients, then the totals include no other client's figures. *(source: FR-214; UC-229 rule)*

**History.**
- 17 Nov 2026 · project owner · added with UC-229; default columns recorded as an assumption · monitoring row (1), (2), (6), (13)

### FR-225 — Open a client's report read-only

**Status.** Not started — delivered none · remaining 248.1, 248.2

**Obligation.** The system shall, when an officer opens a client's report, verify that the relationship is active and unexpired, that a report is named for the monitor and that the officer is within their assigned clients, set the tenant context to exactly that one client in a read-only role, record the opening, and allow no edit, filing or export on the client's behalf.

| | |
|---|---|
| **Actors** | An officer, or the Administrator. An officer outside their assignment is refused. |
| **Traces** | UC-230 (UC-16, UC-205, UC-217, UC-224, UC-231) · D-15, D-17, D-18 · FR-199, FR-214, FR-220 · monitoring row (7) · `actors.md` MO |
| **Surfaces** | The named report as the client keeps it, read-only. Where entry lands and what is hidden are not designed (`design_spec.md` OQ-28). · S-07 |

**Preconditions.** An active, unexpired relationship; a named report; an officer within scope (UC-230).

**Behaviour.**
1. The officer selects a client from the roster, the board or the figures (UC-230 step 1).
2. The server verifies the three preconditions (step 2). **Access derives from two facts — membership of the monitor and the monitor's grant — and is stored nowhere else** (monitoring row (7)).
3. The tenant context is set to that **single** client organization in a read-only role (step 3). The mechanism is FR-199's, with the role as the difference.
4. The officer reads the named report, drafts included (step 4). **The monitor sees that report and no other**; how that bound is enforced inside the session is **not decided** (`architecture.md` OQ-62).
5. **The opening is recorded** — officer, monitor, report, time — and is visible to the client's Administrator (step 5; FR-220).
6. What else the read-only role may see — validation findings, the change trail — is **not decided** (OQ-10).

**Refusals.** A relationship that is not active or has expired, no report named, or an officer outside their assignment → refused. The wire forms are named when built, on the shape FR-199 gave.

**Boundaries.** Downloading an export is FR-226. The copy that feeds the figures is FR-229. The client's own edit rights are untouched.

**Acceptance criteria.**
- **AC-1** Given the three preconditions, then entry succeeds and the session's tenant context is exactly one organization. *(source: FR text; UC-230 step 3; D-15)*
- **AC-2** Given a session inside a client, then it can neither edit, file nor export. *(source: D-17; monitoring row (3))*
- **AC-3** Given an expired, revoked, declined, ended or pending relationship, or no named report, then entry is refused. *(source: UC-230 precondition)*
- **AC-4** Given an opening, then it is recorded and visible to the client's Administrator. *(source: UC-230 step 5; monitoring row (7))*
- **AC-5** Given an officer outside their assigned clients and a request that names the client directly, then entry is refused. *(source: FR-214; UC-217)*

**History.**
- 17 Nov 2026 · project owner · added with UC-230; the resolver of FR-199 in a read-only role · monitoring row (7)

### FR-226 — Download a client's export

**Status.** Not started — delivered none · remaining 248.1, 248.2

**Obligation.** The system shall allow an officer inside a client's named report to download the exports that already exist for it, and shall never create an export on the client's behalf.

| | |
|---|---|
| **Actors** | An officer, or the Administrator, under FR-225's conditions. |
| **Traces** | UC-231 (UC-42, UC-43, UC-44, UC-230) · FR-53, FR-225 · monitoring row (14) · `actors.md` MO |
| **Surfaces** | The client's export history, read-only. · S-11 |

**Preconditions.** FR-225's conditions hold and the client has made an export of the named report (UC-231).

**Behaviour.**
1. The officer sees the exports that exist for the named report and downloads one (UC-231 steps 1, 2).
2. The file is the one the client distributed, byte for byte (FR-53).
3. **The monitor downloads and never creates**: UC-42 and UC-43 remain the client's.

**Acceptance criteria.**
- **AC-1** Given an existing export of the named report, then the officer can download it. *(source: FR text; UC-231)*
- **AC-2** Given a session inside a client, then no export can be created. *(source: UC-231 rule; D-17)*
- **AC-3** Given an export of another report of the client, then it is not offered. *(source: monitoring row (8))*

**History.**
- 17 Nov 2026 · project owner · added with UC-231 · monitoring row (14)

### FR-227 — Export the board and the figures

**Status.** Not started — delivered none · remaining 250.3

**Obligation.** The system shall allow the monitoring organization to export the board and the combined figures to Excel, each figure carrying its state and the totals their coverage, limited for an officer to their assigned clients.

| | |
|---|---|
| **Actors** | The Administrator, or an officer. |
| **Traces** | UC-232 (UC-207, UC-228, UC-229) · D-18 · FR-201, FR-214, FR-224 · monitoring row (14) · `actors.md` MO |
| **Surfaces** | The export action on the board and the table. · S-47 · S-48 |

**Preconditions.** The board or the figures are available to the acting user (UC-232).

**Behaviour.**
1. The user exports the board and the figures to Excel (UC-232 step 1).
2. **Unlike the advisor's export (FR-201), this one carries figures**, because they are the monitor's own consented rows (D-18); each carries its state, and the totals their coverage.
3. An officer's export covers only their assigned clients (FR-214).
4. It is the monitor's own file and is not an export of a client's report (FR-226).

**Acceptance criteria.**
- **AC-1** Given the table, when exported, then the file carries each figure with its state, and the totals with how many clients they cover and how much comes from drafts. *(source: FR text; UC-232; monitoring row (14))*
- **AC-2** Given an officer limited to assigned clients, then the file contains no other client's figures. *(source: FR-214)*
- **AC-3** Given a client whose access has been revoked, then the file contains none of its figures. *(source: D-18; FR-219)*

**History.**
- 17 Nov 2026 · project owner · added with UC-232 · monitoring row (14)

### FR-228 — Reminders and notices to both sides

**Status.** Not started — delivered none · remaining 251.1, 251.2

**Obligation.** The system shall allow the Administrator to send a reminder to late clients, and shall notify the client's Organization Administrator of an access request and of a report request or its change or withdrawal, and the monitoring organization of each outcome, of the naming of a report and of its filing, the existing deadline notices also serving a monitor's due date, on the common notification mechanism.

| | |
|---|---|
| **Actors** | The Administrator sends a reminder. SYS raises the notices. The client's Administrators and the monitor receive them. |
| **Traces** | UC-233, UC-235 (UC-168, UC-170, UC-172, UC-173, UC-175, UC-211, UC-228) · FR-157, FR-160 … FR-163, FR-165, FR-203, FR-215, FR-218 … FR-222 · monitoring row (14) · `actors.md` MO |
| **Surfaces** | The notification centre and email; the reminder action on the board. · S-26 · S-47 |

**Preconditions.** A relationship or request changes state, a due date approaches or a named report is filed (UC-235); a client is late against a request (UC-233).

**Behaviour.**
1. The Administrator selects late clients and sends a reminder; each is told (UC-233).
2. The client's Administrator is told of an access request and of a report request, change or withdrawal; the monitor of a grant, decline, revocation, ending or expiry, of the naming of a report and of its filing (UC-235 steps 1, 2).
3. **The existing deadline notices serve a monitor's due date** (step 3; monitoring row (14)). How a request's due date reaches FR-165's schedule is **not decided**, nor are a reminder's recipients, its throttle, or the category's classification; the reasoning that a person may not opt out of being told an outside organization asked to read their drafts is the advisor notices' (FR-203 beh. 4) and is carried over as an assumption (OQ-13).
4. The notices run on the common mechanism and are authored in the three locales, not machine-translated (FR-157).

**Boundaries.** The advisor notices are FR-203. The access acts are FR-215 … FR-222.

**Acceptance criteria.**
- **AC-1** Given late clients selected, when the Administrator sends a reminder, then each selected client is told. *(source: FR text; UC-233)*
- **AC-2** Given an access request or a report request, then the client's Organization Administrator is notified. *(source: UC-235 step 1)*
- **AC-3** Given a grant, decline, revocation, ending or expiry, then the monitoring organization is notified. *(source: UC-235 step 2)*
- **AC-4** Given a named report that is then filed, then the monitor is notified. *(source: UC-235 step 2)*
- **AC-5** Given a request's due date approaching, then the existing deadline notice serves it. *(source: UC-235 step 3; monitoring row (14))*

**History.**
- 17 Nov 2026 · project owner · added with UC-233 and UC-235 · monitoring row (14)

### FR-229 — Keep the shared figures in step

**Status.** Not started — delivered none · remaining 249.1, 249.2, 249.3

**Obligation.** The system shall, while a relationship is active and a report is named against a request, write each numeric figure the client saves, within seconds and through the outbox and worker, to a table that belongs to the monitor's tenant holding client, request, taxonomy element, value and whether it is from a draft or a filed report; shall fill that table when access is granted and a report named and remove its rows when access is revoked, the request withdrawn or the report un-named; and shall report any disagreement between the copy and the source nightly as an operational metric.

| | |
|---|---|
| **Actors** | SYS. |
| **Traces** | UC-234 (UC-35, UC-220, UC-223, UC-226, UC-227, UC-229) · D-18 · AD-2, AD-10, DR-5, DR-10 · FR-224, FR-217, FR-219 · NFR-1 · monitoring row (6) · `actors.md` MO |
| **Surfaces** | No screen of its own; the effect is the combined figures' rows. The write is on the outbox (AD-6). |

**Preconditions.** A relationship is active and a report is named against a request (UC-234).

**Behaviour.**
1. The client's save of a numeric figure of the named report is recorded on the existing outbox, and the worker writes it to the monitor's table within seconds (UC-234 steps 1, 2). How soon is not fixed (`non_functional_requirements.md` OQ-18).
2. The row holds the client, the request, the taxonomy element, the value and the state, draft or filed. **It belongs to the monitor's tenant and carries that tenant's row-level predicate unchanged** (monitoring row (6); AD-2, DR-5).
3. On grant and naming, the report's current figures are written; on revocation, withdrawal or un-naming, the rows are removed (steps 3, 4). A filed mark set or withdrawn changes the state of the rows.
4. Only numeric figures are copied.
5. A nightly job compares the copy with the source and **reports** any disagreement as an operational metric, on the pattern of task 64's billing reconciliation; it does not repair (step 5).
6. **The copy is the consent boundary** (D-18).

**Boundaries.** The figures table is FR-224. The ending and revocation are FR-217 and FR-219.

**Acceptance criteria.**
- **AC-1** Given an active relationship and a named report, when the client saves a numeric figure, then the monitor's table holds it with its state. *(source: FR text; UC-234 steps 1, 2)*
- **AC-2** Given access granted and a report named, then the table holds the report's current figures. *(source: UC-234 step 3)*
- **AC-3** Given access revoked, a request withdrawn or a report un-named, then the table holds none of the corresponding rows. *(source: UC-234 step 4; D-18)*
- **AC-4** Given a session of the monitor's tenant, then no query reaches a client's rows and the isolation probe finds no cross-tenant read. *(source: D-18; AD-2)* Unmet until 249.3.
- **AC-5** Given a copy that disagrees with its source, then the nightly job reports it as an operational metric. *(source: FR text; UC-234 step 5)* Unmet until 249.3.
- **AC-6** Given `BILLING_ENABLED=false`, then monitoring still works. *(source: NFR-1)*

**History.**
- 17 Nov 2026 · project owner · added with UC-234; the shared-figures copy chosen over iteration and over widening the policy · `architecture.md` §12.5.6 monitoring row (6)

## 2. Entities held in this part

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Monitoring relationship | FR-14's typed relationship with state (pending, active, revoked, expired, declined, ended), an optional end date, the officers able to open it | FR-215 … FR-220 |
| Report request | Monitoring organization, client, year, scope, due date, the report named in answer | FR-221, FR-222 |
| Shared figure | The monitor's tenant, client, request, taxonomy element, value, draft-or-filed state | FR-224, FR-229 |
| Report opening record | Officer, monitoring organization, report, time | FR-220, FR-225 |
