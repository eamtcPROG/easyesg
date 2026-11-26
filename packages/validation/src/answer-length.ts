/**
 * How long a text answer and a not-available reason may be (task 259; `architecture.md` §12.5.6's task-259 row).
 *
 * **The bound is the EFRAG Digital Template's, not a number of this platform's.** One cell of the official workbook
 * holds at most 32,767 characters, and the Excel export writes an answer into a cell and a reason into a note on one
 * (FR-50), so a longer text was stored and then failed its export. UX-19 admits a hard limit only where the standard
 * imposes one; the template's file is where it does. `apps/api`'s `answer-capacity.spec.ts` holds this value to what
 * `@easyesg/xlsx-patch` refuses, against each registered template, so the two cannot drift apart.
 *
 * **Counted as Excel counts, in UTF-16 code units** — `String.prototype.length`, never a count of code points. A
 * character outside the Basic Multilingual Plane is two units to the workbook, so counting it as one would admit a
 * text the export then refuses.
 *
 * **Here rather than in `apps/api` for the package's stated reason**: the api refuses an over-long value per value
 * (`valueRefusal`) and S-07 says so at the field before the value leaves, one bound at both sites.
 */
export const ANSWER_MAX_LENGTH = 32_767;

/** Whether a text is longer than an answer or a reason may be. A text the value does not carry is not. */
export const answerIsTooLong = (text: string | null | undefined): boolean =>
  text !== null && text !== undefined && text.length > ANSWER_MAX_LENGTH;
