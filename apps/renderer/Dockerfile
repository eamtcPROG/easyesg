# syntax=docker/dockerfile:1
#
# The renderer (architecture.md §5, T-13; task 44.1): headless Chromium and the PDF finisher, in a container of their
# own so Chromium's memory and its hangs are capped, killed and restarted without touching the api or the worker.
# Built from the repository root, as every image here is:
#   docker build -f apps/renderer/Dockerfile -t easyesg-renderer .

FROM node:26.7.0-bookworm-slim AS manifests
WORKDIR /repo
ENV CI=true
RUN npm install --global pnpm@11.22.0

# Every workspace manifest, as the api's image copies them: a frozen install checks the lockfile against the workspace
# it describes. The renderer depends on no workspace package, so nothing under packages/ is built for it.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/renderer/package.json apps/renderer/
COPY packages/contracts/package.json packages/contracts/
COPY packages/i18n/package.json packages/i18n/
COPY packages/ui/package.json packages/ui/
COPY packages/validation/package.json packages/validation/
COPY packages/vsme/package.json packages/vsme/
COPY packages/xlsx-patch/package.json packages/xlsx-patch/

# The production dependencies from the manifests alone, in a stage of their own, so the layers built on them — Chromium
# above all — depend on the lockfile and never on the renderer's source.
FROM manifests AS dependencies
RUN pnpm install --frozen-lockfile --prod --filter @easyesg/renderer...

FROM manifests AS build
RUN pnpm install --frozen-lockfile --filter @easyesg/renderer...
COPY tsconfig.base.json ./
COPY apps/renderer apps/renderer
RUN pnpm --filter @easyesg/renderer build

FROM node:26.7.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /repo

# The finisher's toolchain, from Debian rather than pip: pikepdf (over qpdf's library) and the free sRGB profile the
# output intent embeds. Their versions are the release's, fixed with the base image — §12.1 records what installed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-pikepdf icc-profiles-free \
 && rm -rf /var/lib/apt/lists/*

# The dependencies first and the code last, so Chromium — the slow layer — is installed again only when the
# dependencies move, never because the renderer's own source did.
COPY --from=dependencies /repo/node_modules ./node_modules
COPY --from=dependencies /repo/apps/renderer/package.json ./apps/renderer/package.json
COPY --from=dependencies /repo/apps/renderer/node_modules ./apps/renderer/node_modules
WORKDIR /repo/apps/renderer

# §12.5.9's control 1: Chromium installed explicitly, at the pinned Playwright, with its system libraries — never left
# to a `postinstall` pnpm would block. This is `pnpm exec playwright install`, the binary named directly: the runtime
# stage carries no pnpm, and the binary is the same one the workspace's `playwright` pin put in node_modules.
RUN ./node_modules/.bin/playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /repo/apps/renderer/dist ./dist
COPY apps/renderer/finisher ./finisher

# Never root: Chromium runs without its own sandbox here (Playwright's default in a container), so the container and
# its unprivileged user are the boundary.
USER node

# §12.5.9's control 2: the image refuses to finish unless the browser it holds launches, as the user it runs as, and
# answers the build the renderer is pinned to.
RUN node dist/assert-chromium.js

EXPOSE 3000
CMD ["node", "dist/main.js"]
