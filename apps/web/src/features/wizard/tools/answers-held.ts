import type { DisclosureField } from '@easyesg/contracts';
import type { FieldValue } from '@easyesg/validation';
import { isDerivationInputWrite, isQueuedLine, writeKey, type AutosaveState } from './autosave-state';
import { askedFields } from './step-applicability';
import { outstandingDefaults } from './values';

/**
 * **The step's answers as the wizard holds them now** — what the browser's interpreter evaluates (task 42.1; FR-40
 * item 5, OQ-49; `architecture.md` §12.5.6's task-42 row (1)).
 *
 * Three layers, each newer than the one under it and each keyed by `writeKey` — the function the queue addresses a field
 * with, so *the same field* cannot mean two things here and there: what the step read served, then what the api has
 * acknowledged since (`committed`), then what is unacknowledged (`pending`), sent or not. So a verdict follows an answer
 * the moment it leaves its field — UX-34's commit on blur — whether or not the network has caught up, which is what
 * *inline at the point of entry* asks of an offline reporter too (FR-38).
 *
 * **Only this step's elements.** The queue belongs to the report and may hold an answer typed on another step while
 * offline; the browser evaluates over the elements the step presents (row (1)), and an answer outside them would read
 * as a field the step does not have. A row the reporter added — a second site — is in the queue and not in the served
 * fields, and is kept for being the step's element.
 *
 * The other two shapes the queue carries are not answers: a derivation input feeds a derived figure the step read
 * serves already (task 36.10), and S-09's lines are the calculator's (task 39.1).
 */
export function answersHeld(input: {
  /** What the step read served, already projected to the answer columns (`servedAnswers`). */
  readonly served: readonly FieldValue[];
  readonly state: Pick<AutosaveState, 'committed' | 'pending'>;
}): readonly FieldValue[] {
  const elements = new Set(input.served.map((answer) => answer.elementKey));
  const held = new Map<string, FieldValue>(input.served.map((answer) => [writeKey(answer), answer]));
  for (const [key, committed] of Object.entries(input.state.committed)) {
    if (elements.has(committed.elementKey)) held.set(key, answerOf(committed));
  }
  for (const [key, pending] of Object.entries(input.state.pending)) {
    const write = pending.write;
    if (isQueuedLine(write) || isDerivationInputWrite(write)) continue;
    if (elements.has(write.elementKey)) held.set(key, answerOf(write));
  }
  return [...held.values()];
}

/**
 * **The step's served fields as the interpreter reads them** — the answer columns and nothing else. The section projects
 * them once, on the server, so what crosses into the browser for the verdicts is the answers rather than a second copy
 * of every field the step already hands its fields, options lists included (`server-dedup-props`).
 *
 * **A default the step is about to commit counts as the answer it is** (task 42.2, found by S-08's journey). An editable
 * step commits every outstanding default on arrival (`outstandingDefaults` over the asked fields, `step-fields.tsx`),
 * and the field already shows it — so until that commit landed, a field displaying *Option A* was verdicted *missing*,
 * in the server's HTML as well, and cleared a moment later. The same rule the commit applies decides it here, so the
 * two cannot disagree; a read-only step commits nothing, and its defaults are not answers.
 */
export function servedAnswers(input: {
  readonly fields: readonly DisclosureField[];
  /** Whether the step is read-only — then nothing is committed on arrival (UX-13). */
  readonly readOnly: boolean;
}): readonly FieldValue[] {
  const served = new Map(input.fields.map((field) => [writeKey(field), answerOf(field)]));
  if (!input.readOnly) {
    for (const write of outstandingDefaults(askedFields(input.fields))) served.set(writeKey(write), answerOf(write));
  }
  return [...served.values()];
}

/**
 * The columns the three layers share — the store's own shape (§7.3), nullable where the api answers and optional where
 * a write omits — so the interpreter's row is read off any of them and nothing is mapped.
 */
interface AnswerRow {
  readonly elementKey: string;
  readonly dimensionKey?: string;
  readonly ordinal?: number;
  readonly valueNumeric?: string | null;
  readonly valueText?: string | null;
  readonly valueBoolean?: boolean | null;
  readonly valueDate?: string | null;
  readonly unitCode?: string | null;
  readonly state: string;
}

function answerOf(row: AnswerRow): FieldValue {
  return {
    elementKey: row.elementKey,
    dimensionKey: row.dimensionKey ?? '',
    ordinal: row.ordinal ?? 0,
    valueNumeric: row.valueNumeric ?? null,
    valueText: row.valueText ?? null,
    valueBoolean: row.valueBoolean ?? null,
    valueDate: row.valueDate ?? null,
    unitCode: row.unitCode ?? null,
    state: row.state,
  };
}
