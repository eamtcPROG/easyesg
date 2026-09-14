import { socialCallbackPath } from '@api/contracts/identity-provider.port';
import {
  enablementBlockerOf,
  issuerIsAdmissible,
  normalisedRedirectUris,
  redirectUriIsAdmissible,
  settingsAreUnchanged,
} from './identity-provider-rules';

const SETTINGS = {
  enabled: true,
  clientId: 'easyesg-web',
  issuer: 'https://accounts.google.com',
  scopes: ['openid', 'email', 'profile'],
  redirectUris: ['https://app.easyesg.md/auth/social/google/callback'],
};

describe('A-18’s configuration rules (task 67.11)', () => {
  describe('the issuer', () => {
    it('admits a bare https address', () => {
      expect(issuerIsAdmissible({ issuer: 'https://login.microsoftonline.com/common/v2.0', allowInsecure: false })).toBe(true);
    });

    it('admits http only where the environment admits insecure issuers', () => {
      expect(issuerIsAdmissible({ issuer: 'http://127.0.0.1:4000', allowInsecure: false })).toBe(false);
      expect(issuerIsAdmissible({ issuer: 'http://127.0.0.1:4000', allowInsecure: true })).toBe(true);
    });

    it.each([
      ['not an address', 'accounts.google.com'],
      ['a query', 'https://accounts.google.com?tenant=x'],
      ['a fragment', 'https://accounts.google.com#x'],
      ['credentials', 'https://user:secret@accounts.google.com'],
      ['another scheme', 'ftp://accounts.google.com'],
    ])('refuses %s', (_label, issuer) => {
      expect(issuerIsAdmissible({ issuer, allowInsecure: true })).toBe(false);
    });
  });

  describe('a redirect address', () => {
    it('admits the provider’s own callback path, and no other', () => {
      expect(socialCallbackPath('google')).toBe('/auth/social/google/callback');
      expect(
        redirectUriIsAdmissible({ provider: 'google', uri: 'https://app.easyesg.md/auth/social/google/callback', allowInsecure: false }),
      ).toBe(true);
      expect(
        redirectUriIsAdmissible({ provider: 'microsoft', uri: 'https://app.easyesg.md/auth/social/google/callback', allowInsecure: false }),
      ).toBe(false);
      expect(
        redirectUriIsAdmissible({ provider: 'google', uri: 'https://app.easyesg.md/auth/social/google/callback/', allowInsecure: false }),
      ).toBe(false);
    });

    it('refuses a query, and http outside an insecure environment', () => {
      expect(
        redirectUriIsAdmissible({ provider: 'google', uri: 'https://app.easyesg.md/auth/social/google/callback?x=1', allowInsecure: true }),
      ).toBe(false);
      expect(
        redirectUriIsAdmissible({ provider: 'google', uri: 'http://localhost:3100/auth/social/google/callback', allowInsecure: false }),
      ).toBe(false);
      expect(
        redirectUriIsAdmissible({ provider: 'google', uri: 'http://localhost:3100/auth/social/google/callback', allowInsecure: true }),
      ).toBe(true);
    });

    it('normalises a pasted list: trimmed, blanks dropped, each address once, order kept', () => {
      expect(normalisedRedirectUris([' https://b/x ', '', 'https://a/x', 'https://b/x', '   '])).toEqual([
        'https://b/x',
        'https://a/x',
      ]);
    });
  });

  describe('when a provider may be enabled', () => {
    it('answers the first unmet condition, in the order an operator meets them', () => {
      expect(enablementBlockerOf({ settings: null, secretHeld: true })).toBe('client_id_missing');
      expect(enablementBlockerOf({ settings: { clientId: '  ', redirectUris: [] }, secretHeld: false })).toBe(
        'client_id_missing',
      );
      expect(enablementBlockerOf({ settings: { clientId: 'x', redirectUris: [] }, secretHeld: false })).toBe(
        'redirect_missing',
      );
      expect(enablementBlockerOf({ settings: { clientId: 'x', redirectUris: ['https://a/x'] }, secretHeld: false })).toBe(
        'secret_missing',
      );
      expect(enablementBlockerOf({ settings: { clientId: 'x', redirectUris: ['https://a/x'] }, secretHeld: true })).toBeNull();
    });
  });

  describe('an unchanged configuration', () => {
    // Every field of the payload, walked from the fixture's own keys: a field the settings gain later must be
    // added to this typed fixture, and is then covered here without anyone remembering to add a case.
    it.each(Object.keys(SETTINGS) as (keyof typeof SETTINGS)[])('is changed by a different %s alone', (field) => {
      const original = SETTINGS[field];
      const changed = Array.isArray(original) ? [...original, 'x'] : typeof original === 'boolean' ? !original : `${original}-x`;

      expect(settingsAreUnchanged({ before: SETTINGS, after: { ...SETTINGS, [field]: changed } })).toBe(false);
    });

    it('is the same values, list order included', () => {
      expect(settingsAreUnchanged({ before: SETTINGS, after: { ...SETTINGS } })).toBe(true);
      expect(settingsAreUnchanged({ before: null, after: SETTINGS })).toBe(false);
      expect(settingsAreUnchanged({ before: SETTINGS, after: { ...SETTINGS, clientId: 'rotated' } })).toBe(false);
      expect(settingsAreUnchanged({ before: SETTINGS, after: { ...SETTINGS, enabled: false } })).toBe(false);
      expect(
        settingsAreUnchanged({
          before: { ...SETTINGS, redirectUris: ['https://a/x', 'https://b/x'] },
          after: { ...SETTINGS, redirectUris: ['https://b/x', 'https://a/x'] },
        }),
      ).toBe(false);
      expect(settingsAreUnchanged({ before: { ...SETTINGS, scopes: ['openid'] }, after: SETTINGS })).toBe(false);
    });
  });
});
