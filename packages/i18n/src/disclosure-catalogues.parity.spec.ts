import { describe, expect, it } from 'vitest';
import { LOCALES, SOURCE_LOCALE, type Locale } from './locales.js';
import { LABEL_STANDING, isLabelStanding, type LabelStandingManifest } from './disclosure-standing.js';
import { blankKeys, compareToSource } from './parity.js';
import type { MessageCatalogue } from './messages.js';

/**
 * Guards the per-version disclosure catalogues — the obligation `catalogues/disclosure/README.md`
 * recorded as owed when the first version landed, paid here (task 33.2).
 *
 * **Parity holds within a version and never across one.** Two registered versions differing is not
 * drift, it is DR-4: a report authored under `2026-05-01` must render that version's labels years
 * after a newer one ships, so a directory is written once and never edited. So this walks each
 * directory independently.
 *
 * **It asserts the shape of the data and nothing about who reads it.** Resolution lives in
 * `apps/api`'s `platform/localization` — see `disclosure-standing.ts` for why this package must not
 * import these files — and the check that every version a *reader* registers is one that exists on
 * disk is `apps/api/src/modules/platform/localization/disclosure-label.artefact.spec.ts`, which can
 * also hold them against the taxonomy in `config/seed/`. That is the stronger claim and only that
 * file can make it.
 *
 * `import.meta.glob` is Vite's, typed locally rather than by pulling in a `@types` package: this
 * package sets `"types": []` to stay isomorphic, which is the same constraint that rules out
 * `node:fs` here.
 */
interface GlobbingImportMeta {
  glob(
    pattern: string,
    options: { readonly eager: true; readonly import: 'default' },
  ): Readonly<Record<string, unknown>>;
}

const FILES = (import.meta as unknown as GlobbingImportMeta).glob(
  '../catalogues/disclosure/*/*.json',
  { eager: true, import: 'default' },
);

/**
 * The two sub-catalogues task 91.1 added beside the labels — `help/` (EFRAG's `documentation`
 * label, sparse by construction) and `members/` (every enumeration member's label, total). Each
 * is held to the same parity within a version as the labels, over its own key space: help's keys
 * are the subset of elements EFRAG documents, and members' keys are the domains' members, so
 * neither is compared to the element list — that is the api's artefact spec's claim.
 */
const SUB_CATALOGUES = ['help', 'members'] as const;
const SUB_FILES = (import.meta as unknown as GlobbingImportMeta).glob(
  '../catalogues/disclosure/*/{help,members}/*.json',
  { eager: true, import: 'default' },
);

/** `../catalogues/disclosure/2026-05-01/ro.json` → `['2026-05-01', 'ro']`. */
const parsePath = (path: string): { version: string; name: string } => {
  const [name, version] = path.split('/').reverse();
  return { version: version ?? '', name: (name ?? '').replace(/\.json$/, '') };
};

const onDisk = new Map<string, Map<string, unknown>>();
for (const [path, value] of Object.entries(FILES)) {
  const { version, name } = parsePath(path);
  const files = onDisk.get(version) ?? new Map<string, unknown>();
  files.set(name, value);
  onDisk.set(version, files);
}

const VERSIONS = [...onDisk.keys()].sort();

/** `../catalogues/disclosure/2026-05-01/help/ro.json` → version, sub-catalogue, locale. */
const subOnDisk = new Map<string, Map<string, Map<string, unknown>>>();
for (const [path, value] of Object.entries(SUB_FILES)) {
  const [file, folder, version] = path.split('/').reverse();
  const locale = (file ?? '').replace(/\.json$/, '');
  const byFolder = subOnDisk.get(version ?? '') ?? new Map<string, Map<string, unknown>>();
  const byLocale = byFolder.get(folder ?? '') ?? new Map<string, unknown>();
  byLocale.set(locale, value);
  byFolder.set(folder ?? '', byLocale);
  subOnDisk.set(version ?? '', byFolder);
}

