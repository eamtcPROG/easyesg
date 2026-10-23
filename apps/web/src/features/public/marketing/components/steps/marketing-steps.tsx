import { getTranslations } from 'next-intl/server';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { BAND_SURFACE, MarketingBand } from '../shared/marketing-band';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './steps.module.css';

/**
 * *How it works* — S-29's *"how the work is sequenced"*: the four steps from the company to the export, as an ordered
 * list, since the order is the content.
 */
const STEPS = ['company', 'answer', 'check', 'export'] as const;

export async function MarketingSteps() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.steps`);

  return (
    <MarketingBand
      id={MARKETING_ANCHOR.HOW_IT_WORKS}
      surface={BAND_SURFACE.SUNKEN}
      eyebrow={t('eyebrow')}
      title={t('title')}
      lede={t('lede')}
    >
      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step} className={styles.step}>
            <h3 className={`t-heading-3 ${styles.title}`}>{t(`${step}.title`)}</h3>
            <p className={`t-body ${styles.body}`}>{t(`${step}.body`)}</p>
          </li>
        ))}
      </ol>
    </MarketingBand>
  );
}
