/**
 * The mapping between two registered taxonomy versions, with the pair's explicit backwards-compatibility determination
 * (tasks 67.17, 67.21; FR-67, FR-69; 182/39, 182/40) — which a migration run reads to move reports in bulk or one by one,
 * and A-04 draws beside the pair.
 *
 * **A port of its own rather than a method on `TaxonomyRegistry`** (interface segregation): every reader of the
 * registry resolves elements, and none of them asks how two versions differ. `platform/taxonomy` provides both from one
 * service.
 */
/**
 * A field's kind of change and a pair's determination (182/39, 182/40) — **declared here, once**, because both contexts
 * read them: `platform/taxonomy` authors and executes a mapping, and `core/disclosure` names a migrated report's changed
 * fields to its organization (task 67.20). The taxonomy's domain re-exports them under its own names.
 */
export const TAXONOMY_FIELD_CHANGE = {
  ADDED: 'added',
  REMOVED: 'removed',
  ALTERED: 'altered',
} as const;

export type TaxonomyFieldChange = (typeof TAXONOMY_FIELD_CHANGE)[keyof typeof TAXONOMY_FIELD_CHANGE];

export const TAXONOMY_COMPATIBILITY = {
  COMPATIBLE: 'compatible',
  BREAKING: 'breaking',
} as const;

export type TaxonomyCompatibility = (typeof TAXONOMY_COMPATIBILITY)[keyof typeof TAXONOMY_COMPATIBILITY];

export interface TaxonomyMappedField {
  readonly element: string;
  readonly change: TaxonomyFieldChange;
}

export interface TaxonomyVersionMapping {
  readonly from: string;
  readonly to: string;
  readonly determination: TaxonomyCompatibility;
  readonly fields: readonly TaxonomyMappedField[];
}

export interface TaxonomyMappings {
  /** The mapping between two registered versions, as published — `null` where none is, never a guess. */
  mapping(query: { readonly standard: string; readonly from: string; readonly to: string }): TaxonomyVersionMapping | null;
}

export const TAXONOMY_MAPPINGS = Symbol('TAXONOMY_MAPPINGS');
