#!/usr/bin/env node
/**
 * The api image carries every workspace package it depends on — checked hermetically (task 90).
 *
 * ## Why this exists
 *
 * `apps/api/Dockerfile`'s runtime stage lists, by hand, the workspace packages to copy out of the
 * build stage. Its own comment says the list "is exactly apps/api's workspace dependencies, and it
 * grows with them", and names the cost of forgetting: the image builds cleanly and the container
 * dies at start on a dangling symlink — `Cannot find module '@easyesg/<pkg>'`.
 *
 * **Two occurrences are verifiable** (`git log -S`, checked rather than repeated — the task row says
 * three): `packages/validation` at task 20 (`2b34a94`) and `packages/vsme` at task 34.2 (`56f2fb0`),
 * which broke `dev`. `packages/i18n` is NOT one of them — it shipped with the Dockerfile at task 18,
 * so a count that includes it is counting the original as a regression.
 *
 * The two differ in which hand-kept list fell behind, and that is the argument for checking both:
 * task 20's was the BUILD stage (`COPY packages/i18n packages/i18n`, fixed by copying the whole
 * tree), task 34.2's the RUNTIME stage. Same class — a list of workspace packages maintained beside
 * a manifest and compared to it by nothing — and both were caught only by the Images job actually
 * running the container: an image build, on push, after all three gate jobs had already passed.
 * `CLAUDE.md`: *"A finding that recurs graduates into a mechanical gate."*
 *
 * ## Why it asserts equality rather than inclusion
 *
 * Checking only that every dependency is copied would go inert in the other direction: a package
 * dropped as a dependency but left in the Dockerfile ships bytes nothing reads, and a package
 * *renamed* would satisfy an inclusion check from its old line while the new one is missing. This is
 * `schema-invariants.e2e-spec.ts`'s own lesson, recorded in `apps/api/CLAUDE.md` under "Withholding a
 * column": the first draft of that gate listed what was GRANTED and was inert in one direction, so a
 * column in neither list passed while the application could not write it. Equality has no such gap.
 *
 * ## Why only apps/api
 *
 * Confirmed rather than assumed (2 Sep 2026). `apps/web` sets `output: 'standalone'` and copies
 * `.next/standalone` wholesale — Next's own file tracing populates it, so there is no hand-kept list
 * to drift. `apps/admin` copies `dist` into `/srv` as a static bundle with no `node_modules` at all.
 * Neither can hold this defect; a check over them would assert nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/**
 * Package name to directory, derived rather than assumed.
 *
 * `@easyesg/vsme` living in `packages/vsme` is a convention, not a rule, and a check that hard-coded
 * the strip-the-scope transform would be a second place the layout is described.
 */
const directoryByName = new Map(
  readdirSync(resolve(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const manifest = JSON.parse(read(`packages/${entry.name}/package.json`));
        return [[manifest.name, entry.name]];
      } catch {
        return [];
      }
    }),
);

const api = JSON.parse(read('apps/api/package.json'));
const dockerfile = read('apps/api/Dockerfile');

/**
 * **`dependencies` only.** A dev dependency is present when the image is built and absent when it
 * runs, which is the whole point of the prune — requiring a runtime copy for one would demand the
 * image carry what it must not.
 */
const required = Object.keys(api.dependencies ?? {})
  .filter((name) => name.startsWith('@easyesg/'))
  .map((name) => {
    const directory = directoryByName.get(name);
    if (directory === undefined) {
      console.error(`apps/api depends on ${name}, which no directory under packages/ declares.`);
      process.exit(1);
    }
    return directory;
  });

/**
 * The RUNTIME stage's copies, told apart by `--from=build`.
 *
 * The build stage copies the whole `packages` tree in one line; only the runtime stage names them
 * individually, and only its list can drift. The character class admits digits because `i18n` has
 * one — a `[a-z-]+` class silently matches four of the five packages and would have made this gate
 * blind to exactly the kind of omission it exists for.
 */
const copied = [
  ...dockerfile.matchAll(/^COPY --from=build[^\n]*\s\/repo\/packages\/([a-z0-9-]+)\s/gm),
].map((match) => match[1]);

/** The manifest layer, which the install stage resolves `--frozen-lockfile` against. */
const manifests = new Set(
  [...dockerfile.matchAll(/^COPY packages\/([a-z0-9-]+)\/package\.json\s/gm)].map((m) => m[1]),
);

const missing = required.filter((directory) => !copied.includes(directory));
const stray = copied.filter((directory) => !required.includes(directory));
const unmanifested = required.filter((directory) => !manifests.has(directory));

const problems = [];
if (missing.length > 0) {
  problems.push(
    `apps/api depends on ${missing.join(', ')}, which the runtime stage does not copy.\n` +
      `  The image will build and the container will die at start on a dangling symlink:\n` +
      `  Cannot find module '@easyesg/<pkg>'. Add, for each:\n` +
      missing
        .map((d) => `    COPY --from=build --chown=node:node /repo/packages/${d} ./packages/${d}`)
        .join('\n'),
  );
}
if (stray.length > 0) {
  problems.push(
    `The runtime stage copies ${stray.join(', ')}, which apps/api does not depend on.\n` +
      `  Either the dependency was dropped and the line outlived it, or a package was renamed and\n` +
      `  only one of the two places was updated. A runtime image should carry only what it runs.`,
  );
}
if (unmanifested.length > 0) {
  problems.push(
    `apps/api depends on ${unmanifested.join(', ')}, whose package.json the manifest layer does\n` +
      `  not copy, so the install stage resolves a workspace that is missing them. Add, for each:\n` +
      unmanifested.map((d) => `    COPY packages/${d}/package.json packages/${d}/`).join('\n'),
  );
}

if (problems.length > 0) {
  console.error('apps/api/Dockerfile does not match apps/api/package.json:\n');
  for (const problem of problems) console.error(`- ${problem}\n`);
  process.exit(1);
}

console.log(
  `apps/api/Dockerfile carries all ${required.length} workspace dependencies and nothing else ` +
    `(${required.join(', ')}).`,
);
