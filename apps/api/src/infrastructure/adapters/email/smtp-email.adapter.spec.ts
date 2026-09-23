import { Logger } from '@nestjs/common';
import { EMAIL_FAILURE, EmailSendFailed, type EmailMessage } from '@api/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { initialiseCatalogue } from '@api/app/messages/catalogue';

const sendMail = jest.fn();
const createTransport = jest.fn((options: unknown) => ({ sendMail, options }));

jest.mock('nodemailer', () => ({ createTransport: (options: unknown) => createTransport(options) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SmtpEmailAdapter } = require('./smtp-email.adapter') as typeof import('./smtp-email.adapter');

/**
 * What this adapter owes the port, asserted against a stubbed transport.
 *
 * The transport is stubbed rather than a real SMTP server on purpose: what is worth pinning here is
 * the **boundary** — that rendering happens on this side, that a failure propagates, and that the
 * message the provider receives carries what §8.4 says it should. Whether nodemailer can speak SMTP
 * is nodemailer's test, and a local mail catcher would prove that rather than any of this.
 */
const SETTINGS = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'sender@example.md',
  password: 'app-password',
  from: 'easyESG <sender@example.md>',
};

const MESSAGE: EmailMessage = {
  to: 'recipient@example.md',
  locale: 'ro',
  templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
  params: { link: 'https://example.md/verify?token=abc' },
  idempotencyKey: 'outbox-row-1',
};

describe('SmtpEmailAdapter', () => {
  // The renderer reads the committed catalogues (OQ-43); without this a template key resolves to
  // nothing and every send throws for a reason that has nothing to do with this adapter.
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: '<provider-handle@smtp>' });
    createTransport.mockClear();
  });

  it('derives implicit TLS from the port rather than taking a third setting', () => {
    new SmtpEmailAdapter({ ...SETTINGS, port: 465 });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));

    createTransport.mockClear();
    new SmtpEmailAdapter({ ...SETTINGS, port: 587 });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false }));
  });

  /** The outbox dispatcher awaits each send while holding the row's lock, so an unbounded
   *  transport holds a database row open for as long as it hangs. */
  it('bounds every timeout rather than accepting the library defaults', () => {
    new SmtpEmailAdapter(SETTINGS);
    const options = createTransport.mock.calls[0][0] as Record<string, unknown>;
    for (const key of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
      expect(typeof options[key]).toBe('number');
    }
  });

  it('renders through the shared renderer and sends what it rendered', async () => {
    await new SmtpEmailAdapter(SETTINGS).send(MESSAGE);

    const [sent] = sendMail.mock.calls[0] as [Record<string, unknown>];
    expect(sent.to).toBe(MESSAGE.to);
    expect(sent.from).toBe(SETTINGS.from);
    // Rendered, not passed through: the caller supplies a catalogue key and the subject is prose.
    expect(sent.subject).toEqual(expect.any(String));
    expect(sent.subject).not.toBe(MESSAGE.templateKey);
    expect(String(sent.text)).toContain(String(MESSAGE.params.link));
  });

  /** §8.4: the key travels so a provider-side duplicate is traceable to the outbox row. */
  it('carries the idempotency key to the provider', async () => {
    await new SmtpEmailAdapter(SETTINGS).send(MESSAGE);
    const [sent] = sendMail.mock.calls[0] as [{ headers: Record<string, string> }];
    expect(sent.headers['X-Idempotency-Key']).toBe(MESSAGE.idempotencyKey);
  });

  /** RFC 8058 (task 52.2.2): both headers on a message carrying an unsubscribe, neither on one that does not. */
  it('sends the one-click unsubscribe headers with an unsubscribe, and none without', async () => {
    const oneClickUrl = 'https://app.easyesg.md/mail/unsubscribe/v1~abc~def';
    await new SmtpEmailAdapter(SETTINGS).send({
      ...MESSAGE,
      templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
      params: { ...MESSAGE.params, senderName: 'Ana', entityName: 'Lina', fiscalYear: '2026', noteGiven: 'none' },
      unsubscribe: { link: 'https://app.easyesg.md/ro/unsubscribe/v1~abc~def', oneClickUrl },
    });
    await new SmtpEmailAdapter(SETTINGS).send(MESSAGE);

    const [[optional], [mandatory]] = sendMail.mock.calls as [[{ headers: Record<string, string> }], [{ headers: Record<string, string> }]];
    expect(optional.headers['List-Unsubscribe']).toBe(`<${oneClickUrl}>`);
    expect(optional.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(Object.keys(mandatory.headers)).toEqual(['X-Idempotency-Key']);
  });

  it("returns the provider's handle, which is what bounce matching will join on", async () => {
    const result = await new SmtpEmailAdapter(SETTINGS).send(MESSAGE);
    expect(result.providerMessageId).toBe('<provider-handle@smtp>');
  });

  /**
   * The assertion that matters most. The consumer is a BullMQ job, so a throw is a retry and the
   * outbox row stays unacknowledged — swallowing this would turn an undelivered verification mail
   * into a silently successful one, and the account would wait forever for a link nobody sent.
   */
  it('propagates a send failure instead of reporting success', async () => {
    sendMail.mockRejectedValue(new Error('535 authentication failed'));
    await expect(new SmtpEmailAdapter(SETTINGS).send(MESSAGE)).rejects.toThrow(EmailSendFailed);
  });

  /**
   * Task 51.4's classification, and **this case is why it is not a reply-code check**.
   *
   * `535` is *authentication failed* — this platform's own credentials, not the recipient's mailbox.
   * Read as a hard bounce it would suppress every address the misconfigured transport wrote to, with
   * no `DELETE` grant to undo it. The two mistakes are not symmetric, so the evidence must name the
   * recipient before anything is suppressed.
   */
  it('calls an authentication failure TRANSIENT, whatever its 5xx code, so no address is suppressed', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('535 authentication failed'), { responseCode: 535 }));

    await expect(new SmtpEmailAdapter(SETTINGS).send(MESSAGE)).rejects.toMatchObject({
      failure: EMAIL_FAILURE.TRANSIENT,
      detail: '535 authentication failed',
    });
  });

  it('calls a rejected recipient with a 5xx reply a hard bounce', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('550 no such user'), {
        rejected: ['ana@example.md'],
        rejectedErrors: [{ responseCode: 550 }],
      }),
    );

    await expect(new SmtpEmailAdapter(SETTINGS).send(MESSAGE)).rejects.toMatchObject({
      failure: EMAIL_FAILURE.HARD_BOUNCE,
    });
  });

  // A 4xx rejection is *not now*: greylisting answers exactly this way, and suppressing on it would
  // make a routine delay permanent.
  it('calls a rejected recipient with a 4xx reply transient', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('450 try later'), {
        rejected: ['ana@example.md'],
        rejectedErrors: [{ responseCode: 450 }],
      }),
    );

    await expect(new SmtpEmailAdapter(SETTINGS).send(MESSAGE)).rejects.toMatchObject({
      failure: EMAIL_FAILURE.TRANSIENT,
    });
  });

  // `sendMail` RESOLVES when some recipient was accepted, so reading only the thrown case would
  // record a refusal as an acceptance.
  it('reads a rejected recipient on a RESOLVED send as a hard bounce', async () => {
    sendMail.mockResolvedValue({ messageId: 'm-1', rejected: ['ana@example.md'], response: '550 no such user' });

    await expect(new SmtpEmailAdapter(SETTINGS).send(MESSAGE)).rejects.toMatchObject({
      failure: EMAIL_FAILURE.HARD_BOUNCE,
      detail: '550 no such user',
    });
  });

  /** NFR-30: an operational log line carries no recipient address. */
  it('never writes the recipient address to the log', async () => {
    const written: string[] = [];
    const spy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((...args: unknown[]) => void written.push(String(args[0])));

    await new SmtpEmailAdapter(SETTINGS).send(MESSAGE);
    expect(written.join('\n')).not.toContain(MESSAGE.to);
    expect(written.join('\n')).toContain(MESSAGE.idempotencyKey);
    spy.mockRestore();
  });
});
