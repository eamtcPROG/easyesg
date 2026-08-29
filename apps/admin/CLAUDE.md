# apps/admin — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the closed-vocabulary
rule, the timestamp and user-facing-text conventions, and **"A rule is applied where it holds, not
where it was found"**, which this file exists partly because of. Sibling notes for the tenant app
live in `apps/web/CLAUDE.md`; where a rule there is about `Callout`, `ApiOutcome`, catalogue copy or
`packages/ui`, it is a rule here too.

`docs/architecture.md` is authoritative for every decision below, and `docs/design_spec.md` §5.2 and
§12 for the console's screens.

**Written 29 Aug 2026, and the delay is the point.** `apps/web` has had scoped notes since task 20;
this app had none, and `src/i18n/index.ts` was already citing this file by name before it existed.
Two reviews scoped themselves to `apps/web` because that is where the scoped guidance was, and both
left the console behind: the `action={null}` refusal rule reached five screens and not the sixth
here, and UX-135's formal Romanian reached seven `identity` namespaces and none of `realm`, so the
console addressed operators as *tu* on every screen it has. Neither was a hard question. Both were
invisible because nothing in this directory said the rules applied.

## Current state

**A-01 only.** 26 route files cover all eighteen screens (`A-01` … `A-18`) and every one behind the
realm still returns `null`. What is live, from task 23: `src/realm/` — the API client, the session
query, the two-step sign-in screen and the interim strip — plus `_realm`'s closed-by-default guard,
and a third Playwright project driving the journey **cross-origin against the built bundle**.

`src/features/` holds fifteen folders split `platform/` and `billing/`. There is no `features/core/`
and that absence **is** D-5: a Platform Administrator has no standing access to any organization's
report data, so there is no module here for it to live in. The only path is A-07's time-boxed grant.

## This is not `apps/web`

Same design system, same contracts package, same closed vocabularies — different everything else.
The differences that change what you write:

| | `apps/web` | here |
| --- | --- | --- |
| Runtime | Next.js, server tier | **Vite SPA, no server tier** — nothing in `vite.config.ts` may grow one |
| Router | file routes + `proxy.ts` | TanStack Router, `beforeLoad` guards, generated `route-tree.gen.ts` |
| Data | Server Actions through a server seam | **TanStack Query everywhere**, straight to the API, cross-origin |
| Styling | CSS modules | **Tailwind** (`src/app/styles/globals.css`), over the same tier 1/2/3 tokens |
| i18n | `next-intl` | **`use-intl`** — the same core at the same pin, so one ICU dialect |
| Locales | RO / EN / RU | **Romanian only** (architecture.md OQ-42, closed 19 Aug 2026) |
| Path alias | `@/` | **`~/`** |
| Session | sealed cookie this app writes | sealed cookie **the API writes**; this app never holds a token |

**`~`, not `@`, and it is not a preference.** `tsconfig.boundaries.json` maps `@/*` to
`apps/web/src`, and a TS `paths` key holds one meaning — sharing it would resolve admin's
`~/lib/env` to web's `lib/env` (both exist) and fire the cross-app boundary rules on the wrong file.

**Romanian-only is a decision about catalogues, not permission to write a sentence in a `.tsx`.**
Every string a person reads is still a message key in `src/messages/ro.json`; the JSXText lint rule
enforces it here exactly as it does in the tenant app. `LOCALES` is still exported for A-03, where an
operator authors all three locales — reading the registry while rendering one of its members is
deliberate.

## Commands

Run lint and boundary checks from the **repo root**; they are workspace-wide.

| From | Command | Notes |
| --- | --- | --- |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script |
| root | `pnpm boundaries` / `boundaries:prove` | Four rules govern this app — see below |
| here | `pnpm typecheck` | `tsc --noEmit` |
| here | `pnpm build` | `vite build`. **Needs the environment it is built for** — see the env trap |
| here | `pnpm start:dev` / `start:prod` | Port 3200 both ways; `start:prod` previews `dist/` |
| here | `pnpm test` | Vitest, `--passWithNoTests` |
| root | `pnpm e2e:web` | Includes the `admin` Playwright project, which runs against `vite preview` |

## Where things live

```
src/
├─ app/         composition root, routes, generated route tree, fallbacks, styles
│  └─ routes/   _focus (A-01) · _realm (everything behind the guard) — both pathless
├─ realm/       session, API client, guards, A-01's screen. A LEAF (see below)
├─ features/    15 folders, platform/ and billing/, mirroring apps/api's contexts
├─ shared/      what BOTH contexts need. A LEAF
├─ i18n/        use-intl wiring, the console locale, formats, the expansion harness
├─ lib/         env (build-time only), pagination
└─ messages/    ro.json — one catalogue, by decision
```

**Four boundary rules, all enforced and all proved:**

- `admin-realm-is-a-leaf` — `realm/` must not import `features/**`. It is what every feature
  depends on; a reference back makes whatever it reached for a transitive dependency of both
  bounded contexts at once. The mirror of `contracts-is-a-leaf` in `apps/api`.
- `admin-shared-is-a-leaf` — same reasoning, and the sharper case: `shared/` importing a feature
  becomes a laundered path from billing to platform that the next two rules cannot see.
