import type { Locale } from '@easyesg/i18n';
import { isCalendarDateParam, isFieldListParam, type FieldListParam } from '@api/contracts/notice-params';

/**
 * A notice's params as one reader's language writes them (task 51.2): a field list named by its labels, a calendar date
 * written as the locale writes a date, and anything else passed to ICU as it is.
 *
 * **A field with no label is left out rather than printed by its key** — a taxonomy element key is a development-side
 * notion no reader may meet (root `CLAUDE.md`, *User-facing text carries no internal identifiers*); the field is still
 * counted, and the report itself names it. A module none of whose fields has a label keeps its reference.
 *
 * **A date is written in UTC from its calendar day**, so no zone can move it to the day before: the day is the legal fact
 * (NFR-34), and the zone that decided it was applied when it was stored.
 *
 * **A field list has two forms** (task 225; §12.5.6's task-225 row (6)): one sentence for the centre, whose wording
 * places it inside a sentence, and one line per module for an email, which draws it as rows and lines.
 */
export const FIELD_LIST_FORM = {
  SENTENCE: 'sentence',
  LINES: 'lines',
} as const;

export type FieldListForm = (typeof FIELD_LIST_FORM)[keyof typeof FIELD_LIST_FORM];

export function paramsForLocale(input: {
  readonly params: Readonly<Record<string, unknown>>;
  readonly locale: Locale;
  readonly labelOf: (query: { readonly version: string; readonly key: string }) => string | null;
  /** The centre's sentence unless an email asks for its lines. */
  readonly fieldList?: FieldListForm;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input.params).map(([name, value]) => {
      if (isFieldListParam(value)) {
        const lines = moduleLines({ param: value, locale: input.locale, labelOf: input.labelOf });
        return [name, input.fieldList === FIELD_LIST_FORM.LINES ? lines : lines.join('; ')];
      }
      if (isCalendarDateParam(value)) return [name, calendarDate({ date: value.calendarDate, locale: input.locale })];
      return [name, value];
    }),
  );
}

/** One line per module — its reference and its fields' labels — which the centre joins into one sentence. */
function moduleLines(input: {
  readonly param: FieldListParam;
  readonly locale: Locale;
  readonly labelOf: (query: { readonly version: string; readonly key: string }) => string | null;
}): string[] {
  const { taxonomyVersion, modules } = input.param.fieldList;
  const list = new Intl.ListFormat(input.locale, { style: 'long', type: 'conjunction' });
  return modules.map(({ module, elementKeys }) => {
    const labels = elementKeys
      .map((key) => input.labelOf({ version: taxonomyVersion, key }))
      .filter((label): label is string => label !== null);
    return labels.length === 0 ? module : `${module}: ${list.format(labels)}`;
  });
}

function calendarDate(input: { readonly date: string; readonly locale: Locale }): string {
  const [year, month, day] = input.date.split('-').map(Number);
  return new Intl.DateTimeFormat(input.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
