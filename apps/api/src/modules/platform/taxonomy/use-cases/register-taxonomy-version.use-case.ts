import { TaxonomyCandidateNotFoundError } from '../errors/taxonomy-console.errors';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';

/**
 * UC-75 (task 67.21; FR-65; 182/48): a taxonomy version registered — **what the release commits, not an upload**: its
 * artefacts sit under `config/taxonomy-candidates/<version>/`, extracted offline, and registering publishes them into
 * the store as one set, so the version, its classifications, its templates and their maps arrive together or not at
 * all. **Registering is not adopting** (OQ-45, 182/52): no report pins the version until the schedule says so.
 * Answers the publication, which the audit row names.
 */
export class RegisterTaxonomyVersion {
  constructor(private readonly store: TaxonomyConsoleStore) {}

  async execute(command: { readonly version: string; readonly operatorId: string }): Promise<{ readonly id: string }> {
    const registered = await this.store.registerCandidate(command);
    if (registered === null) throw new TaxonomyCandidateNotFoundError();
    return registered;
  }
}
