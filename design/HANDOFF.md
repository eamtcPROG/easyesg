> **Superseded record — provenance, not specification.**
> This file is the design handoff **as delivered on 18 August 2026**. Its normative content has been
> folded into the project's document set, which now governs:
>
> - Token values, colour roles, typography, space, shape, elevation, motion → `docs/design_spec.md` §11
> - The eight-state disclosure model, with marks and colour roles → `docs/design_spec.md` §6.4
> - Component inventory and the domain components → `docs/design_spec.md` §11.5
> - UI phase sequencing → `docs/architecture.md` §15.4 and `design/IMPLEMENTATION_PLAN.md`
>
> **Where this file and `docs/` differ, `docs/` governs.** The handoff's own rule — "the docs win on
> behaviour and scope, the design wins on presentation" — is *not* carried forward: split authority
> between two documents covering one subject is what `architecture.md` §17.1 versus the NFR register
> already cost this project, and it is not repeated here. `design/tokens.css` remains the single
> source of truth for values, and `design/screens/` remains the rendered reference.

---

# Handoff: EasyESG

A hi-fi design set for **EasyESG** — a web application that lets a small or medium company in Moldova prepare, validate, export and file a VSME-standard sustainability report without hiring a consultant. It covers the public marketing site, identity, the tenant workspace, the eleven-module reporting wizard, a carbon calculator, organization administration, commerce and billing, the help centre, the platform admin console, and the exported report document.

The audience is deliberately non-expert: the product asks plain questions, never presents a blank box, and treats "we don't have this number, and here's why" as a first-class answer rather than an error.

---

## About the design files

The files in `design-files/` are **design references created in HTML** — high-fidelity prototypes showing intended look, structure and behaviour. They are **not production code to copy**.

The task is to **recreate these designs in `eamtcPROG/easyesg`** using the stack and conventions that repository already commits to. At the time of writing that repo is specification only — `docs/` and the agent skills, no application code — so this design set is the visual half of the same contract the `docs/` set describes in words, and the two use the same identifiers (`S-07`, `A-10`, `UX-42`, `UC-32`, `FR-123`).

Where the design and the docs appear to disagree, the docs win on behaviour and scope (`problem_overview.md` governs scope; each other doc is authoritative in its own column) and the design wins on presentation. Cite the identifiers rather than re-deriving decisions.

Where the design lands, per `architecture.md` §10.7 / §12:

| Design artefact | Home in the monorepo |
|---|---|
| `tokens.css`, primitives, form controls, feedback, navigation, data display | `packages/ui` |
| Disclosure field, module card, wizard shell, validation panel, completeness meter, calculator row | `packages/ui` (domain-aware but presentational) |
| Public site, identity, workspace, reporting wizard, commerce, help centre | `apps/web` (Next.js) |
| Admin console (22 screens, compact density) | `apps/admin` (React + Vite) |
| Exported document layout | rendered by the worker via Playwright/Chromium |
| RO / EN / RU strings | `packages/i18n` — separately authored, never machine-translated, Romanian is the source |

Apply `vercel-react-best-practices` in `apps/web` and `vercel-composition-patterns` in `packages/ui`. Where a skill and `architecture.md` disagree, the architecture wins.

Two things about the file format:

- Each `.dc.html` is a self-contained document that opens directly in a browser. Open one and scroll — every screen is laid out one after another with a label above it.
- **All styling is inline `style="…"`**, deliberately. That is an authoring constraint of the prototype format, not a recommendation. Extract the values (they are exact) and express them through `packages/ui` using `tokens.css` as the source of truth.
- Do not copy prototype markup into the repo. Read it, take the values, write the component properly.

Reading order for a developer new to the project:

1. `EasyESG Design Foundations.dc.html` — tokens, colour roles, type scale, state model
2. `EasyESG Components.dc.html` — the full component inventory, every variant and state
3. Then whichever feature area you're building, from the screen map below

