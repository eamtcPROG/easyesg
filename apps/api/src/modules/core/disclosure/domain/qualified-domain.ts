import { ENUMERATION_TAXONOMY, type TaxonomyElement } from '@api/contracts/taxonomy-registry.port';

/**
 * An element's domain as the registry keys enumerations — qualified (task 91.1).
 *
 * The artefact leaves a `vsme` domain unqualified on the element and qualifies every enumeration,
 * so every reader that looks a domain up shares this rather than spelling it out. A lookup by the bare name finds
 * nothing and says nothing, which is the trap.
 */
export const qualifiedDomainOf = (element: Pick<TaxonomyElement, 'domain'>): string | null =>
  element.domain === null
    ? null
    : element.domain.includes(':')
      ? element.domain
      : `${ENUMERATION_TAXONOMY.VSME}:${element.domain}`;