- `admin-platform-not-to-billing` and `admin-billing-not-to-platform` — DR-1/AD-1's context
  separation, in the front end. With `BILLING_ENABLED=false` the platform screens must still work.

## The traps

- **There is no server tier, and that is why AD-12 exists.** The session is a sealed httpOnly cookie
  **the API sets and rotates**; browser JavaScript never holds a token, and there is no
  `Authorization` header anywhere in this app. `credentials: 'include'` on every request is what
  carries it. If you find yourself wanting a token in `localStorage`, the answer is that the design
  already refused that question.

- **Development is cross-origin on purpose — do not add `server.proxy`.** Production is
  `admin.<host>` calling `api.<host>`; a dev proxy would make development same-origin and hide the
  CSRF/`SameSite` question until staging. The API's CORS is pinned to `ADMIN_ORIGIN` with
  credentials, and it proves `Origin` on realm writes. A local run needs the API configured for
  *this* origin, which is why the Playwright project sets `ADMIN_ORIGIN` explicitly.

- **`VITE_*` is inlined at build time, so the bundle is an artefact of one environment.** A build
  made against staging **cannot be promoted** to production; the API base URL is baked in. And no
  secret may ever be read through `lib/env.ts` — the bundle is public the moment it is built, and
  the IP allowlist in front of `admin.<host>` restricts who fetches it, not what it contains.

- **The guard is `beforeLoad` and closed by default.** Every route under `_realm` resolves the
  session probe before rendering, and an unauthenticated arrival is redirected to A-01 with
  `?redirect=` carrying the destination. Adding a route outside `_realm` is adding an
  unauthenticated surface — there are two, and both are deliberate: `_focus/sign-in` and `index`.

  **The redirect is validated where it is consumed, not where it is set.** `_realm`'s guard puts
  `location.href` in the search param; `_focus/sign-in.tsx`'s `safeRealmPath` is what refuses
  anything that is not a same-app path — leading `/`, but not `//` and not `/\`, the two forms a
  browser reads as an origin. An open redirect on the console's sign-in is worth more to an
  attacker than on any tenant screen, and the check is three lines away from the navigation it
  guards precisely so a reader of that navigation meets it.

- **This chrome has no organization selector, and must not grow one.** D-5 gives a Platform
  Administrator no standing access to organization data. A selector here would be that standing
  access arriving as a convenience.

- **`defaultPreload: 'intent'` is safe here and is not in the tenant app.** Every admin route is
  already behind the realm guard; preloading a tenant route can warm data the viewer may lose
  rights to. Do not copy the setting in the other direction.

- **A library default is user-facing text nobody wrote.** Unset, TanStack Router renders its own
  hardcoded English "Not Found" — which the JSXText ban structurally cannot catch, because the
  literal is in `node_modules`. `route-fallbacks.tsx` exists for that; the same applies to any
  library you introduce that renders words.

- **The token cascade is `packages/ui`'s and this app defines none.** §12 is "same tokens, same
  primitives, deliberately different composition". A second token file here is what UX-127 calls a
  defect. Tailwind loads first, tokens after, so the token layer wins a collision.

  **Compact density is a recorded assumption, not a feature.** `[data-density="compact"]` is
  declared on `<html>` so the contract is fixed, and `packages/ui` has no compact steps behind it
  yet — so the console currently renders at the tenant scale. That is a stated divergence from §12,
  and the steps belong in `packages/ui` when they come.

- **Nothing pushes.** Every queue, migration run and exception list polls (§11.2); `refetchInterval`
  is the shape of every screen in `features/`. `staleTime: 0` is deliberate — an admin read is
  operator-driven and cross-tenant, so a stale queue is a wrong decision rather than a slow one.
  Retry is capped at 2 against §12.5.6's rate budget.

- **Nothing here is memoized, and no compiler is doing it for you.** `reactCompiler` is off across
  the repo with a recorded reason (AD-9). This app is ~33 Client Components with **no server tier to
  absorb a render**, which is where the `vercel-react-best-practices` skill's `rerender-` and
  `client-` categories land — the same skill whose `server-` and `async-` categories are the tenant
  app's half. Both apps are in its scope; the root `CLAUDE.md` says so since 24 Aug 2026.

## Before you call it done

The root `CLAUDE.md` requires `pnpm gates`. Everything in `apps/web/CLAUDE.md`'s "Before you call it
done" applies here too — load `vercel-react-best-practices` and read the diff against it, load
`vercel-composition-patterns` when a component API grows, re-read these traps against what you
wrote, check the screen against its `A-nn` row in `design_spec.md` §5.2 and its artboard in
`design/screens/EasyESG Admin Console Screens.dc.html`, and say what you did not apply and why.

Two checks this app needs that the tenant app does not:

- **Romanian is formal — UX-135, "every surface, without exception".** *Dumneavoastră*, no
  exceptions, and this console is where that rule was found violated wholesale. A new string in
  `ro.json` is the moment to check.
- **The e2e project runs against the built bundle, cross-origin.** `pnpm e2e:web` includes it. A
  change that works under `start:dev` and not under `vite preview` is a build-time/runtime
  difference, and this app has one class of those by construction: `VITE_*` inlining.
