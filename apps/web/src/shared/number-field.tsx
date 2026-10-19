'use client';

import { TextField } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useReducer, type ReactNode } from 'react';
import { decimalForEditing, decimalForReading, parseDecimalInput, type DecimalReading } from '@/lib/decimal-input';
import {
  NUMBER_EVENT,
  NUMBER_PROBLEM,
  currentValue,
  initialNumberEntry,
  numberEntryReducer,
  problemWords,
} from '@/lib/number-entry';
import { NumberChoice } from './number-choice';

/**
 * A number typed and committed when the reader leaves it (task 220; UX-34, UX-96; `architecture.md` §12.5.6's task-220
 * row): **shown in the reader's format at rest and plainly while edited**, read by the language's own marks, and **asked
 * about where it reads two ways** — the question as the field's error, the two readings as buttons beneath it — so a
 * Romanian `1.240` is never stored as 1,24 unasked.
 *
 * **It takes and hands on the canonical decimal string** (NFR-58) and knows nothing of what the number is for: the caller
 * says what a value that is not a number is called (`invalidWords`), may read more strictly than any decimal (`read` —
 * S-09's figures refuse a negative), and decides in `onCommit` whether the value changed and whether it may be stored,
 * answering the refusal's words or `null`. **`onCommit` is called on every leave that read a number**, changed or not,
 * because S-07's pre-filled value is accepted by leaving it untouched (FR-27, UX-34) — the caller knows what it last
 * stored, and this does not.
 *
 * **In `shared/` on its admission test**: S-07's numeric fields and derivation inputs and S-09's figure and months draw
 * it. A Client Component because it holds the text being edited.
 */
export function NumberField({
  label,
  labelHidden = false,
  labelledBy,
  help,
  placeholder,
  readOnly = false,
  value,
  invalidWords,
  read,
  onCommit,
}: {
  readonly label: string;
  readonly labelHidden?: boolean;
  /** The id of a visible label elsewhere that names the input (UX-110), as a disclosure field's question does. */
  readonly labelledBy?: string;
  readonly help?: ReactNode;
  /** A canonical value shown faintly where none is stored — S-07's published offer — laid out like the value. */
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  /** The stored value, canonical, `''` for none. */
  readonly value: string;
  /** NFR-79's three parts for a text that is not a number, in the caller's words. */
  readonly invalidWords: string;
  /** A stricter reading than any decimal's; the language's own by default. */
  readonly read?: (raw: string) => DecimalReading;
  /** The value read, canonical, or `null` for an emptied field. Answers the refusal's words, or `null`. */
  readonly onCommit: (value: string | null) => string | null;
}) {
  const t = useTranslations('forms.number');
  const format = useFormatter();
  const [state, dispatch] = useReducer(numberEntryReducer, value, initialNumberEntry);
  // A value arriving from outside — an acknowledgement, another tab's answer — replaces what is shown at rest.
  // Adjusting state from a changed prop during render is React's own idiom for this, not an effect.
  if (value !== state.given) dispatch({ type: NUMBER_EVENT.VALUE_ARRIVED, value });
  const current = currentValue(state);
  const reader = read ?? ((raw: string) => parseDecimalInput({ raw, format }));

  const handOn = (next: string | null): void => {
    const refusal = onCommit(next);
    dispatch(
      refusal === null
        ? { type: NUMBER_EVENT.HANDED_ON, value: next ?? '' }
        : { type: NUMBER_EVENT.REFUSED, words: refusal },
    );
  };

  const leave = (): void => {
    if (state.text === null) return;
    const reading = reader(state.text);
    if ('invalid' in reading) dispatch({ type: NUMBER_EVENT.LEFT_UNREAD });
    else if ('ambiguous' in reading) dispatch({ type: NUMBER_EVENT.LEFT_AMBIGUOUS, readings: reading.ambiguous });
    else handOn(reading.value);
  };

  const shown = state.text ?? (current === '' ? '' : decimalForReading({ value: current, format }));
  const problem = state.problem;

  return (
    <div>
      <TextField
        label={label}
        labelHidden={labelHidden}
        aria-labelledby={labelledBy}
        help={help}
        placeholder={placeholder === undefined ? undefined : decimalForReading({ value: placeholder, format })}
        readOnly={readOnly}
        inputMode="decimal"
        value={shown}
        onFocus={() => {
          if (!readOnly) {
            dispatch({ type: NUMBER_EVENT.FOCUSED, text: current === '' ? '' : decimalForEditing({ value: current, format }) });
          }
        }}
        onChange={(event) => dispatch({ type: NUMBER_EVENT.TYPED, text: event.currentTarget.value })}
        onBlur={leave}
        error={problemWords({ problem, typed: state.text ?? '', invalidWords, ambiguousWords: (typed) => t('ambiguous', { typed }) })}
      />
      {problem?.kind === NUMBER_PROBLEM.AMBIGUOUS ? <NumberChoice readings={problem.readings} onChoose={handOn} /> : null}
    </div>
  );
}
