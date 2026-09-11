# @easyesg/ui — the design system

The tier 1/2/3 token cascade and §11.5's component inventory, consumed by **`apps/web` and
`apps/admin` alike**. That second consumer is the whole reason this package exists rather than a
`components/` folder in the tenant app, and it is the constraint behind most of what follows: a
component that only works in one of them is a defect here, not a variant.

**The root `CLAUDE.md` owns the rules; this file owns the package.** Where a rule is general — the
`'use client'` vocabulary rule, the `Slot` rule, UX-89's "reuse or add to the inventory", the four
homes of state — it is written at root because it holds for `apps/web` and `apps/admin` too, and
restating it here would create the second copy that drifts. This file carries what is true of
*these 47 components*: where things are, what has already bitten someone, and what finishing looks like.

## Current state

47 components in nine folders, 24 spec files, `src/styles/tokens.css` at 243 lines. Not every
component has its own spec — `forms/forms.spec.tsx` covers several together — so per-file absence
is not itself a gap.

| Folder | Components | What it is |
| --- | --- | --- |
| `primitives/` | 7 | Button, Panel, Skeleton, Spinner, TextLink, BrandMark, ProviderButton |
| `form/` | 11 | The presentational controls — `value`/`onChange`/`ref`, no form library |
| `forms/` | 7 | The react-hook-form binding. **A separate entry point** — see the traps |
| `feedback/` | 4 | Banner, Callout, EmptyState, ConsequenceDialogue |
| `navigation/` | 7 | GlobalBar, AccountMenu, WorkspaceNav, ChromeDrawer, LanguageSwitcher, Pagination, and `nav-link.tsx` — the injected-router seam, a fallback anchor and a type rather than an inventory entry, so §11.5 gains no row for it |
| `data-display/` | 2 | DataTable, StatusChip |
| `disclosure/` | 1 | DisclosureField — the anatomy every B1–B11 module reuses (task 36.1) |
| `domain/` | 3 | ReportingPeriodPicker, SaveStateIndicator, VersionPinIndicator |
| `archetypes/` | 5 | Focus, Index, Record, Wizard shells — see `src/archetypes/README.md` |

`src/archetypes/README.md` is the authority on the **nine** §4.6 archetypes and which screens
instantiate each. Two §4.4 labels are compositions rather than archetypes (OQ-7, closed): S-09 is a
Wizard sub-flow, S-18 a Comparison.

## Commands

There is **no `build` and no `lint` script here**, and neither is an oversight.

| From | Command | Notes |
| --- | --- | --- |
| here | `pnpm test` | `vitest run --passWithNoTests`, jsdom + Testing Library |
| here | `pnpm typecheck` | `tsc --noEmit` |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script |
| root | `pnpm boundaries` | Two rules govern this package — see the traps |
| root | `pnpm e2e:web` | The `identity` and `expansion` Playwright projects exercise these components through `apps/web`; `admin` through the console |

**`main` is `./src/index.ts` — consumers compile the TypeScript.** Nothing here emits, no `dist/`
ever appears, and `preboundaries` does not build it (it builds `i18n`, `validation` and `vsme`,
which do emit). So `pnpm --filter @easyesg/ui build` fails with "no such script" rather than doing
something quiet, and a stale `dist/` is one failure mode this package cannot have.

## Where things live

```
src/
├─ index.ts        The barrel — 48 exports. `@easyesg/ui`
├─ forms/index.ts  The react-hook-form binding. `@easyesg/ui/forms`, NOT in the barrel
├─ styles/         tokens.css — reached as `@easyesg/ui/src/styles/tokens.css`
├─ archetypes/     The nine §4.6 page templates. README.md is the map
├─ primitives/ form/ feedback/ navigation/ data-display/ disclosure/ domain/
└─ test/setup.ts   jest-dom matchers
```

**Three entry points, and the third is not a fallback.** `exports` declares `.`, `./forms` and
`./src/*`; the last is how both apps reach the cascade, in their own `globals.css`:

```css
@import '@easyesg/ui/src/styles/tokens.css';
```

## The traps

- **Tier 3 is the only tier a component may read.** `tokens.css` says so in the file: tier 1 is
  primitives (ramps, the 4px space scale, radius, motion), tier 2 the semantic roles designers and
  reviewers speak, tier 3 the component tokens. A component reading a tier 1 ramp directly is what
  makes UX-79's "re-skinning edits tier 1 only" false, and nothing fails when it happens.

