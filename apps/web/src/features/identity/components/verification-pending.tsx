'use client';

import { Button, Callout, Panel, TextField, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { resendVerificationAction } from '../actions';
import {
  getPendingEmail,
  getResendCooldownRemaining,
  getServerPendingEmail,
  getServerResendCooldownRemaining,
  rememberPendingVerification,
  subscribePendingVerification,
  subscribeResendCooldown,
} from '../pending-verification-store';
import styles from './identity-screens.module.css';

/**
 * S-02 · the verification challenge, waiting side — entered from S-01 after registration (the
 * address rides session storage through `pending-verification-store`), or directly at
 * `/verify` with nothing (an expired link, a cleared session), where it degrades to the
 * resend form.
 *
 * States (§8.1 subset): waiting (address known) · resend form (address unknown) ·
 * sending (pending-async) · sent (uniform confirmation — the response is identical whether or
 * not the address is registered, OQ-55, and the wording here is invariant for the same
 * reason) · error — recoverable (unreachable, from the bundled catalogue).
 *
 * The resend cooldown is client-side pacing only (constants.ts records the assumption); the
 * countdown subscription notifies once a second, which is exactly as often as the state it
 * reflects changes (UX-116).
 */
export function VerificationPending() {
  const t = useTranslations('identity.verify');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();

  const email = useSyncExternalStore(
    subscribePendingVerification,
    getPendingEmail,
    getServerPendingEmail,
  );
  const remaining = useSyncExternalStore(
    subscribeResendCooldown,
    getResendCooldownRemaining,
    getServerResendCooldownRemaining,
  );

  const [sentConfirmed, setSentConfirmed] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ mode: 'onTouched' });

  const send = (address: string) => {
    setUnreachable(false);
    startTransition(async () => {
      const result = await resendVerificationAction({ email: address });
      if (result.status === API_OUTCOME.Unreachable) {
        setUnreachable(true);
        return;
      }
      // Problems and the 202 read the same to the user: the screen may not reveal more than
      // the uniform response does (OQ-55). A malformed address is the one 400 this route
      // emits, and the form's own validation already covers it.
      rememberPendingVerification(address);
      setSentConfirmed(true);
    });
  };

  const submitNewAddress = handleSubmit(({ email: address }) => send(address));

  return (
    <div className={styles.stack}>
      {unreachable ? (
        <Callout
          intent="error"
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      {sentConfirmed ? (
        <Callout intent="info" title={t('sentTitle')} action={t('sentAction')}>
          {t('sentBody')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        {email ? (
          <>
            <p className={styles.bodyText}>{t('sentIntro')}</p>
            <p className={styles.address}>{email}</p>
            <p className={styles.bodyText}>{t('instructions')}</p>
            <Button
              variant="secondary"
              busy={pending}
              disabled={remaining > 0}
              onClick={() => send(email)}
            >
              {t('resend')}
            </Button>
            {remaining > 0 ? (
              <p className={styles.cooldown}>{t('cooldown', { seconds: remaining })}</p>
            ) : null}
            <p className={styles.divided}>
              {t('wrongAddress')}{' '}
              <TextLink asChild>
                <Link href="/register">{t('changeIt')}</Link>
              </TextLink>
            </p>
          </>
        ) : (
          <form
            onSubmit={(event) => void submitNewAddress(event)}
            noValidate
            className={styles.fields}
          >
            <p className={styles.bodyText}>{t('enterEmailIntro')}</p>
            <TextField
              id="verify-email"
              label={t('emailLabel')}
              type="email"
              autoComplete="email"
              inputMode="email"
              error={errors.email?.message}
              {...register('email', {
                required: t('emailMissing'),
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
              })}
            />
            <Button type="submit" busy={pending} disabled={remaining > 0}>
              {t('send')}
            </Button>
            {remaining > 0 ? (
              <p className={styles.cooldown}>{t('cooldown', { seconds: remaining })}</p>
            ) : null}
          </form>
        )}
      </Panel>
    </div>
  );
}
