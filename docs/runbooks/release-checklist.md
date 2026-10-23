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
and the operator named is the seed's temporary *EasyESG SRL*.

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
