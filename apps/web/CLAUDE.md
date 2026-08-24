# apps/web — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below, and `docs/design_spec.md` for
every screen. Cite them; do not re-derive them.

## Current state

Scaffold plus the first screens. What exists: 36 route files across four route groups, 6 layouts,
2 route handlers, the next-intl wiring, 10 feature folders, 5 boundary rules with fixtures — and,
from task 20, **S-01 register and S-02 verify/resend live end to end**: `features/identity/`
(server actions, RHF forms, the sessionStorage hand-off store), the `(identity)` layout on
`@easyesg/ui`'s FocusShell, self-hosted fonts in `globals.css`, and `e2e/web/` at the repo root
driving the journey in a real browser (`pnpm e2e:web`).

**Transport decision (task 20):** unauthenticated identity calls travel by **Server Action** —
the Next server tier calls the public API as the ordinary client AD-9 says it is.
`src/server/api-client.ts` is the full client seam: `api.get / getList / post / patch / delete`,
each returning one `ApiOutcome<T>` (envelope unwrapped — `messages[]` included, because
`WARNING` is how AD-5's `allow_with_warning` reaches a caller — problem+json as received,
202/204 as Ok-with-no-value, network/timeout/gateway failures as `unreachable`). List queries
are built by `src/lib/pagination.ts`, the typed inverse of the API's `ListQueryInterceptor` —
its grammar has no escaping, so the builder throws on a value containing `|` or `,` rather than
letting it parse as extra groups. **Note `API_BASE_URL` already carries `/api/v1`**, so client
paths are version-relative (`/auth/register`). Byte streams (export re-download, FR-53) are
deliberately NOT this client's job — they pass through `src/app/api/[...path]` byte-for-byte,
live since task 22 (see "The session tier" below).

Two rules hold around that seam (post-close review, 20 Aug 2026 — iftamaster's
`GeneralAxiosRepository` is the reference shape):

- **Ambient request context is assembled at the seam, never at call sites.** `postToApi`
  resolves the locale itself and puts it on `Accept-Language`; an action repeating
  `await getLocale()` is the violation. Since task 22 the access token is the second piece:
  read from the sealed session cookie inside the seam, attached as the bearer whenever a
  session exists — and **never rotated there** (see the session trap below).
- **A response body is validated, never cast.** `readResultObject` / `readResultList` /
  `readProblemDocument` in `api-client.ts` check the members they return, the way
  `VerificationEmailHandler.readEvent` does on the worker. A blind `as` reads a missing `object`
  as `undefined` and a screen renders that as *empty* — a silent wrong answer, not an error. An
  unusable body becomes `unreachable` (same fact and same remedy as no answer, and the copy
  already exists in three locales); a problem document is *repaired* instead, because RFC 9457
  makes every member optional and dropping it would replace "the address is taken" with "try
  again later". The thrown reason is developer-facing and names the shape, **never the body** —
  it may carry personal data (NFR-30).

- **One outcome shape end to end, its discriminators a closed vocabulary.**
  `src/lib/api-outcome.ts` declares `API_OUTCOME` (`as const`, derived union — the same rule
  `apps/api` records for `ACCOUNT_STATUS`/`APP_MODE`) and `ApiOutcome<T>`, which travels
  unchanged from `postToApi` through the action to the component; the action only projects the
  value with `mapOutcome`, which owns the failure passthrough. A scattered `'problem'` literal
  or a hand-written `if (!result.ok) …` translation block is the defect this replaced. Specs
  may still pin the literals — they are the RSC wire values, and must break if a constant's
  value is renamed.

**The session tier is live (task 22).** S-01 sign-in and S-02 reset/set-password reach the API
through Server Actions like registration does; sign-in seals the whole AD-12 session — both
tokens, expiries, the identity block — into ONE httpOnly `easyesg_session` cookie
(`Secure; SameSite=Lax; Path=/`, AES-256-GCM under `SESSION_SECRET` — OQ-33, closed
21 Aug 2026, architecture.md §12.5.6) and writes `NEXT_LOCALE` from the profile preference
(OQ-32). `src/server/session-codec.ts` is the pure seal/unseal; `src/server/session.ts` is the
request-scoped tier (read, establish, destroy, single-flighted refresh);
`src/app/api/[...path]` is the real pass-through — same-origin proof on writes, 401 without a
session, rotate-if-expiring, then forward with the bearer and stream both bodies untouched.
Interim surfaces, each recorded on its owning task row in `docs/task.md`: sign-in lands on
`?return=`-or-`/home` until task 25's membership branch, and the `(app)` layout's
`SessionStrip` carries sign-out until task 30's real global tier.

