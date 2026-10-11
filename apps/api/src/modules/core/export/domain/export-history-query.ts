import { isLocale } from '@easyesg/i18n';
import { SORT_DIRECTION, type ListQueryInput } from '@api/contracts/types/list-query';
import { isExportFormat, isExportStatus } from '../constants/export.constants';
import { EXPORT_HISTORY_FILTER, EXPORT_HISTORY_SORT, type ExportHistoryQuery } from '../models/export-history-query.model';

/** A taxonomy version as the registry spells it — EFRAG's own `YYYY-MM-DD` (OQ-45). */
const TAXONOMY_VERSION = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * §6.8's compact list query, narrowed to what S-11's history can be asked (task 47.1) — **an unreadable value falls
 * back rather than refusing**, the notification centre's rule: a format, a language, a version or a status nobody produces is
 * dropped from its facet, and an ordering on anything but when it was asked for is newest first.
 */
export const toExportHistoryQuery = (input: {
  readonly reportId: string;
  readonly list: ListQueryInput;
  readonly fallbackTake: number;
}): ExportHistoryQuery => {
  const valuesOf = (field: string) => [...new Set(input.list.filters.find((filter) => filter.field === field)?.values ?? [])];
  const [ordering] = input.list.order;
  const ordered = ordering !== undefined && ordering.field === EXPORT_HISTORY_SORT.REQUESTED;
  return {
    reportId: input.reportId,
    formats: valuesOf(EXPORT_HISTORY_FILTER.FORMAT).filter(isExportFormat),
    locales: valuesOf(EXPORT_HISTORY_FILTER.LANGUAGE).filter(isLocale),
    taxonomyVersions: valuesOf(EXPORT_HISTORY_FILTER.TAXONOMY_VERSION).filter((value) => TAXONOMY_VERSION.test(value)),
    statuses: valuesOf(EXPORT_HISTORY_FILTER.STATUS).filter(isExportStatus),
    newestFirst: ordered ? ordering.direction === SORT_DIRECTION.DESC : true,
    skip: Math.max(0, input.list.skip),
    take: input.list.take ?? input.fallbackTake,
  };
};
