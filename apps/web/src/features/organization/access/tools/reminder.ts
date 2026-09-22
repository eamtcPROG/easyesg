import { MEMBERSHIP_STATUS, REPORT_STATUS, type Member, type Report } from '@easyesg/contracts';

/**
 * What S-16's reminder panel can offer, and so which of its arms it is in (task 50.3; UC-175; `architecture.md`
 * §12.5.6's task-50.3 rows (1), (4), (5)).
 *
 * **The people are every active member but the sender**, of any role; **the reports are the organization's open
 * ones** — not locked, ready to file or filed. Neither comes from the list above the panel, which is filtered and
 * paged: a reminder may go to someone the list is not showing.
 *
 * **Which arm, in order**: the reads failed, or no session named the sender, so nothing can be offered — the panel's
 * own *partial* state; no open
 * report, so there is nothing to remind about; no one but the sender, so no one to remind; otherwise the form. The
 * report comes first because it is the reminder's subject: with none open, who could be reminded does not matter.
 *
 * Pure, so every arm is a spec; the words for each option are the form's, since this carries no catalogue.
 */
/**
 * The api's bound on the note (`SendReportReminderRequestDto`), restated so a person meets it before sending —
 * task 67.9's precedent for the console's reason field. **The contract publishes it**, so `reminder.spec.ts` holds
 * this copy to `openapi/v1.json`'s `maxLength` rather than to a memory of it.
 */
export const REMINDER_NOTE_MAX_LENGTH = 500;

export const REMINDER_ARM = {
  READY: 'ready',
  NO_REPORT: 'no-report',
  NO_ONE: 'no-one',
  UNAVAILABLE: 'unavailable',
} as const;

export type ReminderArm = (typeof REMINDER_ARM)[keyof typeof REMINDER_ARM];

/**
 * A person the reminder may go to — their membership, the name S-16 shows them by, and their address beneath it, as
 * the list above draws them, so two people sharing a name can still be told apart.
 */
export interface ReminderPerson {
  readonly membershipId: string;
  readonly displayName: string;
  readonly email: string;
}

/** A report the reminder may be about — the entity and the year that name it. */
export interface ReminderReport {
  readonly id: string;
  readonly entityName: string;
  readonly fiscalYear: number;
}

export type ReminderRegion =
  | {
      readonly arm: typeof REMINDER_ARM.READY;
      readonly people: readonly ReminderPerson[];
      readonly reports: readonly ReminderReport[];
    }
  | { readonly arm: Exclude<ReminderArm, typeof REMINDER_ARM.READY> };

export const reminderRegion = (input: {
  /** `GET /members`, or `null` where it could not be read. */
  readonly members: readonly Member[] | null;
  /** `GET /reports`, or `null` where it could not be read. */
  readonly reports: readonly Report[] | null;
  /** The session's account — `null` where no session could be read, which offers nothing rather than everyone. */
  readonly senderAccountId: string | null;
}): ReminderRegion => {
  if (input.members === null || input.reports === null || input.senderAccountId === null) {
    return { arm: REMINDER_ARM.UNAVAILABLE };
  }

  const reports = input.reports
    .filter((report) => report.status === REPORT_STATUS.OPEN)
    .map((report) => ({ id: report.id, entityName: report.subject.entityName, fiscalYear: report.subject.fiscalYear }));
  if (reports.length === 0) return { arm: REMINDER_ARM.NO_REPORT };

  const people = input.members
    .filter((member) => member.status === MEMBERSHIP_STATUS.ACTIVE && member.accountId !== input.senderAccountId)
    .map((member) => ({ membershipId: member.id, displayName: member.displayName, email: member.email }));
  if (people.length === 0) return { arm: REMINDER_ARM.NO_ONE };

  return { arm: REMINDER_ARM.READY, people, reports };
};
