import { type FieldRead, NOT_AN_OBJECT, isRecord, readOrder, readText, readTexts } from './content-payload';
import { type Localized, readLocalized } from './localized';

/**
 * A plan's presentation copy (task 76; FR-61, FR-204; `architecture.md` §12.5.6's task-76 row (2)) — what S-29's
 * pricing section says of a plan (task 222). **Never a price**: that is `billing`'s, versioned on purpose (182/118), so
 * no field here could hold one. Keyed by the plan's code, which 53.1's `billing.plan` reuses.
 */
export interface PlanCopyText {
  readonly name: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  /** A word set beside the name — *Most companies* — or `null`. */
  readonly badge: string | null;
}

export interface PlanCopy {
  readonly order: number;
  readonly text: Localized<PlanCopyText>;
}

const readPlanText = (block: unknown): FieldRead<PlanCopyText> => {
  if (!isRecord(block)) return { fault: NOT_AN_OBJECT };
  const name = readText(block.name);
  if ('fault' in name) return { fault: `its name ${name.fault}` };
  const summary = readText(block.summary);
  if ('fault' in summary) return { fault: `its summary ${summary.fault}` };
  const highlights = readTexts(block.highlights);
  if ('fault' in highlights) return { fault: `its highlights: ${highlights.fault}` };
  if (block.badge === undefined || block.badge === null) {
    return { value: { name: name.value, summary: summary.value, highlights: highlights.value, badge: null } };
  }
  const badge = readText(block.badge);
  if ('fault' in badge) return { fault: `its badge ${badge.fault}` };
  return { value: { name: name.value, summary: summary.value, highlights: highlights.value, badge: badge.value } };
};

const readCopy = (payload: unknown): FieldRead<PlanCopy> => {
  if (!isRecord(payload)) return { fault: NOT_AN_OBJECT };
  const order = readOrder(payload.order);
  if ('fault' in order) return { fault: `its order ${order.fault}` };
  const text = readLocalized({ value: payload.locales, readBlock: readPlanText });
  if ('fault' in text) return { fault: text.fault };
  return { value: { order: order.value, text: text.value } };
};

/** A payload read as plan copy, or `null` — read whole or not at all. */
export const readPlanCopy = (payload: unknown): PlanCopy | null => {
  const read = readCopy(payload);
  return 'value' in read ? read.value : null;
};

/** Why the store refuses a payload of this kind, or `null` (`configuration-kind-rules.ts`). */
export const planCopyRefusal = (payload: unknown): string | null => {
  const read = readCopy(payload);
  return 'fault' in read ? `plan copy the reader would not read: ${read.fault}` : null;
};
