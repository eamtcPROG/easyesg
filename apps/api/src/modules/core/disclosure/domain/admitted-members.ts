import type { RegisteredTaxonomy, TaxonomyAxis } from '@api/contracts/taxonomy-registry.port';
import { membersOf } from '@easyesg/vsme';

/**
 * The members each choice domain of a pinned version admits, keyed by the qualified domain and qualified as a stored
 * answer names them (task 258; §12.5.6's task-258 row) — `vsme:IndividualMember`, `nace:NACE_A0111`, `country:RO`.
 *
 * **A domain the package ships admits its own members**: EFRAG's `vsme` domains and NACE, the same list the step read
 * serves as options. **A domain it only references admits what the version's axes carry from that taxonomy**: ISO 3166
 * is imported from xbrl.org and not shipped, so the country enumeration holds no members, and the 256 codes the package
 * does carry are the members of B8's country axis — the same 256 EFRAG's template lists (row (2)). That is wider than
 * the step's picker, which offers the countries the platform registers a vocabulary for: a site's country is the
 * entity's to state, and the step pre-fills B1's site rows from it.
 *
 * **A domain the version resolves no member for admits nothing** — the direction `admitsMember` takes for an axis the
 * version does not resolve, because an answer the domain cannot name is one the export cannot write.
 */
export function admittedMembers(input: {
  readonly registered: Pick<RegisteredTaxonomy, 'elements' | 'enumerations'>;
  readonly axisOf: (key: string) => TaxonomyAxis | null;
}): ReadonlyMap<string, ReadonlySet<string>> {
  const axes = [...new Set(input.registered.elements.flatMap((element) => element.axes))]
    .map(input.axisOf)
    .filter((axis): axis is TaxonomyAxis => axis !== null);

  return new Map(
    input.registered.enumerations.map((enumeration) => {
      const members =
        enumeration.external === null
          ? enumeration.members
          : axes.filter((axis) => axis.memberTaxonomy === enumeration.taxonomy).flatMap((axis) => axis.members);
      return [enumeration.key, new Set(members.map((member) => `${enumeration.taxonomy}:${member.key}`))];
    }),
  );
}

/**
 * Does this choice answer hold only members its domain admits? — the write's question (task 258), over a single choice
 * and a set alike. An answer holding nothing is not judged: a cleared field and a declared gap name no member.
 */
export function holdsOnlyAdmitted(input: {
  readonly valueText: string | null | undefined;
  readonly admitted: ReadonlySet<string>;
}): boolean {
  const { valueText, admitted } = input;
  if (valueText === null || valueText === undefined) return true;
  return membersOf(valueText).every((member) => admitted.has(member));
}
