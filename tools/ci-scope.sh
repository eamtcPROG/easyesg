#!/usr/bin/env bash
#
# Which of CI's gates a push needs (architecture.md §12.5.4, task 224).
#
# Prints two lines for `$GITHUB_OUTPUT`, and the reason on stderr:
#
#   scope=full | confined   confined: every path that differs from the branch's last green run is in
#                           the tenant application, the console or the docs, so the api's stack
#                           suites have nothing to find
#   e2e-web-args=…          what `pnpm e2e:web` takes: `--project admin` when the console alone
#                           changed, nothing — all three projects — otherwise
#
#   tools/ci-scope.sh          # against the branch's last green push run, which is what CI does
#   tools/ci-scope.sh <sha>    # against a commit of your choosing
#
# **The base is the last green run, never the previous push.** A newer push cancels an older run on
# the same ref, and a red run followed by a fix in the console would otherwise skip the very suite
# that went red: that push's own diff is the console's, while the api it ships was never proven.
#
# **Trees, not history, and renames off.** `git diff <base> HEAD` compares two trees whatever lies
# between them, so a force push needs no case of its own; `--no-renames` lists a file moved out of
# `packages/ui` as a deletion there, where rename detection would list only its arrival in the app.
#
# **Anything this script does not recognise runs everything** — an event other than a push, no green
# run to compare with, a base it cannot fetch, a path outside the lists below. The lists are the
# whole claim: no workspace depends on `apps/web` or `apps/admin`, and no skipped suite reads a path
# counted as confined or neutral. When either stops being true, this file is what changes.
set -uo pipefail

cd "$(dirname "$0")/.."

full() {
  echo "ci-scope: the whole set — $1" >&2
  printf 'scope=full\ne2e-web-args=\n'
  exit 0
}

# ── The base ─────────────────────────────────────────────────────────────────────────────────────
#
# A pull request and a manual run take the whole set: neither has a "last green run" of its own that
# means what it means for a branch, and someone asking for a run by hand is asking for all of it.
EVENT="${GITHUB_EVENT_NAME:-push}"
[ "$EVENT" = push ] || full "a ${EVENT} run is never scoped"

BASE="${1:-}"
if [ -z "$BASE" ]; then
  BRANCH="${GITHUB_REF_NAME:-$(git branch --show-current)}"
  [ -n "$BRANCH" ] || full "HEAD is on no branch"
  BASE="$(gh run list --workflow gates.yml --branch "$BRANCH" --event push --status success --limit 1 \
    --json headSha --jq '.[0].headSha // empty' 2>/dev/null)" || BASE=""
  [ -n "$BASE" ] || full "no green push run on ${BRANCH} to compare with"
fi

# CI's checkout is one commit deep, so the base is fetched on its own — its tree is all a diff needs.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$BASE" 2>/dev/null || full "cannot fetch ${BASE}"
fi

CHANGED="$(git diff --name-only --no-renames "$BASE" HEAD)" || full "cannot compare ${BASE} with HEAD"

# A re-run of a commit that is already green asks for the whole set again, not for nothing.
[ -n "$CHANGED" ] || full "nothing differs from the last green run, ${BASE}"

# ── The paths ────────────────────────────────────────────────────────────────────────────────────
#
# `e2e/web/` belongs to the tenant application and `e2e/admin/` to the console: each folder is read
# only by its own browser projects. The console's specs import `e2e/web/support`, which is one
# reason a tenant-side change runs the console's project too, below. The rest of `e2e/` is the
# suite's own configuration and runs everything.
#
# Neutral paths are the ones the push trigger's `paths-ignore` already holds unable to break a gate.
# Markdown under `packages/` and `config/` is the exception: `packages/ui`'s `contrast-record.md` is
# a spec's input, and `config/seed/README.md` sits in the folder the seed reader lists and ships in
# the api image. A here-string rather than a pipe, so `full` exits the script rather than a subshell.
WEB=false
ADMIN=false
while IFS= read -r path; do
  case "$path" in
    apps/web/* | e2e/web/*) WEB=true ;;
    apps/admin/* | e2e/admin/*) ADMIN=true ;;
    packages/*.md | config/*.md) full "code reads ${path}" ;;
    docs/* | design/* | *.md | .gitignore) ;;
    *) full "${path} is outside the two applications" ;;
  esac
done <<< "$CHANGED"

# ── The answer ───────────────────────────────────────────────────────────────────────────────────
#
# Only the console changed: its project alone. Anything on the tenant side runs all three, because
# three of the console's journeys open the tenant application.
ARGS=''
if [ "$ADMIN" = true ] && [ "$WEB" = false ]; then
  ARGS='--project admin'
fi

echo "ci-scope: confined since ${BASE:0:12} (tenant application ${WEB}, console ${ADMIN}) — the api's stack suites skip" >&2
printf 'scope=confined\ne2e-web-args=%s\n' "$ARGS"
