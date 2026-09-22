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

  it.each(LOCALES)('renders the verification template in %s', (locale: Locale) => {
    const { subject, body } = renderEmail(locale, NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params);

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
      const { body } = renderEmail(locale, wording, { ...params, organizationName: 'Brutăria' });

      expect(body).toContain(params.link);
    },
  );

  it('renders differently per locale, so nothing is falling back to one language', () => {
    const subjects = LOCALES.map(
      (locale: Locale) => renderEmail(locale, NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params).subject,
    );
    expect(new Set(subjects).size).toBe(LOCALES.length);
  });

  /**
   * An email with no subject is worse than no email — it reaches a person who has just signed up
   * and reads as a phishing attempt. Everywhere else a missing key omits the member; here it must
   * stop the send.
   */
  it('throws rather than sending an email with no subject', () => {
    expect(() => renderEmail('ro', 'identity.no_such_template', {})).toThrow(
      /no subject in the ro catalogue/,
    );
  });

  it('carries no internal identifier into what a person reads', () => {
    const { subject, body } = renderEmail('ro', NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params);
    // CLAUDE.md names these by shape: no FR-/UC-/NFR-/OQ- identifier, no enum member, no key.
    expect(`${subject}\n${body}`).not.toMatch(/\b(FR|UC|NFR|AD|DR|UX|OQ|BR)-\d+/);
    expect(`${subject}\n${body}`).not.toContain(NOTIFICATION_CATEGORY.EMAIL_VERIFICATION);
  });
});
