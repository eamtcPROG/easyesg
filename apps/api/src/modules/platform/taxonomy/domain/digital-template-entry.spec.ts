import { digitalTemplateRefusal, readDigitalTemplateEntry } from './digital-template-entry';

describe('a Digital Template registration (task 45.3)', () => {
  const entry = {
    taxonomyVersion: '2026-05-01',
    file: 'VSME-Digital-Template-1.3.0.xlsx',
    sha256: '6652336d63ea523bb57dfb87d4f96ea5f032c82fa05f5a9b594223cfaa87df6e',
    source: 'https://xbrl.efrag.org/downloads/vsme/VSME-Digital-Template-1.3.0.xlsx',
  };

  it('reads a whole registration', () => {
    expect(readDigitalTemplateEntry(entry)).toEqual(entry);
    expect(digitalTemplateRefusal(entry)).toBeNull();
  });

  it.each([
    ['no payload', null],
    ['a taxonomy version that is not OQ-45’s date', { ...entry, taxonomyVersion: '1.3.0' }],
    ['a path rather than a file name', { ...entry, file: '../../seed/vsme-taxonomy.2026-05-01.json' }],
    ['a nested file', { ...entry, file: '1.3.0/VSME-Digital-Template-1.3.0.xlsx' }],
    ['a file that is not a workbook', { ...entry, file: 'VSME-Digital-Template-1.3.0.zip' }],
    ['a digest in capitals', { ...entry, sha256: entry.sha256.toUpperCase() }],
    ['a short digest', { ...entry, sha256: entry.sha256.slice(1) }],
    ['a source that is not https', { ...entry, source: 'http://xbrl.efrag.org/x.xlsx' }],
    ['a source that is not an address', { ...entry, source: 'EFRAG' }],
    ['a field missing', { taxonomyVersion: entry.taxonomyVersion, file: entry.file, sha256: entry.sha256 }],
  ])('reads nothing from %s, and publication refuses it', (_case, payload) => {
    expect(readDigitalTemplateEntry(payload)).toBeNull();
    expect(digitalTemplateRefusal(payload)).toMatch(/read whole$/);
  });
});
