/**
 * The two kinds of notice parameter that are **data rather than text**, written in the reader's language when the
 * notice is read or sent (task 51.2; FR-164, FR-165).
 *
 * A notice's params are fixed when it opens (FR-160) and rendered later, per recipient, in each recipient's language
 * (FR-169) — so anything worded has to stay a key until then. A plain string or number reaches ICU as it is; these two
 * are expanded first by the notification module, the one place every rendering passes through: the centre, the email
 * and A-17's specimen. **Beside the port**, in the one surface producers share, because a producer builds them and the
 * notification module reads them.
 */

/** A report's fields by module — named by their labels in the reader's language, never by their keys. */
export interface FieldListParam {
  readonly fieldList: {
    /** The report's pinned taxonomy version, which its labels are read for (DR-4). */
    readonly taxonomyVersion: string;
    readonly modules: readonly {
      /** The module's reference — `B3` — the standard's own name for it, which every surface prints. */
      readonly module: string;
      readonly elementKeys: readonly string[];
    }[];
  };
}

/** A legal date (NFR-34), `YYYY-MM-DD`, written as the reader's language writes a date — never moved by a zone. */
export interface CalendarDateParam {
  readonly calendarDate: string;
}

/** What a notice parameter may be. */
export type NoticeParam = string | number | FieldListParam | CalendarDateParam;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isFieldListParam = (value: unknown): value is FieldListParam =>
  isRecord(value) &&
  isRecord(value.fieldList) &&
  typeof value.fieldList.taxonomyVersion === 'string' &&
  Array.isArray(value.fieldList.modules) &&
  value.fieldList.modules.every(
    (entry: unknown) =>
      isRecord(entry) &&
      typeof entry.module === 'string' &&
      Array.isArray(entry.elementKeys) &&
      entry.elementKeys.every((key: unknown) => typeof key === 'string'),
  );

export const isCalendarDateParam = (value: unknown): value is CalendarDateParam =>
  isRecord(value) && typeof value.calendarDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value.calendarDate);
