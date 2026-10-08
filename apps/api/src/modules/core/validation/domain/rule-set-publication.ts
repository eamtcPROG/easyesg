import { RULE_SET_READ, readRuleSet } from '@easyesg/validation';

/**
 * Why a validation rule set may not be published, or `null` where it may (task 41.1; FR-73 items 2 and 8, 182/51).
 *
 * **Two refusals, and each is the last place its gap can be seen.**
 * - **A set the interpreter cannot hold** — `readRuleSet` is the reader every evaluation reads the store through, so
 *   asking it here is what keeps publication and evaluation from accepting different sets (factor sets' rule, task
 *   37.4).
 * - **A message key some locale's committed catalogue does not word.** UX-97 makes a missing key invisible at runtime
 *   — a blank where a finding's explanation belongs — so publication is the only place it shows, as A-17 refuses a
 *   notification category with no wording (182/51).
 *
 * **`worded` is passed in** rather than read here, because the catalogues are the release's and this is a pure rule:
 * the configuration store's kind table hands it the committed catalogues, and a spec hands it a set of keys.
 */
export function ruleSetRefusal(input: {
  readonly payload: unknown;
  readonly worded: (key: string) => boolean;
}): string | null {
  const reading = readRuleSet(input.payload);
  if (reading.outcome === RULE_SET_READ.REFUSED) {
    const problems = reading.problems.map((p) => `${p.id ?? (p.index === null ? 'the set' : `rule #${p.index}`)}: ${p.problem}`);
    return `it is not a rule set the interpreter can read — ${problems.join('; ')}`;
  }
  const keys = [...new Set(reading.ruleSet.rules.map((rule) => rule.message))];
  const unworded = keys.filter((key) => !input.worded(key)).sort();
  return unworded.length === 0
    ? null
    : `its message key(s) have no wording in every locale's catalogue: ${unworded.join(', ')}`;
}
