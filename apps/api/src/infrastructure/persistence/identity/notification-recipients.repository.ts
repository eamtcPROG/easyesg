import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import type {
  NotificationRecipient,
  NotificationRecipientsPort,
} from '@api/contracts/notification-recipients.port';
import { CORE_DATA_SOURCE } from '../data-source';

/** The shape an account id takes; anything else is asked about as nothing rather than cast into a 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `NOTIFICATION_RECIPIENTS` over `identity.account` (task 49.3; FR-169; §12.5.6's task-49.3 row (4)).
 *
 * **On the worker, as `esg_worker`**, which task 19's grant already lets read accounts; the job has no request
 * and no tenant, and an account is not tenant-owned, so this reads the pool directly rather than a request
 * runner. Only the three columns a delivery needs.
 *
 * **An id that is not a UUID is not sent to the database**: `ANY($1::uuid[])` would refuse the whole batch with
 * `invalid input syntax`, turning one bad id into every recipient's lost notice. It is simply not found, which the
 * handler reports.
 */
@Injectable()
export class NotificationRecipientsRepository implements NotificationRecipientsPort {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async resolve(query: { readonly userIds: readonly string[] }): Promise<NotificationRecipient[]> {
    const ids = query.userIds.filter((id) => UUID.test(id));
    if (ids.length === 0) return [];

    const rows: { id: string; email: string; locale: string }[] = await this.dataSource.query(
      `SELECT id, email, locale FROM identity.account WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return rows.map((row) => ({ userId: row.id, email: row.email, locale: toLocale(row.locale) }));
  }
}
