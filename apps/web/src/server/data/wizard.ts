import 'server-only';
import type { DisclosureModuleSummary, DisclosureStep } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api-client';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-07's reads (task 35.1) over task 89's routes.
 *
 * **The module list and the step are read together for one step**, and that is not a round-trip
 * saving: UX-5 makes the list persistent beside the step, so a page that fetched them in sequence
 * would render the rail after the fields and move the whole layout under the reader.
 */
export type WizardStepRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly modules: readonly DisclosureModuleSummary[];
      readonly step: DisclosureStep;
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readWizardStep(input: {
  readonly reportId: string;
  readonly module: string;
}): Promise<WizardStepRead> {
  // Independent, so they do not queue (`async-parallel`). Both are tenant-scoped by the session.
  const [modules, step] = await Promise.all([
    api.getList<DisclosureModuleSummary>(`/reports/${input.reportId}/modules`),
    api.get<DisclosureStep>(
      `/reports/${input.reportId}/modules/${encodeURIComponent(input.module)}`,
    ),
  ]);

  if (isPermissionRefusal(modules) || isPermissionRefusal(step)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (modules.status !== API_OUTCOME.Ok || step.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }
  return { status: TENANT_READ.READY, modules: modules.value.items, step: step.value };
}

export type WizardModulesRead =
  | { readonly status: typeof TENANT_READ.READY; readonly modules: readonly DisclosureModuleSummary[] }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

/** The list alone — what the entry segment needs to choose a step (UX-10). */
export async function readWizardModules(reportId: string): Promise<WizardModulesRead> {
  const modules = await api.getList<DisclosureModuleSummary>(`/reports/${reportId}/modules`);
  if (isPermissionRefusal(modules)) return { status: TENANT_READ.FORBIDDEN };
  if (modules.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };
  return { status: TENANT_READ.READY, modules: modules.value.items };
}

/**
 * UX-10: *"Opening a report shall place the user at the first incomplete step, not at the
 * beginning."*
 *
 * **First incomplete in the standard's order, and the list already arrives in it** — the api returns
 * modules in the taxonomy's own order, so this is a scan rather than a sort. A completed report
 * resolves to its first module: there is no incomplete step to open, and refusing to resolve one
 * would leave the entry segment with nowhere to send anybody.
 */
export function firstIncompleteModule(
  modules: readonly DisclosureModuleSummary[],
): string | undefined {
  return (modules.find((module) => module.answered < module.total) ?? modules[0])?.module;
}
