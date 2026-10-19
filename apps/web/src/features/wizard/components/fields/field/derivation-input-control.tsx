'use client';

import type { DerivationInput, DerivationInputWrite } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { NumberField } from '@/shared/number-field';
import { useAutosaveContext } from '../../providers/autosave-context';
import { FIELD_MESSAGES } from '../shared/step-messages';

/**
 * One value a derived figure is computed from (task 36.10; UC-26, UC-27).
 *
 * **`TextField` rather than `DisclosureField`, and the difference is the point.** UX-89 asks whether
 * the *anatomy* differs, and it does: `DisclosureField` requires UX-15's not-available declaration,
 * because every disclosure a reader sees may be deliberately unanswered with a reason. This is not a
 * disclosure — it is not filed, not exported and not validated — so it has no such state, and
 * passing `null` into that required slot would be asserting it does. What is left is a label, help
 * and one numeric control, which is `TextField` exactly. No inventory addition either way.
 *
 * **The published offer is a placeholder, never a written value.** EFRAG prints 2 000 hours and says
 * an undertaking may change it; showing it as the field's value would make an offer the reporter has
 * never looked at indistinguishable from a figure they chose — and the api computes with the offer
 * either way, so nothing is lost by leaving the box empty. That is the same distinction
 * `DisclosureField`'s own `defaultValue` draws for an entity-record answer (task 91.2).
 *
 * **`NumberField` since task 220**, as every typed number is: read by the language's own marks, asked about where it
 * reads two ways, shown in the reader's format, and an unreadable draft now says so rather than staying silently unsent.
 */
export function DerivationInputControl({
  input,
  readOnly,
  label,
  help,
}: {
  readonly input: DerivationInput;
  readonly readOnly: boolean;
  readonly label: string;
  readonly help: string;
}) {
  const t = useTranslations(FIELD_MESSAGES);
  const { change } = useAutosaveContext();

  return (
    <NumberField
      label={label}
      help={help}
      value={input.value ?? ''}
      // The published offer, shown as what the field will mean if left empty — never written. EFRAG
      // prints 2 000 hours and permits changing it, so filling the box with 2 000 would make an
      // offer nobody looked at indistinguishable from a figure someone chose. The api computes with
      // the offer regardless, so the empty box costs nothing and says something true.
      placeholder={input.offered ?? undefined}
      readOnly={readOnly}
      invalidWords={t('invalidNumber')}
      onCommit={(value) => {
        // Annotated rather than inferred: the queue takes a union, and an inline literal lets
        // TypeScript match it against the disclosure arm first and report a confusing mismatch.
        const write: DerivationInputWrite = { inputKey: input.key, valueNumeric: value };
        change(write);
        return null;
      }}
    />
  );
}
