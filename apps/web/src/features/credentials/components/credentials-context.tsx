'use client';

import { createContext, use, useCallback, useMemo, useReducer, useTransition } from 'react';
import type { ReactNode } from 'react';
import { useForm, type Control } from 'react-hook-form';
import type { SocialProvider } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice, successNotice, type Notice, type NoticeCopy } from '@/lib/notice';
import type { CredentialsRead } from '../credentials';
import {
  CREDENTIALS_EVENT,
  credentialsReducer,
  initialCredentialsState,
  type CredentialsEvent,
  type CredentialsSection,
  type CredentialsState,
} from '../credentials-state';

/**
 * S-28's screen state, in one place its sections read from (28 Aug 2026, project owner's review).
 *
 * **The first cut threaded it.** `CredentialsBoard` held the reducer and passed `busy`, `onStart`
 * and `onSettled` into all three sections, plus `getPassword`, plus three more callbacks into the
 * factor — nine props, five of them callbacks whose only purpose was to reach a reducer two levels
 * up. This is the shape `access-context.tsx` replaced on S-16, for the same reason: the props were
 * not data the sections needed, they were the state's own API, spelled out again at every child.
 *
 * **`onSettled(outcome, success)` was the specific defect.** It conflated *"here is what came
 * back"* with *"here is what success says"*, so every section imported `API_OUTCOME`, read the
 * discriminator itself, and then supplied success copy on branches where the outcome was provably
 * a failure — three call sites in `factor-section.tsx` passed `enabledTitle`/`enabledBody` to a
 * refusal. `perform` inverts it: the section says what to run and what a success *means*, and
 * never sees a failure at all.
 *
 * **What this is not.** It holds no server state. The two reads arrive resolved from the Server
 * Component and nothing here caches or refetches them; what lives here is which section is acting,
 * what the last one said, and which stage the screen is in — precisely the residue
 * `apps/web/CLAUDE.md` assigns to React context, and precisely not the "cache server state twice"
 * reach it warns against.
 *
 * **`useCallback` and `useMemo` are load-bearing.** A context value rebuilt every render re-renders
 * every consumer, and `reactCompiler` is off with a recorded reason (AD-9). `dispatch` is stable by
 * React's own guarantee, which is a second reason the reducer suits this file.
 */
export interface ReauthForm {
  password: string;
}

interface CredentialsContextValue extends CredentialsState {
  /** The two section reads, each carrying its own §8.1 outcome — see `SectionUnavailable`. */
  readonly read: CredentialsRead;
  /** The record-level re-authentication field's binding. */
  readonly control: Control<ReauthForm>;
  /**
   * The record's shared password, **read at the moment of the action**.
   *
   * `getValues` does not subscribe, which is wanted twice over: no section re-renders on a
   * keystroke, and the value sent is the one on screen when the button was pressed rather than the
   * one captured by the render that built the closure.
   */
  readonly password: () => string | undefined;
  /**
   * Run one section's action and report it.
   *
   * `onSuccess` turns the value into the event the screen should hear — usually `succeeded(…)`,
   * and for the two actions that answer something shown exactly once, a stage change. Failures
   * never reach it: they are one branch, here, built from the API's own text.
   */
  readonly perform: <T>(input: {
    readonly section: CredentialsSection;
    readonly action: () => Promise<ApiOutcome<T>>;
    readonly onSuccess: (value: T) => CredentialsEvent;
    /**
     * Called whatever the outcome, for a section holding a credential of its own to clear.
     *
     * The record's shared password is reset here regardless; this is for the fields `perform`
     * cannot know about — S-28's new-password field, which after a refusal is a live credential
     * sitting in the DOM and after a success is one the account no longer has.
     */
    readonly clear?: () => void;
  }) => void;
  /** The ordinary success: a notice, and back to rest. */
  readonly succeeded: (copy: NoticeCopy) => CredentialsEvent;
  /** The same notice, for an event that also changes the stage (`CODES_ISSUED`). */
  readonly successNotice: (copy: NoticeCopy) => Notice;
  /** The reader has put the codes away, or abandoned an enrolment. */
  readonly dismiss: () => void;
}

