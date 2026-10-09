import { ENTITY_STATUS, type ReportingEntity } from '@easyesg/contracts';

/**
 * The two choices the creation screen carries in its address (UX-4): the entity and, once one is
 * chosen, the period. Pure, so the parse is a unit spec. `?entity=` and `?period=` reach the screen
 * through the address bar — a repeated key takes its first value and an absent one is `undefined` —
 * and the section re-finds the period in what the API answered rather than trusting the id.
 */

export interface CreationChoice {
  readonly entityId?: string;
  readonly periodId?: string;
}

const single = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export const creationChoice = (
  query: Record<string, string | string[] | undefined>,
): CreationChoice => ({ entityId: single(query, 'entity'), periodId: single(query, 'period') });

/** An entity the screen offers to start a report for — the two fields its list draws. */
export interface OfferedEntity {
  readonly id: string;
  readonly name: string;
}

/**
 * The entities S-39 offers, and the entity choice as it can honour it (FR-20; 182/14; §12.5.6's task-187 row).
 *
 * **Active entities only, by name**: an archived entity takes no new report, which the api refuses with
 * `entity-archived`, so the list does not offer it — S-13 is where it is still listed. **An `?entity=` naming one it
 * does not offer reads as no choice made**: S-05's row of an archived entity's period no longer links here, but a
 * bookmark or a stale tab still can, and drawing that entity's periods with nothing chosen above them would offer a
 * write the api then refuses.
 */
export const creationEntities = (input: {
  readonly entities: readonly ReportingEntity[];
  readonly entityId?: string;
}): { readonly entities: readonly OfferedEntity[]; readonly entityId?: string } => {
  const entities = input.entities
    .filter((entity) => entity.status === ENTITY_STATUS.ACTIVE)
    .map((entity) => ({ id: entity.id, name: entity.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const offered = entities.some((entity) => entity.id === input.entityId);
  return { entities, entityId: offered ? input.entityId : undefined };
};
