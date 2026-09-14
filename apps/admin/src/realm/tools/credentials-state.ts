import type { AdminEnrolment, ApiFailure } from '@easyesg/contracts';
import { CREDENTIALS_ARRIVAL, type CredentialsArrival } from './credentials-arrival';

/**
 * A-19's interaction state (task 151) — which section is acting, what the screen shows beyond its
 * resting form, and what the last write said, as one value and the events that move it. S-28's
 * reason (`apps/web`'s `credentials-state.ts`): the reader does one thing at a time, and as separate
 * `useState`s a success above a refusal still in flight is representable.
 *
 * **Where it departs from S-28's, and why.**
 *
 * - **An open enrolment and a set of codes shown once are two fields, not one stage.** On S-28 the
 *   codes were what enabling the factor answered, so the two could not coexist; here they are two
 *   sections' work, and a union would throw away a staged secret — the only copy there is — the
 *   moment codes were issued beside it.
 * - **A notice names its place.** A refusal is drawn inside the section that acted, where the reader
 *   is looking, and the arrival notice above them all — S-16's placed-notice lesson — so two outcomes
 *   at once stay unrepresentable while each is drawn where it belongs (`noticeSection`).
 * - **The screen can be born with a notice**: A-01's recovery sign-in lands here with one.
 * - **The current password outlives exactly one kind of action.** Every write asks for it, and the
 *   record's one field is cleared once a write settles — except while a re-enrolment is open, whose
 *   confirming step asks for the same password again, so it is typed once (`design_spec.md` §5.2
 *   A-19). `reauthenticationOutlives` derives that from this reducer rather than listing events, so
 *   a later event cannot disagree with it.
 *
 * **Pure, and in its own module** (`pure-logic-leaves-the-component`): every transition is a unit
 * spec, including the ones a browser journey reaches only by contriving the timing.
 */

/** The record's three sections — also each `RecordSection`'s id, so a refusal can name its place. */
export const CREDENTIALS_SECTION = {
  PASSWORD: 'password',
  FACTOR: 'factor',
  RECOVERY_CODES: 'recovery-codes',
} as const;

export type CredentialsSection = (typeof CREDENTIALS_SECTION)[keyof typeof CREDENTIALS_SECTION];

export const CREDENTIALS_NOTICE = {
  /** A-01's recovery sign-in sent the operator here (task 151). Drawn above the sections. */
  RECOVERED: 'recovered',
  PASSWORD_CHANGED: 'password_changed',
  FACTOR_REPLACED: 'factor_replaced',
  REFUSED: 'refused',
} as const;

export type CredentialsNotice =
  | { readonly kind: typeof CREDENTIALS_NOTICE.RECOVERED }
  | {
      readonly kind: typeof CREDENTIALS_NOTICE.PASSWORD_CHANGED;
      readonly otherSessionsTerminated: number;
    }
  | { readonly kind: typeof CREDENTIALS_NOTICE.FACTOR_REPLACED }
  | {
      readonly kind: typeof CREDENTIALS_NOTICE.REFUSED;
      readonly section: CredentialsSection;
      readonly failure: ApiFailure;
    };

export interface CredentialsState {
  /** A second factor staged beside the one in force, awaiting its confirming code. */
  readonly enrolment: AdminEnrolment | null;
  /** A set just issued, shown this once until the reader acknowledges it (UC-212). */
  readonly codes: readonly string[] | null;
  /** The write in flight. One for the whole record — see `credentials-context.tsx`. */
  readonly pending: CredentialsSection | null;
  readonly notice: CredentialsNotice | null;
}

export const CREDENTIALS_EVENT = {
  ACTION_STARTED: 'action_started',
  ACTION_REFUSED: 'action_refused',
  PASSWORD_CHANGED: 'password_changed',
  ENROLMENT_OFFERED: 'enrolment_offered',
  ENROLMENT_ABANDONED: 'enrolment_abandoned',
  FACTOR_REPLACED: 'factor_replaced',
  CODES_ISSUED: 'codes_issued',
  CODES_ACKNOWLEDGED: 'codes_acknowledged',
} as const;

