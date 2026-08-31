#!/usr/bin/env bash
#
# The inner-loop gate runner: everything `pnpm gates` proves about the code you actually changed.
#
# **This is not a replacement for `pnpm gates:clean`**, which stays the rule before pushing, and CI
# still runs the whole set. It is the run you make twenty times a day, and the design question is
# which gates can be skipped without the skip being a guess.
#
# **Scoping is by the dependency graph, never by "which app did I edit"** (31 Aug 2026). The obvious
# rule — api change, run api tests — is wrong in this repository, and task 31.3 is the worked
# example: an api task regenerated `packages/contracts` and edited `packages/i18n`, both of which
# `apps/web` and `apps/admin` consume, so an api-scoped run would have skipped exactly the gates
# that could have caught a break. That is the `packages/i18n/dist` incident's shape, one layer up.
# `pnpm --filter "...[<base>]"` selects changed packages AND their dependents, which gets right what
# the hand-rolled rule gets wrong — verified against that commit, where it pulls in web and admin.
#
# Three gates always run whole-repo regardless of selection, because they are cheap and they are
# precisely what catches a cross-workspace break: typecheck (15 s) — "api moved the contract, web no
# longer compiles" — boundaries (5 s, below, because it builds) and lint (~5 s cached).
#
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# ── The base ref ─────────────────────────────────────────────────────────────────────────────────
#
# The merge-base with `origin/dev` rather than HEAD~1, so a task spanning several commits is scoped
# as one thing. Under-selecting is the failure this file exists to avoid, and HEAD~1 mid-task is the
# easiest way to do it.
BASE="${1:-}"
if [ -z "$BASE" ]; then
  if git rev-parse --verify --quiet origin/dev >/dev/null 2>&1; then
    BASE="$(git merge-base HEAD origin/dev)"
  else
    BASE="$(git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD)"
  fi
fi
printf '\033[1mScoped gates\033[0m — against %s\n' "$(git rev-parse --short "$BASE")"

# ── What changed, and what depends on it ─────────────────────────────────────────────────────────
#
# Read from pnpm rather than reimplemented: it hashes file CONTENT, so an uncommitted edit counts
# and a bare `touch` correctly does not.
SELECTED="$(pnpm -r --filter "...[$BASE]" exec pwd 2>/dev/null \
  | sed "s|^${ROOT}||" | grep -v '^[[:space:]]*$' || true)"
selected() { printf '%s\n' "$SELECTED" | grep -qx -- "$1"; }

if [ -z "$SELECTED" ]; then
  echo "No workspace changed. Running the always-on gates only."
else
  printf 'Affected (changed + dependents):%s\n' "$(printf '%s' "$SELECTED" | tr '\n' ' ')"
fi

# `.dependency-cruiser.cjs` and the fixture script are `boundaries:prove`'s only inputs, and it costs
# 90 s — 15% of a full run — to prove 23 rules still REJECT a violation. It belongs to those files
# and to the pre-push run, not to every task.
RULES_CHANGED=0
if ! git diff --quiet "$BASE" -- .dependency-cruiser.cjs tools/prove-boundaries.sh 2>/dev/null \
   || [ -n "$(git status --porcelain -- .dependency-cruiser.cjs tools/prove-boundaries.sh)" ]; then
  RULES_CHANGED=1
fi

LOGS="$(mktemp -d)"
trap 'rm -rf "$LOGS"' EXIT

# Each phase records its own exit code in a file. A subshell cannot append to the parent's array,
# and a parallel group that silently loses a failure is worse than no parallel group at all.
run() { # run <label> <command...>
  local label="$1"; shift
  local start; start=$(date +%s)
  local code=0
  "$@" >"$LOGS/$label.log" 2>&1 || code=$?
  echo "$code" >"$LOGS/$label.code"
  if [ "$code" -eq 0 ]; then
    printf '  \033[32m✓\033[0m %-18s %ss\n' "$label" "$(( $(date +%s) - start ))"
  else
    printf '  \033[31m✗\033[0m %-18s %ss\n' "$label" "$(( $(date +%s) - start ))"
  fi
}

# ── Group 1: the three that build nothing, in parallel ───────────────────────────────────────────
#
# **Only these three.** `pnpm test` is deliberately not here: `apps/api`'s `pretest` rebuilds
# `@easyesg/i18n` and `@easyesg/validation`, and running that concurrently with a typecheck
# resolving those same `dist/` directories is a read-during-write race. This repository has already
# lost a day to shared `dist` state between gates (20 Aug 2026); the parallel win is not worth
# reintroducing that hazard with the timing inverted. `boundaries:prove` is excluded for a harder
# reason: it *writes fixture files into the working tree*, so it can never run beside a linter.
#
# **`boundaries` left the parallel group on 31 Aug 2026**, the same day it joined: running it first
# exposed that it needs `@easyesg/i18n`'s `dist/` to resolve the workspace package, which until then
# only `pnpm test` had built — a hidden ordering dependency present in CI as well, where `test` runs
# two steps ahead of it. The fix is a `preboundaries` hook, per the root rule; the consequence is
# that `boundaries` now *builds*, so it belongs with the sequential group rather than beside a
# typecheck.
echo
echo "Hermetic (parallel):"
for phase in lint typecheck; do run "$phase" pnpm "$phase" & done
wait

