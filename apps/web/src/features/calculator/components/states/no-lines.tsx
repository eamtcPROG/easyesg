'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * Empty — first use (§8.1; the artboard's 8.7, *"the empty one does the most work"*): it has to teach that the bills are
 * enough — the three bills to hand, the way to start, and that a bill nobody has is still answered, with a reason.
 *
 * **The calculator's own block rather than `EmptyState`**, which takes its body as one paragraph: the artboard draws a
 * numbered list of bills, a different anatomy, and a component only this screen needs is this app's (UX-89 as amended
 * 14 Sep 2026). `role="status"` for `EmptyState`'s reason — a resolved state, never an interruption.
 */
export function NoLines({ readOnly, onStart }: { readonly readOnly: boolean; readonly onStart: () => void }) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.empty`);
  const tAdd = useTranslations(`${CALCULATOR_MESSAGES}.add`);
  return (
    <div className={styles.empty} role="status">
      <p className={`t-heading-3 ${styles.emptyTitle}`}>{t('title')}</p>
      <p className="t-body">{t('body')}</p>
      <ol className={styles.bills}>
        <li>{t('electricity')}</li>
        <li>{t('gas')}</li>
        <li>{t('fuel')}</li>
      </ol>
      <p className="t-body">{t('note')}</p>
      {readOnly ? null : (
        <div>
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onStart}>
            {tAdd('open')}
          </Button>
        </div>
      )}
    </div>
  );
}
