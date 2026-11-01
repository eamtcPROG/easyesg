import type { AdminCredentials } from '@easyesg/contracts';

/**
 * What A-19's recovery-code region says at rest (task 151; `design_spec.md` §5.2 A-19's states):
 *
 * - **none issued** — *empty, first use*: no set has ever been minted, and this screen is the only
 *   thing that mints one;
 * - **exhausted** — *attention*: a set was issued and every code in it is spent, so a lost
 *   authenticator would now leave the operator no way back;
 * - **remaining** — how many are left, and from which set.
 *
 * `recoveryCodesRemaining === 0` alone cannot tell the first two apart, which is why task 144's read
 * carries `recoveryCodesIssuedAt` as well.
 */
export const RECOVERY_CODES_STANDING = {
  NONE_ISSUED: 'none_issued',
  EXHAUSTED: 'exhausted',
  REMAINING: 'remaining',
} as const;

export type CodesStanding =
  | { readonly kind: typeof RECOVERY_CODES_STANDING.NONE_ISSUED }
  | { readonly kind: typeof RECOVERY_CODES_STANDING.EXHAUSTED; readonly issuedAt: number }
  | {
      readonly kind: typeof RECOVERY_CODES_STANDING.REMAINING;
      readonly issuedAt: number;
      readonly remaining: number;
    };

export const recoveryCodesStandingOf = ({
  recoveryCodesIssuedAt,
  recoveryCodesRemaining,
}: AdminCredentials): CodesStanding => {
  if (recoveryCodesIssuedAt === null) return { kind: RECOVERY_CODES_STANDING.NONE_ISSUED };
  return recoveryCodesRemaining === 0
    ? { kind: RECOVERY_CODES_STANDING.EXHAUSTED, issuedAt: recoveryCodesIssuedAt }
    : {
        kind: RECOVERY_CODES_STANDING.REMAINING,
        issuedAt: recoveryCodesIssuedAt,
        remaining: recoveryCodesRemaining,
      };
};
