import type { NotificationPort, RaiseNotificationCommand } from '@api/contracts/notification.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import {
  ReminderRecipientNotFoundError,
  ReminderToSelfError,
  ReportNotFoundError,
  ReportNotOutstandingError,
} from '../errors/report.errors';
import type { ReminderParties } from '../interfaces/reminder-parties.interface';
import { REPORT_STATUS } from '../models/report.model';
import { aReport, aReportSubject, FakeReportStore } from '../testing/report.fakes';
import { SendReportReminder } from './send-report-reminder.use-case';

/**
 * UC-175's reminder (task 50.3): sent only about an open report, to an active member who is not the sender, as one
 * raise carrying what the notice says — and a new notice for every press.
 */

const ORG = '00000000-0000-0000-0000-0000000000a1';
const REPORT_ID = '00000000-0000-0000-0000-0000000000f1';
const ANA = '00000000-0000-0000-0000-0000000000d1';
const IVAN = '00000000-0000-0000-0000-0000000000d2';
const IVAN_MEMBERSHIP = '00000000-0000-0000-0000-0000000000e2';
const ANA_MEMBERSHIP = '00000000-0000-0000-0000-0000000000e1';

class RecordingNotifications implements NotificationPort {
  readonly raised: RaiseNotificationCommand[] = [];

  raise(command: RaiseNotificationCommand): Promise<{ notificationId: string }> {
    this.raised.push(command);
    return Promise.resolve({ notificationId: `n-${this.raised.length}` });
  }

  cancel(): Promise<void> {
    return Promise.reject(new Error('A reminder never cancels'));
  }
}

const parties = (
  memberships: Record<string, { accountId: string; status: (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS] }>,
): ReminderParties => ({
  recipient: ({ membershipId }) => Promise.resolve(memberships[membershipId] ?? null),
  sender: ({ accountId }) =>
    Promise.resolve(
      accountId === ANA ? { givenName: 'Ana', familyName: 'Rusu', email: 'ana@example.md' } : null,
    ),
});

const build = (options: { status?: (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS] } = {}) => {
  const reports = new FakeReportStore(
    [],
    [aReport({ id: REPORT_ID, status: options.status ?? REPORT_STATUS.OPEN, subject: aReportSubject() })],
  );
  const notifications = new RecordingNotifications();
  let next = 0;
  const useCase = new SendReportReminder(
    reports,
    parties({
      [IVAN_MEMBERSHIP]: { accountId: IVAN, status: MEMBERSHIP_STATUS.ACTIVE },
      [ANA_MEMBERSHIP]: { accountId: ANA, status: MEMBERSHIP_STATUS.ACTIVE },
      removed: { accountId: IVAN, status: MEMBERSHIP_STATUS.REMOVED },
    }),
    notifications,
    () => `id-${++next}`,
  );
  return { useCase, notifications };
};

const send = (useCase: SendReportReminder, over: Partial<Parameters<SendReportReminder['execute']>[0]> = {}) =>
  useCase.execute({
    reportId: REPORT_ID,
    membershipId: IVAN_MEMBERSHIP,
    senderAccountId: ANA,
    organizationId: ORG,
    ...over,
  });

describe('SendReportReminder', () => {
  it('raises one in-app reminder to the member, naming the report, the sender and the note, linking to the report', async () => {
    const { useCase, notifications } = build();

    await send(useCase, { note: '  Mai lipsesc datele despre energie.  ' });

    expect(notifications.raised).toEqual([
      {
        categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
        organizationId: ORG,
        recipientUserIds: [IVAN],
        subjectRef: `report:${REPORT_ID}:reminder:id-1`,
        deepLink: `/reports/${REPORT_ID}`,
        // The year as text, the note trimmed, and the parameter the wording selects on.
        params: {
          senderName: 'Ana Rusu',
          entityName: 'Brutăria Lina',
          fiscalYear: '2026',
          noteGiven: 'given',
          note: 'Mai lipsesc datele despre energie.',
        },
      },
    ]);
  });

  it('says no note was given when there is none, or only whitespace', async () => {
    const { useCase, notifications } = build();

    await send(useCase);
    await send(useCase, { note: '   ' });

    expect(notifications.raised.map((raise) => raise.params)).toEqual([
      expect.objectContaining({ noteGiven: 'none', note: '' }),
      expect.objectContaining({ noteGiven: 'none', note: '' }),
    ]);
  });

  // Row (3): a shared key would fold the second into the first, whose content — the first note — is fixed.
  it('makes every press its own notice', async () => {
    const { useCase, notifications } = build();

    await send(useCase, { note: 'Prima' });
    await send(useCase, { note: 'A doua' });

    expect(new Set(notifications.raised.map((raise) => raise.subjectRef)).size).toBe(2);
  });

  // Derived from the vocabulary rather than listed, so a status added later arrives here with it.
  it.each(Object.values(REPORT_STATUS).filter((status) => status !== REPORT_STATUS.OPEN))(
    'refuses a report that is %s, and raises nothing',
    async (status) => {
      const { useCase, notifications } = build({ status });

      await expect(send(useCase)).rejects.toBeInstanceOf(ReportNotOutstandingError);
      expect(notifications.raised).toEqual([]);
    },
  );

  it('answers a report the organization does not hold as not found', async () => {
    const { useCase, notifications } = build();

    await expect(send(useCase, { reportId: '00000000-0000-0000-0000-0000000000ff' })).rejects.toBeInstanceOf(
      ReportNotFoundError,
    );
    expect(notifications.raised).toEqual([]);
  });

  it.each([
    ['a removed membership', 'removed'],
    ['a membership no organization holds', 'nobody'],
  ])('refuses %s, and raises nothing', async (_case, membershipId) => {
    const { useCase, notifications } = build();

    await expect(send(useCase, { membershipId })).rejects.toBeInstanceOf(ReminderRecipientNotFoundError);
    expect(notifications.raised).toEqual([]);
  });

  it('refuses a reminder to its own sender', async () => {
    const { useCase, notifications } = build();

    await expect(send(useCase, { membershipId: ANA_MEMBERSHIP })).rejects.toBeInstanceOf(ReminderToSelfError);
    expect(notifications.raised).toEqual([]);
  });
});
