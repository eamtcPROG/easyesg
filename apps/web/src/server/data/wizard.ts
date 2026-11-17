import 'server-only';
import {
  ENTITY_STATUS,
  MEMBERSHIP_ROLE,
  type DisclosureModuleSummary,
  type DisclosureStep,
  type MembershipRole,
  type PriorPeriodComparatives,
  type Report,
  type ReportScope,
  type StepPage,
  type Validation,
} from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '../api/api-client';
import { readActiveMembership } from './memberships';
import { admittedRules, type InlineRules } from './validation';
import {
  TENANT_READ,
  isNotFound,
  isPermissionRefusal,
  type TenantReadNotFound,
  type TenantReadRefusal,
} from './tenant-read';

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
 * **Two of the three are reachable today.** A locked period is the report's `locked` — never its status, which reads
 * `filed` over the lock since task 47.5; a view-only membership is the caller's role in the active organization. The
 * third, a suspended entitlement
 * (UC-142), is task 54's and is absent from the vocabulary rather than present and unreachable —
 * a cause with no producer would be a screen state nothing can enter.
 */
export const READ_ONLY_CAUSE = {
  /**
   * The report's entity is archived (FR-20 behaviour 7; task 214): read-only for everyone, for good — nothing restores
   * editing, there being no un-archive — while it can still be checked, exported and marked filed.
   */
  ARCHIVED: 'archived',
  /** UC-57: the reporting period is locked, so the report takes no writes from anyone (FR-22). */
  LOCKED: 'locked',
  /** A view-only membership (UC-17): the same screens without the edit affordances. */
  VIEWER: 'viewer',
} as const;

export type ReadOnlyCause = (typeof READ_ONLY_CAUSE)[keyof typeof READ_ONLY_CAUSE];

export const WIZARD_READ = {
  MODULE_NOT_FOUND: 'module-not-found',
} as const;

export type WizardStepRead =
  | { readonly status: typeof WIZARD_READ.MODULE_NOT_FOUND }
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly modules: readonly DisclosureModuleSummary[];
      readonly step: DisclosureStep;
      readonly report: Report;
      /** Last year's answers for the step's own fields (FR-45, FR-46; task 34.3's read, narrowed by task 244). */
      readonly prior: PriorPeriodComparatives;
      /** What the last run found (task 42.2). */
      readonly validation: Validation;
      /**
       * The rules the browser evaluates the step against live (task 42.1), admitted — `null` where none can be read:
       * validation is an aid, never a precondition of answering.
       */
      readonly rules: InlineRules | null;
      /** `null` where the reader may write. */
      readonly readOnly: ReadOnlyCause | null;
    }
  | TenantReadNotFound
  | TenantReadRefusal;

/** The status the step read refuses a Comprehensive module on a Basic report with (task 78.1) — its only conflict. */
const OUT_OF_SCOPE_STATUS = 409;

const isOutOfScope = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && outcome.problem.status === OUT_OF_SCOPE_STATUS;

