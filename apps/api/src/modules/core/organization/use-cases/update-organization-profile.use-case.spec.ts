import { UpdateOrganizationProfile } from './update-organization-profile.use-case';
import {
  CountryNotSupportedError,
  LegalFormUnknownError,
  OrganizationNotFoundError,
} from '../errors/organization.errors';
import {
  FakeOrganizationStore,
  FakeOrganizationVocabulary,
  anOrganization,
} from '../testing/organization.fakes';

/** UC-50 (FR-15). No database, no container — the dependencies point inward. */
describe('UpdateOrganizationProfile (UC-50)', () => {
  const at = new Date('2026-08-28T09:00:00.000Z');

  const build = (
    organization: ReturnType<typeof anOrganization> | null = anOrganization(),
    vocabulary = new FakeOrganizationVocabulary({ md: ['srl', 'sa', 'ii'], ro: ['sa', 'pfa'] }),
  ) => {
    const store = new FakeOrganizationStore(organization);
    return { store, useCase: new UpdateOrganizationProfile(store, vocabulary, () => at) };
  };

  it('applies the fields the patch names and leaves the rest alone', async () => {
    const { useCase } = build(anOrganization({ registeredLocality: 'Chișinău' }));

    const updated = await useCase.execute({ patch: { name: 'Cașcaval SRL', legalForm: 'srl' } });

    expect(updated.name).toBe('Cașcaval SRL');
    expect(updated.legalForm).toBe('srl');
    expect(updated.registeredLocality).toBe('Chișinău');
    expect(updated.updatedAt).toEqual(at);
  });

  it('clears a field given an explicit null, which is a different request from omitting it', async () => {
    const { useCase } = build(anOrganization({ legalForm: 'srl', contactPhone: '+37322000000' }));

    const updated = await useCase.execute({ patch: { legalForm: null } });

    // Clearing a legal form is always permitted: an organization that has not decided is a state
    // S-15 must be able to return to, and refusing it would make a wrong choice unfixable.
    expect(updated.legalForm).toBeNull();
    expect(updated.contactPhone).toBe('+37322000000');
  });

  it('refuses a legal form the organization’s country does not register', async () => {
    const { store, useCase } = build();

    await expect(useCase.execute({ patch: { legalForm: 'pfa' } })).rejects.toBeInstanceOf(
      LegalFormUnknownError,
    );
    expect(store.current?.legalForm).toBeNull();
  });

  it('checks the form against the country the patch RESULTS in, not the stored one', async () => {
    const { store, useCase } = build(anOrganization({ legalForm: 'srl' }));

    // `srl` is registered for MD and not for RO, so moving the organization to RO would strand the
    // form it already holds. Checking against the stored country would pass this and leave a value
    // no list contains — invisible until S-15 renders a select with nothing selected.
    await expect(useCase.execute({ patch: { countryCode: 'RO' } })).rejects.toBeInstanceOf(
      LegalFormUnknownError,
    );
    expect(store.current?.countryCode).toBe('MD');
  });

  it('permits a country change that carries a form the new country also registers', async () => {
    const { useCase } = build(anOrganization({ legalForm: 'sa' }));

    const updated = await useCase.execute({ patch: { countryCode: 'ro' } });

    expect(updated.countryCode).toBe('RO');
    expect(updated.legalForm).toBe('sa');
  });

  it('normalises the submitted country before storing it', async () => {
    const { useCase } = build();

    expect((await useCase.execute({ patch: { countryCode: 'md' } })).countryCode).toBe('MD');
  });

  it('refuses a country that registers no vocabulary at all', async () => {
    const { useCase } = build();

    await expect(useCase.execute({ patch: { countryCode: 'FR' } })).rejects.toBeInstanceOf(
      CountryNotSupportedError,
    );
  });

  it('refuses when no organization is bound, rather than writing to nothing', async () => {
    const { useCase } = build(null);

    // Unreachable in production — `@RequiresRole` has already refused a caller with no membership
    // in an active organization — so this pins the behaviour of the one path left: the row
    // disappearing between the membership lookup and the read.
    await expect(useCase.execute({ patch: { name: 'Cașcaval SRL' } })).rejects.toBeInstanceOf(
      OrganizationNotFoundError,
    );
  });
});
