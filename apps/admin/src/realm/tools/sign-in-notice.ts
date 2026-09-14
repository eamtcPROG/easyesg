/**
 * What A-01 announces on arrival (task 67.4) — only A-20's success today: the account an invitation
 * became exists, and this is where it signs in. **In the address, as a word and nothing else**: never
 * the address the account holds, which a notice has no business putting in a URL.
 */
export const SIGN_IN_NOTICE = {
  INVITATION_ACCEPTED: 'invitation-accepted',
} as const;

export type SignInNotice = (typeof SIGN_IN_NOTICE)[keyof typeof SIGN_IN_NOTICE];

const isSignInNotice = (value: unknown): value is SignInNotice =>
  typeof value === 'string' && (Object.values(SIGN_IN_NOTICE) as readonly string[]).includes(value);

export const readSignInNotice = (value: unknown): SignInNotice | undefined =>
  isSignInNotice(value) ? value : undefined;
