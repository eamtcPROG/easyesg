'use client';

import { Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Dispatch } from 'react';
import type { Sheet } from '@/client/spreadsheet/sheet-cells';
import { IMPORT_EVENT, type ImportEvent } from '../../../tools/import-state';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * Which sheet of a workbook is read (task 204.2; FR-211's inputs) — asked only where there is more than one, by the
 * names the workbook gives them. Choosing another forgets what was chosen for the last: its columns are not this one's.
 */
export function ImportSheetChoice({
  sheets,
  sheet,
  dispatch,
}: {
  readonly sheets: readonly Sheet[];
  readonly sheet: number;
  readonly dispatch: Dispatch<ImportEvent>;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  if (sheets.length <= 1) return null;
  return (
    <Select
      label={t('sheet')}
      help={t('sheetHelp')}
      value={String(sheet)}
      onValueChange={(value) => dispatch({ type: IMPORT_EVENT.SHEET_CHOSEN, sheet: Number(value) })}
      options={sheets.map((each, index) => ({ value: String(index), label: each.name ?? String(index + 1) }))}
    />
  );
}
