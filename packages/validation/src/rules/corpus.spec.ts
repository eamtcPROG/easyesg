import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import evaluation from '../../corpus/evaluation.json';
import exclusive from '../../corpus/exclusive.json';
import range from '../../corpus/range.json';
import requiredAny from '../../corpus/required-any.json';
import required from '../../corpus/required.json';
import rowComplete from '../../corpus/row-complete.json';
import sum from '../../corpus/sum.json';
import url from '../../corpus/url.json';
import yearOverYear from '../../corpus/year-over-year.json';
import { evaluateRules } from './evaluate-rules.js';
import type { FieldValue } from './field-value.js';
import { RULE_SET_READ, readRuleSet } from './read-rule-set.js';

/**
 * The shared rule corpus, run here against the package's source (task 40.3) — the local loop, and the fixtures §12.5.6's
 * 95% line / 90% branch floor for the validation engine names (NFR-88: *"coverage is over the config interpreter, with
 * the rule corpus as fixtures"*). **Measured since task 205**: `pnpm test:coverage` runs this package's suites with
 * coverage on and holds `src/rules/` to that floor, read from §12.5.6's table. Before it, what stood in at task 40 was
 * a mutation run over the interpreter, every mutation red (`build-log.md`'s task-40 entry).
 *
 * **The proof that the two runtimes agree is not this file**: `apps/api`'s jest runs the same files against the
 * package's CommonJS build, and `apps/web`'s vitest against its source, each reading the directory — so a case file
 * added there is in both runtimes' proof with no edit. This one imports each file, as `packages/i18n`'s parity suite
 * imports its catalogues, because the package carries no Node types (`"types": []`); a file added to the corpus is
 * added to the list below.
 *
 * Each case's rules pass through the reader first, so a corpus that drifted out of the vocabulary fails here rather
 * than evaluating something the store would refuse.
 */
interface CorpusCase {
  readonly name: string;
  readonly rules: unknown;
  readonly scope: readonly string[];
  readonly values: readonly FieldValue[];
  readonly prior?: readonly FieldValue[];
  readonly findings: readonly unknown[];
}

const CORPUS: Readonly<Record<string, { readonly cases: readonly CorpusCase[] }>> = {
  required,
  'required-any': requiredAny,
  'row-complete': rowComplete,
  sum,
  range,
  url,
  exclusive,
  'year-over-year': yearOverYear,
  evaluation,
};

describe.each(Object.entries(CORPUS))('the rule corpus: %s', (_, file) => {
  it.each(file.cases)('$name', (corpusCase) => {
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

/**
 * **The answers' order, and how many of them there are, as a property** (task 212; FR-43, BR-VAL-3; §12.5.6's task-212
 * row). The interpreter promises findings that depend on the answers alone — the api lists rows in the store's order and
 * the browser in its step's (task 40.3). So for every case above, any subset of its answers and of its prior answers,
 * given in any order, must give exactly the findings, order included, that the same subset gives in the order the case
 * lists it. A subset is a report with fewer fields answered, which is a state every report passes through, so the
 * property reaches findings no case was written for. Each answer is the case's own row, so the store's natural key —
 * one row per element, member and position — holds of every subset.
 *
 * **A fresh seed every run.** A failure prints its seed and the smallest case it shrank to; that case then joins the
 * corpus, so what it found is tested in both runtimes whatever the next seed draws.
 */
describe.each(Object.entries(CORPUS))('the rule corpus, any part of its answers in any order: %s', (_, file) => {
  it.each(file.cases)('$name', (corpusCase) => {
    const reading = readRuleSet(corpusCase.rules);
    if (reading.outcome !== RULE_SET_READ.READ) throw new Error(`rules refused: ${JSON.stringify(reading.problems)}`);
    const evaluate = (values: readonly FieldValue[], prior: readonly FieldValue[]) =>
      evaluateRules({ ruleSet: reading.ruleSet, scope: new Set(corpusCase.scope), values, prior });
    /** The rows `chosen` holds, in the order `listed` gives them. */
    const inListedOrder = (listed: readonly FieldValue[], chosen: readonly FieldValue[]) =>
      listed.filter((row) => chosen.includes(row));

    fc.assert(
      fc.property(
        fc.shuffledSubarray([...corpusCase.values]),
        fc.shuffledSubarray([...(corpusCase.prior ?? [])]),
        (values, prior) => {
          expect(evaluate(values, prior)).toEqual(
            evaluate(inListedOrder(corpusCase.values, values), inListedOrder(corpusCase.prior ?? [], prior)),
          );
        },
      ),
      { numRuns: 50 },
    );
  });
});
