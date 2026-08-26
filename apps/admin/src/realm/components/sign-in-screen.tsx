import { useMutation } from '@tanstack/react-query';
import { Callout, Panel } from '@easyesg/ui';
import { useReducer } from 'react';
import { useTranslations } from 'use-intl';
import {
  API_OUTCOME,
  PROBLEM_TYPE,
  type AdminAccount,
  type ApiFailure,
} from '@easyesg/contracts';
import { beginSignIn, completeSignIn } from '../session';
import { CredentialStep } from './credential-step';
import { FactorStep } from './factor-step';

/**
 * A-01 · Admin sign-in (UC-68, FR-75) — the two-step handshake the artboard draws (`EasyESG
 * Admin Console Screens.dc.html`, values extracted per OQ-10): the credential opens a sealed
 * five-minute challenge, then the factor screen confirms the code **for an address the server
 * has verified** — "Conectat ca …" is a fact, not copy. One card, three sections (header with
 * its mono kicker, body, footer with the realm statement), on the Focus archetype's column.
 *
 * This component owns the **flow and the card**; each step owns its own form
 * (`credential-step.tsx`, `factor-step.tsx`). The line between them is where the state lives: a
 * step's `useForm`, its field ids and its field-level messages are read by nothing else, while
 * the challenge, the failure and which step is showing are read by both. The steps are not
 * inventory components and adding them is not UX-89's one-off — every control they render comes
 * from `@easyesg/ui`; what they are is this screen's own composition, split where it is cohesive.
 *
 * Two properties fall out of that split rather than being maintained by hand:
 *
 * - **The step switch can no longer leak a field between steps.** Both steps used to be a
 *   `<form>` at the same position, so React reconciled them and REUSED the uncontrolled input's
 *   DOM node — the email typed at step one surfaced inside the code field, and a `key` was what
 *   held it off. Distinct component types cannot be reconciled into each other, so the hazard is
 *   now structural. Reintroducing a shared step component brings it back.
 * - **Leaving a step discards what was typed into it**, because the form unmounts with it. That
 *   is the behaviour this screen wants: "Folosește alt cont" means the previous address is
 *   exactly what should not be prefilled, and neither a password nor a spent code has any reason
 *   to outlive the step that collected it. Pinned by spec so it stays a decision.
 *
 * Mutations ride TanStack Query — the console's data layer (§12.1; the 24 Aug 2026 review caught
 * this screen carrying web's Server-Action idiom instead) — with `ApiOutcome` as the resolved
 * value, so failures stay values and the container's discipline holds end to end. The refusal
 * Callouts stay here because the failure is the mutation's, and both steps render it identically;
 * an `ApiFailureCallout` component would be an abstraction with one call site today.
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + UX-111 summary) · error —
 * recoverable, as received; the one branch is `authentication-required` on the factor step —
 * the challenge lapsed, so the flow returns to the credential with the api's wording shown.
 *
 * Drawn by the artboard and deferred at screen level: the LOGGED audit note (owed with task 28's
 * request-tier audit capture — omitted rather than stated while untrue, per the 24 Aug review's
 * batch). The artboard's full-dark ground vs the Focus shell's dark-header-light-ground is a
 * recorded divergence for design review, not a fork of the archetype. The factor step's own
 * deferrals are listed in `factor-step.tsx`.
 */
const STEP = {
  Credential: 'credential',
  Factor: 'factor',
} as const;

type SignInStep =
  | { kind: typeof STEP.Credential }
  | { kind: typeof STEP.Factor; email: string };

/**
 * The handshake's state, as one value and the events that move it.
 *
 * **`step` and `failure` were two `useState`s and are one state** (26 Aug 2026, project owner's
 * rule for both front ends). Every handler wrote both: advancing cleared the failure and set the
 * step, a lapsed challenge set the step and then set the failure, restarting set both. Three call
 * sites spelling out one transition each, with the reader left to reconstruct what actually
 * happens on each event.
 *
 * Writing the whole next state is what makes the lapsed-challenge branch legible: it returns to
 * the credential step **and keeps the refusal**, so the api's own explanation is what greets the
 * reader there. As two setters that was a `setStep` inside an `if` followed by an unconditional
 * `setFailure`, which is the same behaviour and reads like a fall-through.
 */
interface SignInState {
  readonly step: SignInStep;
  readonly failure: ApiFailure | null;
}

