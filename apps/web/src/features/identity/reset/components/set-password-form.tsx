'use client';

import { Callout, CALLOUT_INTENT, ExpiringCallout, Panel, TextLink, useDismissible } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { PolicyPasswordField } from '../../shared/components/policy-password-field';
import { resetPasswordAction } from '../actions/actions';
import type { ResetPasswordResult } from '../actions/action-results';
import type { SetPasswordKind } from '../tools/set-password-kind';
import styles from '../../shared/styles/identity-screens.module.css';
import { SignedInElsewhere } from '../../shared/components/signed-in-elsewhere';
import { SET_PASSWORD_MESSAGES, setPasswordWordingFor } from './set-password-messages';
import { CredentialSubmit } from '@/shared/credential-submit';
import { ScriptingRequired } from '@/shared/scripting-required';

/**
 * S-02 · Set a new password from a reset link (FR-6, UC-09) — `/set-password?token=…`.
 *
 * P5 binds here by name: consuming the link signs out EVERY existing session, and the screen
 * states that consequence before it happens — the info callout is not decoration, it is the
 * disclosure S-02's validation-behaviour row requires.
 *
 * **Worded for the account the link was sent to** (task 155; §12.5.6's task-155 row (8)): the section
 * hands over the `kind` the link decided, and `setPasswordWordingFor` picks the sentences that say *new*
 * or *changed*; the rest is true for either account and stays single.
 *
 * The password field and its policy are `PolicyPasswordField`, the one wiring S-01's registration and
 * S-36 share with this form.
 *
 * **A session this browser still holds after the reset is another account's** (task 160): a reset ends only
 * its own account's sessions, and the action has already cleared this browser's if it was one of them. So
 * that success names the account and offers to switch or to stay, since the sign-in offered otherwise
 * would be turned away by the gate.
 *
 * States (§8.1 subset): rest · submitting · invalid · success (every session out, S-01
 * offered) · error — recoverable (expired/consumed link as received, the request route as the
 * way out) · unreachable (bundled catalogue).
 */
interface SetPasswordInput {
  password: string;
}

export function SetPasswordForm({ token, kind }: { token: string; kind: SetPasswordKind }) {
  const t = useTranslations(SET_PASSWORD_MESSAGES);
  const worded = useTranslations(setPasswordWordingFor(kind));
  // The summary's title. `packages/ui` owns no text (UX-79), so the app supplies it — and it belongs to
  // no feature, which is why it is `forms` rather than borrowed from whichever screen declared it first.
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResetPasswordResult | null>(null);
  // A refusal leaves after a while, or when closed (design_spec.md §8.1, 28 Sep 2026); the next attempt's is a new
  // object and shows again. The success above replaces the form and stays.
  const [shownResult, dismissResult] = useDismissible(result);

  const { control, handleSubmit } = useForm<SetPasswordInput>({ mode: 'onTouched' });

  const submit = handleSubmit((input) => {
    // The last refusal goes when the next attempt starts, so each answer's message is a fresh one with its own
    // dwell (design_spec.md §8.1, 28 Sep 2026) rather than inheriting the time the last one had left.
    setResult(null);
    startTransition(async () => {
      setResult(await resetPasswordAction({ token, password: input.password }));
    });
  });

  if (result?.status === API_OUTCOME.Ok) {
    const { heldAccount } = result.value;
    if (heldAccount !== null) {
      return (
        <SignedInElsewhere
          heldAccount={heldAccount}
          title={worded('successTitle')}
          body={worded('otherAccountBody', { current: heldAccount.email })}
          switchLabel={t('otherAccountAction')}
        />
      );
    }
    return (
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={worded('successTitle')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.SIGN_IN}>{t('successAction')}</Link>
          </TextLink>
        }
      >
        {worded('successBody')}
      </Callout>
    );
  }

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <ScriptingRequired />
      <FormSummary control={control} title={tForms('summaryTitle')} />

      {shownResult?.status === API_OUTCOME.Problem ? (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissResult}
          title={shownResult.problem.title ?? t('problemTitle')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.RESET}>{t('requestNew')}</Link>
            </TextLink>
          }
        >
          {shownResult.problem.detail ?? t('problemBody')}
        </ExpiringCallout>
      ) : null}

      {shownResult?.status === API_OUTCOME.Unreachable ? (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissResult}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </ExpiringCallout>
      ) : null}

      <Callout
        intent={CALLOUT_INTENT.INFO}
        title={t('consequenceTitle')}
        action={worded('consequenceAction')}
      >
        {worded('consequenceBody')}
      </Callout>

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <PolicyPasswordField control={control} name="password" label={worded('passwordLabel')} />

          <CredentialSubmit busy={pending}>
            {worded('submit')}
          </CredentialSubmit>
        </div>
      </Panel>
    </form>
  );
}
