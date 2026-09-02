import { DISCLOSURE_STATE, type DisclosureValueWrite } from '@easyesg/contracts';
import { SAVE_STATE } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_EVENT,
  CONNECTION,
  FLUSH_FAILURE,
  autosaveReducer,
  canFlush,
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
    expect(writes.map((w) => `${w.elementKey}:${w.valueNumeric}`)).toEqual(['A:2', 'B:3']);
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
