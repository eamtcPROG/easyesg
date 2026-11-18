import { describe, expect, it } from 'vitest';
import { itemAddress, itemRefOf, readContentConsoleSearch } from './content-console-search';

describe('A-03’s address (task 67.5)', () => {
  it('keeps an item, a new item’s kind and the publication panel it understands', () => {
    expect(readContentConsoleSearch({ item: 'help_topic/first-report', create: 'help_article', panel: 'publish' })).toEqual({
      item: 'help_topic/first-report',
      create: 'help_article',
      panel: 'publish',
    });
  });

  it('drops what it does not understand, so a stale address shows the list', () => {
    expect(readContentConsoleSearch({ item: 'help_topic/../x', create: 'page', panel: 'other' })).toEqual({});
  });

  it('reads an item reference back out of its address', () => {
    expect(itemRefOf(itemAddress({ kind: 'help_article', key: 'locking-a-period' }))).toEqual({
      kind: 'help_article',
      key: 'locking-a-period',
    });
    expect(itemRefOf('plan_copy')).toBeNull();
  });
});
