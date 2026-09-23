/**
 * Checks the countable claims the CLAUDE.md files make against the repository they describe
 * (task 100).
 *
 * ## Why this exists
 *
 * A CLAUDE.md audit on 8 Sep 2026 found fourteen wrong statements across the four files that then
 * existed — the same task authored `packages/ui/CLAUDE.md`, so this gate reads five. Eight were
 * counts, and — this is the part that decided the design — **three were wrong on the day they were
 * written**, not decayed since: "36 registered" was authored in a commit where the real figure was
 * already 39, and "36 route files" in one where `page.tsx` numbered 35. So this is not a staleness
 * gate. It is the gate that would have refused two of those claims at birth.
 *
 * Nothing else can see them. A count in prose is invisible to `lint`, `typecheck` and every other
 * gate, and it reads as authoritative precisely because it is specific.
 *
 * ## The design rule: the prose is the single source of the claim
 *
 * A manifest holding `{ file, expected: 44 }` would be a second copy of the number, free to
 * disagree with the sentence it describes — the defect this repository already names for DTOs and
 * for vocabularies. So an entry carries **no expected value**. It carries a `pattern` whose capture
 * group is the number *as written in the document*, and an `actual()` that computes the truth from
 * the repository without reading that document. The two are compared. There is exactly one place
 * the number lives, and it is the sentence a reader sees.
 *
 * Three ways an entry fails, and the last two matter as much as the first:
 *
 * - the claimed number and the computed one disagree — the ordinary case;
 * - the pattern matches **nothing**, meaning the prose was rewritten and the claim moved or
 *   vanished. That is a failure, not a pass: a check whose subject has gone is not satisfied, and
 *   the alternative is a manifest that quietly shrinks to zero live entries;
 * - the pattern matches **more than once**, which makes "the claim" ambiguous and the capture a
 *   coin toss.
 *
 * ## Numbers are spelled out here, so the parser reads both
 *
 * The house voice writes small counts as words — "nine folders", "Seven rules", "thirteen §7
 * invariants". Restricting the gate to digits would have covered none of `apps/admin/CLAUDE.md`'s
 * or `apps/api/CLAUDE.md`'s claims, so `WORDS` maps the range the documents actually use.
 *
 * ## `--prove`, and why it runs on every invocation rather than as a second gate
 *
 * `boundaries:prove` and `eslint:prove` exist because a rule that matches nothing is
 * indistinguishable from a rule that passes. The same hazard lives here in a subtler form: a
 * pattern can match, capture the *wrong number in the sentence*, and agree with `actual()` by
 * coincidence — green, and checking nothing.
 *
 * So after every claim passes, each is re-run against a copy of the document with **that claim's
 * number changed**, and the run fails unless the check now fails. That proves the capture group is
 * anchored to the figure a human would edit. It is in-memory and instant, so it is part of
 * `docs:check` rather than a separate script — a prover nobody runs is worth nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, extname } from 'node:path';

const require = createRequire(import.meta.url);

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

/** `"44"` and `"Seven"` both become numbers; anything else is `null`, which is a failure. */
const toNumber = (raw) => {
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const i = WORDS.indexOf(raw.toLowerCase());
  return i === -1 ? null : i;
};

const toWordOrDigits = (n, sample) =>
  /^\d+$/.test(sample) ? String(n) : WORDS[n] ?? String(n);

// ── Computing the truth ─────────────────────────────────────────────────────────────────────────

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
};

const read = (path) => readFileSync(path, 'utf8');
const countIn = (path, re) => (read(path).match(re) ?? []).length;
const lines = (path) => read(path).split('\n').length - 1;

/** Files directly inside `<root>/<any one directory>/`, filtered. */
const componentsOf = (root, keep) =>
  readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(root, d.name)).map((f) => join(root, d.name, f)))
    .filter(keep);

