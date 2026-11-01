'use client';

import { ARIA_CURRENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { FactorSteps, FactorStepKey } from '../../tools/factor-steps';
import { FACTOR_FLOW, FACTOR_STEP } from '../../tools/factor-steps';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import styles from '../styles/credentials.module.css';

/**
 * Where the reader is in the second factor's flow — §4.2's *step sequence within a flow* (task 169, the owner's review
 * of the rebuilt S-28). A numbered list with the current step marked by `aria-current="step"`, a surface and a weight,
 * and the steps behind it by a filled number, so colour is never the sole carrier (UX-102).
 *
 * **In `factor/` because only its flow draws steps.** No inventory component carries a step sequence; the wizard's
 * rail is a module list, a different anatomy. It moves to `packages/ui` the day a second flow needs one (UX-89).
 */
export function StepIndicator({ sequence }: { readonly sequence: FactorSteps }) {
  const t = useTranslations(FACTOR_MESSAGES);
  const flowLabel = sequence.flow === FACTOR_FLOW.ENROLMENT ? t('stepsEnrolment') : t('stepsReissue');
  // A switch over the vocabulary rather than a map of keys: each call names its key literally, which is what types it.
  const stepLabel = (step: FactorStepKey): string => {
    switch (step) {
      case FACTOR_STEP.CONFIRM:
        return t('stepConfirm');
      case FACTOR_STEP.AUTHENTICATOR:
        return t('stepAuthenticator');
      case FACTOR_STEP.CODES:
        return t('stepCodes');
    }
  };

  // A labelled list, not a `nav`: it names progress, and nothing in it is a destination.
  return (
    <ol className={styles.steps} aria-label={flowLabel}>
      {sequence.steps.map((step, index) => (
        <li
          key={step}
          className={styles.step}
          aria-current={index === sequence.current ? ARIA_CURRENT.STEP : undefined}
          data-done={index < sequence.current ? '' : undefined}
        >
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <span className={styles.stepLabel}>
            <span className={styles.visuallyHidden}>
              {t('stepPosition', { current: index + 1, total: sequence.steps.length })}{' '}
            </span>
            {stepLabel(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}
