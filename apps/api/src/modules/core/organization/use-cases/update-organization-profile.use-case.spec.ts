import { UpdateOrganizationProfile } from './update-organization-profile.use-case';
import {
  CountryNotSupportedError,
  IdnoMalformedError,
  LegalFormUnknownError,
  LeiCheckDigitsError,
  LeiMalformedError,
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

  describe("FR-16's identifiers", () => {
    // A real, published LEI (Deutsche Bank AG), so the corpus cannot agree with a wrong
    // implementation the way an invented string would.
    const LEI = '7LTWFZYICNSX8D621K86';
    const IDNO = '1003600158022';

    it('records both when they are valid', async () => {
      const { useCase } = build();

      const updated = await useCase.execute({ patch: { idno: IDNO, lei: LEI } });

      expect(updated.idno).toBe(IDNO);
      expect(updated.lei).toBe(LEI);
    });

    it('clears either on an explicit null, since neither is required here', async () => {
      const { useCase } = build(anOrganization({ idno: IDNO, lei: LEI }));

      // What makes the IDNO required is that B1 cannot be filed without it (task 40), not this
      // record — so S-15 must be able to empty a field somebody filled in wrongly.
      const updated = await useCase.execute({ patch: { idno: null, lei: null } });

      expect(updated.idno).toBeNull();
      expect(updated.lei).toBeNull();
    });

    it.each([
      ['twelve digits', '100360015802'],
      ['fourteen digits', '10036001580222'],
      ['a letter', '100360015802X'],
    ])('refuses an IDNO of %s', async (_label, idno) => {
      const { store, useCase } = build();

      await expect(useCase.execute({ patch: { idno } })).rejects.toBeInstanceOf(IdnoMalformedError);
      expect(store.current?.idno).toBeNull();
    });

    it('refuses a malformed LEI distinctly from one whose check digits disagree', async () => {
      const { useCase } = build();

      // Wrong shape: nineteen characters. The resolution is to retype it.
      await expect(useCase.execute({ patch: { lei: LEI.slice(0, 19) } })).rejects.toBeInstanceOf(
        LeiMalformedError,
      );

      // Right shape, two adjacent characters transposed. Nothing about the value looks wrong, and
      // only the checksum sees it — which is the whole argument for running one. The resolution is
      // different too: go back to the register rather than retype.
      await expect(
        useCase.execute({ patch: { lei: '7LTWFZYICNSX8D62K186' } }),
      ).rejects.toBeInstanceOf(LeiCheckDigitsError);
    });

    it('does not refuse an IDNO on its check digit, because that algorithm is unknown', async () => {
      const { useCase } = build();

      // Thirteen digits whose thirteenth is almost certainly not the right check digit — and it is
      // accepted, deliberately. §7.2 records why: the algorithm is not published in the defining
      // instrument, a candidate reproduced 2 of 12 real IDNOs, and a guessed one would refuse real
      // registrations rather than catch mistyped ones. This test is what makes that a decision
      // rather than an omission, and it is the one to change when the norm is found.
      const updated = await useCase.execute({ patch: { idno: '1003600158029' } });

      expect(updated.idno).toBe('1003600158029');
    });
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
