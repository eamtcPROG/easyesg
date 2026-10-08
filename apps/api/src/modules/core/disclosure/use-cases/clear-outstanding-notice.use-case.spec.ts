import type { CancelNotificationCommand, NotificationPort } from '@api/contracts/notification.port';
import type { CurrentAnswer } from '../models/outstanding-cleared';
import type { LastRunOutstanding } from '../interfaces/last-run-outstanding.interface';
import { OMITTED_DISCLOSURES_ELEMENT } from '../models/omission.model';
import { ClearOutstandingNotice } from './clear-outstanding-notice.use-case';
import type { ReadWizardStep } from './read-wizard-step.use-case';

const RAN = new Date('2026-10-09T04:00:00Z');
const AFTER = new Date('2026-10-09T09:00:00Z');
const field = (elementKey: string) => ({ elementKey, dimensionKey: '', ordinal: 0 });

function build(input: { readonly listed?: readonly string[] | null; readonly answers?: readonly CurrentAnswer[]; readonly scope?: readonly string[] }) {
  const cancelled: CancelNotificationCommand[] = [];
  const answersRead = jest.fn().mockResolvedValue(input.answers ?? []);
  const evaluationScope = jest.fn().mockResolvedValue({ values: [], scope: new Map((input.scope ?? []).map((key) => [key, ['B1']])), modules: [] });
  const lastRun: LastRunOutstanding = {
    of: () => Promise.resolve(input.listed === null ? null : { ranAt: RAN, fields: (input.listed ?? ['Turnover']).map(field) }),
    answers: answersRead,
  };
  const notifications: NotificationPort = {
    raise: () => Promise.reject(new Error('A write raises nothing')),
    cancel: (command) => {
      cancelled.push(command);
      return Promise.resolve();
    },
  };
  const useCase = new ClearOutstandingNotice(lastRun, { evaluationScope } as unknown as ReadWizardStep, notifications);
  const run = (writtenElements: readonly string[]) =>
    useCase.execute({ reportId: 'report-1', organizationId: 'org-1', writtenElements });
  return { run, cancelled, answersRead, evaluationScope };
}

describe('ClearOutstandingNotice (task 51.2)', () => {
  it('withdraws the notice when the write answers the last field it listed', async () => {
    const { run, cancelled } = build({ answers: [{ value: { elementKey: 'Turnover', valueNumeric: '9' }, updatedAt: AFTER }] });
    await run(['Turnover']);
    expect(cancelled).toEqual([
      { categoryKey: 'reporting.outstanding_report', organizationId: 'org-1', subjectRef: 'report:report-1:outstanding' },
    ]);
  });

  it('withdraws nothing while a listed field is left', async () => {
    const { run, cancelled } = build({
      listed: ['Turnover', 'Assets'],
      answers: [{ value: { elementKey: 'Turnover', valueNumeric: '9' }, updatedAt: AFTER }],
    });
    await run(['Turnover']);
    expect(cancelled).toEqual([]);
  });

  it('reads nothing more for a write that touches no listed field and declares no omission', async () => {
    const { run, cancelled, answersRead, evaluationScope } = build({});
    await run(['NumberOfEmployees']);
    expect(answersRead).not.toHaveBeenCalled();
    expect(evaluationScope).not.toHaveBeenCalled();
    expect(cancelled).toEqual([]);
  });

  it('computes the scope only for a write to the omission list, and clears the fields it took out', async () => {
    const { run, cancelled, evaluationScope } = build({ listed: ['WasteDirectedToDisposalMass'], scope: ['Turnover'] });
    await run([OMITTED_DISCLOSURES_ELEMENT]);
    expect(evaluationScope).toHaveBeenCalledWith({ reportId: 'report-1' });
    expect(cancelled).toHaveLength(1);
  });

  it('does nothing for a report never validated, or one whose last run listed nothing', async () => {
    for (const listed of [null, []]) {
      const { run, cancelled, answersRead } = build({ listed });
      await run(['Turnover']);
      expect(answersRead).not.toHaveBeenCalled();
      expect(cancelled).toEqual([]);
    }
  });
});
