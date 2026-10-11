import { roundHalfUp, type Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';

/** Where the document's own words sit in the committed catalogues (task 43; §12.5.6's task-43 row (b)). */
const NAMESPACE = 'core.export.document';

/**
 * The document's words and figures in one language — the export's, never the request's (FR-52, 182/34).
 *
 * **Its words are its own catalogue**: the standard's module names, the marks, the cover and the provenance, authored
 * in three locales. **Its figures and dates are the locale's own layout** (NFR-26) over values already decided — a
 * figure rounded once, half-up, by FR-29's one function before it is laid out, and a calendar date printed as the day
 * it spells, never through a zone (NFR-34).
 */
export interface DocumentWords {
  readonly locale: Locale;
  /** A word of the document's own — `''` where the catalogue has none, which prints nothing rather than a key (UX-97). */
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  /** Any committed message by its full key — a finding's — or `null` where it has no wording. */
  message(key: string, params?: Readonly<Record<string, unknown>>): string | null;
  /** A decimal rounded to `places` where some are given, every digit kept where none are. */
  figure(value: string, places: number | null): string;
  /**
   * A fraction as the locale writes a percentage — `0.1020408…` as *10.20%*, *10,20 %* — rounded to `places` decimals
   * of the percent where some are given (task-46 row (10)).
   */
  percent(value: string, places: number | null): string;
  /** A calendar date, `YYYY-MM-DD`, as the locale writes a date in full. */
  date(date: string): string;
  /** Two calendar dates as one range — *1 January – 31 December 2026*. */
  range(start: string, end: string): string;
  /**
   * An instant — the moment a file was produced (NFR-22) — on the wall clock of `timezone`, the zone named beside it,
   * because a reader holding the file may sit in another.
   */
  moment(instant: Date, timezone: string): string;
  /** The options a reporter chose, as the locale lists them. */
  list(items: readonly string[]): string;
}

/** The widest a decimal's fraction is laid out — beyond every figure an SME reports. */
const EVERY_DIGIT = 20;

/** A calendar date at midnight in UTC, which the formatter is told to read in UTC: the day it spells, never the next. */
const asDay = (date: string): Date => new Date(`${date}T00:00:00Z`);

export function documentWords(locale: Locale): DocumentWords {
  const numbers = new Map<number, Intl.NumberFormat>();
  const numberFormat = (places: number | null): Intl.NumberFormat => {
    const key = places ?? -1;
    let format = numbers.get(key);
    if (format === undefined) {
      format = new Intl.NumberFormat(
        locale,
        places === null
          ? { maximumFractionDigits: EVERY_DIGIT }
          : { minimumFractionDigits: places, maximumFractionDigits: places },
      );
      numbers.set(key, format);
    }
    return format;
  };
  const percents = new Map<number, Intl.NumberFormat>();
  const percentFormat = (places: number | null): Intl.NumberFormat => {
    const key = places ?? -1;
    let format = percents.get(key);
    if (format === undefined) {
      format = new Intl.NumberFormat(
        locale,
        places === null
          ? { style: 'percent', maximumFractionDigits: EVERY_DIGIT }
          : { style: 'percent', minimumFractionDigits: places, maximumFractionDigits: places },
      );
      percents.set(key, format);
    }
    return format;
  };
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  const lists = new Intl.ListFormat(locale, { type: 'unit', style: 'short' });

  return {
    locale,
    t: (key, params) => translate(locale, `${NAMESPACE}.${key}`, params) ?? '',
    message: (key, params) => translate(locale, key, params) ?? null,
    // A string reaches the formatter as the exact decimal it is (ECMA-402's string operand), never a float.
    figure: (value, places) =>
      numberFormat(places).format((places === null ? value : roundHalfUp(value, places)) as Intl.StringNumericLiteral),
    // Rounded as the fraction it is stored as, two places further along, so a percent's decimals round once and half-up.
    percent: (value, places) =>
      percentFormat(places).format((places === null ? value : roundHalfUp(value, places + 2)) as Intl.StringNumericLiteral),
    date: (date) => dates.format(asDay(date)),
    range: (start, end) => dates.formatRange(asDay(start), asDay(end)),
    moment: (instant, timezone) =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        timeZoneName: 'short',
      }).format(instant),
    list: (items) => lists.format(items),
  };
}
