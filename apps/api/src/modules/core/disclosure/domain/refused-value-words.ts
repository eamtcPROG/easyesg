import type { DisclosureLabel } from '@easyesg/i18n';
import type { DomainError } from '@api/app/filters/domain.error';
import type { RefusalWords } from '@api/app/filters/refusal-words';
import type { RefusedValue, WordedRefusedValue } from '../models/refused-write.model';

/**
 * Each refused value as a reader meets it (task 218; §12.5.6's task-218 row (a), (3)) — the refusal worded and the
 * field named, so the banner can name a field on a step that is not on screen, as a finding's field is named (task
 * 42.2). A member's name is the breakdown row or the chosen pollutant, and is absent on an undimensioned field.
 *
 * Pure, with the labels and the wording handed in, so the naming is a unit case; the service reads both in the
 * request's language.
 */
export function wordRefusedValues(input: {
  readonly refused: readonly RefusedValue[];
  readonly labels: Readonly<Record<string, DisclosureLabel>> | null;
  readonly members: Readonly<Record<string, DisclosureLabel>> | null;
  readonly words: (refusal: DomainError) => RefusalWords;
}): WordedRefusedValue[] {
  return input.refused.map(({ key, modules, refusal }) => ({
    ...input.words(refusal),
    elementKey: key.elementKey,
    dimensionKey: key.dimensionKey,
    ordinal: key.ordinal,
    modules,
    label: input.labels?.[key.elementKey]?.text ?? null,
    memberLabel: key.dimensionKey === '' ? null : (input.members?.[key.dimensionKey]?.text ?? null),
  }));
}
