import { API_OUTCOME, CONSOLE_ROLE, type ApiFailure } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { ROLE_DRAFT_EVENT, roleDraftReducer, type RoleDraftState } from './role-draft-state';

const FAILURE = { status: API_OUTCOME.Unreachable } as ApiFailure;
const START: RoleDraftState = { roles: [CONSOLE_ROLE.SUPPORT], outcome: null };

describe('roleDraftReducer (task 67.13)', () => {
  it('clears a saved notice when the choice changes, so it never stands over a choice it did not save', () => {
    const saved = roleDraftReducer(START, { type: ROLE_DRAFT_EVENT.SAVED });
    expect(saved.outcome).toEqual({ kind: 'saved' });
    expect(roleDraftReducer(saved, { type: ROLE_DRAFT_EVENT.CHOSEN, roles: [] })).toEqual({ roles: [], outcome: null });
  });

  it('keeps the choice through a refusal, and clears the refusal on the next submission', () => {
    const refused = roleDraftReducer(START, { type: ROLE_DRAFT_EVENT.REFUSED, failure: FAILURE });
    expect(refused).toEqual({ roles: [CONSOLE_ROLE.SUPPORT], outcome: { kind: 'refused', failure: FAILURE } });
    expect(roleDraftReducer(refused, { type: ROLE_DRAFT_EVENT.SUBMITTED })).toEqual(START);
  });
});
