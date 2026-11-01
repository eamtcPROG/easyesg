import {
  IdentityProviderChangedError,
  IdentityProviderEnabledIncompleteError,
  IdentityProviderIssuerInvalidError,
  IdentityProviderRedirectInvalidError,
  IdentityProviderUnchangedError,
} from '../errors/identity-providers.errors';
import { FakeIdentityProviderConfigurationStore, FakeProviderEnvironment } from '../testing/identity-provider.fakes';
import { ConfigureIdentityProvider } from './configure-identity-provider.use-case';

const CALLBACK = 'https://app.easyesg.md/auth/social/google/callback';

describe('ConfigureIdentityProvider (UC-70; task 67.11)', () => {
  let store: FakeIdentityProviderConfigurationStore;
  let environment: FakeProviderEnvironment;
  let configure: ConfigureIdentityProvider;

  const seed = (input: { enabled: boolean; scopes?: string[] }) =>
    store.stored.set('google', {
      provider: 'google',
      settings: {
        enabled: input.enabled,
        clientId: 'easyesg-web',
        issuer: 'https://accounts.google.com',
        scopes: input.scopes ?? ['openid', 'email', 'profile'],
        redirectUris: [CALLBACK],
      },
      revision: 2,
      changedByEmail: null,
      changedAt: null,
    });

  const command = {
    provider: 'google' as const,
    clientId: ' rotated-client ',
    issuer: 'https://accounts.google.com',
    redirectUris: [` ${CALLBACK} `, '', CALLBACK],
    revision: 2,
    operatorId: 'operator-1',
  };

  beforeEach(() => {
    store = new FakeIdentityProviderConfigurationStore();
    environment = new FakeProviderEnvironment();
    configure = new ConfigureIdentityProvider(store, environment);
  });

  it('publishes the edited fields normalised, keeps the enabled state, and writes FR-2’s three scopes', async () => {
    seed({ enabled: true, scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive'] });

    const publication = await configure.execute(command);

    expect(publication).toEqual({ id: 'version-google-3', provider: 'google', revision: 3 });
    expect(store.publications).toEqual([
      {
        provider: 'google',
        settings: {
          enabled: true,
          clientId: 'rotated-client',
          issuer: 'https://accounts.google.com',
          scopes: ['openid', 'email', 'profile'],
          redirectUris: [CALLBACK],
        },
        expectedRevision: 2,
        operatorId: 'operator-1',
      },
    ]);
  });

  it('registers a provider nothing was published for, disabled', async () => {
    await configure.execute({ ...command, revision: 0 });

    expect(store.publications[0].settings.enabled).toBe(false);
  });

  it('refuses a revision no longer in force, and publishes nothing', async () => {
    seed({ enabled: false });

    await expect(configure.execute({ ...command, revision: 1 })).rejects.toBeInstanceOf(IdentityProviderChangedError);
    expect(store.publications).toEqual([]);
  });

  it('refuses an issuer discovery could not run against, http included outside an insecure environment', async () => {
    seed({ enabled: false });

    await expect(configure.execute({ ...command, issuer: 'http://127.0.0.1:4000' })).rejects.toBeInstanceOf(
      IdentityProviderIssuerInvalidError,
    );
    environment.insecure = true;
    await expect(configure.execute({ ...command, issuer: 'http://127.0.0.1:4000' })).resolves.toMatchObject({
      revision: 3,
    });
  });

  it('refuses a redirect address off the provider’s callback path, naming the path', async () => {
    seed({ enabled: false });

    const refusal = configure.execute({ ...command, redirectUris: ['https://app.easyesg.md/auth/social/microsoft/callback'] });

    await expect(refusal).rejects.toBeInstanceOf(IdentityProviderRedirectInvalidError);
    await expect(refusal).rejects.toMatchObject({ params: { path: '/auth/social/google/callback' } });
    expect(store.publications).toEqual([]);
  });

  it('refuses a save that would leave an enabled provider unable to sign anyone in', async () => {
    seed({ enabled: true });

    await expect(configure.execute({ ...command, clientId: '  ' })).rejects.toBeInstanceOf(
      IdentityProviderEnabledIncompleteError,
    );
    await expect(configure.execute({ ...command, redirectUris: [] })).rejects.toBeInstanceOf(
      IdentityProviderEnabledIncompleteError,
    );
  });

  it('lets a disabled provider be emptied, which is how an operator clears a registration', async () => {
    seed({ enabled: false });

    await configure.execute({ ...command, clientId: '', redirectUris: [] });

    expect(store.publications[0].settings).toMatchObject({ clientId: '', redirectUris: [] });
  });

  it('refuses a save identical to what is in force, rather than recording a change that did not happen', async () => {
    seed({ enabled: false });

    await expect(configure.execute({ ...command, clientId: 'easyesg-web' })).rejects.toBeInstanceOf(
      IdentityProviderUnchangedError,
    );
  });
});
