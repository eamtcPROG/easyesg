# apps/admin — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below, and `docs/design_spec.md` for
every screen. Cite them; do not re-derive them.

## Current state

Scaffold plus the realm (task 23). What exists: 26 route files covering all 18 administrative
screens, two pathless layouts, the TanStack Router tree, the query client, the `packages/ui`
token cascade, 15 feature folders across two bounded contexts, 7 boundary rules with fixtures —
and **A-01 live end to end**: `src/realm/` holds the api client (the web seam's shape —
`credentials: 'include'`, `Accept-Language: ro`, the shared `@easyesg/contracts` outcome
readers), the session view (a TanStack Query entry over `GET /auth/admin/session`; the session
itself is the sealed httpOnly cookie the API sets and rotates, OQ-17), and — under
`realm/components/`, the same anatomy every feature folder has — the sign-in screen and the
interim `SessionStrip` (task 67's row owns replacing it). Sign-in is **A-01's two-step
handshake** (24 Aug 2026 review): the credential opens a sealed five-minute challenge, the
factor step names the server-verified address, mutations ride `useMutation` with `ApiOutcome`
as the resolved value. It is three files on the cohesion line — `sign-in-screen.tsx` owns the
flow and the card (step, mutations, failure), `credential-step.tsx` and `factor-step.tsx` own
one form each, since a step's `useForm`, field ids and field-level messages are read by nothing
else. The screen carries the artboard's card anatomy and realm statement. **The segmented six-cell
code input arrived with task 27.4** as `packages/ui`'s `CodeField` — one real input painted to
look like six, because UX-108's paste and `one-time-code` autofill both need a single field —
and `factor-step.tsx` renders `FormCodeField`. Its docblock still lists what is deferred (the
code-window countdown, which `CodeField` exposes a `hint` slot for; the recovery-code route,
which has **no implementation to point at** since task 27.2 built recovery codes for the tenant
realm only; and the one recorded divergence (the artboard's
full-dark ground). **The LOGGED audit note shipped with task 28.4**, once admin sign-in attempts
actually reached `audit.system_audit_log` — task 23 omitted it rather than state something untrue,
so this was an addition and not a correction. Its wording deliberately **diverges from the
artboard**, which promises "time, account and address": what is stored is a SHA-256 digest of the
address (§12.5.6), so the note says *o amprentă a adresei — nu adresa în sine*. Shipping the
artboard's sentence verbatim would have repeated exactly the mistake task 23 declined to make.
`--text-body` and not `--text-muted` on that band: muted-on-sunken measures 4.47:1 and the axe gate
caught it once already. `_realm.tsx`'s `beforeLoad` is the
closed-by-default guard: no session → A-01 with `?redirect=` carried, sanitized on return.
`e2e/admin/` drives the journey in a real browser against the built bundle on its own origin,
so CORS, the `SameSite=Strict` cookie and the Origin proof are exercised for real.

**Not built:** every screen behind the realm still returns `null` (A-02…A-18 are tasks 67–68),
and `src/lib/pagination.ts` stays a docblock until the first Index screen.

**`src/i18n/` is built.** `use-intl` (pinned to `next-intl`'s version, §12.1) is mounted in
`app/providers.tsx` around the router, the catalogue is `src/messages/ro.json`, and named formats
live in `src/i18n/formats.ts`. `src/global.d.ts` types the keys, so a mistyped one fails
`pnpm typecheck` — which is the only thing catching it, because UX-97 makes a missing key render
as a blank rather than a marker, and one catalogue means no parity gate to cross-check against.

`A-01` is Phase 2; `A-02 … A-18` are Phase 11 (`design/IMPLEMENTATION_PLAN.md`).

## Commands

Run lint and boundary checks from the **repo root**; they are workspace-wide.

| From | Command | Notes |
| --- | --- | --- |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script of its own. The browser tier covers `apps/web`, `apps/admin` and `packages/ui`; the Next-only block does not apply here |
| root | `pnpm boundaries` | dependency-cruiser over five roots, `apps/admin/src` among them |
| root | `pnpm boundaries:prove` | Asserts each of the 23 rules still **rejects** a real violation. Run after touching `.dependency-cruiser.cjs` |
| root | `pnpm routes:check` | Rebuilds and fails if the committed route tree differs from the one the plugin generates. The analogue of `openapi:check` |
| here | `pnpm typecheck` | `tsc --noEmit`, and it covers `vite.config.ts` and `vitest.config.ts` too |
| here | `pnpm build` | Emits `dist/`. **Regenerates `src/app/route-tree.gen.ts` as a side effect** — commit it if it changed |
| here | `pnpm start:dev` | Port 3200 (web is 3100, api is 3000) |
| here | `pnpm test` / `test:watch` | Vitest, `src/**/*.spec.tsx` |

## Where things live

```
src/
├─ main.tsx        mount only
├─ app/
│  ├─ routes/      the route tree — 26 files, one per addressable state
│  ├─ route-tree.gen.ts   GENERATED by @tanstack/router-plugin. Committed, never hand-edited
│  ├─ providers.tsx       query client + router. The only global surface
│  └─ styles/      globals.css — Tailwind, then the packages/ui token cascade
├─ realm/          the admin auth realm: session, API client, guards. A-01 lives here
├─ shared/         cross-context shells. Empty and provisional — see its README and OQ-38
├─ features/
│  ├─ platform/    PA — 7 features, mirroring apps/api/src/modules/platform
│  └─ billing/     BO — 8 features, mirroring apps/api/src/modules/billing
├─ i18n/           locale registry consumption and named formats
└─ lib/            env, pagination
```

**There is no `features/core/`, and that absence is load-bearing.** Mapping all 18 screens onto
`apps/api`'s module tree lands them in `identity`, `platform` and `billing` — and in nothing else.
That is **D-5**: a Platform Administrator has no standing access to tenant report data. A
`features/core/` folder appearing here is the visible symptom of D-5 having been broken somewhere
else; treat it as an incident, not a refactor.

## The traps

- **No server tier, and the token cannot live where `apps/web`'s does.** `apps/web` keeps its
  access token server-side because Next.js gives it a rendering tier. A static Vite bundle has
  none, and AD-12 names the consequence: left unaddressed, the *more* privileged surface holds its
  token in browser JavaScript, inverting the risk gradient §14.2 says must run the other way. The
  handler is `POST /auth/admin/session` **on `api`** — that is OQ-17, and it is closed. AD-12's own
  prose and §14.2 still say "a token-handler endpoint at `edge`"; that wording predates OQ-17 and
  is wrong. OQ-17 governs.

- **No dev proxy, deliberately.** Production is cross-origin — `admin.<host>` calling `api.<host>`
  — and that is what NFR-65's separate cookie scope requires. A `server.proxy` in `vite.config.ts`
  would make development same-origin and hide the CSRF/SameSite question until staging. That
  question is now CLOSED for this realm (task 23, §12.5.6's task-23 rows): the api sets one
  sealed httpOnly `SameSite=Strict` cookie (same-site cross-origin, so Strict still flows),
  allows exactly `ADMIN_ORIGIN` in CORS with credentials, and refuses state-changing
  admin-realm requests whose `Origin` differs. The client's whole contribution is
  `credentials: 'include'` — no token ever reaches this bundle.

- **`VITE_*` is inlined into the bundle at build time.** No secret may ever be read through
  `src/lib/env.ts`. The IP allowlist in front of `admin.<host>` restricts who can fetch the bundle,
  not what is inside it. The API base URL being a build input also means one artefact per
  environment — a staging build cannot be promoted to production. Logged in `architecture.md` §18.

- **The route tree is generated, and `routes:check` is what keeps it honest.** Adding a file under
  `src/app/routes/` changes `route-tree.gen.ts` on the next build. Commit it in the same change, or
  CI fails the way `openapi:check` does when the spec drifts.

- **A `__`-prefixed route file is silently ignored by the generator.** `__root.tsx` is reserved,
  and the plugin skips the prefix rather than treating it as a route — so `__scratch.tsx` under
  `src/app/routes/` produces no route, no error and no entry in the generated tree, and
  `routes:check` stays green because nothing changed. It looks exactly like a route that exists.
  Name route files normally; if you want one deliberately excluded, use the plugin's configured
  `routeFileIgnorePrefix` (`-`) so the intent is legible.

- **Two forms swapped at the same position share their inputs' DOM nodes.** React reconciles by
  position and element type, so a wizard rendering `<form>`→`<form>` REUSES the uncontrolled
  `<input>` underneath — A-01's step one leaked the typed email into step two's code field, and
  nothing failed: the field simply had a value nobody put there. Two fixes work and only one
  survives a refactor. A `key` per branch works while someone remembers it; **making each step its
  own component type** makes the reuse unrepresentable, because React cannot reconcile
  `CredentialStep` into `FactorStep`. A-01 is the second shape and its spec pins the empty field.
  This is generic to every multi-step form and every screen that swaps a filter panel — no gate
  sees it, and it presents as data appearing from nowhere.

- **Library defaults are user-facing text you did not write.** TanStack Router's built-in
  `Not Found` is a hardcoded English string, and the ESLint `JSXText` ban cannot catch it because
  the literal is in `node_modules`. Discharged for the router — `defaultNotFoundComponent` and
  `defaultErrorComponent` are set in `app/providers.tsx` to `app/route-fallbacks.tsx`, which
  resolve through the catalogue and carry NFR-79's three parts. **The rule generalises and the
  next library will not announce itself:** anything shipping default copy — a date picker's month
  names, a table's "no rows", a form library's validation strings — needs the same treatment, and
  no gate here will tell you.

- **Compact density is a hook with nothing behind it yet.** `[data-density="compact"]` is declared
  on `<html>` and every screen is inside it, but `packages/ui/src/styles/tokens.css` defines a
  single scale and no density selector. §11.4's compact steps do not exist yet. **Do not author
  them here** — a second token file is what UX-127 calls a defect. They belong in `packages/ui`.
  Until then the console renders at the tenant scale, which is a known, stated divergence from §12.

- **`wide` and `extra` only** (UX-77), and the console must *state* the limit rather than degrade
  below it. That notice belongs in the `_realm` layout, not in each screen. Blocked meanwhile on
  **OQ-13**: `compact`, `medium`, `wide` and `extra` have no pixel values anywhere, and
  `tokens.css` carries no breakpoint tokens.

- **There is no active organization in this app, and there must not be one.** An organization
  selector in the console chrome would be the standing access D-5 forbids, arriving as a
  convenience. Report data is reachable only through A-07's time-boxed, reasoned, auto-expiring
  grant, and every acquisition is logged (FR-79, NFR-66).

- **No locale segment in the URL.** The console is Romanian-only at MVP (`architecture.md`
  OQ-42), which is a decision about how many catalogues the chrome ships in — **not** permission to
  put a sentence in a `.tsx` file. Every string is still a message key: not for NFR-85's sake any
  more (OQ-43 moved catalogue text into the release, so a wording change ships with a deploy), but
  because a key is what the type system, the translator and any future locale can all see. A
  literal is invisible to all three.

- **`~/*`, not `@/*`.** `tsconfig.boundaries.json` maps `@/*` to `apps/web/src`, and a TS `paths`
  key holds one meaning. Sharing it would resolve this app's `~/lib/env` to *web's* `lib/env` —
  both files exist — and the cross-app boundary rules would fire on the wrong file, or not at all.

- **Nothing pushes.** Every queue, counter and job status polls (§11.2). SSE and WebSockets appear
  nowhere in §5.4, §10.4 or the edge configuration; adding one is an amendment to those sections,
  not a ticket. TanStack Query's `refetchInterval` is the shape of every screen here.

- **A form field is `@easyesg/ui/forms`, not `TextField` + `register`.** Since 24 Aug 2026 the
  bound controls take `control` and `name` and derive the rest: `<FormTextField control={control}
  name="email" label={…} rules={{ required: … }} />`, with `<FormSummary control={control}
  title={…} />` above them. A-01's two steps are the reference. Reaching for the presentational
  `TextField` inside a form reintroduces the five hand-kept pieces the layer removed — the id
  constant, `id=`, `error=`, the `register()` spread and the summary entry — of which the id
  existed in three copies that a rename broke silently. The unbound controls stay exported for
  what is not a form: a queue's filter box, a search input, a read-only display. `required` must
  carry a message; the type refuses `required: true`, because a message-less rule renders no
  text, no `aria-invalid` and no summary entry — the form just refuses to submit in silence.

  **Type the form as the wire DTO** where one exists (`useForm<AdminChallengeRequest>`), as both
  steps do: `name="email"` is then checked against the contract rather than being a string
  nobody validates.

- **Nothing is memoized, no compiler is doing it for you, and this app has none of web's cover.**
  As of 24 Aug 2026 there is not one `useMemo`, `useCallback` or `memo()` in `apps/web`,
  `apps/admin` or `packages/ui` — raised by the project owner. The escape hatch the
  `vercel-react-best-practices` skill names in `rerender-memo.md` (*if React Compiler is enabled,
  manual memoization is not necessary*) does not apply: `apps/web` disables it deliberately
  (`reactCompiler: false`, AD-9) and `vite.config.ts` here never had it.

  It matters more here than there, for two reasons that are this app's defining properties. **There
  is no server tier**, so all 33 components are Client Components — `apps/web` gets away with it
  because only seven of its files are, and a Server Component has no render loop to optimise.
  And **every screen polls** (the trap above): a `refetchInterval` re-renders its subscriber on
  every tick whether or not the data changed, so a list derived inline — sorted, grouped, filtered
  by the URL's search params — redoes that work on a timer, forever, on screens whose whole job is
  a table.

  That is a reason to memoize the derivation, not to memoize by reflex: the same skill's
  `rerender-simple-expression-in-memo` says a simple expression with a primitive result must stay
  unwrapped, because comparing the dependencies costs more than recomputing. Three cases are real
  and nothing will flag them — a non-primitive passed into a `memo()`'d child or a dependency
  array, an expensive derivation, and a handler whose identity a child or effect actually observes.
  A-01 has none of them, which is why the absence has cost nothing yet; A-02…A-18 are tables and
  queues, and they are where it starts.

- **Two `setX` calls in one handler mean one `useReducer`.** The rule is in the root `CLAUDE.md`
  ("State has four homes"); `realm/components/sign-in-screen.tsx` is this app's worked example. Its
  `step` and `failure` were two `useState`s and are one state: advancing cleared the failure and set
  the step, a lapsed challenge set the step and then set the failure, restarting set both. Writing
  the transitions out is what made the lapsed-challenge branch legible — it returns to the
  credential step **and keeps the refusal**, so the api's own explanation is what greets the reader
  there, where as two setters it read like a fall-through.

  The console-specific part is where the reducer sits relative to Query. A mutation's `onSuccess`
  **dispatches one event and decides nothing else**: it maps the `ApiOutcome` to an event and hands
  it over, so the flow lives in the reducer and the wire handling stays in the mutation. Query owns
  `isPending` and the request; the reducer owns what the screen is. Reaching for a third
  `useState` to bridge them is the shape this rule exists to stop.


## Before you add a screen

- It has an `A-nn` in `design_spec.md` §4.4. All eighteen already exist as routes — you are filling
  one in, not adding one. A nineteenth is an escalation to design review.
- It is an instance of one of the nine archetypes (§4.6). `Exception queue` and `Dashboard` are
  admin-only; the tenant home is never a Dashboard.
- All eleven §8.1 states are designed before implementation. An undefined state is a defect, not an
  omission (UX-90).
- Every addressable state is in the URL — **including the queue filter** (UX-4, which names it
  explicitly). TanStack Router's typed search params are the mechanism; a filter held in component
  state is a UX-4 defect.
- Every string is a message key. Every error states what failed, the consequence, and the action
  that resolves it (NFR-79) — the "what now" slot is required.
- No internal identifier reaches the screen: no `FR-`/`UC-`/`A-`, no enum member, no taxonomy
  element key, no problem-type slug, no provider error string.
- If it is one of the five config-as-data screens (`A-03`, `A-04`, `A-05`, `A-09`, `A-17`), it is a
  **generic editor over versioned config, not a bespoke form** — adding a taxonomy element or a
  factor set must need no code change (AD-4, Phase 11).
- If it publishes anything cross-tenant, it follows UX-123 end to end: preview → scope disclosure →
  confirm → progress → result → one-step revert.
- If it is an exception queue, every manual resolution carries a rationale (UX-125), and that
  rationale is the ledger entry, not a UI nicety.
- If it shows a ledger, entries are superseded and never edited, and the interface offers no
  affordance implying otherwise (UX-126) — the append-only guarantee is a database privilege
  (DR-6), so an edit control would be a lie the database refuses.

## Before you call it done

The root `CLAUDE.md` requires `pnpm gates`, and that is necessary rather than sufficient: the gates
prove the code *runs*, not that it *belongs here*. Every finding the project owner has raised on
this app was invisible to all nine and to both e2e suites — sign-in carrying web's Server-Action
idiom where the console's data layer is Query, a screen that did not match its artboard,
components loose at `realm/` root instead of in `components/`, no memoization anywhere. A green
pipeline said nothing about any of them, so the convention pass is part of finishing rather than
a courtesy after it.

Run it against **the diff**, not from memory, and in this order:

1. **Load the `vercel-react-best-practices` skill and read the diff against it.** Every task that
   adds or edits a `.tsx` file here, no exceptions. The root skills table used to scope that skill
   to `apps/web`; that was wrong and is corrected — this app is 33 Client Components with no server
   tier, which makes it the one with *more* to answer for, not less. Its `rerender-` and `client-`
   categories are the ones that bite here (the memoization trap above, and Query's own caching);
   `server-` mostly does not apply, and saying so is part of having read it.
2. **Load `vercel-composition-patterns`** when the change adds a component API or a third boolean
   prop to an existing one — that prop is the smell UX-89 names, and the skill is installed for it.
3. **Re-read this file's traps and the checklist above** against what you actually wrote. Each one
   is a defect that already happened here once; the DOM-node reuse trap cost a real leak.
4. **Re-read the screen's own source** — `design_spec.md` §4.4's `A-nn` row and the artboard in
   `design/screens/EasyESG Admin Console Screens.dc.html` — and check the finished screen against
   it. "I read it before starting" is exactly how A-01 shipped without its staged flow; the check
   is against the built thing, not the intention.
5. **Say what you did not apply, and why.** A rule considered and declined with a reason is a
   decision; a rule never opened is an omission wearing the same clothes.
