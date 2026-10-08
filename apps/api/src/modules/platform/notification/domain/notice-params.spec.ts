import { paramsForLocale } from './notice-params';

const LABELS: Record<string, Record<string, string>> = {
  ro: { Turnover: 'Cifra de afaceri', Assets: 'Active', TotalEnergyConsumption: 'Consumul total de energie' },
  en: { Turnover: 'Turnover', Assets: 'Assets', TotalEnergyConsumption: 'Total energy consumption' },
};

const labelOf = (locale: string) => (query: { version: string; key: string }) =>
  query.version === '2026-05-01' ? (LABELS[locale]?.[query.key] ?? null) : null;

const FIELDS = {
  fieldList: {
    taxonomyVersion: '2026-05-01',
    modules: [
      { module: 'B1', elementKeys: ['Turnover', 'Assets'] },
      { module: 'B3', elementKeys: ['TotalEnergyConsumption'] },
    ],
  },
};

describe('paramsForLocale (task 51.2)', () => {
  it('names each module’s fields by their labels, in the reader’s language and list style', () => {
    expect(paramsForLocale({ params: { fields: FIELDS }, locale: 'en', labelOf: labelOf('en') })).toEqual({
      fields: 'B1: Turnover and Assets; B3: Total energy consumption',
    });
    expect(paramsForLocale({ params: { fields: FIELDS }, locale: 'ro', labelOf: labelOf('ro') })).toEqual({
      fields: 'B1: Cifra de afaceri și Active; B3: Consumul total de energie',
    });
  });

  it('leaves out a field with no label rather than printing its key, and keeps the module', () => {
    const unlabelled = {
      fieldList: { taxonomyVersion: '2026-05-01', modules: [{ module: 'B9', elementKeys: ['NoSuchElement'] }] },
    };
    const rendered = paramsForLocale({ params: { fields: unlabelled }, locale: 'en', labelOf: labelOf('en') });
    expect(rendered).toEqual({ fields: 'B9' });
    expect(JSON.stringify(rendered)).not.toContain('NoSuchElement');
  });

  it('writes a calendar date as the locale writes one, on its own day whatever the zone', () => {
    expect(paramsForLocale({ params: { due: { calendarDate: '2027-05-30' } }, locale: 'en', labelOf: labelOf('en') })).toEqual({
      due: 'May 30, 2027',
    });
    expect(paramsForLocale({ params: { due: { calendarDate: '2027-01-01' } }, locale: 'ro', labelOf: labelOf('ro') })).toEqual({
      due: '1 ianuarie 2027',
    });
  });

  it('passes every other param to ICU as it is', () => {
    expect(
      paramsForLocale({ params: { entityName: 'Brutăria Lina SRL', count: 3, odd: { other: true } }, locale: 'en', labelOf: labelOf('en') }),
    ).toEqual({ entityName: 'Brutăria Lina SRL', count: 3, odd: { other: true } });
  });
});