---

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, shadows, motion durations and copy are final and should be reproduced exactly. Every value in the prototypes resolves to a token in `tokens.css`.

Two caveats:

- **Icons are placeholders.** The prototypes use text glyphs (`✓ ! ≠ × — ⊘ 0`) where a real icon set belongs. Pick one coherent set at 20px and 24px on a 24px box. Each icon needs an accessible name, and no icon may be the sole carrier of state or action.
- **Illustration and photography are placeholders.** Nothing in the set depends on imagery.

---

## Design tokens

Use `tokens.css` in this folder. The architecture is three tiers and the rule is strict:

| Tier | Contains | Who may read it |
|---|---|---|
| 1 — Primitive | Raw literals: `pine.600`, `slate.100`, `space.4` | Tier 2 only |
| 2 — Semantic | Intent, hue-independent: `surface.raised`, `text.muted`, `border.focus`, `state.reasoned` | Tier 3, and designers/reviewers in conversation |
| 3 — Component | Point of use: `field.border.rest`, `field.border.invalid`, `wizard.step.complete` | Components — and nothing past this tier |

A theme swap edits tier 1 and, where a component maps differently, tier 3. Components never change.

### Colour

**Accent — pine, exactly one.** `#2E6A4F`. Primary action and active state only. Never used for a validation state, so an accent button is never mistaken for a success marker.

Pine ramp: `50 #EDF5F0` · `100 #D6E8DE` · `200 #ADD1BE` · `300 #7CB49A` · `400 #4E8F72` · `500 #3A7A5C` · **`600 #2E6A4F`** · `700 #245540` · `800 #1B4031` · `900 #132C22`

**Neutral — slate, cool, chroma under 0.02.** Carries roughly 90% of every screen.

`0 #FFFFFF` · `25 #FAFBFC` · `50 #F4F6F8` · `100 #E8ECF0` · `200 #D5DBE2` · `300 #B4BDC7` · `400 #8B96A3` · `500 #67737F` · `700 #3A434C` · `900 #161B20`

**State hues — one text-safe step and one tint each.** No ramps, deliberately: there is no room to improvise a shade.

| Role | Hue | Text-safe | Tint |
|---|---|---|---|
| Attention | amber | `#9A6510` | `#FDF4E3` |
| Warning | rust | `#B4501A` | `#FDF0E8` |
| Error | crimson | `#B32318` | `#FDEDEB` |
| Reasoned | iris | `#5A4FA3` | `#F0EFF9` |
| Pending | azure | `#0E6FA8` | `#E9F3FA` |

Iris for *reasoned* is a load-bearing choice: a declared gap is neither an answer nor an omission. Green would read as complete, amber as outstanding. A hue from neither family is the only honest option, and it keeps the accent free for actions.

Steps at 600 and above pass 4.5:1 on `surface.default`. 300 and below are surfaces and tints only.

### Semantic roles and contrast

| Token | Source | Applied to | Contrast |
|---|---|---|---|
| `surface.default` | slate.0 | Card, field, panel — the reading plane | — |
| `surface.sunken` | slate.50 | Page ground, well, read-only field | — |
| `text.default` | slate.900 | Labels, values, headings | 16.4:1 |
| `text.body` | slate.700 | Help text, prose, message bodies | 10.3:1 |
| `text.muted` | slate.500 | Captions, units, metadata — never sole carrier | 5.1:1 |
| `border.default` | slate.200 | Card edge, divider, table rule | 1.4:1 |
| `border.strong` | slate.400 | Input at rest — a field must look enterable | 3.1:1 |
| `border.focus` | pine.600 + pine.200 | Two-layer ring, legible on every surface | 5.9:1 |
| `accent` | pine.600 | Primary action, active nav | 5.9:1 |

### Typography

**Onest** for every text role. **IBM Plex Mono** for identifiers, token names, payment references and code. Load weights 400/500/600/700 for Onest, 400/500 for Plex Mono.

