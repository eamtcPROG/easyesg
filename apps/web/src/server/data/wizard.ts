import 'server-only';
import {
  MEMBERSHIP_ROLE,
  REPORT_STATUS,
  type DisclosureModuleSummary,
  type DisclosureStep,
  type MembershipRole,
  type Report,
} from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api-client';
import { readActiveMembership } from '../memberships';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-07's reads (task 35.1) over task 89's routes — and, from task 35.2, the report itself.
 *
 * **The module list, the step and the report are read together for one step**, and that is not a
 * round-trip saving: UX-5 makes the list persistent beside the step, so a page that fetched them in
 * sequence would render the rail after the fields and move the whole layout under the reader.
 *
 * **The report is read for one field.** UX-13 requires a read-only screen to name *which* of three
 * causes applies, and a locked period (UC-57) is only visible on the report's `status` — the step
 * read carries values and says nothing about whether they may still change.
 */

/**
 * Why S-07 is read-only, where it is — UX-13's three causes, named rather than collapsed.
 *
 * **Two of the three are reachable today.** A locked period is the report's status; a view-only
 * membership is the caller's role in the active organization. The third, a suspended entitlement
 * (UC-142), is task 54's and is absent from the vocabulary rather than present and unreachable —
 * a cause with no producer would be a screen state nothing can enter.
 */
export const READ_ONLY_CAUSE = {
  /** UC-57: the reporting period is locked, so the report takes no writes from anyone (FR-22). */
  LOCKED: 'locked',
  /** A view-only membership (UC-17): the same screens without the edit affordances. */
  VIEWER: 'viewer',
} as const;

export type ReadOnlyCause = (typeof READ_ONLY_CAUSE)[keyof typeof READ_ONLY_CAUSE];

export type WizardStepRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly modules: readonly DisclosureModuleSummary[];
      readonly step: DisclosureStep;
      readonly report: Report;
      /** `null` where the reader may write. */
      readonly readOnly: ReadOnlyCause | null;
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readWizardStep(input: {
  readonly reportId: string;
  readonly module: string;
}): Promise<WizardStepRead> {
  // Independent, so they do not queue (`async-parallel`). All tenant-scoped by the session; the
  // membership read is React-`cache()`d and shared with the global tier's own call.
  const [modules, step, report, membership] = await Promise.all([
    api.getList<DisclosureModuleSummary>(`/reports/${input.reportId}/modules`),
    api.get<DisclosureStep>(
      `/reports/${input.reportId}/modules/${encodeURIComponent(input.module)}`,
    ),
    api.get<Report>(`/reports/${input.reportId}`),
    readActiveMembership(),
  ]);

  if (isPermissionRefusal(modules) || isPermissionRefusal(step) || isPermissionRefusal(report)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (
    modules.status !== API_OUTCOME.Ok ||
    step.status !== API_OUTCOME.Ok ||
    report.status !== API_OUTCOME.Ok
  ) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return {
    status: TENANT_READ.READY,
    modules: modules.value.items,
    step: step.value,
    report: report.value,
    readOnly: readOnlyCauseOf({ report: report.value, role: membership?.role ?? null }),
  };
}

/**
 * The lock outranks the role: a locked period is read-only for the administrator too (task 31.2's
 * "the lock is not a role gate"), so it is the cause named even when the reader is also a viewer.
 */
export function readOnlyCauseOf(input: {
  readonly report: Pick<Report, 'status'>;
  /** The contract's own union, never `string` — a renamed role must fail here, not read as editable. */
  readonly role: MembershipRole | null;
}): ReadOnlyCause | null {
  if (input.report.status === REPORT_STATUS.LOCKED) return READ_ONLY_CAUSE.LOCKED;
  if (input.role === MEMBERSHIP_ROLE.VIEWER) return READ_ONLY_CAUSE.VIEWER;
  return null;
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
