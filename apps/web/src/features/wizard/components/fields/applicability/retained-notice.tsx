import type { DisclosureField } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { hiddenReason, keptWords } from '../../../tools/applicability-words';
import { keptAnswerOf } from '../../../tools/kept-answer';
import { unitWords } from '../../../tools/unit-words';
import { APPLICABILITY_MESSAGES, FIELD_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';

/**
 * **UX-28: a hidden field's answer is kept, said where the field stood** (task 95; `architecture.md` §12.5.6's task-95
 * row (2)) — the C9 artboard's *"Hidden because C9-1 is nil. Your earlier answer has been kept and will come back if
 * that changes. Kept from 4 April: …"*.
 *
 * **A notice, never the field**: no control, no marker, nothing to answer, so task 36.9's *an inapplicable field is not
 * rendered* still holds for the field — what is drawn is the statement about it, which UX-28 requires the reader be
 * given. Its label, why it is hidden, the promise, and the kept answer where one can be quoted without an identifier
 * (`keptAnswerOf`).
 *
 * App-local rather than an inventory addition (UX-89 as amended 14 Sep 2026): only the tenant wizard hides a field, and
 * it takes its colours, space and type from the token cascade alone. No directive: drawn inside `StepFields`, a client
 * boundary already.
 */
export function RetainedNotice({ field }: { readonly field: DisclosureField }) {
  const t = useTranslations(APPLICABILITY_MESSAGES);
  const tField = useTranslations(FIELD_MESSAGES);
  const tUnit = useTranslations(`${FIELD_MESSAGES}.units`);
  const format = useFormatter();
  const kept = keptAnswerOf(field);

  return (
    <div className={styles.retained}>
      <p className={styles.retainedLabel}>{field.label ?? tField('unnamed')}</p>
      <p className={styles.retainedReason}>
        {field.applicabilityCause === null ? null : `${hiddenReason(t, format, field.applicabilityCause)} `}
        {t('hidden.kept')}
      </p>
      {kept === null ? null : (
        <p className={styles.retainedValue}>
          {t('hidden.keptValue', {
            value: keptWords({ t, format, kept, units: unitWords(tUnit), yes: tField('yes'), no: tField('no') }),
          })}
        </p>
      )}
    </div>
  );
}
