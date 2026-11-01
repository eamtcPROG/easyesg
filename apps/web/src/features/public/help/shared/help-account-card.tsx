import { Button, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import styles from './help-page.module.css';

/**
 * A visitor's way into an account (task 227) — artboard 02's *Reading it is one thing*, which artboard 03's note puts
 * in place of *Apply this to your report* on an article a visitor reads. **Read by S-32 and S-33**, so in the help's
 * `shared/`. It says what an account adds and promises nothing the platform has not decided — the artboard's *your
 * first report is free* is a fact no document states (the task-227 row (3)).
 */
export async function HelpAccountCard() {
  const t = await getTranslations('help.account');

  return (
    <section aria-labelledby="help-account" className={`${styles.card} ${styles.lead}`}>
      <div className={styles.cardHead}>
        <h2 id="help-account" className="t-heading-3">
          {t('title')}
        </h2>
        <p className={`t-caption ${styles.body}`}>{t('body')}</p>
      </div>
      <div className={styles.cardBody}>
        <Button asChild>
          <Link href={ROUTES.REGISTER}>{t('register')}</Link>
        </Button>
        <p className={`t-caption ${styles.muted}`}>
          {t.rich('signIn', {
            link: (words) => (
              <TextLink asChild>
                <Link href={ROUTES.SIGN_IN}>{words}</Link>
              </TextLink>
            ),
          })}
        </p>
      </div>
    </section>
  );
}