**The message catalogues have their first content.** `src/messages/{ro,en,ru}.json` carry
`chrome` and `identity`; all three separately authored, RO the source. Adding a string is a JSON
edit — and adding it to `ro.json` alone fails `src/messages/messages.parity.spec.ts`, which is
what replaces FR-64's runtime queue now that every locale is present at build time
(architecture.md OQ-43). `global.d.ts` derives key types from `ro.json`, so a typo'd key fails
`pnpm typecheck`. Component specs run against the real RO catalogue with
`src/test/setup.ts` registering jest-dom matchers and the explicit `cleanup()` that
`globals: false` withholds.

## Commands

Run lint and boundary checks from the **repo root**; they are workspace-wide.

| From | Command | Notes |
| --- | --- | --- |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script of its own. Next 16 removed `next lint`, so this is the **only** lint gate — AD-9: without it "every gate in AD-13's table silently turns off" |
| root | `pnpm boundaries` | dependency-cruiser over five roots, `apps/web/src` among them |
| root | `pnpm boundaries:prove` | Asserts each of the 20 rules still **rejects** a real violation. Run after touching `.dependency-cruiser.cjs` |
| here | `pnpm typecheck` | `tsc --noEmit` |
| here | `pnpm build` | Needs **no** environment. Nothing under `[locale]` prerenders, so the build never reaches the message loader, and `src/lib/env.ts` resolves through getters so a secret is a runtime input rather than a build input |
| here | `pnpm start:dev` / `test` | |

## Where things live

```
src/
├─ proxy.ts        Next 16's middleware. Locale AND session — see below
├─ i18n/           next-intl: routing · navigation · request · formats · page (the per-page ritual)
├─ app/            routes only, thin. No logic, no data access
├─ features/       10 domains, mirroring apps/api/src/modules names
├─ shared/         chrome owned by no single feature (SiteFooter) — mirrors apps/admin/src/shared
├─ server/         server-only: session, api-client, data/
├─ client/         browser-only: autosave (IndexedDB queue), polling
└─ lib/            env, pagination, session-cookie
```

Route groups carry no URL segment, which is the whole reason there are four:

| Group | Layout it establishes | Screens |
| --- | --- | --- |
| `(public)` | None. **The only zone where `"use cache"` is legal** (§14.2) | Marketing, legal, help |
| `(identity)` | Focus archetype — one task, no navigation | S-01, S-02, S-03 |
| `(app)/(workspace)` | Global tier + workspace tier | S-05, S-06, S-13…S-28 |
| `(app)/(wizard)` | Global tier only; module rail replaces the workspace tier | S-07…S-12 |

`(workspace)` and `(wizard)` are siblings, not parent and child, because **UX-5** says the wizard
*suppresses* the workspace tier. `/reports` and `/reports/:id/:module` therefore sit under
different layout ancestries over one address space. Nesting them would make the rail a
conditional render, which is how it ends up half-suppressed on one screen.

## The traps

- **`proxy.ts` has two jobs and only one file.** Next accepts one proxy module; AD-9 needs the
  session tier there and next-intl needs locale negotiation there. They compose in one exported
  `proxy` function, locale first. The matcher excludes `api` — `src/app/api/[...path]` is the
  token-attaching proxy and a locale rewrite would corrupt the forwarded path — and `health`,
  which must answer identically at every locale, meaning at none.

- **A refresh may only happen where the successor cookie can be written** — Server Actions and
  Route Handlers; cookie writes THROW during Server Component rendering (pinned Next 16 docs).
  This is not an inconvenience but a tripwire: rotation CONSUMES the single-use refresh token
  (task 21), so a refresh whose successor is not persisted leaves the browser holding a
  consumed token, and its next presentation past the 30 s grace reads as theft and revokes the
  session — a random sign-out with no error anywhere. `session.ts` single-flights refreshes
  per token for the same reason. When Server Components start calling the API (task 29+), the
  page-load rotation point becomes `proxy.ts`, which may set response cookies — planned there,
  not rediscovered. And rotating a `SESSION_SECRET` signs everyone out by design: unsealable
  is indistinguishable from absent, and that is the correct failure.

- **Never import `next/link` or `next/navigation`'s locale-aware members.** Use
  `@/i18n/navigation`. A raw `next/link` renders a working-looking anchor that drops the locale
  prefix: nothing throws, nothing logs, and it survives review. Lint-enforced.

- **`UNAUTHENTICATED_SEGMENTS` in `proxy.ts` is the auth boundary, and it is a list.** Route
  groups are invisible in URLs, so `(public)` and `(identity)` cannot be detected from the path.
  The default is closed — anything unnamed requires a session. Adding a public screen means
  adding it there.

  **Never read the locale as path segment 1.** The source locale is served *unprefixed*
  (`localePrefix: 'as-needed'`, architecture.md §10.8), so `/home` and `/ru/home` are the same
  route in different languages. `routeSegment()` resolves the first **non-locale** segment for
  exactly this reason: the earlier positional read treated `/home` as "no segment, therefore the
  marketing home" and returned public, which would have opened every authenticated Romanian
  route. It failed open, and silently — every test URL at the time carried a prefix, so nothing
  caught it. `e2e/web/routing.spec.ts` is the guard now.

