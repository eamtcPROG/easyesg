import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '@easyesg/contracts';
import {
  CATEGORY_ACTION_EVENT,
  INITIAL_CATEGORY_ACTION_STATE,
  categoryActionReducer,
  isBusy,
  revertActionOf,
  type CategoryAction,
} from './category-action-state';

const PUBLISH: CategoryAction = {
  control: 'publish',
  categoryKey: 'reporting.manual_reminder',
  behaviour: { channels: ['email'], classification: 'transactional' },
  expectedRevision: 3,
};
const CONSEQUENCES = [{ kind: 'switch_offs_overridden' as const, people: 4 }];

const problem = (type: string, status: number): ApiFailure => ({
  status: 'problem',
  problem: { type, title: 'Refused', detail: 'Refused, and why.', status },
});

describe('A-17’s publication state (task 67.10)', () => {
  it('reverts to the behaviour before the one in force, against the revision in force — or offers nothing', () => {
    const category = {
      categoryKey: 'reporting.manual_reminder' as const,
      mandatory: false,
      addressNotice: false,
      switchOffs: { inApp: 0, email: 0, people: 0 },
      wording: [],
      inForce: {
        channels: ['email' as const],
        classification: 'optional' as const,
        revision: 5,
        publishedAt: null,
        publishedBy: null,
        previousRevision: 4,
        previous: { channels: ['in_app' as const, 'email' as const], classification: 'optional' as const },
      },
    };
    expect(revertActionOf(category)).toEqual({
      control: 'revert',
      categoryKey: 'reporting.manual_reminder',
      behaviour: { channels: ['in_app', 'email'], classification: 'optional' },
      expectedRevision: 5,
    });
    expect(revertActionOf({ ...category, inForce: { ...category.inForce, previous: null } })).toBeNull();
    expect(revertActionOf({ ...category, inForce: null })).toBeNull();
  });

  it('walks preview → disclosure → confirm → progress → result', () => {
    const previewing = categoryActionReducer(INITIAL_CATEGORY_ACTION_STATE, {
      type: CATEGORY_ACTION_EVENT.PREVIEW_STARTED,
      action: PUBLISH,
    });
    expect(isBusy(previewing)).toBe(true);

    const disclosed = categoryActionReducer(previewing, { type: CATEGORY_ACTION_EVENT.PREVIEWED, consequences: CONSEQUENCES });
    expect(disclosed).toEqual({
      previewing: null,
      confirming: { action: PUBLISH, consequences: CONSEQUENCES },
      pending: null,
      notice: null,
    });
    expect(isBusy(disclosed)).toBe(false);

    const writing = categoryActionReducer(disclosed, { type: CATEGORY_ACTION_EVENT.STARTED });
    expect(writing).toEqual({ previewing: null, confirming: null, pending: PUBLISH, notice: null });

    expect(categoryActionReducer(writing, { type: CATEGORY_ACTION_EVENT.SUCCEEDED }).notice).toEqual({
      kind: 'done',
      action: PUBLISH,
    });
  });

  it('writes nothing it has not disclosed: a start with no disclosure open changes nothing', () => {
    expect(categoryActionReducer(INITIAL_CATEGORY_ACTION_STATE, { type: CATEGORY_ACTION_EVENT.STARTED })).toBe(
      INITIAL_CATEGORY_ACTION_STATE,
    );
  });

  it('draws a colleague’s publication as the conflict state, and any other refusal as a refusal', () => {
    const writing = { ...INITIAL_CATEGORY_ACTION_STATE, pending: PUBLISH };
    expect(
      categoryActionReducer(writing, {
        type: CATEGORY_ACTION_EVENT.REFUSED,
        failure: problem('https://easyesg.md/problems/notification-category-changed', 409),
      }).notice,
    ).toEqual({ kind: 'changed', categoryKey: 'reporting.manual_reminder' });

    // A preview refused by a rule in code ends the preview, and says why.
    const previewing = { ...INITIAL_CATEGORY_ACTION_STATE, previewing: PUBLISH };
    const refusal = problem('https://easyesg.md/problems/validation-failed', 400);
    expect(categoryActionReducer(previewing, { type: CATEGORY_ACTION_EVENT.REFUSED, failure: refusal })).toEqual({
      previewing: null,
      confirming: null,
      pending: null,
      notice: { kind: 'refused', failure: refusal },
    });
  });

  it('retires the last notice when the next proposal starts, and keeps nothing open on a cancel', () => {
    const done = { ...INITIAL_CATEGORY_ACTION_STATE, notice: { kind: 'done' as const, action: PUBLISH } };
    expect(categoryActionReducer(done, { type: CATEGORY_ACTION_EVENT.PREVIEW_STARTED, action: PUBLISH }).notice).toBeNull();

    const disclosed = { ...INITIAL_CATEGORY_ACTION_STATE, confirming: { action: PUBLISH, consequences: [] } };
    expect(categoryActionReducer(disclosed, { type: CATEGORY_ACTION_EVENT.CONFIRMATION_CANCELLED }).confirming).toBeNull();
  });
});
