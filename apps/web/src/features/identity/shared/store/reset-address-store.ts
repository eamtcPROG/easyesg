'use client';

import { RESET_ADDRESS_STORAGE_KEY } from '../tools/constants';

/**
 * **In `identity/shared/store/` on one test — read by more than one journey: `sign-in/` carries the address, `reset/` takes it.** `store/` rather than `tools/` because a `sessionStorage` store is not pure.
 *
 * S-01's address carried to S-02's reset request (`design_spec.md` S-02, amended 28 Sep 2026): a
 * reader who has typed it once does not type it again. **Session storage, never the URL** — the
 * reason `constants.ts` gives for the verification hand-off, with NFR-30 behind it, and more so
 * here: the request form posts to its own address, so a query parameter would reach the logs on
 * the arrival and again on the submission.
 *
 * **Not the verification store**, though it holds the same kind of value: that key tells S-02's
 * challenge a confirmation is pending, and an address left there would present a reset as an
 * unconfirmed registration.
 *
 * **A convenience never stands between the reader and the form.** Storage a browser refuses — site
 * data blocked, quota spent — throws on access, and here that means no prefill: the screen exactly
 * as it was before the address was carried.
 */

/** Carries what the field holds now; an empty field forgets an address carried earlier, so an old one never resurfaces. */
export function carryResetAddress(email: string): void {
  try {
    if (email) sessionStorage.setItem(RESET_ADDRESS_STORAGE_KEY, email);
    else sessionStorage.removeItem(RESET_ADDRESS_STORAGE_KEY);
  } catch {
    // Refused storage: the reset request opens empty, which is where it started.
  }
}

/** The carried address, read once and forgotten — a reload, or a later visit, opens the form empty. */
export function takeResetAddress(): string | null {
  try {
    const email = sessionStorage.getItem(RESET_ADDRESS_STORAGE_KEY);
    sessionStorage.removeItem(RESET_ADDRESS_STORAGE_KEY);
    return email;
  } catch {
    return null;
  }
}
