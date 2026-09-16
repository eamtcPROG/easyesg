import { DISCLOSURE_STATE, type DisclosureValueWrite } from '@easyesg/contracts';
import { SAVE_STATE } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_EVENT,
  CONNECTION,
  FLUSH_FAILURE,
  autosaveReducer,
  canFlush,
  flushIsBlocked,
  flushSnapshot,
  initialAutosaveState,
  saveStateOf,
  syncStateOf,
  writeKey,
  type AutosaveState,
} from './autosave-state';

/**
 * The transitions a browser journey cannot reach without contriving the timing — which is the
 * reason the reducer is a pure module (task 35.2).
 */
const write = (elementKey: string, valueNumeric: string): DisclosureValueWrite => ({
  elementKey,
  valueNumeric,
  state: DISCLOSURE_STATE.OK,
});

const committed = (elementKey: string, valueNumeric: string) => ({
  id: `id-${elementKey}`,
  elementKey,
  dimensionKey: '',
  ordinal: 0,
  valueNumeric,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  updatedAt: 1,
});

const online = () => initialAutosaveState({ online: true });

const changed = (state: AutosaveState, w: DisclosureValueWrite) =>
  autosaveReducer(state, { type: AUTOSAVE_EVENT.CHANGED, write: w });

const started = (state: AutosaveState) =>
  autosaveReducer(state, { type: AUTOSAVE_EVENT.FLUSH_STARTED, sent: flushSnapshot(state).sent });

