import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';

type Placed = Pick<TaxonomyElement, 'key' | 'modules' | 'section' | 'order' | 'parent'>;

/**
 * The standard's presentation order (task 79.6; `architecture.md` §12.5.6's task-79.6 row (4)) — **module, then section,
 * then each element after the element it belongs to**, which is how EFRAG's presentation linkbase draws a module: roles
 * in their code order, each a tree.
 *
 * **`order` alone is a position among siblings, not in the module.** Sorted by it across sections and parents, a module
 * read C6's *specify other content* before the choice it specifies, C8's benchmark exclusion among its revenues, B1's
 * other legal form before the legal form and B8's turnover rate before its contracts — every one an `order` of 1 beside
 * a sibling's elsewhere in the tree. An element's place is the path of `order`s from its section's root down to it, read
 * through the parents the artefact carries; an abstract parent is no element, so the path starts beneath it.
 *
 * **A section is compared by its code** — `[1380]` before `[1390]`, `[C08.000]` before `[C08.100]` — the bracketed
 * prefix both registered versions write, and the whole string where there is none.
 *
 * Pure: the registry hands in the module order and the elements it read.
 */
export function presentationOrder(input: {
  readonly elements: readonly Placed[];
  readonly modules: readonly string[];
}): (a: Placed, b: Placed) => number {
  const byKey = new Map(input.elements.map((element) => [element.key, element]));
  // **An unmoduled element sorts last rather than first**, where the pillar-level catch-alls belong — `indexOf`
  // answering -1 would put them ahead of B1. **An element in two modules sorts by its first**, which is the module
  // `section` and `order` describe (task 36.4): the eight B3/C3 disclosures sort inside B3.
  const moduleRank = (element: Placed): number =>
    element.modules.length === 0 ? input.modules.length : input.modules.indexOf(element.modules[0]);
  const paths = new Map(input.elements.map((element) => [element.key, pathOf(element, byKey)]));
  return (a, b) =>
    moduleRank(a) - moduleRank(b) ||
    compareText(sectionCode(a.section), sectionCode(b.section)) ||
    comparePaths(paths.get(a.key) ?? [a.order], paths.get(b.key) ?? [b.order]);
}

/** The orders from the section's root down to the element, through the parents that are elements themselves. */
function pathOf(element: Placed, byKey: ReadonlyMap<string, Placed>): readonly number[] {
  const path: number[] = [];
  const seen = new Set<string>();
  let at: Placed | undefined = element;
  // `seen` guards a cycle the extractor would never write and a hand-edited artefact could.
  while (at !== undefined && !seen.has(at.key)) {
    seen.add(at.key);
    path.unshift(at.order);
    at = at.parent === null ? undefined : byKey.get(at.parent);
  }
  return path;
}

/** A parent before its children, and siblings by `order`. */
function comparePaths(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

const SECTION_CODE = /^\[([^\]]*)\]/u;

const sectionCode = (section: string): string => SECTION_CODE.exec(section)?.[1] ?? section;

// Code-point order, not a locale's: a section code is an identifier, and `localeCompare` would order it by the reader.
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
