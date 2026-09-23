'use client';

import { Callout, CALLOUT_INTENT, Panel, TextLink } from '@easyesg/ui';
import { FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { Link, useRouter } from '@/i18n/navigation';
import { registerAction } from '../actions/actions';
import { PolicyPasswordField } from '../../shared/components/policy-password-field';
import { rememberPendingVerification } from '../../shared/store/pending-verification-store';
import styles from '../../shared/styles/identity-screens.module.css';
import { ROUTES } from '@/lib/routes';
import { CredentialSubmit } from '@/shared/credential-submit';
import { ScriptingRequired } from '@/shared/scripting-required';

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
 * "enforced on entry", via `@easyesg/validation` — the same evaluation the API runs, §9.8), through
 * `PolicyPasswordField`, the one wiring S-02's set-password form and S-36 share with this one.
 * UX-108: nothing here blocks paste or autofill; `autoComplete="new-password"` invites the
 * password manager.
 */
interface RegisterInput {
  givenName: string;
  familyName: string;
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
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <ScriptingRequired />
      <FormSummary control={control} title={tForms('summaryTitle')} />

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
          {/* FR-9's two parts, required since `design_spec.md` OQ-16's name half closed. Two fields
              rather than the artboard's one `full name`, because a monogram, a sort and a
              salutation each need to know which part is which (UX-137). `autoComplete` is the
              standard token pair, so a password manager fills both without being taught. */}
          <FormTextField
            control={control}
            name="givenName"
            label={t('givenNameLabel')}
            autoComplete="given-name"
            rules={{ required: t('givenNameMissing'), maxLength: { value: 100, message: t('nameTooLong') } }}
          />

          <FormTextField
            control={control}
            name="familyName"
            label={t('familyNameLabel')}
            autoComplete="family-name"
            rules={{ required: t('familyNameMissing'), maxLength: { value: 100, message: t('nameTooLong') } }}
          />

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

          <PolicyPasswordField control={control} name="password" label={t('passwordLabel')} />

          <CredentialSubmit busy={pending}>
            {t('submit')}
          </CredentialSubmit>
        </div>
      </Panel>

      {/* The standing "already have an account?" prompt — **suppressed while the conflict callout
          is offering the same destination** (28 Aug 2026). On a 409 the API has just said this
          address has an account and the callout carries the remedy, so this repeats it: a second
          link, same accessible name, same href, a screen apart. Two tests had been written around
          that ambiguity rather than reporting it — an e2e `.first()` and a unit assertion of
          `length > 0` — which is the shape a defect takes when only the tests meet it. */}
      {isConflict ? null : (
        <p className={styles.altAction}>
          {t('alreadyHave')}{' '}
          <TextLink asChild>
            <Link href={ROUTES.SIGN_IN}>{t('signIn')}</Link>
          </TextLink>
        </p>
      )}
    </form>
  );
}
