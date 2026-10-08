import type { FieldValue } from '@easyesg/validation';

/**
 * What a report's validation evaluates over (task 41.2): its stored answers, and the elements in its scope with the
 * modules each counts in — applicability (FR-28), omissions whole and by section (FR-31, task-41 row (4)) and the
 * report's own scope (FR-177) all applied. **`core/disclosure` computes it**, since every one of those is that module's
 * (`WizardService.evaluationScope`), so a run and the wizard cannot read a report's shape two ways.
 */
export interface EvaluationScope {
  readonly values: readonly FieldValue[];
  readonly scope: ReadonlyMap<string, readonly string[]>;
  /** The modules its roll-up lists, in the standard's order — waiting ones included (FR-41 item 2). */
  readonly modules: readonly string[];
}

export interface EvaluationScopes {
  evaluationScope(query: { readonly reportId: string }): Promise<EvaluationScope>;
}

export const EVALUATION_SCOPES = Symbol('EVALUATION_SCOPES');
