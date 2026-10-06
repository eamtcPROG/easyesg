# Functional requirements — Part 10: The advisor domain

Part 10 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.32 Advisor domain | FR-190 … FR-203 |

Business rules held here: none. The index's §4 assigns no rule to the advisor domain, and none is invented here; the rules of this domain are carried in the requirements themselves and in `use_cases.md` D-15 and D-16. Entities held here: none. The index's §5 lists no advisor entity, and this part adds none; the relationship an advisor holds with a client is FR-14's typed relationship, extended by the requirements below, not an entity of its own.

Added 11 Sep 2026 with the promotion of Advisor portfolio management out of `use_cases.md` §7.1 into MVP scope and the registration of the `AD` actor. These requirements sit on FR-14, which already models typed organization relationships expressly so the Advisor type can be activated without a schema change; what was missing was the behaviour, not the provision for it. D-15 and D-16 in `use_cases.md` §6.1 govern the group.

**The invariant this part protects.** An advisor session never holds a context spanning two organizations. Entering a client (FR-199) sets the tenant context to exactly that client, so the row-level isolation predicate (AD-2, DR-5) applies unmodified and the cross-tenant probe keeps its meaning. This group introduces **no exception to tenant isolation** (D-15; `use_cases.md` §4.6; `actors.md` AD). The one surface that presents several clients at once, the consolidated board (FR-200), is assembled by iterating the roster with one ordinary scoped query per client, never by a query that spans tenants and never through a privilege that bypasses the predicate. The blocks below cite this rather than restating it.

**Who acts.** The Advisor Administrator (`AD`) holds no authority over any client organization by virtue of the role. Every capability inside a client is exercised as a Reporting Contributor (`RC`), under the entity scope the client's Organization Administrator selected, and is attributed to the advisor user in the client's change history (UC-205; `actors.md` AD). The firm requests and the client grants: **there is no path by which an advisor attaches itself to an organization** (D-15). The client's half (FR-195 … FR-198) belongs to the Organization Administrator alone (`actors.md` §5).

**The state of the group.** No requirement here is built. Every row of tasks 116 … 121 is `TODO` (`task.md`, Stage 8). Tasks 28, 29, 30, 49, 52 and 83, on which the rows depend, are `DONE`: the guard chain, the organization and its typed relationship table, the users screen, the notification core, preferences and the organization switch (`PUT /session/organization`) all exist. Tasks 41, 42, 53, 54, 63 and 68 are open, and task 51 is open in part (`task.md`). `core.org_relationship` today carries `kind` and `organization_type` and has no state, scope or expiry column; `organization_relationship_type` is seeded with `direct_sme` only; no advisor route appears in `packages/contracts/openapi/v1.json`.

**Task coverage.** Four requirements have no sub-step that builds their screen or route: FR-190 (creating the advisor organization), FR-191 (inviting staff and setting scope), FR-192 (the request form) and FR-194 (ending an engagement). Their only task was the parent row 116, which cites FR-190 … FR-197 without cutting a sub-step for the advisor's own screens. That is settled (§12.5.6 task-182 advisor row, 182/168): 116.5 builds the creation screen, 116.6 the invitation and the scope control, 116.7 the request form and 116.8 the ending of an engagement, with 119.3 for the client's revoke control, 119.4 for changing a grant and 119.5 for the access code. None has an artboard (`design_spec.md` §1.4), so each is composed from the shared archetypes, as 118.1 composes the roster. Tasks 118 and 119 build the roster, entry, board, export and the client's half.

## 1. Advisor domain (index §3.32)

### FR-190 — The advisor organization

