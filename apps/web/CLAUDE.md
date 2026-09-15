# apps/web — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below, and `docs/design_spec.md` for
every screen. Cite them; do not re-derive them.

## Current state

Identity, organization, periods, reports, entities and the wizard are live; the calculator,
validation, preview and export, notifications, checkout and billing and the public tier are the
sixteen addresses `AddressNotice` answers for. What exists: 45 page routes across six route groups,
7 layouts, a not-found boundary, 4 route handlers, the next-intl wiring, 15 feature folders (eight built),
5 boundary rules with fixtures, `features/identity/` on `@easyesg/ui`'s FocusShell with self-hosted
fonts in `globals.css`, and `e2e/web/` at the repo root driving every journey in a real
browser (`pnpm e2e:web`). The root `CLAUDE.md`'s table names the live screens; `docs/archived_tasks.md`
says what each closed task shipped and `docs/task.md` what each remaining one must. What follows is what a reader needs in hand for each live slice, grouped by
the seam it sits on rather than by the task that built it.

### The seam to the API

**Transport decision (task 20):** unauthenticated identity calls travel by **Server Action** —
the Next server tier calls the public API as the ordinary client AD-9 says it is.
`src/server/api/api-client.ts` is the full client seam: `api.get / getList / post / patch / delete`,
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

**The outcome-to-notice translation itself lives in `src/lib/notice.ts`** — `successNotice`,
`failureNotice` and `noticeFromOutcome`, pure and copy-free. It exists because three screens had
grown their own copy of the same per-member RFC 9457 fallback and two had already drifted. Reach
for it whenever a screen holds an outcome in state; render `problem.title ?? …` inline only where
the "what now" is a **node** that navigates, which `Notice.action: string | null` deliberately
cannot hold.

**A refusal's "what now" comes from the API, not from the screen** (same review, extended 27 Aug
2026). `Callout`'s `action` is required by §11.5 — feedback ships with three parts — so every screen
was passing *something*, and four passed a catalogue sentence that duplicated a clause already
inside `problem.detail`: `identity.sign_in.credential_invalid` ends *"Verificați datele introduse și
încercați din nou"*, and `signIn.problemAction` said the same thing again underneath it. On a
throttle refusal the duplicate became a contradiction — the API's "wait a few minutes" above the
screen's "try again now".

**`action={null}` is now how a screen says the next step is already in the message.** The slot stays
required so it cannot be forgotten; `null` is a visible decision where a fixed sentence was one
nobody had taken. Pass a node only where this screen owns a remedy the detail cannot express —
in practice one that **navigates**, like the lockout's reset link. `confirm-email` and
`accept-invitation` are the correct shape and were left alone: they use `problemAction` as the
*label of a link*, which is the legitimate case, not the defect.

**The rule binds both front ends, and this file's scope is why that had to be discovered twice.**
A sweep on 29 Aug 2026 found a sixth site in `apps/admin` — `realm.signIn.problemAction` was
*"Verifică datele introduse și încearcă din nou"*, the same clause verbatim — untouched because the
27 Aug review was reading `apps/web`. The same sweep found the console had never had UX-135's
formal register applied either. When a rule here is about `Callout`, `ApiOutcome` or catalogue copy,
it is a rule about the console too; the root `CLAUDE.md`'s "A rule is applied where it holds"
carries the general form.

**Read a provider through the contract's enum, never as a `string`.** `providerLabel` and
`providerGlyph` take `SocialProvider`, so an unnamed provider is a compile error at their `Record`
rather than a raw slug rendered into a sentence. `features/credentials/tools/credentials.ts` **re-exports**
`LinkedProvider` and `TotpState` from `@easyesg/contracts` rather than restating them: the
hand-written copy had widened `provider` to `string`, which is exactly the drift that package exists
to prevent, and it is what let the slug through.

### The session tier

**The session tier** (task 22). S-01 sign-in and S-02 reset/set-password reach the API
through Server Actions like registration does; sign-in seals the whole AD-12 session — both
tokens, expiries, the identity block — into ONE httpOnly `easyesg_session` cookie
(`Secure; SameSite=Lax; Path=/`, AES-256-GCM under `SESSION_SECRET` — OQ-33, closed
21 Aug 2026, architecture.md §12.5.6) and writes `NEXT_LOCALE` from the profile preference
(OQ-32). `src/server/session/session-codec.ts` is the pure seal/unseal; `src/server/session/session.ts` is the
request-scoped tier (read, establish, destroy, single-flighted refresh);
`src/app/api/[...path]` is the real pass-through — same-origin proof on writes, 401 without a
session, rotate-if-expiring, then forward with the bearer and stream both bodies untouched.
The one interim this left — the `(app)` layout's `SessionStrip`, carrying sign-out until the real
global tier existed — is **gone since task 30.1**, deleted rather than left dead.

**§4.3's post-sign-in branch** (task 25.4). `features/identity/shared/tools/post-sign-in.ts` holds the
rule — none → S-04, one → S-05, several → S-05 where the switcher chooses (OQ-6) — and
`server/session/post-sign-in.ts` the seam that reads `/memberships` and applies it. Both sign-in flows exit
through it; a provider session is the same session (UC-05). Three things to know before touching
it: **`?return=` is honoured where the destination can actually render** — refined 25 Aug 2026 by
task 26.3, from "only where an organization resolves". The override exists because a route inside
`(app)` needs a bound organization, which says nothing about one outside it: S-03's
`/invitation/<token>` renders perfectly for a member of nothing and is the one deep link such a
person must be returned to. `rendersWithoutOrganization` reads `lib/route-access.ts`, which is the
proxy's own list — the gate and the branch must not disagree about which routes need a session;
**`null` memberships and `[]` are different answers** — could not read (S-35) versus belongs to
nothing (S-04); and **the rule carries no `server-only`** deliberately, since importing the
API client there would make every arm untestable outside a browser.

