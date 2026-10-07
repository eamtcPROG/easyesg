import { LOCALES, type Locale } from '@easyesg/i18n';
import { initialiseCatalogue, translate } from '@api/app/messages/catalogue';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { REPORT_UPDATE_REACH, type ReportUpdateParams } from './report-update.model';

/**
 * The report-update notice's words in-app (task 37.3), in each language, read from the real catalogue with the
 * parameters `NotifyFactorSetReplaced` raises.
 *
 * **One report or several is chosen by `reach`**, whose spellings are `REPORT_UPDATE_REACH`'s and the catalogue's ICU
 * `select`'s — two copies of one vocabulary, which this binds: a renamed member would word a notice about one named
 * report as though it reached several, and nothing else would say so. Its email is the renderer's spec, for the
 * boundary the reminder's wording spec names.
 */
const category = `notification.${NOTIFICATION_CATEGORY.REPORT_UPDATE}`;

const params = (reach: ReportUpdateParams['reach']): ReportUpdateParams =>
  reach === REPORT_UPDATE_REACH.ONE
    ? { reach, setLabel: '2026.1', newSetLabel: '2026.2', entityName: 'Brutăria Lina', fiscalYear: '2026' }
    : { reach, setLabel: '2026.1', newSetLabel: '2026.2', entityName: '', fiscalYear: '' };

const inApp = (locale: Locale, reach: ReportUpdateParams['reach']) => ({
  name: translate(locale, `${category}.name`),
  title: translate(locale, `${category}.in_app.title`, params(reach)),
  body: translate(locale, `${category}.in_app.body`, params(reach)),
  action: translate(locale, `${category}.in_app.action`, params(reach)),
});

describe('the report-update notice’s words (task 37.3)', () => {
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  it.each(LOCALES)('names the report and its year in %s when one is reached, the year as a year', (locale) => {
    const words = inApp(locale, REPORT_UPDATE_REACH.ONE);

    expect(words.name).toBeTruthy();
    expect(words.title).toContain('Brutăria Lina');
    // Text, not a number: ICU would write 2 026 or 2,026.
    expect(words.title).toContain('2026');
    expect(words.body).toContain('2026.1');
    expect(words.body).toContain('2026.2');
  });

  it.each(LOCALES)('says several in %s without naming a report, and points elsewhere', (locale) => {
    const one = inApp(locale, REPORT_UPDATE_REACH.ONE);
    const several = inApp(locale, REPORT_UPDATE_REACH.SEVERAL);

    expect(several.title).toBeTruthy();
    expect(several.title).not.toBe(one.title);
    expect(several.title).not.toContain('Brutăria Lina');
    // The action follows the link: the calculator for one report, the reports list for several.
    expect(several.action).toBeTruthy();
    expect(several.action).not.toBe(one.action);
  });

  it('is worded separately in each language', () => {
    const titles = LOCALES.map((locale: Locale) => inApp(locale, REPORT_UPDATE_REACH.ONE).title);
    expect(new Set(titles).size).toBe(LOCALES.length);
  });
});
