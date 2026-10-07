import { overridingPerson, type OverridingPersonRow } from './overriding-person';

const ACCOUNT = '01a1165f-e68b-74b8-9ab2-846a96fe9601';
const row = (overrides: Partial<OverridingPersonRow>): OverridingPersonRow => ({
  overrider_id: ACCOUNT,
  overrider_found: true,
  overrider_email: 'ana@example.md',
  overrider_given_name: 'Ana',
  overrider_family_name: 'Popescu',
  ...overrides,
});

describe('overridingPerson', () => {
  it('names the account by its display name as it reads now', () => {
    expect(overridingPerson(row({}))).toEqual({ accountId: ACCOUNT, name: 'Ana Popescu' });
  });

  it('falls back to the address for an account that gave no name, as UX-137 does everywhere', () => {
    expect(overridingPerson(row({ overrider_given_name: null, overrider_family_name: ' ' }))).toEqual({
      accountId: ACCOUNT,
      name: 'ana@example.md',
    });
  });

  it('keeps the attribution of an erased account and names no one', () => {
    expect(
      overridingPerson(
        row({ overrider_found: false, overrider_email: null, overrider_given_name: null, overrider_family_name: null }),
      ),
    ).toEqual({ accountId: ACCOUNT, name: null });
  });

  it('is no attribution where no person is stored', () => {
    expect(overridingPerson(row({ overrider_id: null }))).toBeNull();
  });
});
