'use client';

import { useReducer, useTransition } from 'react';
import { submitFactor, submitPassword } from '@/client/session/reauthenticate';
import { REAUTHENTICATION, type ReauthenticationAnswer } from '../tools/reauthentication-answer';
import type { ReauthenticatingAccount } from '../tools/reauthentication-command';
import {
  INITIAL_REAUTHENTICATION_STATE,
  REAUTHENTICATION_EVENT,
  REAUTHENTICATION_STAGE,
  reauthenticationReducer,
} from '../tools/reauthentication-state';
import { FactorStage } from './factor-stage';
import { PasswordStage } from './password-stage';
import { ReauthenticationRefusalNotice } from './reauthentication-refusal-notice';
import { SignOutLater } from './sign-out-later';
import styles from './reauthentication.module.css';

/**
 * What the dialogue holds while it is open (task 92): the stage, the refusal above it, and the second way
 * out below — and the one place an answer is read.
 *
 * **Resuming is the answer this component does not render.** It tells the screen, which is what moves —
 * its queue drains and the dialogue closes because the screen says the session is held — and every other
 * answer is one event for the reducer to name the next state from (`apps/web/CLAUDE.md`: a result reaches
 * the reducer as one event carrying the outcome).
 */
export function ReauthenticationBody({
  account,
  organizationId,
  returnTo,
  onResumed,
}: {
  readonly account: ReauthenticatingAccount;
  readonly organizationId: string | null;
  readonly returnTo: string;
  readonly onResumed: () => void;
}) {
  const [state, dispatch] = useReducer(reauthenticationReducer, INITIAL_REAUTHENTICATION_STATE);
  const [busy, startTransition] = useTransition();

  const settle = (send: () => Promise<ReauthenticationAnswer>) => {
    dispatch({ type: REAUTHENTICATION_EVENT.SUBMITTED });
    startTransition(async () => {
      const answer = await send();
      if (answer.status === REAUTHENTICATION.RESUMED) onResumed();
      else dispatch({ type: REAUTHENTICATION_EVENT.SETTLED, answer });
    });
  };

  return (
    <div className={styles.body}>
      <ReauthenticationRefusalNotice refusal={state.refusal} />

      {state.stage === REAUTHENTICATION_STAGE.PASSWORD ? (
        <PasswordStage
          email={account.email}
          busy={busy}
          onSubmit={(password) =>
            settle(() =>
              submitPassword({
                command: {
                  accountId: account.id,
                  email: account.email,
                  password,
                  remembered: account.remembered,
                  organizationId,
                },
              }),
            )
          }
        />
      ) : (
        <FactorStage
          answer={state.answer}
          busy={busy}
          onChooseAnswer={(answer) => dispatch({ type: REAUTHENTICATION_EVENT.ANSWER_CHOSEN, answer })}
          onRestart={() => dispatch({ type: REAUTHENTICATION_EVENT.RESTARTED })}
          onSubmit={(code) =>
            settle(() => submitFactor({ command: { accountId: account.id, code, organizationId } }))
          }
        />
      )}

      <SignOutLater returnTo={returnTo} />
    </div>
  );
}
