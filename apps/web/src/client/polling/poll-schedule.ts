import { EVENT_NAME, type EventName } from '@easyesg/contracts';

/**
 * When a poll runs — the one schedule every asynchronous result in this application is read on (task 50.2.1, the
 * unread count, its first).
 *
 * **Polling is the authority, and it is the floor.** §11.1 rejected a push transport and named the procedure for
 * adding one, and **AD-15 is that change**: the api's socket (tasks 146 … 150) fans out contentless hints that make an
 * accelerated surface refetch sooner (`client/push`). It never replaces a poll, and NFR-110 makes the disconnected
 * interval the guaranteed ceiling — so an interval here may not be lengthened on the grounds that the accelerator
 * covers it.
 *
 * **The intervals are `architecture.md` OQ-36's**, closed 12 Sep 2026: the unread count 60 s, S-16's access list 30 s
 * (task 149), every poll stopped while the tab is hidden, and a failed poll backed off full-jitter exponential to a
 * five-minute cap. Order state (3 s) and export job state (5 s) are OQ-36's too, and arrive with the tasks that poll
 * them rather than as values with no reader. UX-116 is why none is shorter: under the April–May load no element may
 * poll more often than the state it reflects actually changes.
 */
export const POLL_INTERVAL = {
  /** The global tier's unread count (FR-161, UX-62). */
  UNREAD_COUNT: 60_000,
  /** S-16's members and invitations (UC-59 … UC-64; task 149). */
  ACCESS_LIST: 30_000,
} as const;

/**
 * **Every event the api may push names the poll that is its floor** (task 149; AD-15, NFR-110). Typed over the whole
 * catalogue, so an event added to it fails `typecheck` here until a surface polls its authority — an event with no
 * poll behind it would make the frame the authority, which is the one thing AD-15 refuses.
 */
export const ACCELERATED_POLL_INTERVAL = {
  [EVENT_NAME.ACCESS_CHANGED]: POLL_INTERVAL.ACCESS_LIST,
  [EVENT_NAME.NOTIFICATION_UNREAD_CHANGED]: POLL_INTERVAL.UNREAD_COUNT,
} as const satisfies Record<EventName, number>;

/** OQ-36's ceiling on a failing poll's wait. */
export const POLL_BACKOFF_CAP = 300_000;

/**
 * The wait before a poll's next run: its interval while it succeeds, and after `failures` consecutive failures a
 * wait drawn uniformly from zero up to the interval doubled once per failure, never past the cap — AWS's *full
 * jitter*, which is what keeps 150 open screens that lost the API together from returning to it together.
 *
 * `random` is injected so the spec can pin both ends of the draw.
 */
export const nextPollDelay = (input: {
  readonly interval: number;
  readonly failures: number;
  readonly random?: () => number;
}): number => {
  if (input.failures <= 0) return input.interval;
  const ceiling = Math.min(POLL_BACKOFF_CAP, input.interval * 2 ** input.failures);
  return Math.floor((input.random ?? Math.random)() * ceiling);
};
