import { LABEL_STANDING, type DisclosureLabel } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import {
  PERIOD_TYPE,
  type TaxonomyAxis,
  type TaxonomyElement,
  type TaxonomyEnumeration,
  type TaxonomyMember,
} from '@api/contracts/taxonomy-registry.port';
import {
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  NO_DIMENSION,
  type DisclosureValue,
} from '../models/disclosure-value.model';

/**
 * The shapes the step read's pure parts and resolvers are specified over — a stored value, an element, an axis, a
 * member, an enumeration, a label — each with only what a case varies spelled out.
 *
 * **Shared because several specs build them** (task 133.2), each over a different rule, and a builder written per spec is
 * a copy that drifts from the type the day a field is added. The specs written before this file keep their own.
 */

export const aStoredValue = (
  over: Partial<DisclosureValue> & Pick<DisclosureValue, 'elementKey'>,
): DisclosureValue => ({
  id: '01930000-0000-7000-8000-000000000001',
  reportId: '01930000-0000-7000-8000-0000000000ff',
  dimensionKey: NO_DIMENSION,
  ordinal: 0,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  explanation: null,
  overriddenBy: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

export const anElement = (over: Partial<TaxonomyElement> & Pick<TaxonomyElement, 'key'>): TaxonomyElement => ({
  modules: ['B1'],
  section: 'B1',
  order: 1,
  parent: null,
  kind: DISCLOSURE_KIND.TEXT,
  xbrlType: 'stringItemType',
  periodType: PERIOD_TYPE.DURATION,
  domain: null,
  axes: [],
  unitCodes: [],
  ...over,
});

export const aMember = (over: Partial<TaxonomyMember> & Pick<TaxonomyMember, 'key'>): TaxonomyMember => ({
  code: null,
  hazardous: null,
  parent: null,
  labels: {},
  ...over,
});

export const anAxis = (over: Partial<TaxonomyAxis> & Pick<TaxonomyAxis, 'key'>): TaxonomyAxis => ({
  typed: false,
  defaultMember: null,
  members: [],
  memberTaxonomy: null,
  ...over,
});

export const anEnumeration = (
  over: Partial<TaxonomyEnumeration> & Pick<TaxonomyEnumeration, 'key' | 'taxonomy'>,
): TaxonomyEnumeration => ({
  external: null,
  members: [],
  ...over,
});

/** A catalogue entry, official unless a case says otherwise. */
export const aLabel = (text: string, standing: DisclosureLabel['standing'] = LABEL_STANDING.OFFICIAL): DisclosureLabel => ({
  text,
  standing,
});
