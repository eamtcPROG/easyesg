# One Idea per File

How a source file is cut in the easyesg workspaces, written from one screen's refactor (S-05 and
`apps/web/src/features/organization/`, tasks 115 … 129) and stated as the rule for every workspace
by the project owner on 11 Sep 2026 (task 132). The companion skill, `one-kind-per-folder`, carries
the directory rules for the two front ends.

## Structure

- `SKILL.md` - Entry point: scope, categories, quick reference
- `rules/` - One rule per file, `<prefix>-<name>.md`, each with the incorrect and correct shape
- `metadata.json` - Version, organization, abstract, references

No compiled document, on purpose: it would be a second copy of the rules, free to drift.

## Rules

### Entry files (CRITICAL)

- `shell-composes-only.md`
- `shell-parallel-by-composition.md`
- `shell-boundary-per-reading-region.md`

### Sections and parts (HIGH)

- `section-reads-parts-render.md`
- `section-pass-what-was-read.md`
- `section-compute-once.md`

### File granularity (HIGH)

- `file-one-idea.md`
- `file-one-behaviour-api.md`

### Pure logic (MEDIUM-HIGH)

- `pure-logic-leaves-the-component.md`
- `pure-derive-during-render.md`

### Reasons and measurement (MEDIUM)

- `reason-docblock-carries-the-why.md`
- `reason-measure-structural-claims.md`

## The worked example

`apps/web/src/features/organization/` meets every rule here and every rule in
`one-kind-per-folder`; `apps/web/CLAUDE.md` keeps its numbers and the traps each move found.
