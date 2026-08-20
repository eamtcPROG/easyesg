# syntax=docker/dockerfile:1
#
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t easyesg-web .
#
# Unlike apps/api this image does NOT prune a workspace install, because Next.js does its own file
# tracing: `output: 'standalone'` emits a tree carrying exactly the files the server needs.
#
# CLAUDE.md asked for that tracing to be proven against pnpm's symlink layout on the first Docker
# build, because Next traces real paths while pnpm ships links. **Checked, on Next 16.3.0 with pnpm
# 11.22:** the bundle contains 29 symlinks and every one is relative and resolves inside the bundle
# — Next reproduces the .pnpm virtual store rather than dereferencing it, so the tree is
# self-contained and copyable. If a future Next version changes that, the image still builds and
# then fails on a missing module at start, which is why CI runs the container rather than only
# building it.
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
RUN pnpm install --frozen-lockfile --filter @easyesg/web...

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web

# The trailing `...` builds the workspace dependencies too. Without it packages/i18n and packages/ui
# have no output and the traced bundle references files that were never emitted — the api image
# failed exactly that way before it was corrected.
RUN pnpm --filter @easyesg/web... build

FROM node:26.7.0-bookworm-slim AS runtime
ENV NODE_ENV=production

# Next's standalone server binds `localhost` by default, which inside a container means nothing
# outside it can connect. §10.4 runs this at two replicas behind the edge, so it must listen on
# every interface.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

# The standalone tree keeps the monorepo shape: server.js sits at apps/web/. `static` and `public`
# are deliberately NOT traced by Next — they are assets rather than modules — so they are copied
# alongside, into the paths the server expects.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
