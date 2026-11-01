import { getTranslations } from 'next-intl/server';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { BAND_SURFACE, MarketingBand } from '../shared/marketing-band';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './data.module.css';

/**
 * *Your data* — S-29's *"where the answers sit and who can see them"*. Four statements, each one a requirement the
 * platform already holds itself to rather than a promise made here: EU/EEA residency and encryption (NFR-27, NFR-13,
 * NFR-61), no publication (the public disclosure portal is Phase 3's, §15.1), support only when the organization grants
 * it and every grant recorded (FR-78, FR-79), and the export open to the organization (NFR-29).
 */
const STATEMENTS = ['eu', 'published', 'support', 'export'] as const;

export async function MarketingData() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.data`);

  return (
    <MarketingBand
      id={MARKETING_ANCHOR.YOUR_DATA}
      surface={BAND_SURFACE.DEFAULT}
      eyebrow={t('eyebrow')}
      title={t('title')}
    >
      <ul className={styles.statements}>
        {STATEMENTS.map((statement) => (
          <li key={statement} className={styles.statement}>
            <h3 className={`t-heading-3 ${styles.title}`}>{t(`${statement}.title`)}</h3>
            <p className={`t-body ${styles.body}`}>{t(`${statement}.body`)}</p>
          </li>
        ))}
      </ul>
    </MarketingBand>
  );
}
