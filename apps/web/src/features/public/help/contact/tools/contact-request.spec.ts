import { describe, expect, it } from 'vitest';
import { contactRequestOf, looksLikeEmail, type ContactFields } from './contact-request';

const FIELDS: ContactFields = {
  topic: 'exports',
  question: '  Raportul nu se descarcă.  ',
  replyLocale: 'ru',
  name: ' Ion Rusu ',
  email: ' ion@rusu.md ',
};

describe('contactRequestOf (S-34; task 77)', () => {
  it('sends a visitor’s name and address, trimmed', () => {
    expect(contactRequestOf({ fields: FIELDS, signedIn: false })).toEqual({
      topic: 'exports',
      question: 'Raportul nu se descarcă.',
      replyLocale: 'ru',
      name: 'Ion Rusu',
      email: 'ion@rusu.md',
    });
  });

  it('never sends a signed-in reader’s, which the account supplies (UX-109)', () => {
    expect(contactRequestOf({ fields: FIELDS, signedIn: true })).toEqual({
      topic: 'exports',
      question: 'Raportul nu se descarcă.',
      replyLocale: 'ru',
    });
  });

  it('sends nothing for a topic outside the six', () => {
    expect(contactRequestOf({ fields: { ...FIELDS, topic: '' }, signedIn: false })).toBeNull();
    expect(contactRequestOf({ fields: { ...FIELDS, topic: 'gossip' }, signedIn: false })).toBeNull();
  });
});

describe('looksLikeEmail (task 77)', () => {
  it.each([['ion@rusu.md', true], [' ion@rusu.md ', true], ['ion', false], ['ion@rusu', false], ['a b@c.md', false]])(
    'reads %j as %s',
    (value, expected) => {
      expect(looksLikeEmail(value)).toBe(expected);
    },
  );
});
