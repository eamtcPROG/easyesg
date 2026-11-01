import sharedEn from '@easyesg/i18n/catalogues/en.json';
import sharedRo from '@easyesg/i18n/catalogues/ro.json';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { findingWords } from './finding-words';

/**
 * A finding worded from the shared catalogue (task 42.1; NFR-79, NFR-26). The catalogue is the real one, so a message
 * the rule set names and the catalogue does not word in three parts fails here as well as at publication.
 */
const wordsIn = (locale: 'ro' | 'en', messages: typeof sharedRo) => (finding: { message: string; params: Record<string, string> }) =>
  findingWords({
    t: createTranslator({ locale, messages: { validation: messages.validation }, namespace: 'validation' }),
    format: createFormatter({ locale, formats, timeZone: 'Europe/Chisinau' }),
    finding,
  });

describe('findingWords', () => {
  it('words a finding in its three parts, in reading order', () => {
    const words = wordsIn('en', sharedEn)({ message: 'validation.required', params: {} });
    expect(words).toEqual([
      'This question has no answer yet.',
      'The report needs one, so it is not complete without it.',
      'Answer it, or mark it as not available and give the reason.',
    ]);
  });

  it('formats a decimal it quotes in the reader’s locale, every digit kept (NFR-26)', () => {
    const [happened] = wordsIn('ro', sharedRo)({
      message: 'validation.year_over_year',
      params: { prior: '31', current: '52', change: '21' },
    }) ?? [];
    expect(happened).toContain('31');
    const [en] = wordsIn('en', sharedEn)({ message: 'validation.sum.over', params: { parts: '1250000.5', total: '1000000' } }) ?? [];
    expect(en).toContain('1,250,000.5');
    expect(en).toContain('1,000,000');
  });

  it('quotes an address verbatim — it is not a number', () => {
    const [happened] = wordsIn('en', sharedEn)({ message: 'validation.url', params: { value: 'www.example.md/raport' } }) ?? [];
    expect(happened).toContain('“www.example.md/raport”');
  });

  it('answers null for a key the catalogue does not word as a finding, or one outside the namespace', () => {
    expect(wordsIn('en', sharedEn)({ message: 'validation.nowhere', params: {} })).toBeNull();
    expect(wordsIn('en', sharedEn)({ message: 'validation.sum', params: {} })).toBeNull();
    expect(wordsIn('en', sharedEn)({ message: 'organization.wizard.title', params: {} })).toBeNull();
  });
});
