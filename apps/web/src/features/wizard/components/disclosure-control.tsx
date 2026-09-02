'use client';

import {
  DISCLOSURE_KIND,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureValueWrite,
} from '@easyesg/contracts';
import { DateField, Select, TextArea, TextField } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRef, useState, type FocusEvent } from 'react';
import {
  BOOLEAN_CHOICE,
  COLUMN_OF_KIND,
  VALUE_COLUMN,
  draftOf,
  parseDecimalInput,
  writeFor,
} from '../values';
import styles from './step.module.css';

/**
 * The control for one field's kind — the slot §6.2's anatomy leaves open (task 35.2).
 *
 * **Ten kinds, four controls, one commit rule.** A control commits on blur (FR-37, UX-34) — or, for
 * a choice, on the choice — and only when the draft differs from what the field last committed, so
 * tabbing through a step writes nothing. The draft is the input's own `useState`: one value nothing
 * else moves with, which is the case the reducer rule leaves to a single state.
 *
 * **The visible label is the group's, and it is the input's programmatic label.** UX-110 requires
 * *"a programmatically associated visible label"*, and §6.2's anatomy draws the words once — so the
 * input carries `aria-labelledby` pointing at `DisclosureField`'s visible label (the association
 * that outranks a `<label for>` in name computation), and its own `<label>` is visually hidden
 * rather than rendered as a second copy of the words; it stays for click-to-focus. `labelHidden` is
 * `Select`'s existing answer, extended to the text controls for this caller. The boolean `Select`
 * keeps the hidden label as its name: Radix's trigger takes no `aria-labelledby` through this API.
 *
 * **What is deliberately generic here, and who refines it.** `enumeration` and `enumeration_set`
 * render as text because the step read carries no domain members — task 36.2 (B1, where ten of the
 * two kinds live) is where the domain reaches the browser. `text_block` is a plain textarea, not UX-19's
 * narrative control with its soft target (task 36.1's recorded gap, task 36.2's first act). Numeric
 * kinds carry no unit chooser, because the read carries no unit list (UX-14; the module that first
 * needs one adds it). None of these is a boolean prop waiting to be added: each is a different
 * control, and arrives as one.
 *
 * **A number that is not a number is refused at the field and never sent.** The column is
 * `numeric`; the database would refuse it with a message no reader can act on. The refusal here is
 * NFR-79's three parts, inline, and the draft is kept so nothing typed is lost.
 */
export function DisclosureControl({
  field,
  readOnly,
  labelledBy,
  onCommit,
}: {
  readonly field: DisclosureFieldShape;
  readonly readOnly: boolean;
  /** The id of the visible label the input is named by. */
  readonly labelledBy: string;
  readonly onCommit: (write: DisclosureValueWrite) => void;
}) {
  const t = useTranslations('organization.wizard.field');
  const [draft, setDraft] = useState(() => draftOf(field));
  const [invalid, setInvalid] = useState(false);
  // What the field is known to hold, in draft form — so a blur with nothing changed writes nothing.
  const committed = useRef(draftOf(field));
  const label = field.label ?? field.elementKey;
  const column = COLUMN_OF_KIND[field.kind];

  if (readOnly) {
    const shown = column === VALUE_COLUMN.BOOLEAN ? booleanLabel(draft, { yes: t('yes'), no: t('no') }) : draft;
    return shown === '' ? (
      <p className={styles.readOnlyEmpty}>{t('unanswered')}</p>
    ) : (
      <p className={styles.readOnlyValue}>{shown}</p>
    );
  }

  /** Commit a draft-form value: `''` clears, anything else is the column's value. */
  const commit = (asDraft: string) => {
    if (asDraft === committed.current) return;
    committed.current = asDraft;
    onCommit(writeFor(field, asDraft === '' ? null : asDraft));
  };

  const onTextBlur = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = event.currentTarget.value;
    if (column !== VALUE_COLUMN.NUMERIC) {
      commit(raw.trim() === '' ? '' : raw);
      return;
    }
    const parsed = parseDecimalInput(raw);
    if ('invalid' in parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    commit(parsed.value ?? '');
  };

  switch (column) {
    case VALUE_COLUMN.BOOLEAN:
      return (
        <Select
          label={label}
          labelHidden
          placeholder={t('choose')}
          value={draft === '' ? undefined : draft}
          onValueChange={(choice) => {
            setDraft(choice);
            commit(choice);
          }}
          options={[
            { value: BOOLEAN_CHOICE.YES, label: t('yes') },
            { value: BOOLEAN_CHOICE.NO, label: t('no') },
          ]}
        />
      );
    case VALUE_COLUMN.DATE:
      return (
        <DateField
          label={label}
          labelHidden
          aria-labelledby={labelledBy}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={onTextBlur}
        />
      );
    case VALUE_COLUMN.NUMERIC:
      return (
        <TextField
          label={label}
          labelHidden
          aria-labelledby={labelledBy}
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={onTextBlur}
          error={invalid ? t('invalidNumber') : undefined}
        />
      );
    default:
      return field.kind === DISCLOSURE_KIND.TEXT_BLOCK ? (
        <TextArea
          label={label}
          labelHidden
          aria-labelledby={labelledBy}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={onTextBlur}
        />
      ) : (
        <TextField
          label={label}
          labelHidden
          aria-labelledby={labelledBy}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={onTextBlur}
        />
      );
  }
}

function booleanLabel(draft: string, words: { readonly yes: string; readonly no: string }): string {
  if (draft === BOOLEAN_CHOICE.YES) return words.yes;
  if (draft === BOOLEAN_CHOICE.NO) return words.no;
  return '';
}
