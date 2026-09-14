import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import type {
  OrganizationRegisterRead,
  OrganizationRegisterRowRead,
  OrganizationRegisterStore,
} from '@api/modules/platform/admin/interfaces/organization-register-store.interface';
import {
  ORGANIZATION_REGISTER_SORT,
  type OrganizationRegisterPage,
  type OrganizationRegisterRow,
  type OrganizationRegisterSort,
} from '@api/modules/platform/admin/models/organization-register.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { collated } from '../collation';

interface RegisterDbRow {
  id: string;
  name: string;
  idno: string | null;
  created_at: Date;
  entity_count: number;
  report_count: number;
  last_sign_in_at: Date | null;
}

/**
 * The register, as one statement per page over every organization (task 67.3; FR-76).
 *
 * **Account-level metadata, and this `SELECT` list is where that is true.** Each column is one
 * decision in `design_spec.md` §5.2: name and IDNO, registration, **active** entities, a report
 * **count**, and the most recent sign-in by an active member. No column of `core.report` beyond its
 * existence is read, and `identity.session` is readable by this role only as `(account_id,
 * created_at)` — the migration's column grant, so a later edit reaching for more fails at the
 * database rather than in review.
 *
 * **Both statements run inside one acquisition**, so one read of the register is one row in
 * `audit.support_access_log` (`admin-readonly.ts`), and both see the same snapshot of the platform.
 *
 * **Search never interpolates**: the term is a bind parameter, with `!`, `%` and `_` escaped so a
 * reader's `_` is a character and not a wildcard. **Ordering never interpolates a caller's string**:
 * `ORDER_BY` maps the closed `ORGANIZATION_REGISTER_SORT` vocabulary to SQL this file owns, and every
 * ordering ties on `id` so a page boundary cannot drop or repeat a row. Names order through
 * `collated()` (OQ-61), which is what keeps *Ștefan* among the S's.
 *
 * **`NULLS LAST` on every ordering**, which only bites on activity: an organization nobody has signed
 * in to is not the most recent or the least recent, it is undated, and sorting it first in either
 * direction would put the least informative row at the top.
 */
const REGISTER = `
  SELECT o.id, o.name, o.idno, o.created_at,
         (SELECT count(*)::int FROM core.reporting_entity e
           WHERE e.organization_id = o.id AND e.status = '${ENTITY_STATUS.ACTIVE}') AS entity_count,
         (SELECT count(*)::int FROM core.report r
           WHERE r.organization_id = o.id) AS report_count,
         (SELECT max(s.created_at)
            FROM identity.membership m
            JOIN identity.session s ON s.account_id = m.account_id
           WHERE m.organization_id = o.id AND m.status = '${MEMBERSHIP_STATUS.ACTIVE}') AS last_sign_in_at
    FROM core.organization o`;

/** `$1` is the escaped search term, or null for none. */
const MATCHES = `($1::text IS NULL
                 OR name ILIKE '%' || $1::text || '%' ESCAPE '!'
                 OR idno LIKE $1::text || '%' ESCAPE '!')`;

const escapeLikePattern = (term: string): string => term.replace(/[!%_]/gu, (c) => `!${c}`);

const ORDER_BY: Record<OrganizationRegisterSort, string> = {
  [ORGANIZATION_REGISTER_SORT.NAME]: collated('name'),
  [ORGANIZATION_REGISTER_SORT.REGISTERED]: 'created_at',
  [ORGANIZATION_REGISTER_SORT.ENTITIES]: 'entity_count',
  [ORGANIZATION_REGISTER_SORT.REPORTS]: 'report_count',
  [ORGANIZATION_REGISTER_SORT.ACTIVITY]: 'last_sign_in_at',
};

@Injectable()
export class OrganizationRegisterStoreRepository implements OrganizationRegisterStore {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  list(read: OrganizationRegisterRead): Promise<OrganizationRegisterPage> {
    const { query } = read;
    const search = query.search === null ? null : escapeLikePattern(query.search);

    return this.adminReadOnly.acquire(
      {
        requesterId: read.requesterId,
        purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
        organizationId: null,
      },
      async (runner: QueryRunner) => {
        const [counts] = (await runner.query(
          `WITH register AS (${REGISTER})
           SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE ${MATCHES})::int AS matched
             FROM register`,
          [search],
        )) as { total: number; matched: number }[];

        const rows = (await runner.query(
          `WITH register AS (${REGISTER})
           SELECT id, name, idno, created_at, entity_count, report_count, last_sign_in_at
             FROM register
            WHERE ${MATCHES}
            ORDER BY ${ORDER_BY[query.sort]} ${query.descending ? 'DESC' : 'ASC'} NULLS LAST, id ASC
            LIMIT $2 OFFSET $3`,
          [search, query.take, query.skip],
        )) as RegisterDbRow[];

        return { rows: rows.map(toRegisterRow), matched: counts.matched, total: counts.total };
      },
    );
  }

  find(read: OrganizationRegisterRowRead): Promise<OrganizationRegisterRow | null> {
    return this.adminReadOnly.acquire(
      {
        requesterId: read.requesterId,
        purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
        organizationId: read.organizationId,
      },
      async (runner: QueryRunner) => {
        const rows = (await runner.query(
          `WITH register AS (${REGISTER})
           SELECT id, name, idno, created_at, entity_count, report_count, last_sign_in_at
             FROM register
            WHERE id = $1`,
          [read.organizationId],
        )) as RegisterDbRow[];
        return rows.length === 0 ? null : toRegisterRow(rows[0]);
      },
    );
  }
}

const toRegisterRow = (row: RegisterDbRow): OrganizationRegisterRow => ({
  id: row.id,
  name: row.name,
  idno: row.idno,
  registeredAt: row.created_at,
  entityCount: row.entity_count,
  reportCount: row.report_count,
  lastSignInAt: row.last_sign_in_at,
});
