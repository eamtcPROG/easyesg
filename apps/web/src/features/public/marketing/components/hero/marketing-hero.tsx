import { BUTTON_TONE, Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import { HeroFigure } from './hero-figure';
import styles from './hero.module.css';

/**
 * S-29's opening band — what the platform produces and for whom, and the two ways on: register, or read the questions
 * first. On the band the public header stands on, continued, as the artboard draws the two as one pine field.
 *
 * **The page's one `<h1>`**, which is why the hero is not a `MarketingBand`: every other band is a section named by its
 * `<h2>`.
 *
 * **No cost and no plan term anywhere in it** (task 74.6; §12.5.6's task-182 public tier row, 182/118). The artboard's
 * *"Free until you export"* is a statement about what a plan grants, which task 53.1 versions — so it waits for the
 * pricing section that reads the published plan copy, rather than being a second source of truth here.
 */
export async function MarketingHero() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.hero`);

  return (
    <>
      <div className={styles.band}>
        <div className={styles.lead}>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1 className={`t-display ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
          <div className={styles.actions}>
            {/* The screen's primary action is a navigation — `asChild` over the locale-aware `Link`, as the header's. */}
            <Button asChild tone={BUTTON_TONE.BAND}>
              <Link href={ROUTES.REGISTER}>{t('start')}</Link>
            </Button>
            <a className={styles.link} href={`#${MARKETING_ANCHOR.QUESTIONS}`}>
              {t('questions')}
            </a>
          </div>
          <ul className={styles.assurances} aria-label={t('assurances')}>
            <li>{t('languages')}</li>
            <li>{t('nothingFiled')}</li>
          </ul>
        </div>
      </div>
      <div className={styles.stage}>
        <HeroFigure />
      </div>
    </>
  );
}
