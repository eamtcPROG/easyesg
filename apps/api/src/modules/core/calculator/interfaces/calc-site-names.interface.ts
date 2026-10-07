/**
 * What each of a report's B1 site rows is called (task 39.1) — the names S-09 groups its lines under.
 *
 * **A port, because the answer is `core/disclosure`'s wizard read**, and a use case here may not call another module's
 * service: the adapter (`services/wizard-site-names.service.ts`) reads B1's step through `WizardService`, which that
 * module exports, and `domain/site-names.ts` picks the names out of it.
 */
export interface CalcSiteNames {
  /** By ordinal on the site axis; a row nothing names is absent. */
  names(query: { readonly reportId: string }): Promise<ReadonlyMap<number, string>>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const CALC_SITE_NAMES = Symbol('CALC_SITE_NAMES');
