import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import {
  ReminderRecipientNotFoundError,
  ReminderToSelfError,
  ReportNotFoundError,
  ReportNotOutstandingError,
} from '../errors/report.errors';
import type { ReminderParties } from '../interfaces/reminder-parties.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { REMINDER_NOTE, type ReminderParams } from '../models/report-reminder.model';
import { REPORT_STATUS } from '../models/report.model';

export interface SendReportReminderCommand {
  readonly reportId: string;
  readonly membershipId: string;
  /** Trimmed here, and an empty one is none. Its length is the request's to bound (`REMINDER_NOTE_MAX_LENGTH`). */
  readonly note?: string;
  /** The administrator sending it — the request's actor, never a field a caller names. */
  readonly senderAccountId: string;
  /** The bound organization, which the notice is raised in. */
  readonly organizationId: string;
}

/**
 * UC-175: an administrator reminds a member about an open report (task 50.3; FR-157, FR-173; `architecture.md`
 * §12.5.6's task-50.3 row).
 *
 * **The reminder is a raise and nothing else** — *"the reminder goes out through the same mechanism and is recorded
 * the same way"* — on the request's own transaction (P-8), so a refusal below raises nothing and a raise that
 * commits is delivered by the worker like any notice. What this owns is whether it may be sent, in the order a reader
 * would ask it:
 *
 * 1. **The report is open** (row (1)): not locked, ready to file or filed — UC-175's *outstanding*, until task 41.3's
 *    rollup can say what is outstanding in it.
 * 2. **The recipient is an active member**, of any role (row (4)); a removed membership, or another tenant's, is none.
 * 3. **The recipient is not the sender.**
 *
 * **Each reminder is its own notice** (row (3)): its subject carries an id of its own, so FR-167 never folds a second
 * reminder into the first — which, with a notice's content fixed when it opens, would lose the second note.
 */
export class SendReportReminder {
  constructor(
    private readonly reports: ReportStore,
    private readonly parties: ReminderParties,
    private readonly notifications: NotificationPort,
    /** A fresh id for each reminder's subject. */
    private readonly newId: () => string,
  ) {}

  async execute(command: SendReportReminderCommand): Promise<void> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    if (!report) throw new ReportNotFoundError();
    if (report.status !== REPORT_STATUS.OPEN) throw new ReportNotOutstandingError();

    const recipient = await this.parties.recipient({ membershipId: command.membershipId });
    if (recipient?.status !== MEMBERSHIP_STATUS.ACTIVE) throw new ReminderRecipientNotFoundError();
    if (recipient.accountId === command.senderAccountId) throw new ReminderToSelfError();

    // The actor passed the guards, so an account holds it; a missing one is a defect, not a refusal to word.
    const sender = await this.parties.sender({ accountId: command.senderAccountId });
    if (!sender) throw new Error('The request’s actor resolves to no account');

    const note = command.note?.trim() ?? '';
    const params: ReminderParams = {
      senderName: displayName(sender, sender.email),
      entityName: report.subject.entityName,
      fiscalYear: String(report.subject.fiscalYear),
      noteGiven: note ? REMINDER_NOTE.GIVEN : REMINDER_NOTE.NONE,
      note,
    };

    await this.notifications.raise({
      categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
      organizationId: command.organizationId,
      recipientUserIds: [recipient.accountId],
      subjectRef: `report:${report.id}:reminder:${this.newId()}`,
      deepLink: `/reports/${report.id}`,
      params,
    });
  }
}