Substituting the text family is permitted, but any candidate must carry **comma-below Romanian diacritics (ș, ț — not the Turkish cedilla forms) and full Cyrillic**. A typeface that substitutes cedillas is disqualified regardless of appearance; Romanian readers see it immediately.

| Role | Spec |
|---|---|
| `display` | Onest 600 · 40/44 · −0.02em |
| `heading.1` | Onest 600 · 28/34 |
| `heading.2` | Onest 600 · 21/26 |
| `heading.3` | Onest 600 · 17/22 |
| `body` | Onest 400 · 15/24 · max 68ch |
| `body.strong` | Onest 600 · 15/24 |
| `label` | Onest 600 · 14/20 |
| `caption` | Onest 400 · 13/19 |
| `numeric` | Onest 500 · 19/26 · **tabular lining figures** |
| `code` | IBM Plex Mono 400 · 14/22 |

Every quantity, money amount and identifier uses `font-variant-numeric: tabular-nums lining-nums`, so a figure does not shift sideways when a value changes or a state marker appears beside it.

### Space, shape, elevation

Spacing derives from a single 4px-based scale; **arbitrary values are prohibited.**

`space.1 2` · `space.2 4` · `space.3 8` · `space.4 12` · `space.5 16` · `space.6 24` · `space.7 32` · `space.8 48` · `space.9 64` · `space.10 96`

Two densities from the same tokens, differing only in step choice: **comfortable** is the tenant default, **compact** belongs to the admin queues.

Radius: `1 · 3px` inputs, chips, markers — `2 · 6px` cards and panels — `3 · 10px` dialogues — `pill` status chips only. Nothing is rounder than a dialogue.

Elevation — maximum three, and it means transience, not importance:

- `0 · flat` — content. **A card does not float.**
- `1 · raised` — `0 1px 2px rgba(22,27,32,.06), 0 2px 6px rgba(22,27,32,.05)` — popover, sticky bar
- `2 · overlay` — `0 4px 12px rgba(22,27,32,.10), 0 12px 32px rgba(22,27,32,.10)` — dialogues, re-authentication

### Motion

| Token | Duration | Used for |
|---|---|---|
| `motion.instant` | 80ms | Hover, focus, checkbox |
| `motion.quick` | 160ms | Toast, tooltip, inline message |
| `motion.panel` | 240ms | Validation panel, dialogue, applicability change |
| `motion.ease` | `cubic-bezier(.2, 0, .2, 1)` | The only curve — no bounce, no overshoot |

Nothing essential is conveyed by animation alone. `prefers-reduced-motion` drops every motion to an instant state change.

---

## The state model

Eight disclosure states map onto six colour roles. **Every state carries a mark, a text label and a colour role** — remove the colour and the state still reads, which is what makes the monochrome print layer possible.

| State | Mark | Field treatment | Colour role | Counts as resolved |
|---|---|---|---|---|
| `ok` | ✓ | Neutral, no marker in the field itself | `state.ok` | Yes |
| `missing` | ! | Attention marker, non-alarming — nothing is wrong yet | `state.attention` | No |
| `inconsistency` | ≠ | Warning, plus a link to the conflicting field | `state.warning` | No |
| `error` | × | Error, blocking within the field | `state.error` | No |
| `invalid_url` | × | Error role, and the failing URL is shown verbatim | `state.error` | No |
| `not_available` | — | Reasoned marker, stated reason inline | `state.reasoned` | Reasoned |
| `not_material` | ⊘ | Section-level; collapses the module body, keeps the rationale visible | `state.reasoned` | Reasoned |
| `nil_return` | 0 | Neutral, labelled as an affirmative zero — **never an empty box** | `state.neutral` | Yes |

The distinction between *resolved*, *reasoned* and *unresolved* drives completeness calculations, the validation panel, the export gate and what appears in the filed document. Model it explicitly in the data layer — this is not a presentation concern.

