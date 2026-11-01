import { describe, expect, it } from 'vitest';
import { writeKey } from './autosave-state';
import { fieldAnchor, fieldHref } from './field-anchor';

describe('fieldAnchor', () => {
  it('is the field’s natural key, with what an id may not carry made a hyphen', () => {
    expect(fieldAnchor(writeKey({ elementKey: 'Turnover', dimensionKey: '', ordinal: 0 }))).toBe('disclosure-Turnover--0');
    expect(fieldAnchor(writeKey({ elementKey: 'AddressOfSite', dimensionKey: 'SiteAxis', ordinal: 2 }))).toBe(
      'disclosure-AddressOfSite-SiteAxis-2',
    );
  });

  it('tells two rows of one element apart', () => {
    const first = fieldAnchor(writeKey({ elementKey: 'AddressOfSite', dimensionKey: 'SiteAxis', ordinal: 0 }));
    const second = fieldAnchor(writeKey({ elementKey: 'AddressOfSite', dimensionKey: 'SiteAxis', ordinal: 1 }));
    expect(first).not.toBe(second);
  });
});

describe('fieldHref', () => {
  it('is the step’s address with the field’s anchor', () => {
    expect(
      fieldHref({ reportId: 'r-1', module: 'B1', field: { elementKey: 'Turnover', dimensionKey: '', ordinal: 0 } }),
    ).toBe('/reports/r-1/B1#disclosure-Turnover--0');
  });
});
