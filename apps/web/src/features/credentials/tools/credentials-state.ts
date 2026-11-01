import type { SocialProvider } from '@easyesg/contracts';
import type { Notice } from '@/lib/notice';

/**
 * S-28's interaction state, as one value and the events that move it (task 27.7; since task 169, which row is open).
 *
 * **The screen rests as a summary row per credential and opens one at a time** (`design_spec.md` OQ-19, closed
 * 24 Sep 2026). What is open is the `stage`: the password's change, one of the second factor's four steps, or one
 * provider's unlink or link confirmation. Held as one discriminated value, *two rows open at once* is unrepresentable
 * — which is what lets each opened row ask for the current password itself without the screen ever asking twice, the
 * defect the record-level field it replaced was built to fix.
 *
 * **Pure, and in its own module**, so every transition is a unit spec — including the ones a browser journey reaches
 * only by contriving the timing, like a row opened while another's action is still running.
 */

/**
 * The record's three regions, as the closed vocabulary they always were (28 Aug 2026). An action names the region
 * it runs in, so only that region's controls go inert.
 */
export const CREDENTIALS_SECTION = {
  PASSWORD: 'password',
  FACTOR: 'factor',
  PROVIDERS: 'providers',
} as const;

export type CredentialsSection = (typeof CREDENTIALS_SECTION)[keyof typeof CREDENTIALS_SECTION];

/** What this screen says after an action settled — `@/lib/notice`'s, re-exported (28 Aug 2026). */
export type { Notice };

/**
 * Which flow issued the codes on screen — turning the factor on, or replacing spent codes. The codes look identical
 * either way (UC-193); what differs is the step sequence around them, three steps against two.
 */
export const CODES_ORIGIN = {
  ENROLMENT: 'enrolment',
  REISSUE: 'reissue',
} as const;

export type CodesOrigin = (typeof CODES_ORIGIN)[keyof typeof CODES_ORIGIN];

/** Which row is open, and at which step. Exclusive by construction. */
export const CREDENTIALS_STAGE = {
  /** Every row at rest. */
  IDLE: 'idle',
  /** The password row, open to its change form. */
  CHANGING_PASSWORD: 'changing_password',
  /** The second factor's row, asking for the current password before a secret is issued. */
  BEGINNING_ENROLMENT: 'beginning_enrolment',
  /**
   * The secret is on screen and awaiting its first code. It is the only copy that will ever exist, which is why
   * abandoning it is a designed exit rather than a dismissal.
   */
  ENROLLING: 'enrolling',
  /** The second factor's row, asking for the current password before turning it off. */
  DISABLING_FACTOR: 'disabling_factor',
  /** The second factor's row, asking for the current password before new codes replace the old. */
  REISSUING_CODES: 'reissuing_codes',
  /** Codes issued, shown exactly once (UC-193). The reader must acknowledge before they go. */
  SHOWING_CODES: 'showing_codes',
  /** One linked provider's row, asking for the current password before it is unlinked. */
  UNLINKING: 'unlinking',
  /** A provider round trip has returned and the link awaits the current password (§12.5.6's task-27.7 row). */
  CONFIRMING_LINK: 'confirming_link',
} as const;

export type CredentialsStage = (typeof CREDENTIALS_STAGE)[keyof typeof CREDENTIALS_STAGE];

export type CredentialsStageValue =
  | { readonly kind: typeof CREDENTIALS_STAGE.IDLE }
  | { readonly kind: typeof CREDENTIALS_STAGE.CHANGING_PASSWORD }
  | { readonly kind: typeof CREDENTIALS_STAGE.BEGINNING_ENROLMENT }
  | {
      readonly kind: typeof CREDENTIALS_STAGE.ENROLLING;
      readonly secret: string;
      readonly enrolmentUri: string;
    }
  | { readonly kind: typeof CREDENTIALS_STAGE.DISABLING_FACTOR }
  | { readonly kind: typeof CREDENTIALS_STAGE.REISSUING_CODES }
  | {
      readonly kind: typeof CREDENTIALS_STAGE.SHOWING_CODES;
      readonly codes: readonly string[];
      readonly origin: CodesOrigin;
    }
  /** `SocialProvider`, not `string`: the screen never holds a provider it cannot name (27 Aug 2026). */
  | { readonly kind: typeof CREDENTIALS_STAGE.UNLINKING; readonly provider: SocialProvider }
  | { readonly kind: typeof CREDENTIALS_STAGE.CONFIRMING_LINK; readonly provider: SocialProvider };

/**
 * A stage a trigger opens. The other three are reached only by an answer — a secret offered, codes issued — or by
 * returning from a provider, so no trigger can name them.
 */
export type OpenableStage = Extract<
  CredentialsStageValue,
  {
    readonly kind:
      | typeof CREDENTIALS_STAGE.CHANGING_PASSWORD
      | typeof CREDENTIALS_STAGE.BEGINNING_ENROLMENT
      | typeof CREDENTIALS_STAGE.DISABLING_FACTOR
      | typeof CREDENTIALS_STAGE.REISSUING_CODES
      | typeof CREDENTIALS_STAGE.UNLINKING;
  }
