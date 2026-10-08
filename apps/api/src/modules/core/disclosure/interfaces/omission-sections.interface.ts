/**
 * Which elements each omittable section withholds (task 41.2; FR-31 AC-3; `architecture.md` §12.5.6's task-41 row
 * (4)) — keyed by the section's member of B1's list, bare (`B8GenderMember`), each naming its elements.
 *
 * **A section only**: a module's own member (`B8-…Member`) omits the module whole, which `omittedModules` already
 * derives. **Read as at today** like the applicability rules beside it: which elements make up a section is a fact
 * about the standard, not about a report's period.
 */
export interface OmissionSections {
  sectionsFor(query: { readonly standard: string }): ReadonlyMap<string, readonly string[]>;
}

export const OMISSION_SECTIONS = Symbol('OMISSION_SECTIONS');
