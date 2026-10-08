import { isDeepStrictEqual } from 'node:util';
import { evaluateRules, type FieldValue } from '@easyesg/validation';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { keptHistory, readKeptVersions, type KeptVersion } from '@api/testing/kept-versions';
import { readSeedEntries } from '@api/testing/seed-configuration-store';
import { VALIDATION_RULE_SET_CONFIG_KIND } from './constants/validation.constants';
import { ValidationRuleSetCatalog } from './services/validation-rule-set-catalog.service';

/**
 * **NFR-87's suite, the rule-set half** (task 201; `architecture.md` §12.5.6's task-201 row; FR-73 item 9): every rule
 * set the seed has shipped is kept in `config/version-pinned/`, with reports pinned to it and the findings each came to,
 * and every report is evaluated again here against its own kept set and must come to exactly those findings.
 *
 * **Why findings recorded by an earlier build**: a locked report's revision is pinned by its lock (task-41 row (5)), so a
 * rule change cannot reach it — what can is code. A change to the reader or the interpreter moves what an earlier set
 * finds, and a locked report re-run before its export (47.4) would read differently with nothing in the data changed.
 *
 * **Evaluated as a validation run evaluates a locked report**: the pinned revision read through
 * `ValidationRuleSetCatalog.pinned` over configuration history, which `keptHistory` serves from the kept files, then
 * `evaluateRules` over the report's scope, answers and prior. The run's roll-up is counted from those findings by code
 * no rule set carries, and is `roll-up.spec.ts`'s (task-201 row (b)).
 */
interface KeptReport {
  readonly name: string;
  readonly scope: readonly string[];
  readonly values: readonly FieldValue[];
  readonly prior?: readonly FieldValue[];
  readonly findings: readonly unknown[];
}

interface KeptRuleSet {
  readonly payload: { readonly rules: readonly Record<string, unknown>[] } & Record<string, unknown>;
  readonly reports: readonly KeptReport[];
}

type KeptRules = KeptVersion<KeptRuleSet>;

const KEPT: readonly KeptRules[] = readKeptVersions<KeptRuleSet>({ kind: VALIDATION_RULE_SET_CONFIG_KIND });

/** One kept report, evaluated against the kept set it is pinned to. */
async function reevaluate(input: { readonly version: KeptRules; readonly report: KeptReport }) {
  // The store is never read: a locked report asks for its pin, and only `inForce` would read what is in force.
  const pinned = await new ValidationRuleSetCatalog({} as ConfigurationStore, keptHistory([input.version])).pinned({
    revision: input.version.revision,
  });
  if (pinned === null) throw new Error(`The kept rule set ${input.version.name} reads as nothing`);
  return evaluateRules({
    ruleSet: pinned.ruleSet,
    scope: new Set(input.report.scope),
    values: input.report.values,
    prior: input.report.prior,
  });
}

it('keeps at least one rule set', () => {
  // `describe.each` over nothing reports no tests rather than a failure, so an emptied or moved directory says so here.
  expect(KEPT.length).toBeGreaterThan(0);
});

it('keeps every rule set the seed ships — a changed set is added to config/version-pinned/, the earlier kept', () => {
  const shipped = readSeedEntries().filter((entry) => entry.kind === VALIDATION_RULE_SET_CONFIG_KIND);
  expect(shipped.length).toBeGreaterThan(0);
  for (const entry of shipped) {
    const kept = KEPT.some((version) => version.scope === entry.scope && isDeepStrictEqual(version.file.payload, entry.payload));
    expect({ scope: entry.scope, from: entry.validFrom ?? null, kept }).toEqual({
      scope: entry.scope,
      from: entry.validFrom ?? null,
      kept: true,
    });
  }
});

describe.each(KEPT.map((version) => [`${version.scope} ${version.name}`, version] as const))(
  'the kept rule set %s',
  (_, version) => {
    it('is read whole through the adapter a lock’s pin is read through', async () => {
      const pinned = await new ValidationRuleSetCatalog({} as ConfigurationStore, keptHistory([version])).pinned({
        revision: version.revision,
      });
      expect(pinned?.ruleSet.rules).toHaveLength(version.file.payload.rules.length);
    });

    it.each(version.file.reports.map((report) => [report.name, report] as const))(
      'evaluates “%s” to exactly the findings it recorded',
      async (__, report) => {
        expect(await reevaluate({ version, report })).toEqual(report.findings);
      },
    );

    /**
     * The gate's own proof (task-201 row (2)): a set without one of its rules is a set that would restate a finding, so
     * some recorded report must come to different findings under it. A rule no report makes fire is one whose drift
     * this suite could not see — so this fails on a gap in the reports, as well as on a comparison that stopped biting.
     */
    it('comes to different findings for a recorded report when any one rule is removed', async () => {
      const restates = async (under: KeptRules): Promise<boolean> => {
        const findings = await Promise.all(version.file.reports.map((report) => reevaluate({ version: under, report })));
        return findings.some((found, at) => !isDeepStrictEqual(found, version.file.reports[at].findings));
      };
      // The comparison below must be able to say *unchanged*, or every removal would read as a restatement.
      expect(await restates(version)).toBe(false);

      for (const [index, rule] of version.file.payload.rules.entries()) {
        const without = {
          ...version,
          file: {
            ...version.file,
            payload: { ...version.file.payload, rules: version.file.payload.rules.filter((_rule, at) => at !== index) },
          },
        };
        expect({ removed: rule.id, restated: await restates(without) }).toEqual({ removed: rule.id, restated: true });
      }
    });
  },
);
