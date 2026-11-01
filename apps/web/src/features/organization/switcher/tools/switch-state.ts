import type { ApiFailure } from '@/lib/api-outcome';

/**
 * The organization switch's own state (task 83.2): the choice in hand and the last refusal — one reducer,
 * because one event moves both at once, and a reducer branch has to say what every field becomes.
 *
 * **What a choice goes through** (UX-3, UX-37). Nothing unsent: it is sent. Answers unsent and still going:
 * it *waits*, and is sent once they have gone. Answers that cannot go — offline, refused: the reader is
 * *asked*, and it is sent only if they confirm. The api may still refuse it, and that refusal is shown on the
 * screen it was made on until the next choice.
 *
 * **One choice at one stage, not a field per stage** (the root file's *mutually exclusive → one value*): a
 * choice cannot wait, be asked about and be on its way at once, and three nullable fields could say it was.
 */
export const CHOICE_STAGE = {
  /** Chosen while answers were unsent and still going; it is sent once they have gone. */
  WAITING: 'waiting',
  /** Chosen while answers could not be sent; UX-37's dialogue asks before they are left behind. */
  CONFIRMING: 'confirming',
  /** Sent. It is *on its way* while the transition carrying it is pending, which only the provider knows. */
  SENT: 'sent',
} as const;

export type ChoiceStage = (typeof CHOICE_STAGE)[keyof typeof CHOICE_STAGE];

export interface SwitchState {
  /** The choice in hand, or `null` when there is none. */
  readonly choice: { readonly stage: ChoiceStage; readonly organizationId: string } | null;
  /** The last choice's refusal, in the api's words, with the address of the screen it was made on. */
  readonly refusal: { readonly failure: ApiFailure; readonly pathname: string } | null;
}

export const INITIAL_SWITCH_STATE: SwitchState = { choice: null, refusal: null };

/** Named for what happened, never for the field it writes (the root file's reducer rule). */
export const SWITCH_EVENT = {
  CHOSEN_WHILE_UNSENT: 'chosen_while_unsent',
  UNSENT_BLOCKED: 'unsent_blocked',
  CONFIRMATION_ANSWERED: 'confirmation_answered',
  SEND_STARTED: 'send_started',
  REFUSED: 'refused',
  NAVIGATED: 'navigated',
} as const;

export type SwitchEvent =
  | { readonly type: typeof SWITCH_EVENT.CHOSEN_WHILE_UNSENT; readonly organizationId: string }
  | { readonly type: typeof SWITCH_EVENT.UNSENT_BLOCKED }
  | { readonly type: typeof SWITCH_EVENT.CONFIRMATION_ANSWERED }
  | { readonly type: typeof SWITCH_EVENT.SEND_STARTED; readonly organizationId: string }
  | { readonly type: typeof SWITCH_EVENT.REFUSED; readonly failure: ApiFailure; readonly pathname: string }
  | { readonly type: typeof SWITCH_EVENT.NAVIGATED; readonly pathname: string };

export function switchReducer(state: SwitchState, event: SwitchEvent): SwitchState {
  switch (event.type) {
    // A new choice supersedes whatever the last one left: its wait, its question, its refusal.
    case SWITCH_EVENT.CHOSEN_WHILE_UNSENT:
      return { choice: { stage: CHOICE_STAGE.WAITING, organizationId: event.organizationId }, refusal: null };

    // Only a waiting choice can become a question; a late report about a choice already sent moves nothing.
    case SWITCH_EVENT.UNSENT_BLOCKED:
      return state.choice?.stage === CHOICE_STAGE.WAITING
        ? { ...state, choice: { ...state.choice, stage: CHOICE_STAGE.CONFIRMING } }
        : state;

    // Confirmed or cancelled, the question is over; a confirmation is followed by its own SEND_STARTED.
    case SWITCH_EVENT.CONFIRMATION_ANSWERED:
      return state.choice?.stage === CHOICE_STAGE.CONFIRMING ? { ...state, choice: null } : state;

    case SWITCH_EVENT.SEND_STARTED:
      return { choice: { stage: CHOICE_STAGE.SENT, organizationId: event.organizationId }, refusal: null };

    case SWITCH_EVENT.REFUSED:
      return { ...state, refusal: { failure: event.failure, pathname: event.pathname } };

    // **Forgotten once the reader is on another screen**, so that returning to the one it was made on does not
    // bring it back. Whether it shows is `visibleFailure`'s, derived in the render; this only forgets — the
    // address alone cannot tell a reader who stayed from one who left and came back. A choice waiting on
    // answers is still the reader's choice wherever they go next, so it stays.
    case SWITCH_EVENT.NAVIGATED:
      return state.refusal !== null && state.refusal.pathname !== event.pathname
        ? { ...state, refusal: null }
        : state;

    default:
      return state;
  }
}

/** The organization of the choice at this stage, or `null` when the choice is at another or there is none. */
export const choiceAt = (state: SwitchState, stage: ChoiceStage): string | null =>
  state.choice?.stage === stage ? state.choice.organizationId : null;

/**
 * The organization a choice is waiting on or on its way to — the switcher's pending row. A sent choice counts
 * only while `sending`, the transition's own flag, because the state cannot see a navigation commit.
 */
export const pendingOrganizationId = (state: SwitchState, sending: boolean): string | null =>
  choiceAt(state, CHOICE_STAGE.WAITING) ?? (sending ? choiceAt(state, CHOICE_STAGE.SENT) : null);

/**
 * The refusal this screen shows (`pure-derive-during-render`): the last one, on the screen it was made on.
 * Derived rather than cleared, so the first render of the next screen does not draw the last screen's refusal.
 */
export const visibleFailure = (state: SwitchState, pathname: string): ApiFailure | null =>
  state.refusal !== null && state.refusal.pathname === pathname ? state.refusal.failure : null;

/** What a choice waiting on unsent answers does next. */
export const UNSENT_STEP = { SEND: 'send', WAIT: 'wait', ASK: 'ask' } as const;

export type UnsentStep = (typeof UNSENT_STEP)[keyof typeof UNSENT_STEP];

/** From the answers' own standing: gone, going, or stuck. */
export const unsentStep = (work: { readonly unsynced: number; readonly blocked: boolean }): UnsentStep => {
  if (work.unsynced === 0) return UNSENT_STEP.SEND;
  return work.blocked ? UNSENT_STEP.ASK : UNSENT_STEP.WAIT;
};
