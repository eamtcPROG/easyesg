import type { ReportingPeriod } from '@easyesg/contracts';
import { periodStanding, type PeriodStanding } from '@/features/periods/tools/periods';

/**
 * S-13's way into S-14 — each entity's periods, as the list's periods column and the record's side panel name them
 * (`design_spec.md` §5, S-13's exits: *"S-14 for the entity's periods"*; amended 29 Sep 2026).
 *
 * **Pure, and carrying no `server-only`**, which is `entities.ts`'s split: the grouping, the order and the cut are rules
 * over data somebody else fetched, so each is a unit spec rather than a browser journey.
 *
 * **The standing is S-14's**, read through `periodStanding` rather than restated: the two screens draw the same period,
 * and a second comparison against the lock is a second place they could disagree about it.
 */
export interface EntityPeriod {
  readonly id: string;
  readonly fiscalYear: number;
  readonly standing: PeriodStanding;
}

/**
 * How many periods each surface names before it counts the rest — the artboards' own: two in the list's cell, three in
 * the record's panel. An entity files once a year, so the cut keeps a row to one line and the panel short, and the
 * whole list is one press away on S-14 either way.
 */
export const PERIODS_NAMED = { COLUMN: 2, PANEL: 3 } as const;

/**
 * One entity's periods, **newest year first**, which is the order a reporter looks for — this year's filing is the one
 * in hand. Sorted here rather than trusted from the api's order, because the cut below keeps the head of the list and
 * would name the wrong years if an answer ever arrived in another order.
 */
export const toEntityPeriods = (periods: readonly ReportingPeriod[]): EntityPeriod[] =>
  periods
    .map((period) => ({ id: period.id, fiscalYear: period.fiscalYear, standing: periodStanding(period) }))
    .toSorted((left, right) => right.fiscalYear - left.fiscalYear);

/**
 * The organization's periods, grouped by the entity each belongs to — the list's column from **one** `GET /periods`,
 * which answers the organization when no entity is named, rather than one read per row. An entity with no periods has
 * no entry, and the caller reads that as none.
 */
export const periodsByEntity = (
  periods: readonly ReportingPeriod[],
): ReadonlyMap<string, readonly EntityPeriod[]> => {
  const grouped = new Map<string, ReportingPeriod[]>();
  for (const period of periods) {
    const held = grouped.get(period.reportingEntityId);
    if (held) held.push(period);
    else grouped.set(period.reportingEntityId, [period]);
  }
  return new Map([...grouped].map(([entityId, held]) => [entityId, toEntityPeriods(held)]));
};

/** The newest `named` periods, and how many older ones the surface counts instead of naming. */
export const newestPeriods = (input: {
  readonly periods: readonly EntityPeriod[];
  readonly named: number;
}): { readonly named: readonly EntityPeriod[]; readonly more: number } => ({
  named: input.periods.slice(0, input.named),
  more: Math.max(0, input.periods.length - input.named),
});
