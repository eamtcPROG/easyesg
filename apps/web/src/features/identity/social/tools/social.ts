import type { SocialProvider } from '@easyesg/contracts';
/**
 * The social-flow notices (task 24): every way the OAuth round trip can end somewhere other
 * than a session, as a closed vocabulary (CLAUDE.md, "Conventions") — the callback Route
 * Handler writes one into `?notice=`, and S-01's screens map it to catalogue copy. The values
 * are wire tokens, not user-facing text; what the person reads is the message the screen
 * resolves for one.
 */
export const SOCIAL_NOTICE = {
  /** The user cancelled or the provider denied at its own screen. */
  CANCELLED: 'social-cancelled',
  /** The transaction cookie was missing, expired or mismatched — restart the flow. */
  RESTART: 'social-restart',
  /** FR-82: the provider is disabled or unregistered. */
  UNAVAILABLE: 'social-unavailable',
  /** The exchange failed for any other reason — network, refused code, invalid token. */
  FAILED: 'social-failed',
  /** BR-ID-3: the asserted address already has an account; sign in with its password. */
  EMAIL_IN_USE: 'social-email-in-use',
  /** A fresh unverified registration: the account exists, the challenge email is on its way. */
  VERIFY_SENT: 'social-verify-sent',
  /** UC-05's alternate flow: the identity matched nothing; registration is offered. */
  UNKNOWN_IDENTITY: 'social-unknown-identity',
} as const;

export type SocialNotice = (typeof SOCIAL_NOTICE)[keyof typeof SOCIAL_NOTICE];

export const isSocialNotice = (value: string): value is SocialNotice =>
  (Object.values(SOCIAL_NOTICE) as string[]).includes(value);

/**
 * The provider's brand name — a locale-invariant proper noun, not copy; the sentence around it is.
 *
 * Moved here from a private map in `social-providers.tsx` when S-28 became its second consumer
 * (task 27.7): an operation over a vocabulary belongs with the vocabulary, not copied per caller.
 *
 * **The parameter is `SocialProvider`, so there is no unnamed case to fall back from** (corrected
 * 27 Aug 2026). The move out of `social-providers.tsx` widened it to `string` and fell back to
 * returning that string, which publishes an identifier like `google_workspace` into a sentence a
 * person reads — the rule root CLAUDE.md states in terms. Narrowing beats handling: every caller
 * reads a provider from the wire contract's own enum or from a cookie this tier validates against
 * it (`pending-link.ts`), so an unnamed provider is now a compile error at the `Record` above
 * rather than a slug at render.
 */
const DISPLAY_NAME: Record<SocialProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
};

export const providerLabel = (provider: SocialProvider): string => DISPLAY_NAME[provider];
