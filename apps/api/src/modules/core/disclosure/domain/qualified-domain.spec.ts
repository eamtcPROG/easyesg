import { qualifiedDomainOf } from './qualified-domain';

/** Task 133.2: an element's domain, as the registry keys enumerations. */
describe('qualifiedDomainOf', () => {
  it('qualifies a domain the artefact leaves bare as VSME’s own', () => {
    expect(qualifiedDomainOf({ domain: 'ListOfDisclosuresMember' })).toBe('vsme:ListOfDisclosuresMember');
  });

  it('leaves a domain already qualified as it is', () => {
    expect(qualifiedDomainOf({ domain: 'nace:NACE_AllEconomicActivitiesNAMember' })).toBe(
      'nace:NACE_AllEconomicActivitiesNAMember',
    );
  });

  it('is null for an element that draws from no domain', () => {
    expect(qualifiedDomainOf({ domain: null })).toBeNull();
  });
});
