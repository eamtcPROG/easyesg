import 'server-only';
import type { Validation, ValidationRules } from '@easyesg/contracts';
import { RULE_SET_READ, readRuleSet, type RuleSet } from '@easyesg/validation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * S-07's two validation reads (tasks 42.1, 42.2; FR-40 … FR-43; `architecture.md` §12.5.6's task-42 row (1)).
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
 * The rules a run would read now (task 42.1) — or `null` where the read failed, or where what it answered is not a rule
 * set the interpreter can hold: **admitted by `readRuleSet`, never cast** (`api-client.ts`'s *a body is validated*), the
 * one reader every rule set is read by, so the browser cannot evaluate a set the api's own reader would refuse. With
 * `null` the step shows the last run's findings alone.
 */
export async function readInlineRules(reportId: string): Promise<InlineRules | null> {
  const read = await api.get<ValidationRules>(`/reports/${reportId}/validation/rules`);
  if (read.status !== API_OUTCOME.Ok) return null;
  const admitted = readRuleSet(read.value.ruleSet);
  return admitted.outcome === RULE_SET_READ.READ ? { ruleSet: admitted.ruleSet, scope: read.value.scope } : null;
}
