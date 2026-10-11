import { EXPORT_FORMAT, type ApiFailure, type Export, type ExportFormat, type ValidationFinding } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';

/**
 * S-11's dialogue as one state (task 47.3; UX-46, UX-47; FR-44) — its two decisions and where the request stands. A
 * reducer rather than several `useState`s because one event moves several of them at once: a refusal both ends the
 * submission and puts the findings on screen, and an acknowledged retry must keep those findings in view while it runs
 * (`apps/web/CLAUDE.md`'s *values that change together*).
 *
 * **The phases are a discriminated union**, so the impossible pairs — a queued export beside a refusal, a submission
 * with a failure still showing — cannot be written.
 */
export const DIALOGUE_PHASE = {
  /** The two decisions open, with what the last attempt failed for, if it did. */
  CHOOSING: 'choosing',
  /** A request in flight; the findings it acknowledges, where it is the retry that acknowledges them. */
  SUBMITTING: 'submitting',
  /** The api refused for the report's unresolved findings (FR-44): the warning, listing them, and its acknowledgement. */
  UNRESOLVED: 'unresolved',
  /** Queued: its job is running, and the dialogue watches it (UX-46). */
  QUEUED: 'queued',
} as const;

export type DialoguePhase =
  | { readonly kind: typeof DIALOGUE_PHASE.CHOOSING; readonly failure: ApiFailure | null }
  | { readonly kind: typeof DIALOGUE_PHASE.SUBMITTING; readonly findings: readonly ValidationFinding[] | null }
  | {
      readonly kind: typeof DIALOGUE_PHASE.UNRESOLVED;
      readonly findings: readonly ValidationFinding[];
      readonly failure: ApiFailure | null;
    }
  | { readonly kind: typeof DIALOGUE_PHASE.QUEUED; readonly export: Export };

export interface DialogueState {
  readonly format: ExportFormat;
  readonly language: Locale;
  readonly phase: DialoguePhase;
}

/** Named for what happened, never for the field it writes. */
export const DIALOGUE_EVENT = {
  FORMAT_CHOSEN: 'format_chosen',
  LANGUAGE_CHOSEN: 'language_chosen',
  SUBMITTED: 'submitted',
  REFUSED_FOR_FINDINGS: 'refused_for_findings',
  FAILED: 'failed',
  QUEUED: 'queued',
  RESTARTED: 'restarted',
} as const;

export type DialogueEvent =
  | { readonly type: typeof DIALOGUE_EVENT.FORMAT_CHOSEN; readonly format: ExportFormat }
  | { readonly type: typeof DIALOGUE_EVENT.LANGUAGE_CHOSEN; readonly language: Locale }
  | { readonly type: typeof DIALOGUE_EVENT.SUBMITTED }
  | { readonly type: typeof DIALOGUE_EVENT.REFUSED_FOR_FINDINGS; readonly findings: readonly ValidationFinding[] }
  | { readonly type: typeof DIALOGUE_EVENT.FAILED; readonly failure: ApiFailure }
  | { readonly type: typeof DIALOGUE_EVENT.QUEUED; readonly export: Export }
  | { readonly type: typeof DIALOGUE_EVENT.RESTARTED };

/** The PDF first, as the artboard offers it: the file for a bank or a customer to read. */
export const initialDialogueState = (language: Locale): DialogueState => ({
  format: EXPORT_FORMAT.PDF,
  language,
  phase: { kind: DIALOGUE_PHASE.CHOOSING, failure: null },
});

/** Whether the request the dialogue sends next acknowledges the findings — only once the warning has listed them. */
export const acknowledgesFindings = (phase: DialoguePhase): boolean => phase.kind === DIALOGUE_PHASE.UNRESOLVED;

/** A decision is open only while nothing is in flight or queued. */
const choosable = (phase: DialoguePhase): boolean =>
  phase.kind === DIALOGUE_PHASE.CHOOSING || phase.kind === DIALOGUE_PHASE.UNRESOLVED;

export function dialogueReducer(state: DialogueState, event: DialogueEvent): DialogueState {
  switch (event.type) {
    case DIALOGUE_EVENT.FORMAT_CHOSEN:
      return choosable(state.phase) ? { ...state, format: event.format } : state;
    case DIALOGUE_EVENT.LANGUAGE_CHOSEN:
      return choosable(state.phase) ? { ...state, language: event.language } : state;
    case DIALOGUE_EVENT.SUBMITTED:
      return {
        ...state,
        phase: {
          kind: DIALOGUE_PHASE.SUBMITTING,
          // The findings stay in view while the acknowledging retry runs; a first request has none yet.
          findings: state.phase.kind === DIALOGUE_PHASE.UNRESOLVED ? state.phase.findings : null,
        },
      };
    case DIALOGUE_EVENT.REFUSED_FOR_FINDINGS:
      return { ...state, phase: { kind: DIALOGUE_PHASE.UNRESOLVED, findings: event.findings, failure: null } };
    case DIALOGUE_EVENT.FAILED:
      // A retry that failed goes back to the warning it acknowledged, with why; a first request, back to the choice.
      return {
        ...state,
        phase:
          state.phase.kind === DIALOGUE_PHASE.SUBMITTING && state.phase.findings !== null
            ? { kind: DIALOGUE_PHASE.UNRESOLVED, findings: state.phase.findings, failure: event.failure }
            : { kind: DIALOGUE_PHASE.CHOOSING, failure: event.failure },
      };
    case DIALOGUE_EVENT.QUEUED:
      return { ...state, phase: { kind: DIALOGUE_PHASE.QUEUED, export: event.export } };
    case DIALOGUE_EVENT.RESTARTED:
      return { ...state, phase: { kind: DIALOGUE_PHASE.CHOOSING, failure: null } };
  }
}