**An account completing its setup** (task 155; §12.5.6's task-155 row). The sealed session carries
the account's `status`, and three places read it. `proxy.ts` sends an account `awaiting_setup` to
S-36 (`/complete-account`) from every address that needs a session, with `?return=` — **and carries
a rotated successor on that redirect**, because the rotation has already spent the refresh token and
a browser left presenting it reads as theft. §4.3's branch sends one there before reading
memberships the API would refuse it. And S-36's actions **renew** the session when setup completes
(`renewSession`), because a cookie still saying *in setup* would be turned straight back by the
proxy. Two things to know before touching it: **the step comes from the API's read, never from the
cookie** — `setupStepOf` over `GET /account/setup` — so a stale cookie changes where the proxy sends
a reader and never which step they see; and **on S-02's path the password step is served at
`/register/password`**, from a sealed grant cookie (`server/sealed/setup-grant.ts`, the factor
challenge's shape), because that account has no session until the password is set — **inside
`(session-issuing)`**, because completing it issues one, so UX-136's layout turns away a reader who
already holds a session. It was `/verify/password` until task 155's second review found a signed-in
reader could replace their session there; `route-access.spec.ts` compares that group's first segments
with `SESSION_ISSUING_SEGMENTS`, which is why the step lives under `register` rather than a new one.

**The provider flow** (task 24). `/auth/social/{provider}/start|callback` are Route
Handlers OUTSIDE `[locale]` — they are the redirect URIs registered at the providers, so they
cannot vary by language, and they are excluded from `proxy.ts`'s matcher (locale negotiation
would rewrite them; the session gate would bounce the sessionless callback). The flow logic lives
in `features/identity/social/handlers/social-flow.ts`; the in-flight OAuth transaction (state, nonce, PKCE
verifier, intent, return path) rides in its own sealed httpOnly cookie
(`src/server/sealed/social-transaction.ts`, over the codec's generic `sealJson`/`unsealJson`), and a
successful completion calls `establishSession` exactly as password sign-in does. Two traps with
scars: **every redirect this flow issues is based on `env.publicOrigin`, never `request.url`** —
the standalone server binds `0.0.0.0`, and a redirect built from the bind address lands the
browser on a host the session cookie was never set on; and the transaction cookie is
`SameSite=Lax` by necessity — the provider callback is a cross-site top-level GET, which `Strict`
would strip the cookie from. S-01's provider buttons (`SocialProviders`, a Server Component
streamed behind the form) and the `?notice=` callout (`SocialNoticeCallout`, closed vocabulary in
`features/identity/social/tools/social.ts`) are the screen surface; FR-8 link/unlink is task 27's, on S-28.

**A pending provider link is bound to the account that began it** (27 Aug 2026, review).
`beginSocialFlow` refuses to start a link without a session, and that proves nothing about the
session five minutes later at the *confirmation* — the re-sealed cookie is path-wide, so a session
that ends in between leaves it standing, `/account/credentials` bounces to sign-in, and whoever
signs in next is offered a confirmation that would attach someone else's Google account to theirs.
`PendingLink` therefore carries `accountId`, the callback refuses when no session remains, and
`readPendingLink` and `completePendingLink` both require it to match. **The two must agree**: a
pending state the reader can see but never complete is worse than none at all.

**S-28 and S-01's staged factor step** (tasks 27.7, 27.8). `features/credentials/` holds
the Record screen over `RecordShell` — extracted to `packages/ui` at this first instance, not
deferred — and `features/identity/sign-in/`'s `tools/factor.ts` / `tools/factor-state.ts` / `components/factor-form.tsx`
hold `/sign-in/factor`. Three things to know before touching either. **The factor challenge lives
in `server/sealed/factor-challenge.ts`'s sealed httpOnly cookie and only `expiresAt` reaches the browser**
— `peekFactorChallenge` reads without clearing because a render cannot write cookies, and
`consumeFactorChallenge`'s caller puts it back on a refusal, since the API's challenge is
deliberately not single-use. **`signInAction` branches on `kind`, never on the presence of
`accessToken`** — probing for a field is writing the discriminator a second time, and the absence of
that branch is what made enrolling a factor crash the next sign-in for four tasks (build-log,
27 Aug 2026). And **`FACTOR_LAPSED` is a fourth `status` beside `API_OUTCOME`'s three**, declared in
`features/identity/sign-in/tools/factor.ts` and deliberately not a member of the wire vocabulary: no server can
send it.

### The chrome

**§4.2's global tier** (task 30.1). `shared/global-tier.tsx` is a Server Component in the
`(app)` layout — so it is on every authenticated screen including the two outside `(workspace)`,
S-04 and S-35, where it renders its designed empty state and names no organization. It resolves
every string with `getTranslations` and hands them down, because `shared/account-corner.tsx` is a
Client Component only for `usePathname`/`useSearchParams` (a language choice is a link to this
address in another locale) and giving it `useTranslations` would put the `chrome` catalogue in the
bundle. `server/data/memberships.ts` is the read, wrapped in React `cache()` — the band and S-05 read the
same collection in one render pass.

Three things to know before touching it:

- **The organization region is a plate, not a switcher.** Switching writes the session and its route
  is **task 83**'s; the band names what `GET /memberships` marks `active`, which is `AuthGuard`'s own
  `selectActiveMembership` answer projected onto the read. Never derive it here — "the only
  membership" is right until someone holds two.
- **Sign-out submits explicitly.** The menu item is a `type="submit"` button associated by `form=`
  with a form outside the Radix portal, and its `onClick` cancels the default and calls
  `requestSubmit()`. Without that the menu's close unmounts the button before the click's default
  action runs, and sign-out silently does nothing. `e2e/web/global-tier.spec.ts` is what holds it.
- **`AccountMenu` is `modal={false}`.** A modal Radix root puts `pointer-events: none` on `body`, and
  `SubContent` portals as a sibling of the layer that gets `auto` back — so the language submenu is
  unclickable. It is also the right semantics for chrome hanging off a header.

**UX-124's support-access banner** (task 67.9) sits beside the global tier in the `(app)` layout, behind a
`<Suspense>` with **no fallback** — its ordinary state is absent, so a skeleton would reserve and then collapse a band
on nearly every render. `features/support-access/` holds it: `server/data/support-access.ts` reads
`GET /support-access`, whose API decides what each member is shown (pending requests to an Organization Administrator
only, running access to everyone), and three Server Actions answer or end, each revalidating the `(app)` layout. A
failed read draws nothing, and `mayAdminister`, beside `mayWrite`, decides only whether *End access* is offered.

**Every address answers something (task 103).** `shared/address-notice.tsx` is the anatomy under §8.1's two
address states, `not-yet-available.tsx` and `address-not-found.tsx` — `error — not yet available` for the sixteen routes whose screens have not
shipped, and `error — not found` for an address that does not exist. `design_spec.md` §4.5
records them as **patterns, not screens**: UX-7 governs destinations serving a use case, and
these are the answer when none applies, so §4.4's count stays at 52 and neither gained an
`S-nn`. Three things to know before touching them:

- **Neither renders a landmark.** `(workspace)`'s layout already emits `<main>`; `(public)`'s
  emits none, so a public caller wraps the notice in `FocusColumn`. Getting this wrong
  duplicates the landmark in one group and drops it in the other, and nothing but an axe scan
  would say so.
- **`[locale]/not-found.tsx` needs the `[...rest]` catch-all to fire at all.** A nested
  not-found boundary reacts only to an explicit `notFound()`; an unmatched path otherwise falls
  past it to Next's unstyled English-only default. The two files are one mechanism.
- **The 404's markup is client-rendered and the not-yet-available pages are not.** Next serves
  an empty shell for a not-found boundary and streams the content in the Flight payload —
  measured against a synchronous probe component, so it is the framework's behaviour and not
  the `await`s in `AddressNotice`. Do not "fix" it by desugaring the component.

Reaching the 404 signed out depends on the segment, which is `proxy.ts`'s rule rather than the
page's: an unknown address under an authenticated segment answers 307 to sign-in with a
`?return=` and never reaches the catch-all, so only `route-access.ts`'s unauthenticated
segments 404 without a session. `e2e/web/address-states.spec.ts` asserts both halves.

### The wizard

**S-07's draft-integrity pattern** (task 35.2). `client/autosave/` is built — `useAutosave`
over `features/wizard/tools/autosave-state.ts`'s reducer, the IndexedDB `PendingWriteStore` with its
memory fallback, and `putDisclosureValues`, the **first browser-originated write** through
`app/api/[...path]`. The step page renders §6.2's anatomy through `features/wizard/components/fields/`
(`StepFields` → `StepField` → `DisclosureControl`, one control per kind), with the indicator in `WizardShell`'s
`saveState` slot, the unsynced banner above the fields, and the exit control's consequence dialogue.
Four things to know before touching it:

- **The reducer owns what is unacknowledged; Query owns only the wire.** `FLUSH_SUCCEEDED` is
  dispatched from `onSuccess` with the rows as committed, and nothing leaves `pending` before that
  (NFR-56). A key is acknowledged only if its sequence still equals the one sent — edit a field while
  its previous value is in flight and the newer edit survives. `architecture.md` §12.5.6 records why
  Query's mutation cache could not be the queue.
- **The `QueryClientProvider` lives in the `[reportId]` layout, not in `(app)`.** Autosave is the
  first Query consumer and lives entirely under `(wizard)`; the provider moves up when the
  notification unread count (task 50.2) needs it on every screen. Do not create a second client.
- **A step change persists and does not fire.** Unmount writes nothing; the queue is in IndexedDB and
  the next step's mount restores and flushes it. The exit control warns (UX-37); the rail does not,
  because a step change abandons nothing. The queue's key carries the **account id** from the sealed
  session — `pending-store.ts` says why a report-scoped key would let the next sign-in drain it.
- **Two required slots are `null` with their owners named**: `help` (OQ-59 — no source for UX-17's
  sentences exists) and `notAvailable` (task 36.13). `enumeration` kinds render as text until task
  36.2 brings the domain to the browser; `text_block` is a plain `TextArea` until 36.2's narrative
  control. Every one of these is a different control arriving with its module, not a boolean prop.

### Copy

**Romanian addresses the reader formally, everywhere — UX-135** (27 Aug 2026, project owner).
*Dumneavoastră*, no exceptions; Russian was already uniformly *вы* and English has no T-V
distinction. Before this, RO was split almost evenly and the two registers met **inside one
viewport**: S-01 rendered *"Intră în contul tău"* beside *"Continuați cu Google"*, because the
provider buttons are a different namespace from the form they sit under. Seventy strings across
seven `identity` namespaces were rewritten, and seventy test selectors with them — the e2e specs
match on Romanian labels, which is the intended coupling and is why a catalogue edit is never
just a catalogue edit here. `design_spec.md` §3.4 carries the rule and the reasoning.

**The message catalogues have their first content.** `src/messages/{ro,en,ru}.json` carry
`chrome`, `forms`, `identity` and `organization`; all three separately authored, RO the source. Adding a string is a JSON
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
| root | `pnpm boundaries:prove` | Asserts each of the 23 rules still **rejects** a real violation. Run after touching `.dependency-cruiser.cjs` |
| here | `pnpm typecheck` | `tsc --noEmit` |
| here | `pnpm build` | Needs **no** environment. Nothing under `[locale]` prerenders, so the build never reaches the message loader, and `src/lib/env.ts` resolves through getters so a secret is a runtime input rather than a build input |
| here | `pnpm start:dev` / `test` | |

## Where things live

```
src/
├─ proxy.ts        Next 16's middleware. Locale AND session — see below
├─ i18n/           next-intl: routing · navigation · request · formats · page (the per-page ritual)
├─ app/            routes only, thin. No logic, no data access
├─ features/       15 domains, mirroring apps/api/src/modules names
│                 └─ a domain serving SEVERAL screens splits per screen — see below
├─ shared/         chrome owned by no single feature (GlobalTier, AccountCorner, SiteFooter)
├─ server/         server-only: session/ · api/ · sealed/ · data/ · messages/
├─ client/         browser-only: autosave (live since task 35.2 — hook, IndexedDB queue, the PUT), polling
└─ lib/            env, pagination, session-cookie, routes, route-access, notice, api-outcome, legal-date, locale-path, revalidate-paths
```

Route groups carry no URL segment, which is the whole reason there are six. **The table is the
enumeration, and `docs:check` compares its count to the directories on disk** — a group missing a row
here is a group a new screen is not added to, which for `(session-issuing)` means a screen that
issues a session and is never gated:

| Group | Layout it establishes | Screens |
| --- | --- | --- |
| `(public)` | None. **The only zone where `"use cache"` is legal** (§14.2) | Marketing, legal, help |
| `(identity)` | Focus archetype — one task, no navigation | S-01, S-02, S-03, S-36 |
| `(identity)/(session-issuing)` | None of its own. **UX-136's gate, once for the group** (task 112) — membership of the directory *is* what makes a screen refuse a caller who already holds a session | S-01 sign in and its factor step, S-01 register |
| `(app)` | Global tier | S-04 and S-35 — the two authenticated screens in no inner group |
| `(app)/(workspace)` | Global tier + workspace tier | S-05, S-06, S-13…S-28 |
| `(app)/(wizard)` | Global tier only; module rail replaces the workspace tier | S-07…S-12 |

`(workspace)` and `(wizard)` are siblings, not parent and child, because **UX-5** says the wizard
*suppresses* the workspace tier. `/reports` and `/reports/:id/:module` therefore sit under
different layout ancestries over one address space. Nesting them would make the rail a
conditional render, which is how it ends up half-suppressed on one screen.

## The traps

- **A spec that renders `NextIntlClientProvider` itself inherits nothing, and the gap is silent.**
  `NextIntlClientProviderServer` fills `formats`, `timeZone` and `now` from `getRequestConfig`
  whenever the prop is `undefined` — which is why no layout in this app passes any of them. A jsdom
  test renders the *client* provider directly, so it gets none of that: `format.dateTime(x,
  'short')` answers next-intl's fallback and logs `IntlError: MISSING_FORMAT`, once per formatted
  value per render. Found 26 Aug 2026 on `access-board.spec.tsx`, where it was twenty-four caught
  errors and 366 lines of stderr per run, and the table under assertion was rendering dates the
  product never produces. Pass `formats` from `@/i18n/formats` and `timeZone` explicitly in any spec
  whose subject formats a date, a number or a list. The three identity specs omit both and are fine
  **today** only because none of their components calls a formatter — which is a latent version of
  the same trap, not an exemption from it.

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
  per token for the same reason. And rotating a `SESSION_SECRET` signs everyone out by design:
  unsealable is indistinguishable from absent, and that is the correct failure.

  **The page-load rotation point is `proxy.ts`, and it is built (task 26.4).** This paragraph used
  to end "planned there, not rediscovered" and name task 29+; S-16 is the first Server Component to
  read the API during render, so it arrived early. The gate here checks the cookie carries a **live**
  session — the 7-day idle bound — which says nothing about the ≤15-minute access token inside it, so
  without rotation a member returning after twenty minutes met a 401 holding a session with six days
  left. **It said *exists* until task 112, and the paragraph above is what that cost**: *"unsealable
  is indistinguishable from absent, and that is the correct failure"* was written here and the gate
  did not implement it, so rotating `SESSION_SECRET` signed nobody out — it gave everyone an
  authenticated render with no token to call the API with. Four things to know before touching
  `rotateIfDue`:

  - **It runs on routes that READ the session, which is two sets** (task 112): the gated ones, and
    `/sign-in` and `/register`, which resolve §4.3's branch during render for a caller who already
    holds a session. A route that does neither still pays nothing, not even an unseal.

  - **The `request.cookies.set` must happen BEFORE `handleI18nRouting`.** A cookie on the response
    reaches the browser and nothing else; the render of *this* request would still read the stale
    token. next-intl clones `request.headers` into `NextResponse.next({ request: { headers } })`
    (read from its source, not assumed), so mutating the request first is what forwards it.
    `proxy.spec.ts` fails on exactly this reordering and on nothing else — verified by doing it.
  - **`detachedApi`, not `api`.** The proxy runs before Next establishes a request scope, so
    `cookies()` and `getLocale()` have nothing to read. `REQUEST_CONTEXT.Detached` names that one
    caller; anything else reaching for it is a call that has silently dropped the user's language
    and identity.
  - **The write is a `SessionJar`** because Next's two cookie-writing surfaces share no API. Only
    the jar differs between the proxy and an action — deciding whether to refresh, spending the
    single-use token exactly once, and reading a failure are one implementation in `session.ts`.

- **A `'use server'` module may export ONLY async functions, and no gate but the build says so.**
  Task 32.3 moved a shared `revalidatePath` pattern into `features/periods/actions/actions.ts`'s exports so a
  second action could reuse it — *"Only async functions are allowed to be exported in a 'use server'
  file"*, ten Turbopack errors, and `pnpm typecheck`, `pnpm lint` and 286 unit tests all green. The
  constant is a **route pattern**, not a route: it carries `[locale]` and the route groups
  (`(app)`, `(workspace)`) that never appear in a URL, so it lives in `lib/revalidate-paths.ts` and
  not in `lib/routes.ts`, where something would eventually hand it to a `Link` and 404. Anything a
  Server Action needs to share — a constant, a type guard, a plain helper — belongs beside it, not
  in it.

- **A domain serving several screens splits per screen, all the way down** (11 Sep 2026, tasks 122
  and 123). `organization/` was the first to serve four — S-04, S-05, S-15, S-16 — and it had 21 flat
  component files plus 10 loose rule files at its root, with nothing saying which belonged together.
  It is four folders now, each holding **its own rules, its own actions and its own `components/`**:

  ```
  organization/
  ├─ access/     S-16   actions/ · components/ · tools/
  ├─ home/       S-05   components/ · tools/
  ├─ profile/    S-15   actions/ · components/ · tools/
  └─ creation/   S-04   actions/ · components/
  ```

  **The axis was verified rather than chosen**: no file was reached by two screens, so the folders
  could not introduce a coupling that was not already there. Splitting by kind (`forms/`, `lists/`,
  `context/`) was the alternative and is the wrong one — it separates the files that change together,
  which is the only thing a folder can usefully keep.

  **A domain serving ONE screen does not split per screen** — there is no second screen to split
  by — **but its root is a directory like any other** (task 132), so it holds `components/ ·
  tools/ · actions/` directly rather than files beside `components/`. Task 134 gave `periods/`,
  `entities/`, `reports/`, `credentials/` and `wizard/` that shape; the seven unbuilt scaffolds are
  one `index.ts` each, their empty folders gone. What this rule answers is the shape a domain grows
  into, not a shape to impose on arrival.

  **`identity/` was the outstanding case for both halves and is split per journey, not per
  `S-nn`** (task 134, owner's decision). Its ten actions divided by journey — register, sign-in with
  its factor step, verify, reset, invitation — and sign-out's readers are the chrome, so the axis
  the per-screen rule verifies was not `S-01`/`S-02`/`S-03`: `register/`, `sign-in/`, `verify/`,
  `reset/` and `invitation/` each hold their own `actions/ · components/ · tools/`, `social/` holds
  the provider flow with `handlers/` for what the two Route Handlers call, and `shared/` holds what
  more than one journey reads — sign-out, §4.3's branch, the register→verify hand-off store, the
  `(identity)` chrome and the stylesheet.

  **`index.ts` and empty scaffold folders go when the domain is built.** `organization/index.ts` was
  `export {}`, imported nowhere, and its docblock still read *"Not built. Folders are `components/
  hooks/ schema/ queries/ types/`"* — false on both counts, naming only two of the four screens it
  serves. `hooks/`, `queries/` and `schema/` held nothing but `.gitkeep`. A scaffold that outlives
  the scaffolding is a file that lies to the next reader. **One exception, and it is a gate's**: a barrel
  a boundary fixture imports — `commerce/index.ts` and `reporting/index.ts`, which
  `prove-boundaries.sh` reaches as `'../commerce'` and `'../reporting'` — goes only when the fixture
  is repointed, or the proof goes inert (task 134). The seven unbuilt domains keep theirs.

  **File names keep their prefix.** `access/access-list.tsx` stutters and stays: this app relies on
  component file names that survive out of context — `entities-list.tsx`, `reports-list.tsx`,
  `periods-list.tsx`, `access-list.tsx` are deliberately parallel across four features, and a
  `list.tsx` inside a folder reads well in a tree and badly in a stack trace, a test report or a
  tab bar.

- **Inside a screen folder, a directory holds files or folders — never both** (11 Sep 2026, tasks
  126 and 127, project owner). S-05 was the worked example; task 127 carried it to the other three,
  so it is `features/organization/`'s shape rather than one screen's — and, since task 132, every
  directory under `src/`'s: the general form is the `one-kind-per-folder` skill (twelve rules; the
  two exemptions are in `folder-files-or-folders`), and this bullet keeps the worked example. `home/components/` had grown to 16 flat files; splitting it per
  **region** left a stylesheet and six overview files sitting beside the new folders, which is the
  shape this rule refuses — a listing that mixes the two makes a reader check every entry to learn
  what kind of thing it is.

  **A screen folder holds up to three kinds, and the third is what task 126 deferred.**
  `components/` renders, `tools/` is pure, **`actions/`** is the half carrying `'use server'`. That
  directive is what makes it a kind rather than a file: the module may export only async functions,
  its exports become callable endpoints, and the constraint bites at the **build** — `typecheck`,
  `lint` and 286 unit tests all missed it once (see `lib/revalidate-paths.ts`). Folding it into
  `tools/` would put that among modules with neither property. **A screen has the kinds it has**:
  S-05 reads, so it has no `actions/`; S-04 is a form with nothing pure to extract, so it has no
  `tools/`. That last clause named S-15 too until task 129, and the correction is the more useful
  half of the rule: *having no `tools/`* is a fact about a screen at a moment, not a property of
  forms. S-15's had a form shape, two conversions between it and the wire, and a reducer sitting
  **inside** a 430-line component — all pure, none of it reachable by a unit spec until it moved out.
  If a form folder has no `tools/`, the question is whether nothing is pure or whether nothing has
  been extracted yet.

  ```
  home/
  ├─ components/
  │  ├─ arrival/       arrival-notice
  │  ├─ heading/       organization-heading · heading-loading
  │  ├─ overview/      section/ · regions/ · states/ · shared/
  │  ├─ memberships/   section/ · list/ · states/ · shared/
  │  ├─ shared/        home-region
  │  └─ styles/        home.module.css
  └─ tools/            home.ts · overview.ts · their two specs
  ```

  **The top level is what the route renders** — one folder per child of S-05's `return`, in the same
  order, **plus a leaf for each thing that belongs to none of them**: `styles/` and, since task 128,
  `shared/`. A listing is never *shorter* than the `return`, which is the property worth having.
  **Below it the question is always the same one:** how many siblings read this file? One, and it
  lives with that sibling; more than one, and it gets its own leaf at the level where all its readers
  can see it.

  **That question is what moves a file up, and it has now moved one twice.** `home-region.tsx` — a
  `Panel` and the `h2` that names a region — began as four copies of an incantation inside the
  overview, became `overview/shared/overview-region.tsx` when three regions and an empty state read
  it, and became `components/shared/home-region.tsx` when splitting the memberships region found the
  fifth copy. It lost `Overview` from its name at that point, because a region's heading **level**
  follows from the screen having one `h1` and was never the overview's business. A `shared/` folder
  at two levels is the same rule asked about different siblings, which is why they share a name —
  and each carries its admission test in a docblock, because a folder named for sharing becomes a
  junk drawer the first time something is put there for being hard to place.

  **`tools/` is the rule above's *rules* under a different name.** That sentence — "its own rules,
  its own actions and its own `components/`" — describes what a screen folder contains, not what its
  directories are called, so there is nothing to reconcile; the name is the owner's, and it is noted
  in `tools/home.ts` so a reader who knows the sentence finds out in one place which folder it means.

  **It has a failing state, rooted at `src/` since task 134.** `src/test/folder-shape.spec.ts`
  walks every directory under `src/` and names the offender (*"server holds files [stray.ts]
  beside folders [api, data, …]"*), proven to bite at each root it has had by dropping a stray
  file once. **Two exemptions, each exactly one path**: `app/`, which is Next's route tree, and the
  `src/` root, which holds the entrypoints Next places by name beside every folder. It was scoped to
  `features/organization/` from task 126 to task 134 because thirteen directories under `features/`
  and `server/` still mixed, and a gate that starts red inverts *fix the sites first, then turn the
  gate on*; the root moved up when the last site was fixed, not before. Without the spec the rule
  would be asserted in two `CLAUDE.md` files and a skill and checked by nothing, which is this
  repository's own recorded failure shape.

  **The spec lives in `src/test/`, beside the setup file** — a files-only leaf that is nobody's
  feature — because a spec whose subject is the tree cannot sit at a root the rule governs without
  failing on its own placement. `organization/tools/` was its first home and became one folder
  among four the day the root moved.

  **A `vi.mock()` path is a string, so a file move does not typecheck.** `access-board.spec.tsx`
  carried `vi.mock('../actions')` through the move with `pnpm typecheck` and `pnpm lint` both
  clean; it failed only on the run, and it failed as *"This module cannot be imported from a Client
  Component module"* rather than as a missing module — a `'use server'` file reached through a
  stale path. Grep the mocks when you move a spec.

  **And a boundary fixture is a string in a shell script** (task 134, found by `gates:clean` at the
  parent close). `tools/prove-boundaries.sh` proves `client-not-to-server` with an import of
  `'../server/session'`; 134.1 made that a directory with no index, the import stopped resolving,
  the rule matched nothing, and `boundaries:prove` said *"did NOT reject its violation"* — a proof
  switched off by a move, and the one path kind no sub-step run reads. Grep the prove script too.

- **A Suspense fallback may not do I/O. It may await** (11 Sep 2026; task 115 wrote the blunt version
  of this and task 125 corrected it after the project owner pushed back). The mechanism is real: a
  fallback that suspends is resolved against the **parent** boundary, so the shell does wait for it.
  What matters is *what for*. `OverviewLoading` awaits `getTranslations` — a catalogue the request has
  already resolved for the page, the heading and the membership list — which is a microtask, not the
  `GET /periods` round trip its boundary exists to stream past. The first rule here conflated the two
  and cost S-05's route file a translator it did not need.

  **Measured, not reasoned**: `e2e/web/home.spec.ts`'s streaming case reads the served HTML and still finds
  the fallback's markup ahead of the filings with the fallback async. A fallback that reads anything
  over the wire is the real defect — it blocks the shell on exactly the thing the boundary was added
  to stop blocking on — and nothing will tell you, because the boundary still *looks* like it is
  working.

  **Parallel fetching is what *composition* buys, not Suspense.** Sibling async Server Components
  start together — which is what replaced S-05's single `Promise.all` — and a boundary only decides
  what blocks the flush. Adding one where nothing slow sits behind it changes nothing, and **whether
  it does is measurable rather than arguable**: read the served HTML and see whether the fallback is
  in the shell ahead of the content.

  S-05 is the worked example in both directions. Its three region boundaries all have skeletons, and
  exactly **one** streams: the overview's fallback lands at byte 5,862 with its filings at 8,482,
  while the heading's `hgroup` (5,532) and the membership region's heading (6,664) are *inlined* —
  they read memberships, which is React-`cache()`d and awaited by `GlobalTier` **outside any
  boundary** in the `(app)` layout, so the shell cannot flush before their content exists. The inert
  two are kept because UX-90 wants the `loading` state defined and because the global tier may yet
  gain a boundary. **A boundary that buys nothing is not a defect; a boundary silently claiming to
  buy something is.**

  **How to count what streamed, and why the obvious markers do not** (task 126, from the
  gate-integrity review). React SSR writes **`<!--$?-->` per boundary still pending when the shell
  flushes**, so `occurrences('<!--$?-->') === 1` *is* the claim "exactly one region streams" — and it
  is what `e2e/web/home.spec.ts` asserts, proven to bite by making the heading suspend, which took it
  to 2. The two position checks it replaced could not fail on their subjects. One located the
  organization's name and called it the heading; the name's first occurrence is at byte **2,260**,
  which is `GlobalTier`'s organization **plate** in the band — the `h1` is at 5,540, and the check
  would have stayed green with the heading streaming. (That 2,260 was recorded in this file and in
  `build-log.md` as the heading's; it is the band's.) The other compared the membership heading's
  position to the filings' — true whichever way the region renders, since its read resolves before
  `GET /periods` either way. **A position check needs a marker that belongs to the region and to
  nothing else**: `<hgroup` occurs exactly once in this response, and the spec asserts that too so
  the marker cannot quietly acquire a second source.

  **Nothing but a served-HTML assertion can see a boundary being deleted.** Every region renders
  identically once the stream settles, so the suite stays green and the screen simply gets slower —
  `e2e/web/home.spec.ts` reads the positions of the fallback's markup and the filings in the response body.
  Assert on the **markup** (`role="status"`), never on the fallback's label: next-intl ships the
  whole catalogue in the same payload, so the sentence is in the HTML either way, and the first
  draft of that check passed against a build with the boundary removed.

- **Seven route files still hold their read, and that is a recorded deferral, not a rule** (task
  134's parent-close review; task 137). `shell-composes-only` makes a route a shell and its read a
  section's; task 134 gave that shape to the eight routes that also held a second component
  (S-05 and S-03 first, then S-06, S-13's index, S-14's index, S-15, S-16, S-07 and report creation),
  each with a `loading.tsx` where the whole body waits on the read. Still reading in one component:
  `(wizard)/reports/[reportId]` (the redirector), `account/credentials`, `entities/[entityId]`,
  `entities/[entityId]/periods/[periodId]`, `entities/new`, `create-organization` and
  `organization-unavailable`. The owner's scope for 134 was files declaring two components, which
  these do not; they are the next sweep, and until it lands a new route should follow the shells,
  not these. **Every `(identity)` route is a shell since task 157**, which gave the shape to the five
  still translating or branching in `page.tsx` — S-01's registration, sign-in and factor step, and
  S-02's reset request and verification — so this group has no deferral of its own.

- **Never import `next/link` or `next/navigation`'s locale-aware members.** Use
  `@/i18n/navigation`. A raw `next/link` renders a working-looking anchor that drops the locale
  prefix: nothing throws, nothing logs, and it survives review. Lint-enforced.

- **`UNAUTHENTICATED_SEGMENTS` is the auth boundary, it is a list, and since task 26.3 it lives in
  `src/lib/route-access.ts`.** Route groups are invisible in URLs, so `(public)` and `(identity)`
  cannot be detected from the path. The default is closed — anything unnamed requires a session.
  Adding a public screen means adding it there.

  It moved out of `proxy.ts` when a second reader appeared: §4.3's post-sign-in branch needs to know
  which destinations render without an organization, and a route that needs no session needs no
  organization. Copying the list was never an option — one of the two readers is the closed-by-default
  gate, and a drifted copy would either bounce a public screen to sign-in or, in the direction that
  matters, quietly stop bouncing an authenticated one. `lib/` rather than beside the proxy because
  `post-sign-in.ts` deliberately carries no `server-only`.

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

  **When that decision is taken, `loading.tsx` is the file to check first** (recorded 26 Aug 2026,
  review). Next passes it no props, so it cannot call `activateRequestLocale` the way every page
  does — it resolves messages through `requestLocale` alone, which is correct only *because*
  everything is dynamic. Un-force `(identity)` and S-03's loading state silently renders the source
  locale to a Russian reader while the page beneath it renders correctly. Nothing would catch it: a
  loading state is transient, so no browser test asserts one.

  **And a route that can `notFound()` on its data cannot have one at all** (task 134, found by
  `wizard.spec.ts`): a route-level `loading.tsx` flushes the shell with a 200 before the section has
  read anything, so the 404 the stale deep link deserves never reaches the wire. The wizard's step is
  that route; its loading state, when it comes, is a boundary inside the shell below the point where
  the module is known.

- **There is exactly ONE `NextIntlClientProvider`, in `[locale]/layout.tsx`, and it takes no
  props** (task 99, 7 Sep 2026). Rendered from a Server Component it inherits `locale`, `messages`,
  `formats` and `timeZone` from `i18n/request.ts`, so every client component in every route group
  reads the catalogue its request already resolved. **Do not add a second one.** Adding a top-level
  namespace is a catalogue edit and nothing else — no provider to update, and a unit spec that
  mounts its own provider is the only place the subset still has to be named by hand.

  **It replaced fifteen scoped providers, and both reasons matter because the first one is the
  trap.** They were *incorrect*: next-intl treats `messages` as **atomic**, so a nested provider
  replaces rather than merges — and the `(workspace)` layout already passed the whole
  `organization` namespace, so the eight pages beneath it were duplicating a subset of what their
  parent had sent and **narrowing their own subtree**. And they were *unnecessary*: the scoping
  existed to keep the B1–B11 label set out of the bundle, which those labels have not been in since
  **OQ-58** closed by serving them through the API on the wizard's step read. What is actually in
  `src/messages` is 14.4 KB gzipped in `ro`.

  **A `MISSING_MESSAGE` here renders as an empty string, not as a key.** `request.ts`'s
  `getMessageFallback` returns `''` because UX-97 forbids a visible missing-translation marker and
  the key is an internal identifier. So an under-provided namespace is invisible in a screenshot
  and shows up only where a test asserts on visible text — which is why the browser suite is the
  check that matters when anything about messages changes.

  `forms` — `show`, `hide`, `summaryTitle` — is the namespace for strings the **form layer** needs
  that `packages/ui` cannot own (UX-79: it owns no text) and no screen owns either, because every
  screen with a form needs the same words. Before it existed, its three strings were declared per
  feature and reached by borrowing: an alias named `tPolicy` that read no policy, and the workspace
  layout hand-assembling a two-key fragment of `identity.register`. **A layout synthesising part of
  another screen's namespace is the tell** that a string does not live where it belongs.
  `identity.unreachable` is the outstanding case and is *not* a `forms` string — its honest home is
  `chrome`, and moving it is a catalogue change with readers to update.

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

- **`requestLocale` and `setRequestLocale`, not `next/root-params`.** next-intl marks both
  deprecated — the strikethrough in `[locale]/layout.tsx` is expected, not an oversight — but root
  params throw inside a Route Handler (Next E1043) and the module is a compiler-replaced
  placeholder that throws on plain import, breaking unit tests that reach `request.ts`. next-intl
  also states they are unsupported in **Server Actions**, which is how this app reaches the API, so
  Route Handler support alone does not unblock it. Migrate when both are supported. Logged as
  OQ-39 in `architecture.md` §18.

- **Nothing pushes.** Order state, export jobs and the notification unread count all poll (§11.2).
  SSE and WebSockets exist nowhere in §5.4, §10.4 or the edge config; adding one is an amendment
  to those sections, not a ticket.

- **TanStack Query is for client islands, and calling the API directly from one is a security
  bug, not a shortcut.** It is here for the three polls above plus autosave's flush — its first
  live consumer since task 35.2, as the *transport* of one mutation per step and not as the queue
  (§12.1, shared catalog pin with `apps/admin`; the provider is the `[reportId]` layout's). Everything reachable server-side keeps going
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

- **Two `setX` calls in one handler mean one `useReducer`.** The rule is in the root `CLAUDE.md`
  ("State has four homes"); what is local is where it bites here. `features/organization/`'s
  `access-state.ts` is the worked example — S-16's `pendingRowKey`, `notice` and `confirming` were
  three `useState`s that every handler wrote two or three of, and writing the transitions out found
  a stale notice sitting above a row that was still changing. The reducer lives beside the feature
  rather than inside the provider so its transitions are a unit spec; the provider is wiring.

  Two things specific to this app. `dispatch`'s stability matters more here than it would with a
  compiler: `reactCompiler` is off (see the memoization note above), so a `useCallback` with an
  empty dependency list is one fewer list to keep honest. And a Server Action's result reaches the
  reducer as **one event carrying the outcome** — `ACTION_SETTLED` with the notice already built —
  rather than as a branch that dispatches two different actions, which puts the outcome-reading in
  the component where the rest of the wire handling lives.

- **A context is read with React 19's `use(Context)`, not `useContext`** (2 Sep 2026, task 35.2's
  convention review). The composition skill's §4.1 names the replacement, `react` is pinned at 19,
  and the three readers this app had — S-16's, S-28's and the wizard's — all said `useContext`
  until a rule opened against one diff was applied where it holds. Same semantics; one API.

- **A context provider wraps the screen, not one region of it** (29 Aug 2026). `AccessProvider`
  was rendered inside `AccessBoard`, so S-16's invite panel — `AccessBoard`'s sibling — kept its own
  `useState` for the same thing the reducer already held. Two consequences, and the first is
  described verbatim in the comment on the branch that prevents it: a settled invite notice survived
  an unrelated row action starting, and two settled outcomes could show at once. **A provider around
  part of a screen will invite the rest of the screen to keep state of its own**, and the sibling's
  copy is invisible to every test the provider's own region has.

  Where two regions genuinely must render the outcome in different places, put the *place* in the
  state — `NOTICE_REGION` and a `PlacedNotice` — rather than giving each region its own value. One
  value keeps "two outcomes at once" unrepresentable; the region keeps the copy honest, and here it
  had to: the invite refusal reads *"find the person in the list above"*, which is only true
  rendered below the list.

- **A callback that takes both an outcome and what-success-says makes every caller supply a dead
  argument** (29 Aug 2026). S-28's sections were handed `onSettled(outcome, success)`, so each
  imported `API_OUTCOME`, read the discriminator itself, and then passed success copy on branches
  where the outcome was provably a failure — three such call sites in one file. Invert it: the
  section says what to run and what a success *means* (`perform({ section, action, onSuccess })`),
  and the container owns the refusal. No section imports the outcome vocabulary now. The smell is a
  parameter only one branch of the callee reads.

- **A form field is `@easyesg/ui/forms`, not `TextField` + `register`.** Since 24 Aug 2026 the
  bound controls take `control` and `name` and derive the rest: `<FormTextField control={control}
  name="email" label={…} rules={{ required: … }} />`, with `<FormSummary control={control}
  title={…} />` above them. Reaching for the presentational `TextField` in a form means
  reintroducing the five hand-kept pieces the layer removed — the id constant, `id=`, `error=`,
  the `register()` spread and the summary entry — of which the id existed in three copies that a
  rename broke silently. The unbound controls stay exported for what is not a form: a filter box,
  a search input, a read-only display. Two consequences worth knowing: `required` must carry a
  message (the type refuses `required: true`, because a message-less rule renders no text, no
  `aria-invalid` and no summary entry — the form just refuses to submit in silence), and prefer
  **`useWatch({ control, name })` over `watch()`** — one field's subscription, and the API
  `react-hooks/incompatible-library` does not refuse to compile.

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

  **82 files here are Client Components** (14 Sep 2026: thirteen under
  `organization/access/components/` since task 142 split the invite panel into its arms, ten under
  `credentials/components/`, seven under `shared/`, seven under `identity/setup/components/` since
  task 155's S-36, one under `identity/shared/components/` since its second review shared the password field, the rest
  across the wizard's controls and the two record forms' sections and task 67.9's support-access banner's two control sets), so the three
  cases above are live questions in every one of them — `access-context.tsx` is the worked example,
  where `useCallback` and `useMemo` are load-bearing because a rebuilt context value re-renders two
  consumers per row. When this paragraph was written there were seven, all under `identity/`, and
  none had a case; the wizard, autosave's queue and the polls were where it was going to bite. `eslint-plugin-react-hooks` 7.1.1 already runs the compiler's static analysis and
  will tell you when a component is *un*-compilable (`react-hooks/incompatible-library` fires on
  RHF's `watch()` in two forms today) — advisory while the compiler is off, and worth reading as
  the signal it is.

- **A `useTransition` pending flag and the state the transition sets do not commit together, so
  never assert on one right after awaiting the other** (28 Aug 2026, found by CI). `verify.spec.tsx`
  clicked, awaited `findByRole('alert')` — which resolves the moment `setResult` lands — and then
  asserted the button `toBeEnabled()`. React may flip `isPending` in a *later* commit, so that
  assertion sampled the button mid-transition and found it `disabled` with `aria-busy="true"`.
  Asserting on **content** after an await is safe; asserting on anything derived from `pending`
  needs `waitFor`, as `access-board.spec.tsx` already does.

  **What makes this worth a trap entry is how it failed.** It passed six local runs, and it passed
  in the *same CI run* that failed it: `pnpm test` executes in both the hermetic job and the
  `BILLING_ENABLED=false` job, and on one commit the two disagreed — same command, same tree,
  opposite outcomes. A flake that only appears under a scheduler you do not control is invisible to
  every local repetition, so treat a red job whose diff cannot explain it as a timing assertion
  before you go looking for a regression.

- **Children you write for a Client Component that *slots* them cross the RSC boundary as a Flight
  reference, not as an element** (7 Sep 2026). `Slot` introspects its child — `Children.count`,
  `isValidElement`, `cloneElement` — so it meets `$$typeof: Symbol(react.lazy)`, throws *"Slot failed
  to slot onto its children"*, and 500s the route. The root `CLAUDE.md` carries the account; the half
  that is **yours** is the half no gate can see. A selector in `eslint.config.mjs` now stops a
  `packages/ui` primitive being both a slotter and a client boundary, which is why `<Button asChild>`
  and `<TextLink asChild>` are safe from a Server Component. It cannot see the *caller's* side: a
  component that needs `'use client'` for its own state and slots a node you hand it — `AccountMenu`'s
  `items[].node`, wrapped in Radix's `DropdownMenu.Item asChild` — fails the same way if the node is
  written by a Server Component. `account-corner.tsx` is a Client Component and that is load-bearing,
  not incidental.

  **Expect it to lie about where it lives.** It presented as a broken *screen*, on `/entities` and
  `/reports`, while `apps/admin` and every client-side caller were fine — a client → client `asChild`
  never crosses Flight. And it is intermittent in the worst direction: the failing arm renders only
  when the tenant read answers `READY`, so a request whose API call had failed served a clean error
  state and returned 200.

- **`⨯ Error: The destination stream closed early.` (digest `2667547900`) in a gate log is a stream the
  client abandoned, not a render that failed** (13 Sep 2026, measured rather than assumed). React
  raises it: the Flight renderer's `pipe()` — and the HTML renderer's, which Next bundles beside it —
  registers `destination.on('close', …)` with that fixed sentence, and Flight's `abort()` returns at
  once for a render that has already finished, so it is logged only when the HTTP response closes while
  a render still has work. The digest is derived from the error and the message is a constant, which is
  why unrelated screens share **one digest**: an error thrown in this app's code carries its own message
  and a digest of its own. Every request the probe below found pending was a Flight response.

  **Where the browser suite produces it**, each attributed by a probe that listed every request still
  pending when a page was abandoned:

  - **the production router's viewport prefetches.** The workspace tier's links render `/home`,
    `/reports`, `/entities`, `/organization` and `/organization/users` down to their `loading.tsx` as
    they enter the viewport, and a `page.goto` cancels the ones still streaming —
    `post-sign-in.spec.ts`'s turned-away journey logs it at its `goto`s;
  - **a Server Action's response**, which streams the revalidated tree after the client already shows
    the outcome. S-15's save logged it when its test ended with `POST /organization` still pending,
    and not when the same journey let the network settle first;
  - **an action the router abandons on redirect.** S-13's archive posts, redirects to `/entities`,
    and its `POST` shows `net::ERR_ABORTED` in the browser.

  **Intermittent by construction.** A journey aborts dozens of prefetches, and the server logs only the
  few still rendering when the abort lands. None of the three journeys reproduced it run alone;
  `gates:clean` logged three and a second full `identity` run two, in the same journeys. **It predates
  the work that surfaced it**: at `08064b7`, before task 142, a full `identity` run logged it twice, in
  the same two journeys.

  **What would make a line like this a finding**: the same `⨯` with any other message, or this
  message with any other digest — that is a render that threw, which is `Slot`'s shape above, and it
  hides behind a green suite exactly as that one did. Silencing this one (`prefetch={false}` on the
  workspace tier, say) would trade navigation for a quieter log, and is not a decision taken here.

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

The root `CLAUDE.md`'s "Closing a task" says which run a sub-step and a parent each get, and
whichever applies is necessary rather than sufficient: the gates prove the code *runs*, not that it
*belongs here*. Every finding the project owner has raised on
this app and on `apps/admin` was invisible to all sixteen — a screen carrying the wrong idiom, a
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
3. **Load `one-idea-per-file` and `one-kind-per-folder`** whenever the diff adds, splits or moves a
   file under `src/` (task 132) — the first for how each file is cut, the second for where it landed.
   The folder skill holds in every directory under `src/`, and `features/organization/` is the tree
   that meets both.
4. **Re-read this file's traps and the checklist above** against what you actually wrote. They are
   not background reading: each one is a defect that already happened here once.
5. **Re-read the screen's own source** — `design_spec.md` §4.4's `S-nn` row and the artboard in
   `design/screens/` — and check the built screen against it. "I read it before starting" is how
   A-01 shipped without its staged flow; the check is against the finished thing.
6. **Say what you did not apply, and why.** A rule considered and declined with a reason is a
   decision; a rule never opened is an omission wearing the same clothes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
