import { Inject, Injectable } from '@nestjs/common';
import { FIELD_CHANGE_COUNTS, type FieldChangeCounts } from '@api/contracts/field-change-counts.port';
import {
  ELEMENT_PRECISION,
  PRESENTATION_PRECISION,
  type ElementPrecision,
  type PresentationPrecision,
} from '@api/contracts/presentation-precision.port';

import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { ItemsRefusedError } from '@api/app/filters/items-refused.error';
import { refusalWords } from '@api/app/filters/refusal-words';
import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
import { presentedPlaces } from '../domain/figure-precision';
import { wordRefusedValues } from '../domain/refused-value-words';
import type { DisclosureValue } from '../models/disclosure-value.model';
import type { WordedRefusedInput, WordedRefusedValue } from '../models/refused-write.model';
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
    @Inject(FIELD_CHANGE_COUNTS) private readonly changes: FieldChangeCounts,
    @Inject(ELEMENT_PRECISION) private readonly elementPrecision: ElementPrecision,
    @Inject(DISCLOSURE_LABELS) private readonly labels: DisclosureLabelResolver,
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
    // Each stored field's count of changes, for its footer (task 84) — read after the step, which names the elements.
    const changeCounts = await this.changes.count({
      reportId: query.reportId,
      elementKeys: [...new Set(step.fields.map((field) => field.elementKey))],
    });
    // The places a computed or derived figure is shown to (task 39.3; §12.5.6's task-39 row (7)) — by unit for S-09's
    // figure, and since task 211 each field's own, chosen by the rule the PDF and the Excel export choose by, so the
    // wizard cannot disagree with them about a figure (§12.5.6's task-211 row (1)).
    const precision = { units: this.precision.places(), elements: this.elementPrecision.elementPlaces() };
    const fields = step.fields.map((field) => ({ ...field, places: presentedPlaces({ field, precision }) }));
    return { ...step, fields, precision: precision.units, changeCounts };
  }

  /**
   * The ordinary write, then — **on the same transaction** — FR-164's notice withdrawn if the write answered the last of
   * what it listed (task 51.2; 182/134). Two flows composed here rather than one use case doing both: what a write admits
   * is `WriteDisclosureValues`' rule, and whether it cleared a notice is `ClearOutstandingNotice`'s.
   *
   * **What it refused is worded here, in the request's language** (task 218; §12.5.6's task-218 row (a)), with each
   * field named by the version the report pins. **Where nothing was stored, the request is refused** — as its first
   * refusal, carrying them all — so a write that changed nothing is never a success.
   */
  async write(command: {
    readonly reportId: string;
    readonly values: readonly DisclosureValueInput[];
  }): Promise<{ readonly stored: DisclosureValue[]; readonly refused: WordedRefusedValue[] }> {
    const outcome = await this.writes.write(command);
    const locale = requestLocale();
    const at = { version: outcome.taxonomyVersion, locale };
    const refused = wordRefusedValues({
      refused: outcome.refused,
      labels: outcome.refused.length === 0 ? null : this.labels.labels(at),
      members: outcome.refused.length === 0 ? null : this.labels.memberLabels(at),
      words: (refusal) => refusalWords({ refusal, locale }),
    });
    const first = outcome.refused[0];
    if (outcome.stored.length === 0 && first !== undefined) {
      throw new ItemsRefusedError({ first: first.refusal, refused });
    }

    const organizationId = requestContext()?.organizationId;
    // The tenant transaction has bound it before a controller runs; its absence is not a refusal to word.
    if (organizationId === undefined) throw new Error('A disclosure was written with no organization bound');
    await this.clearance.execute({
      reportId: command.reportId,
      organizationId,
      writtenElements: outcome.stored.map((value) => value.elementKey),
    });
    return { stored: outcome.stored, refused };
  }

  /** The inputs a derived figure is computed from, by `write`'s rule for what it refuses (task 218). */
  async writeDerivationInputs(command: {
    readonly reportId: string;
    readonly inputs: readonly DerivationInputWriteInput[];
  }): Promise<{ readonly refused: WordedRefusedInput[] }> {
    const outcome = await this.derivationWrites.write(command);
    const locale = requestLocale();
    const refused = outcome.refused.map(({ inputKey, refusal }) => ({ ...refusalWords({ refusal, locale }), inputKey }));
    const first = outcome.refused[0];
    if (refused.length === command.inputs.length && first !== undefined) {
      throw new ItemsRefusedError({ first: first.refusal, refused });
    }
    return { refused };
  }
}
