import { describe, expect, it } from 'vitest';
import { legalFormOptions } from './legal-forms';

const VOCABULARY = [
  { countryCode: 'MD', legalForms: ['srl', 'sa', 'ii'] },
  { countryCode: 'RO', legalForms: ['srl', 'pfa'] },
];
const LABELS = { srl: 'Societate cu răspundere limitată', sa: 'Societate pe acțiuni', ii: 'Întreprindere individuală' };

/** Task 168: S-13 offers the organization's country's legal forms, and no other country's. */
describe('legalFormOptions', () => {
  it('offers the organization’s country’s forms when several countries are configured', () => {
    expect(legalFormOptions({ vocabulary: VOCABULARY, countryCode: 'RO', labels: LABELS })).toEqual([
      { value: 'srl', label: 'Societate cu răspundere limitată' },
      // A form with no wording yet shows its key rather than disappearing.
      { value: 'pfa', label: 'pfa' },
    ]);
    expect(legalFormOptions({ vocabulary: VOCABULARY, countryCode: 'MD', labels: LABELS }).map((o) => o.value)).toEqual([
      'srl',
      'sa',
      'ii',
    ]);
  });

  it('offers nothing for a country the vocabulary does not carry, rather than the first country’s', () => {
    expect(legalFormOptions({ vocabulary: VOCABULARY, countryCode: 'UA', labels: LABELS })).toEqual([]);
  });

  it('offers nothing when the organization’s country is not known', () => {
    expect(legalFormOptions({ vocabulary: VOCABULARY, countryCode: null, labels: LABELS })).toEqual([]);
  });
});