export type CredentialsEvent =
  | { readonly type: typeof CREDENTIALS_EVENT.ACTION_STARTED; readonly section: CredentialsSection }
  | { readonly type: typeof CREDENTIALS_EVENT.ACTION_REFUSED; readonly failure: ApiFailure }
  | {
      readonly type: typeof CREDENTIALS_EVENT.PASSWORD_CHANGED;
      readonly otherSessionsTerminated: number;
    }
  | { readonly type: typeof CREDENTIALS_EVENT.ENROLMENT_OFFERED; readonly offer: AdminEnrolment }
  | { readonly type: typeof CREDENTIALS_EVENT.ENROLMENT_ABANDONED }
  | { readonly type: typeof CREDENTIALS_EVENT.FACTOR_REPLACED }
  | { readonly type: typeof CREDENTIALS_EVENT.CODES_ISSUED; readonly codes: readonly string[] }
  | { readonly type: typeof CREDENTIALS_EVENT.CODES_ACKNOWLEDGED };

export const initialCredentialsState = (arrival: CredentialsArrival | undefined): CredentialsState => ({
  enrolment: null,
  codes: null,
  pending: null,
  notice: arrival === CREDENTIALS_ARRIVAL.RECOVERED ? { kind: CREDENTIALS_NOTICE.RECOVERED } : null,
});

/** Where a notice is drawn: inside the section it speaks for, or — `null` — above them all. */
export const noticeSection = (notice: CredentialsNotice): CredentialsSection | null => {
  switch (notice.kind) {
    case CREDENTIALS_NOTICE.RECOVERED:
      return null;
    case CREDENTIALS_NOTICE.PASSWORD_CHANGED:
      return CREDENTIALS_SECTION.PASSWORD;
    case CREDENTIALS_NOTICE.FACTOR_REPLACED:
      return CREDENTIALS_SECTION.FACTOR;
    case CREDENTIALS_NOTICE.REFUSED:
      return notice.section;
  }
};

export function credentialsReducer(state: CredentialsState, event: CredentialsEvent): CredentialsState {
  switch (event.type) {
    case CREDENTIALS_EVENT.ACTION_STARTED:
      // The last notice goes with the next write, the arrival notice included: a stale "password
      // changed" above a code re-issue still running reads as though the two were one event.
      return { ...state, pending: event.section, notice: null };

    case CREDENTIALS_EVENT.ACTION_REFUSED:
      // An open enrolment survives, deliberately: a code the new authenticator did not confirm leaves
      // its secret on screen to retype against. With nothing acting there is nothing to place.
      return state.pending === null
        ? state
        : {
            ...state,
            pending: null,
            notice: { kind: CREDENTIALS_NOTICE.REFUSED, section: state.pending, failure: event.failure },
          };

    case CREDENTIALS_EVENT.PASSWORD_CHANGED:
      // A staged enrolment survives this too: the api still holds it, and only the password that
      // confirms it has changed.
      return {
        ...state,
        pending: null,
        notice: {
          kind: CREDENTIALS_NOTICE.PASSWORD_CHANGED,
          otherSessionsTerminated: event.otherSessionsTerminated,
        },
      };

    case CREDENTIALS_EVENT.ENROLMENT_OFFERED:
      // The staged secret on screen is the feedback; a success notice beside it would narrate it.
      return { ...state, enrolment: event.offer, pending: null, notice: null };

    case CREDENTIALS_EVENT.ENROLMENT_ABANDONED:
      // A refusal in the factor section described the enrolment, so it goes with it; a notice another
      // section owns is not the reader's to lose by abandoning this one.
      return {
        ...state,
        enrolment: null,
        notice:
          state.notice !== null && noticeSection(state.notice) === CREDENTIALS_SECTION.FACTOR
            ? null
            : state.notice,
      };

    case CREDENTIALS_EVENT.FACTOR_REPLACED:
      return {
        ...state,
        enrolment: null,
        pending: null,
        notice: { kind: CREDENTIALS_NOTICE.FACTOR_REPLACED },
      };

    case CREDENTIALS_EVENT.CODES_ISSUED:
      // Shown once, and the list is its own announcement.
      return { ...state, codes: event.codes, pending: null, notice: null };

    case CREDENTIALS_EVENT.CODES_ACKNOWLEDGED:
      return { ...state, codes: null };
  }
}

/**
 * Whether the record's current-password field keeps its value once `event` lands: only while an
 * enrolment is open after it, since its confirmation asks for the same password — and never after a
 * password change, which leaves the field holding a password the account no longer has.
 */
export const reauthenticationOutlives = (state: CredentialsState, event: CredentialsEvent): boolean =>
  event.type !== CREDENTIALS_EVENT.PASSWORD_CHANGED && credentialsReducer(state, event).enrolment !== null;
