'use client';

import { PROBLEM_TYPE } from '@easyesg/contracts';
import { Button, Callout, CALLOUT_INTENT, Panel } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { PolicyPasswordField } from '../../../shared/components/policy-password-field';
import type { PasswordStepFailure } from '../../actions/action-results';
import { SETUP_GRANT_LAPSED } from '../../tools/password-step';
import { SETUP_STEP, SETUP_STEP_COUNT, SETUP_STEP_POSITION } from '../../tools/setup-step';
import styles from '../../../shared/styles/identity-screens.module.css';
import { SETUP_MESSAGES } from '../shared/setup-messages';

/**
 * S-36's password step — the form `session-password-step.tsx` and `grant-password-step.tsx` share
 * (task 155; `design_spec.md` S-36).
 *
 * **The two steps differ only in what they hand it.** A signed-in account proves itself with the
 * session's own provider sign-in; an account confirmed by email with the grant the confirmation held. The
 * policy field, the refusal and the unreachable state are the same screen either way, so they are here
 * once. Each step supplies the sentence that opens it, the action that submits it and its way on when
 * its proof has lapsed; **anything else a step adds, it composes** — the link step's *keep me signed in*
 * as `children` above the submit button, the session step's sign-out beside the form — rather than this
 * form growing a prop per step (`vercel-composition-patterns`, explicit variants over modes). `lapsed`
 * stays a prop because it replaces the form in a state only this form detects.
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + the UX-111 summary) · error —
 * recoverable (the API's refusal as received; a stale proof's action slot carries the step's way on) ·
 * unreachable · **expired** (the link step's grant ran out, replacing the form). Success never renders:
 * the action redirects.
 */
interface PasswordInput {
  password: string;
}

export interface PasswordFormProps {
  /** The step's opening sentence. */
  readonly intro: string;
  readonly submit: (password: string) => Promise<PasswordStepFailure>;
  /** The action slot for a stale proof — the step's own way on, which no `detail` can navigate to. */
  readonly staleAction: ReactNode;
  /** Drawn in place of the form once the link step's grant has run out. */
  readonly lapsed?: ReactNode;
  /** What the step adds above the submit button. */
  readonly children?: ReactNode;
}

export function PasswordForm({ intro, submit, staleAction, lapsed, children }: PasswordFormProps) {
  const t = useTranslations(SETUP_MESSAGES);
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  // One value with a lifecycle — cleared on submit, set by the answer — which the reducer rule leaves
  // to `useState`.
  const [failure, setFailure] = useState<Exclude<PasswordStepFailure, undefined> | null>(null);

  const { control, handleSubmit } = useForm<PasswordInput>({ mode: 'onTouched' });

  const onSubmit = handleSubmit((input) => {
    setFailure(null);
    startTransition(async () => {
      // `undefined` is the redirect winning: this tree is unmounting and there is nothing to show.
      setFailure((await submit(input.password)) ?? null);
    });
  });

  if (failure?.status === SETUP_GRANT_LAPSED) return <>{lapsed}</>;

  return (
    <form method="post" onSubmit={(event) => void onSubmit(event)} noValidate className={styles.stack}>
      <p className={`t-body ${styles.subtitle}`}>
        {t('stepPosition', {
          current: SETUP_STEP_POSITION[SETUP_STEP.PASSWORD],
          total: SETUP_STEP_COUNT,
        })}
      </p>

      <FormSummary control={control} title={tForms('summaryTitle')} />

      {failure?.status === API_OUTCOME.Problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={failure.problem.title ?? t('problemTitle')}
          action={failure.problem.type === PROBLEM_TYPE.AccountSetupProofStale ? staleAction : null}
        >
          {failure.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {failure?.status === API_OUTCOME.Unreachable ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <p className={styles.bodyText}>{intro}</p>

          <PolicyPasswordField control={control} name="password" label={t('passwordLabel')} />

          {children}

          <Button type="submit" busy={pending}>
            {t('passwordSubmit')}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
