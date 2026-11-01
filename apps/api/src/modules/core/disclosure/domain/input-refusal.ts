import type { DomainError } from '@api/app/filters/domain.error';
import {
  DerivationInputNotYesOrNoError,
  DisclosureOutOfScopeError,
  UnknownDerivationInputError,
} from '../errors/report.errors';
import {
  INPUT_ANSWER,
  OPERAND_SOURCE,
  inputAnswerOf,
  isYesNoInput,
  type Derivation,
} from '../models/derivation.model';
import { scopeAsks, type ReportScope } from '../models/report.model';

/**
 * Why this derivation input cannot be stored, or `null` (tasks 36.10, 218, 79.5, 79.8) — **the checks a write makes of
 * each input on its own**, `valueRefusal`'s counterpart one table over, pure so each is a unit case.
 *
 * - **A key no registered formula reads** is a live row nothing reads (task 36.10).
 * - **An input no module of whose figures the scope asks** is a Comprehensive one on a Basic report, refused as a C
 *   answer is (UC-192's exception flows; §12.5.6's task-79.5 row (3)). Until C5 every input fed a Basic figure, so the
 *   question was never asked.
 * - **A yes/no input holding anything but a yes or a no** (§12.5.6's task-79.8 row): its formula reads `1` or `0`, and
 *   a `2` would read as no answer at all rather than as the refusal it is. Clearing it is not judged.
 */
export function inputRefusal(input: {
  readonly inputKey: string;
  readonly valueNumeric: string | null;
  readonly derivations: ReadonlyMap<string, Derivation>;
  /** Each element's modules, in the version the report pins. */
  readonly modulesOf: (elementKey: string) => readonly string[];
  readonly scope: ReportScope;
}): DomainError | null {
  const readers = [...input.derivations.values()].filter((derivation) =>
    Object.values(derivation.operands).some(
      (operand) => operand.from === OPERAND_SOURCE.INPUT && operand.key === input.inputKey,
    ),
  );
  if (readers.length === 0) return new UnknownDerivationInputError();

  const asked = readers.some((derivation) =>
    input.modulesOf(derivation.element).some((module) => scopeAsks({ scope: input.scope, module })),
  );
  if (!asked) return new DisclosureOutOfScopeError();

  const yesOrNo = readers.some((derivation) => inputAnswerOf(derivation.formula) === INPUT_ANSWER.YES_NO);
  if (yesOrNo && input.valueNumeric !== null && !isYesNoInput(input.valueNumeric)) {
    return new DerivationInputNotYesOrNoError();
  }
  return null;
}
