/**
 * S-13's record namespace, declared once (task 134): the form, its controls and its three sections
 * read it. In `components/shared/` on that folder's one admission test; the list reads
 * `organization.entities` and is not a reader of this.
 */
export const ENTITY_RECORD_MESSAGES = 'organization.entities.record' as const;

/** The index's namespace: its section, list and loading state read it. */
export const ENTITIES_MESSAGES = 'organization.entities' as const;
