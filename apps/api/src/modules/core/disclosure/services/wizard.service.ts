import { Inject, Injectable } from '@nestjs/common';
import { PRESENTATION_PRECISION, type PresentationPrecision } from '@api/contracts/presentation-precision.port';

import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
import type { DisclosureValue } from '../models/disclosure-value.model';
import type { DisclosureModuleSummary, PresentedDisclosureStep } from '../models/wizard-step.model';
import { ClearOutstandingNotice } from '../use-cases/clear-outstanding-notice.use-case';
import { ReadWizardStep } from '../use-cases/read-wizard-step.use-case';
import {
  WriteDerivationInputs,
  type DerivationInputWriteInput,
} from '../use-cases/write-derivation-inputs.use-case';
import {
  WriteDisclosureValues,
  type DisclosureValueInput,
} from '../use-cases/write-disclosure-values.use-case';

/**
 * The Nest-aware seam over the wizard's use cases (task 89).
 *
 * **It resolves the locale, and the use case does not take it from a caller.** `apps/api/CLAUDE.md`
 * puts ambient request context here rather than in a framework-free use case, and the omission list
 * on the signature is the documentation of what this service supplies — the registration locale is
 * the worked example this follows.
 */
@Injectable()
export class WizardService {
  constructor(
    private readonly reads: ReadWizardStep,
    private readonly writes: WriteDisclosureValues,
    private readonly derivationWrites: WriteDerivationInputs,
    @Inject(PRESENTATION_PRECISION) private readonly precision: PresentationPrecision,
    private readonly clearance: ClearOutstandingNotice,
  ) {}

  modules(query: { readonly reportId: string }): Promise<readonly DisclosureModuleSummary[]> {
    // The list carries an applicability cause of its own since task 91.3, so it resolves the
    // request's locale exactly as `step` does — and falls back the same way, for the same reason.
    return this.reads.modules({ ...query, locale: requestLocale() });
  }

  async step(query: { readonly reportId: string; readonly module: string }): Promise<PresentedDisclosureStep> {
    // Falls back to source rather than throwing: a step with unresolved wording is still an
    // answerable step, and refusing it would make a missing header fatal to the whole product.
    const step = await this.reads.step({ ...query, locale: requestLocale() });
    // The places a computed or derived figure is shown to (task 39.3; §12.5.6's task-39 row (7)) — the same rule S-09,
    // the PDF and the Excel export round by, so the wizard cannot disagree with them about a figure.
    return { ...step, precision: this.precision.places() };
  }

  /**
   * The ordinary write, then — **on the same transaction** — FR-164's notice withdrawn if the write answered the last of
   * what it listed (task 51.2; 182/134). Two flows composed here rather than one use case doing both: what a write admits
   * is `WriteDisclosureValues`' rule, and whether it cleared a notice is `ClearOutstandingNotice`'s.
   */
  async write(command: {
    readonly reportId: string;
    readonly values: readonly DisclosureValueInput[];
  }): Promise<DisclosureValue[]> {
    const written = await this.writes.write(command);
    const organizationId = requestContext()?.organizationId;
    // The tenant transaction has bound it before a controller runs; its absence is not a refusal to word.
    if (organizationId === undefined) throw new Error('A disclosure was written with no organization bound');
    await this.clearance.execute({
      reportId: command.reportId,
      organizationId,
      writtenElements: command.values.map((value) => value.elementKey),
    });
    return written;
  }

  writeDerivationInputs(command: {
    readonly reportId: string;
    readonly inputs: readonly DerivationInputWriteInput[];
  }): Promise<void> {
    return this.derivationWrites.write(command);
  }
}
