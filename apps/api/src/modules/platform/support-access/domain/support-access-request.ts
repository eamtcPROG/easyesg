import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import {
  SUPPORT_ACCESS_STATE,
  type SupportAccessDecisionRecord,
  type SupportAccessRequest,
  type SupportAccessRequestRecord,
} from '../models/support-access-request.model';

/**
 * A support-access request's state, folded from its rows at one instant (task 67.9; FR-78, UC-85).
 *
 * **The two limits are the project owner's (14 Sep 2026)**: a grant lasts 60 minutes, fixed, and a
 * request nobody answers waits 24 hours. Both are read against the clock rather than written when they
 * pass, which is what makes FR-78's *without administrator action* true with no job to fail.
 *
 * **Three rules keep a late or stray row from changing the answer**, each decided here once so no store
 * or screen restates it:
 *
 * - **The first answer wins.** Two Organization Administrators answering at once serialise on a lock in
 *   the store, and should both rows still land, the earlier one is the decision.
 * - **An answer after the request lapsed is no answer.** A request that waited out its 24 hours stays
 *   lapsed, whatever arrives after.
 * - **An end counts only while the grant is live.** An end before a grant, or after its 60 minutes, ends
 *   nothing that was running.
 */
export const SUPPORT_ACCESS_GRANT_MS = 60 * 60 * 1000;

export const SUPPORT_ACCESS_LAPSE_MS = 24 * 60 * 60 * 1000;

/**
 * The oldest a request can be and still be awaiting or active: granted at the last moment before it lapsed,
 * then running its full 60 minutes. A store reading back this far has read everything that can still matter.
 */
export const SUPPORT_ACCESS_HORIZON_MS = SUPPORT_ACCESS_LAPSE_MS + SUPPORT_ACCESS_GRANT_MS;

const instant = (record: SupportAccessDecisionRecord): number => record.occurredAt.getTime();

export const supportAccessRequestOf = (input: {
  readonly request: SupportAccessRequestRecord;
  readonly decisions: readonly SupportAccessDecisionRecord[];
  readonly now: Date;
}): SupportAccessRequest => {
  const { request, now } = input;
  const mine = input.decisions
    .filter((decision) => decision.requestId === request.id)
    .sort((a, b) => instant(a) - instant(b));

  const lapsesAt = new Date(request.requestedAt.getTime() + SUPPORT_ACCESS_LAPSE_MS);
  const decision =
    mine.find(
      (row) => row.kind !== SUPPORT_ACCESS_ENTRY_KIND.END && instant(row) < lapsesAt.getTime(),
    ) ?? null;

  const expiresAt =
    decision?.kind === SUPPORT_ACCESS_ENTRY_KIND.GRANT
      ? new Date(instant(decision) + SUPPORT_ACCESS_GRANT_MS)
      : null;

  const ended =
    decision === null || expiresAt === null
      ? null
      : (mine.find(
          (row) =>
            row.kind === SUPPORT_ACCESS_ENTRY_KIND.END &&
            instant(row) >= instant(decision) &&
            instant(row) < expiresAt.getTime(),
        ) ?? null);

  return { ...request, state: stateOf({ decision, lapsesAt, expiresAt, ended, now }), lapsesAt, decision, expiresAt, ended };
};

const stateOf = (input: {
  readonly decision: SupportAccessDecisionRecord | null;
  readonly lapsesAt: Date;
  readonly expiresAt: Date | null;
  readonly ended: SupportAccessDecisionRecord | null;
  readonly now: Date;
}) => {
  const now = input.now.getTime();
  if (input.decision === null) {
    return now < input.lapsesAt.getTime() ? SUPPORT_ACCESS_STATE.AWAITING : SUPPORT_ACCESS_STATE.LAPSED;
  }
  if (input.decision.kind === SUPPORT_ACCESS_ENTRY_KIND.DECLINE) return SUPPORT_ACCESS_STATE.DECLINED;
  if (input.ended !== null) return SUPPORT_ACCESS_STATE.ENDED;
  return input.expiresAt !== null && now < input.expiresAt.getTime()
    ? SUPPORT_ACCESS_STATE.ACTIVE
    : SUPPORT_ACCESS_STATE.EXPIRED;
};

/**
 * Whether a request still holds its operator's place with the organization — waiting for an answer, or
 * granted and running. A second request for the same organization is refused while one does.
 */
export const supportAccessIsOutstanding = (request: SupportAccessRequest): boolean =>
  request.state === SUPPORT_ACCESS_STATE.AWAITING || request.state === SUPPORT_ACCESS_STATE.ACTIVE;
