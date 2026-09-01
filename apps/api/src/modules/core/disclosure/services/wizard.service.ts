import { Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { DisclosureValue } from '../models/disclosure-value.model';
import type { DisclosureModuleSummary, DisclosureStep } from '../models/wizard-step.model';
import { ReadWizardStep } from '../use-cases/read-wizard-step.use-case';
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
  ) {}

  modules(query: { readonly reportId: string }): Promise<readonly DisclosureModuleSummary[]> {
    return this.reads.modules(query);
  }

  step(query: { readonly reportId: string; readonly module: string }): Promise<DisclosureStep> {
    // Falls back to source rather than throwing: a step with unresolved wording is still an
    // answerable step, and refusing it would make a missing header fatal to the whole product.
    return this.reads.step({ ...query, locale: requestContext()?.locale ?? SOURCE_LOCALE });
  }

  write(command: {
    readonly reportId: string;
    readonly values: readonly DisclosureValueInput[];
  }): Promise<DisclosureValue[]> {
    return this.writes.write(command);
  }
}
