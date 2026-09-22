import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS, REPORT_STATUS, type Member, type Report } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { REMINDER_ARM, REMINDER_NOTE_MAX_LENGTH, reminderRegion } from './reminder';

/** What S-16's reminder panel can offer, and which arm it is in (task 50.3). */

const ANA = 'account-ana';

const aMember = (over: Partial<Member> = {}): Member => ({
  id: 'membership-ivan',
  accountId: 'account-ivan',
  email: 'ivan@example.md',
  displayName: 'Ivan Rusu',
  role: MEMBERSHIP_ROLE.VIEWER,
  status: MEMBERSHIP_STATUS.ACTIVE,
  lastActiveAt: null,
  joinedAt: 1_000,
  ...over,
});

const aReport = (over: Partial<Report> = {}): Report => ({
  id: 'report-2026',
  reportingPeriodId: 'period-2026',
  scope: 'basic',
  status: REPORT_STATUS.OPEN,
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  createdAt: 1_000,
  updatedAt: 1_000,
  subject: {
    reportingEntityId: 'entity-lina',
    entityName: 'Brutăria Lina',
    fiscalYear: 2026,
    periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
    periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
    dueDate: null,
  },
  ...over,
});

const sender = aMember({ id: 'membership-ana', accountId: ANA, displayName: 'Ana Popescu', role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR });

describe('reminderRegion', () => {
  it('offers every active member but the sender, of any role, and the open reports', () => {
    const region = reminderRegion({
      members: [
        sender,
        aMember(),
        aMember({
          id: 'membership-rita',
          accountId: 'account-rita',
          email: 'rita@example.md',
          displayName: 'Rita Luca',
          role: MEMBERSHIP_ROLE.EDITOR,
        }),
        aMember({ id: 'membership-gone', accountId: 'account-gone', status: MEMBERSHIP_STATUS.REMOVED }),
      ],
      // Every status but open, derived from the vocabulary: one added later is offered to this case with it.
      reports: [
        aReport(),
        ...Object.values(REPORT_STATUS)
          .filter((status) => status !== REPORT_STATUS.OPEN)
          .map((status) => aReport({ id: `report-${status}`, status })),
      ],
      senderAccountId: ANA,
    });

    expect(region).toEqual({
      arm: REMINDER_ARM.READY,
      people: [
        { membershipId: 'membership-ivan', displayName: 'Ivan Rusu', email: 'ivan@example.md' },
        { membershipId: 'membership-rita', displayName: 'Rita Luca', email: 'rita@example.md' },
      ],
      reports: [{ id: 'report-2026', entityName: 'Brutăria Lina', fiscalYear: 2026 }],
    });
  });

  it('has nothing to remind about while no report is open, whoever could be reminded', () => {
    expect(
      reminderRegion({ members: [sender, aMember()], reports: [aReport({ status: REPORT_STATUS.LOCKED })], senderAccountId: ANA }),
    ).toEqual({ arm: REMINDER_ARM.NO_REPORT });
    expect(reminderRegion({ members: [sender], reports: [], senderAccountId: ANA })).toEqual({
      arm: REMINDER_ARM.NO_REPORT,
    });
  });

  it('has no one to remind where the sender is the only active member', () => {
    expect(
      reminderRegion({
        members: [sender, aMember({ status: MEMBERSHIP_STATUS.REMOVED })],
        reports: [aReport()],
        senderAccountId: ANA,
      }),
    ).toEqual({ arm: REMINDER_ARM.NO_ONE });
  });

  it.each([
    ['the members', { members: null, reports: [aReport()] }],
    ['the reports', { members: [sender, aMember()], reports: null }],
  ])('offers nothing it could not read — %s', (_case, reads) => {
    expect(reminderRegion({ ...reads, senderAccountId: ANA })).toEqual({ arm: REMINDER_ARM.UNAVAILABLE });
  });

  // Without a sender the rule could not leave them out, so it offers no one rather than everyone.
  it('offers nothing where no session names the sender', () => {
    expect(reminderRegion({ members: [sender, aMember()], reports: [aReport()], senderAccountId: null })).toEqual({
      arm: REMINDER_ARM.UNAVAILABLE,
    });
  });
});

/**
 * The note's bound is the api's, and this holds the two copies together: the contract publishes `maxLength`, so a
 * lowered bound on the api fails here rather than reaching a reader as a refusal of a note the form accepted.
 */
describe('the note’s bound', () => {
  it('is the one the committed contract publishes', () => {
    const contract = JSON.parse(
      readFileSync(join(__dirname, '../../../../../../../packages/contracts/openapi/v1.json'), 'utf8'),
    ) as { components: { schemas: { SendReportReminderRequestDto: { properties: { note: { maxLength: number } } } } } };

    expect(contract.components.schemas.SendReportReminderRequestDto.properties.note.maxLength).toBe(
      REMINDER_NOTE_MAX_LENGTH,
    );
  });
});
