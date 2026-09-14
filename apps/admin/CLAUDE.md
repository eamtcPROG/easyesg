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

**A-01, the chrome, A-02, A-08, A-19 and A-20.** Route files cover the eighteen scaffolded screens
(`A-01` … `A-18`), A-19 and A-20. **A-02's organization register is live since task 67.3** —
`features/platform/admin/organization-register/`, reading `GET /admin/organizations` through
`AdminRealmGuard` — and **A-08's accounts and system audit log since task 67.4**, in
`features/platform/admin/admin-accounts/`, with **A-20**, the invitation acceptance, in
`realm/components/invitation/`. **A-19, the operator's own credentials, since task 151**, in
`realm/components/credentials/` — both privilege levels, from the account menu — with A-01's
**recovery sign-in** as that screen's third step, landing on A-19. Every other screen behind the realm
still returns `null`. What is live, from task 23: `src/realm/` — the API client, the session
query and the two-step sign-in screen — plus `_realm`'s closed-by-default guard, and a third
Playwright project driving the journey **cross-origin against the built bundle**. **From task 67.1,
the console chrome** on every screen behind the guard: `GlobalBar` in the console's tone naming the
operator's realm, `ConsoleNav` — which renders nothing until a screen behind the realm ships — and
`AccountMenu` holding sign-out. Each privilege level lands on its own home, A-02 or A-10, at
sign-in and at `/`.

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

**The boundary rules resolve `~/*` since task 135, and until then they did not.** That same file
mapped only `@/*` and `@api/*`, so an import written through `~/` resolved to nothing and none of the
four rules below could see it — `export * from '~/features/platform/admin'` inside `realm/` cruised
clean, while fourteen of this app's imports are written that way. `admin-realm-is-a-leaf`'s proof
fixture now violates *through* the alias, so a dropped mapping fails `boundaries:prove` rather than
switching the four rules off.

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
| root | `pnpm boundaries` / `boundaries:prove` | Seven rules govern this app — see below |
| here | `pnpm typecheck` | `tsc --noEmit` |
| here | `pnpm build` | `vite build`. **Needs the environment it is built for** — see the env trap |
| here | `pnpm start:dev` / `start:prod` | Port 3200 both ways; `start:prod` previews `dist/` |
| here | `pnpm test` | Vitest, `--passWithNoTests` |
| root | `pnpm e2e:web` | Includes the `admin` Playwright project, which runs against `vite preview` |

## Where things live

```
src/
├─ app/         entry/ (main.tsx) · providers/ (composition root, the router's two fallbacks) · routes/ ·
│  │            styles/ — and the generated route-tree.gen.ts, the one file the router places beside them
│  └─ routes/   _focus (A-01, A-20) · _realm (everything behind the guard) — both pathless
├─ realm/       api/ (the one API client) · components/ (sign-in/ A-01's screen · invitation/ A-20's ·
│               credentials/ A-19's · chrome/ the realm layout's chrome · shared/ the realm chip, the
│               refusal callout and the password requirements) · queries/ (the session, the invitation,
│               A-19's credentials) · tools/ (the three reducers, each role's home, the navigation's
│               sections, the two arrival notices, the realm reads' arms, A-19's read and code standing,
│               the email shape). A LEAF (see below)
├─ features/    15 folders, platform/ and billing/, mirroring apps/api's contexts — one index.ts each until
│               built; platform/admin/ holds organization-register/ (A-02, task 67.3) and admin-accounts/
│               (A-08, task 67.4)
├─ shared/      what BOTH contexts need — index-view.tsx, the Index archetype's chrome bound once. A LEAF
├─ i18n/        use-intl wiring, the console locale, formats, the expansion harness, global.d.ts
├─ lib/         env (build-time only) and vite-env.d.ts beside it, pagination
├─ messages/    ro.json — one catalogue, by decision
└─ test/        the setup file, and folder-shape.spec.ts — the folder invariant's failing state
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
  unauthenticated surface — there are three, and all are deliberate: `_focus/sign-in`, `index`, and since
  task 67.4 `_focus/invitation.$token` (A-20), whose visitor holds no session and cannot — the link's
  token is the capability, and the api judges it on every call, spending a per-IP window on each
  link that does not resolve.

  **The redirect is validated where it is consumed, not where it is set.** `_realm`'s guard puts
  `location.href` in the search param; `_focus/sign-in.tsx`'s `safeRealmPath` is what refuses
  anything that is not a same-app path — leading `/`, but not `//` and not `/\`, the two forms a
  browser reads as an origin. An open redirect on the console's sign-in is worth more to an
  attacker than on any tenant screen, and the check is three lines away from the navigation it
  guards precisely so a reader of that navigation meets it.

- **This chrome has no organization selector, and must not grow one.** D-5 gives a Platform
  Administrator no standing access to organization data. A selector here would be that standing
  access arriving as a convenience.

- **The console nav is presentation, never the boundary** (task 67.1). It shows an operator their
  own realm's section, and only destinations whose screen renders — `realm/tools/console-sections.ts`
  holds both rules and the destination table, which holds A-02 and A-08 for a Platform Administrator. A hidden link refuses nothing:
  `AdminRealmGuard` (task 67.3) is what stops a Billing Operator reaching A-02 by typing its
  address. **A screen that ships adds its destination in the same change**, with its label under
  `realm.chrome.destinations` — the table's type will not accept a key the catalogue lacks. **A-19 is
  the one screen that does not**, by decision (project owner, 14 Sep 2026, task 151): it is the
  operator's own and belongs to neither realm's section, so it is the account menu's first item.

