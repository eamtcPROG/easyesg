import type { SocialProvider } from '@easyesg/contracts';
import { SECTION_READ, type CredentialsRead } from './credentials';

/**
 * Which of the account's ways in is the one it cannot lose — S-28's closing note, and whether a provider's row offers
 * *Unlink* (task 169; `design_spec.md` OQ-19, closed 24 Sep 2026: the artboard tells the reader **before** they try,
 * where the screen used to say it only as the api's refusal afterwards).
 *
 * **Computed once, here, for both readers**, so the note and the trigger cannot disagree about which credential is the
 * last. **Not a mirror of BR-ID-4**: the api still refuses a last credential's removal whatever this says, and a
 * password set elsewhere between the render and the press changes nothing here until the next read — the screen
 * offers what the reads it drew from allow.
 */
export const LAST_WAY_IN = {
  /** A password and nothing linked: the password is the one way in. */
  PASSWORD_ONLY: 'password_only',
  /** A password and at least one provider: every provider may be unlinked, because the password stays. */
  PASSWORD_AND_PROVIDERS: 'password_and_providers',
  /** No password and exactly one provider: that provider is the one way in, and cannot be unlinked. */
  LAST_PROVIDER: 'last_provider',
  /** No password and several providers: any one may go while another remains. */
  PROVIDERS_ONLY: 'providers_only',
} as const;

export type LastWayInKind = (typeof LAST_WAY_IN)[keyof typeof LAST_WAY_IN];

export type LastWayIn =
  | { readonly kind: typeof LAST_WAY_IN.PASSWORD_ONLY }
  | { readonly kind: typeof LAST_WAY_IN.PASSWORD_AND_PROVIDERS; readonly providers: readonly SocialProvider[] }
  | { readonly kind: typeof LAST_WAY_IN.LAST_PROVIDER; readonly provider: SocialProvider }
  | { readonly kind: typeof LAST_WAY_IN.PROVIDERS_ONLY };

/**
 * Null when either read did not resolve: a note naming the last way in from half the facts would state something the
 * screen does not know, and §8.1's partial state already names the half that is missing.
 */
export function lastWayIn(read: Pick<CredentialsRead, 'password' | 'providers'>): LastWayIn | null {
  if (read.password.status !== SECTION_READ.READY || read.providers.status !== SECTION_READ.READY) return null;

  const providers = read.providers.value.map((identity) => identity.provider);
  if (read.password.value.set) {
    return providers.length === 0
      ? { kind: LAST_WAY_IN.PASSWORD_ONLY }
      : { kind: LAST_WAY_IN.PASSWORD_AND_PROVIDERS, providers };
  }
  // An account holds at least one way in (BR-ID-4), so no password means at least one provider; an empty list here
  // would be a read the api should never answer, and reads as the several-providers case rather than inventing one.
  const [only] = providers;
  return providers.length === 1 && only !== undefined
    ? { kind: LAST_WAY_IN.LAST_PROVIDER, provider: only }
    : { kind: LAST_WAY_IN.PROVIDERS_ONLY };
}

/** Whether a linked provider's row offers *Unlink*: every row but the last way in's. */
export const offersUnlink = (way: LastWayIn | null, provider: SocialProvider): boolean =>
  !(way?.kind === LAST_WAY_IN.LAST_PROVIDER && way.provider === provider);