const CredentialsContext = createContext<CredentialsContextValue | null>(null);

/**
 * The screen's state, from anywhere inside it.
 *
 * Throws rather than answering `null`: a section rendered outside the provider would otherwise
 * fail as an undefined property access somewhere further down, in a component that has nothing to
 * do with the mistake.
 */
export function useCredentials(): CredentialsContextValue {
  const value = use(CredentialsContext);
  if (value === null) {
    throw new Error('useCredentials must be used inside <CredentialsProvider>');
  }
  return value;
}

/** Whether THIS section's own controls should be inert — never another's (S-16's per-row lesson). */
export function useSectionBusy(section: CredentialsSection): boolean {
  return useCredentials().pendingSection === section;
}

export function CredentialsProvider({
  read,
  pendingLinkProvider,
  children,
}: {
  readonly read: CredentialsRead;
  /** Set when a provider round trip has just returned — the screen is born mid-flow. */
  readonly pendingLinkProvider: SocialProvider | null;
  readonly children: ReactNode;
}) {
  const t = useTranslations('identity.credentials');
  const [, startAction] = useTransition();
  const [state, dispatch] = useReducer(
    credentialsReducer,
    pendingLinkProvider,
    initialCredentialsState,
  );
  const { control, getValues, reset } = useForm<ReauthForm>({ defaultValues: { password: '' } });

  const password = useCallback(() => getValues('password') || undefined, [getValues]);

  const buildSuccess = useCallback(
    (copy: NoticeCopy) => successNotice({ copy, action: t('doneAction') }),
    [t],
  );

  const succeeded = useCallback<CredentialsContextValue['succeeded']>(
    (copy) => ({ type: CREDENTIALS_EVENT.ACTION_SUCCEEDED, notice: buildSuccess(copy) }),
    [buildSuccess],
  );

  /**
   * Typed by lookup and reading `input.x`, **not by a destructured parameter** — which is what
   * `access-context.tsx` does, and here it is required rather than stylistic. Written as
   * `<T,>({ section, action, onSuccess, clear }: { … }) => …`, the React Compiler's static
   * analysis cannot preserve the memoization through the inline destructured generic, and
   * `react-hooks/preserve-manual-memoization` fails the build — pointing at the `useMemo` below,
   * which is downstream of it, rather than here.
   */
  const perform = useCallback<CredentialsContextValue['perform']>(
    (input) => {
      dispatch({ type: CREDENTIALS_EVENT.ACTION_STARTED, section: input.section });
      startAction(async () => {
        const outcome = await input.action();
        dispatch(
          outcome.status === API_OUTCOME.Ok
            ? input.onSuccess(outcome.value)
            : {
                type: CREDENTIALS_EVENT.ACTION_FAILED,
                // No `action`: NFR-79 has the API compose all three parts into `detail`, and the
                // catalogue sentence this used to pass — "Încercați din nou." — is the closing
                // clause of that detail, which over a throttle refusal contradicted it outright.
                notice: failureNotice({
                  outcome,
                  unreachable: { title: t('failedTitle'), body: t('unreachableBody') },
                }),
              },
        );
        // The shared password never outlives the action it authorised, whatever the outcome.
        reset();
        input.clear?.();
      });
    },
    [reset, t],
  );

  const dismiss = useCallback(() => dispatch({ type: CREDENTIALS_EVENT.DISMISSED }), []);

  const value = useMemo<CredentialsContextValue>(
    () => ({
      ...state,
      read,
      control,
      password,
      perform,
      succeeded,
      successNotice: buildSuccess,
      dismiss,
    }),
    [state, read, control, password, perform, succeeded, buildSuccess, dismiss],
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}
