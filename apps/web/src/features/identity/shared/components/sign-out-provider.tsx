'use client';

import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { useUnsentWork } from '@/client/unsent-work/unsent-work';
import { signOutAction } from '../actions/actions';
import {
  INITIAL_SIGN_OUT_STATE,
  SIGN_OUT_EVENT,
  SIGN_OUT_STAGE,
  signOutIsAt,
  signOutReducer,
} from '../tools/sign-out-state';

/**
 * Sign-out, held once for the whole `(app)` layout (task 93; UC-06, UX-37, FR-5).
 *
 * **UX-37's third trigger.** A sign-out that would abandon unsent answers sends them first where it can,
 * and asks — with a chance to cancel — where it cannot. While they are going the reader is shown nothing
 * beyond what the screen already says (`architecture.md` §12.5.6's task-93 row): in the wizard that is the
 * save-state indicator and the unsynced banner, and everywhere else there is nothing to wait for.
 *
 * **Why the flow is here and not in the controls**, which is task 83.2's lesson one trigger along: the
 * account menu and the compact drawer each close on the press, so a wait, a question and a submission held
 * inside either would be unmounted before the queue had gone anywhere. Both controls hand the press over
 * and this carries it through.
 *
 * **The form is still the controls' to submit before hydration.** It carries `SIGN_OUT_FORM`, and each
 * control is a `type="submit"` button associated by `form=`, so a press the browser handles itself signs
 * out directly — a browser running no script has no queue to guard. Once hydrated the control cancels that
 * default and asks here instead, and this submits when the answer is known.
 */
const SIGN_OUT_FORM = 'chrome-sign-out';

export interface SignOutValue {
  /** The id every sign-out control associates with, so a press before hydration still submits. */
  readonly formId: string;
  /** A press, once hydrated: sent first where the queue can go, asked about where it cannot. */
  readonly requestSignOut: () => void;
}

const SignOutContext = createContext<SignOutValue | null>(null);

export function SignOutProvider({ children }: { readonly children: ReactNode }) {
  const t = useTranslations('chrome.signOut.confirm');
  const { unsynced, blocked, retry } = useUnsentWork();
  const [state, dispatch] = useReducer(signOutReducer, INITIAL_SIGN_OUT_STATE);
  const form = useRef<HTMLFormElement>(null);

  const requestSignOut = useCallback(() => {
    dispatch({ type: SIGN_OUT_EVENT.REQUESTED, unsent: unsynced > 0 });
    // UX-37's *flushed first*: another attempt now, rather than on the queue's own backoff.
    if (unsynced > 0) retry();
  }, [unsynced, retry]);

  // A waiting sign-out moves when the answers do: it leaves once they have gone, and asks once they cannot.
  const waiting = signOutIsAt(state, SIGN_OUT_STAGE.WAITING);
  useEffect(() => {
    if (!waiting) return;
    if (unsynced === 0) dispatch({ type: SIGN_OUT_EVENT.UNSENT_SENT });
    else if (blocked) dispatch({ type: SIGN_OUT_EVENT.UNSENT_BLOCKED });
  }, [waiting, unsynced, blocked]);

  // The submission is the effect of reaching `leaving`, from whichever stage — so the action is called in
  // exactly one place however the answer was reached, and the reducer decides what that answer was.
  const leaving = signOutIsAt(state, SIGN_OUT_STAGE.LEAVING);
  useEffect(() => {
    if (leaving) form.current?.requestSubmit();
  }, [leaving]);

  const value = useMemo<SignOutValue>(() => ({ formId: SIGN_OUT_FORM, requestSignOut }), [requestSignOut]);

  return (
    <SignOutContext.Provider value={value}>
      {children}
      {/* Bound with no return path: this is a plain *leave*, not S-03's *leave and come back as somebody
          else* (task 26.3 gave the action that parameter), and binding keeps the signature a form action. */}
      <form id={SIGN_OUT_FORM} ref={form} action={signOutAction.bind(null, undefined)} hidden />
      <ConsequenceDialogue
        open={signOutIsAt(state, SIGN_OUT_STAGE.CONFIRMING)}
        title={t('title')}
        object={t('object', { count: unsynced })}
        consequence={t('consequence')}
        retained={t('retained')}
        confirmLabel={t('proceed')}
        cancelLabel={t('cancel')}
        onConfirm={() => dispatch({ type: SIGN_OUT_EVENT.CONFIRMATION_ANSWERED, leaving: true })}
        onCancel={() => dispatch({ type: SIGN_OUT_EVENT.CONFIRMATION_ANSWERED, leaving: false })}
      />
    </SignOutContext.Provider>
  );
}

export function useSignOut(): SignOutValue {
  const value = use(SignOutContext);
  if (value === null) {
    throw new Error('useSignOut must be used within SignOutProvider (the `(app)` layout).');
  }
  return value;
}