**Status.** Not started — delivered none · remaining 116.4 (the organization's own type), 116 (116.1), 116.5 (the creation screen)

**Obligation.** The system shall allow an organization of the advisor type to be created from a verified account, shall automatically grant the creating user the Advisor Administrator role over it, and shall hold no reporting entities or reporting periods against it.

| | |
|---|---|
| **Actors** | A user holding a verified account creates it and becomes its Advisor Administrator. An unverified account cannot. |
| **Traces** | UC-196 (UC-49, UC-197, UC-198) · D-1 · D-15 · FR-13, FR-14 · NFR-9 · `actors.md` AD |
| **Surfaces** | No advisor screen is designed (`design_spec.md` §1.4 lists advisor portal surfaces as not designed); 116.5 builds one from the shared archetypes (§12.5.6 task-182 advisor row, 182/168). `POST /organizations` exists for the direct SME and takes no organization type today; it gains an optional one (116.4). · S-04 |

**Preconditions.** The user holds a verified account (UC-196).

**Behaviour.**
1. The organization is created against the same generic relationship model as a direct SME organization (FR-14, UC-49). What differs is the relationship type it may hold, not its schema (UC-196 rule).
2. The type is selectable on FR-14's typed relationship rather than in a table of its own. **The organization's own type is a column on `core.organization`**, holding a key of the registered vocabulary and set at creation. It is the one migration this group needs (116.4), and task 116.1 adds none (§12.5.6 task-182 identity and organization row, 182/8).
3. Creation grants the creating user the Advisor Administrator role in the same act (UC-196 step 2), mirroring D-1. **That role is `organization_administrator`**: the Advisor Administrator is the administrator of an organization of the advisor type, not a fourth value of the role vocabulary (§12.5.6 task-182 identity and organization row, 182/2; `architecture.md` §6.5).
4. An advisor organization produces no reports of its own and holds no reporting entity and no reporting period. The server refuses their creation against it (UC-196 rule; task-116.1 row). A direct SME organization is created with its first reporting entity in the same transaction (§12.5.6 task-175 row (3)); it does **not** apply to the advisor type, which founds none (§12.5.6 task-182 identity and organization row, 182/8).

**Refusals.**
- Entity or period creation against an advisor organization → 409, with a problem type of its own that says the organization holds no reports; a state refusal, as `entity-archived` is (task-116.1 row; §12.5.6 task-182 advisor row, 182/147)
- Creation from an unverified account → not available (UC-196 precondition)

**Configuration-held values.** The organization types are the `organization_relationship_type` vocabulary (`config/seed/organization-relationship-type.global.json`, scope `global`). It holds `direct_sme` only today. Registering `advisor` is configuration, with zero schema migrations (NFR-9; task-116.1 row).

**Boundaries.** Inviting staff is FR-191. Requesting a client is FR-192. The firm's plan is FR-202. Reporting on a client's behalf is FR-199, in the client's context and never in this organization's.

**Acceptance criteria.**
- **AC-1** Given a verified account, when it creates an organization of the advisor type, then the organization exists and the creating user holds the Advisor Administrator role over it. *(source: FR text; UC-196)*
- **AC-2** Given an unverified account, then creating an advisor organization is not available. *(source: UC-196 precondition; FR-13)*
- **AC-3** Given an advisor organization, when a reporting entity is created against it, then the server refuses with 409 and nothing is stored. *(source: FR text; task-116.1 row; §12.5.6 task-182 advisor row, 182/147)*
- **AC-4** Given an advisor organization, when a reporting period is created against it, then the server refuses with 409 and nothing is stored. *(source: FR text; task-116.1 row; §12.5.6 task-182 advisor row, 182/147)*
- **AC-5** Given the advisor type is registered as configuration data, then no schema migration is required to create an organization of that type. *(source: task-116.1 row; NFR-9; FR-14)*
- **AC-6** Given a newly created advisor organization, then it holds no reporting entity. *(source: FR text; §12.5.6 task-182 identity and organization row, 182/8)* Unmet until 116.4 and 116.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 and the `AD` actor · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the Advisor Administrator is the organization administrator of an advisor-type organization; the organization records its own type; an advisor organization founds no entity · §12.5.6 task-182 identity and organization row (182/2, 182/8)

### FR-191 — Advisor staff and their client scope

**Status.** Not started — delivered none · remaining 116.6 (the invitation, the scope record and its control), 117.1 (the enforcement at entry)

**Obligation.** The system shall allow an Advisor Administrator to invite staff into the advisor organization and to set, per staff member, which clients on the roster that staff member may enter, enforcing the restriction at the point of entry rather than by omission from the interface.

| | |
|---|---|
| **Actors** | The Advisor Administrator invites and sets scope. A staff member outside a client's scope is refused entry to it. |
| **Traces** | UC-197 (UC-15, UC-60, UC-199, UC-205) · D-15 · FR-57 · `actors.md` AD |
| **Surfaces** | None designed; 116.6 builds the invitation and the scope control from the shared archetypes (182/168). The check runs on the entry route of FR-199. · S-16 |

**Preconditions.** An advisor organization exists (UC-197).

**Behaviour.**
1. The Administrator invites a colleague into the advisor organization (UC-197 step 1). The invitation mechanism is the organization invitation of UC-15 and UC-60 (related UCs); the role a colleague receives is `editor` or `viewer` (§12.5.6 task-182 identity and organization row, 182/2).
2. The Administrator sets, per staff member, which roster clients that person may enter (step 2). **A staff member's scope defaults to no client**, mirroring FR-195's default: a newly invited colleague, and a client that has just become active, are reachable by no staff member until the Administrator adds them. **The Administrator is not bound by this scope** and may enter every active client; the roster and the board (FR-193, FR-200) are the Administrator's alone (§12.5.6 task-182 advisor row, 182/144).
3. The scope is enforced when the staff member attempts to switch into a client (UC-205), by the server and not by hiding entries in the interface (UC-197 rule; FR text).
4. Entry needs both the client's grant (FR-195) and this per-staff scope (UC-205 step 2).

**Refusals.** A staff member outside a client's scope, requesting entry → 403 `advisor-access-refused`, its `standing` member naming the staff scope (FR text; task-117.1 row; §12.5.6 task-182 advisor row, 182/147)

**Configuration-held values.** The staff-seat ceiling is an entitlement key of the Advisor plan (FR-202), counted as task 142 counts seats: members plus the invitations that hold one (§12.5.6 task-182 advisor row, 182/149).

**Boundaries.** The client's grant is FR-195. Entry itself is FR-199.

**Acceptance criteria.**
- **AC-1** Given an invited colleague, then they are a member of the advisor organization. *(source: FR text; UC-197 step 1)*
- **AC-2** Given a staff member outside a client's scope, when they request entry to that client, then the server refuses with 403 `advisor-access-refused`. *(source: FR text; UC-197 rule; task-117.1 row; §12.5.6 task-182 advisor row, 182/147)*
- **AC-3** Given the same staff member and a request that names the client directly rather than through the interface, then the server still refuses. *(source: FR text, "rather than by omission from the interface"; UC-197 rule)*
- **AC-4** Given a staff member within a client's scope and an active, unexpired relationship, then entry succeeds. *(source: UC-197 step 3; UC-205 step 2)*
- **AC-5** Given a newly invited staff member, or a client that has just become active, then no staff member can enter that client until the Administrator adds it to their scope. *(source: §12.5.6 task-182 advisor row, 182/144)* Unmet until 116.6.
- **AC-6** Given the Advisor Administrator and an active, unexpired relationship, then entry succeeds whatever any staff member's scope is. *(source: §12.5.6 task-182 advisor row, 182/144)* Unmet until 117.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the firm's staff are `editor` or `viewer`; no new role · §12.5.6 task-182 identity and organization row (182/2)

### FR-192 — Request access to a client organization

**Status.** Not started — delivered none · remaining 116 (116.2), 116.7 (the request form), 119.5 (the access code), 121.1 (the notice to the client)

**Obligation.** The system shall allow an advisor organization to request access to a client organization, creating a relationship in a pending state that confers no access to any of the client's data.

| | |
|---|---|
| **Actors** | The Advisor Administrator requests. The client's Organization Administrator is notified. |
| **Traces** | UC-198 (UC-201, UC-202, UC-211) · D-15 · FR-203 · `actors.md` AD |
| **Surfaces** | None designed; 116.7 builds the request form (182/168). The relationship's states are task 116.2's. · S-41 |

**Preconditions.** An advisor organization exists (UC-198).

**Behaviour.**
1. The Administrator identifies the client by registered email or by a code the client supplied (UC-198 step 1). The email is an Organization Administrator's account email. The code is generated by the client's Organization Administrator on S-16, is single-use, and expires after a lifetime held in configuration. **The answer is the same whether or not anything matched**, so the request cannot be used to learn which organizations exist (NFR-64), and a pending relationship is created only on a match (§12.5.6 task-182 advisor row, 182/145).
2. The system creates a relationship in `pending` state (step 2).
3. **A pending relationship confers no access of any kind.** Nothing of the client's is readable until the request is granted (UC-198 rule; FR text). The pending state is a stored state with no read behind it (task-116.2 row).
4. There is no path by which a firm attaches itself to an organization. The advisor requests and the client grants (D-15).
5. The system notifies the client's Organization Administrator (UC-198 step 3; UC-211).
6. **There is one open relationship per firm and client.** A request while one is pending or active is refused. After a decline, a revocation, an expiry or an ending, a new request is accepted and creates a new relationship, and the earlier ones stay as records, so a pattern of declined requests remains visible (UC-202). A throttle per firm and client, held in configuration, refuses a request made too soon after another (§12.5.6 task-182 advisor row, 182/146). A request that would take the roster past the plan's client quota is refused (FR-202).

**Refusals.**
- A request while a relationship with that client is pending or active → 409 `conflict` (§12.5.6 task-182 advisor row, 182/146)
- A request made too soon after another to the same client → 429 `rate-limited` (182/146)
- A request past the plan's client quota → 409 `entitlement-quota-exceeded`, carrying `limit` and `used` (182/149)
- A request that identifies no client is **not refused**: the answer is the same as for a match and nothing is created (182/145)

**Configuration-held values.** The relationship's states are a closed vocabulary held as an `as const` mirroring a `CHECK` constraint, in the shape task 78.1 established (task-116.2 row), not configuration data.

**Boundaries.** The client's reply is FR-195 and FR-196. The notice is FR-203's.

**Acceptance criteria.**
- **AC-1** Given an advisor organization and a client it has identified, when the Administrator requests access, then a relationship in `pending` state exists. *(source: FR text; UC-198 step 2)*
- **AC-2** Given a pending relationship, then no user of the advisor organization can read any record of the client. *(source: FR text; task-116.2 row)*
- **AC-3** Given a pending relationship, when a user of the firm attempts to enter the client, then entry is refused. *(source: UC-205 precondition, an active relationship; D-15)*
- **AC-4** Given a request is made, then the client's Organization Administrator is notified. *(source: FR text; UC-198 step 3)* Unmet until 121.1.
- **AC-5** Given an email or a code that identifies no client, then the answer is indistinguishable from the answer for a client it identifies, and no relationship is created. *(source: §12.5.6 task-182 advisor row, 182/145)* Unmet until 116.7.
- **AC-6** Given a code, then it identifies its organization once, and not again after it is used or after its lifetime. *(source: §12.5.6 task-182 advisor row, 182/145)* Unmet until 119.5.
- **AC-7** Given a pending or active relationship between the firm and a client, when the firm requests that client again, then the request is refused with 409 `conflict`; given a declined, revoked, expired or ended one, then the request is accepted as a new relationship. *(source: §12.5.6 task-182 advisor row, 182/146)* Unmet until 116.2.
- **AC-8** Given requests to one client made faster than the configured throttle, then the later one is refused with 429 `rate-limited`. *(source: §12.5.6 task-182 advisor row, 182/146)* Unmet until 116.7.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the client is identified by an Organization Administrator's email or a single-use code, the answer is uniform, and there is one open relationship per firm and client · §12.5.6 task-182 advisor row (182/145, 182/146)

### FR-193 — The client roster

**Status.** Not started — delivered none · remaining 116.2, 118.1

**Obligation.** The system shall present to the Advisor Administrator a roster of every client organization the firm has requested or been granted access to, with relationship state, granted entity scope, expiry date where set, and the client's plan.

| | |
|---|---|
| **Actors** | The Advisor Administrator reads it. |
| **Traces** | UC-199 (UC-197, UC-205, UC-209) · FR-202 · `actors.md` AD |
| **Surfaces** | The roster, on the Inventory archetype that task 115 rebuilt (task-118.1 row). No S-nn is assigned in `design_spec.md`. · S-40 |

**Preconditions.** An advisor organization exists (UC-199).

**Behaviour.**
1. The roster lists every client organization the firm has requested or been granted access to (UC-199 step 1).
2. Each entry shows the relationship state, the granted entity scope, the expiry date where one was set, and the client's own plan (step 2). The states are `pending`, `active`, `revoked`, `expired`, `declined` and `ended` (§12.5.6 task-182 advisor row, 182/140). The client's plan is shown for an `active` entry only, read inside that client's own scoped query, because a cross-tenant read before the grant is what D-15 forbids (182/151).
3. The roster is what the Advisor plan's client quota is counted against (UC-199 rule; FR-202). A `pending` or `active` entry counts; a declined, revoked, expired or ended one does not (§12.5.6 task-182 advisor row, 182/149).
4. It is built on the shared Inventory skeleton. A second inventory skeleton is task 115's defect repeated (task-118.1 row).
5. The roster is the Administrator's alone: a staff member reaches a client only by entry, within their scope (§12.5.6 task-182 advisor row, 182/144).

**Boundaries.** The board is FR-200. Entering a client from the roster is FR-199.

**Acceptance criteria.**
- **AC-1** Given a firm that has requested and been granted clients, then every one is listed. *(source: FR text; UC-199 step 1)*
- **AC-2** Given a roster entry, then it shows its state among pending, active, revoked, expired, declined and ended, with its granted scope and any expiry. *(source: FR AC; UC-199 step 2; §12.5.6 task-182 advisor row, 182/140)*
- **AC-3** Given an active roster entry, then it shows the client's own plan; given a pending, declined, revoked, expired or ended entry, then it shows none. *(source: FR text; UC-199 step 2; §12.5.6 task-182 advisor row, 182/151)*
- **AC-4** Given a request that is still pending, then it is listed. *(source: FR text, "requested or been granted")*
- **AC-5** Given a staff member who is not the Administrator, then the roster is refused with 403 `insufficient-role`. *(source: FR text, "to the Advisor Administrator"; §12.5.6 task-182 advisor row, 182/144)*

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the roster has six states, shows the plan for an active entry only, counts pending and active entries, and is the Administrator's alone · §12.5.6 task-182 advisor row (182/140, 182/151, 182/149, 182/144)

### FR-194 — End an engagement from the advisor side

**Status.** Not started — delivered none · remaining 116.8 (the act and its screen)

**Obligation.** The system shall allow an Advisor Administrator to end a client relationship from the advisor side without requiring an action by the client, retaining the attribution of that firm's historical contributions in the client's change history.

| | |
|---|---|
| **Actors** | The Advisor Administrator. No action by the client. |
| **Traces** | UC-200 (UC-47, UC-63, UC-203) · FR-54, FR-59 · `actors.md` AD |
| **Surfaces** | None designed; 116.8 builds it (182/168). · S-40 |

**Preconditions.** An active or pending relationship exists with the client (UC-200).

**Behaviour.**
1. The Administrator removes the client from the roster, and the system terminates the relationship without requiring an action from the client (UC-200 steps 1 and 2).
2. After this the firm's users can no longer enter the client (FR AC). An advisor session already inside the client ends at its next action, as it does for a revocation (FR-197; §12.5.6 task-182 advisor row, 182/143).
3. The firm's historical contributions inside the client stay attributed in the client's change history (UC-47). Ending an engagement must not erase who entered which figure, for the same reason removing a member does not (UC-63; FR-59).
4. The relationship takes the state `ended`, and so does a pending request the firm withdraws. The client's Organization Administrators are told of the ending, as they are told of every one (FR-203; §12.5.6 task-182 advisor row, 182/140).

**Boundaries.** The client's own withdrawal is FR-197. Change-history attribution is FR-54.

**Acceptance criteria.**
- **AC-1** Given an active relationship, when the Administrator ends it, then the relationship terminates with no action by the client. *(source: FR text; UC-200 step 2)*
- **AC-2** Given an ended relationship, then no user of the firm can enter the client. *(source: FR AC)*
- **AC-3** Given field changes the firm's users made inside the client, when the engagement is ended, then the change history still attributes each change to the user who made it. *(source: FR AC; UC-200 rule; FR-54)*
- **AC-4** Given a pending relationship, when the Administrator ends it, then the request is withdrawn, takes the state `ended`, and the firm gains no access. *(source: UC-200 precondition, "active or pending"; §12.5.6 task-182 advisor row, 182/140)*
- **AC-5** Given an engagement the firm ended, then the client's Organization Administrators are notified. *(source: §12.5.6 task-182 advisor row, 182/140)* Unmet until 121.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · an engagement the firm ends takes the state ended, the client is told, and an advisor session inside ends at its next action · §12.5.6 task-182 advisor row (182/140, 182/143)

### FR-195 — Grant an advisor request over a chosen scope

**Status.** Not started — delivered none · remaining 116.2, 116.3, 117.3 (the entity dimension), 119.4 (changing a grant), 119.1

**Obligation.** The system shall allow an Organization Administrator to grant a pending advisor request over a selected set of reporting entities and an optional expiry date, defaulting the entity scope to none.

| | |
|---|---|
| **Actors** | The client's Organization Administrator grants. Other roles are not granted this capability (`actors.md` §5). |
| **Traces** | UC-201 (UC-198, UC-204, UC-210) · D-15 · FR-203 · `architecture.md` OQ-26 · `actors.md` AD |
| **Surfaces** | The client's review of a request (task 119.1). No S-nn is assigned. · S-16 |

**Preconditions.** A pending advisor relationship exists against the organization (UC-201).

**Behaviour.**
1. The Administrator reviews the request: which firm, requested by whom, when (UC-201 step 1).
2. The Administrator selects which reporting entities the grant covers (step 2). **The default scope is no entities.** The Administrator selects what to open rather than deselecting what to withhold, so a careless grant is an empty grant rather than a total one (UC-201 rule). This is a stored default, not a screen convention (task-116.2 row). The entity picker starts empty (task-119.1 row).
3. The Administrator optionally sets a date on which the grant expires automatically (step 3). The date is a calendar date in the organization's timezone and its last day is included: access ends at the start of the following day. A date before today is refused with 400 `validation-failed`, and no upper bound is set. The scheduled job and the entry check use this one definition (FR-203; §12.5.6 task-182 advisor row, 182/142).
4. The system activates the relationship within that scope, and the scope and any expiry are recorded against the relationship (step 4; FR AC).
5. An active relationship with an empty scope reaches no entity (task-116.2 row).
6. Inside the client, the firm's users hold Reporting Contributor rights over the entities the grant covers (UC-205 step 4). **The scope is enforced by the database.** The row-security policy of every entity-scoped table gains an entity dimension, and a request binds the granted entity set as a second setting beside the organization, which stays in every predicate. A direct member's request binds no entity set and is narrowed by nothing (§12.5.6 task-182 advisor row, 182/139).
7. **The Organization Administrator may change the scope and the expiry of an active grant at any time**, a weaker act than the revocation UC-203 allows at any time. The firm is told (FR-203's "changed" notice), and the new scope takes effect at the firm's next request, since the entity set is bound per request (§12.5.6 task-182 advisor row, 182/141).

**Refusals.** A grant or a change by a member who is not an Organization Administrator → 403 `insufficient-role` (`actors.md` §5; §12.5.6 task-182 advisor row, 182/147). An expiry date before today → 400 `validation-failed` (182/142).

**Boundaries.** Declining is FR-196. Revoking is FR-197. Automatic expiry is FR-203. Entry is FR-199.

**Acceptance criteria.**
- **AC-1** Given a pending request, when the Administrator grants it without selecting any entity, then the relationship is active and confers access to no entity. *(source: FR AC; UC-201 rule; task-116.2 row)*
- **AC-2** Given a pending request, when the Administrator grants it over selected entities and an expiry, then the scope and the expiry are recorded against the relationship. *(source: FR AC; UC-201 steps 2 to 4)*
- **AC-3** Given the grant form, then no entity is preselected. *(source: UC-201 rule; task-119.1 row)* Unmet until 119.1.
- **AC-4** Given a grant over entity A and not entity B, then a user of the firm inside the client reaches A and does not reach B. *(source: FR text; UC-205 step 4; task-117.1 row; §12.5.6 task-182 advisor row, 182/139)* Unmet until 117.3 and 117.1.
- **AC-5** Given a member of the client who is not an Organization Administrator, then the grant is refused with 403 `insufficient-role`. *(source: `actors.md` §5; UC-201 primary actor; §12.5.6 task-182 advisor row, 182/147)*
- **AC-6** Given a grant with an expiry date, then access ends at the start of the following day in the organization's timezone, the last day being included. *(source: §12.5.6 task-182 advisor row, 182/142)* Unmet until 116.3.
- **AC-7** Given an expiry date before today, then the grant is refused with 400 `validation-failed` and nothing is stored. *(source: §12.5.6 task-182 advisor row, 182/142)* Unmet until 116.3.
- **AC-8** Given an active grant, when the Organization Administrator changes its scope or expiry, then the new values apply from the firm's next request and the firm is notified. *(source: §12.5.6 task-182 advisor row, 182/141)* Unmet until 119.4.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · a grant's entity scope is an entity dimension of the row-security policy, its expiry is a calendar date in the organization's timezone, and an active grant may be changed · §12.5.6 task-182 advisor row (182/139, 182/142, 182/141)

### FR-196 — Decline an advisor request

**Status.** Not started — delivered none · remaining 116.3, 119.1, 121.1 (the outcome notice)

**Obligation.** The system shall allow an Organization Administrator to decline a pending advisor request with an optional reason, recording the declined request rather than deleting it.

| | |
|---|---|
| **Actors** | The client's Organization Administrator. |
| **Traces** | UC-202 (UC-198, UC-211) · FR-203 · `actors.md` AD |
| **Surfaces** | The client's review of a request (task 119.1). · S-16 |

**Preconditions.** A pending advisor relationship exists against the organization (UC-202).

**Behaviour.**
1. The Administrator declines the request, optionally stating a reason (UC-202 step 1).
2. The system records the decline and returns the outcome to the requesting firm (step 2; UC-211).
3. **A declined request is recorded rather than deleted**, so repeated unsolicited requests from one firm are visible as a pattern (UC-202 rule). The record keeps the decline's date and any stated reason (FR AC).
4. A declined request takes the state `declined`, and the requesting firm's roster shows it (§12.5.6 task-182 advisor row, 182/140).

**Boundaries.** The notice is FR-203's. A later request from the same firm is accepted and creates a new relationship; the declined one stays as a record (FR-192; §12.5.6 task-182 advisor row, 182/146).

**Acceptance criteria.**
- **AC-1** Given a pending request, when the Administrator declines it with or without a reason, then the decline is recorded. *(source: FR text; UC-202 step 1)*
- **AC-2** Given a declined request, then it remains visible to the organization with its date and any stated reason. *(source: FR AC; UC-202 rule; §12.5.6 task-182 advisor row, 182/140)*
- **AC-3** Given a declined request, then the outcome reaches the requesting firm. *(source: FR AC; UC-202 step 2)* Unmet until 121.1.
- **AC-4** Given a declined request, then no user of the firm can enter the client. *(source: UC-205 precondition, an active relationship)*
- **AC-5** Given a declined request, then the requesting firm's roster lists it in the state `declined`. *(source: §12.5.6 task-182 advisor row, 182/140)* Unmet until 118.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · a declined request takes the state declined and shows on the firm's roster · §12.5.6 task-182 advisor row (182/140)

### FR-197 — Revoke advisor access

**Status.** Not started — delivered none · remaining 116.3, 119.3 (the revoke control), 121.1 (the outcome notice)

**Obligation.** The system shall allow an Organization Administrator to revoke an active advisor relationship, withdrawing access at the advisor's next request and terminating any advisor session then inside the organization at its next action.

| | |
|---|---|
| **Actors** | The client's Organization Administrator. |
| **Traces** | UC-203 (UC-62, UC-63, UC-200, UC-204) · D-15 · FR-58, FR-59 · AD-12 · `actors.md` AD |
| **Surfaces** | The client's access view (FR-198). Task 119's description names revoking; neither 119.1 nor 119.2 does, and 119.3 builds the control beside 119.2's view (182/168). · S-16 · S-37 |

**Preconditions.** An active advisor relationship exists (UC-203).

**Behaviour.**
1. The Administrator revokes the relationship (UC-203 step 1).
2. The system withdraws access at the advisor's next request (step 2), **not at the next login**, matching the immediacy already required of a role downgrade (UC-62; FR-58). The role and the organization are read server-side on every request (AD-12), and revocation bites on the next request (task-116.3 row).
3. Any advisor session currently inside the organization is terminated at its next action, with the reason shown (step 3). "Terminated" clears the session's active organization and shows the reason; the user stays signed in and lands on the choose-organization screen (S-37), because the same sign-in may serve other clients and the firm's own organization (§12.5.6 task-182 advisor row, 182/143).
4. The requesting firm is told of the revocation (UC-211).
5. A firm removed mid-engagement loses access at once (UC-203 rule).

**Refusals.** After revocation, the next request from any user of the firm is refused with 403 `advisor-access-refused`, its `standing` member `revoked`, and the reason is shown (FR AC; §12.5.6 task-182 advisor row, 182/147).

**Boundaries.** The advisor's own ending is FR-194. The notice is FR-203's. The state a revoked relationship holds is `revoked` (§12.5.6 task-182 advisor row, 182/140).

**Acceptance criteria.**
- **AC-1** Given a revoked relationship, when any user of the firm makes their next request into the client, then it is refused with 403 `advisor-access-refused`. *(source: FR AC; UC-203 step 2; §12.5.6 task-182 advisor row, 182/147)*
- **AC-2** Given the refusal, then the reason is shown to the user. *(source: FR AC; UC-203 step 3)*
- **AC-3** Given an advisor session inside the client at the moment of revocation, then its active organization is cleared at its next action and the reason is shown, the user staying signed in. *(source: FR text; UC-203 step 3; §12.5.6 task-182 advisor row, 182/143)*
- **AC-4** Given a user of the firm holding a valid sign-in, then revocation takes effect with no re-authentication and without waiting for their next login. *(source: UC-203 rule; FR-58; AD-12)*
- **AC-5** Given a revoked relationship, then it no longer appears among the paths with access in FR-198's view. *(source: FR-198 AC)*
- **AC-6** Given a revoked relationship, then the requesting firm is notified. *(source: UC-211 step 2; task-121.1 row)* Unmet until 121.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · a revoked advisor session loses its active organization and stays signed in, and the next request is a 403 with standing revoked · §12.5.6 task-182 advisor row (182/143, 182/147)

### FR-198 — Advisor access alongside direct members

**Status.** Not started — delivered none · remaining 119.2

**Obligation.** The system shall present to the Organization Administrator, in one place, both direct members and any advisor organizations holding access, with each advisor's granted scope, expiry and the individual advisor users able to enter.

| | |
|---|---|
| **Actors** | The Organization Administrator reads it. |
| **Traces** | UC-204 (UC-59, UC-201, UC-203) · D-15 · FR-56 · `actors.md` AD |
| **Surfaces** | S-16 (Users and access; task 119.2 extends task 30's users screen) |

**Preconditions.** The user administers the organization (UC-204).

**Behaviour.**
1. The Administrator sees direct members as in UC-59, and in the same place any advisor organizations holding access, each with its granted scope, its expiry, and the individual advisor users currently able to enter (UC-204 steps 1 and 2).
2. Advisor access is presented **distinctly from direct membership**, beside the members and not merged into the list, because a firm and a person are revoked by different actions (UC-204 rule; task-119.2 row).
3. "Who can see our ESG data" has one complete answer. An access path that does not appear on this screen is one the client cannot govern (UC-204 rule). The paths counted are those a client-side person or firm holds: direct members and advisor organizations. A platform support-access grant (UC-85) is not listed here; it keeps its own surface and banner (§12.5.6 task-182 advisor row, 182/152).
4. The advisor users able to enter are those within the relationship's staff scope (UC-204; UC-197).

**Boundaries.** Revoking is FR-197. Granting and declining are FR-195 and FR-196.

**Acceptance criteria.**
- **AC-1** Given an organization with direct members and an advisor organization holding access, then the access view lists both together. *(source: FR AC; UC-204)*
- **AC-2** Given an advisor entry, then it shows the granted scope, the expiry where set, and the individual advisor users able to enter. *(source: FR text; UC-204 step 2)*
- **AC-3** Given the access view, then advisor organizations appear beside, and not merged into, the direct-member list. *(source: UC-204 rule; task-119.2 row)*
- **AC-4** Given every path a client-side person or firm holds to the organization's report data, then each appears in the view. *(source: FR AC; UC-204 rule; §12.5.6 task-182 advisor row, 182/152)*

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the access view lists the paths a client-side person or firm holds; support access keeps its own surface · §12.5.6 task-182 advisor row (182/152)

### FR-199 — Entering a client resolves to exactly one tenant

**Status.** Not started — delivered none · remaining 117.3 (the entity dimension), 117.1, 117.2, 118.2

**Obligation.** The system shall, when an advisor user enters a client organization, verify that the relationship is active, unexpired and within that staff member's scope, and shall set the tenant context to exactly one client organization for the resulting session.

| | |
|---|---|
| **Actors** | An advisor user, Administrator or staff, with a relationship granted by the client. |
| **Traces** | UC-205 (UC-16, UC-18, UC-47, UC-197) · D-15 · AD-2 · AD-12 · DR-5 · FR-12 · `architecture.md` OQ-26 · `actors.md` AD |
| **Surfaces** | The organization switcher, which gains the advisor's clients (task 118.2, over 83.2). `PUT /session/organization`, the route of task 83, with the matrix line in `route-permissions.ts` unchanged (task-117.1 row). · S-40 |

**Preconditions.** An active, unexpired relationship exists with the client, and the acting staff member is within its scope (UC-205).

**Behaviour.**
1. Mechanically this is UC-16 with membership resolved through the relationship rather than through a membership record. It is the single extension point the whole advisor group rests on (UC-205 rule). A caller's organizations resolve from memberships **and** active relationships (task-117 row). The session shape and the route matrix do not change (task-117.1 row).
2. The system verifies that the relationship is active, unexpired and within the staff member's own scope (UC-205 step 2).
3. The system sets the tenant context to that single client organization (step 3). **The tenant context of an advisor session is exactly one organization**, so no isolation exception arises (D-15), and a test fails if it is ever two (task-117 row, 117.2).
4. The user works in the client's context as a Reporting Contributor over the entities the grant covers (step 4). The entity scope is enforced by the database: the request binds the granted entity set as a second setting beside the organization, and the row-security policy of each entity-scoped table narrows to it (§12.5.6 task-182 advisor row, 182/139).
5. Actions taken here are attributed to the advisor user in the client's change history (UC-47), not to the client (UC-205 rule; FR-54).
6. Inside the client, the client's plan governs. An advisor working there is bound by the client's plan, not the firm's (D-16).
7. An advisor's clients join the switcher's menu and the current client is marked as any organization is, rather than through a parallel menu (task-118.2 row).

**Refusals.** The relationship inactive, expired, or the staff member out of scope → 403 `advisor-access-refused` at the route (task-117.1 row; §12.5.6 task-182 advisor row, 182/147). Its `standing` member names the relationship's state, or the staff scope where the relationship is active and the staff member is outside it; the member values are fixed when 117.1 builds the route and recorded in §12.5.6.

**Boundaries.** The tenancy mechanism is AD-2 and DR-5 and is not redesigned here. The consolidated board, which reads several clients in one request through a scoped query each, is FR-200. `architecture.md` OQ-26 (permission scoping across a relationship) is closed there for the advisor type by 182/139.

**Acceptance criteria.**
- **AC-1** Given an active, unexpired relationship and a staff member within scope, when they enter the client, then the session's tenant context is that one client organization. *(source: FR text; UC-205 steps 2 and 3)*
- **AC-2** Given a relationship that is pending, revoked, declined or otherwise inactive, when a user of the firm tries to enter, then entry is refused with 403 `advisor-access-refused`. *(source: FR text; task-117.1 row; §12.5.6 task-182 advisor row, 182/147)*
- **AC-3** Given an expired relationship, when a user of the firm tries to enter, then entry is refused with 403 `advisor-access-refused`. *(source: FR text; task-117.1 row; §12.5.6 task-182 advisor row, 182/147)*
- **AC-4** Given a staff member outside the relationship's staff scope, when they try to enter, then entry is refused with 403 `advisor-access-refused`. *(source: FR text; FR-191; §12.5.6 task-182 advisor row, 182/147)*
- **AC-5** Given any advisor session, then its tenant context never spans two organizations, and a test fails if it does. *(source: FR text; task-117.2 row)*
- **AC-6** Given the cross-tenant isolation probe suite, then it passes unmodified with the advisor path present. *(source: D-15; `use_cases.md` §4.6; task-117.2 row)*
- **AC-7** Given a change made by an advisor user inside a client, then the client's change history names the advisor user. *(source: UC-205 rule; FR-54)*
- **AC-8** Given an entity outside the grant's scope, then the advisor user reaches nothing of it. *(source: UC-205 step 4; §12.5.6 task-182 advisor row, 182/139)* Unmet until 117.3 and 117.1.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6, D-15
- 5 Oct 2026 · project owner · entry that is refused is a 403 advisor-access-refused, and the entity scope is enforced by the database · §12.5.6 task-182 advisor row (182/147, 182/139)

### FR-200 — The consolidated client status board

**Status.** Not started — delivered none · remaining 118.3 (over 42.2's roll-up and 41.3)

**Obligation.** The system shall present to the Advisor Administrator a consolidated board showing, for every active client, each reporting entity and open period with due date, days remaining, completion percentage and validation state, assembled by a scoped query per client rather than by a query spanning organizations.

| | |
|---|---|
| **Actors** | The Advisor Administrator. |
| **Traces** | UC-206 (UC-38, UC-56, UC-67, UC-170, UC-199) · D-15 · AD-2 · DR-5 · FR-199 · `actors.md` AD |
| **Surfaces** | The board (task 118.3). No S-nn is assigned. · S-42 |

**Preconditions.** At least one active client relationship exists (UC-206).

**Behaviour.**
1. The board presents, for every active client, each reporting entity and open period with its due date, days remaining, completion percentage and validation state (UC-206 step 2).
2. **It is assembled by iterating the roster and running an ordinary scoped query per client, aggregated in the application.** It is never a query spanning tenants and never run through a privilege that bypasses the isolation predicate (UC-206 rule; D-15; task-118.3 row).
3. Completion and validation are the same roll-up UC-38 computes, read from task 42.2's and not recomputed (UC-206 rule; task-118.3 row). **The completion percentage is derived for display from the roll-up's counts**; the roll-up itself returns counts and a status and never a percentage (FR-41; §12.5.6 task-182 validation row, 182/18).
4. At twenty-five clients or fewer the iteration is immaterial; a summary table is the stated escape hatch if it ever is not, and it carries its own row-level predicate rather than a bypass (task-118.3 row).
5. A client contributes only the entities its grant covers; an active client whose grant covers none appears with a note and no rows. Staff scope does not narrow the board, which is the Administrator's alone (§12.5.6 task-182 advisor row, 182/148 and 182/144). **Days remaining** is whole calendar days from today's date, read in the due date's own timezone, to the due date, negative when overdue: the one definition the deadline notice uses (FR-165; §12.5.6 task-182 notifications row, 182/133). **Completion** is derived for display from the roll-up's counts of resolved, reasoned and outstanding, and the **validation state** is the roll-up's derived status (FR-41; 182/18).

**Boundaries.** Exporting the board is FR-201. Access to the board is an entitlement of the Advisor plan (FR-202).

**Acceptance criteria.**
- **AC-1** Given active client relationships, then the board reflects every active client. *(source: FR AC; UC-206)*
- **AC-2** Given the board is built, then no query backing it selects across organizations. *(source: FR AC; task-118.3 row)*
- **AC-3** Given the board is built, then no query backing it runs under a privilege that bypasses row-level isolation. *(source: FR AC; task-118.3 row)*
- **AC-4** Given an entity and open period of an active client, then the board shows its due date, days remaining, completion percentage and validation state. *(source: FR text; UC-206 step 2)* Unmet until 118.3. Days remaining is counted as FR-165 counts it. *(source: §12.5.6 task-182 notifications row, 182/133)*
- **AC-5** Given a client whose relationship is pending, revoked, declined, expired or ended, then it is not on the board. *(source: FR text, "every active client"; §12.5.6 task-182 advisor row, 182/140)*
- **AC-6** Given an active client whose grant covers entity A and not entity B, then the board shows A and not B. *(source: §12.5.6 task-182 advisor row, 182/148)* Unmet until 118.3.
- **AC-7** Given an active client whose grant covers no entity, then it appears with a note and no rows. *(source: §12.5.6 task-182 advisor row, 182/148)* Unmet until 118.3.
- **AC-8** Given a staff member who is not the Administrator, then the board is refused with 403 `insufficient-role`. *(source: §12.5.6 task-182 advisor row, 182/144)*

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6, D-15
- 5 Oct 2026 · project owner · days remaining is counted in whole calendar days in the due date's own timezone, as the deadline notice counts it · §12.5.6 task-182 notifications row (182/133)

### FR-201 — Export the board as status and deadlines only

**Status.** Not started — delivered none · remaining 118.4

**Obligation.** The system shall restrict the export of the consolidated board to status and deadline metadata, excluding disclosure content.

| | |
|---|---|
| **Actors** | The Advisor Administrator. |
| **Traces** | UC-207 (UC-42, UC-43, UC-206) · D-15 · FR-48, FR-49, FR-200 · `actors.md` AD |
| **Surfaces** | The export action on the board (task 118.4, web and worker). · S-42 |

**Preconditions.** The board is available to the acting user (UC-207).

**Behaviour.**
1. The Administrator exports the board as a spreadsheet (UC-207 step 1). The file is an Excel workbook with the board's own columns: client, entity, period, due date, days remaining, completion percentage and validation state as a word. It carries no validation counts, no element names and no finding text (§12.5.6 task-182 advisor row, 182/153).
2. The export carries **status and deadline metadata only, never disclosure content**, so a single file cannot become an unintended aggregation of several clients' report data (UC-207 rule; task-118.4 row).
3. Exporting a client's report itself remains UC-42 and UC-43 (FR-48, FR-49), performed inside that client's context (UC-207 rule; task-118.4 row).
4. Board export is a key of the Advisor plan (FR-202).

**Boundaries.** The board itself is FR-200. A client's report export stays in FR-49 and its siblings.

**Acceptance criteria.**
- **AC-1** Given an exported board, then the file contains no disclosure field value from any client. *(source: FR AC; UC-207 rule)*
- **AC-2** Given an exported board, then it carries, for each row of the board, the client, entity, period, due date, days remaining, completion percentage and validation state word, and nothing else. *(source: FR text; task-118.4 row; §12.5.6 task-182 advisor row, 182/153)*
- **AC-3** Given a firm whose plan does not grant board export, then the export is not allowed. *(source: FR-202; AD-5)*
- **AC-4** Given an exported board, then it contains no count of findings, no taxonomy element name and no finding text. *(source: §12.5.6 task-182 advisor row, 182/153)* Unmet until 118.4.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-196 … UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · the board export carries the board's columns, completion as a percentage and validation as a state word, and no counts, element names or finding text · §12.5.6 task-182 advisor row (182/153)

### FR-202 — The Advisor plan, evaluated on the advisor organization

**Status.** Not started — delivered none · remaining 120.1, 120.2, 120.3

**Obligation.** The system shall support an Advisor plan whose entitlement keys — roster size, advisor staff seats, board access and board export — are evaluated against the advisor organization, and shall not permit any key of that plan to raise the entitlements of a client organization.

| | |
|---|---|
| **Actors** | The Billing Operator defines the plan (UC-208). The Advisor Administrator views plan, quota and invoices (UC-209). |
| **Traces** | UC-208, UC-209 (UC-89 … UC-92, UC-96, UC-148, UC-65, UC-66, UC-132, UC-199) · D-16 · D-12 · AD-5 · FR-99 · FR-100 · NFR-1 · NFR-17 · `actors.md` AD |
| **Surfaces** | A-09 gains the advisor plan and its keys (task 120.3). The firm's billing screens, over task 63's (task 120.2). · S-40 · S-41 · S-42 |

**Preconditions.** The plan catalogue is available (UC-208). The advisor organization holds a subscription (UC-209).

**Behaviour.**
1. The Billing Operator defines the Advisor plan as a plan version, sets its advisor-scoped keys (maximum clients on the roster, advisor staff seats, access to the consolidated board and its export) and its price per currency and cycle (UC-208 steps 1 to 3). The plan is administrable in the console without a release (task-120.3 row; AD-4).
2. **Every key is evaluated on the advisor organization** (D-16). No key raises the entitlements of any client organization. A client on Free remains on Free, including while the advisor is working inside it. An advisor working in a client is bound by the client's plan (D-16; UC-208 rule).
3. **D-16 is the acceptance test** (task-120.1 row): a client organization on Free exhibits Free entitlements while an advisor on a paid plan is working inside it.
4. `BILLING_ENABLED=false` must still permit advisor work (task-120.1 row; NFR-1; AD-5).
5. The Administrator sees the plan version in force, the roster count against the client quota, and the staff seats used, and sees the firm's own invoice history (UC-209 steps 1 and 2). The firm receives **one invoice for its own subscription**, not a view into its clients' billing (UC-209 rule; task-120.2 row). Subscription lifecycle actions reuse UC-96 onward unchanged.
6. **The roster quota counts pending and active entries and bites at request time:** a request past it is refused with 409 `entitlement-quota-exceeded`, carrying `limit` and `used`, and a declined, revoked, expired or ended entry releases its place (§12.5.6 task-182 advisor row, 182/149). **Staff seats** are counted as task 142 counts them, members plus the invitations that hold a seat, against the plan's staff-seat key; task 120.1 records it. **The Advisor plan is a catalogue plan bought at self-serve checkout** over task 63's, not an Enterprise contract (182/150).
7. **Sponsorship, an Advisor plan lifting the entitlements of the clients on its roster, is not an MVP capability.** It would need the entitlement resolver to accept a relationship as a further override source (D-16; `use_cases.md` §7.1).

**Configuration-held values.** The four keys are strings registered in configuration (AD-5). None of the four identifiers is named by a source. The plan and its prices are plan-catalogue data (FR-84 … FR-87).

**Boundaries.** The entitlement service is FR-99. The plan catalogue is FR-84 … FR-89. Enterprise contract provisioning is FR-142.

**Acceptance criteria.**
- **AC-1** Given a client organization on Free and an advisor on a paid plan working inside it, then the client exhibits Free entitlements. *(source: FR AC; D-16; task-120.1 row)*
- **AC-2** Given any key of the Advisor plan, then it does not raise any client organization's entitlements. *(source: FR text; D-16; task-120.1 row)*
- **AC-3** Given the four keys, then each is evaluated against the advisor organization. *(source: FR text; D-16)*
- **AC-4** Given the firm's subscription, then the firm receives one invoice for it. *(source: FR AC; UC-209 rule)*
- **AC-5** Given the billing context disabled, then advisor work is still permitted. *(source: task-120.1 row; NFR-1; AD-5)*
- **AC-6** Given the Administrator opens the firm's billing view, then it shows the plan version in force, the roster count against the client quota, the staff seats used and the firm's invoices. *(source: UC-209 steps 1 and 2; task-120.2 row)*
- **AC-7** Given a change to the plan's keys or price, then it is made as data with no release. *(source: task-120.3 row; AD-4; NFR-17)*
- **AC-8** Given the roster reaches the plan's client quota, then a further request is refused with 409 `entitlement-quota-exceeded` and nothing is stored. *(source: §12.5.6 task-182 advisor row, 182/149)* Unmet until 120.1.
- **AC-9** Given the Advisor plan, then it is offered at self-serve checkout. *(source: §12.5.6 task-182 advisor row, 182/150)* Unmet until 120.2.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-208 and UC-209 and D-16 · index §3.32; `use_cases.md` §4.6, §6.1
- 5 Oct 2026 · project owner · the client quota counts pending and active entries and bites at request time, and the Advisor plan is bought at self-serve checkout · §12.5.6 task-182 advisor row (182/149, 182/150)

### FR-203 — Expiry, and notice of every change of access

**Status.** Not started — delivered none · remaining 116.3 (the expiry job), 121.1

**Obligation.** The system shall end an advisor relationship automatically on its expiry date and shall notify the client's Organization Administrator and the advisor firm of a request and of each subsequent grant, change, decline, revocation, ending or expiry, as a transactional notification category.

| | |
|---|---|
| **Actors** | SYS ends the relationship and raises the notices. The client's Organization Administrator and the advisor firm receive them. |
| **Traces** | UC-210, UC-211 (UC-168, UC-172, UC-173, UC-198, UC-201 … UC-203) · FR-157, FR-160 … FR-163, FR-166 · `actors.md` AD |
| **Surfaces** | The notification centre and email (task 121.1). No screen of its own. · S-16 · S-26 |

**Preconditions.** For expiry, the relationship carries an expiry date set at the grant (UC-210; FR-195). For a notice, an advisor relationship changes state (UC-211).

**Behaviour.**
1. The system ends the relationship on its expiry date with no human action (UC-210 step 1). Expiry is a scheduled job over the outbox, not a check performed on read; an expiry nobody evaluates is one that did not happen (task-116.3 row). The date is a calendar date in the organization's timezone, its last day included, so the relationship ends at the start of the following day; the job and the entry check use that one definition (FR-195; §12.5.6 task-182 advisor row, 182/142).
2. The system notifies both the client and the firm in advance and on expiry (UC-210 step 2). The lead times are held in the notification category's configuration, as every lead time is (§12.5.6 task-182 notifications row, 182/132); the schedule is 14 days and 1 day before the date, each its own notice, and no notice repeats beyond its schedule. Recipients are in step 3 (§12.5.6 task-182 advisor row, 182/154).
3. There are eight notices: requested, granted, changed, declined, revoked, ended, expiring and expired (task-121.1 row, amended by 182/141, 182/140 and 182/154). **Every Organization Administrator of the client** is told of a request and of an ending by the firm; **the firm's Advisor Administrator** is told of a grant, a change, a decline and a revocation; **both** are told of an expiring and of an expired relationship (UC-211 steps 1 and 2, extended).
4. **The category is transactional, so it is never suppressed by a notification preference** (UC-211 rule; UC-168): a person cannot opt out of being told that an outside firm asked to read their company's data.
5. The notices run on the common notification mechanism (UC-172, UC-173; FR-157), are delivered in-app and by email, and are authored in the three locales on task 51's content and not machine-translated (task-121.1 row).

**Configuration-held values.** The category's behaviour is configuration (AD-4; task 49.1). The category and its eight notices are not yet seeded; `config/seed/` holds five notification categories, none advisory.

**Boundaries.** The recipient-resolution correction of task 121.2 belongs to other requirements: once edit access can be held through a relationship, the deadline and outstanding-report notices (UC-169, UC-170, UC-174) must reach advisor users holding it. It adds no category, since the existing ones resolve a larger set (task-121.2 row). Request, grant, decline and revoke are FR-192, FR-195, FR-196 and FR-197.

**Acceptance criteria.**
- **AC-1** Given a relationship with an expiry date, when the date is reached, then the relationship ends with no human action, at the start of the day after the date in the organization's timezone. *(source: FR AC; UC-210 step 1; task-116.3 row; §12.5.6 task-182 advisor row, 182/142)*
- **AC-2** Given a relationship approaching its expiry, then the client's Organization Administrators and the firm's Advisor Administrator are told in advance, at the lead times configured (initially 14 days and 1 day). *(source: FR AC, "advance notice"; UC-210 step 2; §12.5.6 task-182 advisor row, 182/154)* Unmet until 121.1.
- **AC-3** Given a request, then the client's Organization Administrator receives a notice. Given a grant, a change, a decline or a revocation, then the firm's Advisor Administrator receives one; given an ending by the firm, then the client's Organization Administrators do. *(source: FR AC; UC-211 steps 1 and 2; §12.5.6 task-182 advisor row, 182/154)* Unmet until 121.1.
- **AC-4** Given a user whose preferences opt out of every optional category, then these notices are still delivered. *(source: FR AC; UC-211 rule; FR-163)* Unmet until 121.1.
- **AC-5** Given the eight notices, then each exists in the category and is delivered in-app and by email in the three locales. *(source: task-121.1 row)* Unmet until 121.1.
- **AC-6** Given an expired relationship, when a user of the firm tries to enter the client, then entry is refused with 403 `advisor-access-refused`, its `standing` member `expired`. *(source: UC-205 precondition, unexpired; FR-199; §12.5.6 task-182 advisor row, 182/147)*
- **AC-7** Given the existing deadline notice, then no new category is added for advisors. *(source: task-121.2 row)* Unmet until 121.2.

**History.**
- 11 Sep 2026 · promotion out of `use_cases.md` §7.1 · added with UC-210 and UC-211 · index §3.32; `use_cases.md` §4.6
- 5 Oct 2026 · project owner · eight notices with named recipients, advance notice at two configured lead times, and an expiry that is a calendar date in the organization's timezone · §12.5.6 task-182 advisor row (182/154, 182/142, 182/141)
