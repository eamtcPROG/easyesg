import type { FieldRead } from './content-payload';
import { readLocalized, servedIn, translatedLocales } from './localized';

const readWord = (block: unknown): FieldRead<string> =>
  typeof block === 'string' && block !== '' ? { value: block } : { fault: 'is not a word' };

describe('readLocalized', () => {
  it('reads every locale the item carries, the source among them', () => {
    expect(readLocalized({ value: { ro: 'Ajutor', ru: 'Помощь' }, readBlock: readWord })).toEqual({
      value: { source: 'Ajutor', byLocale: { ro: 'Ajutor', ru: 'Помощь' } },
    });
  });

  it('refuses an item with no Romanian, the source every locale falls back to', () => {
    expect(readLocalized({ value: { en: 'Help' }, readBlock: readWord })).toEqual({
      fault: 'carries no ro text, the source every locale falls back to',
    });
  });

  it('refuses a locale the build does not register', () => {
    expect(readLocalized({ value: { ro: 'Ajutor', de: 'Hilfe' }, readBlock: readWord })).toEqual({
      fault: 'names "de", a locale the build does not register',
    });
  });

  it('refuses a half-written locale rather than serving half of it', () => {
    expect(readLocalized({ value: { ro: 'Ajutor', en: '' }, readBlock: readWord })).toEqual({
      fault: 'in en: is not a word',
    });
  });

  it.each([[undefined], [['ro']], ['ro']])('refuses %j as carrying no locales', (value) => {
    expect(readLocalized({ value, readBlock: readWord })).toEqual({ fault: 'carries no locales' });
  });
});

describe('servedIn', () => {
  const localized = { source: 'Ajutor', byLocale: { ro: 'Ajutor', en: 'Help' } };

  it('serves the locale asked for where the item carries it', () => {
    expect(servedIn({ localized, locale: 'en' })).toEqual({ locale: 'en', text: 'Help', fellBack: false });
    expect(servedIn({ localized, locale: 'ro' })).toEqual({ locale: 'ro', text: 'Ajutor', fellBack: false });
  });

  it('serves the source, and says it fell back, where the item carries no text in that locale', () => {
    expect(servedIn({ localized, locale: 'ru' })).toEqual({ locale: 'ro', text: 'Ajutor', fellBack: true });
  });
});

describe('translatedLocales', () => {
  it('answers the locales carried, in the registry’s order', () => {
    expect(translatedLocales({ source: 'a', byLocale: { ru: 'в', ro: 'a' } })).toEqual(['ro', 'ru']);
  });
});
