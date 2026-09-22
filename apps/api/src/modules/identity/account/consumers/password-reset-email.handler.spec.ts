import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@easyesg/i18n';
import type { DeliverNoticeCommand, NotificationDeliveryPort } from '@api/contracts/notification-delivery.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { PasswordResetEmailHandler } from './password-reset-email.handler';

/**
 * The reset email's two wordings (task 155; §12.5.6's task-155 row (8)) — which one the worker
 * picks, and that both exist in every locale — and, since task 50.1.4, the notice it hands to the
 * notification module's delivery: the account as recipient, and the link's path with its token apart
 * from the one kept in the clear. `password-reset.e2e-spec.ts` drives this handler over real outbox
 * rows; this is the hermetic half, and the one that can present a row written before the flag existed.
 *
 * **The catalogue check is here because nothing else holds it.** `message-keys.spec.ts` covers the
 * keys a `DomainError` carries, and a template key is not one: a missing `notification.*` entry
 * fails only when the worker renders it, on a real send.
 */
describe('PasswordResetEmailHandler (tasks 155, 50.1.4)', () => {
  const CATALOGUES = join(__dirname, '../../../../../../../packages/i18n/catalogues');

  class RecordingDelivery implements NotificationDeliveryPort {
    readonly delivered: DeliverNoticeCommand[] = [];

    deliver(command: DeliverNoticeCommand): Promise<void> {
      this.delivered.push(command);
      return Promise.resolve();
    }
  }

  const context = { jobId: 'job-1' } as JobContext;
  const payload = {
    accountId: 'account-1',
    email: 'ana@example.md',
    locale: 'ro',
    token: 'token-1',
    occurredAtMicros: 1_790_726_400_000_000,
  };

  const deliver = async (extra: Record<string, unknown>): Promise<DeliverNoticeCommand> => {
    const port = new RecordingDelivery();
    await new PasswordResetEmailHandler(port).handle({ ...payload, ...extra }, context);
    return port.delivered[0];
  };

  it('hands the account over as the recipient, keyed by the issuance, for the tenant application', async () => {
    expect(await deliver({ holdsPassword: true })).toMatchObject({
      issuanceKey: 'job-1',
      occurredAtMicros: 1_790_726_400_000_000,
      categoryKey: 'identity.password_reset',
      recipient: { accountId: 'account-1' },
      application: 'web',
    });
  });

  // One category, two wordings: the reset's is the category's own key, so it names none.
  it('words the link as a reset for an account holding a password', async () => {
    expect((await deliver({ holdsPassword: true })).templateKey).toBeUndefined();
  });

  it('words it as setting a password for an account holding none, under the same category', async () => {
    const sent = await deliver({ holdsPassword: false });
    expect(sent.categoryKey).toBe('identity.password_reset');
    expect(sent.templateKey).toBe('identity.password_setup');
  });

  it('reads a row written before the flag existed as a reset — every such row was one', async () => {
    expect((await deliver({})).templateKey).toBeUndefined();
  });

  /**
   * The wire value `intent=setup` is asserted as a literal on purpose: S-02 reads the same string, and
   * a rename on either side must fail here or in the web tier's spec rather than silently reword a page.
   * Row (15): the token is in the path the email carries, and never in the one kept in the clear.
   */
  it('sends both to the same page and token, names the wording only for a first password, and keeps the token apart', async () => {
    const setup = await deliver({ holdsPassword: false });
    const reset = await deliver({ holdsPassword: true });
    const sent = (command: DeliverNoticeCommand) => new URL(command.linkPath, 'https://app.easyesg.md');

    expect(sent(setup).pathname).toBe(sent(reset).pathname);
    expect(sent(setup).searchParams.get('token')).toBe('token-1');
    expect(sent(reset).searchParams.get('token')).toBe('token-1');
    expect(sent(setup).searchParams.get('intent')).toBe('setup');
    expect(sent(reset).searchParams.has('intent')).toBe(false);
    expect(setup.deepLink).toBe('/set-password?intent=setup');
    expect(reset.deepLink).toBe('/set-password');
  });

  it('fails a row carrying no time rather than ordering it as now', async () => {
    await expect(
      new PasswordResetEmailHandler(new RecordingDelivery()).handle({ ...payload, occurredAtMicros: undefined }, context),
    ).rejects.toThrow('payload');
  });

  it.each([...LOCALES])('finds both wordings, each carrying the link, in the %s catalogue', (locale) => {
    const catalogue = JSON.parse(readFileSync(join(CATALOGUES, `${locale}.json`), 'utf8')) as {
      notification: { identity: Record<string, { subject?: string; body?: string } | undefined> };
    };
    for (const template of ['password_reset', 'password_setup']) {
      expect(catalogue.notification.identity[template]?.subject).toEqual(expect.any(String));
      expect(catalogue.notification.identity[template]?.body).toContain('{link}');
    }
  });
});
