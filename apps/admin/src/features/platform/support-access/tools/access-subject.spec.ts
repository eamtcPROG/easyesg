import { describe, expect, it } from 'vitest';
import { accessModuleOf } from './access-subject';

describe('what an access row names (task 67.9)', () => {
  it('names the module of a module read, and never the report id', () => {
    expect(accessModuleOf('0192a000-0000-7000-8000-000000000003/B3')).toBe('B3');
    expect(accessModuleOf('0192a000-0000-7000-8000-000000000003/C10')).toBe('C10');
  });

  it('names nothing for the report list, a report’s modules, or a subject it does not recognise', () => {
    expect(accessModuleOf(null)).toBeNull();
    expect(accessModuleOf('0192a000-0000-7000-8000-000000000003')).toBeNull();
    expect(accessModuleOf('0192a000-0000-7000-8000-000000000003/../x')).toBeNull();
  });
});
