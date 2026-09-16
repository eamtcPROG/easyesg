import { describe, expect, it } from 'vitest';
import { isPlainClick, type ClickLike } from './plain-click';

/** Which clicks S-07 may hold for a session probe (task 92), and which it must leave to the browser. */
const plain: ClickLike = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

describe('isPlainClick', () => {
  it('is the primary button with nothing held', () => {
    expect(isPlainClick(plain)).toBe(true);
  });

  it('leaves every modified click to the browser — a new tab, a new window, a download', () => {
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      expect(isPlainClick({ ...plain, [modifier]: true })).toBe(false);
    }
  });

  it('leaves the middle button, and a click something else has already handled', () => {
    expect(isPlainClick({ ...plain, button: 1 })).toBe(false);
    expect(isPlainClick({ ...plain, defaultPrevented: true })).toBe(false);
  });
});
