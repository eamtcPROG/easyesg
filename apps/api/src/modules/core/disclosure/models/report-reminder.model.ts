/**
 * UC-175's manual reminder about a report (task 50.3; `architecture.md` §12.5.6's task-50.3 row).
 */

/** The note an administrator may add, at most — task 67.9's bound for a free-text reason (row (1)). */
export const REMINDER_NOTE_MAX_LENGTH = 500;

/**
 * Whether the reminder carries a note — the value the category's wording selects on.
 *
 * **A parameter of its own rather than an empty note**, because the catalogue's ICU `select` chooses the sentence
 * by it: with a note the body quotes it, and without one the body says the report is still open. The two spellings
 * are the catalogue's own copy of this vocabulary, in `notification.reporting.manual_reminder`.
 */
export const REMINDER_NOTE = {
  GIVEN: 'given',
  NONE: 'none',
} as const;

export type ReminderNote = (typeof REMINDER_NOTE)[keyof typeof REMINDER_NOTE];

/**
 * What the notice carries, fixed when it is raised (§12.5.6's task-50.1 row (18)): the sender's name as it stands,
 * the report's entity and year, and the note. **The year is text**: the catalogue's ICU would format a number with
 * the locale's thousands separator, and *2 026* is not a year. A type rather than an interface, so it is a record
 * `raise()`'s parameters accept.
 */
export type ReminderParams = {
  readonly senderName: string;
  readonly entityName: string;
  readonly fiscalYear: string;
  readonly noteGiven: ReminderNote;
  readonly note: string;
};
