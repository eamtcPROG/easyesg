import { Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import type { ResumableRow } from '../../../tools/overview';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The resume card's `partial` arm (§8.1; task 255): the overview knew which report to resume, and its modules could
 * not be read. **The way back survives the failure** — the report's own address resolves where work stopped without
 * this card's help — so the card says what it cannot show, keeps the sentence task 32.4 drew, and still offers to
 * continue, rather than replacing the region's one action with an error.
 */
export async function ResumeCardUnreachable({ row }: { readonly row: ResumableRow }) {
  const t = await getTranslations(`${OVERVIEW_MESSAGES}.resume`);

  return (
    <div className={`${styles.card} ${styles.emphatic} ${styles.cardInset}`}>
      <div className={styles.resumeFoot}>
        <p className={`t-body ${styles.resumeSentence}`}>
          {t('body', { entity: row.entityName, year: String(row.fiscalYear) })} {t('unreachable')}
        </p>
        <div className={styles.resumeActions}>
          <Button asChild>
            <Link href={reportRoute(row.reportId)}>{t('continueReport')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
