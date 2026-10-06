import { GHG_SCOPE, type GhgScope } from './factor-set.model';

/**
 * The B3 disclosures a calculation run answers (task 38.4; FR-34, UC-33 step 4) — EFRAG's element keys, pinned here
 * rather than read from anywhere, and `b3-element.model.spec.ts` holds each against both registered taxonomy versions
 * so a release that renames one fails a hermetic spec rather than writing into nothing.
 *
 * **Two, not four.** B3's location-based total and its GHG intensity are derivations over these two and B1's turnover
 * (`disclosure-derivation.vsme.json`, §12.5.6's task-38.4 row), recomputed whenever any of them moves — so a run
 * writes the scopes and the store derives the rest.
 */
export const B3_ELEMENT_FOR_SCOPE: Readonly<Record<GhgScope, string>> = {
  [GHG_SCOPE.SCOPE_1]: 'GrossScope1GreenhouseGasEmissions',
  [GHG_SCOPE.SCOPE_2_LOCATION_BASED]: 'GrossLocationBasedScope2GreenhouseGasEmissions',
};
