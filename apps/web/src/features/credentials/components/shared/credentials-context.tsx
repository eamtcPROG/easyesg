'use client';

import { createContext, use, useCallback, useMemo, useReducer, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { SocialProvider } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice, successNotice, type Notice, type NoticeCopy } from '@/lib/notice';
import { SECTION_READ, type CredentialsRead } from '../../tools/credentials';
import {
  CREDENTIALS_EVENT,
  credentialsReducer,
  initialCredentialsState,
  type CredentialsEvent,
  type CredentialsSection,
  type CredentialsState,
  type OpenableStage,
} from '../../tools/credentials-state';
import { CREDENTIALS_MESSAGES } from './credentials-messages';

/**
 * S-28's screen state, in one place its rows read from (28 Aug 2026, project owner's review; task 169).
 *
 * **In `components/shared/` on one test: more than one sibling reads it** — the board provides it, and the notice,
 * every row and the closing note read it.
 *
 * **`perform` inverts `onSettled(outcome, success)`** (28 Aug 2026): a row says what to run and what a success
 * *means*, and never sees a failure — the refusal is one branch, here, built from the api's own text.
 *
 * **It holds no password since task 169.** The record-level re-authentication field is gone with OQ-19's close: each
 * opened row asks for the current password in its own form and hands it to its own action, so no secret outlives the
 * row that asked for it, and one row open at a time is what keeps the screen from asking twice.
 *
 * **What this is not.** It holds no server state: the three reads arrive resolved from the Server Component and
 * nothing here caches or refetches them. **`useCallback` and `useMemo` are load-bearing** — a context value rebuilt
 * every render re-renders every consumer, and `reactCompiler` is off with a recorded reason (AD-9).
 */
interface CredentialsContextValue extends CredentialsState {
  /** The three section reads, each carrying its own §8.1 outcome — see `SectionUnavailable`. */
  readonly read: CredentialsRead;
  /**
   * Whether an opened row asks for the current password. False only where the read says the account holds none
   * (FR-2) — there the session stands as the credential, which the api admits; an unread state asks, since the api
   * would refuse a password-holding account an empty one.
   */
  readonly asksPassword: boolean;
  /**
   * Run one row's action and report it. `onSuccess` turns the value into the event the screen should hear; failures
   * never reach it. `clear` runs whatever the outcome, for a form holding a credential of its own to empty.
   */
  readonly perform: <T>(input: {
    readonly section: CredentialsSection;
    readonly action: () => Promise<ApiOutcome<T>>;
    readonly onSuccess: (value: T) => CredentialsEvent;
    readonly clear?: () => void;
  }) => void;
  /** The ordinary success: a notice, and every row back at rest. */
  readonly succeeded: (copy: NoticeCopy) => CredentialsEvent;
  /** The same notice, for an event that also changes the stage (`CODES_ISSUED`). */
  readonly successNotice: (copy: NoticeCopy) => Notice;
  /** A trigger's press: open its row at this step. */
  readonly open: (stage: OpenableStage) => void;
  /** Close whichever row is open — a cancel, the trigger pressed again, the codes put away. */
  readonly dismiss: () => void;
}

const CredentialsContext = createContext<CredentialsContextValue | null>(null);

/** The screen's state, from anywhere inside it. Throws outside the provider rather than failing somewhere unrelated. */
export function useCredentials(): CredentialsContextValue {
  const value = use(CredentialsContext);
  if (value === null) {
    throw new Error('useCredentials must be used inside <CredentialsProvider>');
  }
  return value;
}

/** Whether THIS region's own controls should be inert — never another's (S-16's per-row lesson). */
export function useSectionBusy(section: CredentialsSection): boolean {
  return useCredentials().pendingSection === section;
}

export function CredentialsProvider({
  read,
  pendingLinkProvider,
  children,
}: {
  readonly read: CredentialsRead;
  /** Set when a provider round trip has just returned — the screen is born with that provider's row open. */
  readonly pendingLinkProvider: SocialProvider | null;
  readonly children: ReactNode;
}) {
  const t = useTranslations(CREDENTIALS_MESSAGES);
  const [, startAction] = useTransition();
  const [state, dispatch] = useReducer(credentialsReducer, pendingLinkProvider, initialCredentialsState);

  const asksPassword = !(read.password.status === SECTION_READ.READY && !read.password.value.set);

  const buildSuccess = useCallback((copy: NoticeCopy) => successNotice({ copy, action: t('doneAction') }), [t]);

  const succeeded = useCallback<CredentialsContextValue['succeeded']>(
    (copy) => ({ type: CREDENTIALS_EVENT.ACTION_SUCCEEDED, notice: buildSuccess(copy) }),
    [buildSuccess],
  );

  /**
   * Typed by lookup and reading `input.x`, **not by a destructured parameter**: the React Compiler's static analysis
   * cannot preserve the memoization through an inline destructured generic, and `preserve-manual-memoization` fails
   * the build — pointing at the `useMemo` below rather than here.
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
                // No `action`: NFR-79 has the api compose all three parts into `detail`.
                notice: failureNotice({
                  outcome,
                  unreachable: { title: t('failedTitle'), body: t('unreachableBody') },
                }),
              },
        );
        input.clear?.();
      });
    },
    [t],
  );

  const open = useCallback((stage: OpenableStage) => dispatch({ type: CREDENTIALS_EVENT.OPENED, stage }), []);
  const dismiss = useCallback(() => dispatch({ type: CREDENTIALS_EVENT.DISMISSED }), []);

  const value = useMemo<CredentialsContextValue>(
    () => ({
      ...state,
      read,
      asksPassword,
      perform,
      succeeded,
      successNotice: buildSuccess,
      open,
      dismiss,
    }),
    [state, read, asksPassword, perform, succeeded, buildSuccess, open, dismiss],
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}
