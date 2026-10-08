import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { writeOutboxEventOnce } from '@api/infrastructure/outbox/outbox-writer';
import { REPORT_NOTICE_CHECK } from '@api/modules/core/validation/constants/validation.constants';
import type { NoticeChecks } from '@api/modules/core/validation/interfaces/notice-checks.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `NOTICE_CHECKS` (task 51.2): the day's checks as outbox rows, **all in one transaction and each keyed by its period
 * and the day**, so a sweep retried writes nothing twice and the dispatcher queues each check as its own job. Each row
 * carries its organization, as every tenant job does, for the check to bind.
 */
@Injectable()
export class ReportNoticeChecksRepository implements NoticeChecks {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  schedule(input: Parameters<NoticeChecks['schedule']>[0]): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      if (manager.queryRunner === undefined) throw new Error('A transaction ran with no query runner');
      let written = 0;
      for (const period of input.periods) {
        const wrote = await writeOutboxEventOnce(manager.queryRunner, {
          eventType: REPORT_NOTICE_CHECK,
          payload: { periodId: period.periodId, asOf: input.asOf.getTime() },
          organizationId: period.organizationId,
          idempotencyKey: `${REPORT_NOTICE_CHECK}/${period.periodId}/${input.day}`,
        });
        if (wrote) written += 1;
      }
      return written;
    });
  }
}
