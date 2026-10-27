import { describe, expect, it } from 'vitest';
import { SCOPE_CHANGE, scopeChangeOffered } from './scope-change';

describe('scopeChangeOffered (task 78.3)', () => {
  it('offers adding the Comprehensive Module on a Basic report, and removing it on one that carries it', () => {
    expect(scopeChangeOffered({ scope: 'basic', writable: true })).toBe(SCOPE_CHANGE.RAISE);
    expect(scopeChangeOffered({ scope: 'basic_and_comprehensive', writable: true })).toBe(SCOPE_CHANGE.LOWER);
  });

  it('offers neither to a reader who may not write the report', () => {
    expect(scopeChangeOffered({ scope: 'basic', writable: false })).toBeNull();
    expect(scopeChangeOffered({ scope: 'basic_and_comprehensive', writable: false })).toBeNull();
  });
});
