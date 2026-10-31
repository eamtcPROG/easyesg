import { Breadcrumb, type BreadcrumbStep } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import styles from './help-page.module.css';

/**
 * The bar beneath the chrome on an article and on the request to support (task 227; artboards 03 and 04) — the way
 * back as `packages/ui`'s Breadcrumb at its start, *Help centre / …*, and the screen's own controls at its end. **Read
 * by S-33 and S-34**, so in the help's `shared/`; each hands it its own trail and controls.
 */
export async function HelpTrail({
  trail,
  current,
  children,
}: {
  /** The way back, outermost first — the help centre, then a topic where there is one. */
  readonly trail: readonly BreadcrumbStep[];
  /** This page, drawn last. */
  readonly current: ReactNode;
  /** The screen's controls at the bar's end. */
  readonly children?: ReactNode;
}) {
  const t = await getTranslations('chrome.breadcrumb');

  return (
    <div className={styles.bar}>
      <div className={`${styles.inner} ${styles.barRow}`}>
        <Breadcrumb label={t('label')} trail={trail} current={current} linkComponent={Link} />
        {children === undefined ? null : <div className={styles.barEnd}>{children}</div>}
      </div>
    </div>
  );
}
