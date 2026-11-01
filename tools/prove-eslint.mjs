#!/usr/bin/env node
// Proves each `no-restricted-syntax` selector in eslint.config.mjs rejects a real violation.
//
// The sibling of `tools/prove-boundaries.sh`, for the same reason and against the same failure:
// CLAUDE.md's *"a rule that silently matches nothing looks identical to a rule that passes"*. A
// dependency-cruiser rule and an ESLint selector are both configuration that can stop matching
// without stopping parsing, and neither has a failing state of its own.
//
// **It exists because it already happened, in the change that added the newest selector**
// (7 Sep 2026, `docs/build-log.md`, "`Slot` in a client boundary"). The client-boundary namespace
// branch was written as `MemberExpression[property.name='Slot']`; `<Radix.Slot.Root>` parses as a
// **`JSXMemberExpression`**, so the branch could not see the one spelling it existed for. It read
// correctly, passed `pnpm lint`, and matched nothing. A hand-planted probe found it, and the probe
// was then deleted — which is exactly the proof that cannot catch the next one.
//
// Two things make this file necessary rather than merely tidy:
//
//   - **`eslint.config.mjs` is in its own `ignores` list**, so `pnpm lint` never parses the file's
//     own selectors. Nothing else in the gate set ever fires them against a matching file.
//   - **All fourteen selectors share one rule id.** `no-restricted-syntax` reports every entry
//     under the same `ruleId`, so a fixture is matched on its selector's own MESSAGE. That is not
//     a weakness: rewording a message is a deliberate act, and being made to revisit the fixture
//     while doing it is the point.
//
// **Node rather than bash, unlike its sibling.** The fixture half would be bash; the structural
// half below cannot be, because it imports the flat config and compares selector sets per block.
// Splitting the two would give the spread check its own file and its own chance to rot.
//
// It writes fixture files into the working tree and removes them, so — exactly as
// `tools/gates-scoped.sh` already records for `boundaries:prove` — it can never run beside a
// linter. Keep it sequential.

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

