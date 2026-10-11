import { EXPORT_FORMAT, type ExportFormat } from '../constants/export.constants';

const EXTENSION: Readonly<Record<ExportFormat, string>> = { [EXPORT_FORMAT.PDF]: 'pdf', [EXPORT_FORMAT.XLSX]: 'xlsx' };

/**
 * Where an export's file is stored (task 44.2): under its organization, then its own id — so a retry writes over the
 * same object rather than leaving an orphan beside it, and an organization's files are one prefix, which is what its
 * erasure (FR-207) and its retention (§12.5.7) act on.
 */
export function exportObjectKey(input: {
  readonly organizationId: string;
  readonly exportId: string;
  readonly format: ExportFormat;
}): string {
  return `organizations/${input.organizationId}/exports/${input.exportId}.${EXTENSION[input.format]}`;
}
