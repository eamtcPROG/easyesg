#!/usr/bin/env bash
# Next's standalone output traces MODULES only: `.next/static` and `public/` are assets and are
# deliberately not traced, so the server expects them copied in beside it. The web Dockerfile
# does exactly this with COPY layers; this script is the same two copies for a host run, used by
# `pree2e:web` so the browser e2e exercises the artefact the image would ship.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
web="$root/apps/web"
dest="$web/.next/standalone/apps/web"

if [ ! -f "$dest/server.js" ]; then
  echo "assemble-web-standalone: $dest/server.js not found — run 'pnpm --filter @easyesg/web build' first" >&2
  exit 1
fi

rm -rf "$dest/.next/static" "$dest/public"
mkdir -p "$dest/.next"
cp -R "$web/.next/static" "$dest/.next/static"
cp -R "$web/public" "$dest/public"
