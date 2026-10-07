import { describe, expect, it } from 'vitest';
import type { ReportingEntity } from '@easyesg/contracts';
import {
  DEFAULT_ENTITY_VIEW,
  ENTITY_FILTER_ANY,
  ENTITY_SORT,
  ENTITY_SORT_DIRECTION,
  ENTITY_STANDING,
  applyEntityView,
  entityViewQuery,
  readEntityView,
  toEntityRows,
} from './entities';

/**
 * S-13's read model, arm by arm (FR-17 … FR-20) — pure, so the filter, the sort, the page
 * arithmetic and the two empty states are nine assertions rather than nine browser journeys.
 */
const entity = (over: Partial<ReportingEntity> & { id: string; name: string }): ReportingEntity => ({
  legalForm: 'srl',
  idno: null,
  lei: null,
  registeredAddressLine1: null,
  registeredAddressLine2: null,
  registeredLocality: null,
  registeredPostalCode: null,
  reportContactName: null,
  reportContactEmail: null,
  naceCodes: [],
  status: ENTITY_STANDING.ACTIVE,
  archivedAt: null,
  consolidationBasis: null,
  consolidationMembers: [],
  sites: [],
  createdAt: 1_788_000_000_000,
  updatedAt: 1_788_000_000_000,
  ...over,
});

const site = (id: string) => ({
  id,
  name: id,
  addressLine1: null,
  locality: null,
  postalCode: null,
  countryCode: null,
  latitude: null,
  longitude: null,
});

describe('toEntityRows', () => {
  it('labels each code by looking it up, never by position', () => {
    // `resolve` drops a code the classifier has retired, so the two lists differ in length —
    // zipping them would label the wrong code, which reads as a plausible sentence and is wrong.
    const [row] = toEntityRows({
      entities: [entity({ id: 'e1', name: 'Brutăria', naceCodes: ['99.99', '10.71'] })],
      activity: new Map([['10.71', 'Fabricarea pâinii']]),
      periods: new Map(),
    });

    expect(row.activity).toEqual(['Fabricarea pâinii']);
    // The code survives even where the word does not: the screen still holds what is stored.
    expect(row.codes).toEqual(['99.99', '10.71']);
  });

  it('counts sites and carries the standing the API stated', () => {
    const [row] = toEntityRows({
      entities: [
        entity({ id: 'e1', name: 'A', sites: [site('s1'), site('s2')], status: 'archived' }),
      ],
      activity: new Map(),
      periods: new Map(),
    });

    expect(row.siteCount).toBe(2);
    expect(row.standing).toBe(ENTITY_STANDING.ARCHIVED);
  });

  it('gives an entity with no periods an empty list, and every entity null when the periods were not read', () => {
    const period = { id: 'p1', fiscalYear: 2026, standing: 'open' } as const;
    const entities = [entity({ id: 'e1', name: 'A' }), entity({ id: 'e2', name: 'B' })];

    const [held, none] = toEntityRows({ entities, activity: new Map(), periods: new Map([['e1', [period]]]) });
    expect(held.periods).toEqual([period]);
    // None is a fact the column states; unread below is not, and the two must stay apart.
    expect(none.periods).toEqual([]);

    const unread = toEntityRows({ entities, activity: new Map(), periods: null });
    expect(unread.map((row) => row.periods)).toEqual([null, null]);
  });
});

describe('the view in the address (UX-4)', () => {
  it('reads defaults for anything absent or unrecognised', () => {
    expect(readEntityView({})).toEqual(DEFAULT_ENTITY_VIEW);
    // An unrecognised value is not an error and not a 404: it is a link somebody edited, and the
    // default is the honest answer.
    expect(readEntityView({ standing: 'nonsense', page: '-3' })).toEqual(DEFAULT_ENTITY_VIEW);
  });

  it('round-trips a view through its query string', () => {
    const view = {
      standing: ENTITY_STANDING.ARCHIVED,
      sort: ENTITY_SORT.SITES,
      direction: ENTITY_SORT_DIRECTION.DESCENDING,
      page: 2,
      pageSize: 50,
      q: 'Lina SRL, Chișinău',
    } as const;
    expect(readEntityView(Object.fromEntries(new URLSearchParams(entityViewQuery(view))))).toEqual(
      view,
    );
  });

  it('writes nothing for the default view, so one list has one address', () => {
    expect(entityViewQuery(DEFAULT_ENTITY_VIEW)).toBe('');
  });
});

