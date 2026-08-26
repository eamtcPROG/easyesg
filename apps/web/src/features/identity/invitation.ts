import { INVITATION_STANDING, type InvitationPreview } from '@easyesg/contracts';
import { ROUTES } from '@/lib/routes';

/**
 * S-03's branch (UC-15, FR-11) — task 26.3.
 *
 * The screen has five surfaces and which one it shows is decided by two facts: what the API said
 * about the link, and who — if anyone — is signed in. Deciding that here rather than in the page
 * buys what `post-sign-in.ts` bought for §4.3: **this file carries no `server-only` and reaches no
 * API**, so every arm is a line of spec rather than a browser journey. Three of the five are error
 * states, and error states are exactly the ones that never get exercised when the only way to reach
 * them is by seeding a database and driving Chromium.
 *
 * The permission arm is the one worth reading twice. Someone signed in as a *different* address is
 * not a broken link and not a broken account — it is a forwarded invitation, or the second mailbox
 * a bookkeeper actually uses — so `design_spec.md` S-03 draws it as its own state with its own way
 * out (amended 25 Aug 2026): name both addresses, and offer to sign out and come back as the
 * invited person.
 */
export const INVITATION_VIEW = {
  /** Signed in as the invited address, link good. The one arm with a primary action. */
  ACCEPT: 'accept',
  /** Signed out, link good — S-01 hands off and `?return=` brings them back here. */
  SIGN_IN_REQUIRED: 'sign_in_required',
  /** Signed in as some other address. S-03's permission state. */
  WRONG_ACCOUNT: 'wrong_account',
  /** Expired, consumed, revoked or unknown — the standing says which. */
  UNUSABLE: 'unusable',
  /** The preview call itself failed. Not a fact about the invitation, so it says so. */
  UNREACHABLE: 'unreachable',
} as const;

export type InvitationViewKind = (typeof INVITATION_VIEW)[keyof typeof INVITATION_VIEW];

/**
 * The four standings that mean "this link cannot be used" — the API's vocabulary minus the one
 * value that is not a refusal, derived by exclusion rather than listed.
 *
 * It is narrow because the screen resolves the standing's sentence by interpolating it into a
 * message key, and next-intl type-checks keys against the catalogue: widened to the full union,
 * `standing.acceptable.title` would be a key with no message, and the Callout would render an empty
 * heading in three languages with nothing failing. A fifth reason added to the API's vocabulary now
 * fails to compile here until its two sentences are written.
 */
export type UnusableStanding = Exclude<
  InvitationPreview['standing'],
  typeof INVITATION_STANDING.ACCEPTABLE
>;

export type InvitationView =
  | {
      readonly kind: typeof INVITATION_VIEW.ACCEPT | typeof INVITATION_VIEW.SIGN_IN_REQUIRED;
      readonly invitation: UsableInvitation;
    }
  | {
      readonly kind: typeof INVITATION_VIEW.WRONG_ACCOUNT;
      readonly invitation: UsableInvitation;
      /** The address the browser is currently signed in as, so the screen can name both. */
      readonly signedInAs: string;
    }
  | {
      readonly kind: typeof INVITATION_VIEW.UNUSABLE;
      readonly standing: UnusableStanding;
    }
  | { readonly kind: typeof INVITATION_VIEW.UNREACHABLE };

/**
 * A preview narrowed to the case where the API published its details.
 *
 * The wire shape makes all three nullable, because they are withheld once the link stops working —
 * so a screen reading `organizationName` off a revoked preview would render "You have been invited
 * to join null". This type is what makes that unrepresentable past the branch.
 */
export interface UsableInvitation {
  readonly organizationName: string;
  readonly invitedEmail: string;
  /**
   * `NonNullable<…>` rather than `string`, and it is load-bearing: the screen resolves the role's
   * label with `t(\`role.${role}\`)`, and next-intl type-checks message keys against the
   * catalogue — so a widened `string` makes the key uncheckable and a missing translation becomes a
   * runtime blank instead of a compile error. The union is `editor | viewer`, FR-57's two.
   */
  readonly role: NonNullable<InvitationPreview['role']>;
}

