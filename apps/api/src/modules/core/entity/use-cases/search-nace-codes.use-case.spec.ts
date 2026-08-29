import {
  FakeOrganizationStore,
  anOrganization,
} from '@api/modules/core/organization/testing/organization.fakes';
import type { NaceCode } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { NaceCodeLookup } from './search-nace-codes.use-case';
import { NACE_SEARCH_DEFAULT_LIMIT } from '../constants/nace-search.constants';

/**
 * The search rule, arm by arm (FR-17, task 30.4.1) — pure, so every one of these is reachable
 * without a database, a request or 996 rows of configuration.
 *
 * The classifier below is a hand-built six-entry stand-in with the two properties that matter: real
 * Romanian diacritics, and one entry whose labels omit English.
 */
const CLASSIFIER: NaceCode[] = [
  { code: 'C', labels: { ro: 'Industria prelucrătoare', en: 'MANUFACTURING' } },
  { code: '10', labels: { ro: 'Industria alimentară', en: 'Manufacture of food products' } },
  { code: '10.7', labels: { ro: 'Fabricarea produselor de brutărie', en: 'Manufacture of bakery products' } },
  { code: '10.71', labels: { ro: 'Fabricarea pâinii; fabricarea prăjiturilor', en: 'Manufacture of bread' } },
  { code: '10.72', labels: { ro: 'Fabricarea biscuiţilor şi pişcoturilor', en: 'Manufacture of rusks' } },
  // No English: the fallback path, which no production payload exercises now that the seed carries
  // all three — and which a fourth country would reach on its first day.
  { code: '49.41', labels: { ro: 'Transporturi rutiere de mărfuri' } },
];

const vocabulary = (classifier: readonly NaceCode[] | null): OrganizationVocabulary => ({
  legalFormsFor: () => null,
  registeredLegalForms: () => [],
  naceCodesFor: () => null,
  naceClassifierFor: () => classifier,
  relationshipTypes: () => [],
});

const search = (classifier: readonly NaceCode[] | null = CLASSIFIER) => {
  const organizations = new FakeOrganizationStore(anOrganization({ countryCode: 'MD' }));
  return new NaceCodeLookup(organizations, vocabulary(classifier));
};

const run = (query: string, locale = 'ro', limit = NACE_SEARCH_DEFAULT_LIMIT) =>
  search().search({ query, locale, limit });

describe('NaceCodeLookup — search (FR-17)', () => {
  it('matches a code by its digits, ignoring how the reader punctuated it', async () => {
    // One query written three ways: the picker must not ask somebody to type the dot.
    for (const typed of ['10.71', '1071', '10 71']) {
      const matches = await run(typed);
      expect(matches.map((m) => m.code)).toEqual(['10.71']);
    }
  });

  it('matches a code prefix, keeping the classifier’s own hierarchy', async () => {
    const matches = await run('10.7');
    expect(matches.map((m) => m.code)).toEqual(['10.7', '10.71', '10.72']);
  });

  it('matches a label without its diacritics, which is how people type', async () => {
    // `brutarie` for *brutărie* — the reason the fold exists. Without it this answers nothing, and
    // the picker looks broken to the majority of its users.
    const matches = await run('brutarie');
    expect(matches.map((m) => m.code)).toEqual(['10.7']);
  });

  it('matches a label case-insensitively in the reader’s own language', async () => {
    expect((await run('BAKERY', 'en')).map((m) => m.code)).toEqual(['10.7']);
    expect((await run('pâinii')).map((m) => m.code)).toEqual(['10.71']);
  });

  it('puts code matches before label matches', async () => {
    // `10` is a code prefix for three entries AND appears in no label, so the ordering is visible
    // only with a query that is both — `C` matches the section's code and `prelucrătoare`'s label.
    const matches = await run('c');
    expect(matches[0].code).toBe('C');
  });

  it('falls back to a label it has when the reader’s locale is missing', async () => {
    // OQ-43's trade: a value registered ahead of its wording renders what there is. Asking in
    // English for an entry that carries only Romanian answers the Romanian rather than hiding it.
    const matches = await run('rutiere', 'en');
    expect(matches).toEqual([{ code: '49.41', label: 'Transporturi rutiere de mărfuri' }]);
  });

  it('answers nothing for an empty query, and does not read the classifier to say so', async () => {
    await expect(run('')).resolves.toEqual([]);
    await expect(run('   ')).resolves.toEqual([]);
  });

  it('bounds the answer, and clamps a limit outside the permitted range', async () => {
    expect(await run('10', 'ro', 2)).toHaveLength(2);
    // Above the maximum and below the minimum both land inside it rather than refusing: a picker
    // asking for too much is a caller to correct, not a reader to fail.
    expect((await run('10', 'ro', 9999)).length).toBeLessThanOrEqual(50);
    expect((await run('10', 'ro', 0)).length).toBeGreaterThan(0);
  });

  it('answers nothing where the country registers no classifier', async () => {
    // §7.2's distinction: the platform does not operate there. Not an error, and not an empty
    // classifier either — the picker simply offers nothing to a country nobody registered.
    await expect(
      search(null).search({ query: 'brutarie', locale: 'ro', limit: NACE_SEARCH_DEFAULT_LIMIT }),
    ).resolves.toEqual([]);
  });
});

describe('NaceCodeLookup — resolve (FR-17, task 30.4.2)', () => {
  const resolve = (codes: string[], locale = 'ro') => search().resolve({ codes, locale });

  it('answers the words for codes a record already holds, in the caller’s order', async () => {
    // The record's order, not the classifier's: this is rendering one entity's own list, and
    // re-sorting it would silently reorder what the reader entered.
    await expect(resolve(['10.72', '10.71'])).resolves.toEqual([
      { code: '10.72', label: 'Fabricarea biscuiţilor şi pişcoturilor' },
      { code: '10.71', label: 'Fabricarea pâinii; fabricarea prăjiturilor' },
    ]);
  });

  it('matches exactly, where search matches a prefix', async () => {
    // The reason this is a second flow rather than a search per code: `10.7` searched answers
    // three rows, and resolved answers the one that was asked for.
    await expect(resolve(['10.7'])).resolves.toEqual([
      { code: '10.7', label: 'Fabricarea produselor de brutărie' },
    ]);
  });

  it('drops a code the classifier no longer carries rather than inventing a label', async () => {
    // AD-4 lets the set move without a redeploy, so a stored code with no entry is a real state.
    // The screen still holds the code; a label made up here would make a retired entry look live.
    await expect(resolve(['10.71', '99.99'])).resolves.toEqual([
      { code: '10.71', label: 'Fabricarea pâinii; fabricarea prăjiturilor' },
    ]);
  });

  it('falls back to a language the entry does carry', async () => {
    await expect(resolve(['49.41'], 'en')).resolves.toEqual([
      { code: '49.41', label: 'Transporturi rutiere de mărfuri' },
    ]);
  });

  it('answers nothing for no codes, and reads no classifier to say so', async () => {
    await expect(resolve([])).resolves.toEqual([]);
  });
});
