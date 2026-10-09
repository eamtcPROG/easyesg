import { APPLICABILITY_CONDITION, type ApplicabilityCause } from '@easyesg/contracts';
import type { useFormatter, useTranslations } from 'next-intl';
import { calendarDay, legalDate } from '@/lib/legal-date';
import type { ApplicabilityNote } from './applicability-notes';
import { KEPT_ANSWER, type KeptAnswer } from './kept-answer';

/**
 * Why a field is asked, or hidden, in the reader's words (task 95; UX-27, UX-28) — from the cause the api serves, since
 * task 91.3 left the sentence to the client: *"no sentence is composed server-side"*.
 *
 * **One sentence per condition kind**, branched on the vocabulary rather than on the rule's data, because what a reader
 * is told differs in kind: a headcount is quoted with its threshold, a list of sites is a presence, and a sector is
 * named by the question it answers — **never quoted**, since its stored form is an XBRL member name. The driver is named
 * by its label, which the api resolves in the request's locale, and a missing label falls back to a neutral phrase
 * rather than the element key.
 *
 * Pure given the translator and the formatter, which the caller passes, as `module-words.ts` does.
 */
type ApplicabilityTranslator = ReturnType<typeof useTranslations<'organization.wizard.applicability'>>;
type Formatter = ReturnType<typeof useFormatter>;

/** The rule's first driver, by its label — the question every kind but the site rule names. */
function driverOf(t: ApplicabilityTranslator, cause: ApplicabilityCause): string {
  return cause.drivers[0]?.label ?? t('unnamedDriver');
}

/** Every driver, as alternatives — the site rule is satisfied by any of B1's site questions. */
function driversOf(t: ApplicabilityTranslator, format: Formatter, cause: ApplicabilityCause): string {
  const labels = cause.drivers.map((driver) => driver.label).filter((label): label is string => label !== null);
  return labels.length === 0 ? t('unnamedDriver') : format.list(labels, 'alternatives');
}

/** A decimal string as the reader writes numbers — a headcount or a threshold, never arithmetic. */
const numberOf = (format: Formatter, decimal: string): string => format.number(Number(decimal), 'exact');

/** UX-27's note: what brought these questions, and what happens if that answer changes. */
export function noteWords(
  t: ApplicabilityTranslator,
  format: Formatter,
  note: ApplicabilityNote,
): { readonly title: string; readonly body: string } {
  const fields = note.labels.length === 0 ? t('unnamedFields') : format.list(note.labels, 'enumeration');
  const { cause } = note;
  const body = t('note.body');
  switch (cause.condition) {
    case APPLICABILITY_CONDITION.NUMERIC_AT_LEAST:
      return {
        title: t('note.numericAtLeast', {
          driver: driverOf(t, cause),
          answer: numberOf(format, cause.answer ?? '0'),
          threshold: numberOf(format, cause.threshold ?? '0'),
          fields,
        }),
        body,
      };
    case APPLICABILITY_CONDITION.ANY_ROW_ANSWERED:
      return { title: t('note.anyRowAnswered', { drivers: driversOf(t, format, cause), fields }), body };
    case APPLICABILITY_CONDITION.MEMBER_WITHIN:
      return { title: t('note.memberWithin', { driver: driverOf(t, cause), fields }), body };
  }
}

/**
 * UX-28's reason a field is hidden. **An unanswered driver is its own sentence** for the two kinds that read one answer:
 * the field waits on B1 rather than being ruled out by it (§12.5.6's task-91.3 row: *"the cause saying the driver is
 * unanswered rather than naming a value"*). The site rule has no single answer to wait on — no site is its whole reason.
 */
export function hiddenReason(t: ApplicabilityTranslator, format: Formatter, cause: ApplicabilityCause): string {
  switch (cause.condition) {
    case APPLICABILITY_CONDITION.NUMERIC_AT_LEAST:
      return cause.answer === null
        ? t('hidden.waiting', { driver: driverOf(t, cause) })
        : t('hidden.numericAtLeast', {
            driver: driverOf(t, cause),
            answer: numberOf(format, cause.answer),
            threshold: numberOf(format, cause.threshold ?? '0'),
          });
    case APPLICABILITY_CONDITION.ANY_ROW_ANSWERED:
      return t('hidden.anyRowAnswered', { drivers: driversOf(t, format, cause) });
    case APPLICABILITY_CONDITION.MEMBER_WITHIN:
      return cause.answer === null
        ? t('hidden.waiting', { driver: driverOf(t, cause) })
        : t('hidden.memberWithin', { driver: driverOf(t, cause) });
  }
}

/**
 * UX-28's kept answer in the reader's words — what the C9 artboard quotes after *"Kept"*. A quantity takes its unit's
 * symbol (`unit-words.ts`) and an amount the filing's currency code, as the field itself shows them (task 36.12); a date
 * is a legal date, formatted in UTC so the day that went in is the day that comes out.
 */
export function keptWords(input: {
  readonly t: ApplicabilityTranslator;
  readonly format: Formatter;
  readonly kept: KeptAnswer;
  readonly units: Readonly<Record<string, string>>;
  readonly yes: string;
  readonly no: string;
}): string {
  const { t, format, kept } = input;
  switch (kept.kind) {
    case KEPT_ANSWER.NOT_AVAILABLE:
      return t('hidden.notAvailable');
    case KEPT_ANSWER.NUMBER:
      return kept.unitCode === null
        ? numberOf(format, kept.value)
        : t('hidden.quantity', { value: numberOf(format, kept.value), unit: input.units[kept.unitCode] ?? kept.unitCode });
    case KEPT_ANSWER.AMOUNT:
      return kept.currency === null
        ? numberOf(format, kept.value)
        : t('hidden.quantity', { value: numberOf(format, kept.value), unit: kept.currency });
    case KEPT_ANSWER.BOOLEAN:
      return kept.value ? input.yes : input.no;
    case KEPT_ANSWER.DATE: {
      const legal = legalDate(kept.value);
      return legal === null ? kept.value : format.dateTime(calendarDay(legal), 'calendar');
    }
    case KEPT_ANSWER.CHOICES:
      return format.list(kept.labels, 'enumeration');
    case KEPT_ANSWER.TEXT:
      return kept.value;
  }
}
