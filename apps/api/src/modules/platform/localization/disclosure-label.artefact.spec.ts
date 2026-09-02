import { Logger } from '@nestjs/common';
import { LABEL_STANDING, LOCALES } from '@easyesg/i18n';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DisclosureLabelService } from './services/disclosure-label.service';
import { DISCLOSURE_CATALOGUES, DISCLOSURE_CATALOGUE_VERSIONS } from './constants/disclosure-catalogues';

/**
 * The shipped catalogues, read by the shipped resolver, against the shipped taxonomy (task 33.2) —
 * the sibling of `taxonomy-artefact.spec.ts`, and the same claim in the other direction.
 *
 * **This is where the guarantee lives, not in the service.** `DisclosureLabelService` is thin on
 * purpose: the catalogues are committed data, so at runtime there is nothing to validate that a
 * spec cannot assert once, for every element, for nothing. What it asserts is the only defect that
 * matters — **an element the taxonomy registers and the catalogue does not name renders as a field
 * with no name**, on a document that carries legal weight, with nothing on screen saying so. UX-97
 * governs a *fallback* to the source locale and prohibits a marker there; this is not a fallback,
 * and no marker exists for it, so the blank is silent by omission rather than by rule. `packages/i18n`'s own parity suite holds the three locales against each other;
 * only this file can hold them against the *taxonomy*, because that lives in `config/seed/`.
 *
 * It is also what keeps two independently regenerated artefacts honest: `extract-vsme-taxonomy.mjs`
 * writes the shape and `extract-vsme-labels.mjs` writes the wording, both re-run at every VSME
 * release (NFR-12), and nothing else compares their output.
 */
