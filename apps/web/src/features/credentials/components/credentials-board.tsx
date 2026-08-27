'use client';

import type { SocialProvider } from '@easyesg/contracts';
import { useCallback, useReducer } from 'react';
import { CALLOUT_INTENT, Callout, RecordSection, RecordShell } from '@easyesg/ui';
import { FormPasswordField } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { SECTION_READ, type CredentialsRead } from '../credentials';
import {
  CREDENTIALS_EVENT,
  credentialsReducer,
  initialCredentialsState,
} from '../credentials-state';
import { FactorSection } from './factor-section';
import { PasswordSection } from './password-section';
import { ProvidersSection } from './providers-section';

/**
 * S-28's body — the Record archetype with three sections (task 27.7).
 *
 * **One reducer for the whole screen, not one per section.** The stages are exclusive — an
 * enrolment secret and a set of recovery codes cannot both be on screen — and the reader can be
 * *returned into* one by a provider round trip, which no section could have put there. Held per
 * section they would be three components each owning a third of a state machine, with every
 * impossible pair representable.
 *
 * **The re-authentication password is one field for the whole record**, and that is a shape rather
 * than a shortcut. Four of the six actions need it (§12.5.6's re-authentication row), and a
 * password field inside each section would ask one person for one secret in four places on one
 * page — leaving three of them holding a live credential in the DOM while the fourth is used.
 *
 * **It is read at the moment of the action, never captured at render.** `getValues` does not
 * subscribe, which is exactly what is wanted twice over: the sections do not re-render on every
 * keystroke of a password field, and the value they send is the one on screen when the button was
 * pressed rather than the one from the render that created the closure.
 *
 * **A section whose read failed renders §8.1's partial state instead of blanking the screen.** A
 * provider list that could not be fetched must not hide a working password form, and the retry it
 * names is a reload — honest, because this is a Server Component read.
 */
export interface CredentialsBoardProps {
  readonly read: CredentialsRead;
  /** Set when a provider round trip has just returned — the screen is born mid-flow. Typed as the
   *  contract's enum, since `readPendingLink` validates the cookie against it (27 Aug 2026). */
  readonly pendingLinkProvider: SocialProvider | null;
}

const SECTION = { PASSWORD: 'password', FACTOR: 'factor', PROVIDERS: 'providers' } as const;

interface ReauthForm {
  password: string;
}

export function CredentialsBoard({ read, pendingLinkProvider }: CredentialsBoardProps) {
  const t = useTranslations('identity.credentials');
  const tPolicy = useTranslations('identity.register');
  const [state, dispatch] = useReducer(
    credentialsReducer,
    pendingLinkProvider,
    initialCredentialsState,
  );
  const { control, getValues, reset } = useForm<ReauthForm>({ defaultValues: { password: '' } });

  // `dispatch` is stable by React's own guarantee, so these carry no dependency list — one that
  // cannot fall behind its body, which is a real saving with `reactCompiler` off (AD-9).
  const onStart = useCallback(
    (section: string) => () => {
      dispatch({ type: CREDENTIALS_EVENT.ACTION_STARTED, section });
    },
    [],
  );

  const onSettled = useCallback(
    (outcome: ApiOutcome<unknown>, success: { title: string; body: string }) => {
      dispatch(
        outcome.status === API_OUTCOME.Ok
          ? {
              type: CREDENTIALS_EVENT.ACTION_SUCCEEDED,
              notice: { intent: CALLOUT_INTENT.SUCCESS, ...success, action: t('doneAction') },
            }
          : {
              type: CREDENTIALS_EVENT.ACTION_FAILED,
              notice: {
                intent: CALLOUT_INTENT.ERROR,
                // The API's own three-part text, as received — the screen keeps no second copy of
                // "that is not your current password" or "this is your last way in".
                title:
                  outcome.status === API_OUTCOME.Problem
                    ? (outcome.problem.title ?? t('failedTitle'))
                    : t('failedTitle'),
                body:
                  outcome.status === API_OUTCOME.Problem
                    ? (outcome.problem.detail ?? t('unreachableBody'))
                    : t('unreachableBody'),
                action: t('failedAction'),
              },
            },
      );
      // The shared password never outlives the action it authorised, whatever the outcome.
      reset();
    },
    [t, reset],
  );

  const busy = (section: string) => state.pendingSection === section;
  const getPassword = useCallback(() => getValues('password') || undefined, [getValues]);

  const unreachable = (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t('unreachable.title')}
      action={t('failedAction')}
    >
      {t('unreachable.body')}
    </Callout>
  );

  return (
    <RecordShell title={t('title')} summary={t('lede')}>
      {state.notice ? (
        <Callout
          intent={state.notice.intent}
          title={state.notice.title}
          action={state.notice.action}
        >
          {state.notice.body}
        </Callout>
      ) : null}

      <RecordSection
        id={SECTION.PASSWORD}
        heading={t('password.heading')}
        description={t('password.description')}
      >
        <PasswordSection
          busy={busy(SECTION.PASSWORD)}
          onStart={onStart(SECTION.PASSWORD)}
          onSettled={onSettled}
        />
      </RecordSection>

      <RecordSection
        id={SECTION.FACTOR}
        heading={t('factor.heading')}
        description={t('factor.description')}
      >
        {read.factor.status === SECTION_READ.READY ? (
          <FactorSection
            busy={busy(SECTION.FACTOR)}
            enrolled={read.factor.value.enrolled}
            recoveryCodesRemaining={read.factor.value.recoveryCodesRemaining}
            stage={state.stage}
            getPassword={getPassword}
            onStart={onStart(SECTION.FACTOR)}
            onSettled={onSettled}
            onEnrolmentOffered={(offer) => {
              dispatch({ type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, ...offer });
            }}
            onCodesIssued={(codes, title, body) => {
              dispatch({
                type: CREDENTIALS_EVENT.CODES_ISSUED,
                codes,
                notice: {
                  intent: CALLOUT_INTENT.SUCCESS,
                  title,
                  body,
                  action: t('doneAction'),
                },
              });
            }}
            onDismiss={() => {
              dispatch({ type: CREDENTIALS_EVENT.DISMISSED });
            }}
          />
        ) : (
          unreachable
        )}
      </RecordSection>

      <RecordSection
        id={SECTION.PROVIDERS}
        heading={t('providers.heading')}
        description={t('providers.description')}
      >
        {read.providers.status === SECTION_READ.READY ? (
          <ProvidersSection
            busy={busy(SECTION.PROVIDERS)}
            linked={read.providers.value}
            stage={state.stage}
            getPassword={getPassword}
            onStart={onStart(SECTION.PROVIDERS)}
            onSettled={onSettled}
          />
        ) : (
          unreachable
        )}
      </RecordSection>

      {/* One field for the four re-authenticated actions, at the foot where it reads as the
          record's rather than any one section's. A provider-only account (FR-2) has no password
          and leaves it empty — the API admits that case, so this screen never has to know which
          kind of account it is looking at. */}
      <RecordSection id="confirm" heading={t('password.current')}>
        <FormPasswordField
          control={control}
          name="password"
          label={t('password.current')}
          help={t('providers.confirmHelp')}
          autoComplete="current-password"
          revealLabel={tPolicy('show')}
          concealLabel={tPolicy('hide')}
        />
      </RecordSection>
    </RecordShell>
  );
}
