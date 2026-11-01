import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { outstandingReportSubject } from '@api/contracts/report-notices';
import { outstandingCleared } from '../models/outstanding-cleared';
import type { LastRunOutstanding } from '../interfaces/last-run-outstanding.interface';
import { OMITTED_DISCLOSURES_ELEMENT } from '../models/omission.model';
import type { ReadWizardStep } from './read-wizard-step.use-case';

export interface ClearOutstandingNoticeCommand {
  readonly reportId: string;
  readonly organizationId: string;
  /** The elements the write answered, cleared or declared — what it could have cleared. */
  readonly writtenElements: readonly string[];
}

/**
 * 182/134's *disclosure supplied* and *section declared omitted* (task 51.2; FR-167; `architecture.md` §12.5.6's
 * task-51.2 row (4)): the write that answers the last of what FR-164's notice listed withdraws it, **on the write's own
 * transaction**, so the notice leaves the centre with the answer that cleared it.
 *
 * **Cheap unless it could matter.** A write touching no listed field and no omission reads nothing more; one that does
 * reads the listed rows; and only a write to B1's omission list computes the scope, the one write that can take a field
 * out of it. Nothing is evaluated (182/26 stands), so a field held by a consistency finding waits for the next check.
 * A withdrawal of a notice that is not open is no error (FR-167), so a write that clears what was already cleared costs
 * one outbox row and nothing else.
 */
export class ClearOutstandingNotice {
  constructor(
    private readonly lastRun: LastRunOutstanding,
    private readonly reads: ReadWizardStep,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: ClearOutstandingNoticeCommand): Promise<void> {
    const last = await this.lastRun.of({ reportId: command.reportId });
    if (last === null || last.fields.length === 0) return;

    const written = new Set(command.writtenElements);
    const omitting = written.has(OMITTED_DISCLOSURES_ELEMENT);
    if (!omitting && !last.fields.some((field) => written.has(field.elementKey))) return;

    const answers = await this.lastRun.answers({ reportId: command.reportId, fields: last.fields });
    const inScope = omitting
      ? new Set((await this.reads.evaluationScope({ reportId: command.reportId })).scope.keys())
      : null;
    if (!outstandingCleared({ listed: last.fields, answers, ranAt: last.ranAt, inScope })) return;

    await this.notifications.cancel({
      categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      organizationId: command.organizationId,
      subjectRef: outstandingReportSubject(command.reportId),
    });
  }
}
