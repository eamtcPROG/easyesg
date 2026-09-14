import configuration from '@api/config/configuration';
import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { SOCIAL_CLIENT_SECRET_SETTING } from './provider.constants';

/**
 * A-18 names the setting that holds each client secret (task 67.11), and `configuration.ts` reads the secret
 * from a literal of its own. This holds the two to one spelling: rename either and the screen would send an
 * operator to set a variable the api never reads.
 */
describe('SOCIAL_CLIENT_SECRET_SETTING (task 67.11)', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it.each(Object.values(SOCIAL_PROVIDER))('names the variable the configuration reads %s’s secret from', (provider) => {
    for (const setting of Object.values(SOCIAL_CLIENT_SECRET_SETTING)) delete process.env[setting];
    process.env[SOCIAL_CLIENT_SECRET_SETTING[provider]] = `secret-for-${provider}`;

    const { social } = configuration().auth;

    expect(social[provider].clientSecret).toBe(`secret-for-${provider}`);
    for (const other of Object.values(SOCIAL_PROVIDER).filter((candidate) => candidate !== provider)) {
      expect(social[other].clientSecret).toBeUndefined();
    }
  });
});
