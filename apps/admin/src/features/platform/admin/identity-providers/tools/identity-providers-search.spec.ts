import { describe, expect, it } from 'vitest';
import { readIdentityProvidersSearch, withProvider } from './identity-providers-search';

describe('A-18’s address (task 67.11)', () => {
  it('keeps a provider FR-2 names, and drops anything else', () => {
    expect(readIdentityProvidersSearch({ provider: 'microsoft' })).toEqual({ provider: 'microsoft' });
    expect(readIdentityProvidersSearch({ provider: 'apple' })).toEqual({});
    expect(readIdentityProvidersSearch({ provider: 3 })).toEqual({});
    expect(readIdentityProvidersSearch({})).toEqual({});
  });

  it('opens and closes a record without writing a default', () => {
    expect(withProvider({}, 'google')).toEqual({ provider: 'google' });
    expect(withProvider({ provider: 'google' }, null)).toEqual({});
  });
});
