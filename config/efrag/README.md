# `config/efrag/` — the official EFRAG VSME Digital Template

The binaries the export pipeline patches (tasks 45, 46). Tracked in git on purpose — `.gitignore`
says so in as many words: *"those are inputs the export pipeline needs — keep them tracked."*
They are not generated, and `packages/xlsx-patch` cannot round-trip a file it does not have.

| File | SHA-256 | Size |
| --- | --- | --- |
| `VSME-Digital-Template-1.3.0.xlsx` | `6652336d63ea523bb57dfb87d4f96ea5f032c82fa05f5a9b594223cfaa87df6e` | 778 434 B |
| `VSME-Digital-Template-Sample-1.3.0.xlsx` | `1ccf52b47567ea8f2524705ceac08918c6f319c3e8c9e0a6d4a3db336ab837ed` | 784 812 B |

Obtained from EFRAG and placed here 26 Aug 2026. The **Sample** is the same workbook with a
`Cover Page` sheet and worked example data filled in; it is the fixture task 45.1 wants
(*"open the official template and re-emit it unchanged"* needs a populated file to be a real test),
not a second template.

**Licence: MIT, Copyright (c) 2025 EFRAG** — stated on the workbook's own `Licence` sheet. Copying,
modifying and redistributing are permitted provided the notice travels with the file, which it does:
the notice is a sheet *inside* the binary, so a patched export carries it by construction. Do not
delete that sheet in `xlsx-patch`.

## What is not decided here

**The directory layout is `OQ-45`'s and task 45.3's, and nothing in this folder presumes it.**
`architecture.md` §10.7 describes this folder as holding template binaries *per version*, and OQ-45
— how a taxonomy version is written — names `config/efrag/<version>/` as one of the four places that
identifier becomes a path. These files therefore sit at the folder root under **EFRAG's own release
filenames**, which carry `1.3.0` because EFRAG put it there. Choosing `1.3.0/`, `2025-10/` or
anything else as a *directory* is the decision OQ-45 defers to the task that will have several real
EFRAG releases in front of it. Moving these two files into a subdirectory later costs one `git mv`.

Note also that a **template** version and a **taxonomy** version are separate dimensions in task
45.3's own wording (*"which template version, pinned, alongside the taxonomy version a report
already pins"*), and this file records only the first.

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

## The Translations sheet, and OQ-5

`1.3.0` ships **English plus eleven reviewed translations**, each attributed to a national standard
setter: Danish `da`, Dutch `nl`, French `fr`, German `de`, Irish `ga`, Italian `it`, Lithuanian `lt`,
Polish `pl`, Portuguese `pt`, Slovenian `sl`, Spanish `es`.

**Romanian is not among them, and neither is Russian.** `problem_overview.md` OQ-5 left exactly this
as *"an action for the `config/efrag` seeding task, not an open question"* — the action is now
performed against the current template, and the answer is on record here. Closing OQ-5 in its own
register, and the consequences for NFR-24, UX-47, UX-98, T-14 and task 46.3, belong to whoever takes
that decision; this file reports the observation and does not take it.
