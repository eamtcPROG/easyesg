import { UpdateOrganizationProfile } from './update-organization-profile.use-case';
import { CountryNotSupportedError, OrganizationNotFoundError } from '../errors/organization.errors';
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
    const { useCase } = build(anOrganization({ contactEmail: 'contact@cascaval.md' }));

    const updated = await useCase.execute({ patch: { name: 'Cașcaval SRL' } });

    expect(updated.name).toBe('Cașcaval SRL');
    expect(updated.contactEmail).toBe('contact@cascaval.md');
    expect(updated.updatedAt).toEqual(at);
  });

  it('clears a field given an explicit null, which is a different request from omitting it', async () => {
    const { useCase } = build(anOrganization({ contactEmail: 'contact@cascaval.md', contactPhone: '+37322000000' }));

    const updated = await useCase.execute({ patch: { contactEmail: null } });

    expect(updated.contactEmail).toBeNull();
    expect(updated.contactPhone).toBe('+37322000000');
  });

  // Task 177: the legal form is each entity's, so a country that registers a vocabulary is all a move needs — the
  // entities' forms are not re-checked while one country registers one (§12.5.6's task-177 row).
  it('moves to another country that registers a vocabulary', async () => {
    const { useCase } = build();

    expect((await useCase.execute({ patch: { countryCode: 'ro' } })).countryCode).toBe('RO');
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
