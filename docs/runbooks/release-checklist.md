# Release checklist — the items a gate cannot run

What a person checks by hand before a release, because no gate can. Each item names the requirement it verifies and
why it is manual. A release is not cut while an item below is unchecked or failed; a failure is a defect against the
named requirement, filed before the release goes out.

## The Excel export in Microsoft Excel (NFR-20, T-12)

**Why by hand.** NFR-20 requires the EFRAG Digital Template exports to open *"without a repair prompt in Microsoft 365,
current Excel and LibreOffice Calc"*. LibreOffice Calc is the automated gate (`apps/api/test/xlsx-export.e2e-spec.ts`,
task 46.2, run by `pnpm e2e` in CI); Microsoft 365 and desktop Excel cannot be driven on a Linux runner, because
server-side Office automation is unsupported there (`architecture.md` T-12). Naming what the gate does not cover is
part of the gate's deliverable, not a caveat on it.

**Produce the files.** On the release candidate, against a seeded environment, export the golden report
(`config/golden-reports/bakery-2026/`) to Excel once in English and once in Russian, and one FY2025 report — which pins
template `1.2.0`, the release with no Footnotes sheet — once in English.

**For each file, in Microsoft 365 (Excel on the web) and in current desktop Excel on Windows:**

1. It opens with **no repair prompt** and no *"We found a problem with some content"* bar.
2. **The formulas compute on open**: *Social Disclosures* D137 shows the turnover rate (5 ÷ 49, about 10.2%, for the
   golden report) and D143 the accident rate (4), not `-`. Excel honours the file's `fullCalcOnLoad`; a dash there means it did not.
3. **The dropdowns work**: on *General Information*, the legal form, the NACE code and the country cells open their
   lists, and the written values are entries of them (no invalid-data marker when *Circle Invalid Data* is used).
4. **The named ranges are intact**: *Formulas ▸ Name Manager* lists EFRAG's names, `Assets` among them, none newly
   `#REF!`.
5. **The template's own checks read as the report says**: the *Table of Contents & Validation* sheet's status column
   reads as `expected.json` says it does in Calc — every answered section `OK`, B1's identifier line `MISSING VALUE`
   (no scheme for an IDNO) — and B1's omitted-disclosures list names the omitted section.
6. **The notes are readable**: on `1.3.0`, the *Footnotes* sheet shows each footnote with the cell it explains chosen
   from EFRAG's list; on `1.2.0`, each noted figure carries a cell note that opens on hover.
7. **The file's properties** (*File ▸ Info*) name the export's language and the person who asked, and the application
   recorded is the platform.

Record the Excel build numbers checked, and the outcome of each item, in the release's notes.

## The legal documents and the operator they name, before the pilot (FR-205, NFR-5, NFR-23; task 75)

