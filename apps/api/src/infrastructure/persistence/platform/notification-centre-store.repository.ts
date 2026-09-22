import { Injectable } from '@nestjs/common';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationCentreStore } from '@api/modules/platform/notification/interfaces/notification-centre-store.interface';
import { NOTIFICATION_CHANNEL } from '@api/modules/platform/notification/models/notification-category.model';
import {
  NOTIFICATION_READ_STATE,
  type NotificationCentreEntry,
  type NotificationCentrePage,
  type NotificationCentreQuery,
} from '@api/modules/platform/notification/models/notification-centre.model';
import { NOTIFICATION_STATE } from '@api/modules/platform/notification/models/notification-record.model';
import { returnedRows } from '../returned-rows';
import { TenantRepository } from '../tenant-repository';

/** The two markers a recipient writes on their delivery — the columns `esg_app` is granted, and no others. */
const MARKER = {
  READ: 'read_at',
  DISMISSED: 'dismissed_at',
} as const;

type Marker = (typeof MARKER)[keyof typeof MARKER];

interface CentreRow {
  notification_id: string;
  category_key: NotificationCategoryKey;
  deep_link: string;
  params: Record<string, unknown>;
  received_at: Date;
  read_at: Date | null;
}

/**
 * `NOTIFICATION_CENTRE_STORE` — the recipient's centre, on the request's own transaction (task 50.1.2; FR-161,
 * UC-165, BR-NOT-5; §12.5.6's task-50.1 rows (8) … (11)).
 *
 * **No statement names the recipient or the organization.** The tenant transaction binds both, and the policies
 * task 50.1.2's migration adds answer `esg_app` with only the bound account's deliveries and the notices they
 * belong to — so a query here cannot reach a colleague's row by being written wrongly, which is the property
 * UC-165's *addressed to them* and BR-NOT-5's per-user marks need, and a `WHERE recipient_account_id = $n` would only
 * have imitated.
 *
 * **What the centre holds is one clause**, `centre` below, shared by the page, both counts and the unread count so
 * the four cannot describe different sets: the recipient's in-app deliveries, not dismissed, of notices not
 * cancelled. Dismissed rows are what the centre's partial index leaves out.
 *
 * **Both markers are written once**, with `COALESCE(…, now())`: a second read keeps the first time and a second
 * dismissal changes nothing, which `notification.keep_read_state` would refuse anyway. The update answers whether
 * the recipient holds a delivery at all, and a dismissed or cancelled one still counts — a click racing a
 * dismissal in another tab, or a withdrawal, is not the recipient's mistake to be told about.
 */
@Injectable()
export class NotificationCentreStoreRepository extends TenantRepository<never> implements NotificationCentreStore {
  protected readonly entity = 'notification.delivery' as never;

  private readonly centre = `
    SELECT n.id AS notification_id, n.category_key, n.deep_link, n.params,
           d.dispatched_at AS received_at, d.read_at
      FROM notification.delivery d
      JOIN notification.notification n ON n.id = d.notification_id AND n.organization_id = d.organization_id
     WHERE d.channel = '${NOTIFICATION_CHANNEL.IN_APP}'
       AND d.dismissed_at IS NULL
       AND n.state <> '${NOTIFICATION_STATE.CANCELLED}'
  `;

  /** `$1` is the read-state facet (`NULL` for both) and `$2` the categories (empty for all). */
  private readonly matches = `($1::text IS NULL OR (read_at IS NULL) = ($1::text = '${NOTIFICATION_READ_STATE.UNREAD}'))
                          AND (cardinality($2::text[]) = 0 OR category_key = ANY($2::text[]))`;

  async list(query: NotificationCentreQuery): Promise<NotificationCentrePage> {
    const facets = [query.readState, query.categories];

    // Both counts over one CTE in one statement, `AccessStoreRepository`'s reason: an Index's two empty states
    // teach opposite things, and counts from two statements could describe two sets.
    const [counts] = await this.manager.query<{ total: number; matched: number }[]>(
      `WITH centre AS (${this.centre})
       SELECT count(*)::int AS total, count(*) FILTER (WHERE ${this.matches})::int AS matched FROM centre`,
      facets,
    );

    // `notification_id` breaks a tie, so the order is total and a page boundary cannot show a row twice.
    const direction = query.newestFirst ? 'DESC' : 'ASC';
    const rows = await this.manager.query<CentreRow[]>(
      `WITH centre AS (${this.centre})
       SELECT notification_id, category_key, deep_link, params, received_at, read_at
         FROM centre
        WHERE ${this.matches}
        ORDER BY received_at ${direction}, notification_id ${direction}
        LIMIT $3 OFFSET $4`,
      [...facets, query.take, query.skip],
    );

    return { entries: rows.map(toEntry), matched: counts.matched, total: counts.total };
  }

  async countUnread(): Promise<number> {
    const [row] = await this.manager.query<{ unread: number }[]>(
      `WITH centre AS (${this.centre}) SELECT count(*)::int AS unread FROM centre WHERE read_at IS NULL`,
    );
    return row.unread;
  }

  async markRead(command: { readonly notificationId: string }): Promise<boolean> {
    return this.mark({ notificationId: command.notificationId, column: MARKER.READ });
  }

  async dismiss(command: { readonly notificationId: string }): Promise<boolean> {
    return this.mark({ notificationId: command.notificationId, column: MARKER.DISMISSED });
  }

  /** The recipient's in-app delivery of one notice, its marker set if unset; the column is this file's alone. */
  private async mark(input: { readonly notificationId: string; readonly column: Marker }): Promise<boolean> {
    const result: unknown = await this.runner.query(
      `UPDATE notification.delivery SET ${input.column} = COALESCE(${input.column}, now())
        WHERE notification_id = $1 AND channel = $2
        RETURNING id`,
      [input.notificationId, NOTIFICATION_CHANNEL.IN_APP],
    );
    return returnedRows(result).length > 0;
  }
}

const toEntry = (row: CentreRow): NotificationCentreEntry => ({
  notificationId: row.notification_id,
  categoryKey: row.category_key,
  deepLink: row.deep_link,
  params: row.params,
  receivedAt: row.received_at,
  readAt: row.read_at,
});
