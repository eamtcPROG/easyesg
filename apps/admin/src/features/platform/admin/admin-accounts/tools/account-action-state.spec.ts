import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import {
  ACCOUNT_ACTION_EVENT,
  INITIAL_ACCOUNT_ACTION_STATE,
  accountActionReducer,
  type AccountAction,
  type AccountActionState,
} from './account-action-state';

const suspend: AccountAction = { rowId: 'row-1', control: 'suspend', email: 'ana@easyesg.md' };
const release: AccountAction = { rowId: 'row-2', control: 'release_lockout', email: 'ion@easyesg.md' };
const refusal: ApiFailure = {
  status: API_OUTCOME.Problem,
  problem: { type: 'https://easyesg.md/problems/last-administrator', status: 409 },
};

const run = (...events: Parameters<typeof accountActionReducer>[1][]): AccountActionState =>
  events.reduce(accountActionReducer, INITIAL_ACCOUNT_ACTION_STATE);

describe('A-08’s action state (task 67.4)', () => {
  it('holds a confirmation open while its action runs, then closes it on the result', () => {
    const running = run(
      { type: ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED, action: suspend },
      { type: ACCOUNT_ACTION_EVENT.STARTED, action: suspend },
    );
    expect(running).toEqual({ confirming: suspend, pending: suspend, notice: null });

    expect(accountActionReducer(running, { type: ACCOUNT_ACTION_EVENT.SUCCEEDED })).toEqual({
      confirming: null,
      pending: null,
      notice: { kind: 'done', action: suspend },
    });
  });

  it('carries the api’s refusal with the action it refused', () => {
    expect(
      run(
        { type: ACCOUNT_ACTION_EVENT.STARTED, action: suspend },
        { type: ACCOUNT_ACTION_EVENT.REFUSED, failure: refusal },
      ).notice,
    ).toEqual({ kind: 'refused', action: suspend, failure: refusal });
  });

  it('never leaves the last action’s notice above the next one', () => {
    const settled = run(
      { type: ACCOUNT_ACTION_EVENT.STARTED, action: suspend },
      { type: ACCOUNT_ACTION_EVENT.SUCCEEDED },
    );

    expect(accountActionReducer(settled, { type: ACCOUNT_ACTION_EVENT.STARTED, action: release }).notice).toBeNull();
    expect(
      accountActionReducer(settled, { type: ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED, action: release }).notice,
    ).toBeNull();
  });

  it('closes a confirmation cancelled, and ignores a result with nothing in flight', () => {
    const asked = run({ type: ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED, action: suspend });
    expect(accountActionReducer(asked, { type: ACCOUNT_ACTION_EVENT.CONFIRMATION_CANCELLED }).confirming).toBeNull();
    expect(accountActionReducer(INITIAL_ACCOUNT_ACTION_STATE, { type: ACCOUNT_ACTION_EVENT.SUCCEEDED })).toBe(
      INITIAL_ACCOUNT_ACTION_STATE,
    );
  });

  it('announces a sent invitation, and a dismissal clears whatever was announced', () => {
    const invited = run({ type: ACCOUNT_ACTION_EVENT.INVITATION_SENT, email: 'nou@easyesg.md' });
    expect(invited.notice).toEqual({ kind: 'invited', email: 'nou@easyesg.md' });
    expect(accountActionReducer(invited, { type: ACCOUNT_ACTION_EVENT.NOTICE_DISMISSED }).notice).toBeNull();
  });
});
