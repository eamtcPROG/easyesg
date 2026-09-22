import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { EmailDispatched, EmailMessage, EmailPort } from '../src/contracts/email.port';
import { AesGcmSecretCipher } from '../src/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import type { JobHandler } from '../src/infrastructure/queue/job-handler';
import { EMAIL_VERIFICATION_REQUESTED } from '../src/modules/identity/account/constants/account.constants';
import { VerificationEmailHandler } from '../src/modules/identity/account/consumers/verification-email.handler';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import { InvitationEmailHandler } from '../src/modules/identity/invitation/consumers/invitation-email.handler';
import { ADMIN_INVITATION_ISSUED } from '../src/modules/platform/admin/constants/admin-invitation.constants';
import { AdminInvitationEmailHandler } from '../src/modules/platform/admin/consumers/admin-invitation-email.handler';
import { noticeIdFor } from '../src/modules/platform/notification/domain/notice-id';
import { PLATFORM_ORGANIZATION_ID } from '../src/modules/platform/notification/models/notification-record.model';
import { asOrganization, connectAs, required } from './support/database';
import { deleteNoticesAbout, linkNoticeDelivery } from './support/notification-store';

/**
 * **The four notices sent to an address, on the record** — task 50.1.4's expected result: every notice the platform
 * sends carries a record and delivery evidence, and no second path remains (§12.5.6's task-50.1 rows (14) … (17)).
 *
 * Each handler is driven with the job its outbox row would become, through the real delivery — store, account
 * lookup, email channel — with only the provider recorded. The claims only the database can hold: **a platform
 * notice lives under the reserved id**, which no organization can take; **the link it sent is kept sealed**, the
 * raw token in no clear column; **a recipient without an account is named by address**; and **a job run twice
 * sends once**. `registration.e2e-spec.ts` and `password-reset.e2e-spec.ts` drive two of these handlers from the
 * outbox rows their producers really write.
 */
const SUITE = 'task50-1-4';
const ORG = randomUUID();
const WEB = 'https://app.easyesg.md';
const CONSOLE = 'https://admin.easyesg.md';

class RecordingEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<EmailDispatched> {
    this.sent.push(message);
    return Promise.resolve({});
  }
}

interface NoticeRow {
  id: string;
  organization_id: string;
  subject_ref: string;
  deep_link: string;
  sealed_link: string | null;
  state: string;
  clear: string;
}

interface DeliveryRow {
  recipient_account_id: string | null;
  recipient_address: string | null;
  channel: string;
  outcome: string;
}

