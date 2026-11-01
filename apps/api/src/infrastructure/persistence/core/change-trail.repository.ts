import { Injectable } from '@nestjs/common';
import type {
  ChangeTrailStore,
  StoredValueField,
  ValueRecord,
} from '@api/modules/core/trace/interfaces/change-trail.interface';
import type { ChangeActor, TrailRow, ValueField } from '@api/modules/core/trace/models/change-history.model';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import { TenantRepository } from '../tenant-repository';

interface TrailRowRecord {
  id: string;
  statement: string;
  occurred_at: Date;
  record_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor_found: boolean;
  actor_email: string | null;
  actor_given_name: string | null;
  actor_family_name: string | null;
  actor_active: boolean;
}

/**
 * `core/trace`'s reads of `core.field_change` (task 84.1; §12.5.6's task-84 row), on the request's transaction: row-level
 * security confines the trail, and every record it is read for, to the bound organization, so no statement here names
 * one.
 *
 * **The trail's read is one statement over `field_change_record_idx`**, whose leading columns are `(organization_id,
 * table_name, record_id, occurred_at DESC)` — the policy supplies the first, the query the next two. **`statement` is the
 * transaction's instant in microseconds**, as text: `occurred_at` is `now()`, shared by every row one transaction wrote,
 * and a JavaScript `Date` would round two statements a microsecond apart into one.
 *
 * **The person is two left joins that read no wider than the trail** (`organization-store.repository.ts`'s argument):
 * the account, which an erased person no longer has, and the membership of the trail's own organization, which says
 * whether they still hold access (UX-69). `actor_id` carries no foreign key by design (task 14), so either may find
 * nothing and the row still reads.
 */
@Injectable()
export class ChangeTrailRepository extends TenantRepository<never> implements ChangeTrailStore {
  protected readonly entity = 'core.field_change' as never;

  async organizationRecord(): Promise<string | null> {
    const [row] = await this.manager.query<{ id: string }[]>(`SELECT id FROM core.organization`);
    return row?.id ?? null;
  }

  async entityRecord(query: { readonly entityId: string }): Promise<string | null> {
    const [row] = await this.manager.query<{ id: string }[]>(`SELECT id FROM core.reporting_entity WHERE id = $1`, [
      query.entityId,
    ]);
    return row?.id ?? null;
  }

  async valueRecord(field: ValueField): Promise<ValueRecord | null> {
    const [row] = await this.manager.query<
      { taxonomy_version: string; reporting_currency: string | null; record_id: string | null }[]
    >(
      `SELECT r.taxonomy_version, r.reporting_currency, v.id AS record_id
         FROM core.report r
         LEFT JOIN core.report_disclosure_value v
           ON v.report_id = r.id AND v.element_key = $2 AND v.dimension_key = $3 AND v.ordinal = $4
        WHERE r.id = $1`,
      [field.reportId, field.elementKey, field.dimensionKey, field.ordinal],
    );
    if (row === undefined) return null;
    return { taxonomyVersion: row.taxonomy_version, currency: row.reporting_currency, recordId: row.record_id };
  }

  async valueFields(query: {
    readonly reportId: string;
    readonly elementKeys: readonly string[];
  }): Promise<StoredValueField[]> {
    const rows = await this.manager.query<
      { id: string; element_key: string; dimension_key: string; ordinal: number }[]
    >(
      `SELECT id, element_key, dimension_key, ordinal FROM core.report_disclosure_value
        WHERE report_id = $1 AND element_key = ANY($2::text[])`,
      [query.reportId, query.elementKeys],
    );
    return rows.map((row) => ({
      recordId: row.id,
      elementKey: row.element_key,
      dimensionKey: row.dimension_key,
      ordinal: row.ordinal,
    }));
  }

  async rows(query: {
    readonly table: string;
    readonly recordIds: readonly string[];
    readonly columns: readonly string[];
  }): Promise<TrailRow[]> {
    if (query.recordIds.length === 0) return [];
    const rows = await this.manager.query<TrailRowRecord[]>(
      `SELECT fc.id,
              (extract(epoch FROM fc.occurred_at) * 1000000)::bigint::text AS statement,
              fc.occurred_at, fc.record_id, fc.field_name, fc.old_value, fc.new_value,
              fc.actor_id, a.id IS NOT NULL AS actor_found, a.email AS actor_email,
              a.given_name AS actor_given_name, a.family_name AS actor_family_name,
              coalesce(m.status = $4, false) AS actor_active
         FROM core.field_change fc
         LEFT JOIN identity.account a ON a.id = fc.actor_id
         LEFT JOIN identity.membership m ON m.account_id = fc.actor_id AND m.organization_id = fc.organization_id
        WHERE fc.table_name = $1 AND fc.record_id = ANY($2::uuid[]) AND fc.field_name = ANY($3::text[])
        ORDER BY fc.occurred_at, fc.id`,
      [query.table, query.recordIds, query.columns, MEMBERSHIP_STATUS.ACTIVE],
    );
    return rows.map((row) => ({
      id: row.id,
      statement: row.statement,
      occurredAt: row.occurred_at,
      recordId: row.record_id,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      actor: actorOf(row),
    }));
  }
}

/** No actor is the platform's change; an actor the join no longer finds is a person with no name (FR-55). */
function actorOf(row: TrailRowRecord): ChangeActor | null {
  if (row.actor_id === null) return null;
  const name =
    row.actor_found && row.actor_email !== null
      ? displayName({ givenName: row.actor_given_name, familyName: row.actor_family_name }, row.actor_email)
      : null;
  return { accountId: row.actor_id, name, removed: !row.actor_active };
}
