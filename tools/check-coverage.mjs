/**
 * NFR-88's coverage gate (task 205): each named component held to its own floor, never to a project
 * average, across both test runners.
 *
 * ## Why one checker reads both runners
 *
 * `apps/api` runs Jest and every other workspace runs Vitest (architecture.md §12.5.6), and each has
 * per-path thresholds of its own — which disagree on exactly the property this repository guards.
 * Jest's per-path threshold fails loudly on a path that matches nothing, but takes the files it
 * matches out of `global`; Vitest's glob threshold passes a pattern that matches nothing silently,
 * and counts every file in `global`. The floors would also have been written twice, in two dialects.
 * So each runner only writes istanbul's json-summary to its workspace's `coverage/`, and this reads
 * them all: counts are summed — percentages are never averaged — so a component's figure and the
 * project-wide one are both exact.
 *
 * ## The floors are the specification's, not this file's
 *
 * §12.5.6's floors table names each component, its line and branch floors, and the path it is
 * measured over — or *not built — task N*. This reads that table rather than restating it, the way
 * `docs:check` reads its numbers from the prose: a floor is moved there and nowhere else. A row not
 * built names the task that builds it, and is refused once that task has left `docs/task.md` — the
 * task fills in its path at its close (tasks 54, 57, 61), and this is what makes that checked rather
 * than remembered.
 *
 * ## What it refuses
 *
 * - a measured component below its line or branch floor;
 * - a workspace with a `test` script and no summary — the run did not measure it;
 * - a measured path holding no file the summaries name — a floor over nothing;
 * - a source file under a measured path that the summaries do not name. This is what makes each
 *   runner's `include` load-bearing: without it Vitest 4 reports only the files a test loaded, and a
 *   file no spec imports would vanish from its component instead of counting as uncovered;
 * - a *not built* row whose task has closed.
 *
 * The project-wide floor is printed and not enforced: §12.5.6's task-205 row records that deferral.
 *
 * ## It proves itself on every run
 *
 * As `docs:check` does, and for the same reason — a floor that cannot fail is indistinguishable from
 * one that passes. After the real verdict, each measured floor is re-checked against copies of the
 * real summaries doctored to break it — its lines one short of the floor, then its branches, then its
 * files removed, then one file dropped — and against a *not built* row naming a closed task, and the
 * run fails unless every copy is refused. In memory and instant.
 *
 * ## Modes
 *
 * - no argument — the gate, after `pnpm test:coverage` has run every unit suite with `--coverage`;
 * - `--reset` — removes every workspace's summary, which `pretest:coverage` runs first so that a
 *   summary this run did not write can never be read;
 * - `--partial` — for `pnpm gates:scoped`, which runs only the workspaces a change reaches: a
 *   workspace with no summary is skipped and named, a component inside it is reported *not run*, and
 *   the project-wide figure is not computed. Never what CI runs.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const SPEC = 'docs/architecture.md';
const SUMMARY = 'coverage/coverage-summary.json';
const SOURCE = /\.tsx?$/;
const NOT_SOURCE = /\.(spec|d)\.tsx?$/;
const METRICS = ['lines', 'branches'];

const read = (path) => readFileSync(path, 'utf8');

// ── The floors, from §12.5.6's table ────────────────────────────────────────────────────────────

const percent = (cell) => /^(\d+)%$/.exec(cell)?.[1];

/** One table row as a floor, or the reason it could not be read. */
const floorOf = (cells) => {
  const [component, lines, branches, measuredOver] = cells;
  const floor = { component, lines: Number(percent(lines)), branches: Number(percent(branches)) };
  if (!percent(lines) || !percent(branches)) {
    return { error: `${component}: "${lines}" / "${branches}" are not two percentages` };
  }
  const path = /^`([^`]+\/)`$/.exec(measuredOver)?.[1];
  if (path) return { ...floor, path };
  const task = /^not built — task (\d+)$/.exec(measuredOver)?.[1];
  if (task) return { ...floor, task };
  return {
    error: `${component}: "${measuredOver}" is neither a path ending in / nor "not built — task N"`,
  };
};

/** §12.5.6's floors table and the project-wide figure under it. */
const readFloors = (text) => {
  const start = text.indexOf('**Coverage floors**');
  const end = text.indexOf('Project-wide floor', start);
  if (start === -1 || end === -1) {
    throw new Error(`${SPEC}: the coverage floors table was not found — the prose moved`);
  }
  const rows = text
    .slice(start, end)
    .split('\n')
    .filter((line) => line.startsWith('| ') && !/^\| (Component|---)/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('**', '')));
  const floors = rows.map(floorOf);
  const errors = floors.filter((f) => f.error).map((f) => f.error);
  if (errors.length > 0) throw new Error(`${SPEC}'s coverage floors:\n  ${errors.join('\n  ')}`);
  if (!floors.some((f) => f.path)) {
    throw new Error(`${SPEC}: no floor names a path, so this gate would measure nothing`);
  }
  const projectWide = /Project-wide floor (\d+)%/.exec(text.slice(end))?.[1];
  if (!projectWide) throw new Error(`${SPEC}: the project-wide floor was not found`);
  return { floors, projectWide: Number(projectWide) };
};

