import type { TaxonomyPin } from '@api/contracts/taxonomy-registry.port';
import type { PriorPeriodComparatives } from '@api/modules/core/comparatives/models/prior-period-value.model';
import type { Report } from '@api/modules/core/disclosure/models/report.model';
import type {
  DisclosureModuleSummary,
  PresentedDisclosureStep,
} from '@api/modules/core/disclosure/models/wizard-step.model';
import type { NamedValidation, ValidationRules } from './validation-run.model';

/** S-07's step in one read (task 244) — each part as its own route answers it, the rules `null` where none can be read. */
export interface StepPage {
  readonly report: Report;
  /** The taxonomy a new report would pin — what `ReportResponseDto` says a report's pin is superseded by. */
  readonly adopted: TaxonomyPin | null;
  readonly modules: readonly DisclosureModuleSummary[];
  readonly step: PresentedDisclosureStep;
  /** Last year's answers for the step's own elements only. */
  readonly prior: PriorPeriodComparatives;
  readonly validation: NamedValidation;
  readonly rules: ValidationRules | null;
}