- **`defaultPreload: 'intent'` is safe here and is not in the tenant app.** Every admin route is
  already behind the realm guard; preloading a tenant route can warm data the viewer may lose
  rights to. Do not copy the setting in the other direction.

- **A library default is user-facing text nobody wrote.** Unset, TanStack Router renders its own
  hardcoded English "Not Found" — which the JSXText ban structurally cannot catch, because the
  literal is in `node_modules`. `app/providers/`'s two fallbacks exist for that; the same applies to any
  library you introduce that renders words.

- **The token cascade is `packages/ui`'s and this app defines none.** §12 is "same tokens, same
  primitives, deliberately different composition". A second token file here is what UX-127 calls a
  defect. Tailwind loads first, tokens after, so the token layer wins a collision.

  **Compact density is `packages/ui`'s, and since task 67.2 it has steps.** `[data-density="compact"]`
  is declared on `<html>`, and `tokens.css` redefines space steps 4 through 8 under that selector
  (architecture.md OQ-44). This bullet called it an assumption with nothing behind it until task
  67.1 found it stale, along with the `globals.css` comment that said the same.

- **Nothing pushes.** Every queue, migration run and exception list polls (§11.2); `refetchInterval`
  is the shape of every screen in `features/`. `staleTime: 0` is deliberate — an admin read is
  operator-driven and cross-tenant, so a stale queue is a wrong decision rather than a slow one.
  Retry is capped at 2 against §12.5.6's rate budget.

- **The folder rules bind this app, and it meets them since task 135** (the `one-kind-per-folder`
  skill; the owner scoped it to *web and admin* in task 132). Three sites mixed until then:
  `realm/` held `api-client.ts`, `session.ts` and an empty barrel beside `components/`, and now
  holds `api/ · components/ · queries/ · tools/`; `app/` held `providers.tsx` and `route-fallbacks.tsx`
  beside `routes/` and `styles/`, and they are `app/providers/` now, the fallbacks one component per
  file; the `src/` root held `main.tsx` and two declaration files beside every folder, and holds only
  folders now (`app/entry/main.tsx`, `i18n/global.d.ts`, `lib/vite-env.d.ts`); and the fifteen unbuilt feature
  scaffolds lost their five `.gitkeep` folders each and keep one `index.ts` — four of those barrels
  are what `prove-boundaries.sh`'s admin fixtures import, so they go only when a fixture is
  repointed. A built feature here takes the tenant app's three kinds with the wire half named for
  how data arrives: `components/` renders, `tools/` is pure, **`queries/`** holds the TanStack Query
  definitions where `apps/web` has `actions/`.

  **It has a failing state**: `src/test/folder-shape.spec.ts` walks every directory under `src/`
  and names the offender. **Two exemptions, both the router's and each listed rather than
  patterned**: `app/routes/`, which is TanStack's file tree (`_realm.tsx` beside `_realm/` *is* how
  it spells a pathless layout) and is not entered, and `route-tree.gen.ts`, the one file the router
  generates beside `app/`'s folders. **The root is not exempt**: nothing places `main.tsx` there but
  `index.html`, which this project wrote. Proven to bite by a stray file at the root, in `realm/` and
  in `app/`, and by a folder added to a scaffold — and not to fire on a file inside `app/routes/`.

- **Nothing here is memoized, and no compiler is doing it for you.** `reactCompiler` is off across
  the repo with a recorded reason (AD-9). This app is ~33 Client Components with **no server tier to
  absorb a render**, which is where the `vercel-react-best-practices` skill's `rerender-` and
  `client-` categories land — the same skill whose `server-` and `async-` categories are the tenant
  app's half. Both apps are in its scope; the root `CLAUDE.md` says so since 24 Aug 2026.

## Before you call it done

The root `CLAUDE.md`'s "Closing a task" says which run applies — a sub-step gets only the gates its
change reaches, the parent gets the gate set, cold where the diff calls for it (the root file's
*"When `gates:clean` is the required run"*). Everything in `apps/web/CLAUDE.md`'s "Before you call it
done" applies here too — load `vercel-react-best-practices` and read the diff against it, load
`vercel-composition-patterns` when a component API grows, load `one-idea-per-file` and
`one-kind-per-folder` whenever a file is added, split or moved under `src/`, re-read these traps against what you
wrote, check the screen against its `A-nn` row in `design_spec.md` §5.2 and its artboard in
`design/screens/EasyESG Admin Console Screens.dc.html`, and say what you did not apply and why.

Two checks this app needs that the tenant app does not:

- **Romanian is formal — UX-135, "every surface, without exception".** *Dumneavoastră*, no
  exceptions, and this console is where that rule was found violated wholesale. A new string in
  `ro.json` is the moment to check.
- **The e2e project runs against the built bundle, cross-origin.** `pnpm e2e:web` includes it. A
  change that works under `start:dev` and not under `vite preview` is a build-time/runtime
  difference, and this app has one class of those by construction: `VITE_*` inlining.
