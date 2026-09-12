import { createEmailAdapter } from './email.module';

/**
 * The boot-time half of NFR-27's guard.
 *
 * `permitted-hosts.spec.ts` proves the list refuses. This proves the **factory consults it** — two
 * different claims, and the gap between them is exactly where a guard ships inert. Task 51.1's row
 * says a config-driven provider is as easy to point somewhere non-compliant as somewhere compliant;
 * what makes that survivable is that an unpermitted host stops the process rather than the first
 * send, and that is what these assert.
 */
const SMTP = { host: 'smtp.gmail.com', port: 587, user: 'u', password: 'p', from: 'f' };

describe('the EmailPort adapter factory (NFR-27, OQ-17)', () => {
  it('refuses a host that is not a permitted provider', () => {
    expect(() => createEmailAdapter('smtp', { ...SMTP, host: 'smtp.sendgrid.net' })).toThrow(
      /not a permitted mail provider/,
    );
  });

  it('refuses an unset host rather than defaulting to one', () => {
    expect(() => createEmailAdapter('smtp', { ...SMTP, host: undefined })).toThrow(
      /EMAIL_HOST is not set/,
    );
  });

  it('names the missing credential rather than failing at the first send', () => {
    expect(() => createEmailAdapter('smtp', { ...SMTP, password: undefined })).toThrow(
      /EMAIL_PASSWORD/,
    );
  });

  it('builds the adapter on a permitted host', () => {
    expect(createEmailAdapter('smtp', SMTP)).toBeDefined();
  });

  it("still refuses an unset provider, which is task 19's rule unchanged", () => {
    expect(() => createEmailAdapter(undefined, SMTP)).toThrow(/not set/);
  });

  it('still serves the logging adapter, so the development path is untouched', () => {
    expect(createEmailAdapter('log', SMTP)).toBeDefined();
  });
});