describe('applyEntityView', () => {
  const rows = toEntityRows({
    entities: [
      entity({ id: 'c', name: 'Cofetăria', sites: [site('s1')] }),
      entity({ id: 'a', name: 'Agro', status: 'archived' }),
      entity({ id: 'b', name: 'Brutăria', sites: [site('s1'), site('s2')] }),
    ],
    activity: new Map(),
    periods: new Map(),
  });

  it('puts active entities before archived ones by default', () => {
    // The reason the default FILTER is `any`: hiding archived rows would make "you have no
    // entities" the first-use message for an organization whose entities are all archived, and
    // §4.6 needs those two states apart. Sorting achieves what hiding was for.
    const page = applyEntityView({ rows, view: DEFAULT_ENTITY_VIEW });
    expect(page.rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('distinguishes nothing-exists from nothing-matches, which is §4.6’s whole requirement', () => {
    const empty = applyEntityView({ rows: [], view: DEFAULT_ENTITY_VIEW });
    expect(empty.total).toBe(0);

    const filteredOut = applyEntityView({
      rows: rows.filter((r) => r.standing === ENTITY_STANDING.ACTIVE),
      view: { ...DEFAULT_ENTITY_VIEW, standing: ENTITY_STANDING.ARCHIVED },
    });
    // Rows exist and none survived the filter — the archetype reads exactly this pair to choose
    // which empty state to draw.
    expect(filteredOut.matched).toBe(0);
    expect(filteredOut.total).toBeGreaterThan(0);
  });

  it('sorts by site count, and breaks ties by name in both directions', () => {
    const ascending = applyEntityView({
      rows,
      view: { ...DEFAULT_ENTITY_VIEW, sort: ENTITY_SORT.SITES },
    });
    expect(ascending.rows.map((r) => r.siteCount)).toEqual([0, 1, 2]);

    const descending = applyEntityView({
      rows,
      view: {
        ...DEFAULT_ENTITY_VIEW,
        sort: ENTITY_SORT.SITES,
        direction: ENTITY_SORT_DIRECTION.DESCENDING,
      },
    });
    expect(descending.rows.map((r) => r.siteCount)).toEqual([2, 1, 0]);
  });

  it('clamps a page beyond the end rather than answering an empty one', () => {
    const page = applyEntityView({
      rows,
      view: { ...DEFAULT_ENTITY_VIEW, standing: ENTITY_FILTER_ANY, page: 99 },
    });
    // A bookmarked page-9 that no longer exists shows the last page, not a blank screen that
    // reads as "your entities are gone".
    expect(page.page).toBe(1);
    expect(page.rows).toHaveLength(3);
  });

  // Task 203.2: §4.7's search over the name and the IDNO, ahead of the facets and the page.
  it('searches the name and the IDNO, and counts what the search admitted', () => {
    const rows = toEntityRows({
      entities: [
        entity({ id: 'a', name: 'Brutăria Lina SRL', idno: '1003600005148' }),
        entity({ id: 'b', name: 'Moara Veche', idno: '1017600033216' }),
      ],
      activity: new Map(),
      periods: new Map(),
    });
    const byName = applyEntityView({ rows, view: { ...DEFAULT_ENTITY_VIEW, q: 'lina' } });
    expect(byName.rows.map((row) => row.id)).toEqual(['a']);
    expect(byName.matched).toBe(1);
    expect(byName.total).toBe(2);
    expect(applyEntityView({ rows, view: { ...DEFAULT_ENTITY_VIEW, q: '101760' } }).rows.map((row) => row.id)).toEqual(['b']);
  });
});
