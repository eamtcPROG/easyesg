import {
  LOCALES,
  isLabelStanding,
  type DisclosureLabel,
  type LabelStanding,
  type LabelStandingManifest,
  type Locale,
} from '@easyesg/i18n';
import en20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/en.json';
import ro20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/ro.json';
import ru20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/ru.json';
import standing20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/standing.json';

/**
 * The committed VSME label catalogues, one entry per taxonomy version (task 33.2).
 *
 * **Adding a version is an edit to this file and nothing else.** Four imports and one map entry,
 * and `disclosure-label.artefact.spec.ts` turns forgetting them into a failure rather than into a
 * taxonomy whose every field renders unnamed.
 *
 * **Statically imported rather than read off disk**, which is what makes the catalogues resolvable
 * the same way in the HTTP tier, in the worker and under jest — `readdirSync` over a path relative
 * to `process.cwd()` answers differently in a container than in a test, and the worker is the one
 * process where a wrong answer reaches a bank.
 *
 * **`packages/i18n` owns the data and this file owns reading it**, which is a boundary with a
 * reason: a module inside that package importing these JSON files would have to satisfy its ESM and
 * CommonJS emits at once, and they cannot both be satisfied — `module: commonjs` rejects an import
 * attribute (TS2823) and `nodenext` demands one (TS1543). `apps/api` is CommonJS, so it needs no
 * attribute, and it reaches the files through that package's own `./catalogues/*` export.
 */

/**
 * A version directory's four files, as committed — **with the labels already paired to their
 * standing**, built once at module load rather than per call.
 *
 * `labels()` is the accessor a forty-field form uses, and rebuilding 143 `{ text, standing }` objects
 * on every call is not what the service's "no caching" note claims it is. Pairing here makes that
 * note true: the map is frozen into the module graph, so every accessor is a property lookup.
 */
export interface DisclosureCatalogue {
  readonly standing: Readonly<Record<Locale, LabelStanding>>;
  readonly labels: Readonly<Record<Locale, Readonly<Record<string, DisclosureLabel>>>>;
}

/**
 * A committed manifest is a build artefact, so an unreadable one is a build defect and this throws
 * at import rather than degrading later. `tools/extract-vsme-labels.mjs` is its only author and
 * derives it from EFRAG's own linkbases; a value this does not know means someone hand-edited a
 * generated file, and the loud failure is the cheap one.
 *
 * It is also what keeps the extractor's mirrored copy of `LABEL_STANDING` honest — a build tool
 * cannot import the workspace package it writes into without making that package's build a
 * prerequisite of regenerating it, so the two are kept in step here instead.
 */
function readStanding(
  manifest: LabelStandingManifest,
  version: string,
): Readonly<Record<Locale, LabelStanding>> {
  if (manifest.version !== version) {
    throw new Error(
      `disclosure label manifest for ${version} declares version ${manifest.version} — a version directory names its own contents`,
    );
  }
  // Keyed by every LIVE locale, not by whatever the file happens to carry — so the return type is a
  // guarantee rather than a hope, and no reader downstream needs a cast or an undefined branch. A
  // locale the manifest omits is the same defect as one it mislabels: the export would be unable to
  // say whether its wording is EFRAG's.
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const standing = manifest.labels[locale];
      // `isLabelStanding` comes from the module that declares the vocabulary, per CLAUDE.md: the
      // narrowing is derived from the set and belongs beside it, not retyped at each reader.
      if (!isLabelStanding(standing)) {
        throw new Error(
          `disclosure label manifest for ${version} gives ${locale} no usable standing: ${String(standing)}`,
        );
      }
      return [locale, standing];
    }),
  ) as Record<Locale, LabelStanding>;
}

/** Pairs a locale's texts with that locale's standing, once, at module load. */
function pair(
  texts: Readonly<Record<string, string>>,
  standing: LabelStanding,
): Readonly<Record<string, DisclosureLabel>> {
  return Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, { text, standing }]));
}

const STANDING_20260501 = readStanding(standing20260501, '2026-05-01');

export const DISCLOSURE_CATALOGUES: Readonly<Record<string, DisclosureCatalogue>> = {
  '2026-05-01': {
    standing: STANDING_20260501,
    labels: {
      ro: pair(ro20260501, STANDING_20260501.ro),
      en: pair(en20260501, STANDING_20260501.en),
      ru: pair(ru20260501, STANDING_20260501.ru),
    },
  },
};

/** Every version with a committed catalogue, newest first — the ordering `TaxonomyRegistry` uses. */
export const DISCLOSURE_CATALOGUE_VERSIONS: readonly string[] =
  Object.keys(DISCLOSURE_CATALOGUES).sort().reverse();
