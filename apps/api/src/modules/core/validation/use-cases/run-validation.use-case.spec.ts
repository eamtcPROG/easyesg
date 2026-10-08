import type { FieldValue, Finding, RuleSet } from '@easyesg/validation';
import type { LegalDate } from '@api/contracts/types/time';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { ValidationRulesUnavailableError } from '../errors/validation.errors';
import type { EvaluationScopes } from '../interfaces/evaluation-scopes.interface';
import type { PriorComparables } from '../interfaces/prior-comparables.interface';
import type { ValidationReport, ValidationReports } from '../interfaces/validation-reports.interface';
import type { RuleSetInForce, ValidationRuleSets } from '../interfaces/validation-rule-sets.interface';
import type { ValidationStore } from '../interfaces/validation-store.interface';
import type { RollUp } from '../models/roll-up.model';
import type { StoredValidation, ValidationRun } from '../models/validation-run.model';
import { RunValidation } from './run-validation.use-case';

const REPORT = '00000000-0000-0000-0000-0000000000a1';
const NOW = new Date('2027-03-10T09:00:00Z');

const required = (id: string, element: string) => ({
  id,
  kind: 'required' as const,
  verdict: 'missing' as const,
  message: 'validation.required',
  fields: [{ element }],
});

const TODAY_SET: RuleSet = { rules: [required('b1-turnover', 'Turnover')] };
const PINNED_SET: RuleSet = { rules: [required('b1-assets', 'Assets')] };

/** A store that keeps one run per report, replaced whole, as the real one does. */
class FakeStore implements ValidationStore {
  stored: StoredValidation | null = null;

  replace(command: {
    readonly reportId: string;
    readonly rulesOn: LegalDate;
    readonly rulesRevision: number;
    readonly findings: readonly Finding[];
    readonly rollUp: RollUp;
  }): Promise<ValidationRun | null> {
    const run: ValidationRun = {
      evaluatedAt: NOW,
      evaluatedBy: null,
      rulesOn: command.rulesOn,
      rulesRevision: command.rulesRevision,
    };
    this.stored = { run, findings: command.findings, rollUp: command.rollUp };
    return Promise.resolve(run);
  }

  read(): Promise<StoredValidation | null> {
    return Promise.resolve(this.stored);
  }
}

const build = (over: { report?: Partial<ValidationReport> | null; values?: FieldValue[]; scope?: string[] } = {}) => {
  const store = new FakeStore();
  const asked: string[] = [];
  let values = over.values ?? [];
  let scope = new Map((over.scope ?? ['Turnover', 'Assets']).map((key) => [key, ['B1']] as const));
  const reports: ValidationReports = {
    find: () =>
      Promise.resolve(
        over.report === null
          ? null
          : { reportId: REPORT, lockedAt: null, ruleSetPin: null, timezone: 'Europe/Chisinau', ...over.report },
      ),
  };
  const scopes: EvaluationScopes = { evaluationScope: () => Promise.resolve({ values, scope, modules: ['B1'] }) };
  const priors: PriorComparables = { comparable: () => Promise.resolve([]) };
  let todaySet: RuleSetInForce | null = { ruleSet: TODAY_SET, revision: 2 };
  const ruleSets: ValidationRuleSets = {
    inForce: ({ on }) => {
      asked.push(`on ${on}`);
      return todaySet;
    },
    pinned: ({ revision }) => {
      asked.push(`pinned ${revision}`);
      return Promise.resolve({ ruleSet: PINNED_SET, revision });
    },
  };
  return {
    store,
    asked,
    useCase: new RunValidation(reports, scopes, priors, ruleSets, store, () => NOW),
    answer: (next: FieldValue[]) => {
      values = next;
    },
    narrow: (next: string[]) => {
      scope = new Map(next.map((key) => [key, ['B1']] as const));
    },
    unreadable: () => {
      todaySet = null;
    },
  };
};

/**
 * UC-40 (task 41.2; FR-40, FR-43, FR-73 item 9; 182/21, 182/26). The interpreter's own behaviour is the corpus's; what
 * is here is the run around it — which rule set, what it replaces, and what a read drops.
 */
