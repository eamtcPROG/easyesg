import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Callout,
  FormErrorSummary,
  Panel,
  PasswordField,
  TextField,
  TextLink,
} from '@easyesg/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import {
  API_OUTCOME,
  PROBLEM_TYPE,
  type AdminAccount,
  type ApiFailure,
} from '@easyesg/contracts';
import { beginSignIn, completeSignIn } from '../session';

/**
 * A-01 · Admin sign-in (UC-68, FR-75) — the two-step handshake the artboard draws (`EasyESG
 * Admin Console Screens.dc.html`, values extracted per OQ-10): the credential opens a sealed
 * five-minute challenge, then the factor screen confirms the code **for an address the server
 * has verified** — "Conectat ca …" is a fact, not copy. One card, three sections (header with
 * its mono kicker, body, footer with the realm statement), on the Focus archetype's column.
 *
 * Mutations ride TanStack Query — the console's data layer (§12.1; the 24 Aug 2026 review
 * caught this screen carrying web's Server-Action idiom instead) — with `ApiOutcome` as the
 * resolved value, so failures stay values and the container's discipline holds end to end.
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + UX-111 summary) · error —
 * recoverable, as received; the one branch is `authentication-required` on the factor step —
 * the challenge lapsed, so the flow returns to the credential with the api's wording shown.
 * UX-108: paste and password managers work; `one-time-code` surfaces platform autofill.
 *
 * Drawn by the artboard, deliberately NOT here, each with its owner: the segmented six-cell
 * code input (a §11.5 inventory addition, with task 27's tenant challenge as its second
 * consumer), the code-window countdown, the recovery-code routes (task 27), and the LOGGED
 * audit note (owed with task 28's request-tier audit capture — omitted rather than stated
 * while untrue, per the 24 Aug review's batch). The artboard's full-dark ground vs the Focus
 * shell's dark-header-light-ground is a recorded divergence for design review, not a fork of
 * the archetype.
 */
const STEP = {
  Credential: 'credential',
  Factor: 'factor',
} as const;

type SignInStep =
  | { kind: typeof STEP.Credential }
  | { kind: typeof STEP.Factor; email: string };

interface CredentialInput {
  email: string;
  password: string;
}

