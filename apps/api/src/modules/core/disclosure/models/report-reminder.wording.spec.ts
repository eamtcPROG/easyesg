import { LOCALES, type Locale } from '@easyesg/i18n';
import { initialiseCatalogue, translate } from '@api/app/messages/catalogue';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { REMINDER_NOTE, type ReminderParams } from './report-reminder.model';

/**
 * The manual reminder's words (task 50.3; `architecture.md` §12.5.6's task-50.3 rows (1), (2)), in each language, read
 * from the real catalogue with the parameters `SendReportReminder` raises.
 *
 * **The note's two sentences are chosen by `noteGiven`**, whose spellings are `REMINDER_NOTE`'s and the catalogue's
 * ICU `select`'s — two copies of one vocabulary, which this binds: a renamed member would render the no-note sentence
 * over a note the sender wrote, and nothing else would say so.
 *
 * **The in-app wording alone is here.** Its email is authored for task 52.2 and exercised by the renderer's own spec,
 * because `email-port-behind-notification` admits no module but `platform/notification` to the email adapters — a
 * boundary this spec met by importing `renderEmail` and the gate caught.
 */
const category = `notification.${NOTIFICATION_CATEGORY.MANUAL_REMINDER}`;
const NOTE = 'Mai lipsesc datele despre energie.';
/** The quotation marks each locale's note is set in — what a body without a note must not carry. */
const QUOTES = /[„“«»”]/;

const params = (noteGiven: ReminderParams['noteGiven']): ReminderParams => ({
  senderName: 'Ana Rusu',
  entityName: 'Brutăria Lina',
  fiscalYear: '2026',
  noteGiven,
  note: noteGiven === REMINDER_NOTE.GIVEN ? NOTE : '',
});

const inApp = (locale: Locale, noteGiven: ReminderParams['noteGiven']) => ({
  name: translate(locale, `${category}.name`),
  title: translate(locale, `${category}.in_app.title`, params(noteGiven)),
  body: translate(locale, `${category}.in_app.body`, params(noteGiven)),
  action: translate(locale, `${category}.in_app.action`, params(noteGiven)),
});

describe('the manual reminder’s words (task 50.3)', () => {
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  it.each(LOCALES)('names the sender, the report and its year in-app in %s, and the year as a year', (locale) => {
    const words = inApp(locale, REMINDER_NOTE.NONE);

    expect(words.name).toBeTruthy();
    expect(words.action).toBeTruthy();
    expect(words.title).toContain('Ana Rusu');
    expect(words.title).toContain('Brutăria Lina');
    // Text, not a number: ICU would write 2 026 or 2,026.
    expect(words.title).toContain('2026');
  });

  it.each(LOCALES)('quotes the note in-app in %s when one was given, and says the report is open when not', (locale) => {
    const given = inApp(locale, REMINDER_NOTE.GIVEN).body;
    const none = inApp(locale, REMINDER_NOTE.NONE).body;

    expect(given).toContain(NOTE);
    expect(given).toMatch(QUOTES);
    // Positively, not by the absence of a note it never had: a body that lost its `other` branch renders an empty
    // pair of quotes, which `not.toContain(NOTE)` cannot see. A key with no entry resolves `undefined`, which the
    // first assertion catches — so the sentence below reads what the catalogue answered, never a fallback.
    expect(none).toBeTruthy();
    expect(none ?? '').not.toMatch(QUOTES);
    expect((none ?? '').length).toBeGreaterThan(NOTE.length);
    // And it says the same thing whatever note is not being shown.
    expect(inApp(locale, REMINDER_NOTE.NONE).body).toBe(none);
  });

  it('is worded separately in each language', () => {
    expect(new Set(LOCALES.map((locale) => inApp(locale, REMINDER_NOTE.NONE).title)).size).toBe(LOCALES.length);
  });
});
