import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { FIELD_CHANGE, readVersionMapping, type VersionMapping } from '../domain/version-mapping';
import { TaxonomyMappingInvalidError, TaxonomyVersionUnknownError } from '../errors/taxonomy-console.errors';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';

export interface PublishVersionMappingCommand {
  readonly mapping: VersionMapping;
  readonly expectedRevision: number;
  readonly operatorId: string;
}

/**
 * UC-76 (task 67.21; FR-67; 182/39, 182/40): a pair's mapping and determination published as configuration — no code
 * change (NFR-86). **Held to its versions**: both are registered, an added field is the later version's alone, a
 * removed field the earlier's alone, an altered field both's — and the determination is one its fields admit. Answers
 * the version put in force, which the audit row names.
 */
export class PublishVersionMapping {
  constructor(
    private readonly registry: TaxonomyRegistry,
    private readonly store: TaxonomyConsoleStore,
  ) {}

  async execute(command: PublishVersionMappingCommand): Promise<{ readonly id: string; readonly revision: number }> {
    const { mapping } = command;
    if (readVersionMapping(mapping) === null) throw new TaxonomyMappingInvalidError();
    const before = this.registry.taxonomy({ standard: 'vsme', version: mapping.from });
    const after = this.registry.taxonomy({ standard: 'vsme', version: mapping.to });
    if (before === null || after === null) throw new TaxonomyVersionUnknownError();

    const inBefore = new Set(before.elements.map((element) => element.key));
    const inAfter = new Set(after.elements.map((element) => element.key));
    const held = mapping.fields.every((field) => {
      switch (field.change) {
        case FIELD_CHANGE.ADDED:
          return inAfter.has(field.element) && !inBefore.has(field.element);
        case FIELD_CHANGE.REMOVED:
          return inBefore.has(field.element) && !inAfter.has(field.element);
        case FIELD_CHANGE.ALTERED:
          return inBefore.has(field.element) && inAfter.has(field.element);
      }
    });
    if (!held) throw new TaxonomyMappingInvalidError();

    return this.store.publishMapping(command);
  }
}