Alongside these, the interface has five system states that a first pass usually skips and this product cannot: **loading, partial, pending, offline, success**. All five are specified in `EasyESG Components.dc.html` §07. No loading affordance appears below 300ms; skeletons match the final layout; spinners are only for indeterminate waits with no known shape.

---

## Component inventory

All specimens live in `EasyESG Components.dc.html`, in this order. Each is rendered in every variant and state it supports.

**01 Primitives** — Button (four variants, no fifth: primary, secondary, ghost, destructive), icon button, link, chip, badge, avatar, divider, spinner, skeleton. Minimum target 24×24 everywhere; 40px height on anything a first-time user must hit.

**02 Form controls** — Text input, number input with unit suffix, textarea, select, combobox, checkbox, radio group, switch, file input. A field at rest must look enterable, so the resting border is `border.strong`, not `border.default`.

**02b Pickers and field furniture** — Date picker, reporting-period picker, unit selector, inline field actions (*not available*, *carry forward*, finding link), help popover, character counter. Reporting periods are the one place where a wrong date is expensive and invisible, so the period picker is its own component.

**03 Feedback** — Toast, inline message, banner, empty state, confirmation dialogue, destructive-action dialogue. Nothing ships with fewer than three parts: **what happened, so what, and what now.** Toasts confirm the user's own action; anything the system decided gets an inline message or banner.

**04 Navigation** — Three tiers and no fourth: global tier, report tier, module rail. Inside the wizard the workspace tier is replaced by the module list.

**04b Overlays and utilities** — Dropdown menu, context menu, side panel, command palette, keyboard-shortcut layer, tooltip. A destructive item never sits adjacent to a routine one in the same menu group.

**05 Data display** — Table (comfortable and compact), key–value list, metric, progress, comparison view, audit trail. Tabular lining figures everywhere.

**06 Domain components** — none of these exists in any library; each is composed from the primitives and owns its own state machine:
- **Disclosure field** — the most-repeated component in the product. Label, help text, input, unit, state marker, reason capture, prior-period value, carry-forward action, change history entry point.
- **Module card** — a reporting section with completeness, applicability and reasoned-omission state
- **Wizard shell** — module rail, save state, validation entry point
- **Validation panel** — findings grouped by severity, each linking to its field
- **Completeness meter** — resolved / reasoned / outstanding, never a single percentage
- **Carbon calculator row** — invoice quantity in the user's own unit → derived tonnes CO₂e, factor set and override

**06b Export, access and the report** — Export preflight, export options, filing confirmation, access-and-role editor, report preview.

**07 The remaining states** — loading, partial, pending, offline, success.

**08 Compact density** — the admin exception queue, the opposite end of the density scale from the wizard. Same tokens, different step choices. Trained operators, high row counts.

**09 Two obligations** — the dark scheme and **+40% string expansion**. Both are token obligations from day one whether or not the theme toggle ships at MVP. Every layout must survive Romanian and Russian strings 40% longer than the English ones; nothing may rely on a fixed-width label.

---

## Screen map

Each row is a file in `design-files/`. Screens are labelled inside the file with the same names; codes (`S-07`, `A-10`, `UX-42`, `UC-32`) are the project's own screen, requirement and use-case identifiers and appear in the prototypes for cross-referencing.

### `EasyESG Public Home.dc.html`
Marketing home at three widths (desktop 1440, tablet 834, mobile 390). Centred hero on a deep pine band, real interface fragments in place of grey blocks. Sections: four steps · eleven sections · one question at a time · pricing per company per reporting year · before you sign up · where your answers sit and who can see them · closing CTA.

### `EasyESG Public Legal.dc.html`
`01` Terms of service · `02` Privacy notice · `03` Cookie policy · `04` The cookie choice. One shared layout: tab strip treating the three documents as a set, plain-language summary above the formal text.

### `EasyESG Identity.dc.html`
Ten screens where a person becomes a session; every one is the Focus archetype — one task, one panel, no navigation.
`S-01` Sign in · `S-01` Register · `S-01` Provider choice · `S-02` Verify email · `S-02` Reset password · `S-02` Set password · `S-03` Accept invitation · Re-authenticate (`UC-07`) · `S-28` Credentials · `S-27` Profile and preferences · `A-01` Admin sign-in with MFA · States pass.

