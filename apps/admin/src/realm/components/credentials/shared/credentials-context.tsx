import { API_OUTCOME, type ApiOutcome } from '@easyesg/contracts';
import { createContext, use, useCallback, useMemo, useReducer, type ReactNode } from 'react';
import { useForm, type Control } from 'react-hook-form';
import type { CredentialsArrival } from '../../../tools/credentials-arrival';
import {
  CREDENTIALS_EVENT,
  credentialsReducer,
  initialCredentialsState,
  reauthenticationOutlives,
  type CredentialsEvent,
  type CredentialsSection,
  type CredentialsState,
} from '../../../tools/credentials-state';

/**
 * **Admission test** (`shared-admission-test`): a file here is read by more than one region folder of
 * A-19's `components/`, and belongs to none of them.
 *
 * A-19's screen state, in one place its regions read from (task 151) — S-28's
 * `credentials-context.tsx` shape, for its reason: what the sections need is the state's API, and
 * threading it would restate that API at every child.
 *
 * **Where it departs from S-28's, and why.**
 *
 * - **The writes are the sections' own `useMutation`s** — the console's data layer (§12.1) — where
 *   S-28 runs Server Actions through one `perform`. What this provider owns is what every write
 *   shares: the one current-password field, and turning an answer into the event the reducer hears,
 *   so no section reads an outcome's discriminator.
 * - **One write at a time, for the whole record.** There is one password field and one place a
 *   pending write is recorded; a second write started beside the first would spend the same password
 *   and place its notice in the wrong section. So while any write runs, every other write control is
 *   inert (`useSectionActivity`).
 * - **The password is required.** An operator account always holds one — S-28 had to admit a
 *   provider-only account with none — so an empty field is refused here, with focus sent to it and its
 *   message shown, rather than spent as a request the api would refuse.
 *
 * **`useCallback` and `useMemo` are load-bearing**, S-28's reason: a context value rebuilt every
 * render re-renders every consumer, and `reactCompiler` is off (AD-9).
 */
export interface ReauthenticationForm {
  password: string;
}

interface CredentialsContextValue extends CredentialsState {
  /** The current-password field's binding, which `ReauthGate` renders. */
  readonly control: Control<ReauthenticationForm>;
  /**
   * Start a write that needs the current password. The field is validated first — focused, with its
   * message, when empty — and `run` is called with its value only when it holds one.
   */
  readonly authorise: (section: CredentialsSection, run: (password: string) => void) => void;
  /**
   * An answer, as the event the screen hears: `onOk` says what a success means, and a refusal is one
   * branch, here, placed in whichever section was acting.
   */
  readonly settle: <T>(outcome: ApiOutcome<T>, onOk: (value: T) => CredentialsEvent) => void;
  readonly abandonEnrolment: () => void;
  readonly acknowledgeCodes: () => void;
}

const CredentialsContext = createContext<CredentialsContextValue | null>(null);

/**
 * The screen's state, from anywhere inside it. Throws rather than answering `null`: a region rendered
 * outside the provider would otherwise fail as an undefined read somewhere unrelated to the mistake.
 */
export function useCredentials(): CredentialsContextValue {
  const value = use(CredentialsContext);
  if (value === null) {
    throw new Error('useCredentials must be used inside <CredentialsProvider>');
  }
  return value;
}

/** A section's write controls: `busy` while its own write runs, `inert` while another section's does. */
export function useSectionActivity(section: CredentialsSection): {
  readonly busy: boolean;
  readonly inert: boolean;
} {
  const { pending } = useCredentials();
  return { busy: pending === section, inert: pending !== null && pending !== section };
}

export function CredentialsProvider({
  arrival,
  children,
}: {
  readonly arrival: CredentialsArrival | undefined;
  readonly children: ReactNode;
}) {
  const [state, dispatch] = useReducer(credentialsReducer, arrival, initialCredentialsState);
  const { control, handleSubmit, reset } = useForm<ReauthenticationForm>({
    mode: 'onTouched',
    defaultValues: { password: '' },
  });

  // Every event after a write passes through here, so the password is cleared by one rule — the
  // reducer's own answer to whether an enrolment is still waiting for it.
  const apply = useCallback(
    (event: CredentialsEvent) => {
      if (!reauthenticationOutlives(state, event)) reset();
      dispatch(event);
    },
    [state, reset],
  );

  const authorise = useCallback<CredentialsContextValue['authorise']>(
    (section, run) => {
      // The field is not a form of its own, and this is its submission: `handleSubmit` validates it,
      // focuses it when it is empty, and calls through only with a value.
      void handleSubmit(({ password }) => {
        dispatch({ type: CREDENTIALS_EVENT.ACTION_STARTED, section });
        run(password);
      })();
    },
    [handleSubmit],
  );

  // Typed by lookup and taking plain parameters, not a destructured generic — `apps/web`'s
  // `credentials-context.tsx` records that the compiler's static analysis cannot preserve the
  // memoization through the latter.
  const settle = useCallback<CredentialsContextValue['settle']>(
    (outcome, onOk) => {
      apply(
        outcome.status === API_OUTCOME.Ok
          ? onOk(outcome.value)
          : { type: CREDENTIALS_EVENT.ACTION_REFUSED, failure: outcome },
      );
    },
    [apply],
  );

  const abandonEnrolment = useCallback(
    () => apply({ type: CREDENTIALS_EVENT.ENROLMENT_ABANDONED }),
    [apply],
  );

  const acknowledgeCodes = useCallback(
    () => apply({ type: CREDENTIALS_EVENT.CODES_ACKNOWLEDGED }),
    [apply],
  );

  const value = useMemo<CredentialsContextValue>(
    () => ({ ...state, control, authorise, settle, abandonEnrolment, acknowledgeCodes }),
    [state, control, authorise, settle, abandonEnrolment, acknowledgeCodes],
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}
