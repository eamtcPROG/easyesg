import 'server-only';
import type { DisclosureModuleSummary, Report, Validation } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';
import { readValidation } from './validation';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';

/**
 * How far one report has come, module by module — S-05's resume card (task 255), which draws the artboard's strip
 * of B1 … B11 and *you stopped in B8*.
 *
 * **The three reads S-07 makes for its list, and no fourth.** The report names the scope (which modules it asks) and
 * the title; the module summaries say what is answered and where work last happened (`resumeModule`); the last
 * validation run says which modules it found complete or needing a fix (`moduleStateOf`). They are independent, so
 * they run together (`async-parallel`).
 *
 * **Validation degrades to `null` and the card still draws**, as on the step (`validation.ts` says why): a module no
 * run has checked is *not checked yet*, which is true. The other two are the card's substance, so either failing is
 * the card's own unreachable state rather than a strip of guesses.
 */
export type ReportProgressRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly report: Report;
      readonly modules: readonly DisclosureModuleSummary[];
      readonly validation: Validation | null;
    }
  | TenantReadRefusal;

export async function readReportProgress(reportId: string): Promise<ReportProgressRead> {
  const [report, modules, validation] = await Promise.all([
    api.get<Report>(`/reports/${reportId}`),
    api.getList<DisclosureModuleSummary>(`/reports/${reportId}/modules`),
    readValidation(reportId),
  ]);
  if (isPermissionRefusal(report) || isPermissionRefusal(modules)) return { status: TENANT_READ.FORBIDDEN };
  if (report.status !== API_OUTCOME.Ok || modules.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }
  return { status: TENANT_READ.READY, report: report.value, modules: modules.value.items, validation };
}
