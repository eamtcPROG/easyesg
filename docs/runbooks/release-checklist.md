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
