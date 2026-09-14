import { describe, expect, it } from 'vitest';
import type { IdentityProvider } from '@easyesg/contracts';
import { configurationRequestOf, settingsFieldsOf } from './provider-settings';

const PROVIDER: IdentityProvider = {
  provider: 'google',
  enabled: false,
  clientId: 'easyesg-web',
  issuer: 'https://accounts.google.com',
  scopes: ['openid', 'email', 'profile'],
  redirectUris: ['https://app.easyesg.md/auth/social/google/callback', 'http://localhost:3100/auth/social/google/callback'],
  revision: 2,
  enablementBlocker: 'secret_missing',
  secretHeld: false,
  secretSetting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET',
  linkedAccounts: 0,
  accountsWithoutOtherCredential: 0,
  changedByEmail: null,
  changedAt: null,
};

describe('A-18’s form and the wire (task 67.11)', () => {
  it('shows the redirect addresses one per line', () => {
    expect(settingsFieldsOf(PROVIDER)).toEqual({
      clientId: 'easyesg-web',
      issuer: 'https://accounts.google.com',
      redirectUris:
        'https://app.easyesg.md/auth/social/google/callback\nhttp://localhost:3100/auth/social/google/callback',
    });
  });

  it('sends the lines as they are, either line ending, with the revision the record showed', () => {
    expect(
      configurationRequestOf({
        fields: { clientId: ' rotated ', issuer: 'https://accounts.google.com', redirectUris: 'https://a/x\r\n\nhttps://b/x' },
        revision: 2,
      }),
    ).toEqual({
      clientId: ' rotated ',
      issuer: 'https://accounts.google.com',
      redirectUris: ['https://a/x', '', 'https://b/x'],
      revision: 2,
    });
  });
});
