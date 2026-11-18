/**
 * A slot's payload as A-05 edits it (task 67.8): the artefact's JSON, written as text and read back before it is sent.
 * **Only the text's shape is judged here** — that it is a JSON object; whether its rules and factors are readable is the
 * family's reader's to say at publication (182/50, 182/51), and the console shows the api's refusal.
 */
export const DRAFT_FAULT = {
  /** The text is not JSON at all. */
  UNPARSABLE: 'unparsable',
  /** It is JSON, but not an object — an array, a number. */
  NOT_AN_OBJECT: 'not-an-object',
} as const;

export type DraftFault = (typeof DRAFT_FAULT)[keyof typeof DRAFT_FAULT];

export function readDraft(
  text: string,
): { readonly payload: Record<string, unknown> } | { readonly fault: DraftFault } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { fault: DRAFT_FAULT.UNPARSABLE };
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { payload: parsed as Record<string, unknown> }
    : { fault: DRAFT_FAULT.NOT_AN_OBJECT };
}

/** The payload as the editor opens it: indented, so a threshold or a factor is one line to change. */
export const draftOf = (payload: Record<string, unknown>): string => JSON.stringify(payload, null, 2);
