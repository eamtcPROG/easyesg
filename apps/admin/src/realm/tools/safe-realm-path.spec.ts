import { describe, expect, it } from 'vitest';
import { safeRealmPath } from './safe-realm-path';

describe('safeRealmPath', () => {
  it('keeps a same-app path, its query included', () => {
    expect(safeRealmPath('/accounts?panel=invite')).toBe('/accounts?panel=invite');
  });

  it('refuses anything a browser could read as another origin, and anything that is not a path', () => {
    for (const hostile of ['//evil.test', '/\\evil.test', 'https://evil.test/', 'accounts', '', undefined]) {
      expect(safeRealmPath(hostile)).toBeNull();
    }
  });

  /**
   * The URL parser deletes every tab, newline and carriage return before it reads a URL, so `/\t/evil.test` arrives as
   * `//evil.test`: a check of the first two characters passes it. A realm path never holds one, so any is refused.
   */
  it('refuses a path holding a tab, a newline or a carriage return, which a browser deletes before reading it', () => {
    for (const hostile of ['/\t/evil.test', '/\n/evil.test', '/\r/evil.test', '/\t\\evil.test', '/accounts\n']) {
      expect(safeRealmPath(hostile)).toBeNull();
    }
  });
});
