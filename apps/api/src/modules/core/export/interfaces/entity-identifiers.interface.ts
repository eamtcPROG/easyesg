/** The registry identifiers of the entity a report is for (task 175): its IDNO, and its LEI where it holds one. */
export interface EntityIdentifiers {
  readonly lei: string | null;
  readonly idno: string | null;
}

/**
 * The reporting entity's identifiers, by the report — what the Excel export writes into the template's identifier cell
 * (task 46.1; OQ-18; FR-50 behaviour 6). Its own read rather than a field on the report, because only the export needs
 * them and the report read serves every screen.
 */
export interface EntityIdentifiersStore {
  /** The identifiers of the report's entity — `null` where there is no such report in the bound organization. */
  identifiersOf(query: { readonly reportId: string }): Promise<EntityIdentifiers | null>;
}

export const ENTITY_IDENTIFIERS = Symbol('ENTITY_IDENTIFIERS');
