import { NO_IDENTITY_PROVIDER_USAGE, identityProviderConfigurationOf } from './identity-provider-configuration';

const SECRET_HELD = { held: true, setting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET' };
const SECRET_MISSING = { held: false, setting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET' };

describe('identityProviderConfigurationOf (task 67.11)', () => {
  it('shows a provider with nothing readable in force as unconfigured, and registrable', () => {
    for (const stored of [
      null,
      { provider: 'google' as const, settings: null, revision: 3, changedByEmail: null, changedAt: null },
    ]) {
      const configuration = identityProviderConfigurationOf({
        provider: 'google',
        stored,
        secret: SECRET_HELD,
        usage: NO_IDENTITY_PROVIDER_USAGE,
      });

      expect(configuration.settings).toEqual({
        enabled: false,
        clientId: '',
        issuer: '',
        scopes: ['openid', 'email', 'profile'],
        redirectUris: [],
      });
      expect(configuration.enablementBlocker).toBe('client_id_missing');
    }
  });

  it('keeps the revision and the attribution of what is in force', () => {
    const changedAt = new Date('2026-09-14T09:00:00Z');
    const configuration = identityProviderConfigurationOf({
      provider: 'google',
      stored: {
        provider: 'google',
        settings: {
          enabled: false,
          clientId: 'easyesg-web',
          issuer: 'https://accounts.google.com',
          scopes: ['openid', 'email', 'profile'],
          redirectUris: ['https://app.easyesg.md/auth/social/google/callback'],
        },
        revision: 4,
        changedByEmail: 'ana@easyesg.md',
        changedAt,
      },
      secret: SECRET_HELD,
      usage: { linkedAccounts: 12, accountsWithoutOtherCredential: 3 },
    });

    expect(configuration).toMatchObject({
      revision: 4,
      enablementBlocker: null,
      changedByEmail: 'ana@easyesg.md',
      changedAt,
      usage: { linkedAccounts: 12, accountsWithoutOtherCredential: 3 },
      secret: SECRET_HELD,
    });
  });

  it('names what blocks an ENABLED provider too — a secret gone from the environment', () => {
    const configuration = identityProviderConfigurationOf({
      provider: 'google',
      stored: {
        provider: 'google',
        settings: {
          enabled: true,
          clientId: 'easyesg-web',
          issuer: 'https://accounts.google.com',
          scopes: ['openid', 'email', 'profile'],
          redirectUris: ['https://app.easyesg.md/auth/social/google/callback'],
        },
        revision: 5,
        changedByEmail: null,
        changedAt: null,
      },
      secret: SECRET_MISSING,
      usage: NO_IDENTITY_PROVIDER_USAGE,
    });

    expect(configuration.settings.enabled).toBe(true);
    expect(configuration.enablementBlocker).toBe('secret_missing');
  });
});