// ── The workspaces and their summaries ──────────────────────────────────────────────────────────

/** Every workspace holding a `test` script, from `pnpm-workspace.yaml`'s `packages:` globs. */
const testedWorkspaces = () => {
  const globs = /^packages:\n((?: {2}- .+\n)+)/m.exec(read('pnpm-workspace.yaml'))?.[1];
  if (!globs) throw new Error('pnpm-workspace.yaml: the packages list was not found');
  return globs
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const parent = /^ {2}- (.+)\/\*$/.exec(line)?.[1];
      if (!parent) throw new Error(`pnpm-workspace.yaml: "${line.trim()}" is not a "<dir>/*" glob`);
      return readdirSync(parent, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(parent, d.name));
    })
    .filter((ws) => {
      const manifest = join(ws, 'package.json');
      return existsSync(manifest) && JSON.parse(read(manifest)).scripts?.test;
    });
};

/** Each measured file, repository-relative, with its line and branch counts. */
const readSummaries = (workspaces) => {
  const files = new Map();
  const missing = [];
  for (const ws of workspaces) {
    const path = join(ws, SUMMARY);
    if (!existsSync(path)) {
      missing.push(ws);
      continue;
    }
    for (const [file, counts] of Object.entries(JSON.parse(read(path)))) {
      if (file === 'total') continue;
      files.set(relative(process.cwd(), file).split('\\').join('/'), {
        lines: { total: counts.lines.total, covered: counts.lines.covered },
        branches: { total: counts.branches.total, covered: counts.branches.covered },
      });
    }
  }
  return { files, missing };
};

/**
 * The source files under a measured path, as a runner's `include` would select them. A path that
 * no longer exists holds none, and the verdict then refuses it as measuring nothing.
 */
const sourceFilesUnder = (dir) =>
  !existsSync(dir) ? [] : readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && SOURCE.test(d.name) && !NOT_SOURCE.test(d.name))
    .map((d) => join(d.parentPath, d.name).split('\\').join('/'));

/** Task numbers still in the active plan — a row's number cell, as `docs:check` reads it. */
const openTasks = () =>
  new Set(
    read('docs/task.md')
      .split('\n')
      .map((line) => /^\|\s*\*{0,2}(\d+)\*{0,2}\s*\|/.exec(line)?.[1])
      .filter(Boolean),
  );

// ── The verdict ─────────────────────────────────────────────────────────────────────────────────

const sum = (entries) => {
  const total = { lines: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 } };
  for (const counts of entries) {
    for (const metric of METRICS) {
      total[metric].total += counts[metric].total;
      total[metric].covered += counts[metric].covered;
    }
  }
  return total;
};

/** Exact: `covered / total >= floor / 100`, in integers. Nothing to cover meets any floor. */
const meets = ({ total, covered }, floor) => covered * 100 >= floor * total;

