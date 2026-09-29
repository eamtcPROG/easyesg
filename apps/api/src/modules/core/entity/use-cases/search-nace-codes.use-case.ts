import type {
  NaceCode,
  OrganizationVocabulary,
} from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import type { OrganizationStore } from '@api/modules/core/organization/interfaces/organization-store.interface';
import { NACE_SEARCH_MAX_LIMIT } from '../constants/nace-search.constants';
import type { NaceCodeMatch } from '../models/reporting-entity.model';

export interface ResolveNaceCodesCommand {
  /** The codes a record already holds, exactly. Unknown ones are dropped rather than invented. */
  readonly codes: readonly string[];
  readonly locale: string;
}

export interface SearchNaceCodesCommand {
  /** What the reader typed. Empty is a real input and answers the first classes — see the class docblock. */
  readonly query: string;
  /** The request's negotiated locale, resolved by the service as every ambient value is. */
  readonly locale: string;
  readonly limit: number;
}

/**
 * Diacritic- and case-insensitive comparison text.
 *
 * **NFD then strip the combining marks**, which is the whole reason this exists: a Moldovan reader
 * types `brutarie` for *brutărie* and `Chisinau` for *Chișinău*, and Romanian's comma-below `ș`/`ț`
 * decompose exactly as the cedilla forms do — so a search that compared raw strings would answer
 * nothing for the spelling most people actually type. Cyrillic is unaffected and passes through.
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Codes are matched on their digits alone, so `10.71`, `1071` and `10 71` are one query. */
const bareCode = (value: string): string => value.replace(/[^0-9a-z]/giu, '').toLowerCase();

/** A label or a query cut into its words — letters and digits in any script, everything else a gap. */
const wordsOf = (folded: string): string[] => folded.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');

/**
 * A **class**, the four-character code B1 exports (`10.71`) — as against a section (`C`), a division
 * (`10`) or a group (`10.7`), which the classifier carries for its hierarchy and which the picker's
 * suggestions leave out.
 */
const isClass = (code: string): boolean => /^\d{4}$/u.test(bareCode(code));

/**
 * How well an entry answers the query, best first — the order results are ranked in, and within one
 * rank the classifier's own order holds. Declared as a vocabulary because the numbers are compared,
 * and a literal `2` at the comparison would say nothing about what it outranks.
 */
const MATCH = {
  /** The digits typed begin the entry's code. */
  CODE: 0,
  /** The label begins with what was typed. */
  LABEL_START: 1,
  /** Every word typed begins a word of the label, in any order. */
  WORD_START: 2,
  /** Every word typed, less an inflected ending, begins a word of the label. */
  STEM: 3,
  /** Every word typed appears somewhere inside the label. */
  WITHIN: 4,
} as const;

type MatchRank = (typeof MATCH)[keyof typeof MATCH];

/** What the reader typed, read once per search rather than once per entry. */
interface Reading {
  readonly folded: string;
  readonly digits: string;
  readonly words: readonly string[];
  readonly stems: readonly string[];
}

/**
 * **A word loses its last two letters as a stem once it is longer than four**, because Romanian and
 * Russian inflect at the end: a reader types *pâine* and the classifier says *pâinii*, types *хлеб* and
 * it says *хлеба*. Shorter words keep every letter, since cutting *pâin* to *pâ* would match half the
 * classifier. A stem match ranks below a whole-word one, so an exact word still comes first.
 */
const STEM_FROM = 5;
const STEM_CUT = 2;
const stemOf = (word: string): string => (word.length >= STEM_FROM ? word.slice(0, -STEM_CUT) : word);

const readQuery = (query: string): Reading => {
  const folded = fold(query).replace(/\s+/gu, ' ');
  const words = wordsOf(folded);
  return { folded, digits: bareCode(query), words, stems: words.map(stemOf) };
};

/** The entry's rank for this query, or null where it does not answer it. */
const rankOf = (reading: Reading, entry: { readonly code: string; readonly label: string }): MatchRank | null => {
  if (reading.digits !== '' && bareCode(entry.code).startsWith(reading.digits)) return MATCH.CODE;
  if (reading.words.length === 0) return null;

  const label = fold(entry.label);
  if (label.startsWith(reading.folded)) return MATCH.LABEL_START;

  const labelWords = wordsOf(label);
  const beginsAWord = (start: string): boolean => labelWords.some((word) => word.startsWith(start));
  if (reading.words.every(beginsAWord)) return MATCH.WORD_START;
  if (reading.stems.every(beginsAWord)) return MATCH.STEM;
  if (reading.words.every((word) => label.includes(word))) return MATCH.WITHIN;
  return null;
};

