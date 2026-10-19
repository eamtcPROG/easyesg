/**
 * What a number field holds between the reader's keystrokes and the stored value (task 220; `architecture.md` §12.5.6's
 * task-220 row): the text being edited, the value this field last handed on, and why what was typed was not.
 *
 * **One reducer, because one event writes several of them**: leaving the field settles the text, the problem and the held
 * value together, and the reader typing again clears the problem while keeping the rest — the root `CLAUDE.md`'s reducer
 * rule. **The text is `null` while the field is not being edited**, which is what lets the field show the stored value in
 * the reader's format at rest and plainly while edited (UX-96) without a second flag saying which.
 *
 * **`held` is what this field handed on, shown until the value it was given catches up** — a calculator line is written
 * through the queue and its stored figure arrives later, so without it the field would show the old figure between the
 * reader leaving and the api answering. A different value arriving from outside (`VALUE_ARRIVED`) drops it.
 *
 * In `lib/` beside `decimal-input.ts`, whose readings it holds, because `shared/number-field.tsx` reads it and the
 * folder rule keeps a pure module out of a files-only component leaf.
 */
export const NUMBER_EVENT = {
  FOCUSED: 'focused',
  TYPED: 'typed',
  LEFT_UNREAD: 'left-unread',
  LEFT_AMBIGUOUS: 'left-ambiguous',
  REFUSED: 'refused',
  HANDED_ON: 'handed-on',
  VALUE_ARRIVED: 'value-arrived',
} as const;

export const NUMBER_PROBLEM = {
  UNREAD: 'unread',
  AMBIGUOUS: 'ambiguous',
  REFUSED: 'refused',
} as const;

export interface NumberReadings {
  readonly thousands: string;
  readonly decimal: string;
}

export type NumberProblem =
  | { readonly kind: typeof NUMBER_PROBLEM.UNREAD }
  | { readonly kind: typeof NUMBER_PROBLEM.AMBIGUOUS; readonly readings: NumberReadings }
  | { readonly kind: typeof NUMBER_PROBLEM.REFUSED; readonly words: string };

export interface NumberEntry {
  /** What the reader is editing, or `null` while the field is not being edited. */
  readonly text: string | null;
  /** The canonical value this field last handed on, until the value it is given moves. */
  readonly held: string | null;
  /** The value the field was given, as of the last render — what `VALUE_ARRIVED` compares against. */
  readonly given: string;
  readonly problem: NumberProblem | null;
}

export type NumberEvent =
  | { readonly type: typeof NUMBER_EVENT.FOCUSED; readonly text: string }
  | { readonly type: typeof NUMBER_EVENT.TYPED; readonly text: string }
  | { readonly type: typeof NUMBER_EVENT.LEFT_UNREAD }
  | { readonly type: typeof NUMBER_EVENT.LEFT_AMBIGUOUS; readonly readings: NumberReadings }
  | { readonly type: typeof NUMBER_EVENT.REFUSED; readonly words: string }
  | { readonly type: typeof NUMBER_EVENT.HANDED_ON; readonly value: string }
  | { readonly type: typeof NUMBER_EVENT.VALUE_ARRIVED; readonly value: string };

export const initialNumberEntry = (given: string): NumberEntry => ({ text: null, held: null, given, problem: null });

export function numberEntryReducer(state: NumberEntry, event: NumberEvent): NumberEntry {
  switch (event.type) {
    case NUMBER_EVENT.FOCUSED:
      // Returning to a field that holds a refused text keeps it, so nothing typed is lost.
      return state.text === null ? { ...state, text: event.text } : state;
    case NUMBER_EVENT.TYPED:
      return { ...state, text: event.text, problem: null };
    case NUMBER_EVENT.LEFT_UNREAD:
      return { ...state, problem: { kind: NUMBER_PROBLEM.UNREAD } };
    case NUMBER_EVENT.LEFT_AMBIGUOUS:
      return { ...state, problem: { kind: NUMBER_PROBLEM.AMBIGUOUS, readings: event.readings } };
    case NUMBER_EVENT.REFUSED:
      return { ...state, problem: { kind: NUMBER_PROBLEM.REFUSED, words: event.words } };
    case NUMBER_EVENT.HANDED_ON:
      return { ...state, text: null, held: event.value, problem: null };
    case NUMBER_EVENT.VALUE_ARRIVED:
      return { ...state, given: event.value, held: null };
  }
}

/** The canonical value the field stands for: what it handed on, else what it was given. */
export const currentValue = (state: NumberEntry): string => state.held ?? state.given;

/**
 * What the field says beneath itself for a problem — the caller's words for a text that is not a number, the question for
 * one that reads two ways, quoting what was typed, and the caller's refusal as it was given.
 */
export function problemWords(input: {
  readonly problem: NumberProblem | null;
  readonly typed: string;
  readonly invalidWords: string;
  readonly ambiguousWords: (typed: string) => string;
}): string | undefined {
  if (input.problem === null) return undefined;
  switch (input.problem.kind) {
    case NUMBER_PROBLEM.UNREAD:
      return input.invalidWords;
    case NUMBER_PROBLEM.AMBIGUOUS:
      return input.ambiguousWords(input.typed);
    case NUMBER_PROBLEM.REFUSED:
      return input.problem.words;
  }
}
