import { Injectable } from '@nestjs/common';
import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
import type { MigrationReview } from '../models/report-migration-review.model';
import { AcceptReportMigration, type ReportMigrationDecisionCommand } from '../use-cases/accept-report-migration.use-case';
import { DeclineReportMigration } from '../use-cases/decline-report-migration.use-case';
import { ReadMigrationReview } from '../use-cases/read-migration-review.use-case';

/**
 * S-49's application seam (task 67.20) — the reader's language, the bound organization and the deciding account resolved
 * from the request, never the body, so a decision is always the signed-in administrator's own.
 */
@Injectable()
export class ReportMigrationService {
  constructor(
    private readonly readReview: ReadMigrationReview,
    private readonly acceptMigration: AcceptReportMigration,
    private readonly declineMigration: DeclineReportMigration,
  ) {}

  review(query: { readonly reportId: string }): Promise<MigrationReview> {
    return this.readReview.execute({ ...query, locale: requestLocale() });
  }

  accept(command: { readonly reportId: string }): Promise<void> {
    return this.acceptMigration.execute(decisionOf(command));
  }

  decline(command: { readonly reportId: string }): Promise<void> {
    return this.declineMigration.execute(decisionOf(command));
  }
}

function decisionOf(command: { readonly reportId: string }): ReportMigrationDecisionCommand {
  const context = requestContext();
  if (context?.organizationId === undefined || context.actorId === undefined) {
    throw new Error('A migration decision reached the service without a bound organization and actor.');
  }
  return { reportId: command.reportId, organizationId: context.organizationId, accountId: context.actorId };
}
