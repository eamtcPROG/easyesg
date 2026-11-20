import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TaxonomyVersionUnknownError } from '../errors/taxonomy-console.errors';
import { COMPATIBILITY, FIELD_CHANGE, structuralChanges, type VersionMapping } from '../domain/version-mapping';

/**
 * UC-76's start (task 67.21; FR-67; 182/40): a mapping proposed for a pair — every field whose shape differs, and the
 * determination that follows from them, **for the operator to complete**: a field whose meaning changed under an
 * unchanged shape is theirs to mark, and a pair that only adds may still be called breaking. Writes nothing.
 */
export class ProposeVersionMapping {
  constructor(private readonly registry: TaxonomyRegistry) {}

  execute(pair: { readonly from: string; readonly to: string }): VersionMapping {
    const before = this.registry.taxonomy({ standard: 'vsme', version: pair.from });
    const after = this.registry.taxonomy({ standard: 'vsme', version: pair.to });
    if (before === null || after === null || pair.from >= pair.to) throw new TaxonomyVersionUnknownError();

    const table = (elements: typeof before.elements) =>
      Object.fromEntries(elements.map((element) => [element.key, element as unknown as Record<string, unknown>]));
    const fields = structuralChanges({ from: table(before.elements), to: table(after.elements) });
    const determination = fields.every((field) => field.change === FIELD_CHANGE.ADDED)
      ? COMPATIBILITY.COMPATIBLE
      : COMPATIBILITY.BREAKING;
    return { from: pair.from, to: pair.to, determination, fields };
  }
}
