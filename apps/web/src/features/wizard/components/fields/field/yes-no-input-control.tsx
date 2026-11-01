'use client';

import { YES_NO_INPUT, type DerivationInput, type DerivationInputWrite } from '@easyesg/contracts';
import { RadioGroup } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAutosaveContext } from '../../providers/autosave-context';
import { FIELD_MESSAGES } from '../shared/step-messages';

/**
 * One derivation input answered yes or no (task 79.8; `architecture.md` §12.5.6's task-79.8 row) — C8's revenue
 * thresholds, the template's own checkboxes, drawn as the yes/no cards every boolean disclosure is (task 179.2) and
 * written as `1` or `0`, the number the input is held as.
 *
 * **Its own file, beside `DerivationInputControl`, which chooses it**: a different control for the same anatomy — label,
 * help and the answer — as the number field is. **The choice is held here**, a radio group having no draft of its own,
 * and the input's value adopted while it changes beneath it — a queue restored from another tab drains after the page
 * rendered — `DisclosureControl`'s idiom: adjusting state from a changed prop during render.
 */
export function YesNoInputControl({
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
  // One value with its source, because the two move together: what is chosen, and the value it was last aligned to.
  const [held, setHeld] = useState({ chosen: input.value, served: input.value });
  if (input.value !== held.served) setHeld({ chosen: input.value, served: input.value });

  return (
    <RadioGroup
      label={label}
      help={help}
      options={[
        { value: YES_NO_INPUT.YES, label: t('yes') },
        { value: YES_NO_INPUT.NO, label: t('no') },
      ]}
      value={held.chosen ?? undefined}
      disabled={readOnly}
      onValueChange={(value) => {
        // Functional, so the choice never pairs with a stale `served` from the render this handler closed over.
        setHeld((current) => ({ chosen: value, served: current.served }));
        const write: DerivationInputWrite = { inputKey: input.key, valueNumeric: value };
        change(write);
      }}
    />
  );
}
