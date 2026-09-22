'use client';

import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import styles from '../styles/panel.module.css';

/**
 * The panel's foot, as the artboard draws it (task 50.2.2): that read state is the reader's own (UX-64), and the way
 * to S-26 — *All notifications*. The artboard's *and preferences* half arrives with S-27 (task 52.3), the global
 * tier's rule that an entry arrives with its screen.
 */
export function PanelFooter() {
  const t = useTranslations(PANEL_MESSAGES);
  return (
    <div className={styles.footer}>
      <p className={styles.note}>{t('note')}</p>
      <TextLink asChild>
        <Link href={ROUTES.NOTIFICATIONS}>{t('all')}</Link>
      </TextLink>
    </div>
  );
}
