import { TEMPLATE_GATE, type TemplateGate } from '@api/contracts/digital-template-map';
import type { WorkbookAnswer } from './workbook-value';

/** One field the report answers, as a gate reads it: its element, the member it is held for, and what it holds. */
export interface HeldAnswers {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly answers: readonly WorkbookAnswer[];
}

/**
 * Whether the report answers one of the template's own yes/no questions *yes* (task 46.1; the map's gates). **A gate
 * the report does not affirm is left as EFRAG ships it**, so this answers yes or nothing — never a written *no* that the
 * report did not state.
 *
 * - `held`: any of the group's elements answered — a certification described, a pollutant reported.
 * - `affirmed`: one of the group's answers says yes or is a figure above zero — a site inside a biodiversity-sensitive
 *   area, a conviction. A report answering *no* for every site, or a nil return for convictions and fines, holds the
 *   group and still answers the question *no*.
 * - `several`: the group held for more than one member — B8's employees in more than one country.
 */
export function gateIsAffirmed(input: { readonly gate: TemplateGate; readonly held: readonly HeldAnswers[] }): boolean {
  const { gate } = input;
  const group = input.held.filter((field) => gate.when.includes(field.elementKey));
  switch (gate.answer) {
    case TEMPLATE_GATE.HELD:
      return group.length > 0;
    case TEMPLATE_GATE.AFFIRMED:
      return group.some((field) => field.answers.some(affirms));
    case TEMPLATE_GATE.SEVERAL:
      return new Set(group.map((field) => field.dimensionKey)).size > 1;
  }
}

/** A yes, or a decimal above zero — the store's decimals are plain strings, so a sign and a non-zero digit decide. */
const affirms = (answer: WorkbookAnswer): boolean =>
  ('yes' in answer && answer.yes) || ('number' in answer && !answer.number.trim().startsWith('-') && /[1-9]/u.test(answer.number));