/**
 * Which surface to render. Pure, total, and ordered — the ordering is the design.
 *
 * **The link's standing is read before the session.** A spent or withdrawn invitation says so to
 * whoever opens it, signed in as anybody: telling them instead that they are signed in as the wrong
 * person would be a second thing to fix after they had fixed the first, and only one of the two is
 * true. The API's own refusal path takes the same order and a spec pins it there too.
 */
export const invitationView = (input: {
  /** `null` when the preview call failed — distinct from a preview that answered "unknown". */
  readonly preview: InvitationPreview | null;
  /** The signed-in account's address, or `null` when the browser holds no session. */
  readonly signedInAs: string | null;
}): InvitationView => {
  if (input.preview === null) return { kind: INVITATION_VIEW.UNREACHABLE };

  const { standing, organizationName, invitedEmail, role } = input.preview;
  if (standing !== INVITATION_STANDING.ACCEPTABLE) {
    return { kind: INVITATION_VIEW.UNUSABLE, standing };
  }

  // The three details travel together or not at all — the API withholds them for every standing
  // but this one — so reaching here without them means the API answered something it cannot
  // answer. Checked rather than asserted, because the alternative is a `!` that renders the word
  // "null" to a person if it is ever wrong.
  //
  // **It degrades to `unreachable`, not to `unusable`, and the distinction is the honest one:**
  // nothing is known to be wrong with the invitation — our own tier failed to describe it — so the
  // sentence to show is "we could not load this, your link is probably fine", which is what that
  // arm already says. Reporting it as expired or unknown would tell the reader a fact about their
  // invitation that nobody established.
  if (organizationName === null || invitedEmail === null || role === null) {
    return { kind: INVITATION_VIEW.UNREACHABLE };
  }

  const invitation: UsableInvitation = { organizationName, invitedEmail, role };
  if (input.signedInAs === null) {
    return { kind: INVITATION_VIEW.SIGN_IN_REQUIRED, invitation };
  }

  // Case-insensitively, matching what the API compares (`emailIdentityKey`) and what
  // `account_email_key` means by identity — `Ana@x.md` and `ana@x.md` are one person, and a screen
  // that disagreed would offer a sign-out the acceptance would then not have needed.
  return input.signedInAs.toLowerCase() === invitedEmail.toLowerCase()
    ? { kind: INVITATION_VIEW.ACCEPT, invitation }
    : { kind: INVITATION_VIEW.WRONG_ACCOUNT, invitation, signedInAs: input.signedInAs };
};

/**
 * The hand-off S-03 sends a signed-out visitor on, and the way back (`design_spec.md` S-03/S-01,
 * amended 25 Aug 2026).
 *
 * Two parameters and each earns its place. `return` is UX-38's contract, already threaded through
 * the provider flow by task 24, and it is what brings them back to *this* invitation rather than to
 * a generic home. `invitation` rides only on the registration route, and it is what makes the
 * account created there **already verified** — without it the invitee waits for a second email in
 * the one flow §12.5.6's task-26.2 row exists to spare them.
 *
 * Built from the token rather than from the current URL so the caller cannot accidentally pass a
 * path with a query already on it, and so the shape is stated in one place for the page and its
 * spec to agree on.
 */
export const invitationHandOff = (token: string) => {
  const returnPath = `${INVITATION_PATH}/${encodeURIComponent(token)}`;
  return {
    /** S-01's sign-in surface: come back here once a session exists. */
    signIn: `${ROUTES.SIGN_IN}?return=${encodeURIComponent(returnPath)}`,
    /** S-01's registration surface, carrying the invitation as well as the way back. */
    register: `${ROUTES.REGISTER}?invitation=${encodeURIComponent(token)}&return=${encodeURIComponent(returnPath)}`,
    /** What `SocialProviders` threads through the OAuth transaction (task 24). */
    returnPath,
  };
};

/** The route `apps/web` has carried since task 4; the worker builds the email link against it.
 *  Not a `ROUTES` member because it takes the token — `invitationRoute` is the builder there, and
 *  this is the prefix that builder and this hand-off share. */
const INVITATION_PATH = '/invitation';
