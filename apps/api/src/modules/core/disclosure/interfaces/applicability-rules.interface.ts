import type { ApplicabilityRule } from '../models/applicability.model';

/** FR-28's rules, as this module reads them (task 91.3). */
export interface ApplicabilityRules {
  /**
   * The rules in force **today** for a standard, or none where nothing is registered.
   *
   * One named input, like `TaxonomyRegistry.registeredVersions` beside it: a single-field query is
   * still an object, and this is the one that survives the second field — which §12.5.6's task-91.3
   * row already anticipates, since a country whose transposing legislation diverges becomes a second
   * scope resolved from the entity.
   *
   * *Today*, not the report's period start, and §12.5.6's task-91.3 row carries the argument:
   * UC-81's business rule says a threshold change *"that obliges review of an existing report
   * raises a notice"*, which only holds if a published change reaches reports already open. A
   * report's shape is therefore not pinned the way DR-4 pins its taxonomy version — which is the
   * case UX-28's retention exists for.
   */
  rulesFor(query: { readonly standard: string }): readonly ApplicabilityRule[];
}

export const APPLICABILITY_RULES = Symbol('APPLICABILITY_RULES');
