'use client';

import { BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import {
  beginTotpEnrolmentAction,
  disableTotpAction,
  reissueRecoveryCodesAction,
} from '../../actions/actions';
import { CODES_ORIGIN, CREDENTIALS_EVENT, CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../../tools/credentials-state';
import { factorSteps } from '../../tools/factor-steps';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import { ReauthForm } from '../shared/reauth-form';
import { RowNotice } from '../shared/row-notice';
import { FactorEnrolment } from './factor-enrolment';
import { RecoveryCodes } from './recovery-codes';
import { StepIndicator } from './step-indicator';
import styles from '../styles/credentials.module.css';

/**
 * The factor row, open: whichever of its five steps the screen's stage names. Three ask for the current password
 * before they act (§12.5.6's re-authentication row) — beginning an enrolment, turning the factor off, issuing new
 * codes — and **confirming an enrolment does not**: `begin` took it moments ago, and a current code from the secret
 * just issued is stronger evidence for the thing being proved.
 *
 * **No outcome is read here** (28 Aug 2026): each action says what to run and what a success *means*; `perform` owns
 * the refusal, which `RowNotice` draws above this.
 *
 * **Drawn as a flow since the owner's review** (task 169): turning the factor on is three steps and new codes two, and
 * the indicator above says which one the reader is on (`tools/factor-steps.ts`).
 */
export function FactorStep() {
  const { stage } = useCredentials();
  const sequence = factorSteps(stage);

  return (
    <div className={styles.flow}>
      {sequence ? <StepIndicator sequence={sequence} /> : null}
      {/* Where the reader is first, then what just happened, then the step — a refusal read beside its form. */}
      <RowNotice section={CREDENTIALS_SECTION.FACTOR} />
      <FactorStepBody />
    </div>
  );
}

/** The step itself — one arm per stage of the factor's row. */
function FactorStepBody() {
  const t = useTranslations(FACTOR_MESSAGES);
  const { stage, perform, succeeded, successNotice } = useCredentials();
  const section = CREDENTIALS_SECTION.FACTOR;

  switch (stage.kind) {
    case CREDENTIALS_STAGE.BEGINNING_ENROLMENT:
      return (
        <ReauthForm
          section={section}
          help={t('beginHelp')}
          submitLabel={t('beginSubmit')}
          onConfirm={({ password, clear }) =>
            perform({
              section,
              action: () => beginTotpEnrolmentAction({ password }),
              // The secret on screen IS the feedback; a success notice beside it would narrate what the reader sees.
              onSuccess: (offer) => ({ type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, ...offer }),
              clear,
            })
          }
        />
      );

    case CREDENTIALS_STAGE.ENROLLING:
      return <FactorEnrolment secret={stage.secret} enrolmentUri={stage.enrolmentUri} />;

    case CREDENTIALS_STAGE.DISABLING_FACTOR:
      return (
        <ReauthForm
          section={section}
          help={t('disableHelp')}
          submitLabel={t('disableSubmit')}
          variant={BUTTON_VARIANT.DESTRUCTIVE}
          onConfirm={({ password, clear }) =>
            perform({
              section,
              action: () => disableTotpAction({ password }),
              onSuccess: () => succeeded({ title: t('disabledTitle'), body: t('disabledBody') }),
              clear,
            })
          }
        />
      );

    case CREDENTIALS_STAGE.REISSUING_CODES:
      return (
        <ReauthForm
          section={section}
          help={t('reissueHelp')}
          submitLabel={t('reissueSubmit')}
          onConfirm={({ password, clear }) =>
            perform({
              section,
              action: () => reissueRecoveryCodesAction({ password }),
              onSuccess: (issued) => ({
                type: CREDENTIALS_EVENT.CODES_ISSUED,
                codes: issued.recoveryCodes,
                origin: CODES_ORIGIN.REISSUE,
                notice: successNotice({ title: t('codesTitle'), body: t('codesBody') }),
              }),
              clear,
            })
          }
        />
      );

    case CREDENTIALS_STAGE.SHOWING_CODES:
      return <RecoveryCodes codes={stage.codes} />;

    default:
      // Every other stage belongs to another row; the factor row is not open in any of them.
      return null;
  }
}
