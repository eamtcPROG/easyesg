# syntax=docker/dockerfile:1
#
# Build from the repository root:
#   docker build -f apps/admin/Dockerfile -t easyesg-admin .
#
# The admin console is a static Vite bundle (§10.4) — no Node runtime, nothing to prune. The image
# exists so the bundle is a versioned artefact deployed like the others rather than files copied
# onto a host, which is what NFR-89's "buildable to a deployable artefact from source with no manual
# step" asks for.
#
# Caddy at §12.1's pin, matching the edge, so this system has one HTTP server to reason about rather
# than two. The edge terminates TLS and routes admin.<host> here.
FROM node:26.7.0-bookworm-slim AS build
WORKDIR /repo
ENV CI=true
RUN npm install --global pnpm@11.22.0

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/contracts/package.json packages/contracts/
COPY packages/i18n/package.json packages/i18n/
COPY packages/ui/package.json packages/ui/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile --filter @easyesg/admin...

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/admin apps/admin
RUN pnpm --filter @easyesg/admin... build

FROM caddy:2.11.4-alpine AS runtime

# A single-page application: any path that is not a file on disk is one of the app's own routes,
# resolved by the router in the browser. UX-4 requires every addressable state to have a shareable
# address, so a deep link must survive a refresh — without this rewrite, reloading
# /billing/invoices returns 404 from the file server and the address stops being shareable.
COPY <<'CADDYFILE' /etc/caddy/Caddyfile
:8080 {
	root * /srv
	encode gzip zstd
	try_files {path} /index.html
	file_server
}
CADDYFILE

COPY --from=build /repo/apps/admin/dist /srv
EXPOSE 8080
