import { getTranslations } from 'next-intl/server';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { BAND_SURFACE, MarketingBand } from '../shared/marketing-band';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import { AnsweringFigure } from './answering-figure';
import styles from './answering.module.css';

/**
 * *What answering looks like* — S-29's *"what is asked before signing up"*, shown rather than told: what every
 * question comes with, beside three questions as the wizard draws them.
 */
const POINTS = ['units', 'prior', 'zero', 'attributed'] as const;

export async function MarketingAnswering() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.answering`);

  return (
    <MarketingBand
      id={MARKETING_ANCHOR.ANSWERING}
      surface={BAND_SURFACE.TINT}
      eyebrow={t('eyebrow')}
      title={t('title')}
      lede={t('lede')}
    >
      <div className={styles.layout}>
        <ul className={styles.points} aria-label={t('points.label')}>
          {POINTS.map((point) => (
            <li key={point} className={`t-body ${styles.point}`}>
              {t(`points.${point}`)}
            </li>
          ))}
        </ul>
        <AnsweringFigure />
      </div>
    </MarketingBand>
  );
}
