import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { BAND_SURFACE, MarketingBand } from '../shared/marketing-band';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './faq.module.css';

/**
 * *Before you sign up* — the questions a visitor asks before spending an email address on the platform, S-29's
 * *Purpose*, each answered in place.
 *
 * **The home's route to the help centre** (S-29's *Controls*, FR-204's AC-2) is in this band's lede, as the artboard
 * puts it. The public header carries no help entry yet: its docblock leaves that to the help centre's own task, and
 * until then the centre answers *not yet available* with a way back (task 103), as the footer's links did before their
 * documents existed.
 */
const QUESTIONS = ['accountant', 'time', 'missing', 'filed', 'nextYear', 'colleagues'] as const;

export async function MarketingFaq() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.faq`);

  return (
    <MarketingBand
      id={MARKETING_ANCHOR.BEFORE_SIGNING_UP}
      surface={BAND_SURFACE.SUNKEN}
      eyebrow={t('eyebrow')}
      title={t('title')}
      lede={t.rich('lede', {
        help: (chunks: ReactNode) => <Link href={ROUTES.HELP_CENTRE}>{chunks}</Link>,
      })}
    >
      <div className={styles.questions}>
        {QUESTIONS.map((question) => (
          <div key={question} className={styles.question}>
            <h3 className={`t-heading-3 ${styles.asked}`}>{t(`${question}.question`)}</h3>
            <p className={`t-body ${styles.answer}`}>{t(`${question}.answer`)}</p>
          </div>
        ))}
      </div>
    </MarketingBand>
  );
}
