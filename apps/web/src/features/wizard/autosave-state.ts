import type {
  DisclosureValueResponse,
  DisclosureValueWrite,
  ProblemDocument,
} from '@easyesg/contracts';
import { SAVE_STATE, type SaveState } from '@easyesg/ui';

/**
 * The wizard's draft-integrity state (task 35.2; UC-35, FR-37, FR-38, UX-34 … UX-37) — what is
 * unacknowledged, what has been sent, and whether the API can currently be reached — as one value
 * and the events that move it.
 *
 * **One reducer, because every event moves several of these at once.** A flush that succeeds
 * removes writes from the pending set, clears the in-flight snapshot, records what was committed,
 * and resets the budget flag; written as four setters those are four call sites that each have to
 * remember the other three. `access-state.ts` is the precedent and the root `CLAUDE.md` the rule.
 *
 * **A change is identified by the store's natural key and stamped with a sequence.** A flush
 * snapshots the sequence of every write it sends; on success a key is removed only if its sequence
 * still equals the one sent. That single rule is what makes editing a field while its previous
 * value is in flight safe — the newer edit survives the older acknowledgement and goes in the next
 * flush — with no lock on the input and no cancellation of the request in flight (NFR-38: input is
 * never blocked).
 *
 * **The indicator is derived, never stored.** UX-35's four states are a function of this value:
 * nothing pending is *saved*; pending while offline is *queued*; pending after a refusal is
 * *failed*; pending past NFR-38's budget is *saving*; and pending inside the budget is still
 * *saved*, because UX-36 moves the indicator only when the budget is exceeded — a save that lands
 * in 80 ms never flickers through *saving*.
 *
 * Pure, and in its own module, so every transition is a unit spec — including the ones a browser
 * journey cannot reach without contriving the timing.
 */

/** Whether the browser believes it can reach the network — `navigator.onLine` and its two events. */
export const CONNECTION = { ONLINE: 'online', OFFLINE: 'offline' } as const;

export type Connection = (typeof CONNECTION)[keyof typeof CONNECTION];

/**
 * Why the last flush did not land. The two are not interchangeable: an unreachable API is retried
 * on its own, a refusal is retried only when something changes — the same request would be refused
 * again, and a period lock (FR-22) is the ordinary refusal here.
 */
export const FLUSH_FAILURE = { UNREACHABLE: 'unreachable', REFUSED: 'refused' } as const;

export type FlushFailure =
  | { readonly kind: typeof FLUSH_FAILURE.UNREACHABLE }
  | { readonly kind: typeof FLUSH_FAILURE.REFUSED; readonly problem: ProblemDocument };

/** One unacknowledged change, addressed by the store's natural key. */
export interface PendingWrite {
  readonly key: string;
  readonly write: DisclosureValueWrite;
  /** Monotonic within this state. A flush compares it to decide whether an acknowledgement still applies. */
  readonly sequence: number;
}

export interface AutosaveState {
  /** Everything not yet acknowledged — dirty or in flight — by natural key. */
  readonly pending: Readonly<Record<string, PendingWrite>>;
  /** The sequence of each key in the flush currently on the wire, or `null` between flushes. */
  readonly inFlight: Readonly<Record<string, number>> | null;
  readonly connection: Connection;
  readonly failure: FlushFailure | null;
  /** NFR-38's 250 ms has passed with something still unacknowledged (UX-36). */
  readonly budgetExceeded: boolean;
  /** What the API acknowledged since the step was read — overlays the server-rendered field. */
  readonly committed: Readonly<Record<string, DisclosureValueResponse>>;
  /** The durable queue has been read into `pending`; until then nothing may be written back to it. */
  readonly hydrated: boolean;
  readonly nextSequence: number;
}

/**
 * The events, named for what happened rather than the field they write (the reducer rule). A
 * setter-shaped event would be the `useState`s again in a reducer's clothes.
 */