const under = (files, path) => [...files].filter(([file]) => file.startsWith(path));

/** A measured floor whose workspace this run measured — every one, except under `--partial`. */
const ranHere = (floor, skipped) => floor.path && !skipped.some((ws) => floor.path.startsWith(`${ws}/`));

/**
 * The gate's judgement, pure over its inputs — which is what lets the prove pass run it on doctored
 * copies. `sources` maps each measured path to the source files on disk beneath it; `skipped` is the
 * set of workspaces `--partial` did not run.
 */
const evaluate = ({ floors, files, sources, open, skipped = [] }) => {
  const rows = [];
  const failures = [];
  for (const floor of floors) {
    if (floor.task) {
      rows.push({ floor, note: `not built — task ${floor.task}` });
      if (!open.has(floor.task)) {
        failures.push(
          `${floor.component}: §12.5.6 says not built — task ${floor.task}, and task ${floor.task} ` +
            'has closed. Its close fills in the path the component is measured over.',
        );
      }
      continue;
    }
    if (!ranHere(floor, skipped)) {
      rows.push({ floor, note: 'not run' });
      continue;
    }
    const measured = under(files, floor.path);
    if (measured.length === 0) {
      failures.push(`${floor.component}: no measured file lies under ${floor.path}`);
      rows.push({ floor, note: 'measures nothing' });
      continue;
    }
    const absent = sources.get(floor.path).filter((file) => !files.has(file));
    for (const file of absent) {
      failures.push(`${floor.component}: ${file} is not in the summary, so it counts for nothing`);
    }
    const total = sum(measured.map(([, counts]) => counts));
    for (const metric of METRICS) {
      if (!meets(total[metric], floor[metric])) {
        failures.push(
          `${floor.component}: ${metric} ${shown(total[metric])} is below its ${floor[metric]}% floor`,
        );
      }
    }
    rows.push({ floor, total });
  }
  return { rows, failures };
};

// ── The prove pass ──────────────────────────────────────────────────────────────────────────────

/** A copy of the summaries with one component's `metric` set one covered unit short of `floor`. */
const oneShort = (files, path, metric, floor) => {
  const copy = new Map([...files].map(([file, counts]) => [file, structuredClone(counts)]));
  const entries = under(copy, path).map(([, counts]) => counts[metric]);
  const total = entries.reduce((n, e) => n + e.total, 0);
  let excess = entries.reduce((n, e) => n + e.covered, 0) - (Math.ceil((floor * total) / 100) - 1);
  for (const entry of entries) {
    const taken = Math.min(entry.covered, Math.max(excess, 0));
    entry.covered -= taken;
    excess -= taken;
  }
  return copy;
};

const without = (files, keep) => new Map([...files].filter(([file]) => keep(file)));

/** Each way a measured floor can be broken, and the refusal that must name it. */
const doctorings = (input) =>
  input.floors
    .filter((floor) => ranHere(floor, input.skipped))
    .flatMap((floor) => {
      const measured = under(input.files, floor.path);
      // A floor over nothing is already refused by the verdict; there is nothing to doctor.
      if (measured.length === 0) return [];
      const first = measured[0][0];
      return [
        ...METRICS.map((metric) => ({
          what: `${floor.component}'s ${metric} one short of ${floor[metric]}%`,
          files: oneShort(input.files, floor.path, metric, floor[metric]),
          refusal: `${floor.component}: ${metric} `,
          vacuous: measured.reduce((n, [, c]) => n + c[metric].total, 0) === 0,
        })),
        {
          what: `${floor.component}'s files removed`,
          files: without(input.files, (file) => !file.startsWith(floor.path)),
          refusal: `${floor.component}: no measured file`,
        },
        {
          what: `${floor.component}'s ${first} dropped from the summary`,
          files: without(input.files, (file) => file !== first),
          refusal: `${floor.component}: ${first} is not in the summary`,
        },
      ];
    });

