import { maskedAddress } from './masked-address';

/** S-38's naming of an address (task 52): whose emails, and nothing more. */
describe('maskedAddress', () => {
  it.each([
    ['ana@lina.md', 'a•••@lina.md'],
    ['a@lina.md', 'a•••@lina.md'],
    ['ana.rusu+esg@mail.lina.md', 'a•••@mail.lina.md'],
    ['Șerban@lina.md', 'Ș•••@lina.md'],
  ])('masks %j as %j, the local part’s length unsaid', (address, masked) => {
    expect(maskedAddress(address)).toBe(masked);
  });

  it('masks a value with no local part whole', () => {
    expect(maskedAddress('@lina.md')).toBe('•••');
    expect(maskedAddress('no-at-sign')).toBe('•••');
  });
});