describe('the four address notices, recorded (task 50.1.4)', () => {
  let owner: DataSource;
  let worker: DataSource;
  let ana: string;
  const keys: string[] = [];
  const cipher = () => new AesGcmSecretCipher(required('SECRET_ENCRYPTION_KEY'));

  beforeAll(async () => {
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', `easyesg-${SUITE}-owner`);
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', `easyesg-${SUITE}-worker`);
    const [row] = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.account (email, locale) VALUES ($1, 'ru') RETURNING id`,
      [`${SUITE}-ana@example.md`],
    );
    ana = row.id;
  }, 30_000);

  afterAll(async () => {
    if (owner) {
      await deleteNoticesAbout(owner, keys);
      await owner.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${SUITE}-%@example.md`]);
    }
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  /** One issuance handed to a handler, as the dispatcher would hand it; answers what the provider was given. */
  const handle = async (input: {
    readonly build: (delivery: ReturnType<typeof linkNoticeDelivery>) => JobHandler;
    readonly jobName: string;
    readonly key: string;
    readonly payload: Record<string, unknown>;
    readonly provider?: RecordingEmailPort;
  }): Promise<EmailMessage[]> => {
    const provider = input.provider ?? new RecordingEmailPort();
    const handler = input.build(linkNoticeDelivery({ worker, provider, webOrigin: WEB, consoleOrigin: CONSOLE }));
    if (!keys.includes(input.key)) keys.push(input.key);
    await handler.handle(
      { ...input.payload, occurredAtMicros: Date.now() * 1000 },
      { jobId: input.key, jobName: input.jobName, attempt: 1 },
    );
    return provider.sent;
  };

  const noticeFor = async (key: string, organizationId: string): Promise<NoticeRow | undefined> =>
    (
      (await asOrganization(worker, organizationId, (run) =>
        run(
          `SELECT id, organization_id, subject_ref, deep_link, sealed_link, state,
                  (to_jsonb(n) - 'sealed_link')::text AS clear
             FROM notification.notification n WHERE subject_ref = $1`,
          [key],
        ),
      )) as NoticeRow[]
    )[0];

  const deliveriesOf = async (notificationId: string, organizationId: string): Promise<DeliveryRow[]> =>
    (await asOrganization(worker, organizationId, (run) =>
      run(
        `SELECT recipient_account_id, recipient_address, channel, outcome
           FROM notification.delivery WHERE notification_id = $1`,
        [notificationId],
      ),
    )) as DeliveryRow[];

  it('records an account’s verification as a platform notice, its link sealed and the account its recipient', async () => {
    const key = `${EMAIL_VERIFICATION_REQUESTED}:${ana}:${Date.now()}`;
    const [message] = await handle({
      build: (delivery) => new VerificationEmailHandler(delivery),
      jobName: EMAIL_VERIFICATION_REQUESTED,
      key,
      payload: { accountId: ana, email: `${SUITE}-ana@example.md`, locale: 'ru', token: 'verify-token-1', organizationId: null },
    });

    // Sent in the account's own language, resolved at send time.
    expect(message.params.link).toBe(`${WEB}/ru/verify?token=verify-token-1`);
    const notice = await noticeFor(key, PLATFORM_ORGANIZATION_ID);
    expect(notice).toMatchObject({
      id: noticeIdFor(key),
      organization_id: PLATFORM_ORGANIZATION_ID,
      deep_link: '/verify',
      state: 'delivered',
    });
    // Row (15): the link it sent, sealed — and the token in no column kept in the clear.
    expect(notice?.sealed_link).toMatch(/^v\d+\./);
    expect(cipher().open(notice?.sealed_link ?? '')).toBe(message.params.link);
    expect(notice?.clear).not.toContain('verify-token-1');
    expect(await deliveriesOf(noticeIdFor(key), PLATFORM_ORGANIZATION_ID)).toEqual([
      { recipient_account_id: ana, recipient_address: null, channel: 'email', outcome: 'accepted' },
    ]);
  });

  it("records an organization's invitation in that organization, the invitee named by address", async () => {
    const key = `${INVITATION_ISSUED}:${randomUUID()}:${Date.now()}`;
    const [message] = await handle({
      build: (delivery) => new InvitationEmailHandler(delivery),
      jobName: INVITATION_ISSUED,
      key,
      payload: {
        invitationId: randomUUID(),
        organizationName: 'Brutăria',
        email: `${SUITE}-invitee@example.md`,
        locale: 'ro',
        token: 'invite-token-1',
        organizationId: ORG,
      },
    });

    expect(message).toMatchObject({ to: `${SUITE}-invitee@example.md`, locale: 'ro' });
    expect(message.params).toEqual({ organizationName: 'Brutăria', link: `${WEB}/ro/invitation/invite-token-1` });
    const notice = await noticeFor(key, ORG);
    expect(notice).toMatchObject({ organization_id: ORG, deep_link: '/invitation' });
    expect(notice?.clear).not.toContain('invite-token-1');
    expect(await deliveriesOf(noticeIdFor(key), ORG)).toEqual([
      {
        recipient_account_id: null,
        recipient_address: `${SUITE}-invitee@example.md`,
        channel: 'email',
        outcome: 'accepted',
      },
    ]);
  });

  it("records an operator's invitation as a platform notice, linked to the console", async () => {
    const key = `${ADMIN_INVITATION_ISSUED}:${randomUUID()}:${Date.now()}`;
    const [message] = await handle({
      build: (delivery) => new AdminInvitationEmailHandler(delivery),
      jobName: ADMIN_INVITATION_ISSUED,
      key,
      payload: { invitationId: randomUUID(), email: `${SUITE}-operator@example.md`, token: 'admin-token-1' },
    });

    expect(message.params.link).toBe(`${CONSOLE}/invitation/admin-token-1`);
    expect(await noticeFor(key, PLATFORM_ORGANIZATION_ID)).toMatchObject({ deep_link: '/invitation' });
    expect(await deliveriesOf(noticeIdFor(key), PLATFORM_ORGANIZATION_ID)).toEqual([
      {
        recipient_account_id: null,
        recipient_address: `${SUITE}-operator@example.md`,
        channel: 'email',
        outcome: 'accepted',
      },
    ]);
  });

  it('sends once when the same issuance runs twice, and a resend is a notice of its own', async () => {
    const provider = new RecordingEmailPort();
    const payload = {
      invitationId: randomUUID(),
      email: `${SUITE}-again@example.md`,
      token: 'admin-token-2',
    };
    const first = `${ADMIN_INVITATION_ISSUED}:${payload.invitationId}:1`;
    const build = (delivery: ReturnType<typeof linkNoticeDelivery>) => new AdminInvitationEmailHandler(delivery);

    await handle({ build, jobName: ADMIN_INVITATION_ISSUED, key: first, payload, provider });
    await handle({ build, jobName: ADMIN_INVITATION_ISSUED, key: first, payload, provider });
    expect(provider.sent).toHaveLength(1);

    const resend = `${ADMIN_INVITATION_ISSUED}:${payload.invitationId}:2`;
    await handle({ build, jobName: ADMIN_INVITATION_ISSUED, key: resend, payload: { ...payload, token: 'admin-token-3' }, provider });
    expect(provider.sent.map((message) => message.params.link)).toEqual([
      `${CONSOLE}/invitation/admin-token-2`,
      `${CONSOLE}/invitation/admin-token-3`,
    ]);
    expect((await noticeFor(resend, PLATFORM_ORGANIZATION_ID))?.id).toBe(noticeIdFor(resend));
  });

  /**
   * OQ-54's containment for the second copy: the request tier is refused the sealed link by grant, even for a notice
   * its policies show it — here the verification notice, which Ana received by email.
   */
  it('refuses the request tier the sealed link, by grant, while showing it the notice', async () => {
    const app = await connectAs('DB_USER', 'DB_PASSWORD', `easyesg-${SUITE}-app`);
    try {
      const asAna = async (sql: string) => {
        const runner = app.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
          await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', PLATFORM_ORGANIZATION_ID]);
          await runner.query('SELECT set_config($1, $2, true)', ['app.current_user', ana]);
          return (await runner.query(sql)) as unknown[];
        } finally {
          await runner.rollbackTransaction();
          await runner.release();
        }
      };

      expect((await asAna(`SELECT id FROM notification.notification`)).length).toBeGreaterThan(0);
      await expect(asAna(`SELECT sealed_link FROM notification.notification`)).rejects.toThrow('permission denied');
    } finally {
      await app.destroy();
    }
  });

  // Row (17): no organization can take the reserved id, so no membership names it and the tenant tier can never
  // bind it — a platform notice is the worker's, and the read-only console role's.
  it('refuses the reserved id to any organization', async () => {
    await expect(
      asOrganization(owner, PLATFORM_ORGANIZATION_ID, (run) =>
        run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Platform', 'MD')`, [
          PLATFORM_ORGANIZATION_ID,
        ]),
      ),
    ).rejects.toThrow('organization_id_not_platform');
  });
});
