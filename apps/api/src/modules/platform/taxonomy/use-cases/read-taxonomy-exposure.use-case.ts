import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';
import type { TaxonomyExposure } from '../models/taxonomy-console.model';

/**
 * UC-77 (task 67.22; FR-68; 182/49): every report pinned to a version older than the **newest registered** — not the
 * adoption schedule, which would never list a FY2025 report on its own version — grouped by organization and by
 * version, with both counts and no report value (FR-77, D-5). Sizes a migration before one is chosen.
 */
export class ReadTaxonomyExposure {
  constructor(
    private readonly registry: TaxonomyRegistry,
    private readonly store: TaxonomyConsoleStore,
  ) {}

  async execute(input: { readonly requesterId: string }): Promise<TaxonomyExposure> {
    const [newest] = [...this.registry.registeredVersions({ standard: 'vsme' })].sort().reverse();
    if (newest === undefined) return { newest: null, versions: [], organizations: [] };
    return this.store.exposure({ newest, requesterId: input.requesterId });
  }
}
