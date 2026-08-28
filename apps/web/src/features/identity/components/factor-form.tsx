'use client';

import { Button, Callout, CALLOUT_INTENT, Panel, TextLink } from '@easyesg/ui';
import { FormCodeField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useEffect, useReducer, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { completeFactorAction } from '../actions';
import { ANSWER_LENGTH, FACTOR_ANSWER, type FactorAnswerKind } from '../factor';
import {
  FACTOR_EVENT,
  FACTOR_STANDING,
  INITIAL_FACTOR_STATE,
  factorReducer,
  isLockout,
} from '../factor-state';
import styles from './identity-screens.module.css';

/**
 * S-01's staged second-factor step (UC-194, UC-195).
 *
 * **Two affordances over one field.** The API takes a single `code` and tells the two apart by
 * shape, so switching here changes the control and nothing else: six numeric cells that a password
 * manager can autofill (`one-time-code`), or a sixteen-character recovery code typed by hand. The
 * design spec asks for both on this step, and UX-108 is why the recovery route is *offered* rather
 * than hidden behind a support request — a person locked out of their authenticator must not need
 * a second device to get in.
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + the UX-111 summary) · error —
 * recoverable (a wrong or spent code, the throttle, an unreachable API; all rendered as received,
 * no branch) · error — recoverable (the FR-4 lockout, which factor failures count toward — the
 * action slot routes to the reset link, since that is the only release before Phase 8) · **expired**,
 * where the five-minute window closed and the form is replaced by the way back to S-01.
 *
 * Success never renders: the action redirects, exactly as password sign-in does.
 */
interface FactorInput {
  code: string;
}

/**
 * How often the countdown is re-read. Fifteen seconds, because the hint is worded in whole minutes
 * — a per-second timer would re-render the form sixty times to change nothing, and this control
 * already re-renders on every keystroke by design.
 */
const TICK_MS = 15_000;

const MS_PER_MINUTE = 60_000;

export function FactorForm({ expiresAt }: { expiresAt: number }) {
  const t = useTranslations('identity.factor');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(factorReducer, INITIAL_FACTOR_STATE);

  const { control, handleSubmit, reset } = useForm<FactorInput>({ mode: 'onSubmit' });

  /**
   * Minutes left, or `null` until the first tick — its own `useState` because nothing moves with
   * it: a tick changes this and only this, which is the case the reducer rule leaves to `useState`.
   *
   * **Deliberately not derived during render**, against `rerender-derived-state-no-effect`. That
   * rule is about values computable from props and state, and this one is computed from the clock:
   * the server rendered this markup at one instant and the browser hydrates at another, so a read
   * during render is a hydration mismatch by construction. The effect is a *subscription* to the
   * clock, not a state-sync effect. The cost is the hint being absent for one frame, which is
   * nothing — it is a hint, not layout, so `rendering-hydration-no-flicker`'s inline-script remedy
   * would be a script fighting reconciliation to save a reader from noticing nothing.
   */
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const readClock = () => {
      const remaining = expiresAt - Date.now();
      // One setter per branch: at zero the whole form is replaced, so there is no hint left to
      // write and writing one anyway would be the two-setters-in-one-handler tell.
      if (remaining <= 0) dispatch({ type: FACTOR_EVENT.WINDOW_CLOSED });
      else setMinutesLeft(Math.ceil(remaining / MS_PER_MINUTE));
    };
    readClock();
    const timer = setInterval(readClock, TICK_MS);
    return () => clearInterval(timer);
    // `dispatch` and a `useState` setter are both stable by React's guarantee — with
    // `reactCompiler` off (AD-9) that is one dependency list that cannot fall behind its body.
  }, [expiresAt]);

  /**
   * Switching affordance clears the field as well as the standing — a six-digit attempt left in
   * the box under a sixteen-character label is a refusal waiting to happen, and the reader did not
   * ask to resubmit it.
   *
   * Unmemoized on purpose: it reaches a plain DOM `onClick`, whose identity nothing observes, and
   * `rerender-memo`'s own companion rule says wrapping that is noise rather than optimisation.
   */
  const chooseAnswer = (answer: FactorAnswerKind) => {
    reset({ code: '' });
    dispatch({ type: FACTOR_EVENT.ANSWER_CHOSEN, answer });
  };

  const submit = handleSubmit((input) => {
    dispatch({ type: FACTOR_EVENT.SUBMITTED });
    startTransition(async () => {
      const result = await completeFactorAction({ code: input.code.trim() });
      // One event carrying the outcome — the reducer owns what each outcome means, including the
      // `undefined` that says the redirect won and this tree is unmounting.
      dispatch({ type: FACTOR_EVENT.SETTLED, result });
    });
  });

  const { answer, standing } = state;
  const isRecovery = answer === FACTOR_ANSWER.RECOVERY;

  if (standing.kind === FACTOR_STANDING.LAPSED) {
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('lapsedTitle')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.SIGN_IN}>{t('lapsedAction')}</Link>
          </TextLink>
        }
      >
        {t('lapsedBody')}
      </Callout>
    );
  }

  const problem =
    standing.kind === FACTOR_STANDING.REFUSED && standing.failure.status === API_OUTCOME.Problem
      ? standing.failure.problem
      : null;
  const locked = isLockout(standing);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={t('summaryTitle')} />

      {problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={problem.title ?? t('problemTitle')}
          /*
            **The action slot carries a remedy only where this screen owns one** (corrected
            27 Aug 2026). It used to render `problemAction` — "check the clock on your device, then
            try again with the code showing now" — for every problem, so the throttle refusal
            arrived as the API's "wait a few minutes" sitting directly above our "try again now".
            Two instructions, contradicting each other, with the wrong one in the position NFR-79
            reserves for what to do next.

            The API's `detail` is already the three-part message and always states its own remedy,
            so the default is to say nothing further. The lockout is the one exception, and it earns
            it by being the refusal whose way out is a different SCREEN: the reset link is the only
            release before Phase 8, and no `detail` can navigate.
          */
          action={
            locked ? (
              <TextLink asChild>
                <Link href={ROUTES.RESET}>{t('lockedAction')}</Link>
              </TextLink>
            ) : null
          }
        >
          {problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {standing.kind === FACTOR_STANDING.REFUSED &&
      standing.failure.status === API_OUTCOME.Unreachable ? (
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
          {isRecovery ? (
            <FormTextField
              control={control}
              name="code"
              label={t('recoveryLabel')}
              help={t('recoveryHelp')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              rules={{ required: t('recoveryMissing') }}
            />
          ) : (
            <FormCodeField
              control={control}
              name="code"
              label={t('codeLabel')}
              help={t('codeHelp')}
              length={ANSWER_LENGTH[FACTOR_ANSWER.AUTHENTICATOR]}
              hint={minutesLeft === null ? null : t('expiresIn', { minutes: minutesLeft })}
              rules={{ required: t('codeMissing') }}
            />
          )}

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>

      <p className={styles.altAction}>
        {/* Both directions of one switch. `asChild` over a real `<button>` rather than an anchor:
            this changes what the form shows and goes nowhere, and an anchor with no destination is
            the assistive-technology lie the inventory's composition slot exists to avoid. It also
            means the affordance works with no JavaScript beyond what the form already needs. */}
        <TextLink asChild>
          <button
            type="button"
            onClick={() =>
              chooseAnswer(isRecovery ? FACTOR_ANSWER.AUTHENTICATOR : FACTOR_ANSWER.RECOVERY)
            }
          >
            {isRecovery ? t('useAuthenticator') : t('useRecovery')}
          </button>
        </TextLink>
      </p>

      <p className={styles.altAction}>
        <TextLink asChild>
          <Link href={ROUTES.SIGN_IN}>{t('startOver')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
