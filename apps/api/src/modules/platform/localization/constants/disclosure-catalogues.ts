import {
  EXPANSION_FLAG,
  LABEL_STANDING,
  LOCALES,
  expandString,
  expansionEnabled,
  isLabelStanding,
  type DisclosureLabel,
  type LabelStanding,
  type LabelStandingManifest,
  type Locale,
} from '@easyesg/i18n';
import en20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/en.json';
import ro20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/ro.json';
import ru20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/ru.json';
import standing20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/standing.json';
import en20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/en.json';
import ro20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/ro.json';
import ru20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/ru.json';
import standing20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/standing.json';
import helpEn20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/en.json';
import helpRo20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/ro.json';
import helpRu20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/ru.json';
import membersEn20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/members/en.json';
import membersRo20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/members/ro.json';
import membersRu20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/members/ru.json';
import helpEn20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/en.json';
import helpRo20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/ro.json';
import helpRu20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/ru.json';
import membersEn20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/members/en.json';
import membersRo20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/members/ro.json';
import membersRu20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/members/ru.json';
import platformHelpEn20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/platform/en.json';
import platformHelpRo20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/platform/ro.json';
import platformHelpRu20260201 from '@easyesg/i18n/catalogues/disclosure/2026-02-01/help/platform/ru.json';
import platformHelpEn20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/platform/en.json';
import platformHelpRo20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/platform/ro.json';
import platformHelpRu20260501 from '@easyesg/i18n/catalogues/disclosure/2026-05-01/help/platform/ru.json';
import { joinHelp } from '../domain/disclosure-help';

/**
 * The committed VSME label catalogues, one entry per taxonomy version (task 33.2).
 *
 * **Adding a version is an edit to this file and nothing else.** An import per file of its
 * directory and one map entry, and `disclosure-label.artefact.spec.ts` turns forgetting them into a
 * failure rather than into a taxonomy whose every field renders unnamed or carries no help.
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
  /**
   * Every element's help (UX-17): EFRAG's `documentation` label where the package carries one (task
   * 91.1), the platform's own sentence for every other element (task 94) — each entry with its own
   * standing, since an authored English sentence is not EFRAG's while the English labels are.
   */
  readonly help: Readonly<Record<Locale, Readonly<Record<string, DisclosureLabel>>>>;
  /** Every `vsme` enumeration member's label — the answers a choice field offers (task 91.1). */
  readonly members: Readonly<Record<Locale, Readonly<Record<string, DisclosureLabel>>>>;
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

/**
 * UX-94's +40% harness, read once for this process (task 51.3; §12.5.6's task-51.3 row).
 *
 * These are the **largest body of wording the api resolves** — every question on S-07, its help and
 * its member lists — and they travel by their own path, not through `app/messages/catalogue.ts`. So
 * padding that one left OQ-58's labels measured at their Romanian length on a padded screen, which is
 * the measurement not being taken rather than a check passing, and the same defect as the one that
 * prompted the task. There is no second place to remember: every catalogue file crosses `pair`, the
 * platform's help included.
 */
const PADDED = expansionEnabled(process.env[EXPANSION_FLAG]);

/** Pairs a locale's texts with that locale's standing, once, at module load. */
function pair(
  texts: Readonly<Record<string, string>>,
  standing: LabelStanding,
): Readonly<Record<string, DisclosureLabel>> {
  return Object.fromEntries(
    Object.entries(texts).map(([key, text]) => [
      key,
      { text: PADDED ? expandString(text) : text, standing },
    ]),
  );
}

/**
 * A version's help in every locale, from its two sources (task 94): EFRAG's `documentation` labels
 * at each locale's standing, and the platform's sentences at `platform_authored` in every locale —
 * English too, which is the case the pairing exists for. `joinHelp` refuses an element both carry.
 */
function helpOf(sources: {
  readonly version: string;
  readonly standing: Readonly<Record<Locale, LabelStanding>>;
  readonly documented: Readonly<Record<Locale, Readonly<Record<string, string>>>>;
  readonly authored: Readonly<Record<Locale, Readonly<Record<string, string>>>>;
}): Readonly<Record<Locale, Readonly<Record<string, DisclosureLabel>>>> {
  return Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      joinHelp({
        version: sources.version,
        locale,
        documented: pair(sources.documented[locale], sources.standing[locale]),
        authored: pair(sources.authored[locale], LABEL_STANDING.PLATFORM_AUTHORED),
      }),
    ]),
  ) as Record<Locale, Readonly<Record<string, DisclosureLabel>>>;
}

/** Each registered version, named once: its entry's key, its manifest's check and its help's. */
const VERSION_20260201 = '2026-02-01';
const VERSION_20260501 = '2026-05-01';

const STANDING_20260201 = readStanding(standing20260201, VERSION_20260201);
const STANDING_20260501 = readStanding(standing20260501, VERSION_20260501);

export const DISCLOSURE_CATALOGUES: Readonly<Record<string, DisclosureCatalogue>> = {
  // Task 33.3's second registered version (R-7). Its element keys and EFRAG's English wording are
  // identical to May's — what moved between the two releases is the presentation-role naming, which
  // labels do not carry. The two authored locales are therefore the same authored text for the same
  // keys, which is per-version authoring rather than a copy of somebody else's translation: the
  // directory is still written once and never edited, as this catalogue's README requires.
  [VERSION_20260201]: {
    standing: STANDING_20260201,
    labels: {
      ro: pair(ro20260201, STANDING_20260201.ro),
      en: pair(en20260201, STANDING_20260201.en),
      ru: pair(ru20260201, STANDING_20260201.ru),
    },
    help: helpOf({
      version: VERSION_20260201,
      standing: STANDING_20260201,
      documented: { ro: helpRo20260201, en: helpEn20260201, ru: helpRu20260201 },
      authored: { ro: platformHelpRo20260201, en: platformHelpEn20260201, ru: platformHelpRu20260201 },
    }),
    members: {
      ro: pair(membersRo20260201, STANDING_20260201.ro),
      en: pair(membersEn20260201, STANDING_20260201.en),
      ru: pair(membersRu20260201, STANDING_20260201.ru),
    },
  },
  [VERSION_20260501]: {
    standing: STANDING_20260501,
    labels: {
      ro: pair(ro20260501, STANDING_20260501.ro),
      en: pair(en20260501, STANDING_20260501.en),
      ru: pair(ru20260501, STANDING_20260501.ru),
    },
    help: helpOf({
      version: VERSION_20260501,
      standing: STANDING_20260501,
      documented: { ro: helpRo20260501, en: helpEn20260501, ru: helpRu20260501 },
      authored: { ro: platformHelpRo20260501, en: platformHelpEn20260501, ru: platformHelpRu20260501 },
    }),
    members: {
      ro: pair(membersRo20260501, STANDING_20260501.ro),
      en: pair(membersEn20260501, STANDING_20260501.en),
      ru: pair(membersRu20260501, STANDING_20260501.ru),
    },
  },
};

/** Every version with a committed catalogue, newest first — the ordering `TaxonomyRegistry` uses. */
export const DISCLOSURE_CATALOGUE_VERSIONS: readonly string[] =
  Object.keys(DISCLOSURE_CATALOGUES).sort().reverse();
