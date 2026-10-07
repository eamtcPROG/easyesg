'use client';

import { Button, BUTTON_VARIANT, FileUpload } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { SPREADSHEET_ACCEPT } from '@/client/spreadsheet/read-spreadsheet';
import { IMPORT_STAGE, type ImportState } from '../../../tools/import-state';
import styles from '../../styles/calculator.module.css';
import { IMPORT_MESSAGES } from '../shared/import-messages';

type Choosing = Exclude<ImportState, { readonly stage: typeof IMPORT_STAGE.MAPPING }>;

/**
 * The import's first arm (task 204.2; FR-211): §11.5's File upload, taking an `.xlsx` or a `.csv`, with the reason the
 * last file was refused beneath it in NFR-79's three parts — or, while a file is read, the pending state that says
 * which. The file is read in the browser; nothing here is sent anywhere.
 */
export function ImportFile({
  stage,
  onFile,
  onCancel,
}: {
  readonly stage: Choosing;
  readonly onFile: (file: File) => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  return (
    <>
      {stage.stage === IMPORT_STAGE.READING ? (
        <p className={styles.importingReading} role="status">
          {t('file.reading', { file: stage.fileName })}
        </p>
      ) : (
        <FileUpload
          label={t('file.label')}
          hint={t('file.hint')}
          browse={t('file.browse')}
          accept={SPREADSHEET_ACCEPT}
          onFile={onFile}
          error={stage.refusal === null ? undefined : t(`file.refused.${stage.refusal}`)}
        />
      )}
      <div className={styles.addingActions}>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </>
  );
}
