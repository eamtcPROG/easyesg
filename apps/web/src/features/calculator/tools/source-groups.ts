import { GHG_SCOPE, type CalcFactorSource, type GhgScope } from '@easyesg/contracts';

/**
 * The sources a line may name, grouped as the artboard groups them — *fuel you burn*, *electricity you buy* — which is
 * the B3 figure each counts toward (task 39.1; S-09 8.3). **The group is the factor set's `ghgScope`**, never a list of
 * fuels here, so a source an operator publishes lands in its group with no release (AD-4). Groups keep the vocabulary's
 * order and drop when empty; sources keep the set's.
 */
export function sourceGroups(
  sources: readonly CalcFactorSource[],
): readonly { readonly scope: GhgScope; readonly sources: readonly CalcFactorSource[] }[] {
  return Object.values(GHG_SCOPE)
    .map((scope) => ({ scope, sources: sources.filter((source) => source.ghgScope === scope) }))
    .filter((group) => group.sources.length > 0);
}