export const AUTOSAVE_EVENT = {
  /** A field lost focus (or a choice was made) with a value different from what it held. */
  CHANGED: 'changed',
  /** The durable queue was read at mount, and these were waiting in it (FR-38). */
  RESTORED: 'restored',
  /** A flush left for the API carrying exactly these sequences. */
  FLUSH_STARTED: 'flush_started',
  /** The API acknowledged the flush after a durable commit (NFR-56). */
  FLUSH_SUCCEEDED: 'flush_succeeded',
  /** The flush did not land, and the retries the transport owns are exhausted. */
  FLUSH_FAILED: 'flush_failed',
  /** `navigator.onLine` changed. */
  CONNECTION_CHANGED: 'connection_changed',
  /** NFR-38's budget elapsed while something was still pending. */
  BUDGET_ELAPSED: 'budget_elapsed',
  /** The reader, or the backoff timer, asked for another attempt after a failure. */
  RETRY_REQUESTED: 'retry_requested',
} as const;

export type AutosaveEvent =
  | { readonly type: typeof AUTOSAVE_EVENT.CHANGED; readonly write: DisclosureValueWrite }
  | { readonly type: typeof AUTOSAVE_EVENT.RESTORED; readonly writes: readonly DisclosureValueWrite[] }
  | { readonly type: typeof AUTOSAVE_EVENT.FLUSH_STARTED; readonly sent: Readonly<Record<string, number>> }
  | {
      readonly type: typeof AUTOSAVE_EVENT.FLUSH_SUCCEEDED;
      readonly committed: readonly DisclosureValueResponse[];
    }
  | { readonly type: typeof AUTOSAVE_EVENT.FLUSH_FAILED; readonly failure: FlushFailure }
  | { readonly type: typeof AUTOSAVE_EVENT.CONNECTION_CHANGED; readonly connection: Connection }
  | { readonly type: typeof AUTOSAVE_EVENT.BUDGET_ELAPSED }
  | { readonly type: typeof AUTOSAVE_EVENT.RETRY_REQUESTED };

/** NFR-38: the acknowledgement budget. Past it the indicator moves to *saving* (UX-36). */
export const ACKNOWLEDGEMENT_BUDGET_MS = 250;

/**
 * The store's natural key as one string (§7.3) — the same shape the api's `keyOf` uses, so a value
 * addressed here is the row the api upserts. `\u0000` cannot appear in an element or member key.
 */
export const writeKey = (write: {
  readonly elementKey: string;
  readonly dimensionKey?: string;
  readonly ordinal?: number;
}): string => `${write.elementKey}\u0000${write.dimensionKey ?? ''}\u0000${write.ordinal ?? 0}`;

export const initialAutosaveState = (input: { readonly online: boolean }): AutosaveState => ({
  pending: {},
  inFlight: null,
  connection: input.online ? CONNECTION.ONLINE : CONNECTION.OFFLINE,
  failure: null,
  budgetExceeded: false,
  committed: {},
  hydrated: false,
  nextSequence: 1,
});

