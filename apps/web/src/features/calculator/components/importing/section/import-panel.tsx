'use client';

import type { CalcFactorSource, CalcSite } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { memo, useCallback, useEffect, useId, useReducer } from 'react';
import { loadSpreadsheetReaders, readSpreadsheet, SPREADSHEET_OUTCOME } from '@/client/spreadsheet/read-spreadsheet';
import { IMPORT_LIMITS } from '../../../tools/import-plan';
import { IMPORT_EVENT, IMPORT_STAGE, importReducer, INITIAL_IMPORT_STATE } from '../../../tools/import-state';
import styles from '../../styles/calculator.module.css';
import { ImportFile } from '../choosing/import-file';
import { ImportMapping } from '../mapping/import-mapping';
import type { ImportedLines } from '../shared/imported-lines';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * *Import from a spreadsheet* on S-09 (task 204.2; FR-211, UC-215; `architecture.md` §12.5.6's task-204 row): the
 * panel's state and the one thing no part can do — read the file the reporter chose — then the arm for where it
 * stands: choosing a file (or reading it), or mapping the sheet read.
 *
 * **Nothing is written from here.** The lines the reporter imports are handed to the board, which puts each in the
 * wizard's queue under a fresh id exactly as *Add a source* does; until then the import has changed nothing, and
 * cancelling at any point leaves S-09 as it was.
 *
 * **Memoized, with the board's callbacks stable, for one reason**: the board re-renders whenever the queue moves —
 * each acknowledgement while an import's lines flush, each keystroke elsewhere on S-09 — and the mapping arm
 * re-derives its table, its matches and its plan from every row of the sheet on every render it gets. With the props
 * unchanged, those renders stop here; the panel's own choices still re-render it, which is when the plan moves.
 */
function ImportPanelSection({
  sources,
  sites,
  onImport,
  onCancel,
}: {
  readonly sources: readonly CalcFactorSource[];
  readonly sites: readonly CalcSite[];
  readonly onImport: (imported: ImportedLines) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  const headingId = useId();
  const [state, dispatch] = useReducer(importReducer, INITIAL_IMPORT_STATE);

  // The readers are fetched when the import opens (§12.5.6's task-204 row (1)), so a file chosen after the connection
  // goes is still read, and its lines wait in the queue.
  useEffect(() => {
    void loadSpreadsheetReaders();
  }, []);

  // `dispatch` is stable, so this needs no dependency; the file input observes its identity through `FileUpload`.
  const choose = useCallback((file: File) => {
    dispatch({ type: IMPORT_EVENT.FILE_CHOSEN, fileName: file.name });
    void readSpreadsheet({ file, maxBytes: IMPORT_LIMITS.MAX_BYTES }).then((read) =>
      dispatch(
        read.kind === SPREADSHEET_OUTCOME.READ
          ? { type: IMPORT_EVENT.FILE_READ, sheets: read.sheets }
          : { type: IMPORT_EVENT.FILE_REFUSED, refusal: read.refusal },
      ),
    );
  }, []);

  return (
    <section className={styles.adding} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.addingHeading}>
        {t('heading')}
      </h2>
      <p className={styles.importingLede}>{t('lede')}</p>
      {state.stage === IMPORT_STAGE.MAPPING ? (
        <ImportMapping
          mapping={state}
          sources={sources}
          sites={sites}
          dispatch={dispatch}
          onImport={onImport}
          onCancel={onCancel}
        />
      ) : (
        <ImportFile stage={state} onFile={choose} onCancel={onCancel} />
      )}
    </section>
  );
}

export const ImportPanel = memo(ImportPanelSection);
