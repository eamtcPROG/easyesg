import type { CalloutIntent } from '@easyesg/ui';
import type { AccessRow } from './access';

/**
 * S-16's interaction state, as one value and the events that move it (26 Aug 2026, project owner).
 *
 * **Three `useState`s became one reducer because they were never three states.** The first cut held
 * `pendingRowKey`, `notice` and `confirming` separately, and every handler set two or three of them:
 * an action's completion wrote all three, `dismiss` wrote one and left the others as they were. That
 * is the shape a reducer exists for — the scattered writes are one event described three times, and
 * the reader has to reconstruct "what happens when an action settles" from three call sites.
 *
 * **Writing the whole next state is what found the defects.** Two fields were being left stale, and
 * neither was visible while each `setX` was read on its own:
 *
 * - Starting an action kept the previous action's notice on screen, so a stale *"the invitation has
 *   been sent"* sat above a removal that was still running.
 * - Opening a confirmation did the same: a success callout from one action framing a dialogue
 *   asking about a different one, which reads as though the two are related.
 *
 * Both are now single lines in the reducer, and they are single lines *because* every branch has to
 * name the whole state. That is the argument for this shape over three setters, more than the
 * batching is.
 *
 * **Pure, and in its own module**, for the reason `access.ts` is: a reducer is a function from state
 * and event to state, so its transitions are a unit spec rather than a browser journey — including
 * the ones a journey would never reach, like an action settling while a dialogue is still open.
 */

/** Which confirmation the dialogue is asking for. Both are consequence-disclosing (UX-70). */
export const CONFIRMATION = {
  /** UC-63 — withdraw a member's access. */
  REMOVE: 'remove',
  /** UC-61 — withdraw an outstanding invitation. */
  REVOKE: 'revoke',
} as const;

export type ConfirmationKind = (typeof CONFIRMATION)[keyof typeof CONFIRMATION];

export interface Confirmation {
  readonly kind: ConfirmationKind;
  readonly row: AccessRow;
}

/**
 * A completed action, reported beside the list.
 *
 * All three parts NFR-79 requires, `action` included — the slot is required by `Callout` for
 * exactly the reason this screen first got wrong: filled with a control's label ("Actions") it
 * reads as decoration, and the reader is left without the sentence saying what to do next. On a
 * success that sentence is honestly "nothing"; saying so is not the same as omitting it.
 */
export interface Notice {
  readonly intent: CalloutIntent;
  readonly title: string;
  readonly body: string;
  readonly action: string;
}

export interface AccessState {
  /** What the last completed action said, or nothing since the last thing the reader started. */
  readonly notice: Notice | null;
  /** The decision currently being asked for, or nothing. */
  readonly confirming: Confirmation | null;
  /**
   * The row whose action is running, by row key — **not a screen-wide flag.**
   *
   * A boolean here would disable every control on every row while any one action ran, which is what
   * `useTransition`'s per-component pending flag did before this state existed.
   */
  readonly pendingRowKey: string | null;
}

export const INITIAL_ACCESS_STATE: AccessState = {
  notice: null,
  confirming: null,
  pendingRowKey: null,
};

/**
 * What can happen to this screen. Named for the **event**, not for the field it writes —
 * `ACTION_SETTLED`, not `SET_NOTICE`, because one event moves three fields and a setter-shaped name
 * would be the three `useState`s again wearing a reducer's clothes.
 */
export const ACCESS_EVENT = {
  /** A consequence-disclosing action was asked for: the dialogue opens. */
  CONFIRMATION_REQUESTED: 'confirmation_requested',
  /** The reader backed out of it. */
  CONFIRMATION_DISMISSED: 'confirmation_dismissed',
  /** A row's action left for the server. */
  ACTION_STARTED: 'action_started',
  /** It came back — with what it said, whether that is a success or a refusal. */
  ACTION_SETTLED: 'action_settled',
} as const;

export type AccessEventType = (typeof ACCESS_EVENT)[keyof typeof ACCESS_EVENT];

export type AccessEvent =
  | { readonly type: typeof ACCESS_EVENT.CONFIRMATION_REQUESTED; readonly confirmation: Confirmation }
  | { readonly type: typeof ACCESS_EVENT.CONFIRMATION_DISMISSED }
  | { readonly type: typeof ACCESS_EVENT.ACTION_STARTED; readonly rowKey: string }
  | { readonly type: typeof ACCESS_EVENT.ACTION_SETTLED; readonly notice: Notice };

export function accessReducer(state: AccessState, event: AccessEvent): AccessState {
  switch (event.type) {
    case ACCESS_EVENT.CONFIRMATION_REQUESTED:
      // The notice goes: a success callout from the last action framing a dialogue about a
      // different one reads as though the two are connected.
      return { ...state, confirming: event.confirmation, notice: null };

    case ACCESS_EVENT.CONFIRMATION_DISMISSED:
      return { ...state, confirming: null };

    case ACCESS_EVENT.ACTION_STARTED:
      // Same reason, and the more visible one: the previous action's outcome must not sit above a
      // row that is currently changing.
      return { ...state, pendingRowKey: event.rowKey, notice: null };

    default:
      // Everything at once, which is the case the three setters were spelling out by hand. The
      // dialogue closes whether or not the action came from one — an action started from a row
      // button has no dialogue to close, and `null` is already `null`.
      return { notice: event.notice, confirming: null, pendingRowKey: null };
  }
}
