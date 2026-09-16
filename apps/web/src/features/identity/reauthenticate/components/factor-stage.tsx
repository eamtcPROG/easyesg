'use client';

import { Button, TextLink } from '@easyesg/ui';
import { FormCodeField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { ANSWER_LENGTH, FACTOR_ANSWER, type FactorAnswerKind } from '../../shared/tools/factor';
import styles from './reauthentication.module.css';

interface CodeInput {
  code: string;
}

/**
 * The dialogue's second stage, for an account with a second factor (task 92; UC-194, UC-195).
 *
 * **S-01's two affordances over one field, in S-01's words.** The authenticator's six digits, which a
 * password manager can fill, or a recovery code typed by hand — offered rather than hidden, for UX-108's
 * reason. The controls read `identity.factor`, the step whose words they are, so the answer is described
 * the same way wherever it is asked for; only what differs here — the lede, *continue where I left off*,
 * and *back to the password* in place of S-01's *start over* — is this journey's.
 *
 * **No countdown.** S-01 draws the minutes left because its step is a page someone may leave open; here a
 * code that arrives too late is answered by the handler, and the reducer returns the reader to the
 * password with the reason.
 */
export function FactorStage({
  answer,
  busy,
  onSubmit,
  onChooseAnswer,
  onRestart,
}: {
  readonly answer: FactorAnswerKind;
  readonly busy: boolean;
  readonly onSubmit: (code: string) => void;
  readonly onChooseAnswer: (answer: FactorAnswerKind) => void;
  readonly onRestart: () => void;
}) {
  const t = useTranslations('identity.reauthenticate');
  const tFactor = useTranslations('identity.factor');
  const { control, handleSubmit, reset } = useForm<CodeInput>({ mode: 'onSubmit' });
  const submit = handleSubmit(({ code }) => onSubmit(code.trim()));
  const isRecovery = answer === FACTOR_ANSWER.RECOVERY;

  // The field is cleared with the switch: six digits left under a sixteen-character label is a refusal
  // waiting to happen, and the reader did not ask to resubmit it.
  const chooseOther = () => {
    reset({ code: '' });
    onChooseAnswer(isRecovery ? FACTOR_ANSWER.AUTHENTICATOR : FACTOR_ANSWER.RECOVERY);
  };

  return (
    <form method="post" noValidate onSubmit={(event) => void submit(event)} className={styles.form}>
      <FormSummary control={control} title={t('summaryTitle')} />
      <p className={`t-body ${styles.lede}`}>{t('factorLede')}</p>
      {isRecovery ? (
        <FormTextField
          control={control}
          name="code"
          label={tFactor('recoveryLabel')}
          help={tFactor('recoveryHelp')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          rules={{ required: tFactor('recoveryMissing') }}
        />
      ) : (
        <FormCodeField
          control={control}
          name="code"
          label={tFactor('codeLabel')}
          help={tFactor('codeHelp')}
          length={ANSWER_LENGTH[FACTOR_ANSWER.AUTHENTICATOR]}
          rules={{ required: tFactor('codeMissing') }}
        />
      )}
      <div className={styles.actions}>
        <Button type="submit" busy={busy} className={styles.action}>
          {t('continue')}
        </Button>
        {/* Buttons wearing links: each changes what the dialogue shows and goes nowhere. */}
        <TextLink asChild>
          <button type="button" onClick={chooseOther}>
            {isRecovery ? tFactor('useAuthenticator') : tFactor('useRecovery')}
          </button>
        </TextLink>
        <TextLink asChild>
          <button type="button" onClick={onRestart}>
            {t('restart')}
          </button>
        </TextLink>
      </div>
    </form>
  );
}
