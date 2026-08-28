import { CALLOUT_INTENT, type CalloutIntent } from '@easyesg/ui';
import { API_OUTCOME, type ApiOutcome } from './api-outcome';

/**
 * What a screen says once one of its own actions settled — NFR-79's three parts, built in one
 * place (28 Aug 2026).
 *
 * **The rule existed twice.** S-16's `access-context.tsx` and S-28's `credentials-board.tsx` each
 * carried the same block: title from `problem.title` or a fallback, body from `problem.detail` or
 * the same fallback, each re-testing `status === Problem` a second time. Two copies of one rule,
 * and they had already drifted — S-28 put *"Încercați din nou."* under a refusal whose `detail`
 * ends with that very sentence, which on a throttle refusal read as "try again" beneath "wait a
 * few minutes".
 *
 * Pure, and copy-free: every string arrives already translated. That is what lets it sit in `lib/`
 * rather than in either feature, and what lets both reducers hold the result without either
 * owning the rule.
 */
export interface Notice {
  readonly intent: CalloutIntent;
  /** What happened. */
  readonly title: string;
  /** So what — the consequence. */
  readonly body: string;
  /**
   * What now — and **`null` where the next step is already inside `body`**, which is the ordinary
   * case for a refusal: NFR-79 has the API compose all three parts into `detail`, so a catalogue
   * sentence beside it duplicates at best and contradicts at worst. `Callout`'s own docblock
   * records the five screens that got this wrong.
   */
  readonly action: string | null;
}

/**
 * Copy for one side of an outcome.
 *
 * An object rather than two parameters: `title` and `body` are adjacent `string`s, and every
 * caller here has a second pair to confuse them with — `enabledTitle`/`enabledBody` beside
 * `codesTitle`/`codesBody`. Swapped, they compile and render a plausible wrong answer.
 */
export interface NoticeCopy {
  readonly title: string;
  readonly body: string;
}

/** The success side: what happened, and what — if anything — is left to do. */
export function successNotice(input: {
  readonly copy: NoticeCopy;
  /**
   * Honestly *"nothing"* on most screens, and saying so is not the same as omitting it
   * (`access-state.ts` argued this first); `null` where the body already carries it.
   */
  readonly action?: string | null;
}): Notice {
  return { intent: CALLOUT_INTENT.SUCCESS, ...input.copy, action: input.action ?? null };
}

/**
 * The refusal side: **the API's own three-part text, as received.**
 *
 * Falls back per MEMBER rather than per document — RFC 9457 makes every member optional, so a
 * problem carrying a detail and no title must keep that detail. Dropping it would replace "that is
 * not your current password" with the generic outage sentence.
 */
export function failureNotice(input: {
  readonly outcome: ApiOutcome<unknown>;
  /** Used when no answer arrived, and for whichever members a problem document omits. */
  readonly unreachable: NoticeCopy;
  /**
   * Pass one **only** where this screen owns a step the API's `detail` cannot state — in practice
   * one that navigates. Defaults to `null`, which is the answer for every server-composed refusal.
   */
  readonly action?: string | null;
}): Notice {
  const { outcome, unreachable } = input;
  const problem = outcome.status === API_OUTCOME.Problem ? outcome.problem : null;
  return {
    intent: CALLOUT_INTENT.ERROR,
    title: problem?.title ?? unreachable.title,
    body: problem?.detail ?? unreachable.body,
    action: input.action ?? null,
  };
}

/**
 * Both sides at once, for a screen that reports an outcome in **one** dispatch (S-16).
 *
 * S-28 does not use this: its success and its refusal are different events — one can change the
 * stage, the other must deliberately leave it standing — so it reaches for the two halves
 * directly. Composed from them rather than repeating either, which is the whole point of the file.
 */
export function noticeFromOutcome(input: {
  readonly outcome: ApiOutcome<unknown>;
  readonly success: NoticeCopy;
  readonly unreachable: NoticeCopy;
  readonly successAction?: string | null;
  readonly failureAction?: string | null;
}): Notice {
  return input.outcome.status === API_OUTCOME.Ok
    ? successNotice({ copy: input.success, action: input.successAction })
    : failureNotice({
        outcome: input.outcome,
        unreachable: input.unreachable,
        action: input.failureAction,
      });
}
