> **Live schedule, subordinate specification.** This plan's *sequencing* is in force and is referenced
> from `docs/architecture.md` §15.4. Its *values* are not: `docs/design_spec.md` §11 owns every token,
> type role, spacing step, radius, elevation and motion duration, and `design/tokens.css` is their
> single source of truth. Where this file states a value that §11 states differently, §11 governs.

---

# EasyESG — UI implementation plan

Sequenced against `architecture.md` §15.4 (foundation → identity → reporting core → calculator/validation → export *(free-tier pilot milestone)* → notifications → billing → operations → public tier). This document covers only the **interface** half of each phase; the docs set owns the rest.

Accessibility target throughout is **WCAG 2.2 AA**, verified per phase, not at the end.

---

## Phase 0 — Foundation (`packages/ui`, `packages/i18n`)

Nothing screen-shaped ships here. This phase exists so that no later phase invents a value.

**Deliverables**

1. `tokens.css` from this folder, installed as the tier 1/2/3 cascade. Enforce the tier rule in review: a component that reads a tier 1 variable is a defect.
2. Type scale wired to the ten roles (`display` … `code`). Self-host Onest 400/500/600/700 and IBM Plex Mono 400/500. **Verify comma-below ș/ț and full Cyrillic in the self-hosted subsets** — a subsetting step that drops Cyrillic is the most likely way this breaks, and it breaks silently in English review.
3. `font-variant-numeric: tabular-nums lining-nums` as the default for every numeric role. Number formatting helper: space thousands separator, comma decimal (`1 240,50`), MDL currency.
4. Focus ring utility — `0 0 0 2px pine.600, 0 0 0 4px pine.200` — applied globally to `:focus-visible`. No component may remove an outline without replacing it.
5. `prefers-reduced-motion` reduction, and the four motion tokens as the only permitted durations.
6. Dark scheme token map defined now even though the toggle is not in MVP scope. It is a token obligation, and retrofitting it after twenty screens is the expensive path.
7. **+40% string expansion harness** — a dev-only i18n mode that pads every string 40%. Wire it in phase 0 and run it at the end of every phase.

**Exit check:** a page containing one button, one input and one table renders correctly in light and dark, in RO/EN/RU, with the expansion harness on, at 1440 / 834 / 390.

**Reference:** `EasyESG Design Foundations.dc.html` in full.

---

## Phase 1 — Component library, part one (`packages/ui`)

The primitives every screen depends on. Build them against the specimens, not against a screen.

- **Primitives** — Button (four variants and no fifth), icon button, link, chip, badge, avatar, divider, spinner, skeleton. Minimum target 24×24; 40px height on anything a first-time user must hit.
- **Form controls** — text input, number input with unit suffix, textarea, select, combobox, checkbox, radio group, switch, file input. Resting border is `border.strong` — a field must look enterable.
- **Feedback** — toast, inline message, banner, empty state, confirmation dialogue, destructive dialogue. Enforce the three parts (what happened / so what / what now) in the component API: make the "what now" slot required rather than optional.
- **Navigation** — three tiers, no fourth.
- **Overlays** — dropdown, context menu, side panel, command palette, shortcut layer, tooltip. Destructive items get their own menu group.
- **Data display** — table at both densities, key–value list, metric, progress, comparison, audit trail.

Follow `vercel-composition-patterns` here: these are exactly the components that grow boolean props. Compound components over flag soup.

**Reference:** `EasyESG Components.dc.html` §01–§05, §07, §08.

---

## Phase 2 — Identity (`apps/web`, `apps/admin`)

Ten screens, all the Focus archetype: one task, one panel, no navigation. The simplest surfaces in the product, which makes them the right place to prove the foundation holds before the wizard depends on it.

`S-01` Sign in · `S-01` Register · `S-01` Provider choice · `S-02` Verify email · `S-02` Reset password · `S-02` Set password · `S-03` Accept invitation · Re-authenticate (`UC-07`, overlay elevation) · `S-28` Credentials · `S-27` Profile and preferences · `A-01` Admin sign-in with MFA.

Also in this phase because identity is the first thing that has them: the language switcher, and the full states pass (loading / error / offline) on a real screen.

**Reference:** `EasyESG Identity.dc.html`.

