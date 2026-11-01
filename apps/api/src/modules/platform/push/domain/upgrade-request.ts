import { SOCKET_TICKET_PARAMETER } from '../constants/socket.constants';

/**
 * What an HTTP upgrade asks for, judged before any socket exists (task 147; §12.5.6's task-147 ticket row) — so a
 * refusal is an HTTP status on the upgrade response, not a close after an open socket.
 *
 * **Two refusals, in order**: an upgrade from an origin other than the tenant application's is refused (403) — the
 * ticket alone would suffice, but a cross-site page has no business opening a socket at all — and one with no ticket is
 * unauthenticated (401). What remains is the ticket, for the admission to consume. **The path is not judged here**:
 * Nest's `WsAdapter` routes an upgrade by path and ends one no gateway serves before this runs.
 */
export const UPGRADE_REFUSAL = {
  FOREIGN_ORIGIN: 403,
  NO_TICKET: 401,
} as const;

export type UpgradeRefusal = (typeof UPGRADE_REFUSAL)[keyof typeof UPGRADE_REFUSAL];

export type UpgradeJudgement =
  | { readonly refused: UpgradeRefusal }
  | { readonly refused: null; readonly ticket: string };

export const judgeUpgrade = (input: {
  /** The request line's target — path and query, as Node hands it over. */
  readonly url: string | undefined;
  readonly origin: string | undefined;
  /** The tenant application's origin, `web.publicUrl`'s. */
  readonly allowedOrigin: string;
}): UpgradeJudgement => {
  const target = new URL(input.url ?? '/', 'http://upgrade.invalid');
  if (input.origin === undefined || input.origin !== new URL(input.allowedOrigin).origin) {
    return { refused: UPGRADE_REFUSAL.FOREIGN_ORIGIN };
  }
  const ticket = target.searchParams.get(SOCKET_TICKET_PARAMETER);
  return ticket === null || ticket === '' ? { refused: UPGRADE_REFUSAL.NO_TICKET } : { refused: null, ticket };
};
