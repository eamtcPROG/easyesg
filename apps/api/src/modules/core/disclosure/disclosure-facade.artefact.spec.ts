import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DISCLOSURES, TAXONOMY_VERSION, type Disclosure } from '@easyesg/vsme';
import { DISCLOSURE_KIND } from '@api/contracts/taxonomy-registry.port';

/**
 * The generated facade held against the taxonomy it was generated from (task 34.2).
 *
 * **The generator's own `git diff` gate proves the file is current; this proves it is *correct*.**
 * `facade:check` regenerates and diffs, so a taxonomy change that nobody regenerated fails — but it
 * would pass just as happily if the generator emitted the wrong key for every element, because both
 * sides of that diff come from the same generator. Only a comparison against the artefact can see
 * that, and this is it: the analogue of `disclosure-label.artefact.spec.ts` for shape rather than
 * wording.
 *
 * Hermetic — it reads the seed file and the generated module, and needs no database.
 */
describe('the generated disclosure facade', () => {
  const artefact = JSON.parse(
    readFileSync(
      resolve(process.cwd(), `../../config/seed/vsme-taxonomy.${TAXONOMY_VERSION}.json`),
      'utf8',
    ),
  ) as {
    modules: string[];
    axes: Record<string, { typed: boolean; members: string[] }>;
    elements: Record<string, { modules: string[]; kind: string; axes?: string[] }>;
  };

  const groups = Object.values(DISCLOSURES) as Record<string, Disclosure>[];
  const descriptors = groups.flatMap((group) => Object.entries(group));

  it('generates a descriptor for every registered element, and no others', () => {
    // Both directions. A missing descriptor is a disclosure no typed caller can reach; an extra one
    // is a key that would write a row the taxonomy does not recognise and no export would carry.
    // **Unique keys**, because an element presented in two modules is emitted under both (task
    // 36.4) — so this asserts coverage, and the case below asserts the duplication is the intended
    // one rather than a generator that lost track of what it had already written.
    expect([...new Set(descriptors.map(([, d]) => d.key))].sort()).toEqual(
      Object.keys(artefact.elements).sort(),
    );
  });

  /**
   * **A disclosure presented in two modules is reachable under both** (task 36.4).
   *
   * The eight B3/C3 emissions are one shared hypercube in EFRAG's package. Grouping the facade by a
   * single module would leave whichever group lost the tie-break silently short — which is the
   * defect this task repaired in the artefact, reproduced one layer up. Named rather than counted,
   * for the same reason the artefact's own guard names them: a count cannot see a lost relation.
   */
  it('reaches a disclosure presented in two modules under each of them', () => {
    const shared = Object.entries(artefact.elements).filter(([, e]) => e.modules.length > 1);
    expect(shared.length).toBeGreaterThan(0);

    for (const [key, element] of shared) {
      const homes = groups.filter((group) =>
        Object.values(group).some((descriptor) => descriptor.key === key),
      );
      expect({ key, reachedIn: homes.length }).toEqual({ key, reachedIn: element.modules.length });
    }
  });

  it('carries the element key verbatim, never a transformation of it', () => {
    // NFR-2 makes the local name the schema's vocabulary, and `element_key` is written from this.
    // The accessor may be spelled for readability; the key may not.
    for (const [, descriptor] of descriptors) {
      expect(artefact.elements[descriptor.key]).toBeDefined();
    }
  });

  it('names no identifier containing a digit (task 34.2, project owner)', () => {
    // The convention the generator enforces, asserted against the shipped output rather than
    // against the generator's own opinion of it.
    const identifiers = [
      ...Object.keys(DISCLOSURES),
      ...descriptors.map(([accessor]) => accessor),
    ];
    expect(identifiers.filter((name) => /\d/.test(name))).toEqual([]);
  });

  it('spells the numbers the sources actually contain', () => {
    // Pinned as a worked example, because "no identifier carries a digit" is satisfiable by a
    // generator that simply *drops* them — `grossScopeGreenhouseGasEmissions` carries no digit and
    // names the wrong disclosure. The scope elements are the case that matters: eight elements
    // distinguished largely by their numbers, and two of them by nothing else.
    //
    // **The expected list is read from the artefact rather than written out**, which is this
    // project's own §7.3 lesson: the first version of this test asserted three `GrossScope*`
    // elements from memory, and there are two — scope 2 is split into location-based and
    // market-based, so it does not start with `GrossScope` at all. Asserting a remembered taxonomy
    // shape is exactly how §7.3 came to carry three element keys that do not exist.
    const scoped = Object.keys(artefact.elements).filter((key) => key.includes('Scope'));
    expect(scoped.length).toBeGreaterThan(0);

    for (const key of scoped) {
      const [accessor] = descriptors.find(([, d]) => d.key === key) ?? [];
      expect(accessor).toBeDefined();
      // Every digit is spelled, and none is lost: the accessor keeps a word where the key had a
      // number, so two elements differing only by their number stay distinguishable.
      for (const digits of key.match(/\d+/g) ?? []) {
        const word = ['Zero', 'One', 'Two', 'Three'][Number.parseInt(digits, 10)];
        expect(accessor).toContain(word);
      }
    }

    // And the pair that would collide if the numbers were dropped rather than spelled. Deduped
    // because both are presented in B3 and C3 (task 36.4) and this case is about the *spelling*;
    // that they appear under two groups is the case above's subject, not this one's.
    const emissions = [
      ...new Set(
        descriptors
          .filter(([, d]) => d.key === 'GrossScope1GreenhouseGasEmissions' || d.key === 'GrossScope3GreenhouseGasEmissions')
          .map(([accessor]) => accessor),
      ),
    ].sort();
    expect(emissions).toEqual([
      'grossScopeOneGreenhouseGasEmissions',
      'grossScopeThreeGreenhouseGasEmissions',
    ]);
  });

  it('gives every descriptor a kind the port declares', () => {
    const kinds: readonly string[] = Object.values(DISCLOSURE_KIND);
    for (const [, descriptor] of descriptors) expect(kinds).toContain(descriptor.kind);
  });

  it('declares members only for an axis that enumerates them', () => {
    for (const [, descriptor] of descriptors) {
      if (descriptor.axis === null) {
        expect(descriptor.members).toBeNull();
        continue;
      }
      const axis = artefact.axes[descriptor.axis];
      expect(axis).toBeDefined();
      // A typed axis has no members by definition — the reporter supplies the identifier. So does
      // B7's waste axis, whose domain is published in a separately-versioned artefact the registry
      // resolves at runtime; narrowing it here would be a tighter type than the truth.
      if (axis.typed || axis.members.length === 0) expect(descriptor.members).toBeNull();
      else expect(descriptor.members).toEqual(axis.members);
    }
  });

  it('groups by the standard’s own modules, with one group for the pillar-level three', () => {
    const expected = artefact.modules.map((module) =>
      module.replace(/\d+/, (n) => ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
        'Eight', 'Nine', 'Ten', 'Eleven'][Number.parseInt(n, 10)]),
    );
    const spelled = expected.map((m) => m.charAt(0).toLowerCase() + m.slice(1));
    expect(Object.keys(DISCLOSURES).sort()).toEqual([...spelled, 'general'].sort());
  });

  it('covers the elements the standard files under no module', () => {
    // An empty `modules` is a real answer, not a missing one (the taxonomy port says so): three
    // pillar-level catch-alls belong to Environment / Social / Governance rather than to B1…C9.
    const unmoduled = Object.entries(artefact.elements).filter(([, e]) => e.modules.length === 0);
    expect(Object.keys(DISCLOSURES.general)).toHaveLength(unmoduled.length);
  });
});
