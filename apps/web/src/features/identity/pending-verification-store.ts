'use client';

import {
  PENDING_EMAIL_STORAGE_KEY,
  RESEND_COOLDOWN_SECONDS,
  RESEND_SENT_AT_STORAGE_KEY,
} from './constants';

/**
 * The S-01 → S-02 hand-off as a tiny external store over `sessionStorage`, shaped for
 * `useSyncExternalStore`: the server snapshot is always empty (there is no session storage to
 * read), the client snapshot is the stored value, and React swaps them after hydration without
 * a mismatch — which is why this exists instead of the read-in-an-effect pattern the
 * `react-hooks/set-state-in-effect` rule rejects.
 *
 * Writes go through {@link rememberPendingVerification} so subscribed components re-read; a
 * bare `sessionStorage.setItem` elsewhere would update the storage and notify nobody.
 */
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export function subscribePendingVerification(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getPendingEmail = (): string | null =>
  sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY);

export const getServerPendingEmail = (): string | null => null;

export function rememberPendingVerification(email: string): void {
  sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, email);
  sessionStorage.setItem(RESEND_SENT_AT_STORAGE_KEY, String(Date.now()));
  notify();
}

export function forgetPendingVerification(): void {
  sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
  notify();
}

/** Seconds left of the client-side resend pacing (constants.ts records the assumption). */
export function getResendCooldownRemaining(): number {
  const sentAt = Number(sessionStorage.getItem(RESEND_SENT_AT_STORAGE_KEY) ?? 0);
  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.min(RESEND_COOLDOWN_SECONDS, Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed));
}

export const getServerResendCooldownRemaining = (): number => 0;

/** One notification per second while anyone renders the countdown — exactly as often as the
 *  state it reflects changes (UX-116). */
export function subscribeResendCooldown(listener: () => void): () => void {
  const interval = setInterval(listener, 1000);
  return () => clearInterval(interval);
}
