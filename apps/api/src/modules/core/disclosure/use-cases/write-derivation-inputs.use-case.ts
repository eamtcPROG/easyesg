import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import { inputRefusal } from '../domain/input-refusal';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import type { RefusedInput } from '../models/refused-write.model';
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
    // The one read the scope check asks — the pinned version's elements, for each figure's modules (task 79.5).
    private readonly taxonomy: Pick<TaxonomyRegistry, 'taxonomy'>,
  ) {}

  async write(command: WriteDerivationInputsCommand): Promise<{ readonly refused: RefusedInput[] }> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    // RLS makes "not yours" and "not there" one answer (task 31.3).
    if (report === null) throw new ReportNotFoundError();

    // The version the report pins says which modules each figure belongs to — what the scope check reads (task 79.5).
    const registered = this.taxonomy.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version: report.taxonomyVersion });
    if (registered === null) throw new TaxonomyVersionUnavailableError();
    const modules = new Map(registered.elements.map((element) => [element.key, element.modules]));
    const derivations = this.derivations.all({ standard: TAXONOMY_STANDARD.VSME });

    // **Each input judged on its own, and what is admitted stored** (task 218; §12.5.6's task-218 row (1), (4)) — the
    // reason `WriteDisclosureValues` states: one input refused for good must not hold the rest of the queue back. What
    // each is judged on is `inputRefusal`'s: a key no formula reads (`WriteDisclosureValues`' reason one table over — a
    // row under a key no formula reads is a live value nothing will ever look at), an input of a module the scope does
    // not ask, a yes/no holding anything else.
    const refused: RefusedInput[] = [];
    const admitted: DerivationInputWriteInput[] = [];
    for (const input of command.inputs) {
      const refusal = inputRefusal({
        inputKey: input.inputKey,
        valueNumeric: input.valueNumeric,
        derivations,
        modulesOf: (elementKey) => modules.get(elementKey) ?? [],
        scope: report.scope,
      });
      if (refusal === null) admitted.push(input);
      else refused.push({ inputKey: input.inputKey, refusal });
    }

    for (const input of admitted) {
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
    if (admitted.length > 0) {
      await this.calculator.recompute({
        reportId: command.reportId,
        standard: TAXONOMY_STANDARD.VSME,
        touched: new Set(admitted.map((input) => input.inputKey)),
      });
    }
    return { refused };
  }
}
