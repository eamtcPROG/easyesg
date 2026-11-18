import { CONTENT_KIND } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  LOCALE_FIELDS,
  SHARED_FIELDS,
  emptyPayload,
  itemTitle,
  localeValue,
  sectionsOf,
  sharedValue,
  withLocaleField,
  withSections,
  withShared,
  withoutLocale,
} from './content-payload';

const [title, summary] = LOCALE_FIELDS[CONTENT_KIND.HELP_TOPIC];
const [, , related] = SHARED_FIELDS[CONTENT_KIND.HELP_ARTICLE];
const [order] = SHARED_FIELDS[CONTENT_KIND.HELP_TOPIC];
const badge = LOCALE_FIELDS[CONTENT_KIND.PLAN_COPY][3];

describe('A-03’s payload edits (task 67.5)', () => {
  it('starts a new item with its shared fields and an empty Romanian block', () => {
    expect(emptyPayload(CONTENT_KIND.HELP_TOPIC)).toEqual({ order: 1, locales: { ro: { title: '', summary: '' } } });
    expect(emptyPayload(CONTENT_KIND.HELP_ARTICLE)).toMatchObject({ topic: '', related: [] });
  });

  it('adds a locale’s block from the kind’s empty one the first time a field of it is written', () => {
    const edited = withLocaleField({
      kind: CONTENT_KIND.HELP_TOPIC,
      payload: emptyPayload(CONTENT_KIND.HELP_TOPIC),
      locale: 'en',
      field: title,
      text: 'Locking',
    });
    expect(edited.locales).toEqual({ ro: { title: '', summary: '' }, en: { title: 'Locking', summary: '' } });
    expect(localeValue(edited, 'en', title)).toBe('Locking');
    expect(localeValue(edited, 'ru', summary)).toBe('');
  });

  it('stores a list as one entry per line with blanks dropped, a number parsed, and an empty optional as none', () => {
    const article = withShared({ payload: emptyPayload(CONTENT_KIND.HELP_ARTICLE), field: related, text: 'a\n\n b \n' });
    expect(article.related).toEqual(['a', 'b']);
    expect(sharedValue(article, related)).toBe('a\nb');
    expect(withShared({ payload: emptyPayload(CONTENT_KIND.HELP_TOPIC), field: order, text: '7' }).order).toBe(7);
    const plan = withLocaleField({
      kind: CONTENT_KIND.PLAN_COPY,
      payload: emptyPayload(CONTENT_KIND.PLAN_COPY),
      locale: 'ro',
      field: badge,
      text: '  ',
    });
    expect((plan.locales as { ro: { badge: unknown } }).ro.badge).toBeNull();
  });

  it('withdraws a translation, and never the Romanian source', () => {
    const translated = withLocaleField({
      kind: CONTENT_KIND.HELP_TOPIC,
      payload: emptyPayload(CONTENT_KIND.HELP_TOPIC),
      locale: 'ru',
      field: title,
      text: 'Блокировка',
    });
    expect(Object.keys(withoutLocale(translated, 'ru').locales as object)).toEqual(['ro']);
    expect(withoutLocale(translated, 'ro')).toBe(translated);
  });

  it('edits an article’s sections in one locale', () => {
    const sections = [{ heading: 'H', body: 'B', disclosed: true }];
    const edited = withSections({ payload: emptyPayload(CONTENT_KIND.HELP_ARTICLE), locale: 'ro', sections });
    expect(sectionsOf(edited, 'ro')).toEqual(sections);
    expect(sectionsOf(edited, 'en')).toEqual([]);
  });

  it('names an item by its Romanian title or name, and by its key while it has none', () => {
    expect(itemTitle({ payload: { locales: { ro: { title: 'Blocare' } } }, key: 'k' })).toBe('Blocare');
    expect(itemTitle({ payload: { locales: { ro: { name: 'Gratuit' } } }, key: 'k' })).toBe('Gratuit');
    expect(itemTitle({ payload: emptyPayload(CONTENT_KIND.HELP_TOPIC), key: 'k' })).toBe('k');
    expect(itemTitle({ payload: null, key: 'k' })).toBe('k');
  });
});
