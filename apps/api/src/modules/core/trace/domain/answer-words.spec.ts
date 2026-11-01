import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { RawAnswer } from '../models/change-history.model';
import { wordAnswer, type AnswerWords } from './answer-words';

const WORDS: AnswerWords = {
  yes: 'Da',
  no: 'Nu',
  nilReturn: 'Valoare zero declarată',
  notAvailable: 'Indisponibil',
  unit: (code) => ({ m3: 'm³' })[code] ?? code,
  figure: (value) => `<${value}>`,
  percent: (value) => `<${value}%>`,
  date: (date) => `[${date}]`,
  list: (items) => items.join(' + '),
  member: (key) => ({ Organic: 'Ecologic', Recycled: 'Reciclat' })[key] ?? null,
};

const EMPTY: RawAnswer = { state: 'ok', numeric: null, text: null, boolean: null, date: null, unit: null };
const word = (answer: Partial<RawAnswer>, kind: Parameters<typeof wordAnswer>[0]['kind'], currency: string | null = null) =>
  wordAnswer({ answer: { ...EMPTY, ...answer }, kind, currency, words: WORDS });

describe('wordAnswer', () => {
  it('words a declared zero and a declared gap by their marks, whatever the columns hold', () => {
    expect(word({ state: 'nil_return', numeric: '0' }, DISCLOSURE_KIND.NUMERIC)).toBe('Valoare zero declarată');
    expect(word({ state: 'not_available' }, DISCLOSURE_KIND.TEXT)).toBe('Indisponibil');
  });

  it('words each kind from its own column', () => {
    expect(word({ numeric: '1240', unit: 'm3' }, DISCLOSURE_KIND.NUMERIC)).toBe('<1240> m³');
    expect(word({ numeric: '12500' }, DISCLOSURE_KIND.MONETARY, 'MDL')).toBe('<12500> MDL');
    expect(word({ numeric: '0.25' }, DISCLOSURE_KIND.PERCENT)).toBe('<0.25%>');
    expect(word({ boolean: 'false' }, DISCLOSURE_KIND.BOOLEAN)).toBe('Nu');
    expect(word({ date: '2026-12-31' }, DISCLOSURE_KIND.DATE)).toBe('[2026-12-31]');
    expect(word({ text: '2025' }, DISCLOSURE_KIND.YEAR)).toBe('2025');
    expect(word({ text: 'Politica este publicată.' }, DISCLOSURE_KIND.TEXT_BLOCK)).toBe('Politica este publicată.');
  });

  it('words a choice by its members’ labels, and never by a member key the version does not word', () => {
    expect(word({ text: 'Organic Recycled' }, DISCLOSURE_KIND.ENUMERATION_SET)).toBe('Ecologic + Reciclat');
    expect(word({ text: 'Organic Unworded' }, DISCLOSURE_KIND.ENUMERATION_SET)).toBe('Ecologic');
    expect(word({ text: 'Unworded' }, DISCLOSURE_KIND.ENUMERATION)).toBeNull();
  });

  it('reads whichever column holds a value where the kind is unknown, and holds nothing as nothing', () => {
    expect(word({ numeric: '7', unit: 'm3' }, null)).toBe('<7> m³');
    expect(word({ boolean: 'true' }, null)).toBe('Da');
    expect(word({ text: 'SomeMemberKey' }, null)).toBeNull();
    expect(word({}, DISCLOSURE_KIND.NUMERIC)).toBeNull();
  });
});
