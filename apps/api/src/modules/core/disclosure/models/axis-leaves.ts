import type { TaxonomyAxis, TaxonomyMember } from '@api/contracts/taxonomy-registry.port';

/**
 * The members of a classification a reporter may actually answer: its **leaves** (task 36.8).
 *
 * EFRAG says so in the workbook itself, on B7's waste table — *"Please select a Type of waste
 * (Hazardous or Non-Hazardous) rather than a category else an ERROR message will appear."* The EU
 * List of Waste is 973 members over three levels and only its 842 entries carry the hazard
 * classification B7 reports on.
 *
 * **Derived from parentage rather than registered**, because unlike an axis's *shape* this one is in
 * the artefact — and it is a no-op for a flat domain like B4's 94 pollutants.
 *
 * **Here rather than inside `MemberResolver`, which is the correction** (convention review at task
 * 36's parent close, 9 Sep 2026). Task 36.8 fixed this rule reaching only the picker and wrote, in
 * `admits`' own docblock, *"One answer for three readers"* — and then gave the write path a second,
 * byte-identical copy in another file. Two copies both locally correct is the drift the
 * closed-vocabulary rule names: change the leaf definition and the picker stops offering a member
 * the store still accepts. The operation belongs with the vocabulary it narrows, which is the axis.
 */
export function answerableMembers(axis: TaxonomyAxis): readonly TaxonomyMember[] {
  const parents = new Set(axis.members.flatMap((m) => (m.parent === null ? [] : [m.parent])));
  return axis.members.filter((member) => !parents.has(member.key));
}

/**
 * A **breakdown**'s rows, by member key: the axis's default member first, then its members (task 36.4).
 *
 * The default member leads because it is the member a fact carrying no dimension is taken to mean —
 * B3's *total renewable and non-renewable* — so a reader meets the whole before its parts. **It is an
 * answer, not a category** (task 217): a breakdown is one question answered several ways, and the
 * total is one of them. Here beside the leaf rule for that rule's reason — the step read draws these
 * rows and the write admits them, and two copies is how the write came to refuse the row the read
 * offered first.
 */
export function breakdownMembers(axis: TaxonomyAxis): readonly string[] {
  return [...(axis.defaultMember ? [axis.defaultMember] : []), ...axis.members.map((member) => member.key)];
}

/**
 * Does this axis admit that member as an **answer**? On a breakdown, any row it serves; anywhere
 * else a leaf, never a category — a classification's default member is its domain head, which the
 * leaf rule refuses (task 217).
 */
export function admitsMember(input: {
  readonly axis: TaxonomyAxis;
  readonly member: string;
  /** Whether the standard registers this axis as a breakdown (`AxisShapes`). */
  readonly breakdown: boolean;
}): boolean {
  if (input.breakdown) return breakdownMembers(input.axis).includes(input.member);
  return answerableMembers(input.axis).some((candidate) => candidate.key === input.member);
}
