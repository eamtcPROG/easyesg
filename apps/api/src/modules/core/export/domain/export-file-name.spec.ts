import { attachmentDisposition, exportFileName } from './export-file-name';

/** The re-download's file name (task 47.1): the undertaking, the year and the language, safe for any file system. */
describe('exportFileName', () => {
  it('names the undertaking, the standard, the year and the language', () => {
    expect(exportFileName({ entityName: 'Brutăria de Aur', fiscalYear: 2026, locale: 'ro', format: 'pdf' })).toBe('Brutăria de Aur VSME 2026 ro.pdf');
    expect(exportFileName({ entityName: 'Brutăria de Aur', fiscalYear: 2026, locale: 'en', format: 'xlsx' })).toBe('Brutăria de Aur VSME 2026 en.xlsx');
  });

  it('drops what a file system refuses, and is never empty', () => {
    expect(exportFileName({ entityName: 'A/B: "C" <D>', fiscalYear: 2025, locale: 'ru', format: 'pdf' })).toBe('A B C D VSME 2025 ru.pdf');
    expect(exportFileName({ entityName: '///', fiscalYear: 2025, locale: 'ru', format: 'pdf' })).toBe('VSME 2025 ru.pdf');
  });
});

describe('attachmentDisposition', () => {
  it('carries an ASCII fallback and the UTF-8 name', () => {
    expect(attachmentDisposition('Brutăria de Aur VSME 2026 ro.pdf')).toBe(
      `attachment; filename="Brutaria de Aur VSME 2026 ro.pdf"; filename*=UTF-8''Brut%C4%83ria%20de%20Aur%20VSME%202026%20ro.pdf`,
    );
  });
});
