import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { ConfigProviderEnvironment } from './config-provider-environment.adapter';

/**
 * The adapter that decides what A-18 says about a secret (task 67.11). Every other suite runs against a fake or an
 * environment holding both secrets, so this is the one place a secret's *absence* is read the way production reads
 * it — and the one place `allowsInsecureIssuers` cannot quietly answer true.
 */
const environmentOf = (social: AppConfig['auth']['social']): ConfigProviderEnvironment => {
  const values: Record<string, unknown> = { 'auth.social': social, 'auth.social.allowInsecureIssuers': social.allowInsecureIssuers };
  return new ConfigProviderEnvironment({ get: (key: string) => values[key] } as unknown as ConfigService<AppConfig, true>);
};

describe('ConfigProviderEnvironment (task 67.11)', () => {
  it('holds a secret that is set, and names the setting either way — never the value', () => {
    const environment = environmentOf({
      allowInsecureIssuers: false,
      google: { clientSecret: 'a-real-secret' },
      microsoft: { clientSecret: undefined },
    });

    expect(environment.secretOf('google')).toEqual({ held: true, setting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET' });
    expect(environment.secretOf('microsoft')).toEqual({ held: false, setting: 'AUTH_SOCIAL_MICROSOFT_CLIENT_SECRET' });
  });

  it('reads an empty secret as none, as the sign-in catalog does', () => {
    const environment = environmentOf({
      allowInsecureIssuers: false,
      google: { clientSecret: '' },
      microsoft: { clientSecret: '' },
    });

    expect(environment.secretOf('google').held).toBe(false);
  });

  it('admits insecure issuers only where the environment says so', () => {
    const secrets = { google: { clientSecret: undefined }, microsoft: { clientSecret: undefined } };

    expect(environmentOf({ allowInsecureIssuers: false, ...secrets }).allowsInsecureIssuers()).toBe(false);
    expect(environmentOf({ allowInsecureIssuers: true, ...secrets }).allowsInsecureIssuers()).toBe(true);
  });
});
