# `config/efrag/` — the official EFRAG VSME Digital Template

The binaries the export pipeline patches (tasks 45, 46). Tracked in git on purpose — `.gitignore`
says so in as many words: *"those are inputs the export pipeline needs — keep them tracked."*
They are not generated, and `packages/xlsx-patch` cannot round-trip a file it does not have.

| File | SHA-256 | Size | Written against |
| --- | --- | --- | --- |
| `1.3.0/VSME-Digital-Template-1.3.0.xlsx` | `6652336d63ea523bb57dfb87d4f96ea5f032c82fa05f5a9b594223cfaa87df6e` | 778 434 B | taxonomy `2026-05-01` |
| `1.3.0/VSME-Digital-Template-Sample-1.3.0.xlsx` | `1ccf52b47567ea8f2524705ceac08918c6f319c3e8c9e0a6d4a3db336ab837ed` | 784 812 B | — (a fixture, registered as no template) |
| `1.2.0/VSME-Digital-Template-1.2.0.xlsx` | `a3f24b0e5e70c6bf125b742fd8b676a322d87b118542bf162de0699fb79f7abb` | 646 105 B | taxonomy `2026-02-01` |

`1.3.0` and its Sample were obtained from EFRAG and placed here 26 Aug 2026; `1.2.0` was downloaded
11 Oct 2026 from `https://xbrl.efrag.org/downloads/vsme/VSME-Digital-Template-1.2.0.xlsx`, which EFRAG
lists as published 27 Feb 2026 beside its February 2026 taxonomy package — the project owner
authorised the download (task 45.3). **Which taxonomy each is written against is read from the
workbook itself**: EFRAG writes the taxonomy's entry point into the template, and `1.3.0` names
`https://xbrl.efrag.org/taxonomy/vsme/2026-05-01/vsme-all.xsd` while `1.2.0` names the `2026-02-01`
one; `apps/api`'s `digital-template-artefact.spec.ts` holds each registration to it.

The **Sample** is the same workbook with a `Cover Page` sheet and worked example data filled in; it is
task 45.1's populated fixture (*"open the official template and re-emit it unchanged"*), not a second
template, and `.dockerignore` keeps it out of every image.

**Licence: MIT, Copyright (c) 2025 EFRAG** — stated on the workbook's own `Licence` sheet. Copying,
modifying and redistributing are permitted provided the notice travels with the file, which it does:
the notice is a sheet *inside* the binary, and `packages/xlsx-patch` leaves every part it does not
write byte for byte as it arrived, the Licence sheet's included.

## Layout and registration

**One directory per template version, named with EFRAG's own template release identifier** — `1.3.0`,
`1.2.0` — and each file under EFRAG's own file name (`architecture.md` §12.5.6's task-45 row (1),
project owner, 11 Oct 2026). A template version is a dimension of its own beside the taxonomy version a
report pins (DR-4): a template fix EFRAG releases against an unchanged taxonomy is a new directory, not
a replaced file.

**A binary here is registered, never uploaded** (182/48): `config/seed/vsme-digital-template.<version>.json`
names its taxonomy version, its file and its SHA-256, and the adoption windows in
`config/seed/reporting-taxonomy.vsme.json` name which template a newly opened period pins. The api
resolves a report's pin through that registration to the file here and refuses one whose digest
differs, so **replacing a file without a new registration fails every export of it** — which is the
point. The api image copies this folder.

**To add a release:** a directory, the binary under EFRAG's name, its registration in `config/seed/`
with the digest, and — when the platform adopts it — a window in the adoption artefact. The registry's
artefact spec then proves the window resolves and that the workbook names the taxonomy it is
registered against.

## What is in the workbook

Sixteen sheets — fourteen visible, two hidden — profiled 26 Aug 2026 from `1.3.0`:

| Sheet | Rows | Data validations | Formulas | Why it matters here |
| --- | --- | --- | --- | --- |
| Language Selection | 64 | 1 | 2 | One dropdown drives every label on every sheet |
| Introduction | 39 | 0 | 37 | — |
| Table of Contents & Validation | 70 | 0 | 178 | The template's *own* validation verdicts — not `packages/validation`'s |
| General Information | 531 | 19 | 629 | B1–B2 |
| Environmental Disclosures | 547 | 46 | 829 | B3–B7; the densest sheet, and the one the calculator feeds |
| Social Disclosures | 198 | 19 | 229 | B8–B10 |
| Governance Disclosures | 218 | 11 | 39 | B11 |
| Footnotes | 1 525 | 1 | 6 | — |
| Fuel Converter | 140 | 6 | 222 | EFRAG's own conversion, parallel to our Scope 1 calculator |
| Fuel Conversion Parameters | 108 | 10 | 0 | The factor table behind it |
| Unit Of Measurement Converter | 136 | 8 | 43 | — |
| Enumeration Lists | 1 049 | 0 | 276 | The closed vocabularies the dropdowns bind to |
| Translations | 806 | 0 | 498 | See below — this one carries a finding |
| Licence | 21 | 0 | 0 | MIT / EFRAG, above |
| *Technical Sheet* (hidden) | 259 | 0 | 589 | Localisation formulas, display strings, lat/long derivation |
| *Footnote (Taxonomy) Labels* (hidden) | 144 | 0 | 143 | Taxonomy element keys → footnote labels |

**121 data validations and 3 720 formulas across the workbook** is the measured reason task 45 patches
rather than regenerates, and the reason 45.1 (*a no-op patch is provably a no-op*) comes first.

Labels are keyed, not positional: `Translations!A` holds ids of the form
`template_label_entity_name_document_information`, and each sheet's visible text is a formula
resolving that id against the selected language. That is the seam a patcher writes values through
without touching wording.

## What the Excel export does with them (task 46)

Each binary has a map in `config/seed/` — `vsme-digital-template-map.<version>.json`, generated by
`node tools/extract-vsme-template-map.mjs <version>` from the binary itself — saying where each value of a report goes.
**A new EFRAG release is a new binary, a registration and a map**, never code (AD-4). The export patches the binary the
report pins through `packages/xlsx-patch`: inputs written, formulas left to compute, the language cell set to English,
notes on the Footnotes sheet (`1.3.0`) or as cell notes (`1.2.0`, which has no Footnotes sheet), and the platform named
as the file's writer so LibreOffice recomputes on open as Excel does (`architecture.md` §12.5.6's task-46 row).

The extractor works around EFRAG's own defects and asserts each, so a release that fixes one is noticed:
B7's waste-type dropdown sits on the materials table (`D437:F437`) rather than the waste table; B10's minimum-wage
`YES`/`NO` validation sits on `C143`, a B9 label; and EFRAG's taxonomy labels the asbestos member *Abestos* while this
template's pollutant list spells it right.

## The Translations sheet, and OQ-5

`1.3.0` ships **English plus eleven reviewed translations**, each attributed to a national standard
setter: Danish `da`, Dutch `nl`, French `fr`, German `de`, Irish `ga`, Italian `it`, Lithuanian `lt`,
Polish `pl`, Portuguese `pt`, Slovenian `sl`, Spanish `es`.

**Romanian is not among them, and neither is Russian.** `problem_overview.md` OQ-5 left exactly this
as *"an action for the `config/efrag` seeding task, not an open question"*. The observation recorded
here was acted on 31 Aug 2026 (task 33.2): T-14, NFR-24, UX-47 and UX-98 now say that only English
VSME labels carry EFRAG standing, and the Excel export sets the template's language cell to English
(FR-50 behaviour 10, task 46.1).
