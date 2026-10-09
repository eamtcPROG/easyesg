import type { Locale } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { ENUMERATION_TAXONOMY, type TaxonomyEnumeration } from '@api/contracts/taxonomy-registry.port';
import { aLabel, aMember, anElement, anEnumeration } from '../testing/step-read.fakes';
import { OptionResolver, type OptionVocabulary } from './option-resolver';

/**
 * Task 133.2: the answers a choice field offers, from each of the three sources — over a registry that answers
 * enumerations and records each time it is asked, and a vocabulary that answers the two reads the options make.
 */
const LEGAL_FORMS = anEnumeration({
  key: 'vsme:ListOfUndertakingsLegalFormsMember',
  taxonomy: ENUMERATION_TAXONOMY.VSME,
  members: [aMember({ key: 'CooperativeMember' }), aMember({ key: 'PartnershipMember' })],
});
const NACE = anEnumeration({
  key: 'nace:NACE_AllEconomicActivitiesNAMember',
  taxonomy: ENUMERATION_TAXONOMY.NACE,
  members: [
    aMember({ key: 'NACE_C1071', code: '10.71', labels: { en: 'Manufacture of bread' } }),
    aMember({
      key: 'NACE_G4711',
      code: '47.11',
      labels: { en: 'Retail sale in non-specialised stores', ru: 'Розничная торговля' },
    }),
    aMember({ key: 'NACE_U', code: null, labels: { en: 'Extraterritorial organisations' } }),
    aMember({ key: 'NACE_X', code: null, labels: {} }),
  ],
});
const COUNTRIES = anEnumeration({ key: 'country:CountryMember', taxonomy: ENUMERATION_TAXONOMY.COUNTRY });

class RecordingEnumerations {
  readonly asked: string[] = [];

  enumeration(query: { readonly key: string }): TaxonomyEnumeration | null {
    this.asked.push(query.key);
    return [LEGAL_FORMS, NACE, COUNTRIES].find((enumeration) => enumeration.key === query.key) ?? null;
  }
}

const vocabulary: OptionVocabulary = {
  registeredLegalForms: () => [{ countryCode: 'md', legalForms: ['srl', 'sa'] }],
  naceClassifierFor: (countryCode) =>
    countryCode === 'md' ? [{ code: '10.71', labels: { ro: 'Fabricarea pâinii', ru: 'Производство хлеба' } }] : null,
};

const resolver = (over: { readonly locale?: Locale; readonly registry?: RecordingEnumerations } = {}) =>
  new OptionResolver({
    registered: { standard: 'vsme', version: '2026-05-01' },
    taxonomy: over.registry ?? new RecordingEnumerations(),
    memberLabels: { CooperativeMember: aLabel('Cooperativă') },
    vocabulary,
    locale: over.locale ?? 'ro',
  });

describe('OptionResolver', () => {
  it('offers nothing to a field that is not a choice, and an empty list to a choice with no domain', () => {
    const options = resolver();

    expect(options.optionsFor(anElement({ key: 'NumberOfEmployees', kind: DISCLOSURE_KIND.NUMERIC }))).toBeNull();
    expect(options.optionsFor(anElement({ key: 'Unbound', kind: DISCLOSURE_KIND.ENUMERATION, domain: null }))).toEqual([]);
    expect(
      options.optionsFor(anElement({ key: 'Unregistered', kind: DISCLOSURE_KIND.ENUMERATION, domain: 'NoSuchMember' })),
    ).toEqual([]);
  });

  it('finds a VSME domain the element names bare, words it from the catalogue, and reads it once per step', () => {
    const registry = new RecordingEnumerations();
    const options = resolver({ registry });
    const domain = 'ListOfUndertakingsLegalFormsMember';
    const single = anElement({ key: 'LegalForm', kind: DISCLOSURE_KIND.ENUMERATION, domain });
    const set = anElement({ key: 'LegalForms', kind: DISCLOSURE_KIND.ENUMERATION_SET, domain });

    expect(options.optionsFor(single)).toEqual([
      { value: 'vsme:CooperativeMember', code: null, hazardous: null, label: 'Cooperativă' },
      { value: 'vsme:PartnershipMember', code: null, hazardous: null, label: null },
    ]);
    expect(options.optionsFor(set)).toBe(options.optionsFor(single));
    expect(registry.asked).toEqual(['vsme:ListOfUndertakingsLegalFormsMember']);
  });

  it('names a NACE class from the platform’s classifier first, then the published name, then English', () => {
    const activity = anElement({ key: 'Activity', kind: DISCLOSURE_KIND.ENUMERATION_SET, domain: NACE.key });

    expect(resolver({ locale: 'ru' }).optionsFor(activity)?.map((option) => option.label)).toEqual([
      'Производство хлеба',
      'Розничная торговля',
      'Extraterritorial organisations',
      null,
    ]);
    expect(resolver({ locale: 'ro' }).optionsFor(activity)?.[0]).toEqual({
      value: 'nace:NACE_C1071',
      code: '10.71',
      hazardous: null,
      label: 'Fabricarea pâinii',
    });
  });

  it('offers the countries the platform registers, by code, and leaves their names to the client', () => {
    const country = anElement({ key: 'Country', kind: DISCLOSURE_KIND.ENUMERATION, domain: COUNTRIES.key });

    expect(resolver().optionsFor(country)).toEqual([{ value: 'country:MD', label: null, code: 'MD', hazardous: null }]);
  });
});
