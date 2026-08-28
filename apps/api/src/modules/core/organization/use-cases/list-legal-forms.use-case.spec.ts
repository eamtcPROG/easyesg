import { ListLegalForms } from './list-legal-forms.use-case';
import { FakeOrganizationVocabulary } from '../testing/organization.fakes';

/** The vocabulary S-04 and S-15 build their selects from (FR-15, AD-4). */
describe('ListLegalForms', () => {
  it('answers one entry per registered country, with the code as ISO renders it', () => {
    const useCase = new ListLegalForms(
      new FakeOrganizationVocabulary({ md: ['srl', 'sa'], ro: ['sa'] }),
    );

    // The scope is lower case because a seed filename is; ISO renders alpha-2 upper case, and the
    // wire follows ISO. The conversion happens here rather than in the front end so both screens
    // and the stored `country_code` agree on one spelling.
    expect(useCase.execute()).toEqual([
      { countryCode: 'MD', legalForms: ['srl', 'sa'] },
      { countryCode: 'RO', legalForms: ['sa'] },
    ]);
  });

  it('answers an empty list when nothing is registered, rather than throwing', () => {
    // A configuration store that has not been seeded is a deployment state, not a fault. S-04 then
    // offers no country and refuses on submit either way — one refusal is better than two.
    expect(new ListLegalForms(new FakeOrganizationVocabulary({})).execute()).toEqual([]);
  });
});
