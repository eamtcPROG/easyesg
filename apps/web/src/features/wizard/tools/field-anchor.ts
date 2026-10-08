import type { FieldAddress } from '@easyesg/validation';
import { reportStepRoute } from '@/lib/routes';
import { writeKey } from './autosave-state';

/**
 * **A field's anchor: the id its visible label carries** (task 42.3; FR-42 item 2, UX-4) — the field's natural key, the
 * queue's own `writeKey`, made safe for an id. `StepField` gives the label this id and names its group by it, and a
 * finding's address ends in it, so the two are one function and cannot drift apart. Element and member keys are XBRL
 * names; anything an id may not carry becomes a hyphen.
 */
export const fieldAnchor = (key: string): string => `disclosure-${key.replace(/[^A-Za-z0-9_-]/gu, '-')}`;

/**
 * **A finding's address: its step's, with the field's anchor** (`architecture.md` §12.5.6's task-42 row (g)). Opened,
 * shared or reached from S-08, it lands on the step, and the step moves focus into the field (`FieldFocus`) — an address,
 * not a scroll handler, so it survives a reload and goes back with the browser.
 */
export const fieldHref = (input: {
  readonly reportId: string;
  /** The step that presents the field. */
  readonly module: string;
  readonly field: FieldAddress;
}): string => `${reportStepRoute({ reportId: input.reportId, module: input.module })}#${fieldAnchor(writeKey(input.field))}`;
