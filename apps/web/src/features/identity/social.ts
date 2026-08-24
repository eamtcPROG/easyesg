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