describe('disclosure label catalogues', () => {
  it('holds at least one version directory', () => {
    // Guards what every assertion below is blind to: with no directories, each `describe.each` and
    // `it.each` over `VERSIONS` is vacuous and the suite passes having checked nothing. It has one
    // real way to fail — a glob pattern that stops matching, which is silent by construction.
    expect(VERSIONS.length).toBeGreaterThan(0);
  });

  it.each(VERSIONS)('%s carries a file for every live locale', (version) => {
    const files = onDisk.get(version);
    expect([...(files?.keys() ?? [])].sort()).toEqual([...LOCALES, 'standing'].sort());
  });

  describe.each(VERSIONS)('%s', (version) => {
    const files = onDisk.get(version) ?? new Map<string, unknown>();
    const source = files.get(SOURCE_LOCALE) as MessageCatalogue;
    const translations = LOCALES.filter((l) => l !== SOURCE_LOCALE);

    it('carries labels to compare', () => {
      // Every per-key assertion below iterates the source key set, so three empty catalogues pass
      // all of them — measured at 10/10 green. The version-directory guard above does not reach
      // this: it proves a directory exists, not that anything is in it. And the shape is reachable
      // from the producer, since `extract-vsme-labels.mjs` derives the catalogue from the artefact's
      // element list, so an empty artefact writes `{}` with nothing to report as unlabelled.
      expect(Object.keys(source).length).toBeGreaterThan(0);
    });

    it.each(translations)('matches the source key space in %s', (locale) => {
      // Romanian is the source (NFR-23) even though it is authored rather than official — parity is
      // about key coverage, and which rendering is *authoritative for a reader* is UX-47's separate
      // question, answered by the standing manifest below.
      expect(
        compareToSource({ source, translated: files.get(locale) as MessageCatalogue }),
      ).toEqual({ missing: [], unexpected: [] });
    });

    it('renders every element differently in each locale', () => {
      // Key parity is blind to this by construction: three files with identical *values* have
      // identical key sets and pass every assertion above. A build that resolved one locale's file
      // for all three would show a Russian reporter Romanian labels on a filed document — and since
      // the strings are all *present*, no fallback fires and nothing anywhere would say so.
      const shared = Object.keys(source).filter((key) => {
        const rendered = LOCALES.map((locale) => (files.get(locale) as MessageCatalogue)[key]);
        return new Set(rendered).size !== LOCALES.length;
      });
      expect(shared).toEqual([]);
    });

    it.each(LOCALES)('declares no empty label in %s', (locale) => {
      // A blank renders as a field with no name on a document that carries legal weight — the same
      // blank `parity.ts` describes for the shared catalogues. Placeholder-by-omission is the shape.
      expect(blankKeys(files.get(locale) as MessageCatalogue)).toEqual([]);
    });

    it('declares a standing for every live locale, drawn from the vocabulary', () => {
      const manifest = files.get('standing') as LabelStandingManifest;
      expect(manifest.version).toBe(version);
      expect(Object.keys(manifest.labels).sort()).toEqual([...LOCALES].sort());
      // Narrowed through the vocabulary's own predicate, not a private copy of it.
      expect(Object.values(manifest.labels).filter((s) => !isLabelStanding(s))).toEqual([]);
    });

    it('has at least one officially published locale', () => {
      // Not a style rule: NFR-24 binds the official translation wherever one is published, and
      // UX-47 tells a reader headed for a bank or an EU buyer which language carries it. A version
      // where every locale is platform-authored has no answer to give them, and the dialogue would
      // recommend nothing while still printing the caveat.
      const manifest = files.get('standing') as LabelStandingManifest;
      const official = (Object.entries(manifest.labels) as [Locale, string][]).filter(
        ([, standing]) => standing === LABEL_STANDING.OFFICIAL,
      );
      expect(official.length).toBeGreaterThan(0);
    });
  });

  describe.each(VERSIONS)('%s sub-catalogues', (version) => {
    const folders = subOnDisk.get(version) ?? new Map<string, Map<string, unknown>>();

    it.each(SUB_CATALOGUES)('carries %s for every live locale', (folder) => {
      // A version extracted after task 91.1 carries both folders; a missing one is a regeneration
      // that stopped halfway, and the wizard would offer choice fields with no answers.
      expect([...(folders.get(folder)?.keys() ?? [])].sort()).toEqual([...LOCALES].sort());
    });

    describe.each(SUB_CATALOGUES)('%s', (folder) => {
      const files = folders.get(folder) ?? new Map<string, unknown>();
      const source = files.get(SOURCE_LOCALE) as MessageCatalogue;
      const translations = LOCALES.filter((l) => l !== SOURCE_LOCALE);

      it('carries entries to compare', () => {
        expect(Object.keys(source ?? {}).length).toBeGreaterThan(0);
      });

      it.each(translations)('matches the source key space in %s', (locale) => {
        expect(
          compareToSource({ source, translated: files.get(locale) as MessageCatalogue }),
        ).toEqual({ missing: [], unexpected: [] });
      });

      it('renders every entry differently in each locale', () => {
        const shared = Object.keys(source ?? {}).filter((key) => {
          const rendered = LOCALES.map((locale) => (files.get(locale) as MessageCatalogue)[key]);
          return new Set(rendered).size !== LOCALES.length;
        });
        expect(shared).toEqual([]);
      });

      it.each(LOCALES)('declares no empty entry in %s', (locale) => {
        expect(blankKeys(files.get(locale) as MessageCatalogue)).toEqual([]);
      });

      it.each(LOCALES)('carries no XBRL scaffolding in %s', (locale) => {
        // `[member]` is the taxonomy's own suffix and never a word a reporter should read.
        const scaffolded = Object.entries(files.get(locale) as MessageCatalogue).filter(
          ([, text]) => typeof text === 'string' && /\[member\]/u.test(text),
        );
        expect(scaffolded).toEqual([]);
      });
    });
  });
});
