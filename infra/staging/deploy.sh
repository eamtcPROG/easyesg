#!/bin/sh
# Deploy a published commit onto the staging host (architecture.md §10.5; tasks 71.3, 72.2).
#
# Invoked two ways, and the second is the point:
#
#   ~/easyesg-deploy/infra/staging/deploy.sh <sha>    # by hand, on the host
#   ssh <deploy user>@<host> <sha>                     # by the Deploy staging workflow, through a forced-command key
#
# **The key that runs this cannot run anything else.** `~/.ssh/authorized_keys` pins it with
# `command="…/deploy.sh",restrict`, so the secret GitHub holds buys the ability to deploy a published commit of this
# repository — not a shell on a host shared with other tenants, where the `docker` group is root-equivalent. That is the
# whole reason this file exists rather than the workflow running `docker compose` over SSH, and it is why everything
# below treats its input as hostile: under a forced command the caller still writes SSH_ORIGINAL_COMMAND.
#
# Setup, once (each step is the host's, so none of it is automated here — §12.5.5):
#   1. git clone https://github.com/eamtcPROG/easyesg.git ~/easyesg-deploy
#   2. cp infra/compose/.env.staging.example infra/compose/.env.staging; chmod 600 it; generate every secret
#   3. the bootstrap vhost, the certificate, then the full vhost (infra/staging/nginx/*.conf say how)
#   4. a key for the workflow, pinned here:
#        ssh-keygen -t ed25519 -N "" -C easyesg-staging-deploy -f ~/.ssh/easyesg_staging_deploy
#        printf 'command="%s/easyesg-deploy/infra/staging/deploy.sh",restrict %s\n' \
#          "$HOME" "$(cat ~/.ssh/easyesg_staging_deploy.pub)" >> ~/.ssh/authorized_keys
#      and prove it gives no shell — this must answer with the sha complaint, never a prompt:
#        ssh -i ~/.ssh/easyesg_staging_deploy -o IdentitiesOnly=yes localhost whoami
#   5. the private half as the DEPLOY_SSH_KEY secret of the `staging` environment, beside DEPLOY_HOST, DEPLOY_USER and
#      DEPLOY_HOST_KEY (ssh-keyscan -t ed25519 <host>) — .github/workflows/deploy-staging.yml names them
set -eu

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/easyesg-deploy}"
ENV_FILE=infra/compose/.env.staging
REGISTRY=ghcr.io/eamtcprog
IMAGES="api web admin renderer"
HEALTH_ATTEMPTS=60
HEALTH_INTERVAL=2

compose() {
  docker compose -f infra/compose/docker-compose.staging.yml --env-file "$ENV_FILE" "$@"
}

# The sha arrives as an argument by hand, or in SSH_ORIGINAL_COMMAND under the forced command.
REQUESTED="${1:-${SSH_ORIGINAL_COMMAND:-}}"

# **Strict, not lenient.** Forty lowercase hex characters and nothing else — no branch, no `HEAD`, no option. This is the
# only barrier between a caller's string and `git checkout`.
if ! printf '%s' "$REQUESTED" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "deploy: expected a 40-character commit sha, got '${REQUESTED}'" >&2
  exit 2
fi
SHA="$REQUESTED"

cd "$DEPLOY_DIR"

# One deploy at a time on this host, whoever started it — the workflow's concurrency group cannot see a run by hand.
exec 9>"$HOME/.easyesg-staging-deploy.lock"
if ! flock -n 9; then
  echo "deploy: another deploy is running" >&2
  exit 4
fi

PREVIOUS="$(grep -E '^IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2)"
echo "deploy: ${PREVIOUS:-<nothing>} -> ${SHA}"

# **Every image must exist before anything running is touched.** A commit whose gates were red was never published, and
# it fails here with the stack still serving the previous release.
for image in $IMAGES; do
  if ! docker manifest inspect "${REGISTRY}/easyesg-${image}:${SHA}" >/dev/null 2>&1; then
    echo "deploy: ${REGISTRY}/easyesg-${image}:${SHA} not found — did the image job publish this commit?" >&2
    exit 3
  fi
done

pin() {
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ENV_FILE"
}

# How many migrations the database holds, or nothing when it cannot say (a first deploy has no ledger yet). Read so a
# failed release can report whether it changed the schema — which turns a rollback into a restore.
applied_migrations() {
  compose exec -T postgres psql -U postgres -d esg -tAc 'SELECT count(*) FROM migration.migrations' 2>/dev/null | tr -d '[:space:]' || true
}

healthy() {
  curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:$(port API_PORT 18101)/health" &&
    curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:$(port WEB_PORT 18102)/health"
}

port() {
  value="$(grep -E "^$1=" "$ENV_FILE" | cut -d= -f2)"
  printf '%s' "${value:-$2}"
}

# **The images back, and the tree with them** — the compose file travels with the code, so the previous release runs
# under its own. A migration that already ran is not undone by this and is not pretended away.
roll_back() {
  echo "deploy: ${SHA} failed: $1" >&2
  compose ps -a >&2 || true
  compose logs --no-color --tail 60 migrate seed api worker web >&2 || true
  if [ -z "$PREVIOUS" ]; then
    echo "deploy: nothing to roll back to" >&2
    exit 1
  fi
  echo "deploy: rolling back to ${PREVIOUS}" >&2
  git checkout --quiet --detach "$PREVIOUS"
  pin "$PREVIOUS"
  compose up -d --remove-orphans || true
  after="$(applied_migrations)"
  if [ -n "$BEFORE" ] && [ -n "$after" ] && [ "$after" != "$BEFORE" ]; then
    echo "deploy: THIS RELEASE APPLIED $((after - BEFORE)) MIGRATION(S) — the previous release now runs on a newer schema; a restore, not a rollback" >&2
  fi
  exit 1
}

BEFORE="$(applied_migrations)"

# The compose file, the vhost and this script travel with the code, so the tree moves too — not only the tag.
git fetch --quiet origin
git checkout --quiet --detach "$SHA"
pin "$SHA"

# Pull first and separately: it is the slow part and needs no downtime, so `up` is a restart rather than a download.
compose pull --quiet
# `up` waits for `migrate` and then `seed` to complete before it starts either entrypoint (task 18's ordering fact), and
# fails when either does.
compose up -d --remove-orphans || roll_back "the stack did not start"

attempt=0
until healthy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$HEALTH_ATTEMPTS" ]; then
    roll_back "api or web not healthy after $((HEALTH_ATTEMPTS * HEALTH_INTERVAL))s"
  fi
  sleep "$HEALTH_INTERVAL"
done

after="$(applied_migrations)"
echo "deploy: healthy at ${SHA} (migrations: ${BEFORE:-none} -> ${after:-?})"
compose ps

# Keep this release's images and the previous one's, so a rollback needs no pull; the host's disk is shared.
docker image ls --format '{{.Repository}}:{{.Tag}}' |
  grep -E "^${REGISTRY}/easyesg-(api|web|admin|renderer):" |
  grep -v -e ":${SHA}\$" ${PREVIOUS:+-e ":${PREVIOUS}\$"} |
  xargs -r docker image rm >/dev/null 2>&1 || true
