'use client';

import { BUTTON_VARIANT, Button, Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { FormCodeField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  beginTotpEnrolmentAction,
  confirmTotpEnrolmentAction,
  disableTotpAction,
  reissueRecoveryCodesAction,
} from '../actions';
import { API_OUTCOME } from '@/lib/api-outcome';
import { CREDENTIALS_STAGE, type CredentialsStageValue } from '../credentials-state';
import type { CredentialsSectionProps } from './section-props';
import styles from './credentials.module.css';

/**
 * S-28's second factor — UC-193, and the one section with a shape of its own.
 *
 * **Three of its states are the enrolment's two steps and the codes**, and they are the screen's
 * `stage` rather than this component's, because the reader can be *returned* into one: the codes
 * arrive from a re-issue as well as from enrolment, and both must look identical. Holding them
 * here would be two components each owning half a state machine.
 *
 * The password is required to begin, to turn off and to re-issue (§12.5.6's re-authentication
 * row) — but **not** to confirm: `begin` took it moments ago, and a current code from the secret
 * just issued is stronger evidence than a password for the thing being proved. The API decides
 * that; this section simply asks for the password on the routes that carry one.
 */
interface FactorForm {
  code: string;
}

export interface FactorSectionProps extends CredentialsSectionProps {
  readonly enrolled: boolean;
  readonly recoveryCodesRemaining: number;
  readonly stage: CredentialsStageValue;
  readonly onEnrolmentOffered: (offer: { secret: string; enrolmentUri: string }) => void;
  readonly onCodesIssued: (codes: readonly string[], title: string, body: string) => void;
  readonly onDismiss: () => void;
  /** Reads the record's shared password AT THE MOMENT of the action — see the board. */
  readonly getPassword: () => string | undefined;
}

export function FactorSection({
  busy,
  enrolled,
  recoveryCodesRemaining,
  stage,
  getPassword,
  onStart,
  onSettled,
  onEnrolmentOffered,
  onCodesIssued,
  onDismiss,
}: FactorSectionProps) {
  const t = useTranslations('identity.credentials.factor');
  const { control, handleSubmit, reset } = useForm<FactorForm>({
    mode: 'onTouched',
    defaultValues: { code: '' },
  });

  const begin = async () => {
    onStart();
    const outcome = await beginTotpEnrolmentAction({ password: getPassword() });
    if (outcome.status === API_OUTCOME.Ok && outcome.value) {
      onEnrolmentOffered(outcome.value);
      return;
    }
    onSettled(outcome, { title: t('enabledTitle'), body: t('enabledBody') });
  };

  const confirm = handleSubmit(async (values) => {
    onStart();
    const outcome = await confirmTotpEnrolmentAction({ code: values.code });
    if (outcome.status === API_OUTCOME.Ok && outcome.value) {
      onCodesIssued(outcome.value.recoveryCodes, t('enabledTitle'), t('enabledBody'));
      reset();
      return;
    }
    onSettled(outcome, { title: t('enabledTitle'), body: t('enabledBody') });
  });

  const disable = async () => {
    onStart();
    onSettled(await disableTotpAction({ password: getPassword() }), {
      title: t('disabledTitle'),
      body: t('disabledBody'),
    });
  };

  const reissue = async () => {
    onStart();
    const outcome = await reissueRecoveryCodesAction({ password: getPassword() });
    if (outcome.status === API_OUTCOME.Ok && outcome.value) {
      onCodesIssued(outcome.value.recoveryCodes, t('codesTitle'), t('codesBody'));
      return;
    }
    onSettled(outcome, { title: t('codesTitle'), body: t('codesBody') });
  };

  if (stage.kind === CREDENTIALS_STAGE.SHOWING_CODES) {
    return (
      <div className={styles.form}>
        <p className="t-label">{t('codesHeading')}</p>
        {/* Stated BEFORE the codes, not after: a reader who has already scrolled past them has
            no way back, and "we show these once" is only useful in advance (P5). */}
        <p className="t-caption">{t('codesHelp')}</p>
        <ul className={styles.codes}>
          {stage.codes.map((code) => (
            <li key={code} className="t-code">
              {code}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={onDismiss}>
          {t('codesDone')}
        </Button>
      </div>
    );
  }

  if (stage.kind === CREDENTIALS_STAGE.ENROLLING) {
    return (
      <form onSubmit={(event) => void confirm(event)} noValidate className={styles.form}>
        <FormSummary control={control} title={t('heading')} />
        <p className="t-label">{t('secretHeading')}</p>
        <p className={`t-code ${styles.secret}`}>{stage.secret}</p>
        <p className="t-caption">{t('secretHelp')}</p>

        <FormCodeField
          control={control}
          name="code"
          label={t('codeLabel')}
          rules={{ required: t('codeMissing') }}
        />

        <div className={styles.actions}>
          <Button type="submit" busy={busy}>
            {t('confirm')}
          </Button>
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
            {t('abandon')}
          </Button>
        </div>
      </form>
    );
  }

  // Enrolled with nothing left to recover with: the one state that needs an action attached.
  const exhausted = enrolled && recoveryCodesRemaining === 0;

  return (
    <div className={styles.form}>
      <p className="t-body">
        {enrolled ? t('on', { remaining: recoveryCodesRemaining }) : t('off')}
      </p>

      {/* Zero codes on an enrolled account is a real, designed state (UC-195) and the one moment
          it can still be fixed — so it is a warning carrying the fix, not a count of nought. The
          re-issue button moves INTO it: §11.5 requires a Callout's third part, and having the
          action in two places would ask the reader which one to trust. */}
      {exhausted ? (
        <Callout
          intent={CALLOUT_INTENT.ATTENTION}
          title={t('heading')}
          action={
            <Button type="button" busy={busy} onClick={() => void reissue()}>
              {t('reissue')}
            </Button>
          }
        >
          {t('noCodes')}
        </Callout>
      ) : null}

      <div className={styles.actions}>
        {enrolled ? (
          <>
            {exhausted ? null : (
              <Button
                type="button"
                variant={BUTTON_VARIANT.SECONDARY}
                busy={busy}
                onClick={() => void reissue()}
              >
                {t('reissue')}
              </Button>
            )}
            <Button
              type="button"
              variant={BUTTON_VARIANT.DESTRUCTIVE}
              busy={busy}
              onClick={() => void disable()}
            >
              {t('disable')}
            </Button>
          </>
        ) : (
          <Button type="button" busy={busy} onClick={() => void begin()}>
            {t('enable')}
          </Button>
        )}
      </div>
    </div>
  );
}
