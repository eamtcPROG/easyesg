import type { Locale } from '@easyesg/i18n';

/**
 * The account as it crosses the store port — the shape a persistence adapter returns and a use
 * case reasons about. Not a TypeORM entity: AD-14 constraint 1 keeps persistence in hand-written
 * SQL, so there is no entity class for this to be confused with.
 *
 * Instants are `Date` here and **not** `EpochMillis`. `contracts/types/time.ts` is explicit that
 * epoch milliseconds are the wire representation and that a use-case signature taking a number of
 * milliseconds has admitted the wire format into the core. The conversion happens once, in the DTO
 * that leaves the controller.
 */
/**
 * The account lifecycle vocabulary (FR-1, FR-3), declared once — the house shape for any closed
 * set of values (`APP_MODE`, `ProblemType` are the same pattern; rule in apps/api/CLAUDE.md,
 * 20 Aug 2026). An `as const` object rather than a TS `enum`: it erases to nothing, derives the
 * union below, and has no ambient/`isolatedModules` sharp edges.
 *
 * The database holds the same vocabulary independently, in the migration's
 * `account_status_known` CHECK constraint — SQL there is deliberately literal (a migration is
 * frozen history; interpolating a constant that can later be renamed would silently rewrite what
 * the history says). This object is the application's mirror of that constraint, and the
 * repository's `toAccount` narrowing rests on the two agreeing.
 */
export const ACCOUNT_STATUS = {
  UNVERIFIED: 'unverified',
  ACTIVE: 'active',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export interface Account {
  readonly id: string;
  /** As the user typed it. Uniqueness is over `lower(email)` — see `domain/email-address.ts`. */
  readonly email: string;
  readonly status: AccountStatus;
  /**
   * FR-10's per-user interface language, seeded at registration from the locale negotiated for
   * that request. It is here rather than on a profile because FR-169 resolves email language per
   * recipient from their own record, and the worker sending that email has no request to read.
   */
  readonly locale: Locale;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What registration hands the store. The password is already hashed — see `RegisterAccount`. */
export interface NewAccount {
  readonly email: string;
  readonly locale: Locale;
  readonly passwordHash: string;
}

export interface NewVerificationToken {
  readonly accountId: string;
  readonly tokenHash: Buffer;
  readonly expiresAt: Date;
}

/** What survives claiming a token: enough to decide, and no raw secret. */
export interface ClaimedVerificationToken {
  readonly accountId: string;
  readonly tokenHash: Buffer;
  readonly expiresAt: Date;
}