interface FactorInput {
  totpCode: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_FIELD_ID = 'admin-sign-in-email';
const PASSWORD_FIELD_ID = 'admin-sign-in-password';
const TOTP_FIELD_ID = 'admin-sign-in-totp';

export function SignInScreen({ onSignedIn }: { onSignedIn: (account: AdminAccount) => void }) {
  const t = useTranslations('realm.signIn');
  const tCommon = useTranslations('realm');
  const [step, setStep] = useState<SignInStep>({ kind: STEP.Credential });
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const credentialForm = useForm<CredentialInput>({ mode: 'onTouched' });
  const factorForm = useForm<FactorInput>({ mode: 'onTouched' });

  const begin = useMutation({
    mutationFn: beginSignIn,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) {
        setFailure(null);
        factorForm.reset();
        setStep({ kind: STEP.Factor, email: outcome.value.email });
        return;
      }
      setFailure(outcome);
    },
  });

  const complete = useMutation({
    mutationFn: completeSignIn,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) {
        onSignedIn(outcome.value);
        return;
      }
      if (
        outcome.status === API_OUTCOME.Problem &&
        outcome.problem.type === PROBLEM_TYPE.AuthenticationRequired
      ) {
        // The challenge lapsed (§12.5.6 — five minutes): sign-in restarts from the
        // credential, with the api's own explanation shown there.
        setStep({ kind: STEP.Credential });
      }
      setFailure(outcome);
    },
  });

  const submitCredential = credentialForm.handleSubmit((input) => {
    setFailure(null);
    begin.mutate(input);
  });

  const submitFactor = factorForm.handleSubmit((input) => {
    setFailure(null);
    complete.mutate(input);
  });

  const restart = () => {
    setFailure(null);
    setStep({ kind: STEP.Credential });
  };

  const credentialErrors = credentialForm.formState.errors;
  const credentialSummary = [
    credentialErrors.email
      ? { fieldId: EMAIL_FIELD_ID, message: credentialErrors.email.message }
      : null,
    credentialErrors.password
      ? { fieldId: PASSWORD_FIELD_ID, message: credentialErrors.password.message }
      : null,
  ].filter((item) => item !== null);

  const factorErrors = factorForm.formState.errors;
  const factorSummary = factorErrors.totpCode
    ? [{ fieldId: TOTP_FIELD_ID, message: factorErrors.totpCode.message }]
    : [];

  const onFactorStep = step.kind === STEP.Factor;

  return (
    <Panel className="overflow-hidden !p-0">
      {/* Header section — the artboard's kicker · title · lede. */}
      <div className="border-b border-[var(--border-default)] px-[var(--space-7)] pb-[var(--space-5)] pt-[var(--space-6)]">
        <p className="t-code mb-[var(--space-2)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {t('kicker')}
        </p>
        <h1 className="t-heading-2 mb-[var(--space-2)] text-[var(--text-default)]">
          {onFactorStep ? t('factor.title') : t('credential.title')}
        </h1>
        <p className="t-caption text-[var(--text-body)]">
          {onFactorStep
            ? t.rich('factor.lede', {
                email: () => <strong className="font-semibold">{step.email}</strong>,
              })
            : t('credential.lede')}
        </p>
      </div>

      {/* Body section — the step's form. */}
      <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-7)] py-[var(--space-5)]">
        {failure?.status === API_OUTCOME.Problem ? (
          <Callout
            intent="error"
            title={failure.problem.title ?? t('problemTitle')}
            action={t('problemAction')}
          >
            {failure.problem.detail ?? t('problemBody')}
          </Callout>
        ) : null}

        {failure?.status === API_OUTCOME.Unreachable ? (
          <Callout
            intent="error"
            title={tCommon('unreachable.title')}
            action={tCommon('unreachable.action')}
          >
            {tCommon('unreachable.body')}
          </Callout>
        ) : null}

        {onFactorStep ? (
          <form
            // The key is load-bearing: both steps render a TextField-led form at the same
            // position, so an unkeyed switch makes React REUSE the uncontrolled input's DOM
            // node — and the email typed at step one surfaces inside the code field. Found by
            // the spec, kept as a named hazard.
            key={STEP.Factor}
            onSubmit={(event) => void submitFactor(event)}
            noValidate
            className="flex flex-col gap-[var(--space-4)]"
          >
            {factorForm.formState.submitCount > 0 && factorSummary.length > 0 ? (
              <FormErrorSummary title={t('summaryTitle')} items={factorSummary} />
            ) : null}

            <TextField
              id={TOTP_FIELD_ID}
              label={t('factor.totpLabel')}
              help={t('factor.totpHelp')}
              autoComplete="one-time-code"
              inputMode="numeric"
              error={factorErrors.totpCode?.message}
              {...factorForm.register('totpCode', { required: t('factor.totpMissing') })}
            />

            <Button type="submit" busy={complete.isPending}>
              {t('factor.submit')}
            </Button>

            <p className="t-caption">
              <TextLink asChild>
                <button type="button" onClick={restart} className="cursor-pointer">
                  {t('factor.changeAccount')}
                </button>
              </TextLink>
            </p>
          </form>
        ) : (
          <form
            key={STEP.Credential}
            onSubmit={(event) => void submitCredential(event)}
            noValidate
            className="flex flex-col gap-[var(--space-4)]"
          >
            {credentialForm.formState.submitCount > 0 && credentialSummary.length > 0 ? (
              <FormErrorSummary title={t('summaryTitle')} items={credentialSummary} />
            ) : null}

            <TextField
              id={EMAIL_FIELD_ID}
              label={t('credential.emailLabel')}
              type="email"
              autoComplete="username"
              inputMode="email"
              error={credentialErrors.email?.message}
              {...credentialForm.register('email', {
                required: t('credential.emailMissing'),
                pattern: { value: EMAIL_SHAPE, message: t('credential.emailInvalid') },
              })}
            />

            <PasswordField
              id={PASSWORD_FIELD_ID}
              label={t('credential.passwordLabel')}
              autoComplete="current-password"
              revealLabel={t('credential.show')}
              concealLabel={t('credential.hide')}
              error={credentialErrors.password?.message}
              {...credentialForm.register('password', {
                required: t('credential.passwordMissing'),
              })}
            />

            <Button type="submit" busy={begin.isPending}>
              {t('credential.submit')}
            </Button>
          </form>
        )}
      </div>

      {/* Footer section — the realm statement (the artboard's grey band). */}
      <div className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)] px-[var(--space-7)] py-[var(--space-4)]">
        <p className="t-caption text-[var(--text-body)]">{t('realmNote')}</p>
      </div>
    </Panel>
  );
}