const uiTsx = (f) => extname(f) === '.tsx';
const isSpec = (f) => f.endsWith('.spec.tsx');

const boundaryRules = () => require('../.dependency-cruiser.cjs').forbidden;

const directoriesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(dir, d.name));

/**
 * A feature folder that holds nothing but an `index.ts` and `.gitkeep`s is scaffolding — the shape
 * `one-kind-per-folder`'s `folder-scaffolds-go-when-built` says goes when the domain is built.
 */
const isScaffold = (dir) => walk(dir).every((f) => /\/(index\.ts|\.gitkeep)$/.test(f));

const apiContexts = ['core', 'identity', 'billing', 'platform'];
const apiModulesIn = (context) => directoriesIn(join('apps/api/src/modules', context)).length;

const gatesChain = () =>
  JSON.parse(read('package.json')).scripts.gates.split('&&').map((s) => s.trim());

/**
 * A task table's rows, and the top-level numbers over them — the plan files' two countable facts.
 * The pattern is the one the `DONE`-in-place claim above already uses, so a row shape that stops
 * matching stops matching for both rather than making one of them quietly count less.
 */
const planRows = (path) =>
  read(path)
    .split('\n')
    .map((line) => /^\|\s*\*{0,2}(\d+)(?:\.\d+)*\*{0,2}\s*\|/.exec(line))
    .filter(Boolean);
const archivedRows = () => planRows('docs/archived_tasks.md');
const archivedNumbers = () => new Set(archivedRows().map((m) => m[1]));

// ── The claims ──────────────────────────────────────────────────────────────────────────────────
//
// Add one whenever a document states a number a reader would act on. Leave one out where the
// number is illustrative rather than load-bearing ("~3,200 lines of convention" is an order of
// magnitude, and pinning it would fail on every paragraph anyone writes).