/** Every doctored copy must be refused, naming what was broken. Returns the inert ones. */
const prove = (input) => {
  const inert = [];
  for (const d of doctorings(input)) {
    if (d.vacuous) {
      inert.push(`${d.what}: it has nothing to count, so this floor can never fail`);
      continue;
    }
    const { failures } = evaluate({ ...input, files: d.files });
    if (!failures.some((f) => f.startsWith(d.refusal))) inert.push(`${d.what} was not refused`);
  }
  const unbuilt = { component: 'A component not built', lines: 100, branches: 100, task: '0' };
  const closed = evaluate({ ...input, floors: [unbuilt], open: new Set(), skipped: [] });
  if (closed.failures.length === 0) inert.push('a not-built row naming a closed task was not refused');
  return inert;
};

// ── The report ──────────────────────────────────────────────────────────────────────────────────

/** Rounded down, so a figure shown as meeting its floor does. */
const pct = ({ total, covered }) =>
  total === 0 ? '—' : `${(Math.floor((covered * 10_000) / total) / 100).toFixed(2)}%`;
const shown = (counts) => `${pct(counts)} (${counts.covered}/${counts.total})`;

const report = (rows, projectWide) => {
  const width = Math.max(...rows.map((r) => r.floor.component.length), 'Project-wide'.length);
  console.log(`NFR-88 coverage — each floor from ${SPEC} §12.5.6\n`);
  for (const { floor, total, note } of rows) {
    const label = floor.component.padEnd(width);
    const floors = `${floor.lines}/${floor.branches}`;
    if (note) console.log(`  ${label}  ${floors.padEnd(8)} ${note}`);
    else {
      const met = METRICS.every((m) => meets(total[m], floor[m])) ? '✓' : '✗';
      console.log(
        `  ${label}  ${floors.padEnd(8)} lines ${shown(total.lines).padEnd(24)} ` +
          `branches ${shown(total.branches).padEnd(24)} ${met}`,
      );
    }
  }
  if (projectWide) {
    const { floor, total } = projectWide;
    console.log(
      `  ${'Project-wide'.padEnd(width)}  ${String(floor).padEnd(8)} lines ${shown(total.lines).padEnd(24)} ` +
        `branches ${shown(total.branches).padEnd(24)} reported, not enforced`,
    );
  }
};

// ── The run ─────────────────────────────────────────────────────────────────────────────────────

const mode = process.argv[2];
const workspaces = testedWorkspaces();

if (mode === '--reset') {
  for (const ws of workspaces) rmSync(join(ws, SUMMARY), { force: true });
  process.exit(0);
}
if (mode !== undefined && mode !== '--partial') {
  console.error(`check-coverage: unknown argument "${mode}"; expected none, --reset or --partial`);
  process.exit(2);
}

const partial = mode === '--partial';
const { floors, projectWide } = readFloors(read(SPEC));
const { files, missing } = readSummaries(workspaces);
const sources = new Map(floors.filter((f) => f.path).map((f) => [f.path, sourceFilesUnder(f.path)]));
const input = { floors, files, sources, open: openTasks(), skipped: partial ? missing : [] };

const { rows, failures } = evaluate(input);
if (!partial) {
  for (const ws of missing) {
    failures.push(`${ws} has a test script and no ${SUMMARY}: run \`pnpm test:coverage\`, not \`pnpm test\``);
  }
}
report(
  rows,
  partial ? null : { floor: projectWide, total: sum([...files.values()]) },
);
if (partial && missing.length > 0) console.log(`\n  Not run here: ${missing.join(', ')}`);

const measuredRan = floors.some((floor) => ranHere(floor, input.skipped));
const inert = measuredRan ? prove(input) : [];

if (failures.length > 0 || inert.length > 0) {
  console.error('');
  for (const f of failures) console.error(`  ✗ ${f}`);
  for (const i of inert) console.error(`  ✗ INERT: ${i}`);
  process.exit(1);
}
console.log(
  measuredRan
    ? '\nEvery measured floor holds, and each was proven to refuse a summary doctored to break it.'
    : '\nNo measured component ran here.',
);
