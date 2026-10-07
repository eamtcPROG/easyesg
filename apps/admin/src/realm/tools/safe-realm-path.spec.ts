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
});
