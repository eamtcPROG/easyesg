import { FakeIdentityProviderConfigurationStore, FakeProviderEnvironment } from '../testing/identity-provider.fakes';
import { ListIdentityProviders } from './list-identity-providers.use-case';

describe('ListIdentityProviders (UC-70; task 67.11)', () => {
  let store: FakeIdentityProviderConfigurationStore;
  let environment: FakeProviderEnvironment;
  let list: ListIdentityProviders;

  beforeEach(() => {
    store = new FakeIdentityProviderConfigurationStore();
    environment = new FakeProviderEnvironment();
    list = new ListIdentityProviders(store, environment);
  });

  it('answers both FR-2 providers in declaration order, configured or not', async () => {
    store.stored.set('microsoft', {
      provider: 'microsoft',
      settings: {
        enabled: false,
        clientId: '',
        issuer: 'https://login.microsoftonline.com/common/v2.0',
        scopes: ['openid', 'email', 'profile'],
        redirectUris: [],
      },
      revision: 1,
      changedByEmail: null,
      changedAt: null,
    });

    const providers = await list.execute();

    expect(providers.map((provider) => provider.provider)).toEqual(['google', 'microsoft']);
    expect(providers[0].revision).toBe(0);
    expect(providers[1].settings.issuer).toBe('https://login.microsoftonline.com/common/v2.0');
  });

  it('carries each secret’s location and who has linked each provider, zero where nobody has', async () => {
    environment.held.add('google');
    store.usageByProvider.set('google', { linkedAccounts: 7, accountsWithoutOtherCredential: 2 });

    const [google, microsoft] = await list.execute();

    expect(google.secret).toEqual({ held: true, setting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET' });
    expect(microsoft.secret).toEqual({ held: false, setting: 'AUTH_SOCIAL_MICROSOFT_CLIENT_SECRET' });
    expect(google.usage).toEqual({ linkedAccounts: 7, accountsWithoutOtherCredential: 2 });
    expect(microsoft.usage).toEqual({ linkedAccounts: 0, accountsWithoutOtherCredential: 0 });
  });
});