**Why by hand.** The terms of service, the privacy notice and the cookie policy are drafted in the repository and
published **provisional** (`architecture.md` §12.5.6's task-75 row (6)); whether they are lawful is counsel's judgement,
and the operating company's registered details are a fact only the owner holds (row (7)). Neither is a property a gate
can test. **This item binds the release that opens the pilot (task 48)** — until then each page says it is provisional,
and the operator named is the seed's temporary *EasyESG SRL*. **Version 1.0's approval was reported on 30 Oct 2026**
(project owner, task 226): `provisional` is `false` and the effective date stays 13 Oct 2026, so step 2 is done for it;
what step 1 also asks, and the reviewers' names, still go in the release's notes. A later version goes through both.

**Before that release:**

1. **Counsel has approved the three documents in Romanian, English and Russian** — the Russian by a Russian-speaking
   reviewer, each locale on its own (NFR-23) — and has said which locale's text binds, if any: the documents state none,
   by row (6). Counsel has also said whether Law No. 195/2024 requires a data protection officer for this processing; if
   it does, the contact A-21 holds is theirs.
2. **The approved text is in the catalogues** (`apps/web/src/messages/{ro,en,ru}.json`, namespace `legal`), and
   `packages/i18n/src/legal-standing.ts` gives each document its version, its effective date as a calendar day in
   Chișinău, and `provisional: false` — so no page shows *Versiune provizorie* any more. **A version moved here sends
   every account that accepted the earlier one to S-43 to accept again** (task 195), and a registration open across the
   release is refused and reloaded — which is what a changed text calls for, and nothing a release should do by accident.
3. **A-21 holds the operating company** — its registered name, IDNO, registered address and data-protection contact,
   not the seed's *EasyESG SRL* and IDNO `1099600012345` — and its change attribution names the operator who saved it.
   The terms and the privacy notice, read with no session, show the same four facts.
4. **What the privacy notice says of the deployment is still true of it**: the hosting region (NFR-27); the email
   provider's location — the notice states the pre-launch exception NFR-27's amendment allows, so if the pilot counts
   as production, that sentence goes or the provider moves; and the retention periods (FR-207 behaviour 7).
5. **The supervisory authority** the privacy notice names — the National Center for Personal Data Protection of the
   Republic of Moldova — is current, and counsel has said whether its address belongs on the page.
6. **The registration screen's sentence** opens both documents it names, in each locale.

Record the approval — its date and its reviewers — the versions and effective dates published, and the operator's
details as saved, in the release's notes.

## The help centre's starter library, before the pilot (FR-61, NFR-23; task 76)

**Why by hand.** The six help topics and six articles the store starts with (`config/seed/help-topic.*.json`,
`help-article.*.json`) were drafted in the repository by the people who built the product, not by the content team
(`architecture.md` §12.5.6's task-76 row (7)). Whether an article answers its question in the reader's own terms, and
whether its English and Russian read as written rather than translated, is an editor's judgement, not a property a gate
can test. The store already refuses what it can judge — no Romanian, a half-written locale, an internal identifier, an
HTML tag (row (3)). **This item binds the release that opens the pilot (task 48).**

**Before that release:**

1. **Each article says only what the platform does in that release** — the sections it names, the exports it offers, the
   way a period locks — read against the product, not against the article's memory of it.
2. **The content team has reviewed each topic and article in Romanian, English and Russian**, each locale on its own
   (NFR-23), and republished what it changed on A-03 (67.5). The loader keeps a version an operator published, so no
   later seed run undoes the review (task 172).
3. **No plan copy is published that names a plan the billing catalogue does not hold** — plan copy is 53.3's, keyed by
   the codes 53.1 creates.

Record the reviewers and the articles each signed off in the release's notes.

## Support requests and the privacy notice's version 1.1, before the pilot (FR-212, FR-205, FR-207; task 77)

**Why by hand.** A request to support is delivered to the address the `support_channel` artefact holds, seeded with
`ajutor@easyesg.md` (`architecture.md` §12.5.6's task-77 row (5)); whether that mailbox exists and a person reads it is a
fact about the operator, not the build. The privacy notice says what a request keeps as version **1.1, provisional** until
counsel approves it (row (11)), as version 1.0 was until task 226. **This item binds the release that opens the pilot
(task 48).**

**Before that release:**

1. **The support address is a mailbox someone reads**, and a request sent from S-34 on the release candidate arrives in
   it, in Romanian, with its reference in the subject and the reader's address as its Reply-To — so pressing *Reply*
   writes to the reader. A different address is published to the `support_channel` artefact, not edited in the seed.
2. **Counsel has approved version 1.1 of the privacy notice** in Romanian, English and Russian — what a support request
   keeps, why and for 24 months — and `packages/i18n/src/legal-standing.ts` gives it `provisional: false` and the date
   counsel sets. Every account that accepted 1.0 is sent to S-43 to accept 1.1 (task 195).
3. **The data-subject request check is in the runbook** (73.3): a request is acted on only once it is confirmed from the
   address registered on the account it concerns (FR-207 behaviour 2).

Record the mailbox checked, the reference of the test request, and counsel's approval of 1.1, in the release's notes.
