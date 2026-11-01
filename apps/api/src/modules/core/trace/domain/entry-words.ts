import {
  RAW_VALUE,
  type ChangeEntry,
  type RawAnswer,
  type RawEntry,
  type RawValue,
  type Vocabulary,
  type WordedChange,
} from '../models/change-history.model';
import type { HistoryField } from './history-subjects';

/**
 * The words one subject's entries are stated in, in the reader's language (§12.5.6's task-84 row (3)) — built per
 * request by the trace module's provider, and an interface here so the wording is a unit spec rather than a database's.
 */
export interface ChangeWords {
  /** A field's name in an entry — the history's own, `core.trace.fields.<subject>.<key>`. */
  field(key: string): string;
  /** A closed vocabulary's word from the shared catalogue, or `null` where it has none (row (e)). */
  term(vocabulary: Vocabulary, term: string): string | null;
  /** An activity code with its label — the code alone, a reference a reader can cite, where the classifier lost it. */
  activity(code: string): string;
  /** A disclosure answer as the document prints it (row (d)). */
  answer(answer: RawAnswer): string | null;
  list(items: readonly string[]): string;
}

/**
 * One entry in words. **The subject's own field is worded with no name** — a disclosure field's panel is titled with
 * the field, so its answer's change is the entry's headline — and every other change names its field.
 */
export function wordEntry(input: {
  readonly entry: RawEntry;
  readonly fields: readonly HistoryField[];
  readonly words: ChangeWords;
}): ChangeEntry {
  const { entry, words } = input;
  const subjectFields = new Set(input.fields.filter((field) => field.subject).map((field) => field.key));
  const changes: WordedChange[] = entry.changes.map((change) => ({
    field: subjectFields.has(change.field) ? null : words.field(change.field),
    from: wordValue(change.from, words),
    to: wordValue(change.to, words),
  }));
  return { at: entry.at, actor: entry.actor, source: entry.source, changes };
}

function wordValue(value: RawValue | null, words: ChangeWords): string | null {
  if (value === null) return null;
  switch (value.kind) {
    case RAW_VALUE.TEXT:
      return value.text;
    case RAW_VALUE.TERM:
      return words.term(value.vocabulary, value.term);
    case RAW_VALUE.ACTIVITIES:
      return words.list(value.codes.map((code) => words.activity(code)));
    case RAW_VALUE.ANSWER:
      return words.answer(value.answer);
  }
}

/** Every activity code a page of entries names — what the provider resolves labels for, once per request. */
export const activityCodesOf = (entries: readonly RawEntry[]): readonly string[] => [
  ...new Set(
    entries.flatMap((entry) =>
      entry.changes.flatMap((change) =>
        [change.from, change.to].flatMap((value) => (value?.kind === RAW_VALUE.ACTIVITIES ? value.codes : [])),
      ),
    ),
  ),
];
