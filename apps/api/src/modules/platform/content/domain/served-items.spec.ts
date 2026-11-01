import type { Localized } from './localized';
import { type ContentItem, itemsNamed, serveItems } from './served-items';

interface Note extends ContentItem<string> {
  readonly order: number;
  readonly text: Localized<string>;
}

const note = (order: number, byLocale: Localized<string>['byLocale']): Note => ({
  order,
  text: { source: byLocale.ro ?? '', byLocale },
});

const read = (stored: { readonly payload: unknown }): Note | null => stored.payload as Note | null;

describe('serveItems', () => {
  const stored = [
    { key: 'c', revision: 1, payload: note(2, { ro: 'C' }) },
    { key: 'b', revision: 1, payload: note(1, { ro: 'B', en: 'B (en)' }) },
    { key: 'a', revision: 3, payload: note(2, { ro: 'A', en: 'A (en)' }) },
    { key: 'broken', revision: 4, payload: null },
  ];

  it('serves each item in the locale asked for or the source’s, in order with ties broken by key', () => {
    const { items } = serveItems<Note, string>({ stored, read, locale: 'en' });
    expect(items.map((item) => [item.key, item.served])).toEqual([
      ['b', { locale: 'en', text: 'B (en)', fellBack: false }],
      ['a', { locale: 'en', text: 'A (en)', fellBack: false }],
      ['c', { locale: 'ro', text: 'C', fellBack: true }],
    ]);
  });

  it('leaves out an item the reader refuses, and hands it back to be said', () => {
    const { items, unreadable } = serveItems<Note, string>({ stored, read, locale: 'ro' });
    expect(items.map((item) => item.key)).not.toContain('broken');
    expect(unreadable).toEqual([{ key: 'broken', revision: 4, payload: null }]);
  });
});

describe('itemsNamed', () => {
  it('answers the items named, in the order named, leaving out a name not among them', () => {
    const { items } = serveItems<Note, string>({
      stored: [
        { key: 'a', revision: 1, payload: note(1, { ro: 'A' }) },
        { key: 'b', revision: 1, payload: note(2, { ro: 'B' }) },
      ],
      read,
      locale: 'ro',
    });
    expect(itemsNamed({ keys: ['b', 'gone', 'a'], items }).map((item) => item.key)).toEqual(['b', 'a']);
  });
});
