import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '@easyesg/contracts';
import {
  INITIAL_PROVIDER_ACTION_STATE,
  PROVIDER_ACTION_EVENT,
  actionAsksConfirmation,
  providerActionReducer,
  type ProviderAction,
} from './provider-action-state';

const DISABLE: ProviderAction = { control: 'disable', provider: 'google', revision: 4 };
const ENABLE: ProviderAction = { control: 'enable', provider: 'google', revision: 4 };
const SAVE: ProviderAction = {
  control: 'save',
  provider: 'google',
  request: { clientId: 'x', issuer: 'https://accounts.google.com', redirectUris: [], revision: 4 },
};

const problem = (type: string): ApiFailure => ({
  status: 'problem',
  problem: { type, title: 'Refused', detail: 'Refused, and why.', status: 409 },
});

describe('A-18’s action state (task 67.11)', () => {
  it('asks before every disable and before a save to an enabled provider, and never before an enable', () => {
    expect(actionAsksConfirmation({ action: DISABLE, enabled: true })).toBe(true);
    expect(actionAsksConfirmation({ action: SAVE, enabled: true })).toBe(true);
    expect(actionAsksConfirmation({ action: SAVE, enabled: false })).toBe(false);
    expect(actionAsksConfirmation({ action: ENABLE, enabled: false })).toBe(false);
  });

  it('carries a confirmed action into flight, and names what was done when it succeeds', () => {
    const confirming = providerActionReducer(INITIAL_PROVIDER_ACTION_STATE, {
      type: PROVIDER_ACTION_EVENT.CONFIRMATION_REQUESTED,
      action: DISABLE,
    });
    expect(confirming.confirming).toBe(DISABLE);

    const pending = providerActionReducer(confirming, { type: PROVIDER_ACTION_EVENT.STARTED, action: DISABLE });
    expect(pending).toEqual({ confirming: null, pending: DISABLE, notice: null });

    expect(providerActionReducer(pending, { type: PROVIDER_ACTION_EVENT.SUCCEEDED })).toEqual({
      confirming: null,
      pending: null,
      notice: { kind: 'done', action: DISABLE },
    });
  });

  it('reads a colleague’s earlier save as the conflict state, and any other refusal as the api worded it', () => {
    const pending = providerActionReducer(INITIAL_PROVIDER_ACTION_STATE, {
      type: PROVIDER_ACTION_EVENT.STARTED,
      action: SAVE,
    });

    expect(
      providerActionReducer(pending, {
        type: PROVIDER_ACTION_EVENT.REFUSED,
        failure: problem('https://easyesg.md/problems/identity-provider-changed'),
      }).notice,
    ).toEqual({ kind: 'changed', provider: 'google' });

    const incomplete = problem('https://easyesg.md/problems/identity-provider-incomplete');
    expect(providerActionReducer(pending, { type: PROVIDER_ACTION_EVENT.REFUSED, failure: incomplete }).notice).toEqual({
      kind: 'refused',
      action: SAVE,
      failure: incomplete,
    });
  });

  it('retires the last notice when the next write starts, and ignores an answer with nothing in flight', () => {
    const done = { confirming: null, pending: null, notice: { kind: 'done', action: ENABLE } } as const;

    expect(providerActionReducer(done, { type: PROVIDER_ACTION_EVENT.STARTED, action: DISABLE }).notice).toBeNull();
    expect(providerActionReducer(done, { type: PROVIDER_ACTION_EVENT.SUCCEEDED })).toBe(done);
    expect(providerActionReducer(done, { type: PROVIDER_ACTION_EVENT.NOTICE_DISMISSED }).notice).toBeNull();
  });
});
