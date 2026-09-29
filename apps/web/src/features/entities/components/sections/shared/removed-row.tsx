'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import styles from '../../styles/entities.module.css';

/**
 * A stored row the reader has removed, collapsed to one line until the save — what will happen, and the undo
 * (project owner, 28 Sep 2026). In `shared/` because the sites and the boundary both draw it.
 *
 * **It takes focus when it appears**, because it appears only when the reader presses *remove* on the row it replaces:
 * the form's defaults hold no removed row, a discard clears every mark and a save sends none back. So mounting is that
 * press, and the undo is where the reader's focus was.
 *
 * **The undo's accessible description is the sentence**, so a screen reader moving between two of them hears which
 * removal each takes back.
 */
export function RemovedRow({
  sentence,
  onRestoreAction,
}: {
  /** What the save will do to this row, in the caller's words. */
  readonly sentence: string;
  readonly onRestoreAction: () => void;
}) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.rows`);
  const sentenceId = useId();
  const undo = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    undo.current?.focus();
  }, []);

  return (
    <li className={styles.removedRow}>
      <p id={sentenceId} className={`t-body ${styles.removedSentence}`}>
        {sentence}
      </p>
      <Button
        ref={undo}
        type="button"
        variant={BUTTON_VARIANT.SUBTLE}
        className={styles.removedUndo}
        aria-describedby={sentenceId}
        onClick={onRestoreAction}
      >
        {t('undo')}
      </Button>
    </li>
  );
}
