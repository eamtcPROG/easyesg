import type { TaxonomyMappings } from '@api/contracts/taxonomy-mapping.port';
import { TAXONOMY_STANDARD } from '../constants/taxonomy.constants';
import type { Compatibility } from '../domain/version-mapping';
import { MigrationMappingMissingError, TaxonomyVersionUnknownError } from '../errors/taxonomy-console.errors';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';

export interface RunPair {
  readonly from: string;
  readonly to: string;
  readonly toTemplateVersion: string;
}

/**
 * What a run between two versions moves reports by (tasks 67.23, 67.7) — read beside the two use cases that need it,
 * the preview and the start, so the console is shown exactly the determination the run would use. **Both versions must
 * be registered, the template must be one registered against `to`, and the pair's mapping must be published**: a run
 * with no published mapping would have to guess whether a report may move unreviewed, which is 182/39's to say.
 */
export async function resolveRunPair(input: {
  readonly pair: RunPair;
  readonly console: TaxonomyConsoleStore;
  readonly mappings: TaxonomyMappings;
}): Promise<{ readonly determination: Compatibility }> {
  const { versions } = await input.console.state();
  const from = versions.find((version) => version.version === input.pair.from);
  const to = versions.find((version) => version.version === input.pair.to);
  if (from === undefined || to === undefined || !to.templateVersions.includes(input.pair.toTemplateVersion)) {
    throw new TaxonomyVersionUnknownError();
  }
  const mapping = input.mappings.mapping({ standard: TAXONOMY_STANDARD.VSME, from: input.pair.from, to: input.pair.to });
  if (mapping === null) throw new MigrationMappingMissingError();
  return { determination: mapping.determination };
}
