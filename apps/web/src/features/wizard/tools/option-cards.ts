import { COLUMN_OF_KIND, DISCLOSURE_KIND, VALUE_COLUMN, type DisclosureField } from '@easyesg/contracts';

/**
 * Whether a field's choice is drawn as option cards — §11.5's Radio group — rather than a select (task 179.2;
 * `architecture.md` §12.5.6's row of that task, `design_spec.md` S-07's amendment of 1 Oct 2026).
 *
 * **Every yes/no, and a single choice of two to four answers.** Four is the owner's line, and it is a count read off the
 * wire rather than a list of elements: B1's four two-answer choices and the Basic Module's yes/no questions become cards,
 * legal form's five answers stay a select, and a domain that grows past four moves back by this rule rather than by an
 * edit somewhere. A set-valued answer is never cards — several may be chosen, which a radio cannot say.
 *
 * Pure and out of the control, so the line is a spec rather than a branch inside a component.
 */
export function drawnAsOptionCards(field: Pick<DisclosureField, 'kind' | 'options'>): boolean {
  if (COLUMN_OF_KIND[field.kind] === VALUE_COLUMN.BOOLEAN) return true;
  if (field.kind !== DISCLOSURE_KIND.ENUMERATION) return false;
  const answers = field.options?.length ?? 0;
  return answers >= OPTION_CARDS.FEWEST && answers <= OPTION_CARDS.MOST;
}

/** The range of answers a choice is drawn as cards over — the owner's line, declared once. */
const OPTION_CARDS = { FEWEST: 2, MOST: 4 } as const;
