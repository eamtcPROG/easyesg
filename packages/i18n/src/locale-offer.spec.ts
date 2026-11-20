import { describe, expect, it } from 'vitest';
import { offeredLocales, readLocaleRegistration } from './locale-offer.js';

describe('offeredLocales (task 67.16; FR-63 AC-6)', () => {
  it('offers a built locale only when it is registered, in the registry’s order', () => {
    expect(offeredLocales({ registered: ['ru', 'ro'] })).toEqual(['ro', 'ru']);
  });

  it('does not offer a registered code with no catalogue in the build', () => {
    expect(offeredLocales({ registered: ['ro', 'de'] })).toEqual(['ro']);
  });

  it('offers nothing where nothing is registered', () => {
    expect(offeredLocales({ registered: [] })).toEqual([]);
  });
});

describe('readLocaleRegistration (task 67.16)', () => {
  const ro = { code: 'ro', source: true };

  it('reads the artefact’s codes and its source', () => {
    expect(readLocaleRegistration({ locales: [ro, { code: 'en', source: false }] })).toEqual([
      ro,
      { code: 'en', source: false },
    ]);
  });

  it('refuses a registration without the source locale as its one source', () => {
    expect(readLocaleRegistration({ locales: [{ code: 'en', source: true }] })).toBeNull();
    expect(readLocaleRegistration({ locales: [ro, { code: 'en', source: true }] })).toBeNull();
    expect(readLocaleRegistration({ locales: [{ code: 'ro', source: false }] })).toBeNull();
  });

  it('refuses a malformed or repeated code, and anything that is not the artefact’s shape', () => {
    expect(readLocaleRegistration({ locales: [ro, { code: 'EN', source: false }] })).toBeNull();
    expect(readLocaleRegistration({ locales: [ro, ro] })).toBeNull();
    expect(readLocaleRegistration({ locales: 'ro' })).toBeNull();
    expect(readLocaleRegistration(null)).toBeNull();
  });
});
