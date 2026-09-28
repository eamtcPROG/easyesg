#!/usr/bin/env bash
# Runs a command against the test stack rather than the dev stack (task 174; architecture.md §12.5.10).
#
#     tools/with-test-stack.sh <command> [args…]
#
# It exports `apps/api/.env.test` — the test stack's port, database and Redis port, under the names every test process
# already reads — and then `exec`s the command. **Exported beats the file**: the api's scripts load `apps/api/.env`
# with `node --env-file-if-exists`, which never overrides a variable already in the environment, so `DB_NAME=esg` in
# that file loses to `DB_NAME=esg_test` here while every credential in it still applies.
#
# **For what `--env-file=.env.test` cannot reach.** A single `node` command loads `.env.test` itself, as a second
# `--env-file` after `.env` (`test:e2e`, `test:worker`). This is for the rest: a chain of commands — migrate, revert,
# migrate, invariants; migrate and seed — each of which loads only `.env`, and Playwright, which loads neither.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

set -a
# shellcheck source=../apps/api/.env.test
. "$root/apps/api/.env.test"
set +a

exec "$@"
