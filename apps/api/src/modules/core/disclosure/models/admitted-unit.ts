/**
 * Whether a written unit is one the element admits (task 183; `architecture.md` §12.5.6's task-182 authoring row (6)).
 * The comment on `DisclosureValueContents.unitCode` and the value table's migration both said this was checked against
 * the registry; until this task nothing did.
 *
 * **An empty list admits any unit**, and that is the registry port's definition rather than leniency: `unitCodes`
 * empty means *the standard states none, never that the element takes no unit* (`taxonomy-registry.port.ts`), so
 * refusing every unit there would refuse what EFRAG never ruled out — 25 elements state a list, and the rest do not.
 * **A value with no unit is never refused here**: a unit the reporter has not chosen yet is a gap for validation to
 * name (FR-40), not a malformed write.
 */
export const unitIsAdmitted = (input: {
  readonly unitCode: string | null;
  readonly admitted: readonly string[];
}): boolean => input.unitCode === null || input.admitted.length === 0 || input.admitted.includes(input.unitCode);
