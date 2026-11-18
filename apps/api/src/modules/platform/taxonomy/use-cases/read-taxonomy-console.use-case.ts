import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';
import type { TaxonomyConsole } from '../models/taxonomy-console.model';

/** A-04's read (task 67.21; UC-75, UC-76): versions, candidates, the adoption schedule and each pair's mapping. */
export class ReadTaxonomyConsole {
  constructor(private readonly store: TaxonomyConsoleStore) {}

  execute(): Promise<TaxonomyConsole> {
    return this.store.state();
  }
}
