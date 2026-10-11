import { Injectable } from '@nestjs/common';
import type { LegalDate } from '@api/contracts/types/time';
import type { ReportFilingStore } from '@api/modules/core/disclosure/interfaces/report-filing-store.interface';
import { returnedRows } from '../returned-rows';
import { TenantRepository } from '../tenant-repository';

/**
 * The filed mark's writes (task 47.5; §12.5.6's task-47 row (1)–(4)), on the request's transaction.
 *
 * **The completed export is checked in the statement that writes**, so a mark cannot land on a report whose only
 * export was still being produced when the screen offered the button. The date and its zone are the only columns this
 * may write — `esg_app` holds `UPDATE` on those two of the mark's four — and the lock's trigger lets them move, so a
 * locked report is marked like an open one. `updated_at` moves too: marking is the report's latest activity (UX-6).
 */
@Injectable()
export class ReportFilingStoreRepository extends TenantRepository<never> implements ReportFilingStore {
  protected readonly entity = 'core.report' as never;

  async mark(command: { readonly reportId: string; readonly filedOn: LegalDate }): Promise<boolean> {
    const rows = returnedRows<{ id: string }>(
      await this.manager.query(
        `UPDATE core.report r SET filed_on = $2, filed_on_tz = $3, updated_at = now()
          WHERE r.id = $1
            AND EXISTS (SELECT 1 FROM core.export_artifact a WHERE a.report_id = r.id AND a.status = 'completed')
      RETURNING r.id`,
        [command.reportId, command.filedOn.date, command.filedOn.timezone],
      ),
    );
    return rows.length > 0;
  }

  async withdraw(command: { readonly reportId: string }): Promise<boolean> {
    const rows = returnedRows<{ id: string }>(
      await this.manager.query(
        `UPDATE core.report SET filed_on = NULL, filed_on_tz = NULL, updated_at = now()
          WHERE id = $1
      RETURNING id`,
        [command.reportId],
      ),
    );
    return rows.length > 0;
  }
}
