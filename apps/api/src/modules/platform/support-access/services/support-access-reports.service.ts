import { Injectable } from '@nestjs/common';
import type { Report } from '@api/modules/core/disclosure/models/report.model';
import type {
  DisclosureModuleSummary,
  DisclosureStep,
} from '@api/modules/core/disclosure/models/wizard-step.model';
import { ReportService } from '@api/modules/core/disclosure/services/report.service';
import { WizardService } from '@api/modules/core/disclosure/services/wizard.service';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import { SUPPORT_ACCESS_READ_PURPOSE } from '../models/support-access-log.model';
import { ReadUnderSupportAccess } from '../use-cases/read-under-support-access.use-case';

/** Which grant a read is made under. */
export interface GrantScope {
  readonly organizationId: string;
  readonly requestId: string;
}

/**
 * What a live grant lets a Platform Administrator read (task 67.9; project owner, 14 Sep 2026): **the
 * organization's reports and each module's values, read-only** — through the very services S-06 and S-07 read
 * them with, run inside the grant's binding by `ReadUnderSupportAccess`.
 *
 * **Borrowed rather than restated**: a second read model for "a report as support sees it" would drift from the
 * one the organization sees, and the point of reading under a grant is to see what the organization sees. Each
 * read names what it opened, which is the access row's *what was accessed*.
 */
@Injectable()
export class SupportAccessReportsService {
  constructor(
    private readonly underGrant: ReadUnderSupportAccess,
    private readonly reports: ReportService,
    private readonly wizard: WizardService,
  ) {}

  list(scope: GrantScope): Promise<Report[]> {
    return this.underGrant.execute({
      ...scope,
      operatorId: requestOperatorId(),
      purpose: SUPPORT_ACCESS_READ_PURPOSE.REPORTS,
      subject: null,
      read: () => this.reports.list({}),
    });
  }

  modules(scope: GrantScope & { readonly reportId: string }): Promise<readonly DisclosureModuleSummary[]> {
    return this.underGrant.execute({
      organizationId: scope.organizationId,
      requestId: scope.requestId,
      operatorId: requestOperatorId(),
      purpose: SUPPORT_ACCESS_READ_PURPOSE.REPORT_MODULES,
      subject: scope.reportId,
      read: () => this.wizard.modules({ reportId: scope.reportId }),
    });
  }

  step(scope: GrantScope & { readonly reportId: string; readonly module: string }): Promise<DisclosureStep> {
    return this.underGrant.execute({
      organizationId: scope.organizationId,
      requestId: scope.requestId,
      operatorId: requestOperatorId(),
      purpose: SUPPORT_ACCESS_READ_PURPOSE.REPORT_MODULE,
      subject: `${scope.reportId}/${scope.module}`,
      read: () => this.wizard.step({ reportId: scope.reportId, module: scope.module }),
    });
  }
}
