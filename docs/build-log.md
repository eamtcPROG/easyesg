# Build log

The record of completed work: per task, what was done, the decisions taken, the deviations
from the plan, and how each was verified.

Deliberately separate from [task.md](task.md), which is the forward-looking plan and carries
only a status per task. Three layers, narrowing:

- **`task.md`** — what is left, in what order, and what each task must deliver.
- **This file** — why a completed task ended up shaped the way it did.
- **Commit messages** — the exhaustive version, tied to the actual diff.

Genuinely architectural decisions do not live here: they go into the owning document's
register (`architecture.md` and its OQ rows first), and an entry here links to that rather
than restating it. An entry is written when a task closes, not reconstructed later.

---

## Task 1 — Specification set · 2026-08-18

Commits `ee7a4e7`, `05174aa`, `cb877b4`, `bb14b0b`, `0371292` (plus the CLAUDE.md
operating-rules commits `52f755f`, `d939b88`, `e75cf6e`, `bac2d56`, `4b37f9d`).

The seven-document set landed complete with its identifier registers, and `05174aa` resolved
51 open questions in a single ratification pass. Closed separately, because each needed its
own evidence: `design_spec` OQ-2 (the UX-73 grid geometry, `cb877b4`) and the webhook rate
budget + per-report-rights derivation (`bb14b0b`).

Decisions worth flagging for later tasks:

- **Two amendments are followed but unratified**: three separately-authored locales
  (RO/EN/RU) and WCAG 2.2 AA. The registers still read RO/EN (FR-63, NFR-23) and 2.1 AA
  (NFR-75); the discrepancy is tracked as `design_spec` OQ-1 and `architecture` OQ-3 and
  binds every UI task until the registers are amended.
- **Two conventions were promoted to normative in `0371292`** because they are cheap on day
  one and expensive later: instants are epoch-millisecond integers while legal dates stay
  calendar dates + originating timezone (NFR-34), and no user-facing text may carry an
  internal identifier (NFR-79 owns the required message shape). Task 9's schema and task
  20's error bodies are the first places these bite.

## Task 2 — Monorepo bootstrap and gates · 2026-08-18

Workspace shape landed inside `14bbf25` (with the api scaffold); toolchain pins in
`b64cb26`/`a247195`.

- **Node 26.7.0 pinned ten weeks ahead of its LTS date** — a recorded, time-boxed exception
  to the LTS-only rule, taken because v24 enters Maintenance on 20 Oct 2026 and v26 is
  supported a year longer. The exception closes by the calendar (28 Oct 2026), not by a
  migration; the four holding controls are `architecture.md` §12.6. `engineStrict` turns the
  version rule into a hard install failure while it runs.
- **`strictDepBuilds` surfaced exactly the class of decision it exists for**: three packages
  wanted install scripts. `msgpackr-extract` and `unrs-resolver` are real native builds —
  allowed; `@scarf/scarf` is TypeORM's install-time analytics beacon — denied. Each verdict
  is recorded next to its `allowBuilds` entry in `pnpm-workspace.yaml`.
- **pnpm is 11.22.0, not 11.21.0**: 11.21.0 could not verify its own darwin-x64 binary
  against the lockfile and failed every command, including the install that would have
  written the lockfile. The pin moved; `pmOnFail: ignore` was not reached for, since it would
  silence the enforcement the pin exists to provide.
- The gate set is deliberately CI-shaped before CI exists: the eight root scripts *are* the
  gate until task 14 wires them into `infra/ci`.

## Task 3 — API application scaffold · 2026-08-18

Commits `14bbf25`, `d52a30e`.

35 modules registered and empty, split by bounded context so the DR-1 boundary exists before
any behaviour does. The request edge is complete even though nothing is behind it: one
interceptor shapes every success into the envelope, one filter shapes every error into
problem+json — the iftamaster pattern, adopted so no later controller invents its own shape.
`openapi:check` diffs an emitted `v1.json` with **zero paths**: the contract gate predates
the first endpoint on purpose, so the first path added is already a reviewed contract change.

`d52a30e` added the piece that makes the boundary rules trustworthy: **a fixture per rule**
(`boundaries:prove`, 20 rules). dependency-cruiser resolves workspace symlinks to real store
paths, so a rule that silently matches nothing looks identical to a rule that passes — each
fixture proves its rule still rejects a real violation.

## Task 4 — Web application scaffold · 2026-08-18

Commit `805aabe`. 36 route files across four route groups, next-intl wiring, and the session
proxy — placed now because it fixes DR-11's shape early: the web app is an ordinary client of
the public API, and the proxy is the only place a browser credential is exchanged. Every page
returns `null`; `routes:check` holds the tree against the design_spec screen inventory.

## Task 5 — Admin application scaffold · 2026-08-19

Commit `06c45d7`. 26 route files covering all 18 admin screens (A-01…A-18), two pathless
layouts, TanStack Router + Query, 15 feature folders split platform/billing. **`features/core`
does not exist, and that absence is D-5** — recorded here so nobody "completes" the layout by
adding it. The `[data-density="compact"]` hook is declared on `<html>` with deliberately no
token values behind it: the density steps belong in `packages/ui` and are open as
`architecture.md` OQ-44 (task 40's stated blocker).

## Task 6 — i18n wiring · 2026-08-19

Commit `171af9b`. `packages/i18n` wired across all three apps: locale registry,
message-loader port, fallback reporter, and the +40% expansion harness (a Phase 0 obligation
from §15.4 — retrofitting it after twenty screens finds the same bug twenty times). The
OQ-43 narrowing governs the shape: catalogues ship in the release; only store-edited copy
(help-centre articles, plan presentation) will live in the config store. Romanian is the
source locale; the other two are separately authored, never machine-translated.

## Task 7 — Dev Compose stack · 2026-08-19

Commit `bfbeabd`. PostgreSQL 18 and Redis as Compose services, plus the database roles RLS
will need — created now so task 10's policies are written against the real role split rather
than a superuser connection that RLS silently exempts. The stack *is* the dev environment
(§12.5.10): clients are reached through the containers, and Compose resolves `.env` and the
init mount against `infra/compose/`, which is why `pnpm dev:up`/`dev:down` pass `-f` and work
from anywhere while a bare `docker compose` from the repo root does not.

## Task 8 — Auth and UI dependency pins · 2026-08-19

Commit `fe0ed9d`. The auth stack (Argon2id, passport) and UI primitives (Radix, Lucide)
pinned through the catalog ahead of tasks 15–16 and the first real screens, each §12 row
carrying its version and verification date so the quarterly review (NFR-12) knows how old
the check is.

---

## Plan revision — tasks 9–43 re-sliced into 9–73 · 2026-08-19

Before any TODO task was started, the plan was cut finer: the 35 remaining tasks became 65,
and a **Scope** column now names the workspaces each touches. The slicing rule: vertical
slices in build order, with a feature's API task immediately before its screen task, and
front+back combined only where splitting would produce fragments (social sign-in, TOTP,
invitations). Splitting by application was considered and rejected — §15.4's order is
feature-driven, and an all-api-then-all-web grouping would leave nothing verifiable
end-to-end until two distant halves met.

Task numbers 1–8 did not move, so every citation in this file stays valid; the renumbering
touched only tasks nothing had cited yet.

---

*Next up: task 9 — migration runner and datasource. Its unknowns should be batched before
its first file is written.*