- **The active organization never appears in a URL.** UX-2, and it is a security property, not a
  style: a second source of tenancy turns an org-switch race or a revoked membership into a
  cross-tenant read (AD-2). Language is the opposite case and *is* in the URL — do not
  generalise from one to the other. Romanian, the source locale, is the one that is **not** in
  the URL: `/register` is Romanian, `/en/register` and `/ru/register` are the others, and
  `/ro/register` 307s onto `/register` (architecture.md §10.8). Build links with
  `@/i18n/navigation` and this stays automatic; hand-built `/${locale}/…` strings do not.

- **Nothing prerenders, and `[locale]`'s stated reason has expired.** `force-dynamic` was set
  there because NFR-85 required a copy change to reach production without a redeploy, so strings
  could not be baked into the build artefact. Under **OQ-43 they now are, deliberately**, and
  NFR-85 no longer covers catalogue text — so that justification is gone. It has not been
  removed, because removing it is a caching decision with a tenancy blast radius and belongs in
  its own change: §14.2 permits caching only for "fully static, tenant-independent content: the
  marketing shell, the legal pages, the locale bundles", and telling those apart from the rest of
  `[locale]` is the actual work. `(app)` declares `force-dynamic` again for the stronger reason
  that survives untouched: every route below it is tenant-scoped, and §14.2 treats framework
  caching there as a tenancy risk, not a performance question.

- **`NextIntlClientProvider` is `messages={null}` at the root.** The default ships every message
  to the browser — the full B1–B11 label set across three locales, against NFR-43's LCP budget.
  Client components get a namespace-scoped provider instead. This matters more now that the
  catalogues are bundled: they are reachable from any import, so the only thing keeping them out
  of the client bundle is this deliberate `null` plus scoped providers below it.

- **Formatting has one home.** `src/i18n/formats.ts` declares named formats; components reach
  them by name through `useFormatter()`. `toFixed`, `toLocaleString` and `new Intl.*Format` are
  lint errors, because NFR-26's stated verification is a static analysis rule.

  **A year is a date, not a number** — the trap the `year` format exists for. ICU formats a bare
  `{year}` argument holding a number, so `2026` renders as "2 026" in `ro`/`ru` and "2,026" in
  `en`: the space thousands separator §11 asked for everywhere else, in the one place it is
  wrong. Format the date (`format.dateTime(date, 'year')`) and pass the string.

- **Nothing user-visible is derived from the clock in a Client Component.** The copyright year is
  computed in `SiteFooter`, a Server Component: computed on the client it would be evaluated
  twice, and a reader in Tokyo at 23:30 Chișinău on 31 December would hydrate a different year
  than the server rendered. It also uses **Chișinău's** clock rather than the reader's, which is
  NFR-34's test on a small case — a Moldovan company's legal statement must not change answer
  with the reader's timezone.

- **`requestLocale`, not `next/root-params`.** next-intl marks the former deprecated, but root
  params throw inside a Route Handler (Next E1043) and the module is a compiler-replaced
  placeholder that throws on plain import, breaking unit tests that reach `request.ts`. Migrate
  when Route Handlers are supported. Logged in `architecture.md` §18.

- **Nothing pushes.** Order state, export jobs and the notification unread count all poll (§11.2).
  SSE and WebSockets exist nowhere in §5.4, §10.4 or the edge config; adding one is an amendment
  to those sections, not a ticket.

- **TanStack Query is for client islands, and calling the API directly from one is a security
  bug, not a shortcut.** It is here for the three polls above plus autosave's queued mutations
  (§12.1, shared catalog pin with `apps/admin`). Everything reachable server-side keeps going
  through `src/app/api/[...path]` and `src/server/session.ts` — that proxy is what holds the
  access token out of browser JavaScript (AD-9, AD-12). A `useQuery` whose `queryFn` fetches the
  API origin itself works perfectly in development and moves the token to exactly where AD-12
  says it must never be. Point every `queryFn` at the proxy path.

- **There is no global client store, and that is a decision (OQ-41 follow-up).** Server state is
  Query, URL state is `searchParams`, form state is `react-hook-form`, session and the active
  organization are server-side. What is left — theme, density, toasts, wizard-local flags — is
  React context. Reaching for Zustand or Redux almost always means caching server state twice;
  and a store holding the active organization is the second source of tenancy UX-2 forbids from
  the URL, wearing a different hat.

