import { BUTTON_TONE, Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './closing.module.css';

/**
 * The closing call — S-29's exits to S-01, register and sign in, at the foot of the page a visitor has just read, on
 * the hero's band so the page ends where it began.
 *
 * **The two controls are worded as the public header words them** (`chrome.publicHeader`), being the same two
 * destinations: a visitor should not meet two names for one door on one page.
 */
export async function MarketingClosing() {
  const [t, tHeader] = await Promise.all([
    getTranslations(`${MARKETING_MESSAGES}.closing`),
    getTranslations('chrome.publicHeader'),
  ]);

  return (
    <section aria-labelledby="closing-heading" className={styles.band}>
      <div className={styles.lead}>
        <h2 id="closing-heading" className={`t-heading-1 ${styles.title}`}>
          {t('title')}
        </h2>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        <div className={styles.actions}>
          <Button asChild tone={BUTTON_TONE.BAND}>
            <Link href={ROUTES.REGISTER}>{tHeader('register')}</Link>
          </Button>
          <Link className={styles.link} href={ROUTES.SIGN_IN}>
            {tHeader('signIn')}
          </Link>
        </div>
      </div>
    </section>
  );
}
