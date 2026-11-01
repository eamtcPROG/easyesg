import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { RULE_SET_READ, evaluateRules, readRuleSet, type FieldValue } from '@easyesg/validation';

/**
 * **The browser application's half of task 40.3's proof** (FR-73 AC-1, FR-40 AC-6; `architecture.md` §9.8, §12.5.6's
 * task-40 row): the shared rule corpus, evaluated by the interpreter as this application's tests load it — the
 * package's **source**, through `vitest.config.ts`'s alias, in the jsdom environment the wizard's specs run in — and
 * every case's findings equal to the ones it states. `apps/api/src/modules/core/validation/rule-corpus.spec.ts` runs the
 * same files against the package's CommonJS build, and both run in `pnpm test`: each runtime agreeing with the stated
 * findings is what makes the two agree with each other.
 *
 * **In `src/test/`**, the files-only leaf that is nobody's feature: its subject is the shared package in this
 * application's runtime, not a screen, and `features/validation` holds nothing until task 42 builds it.
 *
 * **The directory is read, not a list**, so a case file added to the corpus is in this proof with no edit here — found
 * through the package's own location, as Node resolves it from this application.
 */
interface CorpusCase {
  readonly name: string;
  readonly rules: unknown;
  readonly scope: readonly string[];
  readonly values: readonly FieldValue[];
  readonly prior?: readonly FieldValue[];
  readonly findings: readonly unknown[];
}

const CORPUS = resolve(dirname(createRequire(import.meta.url).resolve('@easyesg/validation/package.json')), 'corpus');
const FILES = readdirSync(CORPUS).filter((name) => name.endsWith('.json')).sort();

it('finds the corpus', () => {
  // A directory that moved would otherwise leave `describe.each` with nothing to run, and an empty table is no test.
  expect(FILES.length).toBeGreaterThan(0);
});

describe.each(FILES)('the rule corpus: %s', (file) => {
  const { cases } = JSON.parse(readFileSync(resolve(CORPUS, file), 'utf8')) as { readonly cases: readonly CorpusCase[] };

  it.each(cases.map((corpusCase) => [corpusCase.name, corpusCase] as const))('%s', (_, corpusCase) => {
    const reading = readRuleSet(corpusCase.rules);
    if (reading.outcome !== RULE_SET_READ.READ) throw new Error(`rules refused: ${JSON.stringify(reading.problems)}`);
    const findings = evaluateRules({
      ruleSet: reading.ruleSet,
      scope: new Set(corpusCase.scope),
      values: corpusCase.values,
      prior: corpusCase.prior,
    });
    expect(findings).toEqual(corpusCase.findings);
  });
});
