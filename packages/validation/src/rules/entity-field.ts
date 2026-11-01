/**
 * **The fields a reporting entity's record answers** (task 210; FR-16 behaviour 6; `architecture.md` §12.5.6's task-210
 * row (1)) — read into a report's evaluation beside its disclosure answers, so a rule requires one exactly as it
 * requires an answer, and the interpreter needs no kind of its own for it.
 *
 * **Keyed where no taxonomy element can be.** EFRAG's element keys are bare names (`NumberOfEmployees`), so a prefixed
 * key cannot collide with one in any version, and a finding's field says by its key alone that the entity's record —
 * not a step of the report — is where it is answered.
 *
 * **Here because both tiers read it**: the api adds the field to a run's scope and answers, and the browser leads a
 * finding on it to the entity's record rather than to a step (row (2)).
 */
export const ENTITY_FIELD = {
  /** The entity's IDNO (FR-16), its primary identifier — what EFRAG's template carries as the undertaking's identifier. */
  IDNO: 'entity:idno',
} as const;

export type EntityField = (typeof ENTITY_FIELD)[keyof typeof ENTITY_FIELD];

const ENTITY_FIELDS: ReadonlySet<string> = new Set(Object.values(ENTITY_FIELD));

/** Whether an element key — a finding's field, as read from the wire — is one the entity's record answers. */
export const isEntityField = (elementKey: string): elementKey is EntityField => ENTITY_FIELDS.has(elementKey);
