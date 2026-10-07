'use client';

import { Fieldset, Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Dispatch } from 'react';
import { columnLetter, columnOfSelect, NO_CHOICE, selectValueOf } from '../../../tools/import-choice';
import { IMPORT_FIELD, IMPORT_FIELDS, requiredFields, type ColumnChoice } from '../../../tools/import-columns';
import { IMPORT_EVENT, type ImportEvent } from '../../../tools/import-state';
import styles from '../../styles/calculator.module.css';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * Which column holds what (task 204.2; FR-211's behaviour 2): one select per field, offering the sheet's columns by
 * the names its first row gives them — or, where that row leaves one blank, by the letter the spreadsheet shows — and
 * *not in the file*. Each starts at the panel's proposal. **The site is asked only of a report holding more than
 * one**; a column a line cannot be made without says so beneath it while it is not chosen.
 */
export function ImportColumnChoices({
  headers,
  columns,
  sites,
  dispatch,
}: {
  readonly headers: readonly string[];
  readonly columns: ColumnChoice;
  readonly sites: number;
  readonly dispatch: Dispatch<ImportEvent>;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  const required = requiredFields(sites);
  const options = [
    ...headers.map((header, column) => {
      const letter = t('columns.unnamed', { letter: columnLetter(column) });
      return header === ''
        ? { value: String(column), label: letter }
        : { value: String(column), label: header, description: letter };
    }),
    { value: NO_CHOICE, label: t('columns.none') },
  ];

  return (
    <Fieldset legend={t('columns.legend')}>
      <p className={styles.importingHelp}>{t('columns.help')}</p>
      <div className={styles.importingChoices}>
        {IMPORT_FIELDS.filter((field) => field !== IMPORT_FIELD.SITE || sites > 1).map((field) => (
          <Select
            key={field}
            label={t(`columns.${field}.label`)}
            value={selectValueOf(columns[field])}
            onValueChange={(value) => dispatch({ type: IMPORT_EVENT.COLUMN_CHOSEN, field, column: columnOfSelect(value) })}
            options={options}
            error={required.includes(field) && columns[field] === null ? t('columns.required') : undefined}
          />
        ))}
      </div>
    </Fieldset>
  );
}