let failed = 0;
const report = (ok, line) => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? '[32mok[0m   ' : '[31mFAIL[0m '} ${line}`);
};

// ── The selectors, by id ─────────────────────────────────────────────────────────────────────
//
// Keyed on the EXACT selector string, so a selector edited in `eslint.config.mjs` without its
// fixture being revisited shows up below as an unknown selector rather than as a silent pass.
// That is the drift half of this gate: an inert selector is caught by its fixture, and a selector
// nobody has thought about is caught here.
const SELECTORS = {
  'vocab-union-alias': `TSTypeAliasDeclaration > TSUnionType > TSLiteralType > Literal[raw=/^['"]/]`,
  'vocab-union-property': `TSPropertySignature > TSTypeAnnotation > TSUnionType > TSLiteralType > Literal[raw=/^['"]/]`,
  'vocab-comparison': `BinaryExpression[operator=/^[!=]==$/][left.operator!="typeof"] > Literal[raw=/^['"]/][value!='']`,
  'vocab-jsx-attribute': `JSXAttribute[name.name=/^(intent|variant|tone)$/] > Literal[raw=/^['"]/]`,
  'vocab-client-module': `Program:has(> ExpressionStatement[directive='use client']) > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > TSAsExpression`,
  'slot-import': `Program:has(> ExpressionStatement[directive='use client']) > ImportDeclaration:matches([source.value='@radix-ui/react-slot'], [source.value='radix-ui']:has(ImportSpecifier[imported.name='Slot']))`,
  'slot-namespace': `Program:has(> ExpressionStatement[directive='use client']) :matches(MemberExpression, JSXMemberExpression)[property.name='Slot']`,
  'format-tofixed': `CallExpression > MemberExpression[property.name="toFixed"]`,
  'format-tolocale': `CallExpression > MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]`,
  'format-intl': `NewExpression[callee.object.name="Intl"]`,
  'text-jsx-text': `JSXText[value=/[^\\s]/]`,
  'text-attribute': `JSXAttribute[name.name=/^(title|placeholder|aria-label|aria-description|aria-placeholder|aria-valuetext|aria-roledescription)$/] > Literal`,
  'text-alt': `JSXAttribute[name.name='alt'] > Literal[value!='']`,
  'use-cache': `ExpressionStatement > Literal[value="use cache"]`,
  'form-method': `JSXOpeningElement[name.name="form"]:not(:has(JSXAttribute[name.name="method"])):not(:has(JSXAttribute[name.name="action"]))`,
}

const ID_BY_SELECTOR = new Map(Object.entries(SELECTORS).map(([id, sel]) => [sel, id]));

/** A distinctive phrase from each selector's own message — how a fixture says WHICH one fired. */
const ANCHOR = {
  'vocab-union-alias': 'never as a hand-written union of string literals — a union',
  'vocab-union-property': 'never as a hand-written union of string literals on a',
  'vocab-comparison': 'Comparing against a string literal',
  'vocab-jsx-attribute': 'and a JSX attribute is a site',
  'vocab-client-module': 'may not be declared in a module carrying',
  'slot-import': 'it INTROSPECTS it',
  'slot-namespace': 'the namespace spelling is the same violation',
  'format-tofixed': 'no hardcoded format pattern',
  'format-tolocale': 'formatting is derived from the active locale',
  'format-intl': 'formatter constructed here is a format pattern in a component',
  'text-jsx-text': 'Every string a person reads is a message key resolved',
  'text-attribute': 'an attribute is still text a person reads',
  'text-alt': 'alt text is read aloud',
  'use-cache': 'Cache Components are disabled as a security rule',
  'form-method': 'puts every field in the URL',
};

// ── The spread: which selectors each config block must carry ─────────────────────────────────
//
// **This half is not about the selectors at all — it is about the places they are spread into.**
// `no-restricted-syntax` options REPLACE rather than merge, which `eslint.config.mjs`
// documents at length, and the change that added `restrictedSyntaxClientBoundary` still spread it
// into three blocks out of four. A fixture per (selector x block) would be seventy runs; the
// matrix below is the same assertion at no cost, and it fails on a block APPEARING as loudly as on
// a missing spread — which is what "revisit the spreads" has to mean mechanically. It caught task
// 32.4's carve-out on the run that added it, which is the intended behaviour rather than an
// inconvenience: a new block is a new set of files somebody decided the rules apply differently
// to, and it has to be read before it is recorded.
const VOCABULARY = [
  'vocab-union-alias',
  'vocab-union-property',
  'vocab-comparison',
  'vocab-jsx-attribute',
  'vocab-client-module',
];
const CLIENT_BOUNDARY = ['slot-import', 'slot-namespace'];
const FORMATTING = ['format-tofixed', 'format-tolocale', 'format-intl'];
const TEXT = ['text-jsx-text', 'text-attribute', 'text-alt'];
/**
 * §14.2's cache ban — its own constant since 7 Sep 2026, on both sides of this gate.
 *
 * It was written inline here (`'use-cache'`) and inline in `eslint.config.mjs`, which is what let
 * task 32.4's carve-out block drop a **security** selector while respreading all four named
 * constants faithfully. Naming it makes it something a new block has to answer for.
 */
const CACHE = ['use-cache'];

/**
 * Task 96's selector. Browser tier and `apps/web` only — `<form>` exists nowhere else, and specs
 * are exempt for the reason the text selectors are: a spec's JSX fixture is not a shipped form.
 */
const FORMS = ['form-method'];

const EXPECTED_BLOCKS = [
  {
    name: 'every workspace',
    files: ['**/*.{ts,tsx}'],
    selectors: [...VOCABULARY, ...CLIENT_BOUNDARY],
  },
  {
    name: 'browser tier',
    files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    selectors: [...FORMATTING, ...TEXT, ...VOCABULARY, ...CLIENT_BOUNDARY, ...FORMS],
  },
  {
    name: 'apps/web (Next only)',
    files: ['apps/web/**/*.{ts,tsx}'],
    selectors: [...CACHE, ...FORMATTING, ...TEXT, ...VOCABULARY, ...CLIENT_BOUNDARY, ...FORMS],
  },
  {
    // Specs keep the formatting bans (a spec asserting a formatted value is still an NFR-26
    // violation) and drop the text and vocabulary ones (a spec asserts a wire literal on purpose).
    // The client-boundary pair is NOT dropped, and the asymmetry is reasoned in place: nothing
    // legitimately writes `'use client'` beside a `Slot` import in a vitest file.
    name: 'browser-tier specs',
    files: [
      'apps/web/**/*.spec.{ts,tsx}',
      'apps/admin/**/*.spec.{ts,tsx}',
      'packages/ui/**/*.spec.{ts,tsx}',
    ],
    selectors: [...FORMATTING, ...CLIENT_BOUNDARY],
  },
  {
    /*
     * The one module that may construct an `Intl` formatter (task 32.4). `todayIn` answers *which
     * calendar day is it in this IANA zone*, which is what NFR-34 requires of a legal date and is
     * not something a reader sees; `architecture.md` §12.5.6 carries the decision.
     *
     * **The narrowness is proved HERE rather than by a fixture, and this matrix is the better
     * proof.** A fixture would have to be written at this exact path, which is a real source file
     * — so it would clobber the module under test. The list below is read out of the resolved
     * config, so it fails if `format-intl` is ever spread back in, if `format-tofixed` or
     * `format-tolocale` is dropped, or if the exemption is widened to a second path.
     */
    name: 'apps/web/src/lib/legal-date.ts (NFR-26 Intl carve-out)',
    files: ['apps/web/src/lib/legal-date.ts'],
    selectors: [
      // `CACHE` is listed FIRST and deliberately: this block replaces the `apps/web` one for this
      // path, and the first draft of both it and this entry omitted §14.2's security selector —
      // caught by review rather than by this gate, because a matrix that records the hole asserts
      // it. Its presence here is now the thing that fails if the carve-out loses it again.
      ...CACHE,
      ...FORMATTING.filter((id) => id !== 'format-intl'),
      ...TEXT,
      ...VOCABULARY,
      ...CLIENT_BOUNDARY,
      ...FORMS,
    ],
  },
];

// ── The fixtures ─────────────────────────────────────────────────────────────────────────────
//
// Written into the tree at run time and removed, never committed as files: a committed fixture is
// a deliberate violation sitting in `src/`, so `pnpm lint` would fail on the gate's own evidence.
//
// **Each positive is placed in the workspace whose BLOCK it exercises**, so the set covers all
// four blocks as a side effect of covering the selectors — `packages/validation` reaches the
// general block, `apps/admin` and `packages/ui` the browser tier, `apps/web` its own, and a
// `.spec` pair the fourth.
//
// A negative fixture in the browser tier must contain no JSX text, no allow-listed attribute and
// no literal union: those blocks carry the text and vocabulary selectors too, and a negative that
// trips a DIFFERENT selector would report as a failure of the one under test.
//
// **Nothing is written into `apps/api/src`, and that is the sibling's hardest-won lesson rather
// than a preference.** `prove-boundaries.sh` records it: fixtures land in WATCHED trees, and a
// running `nest start --watch` COMPILED its api fixture and left stray `index.js`/`.d.ts` emits
// that failed lint one gates run later. Its fix was excluding `**/__boundary_fixture.ts` from both
// api tsconfigs — an exact filename, which `__eslint_fixture_*.ts` would not match, so inheriting
// the protection was never on offer. Excluding these too is not available either: they must stay
// inside a tsconfig program or `projectService` cannot lint them at all. So the general block is
// exercised from `packages/validation` instead, which no watcher EMITS from. `apps/web` and
// `packages/ui` are watched as well, and are fine for the reason the sibling already writes into
// them: Turbopack recompiles in memory and emits nothing into the tree.
const FIXTURES = [
  // ── the general block: packages/validation ────────────────────────────────────────────────
  {
    id: 'vocab-union-alias',
    block: 'every workspace',
    file: 'packages/validation/src/__eslint_fixture_union_alias.ts',
    content: `export type FixtureStatus = 'active' | 'archived';\n`,
  },
  {
    id: 'vocab-union-property',
    block: 'every workspace',
    file: 'packages/validation/src/__eslint_fixture_union_property.ts',
    content: `export interface FixtureRule {\n  kind: 'required' | 'range';\n}\n`,
  },
  {
    id: 'vocab-comparison',
    block: 'every workspace',
    file: 'packages/validation/src/__eslint_fixture_comparison.ts',
    content: `export const isWorker = String(process.env.MODE) === 'worker';\n`,
  },
  // ── the browser tier: apps/admin, packages/ui ──────────────────────────────────────────────
  {
    id: 'form-method',
    block: 'browser tier',
    file: 'apps/admin/src/__eslint_fixture_form_method.tsx',
    content:
      `export const fixture = (\n` +
      `  <form onSubmit={() => undefined}>\n` +
      `    <input name="password" type="password" />\n` +
      `  </form>\n);\n`,
  },
  {
    id: 'vocab-jsx-attribute',
    block: 'browser tier',
    file: 'apps/admin/src/__eslint_fixture_jsx_attribute.tsx',
    content:
      `function FixtureCallout(props: { intent: string }) {\n` +
      `  return <span data-intent={props.intent} />;\n}\n\n` +
      `export const fixture = <FixtureCallout intent="error" />;\n`,
  },
  {
    id: 'vocab-client-module',
    block: 'browser tier',
    file: 'packages/ui/src/__eslint_fixture_client_vocabulary.ts',
    content: `'use client';\n\nexport const FIXTURE_TONE = { BAND: 'band' } as const;\n`,
  },
  {
    id: 'slot-import',
    block: 'browser tier',
    file: 'packages/ui/src/__eslint_fixture_slot_import.tsx',
    content:
      `'use client';\n\nimport { Slot } from 'radix-ui';\nimport type { ReactNode } from 'react';\n\n` +
      `export function FixtureSlot({ children }: { children: ReactNode }) {\n` +
      `  return <Slot.Root>{children}</Slot.Root>;\n}\n`,
  },
  {
    id: 'format-tolocale',
    block: 'browser tier',
    file: 'packages/ui/src/__eslint_fixture_tolocale.ts',
    content: `export const fixture = new Date().toLocaleDateString();\n`,
  },
  {
    id: 'format-intl',
    block: 'browser tier',
    file: 'apps/admin/src/__eslint_fixture_intl.ts',
    content: `export const fixture = new Intl.NumberFormat('ro-MD');\n`,
  },
  {
    id: 'text-attribute',
    block: 'browser tier',
    file: 'apps/admin/src/__eslint_fixture_text_attribute.tsx',
    content: `export const fixture = <span title="Sign in to continue" />;\n`,
  },
  {
    id: 'text-alt',
    block: 'browser tier',
    file: 'packages/ui/src/__eslint_fixture_alt.tsx',
    content: `export const fixture = <img src="/fixture.png" alt="A bakery in Chisinau" />;\n`,
  },
  {
    // In `packages/ui` rather than in `apps/web`, whose block it would otherwise have exercised:
    // only `packages/ui` declares `radix-ui`, and a fixture reaching for an undeclared package is
    // a phantom dependency — the coupling DR-1/AD-1 and pnpm's strictness exist to prevent. The
    // apps/web block is exercised by four other fixtures, and the matrix above is what actually
    // asserts this selector reaches it.
    id: 'slot-namespace',
    block: 'browser tier',
    file: 'packages/ui/src/__eslint_fixture_slot_namespace.tsx',
    content:
      `'use client';\n\nimport * as Radix from 'radix-ui';\nimport type { ReactNode } from 'react';\n\n` +
      `export function FixtureNamespaceSlot({ children }: { children: ReactNode }) {\n` +
      `  return <Radix.Slot.Root>{children}</Radix.Slot.Root>;\n}\n`,
  },
  // ── apps/web's own block ───────────────────────────────────────────────────────────────────
  {
    id: 'format-tofixed',
    block: 'apps/web (Next only)',
    file: 'apps/web/src/__eslint_fixture_tofixed.ts',
    content: `export const fixture = Number(1).toFixed(2);\n`,
  },
  {
    id: 'text-jsx-text',
    block: 'apps/web (Next only)',
    file: 'apps/web/src/__eslint_fixture_jsx_text.tsx',
    content: `export const fixture = <p>Add your first entity</p>;\n`,
  },
  {
    // The one security selector in the file (§14.2, AD-9), and the reason this fixture set is not
    // scoped to the four shared constants: a cross-tenant cache leak is the most expensive thing
    // any of these guards, and it was the only selector with no proof of its own.
    id: 'use-cache',
    block: 'apps/web (Next only)',
    file: 'apps/web/src/__eslint_fixture_use_cache.ts',
    content: `'use cache';\n\nexport const fixture = 1;\n`,
  },
  // ── the fourth block: browser-tier specs ───────────────────────────────────────────────────
  //
  // The block that was missed when `restrictedSyntaxClientBoundary` was first spread. It comes
  // LAST in the flat config and therefore REPLACES the three above for these files, so a selector
  // proven in `packages/ui/src/x.tsx` says nothing about `packages/ui/src/x.spec.tsx`.
  {
    id: 'slot-import',
    block: 'browser-tier specs',
    file: 'packages/ui/src/__eslint_fixture_slot.spec.tsx',
    content: `'use client';\n\nimport { Slot } from 'radix-ui';\n\nexport const fixture = Slot;\n`,
  },
  {
    id: 'format-tofixed',
    block: 'browser-tier specs',
    file: 'apps/web/src/__eslint_fixture_tofixed.spec.ts',
    content: `export const fixture = Number(1).toFixed(2);\n`,
  },
];

// ── The carve-outs, each of which must still PASS ────────────────────────────────────────────
//
// A selector that over-matches is the other way this file can be wrong, and the expensive one:
// it trains the inline disable, which is how a rule stops being read. Every entry here is a
// carve-out documented in `eslint.config.mjs` beside the selector it belongs to.
const NEGATIVES = [
  {
    what: 'alt="" — the required marking for a decorative image',
    file: 'packages/ui/src/__eslint_fixture_neg_alt.tsx',
    content: `export const fixture = <img src="/fixture.png" alt="" />;\n`,
  },
  {
    what: `x === '' — a length test, not a vocabulary member`,
    file: 'packages/validation/src/__eslint_fixture_neg_empty.ts',
    content: `export const fixture = String(process.env.MODE) === '';\n`,
  },
  {
    what: 'a typeof check',
    file: 'packages/validation/src/__eslint_fixture_neg_typeof.ts',
    content: `export const fixture = typeof globalThis === 'object';\n`,
  },
  {
    what: `Pick<T, 'a' | 'b'> / Omit<T, 'a'> — key unions, with no as const form`,
    file: 'packages/validation/src/__eslint_fixture_neg_key_unions.ts',
    content:
      `interface FixtureRow {\n  a: number;\n  b: number;\n}\n\n` +
      `export type FixturePicked = Pick<FixtureRow, 'a' | 'b'>;\n` +
      `export type FixtureOmitted = Omit<FixtureRow, 'a'>;\n`,
  },
  {
    what: 'a JSX attribute outside the intent|variant|tone allowlist',
    file: 'packages/ui/src/__eslint_fixture_neg_align.tsx',
    content:
      `function FixtureMenu(props: { align: string }) {\n` +
      `  return <span data-align={props.align} />;\n}\n\n` +
      `export const fixture = <FixtureMenu align="end" />;\n`,
  },
  {
    what: 'a directive-free module importing Slot — what Button and TextLink actually are',
    file: 'packages/ui/src/__eslint_fixture_neg_slot.tsx',
    content:
      `import { Slot } from 'radix-ui';\nimport type { ReactNode } from 'react';\n\n` +
      `export function FixtureSlot({ children }: { children: ReactNode }) {\n` +
      `  return <Slot.Root>{children}</Slot.Root>;\n}\n`,
  },
  {
    what: `a 'use client' module importing another Radix part by name`,
    file: 'packages/ui/src/__eslint_fixture_neg_dropdown.tsx',
    content: `'use client';\n\nimport { DropdownMenu } from 'radix-ui';\n\nexport const fixture = DropdownMenu.Root;\n`,
  },
  {
    what: `a 'use client' module reaching another Radix part by namespace`,
    file: 'packages/ui/src/__eslint_fixture_neg_namespace.tsx',
    content: `'use client';\n\nimport * as Radix from 'radix-ui';\n\nexport const fixture = Radix.DropdownMenu.Root;\n`,
  },
  {
    // The fourth block's own exemption, which is a decision and therefore needs a proof: a spec
    // asserts the wire value on purpose (CLAUDE.md's stated exception to the vocabulary rule).
    what: 'a spec asserting a wire literal — the vocabulary exemption specs are given',
    file: 'packages/ui/src/__eslint_fixture_neg_exempt.spec.tsx',
    content:
      `export type FixtureStatus = 'active' | 'archived';\n\n` +
      `function FixtureCallout(props: { intent: string }) {\n` +
      `  return <span data-intent={props.intent} />;\n}\n\n` +
      `export const fixture = <FixtureCallout intent="error" />;\n`,
  },
];

// ── Run ──────────────────────────────────────────────────────────────────────────────────────

const written = [];
const write = ({ file, content }) => {
  mkdirSync(dirname(join(ROOT, file)), { recursive: true });
  writeFileSync(join(ROOT, file), content);
  written.push(file);
};
const cleanup = () => {
  for (const file of written) rmSync(join(ROOT, file), { force: true });
  // Parity with the sibling's `rmdir -p`: remove a directory a fixture had to create, so a proof
  // run leaves the tree exactly as it found it. Moot while all four fixture directories exist,
  // and free.
  for (const file of written) {
    try {
      rmdirSync(dirname(join(ROOT, file)));
    } catch {
      /* not empty, or never created by us — the correct outcome */
    }
  }
};
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

console.log('Proving the no-restricted-syntax selectors bite:\n');

// 1 ── the spread, read from the resolved config rather than from this file's memory of it.
const config = (await import('../eslint.config.mjs')).default;
const actualBlocks = config
  .filter((block) => block.rules?.['no-restricted-syntax'])
  .map((block) => ({
    files: block.files ?? [],
    // Element 0 is the severity.
    selectors: block.rules['no-restricted-syntax'].slice(1).map((entry) => entry.selector),
  }));

console.log('The spread — which block carries which selector:');
if (actualBlocks.length !== EXPECTED_BLOCKS.length) {
  report(
    false,
    `${actualBlocks.length} blocks set no-restricted-syntax, expected ${EXPECTED_BLOCKS.length}. ` +
      'A block was added or removed: revisit every spread, then update EXPECTED_BLOCKS here.',
  );
} else {
  for (const [index, expected] of EXPECTED_BLOCKS.entries()) {
    const actual = actualBlocks[index];
    const sameFiles = JSON.stringify(actual.files) === JSON.stringify(expected.files);
    const ids = actual.selectors.map((selector) => ID_BY_SELECTOR.get(selector) ?? `?${selector}`);
    const unknown = ids.filter((id) => id.startsWith('?'));
    const missing = expected.selectors.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !id.startsWith('?') && !expected.selectors.includes(id));

    if (!sameFiles) {
      report(false, `block ${index} (${expected.name}) — files changed: ${JSON.stringify(actual.files)}`);
    } else if (unknown.length > 0) {
      report(
        false,
        `block ${index} (${expected.name}) — ${unknown.length} selector(s) this gate does not know. ` +
          'A selector was edited or added: give it an id, a fixture and an anchor here.',
      );
    } else if (missing.length > 0) {
      report(
        false,
        `block ${index} (${expected.name}) — NOT spread into it: ${missing.join(', ')}. ` +
          'Rule options replace rather than merge, so these files are uncovered.',
      );
    } else if (extra.length > 0) {
      report(false, `block ${index} (${expected.name}) — unexpected: ${extra.join(', ')}`);
    } else {
      report(true, `block ${index} (${expected.name}) carries all ${ids.length}`);
    }
  }
}

