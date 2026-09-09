import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, UnknownDerivationInputError } from '../errors/report.errors';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { OPERAND_SOURCE } from '../models/derivation.model';
import type {
  DerivationRecalculator,
  Derivations,
} from '../interfaces/derivation.interface';

/** One input's new value; `null` clears it back to the published offer. */
export interface DerivationInputWriteInput {
  readonly inputKey: string;
  readonly valueNumeric: string | null;
}

export interface WriteDerivationInputsCommand {
  readonly reportId: string;
  readonly inputs: readonly DerivationInputWriteInput[];
}

/**
 * UC-27 step 2 and UC-26 step 4 — the values EFRAG's derived figures are computed from (task 36.10).
 *
 * **A separate use case from `WriteDisclosureValues`, because these are not disclosures.** They have
 * no state, no unit, no dimension and no applicability; they are not validated by FR-40's run and
 * they are not exported as facts. Folding them into the disclosure write would mean one command
 * whose fields are meaningful for half its payload — and the shape of that command is what every
 * later reader would reason from.
 *
 * **`null` clears rather than storing a zero**, which is the distinction FR-30 makes elsewhere and
 * this path must not blur: a reporter who empties the hours field is asking for the published
 * default back, and a stored `0` would instead make every accident rate undefined — a zero denominator
 * is not a working year of no hours, it is no answer.
 *
 * **The lock is not checked here.** FR-22 is enforced by the trigger beneath the store, which the
 * repository translates into `ReportNotEditableError` (P-4, task 31.3) — the same argument, and the
 * same trigger function, as the value store's.
 */
export class WriteDerivationInputs {
  constructor(
    private readonly reports: ReportStore,
    private readonly inputs: DerivationInputStore,
    private readonly derivations: Derivations,
    private readonly calculator: DerivationRecalculator,
  ) {}

  async write(command: WriteDerivationInputsCommand): Promise<void> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3).
    if (report === null) throw new ReportNotFoundError();

    // **Every key is checked against the registered derivations**, for `WriteDisclosureValues`'
    // reason one table over: a row under a key no formula reads is a live value nothing will ever
    // look at, invisible to every read because a read walks the artefact and would never ask for it.
    const registered = new Set(
      [...this.derivations.all({ standard: TAXONOMY_STANDARD.VSME }).values()].flatMap((derivation) =>
        Object.values(derivation.operands)
          .filter((operand) => operand.from === OPERAND_SOURCE.INPUT)
          .map((operand) => operand.key),
      ),
    );
    // Refused before any write, so a batch is all-or-nothing about what it names.
    if (command.inputs.some((input) => !registered.has(input.inputKey))) {
      throw new UnknownDerivationInputError();
    }

    for (const input of command.inputs) {
      if (input.valueNumeric === null) {
        await this.inputs.remove({ reportId: command.reportId, inputKey: input.inputKey });
        continue;
      }
      await this.inputs.write({
        reportId: command.reportId,
        inputKey: input.inputKey,
        valueNumeric: input.valueNumeric,
      });
    }

    // After the batch rather than per input, for the reason `WriteDisclosureValues` states: B8's
    // three turnover inputs can arrive in one request, and recomputing between them would write a
    // rate from a half-applied batch.
    await this.calculator.recompute({
      reportId: command.reportId,
      standard: TAXONOMY_STANDARD.VSME,
      touched: new Set(command.inputs.map((input) => input.inputKey)),
    });
  }
}
