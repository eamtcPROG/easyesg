import { CreateOrganization } from './create-organization.use-case';
import { CountryNotSupportedError } from '../errors/organization.errors';
import {
  FakeOrganizationFoundingStore,
  FakeOrganizationVocabulary,
} from '../testing/organization.fakes';

/** UC-49 (FR-13, D-1). No database, no container — the dependencies point inward. */
describe('CreateOrganization (UC-49)', () => {
  const build = (vocabulary = new FakeOrganizationVocabulary()) => {
    const store = new FakeOrganizationFoundingStore();
    return { store, useCase: new CreateOrganization(store, vocabulary) };
  };

  const command = {
    name: 'Fabrica de Cașcaval',
    countryCode: 'MD',
    contactEmail: null,
    contactPhone: null,
    founderAccountId: '00000000-0000-0000-0000-0000000000f1',
  };

  it('founds the organization and names the caller as its administrator', async () => {
    const { store, useCase } = build();

    const organization = await useCase.execute(command);

    expect(organization.name).toBe('Fabrica de Cașcaval');
    // The founder is carried to the store, not returned — FR-13's grant is the store's single
    // transaction, and this is the assertion that the identity reaches it at all.
    expect(store.founded).toEqual([
      {
        organization: {
          name: 'Fabrica de Cașcaval',
          countryCode: 'MD',
          contactEmail: null,
          contactPhone: null,
        },
        founderAccountId: '00000000-0000-0000-0000-0000000000f1',
      },
    ]);
  });

  it('normalises the country to upper case before it is stored or looked up', async () => {
    const { store, useCase } = build();

    await useCase.execute({ ...command, countryCode: 'md' });

    // ISO renders alpha-2 upper case and the column stores it that way. Both halves matter: the
    // lookup has to find `md`'s vocabulary, and the row has to hold `MD` — one normalisation
    // serving two readers is why it happens here rather than in the DTO.
    expect(store.founded[0].organization.countryCode).toBe('MD');
  });

  it('trims the name, so a trailing space is not a different organization', async () => {
    const { store, useCase } = build();

    await useCase.execute({ ...command, name: '  Fabrica de Cașcaval  ' });

    expect(store.founded[0].organization.name).toBe('Fabrica de Cașcaval');
  });

  it('refuses a country that registers no legal-form vocabulary, writing nothing', async () => {
    const { store, useCase } = build();

    await expect(useCase.execute({ ...command, countryCode: 'FR' })).rejects.toBeInstanceOf(
      CountryNotSupportedError,
    );
    // The refusal is §7.2's stated boundary, and it lands *before* the write: permitting the
    // organization and refusing its legal form later would leave a real tenant permanently unable
    // to complete B1, discovered at filing time.
    expect(store.founded).toEqual([]);
  });

  it('treats a registered-but-empty vocabulary as a supported country', async () => {
    const { store, useCase } = build(new FakeOrganizationVocabulary({ md: [] }));

    await useCase.execute(command);

    // The port keeps "no vocabulary registered" and "registered with no entries" apart, and this is
    // the test that says why: the second is an editing mistake in configuration, and collapsing it
    // into the first would make a mistake indistinguishable from the deliberate country limit.
    expect(store.founded).toHaveLength(1);
  });
});
