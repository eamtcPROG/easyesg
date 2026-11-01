'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { FigureOverrideForm } from '../shared/figure-override-form';
import styles from '../styles/calculator.module.css';

/**
 * One invoice line's tonnes replaced with the reporter's own, and why (task 39.3; UC-34's line granularity, UX-43; the
 * artboard's 8.5 *"the substitution, in place on the row"*). **The computed figure stays beside the substitute** with
 * the reason and, since task 39.4, the person who made it (FR-36), and putting the computed one back is one action.
 *
 * **It rides the line's own write**, through the wizard's queue (§12.5.6's task-39 row (2)): a line override is an input,
 * copied into every run and reproduced by its replay (§12.5.6's task-38.4 row (4)), so it is written whole with the line
 * and sent on reconnection like any of its fields. Whether the form is open is one value nothing else moves with.
 */
export function LineOverride({
  substitute,
  computed,
  readOnly,
  onWrite,
}: {
  /**
   * The reporter's tonnes and their reason, where they stand — `null` where the computed figure does — and the name of
   * whoever made the substitution (task 39.4), `null` where the server has not said or the account is gone.
   */
  readonly substitute: { readonly tonnes: string; readonly reason: string; readonly by: string | null } | null;
  /** The line's computed tonnes, already rounded and worded for the reader — what a substitute supersedes. */
  readonly computed: string;
  readonly readOnly: boolean;
  /** The line written with this override, or with none. */
  readonly onWrite: (override: { readonly tonnesCo2e: string; readonly explanation: string } | null) => void;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.override`);
  const [open, setOpen] = useState(false);

  if (open && !readOnly) {
    return (
      <div className={styles.lineOverride}>
        <p className={styles.superseded}>{t('computed', { figure: computed })}</p>
        <FigureOverrideForm
          initial={substitute}
          pending={false}
          cancelLabel={substitute === null ? t('keep') : t('cancel')}
          onSubmit={(override) => {
            onWrite(override);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }
  if (substitute === null) {
    return readOnly ? null : (
      <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => setOpen(true)}>
        {t('replace')}
      </Button>
    );
  }
  return (
    <div className={styles.lineOverride}>
      <p>{t('replaced', { computed })}</p>
      {substitute.by === null ? null : <p className={styles.calculatedSource}>{t('by', { name: substitute.by })}</p>}
      <p className={styles.calculatedReason}>
        <span className={styles.noFigure}>{t('reasonLabel')}</span> {substitute.reason}
      </p>
      {readOnly ? null : (
        <div className={styles.lineActions}>
          <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => setOpen(true)}>
            {t('change')}
          </Button>
          <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => onWrite(null)}>
            {t('restore')}
          </Button>
        </div>
      )}
    </div>
  );
}
