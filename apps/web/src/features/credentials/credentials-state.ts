import type { SocialProvider } from '@easyesg/contracts';
import type { Notice } from '@/lib/notice';

/**
 * S-28's interaction state, as one value and the events that move it (task 27.7).
 *
 * **The screen has six actions and one place a reader looks.** Each action can be running, can
 * refuse, or can produce something shown exactly once — and only one of those can be true at a
 * time, because the user is doing one thing. Held as separate `useState`s that would be four
 * booleans and two payloads whose impossible combinations are all representable: a success notice
 * from a password change sitting above recovery codes from a re-issue, an enrolment offer still on
 * screen while a disable runs.
 *
 * So the screen's transient state is **one discriminated value**, and the reducer's branches name
 * the whole of the next one. The root `CLAUDE.md` rule is "two different setters in one handler",
 * and this file is what it looks like when the answer is a union rather than a record: the states
 * are genuinely exclusive, so making the impossible pairs unrepresentable is the fix, and a reducer
 * is what makes each transition a named event rather than a scattered write.
 *
 * **Pure, and in its own module**, so every transition is a unit spec — including the ones a
 * browser journey reaches only by contriving the timing, like a refusal arriving while a
 * confirmation dialogue is open.
 */

/**
 * The record's three sections, as the closed vocabulary they always were (28 Aug 2026).
 *
 * It lived as an `as const` inside `credentials-board.tsx` while the field it feeds was typed
 * `string`, so the derived union was thrown away one module after being declared and any string
 * at all satisfied `pendingSection`. Declared here because this is the module that consumes it:
 * a section identifier is interaction state, not a fact about a credential.
 */
export const CREDENTIALS_SECTION = {
  PASSWORD: 'password',
  FACTOR: 'factor',
  PROVIDERS: 'providers',
} as const;

export type CredentialsSection =
  (typeof CREDENTIALS_SECTION)[keyof typeof CREDENTIALS_SECTION];

/**
 * What this screen says after an action settled.
 *
 * **Re-exported from `@/lib/notice`, not declared** (28 Aug 2026): the shape and the
 * outcome-to-notice rule were duplicated here and in S-16, and the copies had drifted — this one
 * put *"Încercați din nou."* under refusals whose `detail` already ends with that sentence.
 */
export type { Notice };

/** What the screen is currently showing beyond its resting form. Exclusive by construction. */
export const CREDENTIALS_STAGE = {
  /** Nothing in flight and nothing to show. */
  IDLE: 'idle',
  /**
   * Enrolment step one has answered: the secret is on screen and awaiting its first code. It is
   * the only copy that will ever exist, which is why abandoning it is a designed exit rather than
   * a dismissal.
   */
  ENROLLING: 'enrolling',
  /** Codes issued, shown exactly once (UC-193). The reader must acknowledge before they go. */
  SHOWING_CODES: 'showing_codes',
  /** A provider round trip has returned and the link awaits the current password (§12.5.6). */
  CONFIRMING_LINK: 'confirming_link',
} as const;

export type CredentialsStage = (typeof CREDENTIALS_STAGE)[keyof typeof CREDENTIALS_STAGE];

export type CredentialsStageValue =
  | { readonly kind: typeof CREDENTIALS_STAGE.IDLE }
  | {
      readonly kind: typeof CREDENTIALS_STAGE.ENROLLING;
      readonly secret: string;
      readonly enrolmentUri: string;
    }
  | { readonly kind: typeof CREDENTIALS_STAGE.SHOWING_CODES; readonly codes: readonly string[] }
  /** `SocialProvider`, not `string`: `readPendingLink` validates the cookie's value against the
   *  contract's own enum, so the screen never holds a provider it cannot name (27 Aug 2026). */
  | { readonly kind: typeof CREDENTIALS_STAGE.CONFIRMING_LINK; readonly provider: SocialProvider };

export interface CredentialsState {
  readonly stage: CredentialsStageValue;
  /** Which section is acting, so only its own controls go inert (S-16's per-row lesson). */
  readonly pendingSection: CredentialsSection | null;
  readonly notice: Notice | null;
}

export const CREDENTIALS_EVENT = {
  ACTION_STARTED: 'action_started',
  ACTION_FAILED: 'action_failed',
  ACTION_SUCCEEDED: 'action_succeeded',
  ENROLMENT_OFFERED: 'enrolment_offered',
  CODES_ISSUED: 'codes_issued',
  DISMISSED: 'dismissed',
} as const;

export type CredentialsEventKind = (typeof CREDENTIALS_EVENT)[keyof typeof CREDENTIALS_EVENT];

export type CredentialsEvent =
  | {
      readonly type: typeof CREDENTIALS_EVENT.ACTION_STARTED;
      readonly section: CredentialsSection;
    }
  | { readonly type: typeof CREDENTIALS_EVENT.ACTION_FAILED; readonly notice: Notice }
  | { readonly type: typeof CREDENTIALS_EVENT.ACTION_SUCCEEDED; readonly notice: Notice }
  | {
      readonly type: typeof CREDENTIALS_EVENT.ENROLMENT_OFFERED;
      readonly secret: string;
      readonly enrolmentUri: string;
    }
  | {
      readonly type: typeof CREDENTIALS_EVENT.CODES_ISSUED;
      readonly codes: readonly string[];
      readonly notice: Notice;
    }
  | { readonly type: typeof CREDENTIALS_EVENT.DISMISSED };

const idle = { kind: CREDENTIALS_STAGE.IDLE } as const;

export const initialCredentialsState = (
  pendingLinkProvider?: SocialProvider | null,
): CredentialsState => ({
  // The screen can be *born* mid-flow: returning from a provider lands here with a link awaiting
  // its password, which is a state the reader did not click into on this page load.
  stage: pendingLinkProvider
    ? { kind: CREDENTIALS_STAGE.CONFIRMING_LINK, provider: pendingLinkProvider }
    : idle,
  pendingSection: null,
  notice: null,
});

export function credentialsReducer(
  state: CredentialsState,
  event: CredentialsEvent,
): CredentialsState {
  switch (event.type) {
    case CREDENTIALS_EVENT.ACTION_STARTED:
      // The previous notice goes with the new action, which is the defect S-16 found: a stale
      // "your password was changed" sitting above an unlink that is still running reads as though
      // the two are the same event.
      return { ...state, pendingSection: event.section, notice: null };

    case CREDENTIALS_EVENT.ACTION_FAILED:
      // The stage survives a refusal, deliberately: a wrong code on the enrolment step must leave
      // the secret on screen to retype against, exactly as the factor challenge does at sign-in.
      return { ...state, pendingSection: null, notice: event.notice };

    case CREDENTIALS_EVENT.ACTION_SUCCEEDED:
      return { stage: idle, pendingSection: null, notice: event.notice };

    case CREDENTIALS_EVENT.ENROLMENT_OFFERED:
      return {
        stage: {
          kind: CREDENTIALS_STAGE.ENROLLING,
          secret: event.secret,
          enrolmentUri: event.enrolmentUri,
        },
        pendingSection: null,
        notice: null,
      };

    case CREDENTIALS_EVENT.CODES_ISSUED:
      return {
        stage: { kind: CREDENTIALS_STAGE.SHOWING_CODES, codes: event.codes },
        pendingSection: null,
        notice: event.notice,
      };

    case CREDENTIALS_EVENT.DISMISSED:
      // Both the codes and an abandoned enrolment leave by this one event, and the notice goes
      // with them: a reader who has put their codes away should not be left with the sentence
      // that introduced them.
      return { stage: idle, pendingSection: null, notice: null };
  }
}
