# @easyesg/ui — the design system

The tier 1/2/3 token cascade and §11.5's component inventory, consumed by **`apps/web` and
`apps/admin` alike**. That second consumer is the whole reason this package exists rather than a
`components/` folder in the tenant app, and it is the constraint behind most of what follows: a
component that only works in one of them is a defect here, not a variant.

**The root `CLAUDE.md` owns the rules; this file owns the package.** Where a rule is general — the
`'use client'` vocabulary rule, the `Slot` rule, UX-89's "reuse or add to the inventory", the four
homes of state — it is written at root because it holds for `apps/web` and `apps/admin` too, and
restating it here would create the second copy that drifts. This file carries what is true of
*these 91 components*: where things are, what has already bitten someone, and what finishing looks like.

## Current state

91 components in nine folders, 61 spec files, `src/styles/tokens.css` at 506 lines — **light and
dark since task 82**, with `styles/tokens.spec.ts` measuring every semantic pairing in both
schemes against UX-101 and writing `styles/contrast-record.md` as it goes. The spec count is `.spec.tsx` files only, so `tokens.spec.ts` — which renders nothing, it parses the stylesheet — and the six other `.spec.ts` files over pure modules are not in it. Not every
component has its own spec — `forms/forms.spec.tsx` covers several together — so per-file absence
is not itself a gap.

| Folder | Components | What it is |
| --- | --- | --- |
| `primitives/` | 8 | Button, Panel, Skeleton, Spinner, TextLink, BrandMark, ProviderButton, and task 50.2.1's Badge |
| `form/` | 15 | The presentational controls — `value`/`onChange`/`ref`, no form library — and since task 179.2 the Radio group, drawn as the B1 artboard's option cards, and since task 204.2 the File upload, the Components sheet's dropzone, first read by S-09's spreadsheet import, and since task 221 §11.5's Number-with-unit — a figure's value and its unit's box, with `UnitLabel` for a unit the taxonomy or the filing fixes |
| `forms/` | 8 | The react-hook-form binding. **A separate entry point** — see the traps |
| `feedback/` | 6 | Banner, Callout, EmptyState, ConsequenceDialogue, task 170's Dialog — a record or a form over a list — and the Expiring callout (28 Sep 2026), a submit's message that leaves after its dwell, with `useDismissible` beside it |
| `navigation/` | 17 | GlobalBar — the console's band too, through a tone — task 50.2.1's NotificationBell, the band's notification entry and since 50.2.2 its panel's trigger, here because the icon set is — AccountMenu, WorkspaceNav, task 67.1's ConsoleNav — a collapsible sidebar since 25 Oct 2026, its icon strip from `medium` — ChromeDrawer, LanguageSwitcher, Pagination, task 83.2's OrganizationSwitcher, task 170's ConsoleDrawer — the console navigation below `medium` — OverflowMenu, task 203.3's SkipLink — UX-99's skip link to `<main>`, with no text and no directive of its own — task 173's LockedNavEntry — a section the reader's role may not open, drawn by the band, the drawer and `apps/web`'s account rail — and the Breadcrumb (28 Sep 2026), a record's way back to the section it lies beneath, and since task 179.1 the BackArrow — the square way back `PageHeading` drew and the wizard's bar now draws too — with `console-nav-sections.tsx`, the sections the column and the drawer both draw and a part rather than an inventory entry, and `nav-link.tsx` — the injected-router seam, a fallback anchor and a type rather than an inventory entry, so §11.5 gains no row for it |
| `data-display/` | 4 | DataTable — whose columns may fill, fit and centre since 29 Sep 2026 — StatusChip, and task 143's EnrolmentCode with its loading arm |
| `disclosure/` | 1 | DisclosureField — the anatomy every B1–B11 module reuses (task 36.1) |
| `domain/` | 11 | ReportingPeriodPicker, SaveStateIndicator, VersionPinIndicator, and §6.10's two from task 142 — UsageCounter beside an action, EntitlementGate after a refused one — and since task 42.2 S-08's parts and §11.5's completeness meter: `CompletenessMeter`, the panel's frame `ValidationPanel`, a module's `ValidationGroup`, a `ValidationFinding`, `ValidationDock` where the panel is docked, and `ValidationCountBar`, its seat below `wide` |
| `archetypes/` | 21 | Focus, Index, Record, Wizard shells, and since 29 Sep 2026 the Record's card form, `RecordCard`; since 30 Sep 2026 `PageHeading`, the heading with its way back that `RecordCard` built and S-14's Index and Record share; and since task 179.1 the Wizard's parts — its bar, the step list's group, row and mark, and the list below `wide` — see `src/archetypes/README.md`; and since task 74.2 the tenth archetype, Content — `ContentShell`, `ContentSection`, `ContentContents`, `ContentPeers` with its scroll leaf, and `ContentWide`; and since task 43.2 the Document archetype — `DocumentShell`, `DocumentPages` and `DocumentFrame`, the one client leaf, which says the document is being assembled until its frame has loaded it |