const SIGN_IN_EVENT = {
  /** The credential was accepted: a sealed challenge is open for this address. */
  CHALLENGE_OPENED: 'challenge_opened',
  /** The api refused, at whichever step asked. */
  REFUSED: 'refused',
  /** The five-minute challenge lapsed (§12.5.6), so the flow starts again from the credential. */
  CHALLENGE_LAPSED: 'challenge_lapsed',
  /** "Use another account" — the reader chose to start over. */
  RESTARTED: 'restarted',
  /**
   * A step's form left for the server. The previous refusal goes with it: a stale "wrong code"
   * above a submission that is still running says something untrue about the attempt in flight.
   */
  SUBMITTED: 'submitted',
} as const;

type SignInEvent =
  | { readonly type: typeof SIGN_IN_EVENT.CHALLENGE_OPENED; readonly email: string }
  | { readonly type: typeof SIGN_IN_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof SIGN_IN_EVENT.CHALLENGE_LAPSED; readonly failure: ApiFailure }
  | { readonly type: typeof SIGN_IN_EVENT.RESTARTED }
  | { readonly type: typeof SIGN_IN_EVENT.SUBMITTED };

const INITIAL_SIGN_IN_STATE: SignInState = {
  step: { kind: STEP.Credential },
  failure: null,
};

function signInReducer(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case SIGN_IN_EVENT.CHALLENGE_OPENED:
      return { step: { kind: STEP.Factor, email: event.email }, failure: null };

    case SIGN_IN_EVENT.REFUSED:
      // The step is deliberately untouched: a wrong code must leave the reader on the factor
      // screen with the challenge still open, which is what the retype needs.
      return { ...state, failure: event.failure };

    case SIGN_IN_EVENT.CHALLENGE_LAPSED:
      return { step: { kind: STEP.Credential }, failure: event.failure };

    case SIGN_IN_EVENT.SUBMITTED:
      return { ...state, failure: null };

    default:
      return INITIAL_SIGN_IN_STATE;
  }
}

export function SignInScreen({ onSignedIn }: { onSignedIn: (account: AdminAccount) => void }) {
  const t = useTranslations('realm.signIn');
  const tCommon = useTranslations('realm');
  const [{ step, failure }, dispatch] = useReducer(signInReducer, INITIAL_SIGN_IN_STATE);

  const begin = useMutation({
    mutationFn: beginSignIn,
    onSuccess: (outcome) => {
      dispatch(
        outcome.status === API_OUTCOME.Ok
          ? { type: SIGN_IN_EVENT.CHALLENGE_OPENED, email: outcome.value.email }
          : { type: SIGN_IN_EVENT.REFUSED, failure: outcome },
      );
    },
  });

  const complete = useMutation({
    mutationFn: completeSignIn,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) {
        onSignedIn(outcome.value);
        return;
      }
      // The challenge lapsed (§12.5.6 — five minutes): sign-in restarts from the credential, with
      // the api's own explanation shown there. Any other refusal keeps the reader where they are.
      const lapsed =
        outcome.status === API_OUTCOME.Problem &&
        outcome.problem.type === PROBLEM_TYPE.AuthenticationRequired;
      dispatch({
        type: lapsed ? SIGN_IN_EVENT.CHALLENGE_LAPSED : SIGN_IN_EVENT.REFUSED,
        failure: outcome,
      });
    },
  });

  const restart = () => dispatch({ type: SIGN_IN_EVENT.RESTARTED });

  // A const alias of a discriminant check, so TypeScript narrows `step` through it — `step.email`
  // below is checked, not asserted.
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

      {/* Body section — the refusal, then the step that is showing. */}
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
          <FactorStep
            busy={complete.isPending}
            onSubmit={(command) => {
              dispatch({ type: SIGN_IN_EVENT.SUBMITTED });
              complete.mutate(command);
            }}
            onChangeAccount={restart}
          />
        ) : (
          <CredentialStep
            busy={begin.isPending}
            onSubmit={(command) => {
              dispatch({ type: SIGN_IN_EVENT.SUBMITTED });
              begin.mutate(command);
            }}
          />
        )}
      </div>

      {/* Footer section — the realm statement (the artboard's grey band). */}
      <div className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)] px-[var(--space-7)] py-[var(--space-4)]">
        <p className="t-caption text-[var(--text-body)]">{t('realmNote')}</p>
      </div>
    </Panel>
  );
}
