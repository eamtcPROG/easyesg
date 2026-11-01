# One Kind per Folder

How a feature tree is shaped in the two easyesg front ends, written from one feature's refactor
(`apps/web/src/features/organization/`, tasks 122 … 129) and stated as the rule for `apps/web` and
`apps/admin` by the project owner on 11 Sep 2026 (task 132). The companion skill,
`one-idea-per-file`, carries the file rules and binds every workspace including `apps/api`.

## Structure

- `SKILL.md` - Entry point: scope, exemptions, categories, quick reference
- `rules/` - One rule per file, `<prefix>-<name>.md`, each with the incorrect and correct tree
- `metadata.json` - Version, organization, abstract, references

No compiled document, on purpose: it would be a second copy of the rules, free to drift.

## Rules

### Directory shape (CRITICAL)

- `folder-files-or-folders.md`
- `folder-per-screen-not-per-kind.md`
- `folder-scaffolds-go-when-built.md`

### Screen folders (HIGH)

- `screen-three-kinds.md`

### Component trees (HIGH)

- `components-mirror-the-return.md`
- `components-region-anatomy.md`

### Shared leaves (MEDIUM-HIGH)

- `shared-how-many-siblings.md`
- `shared-admission-test.md`
- `shared-namespace-declared-once.md`

### Moves and gates (MEDIUM)

- `move-names-keep-prefix.md`
- `move-grep-the-mocks.md`
- `move-gate-scoped-where-it-holds.md`

## The worked example

`apps/web/src/features/organization/` meets every rule here; `apps/web/CLAUDE.md` keeps its numbers
and the traps each move found, and `src/test/folder-shape.spec.ts` — rooted at `src/` — is the failing state.
