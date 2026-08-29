import type {
  NaceCode,
  OrganizationVocabulary,
} from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import type { OrganizationStore } from '@api/modules/core/organization/interfaces/organization-store.interface';
import { NACE_SEARCH_MAX_LIMIT } from '../constants/nace-search.constants';
import type { NaceCodeMatch } from '../models/reporting-entity.model';

export interface SearchNaceCodesCommand {
  /** What the reader typed. Empty is a real input and answers nothing — see the class docblock. */
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

/**
 * S-13's activity picker (FR-17, task 30.4.1) — the classifier searched, not merely validated.
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
 * **An empty query answers an empty list, deliberately.** The alternatives were both worse: the
 * first `n` codes in order is an arbitrary slice of agriculture, and the 21 sections — which reads
 * like a navigational starting point — would invite storing a **section** where B1 exports a
 * four-character code, so the picker's most convenient answer would be the one that leaves FR-17
 * unsatisfied. The control prompts instead.
 */
export class SearchNaceCodes {
  constructor(
    private readonly organizations: OrganizationStore,
    private readonly vocabulary: OrganizationVocabulary,
  ) {}

  async execute(command: SearchNaceCodesCommand): Promise<NaceCodeMatch[]> {
    const query = command.query.trim();
    if (query === '') return [];

    const organization = await this.organizations.findBoundOrganization();
    if (!organization) return [];

    const classifier = this.vocabulary.naceClassifierFor(organization.countryCode);
    if (!classifier) return [];

    const limit = Math.min(Math.max(command.limit, 1), NACE_SEARCH_MAX_LIMIT);
    const folded = fold(query);
    const digits = bareCode(query);

    // Two passes rather than one sort, and the order is the point: somebody who typed a code wants
    // that code first, and somebody who typed a word wants the shortest useful list. A single pass
    // scored by "does it look like a code" guesses at intent; two passes read the input twice and
    // guess at nothing. The classifier is already in code order (the adapter sorts once), so each
    // pass preserves the hierarchy.
    const byCode: NaceCodeMatch[] = [];
    const byLabel: NaceCodeMatch[] = [];

    for (const entry of classifier) {
      const label = this.label(entry, command.locale);
      if (digits !== '' && bareCode(entry.code).startsWith(digits)) {
        byCode.push({ code: entry.code, label });
        continue;
      }
      if (fold(label).includes(folded)) byLabel.push({ code: entry.code, label });
    }

    return [...byCode, ...byLabel].slice(0, limit);
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
