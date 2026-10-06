/**
 * What S-28 announces on arrival (task 190; `architecture.md` §12.5.6's task-190 row (1)) — only a recovery sign-in,
 * which S-01 sends here ahead of `?return=`, as A-01 sends an operator's to A-19 (`apps/admin`'s
 * `credentials-arrival.ts`, task 151). **In the address as a word and nothing else**: the count of codes left is this
 * screen's own read, never a number of spare credentials written into a history entry.
 */
import { sanitizeReturnPath, type LocalizedPath } from '@/lib/locale-path';
import { ROUTES } from '@/lib/routes';

/** The parameter it travels in — one spelling for the reader and the writer. */
export const CREDENTIALS_ARRIVAL_PARAM = 'notice';

/**
 * Where the reader was going before the recovery sent them here — §4.3's destination, `?return=` included, carried so
 * the arrival can offer it (owner, 6 Oct 2026; §12.5.6's task-190 row (1)). The proxy's spelling for the same idea.
 */
export const CREDENTIALS_ONWARD_PARAM = 'return';

export const CREDENTIALS_ARRIVAL = {
  RECOVERED: 'recovered',
} as const;

export type CredentialsArrival = (typeof CREDENTIALS_ARRIVAL)[keyof typeof CREDENTIALS_ARRIVAL];

/**
 * S-28's address announcing an arrival — what S-01's factor step redirects a recovery sign-in to, carrying the
 * destination the sign-in would otherwise have reached.
 */
export const credentialsArrivalHref = (input: {
  readonly arrival: CredentialsArrival;
  readonly onward: string;
}): string =>
  `${ROUTES.ACCOUNT_CREDENTIALS}?${new URLSearchParams({
    [CREDENTIALS_ARRIVAL_PARAM]: input.arrival,
    [CREDENTIALS_ONWARD_PARAM]: input.onward,
  }).toString()}`;

/**
 * The carried destination, **sanitized as `?return=` is everywhere** — it round-trips through the browser, so it is
 * attacker-shapeable, and anything that is not a same-app path is no way on at all. One function decides that, for
 * S-01's branch and for this.
 */
export const readCredentialsOnward = (value: string | string[] | undefined): LocalizedPath | null =>
  typeof value === 'string' ? sanitizeReturnPath(value) : null;

/** The address's `notice`, or `null` for anything this screen does not announce — an unknown word says nothing. */
export const readCredentialsArrival = (value: string | string[] | undefined): CredentialsArrival | null =>
  typeof value === 'string' && (Object.values(CREDENTIALS_ARRIVAL) as readonly string[]).includes(value)
    ? (value as CredentialsArrival)
    : null;
