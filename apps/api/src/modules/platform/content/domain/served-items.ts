import type { Locale } from '@easyesg/i18n';
import { type Localized, type Served, servedIn } from './localized';

/** One item in force as the store holds it: its key — the slot's scope — its revision and its payload. */
export interface StoredItem {
  readonly key: string;
  readonly revision: number;
  readonly payload: unknown;
}

/** What every content kind reads into: a place among its kind, and its text per locale. */
export interface ContentItem<Text> {
  readonly order: number;
  readonly text: Localized<Text>;
}

/** An item a reader is shown, with the text they are served. */
export interface ServedItem<Item extends ContentItem<Text>, Text> {
  readonly key: string;
  readonly item: Item;
  readonly served: Served<Text>;
}

export interface Serving<Item extends ContentItem<Text>, Text> {
  /** Every readable item in its kind's order: by `order`, ties broken by key. */
  readonly items: readonly ServedItem<Item, Text>[];
  /** Items in force the reader refuses — the store refuses them at publication, so only a write around it leaves one. */
  readonly unreadable: readonly StoredItem[];
}

/**
 * A kind's items in force served in one locale (task 76; `architecture.md` §12.5.6's task-76 row (4)) — each in the
 * locale asked for or in the source's, independently. An unreadable item is left out rather than half-shown and
 * returned beside the rest for the caller to say so; reporting which fell back is the caller's, since only it knows
 * which of them a reader is shown.
 */
export const serveItems = <Item extends ContentItem<Text>, Text>(input: {
  readonly stored: readonly StoredItem[];
  readonly read: (stored: StoredItem) => Item | null;
  readonly locale: Locale;
}): Serving<Item, Text> => {
  const items: ServedItem<Item, Text>[] = [];
  const unreadable: StoredItem[] = [];
  for (const stored of input.stored) {
    const item = input.read(stored);
    if (item === null) unreadable.push(stored);
    else items.push({ key: stored.key, item, served: servedIn({ localized: item.text, locale: input.locale }) });
  }
  // Keys are slugs, not prose, so a code-unit comparison is the whole of their order.
  items.sort((a, b) => a.item.order - b.item.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { items, unreadable };
};

/** The items named by `keys`, in the order named, leaving out any not among `items` — an article's *read next*. */
export const itemsNamed = <Item extends ContentItem<Text>, Text>(input: {
  readonly keys: readonly string[];
  readonly items: readonly ServedItem<Item, Text>[];
}): ServedItem<Item, Text>[] =>
  input.keys.flatMap((key) => input.items.filter((item) => item.key === key));
