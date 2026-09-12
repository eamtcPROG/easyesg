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
} from '../actions/actions';
import type { TotpState } from '../tools/credentials';
import { CREDENTIALS_EVENT, CREDENTIALS_SECTION, CREDENTIALS_STAGE } from '../tools/credentials-state';
import { FACTOR_MESSAGES } from './credentials-messages';
import { useCredentials, useSectionBusy } from './credentials-context';
import styles from './credentials.module.css';

interface FactorForm {
  code: string;
}

/**
 * The section's three stages and its resting form.
 *
 * **A module-level component, not one declared inside `FactorSection`.** A component defined in
 * another's body is a new function on every render, so React unmounts and remounts the whole
 * subtree — which would take the focus and the caret out of the code field mid-typing. Its one
 * prop is the narrowed read; everything else it needs it takes from the hook, which is the prop
 * surface this file was rewritten to remove.
 */
export function FactorBody({ factor }: { readonly factor: TotpState }) {
  const t = useTranslations(FACTOR_MESSAGES);
  // The form-level error summary's heading — `forms`, because it says what happened to a
  // FORM and no screen owns it. See `factor-form.tsx` for the one that is not shared.
  const tForms = useTranslations('forms');
  const { stage, perform, succeeded, successNotice, password, dismiss } = useCredentials();
  const busy = useSectionBusy(CREDENTIALS_SECTION.FACTOR);
  const { control, handleSubmit, reset } = useForm<FactorForm>({
    mode: 'onTouched',
    defaultValues: { code: '' },
  });

  const begin = () =>
    perform({
      section: CREDENTIALS_SECTION.FACTOR,
      action: () => beginTotpEnrolmentAction({ password: password() }),
      // A stage change IS the feedback here: the secret goes on screen and the next step is
      // visible. A success notice beside it would narrate what the reader can already see.
      onSuccess: (offer) => ({ type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, ...offer }),
    });

  const confirm = handleSubmit((values) =>
    perform({
      section: CREDENTIALS_SECTION.FACTOR,
      action: () => confirmTotpEnrolmentAction({ code: values.code }),
      onSuccess: (issued) => ({
        type: CREDENTIALS_EVENT.CODES_ISSUED,
        codes: issued.recoveryCodes,
        notice: successNotice({ title: t('enabledTitle'), body: t('enabledBody') }),
      }),
      // Cleared on a refusal too: a TOTP code rotates, so a rejected one can never be retried and
      // leaving it in the field invites exactly that.
      clear: reset,
    }),
  );

  const disable = () =>
    perform({
      section: CREDENTIALS_SECTION.FACTOR,
      action: () => disableTotpAction({ password: password() }),
      onSuccess: () => succeeded({ title: t('disabledTitle'), body: t('disabledBody') }),
    });

  const reissue = () =>
    perform({
      section: CREDENTIALS_SECTION.FACTOR,
      action: () => reissueRecoveryCodesAction({ password: password() }),
      onSuccess: (issued) => ({
        type: CREDENTIALS_EVENT.CODES_ISSUED,
        codes: issued.recoveryCodes,
        notice: successNotice({ title: t('codesTitle'), body: t('codesBody') }),
      }),
    });

  if (stage.kind === CREDENTIALS_STAGE.SHOWING_CODES) {
    return (
      <div className={styles.form}>
        <p className="t-label">{t('codesHeading')}</p>
        {/* Stated BEFORE the codes, not after: a reader who has already scrolled past them has
            no way back, and "we show these once" is only useful in advance (P5). */}
        <p className="t-caption">{t('codesHelp')}</p>
        <ul className={styles.codes}>
          {stage.codes.map((code) => (
            <li key={code} className="t-code" translate="no">
              {code}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={dismiss}>
          {t('codesDone')}
        </Button>
      </div>
    );
  }

  if (stage.kind === CREDENTIALS_STAGE.ENROLLING) {
    return (
      <form method="post" onSubmit={(event) => void confirm(event)} noValidate className={styles.form}>
        <FormSummary control={control} title={tForms('summaryTitle')} />
        <p className="t-label">{t('secretHeading')}</p>
        <p className={`t-code ${styles.secret}`} translate="no">{stage.secret}</p>
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
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={dismiss}>
            {t('abandon')}
          </Button>
        </div>
      </form>
    );
  }

  // Enrolled with nothing left to recover with: the one state that needs an action attached.
  const exhausted = factor.enrolled && factor.recoveryCodesRemaining === 0;

  return (
    <div className={styles.form}>
      <p className="t-body">
        {factor.enrolled ? t('on', { remaining: factor.recoveryCodesRemaining }) : t('off')}
      </p>

      {/* Zero codes on an enrolled account is a real, designed state (UC-195) and the one moment
          it can still be fixed — so it is a warning carrying the fix, not a count of nought. The
          re-issue button moves INTO it: §11.5 requires a Callout's third part, and having the
          action in two places would ask the reader which one to trust. */}
      {exhausted ? (
        <Callout
          intent={CALLOUT_INTENT.ATTENTION}
          // What HAPPENED, not what section this is. It read `t('heading')` — "Verificare în doi
          // pași" — so NFR-79's first part named the region the reader was already looking at,
          // and the consequence had to carry the news as well as the news's meaning.
          title={t('noCodesTitle')}
          action={
            <Button type="button" busy={busy} onClick={reissue}>
              {t('reissue')}
            </Button>
          }
        >
          {t('noCodesBody')}
        </Callout>
      ) : null}

      <div className={styles.actions}>
        {factor.enrolled ? (
          <>
            {exhausted ? null : (
              <Button
                type="button"
                variant={BUTTON_VARIANT.SECONDARY}
                busy={busy}
                onClick={reissue}
              >
                {t('reissue')}
              </Button>
            )}
            <Button
              type="button"
              variant={BUTTON_VARIANT.DESTRUCTIVE}
              busy={busy}
              onClick={disable}
            >
              {t('disable')}
            </Button>
          </>
        ) : (
          <Button type="button" busy={busy} onClick={begin}>
            {t('enable')}
          </Button>
        )}
      </div>
    </div>
  );
}
