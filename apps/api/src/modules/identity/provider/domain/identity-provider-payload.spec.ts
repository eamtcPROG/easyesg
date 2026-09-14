import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { REQUESTED_SCOPES, readIdentityProviderPayload } from './identity-provider-payload';

const SEEDED = {
  enabled: false,
  clientId: '',
  issuer: 'https://accounts.google.com',
  scopes: ['openid', 'email', 'profile'],
  redirectUris: ['http://localhost:3100/auth/social/google/callback'],
};

describe('readIdentityProviderPayload (FR-82; tasks 24, 67.11)', () => {
  it('reads a whole payload as settings', () => {
    expect(readIdentityProviderPayload(SEEDED)).toEqual(SEEDED);
  });

  it('drops a field the shape does not name rather than carrying it', () => {
    expect(readIdentityProviderPayload({ ...SEEDED, clientSecret: 'must-not-travel' })).toEqual(SEEDED);
  });

  it.each([
    ['enabled as text', { ...SEEDED, enabled: 'true' }],
    ['no client id', { ...SEEDED, clientId: undefined }],
    ['an issuer that is not text', { ...SEEDED, issuer: 42 }],
    ['scopes that are not a list', { ...SEEDED, scopes: 'openid email' }],
    ['a redirect address that is not text', { ...SEEDED, redirectUris: ['https://app.easyesg.md', 7] }],
  ])('refuses %s', (_label, payload) => {
    expect(readIdentityProviderPayload(payload)).toBeNull();
  });

  it.each(Object.values(SOCIAL_PROVIDER))('reads the shipped %s seed, which requests FR-2’s three scopes', (provider) => {
    const seed = JSON.parse(
      readFileSync(resolve(process.cwd(), `../../config/seed/identity-provider.${provider}.json`), 'utf8'),
    ) as Record<string, unknown>;

    expect(readIdentityProviderPayload(seed)?.scopes).toEqual([...REQUESTED_SCOPES]);
  });
});
