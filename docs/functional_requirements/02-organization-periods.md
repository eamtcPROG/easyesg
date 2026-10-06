# Functional requirements — Part 2: Organization, entities and periods

Part 2 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.3 Organization | FR-13 … FR-16 |
| 3.4 Entity and period | FR-17 … FR-23 |

Business rules held here: BR-PER-1 … BR-PER-3 (§4.1) and BR-ACC-1 (§4.2). Entities held here: Organization, Organization relationship and Entity identifier (§5.1); Reporting entity, Consolidation scope, Entity master data version and Reporting period (§5.2).

**Who writes what.** Every write in this part is the **Organization Administrator's** (D-2): the organization's profile, entities, consolidation scope, archiving, and the period's opening, editing, locking and reopening. A member holding the editor or view-only role is refused (403 `insufficient-role`). The one exception is creating an organization, which any verified account does and which makes it the administrator of what it created (FR-13). **Reads differ by record.** The organization's profile is read by the administrator alone (FR-15). Entities and periods are read by every member, because a contributor completing B1 needs the entity it pre-fills from (`archived_tasks.md` task 29.3, project owner, 28 Aug 2026). The administrator may also fill a report (D-2 as amended 5 Oct 2026, `architecture.md` §12.5.6's task-182 row (1)), which part 3 holds. Nothing here narrows that: what stays the administrator's alone is the entity record and the period's lifecycle.

**Two refusals for a locked period, and the difference matters.** A write to the *period itself* (its year, dates or due date) is refused with 409 `period-locked`. A write to the *report inside it* is refused with 409 `report-not-editable` (FR-26, part 3). Both bind the administrator too (FR-22).

## 1. Organization (index §3.3)

### FR-13 — Create an organization

**Status.** Partial — delivered 12, 29.1, 30.2, 175 · remaining 116.4 (the organization's own type)

**Obligation.** The system shall allow an organization to be created from a verified account and shall automatically grant the creating user the Organization Administrator role over it.

| | |
|---|---|
| **Actors** | Any verified account creates. The creator becomes the Organization Administrator. An unverified account holds no session and cannot reach the route. |
| **Traces** | UC-49 · D-1 · AD-2 · BR-ACC-1 · FR-1, FR-12, FR-17 · entities *Organization*, *Reporting entity* |
| **Surfaces** | S-04 (Focus) · `POST /organizations` · `GET /organizations/legal-forms` |

**Preconditions.** The account is verified (UC-49; UC-03).

**Inputs.** Name (1 … 200 characters, trimmed), country (ISO 3166-1 alpha-2, accepted in any case and stored upper case), and optionally a contact email and a contact phone (free-form, up to 40 characters). The legal form is not asked here; it is each entity's (FR-17). The organization's type is asked, as a key of the registered organization-type vocabulary, and an omitted type means `direct_sme`, so no existing caller changes (§12.5.6 task-182 identity and organization row, 182/8; 116.4).

**Behaviour.**
1. **One transaction writes four things**: the organization, the creator's founding membership in the Organization Administrator role, the organization's first reporting entity, and the calling session's active organization, set to the one just created. The founding grant is not a separate step: an organization committed without it would be unreachable by everyone, its creator included (UC-49 steps 2 and 3; D-1; build-log task 29.1 review fixes).
2. **The first entity carries the organization's name and nothing else.** Most SMEs are one company, so a single-company user is never asked to type the same name twice. A group adds its further companies through FR-17. Organizations that existed before 29 Sep 2026 were not given one (UC-49 step 3; `architecture.md` §12.5.6's task-175 row (3)).
3. **The creator keeps every membership already held.** Pointing the session at the new organization is what stops an account with two memberships and no stated preference from having no active organization on the next request (build-log task 29.1 review fixes; FR-12).
4. **The country must register a legal-form vocabulary**, held as configuration (`organization-legal-form.<country>.json`, AD-4). It is refused at creation rather than at a later save, because an organization in a country with no vocabulary could never complete the legal form B1 needs (`architecture.md` §7.2, decided 28 Aug 2026). At MVP only `MD` registers one.
5. **The tenant root's insert policy is `WITH CHECK (true)`**, because creating a row one then owns is not a cross-tenant act (AD-2; task 12).
6. The founding rows are attributed to the creator in the change trail (build-log task 29.1: the acting user is bound before either write; FR-15).
7. **There is no limit** on the organizations one account may found at MVP. The question belongs to the entitlement design, so task 54.2 lists *organization creation* among the seams it enumerates (§12.5.6 task-182 identity and organization row, 182/13).
8. **The organization records its own type**, a key in the registered vocabulary, as a column of `core.organization`. A direct SME founds its first entity (item 2). An advisor organization founds none, and its creator is still granted the Organization Administrator role (item 1; FR-190) (§12.5.6 task-182 identity and organization row, 182/8).

**Refusals.**
- Country registers no vocabulary → 400 `country-not-supported`
- Name blank after trimming, malformed email or phone too long → 400 `validation-failed`
- No session → 401 `authentication-required`

**Effects.** `core.organization`, `identity.membership` (role `organization_administrator`), `core.reporting_entity` and the session's active organization are written together or not at all.

**Configuration-held values.** The countries an organization may be created in, and each one's legal forms: `config/seed/organization-legal-form.md.json` (ten forms: `srl sa snc sc ii cp ci is im gt`). Their wording ships in the release (OQ-43).

**Boundaries.** The billing account is FR-106's. The advisor organization type, which is also created by this route, is FR-190's. A quota on organizations per account, if a plan ever sets one, is task 54.2's.

**Acceptance criteria.**
- **AC-1** Given a verified account, when it creates an organization with a name and a supported country, then the organization exists and the account holds the Organization Administrator role over it. *(source: FR text; D-1; UC-49 step 2)*
- **AC-2** Given an account that already holds memberships, when it creates an organization, then it keeps them and the new organization is its session's active one. *(source: build-log task 29.1 review fixes; FR-12)*
- **AC-3** Given an organization has just been created, then it holds exactly one reporting entity, named after it. *(source: UC-49 step 3; §12.5.6 task-175 row (3))*
- **AC-4** Given a country with no registered legal-form vocabulary, when an organization is created in it, then the answer is 400 `country-not-supported` and nothing is stored. *(source: §7.2 task 29.1 paragraphs)*
- **AC-5** Given an unverified account, then it holds no session and cannot create an organization. *(source: FR text; FR-1; UC-49 precondition)*
- **AC-6** Given a country is registered as configuration, then it is accepted with no deployment. *(source: AD-4; `GET /organizations/legal-forms` description)*
- **AC-7** Given an account that has already founded organizations, when it founds another, then it is created, and no limit applies. *(source: §12.5.6 task-182 identity and organization row, 182/13; `POST /organizations`)*
- **AC-8** Given an organization created with a type in the registered vocabulary, then the type is stored and read back; given a type outside it, then the answer is 400 and nothing is stored; given no type, then it is `direct_sme`. *(source: §12.5.6 task-182 identity and organization row, 182/8)* Unmet until 116.4.
- **AC-9** Given an organization created with the advisor type, then it holds no reporting entity, and its creator holds the Organization Administrator role. *(source: §12.5.6 task-182 identity and organization row, 182/8; FR-190)* Unmet until 116.4 and 116.1.

**History.**
- 20 Aug 2026 · build · the tenant root's insert policy carries `WITH CHECK (true)` so this requirement can create an organization · AD-2 amended; `archived_tasks.md` task 12
- 28 Aug 2026 · build · the founding transaction also points the session at the new organization · build-log task 29.1 review fixes
- 29 Sep 2026 · project owner · creating the organization creates its first reporting entity · UC-49 step 3; §12.5.6 task-175 row (3)
- 5 Oct 2026 · project owner · no limit on organizations per account at MVP, the quota left to task 54.2; the organization records its own type, and an advisor organization founds no entity · §12.5.6 task-182 identity and organization row (182/13, 182/8)

### FR-14 — Typed relationships between organizations

**Status.** Partial — delivered 29.1 · remaining 116.1 (the advisor type registered)

**Obligation.** The system shall model organizations with typed parent, child and peer relationships to other organizations, with the direct SME organization type and, from task 116.1, the advisor type active at MVP, so that Buyer and Licensee types can be added without a schema change.

| | |
|---|---|
| **Actors** | No actor writes a relationship at MVP. A type is registered as configuration data (AD-4), not by a tenant. |
| **Traces** | UC-49 · NFR-9 · AD-4 · `architecture.md` §7.2, §7.5 · FR-190 … FR-197 · entity *Organization relationship* |
| **Surfaces** | None. The table `core.org_relationship` and the configuration artefact `organization-relationship-type.global.json`. |

**Behaviour.**
1. **Two typed axes, constrained differently on purpose** (§7.2, decided 28 Aug 2026). The **kind** of edge (`parent`, `child`, `peer`) is the shape of a graph and is a database `CHECK`. The **organization type** (`direct_sme` at MVP; Advisor, Buyer and Licensee later) is NFR-9's axis, so it is a configuration key, and the database guarantees only that it is a lower-case identifier.
2. The registered vocabulary is read from the configuration store at request time. That its answer moves when the registration moves is specified in both directions, registered and unregistered.
3. **No MVP flow writes a row.** Every MVP tenant is one direct SME with no relationship to another organization. The table is built now because adding it later would be a migration inside a filing window (NFR-48), and because NFR-9's demonstration needs somewhere to insert a fourth type's edge.
4. **No function admits a type against the vocabulary yet**, because nothing writes a relationship to admit. The admission arrives with the first flow that creates an edge (§7.2, corrected 28 Aug 2026).
5. An organization is not its own relation, and one edge exists at most once per (organization, related organization, kind). Erasing either organization removes the edge, so a third party's data never blocks an erasure.
6. **The same vocabulary types the organization itself.** `core.organization` carries a type column holding a key of this vocabulary, which the database guards only as a lower-case identifier, as it does the relationship's (FR-13; §12.5.6 task-182 identity and organization row, 182/8). It is the one migration the advisor type needs.

**Configuration-held values.** `config/seed/organization-relationship-type.global.json`: `{ "types": ["direct_sme"] }`.

**Boundaries.** Activating the Advisor type, and the relationship's request, grant, revoke and expiry lifecycle, are FR-190 … FR-197's (task 116), over this model. They are specified so that no migration beyond the organization's own type column (116.4) is needed there (§12.5.6 task-182 identity and organization row, 182/8; task.md row 116.1 as amended).

**Acceptance criteria.**
- **AC-1** Given a relationship, then it stores a kind and an organization type. *(source: FR text; §7.2)*
- **AC-2** Given a fourth organization type is registered as data in staging, then a relationship of that type can be stored with zero schema migrations. *(source: NFR-9 verification)*
- **AC-3** Given a relationship kind outside `parent`, `child` and `peer`, then the database refuses it. *(source: §7.2 task 29.1 paragraphs)*
- **AC-4** Given the registered vocabulary, then it lists `direct_sme`, and `advisor` once task 116.1 registers it, and no other type at MVP. *(source: FR text as amended; seed artefact)* The advisor type is unmet until 116.1.
- **AC-5** Given a relationship naming an organization as its own relation, then the database refuses it. *(source: migration `1788566400000-organization-profile`, `org_relationship_not_self`)*
- **AC-6** Given a relationship of a type that is not registered, then it is refused. *(source: §7.2, "the admission belongs with the first flow")* Unmet until the first flow that writes a relationship (task 116).

**History.**
- 28 Aug 2026 · project owner · two typed axes, the kind a `CHECK` and the type a configuration key · §7.2 task 29.1 paragraphs
- 28 Aug 2026 · build · the claim that an admission function was specified is corrected; only a reader of the vocabulary shipped · §7.2
- 5 Oct 2026 · project owner · the advisor type is active at MVP beside the direct SME, and the organization records its own type in a column · §12.5.6 task-182 identity and organization row (182/8)

### FR-15 — The organization's profile

**Status.** Built — delivered 29.1, 30.3, 177

**Obligation.** The system shall maintain the organization's registered name, its country and the contact email and phone the platform writes to, with every change attributed and timestamped. The legal form, the registered address and the contact printed on the report cover are each reporting entity's (FR-17), not the organization's.

| | |
|---|---|
| **Actors** | Organization Administrator reads and edits. Any other member is refused. |
| **Traces** | UC-50 · D-2 · FR-16, FR-17, FR-54, FR-106 · `design_spec.md` OQ-19, OQ-20 · entity *Organization* |
| **Surfaces** | S-15 (Record) · `GET /organization` · `PATCH /organization` |

**Preconditions.** The organization exists and the caller holds the Organization Administrator role (UC-50).

**Inputs.** Name (1 … 200 characters), country (alpha-2), contact email (up to 320 characters), contact phone (up to 40 characters, free-form). A patch: a field absent is unchanged, and an explicit null clears the email or the phone.

**Behaviour.**
1. **The organization is the account.** These values are shown to the team and used by the platform to reach it. **None of them reaches a report**: a report prints its reporting entity's legal identity (UC-50 business rule; §12.5.6 task-177 row (1)).
2. **Change attribution is read, not stored.** `GET /organization` answers `lastChange` (the acting account's id and address, and the instant), read from the per-field change trail the database writes, not from a column the application maintains. A second writer of the same fact would drift (§12.5.6 task-30.3 attribution row). The actor is null where that account has since been erased, because the trail carries no foreign key. The whole `lastChange` is null where the trail holds nothing.
3. The country must register a legal-form vocabulary, as at creation (FR-13).
4. **The platform contact and the billing account are different things.** The invoiced legal person is not always the reporting entity (FR-106, UC-108).
5. S-15 says that what prints on a report is held under Entities, so nobody looks here for it (design_spec S-15, amended 29 Sep 2026).

**Refusals.**
- Not an Organization Administrator → 403 `insufficient-role`; no active membership → 403 `membership-required`
- Country registers no vocabulary → 400 `country-not-supported`
- Blank name, malformed email, overlong phone → 400 `validation-failed`

**Boundaries.** The legal form, the registered address, the report-cover contact and the identifiers are FR-17's and FR-16's. The history panel behind the attribution line is S-12, task 84. **A change of country is not checked against the legal forms of the organization's entities**, because one country registers a vocabulary and no move between two is possible yet; the second registered country has to add that check (§12.5.6 task-177 row, deferral with its assumption).

**Acceptance criteria.**
- **AC-1** Given an Organization Administrator, when they change the name, country, contact email or phone, then the change is stored and read back. *(source: FR text; UC-50 step 1)*
- **AC-2** Given a change, then the profile read names the acting account and the instant. *(source: FR text; §12.5.6 task-30.3 attribution row)*
- **AC-3** Given an editor or a view-only member, when they read or write the profile, then the answer is 403. *(source: UC-50 precondition; D-2; the controller's class-level gate)*
- **AC-4** Given a country with no registered vocabulary, when it is submitted, then the answer is 400 `country-not-supported` and nothing changes. *(source: §7.2; build 29.1)*
- **AC-5** Given the organization's record, then it holds no legal form, no registered address and no report-cover contact; each is held on the reporting entity. *(source: FR text as amended; §12.5.6 task-177 row (2), (3))*
- **AC-6** Given the platform contact is edited, then no report's cover contact changes. *(source: §12.5.6 task-177 row (1); task-30.3 report-cover row)*

**History.**
- 29 Aug 2026 · project owner · the report-cover contact is a second contact, not a rename of the platform one; the attribution is read from the change trail · §12.5.6 task-30.3 rows
- 29 Sep 2026 · project owner · the organization keeps its name, country and platform contact; the legal form, the registered address and the report-cover contact move to the reporting entity · §12.5.6 task-177 row; UC-50 step 1; `design_spec.md` S-15

### FR-16 — Entity identifiers

**Status.** Partial — delivered 29.2, 30.3, 175 · remaining 188 (the IDNO check digit)

**Obligation.** The system shall maintain each reporting entity's identifiers, with **IDNO as primary** and **LEI as an optional additional identifier**, validating format and checksum on entry. DUNS, EU ID and PermID are not modelled at MVP.

| | |
|---|---|
| **Actors** | Organization Administrator enters. SYS validates. |
| **Traces** | UC-51 · OQ-18 · NFR-64, NFR-79 · FR-17, FR-73, FR-107 · entity *Entity identifier* |
| **Surfaces** | S-13 (the record; the Index lists each entity's IDNO) · `POST /entities` · `PATCH /entities/{entityId}` |

**Inputs.** IDNO: thirteen digits. LEI: twenty characters, eighteen of upper-case letters and digits then two digits. Either is null until stated, and null clears.

**Behaviour.**
1. **The identifiers are the entity's, not the organization's.** EFRAG's Digital Template ties one *Entity Identifier* to the reporting undertaking, per report, and each company of a group holds its own IDNO (§12.5.6 task-175 row (1)).
2. **The rule is shared.** `packages/validation` holds it, so S-13 shows the same verdict inline as the server returns, and the two cannot drift (§9.8).
3. **The IDNO is checked in full, once 188 builds the check.** Government Decision 272/2002 fixes the thirteen-digit layout and says the last digit is a check digit, without giving the algorithm. The algorithm was supplied on 5 Oct 2026: the first twelve digits are multiplied by the repeating weights 7, 3, 1 and summed, and the sum modulo 10 is the thirteenth digit. It holds for 1003600005148 and 1017600033216, and its source (StephenAbbott/opencheck PR #269, `backend/opencheck/sources/asp_moldova.py`) validated all 265,814 IDNOs in the State Register export of 14 Sep 2026. It is not the weighted-modulo-11 family that §7.2 refuted on 28 Aug 2026. Until the check is built, the validator reports the check digit as *not evaluated*, which is not the same as failed (§12.5.6 task-182 identity and organization row, 182/12; §7.2).
4. **The LEI is checked in full**: ISO 17442 shape, then ISO 7064 MOD 97-10. Case is not normalised; a lower-case LEI is malformed.
5. **No uniqueness constraint on the IDNO.** A platform-wide unique index would be an existence oracle over the Moldovan company register crossed with the customer list (NFR-64), and it would need a cross-tenant read no policy grants. Duplicates are permitted (§7.2). Whether one organization's entities may share an IDNO is deferred: nothing refuses it, and if the answer is to refuse, a partial unique index on (organization, IDNO) and one problem type are what change (§12.5.6 task-175 row).
6. **Requiredness is not enforced at the record.** That B1 cannot be filed without an IDNO is a validation rule interpreted from configuration (FR-73, task 40), so the profile stays usable while half complete.

**Refusals.**
- IDNO not thirteen digits, or LEI not of the right shape → 400 `identifier-malformed` (`core.entity.idno_malformed`, `core.entity.lei_malformed`)
- LEI of the right shape whose check digits disagree → 400 `identifier-check-digits` (`core.entity.lei_check_digits`)
- IDNO of the right shape whose check digit disagrees → 400 `identifier-check-digits`, the type the LEI already uses (unmet until 188)
- The entity is archived → 409 `entity-archived` (FR-20)

**Boundaries.** The export writes the LEI under EFRAG's LEI scheme where the entity holds one, and otherwise the IDNO under a scheme URI the platform defines; task 46 fixes the URI and proves the instance against EFRAG's validator (§12.5.6 task-175 row (5)). The console's search by IDNO is A-02's (same row, (4)). The billing account's own IDNO and VAT code are FR-106's and FR-107's.

**Acceptance criteria.**
- **AC-1** Given a reporting entity, when a thirteen-digit IDNO is recorded, then it is stored as the entity's primary identifier. *(source: FR text; UC-51 step 1)*
- **AC-2** Given an LEI is recorded alongside the IDNO, then both are stored, and an entity with an IDNO and no LEI is valid. *(source: FR text; OQ-18)*
- **AC-3** Given an IDNO that is not thirteen digits, then it is refused with 400 `identifier-malformed` and nothing is stored. *(source: §7.2 task 29.2 paragraphs)*
- **AC-4** Given an LEI of the right shape whose check digits disagree, then it is refused with 400 `identifier-check-digits`. *(source: FR text; §7.2: "satisfied for LEI")*
- **AC-5** Given an LEI of the wrong length or character classes, then it is refused with 400 `identifier-malformed`. *(source: §7.2)*
- **AC-6** Given the identifiers offered, then no DUNS, EU ID or PermID field exists. *(source: FR text; OQ-18)*
- **AC-7** Given an organization with two entities, then each holds its own IDNO and LEI, and the organization holds none. *(source: §12.5.6 task-175 row (1))*
- **AC-8** Given two entities holding the same IDNO, then both are accepted. *(source: §7.2, no uniqueness at MVP)*
- **AC-9** Given thirteen digits whose check digit is wrong, then the IDNO is refused with 400 `identifier-check-digits` and nothing is stored. *(source: FR text, "checksum on entry"; §12.5.6 task-182 identity and organization row, 182/12)* Unmet until 188.
- **AC-10** Given 1003600005148 or 1017600033216, then the IDNO is accepted. *(source: §12.5.6 task-182 identity and organization row, 182/12)* Unmet until 188.

**History.**
- 18 Aug 2026 · OQ-18 closed · IDNO primary, LEI optional, the other schemes removed · `architecture.md` §18 OQ-18
- 28 Aug 2026 · project owner · the LEI check built; the IDNO check digit not evaluated; no uniqueness constraint; the identifier is nullable · §7.2 task 29.2 paragraphs
- 28 Aug 2026 · correction · the acceptance column carried the superseded scheme (LEI primary with DUNS, EU ID and PermID) and contradicted its own requirement · OQ-18
- 29 Sep 2026 · project owner · the identifiers are held on each reporting entity · §12.5.6 task-175 row (1)
- 5 Oct 2026 · project owner · the IDNO's check digit is known and is built; the VAT code gets a shape check only (FR-107) · §12.5.6 task-182 identity and organization row (182/12)

## 2. Entity and period (index §3.4)

### FR-17 — Reporting entities

**Status.** Built — delivered 29.3, 30.4.1, 30.4.2, 30.4.3, 175, 176, 177, 180.1

**Obligation.** The system shall allow reporting entities to be created and edited with legal form, NACE code(s), site locations, **registered address** and the **contact printed on the report's cover**, permitting more than one entity per organization.

| | |
|---|---|
| **Actors** | Organization Administrator creates, edits and archives. Every member reads. |
| **Traces** | UC-52, UC-53 · D-2 · AD-4 · `architecture.md` §7.2, §9.6 · FR-13, FR-15, FR-16, FR-18, FR-19, FR-20, FR-27 · BR-DIS-4 · entity *Reporting entity* |
| **Surfaces** | S-13 (Index + Record) · `GET /entities` · `POST /entities` · `GET`, `PATCH /entities/{entityId}` · `GET /entities/nace-codes` · `GET /organizations/legal-forms` |

**Inputs.** Name (1 … 200 characters, the name the entity is reported under). Legal form (a key from the organization's country's vocabulary, or null). NACE code(s) (up to 50). Sites (up to 200): name, address line, locality, postal code, country, latitude and longitude as decimal degrees. Registered address (two lines, locality, postal code). Report-cover contact (a name and an email). Identifiers (FR-16) and the consolidation basis and subsidiaries (FR-19).

**Behaviour.**
1. **An organization holds one entity or several.** Most SMEs hold exactly one, and the model does not assume it. The first is created with the organization (FR-13); a group adds its further companies here.
2. **The legal form is admitted against the vocabulary registered for the organization's country**, on create and on edit. Null clears it and is always permitted. The rule was the organization's until 29 Sep 2026, when it moved here with the legal form, where B1 already read it (§12.5.6 task-177 row (2)).
3. **Each NACE code is admitted against the classifier registered for the country** (kind `nace_code`; Moldova's is CAEM Rev.2, 996 codes, 1:1 with NACE Rev.2 to four characters, which is what B1 exports). A country with no classifier admits none. An empty list is permitted. The activity classification is the entity's only; the organization collects none (§12.5.6 task-30.2 row; §9.6).
4. **The classifier is offered, not only validated.** `GET /entities/nace-codes?q=` answers code and label in the negotiated locale. An empty query answers the first four-character classes in code order; a typed query ranks code match first, then label beginning, then every word beginning a word of the label, then stems, then words anywhere inside; `codes=` resolves the labels of codes a record already holds (§12.5.6 task-30.4.1, task-30.4.2 and 28 Sep 2026 rows).
5. **A patch changes only what it names.** `sites` and `consolidationMembers` are saved as whole collections: an element with an id is edited, one without is added, and a stored element the array omits is removed. Omitting the collection leaves it alone (controller description; build-log task 29.4).
6. **A site is captured whole** (name, address, locality, postal code, country, coordinates to six decimals), and a save never clears what the form does not show, such as a site's country and coordinates or a subsidiary's LEI (`design_spec.md` S-13, amended 30 Sep 2026; task 180.1).
7. **A save carries the entity into the periods whose B1 has not been opened** (FR-18).
8. An archived entity cannot be edited (FR-20).
9. Entities are read by every member. The administrator writes (`archived_tasks.md` task 29.3; `actors.md` §5).

**Refusals.**
- NACE code the country does not register → 400 `nace-code-unknown`
- Legal form not in the country's vocabulary → 400 `legal-form-unknown`
- Consolidated basis with no subsidiary → 400 `consolidation-boundary-empty` (FR-19)
- Malformed or check-digit-failing identifier → 400 `identifier-malformed`, `identifier-check-digits` (FR-16)
- Entity archived → 409 `entity-archived` · Unknown entity, or another organization's → 404 `not-found`
- Not an Organization Administrator → 403 `insufficient-role`

**Configuration-held values.** `organization-legal-form.md.json` (ten forms, each mapped to one of EFRAG's five legal-form members for B1), `nace-code.md.json` (996 codes in Romanian, Russian and English). The names of the forms ship in the release (OQ-43). The classifier's names are the Bureau's and EU Publications Office's published text, held as configuration (§9.6).

**Boundaries.** How many entities a plan admits is FR-99's, task 54.2: no entitlement gate exists until then (controller header). The read-only state of an entity beyond a reduced entitlement is FR-103's (UC-151). B1's pre-fill from the entity is FR-27's.

**Acceptance criteria.**
- **AC-1** Given an Organization Administrator, when an entity is created with a legal form, NACE code(s) and site locations, then it is stored and read back. *(source: FR text; UC-52)*
- **AC-2** Given an entity, when it is edited, then the new values are stored. *(source: FR text; UC-53)*
- **AC-3** Given an organization with an entity, when a second is created, then both exist. *(source: FR text)*
- **AC-4** Given an entity, then its registered address and report-cover contact are held with it, distinct from the organization's platform contact. *(source: FR text as amended; §12.5.6 task-177 row (3))*
- **AC-5** Given a NACE code the country does not register, then the write is refused with 400 `nace-code-unknown`. *(source: §9.6; controller description)*
- **AC-6** Given a legal form not in the country's vocabulary, then the write is refused with 400 `legal-form-unknown`. *(source: §12.5.6 task-177 row (2))*
- **AC-7** Given an editor or a view-only member, then they read entities and any write is refused with 403. *(source: `archived_tasks.md` task 29.3; controller header)*
- **AC-8** Given a save that sends `sites` with one stored site omitted, then that site is removed, and a save that sends no `sites` leaves them untouched. *(source: controller description; build-log task 29.4)*
- **AC-9** Given a site saved with a country and coordinates, when the record is saved again without touching them, then both are kept. *(source: `design_spec.md` S-13 amendment of 30 Sep 2026; task 180.1)*
- **AC-10** Given an empty search query, then the first four-character classes are offered in code order. *(source: §12.5.6 row of 28 Sep 2026)*

**History.**
- 28 Aug 2026 · project owner · the NACE list is configuration seeded from the Bureau's CAEM Rev.2; a contributor reads while the administrator writes; the snapshot table ships ahead of its writer · §7.2 task 29.3 paragraphs; `archived_tasks.md` task 29.3
- 29 Aug 2026 · project owner · activity classification stays on the entity · §12.5.6 task-30.2 row
- 29 Aug 2026 · project owner · the classifier is searchable server-side, with sourced English labels · §12.5.6 task-30.4.1 and task-30.4.2 rows
- 28 Sep 2026 · project owner · an empty query answers the first classes; a typed query ranks · §12.5.6 row of 28 Sep 2026
- 29 Sep 2026 · project owner · the organization is founded with its first entity · §12.5.6 task-175 row (3)
- 29 Sep 2026 · project owner · registered address and report-cover contact added from the organization; the legal-form rule moves here · §12.5.6 task-177 row; UC-52
- 29 Sep 2026 · build · the create path records the consolidation boundary it was sent · `archived_tasks.md` task 176
- 30 Sep 2026 · project owner · a site is captured whole and a save no longer wipes it · `design_spec.md` S-13; task 180.1

### FR-18 — Entity master data is point-in-time

**Status.** Built — delivered 29.3, 31.1, 31.4, 91.2, 180.2

**Obligation.** The system shall retain entity master data point-in-time, so that a report for a closed period continues to reflect the values in force when it was prepared. A period is closed, for this purpose, once it is locked or its report's B1 has been opened, whichever comes first.

| | |
|---|---|
| **Actors** | SYS takes snapshots. The Organization Administrator's save of an entity refreshes them. |
| **Traces** | UC-53 · D-2 · P-4 · BR-PER-2 · FR-21, FR-27 · entity *Entity master data version* |
| **Surfaces** | `ReportingPeriod.entitySnapshotId` · the B1 step read (part 3) · S-13 (states the consequence before an edit) |

**Behaviour.**
1. **A snapshot is a row in `core.entity_snapshot`**: the entity record together with its sites and its consolidation members, ordered by name so a site's position, which is B1's ordinal, is stable. It is tenant-scoped and insert-only: no runtime role holds UPDATE or DELETE on it.
2. **It is taken when the period is opened**, in the opening transaction and before the period row is written, and **referenced by the period** (`entity_snapshot_id`); the report reaches it through its period (§12.5.6 task-31.1 row). Entity creation takes none, since no period exists yet.
3. **Reports read the snapshot, never the live record.** B1's defaults come from it (FR-27).
4. **The snapshot follows the entity until B1 is opened.** Saving an entity re-takes the snapshot of each of its periods that is not locked and whose report stores none of B1's record keys (a period with no report included), in the saving transaction, once for all periods due. The earlier copy stays. After B1 is opened, or once the period is locked, the snapshot never moves, and a later correction reaches only a period opened afterwards (§12.5.6 task-180.2 row).
5. **The boundary a filed report reflects is the snapshot's**, not the entity's current value. An entity that consolidates from 2027 does not re-scope its 2026 filing (§7.2 task 29.4 paragraphs).
6. **S-13 states the consequence before an edit that would otherwise read as retroactive** (design_spec S-13, validation behaviour).
7. There is no report snapshot table: the lock is the snapshot of values (FR-22; §12.5.6 task-31.4 row).

**Boundaries.** **"Closed" means locked, or with B1 opened**, whichever comes first: from then the snapshot stops moving (behaviour 4; §12.5.6 task-182 identity and organization row, 182/9). The values a locked report holds are FR-22's.

**Acceptance criteria.**
- **AC-1** Given a period is opened, then it references a snapshot of the entity as it stood at that moment. *(source: §12.5.6 task-31.1 row)*
- **AC-2** Given B1 has been opened on a period's report, when the entity is edited, then the period's snapshot is unchanged and B1 still reads the earlier values. *(source: FR text; §12.5.6 task-180.2 row)*
- **AC-3** Given a locked period, when the entity is edited, then the period's snapshot is unchanged. *(source: §12.5.6 task-180.2 row)*
- **AC-4** Given an unlocked period whose report holds no B1 record answer, when the entity is saved, then the period references a newly taken snapshot holding the new values. *(source: §12.5.6 task-180.2 row)*
- **AC-5** Given a snapshot, then no runtime role can update or delete it. *(source: migration `1788825600000-reporting-entity` grants; §7.2)*
- **AC-6** Given an entity that changes its consolidation basis after a period was opened and its B1 answered, then the earlier period still carries the earlier basis. *(source: §7.2 task 29.4 paragraphs)*

**History.**
- 28 Aug 2026 · project owner · the snapshot table ships with the entity and its writer arrives with the period; the guarantee is structural until then · `archived_tasks.md` task 29.3
- 29 Aug 2026 · project owner · the snapshot belongs to the period, not the report · §12.5.6 task-31.1 row; §7.2 amended
- 31 Aug 2026 · project owner · no report snapshot table; the lock is the snapshot · §12.5.6 task-31.4 row
- 2 Sep 2026 · project owner · "the entity master record" read elsewhere means this snapshot · §12.5.6 task-91.2 rows; FR-27
- 30 Sep 2026 · project owner · the snapshot follows the entity until B1 is opened · §12.5.6 task-180.2 row; FR-27
- 5 Oct 2026 · project owner · "closed" in the obligation and in BR-PER-2 means locked or with B1 opened, which is what task 180.2 built · §12.5.6 task-182 identity and organization row (182/9)

### FR-19 — Consolidation scope

**Status.** Built — delivered 29.4, 30.4.3, 91.2, 176

**Obligation.** The system shall record an entity's consolidation basis and, where consolidated, the subsidiaries inside the reporting boundary, feeding B1 and bounding every quantitative figure in the report.

| | |
|---|---|
| **Actors** | Organization Administrator records. Every member reads. |
| **Traces** | UC-54, UC-19 · D-2 · `architecture.md` §7.2 · FR-18, FR-27, FR-73 · entity *Consolidation scope* |
| **Surfaces** | S-13 (the basis, and the subsidiaries once consolidated) · `POST /entities`, `PATCH /entities/{entityId}` (`consolidationBasis`, `consolidationMembers`) |

**Inputs.** Basis: `individual`, `consolidated` or null. Subsidiaries (up to 500): legal name (1 … 200 characters) and optionally an IDNO (thirteen digits), an LEI (twenty characters) and a country.

**Behaviour.**
1. **The basis is null until stated, with no default.** VSME asks the question explicitly, and a default would answer it on the undertaking's behalf. A group that should have consolidated would file every number on the wrong boundary (build-log task 29.4).
2. **A subsidiary is a named record**, not a pointer to another reporting entity. A Moldovan SME's subsidiaries are generally not on the platform (`archived_tasks.md` task 29.4; build-log task 29.4).
3. **`consolidated` with an empty boundary is refused at the record.** A consolidated basis names a boundary, an empty boundary names nothing, and every figure is gathered against it. The rule is checked against the state the write results in, so setting the basis with none stored, clearing the members while the basis stands, and doing both at once all reach it. It applies on create (since task 176) and on edit (§7.2 task 29.4 paragraphs).
4. **Switching to `individual` leaves the subsidiaries standing.** B1 reads the members only when the basis is `consolidated`.
5. **B1 discloses the boundary.** The basis, and the subsidiaries' names where consolidated, are served as editable defaults (D-2): the entity is the default, never the authority, so a report may disclose a boundary that differs from the entity's current one.
6. **Every quantitative disclosure is gathered against the boundary**: `individual` is the undertaking alone, `consolidated` is the undertaking with the listed subsidiaries. This is what the figures mean, not a validation rule (§7.2 task 29.4 paragraphs).
7. Which boundary a filed report reflects is the snapshot's (FR-18).

**Refusals.** Consolidated basis with no subsidiary → 400 `consolidation-boundary-empty`.

**Boundaries.** Whether a report may be filed with no basis at all is the ordinary completeness question: FR-73, task 40. The calculator's aggregation over the boundary is FR-34's.

**Acceptance criteria.**
- **AC-1** Given an entity, when `individual` is recorded, then it is stored and read back. *(source: FR text; UC-54 step 1)*
- **AC-2** Given an entity, when `consolidated` is recorded with at least one subsidiary, then both are stored and B1 offers them as defaults. *(source: FR text; UC-54 step 2; §12.5.6 task-91.2 rows)*
- **AC-3** Given `consolidated` with no subsidiary, whether by setting the basis, by clearing the members, or both, then the write is refused with 400 `consolidation-boundary-empty`. *(source: §7.2 task 29.4 paragraphs)*
- **AC-4** Given a basis switched from `consolidated` to `individual`, then the stored subsidiaries remain and B1 does not offer them. *(source: build-log task 29.4)*
- **AC-5** Given an entity whose basis was never stated, then it reads null and no default is applied. *(source: build-log task 29.4)*
- **AC-6** Given an entity is created with a basis and subsidiaries in one request, then both are recorded. *(source: `archived_tasks.md` task 176)*

**History.**
- 28 Aug 2026 · project owner · a subsidiary is a named record; the basis is nullable with no default; an empty consolidated boundary is refused at the record · §7.2 task 29.4 paragraphs
- 29 Sep 2026 · build · the create path recorded neither basis nor subsidiaries, and now does · `archived_tasks.md` task 176

### FR-20 — Archive an entity

**Status.** Partial — delivered 29.3, 30.4.3 · remaining 187 (the pickers that start new work)

**Obligation.** The system shall allow a reporting entity to be archived, removing it from active selection while retaining its historical reports and exports intact.

| | |
|---|---|
| **Actors** | Organization Administrator archives. Every member reads an archived entity. |
| **Traces** | UC-55 · UX-70 · FR-17, FR-21 · entity *Reporting entity* |
| **Surfaces** | S-13 (the archive control in the record's side column; archived rows in the Index) · `POST /entities/{entityId}/archive` (204) |

**Preconditions.** The entity is no longer reported on: sold, merged or dissolved (UC-55).

**Behaviour.**
1. **Archiving changes the entity's status; nothing is deleted.** No route removes an entity, and there is no un-archive (UC-55).
2. **An archived entity stays readable.** It is included in `GET /entities` with its status, so its historical reports and exports remain retrievable. Its master data is frozen, and a new period cannot be opened against it.
3. S-13 lists archived entities after active ones and does not hide them by default, so a first-use message is never shown to an organization whose entities are all archived (S-13 states; §4.6).
4. **Archiving is a consequence-disclosing action** naming what survives (UX-70; design_spec S-13).
5. **"Active selection" means the pickers that start new work**: the new-period entry and the new-report picker do not offer an archived entity. The S-13 Index keeps listing archived entities (item 3) (§12.5.6 task-182 identity and organization row, 182/14).

**Refusals.**
- Archiving an archived entity, editing one, or opening a period against one → 409 `entity-archived`
- Unknown entity → 404 `not-found` · Not an Organization Administrator → 403 `insufficient-role`

**Acceptance criteria.**
- **AC-1** Given an entity, when it is archived, then its status reads `archived` and it is still readable. *(source: FR text; UC-55 step 1)*
- **AC-2** Given an archived entity, then its periods, reports and exports are retrievable unchanged. *(source: FR text; UC-55 step 2)*
- **AC-3** Given an archived entity, when its master data is edited, then the answer is 409 `entity-archived`. *(source: controller description; UC-55)*
- **AC-4** Given an archived entity, when a period is opened against it, then the answer is 409 `entity-archived` and no period is created. *(source: FR text; open-period use case, FR-20 comment)*
- **AC-5** Given an archived entity, when it is archived again, then the answer is 409 `entity-archived`. *(source: controller description)*
- **AC-6** Given any role, then no route deletes an entity. *(source: controller header; UC-55)*
- **AC-7** Given an archived entity, then it is not offered by the picker that starts a report or the entry that opens a period, and it is still listed on S-13. *(source: FR text; §12.5.6 task-182 identity and organization row, 182/14)* Unmet until 187.

### FR-21 — Open a reporting period

**Status.** Partial — delivered 31.1, 32.1.1, 32.1.2, 33.1, 33.3 · remaining 186 (one period per fiscal year)

**Obligation.** The system shall allow a reporting period to be opened for an entity with fiscal year and start and end dates, pinning the current template and taxonomy version and linking the immediately preceding period, and shall record an optional due date by which the report must be complete, distinct from the period end.

| | |
|---|---|
| **Actors** | Organization Administrator opens and edits. Every member reads. |
| **Traces** | UC-56 · NFR-3, NFR-34 · DR-4 · D-3 · BR-PER-3 · FR-18, FR-22, FR-23, FR-45, FR-65, FR-66, FR-165 · entity *Reporting period* |
| **Surfaces** | S-14 (Index + Record) · `GET /periods` · `POST /periods` · `GET`, `PATCH /periods/{id}` |

**Preconditions.** The entity exists and is active (UC-56; FR-20). A taxonomy version is registered (UC-56; UC-75).

**Inputs.** Entity; fiscal year (an integer, 1900 … 2200); start and end, each a calendar date with the IANA timezone that determines it (the end is the last day *in* the period); and optionally a due date of the same shape. **The caller supplies neither the version pin nor the prior-period link** (UC-56 steps 3 and 4).

**Behaviour.**
1. **A period boundary is a calendar date plus its timezone, never an instant** (NFR-34). Dates are read back as text so a server in another zone cannot move a boundary. The zone comes from the reporter's browser; no screen asks for it (§12.5.6 task-32.1 row).
2. **The pin is resolved for the period's start date**, never for the day the period is opened: `TAXONOMY_REGISTRY.pinFor()` is the only source of a pin. A period starting before 1 Jan 2026 pins `2026-02-01`, and one starting on or after it pins `2026-05-01` (§12.5.6 task-33.3 row). Editing a period's dates does not re-pin it, and nothing in the request tier can move a pin (DR-4; §12.5.6 task-31.3 pin rows).
3. **The prior period is the entity's period with the latest end before this one's start**, and the link is maintained: opening a period repoints the neighbour that should now follow it, and editing dates re-links both sides. Opening FY2026 and then backfilling FY2025 gives FY2026 a prior (§12.5.6 task-31.1 row; D-3).
4. **Periods of one entity may not overlap**, enforced by the database (a range-exclusion constraint over the inclusive end). **One entity may not hold two periods with the same fiscal year.** A second period naming a year the entity already holds is refused, on open and on edit, by a unique constraint and by a refusal, 409 `period-fiscal-year-taken`. S-14 already blocks choosing such a year, so the two now agree. This reverses task 31.1's decision to leave the year non-unique (§12.5.6 task-182 identity and organization row, 182/10; unmet until 186).
5. The entity snapshot (FR-18) is taken in the same transaction.
6. **The due date is optional and separate from the period end.** It is a legal date, editable and clearable (null clears) while the period is unlocked. Deadline notices count down to it (FR-165) and the overview marks it passed (FR-23). **No relation is enforced** between the due date, the period's end and the fiscal year, beyond what the opening checks: every date a real calendar day in a known timezone, the end not before the start, and no overlap. A due date before the period end, a fiscal year unrelated to the dates and a period of any length are accepted, because a prior-period catch-up filing can legitimately break each (§12.5.6 task-182 identity and organization row, 182/15).
7. **A report is a separate, explicit creation**; a period may exist with none (§12.5.6 task-31.3 row; FR-25).
8. S-14: the fiscal year is chosen from the last five years and the next, nothing preselected, and choosing one fills the dates with its calendar year, which stay editable; a save names the field that is wrong rather than being disabled (design_spec S-14, amended 30 Sep 2026).

**Refusals.**
- End before start, a boundary that is not a real calendar day, or an unknown timezone → 400 `validation-failed` (`core.period.dates_invalid`)
- Unknown entity, or another organization's → 404 `not-found`
- Entity archived → 409 `entity-archived`
- Dates overlap another period of the entity → 409 `period-overlaps`
- A fiscal year the entity already holds → 409 `period-fiscal-year-taken` (unmet until 186)
- No taxonomy version registered → 409 `taxonomy-version-unavailable`
- Editing a locked period → 409 `period-locked` (FR-22)
- Not an Organization Administrator → 403 `insufficient-role`

**Configuration-held values.** The adoption schedule, `config/seed/reporting-taxonomy.vsme.json`: `2026-02-01` valid to 1 Jan 2026, `2026-05-01` valid from it. Adoption is this platform's decision, not the newest registered version (`config/seed/README.md`).

**Boundaries.** What a pinned version means for a report is FR-65's and FR-66's. Comparatives over the link are FR-45's. Telling an administrator that a deadline is near is FR-165's and FR-173's.

**Acceptance criteria.**
- **AC-1** Given an active entity, when a period is opened with a fiscal year and dates, then it is stored with its template and taxonomy version. *(source: FR text; UC-56 steps 1 to 3)*
- **AC-2** Given a period starting on 1 July 2025, then it pins `2026-02-01`; given one starting on 1 January 2026, then it pins `2026-05-01`. *(source: §12.5.6 task-33.3 row)*
- **AC-3** Given a period backfilled for an earlier year, then it pins what was in force for its start date, not for today. *(source: build-log task 31.1)*
- **AC-4** Given an entity with a FY2025 period, when a FY2026 period is opened, then FY2026's prior is FY2025. *(source: FR text; UC-56 step 4)*
- **AC-5** Given FY2026 was opened first, when FY2025 is opened afterwards, then FY2026's prior becomes FY2025. *(source: §12.5.6 task-31.1 row)*
- **AC-6** Given a period whose dates overlap another of the same entity, then the answer is 409 `period-overlaps`. *(source: §12.5.6 task-31.1 row)*
- **AC-7** Given a due date, then it is stored apart from the period end, and a patch of null clears it. *(source: FR text; build-log task 31.1)*
- **AC-8** Given an end before the start, then the answer is 400 and no period is created. *(source: open-period use case, `admitDates`)*
- **AC-9** Given an archived entity, then no period can be opened against it (409 `entity-archived`). *(source: FR-20)*
- **AC-10** Given a period's dates are edited, then its template and taxonomy version are unchanged. *(source: DR-4; §12.5.6 task-31.3 pin rows)*
- **AC-11** Given a period read under any server timezone, then each boundary reads as the calendar date it was recorded with. *(source: NFR-34; build-log task 31.1)*
- **AC-12** Given an editor or a view-only member, then they read periods and any write is refused with 403. *(source: controller roles)*
- **AC-13** Given an entity that holds a period for fiscal year 2026, when a second period is opened with fiscal year 2026, or an existing period is edited to it, then the answer is 409 `period-fiscal-year-taken` and nothing changes. *(source: §12.5.6 task-182 identity and organization row, 182/10; `design_spec.md` S-14)* Unmet until 186.
- **AC-14** Given a due date before the period's end, or a fiscal year that is not the year of either date, then the period is accepted. *(source: §12.5.6 task-182 identity and organization row, 182/15)*

**History.**
- 29 Aug 2026 · project owner · the snapshot is referenced by the period; the prior link is maintained, not set once; periods may not overlap and fiscal year is not unique · §12.5.6 task-31.1 rows
- 31 Aug 2026 · project owner · the legal date's timezone comes from the reporter's browser; S-14's Date control is the platform's · §12.5.6 task-32.1 rows
- 1 Sep 2026 · project owner · the adoption boundary is the fiscal year (period start) · §12.5.6 task-33.3 row
- 30 Sep 2026 · project owner · S-14 takes S-13's conventions: year chosen from a list, a save names the wrong field, a way back that returns to its origin · `design_spec.md` S-14 amendments
- 5 Oct 2026 · project owner · a fiscal year is unique per entity, reversing task 31.1's decision (the recommendation was to permit it at the api; the owner chose to forbid it everywhere); no relation between due date, fiscal year and dates is enforced · §12.5.6 task-182 identity and organization row (182/10, 182/15)

### FR-22 — Lock and reopen a period

**Status.** Built — delivered 31.2, 31.3, 31.4, 32.1.2, 34.1

**Obligation.** The system shall allow a reporting period to be locked, after which it refuses every write, **the Organization Administrator's included**, and to be reopened with acting user, timestamp and stated reason recorded.

| | |
|---|---|
| **Actors** | Organization Administrator locks and reopens. The lock refuses everyone, the administrator included. Every member reads the period and its reopenings. |
| **Traces** | UC-57, UC-58 · UX-13, UX-71, UX-72 · P-4 · BR-PER-1 · FR-18, FR-26, FR-53, FR-54 · entity *Reporting period* |
| **Surfaces** | S-14 (lock and reopen as designed states; a reopening displayed with its reason) · `POST /periods/{id}/lock` · `POST /periods/{id}/reopening` · `GET /periods/{id}/reopenings` |

**Preconditions.** To lock: the period is open. UC-57 states "the report is final and distributed"; **the system does not check it** at MVP. It is the administrator's judgement, and a lock is reversible by a recorded reopening (UC-58). It is revisited when task 41.3 lands (§12.5.6 task-182 identity and organization row, 182/11). To reopen: the period is locked and a genuine correction is required (UC-58).

**Inputs.** For a reopening, a reason of 1 … 500 characters, trimmed; whitespace is not a reason.

**Behaviour.**
1. **Locking is not a role gate** (§12.5.6 task-31.2 row, 30 Aug 2026). UC-57 and this requirement's criterion named the Reporting Contributor only. Read as a role gate, an administrator edits a locked period directly and the correction lands in the trail as ordinary editing, which contradicts UC-58's rule that a post-publication amendment is visible as an amendment. So the lock refuses every write, and **reopening is the only route through it**.
2. **The lock freezes the period shell as well as the report.** `PATCH /periods/{id}` is refused while locked, in the database by a `BEFORE UPDATE` trigger raising SQLSTATE `45001` as well as in the use case, which closes the read-then-lock race (§12.5.6 task-31.2 row; corrected 1 Sep 2026: the trigger is `BEFORE UPDATE` alone).
3. **The lock reaches every table inside it.** Every tenant table with a foreign key into `core.report` or `core.reporting_period` carries the `refuse_locked_write` trigger or is declared exempt, asserted by the schema invariants. A `DELETE` of a disclosure value in a locked report is refused too (§12.5.6 task-31.4 and task-34.1 rows).
4. **The period lock is the only writer of a report's `open` and `locked` status.** Locking moves every report in the period to `locked` in the same transaction, and reopening moves it back to `open` (§12.5.6 task-31.3 report-status row).
5. **A lock records who and when** (`lockedBy`, `lockedAt`). **A reopening is its own append-only record**, `core.period_reopening`, one row per reopening: when the lock was placed, when and by whom it was reopened, and the reason. It is tenant-scoped and immutable by grant, and it is exempt from the lock trigger because it is the record of the reopening (§12.5.6 task-31.2 row). `GET /periods/{id}/reopenings` answers them newest first, and the period displays that it was reopened, with the reason, thereafter (UX-72).
6. **The lock is the snapshot.** A locked report reads identically before and after the lock, and a reopen is visible in the record (§12.5.6 task-31.4 row). A locked period's entity snapshot never moves (FR-18).
7. Locking and reopening are irreversible-class under UX-71: S-14 distinguishes them and states the compensating mechanism. The read-only screen names the lock as its cause (UX-13).

**Refusals.**
- Not an Organization Administrator → 403 `insufficient-role`
- Unknown period → 404 `not-found`
- Locking a locked period, or reopening one that is not locked → 409 `conflict` (`core.period.already_locked`, `core.period.not_locked`)
- A reopening with no reason or a blank one → 400 `validation-failed`
- A write to the period shell → 409 `period-locked`; a write to its report → 409 `report-not-editable` (FR-26)

**Effects.** `locked_at` and `locked_by` set or cleared on the period. A `core.period_reopening` row on each reopening. Every report in the period changes status.

**Boundaries.** What the lock freezes in a report is FR-26's. The change trail is FR-54's. The person who locked is on the period; a reopened period's later edits are ordinary edits again.

**Acceptance criteria.**
- **AC-1** Given a locked period, when an editor writes a value in its report, then the answer is 409 `report-not-editable` and nothing changes. *(source: FR text; FR-26)*
- **AC-2** Given a locked period, when the Organization Administrator writes a value in its report or edits the period, then the answer is 409 (`report-not-editable`, `period-locked`). *(source: §12.5.6 task-31.2 row)*
- **AC-3** Given a locked report, when a disclosure value is deleted, then the delete is refused. *(source: §12.5.6 task-34.1 row)*
- **AC-4** Given a write that bypasses the use case, when it reaches the store on a locked period or report, then the database refuses it. *(source: §12.5.6 task-31.2 row; P-4)*
- **AC-5** Given a locked period, when it is reopened with a reason, then the acting user, the instant and the reason are recorded, the period accepts writes again, and the reopening is listed. *(source: FR text; UC-58 step 2)*
- **AC-6** Given a reopening with no reason or whitespace only, then the answer is 400 and the period stays locked. *(source: FR text; reopen DTO and database check)*
- **AC-7** Given an editor or a view-only member, when they lock or reopen a period, then the answer is 403. *(source: UC-57 and UC-58 actor; controller roles)*
- **AC-8** Given a locked report, then it reads identically before and after the lock, and a reopening is visible in the record. *(source: §12.5.6 task-31.4 row)*
- **AC-9** Given a reopening, then no runtime role can update or delete its record. *(source: §12.5.6 task-31.2 row)*
- **AC-10** Given a table that references a report or a period, then it carries the lock trigger or is declared exempt, and a table that does neither fails the build. *(source: §12.5.6 task-31.4 row)*
- **AC-11** Given a locked period with a report, then the report's status is `locked`, and `open` again after reopening. *(source: §12.5.6 task-31.3 report-status row)*
- **AC-12** Given a period locked twice, or reopened when not locked, then the answer is 409 `conflict`. *(source: lock use case; build-log task 31.2)*
- **AC-13** Given an open period whose report is unfinished or absent, when the Organization Administrator locks it, then the lock is accepted. *(source: §12.5.6 task-182 identity and organization row, 182/11; lock use case)*

**History.**
- 29 Aug 2026 · project owner · the report carries a status, and the period lock is the only writer of `open` and `locked` · §12.5.6 task-31.3 report-status row
- 30 Aug 2026 · project owner · the lock refuses every write, the administrator's included; the reopening is its own append-only table; the lock freezes the period shell · §12.5.6 task-31.2 rows. FR-22's acceptance criterion was amended in the same change
- 31 Aug 2026 · project owner · the lock's reach is a gate, not a review property; no report snapshot table · §12.5.6 task-31.4 rows
- 1 Sep 2026 · build · the lock reaches a `DELETE` of a disclosure value; the period trigger is `BEFORE UPDATE` alone, corrected from the record's claim · §12.5.6 task-34.1 and task-31.2 rows
- 5 Oct 2026 · project owner · locking checks no final-report precondition at MVP; revisit with task 41.3 · §12.5.6 task-182 identity and organization row (182/11); UC-57 amended

### FR-23 — The organization-wide overview

**Status.** Partial — delivered 30.5, 32.4 · remaining 40, 41.3 (completion and validation status), 187 (an archived entity's periods are not attention items)

**Obligation.** The system shall present an organization-wide overview of every period of every entity, with completion and validation status, in a single view.

| | |
|---|---|
| **Actors** | Every member reads. The Organization Administrator uses it to answer "is everything ready before the deadline". |
| **Traces** | UC-67 · UX-6, UX-13 · NFR-34 · FR-21, FR-22, FR-25, FR-165, FR-173 |
| **Surfaces** | S-05 (the home's three regions) · `GET /periods` without an entity filter |

**Behaviour.**
1. **A row is a period, not a report.** Since a report is an explicit creation, a period whose deadline nobody has started is the row the readiness question most needs, and it is invisible to `GET /reports` by construction. `GET /periods` answers the organization's periods with the entity's name and the report opened against each, nested as `{ id, status, updatedAt }` or null (§12.5.6 task-32.4 row).
2. **Standing** is one value: not started (no report), in progress, locked, ready to file, filed. The last two have no producer yet (task 41.3, task 47).
3. **What needs attention** is every period whose filing is not settled, soonest due date first, a period with no due date last by its period end. A locked period is never attention, whatever its standing, because there is nothing to act on and reopening is a deliberate act (S-05, 7 Sep 2026).
4. **A due date that has passed is marked, and nothing else about lateness is.** The comparison is read in the period's own timezone, because whether a deadline has passed is a legal question (NFR-34). No "due soon" threshold is invented: lead times are FR-173's notification configuration (§12.5.6 task-32.4 rows).
5. **Where did I leave off** is the one resumable report most recently touched, opened through S-07's own resolver; the screen never picks a step. **What is the state of everything** lists the rows by entity, then most recent year first.
6. **A row's action is removed by a locked period and by a view-only membership**, and the locked one says so (UX-13). The third cause, a suspended entitlement, is task 54's.
7. **Completion and validation status are refused until their producers exist, not drawn empty**: the roll-up is task 41.3's, server-computed because two counters would be two answers, and findings are task 40's. The wizard's own module list counts in the browser meanwhile (§12.5.6 task-32.4 and task-179.1 rows).
8. **Rows are periods only.** An entity with no period has no row; S-13 is where it is seen. The periods of an archived entity stay in the table and are not attention items (§12.5.6 task-182 identity and organization row, 182/16).

**Refusals.** No membership in the active organization → 403 `membership-required`.

**Boundaries.** The reports list is FR-25's. Deadline notices are FR-165's.

**Acceptance criteria.**
- **AC-1** Given an organization with entities and periods, then the overview lists each period with its entity's name, fiscal year, dates, due date and standing. *(source: FR text; §12.5.6 task-32.4 row)*
- **AC-2** Given a period with no report, then it is listed as not started and offers starting a report to a member who may. *(source: §12.5.6 task-32.4 row; S-05)*
- **AC-3** Given a view-only member, then the same rows are listed and the one write, starting a report, is absent. *(source: S-05 states; FR-25)*
- **AC-4** Given a due date earlier than today in the period's own timezone on a filing that is not settled, then the row is marked passed. *(source: §12.5.6 task-32.4 rows; NFR-34)*
- **AC-5** Given a locked period, then its row is not an attention item and says it is locked. *(source: S-05 amendment of 7 Sep 2026; UX-13)*
- **AC-6** Given attention items, then they are ordered by due date, soonest first, with a period lacking one last. *(source: S-05 amendment of 7 Sep 2026)*
- **AC-7** Given validation and completion have run, then each row shows its completion and validation status. *(source: FR text)* Unmet until 40 and 41.3.
- **AC-8** Given an entity with no period, then the overview has no row for it. *(source: §12.5.6 task-182 identity and organization row, 182/16)*
- **AC-9** Given a period of an archived entity, then it is listed in the table and is not an attention item. *(source: §12.5.6 task-182 identity and organization row, 182/16)* Unmet until 187.

**History.**
- 29 Aug 2026 · project owner · the report-status region ships as an explicit stub until reports exist · §12.5.6 task-30.5 row
- 7 Sep 2026 · project owner · the overview reads periods and not reports; the completion and validation columns are refused with their owners named; no "due soon" threshold; lateness read in the period's zone · §12.5.6 task-32.4 rows
- 5 Oct 2026 · project owner · "every entity and period" means every period of every entity; an archived entity's periods stay listed and ask for no attention · §12.5.6 task-182 identity and organization row (182/16)

## 3. Business rules held in this part

Moved from the index's §4.1 (BR-PER-1 … BR-PER-3) and §4.2 (BR-ACC-1) on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-PER-1 | A locked period refuses every write, the Organization Administrator's included; reopening is the only route through it, requires a stated reason and records actor and timestamp. *(Statement amended in this move. The index read "read-only for Reporting Contributors"; `architecture.md` §12.5.6's task-31.2 row, 30 Aug 2026, decided that locking is not a role gate, and the statement now says what the row decided.)* | FR-22, FR-26 |
| BR-PER-2 | Entity master data is point-in-time: a closed period keeps the values in force when its report was prepared. *(A period is closed once it is locked or its report's B1 has been opened, whichever comes first: the snapshot follows the entity until then, task 180.2; amended 5 Oct 2026, 182/9.)* | FR-18 |
| BR-PER-3 | A period's due date is distinct from its period end and is what deadline notices count down to. | FR-21, FR-165 |
| BR-ACC-1 | The founding user of an organization is an Organization Administrator; a pure Reporting Contributor arises only by invitation. | FR-13, D-1 |

## 4. Entities held in this part

Moved from the index's §5.1 and §5.2 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model. Three rows are brought to the 29 Sep 2026 decisions (tasks 175 and 177), which the index rows had not yet absorbed: *Organization*, *Reporting entity* and *Reporting period*.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Organization | Registered name, country, contact email and phone the platform writes to; type (a key of the registered organization-type vocabulary, `direct_sme` unless stated, 5 Oct 2026); each change attributed and timestamped. The legal form, registered address and report-cover contact are the reporting entity's | FR-13, FR-15 |
| Organization relationship | Kind (parent / child / peer), organization type (a registered configuration key; direct SME active at MVP) | FR-14 |
| Entity identifier | Held per reporting entity (29 Sep 2026): IDNO (primary), LEI (optional additional), format and checksum validity (the IDNO's check digit is evaluated from 188; weights 7, 3, 1, modulo 10) — DUNS / EU ID / PermID not modelled at MVP (OQ-18, 18 Aug 2026) | FR-16 |
| Reporting entity | Name, legal form, NACE code(s), site locations, registered address, report-cover contact, identifiers (FR-16), archived state | FR-17, FR-20 |
| Consolidation scope | Basis (individual / consolidated; null until stated), in-boundary subsidiaries (legal name; optional IDNO, LEI, country) | FR-19 |
| Entity master data version | Point-in-time copy of the entity record, its sites and its subsidiaries, taken at period open and re-taken on the entity's save until B1 is opened; immutable | FR-18, FR-27 |
| Reporting period | Fiscal year, start and end dates (calendar date and timezone), optional due date, pinned template and taxonomy version, link to the preceding period, reference to the entity snapshot, locked state with who and when, each reopening (who, when, reason) | FR-21, FR-22, FR-18, FR-66 |