describe('RunValidation (UC-40)', () => {
  it('evaluates an incomplete report and stores what it finds, with the day and revision it read (FR-43 AC-1)', async () => {
    const { useCase, store, asked } = build();
    const reading = await useCase.run({ reportId: REPORT });

    expect(reading.findings.map((finding) => finding.rule)).toEqual(['b1-turnover']);
    // Today in the period's zone, the open period's day.
    expect(asked).toEqual(['on 2027-03-10']);
    expect(reading.run?.rulesOn).toEqual({ date: '2027-03-10', timezone: 'Europe/Chisinau' });
    expect(store.stored?.run.rulesRevision).toBe(2);
    // And what it came to, from the same answers and findings (task 41.3): one outstanding field in B1.
    expect(reading.rollUp?.report).toEqual({ resolved: 0, reasoned: 0, outstanding: 1 });
    expect(store.stored?.rollUp).toEqual(reading.rollUp);
  });

  it('reads the roll-up as the run left it, unfiltered, though a finding has left the scope since (FR-41 item 8)', async () => {
    const { useCase, narrow } = build();
    await useCase.run({ reportId: REPORT });
    narrow(['Assets']);
    const read = await useCase.read({ reportId: REPORT });
    expect(read.findings).toEqual([]);
    expect(read.rollUp?.report.outstanding).toBe(1);
  });

  it('finds the same over unchanged answers, and nothing once the field is corrected (FR-43 AC-2, AC-3)', async () => {
    const { useCase, answer, store } = build();
    const first = await useCase.run({ reportId: REPORT });
    const again = await useCase.run({ reportId: REPORT });
    expect(again.findings).toEqual(first.findings);

    answer([{ elementKey: 'Turnover', valueNumeric: '1000' }]);
    expect((await useCase.run({ reportId: REPORT })).findings).toEqual([]);
    // Replaced, not accumulated: the corrected field's finding is gone from the store too.
    expect(store.stored?.findings).toEqual([]);
  });

  it('runs a locked report against the rule set its lock pinned, never today’s (FR-73 item 9; 182/21)', async () => {
    const { useCase, asked } = build({ report: { lockedAt: new Date('2026-12-15T10:00:00Z'), ruleSetPin: 1 } });
    const reading = await useCase.run({ reportId: REPORT });

    expect(asked).toEqual(['pinned 1']);
    expect(reading.findings.map((finding) => finding.rule)).toEqual(['b1-assets']);
    expect(reading.run?.rulesOn.date).toBe('2026-12-15');
  });

  it('reads a report locked before pins existed as at its lock day', async () => {
    const { useCase, asked } = build({ report: { lockedAt: new Date('2026-12-15T10:00:00Z'), ruleSetPin: null } });
    await useCase.run({ reportId: REPORT });
    expect(asked).toEqual(['on 2026-12-15']);
  });

  it('refuses the run, storing nothing, where no rule set can be read', async () => {
    const { useCase, unreadable, store } = build();
    unreadable();
    await expect(useCase.run({ reportId: REPORT })).rejects.toThrow(ValidationRulesUnavailableError);
    expect(store.stored).toBeNull();
  });

  it('answers 404 for a report outside the bound organization, to a run and a read alike', async () => {
    const { useCase } = build({ report: null });
    await expect(useCase.run({ reportId: REPORT })).rejects.toThrow(ReportNotFoundError);
    await expect(useCase.read({ reportId: REPORT })).rejects.toThrow(ReportNotFoundError);
  });

  describe('reading the findings', () => {
    it('answers no run and no findings for a report never validated', async () => {
      const { useCase } = build();
      expect(await useCase.read({ reportId: REPORT })).toEqual({ run: null, findings: [], rollUp: null });
    });

    it('answers the last run as it left it, though the field was answered since (FR-43 AC-8)', async () => {
      const { useCase, answer } = build();
      await useCase.run({ reportId: REPORT });
      answer([{ elementKey: 'Turnover', valueNumeric: '1000' }]);
      expect((await useCase.read({ reportId: REPORT })).findings.map((finding) => finding.rule)).toEqual([
        'b1-turnover',
      ]);
    });

    it('drops a finding whose field has left the scope since the run (182/26)', async () => {
      const { useCase, narrow } = build();
      await useCase.run({ reportId: REPORT });
      narrow(['Assets']);
      expect((await useCase.read({ reportId: REPORT })).findings).toEqual([]);
    });
  });
});
