import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { PhoneNumberMalformedError, ProfileNamesRequiredError } from '../errors/account.errors';
import type { AccountProfileStore } from '../interfaces/account-profile-store.interface';
import type { AccountProfile, AccountProfileChange } from '../models/account-profile.model';
import { SaveAccountProfile } from './save-account-profile.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-00000000a001';

/** One account's profile, as the table holds it: a save writes every field it is given. */
class FakeProfileStore implements AccountProfileStore {
  saved: AccountProfileChange[] = [];
  constructor(private profile: AccountProfile | null) {}

  find(): Promise<AccountProfile | null> {
    return Promise.resolve(this.profile);
  }

  save(command: { readonly change: AccountProfileChange }): Promise<AccountProfile | null> {
    if (this.profile === null) return Promise.resolve(null);
    this.saved.push(command.change);
    this.profile = { ...this.profile, ...command.change };
    return Promise.resolve(this.profile);
  }
}

const STORED: AccountProfile = {
  email: 'ana@lina.md',
  givenName: 'Ana',
  familyName: 'Rusu',
  jobTitle: null,
  phone: null,
  locale: 'ro',
  emailLocale: 'ro',
  exportLocale: 'ro',
};

// Three different languages, so a save that wrote one into another's place cannot pass (task 52's close review).
const SAVE = {
  accountId: ACCOUNT,
  givenName: 'Ana',
  familyName: 'Rusu',
  locale: 'en',
  emailLocale: 'ru',
  exportLocale: 'ro',
} as const;

/** UC-13 and UC-14's save (task 52.3): the whole Record, judged before anything is written. */
describe('SaveAccountProfile (task 52.3)', () => {
  it('saves the three languages independently, trimmed parts and a phone in its one spelling', async () => {
    const store = new FakeProfileStore(STORED);
    const saved = await new SaveAccountProfile(store).execute({
      ...SAVE,
      givenName: '  Ana ',
      jobTitle: ' Financial controller ',
      phone: '+373 69 123 456',
    });

    expect(saved).toEqual({
      ...STORED,
      givenName: 'Ana',
      jobTitle: 'Financial controller',
      phone: '+37369123456',
      locale: 'en',
      emailLocale: 'ru',
      exportLocale: 'ro',
    });
  });

  it('clears a job title and a phone left empty', async () => {
    const store = new FakeProfileStore({ ...STORED, jobTitle: 'Controller', phone: '+37369123456' });
    const saved = await new SaveAccountProfile(store).execute({ ...SAVE, jobTitle: '  ', phone: '' });

    expect(saved).toMatchObject({ jobTitle: null, phone: null });
  });

  it.each([
    ['a given name that is only whitespace', { givenName: '   ' }],
    ['an empty family name', { familyName: '' }],
  ])('refuses %s, and writes nothing', async (_case, override) => {
    const store = new FakeProfileStore(STORED);
    await expect(new SaveAccountProfile(store).execute({ ...SAVE, ...override })).rejects.toBeInstanceOf(
      ProfileNamesRequiredError,
    );
    expect(store.saved).toEqual([]);
  });

  it('refuses a phone number not in international form, and writes nothing', async () => {
    const store = new FakeProfileStore(STORED);
    await expect(new SaveAccountProfile(store).execute({ ...SAVE, phone: '069 123 456' })).rejects.toBeInstanceOf(
      PhoneNumberMalformedError,
    );
    expect(store.saved).toEqual([]);
  });

  it('answers a session whose account is gone as unauthenticated', async () => {
    await expect(new SaveAccountProfile(new FakeProfileStore(null)).execute(SAVE)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });
});
