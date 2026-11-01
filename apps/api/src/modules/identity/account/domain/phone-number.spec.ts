import { PHONE_MALFORMED, phoneNumber } from './phone-number';

/** S-27's phone (task 52.3): international, one spelling, nothing typed is nothing stored. */
describe('phoneNumber (task 52.3)', () => {
  it.each([
    ['+373 69 123 456', '+37369123456'],
    ['+373-69-123456', '+37369123456'],
    [' +44 (20) 7946.0958 ', '+442079460958'],
  ])('stores %j as %j', (typed, stored) => {
    expect(phoneNumber(typed)).toBe(stored);
  });

  it.each([null, undefined, '', '   '])('stores nothing for %j', (typed) => {
    expect(phoneNumber(typed)).toBeNull();
  });

  it.each([
    ['a local number, with no country code', '069123456'],
    ['a country code starting with zero', '+0373691234'],
    ['too few digits', '+37369'],
    ['more than fifteen digits', '+3736912345678901'],
    ['letters', '+373 69 ABC 456'],
  ])('refuses %s', (_case, typed) => {
    expect(phoneNumber(typed)).toBe(PHONE_MALFORMED);
  });
});
