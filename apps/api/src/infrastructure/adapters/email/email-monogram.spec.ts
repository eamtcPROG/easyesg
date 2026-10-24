import { organizationMonogram } from './email-monogram';

describe('an organization’s monogram (task 225)', () => {
  it('takes the first letter of the first two words', () => {
    expect(organizationMonogram({ name: 'Brutăria Lina SRL', locale: 'ro' })).toBe('BL');
  });

  it('skips a word that does not begin with a letter, and upper-cases in the reader’s language', () => {
    expect(organizationMonogram({ name: '„ștefan” 3D ăria', locale: 'ro' })).toBe('Ă');
    expect(organizationMonogram({ name: 'ателье «нова»', locale: 'ru' })).toBe('А');
  });

  it('draws one letter for a one-word name and none for a name with no letter', () => {
    expect(organizationMonogram({ name: 'Lina', locale: 'en' })).toBe('L');
    expect(organizationMonogram({ name: '2026 — 7', locale: 'en' })).toBe('');
  });
});
