'use client';

import { INPUT_ANSWER, type DerivationInput } from '@easyesg/contracts';
import { derivationInputField } from '@easyesg/validation';
import { writeKey } from '../../../tools/autosave-state';
import { fieldAnchor } from '../../../tools/field-anchor';
import { TONE_OF_STATE } from '../../../tools/field-tone';
import { useFieldFindings } from '../../providers/validation-context';
import styles from '../styles/step.module.css';
import { FindingMessages } from './finding-messages';
import { NumberInputControl } from './number-input-control';
import { YesNoInputControl } from './yes-no-input-control';

/**
 * One value a derived figure is computed from (task 36.10; UC-26, UC-27) — a number (`NumberInputControl`), or since
 * task 79.8 a yes or a no where the api says the input is answered so (`answer`, its formula's): C8's revenue
 * thresholds, the template's own checkboxes, which `YesNoInputControl` draws.
 *
 * **Validated since task 254** (`architecture.md` §12.5.6's task-254 row (1)): a rule requires the input, never the
 * figure computed from it, so the input's findings are drawn here, beneath its box, by the key the queue addresses it
 * with — most severe first, in the first one's tone, as a field's message is — and the group carries the anchor a
 * finding's address ends in (`fieldAnchor`), so S-08's link lands focus in this box (`focusField`).
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
  const key = writeKey({ elementKey: derivationInputField(input.key) });
  const findings = useFieldFindings(key);
  const verdict = findings[0]?.verdict;

  return (
    <div role="group" id={fieldAnchor(key)} aria-label={label}>
      {input.answer === INPUT_ANSWER.YES_NO ? (
        <YesNoInputControl input={input} readOnly={readOnly} label={label} help={help} />
      ) : (
        <NumberInputControl input={input} readOnly={readOnly} label={label} help={help} />
      )}
      {verdict === undefined ? null : (
        <div className={styles.inputFinding} data-tone={TONE_OF_STATE[verdict]} role="status">
          <FindingMessages findings={findings} />
        </div>
      )}
    </div>
  );
}