const CLAIMS = [
  // ── packages/ui/CLAUDE.md ──
  {
    what: 'packages/ui components',
    file: 'packages/ui/CLAUDE.md',
    pattern: /(\d+) components in nine folders/,
    actual: () => componentsOf('packages/ui/src', (f) => uiTsx(f) && !isSpec(f)).length,
  },
  {
    what: 'packages/ui spec files',
    file: 'packages/ui/CLAUDE.md',
    pattern: /nine folders, (\d+) spec files/,
    actual: () => componentsOf('packages/ui/src', isSpec).length,
  },
  {
    what: 'packages/ui token-cascade lines',
    file: 'packages/ui/CLAUDE.md',
    pattern: /`src\/styles\/tokens\.css` at (\d+) lines/,
    actual: () => lines('packages/ui/src/styles/tokens.css'),
  },
  {
    what: 'packages/ui barrel exports',
    file: 'packages/ui/CLAUDE.md',
    pattern: /The barrel — (\d+) exports/,
    actual: () => countIn('packages/ui/src/index.ts', /export/g),
  },
  {
    what: "packages/ui modules carrying 'use client'",
    file: 'packages/ui/CLAUDE.md',
    pattern: /\*\*(\d+) of the \d+ modules carry `'use client'`/,
    actual: () =>
      walk('packages/ui/src').filter((f) => /^'use client'/m.test(read(f))).length,
  },
  {
    what: 'packages/ui component total, as restated in the use-client sentence',
    file: 'packages/ui/CLAUDE.md',
    pattern: /\*\*\d+ of the (\d+) modules carry `'use client'`/,
    actual: () => componentsOf('packages/ui/src', (f) => uiTsx(f) && !isSpec(f)).length,
  },
  {
    what: 'packages/ui vocabulary modules',
    file: 'packages/ui/CLAUDE.md',
    pattern: /\*\*The (\w+) vocabularies live in directive-free/,
    actual: () => componentsOf('packages/ui/src', (f) => f.endsWith('-vocabulary.ts')).length,
  },
  {
    what: '@easyesg/ui/forms import sites in the apps',
    file: 'packages/ui/CLAUDE.md',
    pattern: /(\d+) import sites across the two apps today/,
    // Files that IMPORT the binding, which is what the document counts — not mentions of the entry point, which a
    // docblock naming it would add to (found 14 Sep 2026, when one sentence in A-07's form read as a 32nd site).
    actual: () =>
      ['apps/web/src', 'apps/admin/src']
        .flatMap((d) => walk(d))
        .filter((f) => /\.tsx?$/.test(f))
        .filter((f) => /from\s+['"]@easyesg\/ui\/forms['"]/.test(read(f))).length,
  },
  {
    // The opening paragraph said "these 46 files" beside a guarded "47 components" — the two
    // sentences were one line apart and only one of them could fail.
    what: 'packages/ui component total, as restated in the opening paragraph',
    file: 'packages/ui/CLAUDE.md',
    pattern: /\*these (\d+) components\*/,
    actual: () => componentsOf('packages/ui/src', (f) => uiTsx(f) && !isSpec(f)).length,
  },

  // ── CLAUDE.md (root) ──
  {
    what: 'no-restricted-syntax selectors',
    file: 'CLAUDE.md',
    pattern: /`pnpm eslint:prove` \((\d+) `no-restricted-syntax` selectors/,
    actual: () => countIn('eslint.config.mjs', /selector:/g),
  },
  {
    what: 'dependency-cruiser rules',
    file: 'CLAUDE.md',
    pattern: /`pnpm boundaries:prove` \((\d+) rules, each with a fixture/,
    actual: () => boundaryRules().length,
  },
  {
    what: 'config/seed artefacts',
    file: 'CLAUDE.md',
    // The task named moves with the count — 33.1 made it seventeen, 142 eighteen — so it is matched
    // as a shape rather than spelled, or every new artefact breaks this entry instead of the claim.
    pattern: /— (\w+) artefacts since task [\d.]+/,
    actual: () => readdirSync('config/seed').filter((f) => f.endsWith('.json')).length,
  },
  {
    what: 'api modules under src/modules',
    file: 'CLAUDE.md',
    pattern: /Module tree \((\d+) modules under `src\/modules\/`/,
    actual: () => walk('apps/api/src/modules').filter((f) => f.endsWith('.module.ts')).length,
  },
  {
    what: 'apps/web page.tsx routes',
    file: 'CLAUDE.md',
    pattern: /\| `apps\/web` \| (\d+) `page\.tsx` routes/,
    actual: () => walk('apps/web/src/app').filter((f) => f.endsWith('/page.tsx')).length,
  },
  {
    // **Third stale count in one session, so it graduates** (task 112's convention review, 11 Sep
    // 2026). The route-group count is stated in four places across three files and two of them were
    // left behind — including `apps/web/CLAUDE.md`'s enumeration table, which is where a new screen
    // is added from, and where a missing `(session-issuing)` row means a screen that issues a
    // session and is never gated. Counting directories rather than table rows is deliberate: the
    // filesystem is the thing the guard actually reads.
    what: 'apps/web route groups',
    file: 'CLAUDE.md',
    pattern: /\| `apps\/web` \| \d+ `page\.tsx` routes across (\w+) route groups/,
    actual: () =>
      walk('apps/web/src/app')
        .map((f) => f.split('/').slice(0, -1))
        .flat()
        .filter((segment) => segment.startsWith('(') && segment.endsWith(')'))
        .filter((segment, index, all) => all.indexOf(segment) === index).length,
  },
  {
    what: 'apps/web route groups, as counted by apps/web',
    file: 'apps/web/CLAUDE.md',
    pattern: /Route groups carry no URL segment, which is the whole reason there are (\w+)\./,
    actual: () =>
      walk('apps/web/src/app')
        .map((f) => f.split('/').slice(0, -1))
        .flat()
        .filter((segment) => segment.startsWith('(') && segment.endsWith(')'))
        .filter((segment, index, all) => all.indexOf(segment) === index).length,
  },
  {
    what: '§7 schema invariants',
    file: 'CLAUDE.md',
    pattern: /(\w+) §7 invariants each proving its own rule bites \(\d+ cases\)/,
    // One outer `describe('schema invariants (§7)')` wraps one inner block per rule.
    actual: () => countIn('apps/api/test/schema-invariants.e2e-spec.ts', /^\s*describe\(/gm) - 1,
  },
  {
    what: '§7 invariant cases',
    file: 'CLAUDE.md',
    pattern: /\w+ §7 invariants each proving its own rule bites \((\d+) cases\)/,
    actual: () => countIn('apps/api/test/schema-invariants.e2e-spec.ts', /^\s*it\(/gm),
  },
  {
    what: 'root scripts in the gates chain',
    file: 'CLAUDE.md',
    pattern: /The gate\nset is (\w+) root scripts plus three e2e suites/,
    actual: () => gatesChain().filter((s) => !/\be2e/.test(s)).length,
  },

  {
    // The wire contract's size (task 50.1.2, which found it unchecked when its four routes made it 93). It is the
    // emitted document, not the controllers, because the sentence is about `openapi/v1.json`, and `openapi:check`
    // already holds that file equal to what the controllers emit.
    what: 'OpenAPI paths in the committed contract',
    file: 'CLAUDE.md',
    pattern: /`openapi\/v1\.json` carries (\d+) paths/,
    actual: () => Object.keys(JSON.parse(read('packages/contracts/openapi/v1.json')).paths).length,
  },
  {
    what: 'OpenAPI paths under /auth',
    file: 'CLAUDE.md',
    pattern: /carries \d+ paths, (\d+) under `\/auth`/,
    actual: () =>
      Object.keys(JSON.parse(read('packages/contracts/openapi/v1.json')).paths).filter((path) =>
        path.startsWith('/api/v1/auth/'),
      ).length,
  },

  {
    // **The manifest checks its own size, and that is the gate's failing state.**
    // Every other entry here proves a document right. None of them notices if this array is
    // emptied: a `CLAIMS` with two entries left in it passes, prints a cheerful line, and checks
    // almost nothing — the exact shape of `domain-free-of-frameworks` shipping inert. Pinning the
    // count to a sentence a reader sees makes deletion a build failure. It is a fixpoint, not a
    // circularity: remove an entry and the computed length falls below what the document claims.
    what: 'the number of claims this gate checks',
    file: 'CLAUDE.md',
    pattern: /`pnpm docs:check` \((\d+) countable claims these/,
    actual: () => CLAIMS.length,
  },

  {
    // The plan's size, claimed by `CLAUDE.md` and computed from the plan. It read 77 for the
    // 23 tasks appended after that sentence was written — the first claim found that this gate
    // covered neither file for, because the manifest checked counts about *code* and this one is
    // about a tracking file.
    //
    // **It counts the union of the two plan files, and that is not an accident of the split.**
    // The claim exists to notice the plan *growing*. Counting only `task.md` would make the number
    // fall every time a task closes and its row moves to the archive — turning a staleness gate
    // into a churn gate that demands a `CLAUDE.md` edit per closed task. The union is invariant
    // under closing and moves only when work is appended, which is the event this was written for.
    what: 'top-level tasks across the two plan files',
    file: 'CLAUDE.md',
    pattern: /(\d+) tasks across the two plan files/,
    actual: () =>
      new Set(
        ['docs/task.md', 'docs/archived_tasks.md']
          .flatMap((p) => read(p).split('\n'))
          .map((l) => /^\|\s*\*{0,2}(\d+)(?:\.\d+)*\*{0,2}\s*\|/.exec(l))
          .filter(Boolean)
          .map((m) => m[1]),
      ).size,
  },

  {
    // **The split's failing state.** `task.md` holding only remaining work is an invariant, and
    // nothing stopped a row being marked `DONE` in place — which would rebuild, one row at a
    // time, exactly the file the split was made to end. A rule with no failing state is not one
    // (`boundaries:prove`, `eslint:prove`, and this manifest's own size claim above).
    //
    // It reads naturally at zero because `WORDS` maps `zero` → 0 and the prover mutates with
    // `actual + 1`, so the proof pass rewrites the sentence to `one` and the claim correctly fails.
    // **Groups, not rows — corrected 12 Sep 2026, the first time a sub-step closed.** The claim
    // began as "zero rows here carry DONE" and was wrong on its second day: task 67.2 closed while
    // 67.1 and its siblings stayed open, and a group travels whole (the archive's preamble says so,
    // and splitting one across the two files would put a parent's roll-up in a different file from
    // the rows it rolls up). A closed sub-step therefore BELONGS here, in the active plan, where a
    // reader needs to see which parts of an open task are done. What must never linger is a group
    // whose every row is closed — that is the archive's, and it is what this counts.
    what: 'fully closed groups left in the active plan',
    file: 'docs/task.md',
    pattern: /\*\*(\w+) fully closed groups remain here\*\*/,
    actual: () => {
      const status = new Map();
      for (const line of read('docs/task.md').split('\n')) {
        const m = /^\|\s*\*{0,2}(\d+)(?:\.\d+)*\*{0,2}\s*\|.*\|\s*([A-Z ]+?)\s*\|\s*$/.exec(line);
        if (!m) continue;
        (status.get(m[1]) ?? status.set(m[1], []).get(m[1])).push(m[2]);
      }
      return [...status.values()].filter((s) => s.every((v) => v === 'DONE')).length;
    },
  },

  // ── The archive's own size, claimed twice and guarded neither time until task 165 ──
  //
  // `archived_tasks.md`'s preamble and `task.md`'s opening sentence each state how much has closed,
  // and both were stale the moment task 50's group moved — 99/187 against an actual 100/197, for a
  // day, while the root `CLAUDE.md`'s copy of the same two numbers was updated in the same edit and
  // was right. That asymmetry is the whole argument: the guarded copy stayed true and the unguarded
  // ones did not, which is the 11 Sep audit's finding repeating rather than a new one.
  //
  // **Unlike the plan-size claim above, these move on every close**, and that is deliberate here.
  // That one counts the union so a closing task cannot churn it; these two are *about* the closing,
  // so a number that did not move would be the error. Closing a task already edits both files.
  {
    what: 'task numbers in the archive',
    file: 'docs/archived_tasks.md',
    pattern: /\*\*(\d+) task numbers, \d+ rows\*\*/,
    actual: () => archivedNumbers().size,
  },
  {
    what: 'rows in the archive',
    file: 'docs/archived_tasks.md',
    pattern: /\*\*\d+ task numbers, (\d+) rows\*\*/,
    actual: () => archivedRows().length,
  },
  {
    what: 'task numbers in the archive, as counted by the active plan',
    file: 'docs/task.md',
    pattern: /— (\d+) numbers and \d+ of them —/,
    actual: () => archivedNumbers().size,
  },
  {
    what: 'rows in the archive, as counted by the active plan',
    file: 'docs/task.md',
    pattern: /— \d+ numbers and (\d+) of them —/,
    actual: () => archivedRows().length,
  },

  // The 11 Sep 2026 audit found twelve stale numbers across the five files, and every one was
  // unguarded while every guarded one was right. These are the countable ones, added with the
  // sentences they pin rewritten to carry a figure a reader would act on.
  {
    what: 'applications, as counted by the root Current state',
    file: 'CLAUDE.md',
    pattern: /\*\*(\w+) applications and \w+ packages;/,
    actual: () => directoriesIn('apps').length,
  },
  {
    what: 'packages, as counted by the root Current state',
    file: 'CLAUDE.md',
    pattern: /\*\*\w+ applications and (\w+) packages;/,
    actual: () => directoriesIn('packages').length,
  },

  // ── apps/web/CLAUDE.md ──
  //
  // This document had **no entry at all** until the second audit of 8 Sep 2026, and it was the one
  // file holding a live wrong count — "invisible to all nine", correct on 24 Aug when the chain had
  // nine non-e2e scripts and thirteen by the time anyone looked. The manifest's coverage had been
  // chosen by where the first audit happened to be reading, which is the same defect one level up
  // from the claims it checks.
  {
    what: 'gates in the chain, as counted by apps/web',
    file: 'apps/web/CLAUDE.md',
    pattern: /was invisible to all (\w+) —/,
    actual: () => gatesChain().length,
  },
  {
    what: 'dependency-cruiser rules, as counted by apps/web',
    file: 'apps/web/CLAUDE.md',
    pattern: /Asserts each of the (\d+) rules still \*\*rejects\*\*/,
    actual: () => boundaryRules().length,
  },
  {
    what: 'page archetypes',
    file: 'apps/web/CLAUDE.md',
    pattern: /one of the (\w+) archetypes \(§4\.6\)/,
    actual: () => countIn('packages/ui/src/archetypes/README.md', /^\| `/gm),
  },
  {
    what: 'message catalogues',
    file: 'apps/web/CLAUDE.md',
    pattern: /all (\w+) separately authored, RO the source/,
    actual: () => readdirSync('apps/web/src/messages').filter((f) => f.endsWith('.json')).length,
  },
  {
    what: 'apps/web feature domains',
    file: 'apps/web/CLAUDE.md',
    pattern: /├─ features\/\s+(\d+) domains/,
    actual: () =>
      readdirSync('apps/web/src/features', { withFileTypes: true }).filter((d) => d.isDirectory())
        .length,
  },
  {
    what: 'apps/web feature folders, as counted by its opening sentence',
    file: 'apps/web/CLAUDE.md',
    pattern: /(\d+) feature folders \(\w+ built\)/,
    actual: () => directoriesIn('apps/web/src/features').length,
  },
  {
    what: 'apps/web feature folders that are built rather than scaffolded',
    file: 'apps/web/CLAUDE.md',
    pattern: /\d+ feature folders \((\w+) built\)/,
    actual: () => directoriesIn('apps/web/src/features').filter((d) => !isScaffold(d)).length,
  },
  {
    // "Only seven files here are Client Components" was true on 24 Aug 2026 and 59 by the time
    // anyone re-counted — the memoization paragraph it opens was describing a future that had
    // arrived, and nothing measured it.
    what: "apps/web modules carrying 'use client'",
    file: 'apps/web/CLAUDE.md',
    pattern: /\*\*(\d+) files here are Client Components\*\*/,
    actual: () =>
      walk('apps/web/src').filter((f) => /\.tsx?$/.test(f) && /^'use client'/m.test(read(f))).length,
  },

  // ── apps/api/CLAUDE.md ──
  {
    what: 'boundary rules governing apps/api',
    file: 'apps/api/CLAUDE.md',
    pattern: /\n(\w+), in `\.dependency-cruiser\.cjs`:/,
    actual: () =>
      boundaryRules().filter((r) => /apps\/api/.test(r.from.path ?? '') || !r.from.path).length,
  },
  {
    what: 'apps/api boundary rules, as restated in the fixture sentence',
    file: 'apps/api/CLAUDE.md',
    pattern: /All (\w+) have a fixture in `tools\/prove-boundaries\.sh`/,
    actual: () =>
      boundaryRules().filter((r) => /apps\/api/.test(r.from.path ?? '') || !r.from.path).length,
  },
  // The tree line in "Where things live" said `identity/(5) … 35 total` for a day after task 131
  // added `identity/access` — the root's `40 modules` was guarded and moved; this line was not.
  ...apiContexts.map((context) => ({
    what: `apps/api modules under ${context}/, as drawn in Where things live`,
    file: 'apps/api/CLAUDE.md',
    pattern: new RegExp(`├─ modules/\\s+(?:\\w+/\\(\\d+\\) )*${context}/\\((\\d+)\\)`),
    actual: () => apiModulesIn(context),
  })),
  {
    what: 'apps/api leaf modules in total, as drawn in Where things live',
    file: 'apps/api/CLAUDE.md',
    pattern: /platform\/\(\d+\) — (\d+), plus the four context modules/,
    actual: () => apiContexts.reduce((n, context) => n + apiModulesIn(context), 0),
  },

  // ── apps/admin/CLAUDE.md ──
  {
    what: 'boundary rules governing apps/admin',
    file: 'apps/admin/CLAUDE.md',
    pattern: /\| (\w+) rules govern this app — see below \|/,
    actual: () =>
      boundaryRules().filter(
        (r) => /apps\/admin/.test(r.from.path ?? '') || /apps\/admin/.test(r.to.path ?? ''),
      ).length,
  },
];

// ── The run ─────────────────────────────────────────────────────────────────────────────────────

/** Extract the claimed number, or say precisely why the claim could not be read. */
const extract = (text, claim) => {
  // `d` for the capture's own offsets, which the prove pass mutates at (task 147).
  const found = [...text.matchAll(new RegExp(claim.pattern, 'gd'))];
  if (found.length === 0) {
    return { error: 'the pattern matches nothing — the prose changed; update this entry' };
  }
  if (found.length > 1) {
    return { error: `the pattern matches ${found.length} times, so "the claim" is ambiguous` };
  }
  const raw = found[0][1];
  const value = toNumber(raw);
  if (value === null) return { error: `"${raw}" is not a number this parser knows` };
  return { raw, value, match: found[0] };
};

const failures = [];
const texts = new Map();

for (const claim of CLAIMS) {
  if (!texts.has(claim.file)) texts.set(claim.file, read(claim.file));
  const text = texts.get(claim.file);
  const got = extract(text, claim);
  if (got.error) {
    failures.push(`${claim.file} — ${claim.what}: ${got.error}`);
    continue;
  }
  const actual = claim.actual();
  if (got.value !== actual) {
    failures.push(
      `${claim.file} — ${claim.what}: the document says ${got.raw} (${got.value}); ` +
        `the repository has ${actual}`,
    );
    continue;
  }

  // The prove pass: change the number in a copy and require the check to notice. **At the capture group's own
  // offsets**, not the figure's first occurrence in the match — which is what this did until task 147, when
  // `core/(9) … platform/(9)` put the same figure twice in one match and the mutation edited the wrong one, so a
  // correct entry read as INERT. The false alarm was the safe direction; a mutation landing on a figure the pattern
  // does not read is not.
  const mutantRaw = toWordOrDigits(actual + 1, got.raw);
  const [start, end] = got.match.indices[1];
  const mutated = text.slice(0, start) + mutantRaw + text.slice(end);
  const remeasured = extract(mutated, claim);
  if (remeasured.error || remeasured.value === actual) {
    failures.push(
      `${claim.file} — ${claim.what}: INERT. Changing the number to "${mutantRaw}" did not change ` +
        `what the pattern reads, so this entry proves nothing. Its capture group is not on the ` +
        `figure a reader would edit.`,
    );
  }
}

if (failures.length > 0) {
  console.error(`docs:check — ${failures.length} of ${CLAIMS.length} claims failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    '\nFix the document, or fix the entry in tools/check-docs-claims.mjs if the prose moved.',
  );
  process.exit(1);
}

console.log(
  `docs:check — ${CLAIMS.length} claims across ${texts.size} documents agree with the repository, ` +
    'and each was proven to notice a changed number.',
);