describe('the shipped VSME label catalogues', () => {
  const store = seedConfigurationStore(readSeedEntries());

  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
  });

  const registry = new TaxonomyRegistryService(store);
  const labels = new DisclosureLabelService();
  const registeredVersions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

  it('carries a label catalogue for every registered taxonomy version', () => {
    // Two artefacts registered by two different mechanisms — the taxonomy is configuration a
    // publish can move (AD-4), the wording ships in the release (OQ-43) — so a version can exist
    // in one and not the other. Registering a version with no catalogue is the shape that makes
    // every field of a whole taxonomy unnamed at once.
    expect([...DISCLOSURE_CATALOGUE_VERSIONS].sort()).toEqual([...registeredVersions].sort());
  });

  describe.each(registeredVersions)('%s', (version) => {
    const elements =
      registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version })?.elements ?? [];

    it('registers elements to label', () => {
      // Guards the failure every assertion below is blind to: an empty element list makes each
      // `it.each` over it vacuous, and a suite that asserts nothing passes.
      expect(elements.length).toBeGreaterThan(0);
    });

    it.each(LOCALES)('names every registered element in %s', (locale) => {
      const unnamed = elements
        .filter((element) => labels.label({ version, locale, key: element.key }) === null)
        .map((element) => element.key);
      expect(unnamed).toEqual([]);
    });

    it.each(LOCALES)('names nothing the taxonomy does not register, in %s', (locale) => {
      // The other direction, and it is not symmetry for its own sake. A version directory is never
      // edited (DR-4), so a label surviving an element's removal is how a catalogue accumulates
      // wording for disclosures that no longer exist — invisible until an export iterates the
      // catalogue rather than the taxonomy.
      const registered = new Set(elements.map((element) => element.key));
      const stale = Object.keys(labels.labels({ version, locale }) ?? {}).filter(
        (key) => !registered.has(key),
      );
      expect(stale).toEqual([]);
    });

    it('reports English as EFRAG’s own and the two authored locales as platform-authored', () => {
      // T-14 as amended 31 Aug 2026. Literals rather than the vocabulary, per CLAUDE.md's test
      // exception: these are the facts the specification states, and the assertion must fail if a
      // constant's value is renamed underneath them.
      expect(labels.standing({ version, locale: 'en' })).toBe('official');
      expect(labels.standing({ version, locale: 'ro' })).toBe('platform_authored');
      expect(labels.standing({ version, locale: 'ru' })).toBe('platform_authored');
    });

    it('resolves the whole taxonomy without logging', () => {
      // The resolver degrades and logs rather than throwing, which is only safe if something reads
      // the log — the same argument `taxonomy-artefact.spec.ts` makes about the registry.
      //
      // **The resolution happens HERE, in the body.** The first version of this test asserted the
      // spy without calling anything, and `beforeEach` installs a fresh spy before every test — so
      // it recorded zero calls under every possible breakage and could not fail. It was copied from
      // `taxonomy-artefact.spec.ts`, which asserts *after* the loop that did the resolving; the copy
      // kept the assertion and dropped the calls. This is broader than the null-checks above: it is
      // what catches a spurious log on a resolution that otherwise succeeds.
      for (const locale of LOCALES) {
        for (const element of elements) labels.label({ version, locale, key: element.key });
        labels.labels({ version, locale });
        labels.standing({ version, locale });
      }
      expect(errors).not.toHaveBeenCalled();
    });
  });

  describe.each(registeredVersions)('%s — help and members (task 91.1)', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });

    it('labels every member of every vsme enumeration in every locale, without logging', () => {
      const domains = (taxonomy?.enumerations ?? []).filter((e) => e.taxonomy === 'vsme');
      expect(domains.length).toBeGreaterThan(0);
      for (const locale of LOCALES) {
        const members = labels.memberLabels({ version, locale });
        expect(members).not.toBeNull();
        for (const domain of domains) {
          for (const member of domain.members) {
            // An unlabelled member is an XBRL name offered as an answer.
            expect(members?.[member.key]?.text).toBeTruthy();
            expect(members?.[member.key]?.text).not.toMatch(/\[member\]/u);
          }
        }
      }
      expect(errors).not.toHaveBeenCalled();
    });

    it('carries help only for registered elements, and for at least one', () => {
      const keys = new Set((taxonomy?.elements ?? []).map((e) => e.key));
      let documented = 0;
      for (const element of keys) {
        for (const locale of LOCALES) {
          const help = labels.help({ version, locale, key: element });
          if (help !== null) documented += 1;
        }
      }
      // Sparse by construction — EFRAG documents 22 of 143 — but never empty.
      expect(documented).toBeGreaterThan(0);
      // The other direction, which a probe for an unknown key cannot see (gate-integrity review):
      // every key the catalogue carries is an element the taxonomy registers. A version directory
      // is never edited, so wording outlives the element — the same guard the labels have.
      for (const locale of LOCALES) {
        const stale = Object.keys(DISCLOSURE_CATALOGUES[version]?.help[locale] ?? {}).filter(
          (key) => !keys.has(key),
        );
        expect(stale).toEqual([]);
      }
    });

    it('names no member that no vsme enumeration offers', () => {
      const offered = new Set(
        (taxonomy?.enumerations ?? [])
          .filter((e) => e.taxonomy === 'vsme')
          .flatMap((e) => e.members.map((m) => m.key)),
      );
      for (const locale of LOCALES) {
        const stale = Object.keys(DISCLOSURE_CATALOGUES[version]?.members[locale] ?? {}).filter(
          (key) => !offered.has(key),
        );
        expect(stale).toEqual([]);
      }
    });
  });

  describe('what the resolver does with a miss', () => {
    it('logs at error and answers null, naming the version and the locale', () => {
      expect(labels.label({ version: '2026-05-01', locale: 'ro', key: 'NoSuchElement' })).toBeNull();
      expect(errors).toHaveBeenCalledWith(expect.stringContaining('NoSuchElement'));
      expect(errors).toHaveBeenCalledWith(expect.stringContaining('2026-05-01'));
    });

    it('answers null for an unregistered version rather than the newest one', () => {
      // DR-4: a report pinned to a withdrawn version surfaces as an explicit failure. Answering
      // from a version it was never authored under is what version pinning exists to prevent.
      expect(labels.labels({ version: '2030-01-01', locale: 'ro' })).toBeNull();
      expect(labels.standing({ version: '2030-01-01', locale: 'ro' })).toBeNull();
    });

    it('does not log for a standing question, so one bad pin is not a line per locale', () => {
      labels.standing({ version: '2030-01-01', locale: 'ro' });
      labels.standing({ version: '2030-01-01', locale: 'en' });
      expect(errors).not.toHaveBeenCalled();
    });
  });

  it('offers at least one locale a reporter can cite to a bank', () => {
    // UX-47 tells anyone exporting in a platform-authored language which one carries EFRAG's own
    // wording. A version where every locale is authored leaves the dialogue printing a caveat and
    // recommending nothing.
    for (const version of registeredVersions) {
      const official = LOCALES.filter(
        (locale) => labels.standing({ version, locale }) === LABEL_STANDING.OFFICIAL,
      );
      expect(official.length).toBeGreaterThan(0);
    }
  });
});