export async function readWizardStep(input: {
  readonly reportId: string;
  readonly module: string;
}): Promise<WizardStepRead> {
  // **One request for the step and everything read beside it** (task 244; `architecture.md` §12.5.6's task-244 row
  // (6)): separate reads in parallel each paid the api's fixed cost per request and read the report again. The
  // membership read is React-`cache()`d and shared with the global tier's own call, so it costs nothing here.
  const [page, membership] = await Promise.all([
    api.get<StepPage>(`/reports/${input.reportId}/steps/${encodeURIComponent(input.module)}`),
    readActiveMembership(),
  ]);

  if (isPermissionRefusal(page)) return { status: TENANT_READ.FORBIDDEN };
  // A report the organization does not hold — unknown, or deleted (FR-210; task 192) — or a module its pinned taxonomy
  // does not carry (task 183): both the api's 404, and both the 404 screen, never *try again*.
  if (isNotFound(page)) return { status: TENANT_READ.NOT_FOUND };
  // A Comprehensive module on a Basic report (task 78.1) — answered as a module the report does not carry.
  if (isOutOfScope(page)) return { status: WIZARD_READ.MODULE_NOT_FOUND };
  if (page.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  const { report, modules, step, prior, validation, rules } = page.value;
  return {
    status: TENANT_READ.READY,
    modules,
    step,
    report,
    prior,
    validation,
    rules: admittedRules(rules),
    readOnly: readOnlyCauseOf({ report, role: membership?.role ?? null }),
  };
}

/**
 * The lock outranks the role: a locked period is read-only for the administrator too (task 31.2's
 * "the lock is not a role gate"), so it is the cause named even when the reader is also a viewer. **The archive
 * outranks the lock** (task 214; §12.5.6's task-214 row (a)): reopening an archived entity's period restores no
 * editing, so naming the lock would name a remedy that does not work.
 */
export function readOnlyCauseOf(input: {
  /** `locked`, never the status: a filed report reads `filed` over its period's lock (task 47.5). */
  readonly report: Pick<Report, 'locked'> & { readonly subject: Pick<Report['subject'], 'entityStatus'> };
  /** The contract's own union, never `string` — a renamed role must fail here, not read as editable. */
  readonly role: MembershipRole | null;
}): ReadOnlyCause | null {
  if (input.report.subject.entityStatus === ENTITY_STATUS.ARCHIVED) return READ_ONLY_CAUSE.ARCHIVED;
  if (input.report.locked) return READ_ONLY_CAUSE.LOCKED;
  if (input.role === MEMBERSHIP_ROLE.VIEWER) return READ_ONLY_CAUSE.VIEWER;
  return null;
}

export type WizardModulesRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly modules: readonly DisclosureModuleSummary[];
      /** The report's scope, which decides which of `modules` it asks (task 179.3; FR-177). */
      readonly scope: ReportScope;
    }
  | TenantReadRefusal;

/**
 * The list and the report's scope — what the entry segment needs to choose a step (UX-10). The scope since task 179.3:
 * the api serves every module of the pinned taxonomy, and a Basic report must not be sent to a C module it does not
 * ask. Independent reads, so they do not queue (`async-parallel`).
 */
export async function readWizardModules(reportId: string): Promise<WizardModulesRead> {
  const [modules, report] = await Promise.all([
    api.getList<DisclosureModuleSummary>(`/reports/${reportId}/modules`),
    api.get<Report>(`/reports/${reportId}`),
  ]);
  if (isPermissionRefusal(modules) || isPermissionRefusal(report)) return { status: TENANT_READ.FORBIDDEN };
  if (modules.status !== API_OUTCOME.Ok || report.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }
  return { status: TENANT_READ.READY, modules: modules.value.items, scope: report.value.scope };
}

/**
 * Where a returning reporter lands (task 35.3; UC-36, FR-39, UX-10, UX-39).
 *
 * **Where work last happened, else the first incomplete step, else the first.** FR-39 restores
 * *"wizard position … regardless of the device"*, and UX-10 says opening a report lands on *"the
 * first incomplete step, not at the beginning"*. One rule reconciles them (project owner,
 * 2 Sep 2026): the module with the most recent answer is where work stopped, on whichever device
 * it stopped; a report nobody has answered yet has no such module, and UX-10's rule is what
 * remains. Nothing records anyone's position separately — the values carry it, which is why a
 * second device sees the same answer as the first.
 *
 * **First incomplete in the standard's order, and the list already arrives in it** — the api
 * returns modules in the taxonomy's own order, so this is a scan rather than a sort. A completed
 * report with no answers newer than another's resolves to its first module: there is no incomplete
 * step to open, and refusing to resolve one would leave the entry segment with nowhere to send
 * anybody.
 *
 * **A tie goes to the earlier module in the standard's order**, and ties are real rather than
 * theoretical: `updated_at` is the transaction's `now()`, so one FR-38 queue flush spanning two
 * modules stamps both with the same millisecond. Strict `>` over a list already in the taxonomy's
 * order is what makes the answer deterministic; `>=` would hand the reporter to whichever module
 * the flush happened to list last.
 */
export function resumeModule(modules: readonly DisclosureModuleSummary[]): string | undefined {
  // Not named `module`: Next reserves that identifier (the entry page records the same).
  let latest: { readonly module: string; readonly at: number } | undefined;
  for (const summary of modules) {
    if (summary.lastAnsweredAt === null) continue;
    if (latest === undefined || summary.lastAnsweredAt > latest.at) {
      latest = { module: summary.module, at: summary.lastAnsweredAt };
    }
  }
  return latest?.module ?? (modules.find((m) => m.answered < m.total) ?? modules[0])?.module;
}
