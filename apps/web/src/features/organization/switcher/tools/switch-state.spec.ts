import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import {
  CHOICE_STAGE,
  choiceAt,
  INITIAL_SWITCH_STATE,
  pendingOrganizationId,
  SWITCH_EVENT,
  switchReducer,
  UNSENT_STEP,
  unsentStep,
  visibleFailure,
  type ChoiceStage,
  type SwitchState,
} from './switch-state';

/**
 * The switch's transitions (task 83.2), each naming the whole next state — the reason this is a reducer — and
 * the three readings the provider derives from it. The cases a browser reaches only by contriving timing are
 * the ones asserted here.
 */
const REFUSAL = { status: API_OUTCOME.Unreachable } as const;

const holding = (stage: ChoiceStage, organizationId = 'org-b'): SwitchState => ({
  choice: { stage, organizationId },
  refusal: null,
});

const refusedOn = (pathname: string) => ({ failure: REFUSAL, pathname });

describe('switchReducer', () => {
  it('holds a choice made while answers are unsent, clearing what the last choice left', () => {
    const after = switchReducer(
      { choice: { stage: CHOICE_STAGE.SENT, organizationId: 'org-a' }, refusal: refusedOn('/entities') },
      { type: SWITCH_EVENT.CHOSEN_WHILE_UNSENT, organizationId: 'org-b' },
    );

    expect(after).toEqual(holding(CHOICE_STAGE.WAITING));
  });

  it('turns a waiting choice into a question once its answers cannot go (UX-37)', () => {
    expect(switchReducer(holding(CHOICE_STAGE.WAITING), { type: SWITCH_EVENT.UNSENT_BLOCKED })).toEqual(
      holding(CHOICE_STAGE.CONFIRMING),
    );
  });

  it('asks nothing about a choice that is not waiting, whatever the answers do', () => {
    const sent = holding(CHOICE_STAGE.SENT);

    expect(switchReducer(sent, { type: SWITCH_EVENT.UNSENT_BLOCKED })).toBe(sent);
    expect(switchReducer(INITIAL_SWITCH_STATE, { type: SWITCH_EVENT.UNSENT_BLOCKED })).toBe(INITIAL_SWITCH_STATE);
  });

  it('ends the question when the reader answers it', () => {
    expect(
      switchReducer(holding(CHOICE_STAGE.CONFIRMING), { type: SWITCH_EVENT.CONFIRMATION_ANSWERED }),
    ).toEqual(INITIAL_SWITCH_STATE);
  });

  it('leaves a choice that is not a question alone when an answer arrives', () => {
    const sent = holding(CHOICE_STAGE.SENT);

    expect(switchReducer(sent, { type: SWITCH_EVENT.CONFIRMATION_ANSWERED })).toBe(sent);
  });

  it('sends a choice with nothing left waiting, asking or refused', () => {
    const after = switchReducer(
      { choice: { stage: CHOICE_STAGE.CONFIRMING, organizationId: 'org-c' }, refusal: refusedOn('/entities') },
      { type: SWITCH_EVENT.SEND_STARTED, organizationId: 'org-b' },
    );

    expect(after).toEqual(holding(CHOICE_STAGE.SENT));
  });

  it('keeps a refusal with the screen it was made on', () => {
    const after = switchReducer(holding(CHOICE_STAGE.SENT), {
      type: SWITCH_EVENT.REFUSED,
      failure: REFUSAL,
      pathname: '/entities',
    });

    expect(after).toEqual({ ...holding(CHOICE_STAGE.SENT), refusal: refusedOn('/entities') });
  });

  it('forgets a refusal once the reader is on another screen, and keeps a waiting choice', () => {
    const state: SwitchState = { ...holding(CHOICE_STAGE.WAITING), refusal: refusedOn('/entities') };

    expect(switchReducer(state, { type: SWITCH_EVENT.NAVIGATED, pathname: '/reports' })).toEqual(
      holding(CHOICE_STAGE.WAITING),
    );
  });

  it('keeps a refusal while the reader is still on its screen', () => {
    const state: SwitchState = { ...holding(CHOICE_STAGE.SENT), refusal: refusedOn('/entities') };

    expect(switchReducer(state, { type: SWITCH_EVENT.NAVIGATED, pathname: '/entities' })).toBe(state);
    expect(switchReducer(INITIAL_SWITCH_STATE, { type: SWITCH_EVENT.NAVIGATED, pathname: '/reports' })).toBe(
      INITIAL_SWITCH_STATE,
    );
  });
});

describe('the readings the provider derives', () => {
  it('reads the organization of a choice at the stage asked about, and nothing at another', () => {
    expect(choiceAt(holding(CHOICE_STAGE.CONFIRMING), CHOICE_STAGE.CONFIRMING)).toBe('org-b');
    expect(choiceAt(holding(CHOICE_STAGE.CONFIRMING), CHOICE_STAGE.WAITING)).toBeNull();
    expect(choiceAt(INITIAL_SWITCH_STATE, CHOICE_STAGE.SENT)).toBeNull();
  });

  it('counts a waiting choice as pending, and a sent one only while its transition is', () => {
    expect(pendingOrganizationId(holding(CHOICE_STAGE.WAITING), false)).toBe('org-b');
    expect(pendingOrganizationId(holding(CHOICE_STAGE.SENT), true)).toBe('org-b');
    expect(pendingOrganizationId(holding(CHOICE_STAGE.SENT), false)).toBeNull();
    // A question is the reader's to answer, not a switch on its way.
    expect(pendingOrganizationId(holding(CHOICE_STAGE.CONFIRMING), true)).toBeNull();
  });

  it('shows a refusal on the screen it was made on, and on no other', () => {
    const state: SwitchState = { ...holding(CHOICE_STAGE.SENT), refusal: refusedOn('/entities') };

    expect(visibleFailure(state, '/entities')).toBe(REFUSAL);
    expect(visibleFailure(state, '/reports')).toBeNull();
    expect(visibleFailure(INITIAL_SWITCH_STATE, '/entities')).toBeNull();
  });
});

describe('unsentStep', () => {
  it('sends once nothing is unsent', () => {
    expect(unsentStep({ unsynced: 0, blocked: true })).toBe(UNSENT_STEP.SEND);
  });

  it('waits while unsent answers are still going', () => {
    expect(unsentStep({ unsynced: 2, blocked: false })).toBe(UNSENT_STEP.WAIT);
  });

  it('asks once unsent answers cannot go', () => {
    expect(unsentStep({ unsynced: 2, blocked: true })).toBe(UNSENT_STEP.ASK);
  });
});