`src/archetypes/README.md` is the authority on the **ten** §4.6 archetypes and which screens
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
ever appears, and `preboundaries` does not build it (it builds `i18n`, `validation`, `vsme` and `xlsx-patch`,
which do emit). So `pnpm --filter @easyesg/ui build` fails with "no such script" rather than doing
something quiet, and a stale `dist/` is one failure mode this package cannot have.

## Where things live

```
src/
├─ index.ts        The barrel — 100 exports. `@easyesg/ui`
├─ forms/index.ts  The react-hook-form binding. `@easyesg/ui/forms`, NOT in the barrel
├─ styles/         tokens.css — reached as `@easyesg/ui/src/styles/tokens.css`
├─ archetypes/     The ten §4.6 page templates. README.md is the map
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

- **The dark scheme is `prefers-color-scheme` only, and only tier 2 moves.** Task 82 authored a
  second tier-1 palette (`--pine-dark-*`, `--slate-dark-*`, a legible step and a dark tint per state
  hue) and re-points tier 2 inside one media block. **A component needs no dark styles** — everything
  that reads tier 3 or tier 2 inherits. The tier-3 tokens that read tier 1 *directly* are the
  exception and are re-pointed by hand in that block, as are the tier-3 tokens that hold their own
  literal — `--scrim` and the three elevation levels.
  `tokens.spec.ts` asserts the real rule instead: any token carrying colour that resolves to the
  *same* literal in both schemes fails, unless it is named in that spec's `SCHEME_INDEPENDENT` set
  with a reason, and the reasons differ by member: the global bar's white-over-brand alphas sit on a
  band that is dark in both schemes, and since task 143 the Enrolment code's plate pair holds dark on
  light because a camera reads that symbol and a reversed QR is one a scanner may be unable to
  decode. Since task 67.1 the console's chrome (`--consolebar-*`, `--consolenav-*`) is dark in both
  schemes for the global bar's reason.
  The spec's own set is the enumeration; this sentence names the reasons. So adding a tier-3 token that reads tier 1 no longer relies on
  anyone remembering — it goes red.

- **No colour may be written outside `tokens.css`** (none is, since task 82). A scrim is `--scrim`, whose dark value is 65 % because 45 % black over a near-black page separates nothing.

- **`forms/` is the only place in this package that may import a form library**, and
  `ui-forms-out-of-the-barrel` in `.dependency-cruiser.cjs` fails the build if anything else does —
  the `src/index.ts` barrel above all. The moment the barrel re-exports it, react-hook-form joins
  the graph of every consumer, including the PDF worker and the email renderer, which read this
  package for UX-127's values and have no DOM. It is a **peer** dependency: the apps own the §12.1
  catalog pin (7.85.0), and a second resolved copy would give a field a different `Control` type
  than the form that created it. **49 import sites across the two apps today**. It counts *files that import the binding*, not forms — splitting a form raises it without adding a form — and not mentions (`docs:check` counts imports since 14 Sep 2026).

- **The thirteen vocabularies live in directive-free sibling modules and are exported from the barrel
  *directly*.** `button-vocabulary.ts`, `data-table-vocabulary.ts`,
  `language-switcher-vocabulary.ts`, `version-pin-indicator-vocabulary.ts`,
  `nav-link-vocabulary.ts`, `skeleton-vocabulary.ts`, `usage-counter-vocabulary.ts`,
  `global-bar-vocabulary.ts`, `badge-vocabulary.ts`, `dialog-vocabulary.ts`, `wizard-step-vocabulary.ts`,
  `skip-link-vocabulary.ts` (task 203.3), `validation-vocabulary.ts` (task 42.2) — none carries
  `'use client'`, and a re-export routed through the component module would still be a client
  reference. The root file records what this cost when it was wrong (`BUTTON_TONE` reaching a
  Server Component as `undefined`, a button in the wrong colours, every gate green). When you add a
  vocabulary, add the sibling module — not an `as const` at the top of the component.

- **39 of the 91 modules carry `'use client'`, and each one needs a reason.** A hook, a browser API
  or a handler of its own. A directive without one is how `Button`'s `asChild` took two screens down with a 500 — the root `CLAUDE.md`'s "A component that slots may not be a client boundary"; `TextLink`, the same seam without the directive, is the control.

- **A component that needs the app's router takes it as a prop; it does not take the app's
  finished markup** (task 105). A rendered `link` arrives opaque, so the component cannot put its own semantics on it (`aria-current` landed on a wrapping `<span>` no screen reader announces). `WorkspaceNav` takes `items` as data, `isActive` as a predicate and an optional `linkComponent`, and builds the anchor itself, which lets `workspace-nav.spec.tsx` guard the current-section semantics for every consumer. Reach for injection (`linkComponent`, `renderItem`) over a `ReactNode` prop whenever the component has semantics of its own to put on the element.

- **Presentational by rule: no text, no router.** Strings and `href`s arrive as props. This is not
  tidiness — the same component renders in three locales and in two apps with different routers,
  and `ui-is-presentational` fails the build on `packages/ui → apps/`.

- **A Radix dialogue opened from state hands focus to nothing on close, unless it is told where** (task 207). Radix's
  modal content cancels the focus scope's own return and focuses `triggerRef`, which only `Dialog.Trigger` sets — and
  `Dialog` and `ConsequenceDialogue` are opened by their callers' state, so every close dropped focus on `body`, on
  every caller in both apps, with every gate green. Both now take `useReturnFocus`: the control that held focus as the
  dialogue opened, or a menu's button where an item in the menu raised it (`dialogueOrigin`, by the menu's
  `aria-labelledby`), focused again on close; a caller keeps focus elsewhere with `onCloseAutoFocus` and
  `preventDefault()`. **A new dialogue opened from state takes the same hook**; one with its own `Trigger` needs none.

- **`account-menu.tsx` is a known, uncoverable gap.** It wraps caller-supplied `items[].node` in
  Radix's own `DropdownMenu.Item asChild`, so its rule is the **caller's**: do not pass slotted
  children across the boundary. No syntax selector can see that. Safe today only because both its
  callers are Client Components: `apps/web/src/shared/account-corner.tsx`, and since task 67.1 the
  console's `realm/components/chrome/console-account.tsx`, in an app with no server tier at all.
  `organization-switcher.tsx`'s `closingItem` is the same gap since task 83.2; its one caller, `apps/web`'s
  `organization-corner.tsx`, is a Client Component.

## Before you add a component

UX-89's order of moves is not a preference — the root file states it, **amended 14 Sep 2026: a
component only one app needs is that app's, not this package's**, and comes here the day the other
app needs it. What is local is where the work lands for a component that *is* this package's:

1. **The root's order of moves first** — the inventory (`design/screens/EasyESG Components.dc.html`), anatomy rather than content or variant, no boolean prop per screen, all eleven §8.1 states before any instance (UX-8, UX-90).
2. **Pick the folder from what it is, not from who asked**: `domain/` for something carrying
   product meaning, `primitives/` for something with none.
3. **Add it to `src/index.ts`.** A component not in the barrel is reachable only through
   `./src/*`, which is the escape hatch for CSS, not a component path.
4. **Amend `design_spec.md` §11.5 in the same change.** The inventory is an enumeration; a
   component that exists in code and not in §11.5 is the one nobody reviews.

## Before you call it done

- **Read the diff against `vercel-composition-patterns` and `vercel-react-best-practices`.** Both
  apply here, and `reactCompiler` is off (AD-9), so `useMemo`/`useCallback`/`memo()` are decisions
  rather than noise — and say what you declined, per the root `CLAUDE.md`'s "Project skills".
- **Both themes, and both apps.** The cascade is theme-aware and this package has two consumers;
  checking one is checking half. Since task 82 the theme half is measured rather than eyeballed —
  `pnpm test` fails if any pairing drops below UX-101 in either scheme — but the spec only knows
  the pairings it lists. A new surface-and-text combination is a new entry in it, and adding the
  component without the entry leaves it unmeasured with everything green.
- **A new vocabulary is a sibling module**, and a new `'use client'` has a reason you can name.
- **Then the run the root file's "Closing a task" calls for** — its `packages/*` row: this package's test and then `apps/web`'s and `apps/admin`'s rows, since a change here reaches both (`pnpm --filter "...[<base>]"` shows it).
