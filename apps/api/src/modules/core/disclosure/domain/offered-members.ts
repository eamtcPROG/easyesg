import { membersOf } from '@easyesg/vsme';
import { bareMember } from '../models/bare-member';

/**
 * The options a choice field offers: its domain's, narrowed to the members `disclosure_offered_members` names for the
 * element (task 79.7; §12.5.6's task-79.7 row) — C7's rights, narrower than the domain they share with C6's content.
 *
 * **An entry that is not a subset of the domain offers the domain**, the artefact's fail-open direction: a member the
 * pinned version does not declare means the entry was written against another list, and narrowing by what is left of it
 * would offer members nobody chose. `offered-members.service.spec.ts` holds the shipped entries to both versions.
 */
export function offeredOptions<Option extends { readonly value: string }>(input: {
  readonly options: readonly Option[];
  readonly offered: ReadonlySet<string> | undefined;
}): readonly Option[] {
  const { options, offered } = input;
  if (offered === undefined) return options;
  const narrowed = options.filter((option) => offered.has(bareMember(option.value)));
  return narrowed.length === offered.size ? narrowed : options;
}

/**
 * Does this choice answer hold only members the element offers? — the write's question (task 79.7). An answer holding
 * nothing, or an element the artefact does not narrow, holds nothing it refuses.
 */
export function holdsOnlyOffered(input: {
  readonly valueText: string | null | undefined;
  readonly offered: ReadonlySet<string> | undefined;
}): boolean {
  const { valueText, offered } = input;
  if (offered === undefined || valueText === null || valueText === undefined) return true;
  return membersOf(valueText).every((member) => offered.has(bareMember(member)));
}
