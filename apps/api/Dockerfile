# syntax=docker/dockerfile:1
#
# api and worker are the SAME image, different entrypoint (AD-1, §10.4, §5.4). That is what NFR-89's
# reproducibility drill rests on — one build, one version, two roles — and it is why `MODE` picks the
# entrypoint at run time rather than there being two Dockerfiles that could drift.
#
# Build from the repository root, not from this directory:
#   docker build -f apps/api/Dockerfile -t easyesg-api .
# A pnpm workspace install needs the lockfile and every workspace package, none of which exist below
# apps/api.

# §12.1's pin, exactly. `engineStrict: true` in pnpm-workspace.yaml means a drift from engines.node
# fails the install below rather than producing an image that runs on the wrong runtime — one of the
# four controls holding the time-boxed Node 26 exception (§12.6).
FROM node:26.7.0-bookworm-slim AS build
WORKDIR /repo

# A Docker build genuinely is non-interactive, and pnpm asks before purging a modules directory —
# which the production prune below does. Without this it stops with
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY rather than proceeding, which is the right default for
# a terminal and the wrong one for a layer.
ENV CI=true

# Not corepack: it has been unbundled from Node and its presence is no longer a given. An explicit
# install is one line and cannot surprise a future base image.
RUN npm install --global pnpm@11.22.0

# The lockfile and manifests first, so a source-only change reuses the install layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/contracts/package.json packages/contracts/
COPY packages/i18n/package.json packages/i18n/
COPY packages/ui/package.json packages/ui/
COPY packages/validation/package.json packages/validation/

# --frozen-lockfile: an install that would change the lockfile fails instead of resolving something
# else. `strictDepBuilds` additionally fails on a dependency build script nobody has adjudicated,
# rather than skipping it and letting the absence surface at run time.
RUN pnpm install --frozen-lockfile --filter @easyesg/api...

COPY tsconfig.base.json ./
COPY packages/i18n packages/i18n
COPY apps/api apps/api
# The trailing `...` is load-bearing: it selects apps/api AND its workspace dependencies. Without
# it, packages/i18n is never built, the image builds cleanly, and the container dies on start with
# `Cannot find module '@easyesg/i18n/dist/cjs/index.js'` — a workspace symlink pointing at a package
# that has no output. The same shape as the missing `pretest:e2e` hook: a step that did not build
# what it depends on, invisible until something actually ran.
RUN pnpm --filter @easyesg/api... build

# Pruned to production **from the lockfile**, which is the whole point: `--frozen-lockfile` resolves
# nothing, so this is a local file operation rather than a dependency graph rebuilt over the network
# inside a Docker layer.
#
# `pnpm deploy` was tried first and is deliberately not used here. Both of its paths are wrong for
# this workspace, and each fails in its own way:
#
#   - `--legacy` (required on pnpm 11, which otherwise refuses with
#     ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE) ignores the shared lockfile and re-resolves everything —
#     observed resolving 475 packages with 0 reused, then dying on `JavaScript heap out of memory`.
#     A build step that reaches for the registry to rebuild a graph the lockfile already describes is
#     not something to tune; it is the wrong operation.
#   - The non-legacy path needs `inject-workspace-packages: true`, which copies workspace packages
#     instead of linking them. That would make `pretest`/`pretest:e2e`'s rebuild of packages/i18n
#     invisible to apps/api until a reinstall — breaking the very hook that keeps the gates honest
#     on a fresh checkout.
RUN pnpm install --frozen-lockfile --prod --filter @easyesg/api...

FROM node:26.7.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# The workspace layout is preserved rather than flattened, because pnpm's links are RELATIVE:
# apps/api/node_modules/@easyesg/i18n points at ../../../../packages/i18n, and everything else at
# ../../node_modules/.pnpm/... . Copying apps/api's node_modules alone is what CLAUDE.md forbids —
# it yields dangling links. Copying the three directories that the links span keeps every one of
# them resolvable, and after the prune above they carry production dependencies only.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/i18n ./packages/i18n
COPY --from=build --chown=node:node /repo/apps/api ./apps/api

# Never root. The image runs an HTTP tier reachable through the edge, and node's own image already
# ships an unprivileged user for the purpose.
USER node
WORKDIR /repo/apps/api

# MODE selects the entrypoint: unset or `http` serves, `worker` consumes the queue and dispatches
# the outbox. §10.4 runs this same image as both services.
EXPOSE 3000
CMD ["node", "dist/main.js"]
