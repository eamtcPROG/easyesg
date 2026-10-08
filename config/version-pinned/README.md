# config/version-pinned

**Every version of a pinned artefact that `config/seed` has shipped, kept, with what was recorded under it** — NFR-87's
version-pinned regression suite (task 201; `architecture.md` §12.5.6's task-201 row).

A report keeps the version it was computed under: a calculation run pins its factor set (FR-35), and a locked period
pins its validation rule set (FR-73 item 9). The database holds that data still — a run's results and a lock's revision
are immutable. What can still restate a figure is **code**: a change to the factor-set reader, the arithmetic or the
rule interpreter changes what an *earlier* version computes. The test stack starts empty and holds only the seed's
current versions, so the earlier ones are kept here, and the api's unit suite re-evaluates every report pinned to every
one of them on every run, and requires exactly the figures recorded.

## What is here

One directory per pinned artefact, named as its seed file without `.json`, holding one file per version:

| Directory | Kept per version | Re-evaluated by |
| --- | --- | --- |
| `emission-factor-set.md/` | the set's payload, and runs pinned to it with the results each stored per B3 scope | `apps/api/src/modules/core/calculator/version-pinned.spec.ts`, through `ReadCalcRun` — NFR-19's replay |
| `validation-rule-set.vsme/` | the set's payload, and reports pinned to it — scope, answers, prior — with the findings each came to | `apps/api/src/modules/core/validation/version-pinned.spec.ts`, through the interpreter as a validation run calls it |

Two artefacts because only two are pinned: thresholds are read as at today (FR-72 item 3), and a derivation's formula
is code pinned with the template (DR-4).

## The two rules

**A kept version is never edited.** Its payload is what reports were pinned to and its figures are what they came to;
editing either rewrites history the suite exists to hold. A citation corrected in the seed is a new version here, not an
edit to the old one.

**A change to the seed adds a version here, and keeps the earlier ones.** The suite refuses a seed whose factor set or
rule set is not one of the kept versions, so editing `config/seed/emission-factor-set.<country>.json` or
`config/seed/validation-rule-set.vsme.json` fails `pnpm test` until:

1. the new payload is copied here as a new file — a factor set named by its label, a rule set by the date it shipped;
2. the earlier version's runs or reports are copied into it, so the new version is held to the same coverage;
3. each one's figures are recorded **as the new version computes them** — run the spec and take the received values from
   its diff, then read each moved figure against the change that moved it, since a figure that moved for no reason is
   the defect this suite exists to catch.

## Coverage is asserted, not hoped for

For each kept factor set, moving any source's factor, scope or unit conversion must leave some kept run not
reproducing; for each kept rule set, removing any rule must change some kept report's findings. A source, unit or rule
that nothing here exercises fails the suite by name — add a run or a report that makes it count.
