import { describe, expect, it } from 'vitest';
import { noticeTitleId } from './notice-title-id';

/** One id per notice (task 50.2.1): distinct for distinct notices, the same for the item and its controls. */
describe('noticeTitleId', () => {
  it('names each notice apart, and the same notice alike', () => {
    expect(noticeTitleId('a')).toBe(noticeTitleId('a'));
    expect(noticeTitleId('a')).not.toBe(noticeTitleId('b'));
  });
});
