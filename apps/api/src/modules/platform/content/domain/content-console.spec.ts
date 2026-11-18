import { CONTENT_KIND } from '../constants/content.constants';
import { isContentKey, isPublishable, payloadLocales, setLocales } from './content-console';

const topic = (locales: Record<string, unknown>) => ({ order: 1, locales });
const block = { title: 'T', summary: 'S.' };

describe('A-03’s rules (task 67.5)', () => {
  it('admits a key of lower-case hyphenated words, and nothing else', () => {
    expect(isContentKey('locking-a-period')).toBe(true);
    expect(isContentKey('Locking')).toBe(false);
    expect(isContentKey('a--b')).toBe(false);
    expect(isContentKey('../seed')).toBe(false);
    expect(isContentKey('a'.repeat(81))).toBe(false);
  });

  it('asks the kind’s own reader whether a payload is publishable', () => {
    expect(isPublishable({ kind: CONTENT_KIND.HELP_TOPIC, payload: topic({ ro: block }) })).toBe(true);
    expect(isPublishable({ kind: CONTENT_KIND.HELP_TOPIC, payload: topic({ en: block }) })).toBe(false);
  });

  it('names the registered locales a payload carries, in the registry’s order', () => {
    expect(payloadLocales(topic({ ru: block, ro: block, de: block }))).toEqual(['ro', 'ru']);
    expect(payloadLocales(null)).toEqual([]);
  });

  it('asks a set’s sign-off for every locale any of its items carries', () => {
    expect(setLocales([topic({ ro: block }), topic({ ro: block, en: block })])).toEqual(['ro', 'en']);
  });
});
