'use client';

import {
  DISCLOSURE_KIND,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureValueWrite,
} from '@easyesg/contracts';
import { DateField, Select, TextArea, TextField } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, type FocusEvent } from 'react';
import {
  BOOLEAN_CHOICE,
  COLUMN_OF_KIND,
  VALUE_COLUMN,
  draftOf,
  parseDecimalInput,
  storedDraftOf,
  writeFor,
} from '../values';
import { ChoiceSet } from './choice-set';
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
 * **Three of those controls arrived with B1** (task 36.2), which is where the plan said they would.
 * `enumeration` is a `Select` over the members task 91.1 put on the read; `enumeration_set` is
 * `ChoiceSet`, a Combobox and the chosen list; `text_block` is the narrative field, which is
 * `TextArea` carrying UX-19's length indication. Each is a different control rather than a flag on
 * an existing one, which is how `Combobox` and `DateField` entered the inventory too. **Still
 * generic, with its owner named**: numeric kinds carry no unit chooser, because the read carries no
 * unit list (UX-14, task 91.4 — `unit_code` stays null until a module sets it).
 *
 * **A pre-filled value commits on blur even though nobody typed it** (FR-27, UX-34). The draft opens
 * at `draftOf` — stored, else the platform's default — while *committed* opens at `storedDraftOf`,
 * which is the stored value alone. The two differ exactly when a default is showing, so leaving the
 * field writes it; §12.5.6's task-91.2 row is what that implements, and `outstandingDefaults` is
 * what covers the fields nobody ever focuses.
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
  // One value, because its three parts move together (the reducer rule): `draft` is what the input
  // shows, `committed` is what this control last sent, `server` is what the field arrived holding.
  // A blur with `draft === committed` writes nothing.
  const [values, setValues] = useState<ControlValues>(() => ({
    draft: draftOf(field),
    // The STORE's value, not the shown one: their difference is a default awaiting the reporter's
    // acceptance, and seeding both from `draftOf` would discard every pre-filled value silently.
    committed: storedDraftOf(field),
    server: draftOf(field),
  }));
  const [invalid, setInvalid] = useState(false);
  // **Never the element key.** `EnergyConsumptionFromFuels` is the example the root file's
  // user-facing-text rule uses by name; a catalogue this locale lacks is a content gap, and the
  // reader gets a neutral word rather than the taxonomy's.
  const label = field.label ?? t('unnamed');
  const column = COLUMN_OF_KIND[field.kind];

  // **An acknowledgement this control did not send still reaches the input.** A queue restored from
  // an earlier tab drains after the page rendered, so the server's value arrives while the input
  // shows the old one; task 35.3's return-path journey is the case. Adopted only while the control
  // holds no edit of its own (`draft === committed`), so typing is never overwritten. Adjusting
  // state from a changed prop during render is React's own idiom for this, not an effect.
  const server = draftOf(field);
  if (server !== values.server) {
    setValues(
      values.draft === values.committed
        ? { draft: server, committed: server, server }
        : { ...values, server },
    );
  }
  const { draft } = values;

  if (readOnly) {
    if (field.kind === DISCLOSURE_KIND.ENUMERATION_SET) {
      return (
        <ChoiceSet
          options={field.options ?? []}
          draft={draft}
          onCommit={() => undefined}
          readOnly
          labelledBy={labelledBy}
          labels={{
            label,
            placeholder: '',
            prompt: '',
            empty: '',
            remove: () => '',
            removeShort: '',
            none: t('unanswered'),
            loading: '',
            unnamed: t('unnamed'),
          }}
        />
      );
    }
    const shown =
      field.kind === DISCLOSURE_KIND.ENUMERATION
        ? enumerationWord(field.options, draft, t('unnamed'))
        : column === VALUE_COLUMN.BOOLEAN
          ? booleanLabel(draft, { yes: t('yes'), no: t('no') })
          : draft;
    return shown === '' ? (
      <p className={styles.readOnlyEmpty}>{t('unanswered')}</p>
    ) : (
      <p className={styles.readOnlyValue}>{shown}</p>
    );
  }

  /** Commit a draft-form value: `''` clears, anything else is the column's value. */
  const commit = (asDraft: string) => {
    if (asDraft === values.committed) return;
    setValues({ ...values, draft: asDraft, committed: asDraft });
    onCommit(writeFor(field, asDraft === '' ? null : asDraft));
  };
  const setDraft = (next: string) => setValues({ ...values, draft: next });

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

  if (field.kind === DISCLOSURE_KIND.ENUMERATION_SET) {
    return (
      <ChoiceSet
        options={field.options ?? []}
        draft={draft}
        onCommit={commit}
        readOnly={false}
        labelledBy={labelledBy}
        labels={{
          label,
          placeholder: t('choose'),
          prompt: t('choicePrompt'),
          empty: t('choiceEmpty'),
          remove: (member) => t('choiceRemove', { member }),
          removeShort: t('choiceRemoveShort'),
          none: t('unanswered'),
          loading: t('choiceLoading'),
          unnamed: t('unnamed'),
        }}
      />
    );
  }

  if (field.kind === DISCLOSURE_KIND.ENUMERATION) {
    return (
      <Select
        label={label}
        labelHidden
        placeholder={t('choose')}
        value={draft === '' ? undefined : draft}
        onValueChange={(choice) => commit(choice)}
        options={(field.options ?? []).map((option) => ({
          value: option.value,
          // A member with no wording of its own falls back to its published code, never to the
          // element key: a taxonomy name is an internal identifier and may not reach a reader.
          // The published code where the wording is missing — a reference someone can cite — and
          // never `option.value`, which is the member's taxonomy-qualified name.
          label: option.label ?? option.code ?? t('unnamed'),
          ...(option.label !== null && option.code !== null ? { description: option.code } : {}),
        }))}
      />
    );
  }

  switch (column) {
    case VALUE_COLUMN.BOOLEAN:
      return (
        <Select
          label={label}
          labelHidden
          placeholder={t('choose')}
          value={draft === '' ? undefined : draft}
          onValueChange={(choice) => commit(choice)}
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
          // UX-19's length indication. No soft target: no reference corpus exists, which the owner
          // deferred rather than let a plausible number read as guidance from the standard.
          count={t('length', { count: draft.length })}
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

interface ControlValues {
  readonly draft: string;
  readonly committed: string;
  readonly server: string;
}

function booleanLabel(draft: string, words: { readonly yes: string; readonly no: string }): string {
  if (draft === BOOLEAN_CHOICE.YES) return words.yes;
  if (draft === BOOLEAN_CHOICE.NO) return words.no;
  return '';
}

/**
 * What a chosen enumeration member is called, read-only.
 *
 * The stored value is the member's taxonomy-qualified name, so falling back to it would print
 * `vsme:IndividualMember` at a reporter — the exact shape the user-facing-text rule forbids. The
 * classification's own code is the honest middle step; a neutral word is the floor.
 */
function enumerationWord(
  options: DisclosureFieldShape['options'],
  draft: string,
  unnamed: string,
): string {
  if (draft === '') return '';
  const chosen = (options ?? []).find((option) => option.value === draft);
  return chosen?.label ?? chosen?.code ?? unnamed;
}