/**
 * S-13's activity vocabulary (FR-17, tasks 30.4.1 and 30.4.2) — the classifier **searched** for a
 * picker and **resolved** for a record that already holds codes.
 *
 * Named for the vocabulary rather than for one flow, because it carries two and they share the
 * country resolution and the locale fallback. Neither is a UC of its own: both support UC-52 and
 * UC-53, which `ManageReportingEntity` owns.
 *
 * §9.6 registered CAEM Rev.2 as configuration and `ManageReportingEntity` admits a code against it,
 * but nothing let a screen *offer* one. Without this, S-13 has a free-text field for a classifier
 * no SME owner has memorised — and a raw code on the screen besides, which the user-facing-text
 * rule forbids.
 *
 * **It searches here rather than shipping the classifier to the browser**, and that is size rather
 * than taste: `/organizations/legal-forms` is ten keys and ships whole, this is 996 entries and
 * 260 KB across three locales. Putting that in a bundle is exactly what the root layout's
 * `messages={null}` exists to prevent (NFR-43).
 *
 * **The country comes from the organization**, as it does for validation, and for the same reason
 * `ManageReportingEntity` states: an entity has sites which may be anywhere, but the classifier
 * governing its activity codes is the one its organization is registered under. Reading it per call
 * keeps a country change (UC-50) applying to the next search with nothing to invalidate.
 *
 * **`resolve` is a second flow over the same vocabulary, not a search with a different filter.**
 * S-13 renders an entity's activity as words, and it already holds the codes — asking `search` for
 * each in turn would be one request per code *and* wrong, since a code match is by prefix: `10.7`
 * would answer three rows where one was asked for. It also answers in the caller's order rather
 * than the classifier's, because the caller is rendering a record's own list.
 *
 * **An empty query answers the classifier's first classes** (project owner, 28 Sep 2026: the picker
 * shows ten on first focus, so a reader sees what it holds before typing). It answered nothing until
 * then, and the reason recorded for that still decides *which* entries: the first `n` in code order
 * are a division, a group and then classes, and the 21 sections would read like a starting point —
 * both invite storing a code B1 does not export. So the answer is **classes only**, the
 * four-character codes, in code order; everything above them stays reachable by search.
 *
 * **A typed query ranks rather than filters in classifier order** (same decision). The words may come
 * in any order, an inflected ending does not stop a match, and what answers best comes first — see
 * `MATCH`. Within one rank the classifier's order holds, so the hierarchy still reads top-down.
 */
export class NaceCodeLookup {
  constructor(
    private readonly organizations: OrganizationStore,
    private readonly vocabulary: OrganizationVocabulary,
  ) {}

  /**
   * The words for codes a record already holds.
   *
   * **Unknown codes are dropped, not rendered as themselves.** A code that no longer exists in the
   * classifier is a configuration change under a stored value — real, since AD-4 lets the set move
   * without a redeploy — and the honest answer is that this vocabulary has nothing to say about it.
   * The screen still holds the code and can show it as a code; inventing a label here would make a
   * retired entry indistinguishable from a live one.
   */
  async resolve(command: ResolveNaceCodesCommand): Promise<NaceCodeMatch[]> {
    if (command.codes.length === 0) return [];

    const classifier = await this.classifier();
    if (!classifier) return [];

    const byCode = new Map(classifier.map((entry) => [entry.code, entry]));
    return command.codes.flatMap((code) => {
      const entry = byCode.get(code);
      return entry ? [{ code: entry.code, label: this.label(entry, command.locale) }] : [];
    });
  }

  async search(command: SearchNaceCodesCommand): Promise<NaceCodeMatch[]> {
    const classifier = await this.classifier();
    if (!classifier) return [];

    const limit = Math.min(Math.max(command.limit, 1), NACE_SEARCH_MAX_LIMIT);
    const query = command.query.trim();

    if (query === '') {
      return classifier
        .filter((entry) => isClass(entry.code))
        .slice(0, limit)
        .map((entry) => ({ code: entry.code, label: this.label(entry, command.locale) }));
    }

    // Somebody who typed a code wants that code first, and somebody who typed words wants the entry
    // that says them best — so the rank reads the input rather than guessing whether it "looks like a
    // code". The classifier is already in code order (the adapter sorts once), and `sort` is stable,
    // so each rank keeps the hierarchy.
    const reading = readQuery(query);
    const ranked: { readonly match: NaceCodeMatch; readonly rank: MatchRank }[] = [];
    for (const entry of classifier) {
      const match = { code: entry.code, label: this.label(entry, command.locale) };
      const rank = rankOf(reading, match);
      if (rank !== null) ranked.push({ match, rank });
    }

    return ranked
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(({ match }) => match);
  }

  /**
   * The classifier registered for the **organization's** country, or null.
   *
   * Shared by both flows, and the country resolution is the reason it is a method rather than a
   * parameter: an entity has sites which may be anywhere, but the classifier governing its activity
   * codes is the one its organization is registered under — `ManageReportingEntity` states the same
   * rule for the write path. Read per call, so a country change (UC-50) applies to the next request
   * with nothing to invalidate.
   */
  private async classifier(): Promise<readonly NaceCode[] | null> {
    const organization = await this.organizations.findBoundOrganization();
    if (!organization) return null;
    return this.vocabulary.naceClassifierFor(organization.countryCode);
  }

  /**
   * The label in the reader's language, or the best there is.
   *
   * **Falls back rather than hiding the entry** — OQ-43's stated trade for a value registered ahead
   * of its wording, and the reason `NaceCode.labels` is a map rather than a required triple: a
   * classifier published for a fourth country would otherwise disappear from the picker until three
   * translations existed. The code is the last resort and is never *nothing*.
   */
  private label(entry: NaceCode, locale: string): string {
    const preferred = entry.labels[locale];
    if (preferred !== undefined) return preferred;
    const first = Object.values(entry.labels)[0];
    return first ?? entry.code;
  }
}
