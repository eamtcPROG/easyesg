import { ENTITY_FIELD, type EntityField } from '@easyesg/validation';
import { entityRoute } from './routes';

/**
 * The anchor of each field S-13's record holds that a finding can name (task 210; `architecture.md` §12.5.6's task-210
 * row (2)) — one spelling, so the identity section's field and the ways S-08 and S-11 lead to it cannot come apart.
 *
 * **Beside `routes.ts` rather than in it**, because `proxy.ts` reads that module and a vocabulary from
 * `@easyesg/validation` has no business in the proxy's bundle.
 */
export const ENTITY_FIELD_ANCHOR = {
  [ENTITY_FIELD.IDNO]: 'entity-idno',
} as const satisfies Record<EntityField, string>;

/** S-13's Record at a field the entity's record answers — where a finding on it leads, since no step holds it. */
export const entityFieldRoute = (input: { readonly entityId: string; readonly field: EntityField }): string =>
  `${entityRoute(input.entityId)}#${ENTITY_FIELD_ANCHOR[input.field]}`;

/** The field an address's fragment lands on in S-13's record — `null` where it names none. */
export function entityFieldLandedOn(hash: string): EntityField | null {
  const anchor = hash.startsWith('#') ? hash.slice(1) : hash;
  return Object.values(ENTITY_FIELD).find((field) => ENTITY_FIELD_ANCHOR[field] === anchor) ?? null;
}
