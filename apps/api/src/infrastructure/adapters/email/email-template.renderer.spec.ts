import { LOCALES, type Locale } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { EMAIL_MARK } from './email-mark';
import { EMAIL_PALETTE } from './email-palette';
import { EMAIL_REQUIRED_PARTS, readEmailParts } from './email-parts';
import { renderEmail, renderEmailText } from './email-template.renderer';

/** The HTML part's text, its markup dropped and the five entities React writes undone — what a reader sees. */
const visible = (html: string): string =>
  html
    .replace(/<[^>]+>/gu, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

describe('email template rendering (OQ-43; task 225)', () => {
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  const LINK = 'https://easyesg.md/ro/verify?token=abc';
  const REMINDER = { senderName: 'Ana Rusu', entityName: 'Brutăria Lina', fiscalYear: '2026', noteGiven: 'none', note: '' };
  const REPORT_UPDATE = { reach: 'one', setLabel: '2026.1', newSetLabel: '2026.2' };
  const FIELD_LINES = ['B1: Cifra de afaceri și Active', 'B3: Consumul total de energie'];
  const OUTSTANDING = { count: 3, intervalDays: 7, fields: FIELD_LINES };
  const DEADLINE = { dueDate: '30 mai 2027', daysRemaining: 7, started: 'yes', outstanding: 4 };
  const EXPORT_FINISHED = { format: 'pdf', outcome: 'completed' };
  const EVERY_PARAM = {
    link: LINK,
    organizationName: 'Brutăria Lina SRL',
    ...REMINDER,
    ...REPORT_UPDATE,
    ...OUTSTANDING,
    ...DEADLINE,
    ...EXPORT_FINISHED,
  };
  const UNSUBSCRIBE = {
    link: 'https://app.easyesg.md/ro/unsubscribe/v1~abc~def',
    oneClickUrl: 'https://app.easyesg.md/mail/unsubscribe/v1~abc~def',
  };
  const OPERATOR = { name: 'Servicii Complete SRL', address: 'str. Exemplu 1, Chișinău' };

  const WORDINGS = [...Object.values(NOTIFICATION_CATEGORY), 'identity.password_setup'];
  const EVERY_WORDING = LOCALES.flatMap((locale: Locale) => WORDINGS.map((wording) => [locale, wording] as const));

  it.each(EVERY_WORDING)('renders %s %s as a plain part and an HTML part, each carrying the link', (locale, wording) => {
    const { subject, text, html } = renderEmail({ locale, templateKey: wording, params: EVERY_PARAM });

    expect(subject.trim()).not.toBe('');
    expect(text).toContain(LINK);
    expect(html).toContain(`href="${LINK}"`);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`lang="${locale}"`);
  });

  it.each(EVERY_WORDING)('says in the plain part of %s %s everything the HTML part says but the card', (locale, wording) => {
    const message = { locale, templateKey: wording, params: EVERY_PARAM, unsubscribe: UNSUBSCRIBE, operator: OPERATOR };
    const parts = readEmailParts(message);
    const { text, html } = renderEmail(message);
    const said = [
      parts.heading,
      parts.greeting,
      ...parts.intro,
      ...parts.list,
      ...(parts.outro === undefined ? [] : [parts.outro]),
      parts.action,
      ...parts.facts,
      ...(parts.note === undefined ? [] : [parts.note.body]),
      parts.reason,
      parts.product,
    ];

    for (const words of said) {
      expect(text).toContain(words);
      expect(visible(html)).toContain(words);
    }
  });

  // A-17's preview composes without drawing the HTML; what it shows must be what the send's plain part says.
  it.each(EVERY_WORDING)('previews %s %s as exactly the plain part the send carries', (locale, wording) => {
    const message = { locale, templateKey: wording, params: EVERY_PARAM, unsubscribe: UNSUBSCRIBE, operator: OPERATOR };
    const { subject, text } = renderEmail(message);

    expect(renderEmailText(message)).toEqual({ subject, text });
  });

  // UX-66: nothing a reader needs is fetched — no stylesheet, no font, no script, no remote image.
  it.each(EVERY_WORDING)('names nothing external in the HTML part of %s %s, and embeds the mark', (locale, wording) => {
    const { html } = renderEmail({ locale, templateKey: wording, params: EVERY_PARAM });

    expect(html).not.toMatch(/<link\b|<script\b|<style\b|@import|url\(/iu);
    expect([...html.matchAll(/<img\b[^>]*>/gu)].map(([img]) => img)).toEqual([
      expect.stringContaining(`src="cid:${EMAIL_MARK.contentId}"`),
    ]);
    expect(html).toContain('alt=""');
  });

  const QUOTES = /[„“«»”]/u;
  const NOTE = 'Mai lipsesc datele despre energie.';

  it.each(LOCALES)('writes the reminder in %s with the note only when one was given', (locale) => {
    const reminder = { locale, templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER };
    const given = renderEmail({ ...reminder, params: { link: LINK, ...REMINDER, noteGiven: 'given', note: NOTE } });
    const none = renderEmail({ ...reminder, params: { link: LINK, ...REMINDER } });

    expect(given.subject).toContain(REMINDER.senderName);
    for (const part of [given.text, visible(given.html)]) {
      expect(part).toContain(NOTE);
      expect(part).toMatch(QUOTES);
    }
    for (const part of [none.text, visible(none.html)]) expect(part).not.toMatch(QUOTES);
  });

  // AC-11: the note is text a person typed, and reaches the reader as text.
  it('shows a note holding markup as text, never as markup', () => {
    const note = '<script>alert(1)</script><a href="https://evil.example">x</a>';
    const { html } = renderEmail({
      locale: 'en',
      templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
      params: { link: LINK, ...REMINDER, noteGiven: 'given', note },
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('https://evil.example"');
    expect(html).toContain('&lt;script&gt;');
  });

  it.each(LOCALES)('writes the report update in %s for one report and for several', (locale) => {
    const update = { locale, templateKey: NOTIFICATION_CATEGORY.REPORT_UPDATE };
    const one = renderEmail({ ...update, params: { link: LINK, ...REPORT_UPDATE, entityName: 'Brutăria Lina', fiscalYear: '2026' } });
    // The report's name and year present for several too, so a *several* worded as one would print them below.
    const several = renderEmail({
      ...update,
      params: { link: LINK, ...REPORT_UPDATE, reach: 'several', entityName: 'Brutăria Lina', fiscalYear: '2026' },
    });

    for (const message of [one, several]) {
      expect(message.text).toContain('2026.1');
      expect(message.text).toContain('2026.2');
    }
    expect(one.subject).toContain('Brutăria Lina');
    expect(visible(one.html)).toContain('Brutăria Lina');
    expect(several.subject).not.toContain('Brutăria Lina');
    expect(several.text).not.toContain('Brutăria Lina');
    // The card is left out where its title words to nothing — several reports have no one entity to name.
    expect(visible(several.html)).not.toContain('Brutăria Lina');
  });

  it.each(LOCALES)('lists the outstanding fields in %s one module a row and one a line', (locale) => {
    const { text, html } = renderEmail({
      locale,
      templateKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      params: { link: LINK, entityName: 'Brutăria Lina', fiscalYear: '2026', ...OUTSTANDING },
    });

    expect(text).toContain(FIELD_LINES.join('\n'));
    for (const line of FIELD_LINES) expect(html).toMatch(new RegExp(`<td[^>]*>${line}</td>`, 'u'));
    // Not ready to file: the report card's chip in the attention hue.
    expect(html).toContain(EMAIL_PALETTE['--amber-tint']);
  });

  it('draws a failed export in the error hue and a finished one in the success hue', () => {
    const exported = (outcome: string) =>
      renderEmail({
        locale: 'en',
        templateKey: NOTIFICATION_CATEGORY.EXPORT_FINISHED,
        params: { link: LINK, entityName: 'Brutăria Lina', fiscalYear: '2026', format: 'xlsx', outcome },
      }).html;

    expect(exported('failed')).toContain(EMAIL_PALETTE['--crimson-tint']);
    expect(exported('failed')).not.toContain(EMAIL_PALETTE['--pine-50']);
    expect(exported('completed')).toContain(EMAIL_PALETTE['--pine-50']);
    expect(exported('completed')).not.toContain(EMAIL_PALETTE['--crimson-tint']);
  });

  it('draws the inviting organization behind its monogram', () => {
    const { html } = renderEmail({ locale: 'en', templateKey: NOTIFICATION_CATEGORY.INVITATION, params: EVERY_PARAM });

    expect(visible(html)).toMatch(/\bBL\b/u);
    expect(visible(html)).toContain('Brutăria Lina SRL');
  });

  it.each(LOCALES)('carries the unsubscribe in %s in both parts, and only when the message carries one', (locale) => {
    const reminder = { locale, templateKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, params: { link: LINK, ...REMINDER } };
    const withFooter = renderEmail({ ...reminder, unsubscribe: UNSUBSCRIBE });
    const without = renderEmail(reminder);
    const { unsubscribe } = readEmailParts({ ...reminder, unsubscribe: UNSUBSCRIBE });

    expect(withFooter.text).toContain(UNSUBSCRIBE.link);
    expect(withFooter.html).toContain(`href="${UNSUBSCRIBE.link}"`);
    expect(`${withFooter.text}${withFooter.html}`).not.toContain(UNSUBSCRIBE.oneClickUrl);
    // The footer's own words, absent from the bare message — a renderer adding them to every email, link empty, would
    // leave them there (task 52's close review; the footers never contain the word *unsubscribe*).
    const footerOpening = unsubscribe?.footer.split('\n')[0] ?? '';
    expect(footerOpening.length).toBeGreaterThan(0);
    expect(without.text).not.toContain(footerOpening);
    expect(visible(without.html)).not.toContain(unsubscribe?.label);
    expect(`${without.text}${without.html}`).not.toContain(UNSUBSCRIBE.link);
  });

  // AC-12: an operator that cannot be read leaves the line out, and the message is still rendered.
  it.each(LOCALES)('names the operator in %s in both parts when one is given, and renders without it when not', (locale) => {
    const verification = { locale, templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params: { link: LINK } };
    const named = renderEmail({ ...verification, operator: OPERATOR });
    const unnamed = renderEmail(verification);

    for (const part of [named.text, visible(named.html)]) {
      expect(part).toContain(OPERATOR.name);
      expect(part).toContain(OPERATOR.address);
    }
    expect(`${unnamed.text}${unnamed.html}`).not.toContain(OPERATOR.name);
  });

  it('renders differently per locale, so nothing is falling back to one language', () => {
    const rendered = LOCALES.map((locale: Locale) =>
      renderEmail({ locale, templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params: { link: LINK } }),
    );
    expect(new Set(rendered.map(({ subject }) => subject)).size).toBe(LOCALES.length);
    expect(new Set(rendered.map(({ text }) => text)).size).toBe(LOCALES.length);
  });

  // The wording gate (`notification-wording.spec.ts`) writes this list out, since the boundary rules keep this adapter
  // from it; pinned here as literals, so a part added to or dropped from the renderer is a change to both.
  it('refuses to send without exactly the parts the wording gate asks every template for', () => {
    expect([...EMAIL_REQUIRED_PARTS]).toEqual(['subject', 'preheader', 'heading', 'intro', 'action', 'reason']);
  });

  it('throws rather than sending an email with no subject', () => {
    expect(() => renderEmail({ locale: 'ro', templateKey: 'identity.no_such_template', params: { link: LINK } })).toThrow(
      /no subject in the ro catalogue/u,
    );
  });

  it('throws rather than sending an email with no link to open', () => {
    expect(() =>
      renderEmail({ locale: 'ro', templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, params: {} }),
    ).toThrow(/no link/u);
  });

  it('carries no internal identifier into what a person reads', () => {
    const { subject, text, html } = renderEmail({
      locale: 'ro',
      templateKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
      params: { link: LINK },
    });
    const read = `${subject}\n${text}\n${visible(html)}`;
    // CLAUDE.md names these by shape: no FR-/UC-/NFR-/OQ- identifier, no enum member, no key.
    expect(read).not.toMatch(/\b(FR|UC|NFR|AD|DR|UX|OQ|BR)-\d+/u);
    expect(read).not.toContain(NOTIFICATION_CATEGORY.EMAIL_VERIFICATION);
    expect(read).not.toMatch(/notification\.\w/u);
  });
});
