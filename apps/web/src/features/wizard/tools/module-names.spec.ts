import { describe, expect, it } from 'vitest';
import ro from '@/messages/ro.json';
import { NAMED_MODULES, isNamedModule } from './module-names';

describe('module names', () => {
  it('names exactly the modules the list says it names — no name unreachable, none reachable and missing', () => {
    expect(Object.keys(ro.organization.wizard.modules).sort()).toEqual([...NAMED_MODULES].sort());
  });

  it('narrows a reference the release names, and leaves a later version’s module to its reference alone', () => {
    expect(isNamedModule('B10')).toBe(true);
    expect(isNamedModule('C9')).toBe(true);
    expect(isNamedModule('B12')).toBe(false);
    expect(isNamedModule('b1')).toBe(false);
  });
});
