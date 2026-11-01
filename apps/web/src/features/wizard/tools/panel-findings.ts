import type { ValidationFinding } from '@easyesg/contracts';
import { FINDING_WEIGHT, type FindingWeight } from '@easyesg/ui';
import { findingKey } from './finding-key';
import { weightOf } from './finding-weight';

/** S-08's filter over its findings (task 42.2) — the artboard's *All · Must fix · Review*. */
export const PANEL_FILTER = { ALL: 'all', MUST_FIX: 'must_fix', REVIEW: 'review' } as const;

export type PanelFilter = (typeof PANEL_FILTER)[keyof typeof PANEL_FILTER];

/** The weight each filter keeps, or `null` for every one. */
const WEIGHT_OF_FILTER: Readonly<Record<PanelFilter, FindingWeight | null>> = {
  [PANEL_FILTER.ALL]: null,
  [PANEL_FILTER.MUST_FIX]: FINDING_WEIGHT.MUST_FIX,
  [PANEL_FILTER.REVIEW]: FINDING_WEIGHT.REVIEW,
};

/** A finding as the panel lists it — its weight, and the key it is told apart by. */
export interface PanelFinding {
  readonly key: string;
  readonly finding: ValidationFinding;
  readonly weight: FindingWeight;
}

export interface PanelGroup {
  /** The module the findings are listed under, by the standard's own reference. */
  readonly module: string;
  readonly findings: readonly PanelFinding[];
}

export interface PanelFindings {
  readonly groups: readonly PanelGroup[];
  /** What each filter would show — the panel's counts are the last run's less what is cleared since (row (c)). */
  readonly counts: { readonly all: number; readonly mustFix: number; readonly review: number };
}

/**
 * **S-08's findings, grouped by module in the list's order** (task 42.2; UX-20; `architecture.md` §12.5.6's task-42 row
 * (c)) — the last run's, as it left them (182/26), each weighed (`weightOf`), and **one the answers held now no longer
 * raise is kept, weighed *cleared*** rather than removed: the artboard's *rows do not disappear mid-keystroke*.
 *
 * **A finding is listed once, under the first module in the list's order that presents its field** — an element B3 and
 * C3 share belongs to the reporter's first way to it. One whose field no module in the list presents is listed last,
 * under the module the read named, so nothing the run found is dropped from view.
 *
 * Pure, so the grouping, the counts and the filter are a spec: the caller passes the list's order and the cleared test.
 */
export function panelFindings(input: {
  readonly findings: readonly ValidationFinding[];
  /** The modules in the list's order — the report's scope (`modulesInScope`). */
  readonly moduleOrder: readonly string[];
  /** Whether the answers held now no longer raise this finding — the step's live verdicts' word (row (c)). */
  readonly cleared: (key: string) => boolean;
  readonly filter: PanelFilter;
}): PanelFindings {
  const listed = input.findings.map((finding): PanelFinding & { readonly module: string } => {
    const key = findingKey(finding);
    const listedUnder =
      input.moduleOrder.find((candidate) => finding.field.modules.includes(candidate)) ?? finding.field.modules[0] ?? '';
    return {
      key,
      finding,
      module: listedUnder,
      weight: input.cleared(key) ? FINDING_WEIGHT.CLEARED : weightOf(finding.verdict),
    };
  });
  const counts = {
    all: listed.length,
    mustFix: listed.filter(({ weight }) => weight === FINDING_WEIGHT.MUST_FIX).length,
    review: listed.filter(({ weight }) => weight === FINDING_WEIGHT.REVIEW).length,
  };
  const kept = WEIGHT_OF_FILTER[input.filter];
  const shown = kept === null ? listed : listed.filter(({ weight }) => weight === kept);
  const order = [...input.moduleOrder, ...new Set(shown.map(({ module }) => module))];
  const groups = [...new Set(order)]
    .map((module) => ({
      module,
      findings: shown
        .filter((entry) => entry.module === module)
        .map(({ key, finding, weight }) => ({ key, finding, weight })),
    }))
    .filter((group) => group.findings.length > 0);
  return { groups, counts };
}