>;

export interface CredentialsState {
  readonly stage: CredentialsStageValue;
  /** Which region is acting, so only its own controls go inert (S-16's per-row lesson). */
  readonly pendingSection: CredentialsSection | null;
  readonly notice: Notice | null;
}

export const CREDENTIALS_EVENT = {
  OPENED: 'opened',
  ACTION_STARTED: 'action_started',
  ACTION_FAILED: 'action_failed',
  ACTION_SUCCEEDED: 'action_succeeded',
  ENROLMENT_OFFERED: 'enrolment_offered',
  CODES_ISSUED: 'codes_issued',
  DISMISSED: 'dismissed',
} as const;

export type CredentialsEventKind = (typeof CREDENTIALS_EVENT)[keyof typeof CREDENTIALS_EVENT];

export type CredentialsEvent =
  | { readonly type: typeof CREDENTIALS_EVENT.OPENED; readonly stage: OpenableStage }
  | { readonly type: typeof CREDENTIALS_EVENT.ACTION_STARTED; readonly section: CredentialsSection }
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
      readonly origin: CodesOrigin;
      readonly notice: Notice;
    }
  | { readonly type: typeof CREDENTIALS_EVENT.DISMISSED };

const idle = { kind: CREDENTIALS_STAGE.IDLE } as const;

export const initialCredentialsState = (pendingLinkProvider?: SocialProvider | null): CredentialsState => ({
  // The screen can be *born* with a row open: returning from a provider lands here with a link awaiting its password,
  // which is a state the reader did not click into on this page load.
  stage: pendingLinkProvider ? { kind: CREDENTIALS_STAGE.CONFIRMING_LINK, provider: pendingLinkProvider } : idle,
  pendingSection: null,
  notice: null,
});

/**
 * The region a stage opens, or null at rest — what decides which row draws itself open, and where a refusal is shown:
 * inside the open row, beside the form it refused, rather than at the head of the record.
 */
export function stageSection(stage: CredentialsStageValue): CredentialsSection | null {
  switch (stage.kind) {
    case CREDENTIALS_STAGE.IDLE:
      return null;
    case CREDENTIALS_STAGE.CHANGING_PASSWORD:
      return CREDENTIALS_SECTION.PASSWORD;
    case CREDENTIALS_STAGE.BEGINNING_ENROLMENT:
    case CREDENTIALS_STAGE.ENROLLING:
    case CREDENTIALS_STAGE.DISABLING_FACTOR:
    case CREDENTIALS_STAGE.REISSUING_CODES:
    case CREDENTIALS_STAGE.SHOWING_CODES:
      return CREDENTIALS_SECTION.FACTOR;
    case CREDENTIALS_STAGE.UNLINKING:
    case CREDENTIALS_STAGE.CONFIRMING_LINK:
      return CREDENTIALS_SECTION.PROVIDERS;
  }
}

export function credentialsReducer(state: CredentialsState, event: CredentialsEvent): CredentialsState {
  switch (event.type) {
    case CREDENTIALS_EVENT.OPENED:
      // Two things may not be left behind by opening another row. **An action still running** — its answer would
      // land in a row that is no longer the open one. **Codes on screen** — they are shown once, and a trigger pressed
      // elsewhere would destroy the only copy. Everything else is replaced: an abandoned enrolment costs one password
      // to begin again and no risk. The notice goes with the row it described.
      if (state.pendingSection !== null || state.stage.kind === CREDENTIALS_STAGE.SHOWING_CODES) return state;
      return { stage: event.stage, pendingSection: null, notice: null };

    case CREDENTIALS_EVENT.ACTION_STARTED:
      // The previous notice goes with the new action: a stale "your password was changed" above an unlink that is still
      // running reads as though the two are the same event.
      return { ...state, pendingSection: event.section, notice: null };

    case CREDENTIALS_EVENT.ACTION_FAILED:
      // The row stays open, deliberately: the refusal is read beside the form it refused, and a wrong code on the
      // enrolment step must leave the secret on screen to retype against.
      return { ...state, pendingSection: null, notice: event.notice };

    case CREDENTIALS_EVENT.ACTION_SUCCEEDED:
      return { stage: idle, pendingSection: null, notice: event.notice };

    case CREDENTIALS_EVENT.ENROLMENT_OFFERED:
      return {
        stage: { kind: CREDENTIALS_STAGE.ENROLLING, secret: event.secret, enrolmentUri: event.enrolmentUri },
        pendingSection: null,
        notice: null,
      };

    case CREDENTIALS_EVENT.CODES_ISSUED:
      return {
        stage: { kind: CREDENTIALS_STAGE.SHOWING_CODES, codes: event.codes, origin: event.origin },
        pendingSection: null,
        notice: event.notice,
      };

    case CREDENTIALS_EVENT.DISMISSED:
      // A row closes by this one event — a cancel, the trigger pressed again, the codes put away — and never while its
      // action runs, whose answer would then have no row to land in.
      if (state.pendingSection !== null) return state;
      return { stage: idle, pendingSection: null, notice: null };
  }
}
