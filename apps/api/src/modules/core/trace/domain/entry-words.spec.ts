import { CHANGE_SOURCE, HISTORY_SUBJECT, RAW_VALUE, VOCABULARY, type RawEntry } from '../models/change-history.model';
import { HISTORY_SUBJECTS } from './history-subjects';
import { activityCodesOf, wordEntry, type ChangeWords } from './entry-words';

const WORDS: ChangeWords = {
  field: (key) => `«${key}»`,
  term: (vocabulary, term) => (vocabulary === VOCABULARY.LEGAL_FORMS && term === 'srl' ? 'Societate cu răspundere limitată (SRL)' : null),
  activity: (code) => `${code} · label`,
  answer: (answer) => (answer.numeric === null ? null : `${answer.numeric} t`),
  list: (items) => items.join('; '),
};

const AT = new Date('2026-08-04T11:31:00Z');

describe('wordEntry', () => {
  it('names every field but the subject’s own, and words each value by its kind', () => {
    const entry: RawEntry = {
      at: AT,
      actor: null,
      source: CHANGE_SOURCE.OVERRIDDEN,
      changes: [
        {
          field: 'answer',
          from: { kind: RAW_VALUE.ANSWER, answer: { state: 'ok', numeric: '3.2', text: null, boolean: null, date: null, unit: 't' } },
          to: { kind: RAW_VALUE.ANSWER, answer: { state: 'ok', numeric: '3.5', text: null, boolean: null, date: null, unit: 't' } },
        },
        { field: 'explanation', from: null, to: { kind: RAW_VALUE.TEXT, text: 'Contorul a fost înlocuit.' } },
      ],
    };
    expect(wordEntry({ entry, fields: HISTORY_SUBJECTS[HISTORY_SUBJECT.VALUE].fields, words: WORDS })).toEqual({
      at: AT,
      actor: null,
      source: CHANGE_SOURCE.OVERRIDDEN,
      changes: [
        { field: null, from: '3.2 t', to: '3.5 t' },
        { field: '«explanation»', from: null, to: 'Contorul a fost înlocuit.' },
      ],
    });
  });

  it('words a vocabulary’s member and a list of activities, and leaves an unworded member unworded', () => {
    const entry: RawEntry = {
      at: AT,
      actor: { accountId: 'a-1', name: 'Ana Rusu', removed: false },
      source: null,
      changes: [
        {
          field: 'legalForm',
          from: { kind: RAW_VALUE.TERM, vocabulary: VOCABULARY.LEGAL_FORMS, term: 'srl' },
          to: { kind: RAW_VALUE.TERM, vocabulary: VOCABULARY.LEGAL_FORMS, term: 'unworded' },
        },
        { field: 'activities', from: null, to: { kind: RAW_VALUE.ACTIVITIES, codes: ['10.71', '11.02'] } },
      ],
    };
    const worded = wordEntry({ entry, fields: HISTORY_SUBJECTS[HISTORY_SUBJECT.ENTITY].fields, words: WORDS });
    expect(worded.changes).toEqual([
      { field: '«legalForm»', from: 'Societate cu răspundere limitată (SRL)', to: null },
      { field: '«activities»', from: null, to: '10.71 · label; 11.02 · label' },
    ]);
    expect(activityCodesOf([entry, entry])).toEqual(['10.71', '11.02']);
  });
});
