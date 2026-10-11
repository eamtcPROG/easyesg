import 'server-only';
import {
  PROBLEM_TYPE,
  type AccountProfile,
  type Export,
  type ExportLanguage,
  type ExportLanguages,
  type Report,
} from '@easyesg/contracts';
import { isLocale, type Locale } from '@easyesg/i18n';
import type { IndexPage } from '@easyesg/ui';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import type { ListQuery } from '@/lib/pagination';
import { api } from '../api/api-client';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';

const NOT_FOUND_STATUS = 404;

/** S-11's read's two answers of its own: a report this organization does not hold, and a reader who may not export. */
export const EXPORTS_READ = {
  REPORT_NOT_FOUND: 'report-not-found',
  /** A view-only member (182/22): the history and the re-download are refused as well as the request. */
  REFUSED: 'refused',
} as const;

export interface ReportExports {
  readonly status: typeof TENANT_READ.READY;
  readonly report: Report;
  /** Every language a file may be written in, each with its labels' standing at the report's pin (UX-47). */
  readonly languages: readonly ExportLanguage[];
  /** The page of the history the address names. */
  readonly history: IndexPage<Export>;
  /** Whether any export of the report has completed — what the filed mark waits for (§12.5.6's task-47 row (n)). */
  readonly exported: boolean;
  /** The account's export default (FR-52; task 52.3) — `null` where the profile could not be read. */
  readonly exportLocale: Locale | null;
}

export type ReportExportsRead =
  | { readonly status: typeof EXPORTS_READ.REPORT_NOT_FOUND }
  | { readonly status: typeof EXPORTS_READ.REFUSED; readonly report: Report }
  | ReportExports
  | TenantReadRefusal;

/** The api's refusal of a role — a view-only member — told apart from *not your organization*. */
const refusesTheRole = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.InsufficientRole;

/**
 * What S-11 draws (task 47.3): the report, the dialogue's languages, the page of the history the address asks, whether
 * the report has a completed export, and the language the dialogue starts in (47.2).
 *
 * **The api decides who may export, and the screen reads its answer**: the history's refusal of the role is the
 * view-only state, so no membership is read to guess it. Five reads, all at once — one round trip, not five in a row.
 */
export async function readReportExports(input: {
  readonly reportId: string;
  readonly history: ListQuery;
  readonly completed: ListQuery;
}): Promise<ReportExportsRead> {
  const base = `/reports/${input.reportId}`;
  const [report, languages, history, completed, profile] = await Promise.all([
    api.get<Report>(base),
    api.get<ExportLanguages>(`${base}/exports/languages`),
    api.getList<Export>(`${base}/exports`, input.history),
    api.getList<Export>(`${base}/exports`, input.completed),
    api.get<AccountProfile>('/account/profile'),
  ]);

  if (isPermissionRefusal(report)) return { status: TENANT_READ.FORBIDDEN };
  if (report.status === API_OUTCOME.Problem && report.problem.status === NOT_FOUND_STATUS) {
    return { status: EXPORTS_READ.REPORT_NOT_FOUND };
  }
  if (report.status !== API_OUTCOME.Ok || report.value === null) return { status: TENANT_READ.UNREACHABLE };
  if (refusesTheRole(history)) return { status: EXPORTS_READ.REFUSED, report: report.value };
  if (isPermissionRefusal(history)) return { status: TENANT_READ.FORBIDDEN };
  if (languages.status !== API_OUTCOME.Ok || history.status !== API_OUTCOME.Ok || completed.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  const page = input.history.page ?? 1;
  const pageSize = input.history.onpage ?? history.value.items.length;
  // A profile that cannot be read is not a dialogue that cannot open: it starts in the reader's own language instead.
  const exportLocale = profile.status === API_OUTCOME.Ok ? profile.value?.exportLocale : undefined;
  return {
    status: TENANT_READ.READY,
    report: report.value,
    languages: languages.value.languages,
    history: {
      rows: history.value.items,
      matched: history.value.total,
      total: history.value.unfiltered ?? history.value.total,
      page,
      pageSize,
    },
    exported: completed.value.total > 0,
    exportLocale: exportLocale !== undefined && isLocale(exportLocale) ? exportLocale : null,
  };
}
