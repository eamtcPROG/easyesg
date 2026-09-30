/**
 * Where S-14 was opened from, so its arrow returns there — §11.5's *Back-to-context*, built 30 Sep 2026 for S-14
 * (project owner: back to the list of entities from the list, back to the entity from the entity). The breadcrumb
 * still names where the page sits; the arrow follows the reader.
 *
 * **A closed set in the address, never a path**: the link that opens S-14 names its origin, S-14 carries it through
 * its own list, record and create form, and the arrow resolves it to an address it builds itself — so a doctored
 * link can choose among these three and send the reader nowhere else. Absent, the arrow leads one level up.
 */
export const PERIODS_FROM = {
  /** S-13's list — the periods cell or the row's *periods* button. */
  ENTITIES: 'entities',
  /** S-13's record — its side panel. */
  ENTITY: 'entity',
  /** S-06's new-report flow, which sends a reader here when the chosen entity has no period to report on. */
  NEW_REPORT: 'new-report',
} as const;

export type PeriodsFrom = (typeof PERIODS_FROM)[keyof typeof PERIODS_FROM];

/** The address parameter that carries it. */
export const PERIODS_FROM_PARAM = 'from';

const ORIGINS: readonly string[] = Object.values(PERIODS_FROM);

/** The origin a query value names, or null for anything else — absent, repeated or not one of the three. */
export const readPeriodsFrom = (value: string | string[] | undefined): PeriodsFrom | null =>
  typeof value === 'string' && ORIGINS.includes(value) ? (value as PeriodsFrom) : null;
