import { VERDICT_SEVERITY, type Finding } from '@easyesg/validation';
import { writeKey } from './autosave-state';

/**
 * **The findings each field carries, by the key the queue addresses it with, most severe first** (task 42.1;
 * BR-VAL-1) — §6.4's order (`VERDICT_SEVERITY`, the interpreter's own), so the first is the field's one state and the
 * rest are read after it. `writeKey` is the queue's function, so a finding lands on the field the reporter typed into
 * and on no neighbour of it.
 */
export function findingsByField(findings: readonly Finding[]): ReadonlyMap<string, readonly Finding[]> {
  const byField = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = writeKey(finding.field);
    byField.set(key, [...(byField.get(key) ?? []), finding]);
  }
  for (const [key, held] of byField) {
    byField.set(
      key,
      held.toSorted((left, right) => VERDICT_SEVERITY.indexOf(left.verdict) - VERDICT_SEVERITY.indexOf(right.verdict)),
    );
  }
  return byField;
}