- **Nothing here is memoized, and no compiler is doing it for you.** `next.config.ts` sets
  `reactCompiler: false` with a recorded reason (AD-9 — off until the wizard's render profile is
  measured), so the escape hatch the `vercel-react-best-practices` skill names in
  `rerender-memo.md` — *if React Compiler is enabled, manual memoization is not necessary* — does
  **not** apply in this repo. The repo took the measure-first branch and then never staffed the
  manual one: as of 24 Aug 2026 there is not one `useMemo`, `useCallback` or `memo()` in
  `apps/web`, `apps/admin` or `packages/ui`. Raised by the project owner, 24 Aug 2026.

  Read that as "the decision has no owner", not as "add memoization everywhere" — the same skill's
  `rerender-simple-expression-in-memo` says a simple expression with a primitive result must stay
  unwrapped, because the dependency compare costs more than the expression. What it does mean is
  that in a **Client Component** the three cases below are yours to handle by hand, and nothing
  will flag them:

  - a non-primitive (object, array, function) passed as a prop into a `memo()`'d child, or into a
    `useEffect`/`useMemo` dependency array — recreated each render, it defeats the thing it feeds;
  - genuinely expensive derivation — parsing, sorting, grouping a list — recomputed per render;
  - `useCallback` for a handler whose identity a child or an effect actually observes. A handler
    passed to a plain DOM element observes nothing, and wrapping it is noise.

  Only seven files here are Client Components, all under `features/identity/`, and none currently
  has a case — Server Components have no render loop to optimise, which is why this has cost
  nothing yet. It starts to bite at the wizard (S-07…S-12), autosave's IndexedDB queue and the
  three polls. `eslint-plugin-react-hooks` 7.1.1 already runs the compiler's static analysis and
  will tell you when a component is *un*-compilable (`react-hooks/incompatible-library` fires on
  RHF's `watch()` in two forms today) — advisory while the compiler is off, and worth reading as
  the signal it is.

## Before you add a screen

- It has an `S-nn` in `design_spec.md` §4.4, or it is one of the public/legal/help surfaces that
  deliberately has none — which is itself an open question, not a licence to invent an id.
- **The locale ritual is declared once, in `src/i18n/page.ts` — do not restate it.** A page
  types its params as `LocaleParams`, opens with `await activateRequestLocale(params)`, and
  gets its tab title with `export const generateMetadata = localizedPageTitle('<namespace>')`
  (the namespace must carry a `title` leaf, enforced by type). What cannot be centralised is
  the *call*: Next renders layouts and pages in parallel, so `[locale]/layout.tsx`'s
  `setRequestLocale` does not reach its pages — one line per page is the floor. A hand-written
  `const { locale } = await params; setRequestLocale(locale);` in a page is the DRY violation
  this module removed (post-task-22 review, 21 Aug 2026).
- It is an instance of one of the nine archetypes (§4.6). A screen that fits none is an
  escalation to design review.
- All eleven §8.1 states are designed before implementation. An undefined state is a defect, not
  an omission (UX-90).
- Every string is a message key. Every error states what failed, the consequence, and the action
  that resolves it (NFR-79) — the "what now" slot is required, not optional.
- No internal identifier reaches the screen: no `FR-`/`UC-`/`S-`, no enum member, no taxonomy
  element key, no problem-type slug.

## Before you call it done

The root `CLAUDE.md` requires `pnpm gates`, and that is necessary rather than sufficient: the gates
prove the code *runs*, not that it *belongs here*. Every finding the project owner has raised on
this app and on `apps/admin` was invisible to all nine — a screen carrying the wrong idiom, a
screen that did not match its artboard, components in the wrong folder, no memoization anywhere.
Gates cannot see any of those, so a convention pass is part of finishing, not a courtesy after it.

Run it against **the diff**, not from memory, and in this order:

1. **Load the `vercel-react-best-practices` skill and read the diff against it.** Every task that
   adds or edits a `.tsx` file under `apps/web`, no exceptions — 70 rules in 8 categories, and its
   own priority order is the one to use: waterfalls and bundle size are CRITICAL, re-render
   optimisation is MEDIUM. The categories that bite hardest here are `server-` and `async-`,
   because most of this app is Server Components; `rerender-` applies only inside the seven
   `'use client'` files, where the memoization trap above says the work is manual.
2. **Load `vercel-composition-patterns`** when the change adds a component API or a third boolean
   prop to an existing one — that prop is the smell UX-89 names, and the skill is installed for it.
3. **Re-read this file's traps and the checklist above** against what you actually wrote. They are
   not background reading: each one is a defect that already happened here once.
4. **Re-read the screen's own source** — `design_spec.md` §4.4's `S-nn` row and the artboard in
   `design/screens/` — and check the built screen against it. "I read it before starting" is how
   A-01 shipped without its staged flow; the check is against the finished thing.
5. **Say what you did not apply, and why.** A rule considered and declined with a reason is a
   decision; a rule never opened is an omission wearing the same clothes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
