import { Button, BUTTON_VARIANT, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import type { ApplicabilityNote as Note } from '../../../tools/applicability-notes';
import { noteWords } from '../../../tools/applicability-words';
import { BASIS_MODULE } from '../../../tools/basis-module';
import { fieldHref } from '../../../tools/field-anchor';
import { StepLink } from '../../shared/step-link';
import { APPLICABILITY_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';

/**
 * **UX-27's note: why these questions are asked, at the questions** (task 95; `architecture.md` §12.5.6's task-95 row
 * (1)) — the Reporting Core artboard's *"Two questions appeared because you reported 50 or more employees … Dismiss"*,
 * in the step that asks them, since every rule's field is in another module than its B1 driver.
 *
 * A `Callout` from the inventory, its three parts filled: what brought the questions, what a change does — the
 * retention promise UX-28 asks be stated up front — and the two acts, the B1 answer's own address and *dismiss*. The
 * address is `fieldHref`'s, so it lands focus in the driver's field as a finding's link does (task 42.3), and goes
 * through `StepLink`, so leaving the step asks about unsent work first. No directive: drawn inside `StepFields`, a
 * client boundary already.
 */
export function ApplicabilityNote({
  note,
  reportId,
  onDismiss,
}: {
  readonly note: Note;
  readonly reportId: string;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations(APPLICABILITY_MESSAGES);
  const format = useFormatter();
  const { title, body } = noteWords(t, format, note);
  const driver = note.cause.drivers[0];

  return (
    <Callout
      intent={CALLOUT_INTENT.INFO}
      title={title}
      action={
        <span className={styles.noteActions}>
          {driver === undefined ? null : (
            <TextLink asChild>
              <StepLink
                href={fieldHref({
                  reportId,
                  module: BASIS_MODULE,
                  field: { elementKey: driver.elementKey, dimensionKey: '', ordinal: 0 },
                })}
              >
                {t('note.see')}
              </StepLink>
            </TextLink>
          )}
          <Button variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
            {t('note.dismiss')}
          </Button>
        </span>
      }
    >
      {body}
    </Callout>
  );
}
