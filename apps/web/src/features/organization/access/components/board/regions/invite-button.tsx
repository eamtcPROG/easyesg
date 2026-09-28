'use client';

import { Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAccess } from '../../shared/access-context';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import styles from '../../styles/access.module.css';

/**
 * The filter row's other end: the button that opens the invitation dialogue (28 Sep 2026, project owner
 * — beside the filters, where the artboard draws it under the seat counter instead).
 *
 * **A button, not a link to `?panel=invite`**, although that is the address it opens: a link would ask
 * the server for a page whose read has not changed, and the dialogue would wait on it. The provider moves
 * the address in the browser (`access-panel.ts`), so a reload still reopens what this opened.
 *
 * **Offered at every seat standing.** At the ceiling the dialogue carries the gate in the form's place,
 * which says why no invitation can be sent and what frees a seat — a withheld button would say neither.
 */
export function InviteButton() {
  const t = useTranslations(`${ACCESS_MESSAGES}.invite`);
  const { openInvite } = useAccess();

  return (
    <Button className={styles.inviteButton} onClick={openInvite}>
      {t('open')}
    </Button>
  );
}
