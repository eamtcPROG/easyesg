/**
 * A sign-out asked for while answers are still unsent (task 93; UC-06, UX-37) — as one value and the
 * events that move it.
 *
 * **Three stages, and the reason there are three** is that UX-37 asks for a warning only where work would
 * be *abandoned*: a queue that can still go is sent first and nothing is put to the reader, and one that
 * cannot is the question. So a request either leaves at once, waits for the queue, or — once waiting has
 * learned the queue is stuck — asks.
 *
 * **Pressing sign-out twice does not restart anything.** A request while one is already in hand is
 * ignored: the menu is gone by then, but the drawer's control and a keyboard repeat both reach here.
 *
 * Pure, and beside the action rather than inside the provider, so each transition is a unit spec —
 * including the one a browser journey can only reach by holding a flush open (`switch-state.ts`'s reason,
 * one trigger along).
 */
export const SIGN_OUT_STAGE = {
  /** Asked while answers were unsent and still going: it leaves once they have gone. */
  WAITING: 'waiting',
  /** Asked while they could not go: UX-37's dialogue asks before they are left behind. */
  CONFIRMING: 'confirming',
  /** The session is being ended — the form is submitted and the screen is on its way out. */
  LEAVING: 'leaving',
} as const;

export type SignOutStage = (typeof SIGN_OUT_STAGE)[keyof typeof SIGN_OUT_STAGE];

export interface SignOutState {
  /** The stage of the sign-out in hand, or `null` when none has been asked for. */
  readonly stage: SignOutStage | null;
}

export const INITIAL_SIGN_OUT_STATE: SignOutState = { stage: null };

/** Named for what happened, never for the field it writes (the root file's reducer rule). */
export const SIGN_OUT_EVENT = {
  REQUESTED: 'requested',
  /** What was waiting has gone. */
  UNSENT_SENT: 'unsent_sent',
  /** What was waiting cannot go: offline, refused, or no session to send it with (task 92). */
  UNSENT_BLOCKED: 'unsent_blocked',
  CONFIRMATION_ANSWERED: 'confirmation_answered',
} as const;

export type SignOutEvent =
  | { readonly type: typeof SIGN_OUT_EVENT.REQUESTED; readonly unsent: boolean }
  | { readonly type: typeof SIGN_OUT_EVENT.UNSENT_SENT }
  | { readonly type: typeof SIGN_OUT_EVENT.UNSENT_BLOCKED }
  | { readonly type: typeof SIGN_OUT_EVENT.CONFIRMATION_ANSWERED; readonly leaving: boolean };

export function signOutReducer(state: SignOutState, event: SignOutEvent): SignOutState {
  switch (event.type) {
    case SIGN_OUT_EVENT.REQUESTED:
      // One sign-out at a time: a second press while one is waiting, asking or leaving changes nothing.
      if (state.stage !== null) return state;
      return { stage: event.unsent ? SIGN_OUT_STAGE.WAITING : SIGN_OUT_STAGE.LEAVING };

    case SIGN_OUT_EVENT.UNSENT_SENT:
      return state.stage === SIGN_OUT_STAGE.WAITING ? { stage: SIGN_OUT_STAGE.LEAVING } : state;

    case SIGN_OUT_EVENT.UNSENT_BLOCKED:
      return state.stage === SIGN_OUT_STAGE.WAITING ? { stage: SIGN_OUT_STAGE.CONFIRMING } : state;

    default:
      // The answer to the dialogue: leave the answers behind, or stay and keep them.
      if (state.stage !== SIGN_OUT_STAGE.CONFIRMING) return state;
      return { stage: event.leaving ? SIGN_OUT_STAGE.LEAVING : null };
  }
}

/** Whether the sign-out in hand is at this stage — the provider's one question of this value. */
export const signOutIsAt = (state: SignOutState, stage: SignOutStage): boolean => state.stage === stage;
