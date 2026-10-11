import { supersedingPin } from './superseding-pin';

const adopted = (taxonomyVersion: string, templateVersion: string) => ({ standard: 'vsme', taxonomyVersion, templateVersion });

/** FR-51's *superseded* (task 47; §12.5.6's task-47 row (6)): the pin differs from what a new report would pin today. */
describe('supersedingPin', () => {
  it('names the adopted versions where either differs from the report’s pin', () => {
    expect(supersedingPin({ report: { taxonomyVersion: '2026-02-01', templateVersion: '1.2.0' }, adopted: adopted('2026-05-01', '1.3.0') })).toEqual({
      taxonomyVersion: '2026-05-01',
      templateVersion: '1.3.0',
    });
    expect(supersedingPin({ report: { taxonomyVersion: '2026-05-01', templateVersion: '1.2.0' }, adopted: adopted('2026-05-01', '1.3.0') })).toEqual({
      taxonomyVersion: '2026-05-01',
      templateVersion: '1.3.0',
    });
  });

  it('answers none for a current pin, and for a registry with nothing adopted', () => {
    expect(supersedingPin({ report: { taxonomyVersion: '2026-05-01', templateVersion: '1.3.0' }, adopted: adopted('2026-05-01', '1.3.0') })).toBeNull();
    expect(supersedingPin({ report: { taxonomyVersion: '2026-05-01', templateVersion: '1.3.0' }, adopted: null })).toBeNull();
  });
});
