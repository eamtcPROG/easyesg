import { CELL_VALUE_KIND, type CellValue } from '@easyesg/xlsx-patch';
import { type DigitalTemplateMap, TEMPLATE_ENCODING, type TemplateEncoding } from '@api/contracts/digital-template-map';

/** One answer, as the field holds it: a decimal, text, a yes/no, or a member's qualified name. */
export type WorkbookAnswer =
  | { readonly number: string }
  | { readonly text: string }
  | { readonly yes: boolean }
  | { readonly member: string };

/** A member the cell's list has no string for — the caller decides whether that is a note or a refusal. */
export interface Unlisted {
  readonly unlisted: string;
}

/**
 * An answer as the template's cell takes it (task 46.1; the map's encodings, task-46 row (1)): a number as a number, a
 * yes/no as a TRUE/FALSE cell or EFRAG's own `YES`/`NO`, a member as the English string EFRAG's dropdown holds for it
 * (182/31), and text as text — **always an inline string, so a reporter's `=SUM(…)` is the words they typed** and never
 * a formula (NFR-70; FR-50 AC-9).
 *
 * An answer of one shape under an encoding of another is a defect in the map, not a value to coerce, and throws.
 */
export function cellValueOf(input: {
  readonly encoding: TemplateEncoding;
  readonly answer: WorkbookAnswer;
  readonly lists: DigitalTemplateMap['lists'];
}): CellValue | Unlisted {
  const { encoding, answer } = input;
  switch (encoding.as) {
    case TEMPLATE_ENCODING.NUMBER:
      if ('number' in answer) return { kind: CELL_VALUE_KIND.NUMBER, value: answer.number };
      break;
    case TEMPLATE_ENCODING.TEXT:
      if ('text' in answer) return { kind: CELL_VALUE_KIND.TEXT, value: answer.text };
      break;
    case TEMPLATE_ENCODING.BOOLEAN:
      if ('yes' in answer) return { kind: CELL_VALUE_KIND.BOOLEAN, value: answer.yes };
      break;
    case TEMPLATE_ENCODING.WORDS:
      if ('yes' in answer) return { kind: CELL_VALUE_KIND.TEXT, value: answer.yes ? encoding.true : encoding.false };
      break;
    case TEMPLATE_ENCODING.LIST: {
      if (!('member' in answer)) break;
      const text = input.lists[encoding.list]?.[answer.member];
      return text === undefined ? { unlisted: answer.member } : { kind: CELL_VALUE_KIND.TEXT, value: text };
    }
  }
  throw new Error(`a ${Object.keys(answer)[0]} answer cannot be written as ${encoding.as}`);
}

/** Whether `cellValueOf` answered a member the list has no string for. */
export const isUnlisted = (value: CellValue | Unlisted): value is Unlisted => 'unlisted' in value;
