import { derivationInputField, type FieldValue } from '@easyesg/validation';
import type { EvaluationScope } from '../interfaces/evaluation-scopes.interface';

/**
 * **The report's scope and answers, with the derivation inputs as fields** (task 254; FR-29, FR-40; `architecture.md`
 * §12.5.6's task-254 row (1)) — each input keyed `input:<key>` and placed in the modules of the figure it feeds, so the
 * roll-up counts it there and S-08 lists a finding on it there, as it would a disclosure field's.
 *
 * **What makes a computed figure need no rule of its own**: the platform writes the figure, so a finding on it asks the
 * reporter for something they cannot type, and nothing at all once an input is unknown. The rule sits on the input,
 * where an answer is possible.
 *
 * The run, the read and the browser's rules each widen the scope by this one function — beside the entity's fields —
 * so a finding the run raised is never dropped by a read for having left a scope it was never in (182/26).
 */
export function withDerivationInputs(evaluation: EvaluationScope): EvaluationScope {
  if (evaluation.inputs.length === 0) return evaluation;
  return {
    ...evaluation,
    scope: new Map([
      ...evaluation.scope,
      ...evaluation.inputs.map((input) => [derivationInputField(input.key), input.modules] as const),
    ]),
    values: [...evaluation.values, ...derivationInputValues(evaluation.inputs)],
  };
}

/**
 * **What the reporter stored for each input, as rows the interpreter reads** — at the field's only address, a yes or a
 * no as the `1` or `0` it is stored as. None where nothing is stored: an unanswered input is a missing row, as an
 * unanswered disclosure is, and a published offer is not an answer.
 */
function derivationInputValues(inputs: EvaluationScope['inputs']): readonly FieldValue[] {
  return inputs.flatMap((input) =>
    input.value === null
      ? []
      : [{ elementKey: derivationInputField(input.key), dimensionKey: '', ordinal: 0, valueNumeric: input.value }],
  );
}
