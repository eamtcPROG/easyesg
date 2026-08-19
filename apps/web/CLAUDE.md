# apps/web — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below, and `docs/design_spec.md` for
every screen. Cite them; do not re-derive them.

## Current state

Scaffold only. What exists: 36 route files across four route groups, 6 layouts, 2 route handlers,
the next-intl wiring, 10 feature folders, and 5 boundary rules with fixtures proving each rejects
a real violation.

**Not built, and do not assume otherwise:** every page returns `null`. No component, no data
fetch, no session. `src/server/api-client.ts` and `src/server/session.ts` are docblocks over an
empty export. `src/app/api/[...path]/route.ts` answers 501 to everything. `packages/ui` exports
nothing but the token cascade, so there is no button yet.

**The message catalogues are wired and empty.** `src/messages/{ro,en,ru}.json` declare the
`chrome`, `validation` and `notification` namespaces and hold no copy yet; `src/server/messages.ts`
loads them through the `MessageLoader` port. Adding a string is a JSON edit — and adding it to
`ro.json` alone fails `src/messages/messages.parity.spec.ts`, which is what replaces FR-64's
runtime queue now that every locale is present at build time (architecture.md OQ-43). The
scaffold-only `emptyCatalogueWhileUnbuilt` shim is deleted.

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
├─ i18n/           next-intl: routing · navigation · request · formats
├─ app/            routes only, thin. No logic, no data access
├─ features/       10 domains, mirroring apps/api/src/modules names
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

- **Never import `next/link` or `next/navigation`'s locale-aware members.** Use
  `@/i18n/navigation`. A raw `next/link` renders a working-looking anchor that drops the locale
  prefix: nothing throws, nothing logs, and it survives review. Lint-enforced.

- **`UNAUTHENTICATED_SEGMENTS` in `proxy.ts` is the auth boundary, and it is a list.** Route
  groups are invisible in URLs, so `(public)` and `(identity)` cannot be detected from the path.
  The default is closed — anything unnamed requires a session. Adding a public screen means
  adding it there.

- **The active organization never appears in a URL.** UX-2, and it is a security property, not a
  style: a second source of tenancy turns an org-switch race or a revoked membership into a
  cross-tenant read (AD-2). Language is the opposite case and *is* in the URL — do not
  generalise from one to the other.

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

## Before you add a screen

- It has an `S-nn` in `design_spec.md` §4.4, or it is one of the public/legal/help surfaces that
  deliberately has none — which is itself an open question, not a licence to invent an id.
- It is an instance of one of the nine archetypes (§4.6). A screen that fits none is an
  escalation to design review.
- All eleven §8.1 states are designed before implementation. An undefined state is a defect, not
  an omission (UX-90).
- Every string is a message key. Every error states what failed, the consequence, and the action
  that resolves it (NFR-79) — the "what now" slot is required, not optional.
- No internal identifier reaches the screen: no `FR-`/`UC-`/`S-`, no enum member, no taxonomy
  element key, no problem-type slug.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