describe('autosaveReducer (UC-35)', () => {
  it('is saved with nothing pending, and stays saved inside the budget (UX-36)', () => {
    expect(saveStateOf(online())).toBe(SAVE_STATE.SAVED);

    const dirty = changed(online(), write('NumberOfEmployees', '42'));
    // Pending, but the 250 ms has not elapsed: UX-36 says the indicator must not move yet.
    expect(saveStateOf(dirty)).toBe(SAVE_STATE.SAVED);
    expect(canFlush(dirty)).toBe(true);
  });

  it('moves to saving only once the budget has elapsed with something still pending', () => {
    const dirty = changed(online(), write('NumberOfEmployees', '42'));
    const late = autosaveReducer(dirty, { type: AUTOSAVE_EVENT.BUDGET_ELAPSED });
    expect(saveStateOf(late)).toBe(SAVE_STATE.SAVING);

    // The budget event on a state with nothing pending is a no-op, not a stale "saving".
    expect(autosaveReducer(online(), { type: AUTOSAVE_EVENT.BUDGET_ELAPSED })).toEqual(online());
  });

  it('acknowledges only what was sent, so an edit made during the flush survives it', () => {
    const first = changed(online(), write('NumberOfEmployees', '42'));
    const inFlight = started(first);
    expect(canFlush(inFlight)).toBe(false);

    // The reporter corrects the value while the first flush is on the wire.
    const corrected = changed(inFlight, write('NumberOfEmployees', '43'));

    const acknowledged = autosaveReducer(corrected, {
      type: AUTOSAVE_EVENT.FLUSH_SUCCEEDED,
      committed: [committed('NumberOfEmployees', '42')],
    });

    // The acknowledgement was for 42; 43 is still pending and goes in the next flush.
    expect(acknowledged.pending[writeKey({ elementKey: 'NumberOfEmployees' })]?.write.valueNumeric).toBe(
      '43',
    );
    expect(acknowledged.inFlight).toBeNull();
    expect(canFlush(acknowledged)).toBe(true);
    expect(saveStateOf(acknowledged)).toBe(SAVE_STATE.SAVED);
  });

  it('settles to saved when everything sent is acknowledged, and resets the budget', () => {
    const dirty = autosaveReducer(
      changed(changed(online(), write('A', '1')), write('B', '2')),
      { type: AUTOSAVE_EVENT.BUDGET_ELAPSED },
    );
    const settled = autosaveReducer(started(dirty), {
      type: AUTOSAVE_EVENT.FLUSH_SUCCEEDED,
      committed: [committed('A', '1'), committed('B', '2')],
    });

    expect(settled.pending).toEqual({});
    expect(settled.budgetExceeded).toBe(false);
    expect(settled.committed[writeKey({ elementKey: 'A' })]?.valueNumeric).toBe('1');
    expect(saveStateOf(settled)).toBe(SAVE_STATE.SAVED);
  });

  it('is queued while offline and flushes again once the connection returns (FR-38)', () => {
    const offline = autosaveReducer(changed(online(), write('A', '1')), {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.OFFLINE,
    });
    expect(saveStateOf(offline)).toBe(SAVE_STATE.QUEUED);
    expect(canFlush(offline)).toBe(false);

    const back = autosaveReducer(offline, {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.ONLINE,
    });
    expect(canFlush(back)).toBe(true);
  });

  it('reports a failure until a change, a retry or a reconnection gives it another attempt', () => {
    const failed = autosaveReducer(started(changed(online(), write('A', '1'))), {
      type: AUTOSAVE_EVENT.FLUSH_FAILED,
      failure: { kind: FLUSH_FAILURE.UNREACHABLE },
    });
    expect(saveStateOf(failed)).toBe(SAVE_STATE.FAILED);
    expect(canFlush(failed)).toBe(false);

    // A refusal stands: the same request would be refused again (a period lock, FR-22).
    const retried = autosaveReducer(failed, { type: AUTOSAVE_EVENT.RETRY_REQUESTED });
    expect(retried.failure).toBeNull();
    expect(canFlush(retried)).toBe(true);

    // Going offline keeps the failure; coming back online clears it — a new attempt, not a
    // continuation of the old one.
    const offline = autosaveReducer(failed, {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.OFFLINE,
    });
    expect(saveStateOf(offline)).toBe(SAVE_STATE.QUEUED);
    const back = autosaveReducer(offline, {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.ONLINE,
    });
    expect(back.failure).toBeNull();
  });

  it('restores the durable queue without overwriting a newer change, and marks itself hydrated', () => {
    const edited = changed(online(), write('A', 'newer'));
    const restored = autosaveReducer(edited, {
      type: AUTOSAVE_EVENT.RESTORED,
      writes: [write('A', 'older'), write('B', 'queued')],
    });

    expect(restored.hydrated).toBe(true);
    expect(restored.pending[writeKey({ elementKey: 'A' })]?.write.valueNumeric).toBe('newer');
    expect(restored.pending[writeKey({ elementKey: 'B' })]?.write.valueNumeric).toBe('queued');
    expect(online().hydrated).toBe(false);
  });

  it('snapshots the flush in sequence order', () => {
    const state = changed(changed(changed(online(), write('B', '1')), write('A', '2')), write('B', '3'));
    const { writes, sent } = flushSnapshot(state);
    // B was re-written after A, so it carries the later sequence and comes second.
    expect(writes.map((w) => ('inputKey' in w ? w.inputKey : `${w.elementKey}:${w.valueNumeric}`))).toEqual([
      'A:2',
      'B:3',
    ]);
    expect(sent[writeKey({ elementKey: 'B' })]).toBe(3);
  });
});

describe('syncStateOf (§4.10 per-field marker)', () => {
  it('reports a field from the same pending set the shell reads, and synced otherwise', () => {
    const key = writeKey({ elementKey: 'A' });
    expect(syncStateOf(online(), key)).toBe(SAVE_STATE.SAVED);

    // Dirty means saving at once — the field's marker is not budgeted the way the shell's is.
    const dirty = changed(online(), write('A', '1'));
    expect(syncStateOf(dirty, key)).toBe(SAVE_STATE.SAVING);
    expect(syncStateOf(dirty, writeKey({ elementKey: 'B' }))).toBe(SAVE_STATE.SAVED);

    const offline = autosaveReducer(dirty, {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.OFFLINE,
    });
    expect(syncStateOf(offline, key)).toBe(SAVE_STATE.QUEUED);

    const failed = autosaveReducer(started(dirty), {
      type: AUTOSAVE_EVENT.FLUSH_FAILED,
      failure: { kind: FLUSH_FAILURE.UNREACHABLE },
    });
    expect(syncStateOf(failed, key)).toBe(SAVE_STATE.FAILED);
  });
});

/**
 * The session's end (task 92; UX-38): a `401` is a refusal of the session rather than of the values, and
 * nothing leaves until the reader signs in again over the step.
 */