const withWrites = (
  state: AutosaveState,
  writes: readonly DisclosureValueWrite[],
): Pick<AutosaveState, 'pending' | 'nextSequence'> => {
  const pending = { ...state.pending };
  let sequence = state.nextSequence;
  for (const write of writes) {
    const key = writeKey(write);
    pending[key] = { key, write, sequence };
    sequence += 1;
  }
  return { pending, nextSequence: sequence };
};

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case AUTOSAVE_EVENT.CHANGED:
      // A newer sequence than anything in flight, so an acknowledgement of the older value cannot
      // remove this one. The failure is kept: a refusal stands until a flush succeeds.
      return { ...state, ...withWrites(state, [event.write]) };

    case AUTOSAVE_EVENT.RESTORED: {
      // What the durable queue held is older than anything changed since mount, so a key already
      // pending keeps its newer value and the restored one is dropped.
      const fresh = event.writes.filter((write) => !(writeKey(write) in state.pending));
      return { ...state, ...withWrites(state, fresh), hydrated: true };
    }

    case AUTOSAVE_EVENT.FLUSH_STARTED:
      return { ...state, inFlight: event.sent, failure: null };

    case AUTOSAVE_EVENT.FLUSH_SUCCEEDED: {
      const sent = state.inFlight ?? {};
      const pending: Record<string, PendingWrite> = {};
      for (const [key, write] of Object.entries(state.pending)) {
        // Acknowledged only if nothing newer was written for this key while the flush was out.
        if (sent[key] !== write.sequence) pending[key] = write;
      }
      const committed = { ...state.committed };
      for (const value of event.committed) committed[writeKey(value)] = value;
      const settled = Object.keys(pending).length === 0;
      return {
        ...state,
        pending,
        inFlight: null,
        failure: null,
        committed,
        // The budget restarts for whatever is still pending — it measures the wait for *an*
        // acknowledgement, and one just arrived.
        budgetExceeded: settled ? false : state.budgetExceeded,
      };
    }

    case AUTOSAVE_EVENT.FLUSH_FAILED:
      return { ...state, inFlight: null, failure: event.failure };

    case AUTOSAVE_EVENT.CONNECTION_CHANGED:
      return state.connection === event.connection
        ? state
        : {
            ...state,
            connection: event.connection,
            // Coming back online is a new attempt, not a continuation of the old failure.
            failure: event.connection === CONNECTION.ONLINE ? null : state.failure,
          };

    case AUTOSAVE_EVENT.BUDGET_ELAPSED:
      return hasUnsynced(state) ? { ...state, budgetExceeded: true } : state;

    case AUTOSAVE_EVENT.RETRY_REQUESTED:
      return state.failure === null ? state : { ...state, failure: null };

    default:
      return state;
  }
}

export const hasUnsynced = (state: AutosaveState): boolean =>
  Object.keys(state.pending).length > 0;

export const unsyncedCount = (state: AutosaveState): number => Object.keys(state.pending).length;

/** Whether a flush may leave now: something to send, nothing on the wire, a network to send it on, and no standing refusal. */
export const canFlush = (state: AutosaveState): boolean =>
  hasUnsynced(state) &&
  state.inFlight === null &&
  state.connection === CONNECTION.ONLINE &&
  state.failure === null;

/** The dirty writes, in sequence order, for the next flush — and the sequences to remember. */
export const flushSnapshot = (
  state: AutosaveState,
): { readonly writes: readonly DisclosureValueWrite[]; readonly sent: Readonly<Record<string, number>> } => {
  const ordered = Object.values(state.pending).sort((a, b) => a.sequence - b.sequence);
  const sent: Record<string, number> = {};
  for (const item of ordered) sent[item.key] = item.sequence;
  return { writes: ordered.map((item) => item.write), sent };
};

/** UX-35's four states, derived (see the module docblock for the order and the reason). */
export function saveStateOf(state: AutosaveState): SaveState {
  if (!hasUnsynced(state)) return SAVE_STATE.SAVED;
  if (state.connection === CONNECTION.OFFLINE) return SAVE_STATE.QUEUED;
  if (state.failure !== null) return SAVE_STATE.FAILED;
  if (state.budgetExceeded) return SAVE_STATE.SAVING;
  return SAVE_STATE.SAVED;
}

/**
 * One field's sync state — §4.10's per-field `synced | queued | failed` marker — from the same
 * value the shell's indicator derives from, so the two cannot disagree about whether a field is
 * waiting. Unlike the shell's state, a pending field is *saving* from the moment it is dirty: the
 * marker is the field's own truth, not a budgeted announcement (UX-36 governs the shell's
 * transition, not the field's).
 */
export function syncStateOf(state: AutosaveState, key: string): SaveState {
  if (!(key in state.pending)) return SAVE_STATE.SAVED;
  if (state.connection === CONNECTION.OFFLINE) return SAVE_STATE.QUEUED;
  if (state.failure !== null) return SAVE_STATE.FAILED;
  return SAVE_STATE.SAVING;
}
