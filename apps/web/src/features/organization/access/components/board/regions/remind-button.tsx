'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../../remind/shared/remind-messages';
import styles from '../../styles/access.module.css';

/**
 * The filter row's second button: it opens the reminder dialogue with nobody chosen (28 Sep 2026, project owner) — a
 * member's row opens the same dialogue with them chosen (`row-actions.tsx`).
 *
 * **Secondary beside the invitation's primary**: inviting is what the screen exists to do, reminding is occasional,
 * and one primary per region is the Button's rule. A button rather than a link to `?panel=remind` for the invitation
 * button's reason — the address moves in the browser, and a link would wait on a page whose read has not changed.
 *
 * **Offered whether or not a reminder can be sent**: the dialogue says when no report is open, as it does from a row.
 */
export function RemindButton() {
  const t = useTranslations(REMIND_MESSAGES);
  const { openReminder } = useAccess();

  return (
    <Button
      variant={BUTTON_VARIANT.SECONDARY}
      className={styles.toolbarButton}
      onClick={() => openReminder()}
    >
      {t('open')}
    </Button>
  );
}
