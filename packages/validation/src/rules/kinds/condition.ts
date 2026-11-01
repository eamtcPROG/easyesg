import { CONDITION_KIND, type Condition } from '../rule-definition.js';
import { holdsValue, type FieldValue } from '../field-value.js';
import type { ValueIndex } from '../value-index.js';

/**
 * Does a rule's condition hold (task 40.2)? Read by the presence kinds' optional `when` and by `exclusive`, so
 * the three cannot come to disagree on what *answered* means.
 *
 * Over every row the element holds: a condition names an element, and a list holds when any of its rows does.
 */
export function conditionHolds(condition: Condition, index: ValueIndex): boolean {
  const rows = index.get(condition.element) ?? [];
  switch (condition.kind) {
    case CONDITION_KIND.ANSWERED:
      return rows.some(holdsValue);
    case CONDITION_KIND.IS_TRUE:
      return rows.some((row) => row.valueBoolean === true);
    case CONDITION_KIND.HAS_MEMBER:
      return rows.some((row) => holdsValue(row) && membersOf(row).includes(bare(condition.member)));
  }
}

/**
 * The members a choice holds, bare. A choice of one stores its member's qualified name and a choice of several its
 * members separated by spaces (task 91.1), so one split reads both; a declaration of not available holds none, which
 * `holdsValue` has already said.
 */
const membersOf = (row: FieldValue): readonly string[] =>
  (row.valueText ?? '').split(/\s+/u).filter((member) => member !== '').map(bare);

/** A member without its taxonomy prefix — `vsme:OtherContentMember` and `OtherContentMember` name one member. */
const bare = (member: string): string => member.slice(member.indexOf(':') + 1);