# ── Group 2: everything that shares the database or a build output, in order ─────────────────────
# **Label and command in two parallel arrays, not one `label:command` string.** The first version
# split on `:` and every phase whose name contains one — `openapi:check`, `routes:check`, `e2e:web`,
# `e2e:worker`, `boundaries:prove` — ran as the garbage after the colon, while `e2e` and `e2e:web`
# collided on one log file. It failed loudly, which is the only reason it was cheap.
LABELS=(); COMMANDS=()
phase() { LABELS+=("$1"); COMMANDS+=("$2"); }

phase boundaries "pnpm boundaries"

[ -n "$SELECTED" ] && phase units "pnpm -r --filter '...[$BASE]' test"
if selected /apps/api; then
  phase openapi-check "pnpm openapi:check"
  phase routes-check "pnpm routes:check"
  phase migrations "pnpm migrations:check"
  phase e2e-api "pnpm e2e"
  phase e2e-worker "pnpm e2e:worker"
fi
# The browser suite is 200 s and splits into three Playwright projects. `identity` and `expansion`
# drive the tenant web app, `admin` drives the console — so a change confined to one front end pays
# for one of them, not all three. `packages/ui` reaches both, and the filter says so on its own.
BROWSER_PROJECTS=()
selected /apps/web && BROWSER_PROJECTS+=(--project identity --project expansion)
selected /apps/admin && BROWSER_PROJECTS+=(--project admin)
[ ${#BROWSER_PROJECTS[@]} -gt 0 ] && phase e2e-web "pnpm e2e:web ${BROWSER_PROJECTS[*]}"
[ "$RULES_CHANGED" -eq 1 ] && phase boundaries-prove "pnpm boundaries:prove"

if [ ${#LABELS[@]} -gt 0 ]; then
  echo
  echo "Scoped (sequential — shared database and build outputs):"
  for i in "${!LABELS[@]}"; do
    run "${LABELS[$i]}" bash -c "${COMMANDS[$i]}"
  done
fi

# ── The report ───────────────────────────────────────────────────────────────────────────────────
FAILED=()
for code_file in "$LOGS"/*.code; do
  [ -e "$code_file" ] || continue
  if [ "$(cat "$code_file")" != "0" ]; then
    FAILED+=("$(basename "$code_file" .code)")
  fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  printf '\033[32mScoped gates passed.\033[0m Run `pnpm gates:clean` before pushing — this run\n'
  printf 'deliberately skipped what your change cannot reach, and only the full one can say so.\n'

  # ── Which model the review agents should run on ────────────────────────────────────────────────
  #
  # Decided from the DIFF, before any agent runs, because **the cheap model's miss is silent**:
  # measured 31 Aug 2026, Sonnet returned a clean, confident report on the convention fixture and had
  # found half of one hunk — no hedge, no short count, nothing to escalate on. So there is no
  # "escalate if needed"; there is only routing decided in advance.
  #
  # The proxy is what Sonnet measurably misses — findings that connect a rule in one file to a
  # convention in another. Breadth and the tenancy/privilege surface stand in for that.
  #
  # **Downgrade-only.** The frontmatter pins `opus`; this suggests overriding *down*. Forget it and
  # you get the better reviewer, not the worse one.
  workspaces=$(printf '%s\n' "$SELECTED" | grep -c '^/' || true)
  risky=''
  git diff --name-only "$BASE" -- '*/migrations/*' | grep -q . && risky='a migration'
  # **Scoped to source, not to the whole diff.** The first version grepped the diff text and matched
  # `GRANT UPDATE` inside this repository's own prose — the reviewer fixtures and a build-log entry —
  # so it answered "opus" on a docs-only change and would never have downgraded at all: inert in the
  # one direction it exists for.
  [ -z "$risky" ] && git diff "$BASE" -- 'apps/api/src/*' ':(exclude)*.md' \
    | grep -qE '^\+.*(GRANT |REVOKE |CREATE POLICY|CREATE TRIGGER|ROW LEVEL SECURITY)' \
    && risky='a grant, policy or trigger'
  [ -z "$risky" ] && git diff --name-only "$BASE" -- 'apps/api/src/contracts/*' 'packages/contracts/*' | grep -q . \
    && risky='the contract surface'
  [ -z "$risky" ] && git diff --name-only "$BASE" -- 'apps/api/src/modules/identity/*' 'apps/api/src/modules/platform/admin/*' | grep -q . \
    && risky='identity or the admin realm'
  [ -z "$risky" ] && [ "$workspaces" -ge 3 ] && risky="$workspaces workspaces"

  echo
  if [ -n "$risky" ]; then
    printf 'Review agents: \033[1mopus\033[0m (the pinned default) — this diff touches %s.\n' "$risky"
  else
    printf 'Review agents: \033[1msonnet\033[0m is enough — one workspace, no migration, grant,\n'
    printf 'policy, trigger, contract or identity surface. Pass `model: sonnet` when invoking them.\n'
  fi
  exit 0
fi

printf '\033[31mFailed: %s\033[0m\n\n' "${FAILED[*]}"
for label in "${FAILED[@]}"; do
  printf '\033[1m── %s ──\033[0m\n' "$label"
  tail -30 "$LOGS/$label.log"
  echo
done
exit 1
