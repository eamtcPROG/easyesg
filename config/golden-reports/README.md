# config/golden-reports

**Reports written through the api as a reporter would, and what each export must say about them** — the golden-report
corpus (task 46.4; NFR-18, NFR-19; `architecture.md` §12.5.6's task-46 row (8)), beside `config/version-pinned/`.

`apps/api/test/golden-reports.e2e-spec.ts` builds each report on the test stack — entity, period, report, every value
through the wizard's own write, the derivation inputs, the calculator's lines and a run — then exports it to PDF and to
the EFRAG Digital Template in each of its languages, opens the Excel file in LibreOffice Calc with Calc's own defaults
(`infra/compose/calc`), and diffs every file against the expectation stored beside the report. It runs in `pnpm e2e`,
and it is the suite NFR-19's nightly replay will run.

## What is here

One directory per report:

| File | Holds |
| --- | --- |
| `report.json` | The inputs, as the api's routes take them: `entity`, `period`, `values` (one per field, as the wizard writes it — `ordinal` for a site, `dimensionKey` for a member), `derivationInputs`, the calculator's `sources`, and the languages it `exports` in |
| `expected.json` | `pins` (the template and taxonomy versions the report must pin), `pdf` (phrases each language's PDF must say), `xlsx` (per language, `Sheet!A1` → what Calc shows there once the file is open) and `computed` (each figure the platform derives and the template computes again, by element and cell) |

`bakery-2026` answers every Basic Module section — a calculated Scope 1 and location-based Scope 2, a nil return, a
field not available, a section withheld, a figure the template computes stated beside it, and the inputs of every
figure the platform derives the way the template does.

## What the expectation holds the export to

- **Each figure where EFRAG's template reads it** — the cells the map writes, in English whatever the export's language
  (182/31), and the footnotes in the export's language.
- **The template's own checks.** The *Table of Contents & Validation* sheet's status per section is in the expectation:
  every section the report answers reads `OK`, and B1's identifier line reads `MISSING VALUE`, because the template's
  scheme list has no entry for an IDNO (task-46 row (5)). A status that moves is the template disagreeing with what the
  export wrote, which is the finding this corpus exists to surface.
- **182/32's equality.** For each `computed` entry, the value Calc computes by the template's formula must equal the
  figure the platform stored, to a double's precision, in every language's file.
- **NFR-18's agreement, as a reader sees it.** The workbook's cells hold the platform's figures exact, and EFRAG's own
  cell formats show them at two places, a percentage at two decimals of the percent, the intensity at seven; the PDF's
  phrases include the same figures at those digits (task-46 row (10)) — `34.92`, `10.20%` — so the two files cannot
  print one figure two ways. Calc's reading is its raw value, which is why the PDF carries the digits.

## Changing an expectation

**An expectation changes only with the change that moved it, in the same diff.** Run the suite, read each moved cell
against the change, and copy the received value from the failure's diff — a value that moved for no reason is the
defect. Never regenerate an expectation wholesale from a run: the point of the file is that a person read each value
once, against the arithmetic it should come to.

A new report is a new directory; the suite picks up every directory here.
