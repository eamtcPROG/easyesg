import type { TaxonomyVersionMapping } from '@api/contracts/taxonomy-mapping.port';
import type { TaxonomyConsole, TaxonomyExposure } from '../models/taxonomy-console.model';

/**
 * A-04's store (tasks 67.21, 67.22) — the store's taxonomy artefacts, the committed candidates, and the cross-tenant
 * exposure count. **Its adapter maps the store's errors onto this module's refusals**, A-03's arrangement.
 */
export interface TaxonomyConsoleStore {
  state(): Promise<TaxonomyConsole>;

  /**
   * A committed candidate's artefacts published as one set (67.14) — its taxonomy, its classifications, its templates
   * and their maps — or null where the release holds no such candidate.
   */
  registerCandidate(input: { readonly version: string; readonly operatorId: string }): Promise<{ readonly id: string } | null>;

  /** Throws `TaxonomyChangedError` where the pair's mapping in force is not `expectedRevision` (0 for none). */
  publishMapping(input: {
    readonly mapping: TaxonomyVersionMapping;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }>;

  /** Opens a window at `from` on the adoption schedule (`ConfigurationPublisher.openWindow`). */
  adopt(input: {
    readonly version: string;
    readonly templateVersion: string;
    readonly from: string;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }>;

  /** UC-77's counts, read through the logged cross-tenant door — never a report's value (D-5). */
  exposure(input: { readonly newest: string; readonly requesterId: string }): Promise<TaxonomyExposure>;
}

export const TAXONOMY_CONSOLE_STORE = Symbol('TAXONOMY_CONSOLE_STORE');