### `EasyESG Workspace.dc.html`
Navigation tiers · `S-04` Create organization · `S-05` Home · `S-05` Home, multi-entity · Global tier menus · `S-06` Reports index · States.

### `EasyESG Reporting Core.dc.html`
The heart of the product. Wizard shell · disclosure field anatomy · eight validation states · `S-07` Report wizard (wide) · `S-08` Validation panel · `S-12` Field change history · `S-07/S-08` narrow · States pass · `S-09` Review · `S-10` Export · `S-11` Filing · `S-05` New report · `S-07` Collaboration · `S-07` Evidence · `S-07` Comprehensive · `S-09/S-10/S-11` narrow.

### `EasyESG Reporting Screens.dc.html`
Every module rendered in full — the largest file in the set.
Basic: `B1` Basis for preparation · `B2` Practices and policies · `B3` Energy and emissions · `B4` Pollution · `B5` Biodiversity · `B6` Water · `B7` Waste and circularity · `B8` Workforce · `B9` Health and safety · `B10` Remuneration · `B11` Convictions.
Flow: Review · Export · Filed · Revision comparison · New report · Mark as filed · Collaboration · Evidence · Comprehensive · Offline · Locked · Export produced · Carried forward.
Comprehensive: `C1` Strategy · `C2` Targets · `C3` Transition plan · `C4` Climate risks · `C5` Workforce detail · `C6` Human rights · `C7` Governance · `C8` Revenue by sector · `C9` Value chain.

### `EasyESG Carbon Calculator.dc.html`
`S-09`. B3 asks for tonnes of CO₂e; nobody has a bill in tonnes. The calculator takes the numbers printed on the bill, in the unit the bill uses, and derives the figure.
`8.0` In the workspace · `8.1` Where it opens from · `8.2` Wide 1440 · `8.3` The unit is theirs · `8.4` Derivation in one step · `8.5` Override · `8.6` Newer factor set · `8.7` States · `8.8` Narrow frames · `8.9` Whole screens.

### `EasyESG Organization Admin.dc.html`
`9.0` `S-13` Entities index · `9.1` `S-13` Entity record · `9.2` `S-14` Reporting periods · `9.3` `S-15` Organization profile · `9.4` `S-16` Users and access · `9.5` `S-17` Plan and usage · `9.6` Losing scope · `9.7` States pass · `9.8` Narrow frames · `9.9` Whole screens.

### `EasyESG Commerce.dc.html`
`10.0` `S-18` Plan comparison · `10.1` `S-19` Order and summary · `10.2` `S-20` Leaving for the bank · `10.3` `S-20` The four returns · `10.4` `S-21` Bank transfer · `10.5` `S-22` Invoices and documents · `10.6` `S-24` Subscription status · `10.7` `S-25` Enterprise request · `10.8` `S-26` Notification centre · `10.9` Narrow frames · `10.10` Whole screens.

### `EasyESG Help Centre.dc.html`
`01` Help centre, signed in · `02` Help centre, guest · `03` Help article, signed in · `04` Write to support. Articles are written for people who run a business, not for people who read standards; every article names the module it belongs to.

### `EasyESG Admin Console Screens.dc.html`
Twenty-two platform-operator screens at compact density.
`A-01` Admin sign-in · `A-02` Organization register · `A-03` Content and translation · `A-03` Publish, scope disclosed · `A-04` Taxonomy versions · `A-04` Migration run · `A-05` Factor sets · `A-05` Validation rules · `A-06` Adoption metrics · `A-07` Support access · `A-08` Admin accounts and audit log · `A-17` Notification templates · `A-18` Identity providers · `A-09` Plans and pricing · `A-10` Reconciliation · `A-10` Manual resolution with rationale · `A-11` Collections and dunning · `A-12` Invoicing and numbering · `A-13` e-Factura exceptions · `A-14` Refunds and chargebacks · `A-15` Enterprise contracts · `A-16` Revenue, VAT and the ledger.

