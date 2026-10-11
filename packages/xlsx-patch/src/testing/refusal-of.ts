import { XlsxPatchRefusedError } from '../patch-refusal.js';

/**
 * The refusal a call raised, `null` when it raised none, or a sentence naming any other error — so a spec asserting
 * one refusal fails visibly on a crash rather than passing on it, and fails on a call that did not refuse at all.
 */
export function refusalOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof XlsxPatchRefusedError ? error.refusal : `not a refusal: ${String(error)}`;
  }
}
