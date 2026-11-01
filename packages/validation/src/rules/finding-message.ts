/**
 * **A finding's message is three parts by construction** (task 42; NFR-79; `architecture.md` §12.5.6's task-42 row (2))
 * — *what happened*, *so what*, *what now* — each its own leaf under the key a rule names, so the shape NFR-79 asks of
 * every message is something a catalogue either has or does not, rather than something a reviewer reads for.
 *
 * **Here, beside `Finding`, because readers on both sides of the wire share it and none owns the others**: the api's
 * publication rule refuses a rule set whose message is not worded so in every locale (182/51's check, reshaped), the
 * browser renders the parts in this order, and the conformance test holds every committed message to it. A rule's `message` names the node,
 * never a part — `validation.required`, not `validation.required.happened`.
 */
export const FINDING_MESSAGE_PART = {
  /** What happened — the fact about this field. */
  HAPPENED: 'happened',
  /** So what — what follows for the report if it stays. */
  CONSEQUENCE: 'consequence',
  /** What now — the act that resolves it. */
  ACTION: 'action',
} as const;

export type FindingMessagePart = (typeof FINDING_MESSAGE_PART)[keyof typeof FINDING_MESSAGE_PART];

/** The three, in the order a reader reads them. */
export const FINDING_MESSAGE_PARTS: readonly FindingMessagePart[] = [
  FINDING_MESSAGE_PART.HAPPENED,
  FINDING_MESSAGE_PART.CONSEQUENCE,
  FINDING_MESSAGE_PART.ACTION,
];

/** The catalogue key of one part of a message — `validation.required` and `action` make `validation.required.action`. */
export const findingMessagePartKey = (input: {
  readonly message: string;
  readonly part: FindingMessagePart;
}): string => `${input.message}.${input.part}`;

/**
 * Does a catalogue — given as the set of its leaf keys — word `message` as a finding: **exactly the three parts and
 * nothing else beneath it**? A leaf at `message` itself is not a finding's message (it holds one sentence where three
 * are owed), and a fourth leaf beneath it is a part no reader renders.
 */
export function wordsFindingMessage(input: { readonly leaves: ReadonlySet<string>; readonly message: string }): boolean {
  const prefix = `${input.message}.`;
  const beneath = [...input.leaves].filter((leaf) => leaf.startsWith(prefix));
  return (
    beneath.length === FINDING_MESSAGE_PARTS.length &&
    FINDING_MESSAGE_PARTS.every((part) => input.leaves.has(findingMessagePartKey({ message: input.message, part })))
  );
}
