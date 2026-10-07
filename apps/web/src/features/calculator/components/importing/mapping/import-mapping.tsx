'use client';

import type { CalcFactorSource, CalcSite } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Dispatch } from 'react';
import { IMPORT_FIELD } from '../../../tools/import-columns';
import { IMPORT_PLAN } from '../../../tools/import-plan';
import { IMPORT_EVENT, IMPORT_STAGE, type ImportEvent, type ImportState } from '../../../tools/import-state';
import { wordsOf } from '../../../tools/import-text';
import { unitsOf } from '../../../tools/import-values';
import { importView } from '../../../tools/import-view';
import { CALCULATOR_MESSAGES } from '../../shared/calculator-messages';
import { useCalculatorWords } from '../../shared/use-calculator-words';
import styles from '../../styles/calculator.module.css';
import type { ImportedLines } from '../section/import-panel';
import { IMPORT_MESSAGES } from '../shared/import-messages';
import { ImportColumnChoices } from './import-column-choices';
import { ImportReport } from './import-report';
import { ImportSheetChoice } from './import-sheet-choice';
import { ImportValueMatches } from './import-value-matches';

type Mapping = Extract<ImportState, { readonly stage: typeof IMPORT_STAGE.MAPPING }>;

/**
 * The import's second arm (task 204.2; FR-211; `architecture.md` §12.5.6's task-204 row (2), (4)): the file read, the
 * sheet, the columns, the values, what the import will do — and the two ways out.
 *
 * **The view is computed here, once** (`importView`), so the selects, the report and the count on the import button
 * read one answer. The options a value is matched to are the names S-09 already shows: a source and a unit as the
 * board words them, a site by its B1 name. **The columns and values are not asked while the sheet cannot be imported
 * at all** — an empty sheet or one over the row limit says so, and offers another sheet or file instead.
 */
export function ImportMapping({
  mapping,
  sources,
  sites,
  dispatch,
  onImport,
  onCancel,
}: {
  readonly mapping: Mapping;
  readonly sources: readonly CalcFactorSource[];
  readonly sites: readonly CalcSite[];
  readonly dispatch: Dispatch<ImportEvent>;
  readonly onImport: (imported: ImportedLines) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  const tSites = useTranslations(`${CALCULATOR_MESSAGES}.sites`);
  const { sourceName, unitName } = useCalculatorWords();

  const options = {
    [IMPORT_FIELD.SOURCE]: sources.map((source) => ({ value: source.key, label: sourceName(source.key) })),
    [IMPORT_FIELD.UNIT]: unitsOf(sources).map((code) => ({ value: code, label: unitName(code) })),
    [IMPORT_FIELD.SITE]: sites.map((site) => ({
      value: String(site.ordinal),
      label: site.name ?? tSites('unnamed', { position: site.ordinal + 1 }),
    })),
  };
  const view = importView({
    rows: mapping.sheets[mapping.sheet].rows,
    chosen: mapping,
    words: {
      [IMPORT_FIELD.SOURCE]: wordsOf(t('columns.source.words')),
      [IMPORT_FIELD.FIGURE]: wordsOf(t('columns.figure.words')),
      [IMPORT_FIELD.UNIT]: wordsOf(t('columns.unit.words')),
      [IMPORT_FIELD.SITE]: wordsOf(t('columns.site.words')),
      [IMPORT_FIELD.DESCRIPTION]: wordsOf(t('columns.description.words')),
    },
    options,
    sources,
    sites,
  });
  const lines = view.plan.kind === IMPORT_PLAN.READY ? view.plan.lines : [];

  return (
    <>
      <div className={styles.importingFile}>
        <p className={styles.importingFileName}>{t('chosen', { file: mapping.fileName })}</p>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => dispatch({ type: IMPORT_EVENT.ANOTHER_FILE })}>
          {t('anotherFile')}
        </Button>
      </div>
      <ImportSheetChoice sheets={mapping.sheets} sheet={mapping.sheet} dispatch={dispatch} />
      {view.table === null || view.plan.kind === IMPORT_PLAN.REFUSED ? null : (
        <>
          <ImportColumnChoices headers={view.table.headers} columns={view.columns} sites={sites.length} dispatch={dispatch} />
          <ImportValueMatches matches={view.matches} options={options} dispatch={dispatch} />
        </>
      )}
      <ImportReport plan={view.plan} />
      <div className={styles.addingActions}>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          disabled={lines.length === 0}
          onClick={() => onImport({ lines, file: mapping.fileName })}
        >
          {t('submit', { lines: lines.length })}
        </Button>
      </div>
    </>
  );
}
