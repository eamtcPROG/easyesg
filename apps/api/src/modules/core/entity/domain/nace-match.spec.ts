import { MATCH, rankOf, readQuery } from './nace-match';

/**
 * Task 208: how a classifier entry answers a query, rank by rank. `search-nace-codes.use-case.spec.ts` holds the
 * ordering a reader sees across a classifier; this holds each rank against one entry, and the reading it rests on.
 */
const entry = (code: string, label: string) => ({ code, label });

describe('readQuery', () => {
  it('reads the comma-below and the cedilla forms alike, and drops every diacritic and capital', () => {
    expect(readQuery('Chișinău').folded).toBe('chisinau');
    expect(readQuery('Chişinău').folded).toBe('chisinau');
    expect(readQuery('PÂINE').folded).toBe('paine');
  });

  it('leaves Cyrillic its letters, lower-cased', () => {
    expect(readQuery('ХЛЕБ').words).toEqual(['хлеб']);
  });

  it('cuts the query into words, and reads its digits apart', () => {
    expect(readQuery('  fabricarea   pâinii, 10.71 ')).toMatchObject({
      // Runs of space become one; the ends are the use case's to trim, and it does.
      folded: ' fabricarea painii, 10.71 ',
      words: ['fabricarea', 'painii', '10', '71'],
    });
    expect(readQuery('10.71').digits).toBe('1071');
  });

  it('stems a word of five letters or more by its last two, and keeps a shorter one whole', () => {
    expect(readQuery('paine pain хлеба').stems).toEqual(['pai', 'pain', 'хле']);
  });
});

describe('rankOf', () => {
  const PAINE = entry('10.71', 'Fabricarea pâinii; fabricarea prăjiturilor');
  const ROAD = entry('49.41', 'Transporturi rutiere de mărfuri');
  const SHIPS = entry('33.15', 'Repararea mijloacelor de transport naval');

  it('answers a code whose digits begin with what was typed, before reading its label', () => {
    expect(rankOf(readQuery('10.7'), PAINE)).toBe(MATCH.CODE);
    expect(rankOf(readQuery('c'), entry('C', 'Industria prelucrătoare'))).toBe(MATCH.CODE);
  });

  it('answers a label that begins with what was typed', () => {
    expect(rankOf(readQuery('transporturi rut'), ROAD)).toBe(MATCH.LABEL_START);
  });

  it('answers a label each typed word begins a word of, in any order', () => {
    expect(rankOf(readQuery('marfuri rutiere'), ROAD)).toBe(MATCH.WORD_START);
  });

  it('answers a label a typed word reaches only without its ending, below a whole word', () => {
    expect(rankOf(readQuery('paine'), PAINE)).toBe(MATCH.STEM);
    expect(rankOf(readQuery('painii'), PAINE)).toBe(MATCH.WORD_START);
  });

  it('answers a label that holds every typed word inside a word, last', () => {
    expect(rankOf(readQuery('ansport'), SHIPS)).toBe(MATCH.WITHIN);
  });

  it('answers nothing for a label that holds none of it, and for a query with nothing to match', () => {
    expect(rankOf(readQuery('pax'), PAINE)).toBeNull();
    expect(rankOf(readQuery('—'), PAINE)).toBeNull();
  });

  it('answers nothing where only some of the words typed are in the label', () => {
    // Every word must answer, at every rank: one road-haulage word and one stranger is not a road-haulage query.
    expect(rankOf(readQuery('marfuri autobuze'), ROAD)).toBeNull();
  });

  it('never matches a short word through a stem it does not have', () => {
    // Four letters keep every one. Cut to `pa`, `pari` would begin *pâinii* and match.
    expect(rankOf(readQuery('pari'), PAINE)).toBeNull();
  });
});
