// `pnpm lint`: ESLint over the whole repository, in passes (the owner's choice at Stage 2's close, 9 Oct 2026;
// `docs/architecture.md` §12.5.6's Stage-2-close row, item (8)).
//
// WHY PASSES. Type-aware rules load the TypeScript program of every file they lint, so one `eslint .` holds every
// workspace's program at once. Measured cold on an 8 GB host after Stage 2: 3.0 GB of V8 heap, past Node's default
// ceiling of 2.1 GB there — the run aborted out of memory — and 225 s. Linted as `apps/api`, `apps/web` and the rest,
// the largest pass peaked at 1.39 GB and the three took about 121 s; and each pass grows with its own workspace rather
// than with the repository.
//
// WHY ONE LIST. The last pass is the repository minus every earlier one, its ignore patterns derived from SEPARATE, so
// the passes lint each file exactly once by construction — measured equal to `eslint .`, the same 2,756 files. A chain
// written out by hand could drop a pass and keep its ignore pattern, and those files would go unlinted with every gate
// green. Moving a workspace in or out of SEPARATE moves it between passes and never out of the run.
//
// EACH PASS ITS OWN CACHE. ESLint names the cache file inside a directory after the working directory, so passes
// sharing one would overwrite each other's entries. `tools/clean-build-outputs.sh` removes the parent.
//
// Every pass runs even when an earlier one fails, so one run reports every finding; the exit is non-zero if any failed.
// Arguments after `pnpm lint` (`--fix`, say) reach every pass.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ESLINT = 'node_modules/eslint/bin/eslint.js';
const CACHE = 'node_modules/.cache/eslint';

/** Linted each in a pass of its own — the workspaces whose programs are largest. */
const SEPARATE = ['apps/api', 'apps/web'];

const passes = [
  ...SEPARATE.map((dir) => ({ name: dir, cache: dir.replaceAll('/', '-'), targets: [dir] })),
  {
    name: 'the rest of the repository',
    cache: 'rest',
    targets: ['.', ...SEPARATE.flatMap((dir) => ['--ignore-pattern', `${dir}/**`])],
  },
];

const failed = passes.filter((pass) => {
  const run = spawnSync(
    process.execPath,
    [
      ESLINT,
      ...pass.targets,
      '--cache',
      '--cache-strategy',
      'content',
      '--cache-location',
      `${CACHE}/${pass.cache}/`,
      ...process.argv.slice(2),
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
  return run.error !== undefined || run.status !== 0;
});

if (failed.length > 0) {
  console.error(`lint: ${failed.map((pass) => pass.name).join(', ')} failed.`);
  process.exit(1);
}