- **`forms/` is the only place in this package that may import a form library**, and
  `ui-forms-out-of-the-barrel` in `.dependency-cruiser.cjs` fails the build if anything else does —
  the `src/index.ts` barrel above all. The moment the barrel re-exports it, react-hook-form joins
  the graph of every consumer, including the PDF worker and the email renderer, which read this
  package for UX-127's values and have no DOM. It is a **peer** dependency: the apps own the §12.1
  catalog pin (7.85.0), and a second resolved copy would give a field a different `Control` type
  than the form that created it. **23 import sites across the two apps today** — 16 until task 129,
  which split S-15's form into four section components over one `control` and so multiplied one site
  into five, and 20 until task 134 did the same to S-13's form with three. Worth knowing when reading this number: it counts *files that import the binding*, not
  forms, and splitting a form raises it without adding a form.

- **The six vocabularies live in directive-free sibling modules and are exported from the barrel
  *directly*.** `button-vocabulary.ts`, `data-table-vocabulary.ts`,
  `language-switcher-vocabulary.ts`, `version-pin-indicator-vocabulary.ts`,
  `nav-link-vocabulary.ts`, `skeleton-vocabulary.ts` — none carries
  `'use client'`, and a re-export routed through the component module would still be a client
  reference. The root file records what this cost when it was wrong (`BUTTON_TONE` reaching a
  Server Component as `undefined`, a button in the wrong colours, every gate green). When you add a
  vocabulary, add the sibling module — not an `as const` at the top of the component.

- **25 of the 47 modules carry `'use client'`, and each one needs a reason.** A hook, a browser API
  or a handler of its own. `Button` carried it from task 20 without needing it, and the day it
  gained `asChild` that directive took two screens down with a 500 — see the root file's *"A
  component that slots may not be a client boundary"*. `TextLink` is the control: same seam, never
  had the directive, has worked from a Server Component throughout.

- **A component that needs the app's router takes it as a prop; it does not take the app's
  finished markup** (task 105). `WorkspaceNav` used to accept a rendered `link` per item, which
  read as maximal flexibility and was the opposite: the anchor arrived opaque, so the component
  could not set `aria-current` on it — the attribute sat on a wrapping `<span>`, `role="generic"`,
  where no screen reader announces it — and every consumer had to build JSX in a `.map` before it
  could render a nav. It now takes `items` as data, `isActive` as a predicate and an optional
  `linkComponent`, and builds the anchor itself. **The test is the tell:** under the old shape the
  only spec of the current-section semantics lived in `apps/web`, against one caller, so a second
  consumer inherited no guard; `workspace-nav.spec.tsx` can assert it here because the anchor is
  now the component's. Reach for injection (`linkComponent`, `renderItem`) over a `ReactNode`
  prop whenever the component has semantics of its own to put on the element.

- **Presentational by rule: no text, no router.** Strings and `href`s arrive as props. This is not
  tidiness — the same component renders in three locales and in two apps with different routers,
  and `ui-is-presentational` fails the build on `packages/ui → apps/`.

- **`account-menu.tsx` is a known, uncoverable gap.** It wraps caller-supplied `items[].node` in
  Radix's own `DropdownMenu.Item asChild`, so its rule is the **caller's**: do not pass slotted
  children across the boundary. No syntax selector can see that. Safe today only because its one
  caller, `apps/web/src/shared/account-corner.tsx`, is itself a Client Component.

## Before you add a component

UX-89 is closed and the order of moves is not a preference — the root file states it. What is local
is where the work lands:

1. **Check the inventory first.** `design/screens/EasyESG Components.dc.html` renders every
   specimen and settles what the prose leaves ambiguous. A difference in *content* or *variant* is
   not a new component; a difference in **anatomy** is.
2. **A boolean prop added per screen means the split is wrong**, not that the component needs
   another flag. `vercel-composition-patterns` is installed for exactly this.
3. **All eleven §8.1 states before any instance is built** (UX-8, UX-90) — including the ones a
   screen has not asked for yet.
4. **Pick the folder from what it is, not from who asked**: `domain/` for something carrying
   product meaning, `primitives/` for something with none.
5. **Add it to `src/index.ts`.** A component not in the barrel is reachable only through
   `./src/*`, which is the escape hatch for CSS, not a component path.
6. **Amend `design_spec.md` §11.5 in the same change.** The inventory is an enumeration; a
   component that exists in code and not in §11.5 is the one nobody reviews.

## Before you call it done

- **Read the diff against `vercel-composition-patterns` and `vercel-react-best-practices`.** Both
  apply here, and `reactCompiler` is off (AD-9), so `useMemo`/`useCallback`/`memo()` are decisions
  rather than noise. A rule considered and declined with a reason is a decision; a rule never
  opened is an omission wearing the same clothes.
- **Both themes, and both apps.** The cascade is theme-aware and this package has two consumers;
  checking one is checking half.
- **A new vocabulary is a sibling module**, and a new `'use client'` has a reason you can name.
- **Then the run the root file's "Closing a task" calls for.** A change confined here still reaches
  `apps/web` and `apps/admin` through the dependency graph — `pnpm --filter "...[<base>]"` says so
  — which is why a shared package has no narrow sub-step run.
