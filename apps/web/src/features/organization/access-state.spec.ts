import { CALLOUT_INTENT } from '@easyesg/ui';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { ACCESS_ROW_KIND, type AccessRow } from './access';
import {
  ACCESS_EVENT,
  CONFIRMATION,
  INITIAL_ACCESS_STATE,
  accessReducer,
  type AccessState,
  type Notice,
} from './access-state';

/**
 * The screen's transitions, as a function.
 *
 * This is what the reducer bought beyond batching: every branch names the whole next state, so a
 * field left stale is a line someone can point at — and two were. Both are asserted below, and
 * neither was reachable from a browser journey without contriving the timing.
 */
const ROW: AccessRow = {
  kind: ACCESS_ROW_KIND.INVITATION,
  id: 'i-1',
  email: 'bogdan@example.md',
  role: MEMBERSHIP_ROLE.EDITOR,
  issuedAt: 1_780_000_000_000,
  expiresAt: 1_780_500_000_000,
};

const NOTICE: Notice = {
  intent: CALLOUT_INTENT.SUCCESS,
  title: 'Invitația a fost trimisă.',
  body: 'Lista de mai sus arată deja situația nouă.',
  action: 'Nu mai aveți nimic de făcut.',
};

const settled = (state: AccessState) =>
  accessReducer(state, { type: ACCESS_EVENT.ACTION_SETTLED, notice: NOTICE });

describe('accessReducer', () => {
  it('starts with nothing running, nothing asked and nothing said', () => {
    expect(INITIAL_ACCESS_STATE).toEqual({
      notice: null,
      confirming: null,
      pendingRowKey: null,
    });
  });

  it('opens the dialogue on a request', () => {
    const state = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REVOKE, row: ROW },
    });

    expect(state.confirming).toEqual({ kind: CONFIRMATION.REVOKE, row: ROW });
  });

  it('closes it on a dismissal, leaving everything else where it was', () => {
    const asked = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REMOVE, row: ROW },
    });

    expect(accessReducer(asked, { type: ACCESS_EVENT.CONFIRMATION_DISMISSED })).toEqual(
      INITIAL_ACCESS_STATE,
    );
  });

  it('marks the acting row, and only that row', () => {
    const state = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'invitation:i-1',
    });

    expect(state.pendingRowKey).toBe('invitation:i-1');
  });

  /**
   * One event, three fields — the case the three `useState` setters were spelling out by hand, and
   * the reason this is a reducer.
   */
  it('settles everything at once: the outcome shown, nothing running, nothing asked', () => {
    const running = accessReducer(
      accessReducer(INITIAL_ACCESS_STATE, {
        type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
        confirmation: { kind: CONFIRMATION.REVOKE, row: ROW },
      }),
      { type: ACCESS_EVENT.ACTION_STARTED, rowKey: 'invitation:i-1' },
    );

    expect(settled(running)).toEqual({
      notice: NOTICE,
      confirming: null,
      pendingRowKey: null,
    });
  });

  /**
   * The first defect writing the whole state exposed: the previous action's outcome must not sit
   * above a row that is currently changing. Three separate setters left it there, because nothing
   * asked what `notice` should be while an action ran.
   */
  it('clears the last outcome when the next action starts', () => {
    const reported = settled(INITIAL_ACCESS_STATE);
    expect(reported.notice).not.toBeNull();

    const running = accessReducer(reported, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'member:m-2',
    });

    expect(running.notice).toBeNull();
    expect(running.pendingRowKey).toBe('member:m-2');
  });

  /**
   * The second: a success callout from one action framing a dialogue asking about a different one
   * reads as though the two are connected.
   */
  it('clears the last outcome when a new decision is asked for', () => {
    const reported = settled(INITIAL_ACCESS_STATE);

    const asking = accessReducer(reported, {
      type: ACCESS_EVENT.CONFIRMATION_REQUESTED,
      confirmation: { kind: CONFIRMATION.REMOVE, row: ROW },
    });

    expect(asking.notice).toBeNull();
    expect(asking.confirming).not.toBeNull();
  });

  /** A row action opens no dialogue, so settling has none to close — and must not mind. */
  it('settles cleanly when no dialogue was open', () => {
    const running = accessReducer(INITIAL_ACCESS_STATE, {
      type: ACCESS_EVENT.ACTION_STARTED,
      rowKey: 'invitation:i-1',
    });

    expect(settled(running).confirming).toBeNull();
  });
});