---

## Phase 3 — Workspace shell (`apps/web`)

`S-04` Create organization · `S-05` Home · `S-05` Home multi-entity · global tier menus · `S-06` Reports index · states.

The multi-entity variant is not a nice-to-have: entity scope is part of the session and every screen after this one reads it.

**Reference:** `EasyESG Workspace.dc.html`.

---

## Phase 4 — The disclosure field

Its own phase, deliberately. It is the most-repeated component in the product and everything downstream inherits its decisions.

**Anatomy:** label · help text · input · unit · state marker · reason capture · prior-period value · carry-forward action · change-history entry point.

**The eight states, each with mark, label and colour role:** `ok` ✓ · `missing` ! · `inconsistency` ≠ · `error` × · `invalid_url` × · `not_available` — · `not_material` ⊘ · `nil_return` 0.

Three rules that are easy to get wrong and expensive to fix later:

1. **Remove the colour and the state must still read.** This is what makes the monochrome print layer possible. Test it by rendering the field set in greyscale.
2. **A nil return is an affirmative zero, never an empty box.** Model it as a distinct state, not as `value === 0`.
3. **Reasoned is neither answered nor missing.** Iris, not green, not amber. Completeness counts three buckets — resolved, reasoned, outstanding — and never collapses to one percentage.

**Reference:** `EasyESG Reporting Core.dc.html` (disclosure field anatomy, eight validation states) and `EasyESG Components.dc.html` §06.

---

## Phase 5 — Reporting core (`apps/web`)

- Wizard shell — module rail, save state, validation entry point. Inside the wizard the workspace tier is replaced by the module list.
- Module card — completeness, applicability, reasoned-omission rationale.
- `S-07` Report wizard at 1440 and narrow.
- `S-08` Validation panel — findings grouped by severity, every finding linking to its field, every inconsistency linking to **both** conflicting fields.
- `S-12` Field change history — an audit surface, with actor and timestamp.
- `S-05` New report, `S-07` Collaboration, `S-07` Evidence.
- Save state component: saved / queued / failed, plus the offline queue. Users work intermittently and under deadline; the offline state is designed, not an afterthought.

Then the eleven Basic modules end to end: `B1` Basis for preparation · `B2` Practices and policies · `B3` Energy and emissions · `B4` Pollution · `B5` Biodiversity · `B6` Water · `B7` Waste and circularity · `B8` Workforce · `B9` Health and safety · `B10` Remuneration · `B11` Convictions.

**Reference:** `EasyESG Reporting Core.dc.html`, `EasyESG Reporting Screens.dc.html` screens 01–11 and 18–24.

---

## Phase 6 — Calculator and validation (`apps/web`)

`S-09`. B3 asks for tonnes of CO₂e and nobody has a bill in tonnes, so the calculator takes the number printed on the bill in the unit the bill uses.

`8.0` in the workspace · `8.1` where it opens from · `8.2` wide · `8.3` the unit is theirs · `8.4` derivation in one step · `8.5` override · `8.6` newer factor set available · `8.7` states · `8.8` narrow.

The factor set is versioned config, not code. The UI must show which set a figure was derived under, and offer — never force — a re-derivation when a newer set is published.

**Reference:** `EasyESG Carbon Calculator.dc.html`.

---

## Phase 7 — Review, export, filing *(free-tier pilot milestone)*

`S-09` Review · `S-10` Export · `S-11` Filing · Mark as filed · Export produced · Filed · Locked · Revision comparison.

Then the printed artefact itself: cover and contents · the body · reasoned omissions · provenance. Rendered by the worker through Playwright/Chromium, so the layout must hold with no client JS and no web fonts loading late.

Export is gated on no unresolved findings. **Reasoned omissions do not block export** — they flow into the document verbatim, with their stated reason. That is the product's central claim; if the export loses the reason text, the feature is broken regardless of what the screen shows.

**Reference:** `EasyESG Reporting Screens.dc.html` screens 12–17, 23; `EasyESG Exported Document.dc.html`.

---

## Phase 8 — Organization admin and notifications (`apps/web`)

`9.0` `S-13` Entities index · `9.1` `S-13` Entity record · `9.2` `S-14` Reporting periods · `9.3` `S-15` Organization profile · `9.4` `S-16` Users and access · `9.5` `S-17` Plan and usage · `9.6` Losing scope.

