import {
  COLUMN_OF_KIND,
  DISCLOSURE_KIND,
  VALUE_COLUMN,
  type DisclosureField,
} from '@easyesg/contracts';
import { BOOLEAN_CHOICE } from './values';

/**
 * A choice field's control and its answers (task 179.2; `architecture.md` §12.5.6's row of that task, `design_spec.md`
 * S-07's amendment of 1 Oct 2026) — pure and out of the control, so the line and the wording rule are specs rather than
 * branches inside a component.
 *
 * **Option cards for every yes/no and a single choice of two to four answers; a select for the rest.** Four is the
 * owner's line, and it is a count read off the wire rather than a list of elements: B1's four two-answer choices and
 * the Basic Module's yes/no questions become cards, legal form's five answers stay a select, and a domain that grows
 * past four moves back by this rule rather than by an edit somewhere. A set-valued answer is neither — several may be
 * chosen, which a radio cannot say — and is `ChoiceSet`'s.
 */
export const CHOICE_CONTROL = { CARDS: 'cards', SELECT: 'select' } as const;

export type ChoiceControl = (typeof CHOICE_CONTROL)[keyof typeof CHOICE_CONTROL];

export interface ChoiceAnswer {
  readonly value: string;
  readonly label: string;
  /** The member's published code, under its words — a select's second line; a card draws none. */
  readonly description?: string;
}

/** The words a choice needs that the wire does not carry — the catalogue's, resolved by the caller. */
export interface ChoiceWords {
  readonly unnamed: string;
  readonly yes: string;
  readonly no: string;
}

/**
 * The control a field's choice is drawn with and the answers it offers, or `null` where the field is not a single
 * choice. **A member is never named by its taxonomy name**: its words where the pinned version has them, else its
 * published code — a reference a reader can cite — else the neutral word; `option.value` is the member's qualified name
 * and may not reach a reader.
 */
export function choiceOf(input: {
  readonly field: Pick<DisclosureField, 'kind' | 'options'>;
  readonly words: ChoiceWords;
}): { readonly control: ChoiceControl; readonly answers: readonly ChoiceAnswer[] } | null {
  const { field, words } = input;
  if (COLUMN_OF_KIND[field.kind] === VALUE_COLUMN.BOOLEAN) {
    return {
      control: CHOICE_CONTROL.CARDS,
      answers: [
        { value: BOOLEAN_CHOICE.YES, label: words.yes },
        { value: BOOLEAN_CHOICE.NO, label: words.no },
      ],
    };
  }
  if (field.kind !== DISCLOSURE_KIND.ENUMERATION) return null;

  const options = field.options ?? [];
  const control =
    options.length >= OPTION_CARDS.FEWEST && options.length <= OPTION_CARDS.MOST
      ? CHOICE_CONTROL.CARDS
      : CHOICE_CONTROL.SELECT;
  return {
    control,
    answers: options.map((option) => ({
      value: option.value,
      label: option.label ?? option.code ?? words.unnamed,
      // The code beside its words, in a select's menu — `Select`'s NACE anatomy. A card draws no second line: the
      // artboard's is a sentence EFRAG does not give, and a code there would be a line the amendment says is absent.
      ...(control === CHOICE_CONTROL.SELECT && option.label !== null && option.code !== null
        ? { description: option.code }
        : {}),
    })),
  };
}

/** The range of answers a single choice is drawn as cards over — the owner's line, declared once. */
const OPTION_CARDS = { FEWEST: 2, MOST: 4 } as const;
