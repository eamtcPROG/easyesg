import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RULE_SET_READ, evaluateRules, readRuleSet, type FieldValue } from '@easyesg/validation';

/**
 * **The api's half of task 40.3's proof** (FR-73 AC-1, FR-40 AC-6; `architecture.md` §9.8, §12.5.6's task-40 row):
 * the shared rule corpus, evaluated by the interpreter as this application loads it — jest resolves
 * `@easyesg/validation` through the package's `require` condition to its **CommonJS build**, which `pretest` makes —
 * and every case's findings equal to the ones it states. `apps/web/src/test/rule-corpus.spec.ts` runs the same files
 * against the package's source in the browser's application, and both run in `pnpm test`: each runtime agreeing with
 * the stated findings is what makes the two agree with each other.
 *
 * **The directory is read, not a list**, so a case file added to the corpus is in this proof with no edit here. It is
 * found through the package's own location, the way this application resolves the package, rather than by a path
 * climbing out of `apps/api`.
 */
interface CorpusCase {
  readonly name: string;
  readonly rules: unknown;
  readonly scope: readonly string[];
  readonly values: readonly FieldValue[];
  readonly prior?: readonly FieldValue[];
  readonly findings: readonly unknown[];
}

const CORPUS = resolve(dirname(require.resolve('@easyesg/validation/package.json')), 'corpus');
const FILES = readdirSync(CORPUS).filter((name) => name.endsWith('.json')).sort();

it('finds the corpus', () => {
  // A directory that moved, or a package resolved from somewhere else, would otherwise leave `describe.each` with
  // nothing to run, and jest reports an empty table as no tests rather than a failure.
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
