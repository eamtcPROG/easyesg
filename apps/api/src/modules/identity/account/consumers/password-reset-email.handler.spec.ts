import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { LOCALES } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { PasswordResetEmailHandler } from './password-reset-email.handler';

/**
 * The reset email's two wordings (task 155; §12.5.6's task-155 row (8)) — which one the worker
 * picks, and that both exist in every locale. `password-reset.e2e-spec.ts` drives this handler over
 * real outbox rows; this is the hermetic half, and the one that can present a row written before the
 * flag existed.
 *
 * **The catalogue check is here because nothing else holds it.** `message-keys.spec.ts` covers the
 * keys a `DomainError` carries, and a template key is not one: a missing `notification.*` entry
 * fails only when the worker renders it, on a real send.
 */
describe('PasswordResetEmailHandler — the wording it picks (task 155)', () => {
  const CATALOGUES = join(__dirname, '../../../../../../../packages/i18n/catalogues');

  // The notification module's port since task 49.2 — the handler names the category, and a wording only where
  // the category has a second one.
  class RecordingEmailPort implements NotificationEmailPort {
    readonly sent: NotificationEmail[] = [];

    send(email: NotificationEmail): Promise<void> {
      this.sent.push(email);
      return Promise.resolve();
    }
  }

  const config = { get: () => 'https://app.easyesg.md' } as unknown as ConfigService<AppConfig, true>;
  const context = { jobId: 'job-1' } as JobContext;
  const payload = { accountId: 'account-1', email: 'ana@example.md', locale: 'ro', token: 'token-1' };

  const deliver = async (extra: Record<string, unknown>): Promise<NotificationEmail> => {
    const port = new RecordingEmailPort();
    await new PasswordResetEmailHandler(port, config).handle({ ...payload, ...extra }, context);
    return port.sent[0];
  };

  // One category, two wordings: the reset's is the category's own key, so it names none.
  it('words the link as a reset for an account holding a password', async () => {
    const sent = await deliver({ holdsPassword: true });
    expect(sent.categoryKey).toBe('identity.password_reset');
    expect(sent.templateKey).toBeUndefined();
  });

  it('words it as setting a password for an account holding none, under the same category', async () => {
    const sent = await deliver({ holdsPassword: false });
    expect(sent.categoryKey).toBe('identity.password_reset');
    expect(sent.templateKey).toBe('identity.password_setup');
  });

  it('reads a row written before the flag existed as a reset — every such row was one', async () => {
    const sent = await deliver({});
    expect(sent.categoryKey).toBe('identity.password_reset');
    expect(sent.templateKey).toBeUndefined();
  });

  /**
   * The wire value `intent=setup` is asserted as a literal on purpose: S-02 reads the same string, and
   * a rename on either side must fail here or in the web tier's spec rather than silently reword a page.
   */
  it('sends both to the same page and token, and names the wording only for a first password', async () => {
    const setup = new URL(String((await deliver({ holdsPassword: false })).params.resetUrl));
    const reset = new URL(String((await deliver({ holdsPassword: true })).params.resetUrl));

    expect(setup.pathname).toBe(reset.pathname);
    expect(setup.searchParams.get('token')).toBe('token-1');
    expect(reset.searchParams.get('token')).toBe('token-1');
    expect(setup.searchParams.get('intent')).toBe('setup');
    expect(reset.searchParams.has('intent')).toBe(false);
  });

  it.each([...LOCALES])('finds both wordings, each carrying the link, in the %s catalogue', (locale) => {
    const catalogue = JSON.parse(readFileSync(join(CATALOGUES, `${locale}.json`), 'utf8')) as {
      notification: { identity: Record<string, { subject?: string; body?: string } | undefined> };
    };
    for (const template of ['password_reset', 'password_setup']) {
      expect(catalogue.notification.identity[template]?.subject).toEqual(expect.any(String));
      expect(catalogue.notification.identity[template]?.body).toContain('{resetUrl}');
    }
  });
});
