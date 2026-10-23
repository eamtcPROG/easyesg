import { getTranslations } from 'next-intl/server';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { BAND_SURFACE, MarketingBand } from '../shared/marketing-band';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import { BASIC_MODULES } from '../../tools/basic-modules';
import styles from './sections.module.css';

/**
 * *The questions* — S-29's *"the eleven Basic sections named"*, the hero's *See the questions first* lands here.
 *
 * **Each section is named as the exported report names it** (`reportModules`, the shared catalogue's own words), with
 * the home's one sentence on what it asks beside it, so the page cannot promise a section the report calls something
 * else. The code stays visible because the wizard, the export and every finding show it too.
 */
export async function MarketingSections() {
  const [t, tModules] = await Promise.all([
    getTranslations(`${MARKETING_MESSAGES}.sections`),
    getTranslations('reportModules'),
  ]);

  return (
    <MarketingBand
      id={MARKETING_ANCHOR.QUESTIONS}
      surface={BAND_SURFACE.DEFAULT}
      eyebrow={t('eyebrow')}
      title={t('title')}
      lede={t('lede')}
    >
      <ol className={styles.sections}>
        {BASIC_MODULES.map((code) => (
          <li key={code} className={styles.section}>
            <span className={styles.code}>{code}</span>
            <span className={styles.words}>
              <span className={`t-body-strong ${styles.name}`}>{tModules(code)}</span>
              <span className={`t-body ${styles.about}`}>{t(`about.${code}`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={`t-body ${styles.note}`}>{t('notMaterial')}</p>
    </MarketingBand>
  );
}
