import type { CancelNotificationCommand } from '@api/contracts/notification.port';
import {
  ReportEntityArchivedError,
  ReportExportedError,
  ReportNotEditableError,
  ReportNotFoundError,
} from '../errors/report.errors';
import { REPORT_DELETION, type ReportDeletion } from '../models/report-deletion.model';
import { DeleteReport } from './delete-report.use-case';

const REPORT = '00000000-0000-0000-0000-0000000000d1';
const ORGANIZATION = '00000000-0000-0000-0000-0000000000a1';

const build = (outcome: ReportDeletion) => {
  const cancelled: CancelNotificationCommand[] = [];
  const asked: string[] = [];
  const useCase = new DeleteReport(
    {
      delete: (command) => {
        asked.push(command.reportId);
        return Promise.resolve(outcome);
      },
    },
    {
      cancel: (command) => {
        cancelled.push(command);
        return Promise.resolve();
      },
    },
  );
  return { run: () => useCase.execute({ reportId: REPORT, organizationId: ORGANIZATION }), cancelled, asked };
};

/** UC-213's outcomes (task 192; FR-210): the function's four answers, and the notice a deletion withdraws. */
describe('DeleteReport', () => {
  it('deletes, and withdraws the report’s outstanding-report notice in the organization', async () => {
    const { run, cancelled, asked } = build(REPORT_DELETION.DELETED);
    await run();
    expect(asked).toEqual([REPORT]);
    expect(cancelled).toEqual([
      { categoryKey: 'reporting.outstanding_report', organizationId: ORGANIZATION, subjectRef: `report:${REPORT}:outstanding` },
    ]);
  });

  it.each([
    [REPORT_DELETION.NOT_FOUND, ReportNotFoundError],
    // The archive retains an entity's reports (FR-20 behaviour 7; task 214).
    [REPORT_DELETION.ARCHIVED, ReportEntityArchivedError],
    [REPORT_DELETION.LOCKED, ReportNotEditableError],
    [REPORT_DELETION.EXPORTED, ReportExportedError],
  ] as const)('answers %s with its refusal and withdraws nothing', async (outcome, refusal) => {
    const { run, cancelled } = build(outcome);
    await expect(run()).rejects.toBeInstanceOf(refusal);
    expect(cancelled).toEqual([]);
  });
});
