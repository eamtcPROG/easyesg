import 'server-only';
import type { CalcFigures, Calculator, DisclosureModuleSummary, Report } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';
import { readActiveMembership } from './memberships';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';
import { readOnlyCauseOf, type ReadOnlyCause } from './wizard';

/**
 * S-09's reads (task 39.1): the calculator as it opens, and what the wizard shell around it needs — the report for
 * the bar, the module list for the rail, and whether anything may be written (UX-13).
 *
 * **Read together, as S-07's are** (`wizard.ts`): the rail is persistent beside the calculator (UX-5), so a page that
 * read the shell after the lines would move the layout under the reader. The step read is not among them — S-09 is a
 * sub-flow of B3, not B3's fields, and `GET …/calculator` already carries everything a line may say.
 */
export type CalculatorRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly modules: readonly DisclosureModuleSummary[];
      readonly report: Report;
      readonly calculator: Calculator;
      /** `null` where the reader may write — S-07's own causes, by S-07's own rule. */
      readonly readOnly: ReadOnlyCause | null;
    }
  | TenantReadRefusal;

export async function readCalculator(reportId: string): Promise<CalculatorRead> {
  // Independent, so they do not queue (`async-parallel`); the membership read is the global tier's `cache()`d one.
  const [modules, report, calculator, membership] = await Promise.all([
    api.getList<DisclosureModuleSummary>(`/reports/${reportId}/modules`),
    api.get<Report>(`/reports/${reportId}`),
    api.get<Calculator>(`/reports/${reportId}/calculator`),
    readActiveMembership(),
  ]);

  if (isPermissionRefusal(modules) || isPermissionRefusal(report) || isPermissionRefusal(calculator)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (
    modules.status !== API_OUTCOME.Ok ||
    report.status !== API_OUTCOME.Ok ||
    calculator.status !== API_OUTCOME.Ok
  ) {
    return { status: TENANT_READ.UNREACHABLE };
  }
  return {
    status: TENANT_READ.READY,
    modules: modules.value.items,
    report: report.value,
    calculator: calculator.value,
    readOnly: readOnlyCauseOf({ report: report.value, role: membership?.role ?? null }),
  };
}

/**
 * The figures B3 took from the calculator (task 39.3): the latest run, for B3's two scope fields — an overridden scope
 * shows the computed figure it superseded beside the substitute (UX-43). **`null` where the read fails**, and the field
 * still renders: the substitute and its reason are the field's own, and only the superseded figure goes unshown.
 */
export async function readCalcFigures(reportId: string): Promise<CalcFigures | null> {
  const figures = await api.get<CalcFigures>(`/reports/${reportId}/calculator/figures`);
  return figures.status === API_OUTCOME.Ok ? figures.value : null;
}