describe('the session’s standing', () => {
  const refusedWith = (state: AutosaveState, status: number) =>
    autosaveReducer(started(state), {
      type: AUTOSAVE_EVENT.FLUSH_FAILED,
      failure: {
        kind: FLUSH_FAILURE.REFUSED,
        problem: { type: 'https://easyesg.md/problems/authentication-required', status },
      },
    });

  it('ends on a write refused 401, and on nothing else the api refuses with', () => {
    const dirty = changed(online(), write('A', '1'));
    expect(refusedWith(dirty, 401).session).toBe('ended');
    // A locked period is 409 and a role 403: refusals of the write, not of the session.
    expect(refusedWith(dirty, 403).session).toBe('held');
    expect(refusedWith(dirty, 409).session).toBe('held');
    const unreachable = autosaveReducer(started(dirty), {
      type: AUTOSAVE_EVENT.FLUSH_FAILED,
      failure: { kind: FLUSH_FAILURE.UNREACHABLE },
    });
    expect(unreachable.session).toBe('held');
  });

  it('holds every flush while ended — a retry, a reconnection and a new change included', () => {
    const ended = refusedWith(changed(online(), write('A', '1')), 401);
    expect(canFlush(ended)).toBe(false);
    expect(canFlush(autosaveReducer(ended, { type: AUTOSAVE_EVENT.RETRY_REQUESTED }))).toBe(false);
    expect(canFlush(changed(ended, write('B', '2')))).toBe(false);
    expect(saveStateOf(ended)).toBe(SAVE_STATE.FAILED);
    expect(syncStateOf(ended, writeKey({ elementKey: 'A' }))).toBe(SAVE_STATE.FAILED);
    expect(flushIsBlocked(ended)).toBe(true);
  });

  it('is ended by a navigation’s probe with nothing pending, and says nothing is lost', () => {
    const probed = autosaveReducer(online(), { type: AUTOSAVE_EVENT.SESSION_ENDED });
    expect(probed.session).toBe('ended');
    expect(saveStateOf(probed)).toBe(SAVE_STATE.SAVED);
    expect(autosaveReducer(probed, { type: AUTOSAVE_EVENT.SESSION_ENDED })).toBe(probed);

    // A change arriving while ended waits, and reads as not saved rather than as on its way.
    const waiting = changed(probed, write('A', '1'));
    expect(canFlush(waiting)).toBe(false);
    expect(saveStateOf(waiting)).toBe(SAVE_STATE.FAILED);
  });

  it('flushes what waited once the session is resumed, the refusal gone with it', () => {
    const ended = refusedWith(changed(online(), write('A', '1')), 401);
    const resumed = autosaveReducer(ended, { type: AUTOSAVE_EVENT.SESSION_RESUMED });
    expect(resumed.session).toBe('held');
    expect(resumed.failure).toBeNull();
    expect(canFlush(resumed)).toBe(true);
    expect(resumed.pending).toEqual(ended.pending);
  });
});

/**
 * Stuck, as against on its way (task 83.2). The organization switch waits for the second and asks the
 * reader about the first (UX-37), so a queue merely in flight must not read as blocked.
 */
describe('flushIsBlocked', () => {
  it('is not blocked while a change is only on its way', () => {
    const dirty = changed(online(), write('A', '1'));
    expect(flushIsBlocked(dirty)).toBe(false);
    expect(flushIsBlocked(started(dirty))).toBe(false);
  });

  it('is blocked offline', () => {
    const offline = autosaveReducer(changed(online(), write('A', '1')), {
      type: AUTOSAVE_EVENT.CONNECTION_CHANGED,
      connection: CONNECTION.OFFLINE,
    });
    expect(flushIsBlocked(offline)).toBe(true);
  });

  it('is blocked by a standing failure, and not once another attempt is asked for', () => {
    const failed = autosaveReducer(started(changed(online(), write('A', '1'))), {
      type: AUTOSAVE_EVENT.FLUSH_FAILED,
      failure: { kind: FLUSH_FAILURE.UNREACHABLE },
    });
    expect(flushIsBlocked(failed)).toBe(true);
    expect(flushIsBlocked(autosaveReducer(failed, { type: AUTOSAVE_EVENT.RETRY_REQUESTED }))).toBe(false);
  });
});
