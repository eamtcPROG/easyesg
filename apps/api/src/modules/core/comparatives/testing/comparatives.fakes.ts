import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { PERIOD_TYPE } from '@api/contracts/taxonomy-registry.port';
import type {
  RegisteredTaxonomy,
  TaxonomyAxis,
  TaxonomyEnumeration,
  TaxonomyElement,
  TaxonomyPin,
  TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import type {
  PriorPeriodReadout,
  PriorPeriodStore,
  StoredPriorValue,
} from '../interfaces/prior-period-store.interface';

/** A readout the store would return, with only the parts a test cares about spelled out. */
export const readout = (over: Partial<PriorPeriodReadout> = {}): PriorPeriodReadout => ({
  taxonomyVersion: '2026-05-01',
  priorPeriodLinked: false,
  prior: null,
  ...over,
});

export const storedValue = (over: Partial<StoredPriorValue> = {}): StoredPriorValue => ({
  elementKey: 'NumberOfEmployeesInHeadcount',
  dimensionKey: '',
  ordinal: 0,
  valueNumeric: '42',
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: 'ok',
  ...over,
});

export class FakePriorPeriodStore implements PriorPeriodStore {
  constructor(private readonly answer: PriorPeriodReadout | null) {}

  readFor(): Promise<PriorPeriodReadout | null> {
    return Promise.resolve(this.answer);
  }
}

/** A taxonomy element with only the two fields comparability compares varied by a test. */
export const element = (over: Partial<TaxonomyElement> = {}): TaxonomyElement => ({
  key: 'NumberOfEmployeesInHeadcount',
  module: 'B8',
  section: 'B8',
  order: 1,
  parent: null,
  kind: DISCLOSURE_KIND.NUMERIC,
  xbrlType: 'decimalItemType',
  periodType: PERIOD_TYPE.INSTANT,
  domain: null,
  axes: [],
  ...over,
});

/**
 * A registry whose `element` answers **per version**, which is the whole point: comparability is a
 * statement about two versions, so a fake that cannot disagree with itself could not fail the tests
 * that matter.
 *
 * It also **records what it was asked**, because the easily-broken rule here is *which* version is
 * consulted for which side — swapped, every assertion below still passes.
 */
export class FakeElementRegistry implements TaxonomyRegistry {
  readonly askedFor: { version: string; key: string }[] = [];

  constructor(private readonly byVersion: Record<string, TaxonomyElement | null>) {}

  element(query: { standard: string; version: string; key: string }): TaxonomyElement | null {
    this.askedFor.push({ version: query.version, key: query.key });
    return this.byVersion[query.version] ?? null;
  }

  pinFor(): TaxonomyPin | null {
    return null;
  }

  registeredVersions(): readonly string[] {
    return Object.keys(this.byVersion);
  }

  taxonomy(): RegisteredTaxonomy | null {
    return null;
  }

  enumeration(): TaxonomyEnumeration | null {
    return null;
  }

  axis(): TaxonomyAxis | null {
    return null;
  }
}
