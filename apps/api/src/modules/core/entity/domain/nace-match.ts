import { bareCode } from './nace-code';

/**
 * How well a classifier entry answers what the reader typed (FR-17, task 30.4.1; project owner, 28 Sep 2026): the
 * query read once, and each entry ranked against it — a code by its digits, a label by its words in any order, with or
 * without diacritics and inflected endings.
 *
 * **Pure, and out of `NaceCodeLookup`** (task 208). The use case reads the organization's classifier and labels each
 * entry in the reader's language; what makes one entry a better answer than another is this file's, so every rank and
 * the stem's threshold are unit cases with no store.
 */

/**
 * Diacritic- and case-insensitive comparison text.
 *
 * **NFD then strip the combining marks**, which is the whole reason this exists: a Moldovan reader
 * types `brutarie` for *brutărie* and `Chisinau` for *Chișinău*, and Romanian's comma-below `ș`/`ț`
 * decompose exactly as the cedilla forms do — so a search that compared raw strings would answer
 * nothing for the spelling most people actually type. Cyrillic is unaffected and passes through.
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** A label or a query cut into its words — letters and digits in any script, everything else a gap. */
const wordsOf = (folded: string): string[] => folded.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');

/**
 * How well an entry answers the query, best first — the order results are ranked in, and within one
 * rank the classifier's own order holds. Declared as a vocabulary because the numbers are compared,
 * and a literal `2` at the comparison would say nothing about what it outranks.
 */
export const MATCH = {
  /** The digits typed begin the entry's code. */
  CODE: 0,
  /** The label begins with what was typed. */
  LABEL_START: 1,
  /** Every word typed begins a word of the label, in any order. */
  WORD_START: 2,
  /** Every word typed, less an inflected ending, begins a word of the label. */
  STEM: 3,
  /** Every word typed appears somewhere inside the label. */
  WITHIN: 4,
} as const;

export type MatchRank = (typeof MATCH)[keyof typeof MATCH];

/** What the reader typed, read once per search rather than once per entry. */
export interface Reading {
  readonly folded: string;
  readonly digits: string;
  readonly words: readonly string[];
  readonly stems: readonly string[];
}

/**
 * **A word loses its last two letters as a stem once it is longer than four**, because Romanian and
 * Russian inflect at the end: a reader types *pâine* and the classifier says *pâinii*, types *хлеб* and
 * it says *хлеба*. Shorter words keep every letter, since cutting *pâin* to *pâ* would match half the
 * classifier. A stem match ranks below a whole-word one, so an exact word still comes first.
 */
const STEM_FROM = 5;
const STEM_CUT = 2;
const stemOf = (word: string): string => (word.length >= STEM_FROM ? word.slice(0, -STEM_CUT) : word);

export const readQuery = (query: string): Reading => {
  const folded = fold(query).replace(/\s+/gu, ' ');
  const words = wordsOf(folded);
  return { folded, digits: bareCode(query), words, stems: words.map(stemOf) };
};

/** The entry's rank for this query, or null where it does not answer it. */
export const rankOf = (reading: Reading, entry: { readonly code: string; readonly label: string }): MatchRank | null => {
  if (reading.digits !== '' && bareCode(entry.code).startsWith(reading.digits)) return MATCH.CODE;
  if (reading.words.length === 0) return null;

  const label = fold(entry.label);
  if (label.startsWith(reading.folded)) return MATCH.LABEL_START;

  const labelWords = wordsOf(label);
  const beginsAWord = (start: string): boolean => labelWords.some((word) => word.startsWith(start));
  if (reading.words.every(beginsAWord)) return MATCH.WORD_START;
  if (reading.stems.every(beginsAWord)) return MATCH.STEM;
  if (reading.words.every((word) => label.includes(word))) return MATCH.WITHIN;
  return null;
};
