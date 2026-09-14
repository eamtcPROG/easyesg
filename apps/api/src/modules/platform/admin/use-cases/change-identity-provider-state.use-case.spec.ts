import {
  IdentityProviderChangedError,
  IdentityProviderIncompleteError,
  IdentityProviderStateUnchangedError,
} from '../errors/identity-providers.errors';
import { FakeIdentityProviderConfigurationStore, FakeProviderEnvironment } from '../testing/identity-provider.fakes';
import { ChangeIdentityProviderState } from './change-identity-provider-state.use-case';

const CALLBACK = 'https://app.easyesg.md/auth/social/google/callback';

describe('ChangeIdentityProviderState (UC-70, BR-ID-6; task 67.11)', () => {
  let store: FakeIdentityProviderConfigurationStore;
  let environment: FakeProviderEnvironment;
  let change: ChangeIdentityProviderState;

  const seed = (input: { enabled: boolean; clientId?: string; redirectUris?: string[] }) =>
    store.stored.set('google', {
      provider: 'google',
      settings: {
        enabled: input.enabled,
        clientId: input.clientId ?? 'easyesg-web',
        issuer: 'https://accounts.google.com',
        scopes: ['openid', 'email', 'profile'],
        redirectUris: input.redirectUris ?? [CALLBACK],
      },
      revision: 4,
      changedByEmail: null,
      changedAt: null,
    });

  beforeEach(() => {
    store = new FakeIdentityProviderConfigurationStore();
    environment = new FakeProviderEnvironment();
    change = new ChangeIdentityProviderState(store, environment);
  });

  it('enables a complete provider, carrying every other setting', async () => {
    seed({ enabled: false });
    environment.held.add('google');

    await expect(
      change.execute({ provider: 'google', enabled: true, revision: 4, operatorId: 'operator-1' }),
    ).resolves.toEqual({ id: 'version-google-5', provider: 'google', revision: 5 });
    expect(store.publications[0]).toEqual({
      provider: 'google',
      settings: {
        enabled: true,
        clientId: 'easyesg-web',
        issuer: 'https://accounts.google.com',
        scopes: ['openid', 'email', 'profile'],
        redirectUris: [CALLBACK],
      },
      expectedRevision: 4,
      operatorId: 'operator-1',
    });
  });

  it.each([
    ['no client id', { clientId: '' }, true, 'platform.admin.identity_provider_incomplete.client_id_missing'],
    ['no redirect address', { redirectUris: [] }, true, 'platform.admin.identity_provider_incomplete.redirect_missing'],
    ['no secret held', {}, false, 'platform.admin.identity_provider_incomplete.secret_missing'],
  ])('refuses to enable a provider with %s, publishing nothing', async (_label, settings, secretHeld, key) => {
    seed({ enabled: false, ...settings });
    if (secretHeld) environment.held.add('google');

    const refusal = change.execute({ provider: 'google', enabled: true, revision: 4, operatorId: 'operator-1' });

    await expect(refusal).rejects.toBeInstanceOf(IdentityProviderIncompleteError);
    await expect(refusal).rejects.toMatchObject({ messageKey: key });
    expect(store.publications).toEqual([]);
  });

  it('refuses to enable a provider nothing readable was ever published for', async () => {
    environment.held.add('google');

    await expect(
      change.execute({ provider: 'google', enabled: true, revision: 0, operatorId: 'operator-1' }),
    ).rejects.toMatchObject({ messageKey: 'platform.admin.identity_provider_incomplete.client_id_missing' });
  });

  it('disables a provider whatever it strands — nothing about its accounts or its secret refuses a withdrawal', async () => {
    seed({ enabled: true });
    store.usageByProvider.set('google', { linkedAccounts: 40, accountsWithoutOtherCredential: 40 });

    await change.execute({ provider: 'google', enabled: false, revision: 4, operatorId: 'operator-1' });

    expect(store.publications[0].settings.enabled).toBe(false);
  });

  it('refuses a change to the state the provider already has, either way', async () => {
    seed({ enabled: true });
    await expect(
      change.execute({ provider: 'google', enabled: true, revision: 4, operatorId: 'operator-1' }),
    ).rejects.toBeInstanceOf(IdentityProviderStateUnchangedError);

    await expect(
      change.execute({ provider: 'microsoft', enabled: false, revision: 0, operatorId: 'operator-1' }),
    ).rejects.toMatchObject({ messageKey: 'platform.admin.identity_provider_state_unchanged.disabled' });
  });

  it('refuses a revision no longer in force', async () => {
    seed({ enabled: true });

    await expect(
      change.execute({ provider: 'google', enabled: false, revision: 3, operatorId: 'operator-1' }),
    ).rejects.toBeInstanceOf(IdentityProviderChangedError);
  });
});
