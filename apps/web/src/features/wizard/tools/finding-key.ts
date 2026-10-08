import type { FieldAddress } from '@easyesg/validation';
import { writeKey } from './autosave-state';

/**
 * **What tells one finding from another: its rule and its field** (task 42.2) — a run states at most one finding per
 * rule and field (task 40.2), so the pair is the finding's identity across the last run and the live verdicts. The
 * field's part is `writeKey`, the queue's own function, so *the same field* means one thing here and there.
 */
export const findingKey = (finding: { readonly rule: string; readonly field: FieldAddress }): string =>
  `${finding.rule}\u0000${writeKey(finding.field)}`;