### `EasyESG Exported Document.dc.html`
The artefact the whole product exists to produce, as it prints.
`12.0` Cover and contents · `12.1` The body: B1 and B3 · `12.2` Reasoned omissions · `12.3` Provenance.

### `EasyESG Logo.dc.html`
Wordmark and monogram construction, sizes, clear space, and permitted colour treatments.

---

## Interaction and behaviour

**Saving.** The wizard autosaves. Save state is a visible component with three positions — saved, queued (`savestate.queued`, azure), failed. Users work intermittently and under deadline; nothing may be lost to a closed tab or a dropped connection. The offline state is designed, not an afterthought.

**Validation.** Findings are produced continuously and surfaced in two places: inline on the field, and grouped by severity in the `S-08` validation panel. Every finding links to the field that produced it, and every inconsistency links to *both* conflicting fields. Export is gated on there being no unresolved findings — reasoned omissions do not block it.

**Reasoned omission.** Any field can be marked *not available* with a stated reason, and any section can be marked *not material*. Both flow through to the exported document verbatim. The reason text is required; an empty reason is an error state, not a warning.

**Carry forward.** Where a prior period exists, each field offers its prior value with a date. Accepting it records that the value was carried forward, and that provenance appears in the change history and in the export.

**Change history.** Every field value change is recorded with actor and timestamp (`S-12`). This is an audit surface, not a convenience.

**Navigation.** Three tiers, never four. Inside the wizard the workspace tier is replaced by the module list.

**Focus.** A two-layer ring — `0 0 0 2px pine.600, 0 0 0 4px pine.200` — on every interactive element, legible on every surface. Never remove an outline without replacing it.

**Targets.** Never below 24×24. That binds the inline field actions — *not available*, *carry forward*, finding links — where the temptation to shrink is greatest. 40px height on anything a first-time user must hit.

**Responsive.** Three frames are designed throughout: 1440, 834, 390. The wizard collapses the module rail into a sheet below 834. The admin console is desktop-only by intent.

**Localisation.** Romanian, Russian and English. Every layout must survive +40% string expansion. Number formatting uses a space as the thousands separator and a comma as the decimal (`1 240,50`); currency is MDL.

---

## State management

The domain state a developer will need to model, independent of framework:

- **Organization** → entities → reporting periods. An entity may lose scope mid-period (`9.6`); that is a designed state, not an error.
- **Report** → modules (B1–B11, C1–C9) → disclosure fields. Each field carries: value, unit, state (the eight above), reason text, prior-period value, carried-forward flag, evidence attachments, change history.
- **Module** carries: applicability (material / not material + rationale), completeness (resolved / reasoned / outstanding counts).
- **Report lifecycle**: draft → validated → exported → filed → locked. A filed report is immutable; a revision creates a comparison view.
- **Findings** are derived, not stored: recompute on every change, group by severity, link to fields.
- **Save state**: saved / queued / failed, with an offline queue.
- **Session**: organization scope, entity scope, role and permissions, language.
- **Billing**: plan, subscription status, order, payment return states (four distinct returns from the bank in `10.3`), invoice, e-Factura status.

---

## Assets

- **Fonts**: Onest (400/500/600/700) and IBM Plex Mono (400/500), both from Google Fonts. Self-host for production.
- **Icons**: not chosen. See the caveat under Fidelity.
- **Logo**: constructed in `EasyESG Logo.dc.html`; export production SVGs from there.
- No photography or illustration is used anywhere in the set.

---

## Build order

See `IMPLEMENTATION_PLAN.md` in this folder — the UI work sequenced against `architecture.md` §15.4 (foundation → identity → reporting core → calculator/validation → export → notifications → billing → operations), with screen-by-screen scope per phase.