// 2 ── the selectors themselves. One eslint run over every fixture: unlike depcruise, which must
//      re-cruise the whole graph to see a new file, eslint takes explicit paths and the files are
//      independent of each other — so the sibling's per-fixture loop would buy nothing and pay a
//      type-aware startup each time.
for (const fixture of [...FIXTURES, ...NEGATIVES]) write(fixture);

const eslint = spawnSync(
  'pnpm',
  ['exec', 'eslint', '--no-cache', '--format', 'json', ...[...FIXTURES, ...NEGATIVES].map((f) => f.file)],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

let results;
try {
  results = JSON.parse(eslint.stdout);
} catch {
  console.error('\neslint produced no parseable JSON. stderr:\n');
  console.error(eslint.stderr);
  process.exit(1);
}

const resultFor = (file) => results.find((r) => r.filePath === join(ROOT, file));

/**
 * Did eslint actually EVALUATE this file — as against reporting nothing about it?
 *
 * **The gate's own failure mode, found inside the gate by its own review.** A negative fixture
 * asserts "no `no-restricted-syntax` finding", and three very different things produce that: the
 * carve-out held (what is meant), the file failed to parse, and the file matched one of
 * `eslint.config.mjs`'s `ignores` globs. The last two report a single message with `ruleId: null` —
 * which the rule-id filter drops — so a carve-out check would print `ok` having proven nothing.
 * Proven, not theorised: a fixture with a syntax error *containing a real violation* reported
 * `{ruleId: null, fatal: true}` and nothing else. None of the nine is exposed today; the point is
 * that nothing stopped one being.
 *
 * A positive fixture fails loudly under the same conditions, so this guard is what makes the two
 * halves equally honest.
 */
const evaluated = (file) => {
  const result = resultFor(file);
  if (!result) return 'eslint reported nothing at all for it';
  const inert = result.messages.find((m) => m.ruleId === null);
  if (inert) return `eslint did not lint it: ${inert.message.split('\n')[0]}`;
  return null;
};

const findingsFor = (file) =>
  (resultFor(file)?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax');

console.log('\nSelectors, each against a violation of its own:');
for (const fixture of FIXTURES) {
  const unevaluated = evaluated(fixture.file);
  if (unevaluated) {
    report(false, `${fixture.id} — ${unevaluated} (${fixture.file})`);
    continue;
  }
  const anchor = ANCHOR[fixture.id];
  const hit = findingsFor(fixture.file).some((m) => m.message.includes(anchor));
  report(
    hit,
    hit
      ? `${fixture.id} rejects its violation (${fixture.block})`
      : `${fixture.id} did NOT reject its violation in the "${fixture.block}" block — ` +
        'the selector matches nothing, or its message no longer contains this fixture\'s anchor',
  );
}

console.log('\nCarve-outs, each of which must still pass:');
for (const negative of NEGATIVES) {
  // The evaluation guard FIRST, because "no findings" is what a file eslint never looked at also
  // reports — see `evaluated`. Without this the nine checks below could all pass having proven
  // nothing, which is the shape this whole gate exists to refuse.
  const unevaluated = evaluated(negative.file);
  if (unevaluated) {
    report(false, `${negative.what} — ${unevaluated} (${negative.file})`);
    continue;
  }
  const findings = findingsFor(negative.file);
  report(
    findings.length === 0,
    findings.length === 0
      ? `${negative.what}`
      : `${negative.what} — over-matched by: ${findings.map((m) => m.message.slice(0, 60)).join(' | ')}`,
  );
}

if (failed > 0) {
  console.log(
    `\n[31m${failed} check(s) failed.[0m A selector that matches nothing looks exactly ` +
      'like a clean tree.\nFix the rule, not the fixture.',
  );
  process.exit(1);
}

console.log('\nEvery selector rejects its violation, and every carve-out still passes.');
