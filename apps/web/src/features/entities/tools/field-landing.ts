import { ENTITY_FIELD, type EntityField } from '@easyesg/validation';
import { entityFieldLandedOn } from '@/lib/entity-field-route';
import type { EntityFields } from './entity-fields';

/**
 * The input on S-13's form that holds each field the entity's record answers (task 210; `architecture.md` §12.5.6's
 * task-210 row (2)) — a field added to the vocabulary with no input here fails `pnpm typecheck`.
 */
export const ENTITY_FIELD_INPUT = {
  [ENTITY_FIELD.IDNO]: 'idno',
} as const satisfies Record<EntityField, keyof EntityFields>;

/**
 * The input an address lands focus in as the record opens — the one its fragment names, which a finding on the
 * entity's IDNO carries from S-08 or S-11 — or none (FR-42 behaviour 6, UX-22).
 */
export function landingInput(hash: string): (typeof ENTITY_FIELD_INPUT)[EntityField] | null {
  const field = entityFieldLandedOn(hash);
  return field === null ? null : ENTITY_FIELD_INPUT[field];
}
