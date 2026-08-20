import { LOCALES, type Locale } from '@easyesg/i18n';
import { EMAIL_VERIFICATION_TEMPLATE } from '@api/modules/identity/account/constants/account.constants';
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

  const params = { verificationUrl: 'https://easyesg.md/ro/verify?token=abc' };

  it.each(LOCALES)('renders the verification template in %s', (locale: Locale) => {
    const { subject, body } = renderEmail(locale, EMAIL_VERIFICATION_TEMPLATE, params);

    expect(subject.trim()).not.toBe('');
    expect(body).toContain(params.verificationUrl);
  });

  it('renders differently per locale, so nothing is falling back to one language', () => {
    const subjects = LOCALES.map(
      (locale: Locale) => renderEmail(locale, EMAIL_VERIFICATION_TEMPLATE, params).subject,
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
    const { subject, body } = renderEmail('ro', EMAIL_VERIFICATION_TEMPLATE, params);
    // CLAUDE.md names these by shape: no FR-/UC-/NFR-/OQ- identifier, no enum member, no key.
    expect(`${subject}\n${body}`).not.toMatch(/\b(FR|UC|NFR|AD|DR|UX|OQ|BR)-\d+/);
    expect(`${subject}\n${body}`).not.toContain(EMAIL_VERIFICATION_TEMPLATE);
  });
});
