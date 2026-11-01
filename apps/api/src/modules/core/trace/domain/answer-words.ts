import { DISCLOSURE_KIND, MEMBER_SEPARATOR, type DisclosureKind } from '@easyesg/vsme';
import { DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { STORED_BOOLEAN, type RawAnswer } from '../models/change-history.model';

/**
 * The words and layouts a disclosure answer is printed with — the document's own (§12.5.6's task-84 row (d)), so a
 * value reads in its history exactly as the report prints it: the same *yes*, the same mark for a declared zero, the
 * same unit symbols, every digit of a figure in the reader's layout.
 */
export interface AnswerWords {
  readonly yes: string;
  readonly no: string;
  readonly nilReturn: string;
  readonly notAvailable: string;
  /** A unit's symbol — the code itself where the document has none, as the document prints it. */
  unit(code: string): string;
  /** A decimal, every digit kept, in the locale's layout. */
  figure(value: string): string;
  /** A stored fraction as the locale writes a percentage. */
  percent(value: string): string;
  /** A calendar date in full, the day it spells. */
  date(date: string): string;
  list(items: readonly string[]): string;
  /** A choice's member label at the report's pinned version, or `null` where the version words it nothing. */
  member(key: string): string | null;
}

/**
 * One answer in words, or `null` where it holds none. **A declared zero and a declared gap are their marks**, never a
 * blank (UX-119); every other answer is read from the column its element's kind answers into — and, where the kind is
 * unknown or the column it names is empty, from whichever column holds something, so a value is never hidden for want
 * of a kind.
 */
export function wordAnswer(input: {
  readonly answer: RawAnswer;
  readonly kind: DisclosureKind | null;
  /** The filing's currency, for a monetary element. */
  readonly currency: string | null;
  readonly words: AnswerWords;
}): string | null {
  const { answer, words } = input;
  if (answer.state === DISCLOSURE_STATE.NIL_RETURN) return words.nilReturn;
  if (answer.state === DISCLOSURE_STATE.NOT_AVAILABLE) return words.notAvailable;
  return byKind(input) ?? anyColumn(answer, words);
}

function byKind({ answer, kind, currency, words }: Parameters<typeof wordAnswer>[0]): string | null {
  switch (kind) {
    case DISCLOSURE_KIND.NUMERIC:
      return answer.numeric === null ? null : withUnit(words.figure(answer.numeric), answer.unit, words);
    case DISCLOSURE_KIND.MONETARY:
      return answer.numeric === null ? null : currency === null ? words.figure(answer.numeric) : `${words.figure(answer.numeric)} ${currency}`;
    case DISCLOSURE_KIND.PERCENT:
      return answer.numeric === null ? null : words.percent(answer.numeric);
    case DISCLOSURE_KIND.BOOLEAN:
      return yesNo(answer.boolean, words);
    case DISCLOSURE_KIND.DATE:
      return answer.date === null ? null : words.date(answer.date);
    case DISCLOSURE_KIND.ENUMERATION:
    case DISCLOSURE_KIND.ENUMERATION_SET: {
      const labels = (answer.text ?? '')
        .split(MEMBER_SEPARATOR)
        .filter((member) => member !== '')
        .map((member) => words.member(member))
        .filter((label): label is string => label !== null);
      return labels.length === 0 ? null : words.list(labels);
    }
    case DISCLOSURE_KIND.YEAR:
    case DISCLOSURE_KIND.TEXT:
    case DISCLOSURE_KIND.TEXT_BLOCK:
      return answer.text;
    case null:
      return null;
  }
}

/** What the answer holds where its kind could not say — never a member key, which is not a reader's word. */
function anyColumn(answer: RawAnswer, words: AnswerWords): string | null {
  if (answer.numeric !== null) return withUnit(words.figure(answer.numeric), answer.unit, words);
  if (answer.boolean !== null) return yesNo(answer.boolean, words);
  if (answer.date !== null) return words.date(answer.date);
  return null;
}

const withUnit = (figure: string, unit: string | null, words: AnswerWords): string =>
  unit === null ? figure : `${figure} ${words.unit(unit)}`;

function yesNo(stored: string | null, words: AnswerWords): string | null {
  if (stored === STORED_BOOLEAN.TRUE) return words.yes;
  if (stored === STORED_BOOLEAN.FALSE) return words.no;
  return null;
}