Plus `S-26` Notification centre from the commerce file, which belongs to the notifications milestone rather than to billing.

Losing scope mid-period is a designed state, not an error path. Treat it as such.

**Reference:** `EasyESG Organization Admin.dc.html`, `EasyESG Commerce.dc.html` `10.8`.

---

## Phase 9 — Commerce (`apps/web`)

Everything here sits behind `BILLING_ENABLED`. With the flag off, UC-17…48 must still pass, so no screen from an earlier phase may import a commerce component.

`10.0` `S-18` Plan comparison · `10.1` `S-19` Order and summary · `10.2` `S-20` Leaving for the bank · `10.3` `S-20` the four returns · `10.4` `S-21` Bank transfer · `10.5` `S-22` Invoices and documents · `10.6` `S-24` Subscription status · `10.7` `S-25` Enterprise request.

The four bank returns are four distinct designed states — success, failure, cancelled, indeterminate. The indeterminate return is the one that gets skipped and the one that generates support load.

**Reference:** `EasyESG Commerce.dc.html`.

---

## Phase 10 — Public site and help centre (`apps/web`)

Marketing home at 1440 / 834 / 390, the three legal documents plus the cookie choice, and the four help screens.

These can be pulled earlier if commercial timing demands it — they share the token layer and the primitives and depend on nothing from phases 4–9. Nothing later depends on them either.

**One of them is not discretionary, corrected 24 Aug 2026 with §15.4's ninth step.** The three legal documents and the cookie choice are a compliance obligation on the registration path, not a marketing asset: GDPR Article 13 and Law No. 195/2024 (applicable 23 August 2026, NFR-5) require the information where personal data is collected, and Phase 2 already collects an email address. They bind at **Phase 7's free-tier pilot**, where the first real SMEs arrive. The sentence above governs the marketing home and the help centre; it does not govern the legal screens.

**Reference:** `EasyESG Public Home.dc.html`, `EasyESG Public Legal.dc.html`, `EasyESG Help Centre.dc.html`.

---

## Phase 11 — Admin console (`apps/admin`) and operations

Twenty-two screens at compact density, desktop only by intent. Same tokens as the tenant app, different step choices: trained operators, high row counts, dense tables.

`A-01` Admin sign-in · `A-02` Organization register · `A-03` Content and translation · `A-03` Publish, scope disclosed · `A-04` Taxonomy versions · `A-04` Migration run · `A-05` Factor sets · `A-05` Validation rules · `A-06` Adoption metrics · `A-07` Support access · `A-08` Admin accounts and audit log · `A-17` Notification templates · `A-18` Identity providers · `A-09` Plans and pricing · `A-10` Reconciliation · `A-10` Manual resolution with rationale · `A-11` Collections and dunning · `A-12` Invoicing and numbering · `A-13` e-Factura exceptions · `A-14` Refunds and chargebacks · `A-15` Enterprise contracts · `A-16` Revenue, VAT and the ledger.

Several of these are the UI for config-as-data (`A-03`, `A-04`, `A-05`, `A-09`, `A-17`). Build them as generic editors over versioned config, not as bespoke forms per artefact — adding a taxonomy element or a factor set must need no code change.

**Reference:** `EasyESG Admin Console Screens.dc.html`.

---

## Phase 12 — Comprehensive modules (post-MVP)

`C1` Strategy · `C2` Targets · `C3` Transition plan · `C4` Climate risks · `C5` Workforce detail · `C6` Human rights · `C7` Governance · `C8` Revenue by sector · `C9` Value chain.

Designed and in the set so that the Basic wizard is not built in a way that excludes them. Scope per `problem_overview.md`.

**Reference:** `EasyESG Reporting Screens.dc.html` screens 25–33.

---

## Standing checks, every phase

- 1440 / 834 / 390
- RO / EN / RU, plus the +40% expansion harness
- Light and dark token maps resolve
- Greyscale pass: every state still readable with colour removed
- Keyboard only: focus visible everywhere, no trap, logical order
- No loading affordance under 300ms; skeletons match final layout
- No arbitrary spacing values; no colour outside the token set
