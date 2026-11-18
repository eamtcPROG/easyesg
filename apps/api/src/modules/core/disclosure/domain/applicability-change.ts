/**
 * Whether a threshold change obliges a report to be looked at again (task 67.8; FR-166, UC-81; 182/135 … 182/137): an
 * element the old rules and the new rules judge differently, over the same stored answers. **An element no rule governs
 * applies**, so a rule added or removed counts where it changes a verdict and not where it agrees with the default.
 */
export function applicabilityMoved(input: {
  readonly before: ReadonlyMap<string, boolean>;
  readonly after: ReadonlyMap<string, boolean>;
}): boolean {
  const elements = new Set([...input.before.keys(), ...input.after.keys()]);
  return [...elements].some((element) => (input.before.get(element) ?? true) !== (input.after.get(element) ?? true));
}
