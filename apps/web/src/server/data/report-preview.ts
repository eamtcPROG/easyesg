import 'server-only';
import type { AccountProfile, DisclosureModuleSummary, Report } from '@easyesg/contracts';
import { isLocale, type Locale } from '@easyesg/i18n';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';
import { mayWrite, readActiveMembership } from './memberships';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';

const NOT_FOUND_STATUS = 404;

/** S-10's read's one answer of its own: a report this organization does not hold. */
export const PREVIEW_READ = {
  REPORT_NOT_FOUND: 'report-not-found',
} as const;

export type ReportPreviewRead =
  | { readonly status: typeof PREVIEW_READ.REPORT_NOT_FOUND }
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly report: Report;
      readonly modules: readonly DisclosureModuleSummary[];
      /** Whether the reader may preview — an editor or the OA (182/22). The api refuses the document to anyone else. */
      readonly mayPreview: boolean;
      /** The account's export default (FR-52; task 52.3) — `null` where the profile could not be read. */
      readonly exportLocale: Locale | null;
    }
  | TenantReadRefusal;

/**
 * What S-10 draws around the document (task 43.2): the report and its modules for the bar and the page list, whether
 * the reader may preview, and the language the preview opens in (182/34). **The document itself is not read here** —
 * the frame loads it through the session pass-through, so a page of several hundred kilobytes never rides this
 * response as well (`architecture.md` §12.5.6's task-43 row (1)).
 *
 * **`mayPreview` is presentation only**, as S-07's read-only cause is: the api's 403 on the document is the authority,
 * and this decides only whether the screen draws the frame or says why it does not.
 */
export async function readReportPreview(reportId: string): Promise<ReportPreviewRead> {
  const [report, modules, membership, profile] = await Promise.all([
    api.get<Report>(`/reports/${reportId}`),
    api.getList<DisclosureModuleSummary>(`/reports/${reportId}/modules`),
    readActiveMembership(),
    api.get<AccountProfile>('/account/profile'),
  ]);

  if (isPermissionRefusal(report) || isPermissionRefusal(modules)) return { status: TENANT_READ.FORBIDDEN };
  if (report.status === API_OUTCOME.Problem && report.problem.status === NOT_FOUND_STATUS) {
    return { status: PREVIEW_READ.REPORT_NOT_FOUND };
  }
  if (report.status !== API_OUTCOME.Ok || modules.status !== API_OUTCOME.Ok || report.value === null) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  // A profile that cannot be read is not a preview that cannot open: it opens in the reader's own language instead.
  const exportLocale = profile.status === API_OUTCOME.Ok ? profile.value?.exportLocale : undefined;
  return {
    status: TENANT_READ.READY,
    report: report.value,
    modules: modules.value.items,
    mayPreview: mayWrite(membership),
    exportLocale: exportLocale !== undefined && isLocale(exportLocale) ? exportLocale : null,
  };
}
