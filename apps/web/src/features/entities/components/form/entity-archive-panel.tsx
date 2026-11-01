'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * The record's side column — *Archive, never delete*, as the S-13 artboard draws it beside the record (UC-55, FR-20;
 * 28 Sep 2026). The action sits with the sentence that says what survives it, before the consequence dialogue says it
 * again at the point of no return (UX-69, UX-70).
 *
 * **Drawn only for a stored, active entity**: an unsaved one has nothing to archive and an archived one nothing left
 * to archive, and a panel offering neither would be a column of refusals.
 */
export function EntityArchivePanel({ onArchiveRequestedAction }: { readonly onArchiveRequestedAction: () => void }) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.archive`);
  const headingId = useId();

  return (
    <section className={styles.sidePanel} aria-labelledby={headingId}>
      <h2 id={headingId} className={`t-heading-3 ${styles.sidePanelTitle}`}>
        {t('panelTitle')}
      </h2>
      <p className={`t-body ${styles.sidePanelBody}`}>{t('retained')}</p>
      <Button type="button" variant={BUTTON_VARIANT.DESTRUCTIVE} onClick={onArchiveRequestedAction}>
        {t('action')}
      </Button>
    </section>
  );
}
