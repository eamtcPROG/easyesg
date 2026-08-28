'use client';

import { evaluatePasswordPolicy, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@easyesg/validation';
import { Button, Callout, CALLOUT_INTENT, Panel, RequirementList, TextLink } from '@easyesg/ui';
import { FormPasswordField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { Link, useRouter } from '@/i18n/navigation';
import { registerAction } from '../actions';
import { rememberPendingVerification } from '../pending-verification-store';
import styles from './identity-screens.module.css';
import { ROUTES } from '@/lib/routes';

/**
 * S-01 · Register (UC-01) — email + password per the S-01 content list and the task-19 API.
 * The prototype's extra captures (full name, consent) are design_spec OQ-16, deliberately not
 * closed here.
 *
 * States (§8.1 subset for this surface): rest · submitting (busy button, pending-async) ·
 * invalid (inline errors + UX-111 summary) · error — recoverable (problem+json rendered as
 * received; unreachable from the bundled catalogue) · success (exit to the S-02 challenge).
 *
 * The password policy is displayed before entry and answers itself while typing (S-02's
 * "enforced on entry", via `@easyesg/validation` — the same evaluation the API runs, §9.8).
 * UX-108: nothing here blocks paste or autofill; `autoComplete="new-password"` invites the
 * password manager.
 */
interface RegisterInput {
  email: string;
  password: string;
}

/** Light shape check only — deliverability is unknowable client-side; the API is authoritative. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterFormProps {
  /**
   * An invitation being acted on — S-03's registration hand-off (task 26.3), absent everywhere
   * else. Carried through to the API, where a live one for this same address creates an
   * **already-verified** account and suppresses the challenge email (FR-3, §12.5.6's task-26.2 row).
   */
  invitationToken?: string;
  /** Where to go once an account exists. UX-38's contract, sanitised by the route it lands on. */
  returnTo?: string;
}

export function RegisterForm({ invitationToken, returnTo }: RegisterFormProps) {
  const t = useTranslations('identity.register');
  // The reveal toggle's accessible names. `packages/ui` owns no text (UX-79), so the app supplies
  // them — and they belong to no feature, which is why they are `forms` rather than borrowed from
  // whichever screen happened to declare them first.
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { control, handleSubmit } = useForm<RegisterInput>({ mode: 'onTouched' });

  // `useWatch`, not `watch()`: it subscribes to this one field instead of re-rendering the form
  // on every change, and it is the API React Compiler can memoize — `watch()` is what
  // `react-hooks/incompatible-library` was warning about here.
  const password = useWatch({ control, name: 'password' }) ?? '';
  const verdict = evaluatePasswordPolicy(password);

  const requirements = [
    {
      key: 'length',
      label: t('requirements.length', {
        minimum: PASSWORD_MIN_LENGTH,
        maximum: PASSWORD_MAX_LENGTH,
      }),
      met: verdict.length,
    },
    { key: 'lowercase', label: t('requirements.lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: t('requirements.uppercase'), met: verdict.uppercase },
    { key: 'digit', label: t('requirements.digit'), met: verdict.digit },
    { key: 'further', label: t('requirements.further'), met: verdict.further },
  ];

  const submit = handleSubmit((input) => {
    setFailure(null);
    startTransition(async () => {
      const result = await registerAction({ ...input, invitationToken });
      if (result.status === API_OUTCOME.Ok) {
        // **Branch on what came back, not on whether a token was sent.** A stale or misaddressed
        // invitation is ignored by the API and yields an ordinary unverified account (task 26.2's
        // register DTO says so in terms), so trusting the request would push someone to a sign-in
        // that refuses them — while trusting the response is right in every case.
        if (result.value.status === ACCOUNT_STATUS.ACTIVE) {
          // Verified by the invitation itself, so there is no challenge to wait for: straight on to
          // sign in, and `?return=` brings them back to the invitation to accept it.
          router.push(returnTo ? `${ROUTES.SIGN_IN}?return=${encodeURIComponent(returnTo)}` : '/sign-in');
          return;
        }
        // The S-02 challenge screen states the address it was sent to. Session storage, not the
        // URL: an email address in a query string reaches server logs and history (constants.ts).
        rememberPendingVerification(result.value.email);
        // **`?return=` survives the challenge too** (26 Aug 2026 review). This branch is reached
        // from an invitation whenever the token was stale, revoked or for another address — the API
        // ignores it and issues an ordinary challenge — and dropping the return path there stranded
        // the invitee: they verified, signed in with nowhere to go, and landed on "create your first
        // organization" with no sign the invitation existed. S-02 threads it on to sign-in.
        router.push(returnTo ? `${ROUTES.VERIFY}?return=${encodeURIComponent(returnTo)}` : '/verify');
        return;
      }
      setFailure(result);
    });
  });

  const isConflict = failure?.status === API_OUTCOME.Problem && failure.problem.status === 409;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={t('summaryTitle')} />

      {failure?.status === API_OUTCOME.Problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={failure.problem.title ?? t('problemTitle')}
          /* NFR-79's "what now" belongs to the API's `detail`, which always states its own remedy.
              The slot carries something only where this screen owns one the detail cannot express —
              a remedy that NAVIGATES. Until 27 Aug 2026 it fell back to a fixed sentence for every
              other problem, so the throttle refusal arrived with the API's "wait a few minutes"
              directly above this screen's "try again now". (factor-form.tsx made the same fix.) */
          action={
            isConflict ? (
              <TextLink asChild>
                <Link href={ROUTES.SIGN_IN}>{t('signIn')}</Link>
              </TextLink>
            ) : null
          }
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
          <FormTextField
            control={control}
            name="email"
            label={t('emailLabel')}
            help={t('emailHelp')}
            type="email"
            autoComplete="email"
            inputMode="email"
            rules={{
              required: t('emailMissing'),
              pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
            }}
          />

          <div className={styles.passwordGroup}>
            <FormPasswordField
              control={control}
              name="password"
              label={t('passwordLabel')}
              help={t('pasteHint')}
              autoComplete="new-password"
              revealLabel={tForms('show')}
              concealLabel={tForms('hide')}
              rules={{
                validate: (value) =>
                  evaluatePasswordPolicy(value ?? '').satisfied ||
                  t('passwordPolicy', {
                    minimum: PASSWORD_MIN_LENGTH,
                    maximum: PASSWORD_MAX_LENGTH,
                  }),
              }}
            />
            <RequirementList
              items={requirements}
              metLabel={t('met')}
              unmetLabel={t('unmet')}
            />
          </div>

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>

      <p className={styles.altAction}>
        {t('alreadyHave')}{' '}
        <TextLink asChild>
          <Link href={ROUTES.SIGN_IN}>{t('signIn')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
