import { LOCALES, type Locale } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { renderEmail } from './email-template.renderer';

/**
 * The catalogue's parity suite in `packages/i18n` proves the three files share a key space. It
 * cannot prove that a key an adapter *asks for* exists at all — a template key is a string
 * composed at runtime, so a typo in it produces a subject-less email rather than a build failure.
 * This is the check that binds the two ends together.
 */
describe('email template rendering (OQ-43)', () => {
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  const params = { link: 'https://easyesg.md/ro/verify?token=abc' };
  /** The manual reminder's own parameters (task 50.3), which its wording needs to render at all. */
  const REMINDER = {
    senderName: 'Ana Rusu',
    entityName: 'Brutăria Lina',
    fiscalYear: '2026',
    noteGiven: 'none',
    note: '',
  };

  it.each(LOCALES)('renders the verification template in %s', (locale: Locale) => {
    const { subject, body } = renderEmail({ locale, templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params });

    expect(subject.trim()).not.toBe('');
    expect(body).toContain(params.link);
  });

  /**
   * **Every template a notice sends is written against `{link}`** (§12.5.6's task-49.3 row (8), task 50.1.4): the
   * delivery hands each message the link as `link` and nothing else, so a template still naming its own placeholder
   * renders no link at all — the email arrives and cannot be acted on. Each wording, in each language.
   */
  const WORDINGS = [...Object.values(NOTIFICATION_CATEGORY), 'identity.password_setup'];
  it.each(LOCALES.flatMap((locale: Locale) => WORDINGS.map((wording) => [locale, wording] as const)))(
    'puts the link into %s %s',
    (locale, wording) => {
      const { body } = renderEmail({
        locale,
        templateKey: wording,
        params: { ...params, organizationName: 'Brutăria', ...REMINDER },
      });

      expect(body).toContain(params.link);
    },
  );

  /**
   * The manual reminder's email (task 50.3; §12.5.6's task-50.3 row (2)), sent since task 52.2.2 — and exercised here
   * word by word. **The note's two sentences are an ICU `select`**, and the
   * no-note one is asserted positively: a body that lost its `other` branch renders an empty pair of quotation
   * marks, which "does not contain the note" cannot see. Its in-app twin is
   * `modules/core/disclosure/models/report-reminder.wording.spec.ts`, which may not import this renderer.
   */
  const QUOTES = /[„“«»”]/;
  const NOTE = 'Mai lipsesc datele despre energie.';

  it.each(LOCALES)('writes the reminder in %s against the link, with the note only when one was given', (locale) => {
    const given = renderEmail({
      locale,
      templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
      params: { ...params, ...REMINDER, noteGiven: 'given', note: NOTE },
    });
    const none = renderEmail({
      locale,
      templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
      params: { ...params, ...REMINDER },
    });

    expect(given.subject).toContain(REMINDER.senderName);
    expect(given.body).toContain(params.link);
    expect(given.body).toContain(NOTE);
    expect(given.body).toMatch(QUOTES);
    expect(none.body).toContain(params.link);
    expect(none.body).not.toMatch(QUOTES);
  });

  /**
   * FR-169's footer (task 52.2.2): an email carrying an unsubscribe ends with it, in the recipient's language, naming
   * S-38's link — and one that carries none has no footer at all, since a mandatory notice has nothing to unsubscribe
   * from and saying otherwise would be untrue.
   */
  const UNSUBSCRIBE = {
    link: 'https://app.easyesg.md/ro/unsubscribe/v1~abc~def',
    oneClickUrl: 'https://app.easyesg.md/mail/unsubscribe/v1~abc~def',
  };

  it.each(LOCALES)('appends the unsubscribe footer in %s, and only when the message carries one', (locale) => {
    const reminder = { locale, templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, params: { ...params, ...REMINDER } };
    const withFooter = renderEmail({ ...reminder, unsubscribe: UNSUBSCRIBE });
    const without = renderEmail(reminder);

    expect(withFooter.body.startsWith(without.body)).toBe(true);
    expect(withFooter.body).toContain(UNSUBSCRIBE.link);
    expect(withFooter.body).not.toContain(UNSUBSCRIBE.oneClickUrl);
    expect(without.body).not.toContain('unsubscribe');
  });

  it('renders differently per locale, so nothing is falling back to one language', () => {
    const subjects = LOCALES.map(
      (locale: Locale) =>
        renderEmail({ locale, templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params }).subject,
    );
    expect(new Set(subjects).size).toBe(LOCALES.length);
  });

  /**
   * An email with no subject is worse than no email — it reaches a person who has just signed up
   * and reads as a phishing attempt. Everywhere else a missing key omits the member; here it must
   * stop the send.
   */
  it('throws rather than sending an email with no subject', () => {
    expect(() => renderEmail({ locale: 'ro', templateKey: 'identity.no_such_template', params: {} })).toThrow(
      /no subject in the ro catalogue/,
    );
  });

  it('carries no internal identifier into what a person reads', () => {
    const { subject, body } = renderEmail({
      locale: 'ro',
      templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
      params,
    });
    // CLAUDE.md names these by shape: no FR-/UC-/NFR-/OQ- identifier, no enum member, no key.
    expect(`${subject}\n${body}`).not.toMatch(/\b(FR|UC|NFR|AD|DR|UX|OQ|BR)-\d+/);
    expect(`${subject}\n${body}`).not.toContain(NOTIFICATION_CATEGORY.EMAIL_VERIFICATION);
  });
});
