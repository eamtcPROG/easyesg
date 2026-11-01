import type { Locale } from '@easyesg/i18n';
import { EXPORT_EXTENSION, type ExportFormat } from '../constants/export.constants';

/** Characters no file system keeps in a name, and control characters (`\p{Cc}`). */
const UNSAFE = /[\\/:*?"<>|\p{Cc}]+/gu;

/**
 * The name a re-downloaded file is saved under (task 47.1): the undertaking, the standard, the fiscal year and the
 * file's language — `Brutăria de Aur VSME 2026 ro.pdf` — so two files of one report in two languages do not overwrite
 * each other in a downloads folder. Characters a file system refuses are dropped, and the name is never empty.
 */
export function exportFileName(input: {
  readonly entityName: string;
  readonly fiscalYear: number;
  readonly locale: Locale;
  readonly format: ExportFormat;
}): string {
  const entity = input.entityName.replace(UNSAFE, ' ').replace(/\s+/gu, ' ').trim();
  const stem = [entity, 'VSME', String(input.fiscalYear), input.locale].filter((part) => part !== '').join(' ');
  return `${stem}.${EXPORT_EXTENSION[input.format]}`;
}

/**
 * The `Content-Disposition` header for it (RFC 6266): an ASCII fallback for old clients, and the name itself in
 * UTF-8 (RFC 8187) for the rest, since an undertaking's name is usually Romanian.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.normalize('NFKD').replace(/[^\x20-\x7e]/gu, '').replace(/["\\]/gu, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
