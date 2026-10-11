import { EXPORT_FORMAT } from '../constants/export.constants';
import { exportObjectKey } from './export-object-key';

describe('exportObjectKey (task 44.2)', () => {
  it('keeps an organization’s files under one prefix and names a file by its export', () => {
    expect(
      exportObjectKey({ organizationId: 'org-1', exportId: 'export-9', format: EXPORT_FORMAT.PDF }),
    ).toBe('organizations/org-1/exports/export-9.pdf');
  });

  it('names an Excel export’s file by its own extension (task 46)', () => {
    expect(exportObjectKey({ organizationId: 'org-1', exportId: 'export-9', format: EXPORT_FORMAT.XLSX })).toBe(
      'organizations/org-1/exports/export-9.xlsx',
    );
  });
});
