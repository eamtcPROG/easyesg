import 'server-only';
import type { Validation, ValidationRules } from '@easyesg/contracts';
import { RULE_SET_READ, readRuleSet, type RuleSet } from '@easyesg/validation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * The validation reads (tasks 42.1, 42.2; FR-40 … FR-43; `architecture.md` §12.5.6's task-42 row (1)) — S-09's last
 * run, and the rules S-07's step read carries, admitted (task 244).
 *
 * **Each degrades to `null`, and the step still renders.** Validation is an aid to answering, never a precondition
 * of it (182/27: nothing is gated by findings) — a step that refused to draw because the last run could not be read
 * would make a report unanswerable over a check about it. What the screen says about a `null` is the panel's.
 */

/** What the last run found and came to, as it left it (182/26) — or `null` where the read failed. */
export async function readValidation(reportId: string): Promise<Validation | null> {
  const read = await api.get<Validation>(`/reports/${reportId}/validation`);
  return read.status === API_OUTCOME.Ok ? read.value : null;
}

/** The rules the browser evaluates inline, admitted by the interpreter's own reader, and the report's scope. */
export interface InlineRules {
  readonly ruleSet: RuleSet;
  readonly scope: readonly string[];
}

/**
 * The rules a run would read now (task 42.1), as S-07's step read carries them since task 244 — or `null` where the api
 * could read none, or where what it answered is not a rule set the interpreter can hold: **admitted by `readRuleSet`,
 * never cast** (`api-client.ts`'s *a body is validated*), the one reader every rule set is read by, so the browser
 * cannot evaluate a set the api's own reader would refuse. With `null` the step shows the last run's findings alone.
 */
export function admittedRules(rules: ValidationRules | null): InlineRules | null {
  if (rules === null) return null;
  const admitted = readRuleSet(rules.ruleSet);
  return admitted.outcome === RULE_SET_READ.READ ? { ruleSet: admitted.ruleSet, scope: rules.scope } : null;
}
