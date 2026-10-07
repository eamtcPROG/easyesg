import type { FieldAddress } from './field-value.js';
import type { Verdict } from './verdict.js';

/**
 * What a rule says about a field (task 40.2; FR-40, FR-42) — the row task 41.2 stores per report and the inline state
 * task 42.1 shows.
 *
 * **It carries everything its message needs and none of its wording.** The rule's message key is resolved in the
 * reader's locale (OQ-43), and the values it quotes are canonical decimal text or the address verbatim, which the
 * reader's locale formats (NFR-26) — so a finding is the same bytes in the api and in the browser, and the same
 * finding read in Romanian and in English.
 */
export interface Finding {
  /** The rule's id within its set. */
  readonly rule: string;
  readonly verdict: Verdict;
  /** The field the finding sits on — what its deep link lands on (FR-42). */
  readonly field: FieldAddress;
  /** The fields it conflicts with, or that answer it instead, linked beside it (FR-42 item 4). Empty where none. */
  readonly related: readonly FieldAddress[];
  /** The rule's catalogue key. */
  readonly message: string;
  /** The values the message quotes, by name. Empty where it quotes none. */
  readonly params: Readonly<Record<string, string>>;
}
