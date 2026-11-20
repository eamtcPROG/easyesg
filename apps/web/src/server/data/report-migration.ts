import 'server-only';
import type { MigrationReview, Report } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';
import {
  TENANT_READ,
  isNotFound,
  isPermissionRefusal,
  type TenantReadNotFound,
  type TenantReadRefusal,
} from './tenant-read';

/** S-49's read's one answer of its own: the report is there, and no move of it awaits a decision. */
export const MIGRATION_READ = {
  /** Never held for a decision, or a colleague decided first — the report's own screen is the way on. */
  NOTHING_TO_DECIDE: 'nothing-to-decide',
} as const;

export interface ReportMigrationReview {
  readonly status: typeof TENANT_READ.READY;
  readonly report: Report;
  readonly review: MigrationReview;
}

export type ReportMigrationRead =
  | ReportMigrationReview
  | { readonly status: typeof MIGRATION_READ.NOTHING_TO_DECIDE; readonly report: Report }
  | TenantReadNotFound
  | TenantReadRefusal;

/**
 * S-49's read (task 67.20) — the report, for its bar and heading, and its migration awaiting a decision. **The report
 * decides the 404**: an unknown report, or another organization's, is the 404 screen; a report with nothing to decide is
 * this screen's own state, since the notice that led here may simply be older than a colleague's decision. **The
 * decision is the Organization Administrator's**, so another member reading it is refused by the api and shown the
 * permission state.
 */
export async function readReportMigration(reportId: string): Promise<ReportMigrationRead> {
  const [report, review] = await Promise.all([
    api.get<Report>(`/reports/${reportId}`),
    api.get<MigrationReview>(`/reports/${reportId}/migration`),
  ]);

  if (isPermissionRefusal(report)) return { status: TENANT_READ.FORBIDDEN };
  if (isNotFound(report)) return { status: TENANT_READ.NOT_FOUND };
  if (report.status !== API_OUTCOME.Ok || report.value === null) return { status: TENANT_READ.UNREACHABLE };
  if (isPermissionRefusal(review)) return { status: TENANT_READ.FORBIDDEN };
  if (isNotFound(review)) return { status: MIGRATION_READ.NOTHING_TO_DECIDE, report: report.value };
  if (review.status !== API_OUTCOME.Ok || review.value === null) return { status: TENANT_READ.UNREACHABLE };
  return { status: TENANT_READ.READY, report: report.value, review: review.value };
}
