import {
  ADMIN_ROSTER_KIND,
  ADMIN_STANDING,
  type AdminRosterRow,
} from '@easyesg/contracts';

/**
 * Which controls A-08's record offers for a row (task 67.4; §5.2 A-08) — derived from its kind and
 * state, and from whether it is the reader's own account.
 *
 * **This is presentation, and the api is the rule** (`ChangeAdminAccountStatus`, `ReleaseAdminLockout`).
 * A control not offered here is one the api would refuse; a control offered here can still be refused —
 * the last active Platform Administrator is a count this screen does not hold — and the refusal is drawn
 * with the api's own sentence. The copy here exists so the screen does not offer what cannot work.
 */
export const ACCOUNT_CONTROL = {
  RELEASE_LOCKOUT: 'release_lockout',
  REACTIVATE: 'reactivate',
  SUSPEND: 'suspend',
  REMOVE: 'remove',
  RESEND: 'resend',
  REVOKE: 'revoke',
} as const;

export type AccountControl = (typeof ACCOUNT_CONTROL)[keyof typeof ACCOUNT_CONTROL];

/** UX-70: the two that end what an account holds disclose it before they act. */
const CONSEQUENTIAL: ReadonlySet<AccountControl> = new Set([
  ACCOUNT_CONTROL.SUSPEND,
  ACCOUNT_CONTROL.REMOVE,
]);

export const controlDisclosesConsequence = (control: AccountControl): boolean => CONSEQUENTIAL.has(control);

export const accountControlsFor = (input: {
  readonly row: Pick<AdminRosterRow, 'id' | 'kind' | 'standing'>;
  /** The signed-in operator's account id. */
  readonly operatorId: string;
}): readonly AccountControl[] => {
  const { row } = input;
  if (row.kind === ADMIN_ROSTER_KIND.INVITATION) {
    return [ACCOUNT_CONTROL.RESEND, ACCOUNT_CONTROL.REVOKE];
  }

  // Nobody suspends or removes themselves; releasing one's own lockout is allowed, since the lock is
  // usually someone else's guessing.
  const own = row.id === input.operatorId;
  const endable = own ? [] : [ACCOUNT_CONTROL.SUSPEND, ACCOUNT_CONTROL.REMOVE];

  switch (row.standing) {
    case ADMIN_STANDING.ACTIVE:
      return endable;
    case ADMIN_STANDING.LOCKED:
      return [ACCOUNT_CONTROL.RELEASE_LOCKOUT, ...endable];
    case ADMIN_STANDING.SUSPENDED:
      return [ACCOUNT_CONTROL.REACTIVATE, ACCOUNT_CONTROL.REMOVE];
    default:
      // Removed accepts nothing; an invitation's standings never belong to an account row.
      return [];
  }
};
